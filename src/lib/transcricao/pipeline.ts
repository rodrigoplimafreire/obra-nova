import "server-only";
import { BUCKET, supabaseAdmin } from "@/lib/supabase/admin";
import { lerConfig, transcrever, type Contexto } from "./provedor";

/**
 * Transcrição do áudio, para os dois módulos.
 *
 * Idempotente por (dono, provider): reprocessar atualiza a linha em vez de
 * criar outra. O áudio nunca é apagado — a transcrição erra nome de material,
 * jargão de obra e número, e o áudio continua sendo a fonte da verdade para
 * quem revisa antes de publicar. No orçamento isso pesa mais: número errado na
 * transcrição vira preço errado no documento.
 *
 * `dono` diz em qual tabela a transcrição se pendura. As duas existem
 * separadas porque o módulo de orçamento nasceu como produto próprio; unificá-
 * las seria migração de dados sem ganho, já que nada consulta as duas juntas.
 */
type Dono =
  | { tabela: "obra"; blocoId: string }
  | { tabela: "orcamento"; blocoId: string };

async function executar(
  dono: Dono,
  storagePath: string,
  mimeType: string | null,
  contexto: Contexto,
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
    const comum = {
      provider: provedor,
      status: campos.status,
      text: campos.text ?? null,
      language: campos.language ?? null,
      error: campos.error ?? null,
      updated_at: new Date().toISOString(),
    };

    // Chave literal, não computada: com uma chave dinâmica o TypeScript infere
    // assinatura de índice e o tipo estrito do upsert deixa de casar.
    if (dono.tabela === "obra") {
      await sb
        .from("transcripts")
        .upsert(
          { confirmacao_bloco_id: dono.blocoId, ...comum },
          { onConflict: "confirmacao_bloco_id,provider" },
        );
    } else {
      await sb
        .from("orc_transcricoes")
        .upsert(
          { bloco_id: dono.blocoId, ...comum },
          { onConflict: "bloco_id,provider" },
        );
    }
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

  const resultado = await transcrever(arquivo, mimeType, contexto);

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

/** O áudio que o mestre manda do canteiro. */
export async function transcreverBlocoDeObra(blocoId: string): Promise<void> {
  const { data: bloco } = await supabaseAdmin()
    .from("confirmacao_blocos")
    .select("id, type, storage_path, mime_type")
    .eq("id", blocoId)
    .maybeSingle();

  if (!bloco || bloco.type !== "audio" || !bloco.storage_path) return;

  await executar(
    { tabela: "obra", blocoId: bloco.id },
    bloco.storage_path,
    bloco.mime_type,
    "obra",
  );
}

/** O áudio do briefing e das respostas, no módulo de orçamento. */
export async function transcreverBlocoDeOrcamento(
  blocoId: string,
): Promise<void> {
  const { data: bloco } = await supabaseAdmin()
    .from("orc_blocos")
    .select("id, type, storage_path, mime_type")
    .eq("id", blocoId)
    .maybeSingle();

  if (!bloco || bloco.type !== "audio" || !bloco.storage_path) return;

  await executar(
    { tabela: "orcamento", blocoId: bloco.id },
    bloco.storage_path,
    bloco.mime_type,
    "orcamento",
  );
}

/** Reprocessa o que ainda não tem transcrição concluída, num orçamento. */
export async function transcreverPendentesDoOrcamento(
  orcamentoId: string,
): Promise<number> {
  const sb = supabaseAdmin();

  const { data: blocos } = await sb
    .from("orc_blocos")
    .select("id")
    .eq("orcamento_id", orcamentoId)
    .eq("type", "audio");

  if (!blocos?.length) return 0;

  const { data: prontas } = await sb
    .from("orc_transcricoes")
    .select("bloco_id")
    .in(
      "bloco_id",
      blocos.map((b) => b.id),
    )
    .eq("status", "done");

  const jaFeitas = new Set((prontas ?? []).map((t) => t.bloco_id));
  const pendentes = blocos.filter((b) => !jaFeitas.has(b.id));

  // Em série: são poucos blocos por orçamento e assim não estouro o rate limit
  // do provedor com uma rajada.
  for (const bloco of pendentes) {
    await transcreverBlocoDeOrcamento(bloco.id);
  }

  return pendentes.length;
}
