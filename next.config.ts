import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Existe um package-lock.json na pasta acima (C:\ProjetosDev). Sem isto o
  // Turbopack elege aquela pasta como raiz do workspace.
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
