import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { carregarRelatorioPublicado } from "@/lib/relatorio/dados";
import { previewDoLinkPublico } from "@/lib/acesso/preview";
import { PaginaDoCliente } from "@/components/relatorio/pagina-do-cliente";

export const dynamic = "force-dynamic";

/**
 * O cartão do WhatsApp sai na marca da empreiteira, não na do Obra Nova.
 *
 * Era estático e herdava o `openGraph` do layout raiz, então o cliente da
 * obra recebia um preview do fornecedor de software da empreiteira dele. Ver
 * `@/lib/acesso/preview`.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const relatorio = await carregarRelatorioPublicado(token);

  if (!relatorio) {
    return previewDoLinkPublico({
      titulo: "Relatório da obra",
      descricao: "Este endereço não existe.",
      empreiteira: null,
    });
  }

  return previewDoLinkPublico({
    titulo: `${relatorio.obra.nome} — ${relatorio.obra.cliente}`,
    descricao: "Relatório da semana na obra, com fotos do canteiro.",
    empreiteira: relatorio.obra.marcaNome,
  });
}

export default async function Relatorio({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Não publicado devolve 404 igual a token inexistente: quem tem o link e
  // ainda não foi liberado não precisa saber que o relatório existe.
  const relatorio = await carregarRelatorioPublicado(token);
  if (!relatorio) notFound();

  return <PaginaDoCliente relatorio={relatorio} />;
}
