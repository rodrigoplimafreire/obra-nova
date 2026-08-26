/**
 * Tipos do schema do Supabase, escritos à mão no formato que o supabase-js
 * espera. Espelham o projeto `obra-nova` (wnzdsqpsowxmistbnhca).
 *
 * Conferir contra o banco depois de qualquer migração:
 *   npx supabase gen types typescript --project-id wnzdsqpsowxmistbnhca
 */

type Tabelas = {
  /**
   * A empreiteira. `name` é a chave técnica — nasce como o e-mail e tem índice
   * único (ver `garantirOrg`). O que o cliente vê é `nome_exibicao`.
   */
  orgs: {
    Row: {
      id: string;
      name: string;
      created_at: string;
      nome_exibicao: string | null;
      documento: string | null;
      telefone: string | null;
      email_contato: string | null;
      /** Caminho no bucket público `marca`. */
      logo_caminho: string | null;
    };
    Insert: { id?: string; name: string; created_at?: string };
    Update: {
      name?: string;
      nome_exibicao?: string | null;
      documento?: string | null;
      telefone?: string | null;
      email_contato?: string | null;
      logo_caminho?: string | null;
    };
  };
  /**
   * Capacidade de console, separada da autorizacao de dados.
   *
   * `org_members` decide o que a pessoa le e escreve; esta tabela decide se
   * ela pode trocar de empreiteira e mexer em cota e cobranca. Sem `org_id`:
   * ser operador e global.
   */
  operadores: {
    Row: { user_id: string; criado_em: string };
    Insert: { user_id: string; criado_em?: string };
    Update: { criado_em?: string };
  };
  org_members: {
    Row: { org_id: string; user_id: string; created_at: string };
    Insert: { org_id: string; user_id: string; created_at?: string };
    Update: { org_id?: string; user_id?: string; created_at?: string };
  };
  obras: {
    Row: {
      id: string;
      org_id: string;
      nome: string;
      cliente_nome: string;
      endereco: string | null;
      marca_nome: string | null;
      ativa: boolean;
      created_at: string;
    };
    Insert: {
      id?: string;
      org_id: string;
      nome: string;
      cliente_nome: string;
      endereco?: string | null;
      marca_nome?: string | null;
      ativa?: boolean;
      created_at?: string;
    };
    Update: {
      id?: string;
      org_id?: string;
      nome?: string;
      cliente_nome?: string;
      endereco?: string | null;
      marca_nome?: string | null;
      ativa?: boolean;
      created_at?: string;
    };
  };
  mestres: {
    Row: {
      id: string;
      obra_id: string;
      nome: string;
      telefone: string | null;
      token: string;
      ativo: boolean;
      escritorio: boolean;
      created_at: string;
    };
    Insert: {
      id?: string;
      obra_id: string;
      nome: string;
      telefone?: string | null;
      token?: string;
      ativo?: boolean;
      escritorio?: boolean;
      created_at?: string;
    };
    Update: {
      id?: string;
      obra_id?: string;
      nome?: string;
      telefone?: string | null;
      token?: string;
      ativo?: boolean;
      escritorio?: boolean;
      created_at?: string;
    };
  };
  atividades: {
    Row: {
      id: string;
      obra_id: string;
      dia: string;
      position: number;
      titulo: string;
      detalhe: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      obra_id: string;
      dia: string;
      position: number;
      titulo: string;
      detalhe?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      obra_id?: string;
      dia?: string;
      position?: number;
      titulo?: string;
      detalhe?: string | null;
      created_at?: string;
    };
  };
  confirmacoes: {
    Row: {
      id: string;
      atividade_id: string;
      mestre_id: string;
      status: Database["public"]["Enums"]["confirmacao_status"];
      completed_at: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      atividade_id: string;
      mestre_id: string;
      status?: Database["public"]["Enums"]["confirmacao_status"];
      completed_at?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      atividade_id?: string;
      mestre_id?: string;
      status?: Database["public"]["Enums"]["confirmacao_status"];
      completed_at?: string | null;
      created_at?: string;
    };
  };
  confirmacao_blocos: {
    Row: {
      id: string;
      confirmacao_id: string;
      position: number;
      type: Database["public"]["Enums"]["block_type"];
      text_content: string | null;
      storage_path: string | null;
      mime_type: string | null;
      duration_ms: number | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      confirmacao_id: string;
      position: number;
      type: Database["public"]["Enums"]["block_type"];
      text_content?: string | null;
      storage_path?: string | null;
      mime_type?: string | null;
      duration_ms?: number | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      confirmacao_id?: string;
      position?: number;
      type?: Database["public"]["Enums"]["block_type"];
      text_content?: string | null;
      storage_path?: string | null;
      mime_type?: string | null;
      duration_ms?: number | null;
      created_at?: string;
    };
  };
  relatorios: {
    Row: {
      id: string;
      obra_id: string;
      inicio: string;
      fim: string;
      status: Database["public"]["Enums"]["relatorio_status"];
      provider: string | null;
      model: string | null;
      resultado: unknown | null;
      error: string | null;
      token: string;
      publicado_em: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      obra_id: string;
      inicio: string;
      fim: string;
      status?: Database["public"]["Enums"]["relatorio_status"];
      provider?: string | null;
      model?: string | null;
      resultado?: unknown | null;
      error?: string | null;
      token?: string;
      publicado_em?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      obra_id?: string;
      inicio?: string;
      fim?: string;
      status?: Database["public"]["Enums"]["relatorio_status"];
      provider?: string | null;
      model?: string | null;
      resultado?: unknown | null;
      error?: string | null;
      token?: string;
      publicado_em?: string | null;
      created_at?: string;
      updated_at?: string;
    };
  };
  transcripts: {
    Row: {
      id: string;
      confirmacao_bloco_id: string;
      provider: string;
      status: Database["public"]["Enums"]["transcript_status"];
      text: string | null;
      language: string | null;
      confidence: number | null;
      error: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      confirmacao_bloco_id: string;
      provider: string;
      status?: Database["public"]["Enums"]["transcript_status"];
      text?: string | null;
      language?: string | null;
      confidence?: number | null;
      error?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      confirmacao_bloco_id?: string;
      provider?: string;
      status?: Database["public"]["Enums"]["transcript_status"];
      text?: string | null;
      language?: string | null;
      confidence?: number | null;
      error?: string | null;
      created_at?: string;
      updated_at?: string;
    };
  };
};

/**
 * Módulo de orçamento. Prefixo `orc_` porque as tabelas nasceram como produto
 * separado antes de virar módulo daqui, e o prefixo continua útil: diz de
 * relance de qual dos dois assuntos a linha é.
 */
type TabelasDeOrcamento = {
  orc_orcamentos: {
    Row: {
      id: string;
      org_id: string;
      obra_id: string | null;
      numero: string | null;
      cliente_nome: string;
      cliente_contato: string | null;
      endereco: string | null;
      objeto: string | null;
      status: OrcStatus;
      prazo: string | null;
      pagamento: string | null;
      validade_dias: number;
      observacoes: string | null;
      /** Abertura do documento, no lugar do "Preparado para X". */
      apresentacao: string | null;
      /** Texto logo antes da tabela de custos. */
      intro_custos: string | null;
      /** Texto logo depois do total: o que está incluso, validade, pagamento. */
      nota_custos: string | null;
      /** Texto antes do botão de aceite. */
      intro_aceite: string | null;
      senha: string | null;
      token: string;
      /** Chave do tema visual do documento. Ver `lib/orcamento/marcas.ts`. */
      marca: string;
      /** BDI sugerido em %, ponto de partida do preço de venda por item. */
      bdi_padrao: number;
      valor_fechado: number | null;
      /** Eixo comercial, separado do `status` (preparo do documento). */
      situacao: OrcSituacao;
      visto_em: string | null;
      visto_ultima_em: string | null;
      aberturas: number;
      aprovado_em: string | null;
      /** Valor congelado no aceite. Base de qualquer cálculo de comissão. */
      valor_aprovado: number | null;
      recusado_em: string | null;
      motivo_recusa: string | null;
      criado_por: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      org_id: string;
      obra_id?: string | null;
      numero?: string | null;
      cliente_nome: string;
      cliente_contato?: string | null;
      endereco?: string | null;
      objeto?: string | null;
      status?: OrcStatus;
      prazo?: string | null;
      pagamento?: string | null;
      validade_dias?: number;
      observacoes?: string | null;
      apresentacao?: string | null;
      intro_custos?: string | null;
      nota_custos?: string | null;
      intro_aceite?: string | null;
      senha?: string | null;
      token?: string;
      marca?: string;
      bdi_padrao?: number;
      valor_fechado?: number | null;
      situacao?: OrcSituacao;
      criado_por?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      obra_id?: string | null;
      numero?: string | null;
      cliente_nome?: string;
      cliente_contato?: string | null;
      endereco?: string | null;
      objeto?: string | null;
      status?: OrcStatus;
      prazo?: string | null;
      pagamento?: string | null;
      validade_dias?: number;
      observacoes?: string | null;
      apresentacao?: string | null;
      intro_custos?: string | null;
      nota_custos?: string | null;
      intro_aceite?: string | null;
      senha?: string | null;
      marca?: string;
      bdi_padrao?: number;
      valor_fechado?: number | null;
      situacao?: OrcSituacao;
      visto_em?: string | null;
      visto_ultima_em?: string | null;
      aberturas?: number;
      aprovado_em?: string | null;
      valor_aprovado?: number | null;
      recusado_em?: string | null;
      motivo_recusa?: string | null;
      updated_at?: string;
    };
  };
  orc_eventos: {
    Row: {
      id: string;
      orcamento_id: string;
      tipo: OrcEventoTipo;
      usuario_id: string | null;
      detalhe: unknown;
      created_at: string;
    };
    Insert: {
      id?: string;
      orcamento_id: string;
      tipo: OrcEventoTipo;
      usuario_id?: string | null;
      detalhe?: unknown;
      created_at?: string;
    };
    Update: { detalhe?: unknown };
  };
  orc_perguntas: {
    Row: {
      id: string;
      orcamento_id: string;
      position: number;
      texto: string;
      porque: string | null;
      origem: OrcOrigem;
      removida_em: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      orcamento_id: string;
      position: number;
      texto: string;
      porque?: string | null;
      origem?: OrcOrigem;
      removida_em?: string | null;
      created_at?: string;
    };
    Update: {
      position?: number;
      texto?: string;
      porque?: string | null;
      origem?: OrcOrigem;
      removida_em?: string | null;
    };
  };
  orc_blocos: {
    Row: {
      id: string;
      orcamento_id: string;
      pergunta_id: string | null;
      position: number;
      type: OrcBlocoTipo;
      text_content: string | null;
      storage_path: string | null;
      mime_type: string | null;
      duration_ms: number | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      orcamento_id: string;
      pergunta_id?: string | null;
      position: number;
      type: OrcBlocoTipo;
      text_content?: string | null;
      storage_path?: string | null;
      mime_type?: string | null;
      duration_ms?: number | null;
      created_at?: string;
    };
    Update: {
      position?: number;
      text_content?: string | null;
      storage_path?: string | null;
      mime_type?: string | null;
      duration_ms?: number | null;
    };
  };
  orc_transcricoes: {
    Row: {
      id: string;
      bloco_id: string;
      provider: string;
      status: OrcTranscricaoStatus;
      text: string | null;
      language: string | null;
      error: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      bloco_id: string;
      provider: string;
      status?: OrcTranscricaoStatus;
      text?: string | null;
      language?: string | null;
      error?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      status?: OrcTranscricaoStatus;
      text?: string | null;
      language?: string | null;
      error?: string | null;
      updated_at?: string;
    };
  };
  orc_itens: {
    Row: {
      id: string;
      orcamento_id: string;
      grupo: string | null;
      position: number;
      descricao: string;
      quantidade: number | null;
      unidade: string | null;
      /** Preço de venda — o que o cliente final vê. */
      valor_unitario: number | null;
      /** Custo de tabela ou digitado à mão. NUNCA sai no documento do cliente. */
      custo_unitario: number | null;
      /** De qual composição da base este item veio, se veio. */
      composicao_id: string | null;
      /** Coluna gerada pelo banco: quantidade × valor_unitario. Só leitura. */
      total: number | null;
      origem: OrcOrigem;
      editado_em: string | null;
      removido_em: string | null;
      observacao: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      orcamento_id: string;
      grupo?: string | null;
      position: number;
      descricao: string;
      quantidade?: number | null;
      unidade?: string | null;
      valor_unitario?: number | null;
      custo_unitario?: number | null;
      composicao_id?: string | null;
      origem?: OrcOrigem;
      editado_em?: string | null;
      removido_em?: string | null;
      observacao?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      grupo?: string | null;
      position?: number;
      descricao?: string;
      quantidade?: number | null;
      unidade?: string | null;
      valor_unitario?: number | null;
      custo_unitario?: number | null;
      composicao_id?: string | null;
      origem?: OrcOrigem;
      editado_em?: string | null;
      removido_em?: string | null;
      observacao?: string | null;
      updated_at?: string;
    };
  };
  orc_bases_de_preco: {
    Row: {
      id: string;
      org_id: string;
      nome: string;
      fonte: OrcFonte;
      referencia: string | null;
      desonerada: boolean;
      ativa: boolean;
      linhas: number;
      criado_por: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      org_id: string;
      nome: string;
      fonte?: OrcFonte;
      referencia?: string | null;
      desonerada?: boolean;
      ativa?: boolean;
      linhas?: number;
      criado_por?: string | null;
      created_at?: string;
    };
    Update: {
      nome?: string;
      fonte?: OrcFonte;
      referencia?: string | null;
      desonerada?: boolean;
      ativa?: boolean;
      linhas?: number;
    };
  };
  orc_composicoes: {
    Row: {
      id: string;
      base_id: string;
      codigo: string | null;
      grupo: string | null;
      descricao: string;
      unidade: string | null;
      custo_unitario: number;
      created_at: string;
    };
    Insert: {
      id?: string;
      base_id: string;
      codigo?: string | null;
      grupo?: string | null;
      descricao: string;
      unidade?: string | null;
      custo_unitario: number;
      created_at?: string;
    };
    Update: {
      codigo?: string | null;
      grupo?: string | null;
      descricao?: string;
      unidade?: string | null;
      custo_unitario?: number;
    };
  };
  /**
   * Os blocos de texto que envolvem a tabela no documento: os cards de "O
   * projeto", a lista de observações técnicas e as etapas da obra. As três
   * têm a mesma forma — título e texto —, então o `tipo` separa em vez de
   * três tabelas iguais.
   */
  orc_secoes: {
    Row: {
      id: string;
      orcamento_id: string;
      tipo: OrcSecaoTipo;
      position: number;
      titulo: string;
      texto: string;
      origem: OrcOrigem;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      orcamento_id: string;
      tipo: OrcSecaoTipo;
      position?: number;
      titulo: string;
      texto: string;
      origem?: OrcOrigem;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      tipo?: OrcSecaoTipo;
      position?: number;
      titulo?: string;
      texto?: string;
      origem?: OrcOrigem;
      updated_at?: string;
    };
  };
  orc_publicacoes: {
    Row: {
      id: string;
      orcamento_id: string;
      versao: number;
      dados: unknown;
      publicado_por: string | null;
      publicado_em: string;
    };
    Insert: {
      id?: string;
      orcamento_id: string;
      versao: number;
      dados: unknown;
      publicado_por?: string | null;
      publicado_em?: string;
    };
    Update: { dados?: unknown };
  };
  orc_geracoes: {
    Row: {
      id: string;
      orcamento_id: string;
      etapa: OrcGeracaoEtapa;
      status: OrcGeracaoStatus;
      provider: string | null;
      model: string | null;
      resultado: unknown;
      error: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      orcamento_id: string;
      etapa: OrcGeracaoEtapa;
      status?: OrcGeracaoStatus;
      provider?: string | null;
      model?: string | null;
      resultado?: unknown;
      error?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      status?: OrcGeracaoStatus;
      provider?: string | null;
      model?: string | null;
      resultado?: unknown;
      error?: string | null;
      updated_at?: string;
    };
  };
  /**
   * Transcrição avulsa: o áudio que chegou por fora do app, quase sempre do
   * WhatsApp. Nasce antes de existir orçamento e pode nunca virar um, por isso
   * tem tabela própria em vez de pendurar em `orc_blocos`.
   */
  transcricoes: {
    Row: {
      id: string;
      org_id: string;
      titulo: string | null;
      /** Nome do arquivo como veio, para reconhecer antes de transcrever. */
      arquivo_nome: string | null;
      storage_path: string;
      mime_type: string | null;
      duracao_ms: number | null;
      tamanho_bytes: number | null;
      status: TranscricaoStatus;
      texto: string | null;
      /** Carimba a mão humana: retranscrever não atropela correção feita. */
      editado_em: string | null;
      erro: string | null;
      /** Para onde este texto já foi, se virou orçamento. */
      orcamento_id: string | null;
      criado_por: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      org_id: string;
      titulo?: string | null;
      arquivo_nome?: string | null;
      storage_path: string;
      mime_type?: string | null;
      duracao_ms?: number | null;
      tamanho_bytes?: number | null;
      status?: TranscricaoStatus;
      texto?: string | null;
      erro?: string | null;
      criado_por?: string | null;
    };
    Update: {
      titulo?: string | null;
      status?: TranscricaoStatus;
      texto?: string | null;
      editado_em?: string | null;
      erro?: string | null;
      orcamento_id?: string | null;
      updated_at?: string;
    };
  };
};

type TranscricaoStatus = "pendente" | "transcrevendo" | "pronta" | "falhou";

type OrcStatus =
  | "briefing"
  | "perguntas"
  | "respondido"
  | "conferindo"
  | "publicado"
  | "arquivado";
type OrcOrigem = "ia" | "humano";
/** `projeto` abre o documento, `observacao` fecha, `etapa` é a linha do tempo. */
type OrcSecaoTipo = "projeto" | "observacao" | "etapa";
type OrcBlocoTipo = "text" | "audio" | "image";
type OrcTranscricaoStatus = "pending" | "done" | "failed";
type OrcGeracaoEtapa = "perguntas" | "orcamento";
type OrcGeracaoStatus = "rodando" | "pronto" | "falhou";
type OrcFonte = "sinapi" | "seinfra" | "propria" | "outra";
type OrcSituacao =
  | "rascunho"
  | "enviado"
  | "visto"
  | "negociando"
  | "aprovado"
  | "recusado"
  | "expirado";
type OrcEventoTipo =
  | "publicado"
  | "aberto"
  | "aceito"
  | "recusado"
  | "republicado"
  | "despublicado";

/** A linha que `orc_buscar_composicoes` devolve — a RPC de busca no editor. */
export type LinhaDeBusca = {
  id: string;
  base_id: string;
  base_nome: string;
  fonte: OrcFonte;
  codigo: string | null;
  grupo: string | null;
  descricao: string;
  unidade: string | null;
  custo_unitario: number;
  sim: number;
};

/**
 * O supabase-js exige `Relationships` em cada tabela para resolver os tipos de
 * select. Como aqui não há select aninhado, um array vazio basta.
 */
export type Database = {
  public: {
    Tables: {
      [K in keyof (Tabelas & TabelasDeOrcamento)]: (Tabelas &
        TabelasDeOrcamento)[K] & { Relationships: [] };
    };
    Views: Record<never, never>;
    Functions: {
      gerar_token: { Args: never; Returns: string };
      orc_buscar_composicoes: {
        Args: { p_org_id: string; p_consulta: string; p_limite?: number };
        Returns: LinhaDeBusca[];
      };
    };
    Enums: {
      block_type: "text" | "audio" | "image";
      confirmacao_status: "pendente" | "feita" | "parcial" | "nao_feita";
      relatorio_status: "rascunho" | "gerando" | "pronto" | "falhou";
      transcript_status: "pending" | "done" | "failed";
      orc_status: OrcStatus;
      orc_origem: OrcOrigem;
      transcricao_status: TranscricaoStatus;
      orc_secao_tipo: OrcSecaoTipo;
      orc_bloco_tipo: OrcBlocoTipo;
      orc_transcricao_status: OrcTranscricaoStatus;
      orc_geracao_etapa: OrcGeracaoEtapa;
      orc_geracao_status: OrcGeracaoStatus;
      orc_fonte_de_preco: OrcFonte;
      orc_situacao: OrcSituacao;
      orc_evento_tipo: OrcEventoTipo;
    };
    CompositeTypes: Record<never, never>;
  };
};

type Public = Database["public"];

export type Tables<T extends keyof Public["Tables"]> =
  Public["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Public["Tables"]> =
  Public["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Public["Tables"]> =
  Public["Tables"][T]["Update"];
export type Enums<T extends keyof Public["Enums"]> = Public["Enums"][T];
