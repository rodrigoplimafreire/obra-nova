/**
 * Verificação da Entrega 1: org ativa, papel de operador e isolamento.
 *
 * O erro que este script existe para pegar é **silencioso**. A versão anterior
 * resolvia a org com `org_members → order(created_at) → limit(1)`: a pessoa era
 * a primeira org em que entrou, para sempre. Com uma org por usuário isso
 * funcionava e ninguém notava. No instante em que o operador vira membro de
 * duas empreiteiras para poder atendê-las, essa linha passa a ler a org errada
 * sem nenhum erro na tela — e um orçamento sai publicado na marca do outro
 * cliente. Não existe tela vermelha para isso; só existe verificação.
 *
 * O que ele prova, contra o banco de verdade:
 *
 *  1. `escolherAtiva` respeita o cookie quando há vínculo em `org_members`;
 *  2. cookie apontando para org **sem** vínculo é ignorado (não é acesso, e
 *     também não é erro — cookie velho é situação normal);
 *  3. cookie com lixo ou ausente cai na primeira org, que é o que faz o usuário
 *     comum de uma org só não perceber diferença nenhuma;
 *  4. usuário de uma org só não consegue sair dela nem forjando o cookie;
 *  5. as orgs realmente têm dados distintos — senão os itens 1 a 4 passariam
 *     por acaso, comparando dois conjuntos vazios.
 *
 * Rodar:  npm run verificar:org
 * Precisa de: .env.local com NEXT_PUBLIC_SUPABASE_URL e
 * SUPABASE_SERVICE_ROLE_KEY. Só lê — não escreve nada.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { escolherAtiva, type OrgAcessivel } from "@/lib/admin/sessao";

config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !CHAVE) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const sb = createClient(URL, CHAVE, { auth: { persistSession: false } });

let falhas = 0;

function conferir(nome: string, ok: boolean, detalhe = "") {
  console.log(`${ok ? "  ok  " : "FALHOU"}  ${nome}${detalhe && `  — ${detalhe}`}`);
  if (!ok) falhas++;
}

/** A mesma leitura que `orgsDoUsuario` faz no app, sem o Storage. */
async function orgsDe(userId: string): Promise<OrgAcessivel[]> {
  const { data: vinculos } = await sb
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .order("created_at");

  const ids = (vinculos ?? []).map((v) => v.org_id);
  if (ids.length === 0) return [];

  const { data: orgs } = await sb
    .from("orgs")
    .select("id, name, nome_exibicao")
    .in("id", ids);

  const porId = new Map((orgs ?? []).map((o) => [o.id, o]));
  return ids.flatMap((id) => {
    const o = porId.get(id);
    return o ? [{ id: o.id, nome: o.nome_exibicao?.trim() || o.name, logo: null }] : [];
  });
}

async function orcamentosDe(orgId: string): Promise<string[]> {
  const { data } = await sb
    .from("orc_orcamentos")
    .select("id, cliente_nome")
    .eq("org_id", orgId)
    .order("created_at");
  return (data ?? []).map((o) => o.cliente_nome ?? o.id);
}

async function main() {
  const { data: operadores } = await sb.from("operadores").select("user_id");
  const ids = (operadores ?? []).map((o) => o.user_id);

  if (ids.length === 0) {
    console.error(
      "Nenhum operador cadastrado. Insira uma linha em `operadores` antes de rodar.",
    );
    process.exit(1);
  }

  // Precisa de um operador com duas orgs: com uma só, todo o teste passa por
  // vacuidade — é exatamente o caso em que o bug antigo também passava.
  let operador: { id: string; orgs: OrgAcessivel[] } | null = null;
  for (const id of ids) {
    const orgs = await orgsDe(id);
    if (orgs.length >= 2) {
      operador = { id, orgs };
      break;
    }
  }

  if (!operador) {
    console.error(
      "Nenhum operador é membro de duas orgs. Sem isso a verificação não prova nada.",
    );
    process.exit(1);
  }

  const [a, b] = operador.orgs;
  console.log(`Operador ${operador.id}`);
  console.log(`  org A (padrão): ${a.nome}`);
  console.log(`  org B:          ${b.nome}\n`);

  // --- A regra de escolha -------------------------------------------------
  conferir(
    "sem cookie, cai na primeira org",
    escolherAtiva(operador.orgs, undefined) === a.id,
  );
  conferir(
    "cookie com vínculo é respeitado (org B)",
    escolherAtiva(operador.orgs, b.id) === b.id,
  );
  conferir(
    "cookie com vínculo é respeitado (org A)",
    escolherAtiva(operador.orgs, a.id) === a.id,
  );

  // O cookie é dado do navegador: qualquer pessoa edita. A lista é que manda.
  const forjada = "00000000-0000-0000-0000-000000000000";
  conferir(
    "cookie para org sem vínculo é ignorado, não vira acesso",
    escolherAtiva(operador.orgs, forjada) === a.id,
  );
  conferir(
    "cookie com lixo não quebra nem vaza",
    escolherAtiva(operador.orgs, "'; drop table orgs; --") === a.id,
  );

  // --- O usuário comum não muda de comportamento --------------------------
  const { data: todos } = await sb.from("org_members").select("user_id, org_id");
  const porUsuario = new Map<string, string[]>();
  for (const v of todos ?? []) {
    porUsuario.set(v.user_id, [...(porUsuario.get(v.user_id) ?? []), v.org_id]);
  }
  const comuns = [...porUsuario.entries()].filter(([, o]) => o.length === 1);

  if (comuns.length === 0) {
    console.log("  --    nenhum usuário de uma org só para comparar");
  } else {
    const presos = comuns.every(([id]) => {
      const orgs = [{ id: porUsuario.get(id)![0], nome: "", logo: null }];
      return (
        escolherAtiva(orgs, undefined) === orgs[0].id &&
        escolherAtiva(orgs, b.id) === orgs[0].id
      );
    });
    conferir(
      `usuário de uma org só não sai dela nem forjando cookie (${comuns.length})`,
      presos,
    );
  }

  // --- Admin vê todas; cliente vê a dele --------------------------------
  const { data: todasOrgs } = await sb.from("orgs").select("id");
  const quantasOrgs = (todasOrgs ?? []).length;

  const semTodas: string[] = [];
  for (const id of ids) {
    const minhas = await orgsDe(id);
    if (minhas.length !== quantasOrgs) semTodas.push(id);
  }
  conferir(
    `admin tem vínculo em todas as ${quantasOrgs} orgs`,
    semTodas.length === 0,
    semTodas.length ? `faltando para ${semTodas.join(", ")}` : "",
  );

  const admins = new Set(ids);
  const clientesComDemais = [...porUsuario.entries()].filter(
    ([id, o]) => !admins.has(id) && o.length > 1,
  );
  conferir(
    "nenhum cliente tem vínculo em mais de uma org",
    clientesComDemais.length === 0,
    clientesComDemais.map(([id]) => id).join(", "),
  );

  // --- E as orgs de fato guardam coisas diferentes -------------------------
  const [itensA, itensB] = await Promise.all([orcamentosDe(a.id), orcamentosDe(b.id)]);
  console.log(`\n  ${a.nome}: ${itensA.length} orçamento(s) — ${itensA.join(", ") || "—"}`);
  console.log(`  ${b.nome}: ${itensB.length} orçamento(s) — ${itensB.join(", ") || "—"}`);

  const { count: vazamento } = await sb
    .from("orc_orcamentos")
    .select("id", { count: "exact", head: true })
    .is("org_id", null);
  conferir("nenhum orçamento sem org", (vazamento ?? 0) === 0);
  conferir(
    "trocar de org realmente troca o conteúdo",
    itensA.length > 0 && itensB.length > 0,
    "as duas orgs têm orçamento próprio",
  );

  console.log(falhas === 0 ? "\nTudo certo." : `\n${falhas} verificação(ões) falharam.`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
