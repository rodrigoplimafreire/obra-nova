/**
 * Tipos do schema do Supabase, escritos à mão no formato que o supabase-js
 * espera. Espelham o projeto `obra-nova` (wnzdsqpsowxmistbnhca).
 *
 * Conferir contra o banco depois de qualquer migração:
 *   npx supabase gen types typescript --project-id wnzdsqpsowxmistbnhca
 */

type Tabelas = {
  orgs: {
    Row: { id: string; name: string; created_at: string };
    Insert: { id?: string; name: string; created_at?: string };
    Update: { id?: string; name?: string; created_at?: string };
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
 * O supabase-js exige `Relationships` em cada tabela para resolver os tipos de
 * select. Como aqui não há select aninhado, um array vazio basta.
 */
export type Database = {
  public: {
    Tables: { [K in keyof Tabelas]: Tabelas[K] & { Relationships: [] } };
    Views: Record<never, never>;
    Functions: {
      gerar_token: { Args: never; Returns: string };
    };
    Enums: {
      block_type: "text" | "audio" | "image";
      confirmacao_status: "pendente" | "feita" | "parcial" | "nao_feita";
      relatorio_status: "rascunho" | "gerando" | "pronto" | "falhou";
      transcript_status: "pending" | "done" | "failed";
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
