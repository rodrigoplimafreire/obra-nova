/**
 * Botão de imprimir de verdade, não instrução para apertar Ctrl+P.
 *
 * Pedido do Rodrigo pensando no cliente com pouca intimidade com computador,
 * abrindo o link no celular: ninguém que precisa da proposta impressa vai
 * descobrir um atalho de teclado sozinho.
 *
 * **Não é componente de cliente, e não tem `onClick`.** Quem escuta o clique é
 * um ouvinte de DOM puro, anexado por script inline no documento — porque esta
 * página não hidrata em produção, e um `onClick` do React nunca chegava a
 * rodar. Era exatamente isso que fazia o botão não responder.
 *
 * Aparece duas vezes no documento: no cartão de resumo, para quem já sabe que
 * quer o papel, e junto das assinaturas, para quem leu tudo e chegou na hora
 * de assinar.
 */
export function BotaoImprimir({
  rotulo = "Imprimir orçamento",
}: {
  rotulo?: string;
}) {
  return (
    <button type="button" data-imprimir className="btn solid">
      {rotulo}
    </button>
  );
}
