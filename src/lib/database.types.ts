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
      /** Conta que recebe o pagamento. Aparece no documento do cliente. */
      banco_titular: string | null;
      banco_documento: string | null;
      banco_nome: string | null;
      banco_agencia: string | null;
      banco_conta: string | null;
      banco_pix: string | null;
      /** As cláusulas que fazem do orçamento uma proposta comercial. */
      responsavel_tecnico: string | null;
      horario_trabalho: string | null;
      garantia_solidez_anos: number | null;
      garantia_acabamento_anos: number | null;
      emite_art: boolean;
      /** Uma norma por linha. */
      normas_tecnicas: string | null;
      /** Um parágrafo por linha. */
      clausulas_extras: string | null;
    };
    Insert: {
      id?: string;
      name: string;
      created_at?: string;
      nome_exibicao?: string | null;
    };
    Update: {
      name?: string;
      nome_exibicao?: string | null;
      documento?: string | null;
      telefone?: string | null;
      email_contato?: string | null;
      logo_caminho?: string | null;
      banco_titular?: string | null;
      banco_documento?: string | null;
      banco_nome?: string | null;
      banco_agencia?: string | null;
      banco_conta?: string | null;
      banco_pix?: string | null;
      responsavel_tecnico?: string | null;
      horario_trabalho?: string | null;
      garantia_solidez_anos?: number | null;
      garantia_acabamento_anos?: number | null;
      emite_art?: boolean;
      normas_tecnicas?: string | null;
      clausulas_extras?: string | null;
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
  acessos: {
    Row: {
      email: string;
      nota: string | null;
      org_id: string | null;
      criado_em: string;
      criado_por: string | null;
    };
    Insert: {
      email: string;
      nota?: string | null;
      org_id?: string | null;
      criado_em?: string;
      criado_por?: string | null;
    };
    Update: { nota?: string | null; org_id?: string | null };
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
      /** Percentual pago no início. O resto na entrega. Nulo = à vista. */
      entrada_percentual: number | null;
      /** Quantas parcelas. 2 = entrada + final; mais que isso, iguais. */
      parcelas: number;
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
      entrada_percentual?: number | null;
      parcelas?: number;
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
      entrada_percentual?: number | null;
      parcelas?: number;
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
  orc_modulos: {
    Row: {
      id: string;
      orcamento_id: string;
      position: number;
      nome: string;
      prazo: string | null;
      valor: number | null;
      percentual: number | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      orcamento_id: string;
      position: number;
      nome: string;
      prazo?: string | null;
      valor?: number | null;
      percentual?: number | null;
    };
    Update: {
      position?: number;
      nome?: string;
      prazo?: string | null;
      valor?: number | null;
      percentual?: number | null;
      updated_at?: string;
    };
  };
  orc_cronograma: {
    Row: {
      id: string;
      orcamento_id: string;
      semana: number;
      titulo: string | null;
      fisico: string | null;
      financeiro: number | null;
      marco: string | null;
      critico: boolean;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      orcamento_id: string;
      semana: number;
      titulo?: string | null;
      fisico?: string | null;
      financeiro?: number | null;
      marco?: string | null;
      critico?: boolean;
    };
    Update: {
      semana?: number;
      titulo?: string | null;
      fisico?: string | null;
      financeiro?: number | null;
      marco?: string | null;
      critico?: boolean;
      updated_at?: string;
    };
  };
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
 * Pipeline de pedidos de orçamento e tempo por etapa.
 *
 * Os estados e as etapas são `text` com `check` no banco, e não enum: o PRD
 * ainda vai mexer nessa lista conforme o funil real aparecer, e trocar um
 * `check` é uma migração, trocar um enum é um ritual.
 */
type PipeEstado =
  | "novo_pedido"
  | "em_estudo"
  | "estudo_entregue"
  | "orcamento_em_producao"
  | "orcamento_enviado"
  | "fechado"
  | "perdido"
  | "congelado";

type PipeEtapa =
  | "deslocamento"
  | "visita_tecnica"
  | "estudo_projeto"
  | "planilha_custos"
  | "formatacao_proposta"
  | "outro";

type PipeTipoDeObra =
  | "reforma"
  | "construcao_zero"
  | "projeto_estrutural"
  | "gestao_obra";

type PipeOrigem =
  | "indicacao"
  | "google"
  | "meta"
  | "instagram"
  | "site"
  | "outro";

type TabelasDePipeline = {
  pipe_pedidos: {
    Row: {
      id: string;
      org_id: string;
      /** Documento gerado a partir deste pedido. Nulo até existir. */
      orcamento_id: string | null;
      /** Número curto por empreiteira (#42), atribuído por trigger. */
      codigo: number;
      cliente_nome: string;
      cliente_telefone: string | null;
      tipo_obra: PipeTipoDeObra | null;
      bairro: string | null;
      origem_lead: PipeOrigem | null;
      porte: "P" | "M" | "G" | null;
      status: PipeEstado;
      data_pedido: string;
      estudo_cobrado: boolean;
      estudo_valor: number | null;
      estudo_abatido: boolean;
      data_entrega_estudo: string | null;
      data_envio_orcamento: string | null;
      valor_orcado: number | null;
      valor_fechado: number | null;
      motivo_perda: string | null;
      observacoes: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      org_id: string;
      orcamento_id?: string | null;
      codigo?: number;
      cliente_nome: string;
      cliente_telefone?: string | null;
      tipo_obra?: PipeTipoDeObra | null;
      bairro?: string | null;
      origem_lead?: PipeOrigem | null;
      porte?: "P" | "M" | "G" | null;
      status?: PipeEstado;
      data_pedido?: string;
      estudo_cobrado?: boolean;
      estudo_valor?: number | null;
      estudo_abatido?: boolean;
      data_entrega_estudo?: string | null;
      data_envio_orcamento?: string | null;
      valor_orcado?: number | null;
      valor_fechado?: number | null;
      motivo_perda?: string | null;
      observacoes?: string | null;
    };
    Update: {
      orcamento_id?: string | null;
      cliente_nome?: string;
      cliente_telefone?: string | null;
      tipo_obra?: PipeTipoDeObra | null;
      bairro?: string | null;
      origem_lead?: PipeOrigem | null;
      porte?: "P" | "M" | "G" | null;
      status?: PipeEstado;
      estudo_cobrado?: boolean;
      estudo_valor?: number | null;
      estudo_abatido?: boolean;
      data_entrega_estudo?: string | null;
      data_envio_orcamento?: string | null;
      valor_orcado?: number | null;
      valor_fechado?: number | null;
      motivo_perda?: string | null;
      observacoes?: string | null;
      updated_at?: string;
    };
  };

  pipe_eventos: {
    Row: {
      id: string;
      pedido_id: string;
      status_anterior: PipeEstado | null;
      status_novo: PipeEstado;
      changed_by: string | null;
      changed_at: string;
    };
    Insert: {
      pedido_id: string;
      status_anterior?: PipeEstado | null;
      status_novo: PipeEstado;
      changed_by?: string | null;
    };
    Update: { changed_by?: string | null };
  };

  pipe_tempos: {
    Row: {
      id: string;
      org_id: string;
      pedido_id: string;
      etapa: PipeEtapa;
      minutos: number;
      km: number | null;
      fonte: "cronometro" | "manual";
      nota: string | null;
      registrado_por: string | null;
      data: string;
      created_at: string;
    };
    Insert: {
      org_id: string;
      pedido_id: string;
      etapa: PipeEtapa;
      minutos: number;
      km?: number | null;
      fonte?: "cronometro" | "manual";
      nota?: string | null;
      registrado_por?: string | null;
      data?: string;
    };
    Update: {
      etapa?: PipeEtapa;
      minutos?: number;
      km?: number | null;
      nota?: string | null;
    };
  };

  /** Premissas de custo e comerciais da empreiteira. Nulo = não calculado. */
  org_ajustes: {
    Row: {
      org_id: string;
      custo_hora: number | null;
      custo_km: number | null;
      dias_para_parado: number;
      /** Conversão informada à mão, usada enquanto o histórico for curto. */
      conversao_estimada: number | null;
      /** Peso da carga comercial por porte de obra. 1 = carga cheia. */
      carga_p: number;
      carga_m: number;
      carga_g: number;
      updated_at: string;
    };
    Insert: {
      org_id: string;
      custo_hora?: number | null;
      custo_km?: number | null;
      dias_para_parado?: number;
      conversao_estimada?: number | null;
      carga_p?: number;
      carga_m?: number;
      carga_g?: number;
      updated_at?: string;
    };
    Update: {
      custo_hora?: number | null;
      custo_km?: number | null;
      dias_para_parado?: number;
      conversao_estimada?: number | null;
      carga_p?: number;
      carga_m?: number;
      carga_g?: number;
      updated_at?: string;
    };
  };

  /** O orçamento típico da empreiteira, etapa por etapa. */
  org_orcamento_padrao: {
    Row: {
      org_id: string;
      etapa: PipeEtapa;
      minutos: number;
      /** Só faz sentido em `deslocamento`. */
      km: number | null;
    };
    Insert: {
      org_id: string;
      etapa: PipeEtapa;
      minutos?: number;
      km?: number | null;
    };
    Update: { minutos?: number; km?: number | null };
  };
};

/**
 * O supabase-js exige `Relationships` em cada tabela para resolver os tipos de
 * select. Como aqui não há select aninhado, um array vazio basta.
 */
export type Database = {
  public: {
    Tables: {
      [K in keyof (Tabelas & TabelasDeOrcamento & TabelasDePipeline)]: (Tabelas &
        TabelasDeOrcamento &
        TabelasDePipeline)[K] & { Relationships: [] };
    };
    Views: {
      /**
       * Pedido com o esforço somado, o custo estimado e o sinal de parado.
       * `security_invoker`: a RLS de `pipe_pedidos` continua valendo.
       */
      pipe_pedidos_resumo: {
        Row: TabelasDePipeline["pipe_pedidos"]["Row"] & {
          total_minutos: number;
          total_horas: number;
          km_total: number;
          etapas_registradas: number | null;
          custo_hora: number | null;
          custo_km: number | null;
          /** Nulo quando falta `custo_hora`: melhor sem número que com zero. */
          custo_estimado: number | null;
          ultimo_evento_em: string | null;
          parado: boolean;
        };
        Relationships: [];
      };
    };
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
