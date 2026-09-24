import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { orgAtual } from "@/lib/admin/sessao";

/**
 * A Biblioteca: tudo o que a empreiteira já orçou, num lugar só.
 *
 * Não é uma tabela nova. É uma **leitura** de `orc_itens` — cada serviço que
 * já saiu num orçamento, agrupado pela descrição. Fazer disto uma tabela
 * própria criaria um segundo lugar para a verdade morar, e o dia em que o
 * Rodrigo corrigisse o preço de um item no orçamento a Biblioteca continuaria
 * mostrando o antigo.
 *
 * **O que fica de fora, e por quê:**
 *
 * - **Orçamento arquivado.** É quase sempre a versão anterior de um orçamento
 *   que continua vivo com outro id; entraria aqui duplicando o mesmo serviço
 *   com o preço velho.
 * - **Registro de teste.** "TESTE", "Teste colar MD", "Teste mobile" têm preço
 *   digitado na hora de experimentar a tela. É exatamente o tipo de número que
 *   não pode virar referência de preço.
 * - **Item removido.** `removido_em` preenchido é item que o Rodrigo tirou do
 *   orçamento.
 *
 * O preço não é média nem sugestão: são as **ocorrências reais**, cada uma com
 * o cliente e a data. Quem consulta precisa poder perguntar "de quando é este
 * preço, e de que obra" — média de dois orçamentos separados por um ano é
 * número bonito e inútil.
 */

/** Uma vez que o serviço apareceu num orçamento. */
export type Ocorrencia = {
  cliente: string;
  /** Token do orçamento, para o link. */
  token: string;
  orcamentoId: string;
  quantidade: number | null;
  unidade: string | null;
  valorUnitario: number | null;
  total: number | null;
  em: string;
};

/** Um serviço do vocabulário da empreiteira, com tudo o que já se cobrou por ele. */
export type ServicoDaBiblioteca = {
  /** A descrição, normalizada só para agrupar — a exibida é a mais recente. */
  chave: string;
  descricao: string;
  /** Grupos em que este serviço já apareceu. */
  grupos: string[];
  /** Unidade mais frequente. */
  unidade: string | null;
  ocorrencias: Ocorrencia[];
  /** Quantas vezes já foi orçado. */
  vezes: number;
  /** Menor e maior preço unitário já praticado. Nulos quando nenhum tem preço. */
  menorUnitario: number | null;
  maiorUnitario: number | null;
  /** O preço unitário mais recente, que é o que interessa para orçar hoje. */
  ultimoUnitario: number | null;
  ultimoEm: string | null;
};

/**
 * Descrições iguais escritas diferente são o mesmo serviço.
 *
 * Tira acento, caixa, pontuação e espaço dobrado. Não tenta ser esperta além
 * disso: "pintura" e "pintura de parede" continuam separados, e devem — o
 * preço de um não serve para o outro.
 */
function normalizar(descricao: string): string {
  return descricao
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const EH_TESTE = /\btestes?\b/i;

export async function listarBiblioteca(): Promise<ServicoDaBiblioteca[]> {
  const sb = supabaseAdmin();
  const org = await orgAtual();

  const { data: orcamentos } = await sb
    .from("orc_orcamentos")
    .select("id, token, cliente_nome, created_at")
    .eq("org_id", org)
    .neq("status", "arquivado");

  const validos = (orcamentos ?? []).filter((o) => !EH_TESTE.test(o.cliente_nome));
  if (validos.length === 0) return [];

  const porId = new Map(validos.map((o) => [o.id, o]));

  const { data: itens } = await sb
    .from("orc_itens")
    .select(
      "orcamento_id, grupo, descricao, quantidade, unidade, valor_unitario, total, created_at",
    )
    .in(
      "orcamento_id",
      validos.map((o) => o.id),
    )
    .is("removido_em", null);

  const mapa = new Map<string, ServicoDaBiblioteca>();

  for (const item of itens ?? []) {
    const orcamento = porId.get(item.orcamento_id);
    if (!orcamento) continue;

    const chave = normalizar(item.descricao);
    if (!chave) continue;

    let servico = mapa.get(chave);
    if (!servico) {
      servico = {
        chave,
        descricao: item.descricao,
        grupos: [],
        unidade: null,
        ocorrencias: [],
        vezes: 0,
        menorUnitario: null,
        maiorUnitario: null,
        ultimoUnitario: null,
        ultimoEm: null,
      };
      mapa.set(chave, servico);
    }

    if (item.grupo && !servico.grupos.includes(item.grupo)) {
      servico.grupos.push(item.grupo);
    }

    servico.ocorrencias.push({
      cliente: orcamento.cliente_nome,
      token: orcamento.token,
      orcamentoId: orcamento.id,
      quantidade: item.quantidade != null ? Number(item.quantidade) : null,
      unidade: item.unidade,
      valorUnitario: item.valor_unitario != null ? Number(item.valor_unitario) : null,
      total: item.total != null ? Number(item.total) : null,
      em: orcamento.created_at,
    });
  }

  for (const servico of mapa.values()) {
    // Mais recente primeiro: é o preço que serve para orçar hoje.
    servico.ocorrencias.sort((a, b) => b.em.localeCompare(a.em));
    servico.vezes = servico.ocorrencias.length;
    servico.descricao =
      servico.ocorrencias[0] && servico.ocorrencias.length > 1
        ? servico.descricao
        : servico.descricao;

    const unidades = servico.ocorrencias
      .map((o) => o.unidade)
      .filter((u): u is string => Boolean(u));
    servico.unidade = unidades[0] ?? null;

    const precos = servico.ocorrencias
      .map((o) => o.valorUnitario)
      .filter((v): v is number => v != null);

    if (precos.length > 0) {
      servico.menorUnitario = Math.min(...precos);
      servico.maiorUnitario = Math.max(...precos);
      const recente = servico.ocorrencias.find((o) => o.valorUnitario != null)!;
      servico.ultimoUnitario = recente.valorUnitario;
      servico.ultimoEm = recente.em;
    }
  }

  // Com preço primeiro — é o que se vem buscar aqui —, depois por quantas
  // vezes já foi orçado, e só então em ordem alfabética.
  return [...mapa.values()].sort((a, b) => {
    const pa = a.ultimoUnitario != null ? 1 : 0;
    const pb = b.ultimoUnitario != null ? 1 : 0;
    if (pa !== pb) return pb - pa;
    if (a.vezes !== b.vezes) return b.vezes - a.vezes;
    return a.descricao.localeCompare(b.descricao, "pt-BR");
  });
}
