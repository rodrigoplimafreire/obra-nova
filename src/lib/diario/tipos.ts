/**
 * O diário de atividades, do lado que o cliente e o servidor compartilham.
 *
 * **Cuidado com o nome:** "relatório" aqui é o do dia, e não tem parentesco
 * com `relatorios`, que é o semanal da obra. Ver `PRD-DIARIO.md` §1.
 */

import type { Enums } from "@/lib/database.types";

export type Secao = Enums<"dia_secao">;
export type Origem = Enums<"dia_origem">;

/**
 * "A definir" não é gente: é a ausência de dono, e a tela sempre a oferece.
 *
 * Fica aqui, e não junto das ações do elenco, porque arquivo com `"use
 * server"` só pode exportar função assíncrona.
 */
export const A_DEFINIR = "A definir";

/**
 * As quatro seções do PRD, na ordem em que a página as mostra — que é a
 * ordem que a pesquisa de ferramentas de status confirma: primeiro o que
 * ficou pronto, por último o que vem.
 *
 * As chaves são as do banco, e não uma tradução em camelCase. Ter dois nomes
 * para a mesma seção obrigava a converter em cada fronteira, e era uma
 * conversão a mais para esquecer.
 */
export const SECOES = [
  {
    chave: "realizado" as const,
    rotulo: "Realizado",
    ajuda: "O que ficou pronto.",
    /** Só duas seções têm dono: as que pedem alguma coisa de alguém. */
    comResponsavel: false,
  },
  {
    chave: "em_andamento" as const,
    rotulo: "Em andamento",
    ajuda: "O que começou e continua.",
    comResponsavel: false,
  },
  {
    chave: "pendencias" as const,
    rotulo: "Pendências",
    ajuda: "O que está travado, com responsável e prazo quando houver.",
    comResponsavel: true,
  },
  {
    chave: "proximos_passos" as const,
    rotulo: "Próximos passos",
    ajuda: "O que vem em seguida, por responsável.",
    comResponsavel: true,
  },
];

export const ROTULO_DA_SECAO: Record<Secao, string> = {
  realizado: "Realizado",
  em_andamento: "Em andamento",
  pendencias: "Pendências",
  proximos_passos: "Próximos passos",
};

export function ehSecao(valor: string): valor is Secao {
  return valor in ROTULO_DA_SECAO;
}

/** Um item do dia, como o painel o edita. */
export type ItemDoDia = {
  id: string;
  secao: Secao;
  texto: string;
  responsavel: string | null;
  origem: Origem;
};

/** O mesmo item na fotografia publicada, sem o que é só de dentro. */
export type ItemPublicado = { texto: string; responsavel: string | null };

/**
 * A fotografia que o link serve.
 *
 * Editar o rascunho depois não mexe nisto — só publicar de novo mexe.
 */
export type DiaPublicado = {
  versao: number;
  dia: string;
  autor: string | null;
  realizado: ItemPublicado[];
  em_andamento: ItemPublicado[];
  pendencias: ItemPublicado[];
  proximos_passos: ItemPublicado[];
  publicadoEm: string;
};

export function itensDaSecao(d: DiaPublicado, secao: Secao): ItemPublicado[] {
  return d[secao];
}

export function temConteudo(d: DiaPublicado): boolean {
  return SECOES.some(({ chave }) => d[chave].length > 0);
}

/**
 * "Reginato: confirmar o preço do rufo" vira dono + tarefa.
 *
 * Só serve para publicação antiga, de antes de `dia_itens.responsavel`
 * existir: lá o dono morava dentro do texto. A coluna vence sempre que
 * estiver preenchida — adivinhar por pontuação é o último recurso, não o
 * primeiro.
 */
export function separarResponsavel(item: ItemPublicado): ItemPublicado {
  if (item.responsavel) return item;

  const casou = item.texto.match(/^([^:]{2,40}):\s*(.+)$/);
  if (!casou) return item;

  const dono = casou[1].trim();
  if (!pareceNome(dono)) return item;

  return { texto: casou[2].trim(), responsavel: dono };
}

/**
 * Isto é nome de gente, ou é frase com dois-pontos no meio?
 *
 * Contar palavras não bastava: "Conferi tudo: a tabela, a proposta" tem duas
 * palavras antes do sinal e virava pastilha — o leitor via uma pessoa chamada
 * Conferi Tudo. Nome próprio em português começa com maiúscula em **todas** as
 * palavras, e verbo conjugado não. Três palavras é o teto: "José da Silva"
 * passa pelo `da` minúsculo, que é a exceção conhecida.
 */
function pareceNome(texto: string): boolean {
  if (semDono(texto)) return true;

  const palavras = texto.split(/\s+/);
  if (palavras.length > 3) return false;

  const LIGACAO = new Set(["da", "de", "do", "das", "dos", "e"]);
  return palavras.every(
    (p, i) => (i > 0 && LIGACAO.has(p)) || /^\p{Lu}/u.test(p),
  );
}

export function semDono(nome: string): boolean {
  return /^a\s+definir$/i.test(nome);
}

/** Texto multilinha vira lista, sem linha em branco. */
export function linhas(texto: string | null | undefined): string[] {
  return (texto ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    // O hífen digitado no começo da linha é hábito de quem escreve lista; a
    // página já desenha o marcador, e os dois juntos dariam "• - item".
    .map((l) => l.replace(/^[-*•]\s*/, ""))
    .filter(Boolean);
}
