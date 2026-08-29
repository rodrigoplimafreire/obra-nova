import { listarOrcamentos } from "@/lib/orcamento/dados";
import { empreiteiraAtual } from "@/lib/admin/empreiteira";
import { PainelDeOrcamentos } from "@/components/admin/painel-orcamentos";

export const dynamic = "force-dynamic";

export default async function ListaDeOrcamentos() {
  // A empreiteira só serve ao cabeçalho da lista impressa — quem recebe o
  // papel precisa saber de quem ele é.
  const [orcamentos, empreiteira] = await Promise.all([
    listarOrcamentos(true),
    empreiteiraAtual(),
  ]);

  return (
    <PainelDeOrcamentos
      orcamentos={orcamentos}
      empreiteira={empreiteira.nome ?? "Orçamentos"}
    />
  );
}
