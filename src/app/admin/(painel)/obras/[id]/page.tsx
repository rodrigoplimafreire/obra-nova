import { notFound } from "next/navigation";
import { carregarObra, hojeNaObra, pendenciasAntesDe } from "@/lib/admin/obras";
import { semanaDe } from "@/lib/obra/dados";
import { carregarRelatorioDaSemana } from "@/lib/relatorio/dados";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { TelaDaObra } from "@/components/admin/tela-obra";

export const dynamic = "force-dynamic";

const FORMATO_DE_DIA = /^\d{4}-\d{2}-\d{2}$/;

export default async function Obra({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dia?: string; aba?: string }>;
}) {
  const { id } = await params;
  const { dia: pedido, aba } = await searchParams;

  const hoje = hojeNaObra();
  // Data malformada na URL cai para hoje em vez de quebrar a tela.
  const dia = pedido && FORMATO_DE_DIA.test(pedido) ? pedido : hoje;

  const detalhe = await carregarObra(id, dia);
  if (!detalhe) notFound();

  // A semana do dia que está sendo visto: trocar a data na aba Checklist
  // troca também a semana que o relatório cobre.
  const semana = semanaDe(dia);
  const inicio = semana[0];
  const fim = semana[semana.length - 1];

  const [pendencias, relatorio, { count: servicosNaSemana }] = await Promise.all([
    pendenciasAntesDe(id, dia),
    carregarRelatorioDaSemana(id, inicio, fim),
    supabaseAdmin()
      .from("atividades")
      .select("id", { count: "exact", head: true })
      .eq("obra_id", id)
      .gte("dia", inicio)
      .lte("dia", fim),
  ]);

  return (
    <TelaDaObra
      detalhe={detalhe}
      dia={dia}
      hoje={hoje}
      aba={
        aba === "mestres" ? "mestres" : aba === "relatorio" ? "relatorio" : "checklist"
      }
      pendencias={pendencias}
      semana={{ inicio, fim, temServicos: (servicosNaSemana ?? 0) > 0 }}
      relatorio={relatorio}
    />
  );
}
