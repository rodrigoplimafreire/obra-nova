import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { separarResponsavel, type Secao } from "./tipos";

/**
 * O resumo do dia, escrito a partir dos registros.
 *
 * A §5 do PRD é curta e é toda sobre o que a IA **não** pode fazer. Ela virou
 * prompt quase palavra por palavra, porque quem lê do outro lado é o cliente
 * da empreiteira: um planejamento promovido a "concluído" não é um erro de
 * estilo, é uma mentira na prestação de contas.
 *
 * A IA organiza. Ela não conclui, não estima e não publica — publicar
 * continua sendo ato humano, e o resumo cai no rascunho para ser lido antes.
 */

// Ver o comentário em itens-da-fala.ts: a Groq removeu llama-3.3-70b do
// catálogo (27/08/2026). openai/gpt-oss-120b é o substituto.
const MODELO = process.env.ANALYSIS_MODEL ?? "openai/gpt-oss-120b";

const INSTRUCOES = `Você organiza o diário de trabalho de uma pessoa, para ser lido pelo cliente dela. Português do Brasil.

QUEM LÊ: o contratante. Ele quer saber o que andou, o que travou e o que vem em seguida. Não acompanha o dia a dia e não quer relatório longo.

DE ONDE VEM O MATERIAL: registros soltos do próprio dia, digitados ou falados e transcritos. As transcrições têm erros, principalmente em nomes e números.

O QUE VOCÊ FAZ: distribui o que foi dito nas quatro listas abaixo, em frases curtas. Uma atividade por item.

O QUE VOCÊ NÃO FAZ, em nenhuma hipótese:
- Não transforme planejamento em atividade concluída. "Vou ajustar a tabela" é próximo passo, nunca realizado. Se o material não diz que terminou, não terminou.
- Não invente valor, responsável, prazo nem resultado. Se não foi dito, não existe.
- Não complete o que ficou pela metade. Registro truncado entra truncado.
- Não resuma ao ponto de perder nome, número, valor ou link: copie-os como vieram.
- Não use travessão. Prefira vírgula, dois-pontos ou ponto.
- Não elogie o trabalho nem use adjetivo de marketing. "Feito" basta, "concluído com sucesso" não.

QUEM ESCREVE: {AUTOR}. Quando o material disser "eu", "vou", "fiz" ou "terminei", o responsável é essa pessoa, e não um desconhecido.

RESPONSÁVEL, em pendências e próximos passos: o item começa com o nome, dois-pontos, e o que precisa acontecer. Sempre nessa ordem, porque é assim que quem lê encontra o próprio nome sem ler a frase inteira.
- Foi apontado alguém: "Reginato: confirmar o preço do rufo, até quinta".
- O material está na primeira pessoa: o responsável é quem escreve.
- Ninguém foi apontado e não é quem escreve: "A definir: confirmar o preço do rufo". Nunca chute quem é.

Em realizado e em andamento **não** use esse formato: ali o que importa é o serviço, não quem fez.

PRÓXIMOS PASSOS: agrupe por responsável, um item por pessoa quando der.

Se uma das listas não tiver nada, devolva ela vazia. Lista vazia é melhor que item inventado para preenchê-la.

Responda SOMENTE com um objeto JSON válido, sem markdown, sem comentários:

{
  "realizado": ["o que ficou pronto hoje"],
  "emAndamento": ["o que começou e continua"],
  "pendencias": ["Responsável: o que está travado, com prazo quando houver"],
  "proximosPassos": ["Responsável: o que vem em seguida"]
}`;

/** O que a IA devolve, já pronto para virar linha de `dia_itens`. */
export type ItemSugerido = {
  secao: Secao;
  texto: string;
  responsavel: string | null;
};

/**
 * A IA responde quatro listas, uma por seção, e não uma lista com o nome da
 * seção dentro de cada item.
 *
 * Testado dos dois jeitos: pedindo o campo `secao` por item, o modelo inventa
 * nome de seção ("bloqueios", "concluido") e metade vira lixo. Quatro chaves
 * fixas no JSON não deixam margem — a seção é a chave, e chave errada
 * simplesmente não é lida.
 */
function itensDa(v: unknown, secao: Secao, comResponsavel: boolean): ItemSugerido[] {
  if (!Array.isArray(v)) return [];

  return v.flatMap((entrada): ItemSugerido[] => {
    if (typeof entrada !== "string") return [];

    // O modelo às vezes devolve o marcador junto; a tela já desenha o dela.
    const linha = entrada.trim().replace(/^[-*•]\s*/, "");
    if (!linha) return [];

    if (!comResponsavel) return [{ secao, texto: linha, responsavel: null }];

    // "Reginato: conferir a proposta" vira dono e tarefa. O prompt pede este
    // formato justamente para a coluna existir sem adivinhação depois. O
    // `separarResponsavel` é o mesmo juiz que a página usa na publicação
    // antiga — um critério só para "isto é nome de gente?".
    const { texto, responsavel } = separarResponsavel({
      texto: linha,
      responsavel: null,
    });

    return [{ secao, texto, responsavel }];
  });
}

export type SaidaDoResumo =
  | { ok: true; itens: ItemSugerido[]; registros: number }
  | { ok: false; erro: string };

export async function gerarResumo(
  relatorioId: string,
  /**
   * Quem assina o diário.
   *
   * Entra no prompt porque sem ele o modelo marcava como "A definir" o que a
   * própria pessoa tinha dito que ia fazer — e quem lê entende "ninguém
   * assumiu". Não é inventar responsável: é dizer de quem é a primeira pessoa
   * do texto que ele está lendo.
   */
  autor: string | null,
): Promise<SaidaDoResumo> {
  const chave = process.env.GROQ_API_KEY;
  if (!chave) return { ok: false, erro: "GROQ_API_KEY não está configurada." };

  const { data: registros } = await supabaseAdmin()
    .from("dia_registros")
    .select("tipo, texto, status")
    .eq("relatorio_id", relatorioId)
    .order("created_at");

  // Áudio ainda na fila ou que falhou não entra: o que ele diz não está
  // disponível, e resumir sem ele daria um dia pela metade sem avisar.
  const uteis = (registros ?? []).filter(
    (r) => r.status === "pronto" && r.texto && r.texto.trim(),
  );

  if (uteis.length === 0) {
    return {
      ok: false,
      erro: "Não há registro com texto neste dia. Grave ou escreva alguma coisa antes.",
    };
  }

  const material = uteis
    .map(
      (r, i) =>
        `[${i + 1}] ${r.tipo === "audio" ? "(falado, transcrito) " : ""}${r.texto?.trim()}`,
    )
    .join("\n\n");

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
          // Baixa de propósito: aqui não se quer variedade, se quer o mesmo
          // material organizado do mesmo jeito.
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              // Sem nome cadastrado, "a pessoa que escreve" — que ainda
              // distingue o autor de um terceiro sem nomear ninguém.
              content: INSTRUCOES.replace(
                "{AUTOR}",
                autor?.trim() || "a pessoa que escreve este diário",
              ),
            },
            { role: "user", content: material },
          ],
        }),
        // Teto abaixo do `maxDuration = 60` da página, com folga para
        // responder. Ver o mesmo cuidado em `transcricao/provedor.ts`.
        signal: AbortSignal.timeout(40_000),
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

    const o = (typeof bruto === "object" && bruto !== null ? bruto : {}) as Record<
      string,
      unknown
    >;

    return {
      ok: true,
      registros: uteis.length,
      itens: [
        ...itensDa(o.realizado, "realizado", false),
        ...itensDa(o.emAndamento, "em_andamento", false),
        ...itensDa(o.pendencias, "pendencias", true),
        ...itensDa(o.proximosPassos, "proximos_passos", true),
      ],
    };
  } catch (e) {
    const expirou = e instanceof Error && e.name === "TimeoutError";
    return {
      ok: false,
      erro: expirou
        ? "A IA não respondeu a tempo. Os registros continuam salvos."
        : e instanceof Error
          ? e.message
          : String(e),
    };
  }
}
