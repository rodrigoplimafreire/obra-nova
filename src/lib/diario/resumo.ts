import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ehSecao, separarResponsavel, type Secao } from "./tipos";

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
  "proximosPassos": ["Responsável: o que vem em seguida"],
  "deOntem": { "1": "realizado", "3": "em_andamento" }
}`;

/**
 * O bloco que conta à IA o que ficou em aberto no último dia.
 *
 * A regra do meio é a que importa, e é a que faz este bloco existir sem
 * quebrar a §5 do PRD: **silêncio não é progresso**. Se o material de hoje
 * não disser nada sobre uma pendência, ela não entra em lugar nenhum — nem
 * como feita, nem como andando. Fica onde estava, esperando o dedo.
 */
function blocoDoQueFicouEmAberto(
  emAberto: { secao: Secao; texto: string }[],
): string {
  if (emAberto.length === 0) return "";

  const lista = emAberto
    .map((i, n) => `[${n + 1}] (${i.secao}) ${i.texto}`)
    .join("\n");

  return `

FICOU EM ABERTO NO ÚLTIMO DIA:
${lista}

Para cada um desses, procure no material de hoje o que aconteceu com ele, e responda em "deOntem", usando o número como chave:
- o material diz que terminou: "realizado"
- o material diz que continua, ou que ainda está travado: "em_andamento" ou "pendencias", o que couber
- o material vai tratar disso depois: "proximos_passos"
- **o material não fala dele**: não inclua o número. Silêncio não é progresso, e chutar aqui é dizer ao cliente que uma coisa andou sem ninguém ter dito isso.

Não repita nas quatro listas o que você classificou em "deOntem": esses itens já têm texto próprio, e escrevê-los de novo duplicaria a linha.`;
}

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

/** Uma pendência de ontem que o material de hoje resolveu, e para onde foi. */
export type DeOntemResolvido = { id: string; secao: Secao };

export type SaidaDoResumo =
  | {
      ok: true;
      itens: ItemSugerido[];
      /** O que a IA disse que aconteceu com o que ficou em aberto. */
      deOntem: DeOntemResolvido[];
      registros: number;
    }
  | { ok: false; erro: string };

/**
 * Lê o `deOntem` que a IA devolveu.
 *
 * Chave é o número que entrou no prompt, valor é a seção. Qualquer coisa fora
 * disso é descartada em silêncio: número que não existe, seção inventada,
 * valor que não é string. O modelo erra o formato de vez em quando, e um
 * `deOntem` torto não pode derrubar o resumo inteiro.
 */
function lerDeOntem(
  bruto: unknown,
  emAberto: { id: string }[],
): DeOntemResolvido[] {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return [];

  return Object.entries(bruto as Record<string, unknown>).flatMap(
    ([chave, valor]) => {
      const n = Number(chave);
      const origem = emAberto[n - 1];
      if (!origem || !Number.isInteger(n)) return [];
      if (typeof valor !== "string" || !ehSecao(valor)) return [];
      return [{ id: origem.id, secao: valor }];
    },
  );
}

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
  /**
   * O elenco do diário.
   *
   * Entra no prompt porque transcrição erra nome próprio: "Reginato" vira
   * "Reginaldo", a pastilha da página vira outra pessoa, e quem lê procura o
   * próprio nome e não acha. Dar a lista não é dizer de quem é a tarefa — é
   * dizer como se escreve o nome de quem o material já citou.
   */
  elenco: string[] = [],
  /**
   * O que ficou em aberto no último dia com conteúdo.
   *
   * Sem isto a IA não sabia que existia pendência de ontem, e a pessoa tinha
   * que marcar cada uma à mão depois de já ter contado, no registro, o que
   * havia acontecido com ela. Era a queixa que originou esta mudança.
   */
  emAberto: { id: string; secao: Secao; texto: string }[] = [],
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
              content:
                INSTRUCOES.replace(
                  "{AUTOR}",
                  autor?.trim() || "a pessoa que escreve este diário",
                ) +
                (elenco.length
                  ? `\n\nNOMES CONHECIDOS, escritos assim: ${elenco.join(", ")}. Quando o material citar uma dessas pessoas, use exatamente essa grafia, inclusive a caixa. NÃO troque um nome por outro parecido: se o material trouxer um nome que não está na lista, use-o como veio, mesmo que soe como um da lista. Corrigir nome que você não pode conferir é inventar responsável.`
                  : "") +
                blocoDoQueFicouEmAberto(emAberto),
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
      deOntem: lerDeOntem(o.deOntem, emAberto),
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
