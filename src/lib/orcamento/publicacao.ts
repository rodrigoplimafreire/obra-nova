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

/**
 * Uma foto ou o vídeo da situação atual, congelados junto com o resto.
 *
 * A URL é gravada aqui, e não montada na leitura: o documento publicado é uma
 * cópia, e tem que continuar mostrando a mesma foto mesmo que alguém troque a
 * mídia do orçamento depois. É a mesma razão de o preço ser copiado.
 */
export type MidiaPublicada = {
  tipo: "foto" | "video";
  url: string;
  legenda: string | null;
};

/**
 * Uma opção de material, com os seus itens e o seu total.
 *
 * Dois jeitos de fazer a mesma obra, e o cliente escolhe. Os itens vêm aqui
 * dentro, e não soltos com um id de opção: o documento publicado é uma cópia
 * para ler, e um id que aponta para outra lista é uma junção que a folha de
 * leitura teria de refazer.
 */
export type OpcaoPublicada = {
  nome: string;
  descricao: string | null;
  itens: ItemPublicado[];
  total: number;
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
  /** Fotos e vídeo da situação atual. Vazio = a seção não aparece. */
  midias: MidiaPublicada[];
  /**
   * Congelado junto com o resto: se a tarja saísse de uma consulta ao vivo, o
   * documento que o cliente já leu mudaria de aviso sem republicação.
   */
  preliminar: boolean;
  /** Vazio = tabela única. Com opções, a tabela vira abas e cada uma soma a sua. */
  opcoes: OpcaoPublicada[];
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
  /** Nulo = item comum, que entra em todas as opções. */
  opcaoId: string | null;
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
  midias: MidiaPublicada[];
  preliminar: boolean;
  opcoes: Array<{ id: string; nome: string; descricao: string | null }>;
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
    midias: orcamento.midias.map((m) => ({
      tipo: m.tipo,
      url: m.url,
      legenda: m.legenda,
    })),
    preliminar: orcamento.preliminar,
    // Cada opção leva os seus itens e o seu total. Item sem opção entra em
    // todas: é serviço que acontece qualquer que seja a escolha.
    opcoes: orcamento.opcoes.map((o) => {
      const meus = vivos.filter((i) => i.opcaoId === o.id || i.opcaoId === null);
      return {
        nome: o.nome,
        descricao: o.descricao,
        itens: meus.map((i) => ({
          grupo: i.grupo,
          descricao: i.descricao,
          quantidade: i.quantidade,
          unidade: i.unidade,
          valorUnitario: i.valorUnitario,
          total: i.total,
          observacao: i.observacao,
        })),
        total: meus.reduce((acc, i) => acc + (i.total ?? 0), 0),
      };
    }),
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

  const midias = Array.isArray(d.midias)
    ? d.midias.flatMap((linha): MidiaPublicada[] => {
        if (!linha || typeof linha !== "object") return [];
        const m = linha as Record<string, unknown>;
        const url = texto(m.url);
        if (!url) return [];
        return [
          {
            tipo: m.tipo === "video" ? "video" : "foto",
            url,
            legenda: texto(m.legenda),
          },
        ];
      })
    : [];

  const opcoes = Array.isArray(d.opcoes)
    ? d.opcoes.flatMap((linha): OpcaoPublicada[] => {
        if (!linha || typeof linha !== "object") return [];
        const o = linha as Record<string, unknown>;
        const nome = texto(o.nome);
        if (!nome) return [];
        const seus = Array.isArray(o.itens)
          ? o.itens.flatMap((x): ItemPublicado[] => {
              if (!x || typeof x !== "object") return [];
              const i = x as Record<string, unknown>;
              const descricao = texto(i.descricao);
              if (!descricao) return [];
              return [
                {
                  grupo: texto(i.grupo),
                  descricao,
                  quantidade: numero(i.quantidade),
                  unidade: texto(i.unidade),
                  valorUnitario: numero(i.valorUnitario),
                  total: numero(i.total),
                  observacao: texto(i.observacao),
                },
              ];
            })
          : [];
        return [
          {
            nome,
            descricao: texto(o.descricao),
            itens: seus,
            total: numero(o.total) ?? seus.reduce((a, i) => a + (i.total ?? 0), 0),
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
    midias,
    // Publicação antiga não tem o campo, e o que ela era é definitiva.
    preliminar: d.preliminar === true,
    opcoes,
    total: numero(d.total) ?? 0,
    valorFechado: numero(d.valorFechado),
    publicadoEm: texto(d.publicadoEm) ?? new Date().toISOString(),
  };
}
