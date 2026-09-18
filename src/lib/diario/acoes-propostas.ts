"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/admin/sessao";
import { ehSecao, type Secao } from "./tipos";
import type { Resultado } from "@/lib/admin/tipos";

/**
 * As propostas da IA: aceitar, trocar de seção, descartar.
 *
 * O que a IA escreveu vive aqui até alguém tocar. Aceitar copia para
 * `dia_itens` com `origem: "ia"` — a linha passa a ser do relatório, e a
 * proposta some.
 */

/** A proposta é minha? Confere subindo a corrente até o diário. */
async function minhaProposta(
  id: string,
): Promise<{ relatorioId: string } | null> {
  const { orgId, id: usuarioId } = await exigirAdmin();
  const sb = supabaseAdmin();

  const { data: proposta } = await sb
    .from("dia_propostas")
    .select("relatorio_id")
    .eq("id", id)
    .maybeSingle();
  if (!proposta) return null;

  const { data: relatorio } = await sb
    .from("dia_relatorios")
    .select("id, diario_id")
    .eq("id", proposta.relatorio_id)
    .maybeSingle();
  if (!relatorio) return null;

  const { data: diario } = await sb
    .from("dia_diarios")
    .select("id")
    .eq("id", relatorio.diario_id)
    .eq("org_id", orgId)
    .eq("autor_id", usuarioId)
    .maybeSingle();

  return diario ? { relatorioId: relatorio.id } : null;
}

function revalidar() {
  revalidatePath("/admin/diario");
}

/** Copia a proposta para o relatório, no fim da seção. */
async function virarItem(
  relatorioId: string,
  proposta: {
    id: string;
    secao: Secao;
    texto: string;
    responsavel: string | null;
    /** A pendência de ontem que esta linha resolve, quando vier de uma. */
    sugestao_id: string | null;
  },
): Promise<string | null> {
  const sb = supabaseAdmin();

  const { data: ultimo } = await sb
    .from("dia_itens")
    .select("posicao")
    .eq("relatorio_id", relatorioId)
    .eq("secao", proposta.secao)
    .order("posicao", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await sb.from("dia_itens").insert({
    relatorio_id: relatorioId,
    secao: proposta.secao,
    texto: proposta.texto,
    responsavel: proposta.responsavel,
    posicao: (ultimo?.posicao ?? 0) + 1,
    // Guarda de onde veio. Editar depois o torna humano — ver `editarItem`.
    origem: "ia",
  });

  if (error) return error.message;

  /**
   * A pendência de ontem sai da lista junto.
   *
   * Sem isto, aceitar "ajuste do contraste" resolvia o relatório e deixava a
   * mesma linha de pé em "Ficou em aberto", para ser marcada de novo à mão.
   * Era a queixa: mais fácil escrever do que sair marcando um por um.
   */
  if (proposta.sugestao_id) {
    await sb
      .from("dia_descartes")
      .insert({ relatorio_id: relatorioId, item_origem_id: proposta.sugestao_id });
  }

  await sb.from("dia_propostas").delete().eq("id", proposta.id);
  return null;
}

export async function aceitarProposta(id: string): Promise<Resultado> {
  const dono = await minhaProposta(id);
  if (!dono) return { ok: false, erro: "Proposta inválida." };

  const { data: proposta } = await supabaseAdmin()
    .from("dia_propostas")
    .select("id, secao, texto, responsavel, sugestao_id")
    .eq("id", id)
    .maybeSingle();
  if (!proposta) return { ok: false, erro: "Proposta não encontrada." };

  const erro = await virarItem(dono.relatorioId, proposta);
  if (erro) return { ok: false, erro };

  revalidar();
  return { ok: true };
}

/** Trocar a seção antes de aceitar: a IA errou o lugar, não o conteúdo. */
export async function moverProposta(
  id: string,
  secao: string,
): Promise<Resultado> {
  const dono = await minhaProposta(id);
  if (!dono) return { ok: false, erro: "Proposta inválida." };
  if (!ehSecao(secao)) return { ok: false, erro: "Seção inválida." };

  const { error } = await supabaseAdmin()
    .from("dia_propostas")
    .update({ secao })
    .eq("id", id);

  if (error) return { ok: false, erro: error.message };

  revalidar();
  return { ok: true };
}

export async function descartarProposta(id: string): Promise<Resultado> {
  const dono = await minhaProposta(id);
  if (!dono) return { ok: false, erro: "Proposta inválida." };

  const { error } = await supabaseAdmin()
    .from("dia_propostas")
    .delete()
    .eq("id", id);

  if (error) return { ok: false, erro: error.message };

  revalidar();
  return { ok: true };
}

/**
 * "Aceitar tudo".
 *
 * Existe porque o caso comum é a IA acertar: quem gerou o resumo já leu os
 * registros, e revisar cinco linhas uma a uma para concordar com as cinco é
 * trabalho sem resultado. Quem discorda de uma descarta aquela e aceita o
 * resto.
 */
export async function aceitarTodasAsPropostas(
  dia: string,
): Promise<Resultado & { aceitas?: number }> {
  const { orgId, id: usuarioId } = await exigirAdmin();
  const sb = supabaseAdmin();

  const { data: diario } = await sb
    .from("dia_diarios")
    .select("id")
    .eq("org_id", orgId)
    .eq("autor_id", usuarioId)
    .maybeSingle();
  if (!diario) return { ok: false, erro: "Diário não encontrado." };

  const { data: relatorio } = await sb
    .from("dia_relatorios")
    .select("id")
    .eq("diario_id", diario.id)
    .eq("dia", dia)
    .maybeSingle();
  if (!relatorio) return { ok: false, erro: "Dia não encontrado." };

  const { data: propostas } = await sb
    .from("dia_propostas")
    .select("id, secao, texto, responsavel, sugestao_id")
    .eq("relatorio_id", relatorio.id)
    .order("posicao");

  if (!propostas?.length) return { ok: false, erro: "Não há proposta aberta." };

  // Uma a uma, e não em lote, para a posição dentro de cada seção sair na
  // ordem em que a IA propôs.
  for (const proposta of propostas) {
    const erro = await virarItem(relatorio.id, proposta);
    if (erro) return { ok: false, erro };
  }

  revalidar();
  return { ok: true, aceitas: propostas.length };
}
