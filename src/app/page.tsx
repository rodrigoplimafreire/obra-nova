import { redirect } from "next/navigation";

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
 */
export default function Home() {
  redirect("/admin/login");
}
