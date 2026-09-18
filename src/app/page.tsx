import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { HOST_DO_DIARIO } from "@/lib/diario/apelido";

/**
 * O domínio pelado não tem público próprio.
 *
 * O produto é white-label com onboarding manual: não existe cadastro
 * público, e ninguém deveria estar digitando este endereço à toa. Quem entra
 * é o Reginato, pelo painel — e cada cliente da obra chega por um link com
 * token que recebeu (`/p/[token]`, `/o/[token]`, `/rel/[token]`), nunca pelo
 * domínio sozinho.
 *
 * Havia aqui uma tela de splash escrita para o cliente ("se você recebeu um
 * relatório, abra por ele") com um botão "Entrar no painel" — que levava para
 * a área interna, não para o cliente. Quem caísse aqui por engano era
 * convidado a clicar num botão que não era para ele.
 *
 * **No domínio do diário isso vale em dobro.** Quem digita
 * `diario.rd.eng.br` sem o apelido é o leitor, não o operador: mandá-lo para
 * o login do painel é oferecer uma conta que ele nunca vai ter. O 404 do
 * produto já diz a frase certa para o caso dele — que o link do WhatsApp pode
 * ter vindo cortado.
 */
export default async function Home() {
  const host = (await headers()).get("host")?.toLowerCase() ?? "";
  if (host === HOST_DO_DIARIO) notFound();

  redirect("/admin/login");
}
