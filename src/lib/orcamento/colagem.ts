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

ATENÇÃO — o erro mais comum: um material costuma ter MAIS DE UM fechamento ("Valor total da mão de obra: 8.700,00" e, mais abaixo, "Valor de material: R$ 5.718,00"). Varra o texto até a ÚLTIMA linha e emita um item de fechamento para CADA UM. Esquecer o segundo faz sair um orçamento com preço menor que o do cliente.

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
  /** A conferencia do dinheiro contra o texto cru. Ver `conferirTotais`. */
  conferencia: Conferencia;
};

/** Um total que o próprio texto do cliente declara: "Valor de material: R$ 5.718,00". */
export type TotalDeclarado = { rotulo: string; valor: number };

/**
 * A conferência que não depende da IA.
 *
 * **Medido:** o modelo às vezes não emite a linha de fechamento de um grupo.
 * Rodando o mesmo texto nove vezes, três esqueceram o "Valor de material:
 * R$ 5.718,00" do orçamento da Santa Terezinha — sempre com
 * `finish_reason: "stop"`, nunca por truncamento, e `temperature: 0` não
 * corrige. É variação do modelo, e prompt não garante.
 *
 * O estrago é pior do que parecer vazio: sobra um item com preço (os
 * R$ 8.700 da mão de obra), o orçamento parece completo, e sai um documento
 * R$ 5.718 abaixo do que o empreiteiro calculou. Nenhuma trava pega isso,
 * porque não há nada de errado na forma — só no número.
 *
 * Então o dinheiro é conferido por regex contra o texto cru, que é a única
 * fonte que não alucina. Não corrige sozinho: avisa, e quem decide é ele. A
 * colagem já nasce para ser revisada antes de gravar.
 */
export type Conferencia = {
  /** Os totais escritos no material colado, na ordem em que aparecem. */
  declarados: TotalDeclarado[];
  /** Soma dos valores dos itens que a IA montou. */
  somaDosItens: number;
  /** Declarados que não viraram item nem batem com a soma. O bug, quando acontece. */
  faltando: TotalDeclarado[];
};

/**
 * Os totais escritos no material cru.
 *
 * Ancorado no rótulo ("Valor…", "Total…") e não em qualquer número com
 * vírgula: o texto do cliente é cheio de medida ("27,90 m²") que não é
 * dinheiro. Aceita o negrito do WhatsApp e do Markdown em volta.
 */
export function totaisDeclarados(texto: string): TotalDeclarado[] {
  const LINHA =
    /^[\s*#>_\-]*((?:valor|total)[^\d:]{0,60}?)\s*[:\-]?\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/i;

  const achados: TotalDeclarado[] = [];
  for (const linha of texto.split(/\r?\n/)) {
    const m = LINHA.exec(linha.trim());
    if (!m) continue;
    const valor = Number(m[2].replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) continue;
    achados.push({
      rotulo: m[1].replace(/[*_#]/g, "").trim().replace(/\s+/g, " "),
      valor,
    });
  }
  return achados;
}

/**
 * Confere o que a IA montou contra o que o texto declara.
 *
 * Um declarado está coberto quando **algum item tem exatamente aquele valor**
 * — ou quando ele é a soma dos itens, que é o caso do total geral. Sem essa
 * segunda regra, um material que declara mão de obra, material E o total
 * ("2.560 + 1.390 = 3.950") acusaria falta no total geral, que está certo.
 */
export function conferirTotais(
  itens: ItemColado[],
  texto: string,
): Conferencia {
  const declarados = totaisDeclarados(texto);
  const valores = itens
    .map((i) => i.valorUnitario)
    .filter((v): v is number => v !== null && v > 0);

  const soma = Math.round(valores.reduce((s, v) => s + v, 0) * 100) / 100;
  const perto = (a: number, b: number) => Math.abs(a - b) < 0.01;

  const faltando = declarados.filter(
    (d) => !valores.some((v) => perto(v, d.valor)) && !perto(soma, d.valor),
  );

  return { declarados, somaDosItens: soma, faltando };
}

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
/**
 * A instrução que o Rodrigo descobriu na prática.
 *
 * A primeira versão pedia "transcreva tudo mantendo a estrutura", e o
 * resultado com tabela era irregular. Ele então jogou os prints no Gemini
 * pedindo **Markdown**, colou o `.md` na tela, e o orçamento saiu perfeito.
 *
 * Faz sentido: tabela em Markdown tem uma linha por item e colunas separadas
 * por `|`, o que remove a ambiguidade que "mantenha a estrutura" deixava em
 * aberto — onde acaba a descrição e começa a quantidade. E o modelo que
 * estrutura depois já lê Markdown nativamente.
 */
const INSTRUCAO_DA_IMAGEM = `Transcreva o conteúdo desta imagem em Markdown, em português.

- Tabela vira tabela Markdown, com cabeçalho e uma linha por item. Mantenha as colunas separadas por |.
- Lista numerada vira lista numerada, com a mesma numeração da imagem.
- Copie os números exatamente como estão escritos, com a mesma pontuação (27,90 continua 27,90; R$ 4.530,00 continua R$ 4.530,00).
- Não interprete, não resuma, não complete o que faltou, não corrija o que parece errado.
- Se algo estiver ilegível, escreva [ilegível] no lugar daquele campo.

Responda só com o Markdown, sem comentário antes nem depois.`;

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Uma imagem por vez, com repetição.
 *
 * A versão anterior mandava todas de uma vez num `Promise.all`. É o instinto
 * certo para chamadas independentes e o errado aqui: o modelo de visão desta
 * conta aceita **duas chamadas** antes de responder 429, então bastavam duas
 * tabelas para o import quebrar. Medido: tentativas 1 e 2 passam em ~1s, a 3ª
 * e a 4ª voltam "Rate limit reached".
 *
 * Pior que quebrar, quebrava calado: a falha virava um `[imagem N: não
 * consegui ler]` que seguia adiante como se fosse texto do cliente, e o erro
 * só aparecia lá na frente como "não identifiquei nenhum serviço".
 */
async function lerImagens(
  imagens: ImagemColada[],
  chave: string,
): Promise<{ ok: true; texto: string } | { ok: false; erro: string }> {
  const partes: string[] = [];

  for (const [i, img] of imagens.entries()) {
    let ultimoErro = "";

    for (let tentativa = 0; tentativa < 4; tentativa++) {
      if (tentativa > 0) await espera(2000 * tentativa);

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
                  { type: "text", text: INSTRUCAO_DA_IMAGEM },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${img.mimeType};base64,${img.base64}`,
                    },
                  },
                ],
              },
            ],
            max_tokens: 2000,
          }),
          signal: AbortSignal.timeout(TETO),
        },
      );

      if (resposta.ok) {
        const dados = await resposta.json();
        const texto: string = dados?.choices?.[0]?.message?.content ?? "";
        // O qwen devolve o raciocínio dentro de <think>…</think> no próprio
        // conteúdo. Sem tirar, isso entraria no orçamento como se fosse texto
        // do cliente.
        const limpo = texto.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
        partes.push(`--- imagem ${i + 1} ---\n${limpo}`);
        ultimoErro = "";
        break;
      }

      const detalhe = (await resposta.text()).slice(0, 200);
      ultimoErro = `HTTP ${resposta.status}`;

      // 429 e 5xx passam; o resto é erro de pedido e repetir não conserta.
      if (resposta.status !== 429 && resposta.status < 500) {
        return {
          ok: false,
          erro: `Não consegui ler a imagem ${i + 1}: ${detalhe}`,
        };
      }
    }

    if (ultimoErro) {
      return {
        ok: false,
        erro:
          `A leitura de imagem bateu no limite da Groq (${ultimoErro}) na imagem ${i + 1}. ` +
          "Tente com menos imagens de uma vez, ou converta o print em texto e cole aqui — funciona igual.",
      };
    }

    // Espaço entre imagens: a cota é por minuto, e emendar uma na outra
    // reproduz o 429 que acabamos de evitar.
    if (i < imagens.length - 1) await espera(1500);
  }

  return { ok: true, texto: partes.join("\n\n") };
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
    let daImagem = "";
    if (imagens.length) {
      const lidas = await lerImagens(imagens, chave);
      if (!lidas.ok) return { ok: false, erro: lidas.erro };
      daImagem = lidas.texto;
    }

    const material = [limpo, daImagem].filter(Boolean).join("\n\n");

    // A conta Groq desta empreiteira é de 8.000 tokens por minuto. Um
    // orçamento grande com o prompt junto chega perto disso, e dois seguidos
    // passam — medido ao rodar três casos em sequência: o primeiro passa, o
    // segundo e o terceiro voltam "Rate limit reached". Sem esta espera, o
    // segundo orçamento do dia falharia sem explicação útil.
    let resposta: Response | null = null;
    for (let tentativa = 0; tentativa < 4; tentativa++) {
      if (tentativa > 0) await espera(4000 * tentativa);

      resposta = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
      });

      if (resposta.ok) break;
      if (resposta.status !== 429 && resposta.status < 500) break;
    }

    if (!resposta || !resposta.ok) {
      const detalhe = resposta ? (await resposta.text()).slice(0, 200) : "";
      if (resposta?.status === 429) {
        return {
          ok: false,
          erro: "A cota da IA por minuto estourou. Espere um minuto e tente de novo — o que você colou continua aqui.",
        };
      }
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
    // Contra o material cru, nao contra o que a IA devolveu: e justamente
    // a IA que as vezes perde a linha de total.
    colagem.conferencia = conferirTotais(colagem.itens, material);
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
    conferencia: { declarados: [], somaDosItens: 0, faltando: [] },
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
    conferencia: { declarados: [], somaDosItens: 0, faltando: [] },
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
