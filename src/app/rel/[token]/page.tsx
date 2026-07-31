import { notFound } from "next/navigation";
import { carregarRelatorioPublicado } from "@/lib/relatorio/dados";
import { PaginaDoCliente } from "@/components/relatorio/pagina-do-cliente";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Relatório da obra",
  // O link vai por WhatsApp para uma pessoa só. Nada de buscador.
  robots: { index: false, follow: false },
};

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
