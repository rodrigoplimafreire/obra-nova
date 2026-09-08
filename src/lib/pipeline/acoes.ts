"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/admin/sessao";
import { lerNumero } from "@/lib/orcamento/formato";
import {
  ESTADOS,
  ETAPAS,
  ORIGENS,
  PORTES,
  TIPOS_DE_OBRA,
} from "./constantes";

/**
 * Escrita do pipeline.
 *
 * As duas regras de integridade — perdido exige motivo, fechado exige valor —
 * vivem no banco, em `check`. Aqui elas são repetidas só para a mensagem de
 * erro ser em português e chegar no formulário; a garantia é lá embaixo,
 * porque a tela não é o único caminho de escrita.
 */

type Saida = { ok: boolean; erro?: string; id?: string };

function texto(form: FormData, campo: string): string | null {
  const v = form.get(campo);
  if (typeof v !== "string") return null;
  const limpo = v.trim();
  return limpo === "" ? null : limpo;
}

function daLista<T extends string>(
  form: FormData,
  campo: string,
  lista: readonly T[],
): T | null {
  const v = texto(form, campo);
  return v && (lista as readonly string[]).includes(v) ? (v as T) : null;
}

/**
 * O cadastro rápido: quatro campos e acabou.
 *
 * A origem do lead é o único deles que não dá para recuperar depois — daqui a
 * uma semana ninguém lembra se o cliente veio de indicação ou do Instagram.
 * Os outros três existem porque sem eles o card no quadro não diz nada.
 */
export async function criarPedido(
  _anterior: Saida | null,
  form: FormData,
): Promise<Saida> {
  const { orgId } = await exigirAdmin();

  const cliente = texto(form, "cliente");
  if (!cliente) return { ok: false, erro: "O nome do cliente é obrigatório." };

  const { data, error } = await supabaseAdmin()
    .from("pipe_pedidos")
    .insert({
      org_id: orgId,
      cliente_nome: cliente,
      cliente_telefone: texto(form, "telefone"),
      tipo_obra: daLista(form, "tipoObra", TIPOS_DE_OBRA),
      bairro: texto(form, "bairro"),
      origem_lead: daLista(form, "origem", ORIGENS),
      porte: daLista(form, "porte", PORTES),
    })
    .select("id")
    .single();

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/admin/pipeline");
  return { ok: true, id: data.id };
}

/**
 * Muda o estado do pedido.
 *
 * O evento é gravado por trigger, não daqui: o lead time inteiro do PRD é
 * derivado de `pipe_eventos`, e um caminho de escrita que esquecesse de
 * registrar apagaria a medida sem ninguém perceber.
 */
export async function mudarEstado(
  id: string,
  estado: string,
  extra?: { motivoPerda?: string; valorFechado?: number | null },
): Promise<Saida> {
  const { orgId, id: usuarioId } = await exigirAdmin();

  const alvo = ESTADOS.find((e) => e === estado);
  if (!alvo) return { ok: false, erro: "Estado inválido." };

  if (alvo === "perdido" && !extra?.motivoPerda?.trim()) {
    return {
      ok: false,
      erro: "Um pedido perdido precisa de motivo — é o que ensina a não perder o próximo.",
    };
  }
  if (alvo === "fechado" && extra?.valorFechado == null) {
    return { ok: false, erro: "Um pedido fechado precisa do valor fechado." };
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const sb = supabaseAdmin();

  const { error } = await sb
    .from("pipe_pedidos")
    .update({
      status: alvo,
      ...(alvo === "perdido" ? { motivo_perda: extra!.motivoPerda!.trim() } : {}),
      ...(alvo === "fechado" ? { valor_fechado: extra!.valorFechado } : {}),
      // Datas de marco: preenchidas quando o estado passa por elas, sem
      // ninguém digitar. Só na primeira vez — reentrar num estado não reescreve
      // a data em que a coisa de fato aconteceu.
      ...(alvo === "estudo_entregue" ? { data_entrega_estudo: hoje } : {}),
      ...(alvo === "orcamento_enviado" ? { data_envio_orcamento: hoje } : {}),
    })
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) return { ok: false, erro: traduzir(error.message) };

  await assinarUltimoEvento(id, usuarioId);

  revalidatePath("/admin/pipeline");
  revalidatePath(`/admin/pipeline/${id}`);
  return { ok: true };
}

/**
 * O trigger grava o evento com `auth.uid()`, que é nulo quando a escrita vem
 * pela chave de serviço — que é como este app fala com o banco. Em vez de
 * abrir mão de saber quem mexeu, a ação assina o evento que acabou de nascer.
 */
async function assinarUltimoEvento(pedidoId: string, usuarioId: string) {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("pipe_eventos")
    .select("id")
    .eq("pedido_id", pedidoId)
    .is("changed_by", null)
    .order("changed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data) {
    await sb
      .from("pipe_eventos")
      .update({ changed_by: usuarioId })
      .eq("id", data.id);
  }
}

/** Os campos que se completa depois, na tela de detalhe. */
export async function salvarDetalhes(
  _anterior: Saida | null,
  form: FormData,
): Promise<Saida> {
  const { orgId } = await exigirAdmin();
  const id = texto(form, "id");
  if (!id) return { ok: false, erro: "Pedido não informado." };

  const cliente = texto(form, "cliente");
  if (!cliente) return { ok: false, erro: "O nome do cliente é obrigatório." };

  const { error } = await supabaseAdmin()
    .from("pipe_pedidos")
    .update({
      cliente_nome: cliente,
      cliente_telefone: texto(form, "telefone"),
      tipo_obra: daLista(form, "tipoObra", TIPOS_DE_OBRA),
      bairro: texto(form, "bairro"),
      origem_lead: daLista(form, "origem", ORIGENS),
      porte: daLista(form, "porte", PORTES),
      estudo_cobrado: form.get("estudoCobrado") === "on",
      estudo_valor: lerNumero(texto(form, "estudoValor")),
      estudo_abatido: form.get("estudoAbatido") === "on",
      valor_orcado: lerNumero(texto(form, "valorOrcado")),
      observacoes: texto(form, "observacoes"),
    })
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) return { ok: false, erro: traduzir(error.message) };

  revalidatePath("/admin/pipeline");
  revalidatePath(`/admin/pipeline/${id}`);
  return { ok: true };
}

export async function apagarPedido(id: string): Promise<Saida> {
  const { orgId } = await exigirAdmin();

  const { error } = await supabaseAdmin()
    .from("pipe_pedidos")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/admin/pipeline");
  return { ok: true };
}

/**
 * Lança esforço numa etapa.
 *
 * Várias entradas por etapa somam. Isso não é detalhe: um estudo feito em três
 * sessões não pode obrigar ninguém a somar de cabeça antes de registrar — e é
 * exatamente aí que a pessoa desiste de registrar.
 */
export async function lancarTempo(
  pedidoId: string,
  entrada: {
    etapa: string;
    minutos: number;
    km?: number | null;
    fonte?: "cronometro" | "manual";
    nota?: string | null;
  },
): Promise<Saida> {
  const { orgId, id: usuarioId } = await exigirAdmin();

  const etapa = ETAPAS.find((e) => e === entrada.etapa);
  if (!etapa) return { ok: false, erro: "Etapa inválida." };
  if (!Number.isFinite(entrada.minutos) || entrada.minutos <= 0) {
    return { ok: false, erro: "Informe quantos minutos, acima de zero." };
  }

  // O pedido precisa ser desta empreiteira. `pipe_tempos` tem org_id próprio, e
  // sem esta conferência daria para pendurar tempo no pedido de outra.
  const { data: pedido } = await supabaseAdmin()
    .from("pipe_pedidos")
    .select("id")
    .eq("id", pedidoId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!pedido) return { ok: false, erro: "Pedido não encontrado." };

  const { error } = await supabaseAdmin().from("pipe_tempos").insert({
    org_id: orgId,
    pedido_id: pedidoId,
    etapa,
    minutos: Math.round(entrada.minutos),
    km: entrada.etapa === "deslocamento" ? (entrada.km ?? null) : null,
    fonte: entrada.fonte ?? "manual",
    nota: entrada.nota ?? null,
    registrado_por: usuarioId,
  });

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/admin/pipeline/${pedidoId}`);
  revalidatePath("/admin/pipeline");
  return { ok: true };
}

export async function apagarTempo(id: string, pedidoId: string): Promise<Saida> {
  const { orgId } = await exigirAdmin();

  const { error } = await supabaseAdmin()
    .from("pipe_tempos")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/admin/pipeline/${pedidoId}`);
  return { ok: true };
}

/**
 * Cria o documento a partir do pedido — o outro lado do "nada de digitação
 * dupla" do PRD.
 *
 * O nome, o telefone e o bairro já foram digitados uma vez, na entrada do
 * funil. Reescrevê-los no formulário do orçamento é exatamente o atrito que
 * faz alguém parar de usar o pipeline e voltar para a planilha.
 *
 * O pedido também anda: quem está gerando o documento está produzindo o
 * orçamento, e é isso que o estado passa a dizer.
 */
export async function gerarOrcamentoDoPedido(pedidoId: string): Promise<Saida> {
  const { orgId } = await exigirAdmin();
  const sb = supabaseAdmin();

  const { data: pedido } = await sb
    .from("pipe_pedidos")
    .select("id, cliente_nome, cliente_telefone, bairro, orcamento_id, status")
    .eq("id", pedidoId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!pedido) return { ok: false, erro: "Pedido não encontrado." };
  if (pedido.orcamento_id) {
    return { ok: false, erro: "Este pedido já tem orçamento.", id: pedido.orcamento_id };
  }

  const { data: orcamento, error } = await sb
    .from("orc_orcamentos")
    .insert({
      org_id: orgId,
      cliente_nome: pedido.cliente_nome,
      cliente_contato: pedido.cliente_telefone,
      endereco: pedido.bairro,
    })
    .select("id")
    .single();

  if (error) return { ok: false, erro: error.message };

  const { error: erroVinculo } = await sb
    .from("pipe_pedidos")
    .update({
      orcamento_id: orcamento.id,
      // Só empurra quem ainda não chegou lá: um pedido já enviado não volta.
      ...(["novo_pedido", "em_estudo", "estudo_entregue"].includes(pedido.status)
        ? { status: "orcamento_em_producao" as const }
        : {}),
    })
    .eq("id", pedidoId);

  if (erroVinculo) {
    // Sem o vínculo o orçamento vira órfão e o pedido some do rastro — pior
    // que não ter criado.
    await sb.from("orc_orcamentos").delete().eq("id", orcamento.id);
    return { ok: false, erro: erroVinculo.message };
  }

  revalidatePath("/admin/pipeline");
  revalidatePath(`/admin/pipeline/${pedidoId}`);
  revalidatePath("/admin/orcamentos");
  return { ok: true, id: orcamento.id };
}

/**
 * As premissas comerciais: o orçamento típico, a conversão esperada e o peso
 * de cada porte.
 *
 * Grava tudo de uma vez porque os três só fazem sentido juntos — salvar o
 * orçamento padrão sem a conversão dá uma tela que mostra custo e não mostra
 * carga, e a pessoa fica sem saber o que ainda falta.
 */
export async function salvarPremissas(
  _anterior: Saida | null,
  form: FormData,
): Promise<Saida> {
  const { orgId } = await exigirAdmin();
  const sb = supabaseAdmin();

  const conversao = lerNumero(texto(form, "conversaoEstimada"));
  if (conversao !== null && (conversao <= 0 || conversao > 100)) {
    return { ok: false, erro: "A conversão vai de 1 a 100%." };
  }

  const pesos = { P: "cargaP", M: "cargaM", G: "cargaG" } as const;
  const multiplicador: Record<string, number> = {};
  for (const [porte, campo] of Object.entries(pesos)) {
    const v = lerNumero(texto(form, campo));
    if (v === null || v < 0 || v > 5) {
      return { ok: false, erro: `O peso do porte ${porte} vai de 0 a 5.` };
    }
    multiplicador[porte] = v;
  }

  const dias = Number(texto(form, "diasParaParado") ?? 5);
  if (!Number.isInteger(dias) || dias < 1 || dias > 60) {
    return { ok: false, erro: "Dias para sinalizar parado: entre 1 e 60." };
  }

  const { error } = await sb.from("org_ajustes").upsert(
    {
      org_id: orgId,
      dias_para_parado: dias,
      custo_hora: lerNumero(texto(form, "custoHora")),
      custo_km: lerNumero(texto(form, "custoKm")),
      conversao_estimada: conversao,
      carga_p: multiplicador.P,
      carga_m: multiplicador.M,
      carga_g: multiplicador.G,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id" },
  );
  if (error) return { ok: false, erro: error.message };

  // O padrão inteiro de uma vez: etapa que ficou em branco é zero, e zero é
  // uma resposta ("esta etapa não acontece"), não um campo por preencher.
  const linhas = ETAPAS.map((etapa) => ({
    org_id: orgId,
    etapa,
    minutos: Math.max(0, Math.round(lerNumero(texto(form, `min_${etapa}`)) ?? 0)),
    km: etapa === "deslocamento" ? lerNumero(texto(form, "padraoKm")) : null,
  }));

  const { error: erroPadrao } = await sb
    .from("org_orcamento_padrao")
    .upsert(linhas, { onConflict: "org_id,etapa" });
  if (erroPadrao) return { ok: false, erro: erroPadrao.message };

  revalidatePath("/admin/pipeline");
  revalidatePath("/admin/pipeline/analise");
  revalidatePath("/admin/pipeline/precificacao");
  return { ok: true };
}

/** As `check` do banco chegam em inglês e falando de constraint. */
function traduzir(mensagem: string): string {
  if (mensagem.includes("perdido_tem_motivo")) {
    return "Um pedido perdido precisa de motivo.";
  }
  if (mensagem.includes("fechado_tem_valor")) {
    return "Um pedido fechado precisa do valor fechado.";
  }
  return mensagem;
}
