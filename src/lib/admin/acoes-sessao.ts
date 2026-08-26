"use server";

import { supabaseServidor } from "@/lib/supabase/servidor";
import { conferirAcesso } from "./acessos";

/**
 * O e-mail está liberado para o painel, sem exigir que já exista sessão.
 *
 * Usada depois de um cadastro: a conta no Supabase Auth pode nascer sem estar
 * na allowlist, e a pessoa precisa saber que criar a conta não é a mesma coisa
 * que ganhar acesso — a autorização de verdade é a lista, não a existência da
 * conta.
 */
export async function emailNaAllowlist(email: string): Promise<boolean> {
  return (await conferirAcesso(email)) === "liberado";
}

/**
 * O servidor está enxergando a sessão que o navegador acabou de criar?
 *
 * Existe por causa de uma falha que não deixa rastro na tela: o login dá
 * certo, o cookie é gravado no navegador, mas o servidor não o recebe — e a
 * pessoa é devolvida para a tela de login sem mensagem nenhuma, como se a
 * senha estivesse errada.
 *
 * Chamar isto logo depois de entrar transforma esse silêncio em diagnóstico.
 */
export async function sessaoVisivelNoServidor(): Promise<{
  visivel: boolean;
  email: string | null;
  naAllowlist: boolean;
}> {
  const supabase = await supabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email?.toLowerCase() ?? null;

  return {
    visivel: Boolean(user),
    email,
    naAllowlist: email ? (await conferirAcesso(email)) === "liberado" : false,
  };
}
