import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { conferirAcesso } from "./acessos";

/**
 * Porta de entrada do painel.
 *
 * A allowlist de e-mail é a autorização de verdade: mesmo que alguém consiga
 * criar uma conta no projeto Supabase, sem estar na lista não entra. E o
 * vínculo em `org_members` é criado na primeira entrada — é ele que faz as
 * policies de RLS liberarem os dados da org.
 *
 * **A org é ativa e explícita, não implícita.** A versão anterior resolvia
 * assim: `org_members` → `order(created_at)` → `limit(1)`. Ou seja, um usuário
 * era a *primeira org em que entrou*, para sempre. Enquanto cada pessoa tinha
 * uma org só, isso funcionava e ninguém percebia. No momento em que o operador
 * vira membro de duas empreiteiras para poder atendê-las, essa linha passa a
 * ler a org errada **em silêncio** — misturando dados de dois clientes sem
 * nenhum erro na tela.
 *
 * Trocar aqui foi o suficiente: toda função de dados chama `orgAtual()` por
 * dentro, então o resto do código continua igual.
 */

/** Onde a escolha do operador fica entre requisições. */
export const COOKIE_ORG = "obranova_org";


/** Uma empreiteira que este usuário pode atender, com o nome para a barra. */
export type OrgAcessivel = {
  id: string;
  /** `nome_exibicao` quando existe; senão o `name`, que nasce como o e-mail. */
  nome: string;
  logo: string | null;
};

export type Admin = {
  id: string;
  email: string;
  /** A org **ativa**. É esta que toda consulta de dados usa. */
  orgId: string;
  /** Pode trocar de empreiteira e abrir o console. Ver tabela `operadores`. */
  ehOperador: boolean;
  /** Todas as orgs em que existe vínculo. Uma só, para usuário comum. */
  orgs: OrgAcessivel[];
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
 * valida o JWT no Supabase (não é leitura local de cookie) e a resolução da
 * org consulta o banco. E `exigirAdmin` é chamada em cascata — o layout chama,
 * e cada função de dados chama de novo por dentro de `orgAtual()`.
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

  // As três vão junto: são independentes, e cada ida a São Paulo custa. A
  // decisão sobre o acesso vem antes de qualquer escrita — `garantirOrg`, mais
  // abaixo, não pode criar org para quem não entra.
  const [veredito, orgs, ehOperador] = await Promise.all([
    conferirAcesso(email),
    orgsDoUsuario(user.id),
    conferirOperador(user.id),
  ]);

  if (veredito === "sem-lista") {
    // Nem tabela nem variável: o painel está trancado para todo mundo, e isso é
    // erro de configuração, não falta de permissão desta pessoa.
    redirect("/admin/login?erro=allowlist-vazia");
  }
  if (veredito === "fora") {
    redirect("/admin/login?erro=sem-acesso");
  }

  // Sem vínculo nenhum é primeira entrada: cria a org da pessoa. Operador já
  // tem várias e nunca cai aqui — org nova para ele seria dado órfão.
  const orgId =
    orgs.length === 0
      ? await garantirOrg(user.id, email)
      : await resolverAtiva(orgs);

  // A foto é do usuário, não da empreiteira, então mora no `user_metadata` do
  // Auth. Vem de graça: o `getUser()` acima já a trouxe.
  const bruto = user.user_metadata?.avatar_caminho;
  const avatarCaminho = typeof bruto === "string" && bruto ? bruto : null;

  return {
    id: user.id,
    email,
    orgId,
    ehOperador,
    orgs,
    avatarCaminho,
    avatar: avatarCaminho
      ? supabaseAdmin().storage.from("marca").getPublicUrl(avatarCaminho).data
          .publicUrl
      : null,
  };
});

/** A org ativa do usuário logado. Atalho para quem já está dentro do painel. */
export async function orgAtual(): Promise<string> {
  const { orgId } = await exigirAdmin();
  return orgId;
}

/**
 * O cookie é palpite; `org_members` é a verdade.
 *
 * A escolha do operador viaja em cookie, que é dado do navegador e portanto
 * editável por quem quiser. Nunca é usado direto: só vale se houver vínculo de
 * verdade para o par (usuário, org). Cookie apontando para org sem vínculo é
 * **ignorado em silêncio** — cai na primeira org acessível. Não é erro 500,
 * porque cookie velho depois de perder acesso é situação normal; e não é
 * acesso, porque a lista veio de `org_members`.
 */
async function resolverAtiva(orgs: OrgAcessivel[]): Promise<string> {
  return escolherAtiva(orgs, (await cookies()).get(COOKIE_ORG)?.value);
}

/**
 * A decisão em si, separada da leitura do cookie para poder ser verificada.
 *
 * É a regra de isolamento entre empreiteiras num lugar só: `orgs` sempre vem de
 * `org_members`, e `escolhida` é o dado do navegador. Ver
 * `scripts/verificar-org-ativa.ts`.
 */
export function escolherAtiva(
  orgs: OrgAcessivel[],
  escolhida: string | undefined,
): string {
  if (escolhida && orgs.some((o) => o.id === escolhida)) return escolhida;
  return orgs[0].id;
}

/** As orgs em que o usuário tem vínculo, com nome e logo para a barra. */
async function orgsDoUsuario(userId: string): Promise<OrgAcessivel[]> {
  const sb = supabaseAdmin();

  const { data: vinculos } = await sb
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .order("created_at");

  const ids = (vinculos ?? []).map((v) => v.org_id);
  if (ids.length === 0) return [];

  const { data: orgs } = await sb
    .from("orgs")
    .select("id, name, nome_exibicao, logo_caminho")
    .in("id", ids);

  const porId = new Map((orgs ?? []).map((o) => [o.id, o]));

  // Mantém a ordem dos vínculos: a primeira org continua sendo o padrão de
  // quem nunca escolheu, e é o que faz usuário comum não notar diferença.
  return ids.flatMap((id) => {
    const o = porId.get(id);
    if (!o) return [];
    return [
      {
        id: o.id,
        nome: o.nome_exibicao?.trim() || o.name,
        logo: o.logo_caminho
          ? sb.storage.from("marca").getPublicUrl(o.logo_caminho).data.publicUrl
          : null,
      },
    ];
  });
}

async function conferirOperador(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin()
    .from("operadores")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Cria a org da pessoa na primeira entrada.
 *
 * Só é chamada quando não existe vínculo nenhum — quem já tem org, mesmo que
 * várias, nunca passa por aqui.
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

/**
 * A porta do console. Usar em toda rota e ação de operador.
 *
 * Não-operador recebe 404 pela `notFound()` de quem chama, e não uma tela de
 * "sem permissão": nada do console pode aparecer para quem não é operador —
 * nem rota, nem menu, nem a informação de que a rota existe.
 */
export async function exigirOperador(): Promise<Admin> {
  const admin = await exigirAdmin();
  if (!admin.ehOperador) redirect("/admin");
  return admin;
}
