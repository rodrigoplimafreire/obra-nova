import "server-only";

/**
 * De uma colagem crua a um orçamento inteiro.
 *
 * O que o Rodrigo fazia até aqui: copiava o que o cliente mandou no WhatsApp,
 * colava numa conversa com o Claude Code, e recebia de volta um orçamento
 * pronto. O `montarItensDaFala` já cobre metade disso — texto vira linhas da
 * tabela — mas só depois que alguém digitou cliente, endereço e objeto num
 * formulário. Esta função tira o formulário do caminho: lê o mesmo texto e
 * devolve **o orçamento todo**, cabeçalho junto.
 *
 * **Nada disto é gravado sem passar pelos olhos dele.** A extração devolve um
 * rascunho para conferência, e é a tela que decide gravar. Não é cerimônia: é
 * a única defesa contra um número lido errado, e a leitura de imagem
 * (`qwen3.6`, o único modelo com visão nesta conta) confundiu o logotipo da RD
 * com o ícone do React num teste — não é fonte para confiar com dinheiro sem
 * revisão.
 */

const MODELO_TEXTO = process.env.ANALYSIS_MODEL ?? "openai/gpt-oss-120b";

/**
 * Só este enxerga imagem, nesta conta. Vem separado do modelo de texto de
 * propósito: quando a Groq publicar algo melhor, troca-se um sem mexer no
 * outro — e sem que "o modelo de visão" vire sinônimo de "o modelo".
 */
const MODELO_VISAO = process.env.VISION_MODEL ?? "qwen/qwen3.6-27b";

const TETO = 45_000;

const INSTRUCOES = `Você recebe o material cru que um cliente mandou para um empreiteiro brasileiro — texto de WhatsApp, lista de serviços, tabela, ou tudo junto e desorganizado. Devolve um orçamento estruturado.

REGRAS ABSOLUTAS — quebrar qualquer uma destas põe número errado num documento que vai para o cliente final:

1. NUNCA invente preço. Item sem valor dito fica com "valorUnitario": null. Não estime, não use média de mercado.
2. NUNCA invente quantidade. Sem número dito, "quantidade": null.
3. NUNCA invente nome, endereço ou telefone. O que não estiver escrito fica null.
4. Só escreva serviço que está no material. Não acrescente o que "normalmente acompanha".

O CABEÇALHO:
- "cliente": para quem é o orçamento. Pessoa ou empresa. Null se não disser.
- "endereco": rua, número, bairro e cidade, numa linha só, se estiverem lá.
- "objeto": o serviço em uma linha curta, como título do documento ("Muro de 12,00 × 3,50 m", "Gesso drywall e pintura"). Deduza do conteúdo — isto é resumo, não invenção.
- "prazo": só se estiver escrito ("10 dias úteis", "16 semanas").
- "entradaPercentual": percentual pago no início, se o material disser ("50% no início" → 50; "70/30" → 70). Null se não disser.

OS ITENS:
- Um item por serviço ou material distinto, na ordem em que aparecem.
- "grupo" junta itens da mesma frente, com o número que o material usa: "1. Demolição", "2. Fundações". Se o material separa MÃO DE OBRA de MATERIAL, use isso como grupo — é a divisão que o empreiteiro quer ver.
- "unidade": m², m, un, vb, sc, m³, dia. Preencha só quando dito ou óbvio pelo serviço.
- "descricao": curta e técnica, do jeito que vai no documento do cliente.

VALOR FECHADO POR GRUPO — atenção, é o caso mais comum:
Muitas vezes o material lista vários serviços SEM preço individual e dá um valor único no fim ("Valor total da mão de obra: 8.700,00"). Nesse caso: os serviços entram como itens sem valor, E você acrescenta ao fim daquele grupo um item com "descricao" igual a "Valor total da mão de obra" (ou "Valor do gesso", conforme o texto), "quantidade": 1, "unidade": "Vb" e o valor em "valorUnitario". Não distribua o total entre os itens.

Responda SOMENTE com JSON válido, sem markdown:

{
  "cliente": "…" ou null,
  "endereco": "…" ou null,
  "objeto": "…" ou null,
  "prazo": "…" ou null,
  "entradaPercentual": 70 ou null,
  "itens": [
    { "grupo": "1. Demolição", "descricao": "…", "quantidade": 28, "unidade": "m²", "valorUnitario": null }
  ],
  "entendido": "2 a 4 frases dizendo o que você entendeu, para ele conferir",
  "duvidas": ["o que ficou ambíguo ou faltando, uma linha cada"]
}`;

export type ItemColado = {
  grupo: string | null;
  descricao: string;
  quantidade: number | null;
  unidade: string | null;
  valorUnitario: number | null;
};

export type Colagem = {
  cliente: string | null;
  endereco: string | null;
  objeto: string | null;
  prazo: string | null;
  entradaPercentual: number | null;
  itens: ItemColado[];
  entendido: string;
  duvidas: string[];
};

export type SaidaDaColagem =
  | { ok: true; colagem: Colagem }
  | { ok: false; erro: string };

/** Imagem que veio junto da colagem, já em base64 pronto para o modelo. */
export type ImagemColada = { mimeType: string; base64: string };

/**
 * Quando há imagem, ela é lida primeiro e vira texto — e só então o texto
 * inteiro passa pelo modelo bom.
 *
 * O caminho direto seria mandar tudo para o modelo de visão de uma vez. Não:
 * o que enxerga é o mais fraco em raciocínio, e estruturar um orçamento é a
 * parte que não pode errar. Assim cada um faz o que sabe — um transcreve o que
 * está na foto, o outro organiza.
 */
async function lerImagens(
  imagens: ImagemColada[],
  chave: string,
): Promise<string> {
  const partes = await Promise.all(
    imagens.map(async (img, i) => {
      const resposta = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${chave}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: MODELO_VISAO,
            temperature: 0,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Transcreva TUDO que está escrito nesta imagem, em português, mantendo a estrutura (listas viram listas, tabela vira linhas com os valores alinhados). Não interprete, não resuma, não complete: só transcreva o que dá para ler. Se algo estiver ilegível, escreva [ilegível] no lugar.",
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${img.mimeType};base64,${img.base64}`,
                    },
                  },
                ],
              },
            ],
            max_tokens: 1500,
          }),
          signal: AbortSignal.timeout(TETO),
        },
      );

      if (!resposta.ok) return `[imagem ${i + 1}: não consegui ler]`;
      const dados = await resposta.json();
      const texto: string = dados?.choices?.[0]?.message?.content ?? "";
      // O qwen devolve o raciocínio dentro de <think>…</think> no próprio
      // conteúdo. Sem tirar, isso entraria no orçamento como se fosse texto do
      // cliente.
      const limpo = texto.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      return `--- transcrição da imagem ${i + 1} ---\n${limpo}`;
    }),
  );

  return partes.join("\n\n");
}

export async function lerColagem(
  texto: string,
  imagens: ImagemColada[] = [],
): Promise<SaidaDaColagem> {
  const chave = process.env.GROQ_API_KEY;
  if (!chave) return { ok: false, erro: "GROQ_API_KEY não está configurada." };

  const limpo = texto.trim();
  if (!limpo && imagens.length === 0) {
    return { ok: false, erro: "Cole o material do cliente antes." };
  }

  try {
    const daImagem = imagens.length ? await lerImagens(imagens, chave) : "";
    const material = [limpo, daImagem].filter(Boolean).join("\n\n");

    const resposta = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${chave}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODELO_TEXTO,
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: INSTRUCOES },
            { role: "user", content: material },
          ],
        }),
        signal: AbortSignal.timeout(TETO),
      },
    );

    if (!resposta.ok) {
      const detalhe = (await resposta.text()).slice(0, 200);
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

    const colagem = normalizar(bruto);
    if (colagem.itens.length === 0) {
      return {
        ok: false,
        erro: "Não consegui identificar nenhum serviço no material colado.",
      };
    }

    return { ok: true, colagem };
  } catch (e) {
    const expirou = e instanceof Error && e.name === "TimeoutError";
    return {
      ok: false,
      erro: expirou
        ? "A IA demorou demais. Tente de novo — nada foi perdido."
        : e instanceof Error
          ? e.message
          : String(e),
    };
  }
}

function normalizar(bruto: unknown): Colagem {
  const vazio: Colagem = {
    cliente: null,
    endereco: null,
    objeto: null,
    prazo: null,
    entradaPercentual: null,
    itens: [],
    entendido: "",
    duvidas: [],
  };
  if (!bruto || typeof bruto !== "object") return vazio;
  const d = bruto as Record<string, unknown>;

  const texto = (v: unknown): string | null =>
    typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;

  const percentual = num(d.entradaPercentual);

  return {
    cliente: texto(d.cliente),
    endereco: texto(d.endereco),
    objeto: texto(d.objeto),
    prazo: texto(d.prazo),
    // Fora de 1..99 não é divisão de parcela — é a IA tendo lido outra coisa.
    entradaPercentual:
      percentual !== null && percentual > 0 && percentual < 100
        ? percentual
        : null,
    itens: Array.isArray(d.itens)
      ? d.itens
          .flatMap((linha): ItemColado[] => {
            if (!linha || typeof linha !== "object") return [];
            const i = linha as Record<string, unknown>;
            const descricao = texto(i.descricao);
            if (!descricao || descricao.length < 3) return [];
            return [
              {
                grupo: texto(i.grupo),
                descricao,
                quantidade: num(i.quantidade),
                unidade: texto(i.unidade),
                valorUnitario: num(i.valorUnitario),
              },
            ];
          })
          .slice(0, 60)
      : [],
    entendido: typeof d.entendido === "string" ? d.entendido.trim() : "",
    duvidas: Array.isArray(d.duvidas)
      ? d.duvidas
          .filter((x): x is string => typeof x === "string" && x.trim() !== "")
          .slice(0, 8)
      : [],
  };
}

/**
 * "Garagem Santa Terezinha" → "santaterezinha".
 *
 * Vira o endereço que o cliente recebe no WhatsApp, então: sem acento, sem
 * espaço, sem palavra de tratamento. "Sr. Paulo Roberto" tem que dar
 * `pauloroberto`, não `sr-paulo-roberto`.
 */
export function sugerirSlug(nome: string): string {
  const semTratamento = nome
    .normalize("NFD")
    // Os acentos, agora separados das letras pelo NFD. Escrito por código
    // porque o intervalo literal some em edição de arquivo.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(sr|sra|dr|dra|dona|seu|garagem|condominio|familia)\.?\s+/g, "");

  return (
    semTratamento
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 40) || "cliente"
  );
}
