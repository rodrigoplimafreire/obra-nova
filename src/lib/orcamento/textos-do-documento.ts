import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { moeda, numero } from "./formato";

/**
 * Os textos que envolvem a tabela, escritos a partir do que já existe.
 *
 * As propostas que a RD monta à mão nunca são só a tabela: abrem apresentando
 * o serviço, dizem o que vem antes dos números, fecham explicando o que está
 * incluso, listam observação técnica e as etapas da obra. É isso que faz a
 * proposta parecer escrita para uma pessoa em vez de exportada de um sistema.
 *
 * **A regra aqui é diferente da regra dos itens, e precisa ser dita.** Em
 * `itens-da-fala.ts` a IA não pode inventar número porque número errado vira
 * prejuízo. Aqui ela escreve prosa, e prosa errada é barata: aparece na hora,
 * na tela, e se corrige digitando. Por isso este arquivo pode gerar texto que
 * aquele não podia gerar.
 *
 * O que continua proibido é **inventar fato**:
 *
 * - Nenhuma medida, prazo, marca de material ou garantia que não esteja na
 *   tabela ou na fala. Escrever "usamos massa corrida premium" quando ninguém
 *   disse é mentira que chega ao cliente com a assinatura do Reginato.
 * - Nenhum valor. Os números do documento vêm da tabela; o texto os menciona
 *   no máximo como "o valor acima".
 *
 * O texto é sempre rascunho: entra nos campos, e o humano edita antes de
 * publicar. Publicar continua sendo ato humano.
 */

// Ver o comentário em itens-da-fala.ts: a Groq removeu este modelo do
// catálogo (27/08/2026). openai/gpt-oss-120b é o substituto.
const MODELO = process.env.ANALYSIS_MODEL ?? "openai/gpt-oss-120b";

const INSTRUCOES = `Você escreve os textos de uma proposta de obra para a RD Engenharia, uma empreiteira de Fortaleza/CE. O responsável técnico se chama Reginato.

Você recebe a tabela de custos já pronta e, quando houver, o que o empreiteiro contou falando. Sua tarefa é escrever os textos que envolvem essa tabela, para o documento não ser só uma planilha.

QUEM VAI LER: o cliente final. Muitas vezes é uma pessoa física reformando a própria casa, não um engenheiro. Escreva para ela.

TOM:
- Português brasileiro, claro e direto. Frases curtas.
- Profissional e caloroso, nunca publicitário.
- Fale do serviço, não da empresa. Não elogie a RD, não prometa qualidade.
- Trate o cliente por você, nunca "o cliente" nem "V.Sa.".

FRASES PROIBIDAS — não escreva nenhuma destas nem variação delas:
- "nossa equipe", "nosso time", "estamos à disposição", "conte conosco"
- "resultado de qualidade", "material de qualidade", "com excelência", "alto padrão", "acabamento impecável"
- "soluções sob medida", "parceria", "transformar seu espaço", "realizar seu sonho"
- "abaixo você encontrará", "segue abaixo", "conforme descrito acima"
- "você está prestes a", "não perca tempo", "aproveite"
Elas são enchimento: ocupam linha sem dizer nada, e o cliente percebe.

TÍTULOS DOS BLOCOS: escreva como uma frase curta em português — só a inicial em maiúscula, o resto minúsculo, salvo nome próprio. Assim: "Estrutura em drywall", "Reforço estrutural", "Medição no local", "Vidros e entrega". NUNCA use maiúscula em toda palavra ("Construção Da Parede"): Title Case do inglês não existe em português e deixa o documento com cara de tradução.

REGRAS ABSOLUTAS:
1. NUNCA invente fato. Só escreva sobre material, medida, prazo, técnica ou garantia que apareça na tabela ou na fala. Se não sabe qual massa, qual tinta ou quantos dias, não diga.
2. NUNCA escreva valor em reais. Os números estão na tabela. Refira-se como "o valor acima" quando precisar.
3. Não prometa nada que não foi dito: nem garantia, nem prazo, nem forma de pagamento.
4. Se a informação para uma seção não existe, devolva ela vazia. Seção curta e verdadeira é melhor que seção cheia e inventada.

O QUE ESCREVER:

"apresentacao": 2 a 3 frases abrindo o documento. Diz O QUE vai ser feito e ONDE, em linguagem de gente. Não anuncie a tabela nem o que vem a seguir — o cliente está vendo a página. Comece pelo serviço.
Bom: "Reforma da cobertura e do forro da casa em Messejana. A telha velha sai inteira, entra telha de fibrocimento nova, e o forro de PVC fecha o ambiente por baixo."

"introCustos": 1 a 2 frases logo antes da tabela, preparando a leitura dela. Ex.: como a tabela está organizada, o que os valores incluem. Não repita o que a apresentação já disse.

"notaCustos": 1 a 2 frases logo depois do total. O que está incluso no valor, e o que não está. Só o que você sabe pela tabela e pela fala.

"introAceite": 1 a 2 frases antes do botão de aceite, dizendo o que acontece quando ele aceita. Convite tranquilo, sem pressão de venda.

"projeto": 2 a 4 blocos que explicam COMO o serviço foi pensado — a abordagem técnica, por frente de trabalho. Cada bloco tem "titulo" curto (2 a 4 palavras) e "texto" de 1 a 3 frases. Baseie nos grupos e itens da tabela. Se a tabela é curta demais para render isso, devolva lista vazia.

"observacoes": 2 a 4 blocos de observação técnica ou condição — o que o cliente precisa saber antes de aprovar. Mesma forma: "titulo" e "texto". Só o que se apoia na tabela ou na fala.

"etapas": 3 a 5 passos de como o serviço acontece do aceite à entrega, na ordem. "titulo" é o nome do passo, "texto" tem 1 a 2 frases. Baseie na ordem real dos grupos da tabela. O primeiro passo costuma ser a aprovação e o alinhamento de data; o último, a entrega e vistoria.

Responda SOMENTE com um objeto JSON válido, sem markdown:

{
  "apresentacao": "...",
  "introCustos": "...",
  "notaCustos": "...",
  "introAceite": "...",
  "projeto":     [{ "titulo": "...", "texto": "..." }],
  "observacoes": [{ "titulo": "...", "texto": "..." }],
  "etapas":      [{ "titulo": "...", "texto": "..." }]
}`;

export type BlocoGerado = { titulo: string; texto: string };

export type TextosGerados = {
  apresentacao: string | null;
  introCustos: string | null;
  notaCustos: string | null;
  introAceite: string | null;
  projeto: BlocoGerado[];
  observacoes: BlocoGerado[];
  etapas: BlocoGerado[];
};

export type SaidaDosTextos =
  | { ok: true; textos: TextosGerados }
  | { ok: false; erro: string };

/**
 * O material que a IA lê: a tabela como ela está, mais a fala se houver.
 *
 * A tabela é obrigatória e a fala não. Um orçamento digitado à mão, sem áudio
 * nenhum, ainda tem itens suficientes para render uma apresentação honesta —
 * é justamente a leitura dos itens que vira texto.
 */
async function montarMaterial(orcamentoId: string): Promise<string | null> {
  const sb = supabaseAdmin();

  const { data: orcamento } = await sb
    .from("orc_orcamentos")
    .select("cliente_nome, objeto, endereco, prazo, pagamento, observacoes")
    .eq("id", orcamentoId)
    .maybeSingle();
  if (!orcamento) return null;

  const { data: itens } = await sb
    .from("orc_itens")
    .select("grupo, descricao, quantidade, unidade, valor_unitario, observacao")
    .eq("orcamento_id", orcamentoId)
    .is("removido_em", null)
    .order("position");

  if (!itens?.length) return null;

  const linhas: string[] = [`CLIENTE: ${orcamento.cliente_nome}`];
  if (orcamento.objeto) linhas.push(`SERVIÇO: ${orcamento.objeto}`);
  if (orcamento.endereco) linhas.push(`LOCAL: ${orcamento.endereco}`);
  if (orcamento.prazo) linhas.push(`PRAZO INFORMADO: ${orcamento.prazo}`);
  if (orcamento.pagamento) {
    linhas.push(`PAGAMENTO INFORMADO: ${orcamento.pagamento}`);
  }
  if (orcamento.observacoes) {
    linhas.push(`OBSERVAÇÕES JÁ ESCRITAS: ${orcamento.observacoes}`);
  }

  linhas.push("", "TABELA DE CUSTOS (é isto que o cliente vai ver):");

  let grupoAtual: string | null = null;
  for (const i of itens) {
    if (i.grupo && i.grupo !== grupoAtual) {
      grupoAtual = i.grupo;
      linhas.push(`  # ${i.grupo}`);
    }
    const medida =
      i.quantidade !== null
        ? `${numero(i.quantidade)} ${i.unidade ?? ""}`.trim()
        : (i.unidade ?? "sem medida");
    // O valor de venda entra para a IA saber o peso relativo de cada frente
    // e não tratar um item de R$ 80 como se fosse o coração da obra. Ela está
    // proibida de escrever valor — a instrução diz isso duas vezes.
    const preco =
      i.valor_unitario !== null ? ` · ${moeda(i.valor_unitario)}` : " · sem preço";
    linhas.push(
      `  - ${i.descricao} (${medida}${preco})${i.observacao ? ` [obs: ${i.observacao}]` : ""}`,
    );
  }

  const { data: blocos } = await sb
    .from("orc_blocos")
    .select("id, type, text_content")
    .eq("orcamento_id", orcamentoId)
    .order("position");

  const idsDeAudio = (blocos ?? [])
    .filter((b) => b.type === "audio")
    .map((b) => b.id);

  const { data: transcricoes } = idsDeAudio.length
    ? await sb
        .from("orc_transcricoes")
        .select("bloco_id, text")
        .in("bloco_id", idsDeAudio)
        .eq("status", "done")
    : { data: [] };

  const textoDoAudio = new Map(
    (transcricoes ?? []).map((t) => [t.bloco_id, t.text ?? ""]),
  );

  const fala: string[] = [];
  for (const bloco of blocos ?? []) {
    if (bloco.type === "text" && bloco.text_content) {
      fala.push(bloco.text_content);
    } else if (bloco.type === "audio") {
      const t = textoDoAudio.get(bloco.id);
      if (t) fala.push(t);
    }
  }

  if (fala.length) {
    linhas.push(
      "",
      "O QUE O EMPREITEIRO CONTOU (transcrição automática, pode ter erro):",
      ...fala,
    );
  }

  return linhas.join("\n");
}

export async function escreverTextosDoDocumento(
  orcamentoId: string,
): Promise<SaidaDosTextos> {
  const chave = process.env.GROQ_API_KEY;
  if (!chave) return { ok: false, erro: "GROQ_API_KEY não está configurada." };

  const material = await montarMaterial(orcamentoId);
  if (!material) {
    return {
      ok: false,
      erro: "A tabela está vazia. Lance os itens antes — os textos são escritos a partir deles.",
    };
  }

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
          // Mais solto que a montagem de itens (0.2). Ali variação é risco;
          // aqui texto no mesmo molde toda vez é o que faz a proposta soar
          // como formulário preenchido.
          temperature: 0.5,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: INSTRUCOES },
            { role: "user", content: material },
          ],
        }),
      },
    );

    if (!resposta.ok) {
      const detalhe = (await resposta.text()).slice(0, 300);
      return { ok: false, erro: `A IA recusou: ${detalhe}` };
    }

    const dados = await resposta.json();
    const conteudo: string = dados?.choices?.[0]?.message?.content ?? "";

    let bruto: unknown;
    try {
      bruto = JSON.parse(conteudo);
    } catch {
      return { ok: false, erro: "A IA devolveu um formato inesperado." };
    }

    return { ok: true, textos: normalizar(bruto) };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Só a inicial do título em maiúscula.
 *
 * Pedir isso no prompt não resolveu: numa rodada o modelo devolveu tudo em
 * Title Case ("Construção Da Parede"), na seguinte tudo em minúscula. É regra
 * mecânica, e regra mecânica se aplica em código — o prompt orienta o estilo,
 * a função garante a forma. Só mexe na primeira letra: baixar o resto
 * estragaria sigla e nome próprio ("Forro de PVC", "SINAPI").
 */
function capitalizar(titulo: string): string {
  return titulo.charAt(0).toLocaleUpperCase("pt-BR") + titulo.slice(1);
}

/** O JSON do modelo é `unknown`, e modelo erra formato. */
function normalizar(bruto: unknown): TextosGerados {
  const vazio: TextosGerados = {
    apresentacao: null,
    introCustos: null,
    notaCustos: null,
    introAceite: null,
    projeto: [],
    observacoes: [],
    etapas: [],
  };
  if (!bruto || typeof bruto !== "object") return vazio;
  const d = bruto as Record<string, unknown>;

  const texto = (v: unknown): string | null =>
    typeof v === "string" && v.trim().length > 1 ? v.trim() : null;

  const blocos = (v: unknown, limite: number): BlocoGerado[] =>
    Array.isArray(v)
      ? v
          .flatMap((linha): BlocoGerado[] => {
            if (!linha || typeof linha !== "object") return [];
            const b = linha as Record<string, unknown>;
            const titulo = texto(b.titulo);
            const corpo = texto(b.texto);
            if (!titulo || !corpo) return [];
            return [{ titulo: capitalizar(titulo), texto: corpo }];
          })
          .slice(0, limite)
      : [];

  return {
    apresentacao: texto(d.apresentacao),
    introCustos: texto(d.introCustos),
    notaCustos: texto(d.notaCustos),
    introAceite: texto(d.introAceite),
    projeto: blocos(d.projeto, 4),
    observacoes: blocos(d.observacoes, 5),
    etapas: blocos(d.etapas, 6),
  };
}
