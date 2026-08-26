import { exigirAdmin } from "@/lib/admin/sessao";
import { empreiteiraAtual } from "@/lib/admin/empreiteira";
import { TelaDePerfil } from "@/components/admin/tela-perfil";

export const dynamic = "force-dynamic";

export default async function Perfil() {
  const [{ email, avatar }, empreiteira] = await Promise.all([
    exigirAdmin(),
    empreiteiraAtual(),
  ]);

  return (
    <TelaDePerfil email={email} avatar={avatar} empreiteira={empreiteira} />
  );
}
