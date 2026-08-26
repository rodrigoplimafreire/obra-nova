"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/admin/sessao";
import { carregarOrcamento } from "./dados";
import { montarDocumento } from "./publicacao";
import type { Resultado } from "@/lib/admin/tipos";
import type { Enums, TablesUpdate } from "@/lib/database.types";

/**
 * Publicar, despublicar e registrar o desfecho.
 *
 * Publicar é ato humano e é ato de congelamento: tira uma fotografia do
 * documento e guarda com número de versão. O rascunho continua editável
 * depois; o que o cliente vê só muda quando alguém publica de novo. É a mesma
 * disciplina do relatório da obra, pelo mesmo motivo — o que já saiu da porta
 * não pode mudar de conteúdo sem ninguém saber.
 *
 * O token mora no orçamento, não na publicação. Republicar não mata o link que
 * já foi para o WhatsApp do cliente.
 */

async function registrarEvento(
  orcamentoId: string,
  tipo:
    | "publicado"
    | "republicado"
    | "despublicado"
    | "aceito"
    | "recusado"
    | "aberto",
  detalhe?: Record<string, unknown>,
  usuarioId?: string | null,
) {
  await supabaseAdmin().from("orc_eventos").insert({
    orcamento_id: orcamentoId,
    tipo,
    usuario_id: usuarioId ?? null,
    detalhe: detalhe ?? null,
  });
}

export async function publicarOrcamento(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const { orgId, id: usuarioId } = await exigirAdmin();
  const id = String(form.get("id") ?? "");
  if (!id) return { ok: false, erro: "Orçamento inválido." };

  const orcamento = await carregarOrcamento(id);
  if (!orcamento) return { ok: false, erro: "Orçamento não encontrado." };

  // Duas travas antes de deixar sair. Item sem preço vira linha em branco no
  // documento do cliente, e orçamento sem senha é link aberto para quem
  // receber encaminhado.
  if (orcamento.itens.length === 0) {
    return { ok: false, erro: "Inclua ao menos um item antes de publicar." };
  }
  if (orcamento.valorFechado === null && orcamento.semPreco > 0) {
    return {
      ok: false,
      erro: `${orcamento.semPreco} ${orcamento.semPreco === 1 ? "item está" : "itens estão"} sem preço de venda. Preencha antes de enviar ao cliente.`,
    };
  }
  if (!orcamento.senha) {
    return {
      ok: false,
      erro: "Defina uma senha em Dados do orçamento: o link circula por WhatsApp e pode ser encaminhado.",
    };
  }

  const sb = supabaseAdmin();
  const versao = (orcamento.versaoPublicada ?? 0) + 1;

  // `montarDocumento` é quem deixa o custo para trás. Ver publicacao.ts.
  const dados = montarDocumento(orcamento, versao);

  const { error } = await sb.from("orc_publicacoes").insert({
    orcamento_id: id,
    versao,
    dados,
    publicado_por: usuarioId,
  });
  if (error) return { ok: false, erro: error.message };

  // Republicar não rebaixa uma conversa que já andou: quem estava em
  // negociação continua em negociação, quem foi aprovado continua aprovado.
  const recomeca =
    orcamento.situacao === "rascunho" || orcamento.situacao === "expirado";

  const atualizacao: TablesUpdate<"orc_orcamentos"> = {
    status: "publicado",
    updated_at: new Date().toISOString(),
    ...(recomeca ? { situacao: "enviado" as const } : {}),
  };

  await sb.from("orc_orcamentos").update(atualizacao).eq("id", id).eq("org_id", orgId);

  await registrarEvento(
    id,
    versao === 1 ? "publicado" : "republicado",
    { versao, total: dados.total },
    usuarioId,
  );

  revalidatePath(`/admin/orcamentos/${id}`);
  revalidatePath("/admin/orcamentos");
  return { ok: true, link: `/p/${orcamento.token}` };
}

/** Tira o link do ar. O endereço continua o mesmo se publicar de novo. */
export async function despublicarOrcamento(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const { orgId, id: usuarioId } = await exigirAdmin();
  const id = String(form.get("id") ?? "");
  if (!id) return { ok: false, erro: "Orçamento inválido." };

  const sb = supabaseAdmin();

  // Apaga as publicações: sem fotografia, a página do cliente responde 404
  // igual a token inexistente. O rascunho fica intacto.
  const { error } = await sb.from("orc_publicacoes").delete().eq("orcamento_id", id);
  if (error) return { ok: false, erro: error.message };

  await sb
    .from("orc_orcamentos")
    .update({ status: "conferindo", situacao: "rascunho" })
    .eq("id", id)
    .eq("org_id", orgId);

  await registrarEvento(id, "despublicado", undefined, usuarioId);

  revalidatePath(`/admin/orcamentos/${id}`);
  revalidatePath("/admin/orcamentos");
  return { ok: true };
}

/**
 * Registra o desfecho no painel.
 *
 * Existe para o caso de o cliente responder por fora — telefone, WhatsApp,
 * conversa na obra. O caminho preferido é o aceite na própria página, que
 * nasce do lado de fora e não depende de ninguém lembrar de marcar.
 */
export async function marcarSituacao(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const { orgId, id: usuarioId } = await exigirAdmin();
  const id = String(form.get("id") ?? "");
  const situacao = String(form.get("situacao") ?? "");
  const motivo = String(form.get("motivo") ?? "").trim() || null;

  // Só o desfecho comercial é editável à mão. `rascunho` e `visto` ficam de
  // fora: o primeiro é estado de origem, o segundo é medido por nós — deixar
  // marcar "visto" na mão transformaria um fato em opinião.
  const permitidas: Enums<"orc_situacao">[] = [
    "enviado",
    "negociando",
    "aprovado",
    "recusado",
    "expirado",
  ];
  const alvo = permitidas.find((s) => s === situacao);
  if (!id || !alvo) return { ok: false, erro: "Situação inválida." };

  const orcamento = await carregarOrcamento(id);
  if (!orcamento) return { ok: false, erro: "Orçamento não encontrado." };

  const agora = new Date().toISOString();
  const campos: TablesUpdate<"orc_orcamentos"> = {
    situacao: alvo,
    updated_at: agora,
    // Congela o valor do aceite. O rascunho continua editável depois, e a base
    // de qualquer cálculo de comissão não pode mudar retroativamente.
    ...(alvo === "aprovado"
      ? {
          aprovado_em: agora,
          valor_aprovado: orcamento.total,
          recusado_em: null,
          motivo_recusa: null,
        }
      : {}),
    ...(alvo === "recusado"
      ? {
          recusado_em: agora,
          motivo_recusa: motivo,
          aprovado_em: null,
          valor_aprovado: null,
        }
      : {}),
  };

  const { error } = await supabaseAdmin()
    .from("orc_orcamentos")
    .update(campos)
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) return { ok: false, erro: error.message };

  if (alvo === "aprovado" || alvo === "recusado") {
    await registrarEvento(
      id,
      alvo === "aprovado" ? "aceito" : "recusado",
      {
        por: "painel",
        valor: alvo === "aprovado" ? orcamento.total : null,
        motivo,
      },
      usuarioId,
    );
  }

  revalidatePath(`/admin/orcamentos/${id}`);
  revalidatePath("/admin/orcamentos");
  return { ok: true };
}
