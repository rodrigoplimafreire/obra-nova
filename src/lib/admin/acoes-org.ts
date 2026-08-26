"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { COOKIE_ORG, exigirAdmin } from "./sessao";
import type { Resultado } from "./tipos";

/**
 * Trocar a empreiteira ativa.
 *
 * A escolha vai para cookie, mas quem autoriza é `org_members`: a conferência
 * acontece aqui, na escrita, **e de novo** em toda resolução de sessão. Duas
 * vezes de propósito — gravar um cookie já validado não dispensa validar na
 * leitura, porque o cookie sai daqui e volta pelo navegador, que é território
 * de quem estiver do outro lado.
 */
export async function trocarOrg(orgId: string): Promise<Resultado> {
  const { orgs } = await exigirAdmin();

  if (!orgs.some((o) => o.id === orgId)) {
    return { ok: false, erro: "Você não tem acesso a esta empreiteira." };
  }

  (await cookies()).set(COOKIE_ORG, orgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Um mês: mais que isso e o operador volta de férias atuando por um
    // cliente que ele não lembra ter escolhido.
    maxAge: 60 * 60 * 24 * 30,
  });

  // `layout` e não `page`: a barra de contexto vive na casca, e sem isto ela
  // continuaria mostrando a empreiteira anterior.
  revalidatePath("/admin", "layout");
  return { ok: true };
}
