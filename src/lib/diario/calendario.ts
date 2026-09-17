/**
 * A grade do mês, montada sem depender de biblioteca e sem depender de
 * navegador: quem chama é um Server Component, porque o calendário precisa
 * funcionar com JavaScript desligado (decisão D7 do `PRD-DIARIO.md`).
 *
 * Tudo em UTC de propósito. A grade é aritmética de calendário, não instante
 * no tempo: `new Date(2026, 8, 1)` no servidor em UTC e no aparelho em
 * Brasília dariam dias diferentes, e o mês sairia deslocado. Quem resolve
 * "que dia é hoje" é `hojeNaEmpreiteira()`, uma vez, antes de chegar aqui.
 */

/** Domingo a sábado, como todo calendário impresso no Brasil. */
export const DIAS_DA_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"] as const;

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "setembro de 2026", para o cabeçalho da grade. */
export function nomeDoMes(mes: string): string {
  return `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`;
}

/**
 * As semanas do mês. Cada semana tem sete posições, e as de fora do mês vêm
 * como `null` — célula vazia, e não o dia do mês vizinho: clicar num dia que
 * pertence a outro mês é a fonte clássica de engano em calendário.
 */
export function semanasDoMes(mes: string): (string | null)[][] {
  const ano = Number(mes.slice(0, 4));
  const numero = Number(mes.slice(5, 7));

  const primeiro = new Date(Date.UTC(ano, numero - 1, 1));
  const total = new Date(Date.UTC(ano, numero, 0)).getUTCDate();

  const celulas: (string | null)[] = Array(primeiro.getUTCDay()).fill(null);
  for (let d = 1; d <= total; d += 1) {
    celulas.push(`${mes}-${String(d).padStart(2, "0")}`);
  }
  while (celulas.length % 7 !== 0) celulas.push(null);

  const semanas: (string | null)[][] = [];
  for (let i = 0; i < celulas.length; i += 7) {
    semanas.push(celulas.slice(i, i + 7));
  }
  return semanas;
}
