import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { orgAtual } from "@/lib/admin/sessao";
import type { Enums } from "@/lib/database.types";

/**
 * Leitura dos orçamentos para o painel.
 *
 * Duas contas aparecem em toda tela e valem por si:
 *
 * - **total** é a soma dos itens vivos, ou o `valor_fechado` quando existe
 *   (caso do orçamento de preço único, sem valor por item).
 * - **semPreco** é quantos itens estão com `valor_unitario` nulo. Não é
 *   detalhe de implementação: é a lista de tarefas do humano antes de publicar.
 *   Enquanto for maior que zero, o documento está incompleto e a tela precisa
 *   dizer isso.
 */

export type StatusDoOrcamento = Enums<"orc_status">;
/** Eixo comercial: onde a conversa com o cliente está. */
export type SituacaoDoOrcamento = Enums<"orc_situacao">;

export type ResumoDeOrcamento = {
  id: string;
  numero: string | null;
  cliente: string;
  objeto: string | null;
  status: StatusDoOrcamento;
  total: number | null;
  itens: number;
  semPreco: number;
  semCusto: number;
  situacao: SituacaoDoOrcamento;
  aberturas: number;
  vistoEm: string | null;
  valorAprovado: number | null;
  versaoPublicada: number | null;
  criadoEm: string;
};

export async function listarOrcamentos(
  incluirArquivados = false,
): Promise<ResumoDeOrcamento[]> {
  const sb = supabaseAdmin();
  const org = await orgAtual();

  let consulta = sb
    .from("orc_orcamentos")
    .select(
      "id, numero, cliente_nome, objeto, status, situacao, aberturas, visto_em, valor_aprovado, valor_fechado, created_at",
    )
    .eq("org_id", org)
    .order("created_at", { ascending: false });

  if (!incluirArquivados) consulta = consulta.neq("status", "arquivado");

  const { data: orcamentos } = await consulta;
  if (!orcamentos?.length) return [];

  const ids = orcamentos.map((o) => o.id);

  const [{ data: itens }, { data: publicacoes }] = await Promise.all([
    sb
      .from("orc_itens")
      .select("orcamento_id, total, valor_unitario, custo_unitario")
      .in("orcamento_id", ids)
      .is("removido_em", null),
    sb
      .from("orc_publicacoes")
      .select("orcamento_id, versao")
      .in("orcamento_id", ids),
  ]);

  return orcamentos.map((o) => {
    const meus = (itens ?? []).filter((i) => i.orcamento_id === o.id);
    const soma = meus.reduce((acc, i) => acc + (i.total ?? 0), 0);
    const versoes = (publicacoes ?? [])
      .filter((p) => p.orcamento_id === o.id)
      .map((p) => p.versao);

    return {
      id: o.id,
      numero: o.numero,
      cliente: o.cliente_nome,
      objeto: o.objeto,
      status: o.status,
      total: o.valor_fechado ?? (meus.length ? soma : null),
      itens: meus.length,
      semPreco: meus.filter((i) => i.valor_unitario === null).length,
      semCusto: meus.filter((i) => i.custo_unitario === null).length,
      situacao: o.situacao,
      aberturas: o.aberturas,
      vistoEm: o.visto_em,
      valorAprovado: o.valor_aprovado,
      versaoPublicada: versoes.length ? Math.max(...versoes) : null,
      criadoEm: o.created_at,
    };
  });
}

export type ItemDoOrcamento = {
  id: string;
  grupo: string | null;
  position: number;
  descricao: string;
  quantidade: number | null;
  unidade: string | null;
  /** Preço de venda — o que sai no documento do cliente. */
  valorUnitario: number | null;
  /** Custo de tabela (SINAPI/SEINFRA/própria) ou digitado à mão.
   *  NUNCA sai no documento do cliente — é dado de decisão, não de proposta. */
  custoUnitario: number | null;
  /** De qual composição da base este custo veio, se veio de lá. */
  composicaoId: string | null;
  total: number | null;
  origem: Enums<"orc_origem">;
  editadoEm: string | null;
  removidoEm: string | null;
  observacao: string | null;
};

/** Tipo de bloco de texto do documento. */
export type TipoDeSecao = Enums<"orc_secao_tipo">;

export type SecaoDoOrcamento = {
  id: string;
  tipo: TipoDeSecao;
  position: number;
  titulo: string;
  texto: string;
  origem: Enums<"orc_origem">;
};

/** Obra que já existe, para o orçamento poder apontar para ela. */
export type ObraParaVincular = { id: string; nome: string; cliente: string };

export async function obrasParaVincular(): Promise<ObraParaVincular[]> {
  const sb = supabaseAdmin();
  const org = await orgAtual();

  const { data } = await sb
    .from("obras")
    .select("id, nome, cliente_nome")
    .eq("org_id", org)
    .eq("ativa", true)
    .order("created_at", { ascending: false });

  return (data ?? []).map((o) => ({
    id: o.id,
    nome: o.nome,
    cliente: o.cliente_nome,
  }));
}

export type OrcamentoCompleto = {
  id: string;
  numero: string | null;
  cliente: string;
  obraId: string | null;
  obraNome: string | null;
  clienteContato: string | null;
  endereco: string | null;
  objeto: string | null;
  status: StatusDoOrcamento;
  prazo: string | null;
  pagamento: string | null;
  validadeDias: number;
  observacoes: string | null;

  /** Os textos que envolvem a tabela no documento do cliente. Ver
   *  `lib/orcamento/publicacao.ts`. Todos opcionais. */
  apresentacao: string | null;
  introCustos: string | null;
  notaCustos: string | null;
  introAceite: string | null;
  /** Cards do projeto, observações técnicas e etapas, em ordem. */
  secoes: SecaoDoOrcamento[];

  senha: string | null;
  token: string;
  /** Chave do tema que assina o documento do cliente. */
  marca: string;
  valorFechado: number | null;
  /** BDI sugerido em %: o ponto de partida do preço de venda de item novo,
   *  não uma trava. Cada item pode se afastar dele. */
  bdiPadrao: number;

  situacao: SituacaoDoOrcamento;
  /** Quando o cliente abriu a página pela primeira vez, e a última. */
  vistoEm: string | null;
  vistoUltimaEm: string | null;
  aberturas: number;
  aprovadoEm: string | null;
  /** Valor congelado no aceite — base de qualquer cálculo de comissão. */
  valorAprovado: number | null;
  recusadoEm: string | null;
  motivoRecusa: string | null;

  criadoEm: string;
  atualizadoEm: string;

  itens: ItemDoOrcamento[];
  /** Os que ele apagou. Ficam guardados: enquanto é rascunho, apagar volta. */
  removidos: ItemDoOrcamento[];

  total: number;
  semPreco: number;
  /** Quantos itens vivos não têm custo lançado. Informativo — diferente de
   *  `semPreco`, não bloqueia o envio: falta de custo é problema de margem,
   *  não de documento incompleto. */
  semCusto: number;
  /** Soma de quantidade × custo, só dos itens que têm custo. A margem
   *  calculada aqui é sobre o que se sabe; `semCusto` avisa que ela é parcial
   *  quando > 0. */
  custoTotal: number;
  /** total (venda) − custoTotal, sobre os itens com custo conhecido. */
  margemValor: number;
  /** null quando custoTotal é 0 — nada para dividir. */
  margemPercentual: number | null;
  versaoPublicada: number | null;
  publicadoEm: string | null;
};

function paraItem(linha: {
  id: string;
  grupo: string | null;
  position: number;
  descricao: string;
  quantidade: number | null;
  unidade: string | null;
  valor_unitario: number | null;
  custo_unitario: number | null;
  composicao_id: string | null;
  total: number | null;
  origem: Enums<"orc_origem">;
  editado_em: string | null;
  removido_em: string | null;
  observacao: string | null;
}): ItemDoOrcamento {
  return {
    id: linha.id,
    grupo: linha.grupo,
    position: linha.position,
    descricao: linha.descricao,
    quantidade: linha.quantidade,
    unidade: linha.unidade,
    valorUnitario: linha.valor_unitario,
    custoUnitario: linha.custo_unitario,
    composicaoId: linha.composicao_id,
    total: linha.total,
    origem: linha.origem,
    editadoEm: linha.editado_em,
    removidoEm: linha.removido_em,
    observacao: linha.observacao,
  };
}

/** custo × quantidade, só onde o custo é conhecido. */
function custoDoItem(item: ItemDoOrcamento): number {
  if (item.custoUnitario === null) return 0;
  return item.custoUnitario * (item.quantidade ?? 0);
}

export async function carregarOrcamento(
  id: string,
): Promise<OrcamentoCompleto | null> {
  const sb = supabaseAdmin();
  const org = await orgAtual();

  const { data: o } = await sb
    .from("orc_orcamentos")
    .select("*")
    .eq("id", id)
    .eq("org_id", org)
    .maybeSingle();
  if (!o) return null;

  const [{ data: linhas }, { data: publicacoes }, { data: secoes }] =
    await Promise.all([
      sb
        .from("orc_itens")
        .select(
          "id, grupo, position, descricao, quantidade, unidade, valor_unitario, custo_unitario, composicao_id, total, origem, editado_em, removido_em, observacao",
        )
        .eq("orcamento_id", id)
        .order("position"),
      sb
        .from("orc_publicacoes")
        .select("versao, publicado_em")
        .eq("orcamento_id", id)
        .order("versao", { ascending: false })
        .limit(1),
      sb
        .from("orc_secoes")
        .select("id, tipo, position, titulo, texto, origem")
        .eq("orcamento_id", id)
        .order("position"),
    ]);

  const todos = (linhas ?? []).map(paraItem);
  const vivos = todos.filter((i) => !i.removidoEm);

  const publicacao = publicacoes?.[0] ?? null;

  // A obra vinculada, quando o cliente já aprovou e ela nasceu.
  const { data: obra } = o.obra_id
    ? await sb.from("obras").select("nome").eq("id", o.obra_id).maybeSingle()
    : { data: null };

  return {
    id: o.id,
    numero: o.numero,
    cliente: o.cliente_nome,
    obraId: o.obra_id,
    obraNome: obra?.nome ?? null,
    clienteContato: o.cliente_contato,
    endereco: o.endereco,
    objeto: o.objeto,
    status: o.status,
    prazo: o.prazo,
    pagamento: o.pagamento,
    validadeDias: o.validade_dias,
    observacoes: o.observacoes,

    apresentacao: o.apresentacao,
    introCustos: o.intro_custos,
    notaCustos: o.nota_custos,
    introAceite: o.intro_aceite,
    secoes: (secoes ?? []).map((s) => ({
      id: s.id,
      tipo: s.tipo,
      position: s.position,
      titulo: s.titulo,
      texto: s.texto,
      origem: s.origem,
    })),

    senha: o.senha,
    token: o.token,
    marca: o.marca,
    valorFechado: o.valor_fechado,
    bdiPadrao: o.bdi_padrao,

    situacao: o.situacao,
    vistoEm: o.visto_em,
    vistoUltimaEm: o.visto_ultima_em,
    aberturas: o.aberturas,
    aprovadoEm: o.aprovado_em,
    valorAprovado: o.valor_aprovado,
    recusadoEm: o.recusado_em,
    motivoRecusa: o.motivo_recusa,

    criadoEm: o.created_at,
    atualizadoEm: o.updated_at,

    itens: vivos,
    removidos: todos.filter((i) => i.removidoEm),

    total: o.valor_fechado ?? vivos.reduce((acc, i) => acc + (i.total ?? 0), 0),
    semPreco: vivos.filter((i) => i.valorUnitario === null).length,
    semCusto: vivos.filter((i) => i.custoUnitario === null).length,
    custoTotal: vivos.reduce((acc, i) => acc + custoDoItem(i), 0),
    margemValor:
      vivos.reduce((acc, i) => acc + (i.total ?? 0), 0) -
      vivos.reduce((acc, i) => acc + custoDoItem(i), 0),
    margemPercentual: (() => {
      const custo = vivos.reduce((acc, i) => acc + custoDoItem(i), 0);
      if (custo <= 0) return null;
      const venda = vivos.reduce((acc, i) => acc + (i.total ?? 0), 0);
      return ((venda - custo) / custo) * 100;
    })(),
    versaoPublicada: publicacao?.versao ?? null,
    publicadoEm: publicacao?.publicado_em ?? null,
  };
}

/**
 * O próximo número da RD, no formato RD-AAAA-NNN.
 *
 * Continua a sequência do ano corrente olhando o maior já usado na org, em vez
 * de contar linhas: orçamento apagado deixaria buraco e o contador repetiria
 * um número que já foi para a rua.
 */
export async function proximoNumero(): Promise<string> {
  const sb = supabaseAdmin();
  const org = await orgAtual();
  const ano = new Date().getFullYear();
  const prefixo = `RD-${ano}-`;

  const { data } = await sb
    .from("orc_orcamentos")
    .select("numero")
    .eq("org_id", org)
    .like("numero", `${prefixo}%`)
    .order("numero", { ascending: false })
    .limit(1);

  const ultimo = data?.[0]?.numero ?? null;
  const sequencial = ultimo ? Number(ultimo.slice(prefixo.length)) : 0;
  const proximo = Number.isFinite(sequencial) ? sequencial + 1 : 1;

  return `${prefixo}${String(proximo).padStart(3, "0")}`;
}
