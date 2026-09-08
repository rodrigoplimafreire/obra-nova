"use client";

/**
 * Botão de imprimir de verdade, não instrução para apertar Ctrl+P.
 *
 * Pedido do Rodrigo pensando no cliente com pouca intimidade com computador,
 * abrindo o link no celular: ninguém que precisa da proposta impressa vai
 * descobrir um atalho de teclado sozinho.
 *
 * Aparece duas vezes no documento — no cartão de resumo, para quem já sabe
 * que quer o papel, e junto das assinaturas, para quem leu tudo e chegou na
 * hora de assinar. Quem rolou o documento inteiro não deve ter que voltar ao
 * topo para achar o botão.
 */
export function BotaoImprimir({
  rotulo = "Imprimir orçamento",
}: {
  rotulo?: string;
}) {
  return (
    <button type="button" className="btn solid" onClick={() => window.print()}>
      {rotulo}
    </button>
  );
}
