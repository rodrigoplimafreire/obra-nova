"use client";

/**
 * Botão de imprimir de verdade, não instrução para apertar Ctrl+P.
 *
 * Pedido do Rodrigo pensando no cliente com pouca intimidade com computador,
 * abrindo o link no celular: ninguém que precisa da proposta impressa vai
 * descobrir um atalho de teclado sozinho.
 */
export function BotaoImprimir() {
  return (
    <button type="button" className="btn solid" onClick={() => window.print()}>
      Imprimir orçamento
    </button>
  );
}
