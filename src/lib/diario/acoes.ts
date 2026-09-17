"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/admin/sessao";
import { diaValido } from "@/lib/tempo";
import { montarDia } from "./publicacao";
import { linhas } from "./tipos";
import type { Resultado } from "@/lib/admin/tipos";

/**
 * As ações do diário, todas do lado de dentro do painel.
 *
 * O que o leitor de fora faz está em `acoes-publico.ts` — e é uma coisa só,
 * digitar a senha.
 */

/** O diário de quem está logado. Toda ação passa por aqui antes de escrever. */
async function meuDiario(): Promise<{ id: string; token: string } | null> {
  const { orgId, id: usuarioId } = await exigirAdmin();

  const { data } = await supabaseAdmin()
    .from("dia_diarios")
    .select("id, token")
    .eq("org_id", orgId)
    .eq("autor_id", usuarioId)
    .maybeSingle();

  return data ?? null;
}

function revalidar(token?: string) {
  revalidatePath("/admin/diario");
  if (token) revalidatePath(`/d/${token}`);
}

/**
 * Grava o rascunho do dia.
 *
 * Não publica nada: o que o leitor vê continua sendo a última fotografia até
 * alguém apertar Publicar. É a exigência do PRD ("novos registros não alteram
 * automaticamente o conteúdo publicado") virando duas escritas separadas.
 */
export async function salvarDia(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const diario = await meuDiario();
  if (!diario) return { ok: false, erro: "Diário não encontrado." };

  const dia = String(form.get("dia") ?? "");
  if (!diaValido(dia)) return { ok: false, erro: "Data inválida." };

  const campos = {
    realizado: String(form.get("realizado") ?? "").trim() || null,
    em_andamento: String(form.get("emAndamento") ?? "").trim() || null,
    pendencias: String(form.get("pendencias") ?? "").trim() || null,
    proximos_passos: String(form.get("proximosPassos") ?? "").trim() || null,
  };

  const sb = supabaseAdmin();

  const { data: existente } = await sb
    .from("dia_relatorios")
    .select("id")
    .eq("diario_id", diario.id)
    .eq("dia", dia)
    .maybeSingle();

  const { error } = existente
    ? await sb
        .from("dia_relatorios")
        .update({ ...campos, updated_at: new Date().toISOString() })
        .eq("id", existente.id)
    : await sb.from("dia_relatorios").insert({ diario_id: diario.id, dia, ...campos });

  if (error) return { ok: false, erro: error.message };

  revalidar();
  return { ok: true };
}

/**
 * Publica o dia, ou publica a atualização dele.
 *
 * Duas travas antes de deixar sair, pelas mesmas razões do orçamento: dia em
 * branco vira página vazia no link de quem confia nele, e diário sem senha é
 * link aberto para quem receber encaminhado.
 */
export async function publicarDia(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const { id: usuarioId, orgId } = await exigirAdmin();

  const dia = String(form.get("dia") ?? "");
  if (!diaValido(dia)) return { ok: false, erro: "Data inválida." };

  const sb = supabaseAdmin();

  const { data: diario } = await sb
    .from("dia_diarios")
    .select("id, token, senha, autor_nome")
    .eq("org_id", orgId)
    .eq("autor_id", usuarioId)
    .maybeSingle();
  if (!diario) return { ok: false, erro: "Diário não encontrado." };

  if (!diario.senha) {
    return {
      ok: false,
      erro: "Defina uma senha em Acesso ao link: o endereço circula por WhatsApp e pode ser encaminhado.",
    };
  }

  const { data: relatorio } = await sb
    .from("dia_relatorios")
    .select("id, dia, realizado, em_andamento, pendencias, proximos_passos")
    .eq("diario_id", diario.id)
    .eq("dia", dia)
    .maybeSingle();

  if (!relatorio) return { ok: false, erro: "Escreva o dia antes de publicar." };

  const preenchido =
    linhas(relatorio.realizado).length +
    linhas(relatorio.em_andamento).length +
    linhas(relatorio.pendencias).length +
    linhas(relatorio.proximos_passos).length;

  if (preenchido === 0) {
    return { ok: false, erro: "Não há nada escrito neste dia para publicar." };
  }

  const { data: ultima } = await sb
    .from("dia_publicacoes")
    .select("versao")
    .eq("relatorio_id", relatorio.id)
    .order("versao", { ascending: false })
    .limit(1)
    .maybeSingle();

  const versao = (ultima?.versao ?? 0) + 1;

  const { error } = await sb.from("dia_publicacoes").insert({
    relatorio_id: relatorio.id,
    versao,
    dados: montarDia(relatorio, diario.autor_nome, versao),
    publicado_por: usuarioId,
  });

  if (error) return { ok: false, erro: error.message };

  revalidar(diario.token);
  return { ok: true, link: `/d/${diario.token}` };
}

/**
 * Tira o dia do link, preservando o rascunho.
 *
 * Apaga as publicações daquela data e só. O endereço continua o mesmo, os
 * outros dias continuam no ar, e o texto continua editável aqui dentro — que
 * é exatamente o que o PRD pede em "retirar uma publicação do link,
 * preservando o rascunho".
 */
export async function tirarDiaDoAr(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const diario = await meuDiario();
  if (!diario) return { ok: false, erro: "Diário não encontrado." };

  const dia = String(form.get("dia") ?? "");
  if (!diaValido(dia)) return { ok: false, erro: "Data inválida." };

  const sb = supabaseAdmin();

  const { data: relatorio } = await sb
    .from("dia_relatorios")
    .select("id")
    .eq("diario_id", diario.id)
    .eq("dia", dia)
    .maybeSingle();
  if (!relatorio) return { ok: false, erro: "Este dia não existe." };

  const { error } = await sb
    .from("dia_publicacoes")
    .delete()
    .eq("relatorio_id", relatorio.id);

  if (error) return { ok: false, erro: error.message };

  revalidar(diario.token);
  return { ok: true };
}

/** Título, nome de quem assina e senha do link. */
export async function salvarAjustes(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const diario = await meuDiario();
  if (!diario) return { ok: false, erro: "Diário não encontrado." };

  const titulo = String(form.get("titulo") ?? "").trim();
  const autorNome = String(form.get("autorNome") ?? "").trim();
  const senha = String(form.get("senha") ?? "").trim();

  // Senha de quatro caracteres é o mesmo que senha nenhuma num link que
  // circula por WhatsApp.
  if (senha && senha.length < 6) {
    return { ok: false, erro: "A senha precisa de ao menos 6 caracteres." };
  }

  const { error } = await supabaseAdmin()
    .from("dia_diarios")
    .update({
      titulo: titulo || null,
      autor_nome: autorNome || null,
      // Campo em branco apaga a senha, e sem senha a publicação trava. Deixar
      // "em branco não mexe" esconderia um jeito de nunca conseguir remover.
      senha: senha || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", diario.id);

  if (error) return { ok: false, erro: error.message };

  revalidar(diario.token);
  return { ok: true };
}

/**
 * Revogar **não** é tirar do ar.
 *
 * Tirar do ar devolve um dia ao rascunho e o endereço continua valendo.
 * Revogar troca o token, e com isso mata o link que já foi para o WhatsApp —
 * o oposto da promessa do endereço fixo. Existe para o caso de o link ter
 * vazado, e por isso a tela avisa antes.
 */
export async function revogarAcesso(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const diario = await meuDiario();
  if (!diario) return { ok: false, erro: "Diário não encontrado." };

  // A tela manda de volta o token que ela está mostrando. Se não for o
  // mesmo, alguém já revogou noutra aba, e girar o endereço de novo
  // derrubaria o link recém-enviado sem ninguém ter pedido.
  const mostrado = String(form.get("token") ?? "");
  if (mostrado !== diario.token) {
    return {
      ok: false,
      erro: "O endereço já foi trocado. Recarregue a página antes de revogar.",
    };
  }

  const antigo = diario.token;
  const sb = supabaseAdmin();

  // O token novo sai da mesma função que gera o da criação: o formato do
  // endereço não pode depender de quem o criou.
  const { data: novo, error: erroToken } = await sb.rpc("gerar_token");
  if (erroToken || !novo) {
    return { ok: false, erro: erroToken?.message ?? "Falha ao gerar o endereço." };
  }

  const { error } = await sb
    .from("dia_diarios")
    .update({ token: novo, updated_at: new Date().toISOString() })
    .eq("id", diario.id);

  if (error) return { ok: false, erro: error.message };

  // O endereço antigo passa a responder 404; revalidar tira do cache o que
  // ficou lá da última visita.
  revalidatePath(`/d/${antigo}`);
  revalidar(novo);
  return { ok: true, link: `/d/${novo}` };
}
