"use server";

import { revalidatePath } from "next/cache";
import { BUCKET, supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/admin/sessao";
import { transcreverBlocoDeOrcamento } from "@/lib/transcricao/pipeline";
import type { Resultado } from "@/lib/admin/tipos";

/**
 * A conversa: o briefing falado e as respostas às perguntas da IA.
 *
 * Os bytes do áudio nunca passam por aqui. O navegador pede uma URL assinada,
 * envia direto ao Storage e só então registra o bloco — o body de uma função
 * da Vercel tem teto de 4,5 MB e áudio de dois minutos passa disso.
 *
 * A transcrição roda no mesmo passo do registro, e de propósito: quem acabou de
 * falar está olhando a tela, e é o único momento em que a espera de alguns
 * segundos é aceitável. Se falhar, o áudio continua guardado e a tela mostra o
 * motivo — nunca se perde o que foi dito.
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

export type UrlDeUpload =
  | { ok: true; caminho: string; token: string; bucket: string }
  | { ok: false; erro: string };

const MIMES_AUDIO = new Set([
  "audio/mp4",
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
]);
const MIMES_IMAGEM = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);
const TAMANHO_MAXIMO = 25 * 1024 * 1024;
const EXTENSAO_VALIDA = /^[a-z0-9]{2,5}$/;

export async function urlDeUpload(dados: {
  orcamentoId: string;
  tipo: "audio" | "image";
  mimeType: string;
  extensao: string;
  tamanhoBytes: number;
}): Promise<UrlDeUpload> {
  if (!(await orcamentoDaOrg(dados.orcamentoId))) {
    return { ok: false, erro: "Orçamento inválido." };
  }

  const mime = dados.mimeType.split(";")[0].trim().toLowerCase();
  const aceitos = dados.tipo === "audio" ? MIMES_AUDIO : MIMES_IMAGEM;
  if (!aceitos.has(mime)) {
    return { ok: false, erro: `Formato não aceito: ${mime || "(vazio)"}` };
  }
  if (!EXTENSAO_VALIDA.test(dados.extensao.toLowerCase())) {
    return { ok: false, erro: "Extensão inválida." };
  }
  if (
    !Number.isFinite(dados.tamanhoBytes) ||
    dados.tamanhoBytes <= 0 ||
    dados.tamanhoBytes > TAMANHO_MAXIMO
  ) {
    return { ok: false, erro: "Arquivo acima do limite de 25 MB." };
  }

  // O caminho carrega o orçamento: é o que permite limpar o Storage quando ele
  // for apagado.
  const caminho = `orc/${dados.orcamentoId}/${crypto.randomUUID()}.${dados.extensao.toLowerCase()}`;

  const { data, error } = await supabaseAdmin()
    .storage.from(BUCKET)
    .createSignedUploadUrl(caminho);

  if (error || !data) {
    return { ok: false, erro: error?.message ?? "Falha ao criar a URL." };
  }

  return { ok: true, caminho: data.path, token: data.token, bucket: BUCKET };
}

/** Registra o bloco já enviado ao Storage e dispara a transcrição. */
export async function registrarBloco(dados: {
  orcamentoId: string;
  perguntaId: string | null;
  tipo: "audio" | "image" | "text";
  texto?: string;
  caminho?: string;
  mimeType?: string;
  duracaoMs?: number;
}): Promise<Resultado> {
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
      pergunta_id: dados.perguntaId,
      position: (ultimo?.[0]?.position ?? 0) + 1,
      type: dados.tipo,
      text_content: dados.texto ?? null,
      storage_path: dados.caminho ?? null,
      mime_type: dados.mimeType ?? null,
      duration_ms: dados.duracaoMs ?? null,
    })
    .select("id")
    .single();

  if (error || !bloco) {
    return { ok: false, erro: error?.message ?? "Falha ao registrar." };
  }

  if (dados.tipo === "audio") {
    // Em série e aguardando: quem acabou de falar está olhando a tela, e ver a
    // transcrição aparecer é o que dá confiança de que foi entendido.
    await transcreverBlocoDeOrcamento(bloco.id);
  }

  revalidatePath(`/admin/orcamentos/${dados.orcamentoId}/falar`);
  revalidatePath(`/admin/orcamentos/${dados.orcamentoId}`);
  return { ok: true };
}

export async function removerBloco(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const orcamentoId = String(form.get("orcamentoId") ?? "");
  const id = String(form.get("id") ?? "");
  if (!id || !(await orcamentoDaOrg(orcamentoId))) {
    return { ok: false, erro: "Bloco inválido." };
  }

  const sb = supabaseAdmin();

  const { data: bloco } = await sb
    .from("orc_blocos")
    .select("storage_path")
    .eq("id", id)
    .eq("orcamento_id", orcamentoId)
    .maybeSingle();

  // O arquivo sai junto: a cascata do banco não alcança o Storage.
  if (bloco?.storage_path) {
    await sb.storage.from(BUCKET).remove([bloco.storage_path]);
  }

  const { error } = await sb
    .from("orc_blocos")
    .delete()
    .eq("id", id)
    .eq("orcamento_id", orcamentoId);

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/admin/orcamentos/${orcamentoId}/falar`);
  return { ok: true };
}

/** Reprocessa uma transcrição que falhou, sem precisar regravar. */
export async function retranscrever(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const orcamentoId = String(form.get("orcamentoId") ?? "");
  const id = String(form.get("id") ?? "");
  if (!id || !(await orcamentoDaOrg(orcamentoId))) {
    return { ok: false, erro: "Bloco inválido." };
  }

  await transcreverBlocoDeOrcamento(id);
  revalidatePath(`/admin/orcamentos/${orcamentoId}/falar`);
  return { ok: true };
}
