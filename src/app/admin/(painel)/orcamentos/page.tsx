import { listarOrcamentos } from "@/lib/orcamento/dados";
import { PainelDeOrcamentos } from "@/components/admin/painel-orcamentos";

export const dynamic = "force-dynamic";

export default async function ListaDeOrcamentos() {
  const orcamentos = await listarOrcamentos(true);
  return <PainelDeOrcamentos orcamentos={orcamentos} />;
}
