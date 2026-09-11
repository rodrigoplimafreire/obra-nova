/**
 * O vocabulário da vistoria: ambientes e disciplinas.
 *
 * Fora de `server-only` porque a tela da visita é um componente de cliente —
 * mesma razão de `pipeline/constantes.ts` ter sido separado de `dados.ts`.
 *
 * **São sugestões, não uma lista fechada.** Toda obra tem o cômodo que não
 * estava previsto, e uma tela que obriga a escolher de um menu vira exatamente
 * o "preenchimento burocrático" que o PRD manda evitar. Os dois campos aceitam
 * texto livre; estas listas só existem para poupar digitação no canteiro.
 */

export const AMBIENTES = [
  "Sala",
  "Cozinha",
  "Banheiro social",
  "Banheiro suíte",
  "Quarto",
  "Suíte",
  "Área de serviço",
  "Varanda",
  "Área externa",
  "Fachada",
  "Corredor",
  "Escada",
  "Garagem",
  "Telhado",
] as const;

/**
 * As disciplinas do checklist (F03 do PRD).
 *
 * Saem da lista do próprio PRD, conferida contra os 35 serviços que o
 * `minerar:servicos` achou nos orçamentos reais da RD — é a divisão que ela
 * usa de verdade, não uma taxonomia de manual.
 *
 * Quando a biblioteca da Entrega 1 estiver cheia, este checklist deixa de ser
 * constante e passa a vir dela, já com preço. Até lá, disciplina é só o rótulo
 * do que foi levantado.
 */
export const SERVICOS = [
  "Demolição",
  "Retirada e descarte",
  "Alvenaria",
  "Estrutura e concretagem",
  "Chapisco e reboco",
  "Contrapiso",
  "Revestimento de piso",
  "Revestimento de parede",
  "Impermeabilização",
  "Gesso",
  "Forro",
  "Pintura",
  "Elétrica",
  "Hidráulica",
  "Esquadrias",
  "Marcenaria",
  "Cobertura",
  "Limpeza pós-obra",
] as const;

/** As unidades que aparecem nos orçamentos da RD. */
export const UNIDADES = ["m²", "m", "m³", "un", "vb", "pç", "sc", "dia"] as const;

export type Ambiente = {
  id: string;
  position: number;
  nome: string;
  observacao: string | null;
  medicoes: Medicao[];
};

export type Medicao = {
  id: string;
  position: number;
  servico: string;
  comprimento: number | null;
  largura: number | null;
  altura: number | null;
  quantidade: number | null;
  unidade: string | null;
  observacao: string | null;
};

export type VistoriaCompleta = {
  id: string;
  pedidoId: string | null;
  pedidoCliente: string | null;
  orcamentoId: string | null;
  cliente: string;
  endereco: string | null;
  dataVisita: string;
  observacoes: string | null;
  concluidaEm: string | null;
  criadoEm: string;
  ambientes: Ambiente[];
};

export type VistoriaNaLista = {
  id: string;
  cliente: string;
  endereco: string | null;
  dataVisita: string;
  concluidaEm: string | null;
  orcamentoId: string | null;
  ambientes: number;
  medicoes: number;
};

/**
 * A área a partir das medidas da trena.
 *
 * Comprimento × largura quando os dois existem; senão comprimento × altura,
 * que é o caso da parede. Devolve `null` quando não dá para calcular, e nunca
 * chuta: quantidade errada num orçamento é preço errado.
 *
 * **Isto não é a "fórmula configurável" do PRD** (decisão D3, que continua em
 * aberto). É a conta que o Reginato faria na calculadora do celular, feita
 * pela tela para ele não precisar fazer em pé no canteiro.
 */
export function areaDe(
  comprimento: number | null,
  largura: number | null,
  altura: number | null,
): number | null {
  const par =
    comprimento !== null && largura !== null
      ? comprimento * largura
      : comprimento !== null && altura !== null
        ? comprimento * altura
        : null;
  if (par === null || !Number.isFinite(par) || par <= 0) return null;
  return Math.round(par * 100) / 100;
}
