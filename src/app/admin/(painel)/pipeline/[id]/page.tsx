import { notFound } from "next/navigation";
import { carregarPedido, carregarPrecificacao } from "@/lib/pipeline/dados";
import { TelaDoPedido } from "@/components/admin/tela-pedido";

export const dynamic = "force-dynamic";

export default async function PaginaDoPedido({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [pedido, { carga }] = await Promise.all([
    carregarPedido(id),
    carregarPrecificacao(),
  ]);

  // `carregarPedido` já filtra por org: pedido de outra empreiteira responde
  // 404 igual a id inexistente, sem dizer qual dos dois é.
  if (!pedido) notFound();

  return (
    <TelaDoPedido
      pedido={pedido}
      // Sem porte definido, vale a carga da obra média — é o palpite menos
      // ruim, e esconder o número seria pior que mostrar o do meio.
      carga={carga.porPorte?.[pedido.porte ?? "M"] ?? null}
    />
  );
}
