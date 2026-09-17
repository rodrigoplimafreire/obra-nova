import "server-only";
import { cookies } from "next/headers";

/**
 * O portão das páginas que o público abre por link.
 *
 * Nasceu dentro do módulo de orçamento e saiu de lá quando o diário passou a
 * precisar do mesmo comportamento. O que este arquivo carrega são as duas
 * decisões que custaram caro, e que não podem se perder na cópia:
 *
 * 1. **A senha é conferida no servidor, sempre.** A versão estática do
 *    orcamentos.rd.eng.br comparava no navegador, o que basta para o curioso
 *    e não basta para o determinado. O segredo nunca desce.
 *
 * 2. **O cookie é por token, e o `path` é a raiz.** O isolamento entre dois
 *    links está no *nome* do cookie, não no caminho. Ele já esteve em
 *    `/p/${token}`, e isso quebrava o domínio da RD: lá o cliente abre
 *    `orcamentos.rd.eng.br/nome/`, que um rewrite da Vercel serve a partir de
 *    `/p/nome`. O caminho da barra do navegador nunca batia com o do cookie,
 *    ele não voltava em requisição nenhuma, e o cliente redigitava a senha a
 *    cada visita.
 */

/** Trinta dias: tempo de uma negociação, não de uma sessão. */
const VALIDADE_SEGUNDOS = 60 * 60 * 24 * 30;

export async function liberar(prefixo: string, token: string): Promise<void> {
  const jar = await cookies();
  jar.set(`${prefixo}${token}`, "1", {
    // O JavaScript da página não tem nada que fazer com este cookie.
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VALIDADE_SEGUNDOS,
  });
}

export async function liberado(prefixo: string, token: string): Promise<boolean> {
  const jar = await cookies();
  return jar.get(`${prefixo}${token}`)?.value === "1";
}

/**
 * Comparação da senha.
 *
 * Texto puro dos dois lados, como o banco guarda — a decisão vigente do
 * produto é senha simples e sem conta (ver `PLANO-PORTAL-CLIENTE.md`). O dia
 * em que isso virar hash, vira aqui, para os dois módulos de uma vez.
 */
export function confere(
  guardada: string | null | undefined,
  tentativa: string,
): boolean {
  if (!guardada) return false;
  return guardada.trim() === tentativa.trim();
}
