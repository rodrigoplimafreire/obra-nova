import "server-only";
import { BUCKET, supabaseAdmin } from "@/lib/supabase/admin";
import { lerConfig, transcrever } from "./provedor";

/**
 * Transcrição do áudio que vem do canteiro.
 *
 * Idempotente por (confirmacao_bloco_id, provider): reprocessar atualiza a
 * linha em vez de criar outra. O áudio nunca é apagado — a transcrição erra
 * nome de material e jargão de obra, e o áudio continua sendo a fonte da
 * verdade para quem revisa antes de publicar.
 */

async function executar(
  blocoId: string,
  storagePath: string,
  mimeType: string | null,
): Promise<void> {
  const sb = supabaseAdmin();

  const config = lerConfig();
  const provedor = config?.provedor ?? "nenhum";

  const registrar = async (campos: {
    status: "pending" | "done" | "failed";
    text?: string | null;
    language?: string | null;
    error?: string | null;
  }) => {
    await sb.from("transcripts").upsert(
      {
        confirmacao_bloco_id: blocoId,
        provider: provedor,
        status: campos.status,
        text: campos.text ?? null,
        language: campos.language ?? null,
        error: campos.error ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "confirmacao_bloco_id,provider" },
    );
  };

  if (!config) {
    await registrar({
      status: "failed",
      error: "Nenhuma chave de transcrição configurada no ambiente.",
    });
    return;
  }

  await registrar({ status: "pending" });

  const { data: arquivo, error: erroDownload } = await sb.storage
    .from(BUCKET)
    .download(storagePath);

  if (erroDownload || !arquivo) {
    await registrar({
      status: "failed",
      error: erroDownload?.message ?? "Não consegui baixar o áudio do Storage.",
    });
    return;
  }

  const resultado = await transcrever(arquivo, mimeType);

  if (!resultado.ok) {
    await registrar({ status: "failed", error: resultado.erro });
    return;
  }

  await registrar({
    status: "done",
    text: resultado.texto,
    language: resultado.idioma,
  });
}

export async function transcreverBlocoDeObra(blocoId: string): Promise<void> {
  const { data: bloco } = await supabaseAdmin()
    .from("confirmacao_blocos")
    .select("id, type, storage_path, mime_type")
    .eq("id", blocoId)
    .maybeSingle();

  if (!bloco || bloco.type !== "audio" || !bloco.storage_path) return;

  await executar(bloco.id, bloco.storage_path, bloco.mime_type);
}
