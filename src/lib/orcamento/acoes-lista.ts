"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/admin/sessao";
import { carregarOrcamento } from "./dados";
import { montarDocumento } from "./publicacao";
import type { Enums } from "@/lib/database.types";

/**
 * As ações que a lista de orçamentos precisa chamar direto, sem abrir a tela.
 *
 * Existem em separado de `acoes.ts` e `acoes-publicacao.ts` porque aquelas
 * falam `FormData` — assinatura de `useActionState`, feita para formulário. Um
 * item de menu não tem formulário, e montar um `FormData` só para satisfazer a
 * assinatura escondia o que estava sendo chamado. A regra de negócio continua
 * onde estava; aqui é só a porta.
 */

type Saida = { ok: boolean; erro?: string };

/** Situações que se marca à mão, iguais às da tela do orçamento. */
const PERMITIDAS: Enums<"orc_situacao">[] = [
  "enviado",
  "negociando",
  "aprovado",
  "recusado",
  "expirado",
];

export async function mudarSituacao(
  id: string,
  situacao: string,
): Promise<Saida> {
  const { orgId } = await exigirAdmin();
  const alvo = PERMITIDAS.find((s) => s === situacao);
  if (!alvo) return { ok: false, erro: "Situação inválida." };

  const orcamento = await carregarOrcamento(id);
  if (!orcamento) return { ok: false, erro: "Orçamento não encontrado." };

  const agora = new Date().toISOString();

  const { error } = await supabaseAdmin()
    .from("orc_orcamentos")
    .update({
      situacao: alvo,
      updated_at: agora,
      // Mesma regra da tela: o aceite congela o valor, e trocar de situação
      // depois limpa o desfecho anterior para não sobrar data de aprovação num
      // orçamento recusado.
      ...(alvo === "aprovado"
        ? {
            aprovado_em: agora,
            valor_aprovado: orcamento.total,
            recusado_em: null,
            motivo_recusa: null,
          }
        : {}),
      ...(alvo === "recusado"
        ? { recusado_em: agora, aprovado_em: null, valor_aprovado: null }
        : {}),
      ...(alvo !== "aprovado" && alvo !== "recusado"
        ? {
            aprovado_em: null,
            valor_aprovado: null,
            recusado_em: null,
            motivo_recusa: null,
          }
        : {}),
    })
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/admin/orcamentos");
  revalidatePath(`/admin/orcamentos/${id}`);
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Republica sem abrir a tela: tira nova fotografia da versão atual.
 *
 * O token não muda, então o link que já foi para o WhatsApp continua valendo —
 * é o mesmo comportamento do botão da tela, e é o que torna isto seguro de
 * fazer com um clique.
 */
export async function republicar(id: string): Promise<Saida> {
  const { orgId, id: usuarioId } = await exigirAdmin();

  const orcamento = await carregarOrcamento(id);
  if (!orcamento) return { ok: false, erro: "Orçamento não encontrado." };
  if (orcamento.versaoPublicada === null) {
    return { ok: false, erro: "Este orçamento nunca foi publicado." };
  }
  if (!orcamento.senha) return { ok: false, erro: "Sem senha definida." };

  const versao = orcamento.versaoPublicada + 1;
  const dados = montarDocumento(orcamento, versao);
  const sb = supabaseAdmin();

  const { error } = await sb
    .from("orc_publicacoes")
    .insert({ orcamento_id: id, versao, dados, publicado_por: usuarioId });
  if (error) return { ok: false, erro: error.message };

  await sb
    .from("orc_orcamentos")
    .update({ status: "publicado", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId);

  await sb.from("orc_eventos").insert({
    orcamento_id: id,
    tipo: "republicado",
    usuario_id: usuarioId,
    detalhe: { versao, total: dados.total },
  });

  revalidatePath("/admin/orcamentos");
  revalidatePath(`/admin/orcamentos/${id}`);
  return { ok: true };
}

/**
 * Apagar de verdade, com cascata.
 *
 * Recusa depois de publicado: o cliente pode estar com o link aberto, e um
 * 404 no lugar do orçamento que ele recebeu é pior que qualquer bagunça na
 * lista. Para esse caso o caminho é despublicar primeiro.
 */
export async function excluir(id: string): Promise<Saida> {
  const { orgId } = await exigirAdmin();
  const sb = supabaseAdmin();

  const { data: orcamento } = await sb
    .from("orc_orcamentos")
    .select("id, obra_id")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!orcamento) return { ok: false, erro: "Orçamento não encontrado." };

  const { count } = await sb
    .from("orc_publicacoes")
    .select("id", { count: "exact", head: true })
    .eq("orcamento_id", id);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      erro: "Já foi publicado. Despublique primeiro — o cliente pode estar com o link.",
    };
  }
  if (orcamento.obra_id) {
    return {
      ok: false,
      erro: "Virou obra. Apague a obra antes, ou o histórico dela fica sem origem.",
    };
  }

  // Os áudios saem antes: o cascade do Postgres não alcança o Storage.
  const { data: blocos } = await sb
    .from("orc_blocos")
    .select("storage_path")
    .eq("orcamento_id", id);

  const caminhos = (blocos ?? [])
    .map((b) => b.storage_path)
    .filter((c): c is string => Boolean(c));
  if (caminhos.length) await sb.storage.from("orcamentos").remove(caminhos);

  const { error } = await sb.from("orc_orcamentos").delete().eq("id", id);
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/admin/orcamentos");
  revalidatePath("/admin");
  return { ok: true };
}

/** Virar obra pela lista. A regra vive em `gerarObraDoOrcamento`. */
export async function virarObra(id: string): Promise<Saida> {
  const { gerarObraDoOrcamento } = await import("./acoes");
  const form = new FormData();
  form.set("id", id);
  const saida = await gerarObraDoOrcamento(null, form);
  return saida.ok ? { ok: true } : { ok: false, erro: saida.erro };
}

/** Apagar obra pela lista. A regra vive em `apagarObra`. */
export async function excluirObra(obraId: string): Promise<Saida> {
  const { apagarObra } = await import("@/lib/admin/acoes-obra");
  const form = new FormData();
  form.set("obraId", obraId);
  // A confirmação por digitação acontece na tela; aqui ela já veio.
  form.set("confirmacao", "APAGAR");
  const saida = await apagarObra(null, form);
  return saida.ok ? { ok: true } : { ok: false, erro: saida.erro };
}
