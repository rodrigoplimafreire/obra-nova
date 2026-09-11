import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { orgAtual } from "@/lib/admin/sessao";
import type {
  Ambiente,
  Medicao,
  VistoriaCompleta,
  VistoriaNaLista,
} from "./constantes";

/**
 * A leitura da vistoria.
 *
 * Filtra por `org_id` na mão mesmo com RLS ligada, pela mesma razão do resto
 * do painel: aqui se usa a service key, que passa por cima da política. A RLS
 * é a rede de baixo, não a porta.
 *
 * **Consultas separadas em vez de `select` aninhado.** O `database.types.ts`
 * é mantido à mão e não carrega os metadados de relação que o PostgREST
 * embutido exige para tipar — mesma escolha de `carregarOrcamento`. Custa uma
 * ida a mais ao banco e evita um `as unknown as` em cima de dado de cliente.
 */

export async function listarVistorias(): Promise<VistoriaNaLista[]> {
  const sb = supabaseAdmin();
  const org = await orgAtual();

  const { data: vistorias } = await sb
    .from("vist_vistorias")
    .select("id, cliente_nome, endereco, data_visita, concluida_em, orcamento_id")
    .eq("org_id", org)
    .order("data_visita", { ascending: false })
    .order("created_at", { ascending: false });

  if (!vistorias?.length) return [];

  const ids = vistorias.map((v) => v.id);
  const { data: ambientes } = await sb
    .from("vist_ambientes")
    .select("id, vistoria_id")
    .in("vistoria_id", ids);

  const { data: medicoes } = (ambientes ?? []).length
    ? await sb
        .from("vist_medicoes")
        .select("ambiente_id")
        .in("ambiente_id", (ambientes ?? []).map((a) => a.id))
    : { data: [] };

  const porAmbiente = new Map<string, number>();
  for (const m of medicoes ?? []) {
    porAmbiente.set(m.ambiente_id, (porAmbiente.get(m.ambiente_id) ?? 0) + 1);
  }

  const contagem = new Map<string, { ambientes: number; medicoes: number }>();
  for (const a of ambientes ?? []) {
    const atual = contagem.get(a.vistoria_id) ?? { ambientes: 0, medicoes: 0 };
    atual.ambientes += 1;
    atual.medicoes += porAmbiente.get(a.id) ?? 0;
    contagem.set(a.vistoria_id, atual);
  }

  return vistorias.map((v) => ({
    id: v.id,
    cliente: v.cliente_nome,
    endereco: v.endereco,
    dataVisita: v.data_visita,
    concluidaEm: v.concluida_em,
    orcamentoId: v.orcamento_id,
    ambientes: contagem.get(v.id)?.ambientes ?? 0,
    medicoes: contagem.get(v.id)?.medicoes ?? 0,
  }));
}

export async function carregarVistoria(
  id: string,
): Promise<VistoriaCompleta | null> {
  const sb = supabaseAdmin();
  const org = await orgAtual();

  const { data: v } = await sb
    .from("vist_vistorias")
    .select("*")
    .eq("id", id)
    .eq("org_id", org)
    .maybeSingle();

  // Vistoria de outra org responde igual a id inexistente, sem dizer qual dos
  // dois é. Mesma disciplina de `carregarOrcamento`.
  if (!v) return null;

  const { data: ambientes } = await sb
    .from("vist_ambientes")
    .select("id, position, nome, observacao")
    .eq("vistoria_id", id)
    .order("position");

  const { data: medicoes } = (ambientes ?? []).length
    ? await sb
        .from("vist_medicoes")
        .select(
          "id, ambiente_id, position, servico, comprimento, largura, altura, quantidade, unidade, observacao",
        )
        .in("ambiente_id", (ambientes ?? []).map((a) => a.id))
        .order("position")
    : { data: [] };

  const porAmbiente = new Map<string, Medicao[]>();
  for (const m of medicoes ?? []) {
    const lista = porAmbiente.get(m.ambiente_id) ?? [];
    lista.push({
      id: m.id,
      position: m.position,
      servico: m.servico,
      comprimento: m.comprimento,
      largura: m.largura,
      altura: m.altura,
      quantidade: m.quantidade,
      unidade: m.unidade,
      observacao: m.observacao,
    });
    porAmbiente.set(m.ambiente_id, lista);
  }

  const { data: pedido } = v.pedido_id
    ? await sb
        .from("pipe_pedidos")
        .select("cliente_nome")
        .eq("id", v.pedido_id)
        .maybeSingle()
    : { data: null };

  return {
    id: v.id,
    pedidoId: v.pedido_id,
    pedidoCliente: pedido?.cliente_nome ?? null,
    orcamentoId: v.orcamento_id,
    cliente: v.cliente_nome,
    endereco: v.endereco,
    dataVisita: v.data_visita,
    observacoes: v.observacoes,
    concluidaEm: v.concluida_em,
    criadoEm: v.created_at,
    ambientes: (ambientes ?? []).map(
      (a): Ambiente => ({
        id: a.id,
        position: a.position,
        nome: a.nome,
        observacao: a.observacao,
        medicoes: porAmbiente.get(a.id) ?? [],
      }),
    ),
  };
}

/** Pedidos do pipeline que ainda podem receber uma vistoria. */
export async function pedidosParaVistoria(): Promise<
  { id: string; rotulo: string }[]
> {
  const sb = supabaseAdmin();
  const org = await orgAtual();

  const { data } = await sb
    .from("pipe_pedidos")
    .select("id, codigo, cliente_nome, status")
    .eq("org_id", org)
    .in("status", ["novo_pedido", "em_estudo", "orcamento_em_producao"])
    .order("codigo", { ascending: false });

  return (data ?? []).map((p) => ({
    id: p.id,
    rotulo: `#${p.codigo} · ${p.cliente_nome}`,
  }));
}
