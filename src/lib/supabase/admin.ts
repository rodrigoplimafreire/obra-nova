import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Cliente com service key. Só no servidor — o import "server-only" acima quebra
 * o build se este módulo for puxado por um client component.
 */

export const BUCKET = "gravacoes";

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
