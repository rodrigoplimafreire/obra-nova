"use client";

import { useEffect, useRef, useState } from "react";
import { formatarDuracao } from "@/lib/audio/recorder";

/**
 * Player próprio no lugar do <audio controls>.
 *
 * O motivo: o áudio gravado pelo MediaRecorder sai sem cabeçalho de duração, e
 * o player nativo mostra qualquer coisa — um áudio de 50 segundos aparecia como
 * "10:25". Nós medimos a duração por cronômetro na gravação e guardamos em
 * duration_ms; é ela que este player exibe.
 */
export function PlayerDeAudio({
  src,
  duracaoMs,
}: {
  src: string | null;
  duracaoMs: number | null;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState(false);
  const [posMs, setPosMs] = useState(0);
  const [durMs, setDurMs] = useState(duracaoMs ?? 0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const aoTempo = () => setPosMs(audio.currentTime * 1000);
    const aoMetadata = () => {
      // Só confia no metadata quando não temos a duração medida e ele é finito.
      if (!duracaoMs && Number.isFinite(audio.duration)) {
        setDurMs(audio.duration * 1000);
      }
    };
    const aoFim = () => {
      setTocando(false);
      setPosMs(0);
    };
    const aoPausar = () => setTocando(false);
    const aoTocar = () => setTocando(true);

    audio.addEventListener("timeupdate", aoTempo);
    audio.addEventListener("loadedmetadata", aoMetadata);
    audio.addEventListener("ended", aoFim);
    audio.addEventListener("pause", aoPausar);
    audio.addEventListener("play", aoTocar);
    return () => {
      audio.removeEventListener("timeupdate", aoTempo);
      audio.removeEventListener("loadedmetadata", aoMetadata);
      audio.removeEventListener("ended", aoFim);
      audio.removeEventListener("pause", aoPausar);
      audio.removeEventListener("play", aoTocar);
    };
  }, [duracaoMs]);

  if (!src) {
    return <p className="text-sm text-cinza">Áudio indisponível.</p>;
  }

  function alternar() {
    const audio = audioRef.current;
    if (!audio) return;
    if (tocando) audio.pause();
    else void audio.play().catch(() => {});
  }

  function buscar(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !durMs) return;
    const alvo = e.currentTarget.getBoundingClientRect();
    const fracao = Math.min(1, Math.max(0, (e.clientX - alvo.left) / alvo.width));
    audio.currentTime = (fracao * durMs) / 1000;
    setPosMs(fracao * durMs);
  }

  const progresso = durMs > 0 ? Math.min(1, posMs / durMs) : 0;

  return (
    <div className="flex items-center gap-3">
      <audio ref={audioRef} src={src} preload="metadata" playsInline />

      <button
        type="button"
        onClick={alternar}
        aria-label={tocando ? "Pausar" : "Ouvir"}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tinta"
      >
        {tocando ? (
          <span className="flex gap-1">
            <span className="h-3.5 w-1.5 rounded-sm bg-white" />
            <span className="h-3.5 w-1.5 rounded-sm bg-white" />
          </span>
        ) : (
          <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 fill-papel">
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
        )}
      </button>

      <div
        role="slider"
        aria-label="Posição do áudio"
        aria-valuemin={0}
        aria-valuemax={Math.round(durMs / 1000)}
        aria-valuenow={Math.round(posMs / 1000)}
        onClick={buscar}
        className="h-8 min-w-0 flex-1 cursor-pointer"
      >
        <div className="relative top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-nevoa">
          <div
            className="h-full rounded-full bg-arroio"
            style={{ width: `${progresso * 100}%` }}
          />
        </div>
      </div>

      <span className="shrink-0 font-mono text-xs tabular-nums text-fumaca">
        {formatarDuracao(tocando || posMs > 0 ? posMs : durMs)}
      </span>
    </div>
  );
}
