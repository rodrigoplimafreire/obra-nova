"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/admin/sessao";
import { diaValido } from "@/lib/tempo";
import { garantirRelatorioDoDia } from "./relatorio";
import { ehSecao, type Secao } from "./tipos";
import type { Resultado } from "@/lib/admin/tipos";

/**
 * As linhas do relatório do dia.
 *
 * Existe para a tela ser **seletiva em vez de digitável**: mover um item de
 * "Em andamento" para "Realizado" é o gesto mais frequente do diário, e com
 * quatro blocos de texto ele custava recortar de um campo e colar em outro.
 * Aqui é um toque, e o servidor só troca uma coluna.
 *
 * Toda ação carimba `editado_em` no dia. É isso que faz "Gerar resumo"
 * perguntar antes de substituir: mexer num item é reivindicar o texto.
 */

async function meuDiario(): Promise<{ id: string; token: string } | null> {
  const { orgId, id: usuarioId } = await exigirAdmin();

  const { data } = await supabaseAdmin()
    .from("dia_diarios")
    .select("id, token")
    .eq("org_id", orgId)
    .eq("autor_id", usuarioId)
    .maybeSingle();

  return data ?? null;
}

/** O item é meu? Confere subindo a corrente até o diário. */
async function meuItem(itemId: string): Promise<string | null> {
  const diario = await meuDiario();
  if (!diario) return null;

  const sb = supabaseAdmin();

  const { data: item } = await sb
    .from("dia_itens")
    .select("relatorio_id")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return null;

  const { data: relatorio } = await sb
    .from("dia_relatorios")
    .select("id")
    .eq("id", item.relatorio_id)
    .eq("diario_id", diario.id)
    .maybeSingle();

  return relatorio?.id ?? null;
}

/**
 * Carimba a mão humana no dia.
 *
 * Um item mexido é o dia mexido: sem isto, gerar o resumo de novo passaria
 * por cima de uma correção feita à mão sem perguntar.
 */
async function marcarEdicao(relatorioId: string) {
  const agora = new Date().toISOString();
  await supabaseAdmin()
    .from("dia_relatorios")
    .update({ editado_em: agora, updated_at: agora })
    .eq("id", relatorioId);
}

function revalidar() {
  revalidatePath("/admin/diario");
}

export async function adicionarItem(dados: {
  dia: string;
  secao: string;
  texto: string;
  responsavel?: string | null;
}): Promise<Resultado> {
  const diario = await meuDiario();
  if (!diario) return { ok: false, erro: "Diário não encontrado." };
  if (!diaValido(dados.dia)) return { ok: false, erro: "Data inválida." };
  if (!ehSecao(dados.secao)) return { ok: false, erro: "Seção inválida." };

  const texto = dados.texto.trim();
  if (!texto) return { ok: false, erro: "Escreva alguma coisa." };

  const relatorioId = await garantirRelatorioDoDia(diario.id, dados.dia);
  if (!relatorioId) return { ok: false, erro: "Falha ao abrir o dia." };

  const sb = supabaseAdmin();

  // Entra no fim da seção. Ordenar por `posicao` e não por data de criação é
  // o que vai permitir reordenar depois sem reescrever o histórico.
  const { data: ultimo } = await sb
    .from("dia_itens")
    .select("posicao")
    .eq("relatorio_id", relatorioId)
    .eq("secao", dados.secao)
    .order("posicao", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await sb.from("dia_itens").insert({
    relatorio_id: relatorioId,
    secao: dados.secao,
    texto,
    responsavel: dados.responsavel?.trim() || null,
    posicao: (ultimo?.posicao ?? 0) + 1,
    origem: "humano",
  });

  if (error) return { ok: false, erro: error.message };

  await marcarEdicao(relatorioId);
  revalidar();
  return { ok: true };
}

/**
 * Trocar de seção — o toque que esta entrega existe para dar.
 *
 * Vai para o fim da seção de destino, e não para a posição que ocupava na de
 * origem: quem move um item de "em andamento" para "realizado" está dizendo
 * que ele acabou de fechar, e o fim da lista é onde isso se lê.
 */
export async function moverItem(
  itemId: string,
  secao: string,
): Promise<Resultado> {
  const relatorioId = await meuItem(itemId);
  if (!relatorioId) return { ok: false, erro: "Item inválido." };
  if (!ehSecao(secao)) return { ok: false, erro: "Seção inválida." };

  const sb = supabaseAdmin();

  const { data: ultimo } = await sb
    .from("dia_itens")
    .select("posicao")
    .eq("relatorio_id", relatorioId)
    .eq("secao", secao)
    .order("posicao", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await sb
    .from("dia_itens")
    .update({
      secao: secao as Secao,
      posicao: (ultimo?.posicao ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  if (error) return { ok: false, erro: error.message };

  await marcarEdicao(relatorioId);
  revalidar();
  return { ok: true };
}

/** Corrigir o texto ou o responsável. Editar item da IA o torna humano. */
export async function editarItem(dados: {
  id: string;
  texto: string;
  responsavel?: string | null;
}): Promise<Resultado> {
  const relatorioId = await meuItem(dados.id);
  if (!relatorioId) return { ok: false, erro: "Item inválido." };

  const texto = dados.texto.trim();
  if (!texto) return { ok: false, erro: "O item não pode ficar vazio." };

  const { error } = await supabaseAdmin()
    .from("dia_itens")
    .update({
      texto,
      responsavel: dados.responsavel?.trim() || null,
      // Mão humana marca a linha — mesma regra dos itens do orçamento e do
      // texto das transcrições.
      origem: "humano",
      updated_at: new Date().toISOString(),
    })
    .eq("id", dados.id);

  if (error) return { ok: false, erro: error.message };

  await marcarEdicao(relatorioId);
  revalidar();
  return { ok: true };
}

export async function removerItem(itemId: string): Promise<Resultado> {
  const relatorioId = await meuItem(itemId);
  if (!relatorioId) return { ok: false, erro: "Item inválido." };

  const { error } = await supabaseAdmin()
    .from("dia_itens")
    .delete()
    .eq("id", itemId);

  if (error) return { ok: false, erro: error.message };

  await marcarEdicao(relatorioId);
  revalidar();
  return { ok: true };
}
