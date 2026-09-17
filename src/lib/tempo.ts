/**
 * O dia da empreiteira, num lugar só.
 *
 * A Vercel roda em UTC: depois das 21h de Brasília o servidor já virou o dia,
 * e "hoje" calculado no fuso do servidor mostraria a data errada para quem
 * está no canteiro. Por isso a data nunca sai de `new Date()` direto.
 *
 * **Por que uma constante e não uma coluna em `orgs`** (decisão D6 do
 * `PRD-DIARIO.md`): a RD é de Fortaleza, que tem o mesmo deslocamento de São
 * Paulo desde o fim do horário de verão, em 2019. Uma coluna de fuso que
 * ninguém preenche é pior que a constante — dá a impressão de configurável e
 * nunca foi testada com outro valor. Quando existir empreiteira em outro
 * fuso, é **este** arquivo que muda, e só ele.
 */

export const FUSO_DA_EMPREITEIRA = "America/Sao_Paulo";

/** Hoje em `AAAA-MM-DD`, que é o formato de `date` no Postgres. */
export function hojeNaEmpreiteira(): string {
  // en-CA porque devolve AAAA-MM-DD sem precisar montar a string à mão.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_DA_EMPREITEIRA,
  }).format(new Date());
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const MES = /^\d{4}-\d{2}$/;

/** `AAAA-MM-DD` que existe de verdade. Filtra 2026-02-31 e afins. */
export function diaValido(valor: string): boolean {
  if (!DIA.test(valor)) return false;
  // `T12:00:00Z` e não meia-noite: no fuso de Brasília, meia-noite UTC ainda é
  // o dia anterior, e a data voltaria deslocada em um dia.
  const d = new Date(`${valor}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

export function mesValido(valor: string): boolean {
  return MES.test(valor) && Number(valor.slice(5, 7)) >= 1 && Number(valor.slice(5, 7)) <= 12;
}

/** O mês (`AAAA-MM`) a que um dia pertence. */
export function mesDoDia(dia: string): string {
  return dia.slice(0, 7);
}

/** Mês vizinho, para as setas do calendário. `passo` é +1 ou -1. */
export function mesVizinho(mes: string, passo: number): string {
  const ano = Number(mes.slice(0, 4));
  const numero = Number(mes.slice(5, 7)) - 1 + passo;
  const d = new Date(Date.UTC(ano, numero, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Primeiro e último dia do mês, em `AAAA-MM-DD`. */
export function limitesDoMes(mes: string): { inicio: string; fim: string } {
  const ano = Number(mes.slice(0, 4));
  const numero = Number(mes.slice(5, 7));
  const ultimo = new Date(Date.UTC(ano, numero, 0)).getUTCDate();
  return {
    inicio: `${mes}-01`,
    fim: `${mes}-${String(ultimo).padStart(2, "0")}`,
  };
}
