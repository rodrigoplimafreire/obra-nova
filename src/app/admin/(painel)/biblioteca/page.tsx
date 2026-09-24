import { listarBiblioteca } from "@/lib/orcamento/biblioteca";
import { PainelDaBiblioteca } from "@/components/admin/painel-biblioteca";

export const dynamic = "force-dynamic";

export default async function Biblioteca() {
  const servicos = await listarBiblioteca();
  return <PainelDaBiblioteca servicos={servicos} />;
}
