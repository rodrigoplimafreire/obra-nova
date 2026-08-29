"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/admin/sessao";
import { lerColagem, sugerirSlug, type Colagem, type ImagemColada } from "./colagem";
import { transcrever } from "@/lib/transcricao/provedor";

/**
 * Colar o material do cliente e sair com um orçamento pronto.
 *
 * Em dois passos, de propósito. `entenderColagem` só lê e devolve; quem grava
 * é `criarDaColagem`, depois que a pessoa viu o que a IA entendeu. Um passo só
 * seria mais rápido de usar e erraria calado: número lido errado numa foto
 * entraria no documento e só apareceria quando o cliente comparasse com o que
 * mandou.
 */

export type SaidaDeLeitura =
  | { ok: true; colagem: Colagem; slug: string }
  | { ok: false; erro: string };

/** Áudio que veio junto: WhatsApp do cliente descrevendo o serviço. */
export type AudioColado = { mimeType: string; base64: string; nome: string };

export async function entenderColagem(
  texto: string,
  imagens: ImagemColada[],
  audios: AudioColado[] = [],
): Promise<SaidaDeLeitura> {
  await exigirAdmin();

  // Teto por requisição: cada arquivo vira base64 (um terço maior) e viaja no
  // corpo da Server Action, que tem limite próprio.
  if (imagens.length > 6) {
    return { ok: false, erro: "No máximo 6 imagens por vez." };
  }
  if (audios.length > 4) {
    return { ok: false, erro: "No máximo 4 áudios por vez." };
  }

  // O áudio vira texto antes de tudo, e entra no mesmo material que o resto.
  // Reusa o Whisper que o módulo de Transcrição já usa — não há segundo
  // caminho de áudio no sistema, e não é aqui que ele vai nascer.
  const transcritos: string[] = [];
  for (const audio of audios) {
    const blob = new Blob([Buffer.from(audio.base64, "base64")], {
      type: audio.mimeType,
    });
    const saida = await transcrever(blob, audio.mimeType, "orcamento", audio.nome);
    if (!saida.ok) {
      return { ok: false, erro: `Áudio "${audio.nome}": ${saida.erro}` };
    }
    transcritos.push(`--- áudio: ${audio.nome} ---\n${saida.texto}`);
  }

  const material = [texto.trim(), ...transcritos].filter(Boolean).join("\n\n");

  const saida = await lerColagem(material, imagens);
  if (!saida.ok) return saida;

  return {
    ok: true,
    colagem: saida.colagem,
    slug: saida.colagem.cliente ? sugerirSlug(saida.colagem.cliente) : "",
  };
}

/**
 * Acrescenta o material colado a um orçamento que já existe.
 *
 * É o caso do cliente que manda ajuste pelo WhatsApp depois de o orçamento
 * estar montado — trocou o metro quadrado, incluiu um serviço, mandou o preço
 * que faltava. Sem isto, o caminho era abrir o orçamento e digitar linha a
 * linha, que é o trabalho que a colagem existe para tirar.
 *
 * Só mexe nos **itens**. Cliente, endereço e objeto ficam como estão: quem já
 * conferiu esses campos uma vez não quer que uma mensagem de ajuste os
 * reescreva por baixo.
 */
export async function acrescentarDaColagem(
  orcamentoId: string,
  colagem: Colagem,
): Promise<{ ok: boolean; erro?: string; criados?: number }> {
  const { orgId } = await exigirAdmin();
  const sb = supabaseAdmin();

  const { data: orcamento } = await sb
    .from("orc_orcamentos")
    .select("id")
    .eq("id", orcamentoId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!orcamento) return { ok: false, erro: "Orçamento não encontrado." };
  if (colagem.itens.length === 0) {
    return { ok: false, erro: "Nenhum item para acrescentar." };
  }

  // Entra depois do que já existe, sem atropelar posição de item conferido.
  const { data: ultima } = await sb
    .from("orc_itens")
    .select("position")
    .eq("orcamento_id", orcamentoId)
    .order("position", { ascending: false })
    .limit(1);

  let posicao = (ultima?.[0]?.position ?? -1) + 1;

  const { error } = await sb.from("orc_itens").insert(
    colagem.itens.map((item) => ({
      orcamento_id: orcamentoId,
      position: posicao++,
      grupo: item.grupo,
      descricao: item.descricao,
      quantidade: item.quantidade,
      unidade: item.unidade,
      valor_unitario: item.valorUnitario,
      origem: "ia" as const,
    })),
  );

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/admin/orcamentos/${orcamentoId}`);
  revalidatePath("/admin/orcamentos");
  return { ok: true, criados: colagem.itens.length };
}

export type SaidaDeCriacao =
  | { ok: true; link: string; senha: string }
  | { ok: false; erro: string };

/**
 * Grava o que a pessoa confirmou.
 *
 * Recebe a colagem **já revisada** de volta da tela, e não o texto cru: se
 * relesse o texto aqui, a IA poderia devolver algo diferente da segunda vez, e
 * o que seria gravado não é o que a pessoa aprovou.
 */
export async function criarDaColagem(
  colagem: Colagem,
  senha: string,
): Promise<SaidaDeCriacao> {
  const { orgId, id: usuarioId } = await exigirAdmin();

  const cliente = colagem.cliente?.trim();
  if (!cliente) return { ok: false, erro: "Falta o nome do cliente." };
  if (!senha.trim()) return { ok: false, erro: "Falta a senha do link." };
  if (colagem.itens.length === 0) {
    return { ok: false, erro: "Nenhum item para gravar." };
  }

  const sb = supabaseAdmin();

  const { data: orcamento, error } = await sb
    .from("orc_orcamentos")
    .insert({
      org_id: orgId,
      cliente_nome: cliente,
      endereco: colagem.endereco,
      objeto: colagem.objeto,
      prazo: colagem.prazo,
      entrada_percentual: colagem.entradaPercentual,
      senha: senha.trim(),
      situacao: "rascunho",
      status: "conferindo",
      criado_por: usuarioId,
    })
    .select("id")
    .single();

  if (error || !orcamento) {
    return { ok: false, erro: error?.message ?? "Não consegui criar." };
  }

  const { error: erroItens } = await sb.from("orc_itens").insert(
    colagem.itens.map((item, n) => ({
      orcamento_id: orcamento.id,
      position: n,
      grupo: item.grupo,
      descricao: item.descricao,
      quantidade: item.quantidade,
      unidade: item.unidade,
      valor_unitario: item.valorUnitario,
      // `ia` e não `humano`: a tabela veio de leitura automática, mesmo tendo
      // passado pelos olhos dele. É o que permite ao painel distinguir depois
      // o que nasceu de extração do que foi digitado.
      origem: "ia" as const,
    })),
  );

  if (erroItens) {
    // Orçamento sem item nenhum é pior que orçamento nenhum: aparece na lista
    // parecendo pronto.
    await sb.from("orc_orcamentos").delete().eq("id", orcamento.id);
    return { ok: false, erro: erroItens.message };
  }

  // Preço fechado por grupo é o formato mais comum aqui: os serviços entram
  // sem valor e o total vem numa linha "Vb". Sem `valor_fechado`, a publicação
  // trava reclamando de item sem preço — que é justamente o normal.
  const soma = colagem.itens.reduce(
    (s, i) => s + (i.valorUnitario ?? 0) * (i.quantidade ?? 1),
    0,
  );
  const temItemSemPreco = colagem.itens.some((i) => i.valorUnitario === null);

  if (soma > 0 && temItemSemPreco) {
    await sb
      .from("orc_orcamentos")
      .update({ valor_fechado: soma })
      .eq("id", orcamento.id);
  }

  revalidatePath("/admin/orcamentos");
  return {
    ok: true,
    link: `/admin/orcamentos/${orcamento.id}`,
    senha: senha.trim(),
  };
}
