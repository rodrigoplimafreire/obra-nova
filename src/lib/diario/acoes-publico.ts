"use server";

import { revalidatePath } from "next/cache";
import { confere, liberado, liberar } from "@/lib/acesso/gate";
import { senhaDoDiario } from "./dados";

/**
 * A única coisa que o leitor de fora faz: digitar a senha.
 *
 * Nada aqui chama `exigirAdmin()`, de propósito — quem abre esta página não
 * tem conta, e não vai ter. A autorização é o token mais a senha, e o token
 * é revalidado do zero a cada chamada, sem confiar em nada que o navegador
 * mande.
 */

/**
 * Cookie por token: uma pessoa pode receber dois diários, e destravar um não
 * pode destravar o outro. O desenho mora em `@/lib/acesso/gate`.
 */
const PREFIXO_DO_COOKIE = "dia_gate_";

export async function entrarNoDiario(
  _anterior: { erro?: string } | null,
  form: FormData,
): Promise<{ erro?: string }> {
  const token = String(form.get("token") ?? "");
  const senha = String(form.get("senha") ?? "");

  if (!confere(await senhaDoDiario(token), senha)) {
    return { erro: "Senha incorreta." };
  }

  await liberar(PREFIXO_DO_COOKIE, token);
  revalidatePath(`/d/${token}`);
  return {};
}

export async function diarioLiberado(token: string): Promise<boolean> {
  return liberado(PREFIXO_DO_COOKIE, token);
}
