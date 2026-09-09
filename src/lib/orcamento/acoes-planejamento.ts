"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/admin/sessao";
import { lerNumero } from "./formato";
import type { Resultado } from "@/lib/admin/tipos";

/**
 * As seções 2 e 4 da proposta canônica: o resumo por módulo e o cronograma
 * executivo físico-financeiro.
 *
 * Nada aqui é obrigatório. Nem toda obra tem cronograma semana a semana — o
 * Rodrigo foi explícito: quando o cliente não passar a informação, a seção
 * simplesmente não aparece no documento. Publicar nunca fica bloqueado por
 * falta destes dados, do mesmo jeito que não fica por falta de texto.
 */

async function orcamentoDaOrg(orcamentoId: string): Promise<boolean> {
  const { orgId } = await exigirAdmin();
  const { data } = await supabaseAdmin()
    .from("orc_orcamentos")
    .select("id")
    .eq("id", orcamentoId)
    .eq("org_id", orgId)
    .maybeSingle();
  return Boolean(data);
}

function revalidar(orcamentoId: string) {
  revalidatePath(`/admin/orcamentos/${orcamentoId}`);
}

/** Campo em branco volta a `null`, não a string vazia: apagar é uma decisão. */
function ouNulo(form: FormData, campo: string): string | null {
  const valor = String(form.get(campo) ?? "").trim();
  return valor.length > 0 ? valor : null;
}

/* ---------------------------------------------------------------- módulos */

export async function salvarModulo(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const orcamentoId = String(form.get("orcamentoId") ?? "");
  if (!(await orcamentoDaOrg(orcamentoId))) {
    return { ok: false, erro: "Orçamento inválido." };
  }

  const nome = String(form.get("nome") ?? "").trim();
  if (nome.length < 2) {
    return { ok: false, erro: "Escreva o nome da macroetapa." };
  }

  const sb = supabaseAdmin();
  const id = String(form.get("id") ?? "");

  const campos = {
    nome,
    prazo: ouNulo(form, "prazo"),
    valor: lerNumero(String(form.get("valor") ?? "")),
    percentual: lerNumero(String(form.get("percentual") ?? "")),
  };

  if (id) {
    const { error } = await sb.from("orc_modulos").update(campos).eq("id", id);
    if (error) return { ok: false, erro: error.message };
  } else {
    // A posição nasce do maior já usado, e não da contagem: apagar uma linha
    // do meio deixaria buraco e a contagem repetiria uma posição que ainda
    // existe — e a chave única barraria a inserção.
    const { data: ultimo } = await sb
      .from("orc_modulos")
      .select("position")
      .eq("orcamento_id", orcamentoId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await sb.from("orc_modulos").insert({
      orcamento_id: orcamentoId,
      position: (ultimo?.position ?? 0) + 1,
      ...campos,
    });
    if (error) return { ok: false, erro: error.message };
  }

  revalidar(orcamentoId);
  return { ok: true };
}

export async function removerModulo(
  orcamentoId: string,
  id: string,
): Promise<Resultado> {
  if (!(await orcamentoDaOrg(orcamentoId))) {
    return { ok: false, erro: "Orçamento inválido." };
  }
  const { error } = await supabaseAdmin()
    .from("orc_modulos")
    .delete()
    .eq("id", id)
    .eq("orcamento_id", orcamentoId);
  if (error) return { ok: false, erro: error.message };

  revalidar(orcamentoId);
  return { ok: true };
}

/**
 * Puxa as macroetapas dos grupos da planilha.
 *
 * O atalho existe porque digitar de novo o que já está na tabela é onde o
 * preenchimento morre. Traz nome, soma e percentual de cada grupo; o prazo
 * fica em branco, que é justamente a informação que só o Reginato tem.
 *
 * Não mexe no que já existe: se já houver módulo cadastrado, devolve erro em
 * vez de duplicar ou de apagar o que foi escrito à mão.
 */
export async function puxarModulosDosGrupos(
  orcamentoId: string,
): Promise<Resultado> {
  if (!(await orcamentoDaOrg(orcamentoId))) {
    return { ok: false, erro: "Orçamento inválido." };
  }

  const sb = supabaseAdmin();

  const { data: jaTem } = await sb
    .from("orc_modulos")
    .select("id")
    .eq("orcamento_id", orcamentoId)
    .limit(1);
  if (jaTem?.length) {
    return { ok: false, erro: "Já existem macroetapas. Apague antes de puxar." };
  }

  const { data: itens } = await sb
    .from("orc_itens")
    .select("grupo, total, position")
    .eq("orcamento_id", orcamentoId)
    .is("removido_em", null)
    .order("position");

  // Ordem de aparição na planilha, e não alfabética: a planilha já está na
  // ordem em que a obra acontece, e reordenar aqui bagunçaria a leitura.
  const somas = new Map<string, number>();
  for (const item of itens ?? []) {
    const grupo = item.grupo?.trim();
    if (!grupo) continue;
    somas.set(grupo, (somas.get(grupo) ?? 0) + (item.total ?? 0));
  }
  if (somas.size === 0) {
    return { ok: false, erro: "A planilha não tem grupos para puxar." };
  }

  const totalGeral = [...somas.values()].reduce((a, b) => a + b, 0);

  const linhas = [...somas.entries()].map(([nome, valor], i) => ({
    orcamento_id: orcamentoId,
    position: i + 1,
    nome,
    prazo: null,
    // Sem valor não há percentual: dividir por zero devolveria NaN, e um
    // percentual falso numa proposta é pior que percentual nenhum.
    valor: valor > 0 ? valor : null,
    percentual:
      totalGeral > 0 && valor > 0
        ? Math.round((valor / totalGeral) * 1000) / 10
        : null,
  }));

  const { error } = await sb.from("orc_modulos").insert(linhas);
  if (error) return { ok: false, erro: error.message };

  revalidar(orcamentoId);
  return { ok: true };
}

/* ------------------------------------------------------------- cronograma */

export async function salvarSemana(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const orcamentoId = String(form.get("orcamentoId") ?? "");
  if (!(await orcamentoDaOrg(orcamentoId))) {
    return { ok: false, erro: "Orçamento inválido." };
  }

  const semana = lerNumero(String(form.get("semana") ?? ""));
  if (semana === null || semana < 1 || semana > 104) {
    return { ok: false, erro: "A semana precisa ser um número de 1 a 104." };
  }

  const campos = {
    semana,
    titulo: ouNulo(form, "titulo"),
    fisico: ouNulo(form, "fisico"),
    financeiro: lerNumero(String(form.get("financeiro") ?? "")),
    marco: ouNulo(form, "marco"),
    critico: form.get("critico") === "on",
  };

  const sb = supabaseAdmin();
  const id = String(form.get("id") ?? "");

  const { error } = id
    ? await sb.from("orc_cronograma").update(campos).eq("id", id)
    : await sb
        .from("orc_cronograma")
        .insert({ orcamento_id: orcamentoId, ...campos });

  if (error) {
    // A chave única (orcamento_id, semana) é o que impede duas linhas para a
    // mesma semana. Traduzida aqui porque a mensagem crua do Postgres não diz
    // nada a quem está preenchendo.
    if (error.code === "23505") {
      return { ok: false, erro: `A semana ${semana} já está no cronograma.` };
    }
    return { ok: false, erro: error.message };
  }

  revalidar(orcamentoId);
  return { ok: true };
}

export async function removerSemana(
  orcamentoId: string,
  id: string,
): Promise<Resultado> {
  if (!(await orcamentoDaOrg(orcamentoId))) {
    return { ok: false, erro: "Orçamento inválido." };
  }
  const { error } = await supabaseAdmin()
    .from("orc_cronograma")
    .delete()
    .eq("id", id)
    .eq("orcamento_id", orcamentoId);
  if (error) return { ok: false, erro: error.message };

  revalidar(orcamentoId);
  return { ok: true };
}
