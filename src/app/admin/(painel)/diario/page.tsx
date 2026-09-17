import { carregarDia, garantirDiario, listarDias } from "@/lib/diario/dados";
import { diaValido, hojeNaEmpreiteira } from "@/lib/tempo";
import { TelaDoDiario } from "@/components/admin/tela-diario";

export const dynamic = "force-dynamic";

/** Transcrever e resumir chamam provedor externo; ver a página do orçamento. */
export const maxDuration = 60;

export default async function Diario({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string }>;
}) {
  const { dia: pedido } = await searchParams;

  const diario = await garantirDiario();
  const hoje = hojeNaEmpreiteira();
  const dia = pedido && diaValido(pedido) ? pedido : hoje;

  const [atual, dias] = await Promise.all([
    carregarDia(diario.id, dia),
    listarDias(diario.id),
  ]);

  return (
    <TelaDoDiario
      diario={diario}
      hoje={hoje}
      atual={atual}
      dias={dias}
      urlBase={process.env.NEXT_PUBLIC_SITE_URL ?? ""}
    />
  );
}
