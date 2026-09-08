import { carregarPrecificacao } from "@/lib/pipeline/dados";
import { listarOrcamentos } from "@/lib/orcamento/dados";
import { TelaDePrecificacao } from "@/components/admin/tela-precificacao";

export const dynamic = "force-dynamic";

export default async function Precificacao() {
  const [{ premissas, carga }, orcamentos] = await Promise.all([
    carregarPrecificacao(),
    listarOrcamentos(),
  ]);

  // Obras de verdade da empreiteira, do menor valor ao maior: é olhando o
  // peso sobre elas que se decide se a carga é vendável. Exemplo inventado
  // não faz ninguém mudar de ideia.
  const exemplos = orcamentos
    .filter((o): o is typeof o & { total: number } => o.total !== null && o.total > 0)
    .sort((a, b) => a.total - b.total)
    .filter((_, i, lista) => i === 0 || i === Math.floor(lista.length / 2) || i === lista.length - 1)
    .map((o) => ({ cliente: o.cliente, valor: o.total }));

  return (
    <TelaDePrecificacao
      premissas={premissas}
      carga={carga}
      exemplos={exemplos}
    />
  );
}
