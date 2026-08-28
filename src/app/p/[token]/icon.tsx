import { readFile } from "node:fs/promises";
import path from "node:path";
import { carregarOrcamentoPublicado } from "@/lib/orcamento/publico";
import { lerMarca } from "@/lib/orcamento/marcas";

/**
 * O favicon deste orçamento é da empreiteira, não do Obra Nova.
 *
 * O link roda por WhatsApp com o nome de quem executa a obra — a aba do
 * navegador precisa confirmar isso de relance, não denunciar a ferramenta por
 * trás. Um cliente que vê o ícone errado desconfia que o link é falso antes
 * de ler a primeira palavra do documento.
 *
 * Rota por `[token]` porque cada orçamento pode ser de uma empreiteira
 * diferente — o Obra Nova atende várias. Sem publicação (link ainda não
 * liberado), cai no ícone do Obra Nova: não há marca de cliente para mostrar.
 */
export const size = { width: 32, height: 32 };

export default async function Icon({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const orcamento = await carregarOrcamentoPublicado(token);
  const marca = lerMarca(orcamento?.documento.marca);

  const arquivo = await readFile(path.join(process.cwd(), "public", marca.favicon));
  const tipo = marca.favicon.endsWith(".svg") ? "image/svg+xml" : "image/png";

  return new Response(new Uint8Array(arquivo), {
    headers: { "Content-Type": tipo },
  });
}
