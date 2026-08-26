import "server-only";

/**
 * O documento que vai ao cliente.
 *
 * Este arquivo existe por uma razão só, e ela é de segurança, não de
 * organização: **é aqui que o custo é deixado para trás**. A fotografia
 * publicada não carrega `custo_unitario`, nem margem, nem BDI. A garantia não
 * é "o template não renderiza" — é que o dado nunca entra no objeto que vira
 * `orc_publicacoes.dados`.
 *
 * Se um dia alguém montar outra tela de leitura do documento, ela vai ler
 * daqui e continuar sem acesso ao custo.
 */

/** Item como o cliente vê: descrição, medida e preço de venda. Só isso. */
export type ItemPublicado = {
  grupo: string | null;
  descricao: string;
  quantidade: number | null;
  unidade: string | null;
  valorUnitario: number | null;
  total: number | null;
  observacao: string | null;
};

/** Bloco de texto com título: card do projeto, observação técnica ou etapa. */
export type SecaoPublicada = {
  tipo: "projeto" | "observacao" | "etapa";
  titulo: string;
  texto: string;
};

/**
 * Os textos que envolvem a tabela.
 *
 * Todos opcionais. Orçamento sem nenhum publica como sempre publicou, e o
 * documento cai nas frases genéricas — a funcionalidade não obriga ninguém a
 * escrever para poder enviar.
 */
export type TextosPublicados = {
  apresentacao: string | null;
  introCustos: string | null;
  notaCustos: string | null;
  introAceite: string | null;
};

export type DocumentoPublicado = {
  versao: number;
  numero: string | null;
  cliente: string;
  clienteContato: string | null;
  endereco: string | null;
  objeto: string | null;
  prazo: string | null;
  pagamento: string | null;
  validadeDias: number;
  observacoes: string | null;
  marca: string;
  itens: ItemPublicado[];
  textos: TextosPublicados;
  secoes: SecaoPublicada[];
  /** Soma dos itens, ou o preço fechado quando o orçamento é de valor único. */
  total: number;
  valorFechado: number | null;
  publicadoEm: string;
};

type ItemDeOrigem = {
  grupo: string | null;
  descricao: string;
  quantidade: number | null;
  unidade: string | null;
  valorUnitario: number | null;
  total: number | null;
  observacao: string | null;
  removidoEm: string | null;
};

type OrcamentoDeOrigem = {
  numero: string | null;
  cliente: string;
  clienteContato: string | null;
  endereco: string | null;
  objeto: string | null;
  prazo: string | null;
  pagamento: string | null;
  validadeDias: number;
  observacoes: string | null;
  marca: string;
  valorFechado: number | null;
  itens: ItemDeOrigem[];
  apresentacao: string | null;
  introCustos: string | null;
  notaCustos: string | null;
  introAceite: string | null;
  secoes: SecaoPublicada[];
};

/**
 * Monta o documento a partir do rascunho.
 *
 * Recebe o orçamento já carregado e devolve só o que é público. Note que a
 * assinatura de `ItemDeOrigem` não tem `custoUnitario`: mesmo que a chamada
 * passe um objeto mais gordo, o TypeScript ignora o excedente e nenhuma linha
 * abaixo consegue alcançá-lo.
 */
export function montarDocumento(
  orcamento: OrcamentoDeOrigem,
  versao: number,
): DocumentoPublicado {
  const vivos = orcamento.itens.filter((i) => !i.removidoEm);

  const itens: ItemPublicado[] = vivos.map((i) => ({
    grupo: i.grupo,
    descricao: i.descricao,
    quantidade: i.quantidade,
    unidade: i.unidade,
    valorUnitario: i.valorUnitario,
    total: i.total,
    observacao: i.observacao,
  }));

  const soma = itens.reduce((acc, i) => acc + (i.total ?? 0), 0);

  return {
    versao,
    numero: orcamento.numero,
    cliente: orcamento.cliente,
    clienteContato: orcamento.clienteContato,
    endereco: orcamento.endereco,
    objeto: orcamento.objeto,
    prazo: orcamento.prazo,
    pagamento: orcamento.pagamento,
    validadeDias: orcamento.validadeDias,
    observacoes: orcamento.observacoes,
    marca: orcamento.marca,
    itens,
    textos: {
      apresentacao: orcamento.apresentacao,
      introCustos: orcamento.introCustos,
      notaCustos: orcamento.notaCustos,
      introAceite: orcamento.introAceite,
    },
    // Remapeado campo a campo, e não repassado direto: a origem carrega
    // `id`, `position` e `origem`, que são do editor e não têm o que fazer
    // no documento do cliente. Mesma disciplina do custo.
    secoes: orcamento.secoes.map((s) => ({
      tipo: s.tipo,
      titulo: s.titulo,
      texto: s.texto,
    })),
    total: orcamento.valorFechado ?? soma,
    valorFechado: orcamento.valorFechado,
    publicadoEm: new Date().toISOString(),
  };
}

/**
 * Rede de segurança para leitura: o JSON gravado é `unknown` do ponto de vista
 * do TypeScript, e uma publicação antiga pode ter formato diferente. Em vez de
 * confiar num cast, normaliza o que veio e descarta qualquer campo que não
 * esteja no contrato — inclusive um `custoUnitario` que tenha vazado numa
 * versão anterior do código.
 */
export function lerDocumento(bruto: unknown): DocumentoPublicado | null {
  if (!bruto || typeof bruto !== "object") return null;
  const d = bruto as Record<string, unknown>;
  if (typeof d.cliente !== "string") return null;

  const texto = (v: unknown): string | null =>
    typeof v === "string" && v.length > 0 ? v : null;
  const numero = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

  const itens = Array.isArray(d.itens)
    ? d.itens.flatMap((linha): ItemPublicado[] => {
        if (!linha || typeof linha !== "object") return [];
        const i = linha as Record<string, unknown>;
        if (typeof i.descricao !== "string") return [];
        return [
          {
            grupo: texto(i.grupo),
            descricao: i.descricao,
            quantidade: numero(i.quantidade),
            unidade: texto(i.unidade),
            valorUnitario: numero(i.valorUnitario),
            total: numero(i.total),
            observacao: texto(i.observacao),
          },
        ];
      })
    : [];

  // Publicação anterior a esta funcionalidade não tem `textos` nem `secoes`.
  // Voltam vazios, e o documento cai nas frases genéricas de sempre.
  const t = (d.textos ?? {}) as Record<string, unknown>;

  const TIPOS = ["projeto", "observacao", "etapa"] as const;
  const secoes = Array.isArray(d.secoes)
    ? d.secoes.flatMap((linha): SecaoPublicada[] => {
        if (!linha || typeof linha !== "object") return [];
        const s = linha as Record<string, unknown>;
        const tipo = TIPOS.find((x) => x === s.tipo);
        const titulo = texto(s.titulo);
        const corpo = texto(s.texto);
        if (!tipo || !titulo || !corpo) return [];
        return [{ tipo, titulo, texto: corpo }];
      })
    : [];

  return {
    versao: numero(d.versao) ?? 1,
    numero: texto(d.numero),
    cliente: d.cliente,
    clienteContato: texto(d.clienteContato),
    endereco: texto(d.endereco),
    objeto: texto(d.objeto),
    prazo: texto(d.prazo),
    pagamento: texto(d.pagamento),
    validadeDias: numero(d.validadeDias) ?? 15,
    observacoes: texto(d.observacoes),
    marca: texto(d.marca) ?? "rd",
    itens,
    textos: {
      apresentacao: texto(t.apresentacao),
      introCustos: texto(t.introCustos),
      notaCustos: texto(t.notaCustos),
      introAceite: texto(t.introAceite),
    },
    secoes,
    total: numero(d.total) ?? 0,
    valorFechado: numero(d.valorFechado),
    publicadoEm: texto(d.publicadoEm) ?? new Date().toISOString(),
  };
}
