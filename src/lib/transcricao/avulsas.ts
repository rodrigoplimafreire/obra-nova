import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { orgAtual } from "@/lib/admin/sessao";
import type {
  ResumoDeTranscricao,
  TranscricaoCompleta,
} from "./tipos";

// Reexporta para quem já importa daqui; a definição mora em `tipos.ts`,
// que o cliente também pode ler.
export type * from "./tipos";

/**
 * Transcrição avulsa: o áudio que chegou por fora do app.
 *
 * O empreiteiro recebe serviço por áudio no WhatsApp o dia inteiro. Antes deste
 * módulo ele tinha dois caminhos, os dois ruins: ouvir e redigitar, ou gravar
 * de novo com a própria voz dentro do orçamento — repetindo o que o cliente já
 * tinha dito. Aqui o arquivo entra como veio.
 *
 * A transcrição vive sozinha porque nasce antes de existir orçamento e pode
 * nunca virar um. Muito áudio de cliente é pergunta, reclamação ou combinação
 * de horário; só parte vira serviço orçado.
 */

export async function listarTranscricoes(): Promise<ResumoDeTranscricao[]> {
  const org = await orgAtual();

  const { data } = await supabaseAdmin()
    .from("transcricoes")
    .select(
      "id, titulo, arquivo_nome, status, duracao_ms, texto, editado_em, orcamento_id, created_at",
    )
    .eq("org_id", org)
    .order("created_at", { ascending: false });

  return (data ?? []).map((t) => ({
    id: t.id,
    titulo: t.titulo,
    arquivoNome: t.arquivo_nome,
    status: t.status,
    duracaoMs: t.duracao_ms,
    previa: t.texto ? t.texto.slice(0, 180) : null,
    temTexto: Boolean(t.texto),
    editado: Boolean(t.editado_em),
    virouOrcamento: t.orcamento_id,
    criadoEm: t.created_at,
  }));
}

export async function carregarTranscricao(
  id: string,
): Promise<TranscricaoCompleta | null> {
  const org = await orgAtual();

  const { data } = await supabaseAdmin()
    .from("transcricoes")
    .select("*")
    .eq("id", id)
    .eq("org_id", org)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    titulo: data.titulo,
    arquivoNome: data.arquivo_nome,
    status: data.status,
    mimeType: data.mime_type,
    duracaoMs: data.duracao_ms,
    tamanhoBytes: data.tamanho_bytes,
    texto: data.texto,
    editado: Boolean(data.editado_em),
    erro: data.erro,
    virouOrcamento: data.orcamento_id,
    criadoEm: data.created_at,
    atualizadoEm: data.updated_at,
  };
}
