import type { Enums } from "@/lib/database.types";

/**
 * Tipos e formatação do módulo de Transcrição, **sem** `server-only`.
 *
 * Existe separado de `avulsas.ts` por uma razão de fronteira: as telas são
 * componentes cliente e precisam do tipo e do nome formatado. Importar isso do
 * módulo de dados arrastava `supabaseAdmin` e `next/headers` para o bundle do
 * navegador — o build quebra, e a mensagem aponta para o `server-only` em vez
 * de para a causa.
 *
 * Regra: o que o cliente usa mora aqui; o que toca o banco fica em
 * `avulsas.ts`.
 */

export type StatusDaTranscricao = Enums<"transcricao_status">;

export type ResumoDeTranscricao = {
  id: string;
  titulo: string | null;
  arquivoNome: string | null;
  status: StatusDaTranscricao;
  duracaoMs: number | null;
  /** As primeiras linhas, para a lista dizer do que se trata. */
  previa: string | null;
  temTexto: boolean;
  editado: boolean;
  virouOrcamento: string | null;
  criadoEm: string;
};

export type TranscricaoCompleta = {
  id: string;
  titulo: string | null;
  arquivoNome: string | null;
  status: StatusDaTranscricao;
  mimeType: string | null;
  duracaoMs: number | null;
  tamanhoBytes: number | null;
  texto: string | null;
  editado: boolean;
  erro: string | null;
  virouOrcamento: string | null;
  criadoEm: string;
  atualizadoEm: string;
};

/** O nome que a tela mostra: o que a pessoa deu, ou o do arquivo, ou a data. */
export function nomeDaTranscricao(t: {
  titulo: string | null;
  arquivoNome: string | null;
  criadoEm: string;
}): string {
  if (t.titulo?.trim()) return t.titulo.trim();
  if (t.arquivoNome?.trim()) return t.arquivoNome.trim();
  return `Áudio de ${new Date(t.criadoEm).toLocaleDateString("pt-BR")}`;
}
