/**
 * Escolha do formato de gravação.
 *
 * Ordem deliberada: `audio/mp4` primeiro porque é o único que o WebKit produz
 * (todo navegador no iPhone é WebKit por baixo). Opus/WebM em seguida, que é o
 * que Chrome e Firefox no desktop e no Android entregam — menor e melhor para
 * voz.
 */

export const CANDIDATOS_MIME = [
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
] as const;

export type SuporteMime = { mime: string; suportado: boolean };

export function mapearSuporte(): SuporteMime[] {
  const disponivel =
    typeof window !== "undefined" &&
    "MediaRecorder" in window &&
    typeof MediaRecorder.isTypeSupported === "function";

  return CANDIDATOS_MIME.map((mime) => ({
    mime,
    suportado: disponivel ? MediaRecorder.isTypeSupported(mime) : false,
  }));
}

/** Primeiro candidato suportado, ou null quando nenhum serve. */
export function escolherMime(): string | null {
  return mapearSuporte().find((c) => c.suportado)?.mime ?? null;
}

/** Extensão de arquivo a partir do mime escolhido. `audio/mp4` do WebKit é AAC — .m4a. */
export function extensaoPara(mime: string): string {
  const base = mime.split(";")[0].trim().toLowerCase();
  if (base === "audio/mp4") return "m4a";
  if (base === "audio/webm") return "webm";
  if (base === "audio/ogg") return "ogg";
  if (base === "audio/mpeg") return "mp3";
  return "bin";
}

/** Mime sem os parâmetros de codec — o que vale para validação no servidor. */
export function mimeBase(mime: string): string {
  return mime.split(";")[0].trim().toLowerCase();
}
