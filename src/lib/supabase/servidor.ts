import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

/**
 * Cliente autenticado do admin, com a sessão vinda dos cookies.
 *
 * Diferente de `admin.ts`, este respeita RLS: o que ele enxerga é o que as
 * policies deixam, ou seja, só a org da qual o usuário é membro.
 */
export async function supabaseServidor() {
  const jar = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (novos) => {
          try {
            novos.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            // Server Component não pode escrever cookie. O proxy renova a
            // sessão antes de chegar aqui, então isto é esperado e inofensivo.
          }
        },
      },
    },
  );
}
