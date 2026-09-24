"use server";

import { revalidatePath } from "next/cache";
import {
  BUCKET_PROPOSTAS,
  supabaseAdmin,
} from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/admin/sessao";
import type { Resultado } from "@/lib/admin/tipos";

/**
 * As fotos e o vídeo da situação atual da obra.
 *
 * As propostas escritas à mão da RD sempre abriram com isto — o Terras
 * Brasilis mostra três fotos e um vídeo da cobertura, e o texto chama aquilo de
 * "a base técnica usada para fechar este orçamento". É o "antes" que explica
 * por que a obra é necessária, e é o que o cliente reconhece: ele mora ali.
 *
 * **Vão para um bucket público**, e tem que ser: o documento é HTML servido a
 * quem tem a senha, e a foto precisa carregar sem sessão nenhuma. URL assinada
 * expiraria, e proposta impressa em julho é reaberta em setembro.
 *
 * Nada aqui alcança documento já publicado: publicação é cópia congelada, e a
 * mídia nova só chega ao cliente quando alguém republicar.
 */

const IMAGENS = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const VIDEOS = ["video/mp4", "video/webm"];

/** 50 MB é o teto do bucket. Vídeo de obra no celular passa de 20 MB fácil. */
const TETO_BYTES = 50 * 1024 * 1024;

const EXTENSOES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

async function daOrg(orcamentoId: string): Promise<boolean> {
  const { orgId } = await exigirAdmin();
  const { data } = await supabaseAdmin()
    .from("orc_orcamentos")
    .select("id")
    .eq("id", orcamentoId)
    .eq("org_id", orgId)
    .maybeSingle();
  return Boolean(data);
}

export async function enviarMidia(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const orcamentoId = String(form.get("orcamentoId") ?? "");
  if (!(await daOrg(orcamentoId))) {
    return { ok: false, erro: "Orçamento não encontrado." };
  }

  const arquivo = form.get("arquivo") as File | null;
  if (!arquivo || arquivo.size === 0) {
    return { ok: false, erro: "Escolha uma foto ou um vídeo." };
  }

  const mime = arquivo.type.split(";")[0].trim().toLowerCase();
  const ehVideo = VIDEOS.includes(mime);
  if (!ehVideo && !IMAGENS.includes(mime)) {
    return { ok: false, erro: "Formato não aceito. Use JPG, PNG, WebP ou MP4." };
  }
  if (arquivo.size > TETO_BYTES) {
    return { ok: false, erro: "O arquivo passa de 50 MB." };
  }

  const sb = supabaseAdmin();

  // O tempo no nome evita colisão e derruba o cache do CDN. O bucket é
  // público e caminho fixo faria a foto antiga continuar aparecendo.
  const caminho = `${orcamentoId}/${Date.now()}.${EXTENSOES[mime]}`;

  const { error: erroUpload } = await sb.storage
    .from(BUCKET_PROPOSTAS)
    .upload(caminho, arquivo, { contentType: mime, upsert: false });
  if (erroUpload) return { ok: false, erro: erroUpload.message };

  const { data: ultimas } = await sb
    .from("orc_midias")
    .select("position")
    .eq("orcamento_id", orcamentoId)
    .order("position", { ascending: false })
    .limit(1);

  const { error } = await sb.from("orc_midias").insert({
    orcamento_id: orcamentoId,
    tipo: ehVideo ? "video" : "foto",
    storage_path: caminho,
    legenda: (String(form.get("legenda") ?? "").trim() || null) as string | null,
    position: (ultimas?.[0]?.position ?? 0) + 1,
  });

  if (error) {
    // Sem isto o bucket fica com um arquivo que nenhuma linha aponta.
    await sb.storage.from(BUCKET_PROPOSTAS).remove([caminho]);
    return { ok: false, erro: error.message };
  }

  revalidatePath(`/admin/orcamentos/${orcamentoId}`);
  return { ok: true };
}

export async function renomearMidia(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const orcamentoId = String(form.get("orcamentoId") ?? "");
  const id = String(form.get("id") ?? "");
  if (!(await daOrg(orcamentoId))) {
    return { ok: false, erro: "Orçamento não encontrado." };
  }

  const legenda = String(form.get("legenda") ?? "").trim();
  const { error } = await supabaseAdmin()
    .from("orc_midias")
    .update({ legenda: legenda.length > 0 ? legenda : null })
    .eq("id", id)
    .eq("orcamento_id", orcamentoId);

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/admin/orcamentos/${orcamentoId}`);
  return { ok: true };
}

export async function excluirMidia(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const orcamentoId = String(form.get("orcamentoId") ?? "");
  const id = String(form.get("id") ?? "");
  if (!(await daOrg(orcamentoId))) {
    return { ok: false, erro: "Orçamento não encontrado." };
  }

  const sb = supabaseAdmin();

  const { data: midia } = await sb
    .from("orc_midias")
    .select("storage_path")
    .eq("id", id)
    .eq("orcamento_id", orcamentoId)
    .maybeSingle();

  const { error } = await sb
    .from("orc_midias")
    .delete()
    .eq("id", id)
    .eq("orcamento_id", orcamentoId);
  if (error) return { ok: false, erro: error.message };

  // Depois da linha, não antes: arquivo órfão é lixo, linha órfã é erro na
  // tela do cliente.
  if (midia?.storage_path) {
    await sb.storage.from(BUCKET_PROPOSTAS).remove([midia.storage_path]);
  }

  revalidatePath(`/admin/orcamentos/${orcamentoId}`);
  return { ok: true };
}
