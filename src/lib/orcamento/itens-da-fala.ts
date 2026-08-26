import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Da fala para a tabela.
 *
 * Substitui a etapa de perguntas. O desenho anterior transformava o que estava
 * faltando numa lista de perguntas para responder antes de ver qualquer coisa;
 * este monta a tabela com o que dá e deixa o buraco visível **como linha**, em
 * branco na coluna que falta. É mais rápido e mais honesto com o jeito de
 * trabalhar: o Reginato prefere corrigir uma tabela pronta a preencher
 * formulário.
 *
 * As regras que não mudam:
 *
 * - **Preço não falado é `null`**, nunca estimado. `0` sairia impresso como
 *   "de graça"; `null` aparece como "sem preço" e bloqueia a publicação.
 * - **Quantidade não falada é `null`.** "A sala toda" não vira 30 m².
 * - Custo pode vir da base de preços — isso é consulta, não invenção, e o
 *   item guarda de qual composição veio.
 */

const MODELO = process.env.ANALYSIS_MODEL ?? "llama-3.3-70b-versatile";

/**
 * Teto da chamada à IA. Medido: geração normal leva de 2 a 4 segundos.
 *
 * Abaixo do limite de execução da função, com folga para gravar o erro e
 * responder — timeout que estoura junto com a função não chega ao aparelho.
 */
const TETO_DA_IA = 35_000;

const INSTRUCOES = `Você transforma a fala de um empreiteiro brasileiro em linhas de uma tabela de orçamento de obra.

Ele descreveu o serviço falando, e a fala foi transcrita automaticamente. A transcrição erra números, unidades de medida e termos técnicos de construção.

Sua tarefa: quebrar o que ele contou em ITENS de orçamento, um por linha de serviço ou material.

REGRAS ABSOLUTAS — quebrar qualquer uma destas estraga o orçamento:

1. NUNCA invente preço. Se ele não falou o valor daquele item, "valorUnitario" e "custoUnitario" ficam null. Não estime, não use "preço de mercado", não chute.
2. NUNCA invente quantidade. Se ele não deu o número, "quantidade" fica null. "A sala toda", "aquela parede" e "uns metros" NÃO viram número.
3. Só escreva o que ele disse. Não acrescente serviço que "normalmente vai junto".

COMO QUEBRAR EM ITENS:
- Um item por serviço distinto. "Trocar o telhado e botar forro" são dois itens, não um.
- Material e mão de obra do mesmo serviço ficam no MESMO item, salvo se ele separou.
- Use "grupo" para juntar itens da mesma frente ("1. Cobertura", "2. Forro"). Numere na ordem em que ele falou.
- "unidade" é a medida do serviço: m², m, un, vb (verba), dia. Se ele não disse e a unidade for óbvia pelo serviço (forro é m², porta é un), pode preencher. Se não for óbvia, deixe null.
- "descricao" é curta e técnica, do jeito que vai no orçamento do cliente: "Forro de PVC branco, com acabamento em roda-forro". Não escreva "o cliente quer" nem "ela pediu".
- "observacao" recebe a condição ou premissa que ele mencionou para aquele item ("cliente fornece o material", "confirmar se entra calha"). Null quando não houver.

Se ele falou um preço, coloque em "valorUnitario" — é o que ele vai cobrar. "custoUnitario" só se ele disse explicitamente que aquilo é o custo dele.

Responda SOMENTE com um objeto JSON válido, sem markdown:

{
  "itens": [
    { "grupo": "1. Cobertura", "descricao": "...", "quantidade": 120, "unidade": "m²", "valorUnitario": null, "custoUnitario": null, "observacao": null }
  ],
  "entendido": "2 a 4 frases resumindo o serviço como você entendeu, para ele conferir se a transcrição não distorceu nada",
  "faltando": ["o que ficou sem número ou sem preço, uma linha cada, para ele saber o que completar"]
}`;

export type ItemGerado = {
  grupo: string | null;
  descricao: string;
  quantidade: number | null;
  unidade: string | null;
  valorUnitario: number | null;
  custoUnitario: number | null;
  observacao: string | null;
};

export type SaidaDaMontagem =
  | { ok: true; criados: number; entendido: string; faltando: string[] }
  | { ok: false; erro: string };

/**
 * O material de **uma** fala.
 *
 * Recebe o `blocoId` porque a alternativa já foi tentada e produziu o pior bug
 * do módulo: a versão anterior lia todos os blocos do orçamento, sem filtro.
 * Isso funcionava para "um briefing, uma geração", mas o fluxo real é
 * incremental — o empreiteiro fala um serviço por vez. A cada nova fala a IA
 * relia a conversa inteira e reescrevia tudo, e o insert acrescentava. Medido:
 * 8 falas viraram 52 itens onde deviam ser 13, e o total geral saiu 3,74× maior
 * que o real.
 *
 * Os grupos que já existem entram como **referência de numeração**, nunca como
 * itens a reescrever. Sem isso a segunda fala abriria outro "1. Cobertura".
 */
async function montarMaterial(
  orcamentoId: string,
  blocoId: string,
): Promise<string | null> {
  const sb = supabaseAdmin();

  const { data: orcamento } = await sb
    .from("orc_orcamentos")
    .select("cliente_nome, objeto, endereco")
    .eq("id", orcamentoId)
    .maybeSingle();
  if (!orcamento) return null;

  // O `eq` no orçamento não é redundante com o `eq` no id: é o que impede um
  // bloco de outro orçamento de ser processado aqui se o id vier trocado.
  const { data: bloco } = await sb
    .from("orc_blocos")
    .select("id, type, text_content")
    .eq("id", blocoId)
    .eq("orcamento_id", orcamentoId)
    .maybeSingle();
  if (!bloco) return null;

  let fala: string | null = null;

  if (bloco.type === "text") {
    fala = bloco.text_content?.trim() || null;
  } else if (bloco.type === "audio") {
    const { data: transcricao } = await sb
      .from("orc_transcricoes")
      .select("text")
      .eq("bloco_id", bloco.id)
      .eq("status", "done")
      .maybeSingle();
    fala = transcricao?.text?.trim() || null;
  }

  if (!fala) return null;

  const { data: existentes } = await sb
    .from("orc_itens")
    .select("grupo")
    .eq("orcamento_id", orcamentoId)
    .is("removido_em", null)
    .not("grupo", "is", null);

  const grupos = [
    ...new Set((existentes ?? []).map((i) => i.grupo).filter(Boolean)),
  ] as string[];

  const linhas: string[] = [`CLIENTE: ${orcamento.cliente_nome}`];
  if (orcamento.objeto) linhas.push(`SERVIÇO: ${orcamento.objeto}`);
  if (orcamento.endereco) linhas.push(`LOCAL: ${orcamento.endereco}`);

  if (grupos.length > 0) {
    linhas.push(
      "",
      "GRUPOS QUE JÁ EXISTEM NA TABELA (contexto, não conteúdo):",
      ...grupos.map((g) => `- ${g}`),
      "Se o serviço novo pertencer a um destes, use o mesmo nome de grupo. Se for uma frente nova, numere a partir do maior. NÃO escreva itens para estes grupos — eles já estão na tabela.",
    );
  }

  linhas.push(
    "",
    "O QUE O EMPREITEIRO ACABOU DE FALAR — é SÓ isto que vira item:",
    fala,
  );

  return linhas.join("\n");
}

/**
 * Procura o custo de cada item na base de preços ativa.
 *
 * Consultar a tabela do próprio empreiteiro não é inventar preço — é o oposto
 * disso. O item guarda de qual composição veio, e o custo entra como cópia
 * (não referência ao vivo), pela mesma razão de sempre: reimportar a base não
 * pode mudar o número debaixo de um orçamento já montado.
 *
 * O corte em 0,55 é deliberadamente alto. Casamento errado é pior que
 * casamento nenhum: custo errado passa despercebido na conferência, campo
 * vazio não.
 */
async function buscarCustos(
  orgId: string,
  itens: ItemGerado[],
): Promise<Map<number, { custo: number; composicaoId: string; unidade: string | null }>> {
  const sb = supabaseAdmin();
  const achados = new Map<
    number,
    { custo: number; composicaoId: string; unidade: string | null }
  >();

  await Promise.all(
    itens.map(async (item, indice) => {
      if (item.custoUnitario !== null) return;

      const { data } = await sb.rpc("orc_buscar_composicoes", {
        p_org_id: orgId,
        p_consulta: item.descricao,
        p_limite: 1,
      });

      const melhor = data?.[0];
      if (melhor && melhor.sim >= 0.55) {
        achados.set(indice, {
          custo: melhor.custo_unitario,
          composicaoId: melhor.id,
          unidade: melhor.unidade,
        });
      }
    }),
  );

  return achados;
}

export async function montarItensDaFala(
  orcamentoId: string,
  orgId: string,
  blocoId: string,
): Promise<SaidaDaMontagem> {
  const chave = process.env.GROQ_API_KEY;
  if (!chave) return { ok: false, erro: "GROQ_API_KEY não está configurada." };

  const material = await montarMaterial(orcamentoId, blocoId);
  if (!material) {
    return {
      ok: false,
      erro: "Não há nada transcrito nesta fala. O áudio continua guardado.",
    };
  }

  const sb = supabaseAdmin();
  const { data: geracao } = await sb
    .from("orc_geracoes")
    .insert({
      orcamento_id: orcamentoId,
      etapa: "orcamento",
      status: "rodando",
      provider: "groq",
      model: MODELO,
    })
    .select("id")
    .single();

  const encerrar = async (campos: {
    status: "pronto" | "falhou";
    resultado?: unknown;
    error?: string;
  }) => {
    if (!geracao) return;
    await sb
      .from("orc_geracoes")
      .update({
        status: campos.status,
        resultado: campos.resultado ?? null,
        error: campos.error ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", geracao.id);
  };

  try {
    const resposta = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${chave}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODELO,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: INSTRUCOES },
            { role: "user", content: material },
          ],
        }),
        // Sem isto a tela trava de verdade. Uma geração normal leva 2 a 4
        // segundos; quando a Groq está degradada ela não recusa, ela pendura a
        // conexão — e o `fetch` do Node espera indefinidamente. O passo
        // "Montando a tabela" ficava girando para sempre, sem erro e sem saída.
        signal: AbortSignal.timeout(TETO_DA_IA),
      },
    );

    if (!resposta.ok) {
      const detalhe = (await resposta.text()).slice(0, 300);
      await encerrar({ status: "falhou", error: `HTTP ${resposta.status}` });
      return { ok: false, erro: `A IA recusou: ${detalhe}` };
    }

    const dados = await resposta.json();
    const conteudo: string = dados?.choices?.[0]?.message?.content ?? "";

    let bruto: unknown;
    try {
      bruto = JSON.parse(conteudo);
    } catch {
      await encerrar({ status: "falhou", error: "Resposta não é JSON válido." });
      return { ok: false, erro: "A IA devolveu um formato inesperado." };
    }

    const { itens, entendido, faltando } = normalizar(bruto);
    if (itens.length === 0) {
      await encerrar({ status: "falhou", error: "Nenhum item utilizável." });
      return {
        ok: false,
        erro: "Não consegui identificar nenhum serviço no que foi falado.",
      };
    }

    const custos = await buscarCustos(orgId, itens);

    // Entra depois do que já existe: o que ele digitou à mão antes de gravar
    // não é atropelado.
    const { data: ultima } = await sb
      .from("orc_itens")
      .select("position")
      .eq("orcamento_id", orcamentoId)
      .order("position", { ascending: false })
      .limit(1);

    let posicao = (ultima?.[0]?.position ?? 0) + 1;

    const { error: erroInsert } = await sb.from("orc_itens").insert(
      itens.map((item, indice) => {
        const daBase = custos.get(indice);
        return {
          orcamento_id: orcamentoId,
          position: posicao++,
          grupo: item.grupo,
          descricao: item.descricao,
          quantidade: item.quantidade,
          unidade: item.unidade ?? daBase?.unidade ?? null,
          valor_unitario: item.valorUnitario,
          custo_unitario: item.custoUnitario ?? daBase?.custo ?? null,
          composicao_id: daBase?.composicaoId ?? null,
          observacao: item.observacao,
          origem: "ia" as const,
        };
      }),
    );

    if (erroInsert) {
      await encerrar({ status: "falhou", error: erroInsert.message });
      return { ok: false, erro: erroInsert.message };
    }

    await sb
      .from("orc_orcamentos")
      .update({ status: "conferindo" })
      .eq("id", orcamentoId);

    await encerrar({ status: "pronto", resultado: { itens, entendido, faltando } });
    return { ok: true, criados: itens.length, entendido, faltando };
  } catch (e) {
    // `TimeoutError` vem do AbortSignal. A mensagem crua ("The operation was
    // aborted due to timeout") não diz nada para quem está no canteiro, e o
    // que importa é que o áudio não se perdeu.
    const expirou = e instanceof Error && e.name === "TimeoutError";
    const mensagem = expirou
      ? "A IA demorou demais para responder. Sua fala está guardada — toque em tentar de novo."
      : e instanceof Error
        ? e.message
        : String(e);

    await encerrar({
      status: "falhou",
      error: expirou ? `timeout após ${TETO_DA_IA}ms` : mensagem,
    });
    return { ok: false, erro: mensagem };
  }
}

/** O JSON do modelo é `unknown`, e modelo erra formato. */
function normalizar(bruto: unknown): {
  itens: ItemGerado[];
  entendido: string;
  faltando: string[];
} {
  if (!bruto || typeof bruto !== "object") {
    return { itens: [], entendido: "", faltando: [] };
  }
  const d = bruto as Record<string, unknown>;

  const numeroOuNulo = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
  const textoOuNulo = (v: unknown): string | null =>
    typeof v === "string" && v.trim().length > 0 ? v.trim() : null;

  const itens = Array.isArray(d.itens)
    ? d.itens.flatMap((linha): ItemGerado[] => {
        if (!linha || typeof linha !== "object") return [];
        const i = linha as Record<string, unknown>;
        const descricao = textoOuNulo(i.descricao);
        if (!descricao || descricao.length < 3) return [];
        return [
          {
            grupo: textoOuNulo(i.grupo),
            descricao,
            quantidade: numeroOuNulo(i.quantidade),
            unidade: textoOuNulo(i.unidade),
            valorUnitario: numeroOuNulo(i.valorUnitario),
            custoUnitario: numeroOuNulo(i.custoUnitario),
            observacao: textoOuNulo(i.observacao),
          },
        ];
      })
    : [];

  return {
    // Teto de 40 linhas: acima disso o modelo está fatiando demais, e uma
    // tabela assim não se confere no celular.
    itens: itens.slice(0, 40),
    entendido: typeof d.entendido === "string" ? d.entendido.trim() : "",
    faltando: Array.isArray(d.faltando)
      ? d.faltando
          .filter((f): f is string => typeof f === "string" && f.trim().length > 0)
          .slice(0, 8)
      : [],
  };
}
