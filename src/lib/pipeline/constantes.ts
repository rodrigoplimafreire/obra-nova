/**
 * O vocabulário do pipeline: estados, etapas, rótulos e os tipos que a tela
 * recebe.
 *
 * Fica **fora** de `dados.ts` porque aquele módulo é `server-only` — ele fala
 * com o banco. O quadro, a tela do pedido e o cronômetro rodam no navegador e
 * precisam dos mesmos rótulos; importá-los de lá arrastaria a chave de serviço
 * para dentro do bundle do cliente, e o build recusa isso (com razão).
 */

export const ESTADOS = [
  "novo_pedido",
  "em_estudo",
  "estudo_entregue",
  "orcamento_em_producao",
  "orcamento_enviado",
  "fechado",
  "perdido",
  "congelado",
] as const;
export type Estado = (typeof ESTADOS)[number];

/** A ordem do funil, que é a ordem das colunas do quadro. */
export const FUNIL: Estado[] = [
  "novo_pedido",
  "em_estudo",
  "estudo_entregue",
  "orcamento_em_producao",
  "orcamento_enviado",
  "fechado",
];

/** Fora do funil: não são etapas, são saídas. */
export const SAIDAS: Estado[] = ["perdido", "congelado"];

export const ROTULO_ESTADO: Record<Estado, string> = {
  novo_pedido: "Novo pedido",
  em_estudo: "Em estudo",
  estudo_entregue: "Estudo entregue",
  orcamento_em_producao: "Orçamento em produção",
  orcamento_enviado: "Orçamento enviado",
  fechado: "Fechado",
  perdido: "Perdido",
  congelado: "Congelado",
};

export const ETAPAS = [
  "deslocamento",
  "visita_tecnica",
  "estudo_projeto",
  "planilha_custos",
  "formatacao_proposta",
  "outro",
] as const;
export type Etapa = (typeof ETAPAS)[number];

export const ROTULO_ETAPA: Record<Etapa, string> = {
  deslocamento: "Deslocamento",
  visita_tecnica: "Visita técnica",
  estudo_projeto: "Estudo e projeto",
  planilha_custos: "Planilha de custos",
  formatacao_proposta: "Formatação da proposta",
  outro: "Outro",
};

export const TIPOS_DE_OBRA = [
  "reforma",
  "construcao_zero",
  "projeto_estrutural",
  "gestao_obra",
] as const;
export type TipoDeObra = (typeof TIPOS_DE_OBRA)[number];

export const ROTULO_TIPO: Record<TipoDeObra, string> = {
  reforma: "Reforma",
  construcao_zero: "Construção do zero",
  projeto_estrutural: "Projeto estrutural",
  gestao_obra: "Gestão de obra",
};

export const ORIGENS = [
  "indicacao",
  "google",
  "meta",
  "instagram",
  "site",
  "outro",
] as const;
export type Origem = (typeof ORIGENS)[number];

export const ROTULO_ORIGEM: Record<Origem, string> = {
  indicacao: "Indicação",
  google: "Google",
  meta: "Meta Ads",
  instagram: "Instagram",
  site: "Site",
  outro: "Outro",
};

export const PORTES = ["P", "M", "G"] as const;
export type Porte = (typeof PORTES)[number];

export type PedidoNoQuadro = {
  id: string;
  codigo: number;
  cliente: string;
  telefone: string | null;
  tipoObra: TipoDeObra | null;
  bairro: string | null;
  origem: Origem | null;
  porte: Porte | null;
  status: Estado;
  dataPedido: string;
  valorOrcado: number | null;
  valorFechado: number | null;
  motivoPerda: string | null;
  orcamentoId: string | null;
  /** Somado de `pipe_tempos` pela visão. */
  totalMinutos: number;
  kmTotal: number;
  etapasRegistradas: number;
  /** Nulo quando a empreiteira ainda não calculou o custo/hora. */
  custoEstimado: number | null;
  ultimoEventoEm: string | null;
  /** Mais de N dias sem andar, ainda no começo do funil. */
  parado: boolean;
};

export type EventoDoPedido = {
  id: string;
  anterior: Estado | null;
  novo: Estado;
  em: string;
};

export type TempoDoPedido = {
  id: string;
  etapa: Etapa;
  minutos: number;
  km: number | null;
  fonte: "cronometro" | "manual";
  nota: string | null;
  data: string;
};

export type PedidoCompleto = PedidoNoQuadro & {
  estudoCobrado: boolean;
  estudoValor: number | null;
  estudoAbatido: boolean;
  dataEntregaEstudo: string | null;
  dataEnvioOrcamento: string | null;
  observacoes: string | null;
  /** Nome do orçamento vinculado, quando já existe documento. */
  orcamentoCliente: string | null;
  eventos: EventoDoPedido[];
  tempos: TempoDoPedido[];
  /** Premissas de custo da empreiteira. Nulas = a tela avisa em vez de mentir. */
  custoHora: number | null;
  custoKm: number | null;
};

export type AjustesDaOrg = {
  custoHora: number | null;
  custoKm: number | null;
  diasParaParado: number;
};
