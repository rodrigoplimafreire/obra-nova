import { escolherMime } from "./mime";

/**
 * Gravador de áudio para navegador móvel.
 *
 * Três armadilhas do WebKit que este módulo trata explicitamente:
 *
 * 1. `getUserMedia` pode nunca resolver dentro de um WebView embutido (o app
 *    hospedeiro engole o pedido de permissão). Daí o timeout.
 * 2. A duração não pode sair do metadata: o container gravado sai sem header de
 *    duração e `audio.duration` vira `Infinity`. Medimos por cronômetro.
 * 3. O blob pode voltar com `type` vazio. Guardamos o mime que *escolhemos*,
 *    não o que o blob reporta — os dois vão para o diagnóstico.
 */

export type FalhaMicrofone =
  | "sem-suporte"
  | "origem-insegura"
  | "negada"
  | "sem-dispositivo"
  | "ocupado"
  | "sem-resposta"
  | "desconhecida";

export class ErroMicrofone extends Error {
  constructor(
    readonly causa: FalhaMicrofone,
    readonly original?: unknown,
  ) {
    super(causa);
    this.name = "ErroMicrofone";
  }
}

export const MENSAGENS_FALHA: Record<FalhaMicrofone, string> = {
  "sem-suporte": "Este navegador não sabe gravar áudio.",
  "origem-insegura":
    "A página não está em HTTPS. O navegador só libera microfone em conexão segura.",
  negada: "A permissão de microfone foi negada.",
  "sem-dispositivo": "Nenhum microfone foi encontrado neste aparelho.",
  ocupado: "O microfone está sendo usado por outro app.",
  "sem-resposta":
    "O pedido de permissão não teve resposta — sinal de navegador embutido em outro app.",
  desconhecida: "Não foi possível acessar o microfone.",
};

/** Quanto esperamos por uma resposta ao pedido de permissão antes de desistir. */
export const TIMEOUT_PERMISSAO_MS = 8000;

function classificar(erro: unknown): FalhaMicrofone {
  const nome = (erro as { name?: string } | null)?.name;
  switch (nome) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "negada";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "sem-dispositivo";
    case "NotReadableError":
    case "TrackStartError":
      return "ocupado";
    default:
      return "desconhecida";
  }
}

/**
 * Pede o microfone. Precisa ser chamado a partir de um toque direto do usuário —
 * o iOS ignora o pedido feito no carregamento da página.
 */
export async function pedirMicrofone(): Promise<MediaStream> {
  const inseguro = typeof window !== "undefined" && !window.isSecureContext;
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    // Em origem insegura o Chrome simplesmente não expõe mediaDevices — a causa
    // real é o HTTP, não a falta de suporte.
    throw new ErroMicrofone(inseguro ? "origem-insegura" : "sem-suporte");
  }
  if (inseguro) {
    throw new ErroMicrofone("origem-insegura");
  }

  const pedido = navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  let expirou = false;
  const relogio = new Promise<never>((_, rejeitar) => {
    setTimeout(() => {
      expirou = true;
      rejeitar(new ErroMicrofone("sem-resposta"));
    }, TIMEOUT_PERMISSAO_MS);
  });

  // Se o timeout vencer, o pedido original pode resolver depois. Solta o stream
  // órfão para não deixar o indicador de microfone aceso no aparelho.
  pedido
    .then((stream) => {
      if (expirou) stream.getTracks().forEach((t) => t.stop());
    })
    .catch(() => {});

  try {
    return await Promise.race([pedido, relogio]);
  } catch (erro) {
    if (erro instanceof ErroMicrofone) throw erro;
    throw new ErroMicrofone(classificar(erro), erro);
  }
}

export type BlocoGravado = {
  blob: Blob;
  /** O mime que pedimos ao MediaRecorder. É este que vai para o banco. */
  mimeEscolhido: string;
  /** O que o blob reporta. Pode vir vazio no WebKit — guardado só para diagnóstico. */
  mimeDoBlob: string;
  duracaoMs: number;
  tamanhoBytes: number;
  /** Pico de volume captado, de 0 a 1. Zero significa gravação muda. */
  picoNivel: number;
  /** true quando a gravação foi encerrada porque a pessoa saiu da aba/app. */
  encerradoPorSuspensao: boolean;
};

type Opcoes = {
  /** Recebe cada evento relevante — a página mostra isso na tela, já que não há devtools no celular. */
  aoRegistrar?: (mensagem: string) => void;
  /** Chamado quando a captura é suspensa (troca de app, ligação recebida). */
  aoSuspender?: () => void;
  /** Nível instantâneo de 0 a 1, para o medidor. */
  aoMedirNivel?: (nivel: number) => void;
};

export class GravadorDeAudio {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mimeEscolhido = "";
  private inicioMs = 0;
  private duracaoMs = 0;
  private picoNivel = 0;
  private suspenso = false;
  private audioCtx: AudioContext | null = null;
  private quadro = 0;

  constructor(private readonly opcoes: Opcoes = {}) {}

  private log(mensagem: string) {
    this.opcoes.aoRegistrar?.(mensagem);
  }

  get gravando() {
    return this.recorder?.state === "recording";
  }

  async iniciar(): Promise<{ mimeEscolhido: string }> {
    const mime = escolherMime();
    if (!mime) throw new ErroMicrofone("sem-suporte");
    this.log(`mime escolhido: ${mime}`);

    this.log("pedindo permissão de microfone…");
    this.stream = await pedirMicrofone();
    this.log("permissão concedida");

    this.mimeEscolhido = mime;
    this.chunks = [];
    this.picoNivel = 0;
    this.suspenso = false;

    // isTypeSupported já disse que sim, mas o construtor ainda pode recusar.
    try {
      this.recorder = new MediaRecorder(this.stream, { mimeType: mime });
    } catch (erro) {
      this.log(`construtor recusou ${mime}, caindo para o padrão do navegador`);
      this.recorder = new MediaRecorder(this.stream);
      this.mimeEscolhido = this.recorder.mimeType || mime;
    }

    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.onerror = () => this.log("MediaRecorder emitiu erro");

    this.medirNivel();

    // Sem timeslice: o Safari é instável com dataavailable periódico.
    this.recorder.start();
    this.inicioMs = performance.now();
    this.log("gravando");

    document.addEventListener("visibilitychange", this.aoTrocarVisibilidade);
    return { mimeEscolhido: this.mimeEscolhido };
  }

  /** Medidor de volume: prova que o microfone está captando som, e não silêncio. */
  private medirNivel() {
    if (!this.stream) return;
    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return;

      this.audioCtx = new Ctx();
      void this.audioCtx.resume();

      const analisador = this.audioCtx.createAnalyser();
      analisador.fftSize = 1024;
      this.audioCtx.createMediaStreamSource(this.stream).connect(analisador);

      const amostras = new Uint8Array(analisador.fftSize);
      const passo = () => {
        analisador.getByteTimeDomainData(amostras);
        let pico = 0;
        for (const amostra of amostras) {
          const desvio = Math.abs(amostra - 128) / 128;
          if (desvio > pico) pico = desvio;
        }
        if (pico > this.picoNivel) this.picoNivel = pico;
        this.opcoes.aoMedirNivel?.(pico);
        this.quadro = requestAnimationFrame(passo);
      };
      this.quadro = requestAnimationFrame(passo);
    } catch {
      this.log("medidor de nível indisponível neste navegador");
    }
  }

  private aoTrocarVisibilidade = () => {
    if (document.visibilityState === "hidden" && this.gravando) {
      this.suspenso = true;
      this.log("app foi para segundo plano — encerrando o bloco");
      this.opcoes.aoSuspender?.();
    }
  };

  async parar(): Promise<BlocoGravado> {
    const recorder = this.recorder;
    if (!recorder) throw new Error("parar() chamado sem gravação em andamento");

    this.duracaoMs = Math.round(performance.now() - this.inicioMs);

    const blob = await new Promise<Blob>((resolver) => {
      recorder.onstop = () => {
        resolver(new Blob(this.chunks, { type: this.mimeEscolhido }));
      };
      if (recorder.state !== "inactive") recorder.stop();
      else resolver(new Blob(this.chunks, { type: this.mimeEscolhido }));
    });

    this.encerrar();
    this.log(
      `parado · ${(this.duracaoMs / 1000).toFixed(1)}s · ${blob.size} bytes · pico ${(this.picoNivel * 100).toFixed(0)}%`,
    );

    return {
      blob,
      mimeEscolhido: this.mimeEscolhido,
      mimeDoBlob: blob.type,
      duracaoMs: this.duracaoMs,
      tamanhoBytes: blob.size,
      picoNivel: this.picoNivel,
      encerradoPorSuspensao: this.suspenso,
    };
  }

  /** Solta microfone, medidor e listeners. Seguro chamar mais de uma vez. */
  encerrar() {
    document.removeEventListener("visibilitychange", this.aoTrocarVisibilidade);
    if (this.quadro) cancelAnimationFrame(this.quadro);
    this.quadro = 0;
    void this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
  }
}

export function formatarDuracao(ms: number): string {
  const total = Math.floor(ms / 1000);
  const min = Math.floor(total / 60);
  const seg = total % 60;
  return `${min}:${String(seg).padStart(2, "0")}`;
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
