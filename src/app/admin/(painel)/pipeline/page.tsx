import { ajustesDaOrg, listarPedidos } from "@/lib/pipeline/dados";
import { empreiteiraAtual } from "@/lib/admin/empreiteira";
import { PainelDePipeline } from "@/components/admin/painel-pipeline";

export const dynamic = "force-dynamic";

export default async function Pipeline() {
  // A empreiteira só serve ao cabeçalho da folha impressa — quem recebe a
  // posição do funil precisa saber de quem ela é.
  const [pedidos, ajustes, empreiteira] = await Promise.all([
    listarPedidos(),
    ajustesDaOrg(),
    empreiteiraAtual(),
  ]);

  return (
    <PainelDePipeline
      pedidos={pedidos}
      empreiteira={empreiteira.nome ?? "Pipeline"}
      // O custo só aparece quando existe premissa. Sem custo/hora, mostrar
      // R$ 0,00 seria afirmar que produzir orçamento não custa nada.
      semCustoHora={ajustes.custoHora === null}
    />
  );
}
