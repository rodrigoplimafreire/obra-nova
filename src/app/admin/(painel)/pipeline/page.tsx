import { ajustesDaOrg, listarPedidos } from "@/lib/pipeline/dados";
import { PainelDePipeline } from "@/components/admin/painel-pipeline";

export const dynamic = "force-dynamic";

export default async function Pipeline() {
  const [pedidos, ajustes] = await Promise.all([
    listarPedidos(),
    ajustesDaOrg(),
  ]);

  return (
    <PainelDePipeline
      pedidos={pedidos}
      // O custo só aparece quando existe premissa. Sem custo/hora, mostrar
      // R$ 0,00 seria afirmar que produzir orçamento não custa nada.
      semCustoHora={ajustes.custoHora === null}
    />
  );
}
