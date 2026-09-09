"use client";

/**
 * Botão de imprimir de verdade, não instrução para apertar Ctrl+P.
 *
 * Pedido do Rodrigo pensando no cliente com pouca intimidade com computador,
 * abrindo o link no celular: ninguém que precisa da proposta impressa vai
 * descobrir um atalho de teclado sozinho.
 *
 * **Tem `onClick` e `data-imprimir` ao mesmo tempo, de propósito.** O documento
 * chega ao cliente por dois caminhos e cada um mata um dos dois: no GET direto
 * a página não hidrata e o `onClick` nunca roda; na resposta do gate o React
 * está vivo, mas o `<script>` inline que instala o ouvinte de DOM não executa.
 * Os dois chamam `__imprimirRD`, que ignora a segunda chamada seguida — ver o
 * comentário longo em `documento-do-cliente.tsx`.
 *
 * Aparece duas vezes no documento: no cartão de resumo, para quem já sabe que
 * quer o papel, e junto das assinaturas, para quem leu tudo e chegou na hora
 * de assinar.
 */
declare global {
  interface Window {
    __imprimirRD?: () => void;
  }
}

export function BotaoImprimir({
  rotulo = "Imprimir orçamento",
}: {
  rotulo?: string;
}) {
  return (
    <button
      type="button"
      data-imprimir
      className="btn solid"
      onClick={() => {
        // O ouvinte de DOM já tratou este mesmo clique quando o script inline
        // rodou; `__imprimirRD` engole a repetição. O `window.print()` cru é
        // para o caso em que o script não executou.
        if (window.__imprimirRD) window.__imprimirRD();
        else window.print();
      }}
    >
      {rotulo}
    </button>
  );
}
