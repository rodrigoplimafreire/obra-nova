import type { Etapa, PedidoNoQuadro, Porte } from "./constantes";

/**
 * Quanto embutir em cada proposta para pagar os orçamentos que não fecham.
 *
 * **A ideia intuitiva tem um furo de tempo.** "O cliente B paga o custo do A e
 * do C" não dá para executar: no dia em que a proposta do B é montada, ninguém
 * sabe ainda que A e C vão se perder. A perda vem depois.
 *
 * O que dá é o inverso: medir a proporção histórica e carregar **toda**
 * proposta com a fatia dos que não fecham.
 *
 *     carga = custo de produzir um orçamento ÷ taxa de conversão
 *
 * Com conversão de 1 em 3 e R$ 630 por orçamento, cada obra fechada precisa
 * carregar R$ 1.890 — o dela e o dos dois que se perderam. A conta é a mesma da
 * ideia original; só o momento de aplicar muda.
 *
 * **Duas fontes para cada entrada, e o app diz qual está usando.** Enquanto o
 * histórico for curto, valem as premissas digitadas: o orçamento padrão (a
 * "visita do Zé", etapa por etapa) e a conversão estimada. Quando houver
 * medição suficiente, o medido assume sozinho. Uma taxa calculada sobre dois
 * pedidos não é medida, é ruído com aparência de número.
 */

/** Abaixo disso, um desfecho a mais vira dez pontos de conversão. */
export const MINIMO_PARA_CONVERSAO = 6;
/** Abaixo disso, um orçamento atípico domina a média. */
export const MINIMO_PARA_CUSTO = 4;

export type Fonte = "medido" | "premissa";

export type PadraoDaEtapa = { etapa: Etapa; minutos: number; km: number | null };

export type EntradasDaCarga = {
  custoHora: number | null;
  custoKm: number | null;
  /** A tabela do orçamento típico, quando ainda não há histórico. */
  padrao: PadraoDaEtapa[];
  /** Conversão informada à mão, em %. */
  conversaoEstimada: number | null;
  multiplicador: Record<Porte, number>;
  pedidos: PedidoNoQuadro[];
};

export type Carga = {
  /** Custo de produzir um orçamento, e de onde veio esse número. */
  custoPorOrcamento: number | null;
  fonteDoCusto: Fonte;
  minutosPorOrcamento: number;
  kmPorOrcamento: number;

  /** Conversão em %, e de onde veio. */
  conversao: number | null;
  fonteDaConversao: Fonte;
  comDesfecho: number;
  medidos: number;

  /** A carga da obra média, antes do peso de porte. */
  base: number | null;
  /** O que embutir, por porte. */
  porPorte: Record<Porte, number> | null;

  /**
   * Com a mistura de portes que já aconteceu, esta carga recupera quanto do
   * que foi gasto orçando? Nulo enquanto não houver desfecho para comparar.
   */
  cobertura: number | null;

  /** O que impede a conta de fechar, em português. */
  impedimento: string | null;
};

export function calcularCarga(e: EntradasDaCarga): Carga {
  const fechados = e.pedidos.filter((p) => p.status === "fechado");
  const perdidos = e.pedidos.filter((p) => p.status === "perdido");
  const comDesfecho = fechados.length + perdidos.length;
  const medidos = e.pedidos.filter((p) => p.totalMinutos > 0);

  // --- Custo de produzir um orçamento ---------------------------------------
  const usaCustoMedido = medidos.length >= MINIMO_PARA_CUSTO;

  const minutosPadrao = e.padrao.reduce((s, p) => s + p.minutos, 0);
  const kmPadrao = e.padrao.reduce((s, p) => s + (p.km ?? 0), 0);

  const minutosPorOrcamento = usaCustoMedido
    ? Math.round(medidos.reduce((s, p) => s + p.totalMinutos, 0) / medidos.length)
    : minutosPadrao;
  const kmPorOrcamento = usaCustoMedido
    ? arredondar(medidos.reduce((s, p) => s + p.kmTotal, 0) / medidos.length, 1)
    : kmPadrao;

  const custoPorOrcamento =
    e.custoHora === null || minutosPorOrcamento === 0
      ? null
      : arredondar(
          (minutosPorOrcamento / 60) * e.custoHora +
            kmPorOrcamento * (e.custoKm ?? 0),
          2,
        );

  // --- Conversão ------------------------------------------------------------
  const usaConversaoMedida = comDesfecho >= MINIMO_PARA_CONVERSAO;
  const conversao = usaConversaoMedida
    ? arredondar((fechados.length / comDesfecho) * 100, 1)
    : e.conversaoEstimada;

  // --- A carga --------------------------------------------------------------
  const impedimento =
    e.custoHora === null
      ? "Falta o custo por hora. Sem ele não há custo de orçamento para repartir."
      : minutosPorOrcamento === 0
        ? "Falta o orçamento padrão: quantos minutos cada etapa costuma levar."
        : conversao === null
          ? "Falta a conversão estimada — de cada 10 orçamentos, quantos fecham."
          : conversao === 0
            ? "Nenhum orçamento fechou ainda. Sem nada fechando, não há proposta onde embutir o custo das perdidas."
            : null;

  const base =
    impedimento !== null || custoPorOrcamento === null || !conversao
      ? null
      : arredondar(custoPorOrcamento / (conversao / 100), 2);

  const porPorte =
    base === null
      ? null
      : {
          P: arredondar(base * e.multiplicador.P, 2),
          M: arredondar(base * e.multiplicador.M, 2),
          G: arredondar(base * e.multiplicador.G, 2),
        };

  return {
    custoPorOrcamento,
    fonteDoCusto: usaCustoMedido ? "medido" : "premissa",
    minutosPorOrcamento,
    kmPorOrcamento,
    conversao,
    fonteDaConversao: usaConversaoMedida ? "medido" : "premissa",
    comDesfecho,
    medidos: medidos.length,
    base,
    porPorte,
    cobertura: coberturaReal(e.pedidos, porPorte),
    impedimento,
  };
}

/**
 * A conferência que impede a carga de ser bonita e insuficiente.
 *
 * Carga por porte é escolha de política, não conta fechada: se a maioria das
 * obras da RD for pequena e o peso do P for baixo, o dinheiro recuperado não
 * cobre o que foi gasto orçando — e isso não aparece em nenhum dos outros
 * números. Aqui aparece.
 *
 * Compara o que as obras fechadas teriam recuperado contra o custo de **todos**
 * os orçamentos com desfecho, fechados e perdidos.
 */
function coberturaReal(
  pedidos: PedidoNoQuadro[],
  porPorte: Record<Porte, number> | null,
): number | null {
  if (!porPorte) return null;

  const comDesfecho = pedidos.filter((p) =>
    ["fechado", "perdido"].includes(p.status),
  );
  const gasto = comDesfecho.reduce((s, p) => s + (p.custoEstimado ?? 0), 0);
  if (gasto === 0) return null;

  const recuperado = comDesfecho
    .filter((p) => p.status === "fechado")
    // Sem porte definido, entra como médio — é o palpite menos ruim, e o
    // alternativo seria excluir a obra e inflar a cobertura.
    .reduce((s, p) => s + porPorte[p.porte ?? "M"], 0);

  return arredondar((recuperado / gasto) * 100, 1);
}

/** Percentual que a carga representa sobre um valor de obra. */
export function pesoNaObra(carga: number, valorDaObra: number): number | null {
  if (valorDaObra <= 0) return null;
  return arredondar((carga / valorDaObra) * 100, 1);
}

function arredondar(n: number, casas: number): number {
  const f = 10 ** casas;
  return Math.round(n * f) / f;
}
