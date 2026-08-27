"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/admin/sessao";
import { transcreverBlocoDeOrcamento } from "@/lib/transcricao/pipeline";
import { montarItensDaFala, type SaidaDaMontagem } from "./itens-da-fala";
import type { Resultado } from "@/lib/admin/tipos";

/**
 * Os três passos de "falar o orçamento", separados de propósito.
 *
 * Poderiam ser uma chamada só. São três porque a tela precisa **mostrar** onde
 * o processo está: enviar o áudio, transcrever e montar a tabela levam tempos
 * bem diferentes, e a queixa que originou isto foi exatamente a tela parada
 * sem dizer nada depois que a gravação termina.
 *
 * Cada passo devolve o que a tela precisa para escrever a linha seguinte do
 * progresso — e, quando falha, o áudio já gravado continua no lugar.
 */

async function orcamentoDaOrg(orcamentoId: string): Promise<string | null> {
  const { orgId } = await exigirAdmin();
  const { data } = await supabaseAdmin()
    .from("orc_orcamentos")
    .select("id")
    .eq("id", orcamentoId)
    .eq("org_id", orgId)
    .maybeSingle();
  return data ? orgId : null;
}

export type SaidaDoRegistro =
  | { ok: true; blocoId: string }
  | { ok: false; erro: string };

/** Passo 1: o áudio já está no Storage; aqui ele vira linha no banco. */
export async function registrarAudioDaFala(dados: {
  orcamentoId: string;
  caminho: string;
  mimeType: string;
  duracaoMs: number;
}): Promise<SaidaDoRegistro> {
  if (!(await orcamentoDaOrg(dados.orcamentoId))) {
    return { ok: false, erro: "Orçamento inválido." };
  }

  const sb = supabaseAdmin();

  const { data: ultimo } = await sb
    .from("orc_blocos")
    .select("position")
    .eq("orcamento_id", dados.orcamentoId)
    .order("position", { ascending: false })
    .limit(1);

  const { data: bloco, error } = await sb
    .from("orc_blocos")
    .insert({
      orcamento_id: dados.orcamentoId,
      pergunta_id: null,
      position: (ultimo?.[0]?.position ?? 0) + 1,
      type: "audio",
      storage_path: dados.caminho,
      mime_type: dados.mimeType,
      // Cronômetro, nunca metadata: o container sai sem cabeçalho e
      // `audio.duration` vira Infinity.
      duration_ms: dados.duracaoMs,
    })
    .select("id")
    .single();

  if (error || !bloco) {
    return { ok: false, erro: error?.message ?? "Falha ao registrar o áudio." };
  }

  return { ok: true, blocoId: bloco.id };
}

/**
 * Passo 1b: o mesmo, para quem preferiu digitar em vez de falar.
 *
 * Devolve o `blocoId` pelo mesmo motivo do passo 1: é ele que diz ao passo 3
 * **qual** fala virar item. Antes devolvia só `ok`, e o caminho de texto caía
 * no mesmo bug de reprocessar o orçamento inteiro.
 */
export async function registrarTextoDaFala(dados: {
  orcamentoId: string;
  texto: string;
}): Promise<SaidaDoRegistro> {
  if (!(await orcamentoDaOrg(dados.orcamentoId))) {
    return { ok: false, erro: "Orçamento inválido." };
  }
  if (dados.texto.trim().length < 3) {
    return { ok: false, erro: "Escreva o que precisa ser feito." };
  }

  const sb = supabaseAdmin();
  const { data: ultimo } = await sb
    .from("orc_blocos")
    .select("position")
    .eq("orcamento_id", dados.orcamentoId)
    .order("position", { ascending: false })
    .limit(1);

  const { data: bloco, error } = await sb
    .from("orc_blocos")
    .insert({
      orcamento_id: dados.orcamentoId,
      pergunta_id: null,
      position: (ultimo?.[0]?.position ?? 0) + 1,
      type: "text",
      text_content: dados.texto.trim(),
    })
    .select("id")
    .single();

  if (error || !bloco) {
    return { ok: false, erro: error?.message ?? "Falha ao registrar o texto." };
  }
  return { ok: true, blocoId: bloco.id };
}

export type SaidaDaTranscricao =
  | { ok: true; texto: string }
  | { ok: false; erro: string };

/** Passo 2: o Whisper. O áudio fica guardado mesmo quando isto falha. */
export async function transcreverDaFala(dados: {
  orcamentoId: string;
  blocoId: string;
}): Promise<SaidaDaTranscricao> {
  if (!(await orcamentoDaOrg(dados.orcamentoId))) {
    return { ok: false, erro: "Orçamento inválido." };
  }

  await transcreverBlocoDeOrcamento(dados.blocoId);

  const { data } = await supabaseAdmin()
    .from("orc_transcricoes")
    .select("status, text, error")
    .eq("bloco_id", dados.blocoId)
    .maybeSingle();

  if (!data || data.status !== "done" || !data.text) {
    return {
      ok: false,
      erro:
        data?.error ??
        "Não consegui transcrever o áudio. Ele está guardado — dá para tentar de novo.",
    };
  }

  return { ok: true, texto: data.text };
}

export type SaidaDaTabela = SaidaDaMontagem;

/**
 * Passo 3: a IA quebra o que foi dito em linhas da tabela.
 *
 * O `blocoId` é obrigatório e diz **qual** fala processar. Sem ele, a versão
 * anterior relia todas as transcrições do orçamento a cada nova fala e
 * reinseria tudo: 8 falas viraram 52 itens onde deviam ser 13.
 */
export async function montarTabelaDaFala(
  orcamentoId: string,
  blocoId: string,
): Promise<SaidaDaTabela> {
  const orgId = await orcamentoDaOrg(orcamentoId);
  if (!orgId) return { ok: false, erro: "Orçamento inválido." };

  const saida = await montarItensDaFala(orcamentoId, orgId, blocoId);

  revalidatePath(`/admin/orcamentos/${orcamentoId}`);
  revalidatePath("/admin/orcamentos");

  return saida;
}
