import { listarObras } from "@/lib/admin/obras";
import { PainelDeObras } from "@/components/admin/painel-obras";

export const dynamic = "force-dynamic";

export default async function Obras() {
  const obras = await listarObras();
  return <PainelDeObras obras={obras} />;
}
