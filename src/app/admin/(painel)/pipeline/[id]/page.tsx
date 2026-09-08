import { notFound } from "next/navigation";
import { carregarPedido } from "@/lib/pipeline/dados";
import { TelaDoPedido } from "@/components/admin/tela-pedido";

export const dynamic = "force-dynamic";

export default async function PaginaDoPedido({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pedido = await carregarPedido(id);

  // `carregarPedido` já filtra por org: pedido de outra empreiteira responde
  // 404 igual a id inexistente, sem dizer qual dos dois é.
  if (!pedido) notFound();

  return <TelaDoPedido pedido={pedido} />;
}
