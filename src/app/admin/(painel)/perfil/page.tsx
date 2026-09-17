import { exigirAdmin } from "@/lib/admin/sessao";
import { empreiteiraAtual } from "@/lib/admin/empreiteira";
import { listarAcessos, listarEmpreiteiras } from "@/lib/admin/acessos";
import { TelaDePerfil } from "@/components/admin/tela-perfil";

export const dynamic = "force-dynamic";

export default async function Perfil() {
  const { email, avatar, ehOperador } = await exigirAdmin();

  // Para quem não é operador a lista nem é buscada: não é a interface que
  // esconde a seção, é o dado que não existe do lado do servidor.
  const [empreiteira, acessos, empreiteiras] = await Promise.all([
    empreiteiraAtual(),
    ehOperador ? listarAcessos() : Promise.resolve(null),
    ehOperador ? listarEmpreiteiras() : Promise.resolve([]),
  ]);

  return (
    <TelaDePerfil
      email={email}
      avatar={avatar}
      empreiteira={empreiteira}
      acessos={acessos}
      empreiteiras={empreiteiras}
    />
  );
}
