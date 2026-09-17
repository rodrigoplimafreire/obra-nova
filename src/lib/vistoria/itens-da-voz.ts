import "server-only";

import { calcular, MODOS, type ItemDaVoz, type Modo } from "./medicao";

export type { ItemDaVoz };

/**
 * Da fala, em pé no cômodo, para as linhas do levantamento.
 *
 * É o mesmo movimento de `orcamento/itens-da-fala.ts`, com uma diferença que
 * muda o desenho: **aqui não existe preço**. A vistoria levanta escopo e
 * medida; preço entra depois, no editor do orçamento, onde a trava de
 * publicação já cobra que ninguém publique sem valor. Um campo a menos para a
 * IA errar, e a regra "preço nunca é estimado" fica garantida pela ausência
 * de coluna, não pela boa vontade do prompt.
 *
 * ## A divisão de trabalho
 *
 * A IA devolve **o que foi dito**: o serviço, o modo de medir e os números
 * que saíram da boca. Quem multiplica é o `calcular()`, em código.
 *
 * Isso não é purismo. É a mesma lição que gerou a função `capitalizar` nos
 * textos do documento: pedir conta ao modelo dá 12 numa rodada e 12,5 na
 * outra, e num orçamento a diferença vira dinheiro. O prompt cuida da língua,
 * que é onde ele é bom; a aritmética é determinística e fica onde dá para
 * conferir.
 */

/** Mesma escolha de `itens-da-fala.ts`, pelo mesmo motivo. */
const MODELO = process.env.ANALYSIS_MODEL ?? "openai/gpt-oss-120b";

/**
 * Teto mais curto que o da fala do orçamento (35s).
 *
 * Aqui a chamada é a segunda da cadeia — transcrever vem antes — e as duas
 * precisam caber no `maxDuration = 60` da página. Trinta segundos somados a
 * uma transcrição de fala curta deixam folga para gravar o erro e responder:
 * timeout que estoura junto com a função nunca chega ao aparelho.
 */
const TETO_DA_IA = 25_000;

const MODOS_VALIDOS = Object.keys(MODOS) as Modo[];

const INSTRUCOES = `Você transforma a fala de um empreiteiro brasileiro, gravada DENTRO de um cômodo durante a visita, em linhas de um levantamento de obra.

A fala foi transcrita automaticamente. A transcrição erra números, unidades e termos de construção — "quatro por três" pode virar "4x3", "43" ou "quatro portrês". Interprete pelo sentido de obra.

Devolva SOMENTE um objeto JSON:

{"itens":[{"servico":"...","modo":"piso","comprimento":4,"largura":3,"altura":null,"quantidade":null,"unidade":null}]}

## Os modos, e quando usar cada um

- "piso": área de chão ou teto. Pede comprimento e largura. "o piso da cozinha, quatro por três"
- "parede": área de uma parede. Pede comprimento e altura. "a parede do box, dois e meio por dois e quarenta"
- "linear": comprimento corrido. Pede só comprimento. "doze metros de rodapé"
- "volume": pede comprimento, largura e altura. "contrapiso de quatro por três por cinco centímetros"
- "contagem": peças contadas. Ponha o número em quantidade. "seis pontos de luz"
- "quantidade": ele já disse o número pronto e a unidade. "vinte metros quadrados de gesso"
- "verba": serviço fechado, sem medida. "a limpeza fina é por conta do serviço todo"

## Regras duras

1. **NÃO INVENTE MEDIDA.** Se ele citou o serviço sem medir, devolva o item com modo "verba" e todos os números em null. O levantamento aceita item sem medida; a tela mostra "sem medida" e alguém completa depois. Inventar 2,80 de pé-direito porque "é o normal" é o erro mais caro que você pode cometer aqui.
2. **NÃO CALCULE.** Devolva os lados que ele falou, nunca o produto. Se ele disser o resultado já pronto ("dá doze metros quadrados"), aí sim use modo "quantidade" com quantidade 12 e unidade "m²".
3. **NÃO INVENTE PREÇO.** Não existe campo de preço. Se ele falou valor, ignore o valor e registre só o serviço.
4. Um item por serviço. "quebrar o piso e assentar porcelanato" são DOIS itens, mesmo que a medida seja a mesma — repita a medida nos dois.
5. Centímetro vira metro: "cinco centímetros" é 0.05. Milímetro idem.
6. O serviço sai em português claro, começando com o verbo ou o substantivo do ofício: "Assentamento de porcelanato", "Demolição de piso", "Ponto de luz". Sem marca comercial inventada, sem adjetivo que ele não disse.
7. Se a fala não descreve serviço nenhum — é conversa, cumprimento, ruído — devolva {"itens":[]}. Não force item para preencher a resposta.

Responda com o JSON e nada mais.`;

export type SaidaDaVoz =
  | { ok: true; itens: ItemDaVoz[] }
  | { ok: false; erro: string };

/** Número que veio do modelo, ou `null`. Nunca `0` por engano de parse. */
function numeroOuNulo(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/**
 * Normaliza a resposta do modelo e **faz a conta em código**.
 *
 * Um item cujo modo calcula (piso, parede, linear, volume) tem a quantidade
 * derivada das dimensões e a unidade imposta pelo modo. O que o modelo tiver
 * escrito nesses dois campos é descartado de propósito: são campos que ele não
 * tem autoridade para preencher.
 */
function normalizar(bruto: unknown): ItemDaVoz[] {
  const lista = (bruto as { itens?: unknown[] } | null)?.itens;
  if (!Array.isArray(lista)) return [];

  const itens: ItemDaVoz[] = [];

  for (const cru of lista.slice(0, 20)) {
    const obj = cru as Record<string, unknown>;
    const servico = String(obj.servico ?? "").trim();
    if (servico.length < 2) continue;

    const modoCru = String(obj.modo ?? "");
    const modo: Modo = MODOS_VALIDOS.includes(modoCru as Modo)
      ? (modoCru as Modo)
      : "verba";

    const comprimento = numeroOuNulo(obj.comprimento);
    const largura = numeroOuNulo(obj.largura);
    const altura = numeroOuNulo(obj.altura);

    if (modo === "verba") {
      itens.push({
        servico,
        modo,
        comprimento: null,
        largura: null,
        altura: null,
        quantidade: 1,
        unidade: "vb",
      });
      continue;
    }

    const calculada = calcular(modo, {
      comprimento,
      largura,
      altura,
      desconto: null,
    });

    // Modo que calcula mas ficou sem medida suficiente não vira número
    // inventado: vira item sem medida, que é exatamente o que a tela sabe
    // mostrar e o que a regra 1 do prompt manda.
    const quantidade = calculada ?? numeroOuNulo(obj.quantidade);
    const unidade =
      MODOS[modo].unidade ??
      (typeof obj.unidade === "string" && obj.unidade.trim()
        ? obj.unidade.trim()
        : null);

    itens.push({
      servico: servico.slice(0, 200),
      modo,
      comprimento,
      largura,
      altura,
      quantidade,
      unidade,
    });
  }

  return itens;
}

export async function itensDaVoz(texto: string): Promise<SaidaDaVoz> {
  const chave = process.env.GROQ_API_KEY;
  if (!chave) {
    return {
      ok: false,
      erro: "Sem chave da IA no ambiente. A transcrição está aqui embaixo — dá para incluir os serviços à mão.",
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
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: INSTRUCOES },
            { role: "user", content: texto },
          ],
        }),
        signal: AbortSignal.timeout(TETO_DA_IA),
      },
    );

    if (!resposta.ok) {
      const detalhe = (await resposta.text()).slice(0, 200);
      return { ok: false, erro: `A IA recusou: ${detalhe}` };
    }

    const corpo = await resposta.json();
    const conteudo = corpo?.choices?.[0]?.message?.content;
    if (typeof conteudo !== "string") {
      return { ok: false, erro: "A IA respondeu num formato inesperado." };
    }

    return { ok: true, itens: normalizar(JSON.parse(conteudo)) };
  } catch (e) {
    // Timeout e JSON quebrado caem aqui. A transcrição continua na tela, então
    // falhar aqui custa a automação, não o trabalho.
    const motivo =
      e instanceof Error && e.name === "TimeoutError"
        ? "A IA demorou demais para responder."
        : "Não consegui interpretar o que a IA devolveu.";
    return { ok: false, erro: motivo };
  }
}
