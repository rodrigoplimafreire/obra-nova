import { listarVistorias, pedidosParaVistoria } from "@/lib/vistoria/dados";
import { PainelDeVistorias } from "@/components/admin/painel-vistorias";

export const dynamic = "force-dynamic";

export default async function Vistorias() {
  const [vistorias, pedidos] = await Promise.all([
    listarVistorias(),
    pedidosParaVistoria(),
  ]);

  return <PainelDeVistorias vistorias={vistorias} pedidos={pedidos} />;
}
