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

/**
 * Uma macroetapa do resumo orçamentário. Congelada junto com o resto: o
 * cliente precisa poder confiar que o prazo que ele leu é o que foi combinado.
 */
export type ModuloPublicado = {
  nome: string;
  prazo: string | null;
  valor: number | null;
  percentual: number | null;
};

/** Uma semana do cronograma executivo físico-financeiro. */
export type SemanaPublicada = {
  semana: number;
  titulo: string | null;
  fisico: string | null;
  financeiro: number | null;
  marco: string | null;
  critico: boolean;
};

export type DocumentoPublicado = {
  versao: number;
  numero: string | null;
  cliente: string;
  clienteContato: string | null;
  endereco: string | null;
  objeto: string | null;
  prazo: string | null;
  /** Percentual pago no início. Nulo = à vista, sem seção de pagamento. */
  entradaPercentual: number | null;
  /** Em quantas parcelas. 2 = entrada + final; acima disso, iguais. */
  parcelas: number;
  pagamento: string | null;
  validadeDias: number;
  observacoes: string | null;
  marca: string;
  itens: ItemPublicado[];
  textos: TextosPublicados;
  secoes: SecaoPublicada[];
  /** Seção 2. Vazio = a seção não aparece no documento. */
  modulos: ModuloPublicado[];
  /** Seção 4. Vazio = a seção não aparece no documento. */
  cronograma: SemanaPublicada[];
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
  /** Percentual pago no início. Nulo = à vista, sem seção de pagamento. */
  entradaPercentual: number | null;
  /** Em quantas parcelas. 2 = entrada + final; acima disso, iguais. */
  parcelas: number;
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
  modulos: ModuloPublicado[];
  cronograma: SemanaPublicada[];
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
    entradaPercentual: orcamento.entradaPercentual,
    parcelas: orcamento.parcelas,
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
    // Remapeados campo a campo pelo mesmo motivo das seções: a origem carrega
    // `id` e `position`, que são do editor.
    modulos: orcamento.modulos.map((m) => ({
      nome: m.nome,
      prazo: m.prazo,
      valor: m.valor,
      percentual: m.percentual,
    })),
    cronograma: orcamento.cronograma.map((c) => ({
      semana: c.semana,
      titulo: c.titulo,
      fisico: c.fisico,
      financeiro: c.financeiro,
      marco: c.marco,
      critico: c.critico,
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

  // Publicação anterior a esta funcionalidade não tem nenhum dos dois, e o
  // documento simplesmente não mostra as seções — que é o mesmo comportamento
  // de um orçamento novo em que ninguém preencheu.
  const modulos = Array.isArray(d.modulos)
    ? d.modulos.flatMap((linha): ModuloPublicado[] => {
        if (!linha || typeof linha !== "object") return [];
        const m = linha as Record<string, unknown>;
        const nome = texto(m.nome);
        if (!nome) return [];
        return [
          {
            nome,
            prazo: texto(m.prazo),
            valor: numero(m.valor),
            percentual: numero(m.percentual),
          },
        ];
      })
    : [];

  const cronograma = Array.isArray(d.cronograma)
    ? d.cronograma.flatMap((linha): SemanaPublicada[] => {
        if (!linha || typeof linha !== "object") return [];
        const c = linha as Record<string, unknown>;
        const semana = numero(c.semana);
        if (semana === null) return [];
        return [
          {
            semana,
            titulo: texto(c.titulo),
            fisico: texto(c.fisico),
            financeiro: numero(c.financeiro),
            marco: texto(c.marco),
            critico: c.critico === true,
          },
        ];
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
    entradaPercentual: numero(d.entradaPercentual),
    // Publicação antiga não tem o campo, e o que ela combinou foi duas.
    parcelas: numero(d.parcelas) ?? 2,
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
    modulos,
    cronograma,
    total: numero(d.total) ?? 0,
    valorFechado: numero(d.valorFechado),
    publicadoEm: texto(d.publicadoEm) ?? new Date().toISOString(),
  };
}
