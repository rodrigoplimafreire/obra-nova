"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { gerarRelatorio } from "@/lib/relatorio/executar";
import { exigirAdmin, orgAtual } from "./sessao";
import type { Resultado } from "./tipos";

const FORMATO_DE_DIA = /^\d{4}-\d{2}-\d{2}$/;

async function obraDaOrg(obraId: string) {
  const { data } = await supabaseAdmin()
    .from("obras")
    .select("id")
    .eq("id", obraId)
    .eq("org_id", await orgAtual())
    .maybeSingle();
  return data;
}

export async function gerarRelatorioDaSemana(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  await exigirAdmin();

  const obraId = String(form.get("obraId") ?? "");
  const inicio = String(form.get("inicio") ?? "");
  const fim = String(form.get("fim") ?? "");

  if (!obraId) return { ok: false, erro: "Obra inválida." };
  if (!FORMATO_DE_DIA.test(inicio) || !FORMATO_DE_DIA.test(fim)) {
    return { ok: false, erro: "Período inválido." };
  }
  if (!(await obraDaOrg(obraId))) {
    return { ok: false, erro: "Obra não encontrada." };
  }

  const saida = await gerarRelatorio(obraId, inicio, fim);

  revalidatePath(`/admin/obras/${obraId}`);
  return saida.ok ? { ok: true } : { ok: false, erro: saida.erro };
}

/**
 * Libera o link para o cliente.
 *
 * O passo existe porque o texto é escrito por IA e vai para quem paga a obra.
 * Publicar é um ato de quem responde pelo serviço, não um efeito colateral de
 * ter clicado em gerar.
 */
export async function publicarRelatorio(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  await exigirAdmin();

  const obraId = String(form.get("obraId") ?? "");
  const relatorioId = String(form.get("relatorioId") ?? "");
  if (!obraId || !relatorioId) return { ok: false, erro: "Relatório inválido." };
  if (!(await obraDaOrg(obraId))) {
    return { ok: false, erro: "Obra não encontrada." };
  }

  const sb = supabaseAdmin();

  const { data: relatorio } = await sb
    .from("relatorios")
    .select("id, status")
    .eq("id", relatorioId)
    .eq("obra_id", obraId)
    .maybeSingle();
  if (!relatorio) return { ok: false, erro: "Relatório não encontrado." };
  if (relatorio.status !== "pronto") {
    return { ok: false, erro: "Só dá para publicar um relatório pronto." };
  }

  const { error } = await sb
    .from("relatorios")
    .update({ publicado_em: new Date().toISOString() })
    .eq("id", relatorioId);

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/admin/obras/${obraId}`);
  return { ok: true };
}

/** Tira o link do ar. O endereço continua o mesmo se você publicar de novo. */
export async function despublicarRelatorio(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  await exigirAdmin();

  const obraId = String(form.get("obraId") ?? "");
  const relatorioId = String(form.get("relatorioId") ?? "");
  if (!obraId || !relatorioId) return { ok: false, erro: "Relatório inválido." };
  if (!(await obraDaOrg(obraId))) {
    return { ok: false, erro: "Obra não encontrada." };
  }

  const { error } = await supabaseAdmin()
    .from("relatorios")
    .update({ publicado_em: null })
    .eq("id", relatorioId)
    .eq("obra_id", obraId);

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/admin/obras/${obraId}`);
  return { ok: true };
}
