import { ajustesDaOrg, listarPedidos } from "@/lib/pipeline/dados";
import { TelaDeAnalise } from "@/components/admin/tela-analise";

export const dynamic = "force-dynamic";

export default async function Analise() {
  const [pedidos, ajustes] = await Promise.all([
    listarPedidos(),
    ajustesDaOrg(),
  ]);

  return <TelaDeAnalise pedidos={pedidos} ajustes={ajustes} />;
}
