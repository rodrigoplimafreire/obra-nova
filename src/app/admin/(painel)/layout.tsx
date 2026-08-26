import { exigirAdmin } from "@/lib/admin/sessao";
import { Casca } from "@/components/admin/casca";

/**
 * O grupo (painel) existe para que /admin/login fique fora daqui: a tela de
 * login não pode exigir sessão nem herdar a barra lateral.
 */
export default async function LayoutDoPainel({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await exigirAdmin();
  return (
    <Casca
      email={admin.email}
      avatar={admin.avatar}
      orgs={admin.orgs}
      orgAtiva={admin.orgId}
    >
      {children}
    </Casca>
  );
}
