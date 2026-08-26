import { carregarVisaoDoDia } from "@/lib/admin/visao-do-dia";
import { empreiteiraAtual } from "@/lib/admin/empreiteira";
import { TelaDeInicio } from "@/components/admin/tela-inicio";

export const dynamic = "force-dynamic";

/**
 * A abertura do painel. Antes esta rota só redirecionava para Obras, e não
 * existia lugar que respondesse "o que precisa de mim hoje?".
 */
export default async function Painel() {
  const [visao, empreiteira] = await Promise.all([
    carregarVisaoDoDia(),
    empreiteiraAtual(),
  ]);

  return <TelaDeInicio visao={visao} nome={empreiteira.nome} />;
}
