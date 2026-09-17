"use server";

import { revalidatePath } from "next/cache";
import { BUCKET, supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/admin/sessao";
import { transcrever } from "@/lib/transcricao/provedor";
import { diaValido } from "@/lib/tempo";
import { garantirRelatorioDoDia } from "./relatorio";
import type { Resultado } from "@/lib/admin/tipos";

/**
 * Os registros do dia: o que foi digitado e o que foi falado.
 *
 * Os bytes do áudio nunca passam por aqui. O navegador pede uma URL assinada,
 * envia direto ao Storage e só então registra a linha — áudio de cinco
 * minutos passa fácil do teto de corpo de uma Server Action. É o mesmo desenho
 * da importação avulsa, pelos mesmos motivos.
 *
 * **Cada passo é uma chamada.** Subir, registrar e transcrever são três, e não
 * uma, porque a tela precisa de degraus para mostrar progresso e porque
 * falhar no meio não pode custar o que já foi feito: se a transcrição quebrar,
 * o áudio continua gravado e o botão de tentar de novo reusa o mesmo arquivo.
 */

const TAMANHO_MAXIMO = 25 * 1024 * 1024;
const EXTENSAO_VALIDA = /^[a-z0-9]{2,5}$/;

const MIMES = new Set([
  "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/webm", "audio/ogg",
  "audio/opus", "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav",
  "audio/flac", "audio/aac", "application/octet-stream", "",
]);

const EXTENSOES = new Set([
  "m4a", "mp3", "mp4", "mpeg", "mpga", "ogg", "opus", "wav", "webm", "flac", "aac",
]);

/** O diário de quem está logado, com a org, para o caminho no Storage. */
async function meuDiario(): Promise<{ id: string; orgId: string } | null> {
  const { orgId, id: usuarioId } = await exigirAdmin();

  const { data } = await supabaseAdmin()
    .from("dia_diarios")
    .select("id")
    .eq("org_id", orgId)
    .eq("autor_id", usuarioId)
    .maybeSingle();

  return data ? { id: data.id, orgId } : null;
}

/** O registro é meu? Confere subindo a corrente até o diário. */
async function meuRegistro(
  registroId: string,
): Promise<{ relatorioId: string } | null> {
  const diario = await meuDiario();
  if (!diario) return null;

  const sb = supabaseAdmin();

  const { data: registro } = await sb
    .from("dia_registros")
    .select("relatorio_id")
    .eq("id", registroId)
    .maybeSingle();
  if (!registro) return null;

  const { data: relatorio } = await sb
    .from("dia_relatorios")
    .select("id")
    .eq("id", registro.relatorio_id)
    .eq("diario_id", diario.id)
    .maybeSingle();

  return relatorio ? { relatorioId: relatorio.id } : null;
}

function revalidar() {
  revalidatePath("/admin/diario");
}

export type UrlDeAudio =
  | { ok: true; caminho: string; token: string; bucket: string }
  | { ok: false; erro: string };

/** Passo 1: a permissão para o navegador subir o áudio direto ao Storage. */
export async function urlParaAudioDoDiario(dados: {
  mimeType: string;
  extensao: string;
  tamanhoBytes: number;
}): Promise<UrlDeAudio> {
  const diario = await meuDiario();
  if (!diario) return { ok: false, erro: "Diário não encontrado." };

  const mime = dados.mimeType.split(";")[0].trim().toLowerCase();
  const extensao = dados.extensao.toLowerCase();

  if (!EXTENSAO_VALIDA.test(extensao) || !EXTENSOES.has(extensao)) {
    return { ok: false, erro: `Formato de áudio não aceito: ${extensao}` };
  }
  if (!MIMES.has(mime)) {
    return { ok: false, erro: `Formato não aceito: ${mime}` };
  }
  if (
    !Number.isFinite(dados.tamanhoBytes) ||
    dados.tamanhoBytes <= 0 ||
    dados.tamanhoBytes > TAMANHO_MAXIMO
  ) {
    return { ok: false, erro: "Áudio acima do limite de 25 MB." };
  }

  // O caminho carrega a org: é o que permite limpar o Storage se a conta for
  // apagada, e impede que um caminho adivinhado caia noutra empreiteira.
  const caminho = `diario/${diario.orgId}/${crypto.randomUUID()}.${extensao}`;

  const { data, error } = await supabaseAdmin()
    .storage.from(BUCKET)
    .createSignedUploadUrl(caminho);

  if (error || !data) {
    return { ok: false, erro: error?.message ?? "Falha ao criar a URL." };
  }
  return { ok: true, caminho: data.path, token: data.token, bucket: BUCKET };
}

export type SaidaDoRegistro =
  | { ok: true; id: string }
  | { ok: false; erro: string };

/** Passo 2: o arquivo já está no Storage; aqui ele vira linha. */
export async function registrarAudioDoDiario(dados: {
  dia: string;
  caminho: string;
  mimeType: string;
  tamanhoBytes: number;
  duracaoMs: number | null;
}): Promise<SaidaDoRegistro> {
  const { id: usuarioId } = await exigirAdmin();
  const diario = await meuDiario();
  if (!diario) return { ok: false, erro: "Diário não encontrado." };
  if (!diaValido(dados.dia)) return { ok: false, erro: "Data inválida." };

  const relatorioId = await garantirRelatorioDoDia(diario.id, dados.dia);
  if (!relatorioId) return { ok: false, erro: "Falha ao abrir o dia." };

  const { data, error } = await supabaseAdmin()
    .from("dia_registros")
    .insert({
      relatorio_id: relatorioId,
      tipo: "audio",
      storage_path: dados.caminho,
      mime_type: dados.mimeType || null,
      tamanho_bytes: dados.tamanhoBytes,
      duracao_ms: dados.duracaoMs,
      status: "pendente",
      criado_por: usuarioId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, erro: error?.message ?? "Falha ao registrar o áudio." };
  }

  revalidar();
  return { ok: true, id: data.id };
}

export type SaidaDaTranscricao =
  | { ok: true; texto: string }
  | { ok: false; erro: string };

/** Passo 3: o Whisper. Falhar aqui não custa o arquivo. */
export async function transcreverRegistro(
  id: string,
): Promise<SaidaDaTranscricao> {
  if (!(await meuRegistro(id))) {
    return { ok: false, erro: "Registro inválido." };
  }

  const sb = supabaseAdmin();

  const { data: registro } = await sb
    .from("dia_registros")
    .select("storage_path, mime_type, texto")
    .eq("id", id)
    .maybeSingle();

  if (!registro?.storage_path) {
    return { ok: false, erro: "Este registro não tem áudio." };
  }

  await sb
    .from("dia_registros")
    .update({ status: "transcrevendo", erro: null })
    .eq("id", id);

  const { data: arquivo, error: erroDownload } = await sb.storage
    .from(BUCKET)
    .download(registro.storage_path);

  if (erroDownload || !arquivo) {
    const erro = erroDownload?.message ?? "Não consegui baixar o áudio.";
    await sb.from("dia_registros").update({ status: "falhou", erro }).eq("id", id);
    revalidar();
    return { ok: false, erro };
  }

  // Contexto `diario`: aqui não se dita medida nem preço, dita-se o que andou
  // e quem ficou de fazer o quê. Ver o vocabulário em `provedor.ts`.
  const saida = await transcrever(arquivo, registro.mime_type, "diario");

  if (!saida.ok) {
    await sb
      .from("dia_registros")
      .update({ status: "falhou", erro: saida.erro })
      .eq("id", id);
    revalidar();
    return { ok: false, erro: saida.erro };
  }

  await sb
    .from("dia_registros")
    .update({ status: "pronto", texto: saida.texto, erro: null })
    .eq("id", id);

  revalidar();
  return { ok: true, texto: saida.texto };
}

/** O caminho curto: digitar em vez de falar. Uma chamada só. */
export async function registrarTextoDoDiario(dados: {
  dia: string;
  texto: string;
}): Promise<SaidaDoRegistro> {
  const { id: usuarioId } = await exigirAdmin();
  const diario = await meuDiario();
  if (!diario) return { ok: false, erro: "Diário não encontrado." };
  if (!diaValido(dados.dia)) return { ok: false, erro: "Data inválida." };

  const texto = dados.texto.trim();
  if (!texto) return { ok: false, erro: "Escreva alguma coisa." };

  const relatorioId = await garantirRelatorioDoDia(diario.id, dados.dia);
  if (!relatorioId) return { ok: false, erro: "Falha ao abrir o dia." };

  const { data, error } = await supabaseAdmin()
    .from("dia_registros")
    .insert({
      relatorio_id: relatorioId,
      tipo: "texto",
      texto,
      status: "pronto",
      criado_por: usuarioId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, erro: error?.message ?? "Falha ao registrar." };
  }

  revalidar();
  return { ok: true, id: data.id };
}

/**
 * Apaga um registro.
 *
 * O arquivo sai do Storage junto: áudio órfão é conta que cresce sozinha e
 * ninguém vai auditar. O resumo já gerado **não** é refeito — o que está
 * escrito nas quatro seções é texto revisado por gente, e apagar a fonte não
 * apaga a conclusão.
 */
export async function apagarRegistro(id: string): Promise<Resultado> {
  if (!(await meuRegistro(id))) {
    return { ok: false, erro: "Registro inválido." };
  }

  const sb = supabaseAdmin();

  const { data: registro } = await sb
    .from("dia_registros")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await sb.from("dia_registros").delete().eq("id", id);
  if (error) return { ok: false, erro: error.message };

  if (registro?.storage_path) {
    await sb.storage.from(BUCKET).remove([registro.storage_path]);
  }

  revalidar();
  return { ok: true };
}
