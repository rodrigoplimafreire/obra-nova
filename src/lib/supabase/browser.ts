"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente do navegador. Usado só para enviar bytes a uma signed upload URL —
 * a autorização vem do token da URL, não da chave anon.
 */

let cliente: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  if (cliente) return cliente;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY não estão configuradas.",
    );
  }

  cliente = createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cliente;
}
