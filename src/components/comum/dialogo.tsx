"use client";

import { useEffect, useId, useRef } from "react";

/**
 * Diálogo: modal no desktop, folha de baixo no celular.
 *
 * É `<dialog>` nativo, não uma `div` com `position: fixed`. A diferença não é
 * de estilo — é que o navegador entrega de graça, e correto, tudo que uma
 * reimplementação erra: foco preso dentro do painel, Esc fechando, o resto da
 * página inerte para leitor de tela, e a camada de topo, que dispensa
 * `z-index` competindo com a barra lateral.
 *
 * O que sobra para nós são três coisas que o nativo não faz:
 *
 * 1. **Fechar no clique fora.** O clique no fundo tem como alvo o próprio
 *    `<dialog>`, então comparar `target` com a referência basta.
 * 2. **Travar a rolagem do corpo.** O fundo fica inerte, mas continua rolando
 *    atrás no iOS.
 * 3. **Sincronizar com o React.** `showModal()` é imperativo; o componente é
 *    declarativo. O efeito faz a ponte.
 */
export function Dialogo({
  aberto,
  aoFechar,
  titulo,
  descricao,
  estreito = false,
  children,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  /** Confirmações e formulários curtos ficam mais legíveis estreitos. */
  estreito?: boolean;
  children: React.ReactNode;
}) {
  const referencia = useRef<HTMLDialogElement>(null);
  const idDoTitulo = useId();
  const idDaDescricao = useId();

  // O callback vive numa ref para o efeito do listener não reassinar a cada
  // render — quem chama passa arrow function inline, e a identidade muda
  // sempre. A escrita é em efeito, não no corpo do componente: durante o
  // render o React pode descartar o trabalho e reexecutar, e mexer em ref ali
  // deixa o valor fora de sincronia com o que foi pintado.
  const fechar = useRef(aoFechar);
  useEffect(() => {
    fechar.current = aoFechar;
  }, [aoFechar]);

  useEffect(() => {
    const dialogo = referencia.current;
    if (!dialogo) return;

    if (aberto && !dialogo.open) dialogo.showModal();
    if (!aberto && dialogo.open) dialogo.close();
  }, [aberto]);

  /**
   * Listener nativo, não `onCancel` do JSX: o evento `cancel` do `<dialog>`
   * **não borbulha**, e o React delega eventos na raiz da árvore. O handler
   * escrito como prop nunca dispara, e o Esc fecharia o elemento sem avisar o
   * React — deixando o estado dizendo "aberto" com a tela já fechada, e o
   * diálogo travado até um segundo clique.
   *
   * O `close` é a rede de segurança: cobre qualquer caminho de fechamento que
   * não passe pelo `cancel`.
   */
  useEffect(() => {
    const dialogo = referencia.current;
    if (!dialogo) return;

    const aoCancelar = (evento: Event) => {
      evento.preventDefault();
      fechar.current();
    };
    const aoFecharNativo = () => fechar.current();

    dialogo.addEventListener("cancel", aoCancelar);
    dialogo.addEventListener("close", aoFecharNativo);
    return () => {
      dialogo.removeEventListener("cancel", aoCancelar);
      dialogo.removeEventListener("close", aoFecharNativo);
    };
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [aberto]);

  return (
    <dialog
      ref={referencia}
      aria-labelledby={idDoTitulo}
      aria-describedby={descricao ? idDaDescricao : undefined}
      onClick={(e) => {
        if (e.target === referencia.current) aoFechar();
      }}
      className={`dialogo ${estreito ? "dialogo-estreito" : ""}`}
    >
      <div className="dialogo-painel">
        <div className="dialogo-alca" aria-hidden>
          <span />
        </div>

        <div className="dialogo-cabecalho">
          <h2 id={idDoTitulo} className="dialogo-titulo">
            {titulo}
          </h2>
          {descricao && (
            <p id={idDaDescricao} className="dialogo-descricao">
              {descricao}
            </p>
          )}
        </div>

        {children}
      </div>
    </dialog>
  );
}
