import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Existe um package-lock.json na pasta acima (C:\ProjetosDev). Sem isto o
  // Turbopack elege aquela pasta como raiz do workspace.
  turbopack: { root: path.resolve(__dirname) },

  /**
   * As propostas escritas à mão, servidas de `public/<cliente>/index.html`.
   *
   * São o formato antigo de orcamentos.rd.eng.br: HTML solto, sem banco e sem
   * token. O `public/` do Next serve o arquivo em `/<cliente>/index.html`, mas
   * não em `/<cliente>` — e o link que a RD manda é o curto. A reescrita é o
   * que faz `https://orcamentos.rd.eng.br/fatima` abrir.
   *
   * Uma entrada por cliente, de propósito: um `/:cliente` genérico engoliria
   * qualquer rota nova de primeiro nível do painel.
   */
  async rewrites() {
    return [{ source: "/fatima", destination: "/fatima/index.html" }];
  },
};

export default nextConfig;
