/**
 * O diário de atividades, do lado que o cliente e o servidor compartilham.
 *
 * **Cuidado com o nome:** "relatório" aqui é o do dia, e não tem parentesco
 * com `relatorios`, que é o semanal da obra. Ver `PRD-DIARIO.md` §1.
 */

/** As quatro seções do PRD, na ordem em que a página as mostra. */
export const SECOES = [
  { chave: "realizado", rotulo: "Realizado" },
  { chave: "emAndamento", rotulo: "Em andamento" },
  { chave: "pendencias", rotulo: "Pendências" },
  { chave: "proximosPassos", rotulo: "Próximos passos" },
] as const;

export type ChaveDeSecao = (typeof SECOES)[number]["chave"];

/** O rascunho, como o painel edita: uma linha por item, texto puro. */
export type RascunhoDoDia = Record<ChaveDeSecao, string>;

export const RASCUNHO_VAZIO: RascunhoDoDia = {
  realizado: "",
  emAndamento: "",
  pendencias: "",
  proximosPassos: "",
};

/**
 * A fotografia que o link serve.
 *
 * Aqui as seções já são listas: quem lê não recebe o texto do campo, recebe o
 * que foi congelado no instante de publicar. Editar o rascunho depois não
 * mexe nisto — só publicar de novo mexe.
 */
export type DiaPublicado = {
  versao: number;
  dia: string;
  autor: string | null;
  realizado: string[];
  emAndamento: string[];
  pendencias: string[];
  proximosPassos: string[];
  publicadoEm: string;
};

export function temConteudo(d: DiaPublicado): boolean {
  return (
    d.realizado.length > 0 ||
    d.emAndamento.length > 0 ||
    d.pendencias.length > 0 ||
    d.proximosPassos.length > 0
  );
}

/** Texto multilinha vira lista, sem linha em branco. Igual a `empreiteira.ts`. */
export function linhas(texto: string | null | undefined): string[] {
  return (texto ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    // O hífen digitado no começo da linha é hábito de quem escreve lista; a
    // página já desenha o marcador, e os dois juntos dariam "• - item".
    .map((l) => l.replace(/^[-*•]\s*/, ""))
    .filter(Boolean);
}
