"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/admin/sessao";
import { lerNumero } from "@/lib/orcamento/formato";
import type { Resultado } from "@/lib/admin/tipos";

/**
 * O que a visita grava.
 *
 * **Tudo salva na hora, campo a campo.** Não há botão "salvar a vistoria": o
 * PRD pede autosave, e numa obra o motivo é concreto — a aba morre, o celular
 * trava, alguém liga. O que já foi digitado não pode depender de lembrar de
 * salvar antes de sair.
 *
 * Isto **não** resolve falta de sinal (decisão D2 do `PRD-VISTORIA.md`, ainda
 * em aberto): sem rede, o gravar falha e a tela avisa. Offline de verdade é
 * fila local e resolução de conflito, e muda a arquitetura.
 */

async function vistoriaDaOrg(vistoriaId: string): Promise<boolean> {
  const { orgId } = await exigirAdmin();
  const { data } = await supabaseAdmin()
    .from("vist_vistorias")
    .select("id")
    .eq("id", vistoriaId)
    .eq("org_id", orgId)
    .maybeSingle();
  return Boolean(data);
}

/** O ambiente pertence a uma vistoria desta org? */
async function ambienteDaOrg(ambienteId: string): Promise<string | null> {
  const { orgId } = await exigirAdmin();
  const sb = supabaseAdmin();

  const { data: ambiente } = await sb
    .from("vist_ambientes")
    .select("id, vistoria_id")
    .eq("id", ambienteId)
    .maybeSingle();
  if (!ambiente) return null;

  const { data: vistoria } = await sb
    .from("vist_vistorias")
    .select("id")
    .eq("id", ambiente.vistoria_id)
    .eq("org_id", orgId)
    .maybeSingle();

  return vistoria ? ambiente.vistoria_id : null;
}

function revalidar(vistoriaId: string) {
  revalidatePath(`/admin/vistorias/${vistoriaId}`);
  revalidatePath("/admin/vistorias");
}

/** Campo em branco volta a `null`, não a string vazia: apagar é uma decisão. */
function ouNulo(form: FormData, campo: string): string | null {
  const valor = String(form.get(campo) ?? "").trim();
  return valor.length > 0 ? valor : null;
}

/**
 * A próxima posição, a partir do maior já usado.
 *
 * Não da contagem: apagar uma linha do meio deixaria buraco, a contagem
 * repetiria uma posição viva e a chave única barraria a inserção. Foi
 * exatamente o que mordeu em `orc_itens`.
 */
async function proximaPosicaoDeAmbiente(vistoriaId: string): Promise<number> {
  const { data } = await supabaseAdmin()
    .from("vist_ambientes")
    .select("position")
    .eq("vistoria_id", vistoriaId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.position ?? 0) + 1;
}

async function proximaPosicaoDeMedicao(ambienteId: string): Promise<number> {
  const { data } = await supabaseAdmin()
    .from("vist_medicoes")
    .select("position")
    .eq("ambiente_id", ambienteId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.position ?? 0) + 1;
}

/* --------------------------------------------------------------- vistoria */

export async function criarVistoria(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const { orgId, id: usuarioId } = await exigirAdmin();

  const cliente = String(form.get("cliente") ?? "").trim();
  if (cliente.length < 2) {
    return { ok: false, erro: "Escreva para quem é a visita." };
  }

  const pedidoId = ouNulo(form, "pedidoId");
  const data = ouNulo(form, "dataVisita");

  const { data: criada, error } = await supabaseAdmin()
    .from("vist_vistorias")
    .insert({
      org_id: orgId,
      pedido_id: pedidoId,
      cliente_nome: cliente,
      endereco: ouNulo(form, "endereco"),
      // Sem data digitada, é hoje: a visita é agora, e pedir a data de novo
      // em pé no canteiro é o tipo de campo que faz a ferramenta ser
      // abandonada.
      ...(data ? { data_visita: data } : {}),
      criado_por: usuarioId,
    })
    .select("id")
    .maybeSingle();

  if (error || !criada) {
    return { ok: false, erro: error?.message ?? "Não consegui criar a visita." };
  }

  revalidatePath("/admin/vistorias");
  redirect(`/admin/vistorias/${criada.id}`);
}

export async function salvarDadosDaVistoria(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const id = String(form.get("id") ?? "");
  if (!(await vistoriaDaOrg(id))) {
    return { ok: false, erro: "Vistoria inválida." };
  }

  const cliente = String(form.get("cliente") ?? "").trim();
  if (cliente.length < 2) {
    return { ok: false, erro: "Escreva para quem é a visita." };
  }

  const { error } = await supabaseAdmin()
    .from("vist_vistorias")
    .update({
      cliente_nome: cliente,
      endereco: ouNulo(form, "endereco"),
      observacoes: ouNulo(form, "observacoes"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false, erro: error.message };

  revalidar(id);
  return { ok: true };
}

/**
 * Concluir é reversível, e de propósito.
 *
 * Marca que o levantamento acabou, para a lista separar o que está em campo
 * do que já pode virar orçamento. Não trava a edição: obra tem o detalhe que
 * só aparece no dia seguinte, e uma vistoria congelada obrigaria a refazer.
 */
export async function alternarConclusao(id: string): Promise<Resultado> {
  if (!(await vistoriaDaOrg(id))) {
    return { ok: false, erro: "Vistoria inválida." };
  }
  const sb = supabaseAdmin();

  const { data: atual } = await sb
    .from("vist_vistorias")
    .select("concluida_em")
    .eq("id", id)
    .maybeSingle();

  const { error } = await sb
    .from("vist_vistorias")
    .update({
      concluida_em: atual?.concluida_em ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false, erro: error.message };

  revalidar(id);
  return { ok: true };
}

export async function apagarVistoria(id: string): Promise<Resultado> {
  if (!(await vistoriaDaOrg(id))) {
    return { ok: false, erro: "Vistoria inválida." };
  }
  const { error } = await supabaseAdmin()
    .from("vist_vistorias")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/admin/vistorias");
  redirect("/admin/vistorias");
}

/* -------------------------------------------------------------- ambientes */

export async function adicionarAmbiente(
  vistoriaId: string,
  nome: string,
): Promise<Resultado> {
  if (!(await vistoriaDaOrg(vistoriaId))) {
    return { ok: false, erro: "Vistoria inválida." };
  }
  const limpo = nome.trim();
  if (limpo.length < 2) return { ok: false, erro: "Escreva o nome do ambiente." };

  const { error } = await supabaseAdmin().from("vist_ambientes").insert({
    vistoria_id: vistoriaId,
    position: await proximaPosicaoDeAmbiente(vistoriaId),
    nome: limpo,
  });
  if (error) return { ok: false, erro: error.message };

  revalidar(vistoriaId);
  return { ok: true };
}

export async function salvarAmbiente(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const id = String(form.get("id") ?? "");
  const vistoriaId = await ambienteDaOrg(id);
  if (!vistoriaId) return { ok: false, erro: "Ambiente inválido." };

  const nome = String(form.get("nome") ?? "").trim();
  if (nome.length < 2) return { ok: false, erro: "Escreva o nome do ambiente." };

  const { error } = await supabaseAdmin()
    .from("vist_ambientes")
    .update({ nome, observacao: ouNulo(form, "observacao") })
    .eq("id", id);
  if (error) return { ok: false, erro: error.message };

  revalidar(vistoriaId);
  return { ok: true };
}

export async function removerAmbiente(id: string): Promise<Resultado> {
  const vistoriaId = await ambienteDaOrg(id);
  if (!vistoriaId) return { ok: false, erro: "Ambiente inválido." };

  const { error } = await supabaseAdmin()
    .from("vist_ambientes")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, erro: error.message };

  revalidar(vistoriaId);
  return { ok: true };
}

/* --------------------------------------------------------------- medições */

export async function salvarMedicao(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const ambienteId = String(form.get("ambienteId") ?? "");
  const vistoriaId = await ambienteDaOrg(ambienteId);
  if (!vistoriaId) return { ok: false, erro: "Ambiente inválido." };

  const servico = String(form.get("servico") ?? "").trim();
  if (servico.length < 2) {
    return { ok: false, erro: "Escolha ou escreva o serviço." };
  }

  const numero = (campo: string) => lerNumero(String(form.get(campo) ?? ""));
  const negativo = (v: number | null) => v !== null && v < 0;

  const campos = {
    servico,
    comprimento: numero("comprimento"),
    largura: numero("largura"),
    altura: numero("altura"),
    quantidade: numero("quantidade"),
    unidade: ouNulo(form, "unidade"),
    observacao: ouNulo(form, "observacao"),
  };

  if (
    negativo(campos.comprimento) ||
    negativo(campos.largura) ||
    negativo(campos.altura) ||
    negativo(campos.quantidade)
  ) {
    return { ok: false, erro: "Medida não pode ser negativa." };
  }

  const sb = supabaseAdmin();
  const id = String(form.get("id") ?? "");

  const { error } = id
    ? await sb.from("vist_medicoes").update(campos).eq("id", id)
    : await sb.from("vist_medicoes").insert({
        ambiente_id: ambienteId,
        position: await proximaPosicaoDeMedicao(ambienteId),
        ...campos,
      });

  if (error) return { ok: false, erro: error.message };

  revalidar(vistoriaId);
  return { ok: true };
}

export async function removerMedicao(
  ambienteId: string,
  id: string,
): Promise<Resultado> {
  const vistoriaId = await ambienteDaOrg(ambienteId);
  if (!vistoriaId) return { ok: false, erro: "Ambiente inválido." };

  const { error } = await supabaseAdmin()
    .from("vist_medicoes")
    .delete()
    .eq("id", id)
    .eq("ambiente_id", ambienteId);
  if (error) return { ok: false, erro: error.message };

  revalidar(vistoriaId);
  return { ok: true };
}
