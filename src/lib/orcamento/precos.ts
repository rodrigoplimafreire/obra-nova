import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { orgAtual } from "@/lib/admin/sessao";
import type { Enums } from "@/lib/database.types";

/**
 * Leitura das bases de preço para o painel.
 *
 * Uma base é uma fotografia — "SEINFRA-CE, 07/2026" nunca muda depois de
 * importada, pelo mesmo motivo de `orc_publicacoes`: um item que aponta para
 * uma composição não pode ver o preço mudar debaixo dele sem aviso. Reimportar
 * cria uma base nova; a antiga fica com `ativa = false`.
 */

export type FonteDePreco = Enums<"orc_fonte_de_preco">;

export type BaseDePreco = {
  id: string;
  nome: string;
  fonte: FonteDePreco;
  referencia: string | null;
  desonerada: boolean;
  ativa: boolean;
  linhas: number;
  criadoEm: string;
};

export async function listarBasesDePreco(): Promise<BaseDePreco[]> {
  const sb = supabaseAdmin();
  const org = await orgAtual();

  const { data } = await sb
    .from("orc_bases_de_preco")
    .select("id, nome, fonte, referencia, desonerada, ativa, linhas, created_at")
    .eq("org_id", org)
    .order("created_at", { ascending: false });

  return (data ?? []).map((b) => ({
    id: b.id,
    nome: b.nome,
    fonte: b.fonte,
    referencia: b.referencia,
    desonerada: b.desonerada,
    ativa: b.ativa,
    linhas: b.linhas,
    criadoEm: b.created_at,
  }));
}
