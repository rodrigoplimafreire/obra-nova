import "server-only";

/**
 * Transcrição por Whisper, agnóstica de provedor.
 *
 * Groq e OpenAI expõem a mesma rota (`/audio/transcriptions`, multipart), então
 * o que muda entre as duas é URL, chave e nome do modelo. Trocar de uma para a
 * outra é trocar duas variáveis de ambiente, sem mexer em código.
 */

export type Provedor = "groq" | "openai";

/**
 * Teto da chamada ao provedor.
 *
 * Tem que ficar **abaixo** do limite de execução da função (60s na Vercel, ver
 * `maxDuration` na página do orçamento), com folga para gravar o erro no banco
 * e devolver a resposta. Com 60s aqui o desenho não funcionava: medido em
 * produção, o timeout disparou aos 61,3s e gravou o erro certinho — mas a
 * função já tinha sido cortada e o aparelho nunca recebeu nada, ficando preso
 * em "Transcrevendo". 35s cobre com sobra um áudio de um minuto.
 */
const TETO = 35_000;

type Config = {
  provedor: Provedor;
  url: string;
  chave: string;
  modelo: string;
};

export function lerConfig(): Config | null {
  const escolhido = (process.env.TRANSCRIPTION_PROVIDER ?? "groq") as Provedor;

  if (escolhido === "openai") {
    const chave = process.env.OPENAI_API_KEY;
    if (!chave) return null;
    return {
      provedor: "openai",
      url: "https://api.openai.com/v1/audio/transcriptions",
      chave,
      modelo: process.env.TRANSCRIPTION_MODEL ?? "whisper-1",
    };
  }

  const chave = process.env.GROQ_API_KEY;
  if (!chave) return null;
  return {
    provedor: "groq",
    url: "https://api.groq.com/openai/v1/audio/transcriptions",
    chave,
    modelo: process.env.TRANSCRIPTION_MODEL ?? "whisper-large-v3-turbo",
  };
}

export type ResultadoDaTranscricao =
  | { ok: true; texto: string; idioma: string | null; provedor: Provedor }
  | { ok: false; erro: string; provedor: Provedor | null };

/**
 * O nome do arquivo importa: os dois provedores decidem o container pela
 * extensão, e um `.bin` genérico é recusado.
 */
function nomeDoArquivo(mimeType: string | null, nomeOriginal?: string | null): string {
  const base = (mimeType ?? "").split(";")[0].trim().toLowerCase();

  const porMime: Record<string, string> = {
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/m4a": "m4a",
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/opus": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/flac": "flac",
    "audio/aac": "m4a",
  };

  if (porMime[base]) return `audio.${porMime[base]}`;

  // Arquivo importado do WhatsApp costuma chegar sem tipo declarado — o
  // navegador não reconhece `.opus` e manda `application/octet-stream` ou
  // string vazia. Aí a extensão do nome original é a única pista, e sem ela o
  // provedor recusa o arquivo.
  const extensao = (nomeOriginal ?? "").split(".").pop()?.toLowerCase() ?? "";
  const aceitas = ["m4a", "mp3", "mp4", "mpeg", "mpga", "ogg", "opus", "wav", "webm", "flac"];
  if (aceitas.includes(extensao)) {
    // O Whisper aceita `.ogg`; `.opus` nem sempre passa pela validação de
    // extensão do provedor, e o container é o mesmo.
    return `audio.${extensao === "opus" ? "ogg" : extensao}`;
  }

  return "audio.m4a";
}

/**
 * O vocabulário que orienta o Whisper, por módulo.
 *
 * Sem acento de propósito: a Groq devolve 500 quando o `prompt` traz caractere
 * fora de ASCII. Testado — "portugues" passa, "português" quebra. O texto
 * orienta o reconhecimento e não aparece na transcrição.
 *
 * São dois porque o que se dita é diferente. No canteiro o assunto é o que foi
 * executado; no orçamento é quanto custa, e aí unidade e valor passam a ser as
 * palavras que não podem sair erradas: metro quadrado e metro linear soam
 * iguais ditados depressa, e a diferença é o preço.
 */
const VOCABULARIO = {
  obra:
    "Relato de obra em portugues do Brasil: servicos executados, alvenaria, " +
    "contrapiso, reboco, laje, forma, ferragem, eletrica, hidraulica, " +
    "esquadria, pintura, material, medida e prazo.",
  orcamento:
    "Orcamento de obra em portugues do Brasil: alvenaria, contrapiso, reboco, " +
    "laje, ferragem, rufo em zinco, forro de PVC, telhado, esquadria, " +
    "eletrica, hidraulica, pintura. Medidas em metro quadrado, metro linear, " +
    "unidade e verba. Quantidade, valor unitario e total em reais.",
} as const;

export type Contexto = keyof typeof VOCABULARIO;

export async function transcrever(
  audio: Blob,
  mimeType: string | null,
  contexto: Contexto = "obra",
  /** Nome do arquivo importado, quando existe. Ver `nomeDoArquivo`. */
  nomeOriginal?: string | null,
): Promise<ResultadoDaTranscricao> {
  const config = lerConfig();
  if (!config) {
    return {
      ok: false,
      provedor: null,
      erro: "Nenhuma chave de transcrição configurada no ambiente.",
    };
  }

  const form = new FormData();
  form.append("file", audio, nomeDoArquivo(mimeType, nomeOriginal));
  form.append("model", config.modelo);
  // Fixar o idioma melhora bastante a precisão e evita o Whisper "traduzir"
  // trechos por conta própria.
  form.append("language", "pt");
  form.append("response_format", "verbose_json");
  form.append("prompt", VOCABULARIO[contexto]);

  try {
    const resposta = await fetch(config.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.chave}` },
      body: form,
      // O provedor já devolveu 502 em produção. Recusa rápida é tratada aqui
      // embaixo; o caso ruim é ele pendurar a conexão sem responder — sem
      // teto, o `fetch` do Node espera para sempre e a tela de quem gravou
      // fica girando sem erro. Um minuto cobre com folga um áudio de 50s.
      signal: AbortSignal.timeout(TETO),
    });

    if (!resposta.ok) {
      const detalhe = (await resposta.text()).slice(0, 300);
      return {
        ok: false,
        provedor: config.provedor,
        erro: `HTTP ${resposta.status}: ${detalhe}`,
      };
    }

    const dados = (await resposta.json()) as {
      text?: string;
      language?: string;
    };

    const texto = (dados.text ?? "").trim();
    if (!texto) {
      return {
        ok: false,
        provedor: config.provedor,
        erro: "O provedor devolveu uma transcrição vazia.",
      };
    }

    return {
      ok: true,
      texto,
      idioma: dados.language ?? null,
      provedor: config.provedor,
    };
  } catch (e) {
    const expirou = e instanceof Error && e.name === "TimeoutError";
    return {
      ok: false,
      provedor: config.provedor,
      erro: expirou
        ? "O serviço de transcrição não respondeu a tempo. O áudio está guardado."
        : e instanceof Error
          ? e.message
          : String(e),
    };
  }
}
