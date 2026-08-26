"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/admin/sessao";
import type { LinhaDeBusca } from "@/lib/database.types";
import type { Resultado } from "@/lib/admin/tipos";
import type { FonteDePreco } from "./precos";

/**
 * Import da base de preços e busca de composições.
 *
 * O import é feito em lotes chamados pelo cliente em sequência — não existe um
 * upload de arquivo inteiro num só POST. Duas razões: a Server Action tem
 * teto de payload, e um SINAPI completo passa de 10 mil linhas; e é o lote que
 * dá o número para a barra de progresso, que numa planilha desse tamanho não é
 * luxo.
 */

export type LinhaImportada = {
  codigo: string | null;
  grupo: string | null;
  descricao: string;
  unidade: string | null;
  custoUnitario: number;
};

export type ResultadoDeBase =
  | { ok: true; baseId: string }
  | { ok: false; erro: string };

/** Primeiro passo: cria a base vazia. As linhas entram depois, em lotes. */
export async function criarBaseDePreco(dados: {
  nome: string;
  fonte: FonteDePreco;
  referencia: string;
  desonerada: boolean;
  /** Quando informado, esta base entra desativada assim que a nova existir —
   *  o caminho de "reimportar" sem duplicar a busca com as duas ativas. */
  substituirBaseId?: string;
}): Promise<ResultadoDeBase> {
  const { orgId } = await exigirAdmin();

  if (dados.nome.trim().length < 2) {
    return { ok: false, erro: "Dê um nome para esta base de preços." };
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("orc_bases_de_preco")
    .insert({
      org_id: orgId,
      nome: dados.nome.trim(),
      fonte: dados.fonte,
      referencia: dados.referencia.trim() || null,
      desonerada: dados.desonerada,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, erro: error?.message ?? "Falha ao criar a base." };
  }

  if (dados.substituirBaseId) {
    await sb
      .from("orc_bases_de_preco")
      .update({ ativa: false })
      .eq("id", dados.substituirBaseId)
      .eq("org_id", orgId);
  }

  return { ok: true, baseId: data.id };
}

export type ResultadoDeLote =
  | { ok: true; inseridas: number }
  | { ok: false; erro: string };

/** Um lote de linhas já mapeadas pelo cliente, inserido de uma vez. */
export async function inserirLoteDeComposicoes(
  baseId: string,
  linhas: LinhaImportada[],
): Promise<ResultadoDeLote> {
  const { orgId } = await exigirAdmin();
  const sb = supabaseAdmin();

  const { data: base } = await sb
    .from("orc_bases_de_preco")
    .select("id, linhas")
    .eq("id", baseId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!base) return { ok: false, erro: "Base não encontrada." };

  const validas = linhas.filter(
    (l) =>
      l.descricao.trim().length > 0 &&
      Number.isFinite(l.custoUnitario) &&
      l.custoUnitario >= 0,
  );
  if (!validas.length) return { ok: true, inseridas: 0 };

  const { error } = await sb.from("orc_composicoes").insert(
    validas.map((l) => ({
      base_id: baseId,
      codigo: l.codigo?.trim() || null,
      grupo: l.grupo?.trim() || null,
      descricao: l.descricao.trim(),
      unidade: l.unidade?.trim() || null,
      custo_unitario: l.custoUnitario,
    })),
  );

  if (error) return { ok: false, erro: error.message };

  await sb
    .from("orc_bases_de_preco")
    .update({ linhas: base.linhas + validas.length })
    .eq("id", baseId);

  return { ok: true, inseridas: validas.length };
}

/** Fecha o import: recarrega a lista de bases para quem estiver na tela. */
export async function finalizarImportacao(): Promise<void> {
  revalidatePath("/admin/precos");
}

export async function alternarBaseAtiva(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const { orgId } = await exigirAdmin();
  const id = String(form.get("id") ?? "");
  const ativa = form.get("ativa") === "1";
  if (!id) return { ok: false, erro: "Base inválida." };

  const { error } = await supabaseAdmin()
    .from("orc_bases_de_preco")
    .update({ ativa })
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) return { ok: false, erro: error.message };
  revalidatePath("/admin/precos");
  return { ok: true };
}

/**
 * Apaga a base e as composições dela (cascade). Os itens de orçamento que já
 * tinham puxado um custo de lá não perdem nada — `custo_unitario` é uma cópia,
 * só `composicao_id` some (`on delete set null`).
 */
export async function excluirBaseDePreco(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const { orgId } = await exigirAdmin();
  const id = String(form.get("id") ?? "");
  if (!id) return { ok: false, erro: "Base inválida." };

  const { error } = await supabaseAdmin()
    .from("orc_bases_de_preco")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) return { ok: false, erro: error.message };
  revalidatePath("/admin/precos");
  return { ok: true };
}

/**
 * Busca para o autocompletar do editor de itens.
 *
 * Usa `word_similarity` do pg_trgm (RPC `orc_buscar_composicoes`), não
 * `ILIKE`: a pessoa digita "forro pvc" e o banco acha "Forro de PVC branco,
 * com acabamento em réguas" — comparar a string inteira reprovaria esse par
 * pela diferença de tamanho. Menos de 3 letras não busca, para não martelar o
 * banco a cada tecla no início da palavra.
 */
export async function buscarComposicoes(
  consulta: string,
): Promise<LinhaDeBusca[]> {
  const texto = consulta.trim();
  if (texto.length < 3) return [];

  const { orgId } = await exigirAdmin();
  const { data, error } = await supabaseAdmin().rpc("orc_buscar_composicoes", {
    p_org_id: orgId,
    p_consulta: texto,
    p_limite: 8,
  });

  if (error) return [];
  return data ?? [];
}
