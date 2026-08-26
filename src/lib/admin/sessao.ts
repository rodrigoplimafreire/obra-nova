import "server-only";
import { cache } from "react";
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

export type Admin = {
  id: string;
  email: string;
  orgId: string;
  /** Caminho da foto no bucket `marca`, guardado no `user_metadata`. */
  avatarCaminho: string | null;
  /** URL pública da foto, pronta para o `src`. Nulo quando não há foto. */
  avatar: string | null;
};

/**
 * Quem está logado, resolvido **uma vez por requisição**.
 *
 * O `cache()` do React não é otimização de enfeite aqui, é o que torna o
 * painel usável. Sem ele, cada chamada fazia duas idas à rede: `getUser()`
 * valida o JWT no Supabase (não é leitura local de cookie) e `garantirOrg()`
 * consulta o banco. E `exigirAdmin` é chamada em cascata — o layout chama, e
 * cada função de dados chama de novo por dentro de `orgAtual()`.
 *
 * Numa tela de orçamento eram três chamadas, mais a do proxy: quatro validações
 * de sessão contra São Paulo para desenhar uma página. Com o cache, a primeira
 * paga e as seguintes reusam a mesma promessa dentro do mesmo render.
 */
export const exigirAdmin = cache(async function exigirAdmin(): Promise<Admin> {
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

  // A foto é do usuário, não da empreiteira, então mora no `user_metadata` do
  // Auth. Vem de graça: o `getUser()` acima já a trouxe.
  const bruto = user.user_metadata?.avatar_caminho;
  const avatarCaminho = typeof bruto === "string" && bruto ? bruto : null;

  return {
    id: user.id,
    email,
    orgId: await garantirOrg(user.id, email),
    avatarCaminho,
    avatar: avatarCaminho
      ? supabaseAdmin().storage.from("marca").getPublicUrl(avatarCaminho).data
          .publicUrl
      : null,
  };
});

/** A org do usuário logado. Atalho para quem já está dentro do painel. */
export async function orgAtual(): Promise<string> {
  const { orgId } = await exigirAdmin();
  return orgId;
}

/**
 * Resolve a org do usuário e cria o vínculo se ainda não existir.
 *
 * Roda com service key porque a policy de `org_members` só permite ler ou
 * escrever a própria linha depois que ela existe.
 *
 * **Precisa ser à prova de corrida.** A versão anterior fazia "procura, não
 * achou, cria" sem trava, e o próprio login dispara duas requisições quase
 * simultâneas (`router.push` e `router.refresh`). As duas passavam pela busca
 * vazia e criavam uma org cada: deu duas orgs para o mesmo e-mail com 41ms de
 * diferença, e os dados da pessoa espalhados entre elas — uma obra numa,
 * um orçamento na outra, e o painel mostrando só metade.
 *
 * O conserto tem duas metades, e as duas são necessárias: índice único em
 * `orgs.name` no banco, e upsert aqui. O índice é quem garante; o upsert é
 * quem transforma a violação em comportamento correto em vez de erro 500.
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

  // `ignoreDuplicates` faz o segundo a chegar não escrever nada; o select
  // seguinte devolve a linha que o primeiro criou. Sem corrida e sem erro.
  const { error: erroUpsert } = await sb
    .from("orgs")
    .upsert({ name: email }, { onConflict: "name", ignoreDuplicates: true });

  if (erroUpsert) {
    throw new Error(erroUpsert.message);
  }

  const { data: org } = await sb
    .from("orgs")
    .select("id")
    .eq("name", email)
    .maybeSingle();

  if (!org) throw new Error("Não consegui criar a org da conta.");

  // Idem para o vínculo: a chave primária é (org_id, user_id), então a segunda
  // tentativa colide e é ignorada em vez de estourar.
  await sb
    .from("org_members")
    .upsert(
      { org_id: org.id, user_id: userId },
      { onConflict: "org_id,user_id", ignoreDuplicates: true },
    );

  return org.id;
}
