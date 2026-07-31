import "server-only";

/**
 * Transcrição por Whisper, agnóstica de provedor.
 *
 * Groq e OpenAI expõem a mesma rota (`/audio/transcriptions`, multipart), então
 * o que muda entre as duas é URL, chave e nome do modelo. Trocar de uma para a
 * outra é trocar duas variáveis de ambiente, sem mexer em código.
 */

export type Provedor = "groq" | "openai";

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
function nomeDoArquivo(mimeType: string | null): string {
  const base = (mimeType ?? "").split(";")[0].trim().toLowerCase();
  if (base === "audio/mp4") return "audio.m4a";
  if (base === "audio/webm") return "audio.webm";
  if (base === "audio/ogg") return "audio.ogg";
  if (base === "audio/mpeg") return "audio.mp3";
  return "audio.m4a";
}

export async function transcrever(
  audio: Blob,
  mimeType: string | null,
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
  form.append("file", audio, nomeDoArquivo(mimeType));
  form.append("model", config.modelo);
  // Fixar o idioma melhora bastante a precisão e evita o Whisper "traduzir"
  // trechos por conta própria.
  form.append("language", "pt");
  form.append("response_format", "verbose_json");
  // Sem acento de propósito: a Groq devolve 500 quando o `prompt` traz
  // caractere fora de ASCII. Testado — "portugues" passa, "português" quebra.
  // Isto orienta o vocabulário e não aparece na transcrição.
  form.append(
    "prompt",
    "Relato de obra em portugues do Brasil: servicos executados, alvenaria, " +
      "contrapiso, reboco, laje, forma, ferragem, eletrica, hidraulica, " +
      "esquadria, pintura, material, medida e prazo.",
  );

  try {
    const resposta = await fetch(config.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.chave}` },
      body: form,
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
    return {
      ok: false,
      provedor: config.provedor,
      erro: e instanceof Error ? e.message : String(e),
    };
  }
}
