"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/admin/sessao";
import { diaValido } from "@/lib/tempo";
import { lerApelido } from "./apelido";
import { listarPessoas, sugestoesDeOntem } from "./dados";
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
  registros?: number;
  propostas?: number;
};

/**
 * A IA organiza os registros do dia e **propõe** as linhas.
 *
 * Não escreve no relatório e não publica nada. As propostas ficam ao lado,
 * para serem aceitas ou descartadas uma a uma — e é isso que faz a última
 * regra da §5 do PRD ("preservar edições manuais até o usuário confirmar a
 * substituição") deixar de precisar de diálogo: **o que está escrito nunca é
 * tocado**, então não há o que confirmar.
 *
 * Gerar de novo troca as propostas, não os itens. Quem já aceitou continua
 * com o que aceitou.
 */
export async function gerarResumoDoDia(
  dia: string,
): Promise<SaidaDoResumoDoDia> {
  const diario = await meuDiario();
  if (!diario) return { ok: false, erro: "Diário não encontrado." };
  if (!diaValido(dia)) return { ok: false, erro: "Data inválida." };

  const sb = supabaseAdmin();

  const relatorioId = await garantirRelatorioDoDia(diario.id, dia);
  if (!relatorioId) return { ok: false, erro: "Falha ao abrir o dia." };

  const [elenco, emAberto] = await Promise.all([
    listarPessoas(diario.id),
    sugestoesDeOntem(diario.id, dia, relatorioId),
  ]);

  const saida = await gerarResumo(
    relatorioId,
    diario.autor_nome,
    elenco.map((p) => p.nome),
    emAberto,
  );
  if (!saida.ok) return { ok: false, erro: saida.erro };

  // Uma geração por vez: a proposta anterior morreu no instante em que
  // alguém pediu outra. O que já virou item não é tocado.
  await sb.from("dia_propostas").delete().eq("relatorio_id", relatorioId);

  /**
   * O que ficou em aberto e o material de hoje resolveu entra **com o texto
   * de ontem**, não com uma reescrita da IA.
   *
   * O texto já foi lido e aprovado uma vez; deixar o modelo redigi-lo de novo
   * é convite para ele mudar o sentido de uma pendência no meio do caminho. A
   * IA aqui decide o **lugar**, que é o que ela leu no registro de hoje.
   */
  const porId = new Map(emAberto.map((i) => [i.id, i]));

  const carregadas = saida.deOntem.flatMap((d) => {
    const origem = porId.get(d.id);
    if (!origem) return [];
    return [
      {
        secao: d.secao,
        texto: origem.texto,
        // Quem move para realizado fechou: cobrar de alguém o que já está
        // feito é ruído, igual ao "Concluí" do cartão de ontem.
        responsavel: d.secao === "realizado" ? null : origem.responsavel,
        sugestao_id: origem.id,
      },
    ];
  });

  const novas = [
    ...carregadas,
    ...saida.itens.map((item) => ({
      secao: item.secao,
      texto: item.texto,
      responsavel: item.responsavel,
      sugestao_id: null as string | null,
    })),
  ].map((p, i) => ({ relatorio_id: relatorioId, ...p, posicao: i + 1 }));

  if (novas.length > 0) {
    const { error } = await sb.from("dia_propostas").insert(novas);
    if (error) return { ok: false, erro: error.message };
  }

  await sb
    .from("dia_relatorios")
    .update({ resumo_em: new Date().toISOString() })
    .eq("id", relatorioId);

  revalidar();
  return { ok: true, registros: saida.registros, propostas: novas.length };
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
