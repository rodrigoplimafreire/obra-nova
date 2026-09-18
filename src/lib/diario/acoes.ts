"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/admin/sessao";
import { diaValido } from "@/lib/tempo";
import { lerApelido } from "./apelido";
import { montarDia } from "./publicacao";
import { garantirRelatorioDoDia } from "./relatorio";
import { gerarResumo } from "./resumo";
import type { Resultado } from "@/lib/admin/tipos";

/**
 * As ações do diário, todas do lado de dentro do painel.
 *
 * O que o leitor de fora faz está em `acoes-publico.ts` — e é uma coisa só,
 * digitar a senha.
 */

/** O diário de quem está logado. Toda ação passa por aqui antes de escrever. */
async function meuDiario(): Promise<{
  id: string;
  token: string;
  autor_nome: string | null;
} | null> {
  const { orgId, id: usuarioId } = await exigirAdmin();

  const { data } = await supabaseAdmin()
    .from("dia_diarios")
    .select("id, token, autor_nome")
    .eq("org_id", orgId)
    .eq("autor_id", usuarioId)
    .maybeSingle();

  return data ?? null;
}

function revalidar(token?: string) {
  revalidatePath("/admin/diario");
  if (token) revalidatePath(`/d/${token}`);
}

export type SaidaDoResumoDoDia = Resultado & {
  /** A IA substituiria texto corrigido à mão. A tela pergunta antes. */
  precisaConfirmar?: boolean;
  registros?: number;
};

/**
 * A IA organiza os registros do dia nas quatro seções.
 *
 * **Não publica nada, e não atropela mão humana.** Cai no rascunho, para ser
 * lido antes; e se o texto que está lá foi editado depois do último resumo, a
 * primeira chamada volta pedindo confirmação em vez de sobrescrever. É a
 * última regra da §5 do PRD — "preservar edições manuais até o usuário
 * confirmar sua substituição" — e é a mesma disciplina do `editado_em` das
 * transcrições avulsas.
 */
export async function gerarResumoDoDia(
  dia: string,
  confirmado = false,
): Promise<SaidaDoResumoDoDia> {
  const diario = await meuDiario();
  if (!diario) return { ok: false, erro: "Diário não encontrado." };
  if (!diaValido(dia)) return { ok: false, erro: "Data inválida." };

  const sb = supabaseAdmin();

  const relatorioId = await garantirRelatorioDoDia(diario.id, dia);
  if (!relatorioId) return { ok: false, erro: "Falha ao abrir o dia." };

  const { data: relatorio } = await sb
    .from("dia_relatorios")
    .select("editado_em, resumo_em")
    .eq("id", relatorioId)
    .maybeSingle();

  const { count } = await sb
    .from("dia_itens")
    .select("id", { count: "exact", head: true })
    .eq("relatorio_id", relatorioId);

  const temTexto = (count ?? 0) > 0;

  const editadoDepois =
    Boolean(relatorio?.editado_em) &&
    (!relatorio?.resumo_em ||
      new Date(relatorio.editado_em as string).getTime() >
        new Date(relatorio.resumo_em).getTime());

  if (temTexto && editadoDepois && !confirmado) {
    return {
      ok: false,
      precisaConfirmar: true,
      erro: "O texto deste dia foi editado à mão. Gerar de novo substitui o que você escreveu.",
    };
  }

  const saida = await gerarResumo(relatorioId, diario.autor_nome);
  if (!saida.ok) return { ok: false, erro: saida.erro };

  const agora = new Date().toISOString();

  /**
   * O resumo **substitui** os itens do dia, não soma a eles.
   *
   * Somar duplicaria tudo a cada geração, e a pessoa passaria a limpar a
   * lista à mão — o oposto de uma tela menos digitável. Quem não quer perder
   * o que escreveu é avisado antes, pelo `precisaConfirmar` acima.
   */
  await sb.from("dia_itens").delete().eq("relatorio_id", relatorioId);

  const novos = saida.itens.map((item, i) => ({
    relatorio_id: relatorioId,
    secao: item.secao,
    texto: item.texto,
    responsavel: item.responsavel,
    posicao: i + 1,
    origem: "ia" as const,
  }));

  if (novos.length > 0) {
    const { error } = await sb.from("dia_itens").insert(novos);
    if (error) return { ok: false, erro: error.message };
  }

  await sb
    .from("dia_relatorios")
    .update({
      resumo_em: agora,
      // O texto passa a ser da IA de novo: a próxima geração não precisa
      // perguntar, a não ser que alguém mexa num item antes dela.
      editado_em: null,
      updated_at: agora,
    })
    .eq("id", relatorioId);

  revalidar();
  return { ok: true, registros: saida.registros };
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
    .select("id, dia")
    .eq("diario_id", diario.id)
    .eq("dia", dia)
    .maybeSingle();

  if (!relatorio) return { ok: false, erro: "Escreva o dia antes de publicar." };

  const { data: itens } = await sb
    .from("dia_itens")
    .select("id, secao, texto, responsavel, origem")
    .eq("relatorio_id", relatorio.id)
    .order("posicao")
    .order("created_at");

  if (!itens?.length) {
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
    dados: montarDia(relatorio.dia, itens, diario.autor_nome, versao),
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
  const apelidoBruto = String(form.get("apelido") ?? "").trim();

  // Senha de quatro caracteres é o mesmo que senha nenhuma num link que
  // circula por WhatsApp. E com endereço legível a senha passa a ser a única
  // barreira — `diario.rd.eng.br/rodrigo` se adivinha, `/d/<32 caracteres>`
  // não.
  if (senha && senha.length < 6) {
    return { ok: false, erro: "A senha precisa de ao menos 6 caracteres." };
  }

  let apelido: string | null = null;
  if (apelidoBruto) {
    const veredito = lerApelido(apelidoBruto);
    if (!veredito.ok) return { ok: false, erro: veredito.erro };
    apelido = veredito.apelido;
  }

  const { error } = await supabaseAdmin()
    .from("dia_diarios")
    .update({
      titulo: titulo || null,
      autor_nome: autorNome || null,
      apelido,
      // Campo em branco apaga a senha, e sem senha a publicação trava. Deixar
      // "em branco não mexe" esconderia um jeito de nunca conseguir remover.
      senha: senha || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", diario.id);

  // O apelido é único no banco inteiro: duas pessoas querendo `rodrigo` é
  // caso normal, não erro de programa, e merece frase em vez de código.
  if (error?.code === "23505") {
    return { ok: false, erro: `O endereço \`${apelido}\` já está em uso.` };
  }
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
    .update({
      token: novo,
      // **O apelido cai junto.** Revogar que deixasse `diario.rd.eng.br/rodrigo`
      // de pé não revogaria nada: o endereço bonito é o que de fato circula, e
      // é o mais fácil de adivinhar. Quem revoga escolhe um apelido novo
      // depois, de propósito.
      apelido: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", diario.id);

  if (error) return { ok: false, erro: error.message };

  // O endereço antigo passa a responder 404; revalidar tira do cache o que
  // ficou lá da última visita.
  revalidatePath(`/d/${antigo}`);
  revalidar(novo);
  return { ok: true, link: `/d/${novo}` };
}
