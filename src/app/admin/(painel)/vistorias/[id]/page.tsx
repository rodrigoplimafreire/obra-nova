import { notFound } from "next/navigation";
import { carregarVistoria } from "@/lib/vistoria/dados";
import { TelaDaVistoria } from "@/components/admin/tela-vistoria";

export const dynamic = "force-dynamic";

export default async function PaginaDaVistoria({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vistoria = await carregarVistoria(id);

  // `carregarVistoria` já filtra por org: visita de outra conta responde 404
  // igual a id inexistente, sem dizer qual dos dois é.
  if (!vistoria) notFound();

  return <TelaDaVistoria vistoria={vistoria} />;
}
