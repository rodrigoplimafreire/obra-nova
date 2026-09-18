import path from "node:path";
import type { NextConfig } from "next";
import { HOST_DO_DIARIO } from "./src/lib/diario/apelido";

const nextConfig: NextConfig = {
  // Existe um package-lock.json na pasta acima (C:\ProjetosDev). Sem isto o
  // Turbopack elege aquela pasta como raiz do workspace.
  turbopack: { root: path.resolve(__dirname) },

  /**
   * O domínio próprio do diário: `diario.rd.eng.br/rodrigo` serve `/d/rodrigo`.
   *
   * Mesma ideia do `orcamentos.rd.eng.br`, e o mesmo motivo: o link vai por
   * WhatsApp para o cliente da empreiteira, e um endereço com a marca dela
   * vale mais que um `.vercel.app` com 32 caracteres aleatórios.
   *
   * **`afterFiles`, e não `beforeFiles`.** `beforeFiles` roda antes de olhar o
   * sistema de arquivos, então `/:apelido` engoliria `/favicon.ico` e os
   * estáticos do `public/`. Em `afterFiles` os arquivos reais ganham, e a
   * reescrita só pega o que sobra — antes das rotas dinâmicas, que é
   * exatamente onde ela precisa entrar.
   *
   * A rota de destino é a mesma `/d/[token]`: ela resolve apelido **ou**
   * token, então o link antigo não morre por causa disto.
   */
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [
        {
          source: "/:apelido",
          has: [{ type: "host", value: HOST_DO_DIARIO }],
          destination: "/d/:apelido",
        },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;
