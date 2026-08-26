"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/admin/sessao";
import type { Resultado } from "@/lib/admin/tipos";

/**
 * Importar uma planilha de orçamento já pronta.
 *
 * Muita gente já tem a tabela feita no Excel — inclusive exportada do Obra
 * Prima, que o Reginato usa. Obrigar a redigitar item por item para começar a
 * usar o produto seria motivo suficiente para não usar.
 *
 * O mapeamento de coluna é genérico, pelo mesmo motivo da base de preços:
 * cada planilha tem um layout, e um leitor dedicado quebra no primeiro arquivo
 * diferente.
 */

export type ItemImportado = {
  grupo: string | null;
  descricao: string;
  quantidade: number | null;
  unidade: string | null;
  custoUnitario: number | null;
  valorUnitario: number | null;
};

export async function importarItens(
  orcamentoId: string,
  linhas: ItemImportado[],
): Promise<Resultado & { importados?: number }> {
  const { orgId } = await exigirAdmin();

  const sb = supabaseAdmin();
  const { data: orcamento } = await sb
    .from("orc_orcamentos")
    .select("id")
    .eq("id", orcamentoId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!orcamento) return { ok: false, erro: "Orçamento não encontrado." };

  const validas = linhas.filter((l) => l.descricao.trim().length >= 2);
  if (!validas.length) {
    return { ok: false, erro: "Nenhuma linha com descrição válida." };
  }

  const { data: ultima } = await sb
    .from("orc_itens")
    .select("position")
    .eq("orcamento_id", orcamentoId)
    .order("position", { ascending: false })
    .limit(1);

  let posicao = (ultima?.[0]?.position ?? 0) + 1;

  const { error } = await sb.from("orc_itens").insert(
    validas.map((l) => ({
      orcamento_id: orcamentoId,
      position: posicao++,
      grupo: l.grupo?.trim() || null,
      descricao: l.descricao.trim(),
      quantidade: l.quantidade,
      unidade: l.unidade?.trim() || null,
      custo_unitario: l.custoUnitario,
      valor_unitario: l.valorUnitario,
      // Veio de fora, mas por mão humana: não é a IA que escreveu, e não deve
      // ser tratado como sugestão a conferir.
      origem: "humano" as const,
      editado_em: new Date().toISOString(),
    })),
  );

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/admin/orcamentos/${orcamentoId}`);
  return { ok: true, importados: validas.length };
}
