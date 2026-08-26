import { listarBasesDePreco } from "@/lib/orcamento/precos";
import { PainelDePrecos } from "@/components/admin/painel-precos";

export const dynamic = "force-dynamic";

export default async function ListaDeBasesDePreco() {
  const bases = await listarBasesDePreco();
  return <PainelDePrecos bases={bases} />;
}
