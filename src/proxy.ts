import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Renova a sessão do admin a cada requisição.
 *
 * Server Component não pode escrever cookie, então é aqui que o refresh token
 * é trocado e os cookies novos são gravados. Sem isto a sessão do painel
 * expiraria em uma hora e o login cairia sozinho.
 *
 * Não faz autorização: quem barra o acesso é `exigirAdmin()` nas páginas.
 */
export async function proxy(request: NextRequest) {
  const resposta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (novos) => {
          novos.forEach(({ name, value, options }) =>
            resposta.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  await supabase.auth.getUser();
  return resposta;
}

export const config = {
  // Só o painel tem sessão. O canteiro e o cliente entram por token, sem cookie.
  matcher: ["/admin/:path*"],
};
