"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/admin/sessao";
// A constante mora em `tipos.ts`, e não aqui: arquivo com `"use server"` só
// pode exportar função assíncrona. Mesma razão do `Resultado`.
import { A_DEFINIR } from "./tipos";
import type { Resultado } from "@/lib/admin/tipos";

/**
 * O elenco do diário.
 *
 * Pequeno de propósito: são as pessoas que aparecem nos itens de quem escreve
 * — ele mesmo, o cliente, um parceiro ou outro. Não é cadastro de usuários, e
 * ninguém aqui tem conta: é uma lista de nomes para a pastilha sair sempre
 * igual, e para a IA receber a grafia certa em vez de inventar a sua.
 */

async function meuDiario(): Promise<string | null> {
  const { orgId, id: usuarioId } = await exigirAdmin();

  const { data } = await supabaseAdmin()
    .from("dia_diarios")
    .select("id")
    .eq("org_id", orgId)
    .eq("autor_id", usuarioId)
    .maybeSingle();

  return data?.id ?? null;
}

export async function adicionarPessoa(nomeBruto: string): Promise<Resultado> {
  const diarioId = await meuDiario();
  if (!diarioId) return { ok: false, erro: "Diário não encontrado." };

  const nome = nomeBruto.trim().replace(/\s+/g, " ");
  if (nome.length < 2) {
    return { ok: false, erro: "Escreva o nome de quem responde." };
  }
  if (nome.length > 40) {
    return { ok: false, erro: "O nome passa de 40 caracteres." };
  }
  if (nome.toLowerCase() === A_DEFINIR.toLowerCase()) {
    return { ok: false, erro: "“A definir” já existe, e não é uma pessoa." };
  }

  const { error } = await supabaseAdmin()
    .from("dia_pessoas")
    .insert({ diario_id: diarioId, nome });

  // Nome repetido não é erro para quem toca: a pessoa já está no elenco, e é
  // isso que ela queria.
  if (error && error.code !== "23505") {
    return { ok: false, erro: error.message };
  }

  revalidatePath("/admin/diario");
  return { ok: true };
}

/**
 * Tira do elenco.
 *
 * **Os itens que já apontam para esse nome não mudam.** O responsável fica
 * gravado no item como texto, e reescrever dias passados para acertar uma
 * lista seria alterar relatório publicado — que é a coisa que este produto
 * inteiro se recusa a fazer.
 */
export async function removerPessoa(id: string): Promise<Resultado> {
  const diarioId = await meuDiario();
  if (!diarioId) return { ok: false, erro: "Diário não encontrado." };

  const { error } = await supabaseAdmin()
    .from("dia_pessoas")
    .delete()
    .eq("id", id)
    .eq("diario_id", diarioId);

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/admin/diario");
  return { ok: true };
}
