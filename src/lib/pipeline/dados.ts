import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { orgAtual } from "@/lib/admin/sessao";
import { ETAPAS } from "./constantes";
import type {
  AjustesDaOrg,
  Estado,
  Etapa,
  Origem,
  PedidoCompleto,
  PedidoNoQuadro,
  Porte,
  TipoDeObra,
} from "./constantes";
import { calcularCarga } from "./precificacao";
import type { Carga, PadraoDaEtapa } from "./precificacao";

/**
 * Leitura do pipeline de pedidos de orçamento.
 *
 * O PRD separa dois tempos que não podem ser confundidos:
 *
 * - **Lead time** é tempo de calendário entre estados. Sai de graça de
 *   `pipe_eventos`, sem ninguém digitar nada.
 * - **Esforço** é minuto de trabalho humano. Esse custa disciplina, e por isso
 *   precisa ser barato de registrar.
 *
 * Aqui só se lê. O que soma esforço, calcula custo e decide se um pedido está
 * parado é a visão `pipe_pedidos_resumo`, no banco — para a regra ser a mesma
 * na tela, no relatório e em qualquer script.
 *
 * O vocabulário (estados, etapas, rótulos, tipos) mora em `constantes.ts`, que
 * a tela também importa. Este módulo é `server-only`.
 */

export * from "./constantes";

type LinhaDaVisao = {
  id: string;
  codigo: number;
  cliente_nome: string;
  cliente_telefone: string | null;
  tipo_obra: TipoDeObra | null;
  bairro: string | null;
  origem_lead: Origem | null;
  porte: Porte | null;
  status: Estado;
  data_pedido: string;
  valor_orcado: number | null;
  valor_fechado: number | null;
  motivo_perda: string | null;
  orcamento_id: string | null;
  total_minutos: number;
  km_total: number;
  etapas_registradas: number | null;
  custo_estimado: number | null;
  ultimo_evento_em: string | null;
  parado: boolean;
};

function paraPedido(l: LinhaDaVisao): PedidoNoQuadro {
  return {
    id: l.id,
    codigo: l.codigo,
    cliente: l.cliente_nome,
    telefone: l.cliente_telefone,
    tipoObra: l.tipo_obra,
    bairro: l.bairro,
    origem: l.origem_lead,
    porte: l.porte,
    status: l.status,
    dataPedido: l.data_pedido,
    valorOrcado: l.valor_orcado === null ? null : Number(l.valor_orcado),
    valorFechado: l.valor_fechado === null ? null : Number(l.valor_fechado),
    motivoPerda: l.motivo_perda,
    orcamentoId: l.orcamento_id,
    totalMinutos: Number(l.total_minutos ?? 0),
    kmTotal: Number(l.km_total ?? 0),
    etapasRegistradas: Number(l.etapas_registradas ?? 0),
    custoEstimado: l.custo_estimado === null ? null : Number(l.custo_estimado),
    ultimoEventoEm: l.ultimo_evento_em,
    parado: l.parado === true,
  };
}

export async function listarPedidos(): Promise<PedidoNoQuadro[]> {
  const sb = supabaseAdmin();
  const org = await orgAtual();

  const { data } = await sb
    .from("pipe_pedidos_resumo")
    .select("*")
    .eq("org_id", org)
    .order("codigo", { ascending: false });

  return ((data ?? []) as LinhaDaVisao[]).map(paraPedido);
}




export async function carregarPedido(id: string): Promise<PedidoCompleto | null> {
  const sb = supabaseAdmin();
  const org = await orgAtual();

  const { data: linha } = await sb
    .from("pipe_pedidos_resumo")
    .select("*")
    .eq("id", id)
    .eq("org_id", org)
    .maybeSingle();
  if (!linha) return null;

  const l = linha as LinhaDaVisao & {
    estudo_cobrado: boolean;
    estudo_valor: number | null;
    estudo_abatido: boolean;
    data_entrega_estudo: string | null;
    data_envio_orcamento: string | null;
    observacoes: string | null;
    custo_hora: number | null;
    custo_km: number | null;
  };

  const [{ data: eventos }, { data: tempos }, orcamento] = await Promise.all([
    sb
      .from("pipe_eventos")
      .select("id, status_anterior, status_novo, changed_at")
      .eq("pedido_id", id)
      .order("changed_at", { ascending: false }),
    sb
      .from("pipe_tempos")
      .select("id, etapa, minutos, km, fonte, nota, data")
      .eq("pedido_id", id)
      .order("data", { ascending: false })
      .order("created_at", { ascending: false }),
    l.orcamento_id
      ? sb
          .from("orc_orcamentos")
          .select("cliente_nome")
          .eq("id", l.orcamento_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    ...paraPedido(l),
    estudoCobrado: l.estudo_cobrado,
    estudoValor: l.estudo_valor === null ? null : Number(l.estudo_valor),
    estudoAbatido: l.estudo_abatido,
    dataEntregaEstudo: l.data_entrega_estudo,
    dataEnvioOrcamento: l.data_envio_orcamento,
    observacoes: l.observacoes,
    orcamentoCliente: orcamento.data?.cliente_nome ?? null,
    custoHora: l.custo_hora === null ? null : Number(l.custo_hora),
    custoKm: l.custo_km === null ? null : Number(l.custo_km),
    eventos: (eventos ?? []).map((e) => ({
      id: e.id,
      anterior: e.status_anterior as Estado | null,
      novo: e.status_novo as Estado,
      em: e.changed_at,
    })),
    tempos: (tempos ?? []).map((t) => ({
      id: t.id,
      etapa: t.etapa as Etapa,
      minutos: t.minutos,
      km: t.km === null ? null : Number(t.km),
      fonte: t.fonte as "cronometro" | "manual",
      nota: t.nota,
      data: t.data,
    })),
  };
}


export async function ajustesDaOrg(): Promise<AjustesDaOrg> {
  const sb = supabaseAdmin();
  const org = await orgAtual();

  const { data } = await sb
    .from("org_ajustes")
    .select("custo_hora, custo_km, dias_para_parado")
    .eq("org_id", org)
    .maybeSingle();

  return {
    custoHora: data?.custo_hora == null ? null : Number(data.custo_hora),
    custoKm: data?.custo_km == null ? null : Number(data.custo_km),
    diasParaParado: data?.dias_para_parado ?? 5,
  };
}

export type PremissasComerciais = {
  custoHora: number | null;
  custoKm: number | null;
  diasParaParado: number;
  conversaoEstimada: number | null;
  multiplicador: Record<Porte, number>;
  /** O orçamento típico, uma linha por etapa. Sempre as seis, em ordem. */
  padrao: PadraoDaEtapa[];
};

/**
 * As premissas comerciais da empreiteira.
 *
 * O padrão volta com as seis etapas mesmo quando nada foi gravado — a tela é
 * um formulário fixo, e fazer o componente inventar as linhas que faltam
 * espalharia a lista de etapas por dois lugares.
 */
export async function premissasComerciais(): Promise<PremissasComerciais> {
  const sb = supabaseAdmin();
  const org = await orgAtual();

  const [{ data: ajustes }, { data: padrao }] = await Promise.all([
    sb
      .from("org_ajustes")
      .select(
        "custo_hora, custo_km, dias_para_parado, conversao_estimada, carga_p, carga_m, carga_g",
      )
      .eq("org_id", org)
      .maybeSingle(),
    sb
      .from("org_orcamento_padrao")
      .select("etapa, minutos, km")
      .eq("org_id", org),
  ]);

  const porEtapa = new Map(
    (padrao ?? []).map((p) => [p.etapa as Etapa, p]),
  );

  return {
    custoHora: ajustes?.custo_hora == null ? null : Number(ajustes.custo_hora),
    custoKm: ajustes?.custo_km == null ? null : Number(ajustes.custo_km),
    diasParaParado: ajustes?.dias_para_parado ?? 5,
    conversaoEstimada:
      ajustes?.conversao_estimada == null
        ? null
        : Number(ajustes.conversao_estimada),
    multiplicador: {
      P: Number(ajustes?.carga_p ?? 0.5),
      M: Number(ajustes?.carga_m ?? 1),
      G: Number(ajustes?.carga_g ?? 1.6),
    },
    padrao: ETAPAS.map((etapa) => ({
      etapa,
      minutos: porEtapa.get(etapa)?.minutos ?? 0,
      km: porEtapa.get(etapa)?.km == null ? null : Number(porEtapa.get(etapa)!.km),
    })),
  };
}

/** Premissas e pedidos juntos: é o par que a carga precisa. */
export async function carregarPrecificacao(): Promise<{
  premissas: PremissasComerciais;
  carga: Carga;
}> {
  const [premissas, pedidos] = await Promise.all([
    premissasComerciais(),
    listarPedidos(),
  ]);

  return {
    premissas,
    carga: calcularCarga({ ...premissas, pedidos }),
  };
}

/**
 * A carga comercial de um orçamento, pelo porte do pedido que o originou.
 *
 * Nulo quando o documento não veio do pipeline: sem pedido não há porte, e sem
 * porte a carga viraria um número genérico aparecendo numa tela onde ninguém
 * pediu. Nulo também enquanto faltar premissa — a tela de Precificação é quem
 * explica o que falta, não esta.
 */
export async function cargaDoOrcamento(
  orcamentoId: string,
): Promise<number | null> {
  const sb = supabaseAdmin();
  const org = await orgAtual();

  const { data: pedido } = await sb
    .from("pipe_pedidos")
    .select("porte")
    .eq("orcamento_id", orcamentoId)
    .eq("org_id", org)
    .maybeSingle();

  if (!pedido) return null;

  const { carga } = await carregarPrecificacao();
  return carga.porPorte?.[pedido.porte ?? "M"] ?? null;
}
