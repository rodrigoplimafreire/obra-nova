import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Cliente com service key. Só no servidor — o import "server-only" acima quebra
 * o build se este módulo for puxado por um client component.
 */

export const BUCKET = "gravacoes";

/**
 * Bucket das fotos e do vídeo que a proposta mostra.
 *
 * Separado do `gravacoes`, que é privado e guarda o áudio da vistoria: aqui os
 * arquivos precisam carregar no documento do cliente sem sessão nenhuma. URL
 * assinada não serve — proposta impressa em julho é reaberta em setembro, e o
 * link já teria expirado.
 */
export const BUCKET_PROPOSTAS = "propostas";

/** A URL pública de um arquivo da proposta. Bucket público: não expira. */
export function urlDaProposta(caminho: string): string {
  return supabaseAdmin().storage.from(BUCKET_PROPOSTAS).getPublicUrl(caminho)
    .data.publicUrl;
}

function exigir(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente ausente: ${nome}`);
  return valor;
}

export function supabaseAdmin() {
  return createClient<Database>(
    exigir("NEXT_PUBLIC_SUPABASE_URL"),
    exigir("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export function supabaseConfigurado(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
