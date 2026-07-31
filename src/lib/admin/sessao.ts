import "server-only";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServidor } from "@/lib/supabase/servidor";

/**
 * Porta de entrada do painel.
 *
 * A allowlist de e-mail é a autorização de verdade: mesmo que alguém consiga
 * criar uma conta no projeto Supabase, sem estar na lista não entra. E o
 * vínculo em `org_members` é criado na primeira entrada — é ele que faz as
 * policies de RLS liberarem os dados da org.
 *
 * A org vem do banco, nunca de uma constante no código. Hoje existe uma só, a
 * nossa; quando um cliente ganhar login próprio, ele entra como membro da org
 * dele e o resto do código continua igual.
 */

function allowlist(): string[] {
  return (process.env.ADMIN_EMAIL_ALLOWLIST ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export type Admin = { id: string; email: string; orgId: string };

export async function exigirAdmin(): Promise<Admin> {
  const supabase = await supabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) redirect("/admin/login");

  const email = user.email.toLowerCase();
  const permitidos = allowlist();

  if (permitidos.length === 0) {
    // Allowlist vazia trancaria o painel para sempre sem dizer por quê.
    redirect("/admin/login?erro=allowlist-vazia");
  }
  if (!permitidos.includes(email)) {
    redirect("/admin/login?erro=sem-acesso");
  }

  return { id: user.id, email, orgId: await garantirOrg(user.id, email) };
}

/** A org do usuário logado. Atalho para quem já está dentro do painel. */
export async function orgAtual(): Promise<string> {
  const { orgId } = await exigirAdmin();
  return orgId;
}

/**
 * Resolve a org do usuário e cria o vínculo se ainda não existir. Idempotente.
 *
 * Roda com service key porque a policy de `org_members` só permite ler ou
 * escrever a própria linha depois que ela existe.
 */
async function garantirOrg(userId: string, email: string): Promise<string> {
  const sb = supabaseAdmin();

  const { data: vinculo } = await sb
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (vinculo) return vinculo.org_id;

  const { data: org, error } = await sb
    .from("orgs")
    .insert({ name: email })
    .select("id")
    .single();

  if (error || !org) {
    throw new Error(error?.message ?? "Não consegui criar a org da conta.");
  }

  await sb.from("org_members").insert({ org_id: org.id, user_id: userId });
  return org.id;
}
