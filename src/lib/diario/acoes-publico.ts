"use server";

import { revalidatePath } from "next/cache";
import { confere, liberado, liberar } from "@/lib/acesso/gate";
import { autenticacaoDoDiario } from "./dados";

/**
 * A única coisa que o leitor de fora faz: digitar a senha.
 *
 * Nada aqui chama `exigirAdmin()`, de propósito — quem abre esta página não
 * tem conta, e não vai ter. A autorização é o endereço mais a senha, e o
 * endereço é revalidado do zero a cada chamada, sem confiar em nada que o
 * navegador mande.
 *
 * **O cookie é nomeado pelo token, mesmo quando a pessoa entrou pelo apelido.**
 * Os dois endereços apontam para o mesmo diário; nomear o cookie pelo que veio
 * na URL faria a mesma pessoa digitar a senha de novo só por ter usado o link
 * bonito em vez do antigo.
 */
const PREFIXO_DO_COOKIE = "dia_gate_";

export async function entrarNoDiario(
  _anterior: { erro?: string } | null,
  form: FormData,
): Promise<{ erro?: string }> {
  const identificador = String(form.get("token") ?? "");
  const senha = String(form.get("senha") ?? "");

  const diario = await autenticacaoDoDiario(identificador);
  if (!diario || !confere(diario.senha, senha)) {
    return { erro: "Senha incorreta." };
  }

  await liberar(PREFIXO_DO_COOKIE, diario.token);
  revalidatePath(`/d/${identificador}`);
  return {};
}

/** Recebe o token canônico, resolvido pela página. */
export async function diarioLiberado(token: string): Promise<boolean> {
  return liberado(PREFIXO_DO_COOKIE, token);
}
