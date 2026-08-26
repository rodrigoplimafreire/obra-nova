/**
 * Número e dinheiro em português, nos dois sentidos.
 *
 * Vive fora de `server-only` de propósito: o editor formata no navegador
 * enquanto ele digita, e a Server Action lê o mesmo formato de volta. Duas
 * implementações separadas divergiriam justamente na vírgula.
 */

const MOEDA = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const NUMERO = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

export function moeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  return MOEDA.format(valor);
}

export function numero(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  return NUMERO.format(valor);
}

/**
 * Lê o que uma pessoa digitou. Aceita "1.234,56", "1234.56", "1234,56" e
 * "R$ 1.234,56"; devolve `null` para vazio, que aqui não é zero — é "não foi
 * falado ainda".
 *
 * A regra do separador: o último sinal de vírgula ou ponto é o decimal, os
 * anteriores são de milhar. É o que distingue "1.234" (mil duzentos e trinta e
 * quatro) de "1.5" (um e meio) sem perguntar nada a quem digita.
 */
export function lerNumero(bruto: string | null | undefined): number | null {
  if (bruto === null || bruto === undefined) return null;

  const limpo = String(bruto)
    .replace(/[^\d,.-]/g, "")
    .trim();
  if (!limpo) return null;

  const ultimaVirgula = limpo.lastIndexOf(",");
  const ultimoPonto = limpo.lastIndexOf(".");
  const decimal = Math.max(ultimaVirgula, ultimoPonto);

  let normalizado: string;
  if (decimal === -1) {
    normalizado = limpo;
  } else {
    const inteiro = limpo.slice(0, decimal).replace(/[.,]/g, "");
    const fracao = limpo.slice(decimal + 1).replace(/[.,]/g, "");
    normalizado = `${inteiro}.${fracao}`;
  }

  const valor = Number(normalizado);
  return Number.isFinite(valor) ? valor : null;
}

/** O que vai no campo do editor: número puro, sem símbolo, com vírgula. */
export function paraCampo(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  return String(valor).replace(".", ",");
}

const DATA_BR = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

export function data(iso: string | null | undefined): string {
  if (!iso) return "—";
  return DATA_BR.format(new Date(iso));
}
