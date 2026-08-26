"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { registrarAbertura, senhaConfere } from "./publico";

/**
 * As duas ações que o cliente final executa — sem conta, sem login, só com o
 * token do link.
 *
 * Nada aqui chama `exigirAdmin()`, de propósito: quem abre esta página não tem
 * conta. A autorização é o token mais a senha, e por isso toda função recebe o
 * token e o revalida do zero, sem confiar em nada que o navegador mande.
 */

const PREFIXO_DO_COOKIE = "orc_gate_";

/**
 * Cookie por token, não um só para o site: uma pessoa pode receber dois
 * orçamentos, e destravar um não pode destravar o outro. `httpOnly` porque o
 * JavaScript da página não tem nada que fazer com ele.
 */
export async function entrarNoOrcamento(
  _anterior: { erro?: string } | null,
  form: FormData,
): Promise<{ erro?: string }> {
  const token = String(form.get("token") ?? "");
  const senha = String(form.get("senha") ?? "");

  if (!(await senhaConfere(token, senha))) {
    return { erro: "Senha incorreta." };
  }

  const jar = await cookies();
  jar.set(`${PREFIXO_DO_COOKIE}${token}`, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/p/${token}`,
    maxAge: 60 * 60 * 24 * 30,
  });

  // A abertura conta aqui, depois do gate: quem não passou da senha não leu a
  // proposta, e o robô de preview do WhatsApp nunca passa.
  await registrarAbertura(token);

  revalidatePath(`/p/${token}`);
  return {};
}

export async function gateLiberado(token: string): Promise<boolean> {
  const jar = await cookies();
  return jar.get(`${PREFIXO_DO_COOKIE}${token}`)?.value === "1";
}

/**
 * O aceite, feito pelo cliente na própria página.
 *
 * É o registro que nasce do lado de fora: não depende de a empreiteira lembrar
 * de marcar, e vira prova do combinado para os dois lados. O valor é copiado
 * da publicação no instante do aceite e congelado.
 */
export async function aceitarOrcamento(
  _anterior: { ok?: boolean; erro?: string } | null,
  form: FormData,
): Promise<{ ok?: boolean; erro?: string }> {
  const token = String(form.get("token") ?? "");
  const nome = String(form.get("nome") ?? "").trim();

  if (!(await gateLiberado(token))) {
    return { erro: "Sessão expirada. Recarregue a página e entre de novo." };
  }
  if (nome.length < 3) {
    return { erro: "Escreva seu nome completo para registrar o aceite." };
  }

  const sb = supabaseAdmin();

  const { data: orcamento } = await sb
    .from("orc_orcamentos")
    .select("id, situacao")
    .eq("token", token)
    .maybeSingle();
  if (!orcamento) return { erro: "Orçamento não encontrado." };
  if (orcamento.situacao === "aprovado") return { ok: true };

  const { data: publicacao } = await sb
    .from("orc_publicacoes")
    .select("versao, dados")
    .eq("orcamento_id", orcamento.id)
    .order("versao", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!publicacao) return { erro: "Este orçamento não está mais disponível." };

  const dados = publicacao.dados as { total?: number } | null;
  const total = typeof dados?.total === "number" ? dados.total : null;
  const agora = new Date().toISOString();

  await sb
    .from("orc_orcamentos")
    .update({
      situacao: "aprovado",
      aprovado_em: agora,
      valor_aprovado: total,
      updated_at: agora,
    })
    .eq("id", orcamento.id);

  await sb.from("orc_eventos").insert({
    orcamento_id: orcamento.id,
    tipo: "aceito",
    detalhe: { por: "cliente", nome, versao: publicacao.versao, valor: total },
  });

  revalidatePath(`/p/${token}`);
  revalidatePath(`/admin/orcamentos/${orcamento.id}`);
  return { ok: true };
}
