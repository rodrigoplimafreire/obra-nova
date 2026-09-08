/**
 * Prova que as regras do pipeline valem **no banco**, e não só na tela.
 *
 * A tela não é o único caminho de escrita — há scripts, e vai haver mais. Se as
 * regras vivessem só no formulário, bastaria um `insert` para gravar um pedido
 * perdido sem motivo, e o relatório de "por que perdemos" nasceria furado sem
 * ninguém perceber.
 *
 * Roda contra o banco de verdade e **limpa o que criou**, inclusive quando
 * falha no meio.
 *
 *   npm run verificar:pipeline
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(URL, CHAVE, { auth: { persistSession: false } });

let falhas = 0;

function ok(certo: boolean, o_que: string, detalhe = "") {
  console.log(`  ${certo ? "ok  " : "FALHA"} ${o_que}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!certo) falhas++;
}

async function main() {
  const { data: org } = await sb
    .from("orgs")
    .select("id")
    .eq("nome_exibicao", "RD Engenharia")
    .maybeSingle();
  if (!org) throw new Error("Não achei a org RD Engenharia.");

  const criados: string[] = [];

  try {
    console.log("\nNúmero curto e evento de nascimento");

    const { data: a, error: erroA } = await sb
      .from("pipe_pedidos")
      .insert({ org_id: org.id, cliente_nome: "ZZ teste pipeline A" })
      .select("id, codigo, status")
      .single();
    if (erroA) throw new Error(erroA.message);
    criados.push(a.id);

    ok(a.codigo > 0, "o código é atribuído por trigger", `#${a.codigo}`);
    ok(a.status === "novo_pedido", "nasce em novo_pedido");

    const { data: b } = await sb
      .from("pipe_pedidos")
      .insert({ org_id: org.id, cliente_nome: "ZZ teste pipeline B" })
      .select("id, codigo")
      .single();
    if (b) criados.push(b.id);
    ok(b!.codigo === a.codigo + 1, "o próximo código é sequencial", `#${b!.codigo}`);

    const { data: ev0 } = await sb
      .from("pipe_eventos")
      .select("status_anterior, status_novo")
      .eq("pedido_id", a.id);
    ok(ev0?.length === 1, "o nascimento já vira evento");
    ok(ev0?.[0]?.status_anterior === null, "o primeiro evento não tem anterior");

    console.log("\nAs duas travas do PRD");

    const { error: semMotivo } = await sb
      .from("pipe_pedidos")
      .update({ status: "perdido" })
      .eq("id", a.id);
    ok(
      semMotivo !== null && /perdido_tem_motivo/.test(semMotivo?.message ?? ""),
      "perdido sem motivo é recusado pelo banco",
    );

    const { error: semValor } = await sb
      .from("pipe_pedidos")
      .update({ status: "fechado" })
      .eq("id", a.id);
    ok(
      semValor !== null && /fechado_tem_valor/.test(semValor?.message ?? ""),
      "fechado sem valor é recusado pelo banco",
    );

    const { error: comMotivo } = await sb
      .from("pipe_pedidos")
      .update({ status: "perdido", motivo_perda: "teste" })
      .eq("id", a.id);
    ok(comMotivo === null, "perdido com motivo passa");

    // Espaço em branco não é motivo: sem o `btrim` no check, " " passaria.
    const { error: soEspaco } = await sb
      .from("pipe_pedidos")
      .update({ status: "perdido", motivo_perda: "   " })
      .eq("id", b!.id);
    ok(soEspaco !== null, "motivo só com espaço em branco é recusado");

    console.log("\nTransições viram histórico");

    const { data: eventos } = await sb
      .from("pipe_eventos")
      .select("status_anterior, status_novo")
      .eq("pedido_id", a.id)
      .order("changed_at");
    ok(eventos?.length === 2, "a mudança de estado gravou um segundo evento");
    ok(
      eventos?.[1]?.status_anterior === "novo_pedido" &&
        eventos?.[1]?.status_novo === "perdido",
      "o evento guarda de onde veio e para onde foi",
    );

    console.log("\nEsforço somado pela visão");

    await sb.from("pipe_tempos").insert([
      { org_id: org.id, pedido_id: a.id, etapa: "visita_tecnica", minutos: 90 },
      { org_id: org.id, pedido_id: a.id, etapa: "estudo_projeto", minutos: 45 },
      // Segunda sessão da mesma etapa: tem que somar, não substituir.
      { org_id: org.id, pedido_id: a.id, etapa: "estudo_projeto", minutos: 30 },
      { org_id: org.id, pedido_id: a.id, etapa: "deslocamento", minutos: 40, km: 22.5 },
    ]);

    const { data: resumo } = await sb
      .from("pipe_pedidos_resumo")
      .select("total_minutos, total_horas, km_total, etapas_registradas, custo_estimado")
      .eq("id", a.id)
      .single();

    ok(Number(resumo!.total_minutos) === 205, "soma os minutos de todas as etapas", `${resumo!.total_minutos} min`);
    ok(Number(resumo!.total_horas) === 3.42, "converte para horas", `${resumo!.total_horas} h`);
    ok(Number(resumo!.km_total) === 22.5, "soma os km");
    ok(
      Number(resumo!.etapas_registradas) === 3,
      "conta etapas distintas, não lançamentos",
      `${resumo!.etapas_registradas} etapas em 4 lançamentos`,
    );

    console.log("\nCusto: nulo é nulo, nunca zero");

    const { data: ajusteAntes } = await sb
      .from("org_ajustes")
      .select("custo_hora, custo_km")
      .eq("org_id", org.id)
      .maybeSingle();

    await sb
      .from("org_ajustes")
      .upsert({ org_id: org.id, custo_hora: null, custo_km: null }, { onConflict: "org_id" });

    const { data: semCusto } = await sb
      .from("pipe_pedidos_resumo")
      .select("custo_estimado")
      .eq("id", a.id)
      .single();
    ok(
      semCusto!.custo_estimado === null,
      "sem custo/hora o custo estimado é nulo, não R$ 0,00",
    );

    await sb
      .from("org_ajustes")
      .upsert({ org_id: org.id, custo_hora: 100, custo_km: 2 }, { onConflict: "org_id" });

    const { data: comCusto } = await sb
      .from("pipe_pedidos_resumo")
      .select("custo_estimado")
      .eq("id", a.id)
      .single();
    // 205 min = 3,4167 h × R$ 100 = R$ 341,67 + 22,5 km × R$ 2 = R$ 45 → 386,67
    ok(
      Number(comCusto!.custo_estimado) === 386.67,
      "com premissas, soma hora e deslocamento",
      `${comCusto!.custo_estimado}`,
    );

    // Devolve as premissas como estavam: este script não decide o custo da RD.
    await sb.from("org_ajustes").upsert(
      {
        org_id: org.id,
        custo_hora: ajusteAntes?.custo_hora ?? null,
        custo_km: ajusteAntes?.custo_km ?? null,
      },
      { onConflict: "org_id" },
    );

    console.log("\nApagar o pedido leva junto tempo e histórico");
    await sb.from("pipe_pedidos").delete().eq("id", a.id);
    criados.splice(criados.indexOf(a.id), 1);

    const [{ count: tempos }, { count: evs }] = await Promise.all([
      sb.from("pipe_tempos").select("id", { count: "exact", head: true }).eq("pedido_id", a.id),
      sb.from("pipe_eventos").select("id", { count: "exact", head: true }).eq("pedido_id", a.id),
    ]);
    ok(tempos === 0 && evs === 0, "cascade limpa tempos e eventos");
  } finally {
    // Sai limpo mesmo se falhou no meio: teste que deixa lixo no banco de
    // produção é pior que teste nenhum.
    for (const id of criados) {
      await sb.from("pipe_pedidos").delete().eq("id", id);
    }
  }

  console.log(
    falhas === 0
      ? "\nTudo certo. As regras estão no banco, não só na tela.\n"
      : `\n${falhas} verificação(ões) falharam.\n`,
  );
  if (falhas > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
