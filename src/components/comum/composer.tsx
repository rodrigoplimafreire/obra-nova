"use client";

import { useEffect, useRef, useState } from "react";
import {
  ErroMicrofone,
  GravadorDeAudio,
  MENSAGENS_FALHA,
  formatarDuracao,
  type BlocoGravado,
} from "@/lib/audio/recorder";
import { escolherMime } from "@/lib/audio/mime";
import { lerContexto, comoAbrirNoNavegador, type ContextoNavegador } from "@/lib/ua";

/**
 * A barra de texto/áudio, no layout do WhatsApp Android: um pill só, com o
 * clipe e a câmera dentro dele, e o círculo de gravar/enviar do lado de fora.
 * Cores e forma são as nossas; a estrutura é a mesma em toda tela que grava —
 * hoje o canteiro, amanhã o que vier depois. Um componente só, um lugar só
 * para consertar.
 *
 * Antes o clipe (e a câmera, na obra) eram círculos grandes à esquerda do
 * campo. Em tela estreita isso sobrava pouco espaço para o texto, e o
 * placeholder quebrava e estourava o pill. Botões pequenos dentro do campo
 * resolvem os dois problemas de uma vez: mais espaço para o texto, e a mesma
 * gramática do app que o mestre já usa no dia a dia.
 *
 * Gravação por toque, sem gestos: tocar no microfone começa; a barra mostra
 * sempre Descartar de um lado e Enviar do outro. (A versão com
 * segurar/deslizar/travar foi testada em aparelho real e removida — bugava.)
 *
 * A regra que sustenta a tela continua: se o microfone falhar, o campo de texto
 * segue funcionando e a mensagem de erro aponta a saída.
 */
/** Altura máxima do campo antes de começar a rolar. Cerca de 5 linhas. */
const TETO_DO_CAMPO = 128;

export function Composer({
  enviarTexto,
  enviarAudio,
  enviarImagem,
  ocupado,
  // No canteiro o que se quer é a foto, que é a prova do serviço; em outras
  // telas pode ser o áudio. Só troca a cor de destaque e o texto do campo — os
  // mesmos três ícones aparecem nos dois casos.
  destaque = "audio",
}: {
  enviarTexto: (texto: string) => Promise<void>;
  enviarAudio: (bloco: BlocoGravado) => Promise<void>;
  enviarImagem: (arquivo: File) => Promise<void>;
  ocupado: boolean;
  destaque?: "audio" | "foto";
}) {
  const [texto, setTexto] = useState("");
  const [gravando, setGravando] = useState(false);
  const [preparando, setPreparando] = useState(false);
  const [decorridoMs, setDecorridoMs] = useState(0);
  const [nivel, setNivel] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [ctx, setCtx] = useState<ContextoNavegador | null>(null);

  const gravadorRef = useRef<GravadorDeAudio | null>(null);
  const relogioRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inicioRef = useRef(0);
  const encerrandoRef = useRef(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCtx(lerContexto());
    return () => {
      gravadorRef.current?.encerrar();
      if (relogioRef.current) clearInterval(relogioRef.current);
    };
  }, []);

  // Como no WhatsApp: o campo cresce com o texto até um teto, e a barra de
  // rolagem só existe depois que ele encosta nesse teto. Com overflow sempre
  // em `auto`, o navegador desenhava a barra (ou reservava o espaço dela)
  // mesmo com o campo vazio.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    const alturaNecessaria = el.scrollHeight;
    el.style.height = `${Math.min(alturaNecessaria, TETO_DO_CAMPO)}px`;
    el.style.overflowY = alturaNecessaria > TETO_DO_CAMPO ? "auto" : "hidden";
  }, [texto]);

  const microfonePossivel = Boolean(
    ctx?.temMediaDevices && ctx?.temMediaRecorder && ctx?.origemSegura && escolherMime(),
  );

  function pararRelogio() {
    if (relogioRef.current) clearInterval(relogioRef.current);
    relogioRef.current = null;
  }

  // Precisa nascer de um toque direto: o iOS ignora pedido de microfone fora de gesto.
  async function comecarGravacao() {
    if (ocupado || preparando || gravando) return;
    setErro(null);
    setPreparando(true);

    const gravador = new GravadorDeAudio({
      aoMedirNivel: setNivel,
      aoSuspender: () => void encerrarGravacao(true),
    });
    gravadorRef.current = gravador;

    try {
      await gravador.iniciar();
      inicioRef.current = performance.now();
      setDecorridoMs(0);
      relogioRef.current = setInterval(
        () => setDecorridoMs(performance.now() - inicioRef.current),
        200,
      );
      setGravando(true);
    } catch (e) {
      const causa = e instanceof ErroMicrofone ? e.causa : "desconhecida";
      const saida =
        ctx?.isInAppBrowser && causa !== "sem-suporte"
          ? ` ${comoAbrirNoNavegador(ctx)} Ou responda por texto aqui mesmo.`
          : " Você pode responder por texto aqui mesmo.";
      setErro(MENSAGENS_FALHA[causa] + saida);
      gravador.encerrar();
      gravadorRef.current = null;
    } finally {
      setPreparando(false);
    }
  }

  async function encerrarGravacao(enviar: boolean) {
    if (encerrandoRef.current) return;
    encerrandoRef.current = true;

    const gravador = gravadorRef.current;
    gravadorRef.current = null;
    pararRelogio();
    setGravando(false);
    setNivel(0);

    try {
      if (!gravador) return;
      const bloco = await gravador.parar().catch(() => null);
      if (!bloco || !enviar || bloco.tamanhoBytes === 0) return;

      if (bloco.picoNivel < 0.02) {
        setErro("O áudio saiu mudo. Confira se o microfone está liberado e tente de novo.");
        return;
      }
      await enviarAudio(bloco);
    } finally {
      encerrandoRef.current = false;
    }
  }

  async function submeterTexto() {
    const limpo = texto.trim();
    if (!limpo) return;
    setTexto("");
    await enviarTexto(limpo);
  }

  return (
    <div className="shrink-0 border-t border-nevoa/70 bg-papel px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-8 md:pb-5">
      <div className="mx-auto w-full max-w-2xl">
      {erro && (
        <p className="mb-3 rounded-2xl bg-alerta/20 px-4 py-3 text-sm leading-relaxed text-alerta-tinta">
          {erro}
        </p>
      )}

      {gravando ? (
        <div className="flex items-center gap-3 rounded-[1.75rem] bg-tinta py-2 pr-2 pl-2">
          <button
            type="button"
            onClick={() => void encerrarGravacao(false)}
            aria-label="Descartar gravação"
            className="flex h-11 shrink-0 items-center rounded-full border border-fumaca px-4 font-mono text-[0.7rem] tracking-widest text-nevoa uppercase"
          >
            Descartar
          </button>

          <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-limao" />
          <span className="shrink-0 font-mono text-sm tabular-nums text-papel">
            {formatarDuracao(decorridoMs)}
          </span>

          <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-fumaca">
            <span
              className="block h-full bg-limao transition-[width] duration-75"
              style={{ width: `${Math.min(100, Math.round(nivel * 140))}%` }}
            />
          </span>

          <button
            type="button"
            onClick={() => void encerrarGravacao(true)}
            aria-label="Enviar áudio"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-limao"
          >
            <Seta className="h-5 w-5 stroke-tinta" />
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          {/* Um pill só: o campo cresce, o clipe e a câmera moram dentro dele,
              encostados na borda direita — a mesma composição do WhatsApp. */}
          <div className="flex min-w-0 flex-1 items-end gap-0.5 rounded-3xl border border-nevoa bg-white py-1.5 pr-1.5 pl-4">
            <textarea
              ref={taRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={1}
              placeholder={
                destaque === "foto"
                  ? microfonePossivel
                    ? "Mande a foto, ou conte aqui"
                    : "Escreva o que foi feito"
                  : microfonePossivel
                    ? "Prefira gravar, ou escreva aqui"
                    : "Escreva sua resposta"
              }
              // overflow-hidden é o estado inicial; o efeito acima troca para
              // auto só quando o texto passa do teto.
              className="rolagem-campo min-h-9 min-w-0 flex-1 resize-none overflow-y-hidden bg-transparent py-1.5 text-[0.95rem] leading-snug outline-none placeholder:text-cinza"
            />

            {/* Dois caminhos porque são dois momentos: fotografar o serviço na
                hora, e pegar uma foto que já foi tirada durante o dia. O
                `capture` abre a câmera de trás direto, sem a folha de escolha;
                sem ele, o seletor mostra galeria e arquivos. No desktop
                `capture` é ignorado e os dois caem no mesmo diálogo. */}
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={ocupado}
              aria-label={
                destaque === "foto"
                  ? "Tirar uma foto do serviço agora"
                  : "Tirar uma foto"
              }
              data-dica={
                destaque === "foto"
                  ? "A foto é a prova do serviço. É ela que o cliente vê no relatório."
                  : undefined
              }
              className={`dica dica-cima flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-40 ${
                destaque === "foto" ? "text-azul" : "text-cinza"
              }`}
            >
              <Camera className="h-5 w-5" />
            </button>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                e.target.value = "";
                if (arquivo) void enviarImagem(arquivo);
              }}
            />

            <button
              type="button"
              onClick={() => arquivoRef.current?.click()}
              disabled={ocupado}
              aria-label={
                destaque === "foto" ? "Escolher uma foto já tirada" : "Enviar uma foto"
              }
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-cinza disabled:opacity-40"
            >
              <Clipe className="h-5 w-5" />
            </button>
            <input
              ref={arquivoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                e.target.value = "";
                if (arquivo) void enviarImagem(arquivo);
              }}
            />
          </div>

          {texto.trim() || !microfonePossivel ? (
            <button
              type="button"
              onClick={() => void submeterTexto()}
              disabled={ocupado || !texto.trim()}
              aria-label="Enviar"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-azul disabled:opacity-40"
            >
              <Seta className="h-5 w-5 stroke-white" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void comecarGravacao()}
              disabled={ocupado || preparando}
              aria-label="Gravar um áudio, a forma mais rápida de responder"
              data-dica="Responder por áudio é mais rápido e ajuda a captar melhor o que você quer dizer."
              // dica-cima: o botão fica no rodapé da tela, e a dica aberta para
              // baixo era cortada pela borda da janela.
              className="dica dica-cima dica-esq flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-azul disabled:opacity-50"
            >
              <Microfone />
            </button>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

function Seta({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`fill-none ${className}`} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function Microfone() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-white" strokeWidth={1.8} strokeLinecap="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

function Camera({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`fill-none stroke-current ${className}`} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2a1.5 1.5 0 0 0 1.25-.67l.6-.9A1.5 1.5 0 0 1 9.8 4.8h4.4a1.5 1.5 0 0 1 1.25.67l.6.9A1.5 1.5 0 0 0 17.3 7h2.2A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="13" r="3.4" />
    </svg>
  );
}

function Clipe({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`fill-none stroke-current ${className}`} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5 12.5 20a5 5 0 0 1-7-7L14 4.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3l8-8" />
    </svg>
  );
}
