"use client";

import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Dica de ajuda, posicionada fora da árvore.
 *
 * A versão anterior era `::after` absoluto dentro do próprio gatilho. Bonito
 * de escrever e impossível de salvar: a casca do painel usa `overflow-clip`
 * nos containers (para o tooltip da barra lateral não vazar sob a tela), e a
 * tabela de custos rola na horizontal. Qualquer dica que encostasse numa
 * dessas bordas era recortada, e as variantes `dica-cima`/`dica-esq` eram
 * remendo manual para casos que a gente lembrava de marcar.
 *
 * Aqui ela é `position: fixed` num portal no `body`: nenhum ancestral a
 * recorta, e a posição é calculada com a medida real da tela — vira para cima
 * quando não cabe embaixo, e encosta na margem em vez de sair pela lateral.
 *
 * Só aparece onde existe mouse. No toque, um tooltip fica preso na tela depois
 * do tap e vira estorvo; nesses aparelhos a informação precisa estar no texto
 * de apoio do campo, não escondida atrás de um gesto que não existe.
 */

const MARGEM = 8;
const DISTANCIA = 8;
const LARGURA_MAXIMA = 230;
const ATRASO = 200;

export function Dica({
  texto,
  children,
  className = "",
}: {
  texto: string;
  children: React.ReactNode;
  /** Classe do gatilho. O componente não impõe estilo ao que envolve. */
  className?: string;
}) {
  const [posicao, setPosicao] = useState<{
    top: number;
    left: number;
    acima: boolean;
  } | null>(null);
  const gatilho = useRef<HTMLSpanElement>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  function medir() {
    const el = gatilho.current;
    if (!el) return;

    const r = el.getBoundingClientRect();
    const largura = Math.min(LARGURA_MAXIMA, window.innerWidth - MARGEM * 2);

    // Cabe embaixo? Senão vira para cima. 80px é uma altura generosa para as
    // duas linhas que o documento permite.
    const acima = r.bottom + DISTANCIA + 80 > window.innerHeight;

    // Centraliza no gatilho e depois encosta na margem, se precisar.
    const centro = r.left + r.width / 2 - largura / 2;
    const left = Math.min(
      Math.max(MARGEM, centro),
      window.innerWidth - largura - MARGEM,
    );

    setPosicao({
      top: acima ? r.top - DISTANCIA : r.bottom + DISTANCIA,
      left,
      acima,
    });
  }

  function abrir() {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(medir, ATRASO);
  }

  function fechar() {
    if (temporizador.current) clearTimeout(temporizador.current);
    setPosicao(null);
  }

  return (
    <>
      <span
        ref={gatilho}
        onMouseEnter={abrir}
        onMouseLeave={fechar}
        onFocus={abrir}
        onBlur={fechar}
        aria-describedby={posicao ? id : undefined}
        className={`dica-gatilho ${className}`}
      >
        {children}
      </span>

      {posicao &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            className="dica-balao"
            style={{
              top: posicao.top,
              left: posicao.left,
              maxWidth: LARGURA_MAXIMA,
              transform: posicao.acima ? "translateY(-100%)" : undefined,
            }}
          >
            {texto}
          </span>,
          document.body,
        )}
    </>
  );
}
