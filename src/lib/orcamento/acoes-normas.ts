"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/admin/sessao";
import { empreiteiraDaOrg } from "@/lib/admin/empreiteira";
import type { Resultado } from "@/lib/admin/tipos";

/**
 * As normas técnicas da seção 5, por orçamento.
 *
 * Garantia, horário de trabalho e responsável técnico continuam morando no
 * Perfil, porque são iguais em toda proposta da mesma empreiteira. Norma não
 * é: ela declara a disciplina do escopo. Uma obra só de estrutura citando
 * assentamento de porcelanato, impermeabilização de área molhada e instalação
 * hidrossanitária descreve um serviço que não vai acontecer — e num documento
 * feito para assinar isso não é excesso de zelo, é escopo errado.
 *
 * **Vazio continua querendo dizer "use a lista do Perfil".** Nenhuma proposta
 * existente muda de comportamento: quem não mexer aqui segue como antes.
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

export async function salvarNorma(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const orcamentoId = String(form.get("orcamentoId") ?? "");
  if (!(await orcamentoDaOrg(orcamentoId))) {
    return { ok: false, erro: "Orçamento inválido." };
  }

  const texto = String(form.get("texto") ?? "").trim();
  if (texto.length < 4) {
    return { ok: false, erro: "Escreva a norma." };
  }

  const sb = supabaseAdmin();
  const id = String(form.get("id") ?? "");

  if (id) {
    const { error } = await sb.from("orc_normas").update({ texto }).eq("id", id);
    if (error) return { ok: false, erro: error.message };
  } else {
    // A posição nasce do maior já usado, e não da contagem: apagar uma linha
    // do meio deixaria buraco, e a contagem repetiria uma posição que ainda
    // existe — a chave única barraria a inserção.
    const { data: ultimo } = await sb
      .from("orc_normas")
      .select("position")
      .eq("orcamento_id", orcamentoId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await sb.from("orc_normas").insert({
      orcamento_id: orcamentoId,
      position: (ultimo?.position ?? 0) + 1,
      texto,
    });
    if (error) return { ok: false, erro: error.message };
  }

  revalidar(orcamentoId);
  return { ok: true };
}

export async function removerNorma(
  orcamentoId: string,
  id: string,
): Promise<Resultado> {
  if (!(await orcamentoDaOrg(orcamentoId))) {
    return { ok: false, erro: "Orçamento inválido." };
  }
  const { error } = await supabaseAdmin()
    .from("orc_normas")
    .delete()
    .eq("id", id)
    .eq("orcamento_id", orcamentoId);
  if (error) return { ok: false, erro: error.message };

  revalidar(orcamentoId);
  return { ok: true };
}

/**
 * Puxa as normas do Perfil para o orçamento, para apagar as que não servem.
 *
 * É o mesmo atalho do "Puxar da planilha" nas macroetapas, pela mesma razão: o
 * trabalho real é **tirar** o que não é do escopo, não redigitar a ABNT. Se
 * para citar menos fosse preciso escrever tudo de novo, ninguém faria — e o
 * documento continuaria prometendo disciplina que a obra não tem.
 *
 * Não mexe no que já existe: com norma cadastrada, devolve erro em vez de
 * duplicar ou de apagar o que foi escrito à mão.
 */
export async function puxarNormasDoPerfil(
  orcamentoId: string,
): Promise<Resultado> {
  const { orgId } = await exigirAdmin();
  if (!(await orcamentoDaOrg(orcamentoId))) {
    return { ok: false, erro: "Orçamento inválido." };
  }

  const sb = supabaseAdmin();

  const { data: jaTem } = await sb
    .from("orc_normas")
    .select("id")
    .eq("orcamento_id", orcamentoId)
    .limit(1);
  if (jaTem?.length) {
    return { ok: false, erro: "Já existem normas. Apague antes de puxar." };
  }

  const empreiteira = await empreiteiraDaOrg(orgId);
  const doPerfil = empreiteira.contrato.normasTecnicas;
  if (doPerfil.length === 0) {
    return {
      ok: false,
      erro: "O Perfil não tem normas cadastradas para puxar.",
    };
  }

  const { error } = await sb.from("orc_normas").insert(
    doPerfil.map((texto, i) => ({
      orcamento_id: orcamentoId,
      position: i + 1,
      texto,
    })),
  );
  if (error) return { ok: false, erro: error.message };

  revalidar(orcamentoId);
  return { ok: true };
}

/**
 * Devolve todas as normas do orçamento à lista do Perfil.
 *
 * Apagar uma a uma até zerar daria no mesmo, mas quem quer voltar atrás não
 * deveria precisar de sete cliques para desfazer um.
 */
export async function voltarAsNormasDoPerfil(
  orcamentoId: string,
): Promise<Resultado> {
  if (!(await orcamentoDaOrg(orcamentoId))) {
    return { ok: false, erro: "Orçamento inválido." };
  }
  const { error } = await supabaseAdmin()
    .from("orc_normas")
    .delete()
    .eq("orcamento_id", orcamentoId);
  if (error) return { ok: false, erro: error.message };

  revalidar(orcamentoId);
  return { ok: true };
}
