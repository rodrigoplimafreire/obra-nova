import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { orgAtual } from "./sessao";
import type { Enums } from "@/lib/database.types";

/**
 * Leitura das obras para o painel.
 *
 * O dia é sempre resolvido no fuso de São Paulo, não no do servidor. A Vercel
 * roda em UTC: depois das 21h de Brasília o servidor já virou o dia, e o
 * checklist das 16h30 apareceria vazio, na data errada.
 */

export function hojeNaObra(): string {
  // en-CA porque devolve YYYY-MM-DD, que é o formato de `date` no Postgres.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

export type ResumoDeObra = {
  id: string;
  nome: string;
  cliente: string;
  mestres: number;
  atividadesHoje: number;
  confirmadasHoje: number;
};

export async function listarObras(): Promise<ResumoDeObra[]> {
  const sb = supabaseAdmin();
  const hoje = hojeNaObra();
  const org = await orgAtual();

  const { data: obras } = await sb
    .from("obras")
    .select("id, nome, cliente_nome")
    .eq("org_id", org)
    .eq("ativa", true)
    .order("created_at", { ascending: false });

  if (!obras?.length) return [];

  const ids = obras.map((o) => o.id);

  const [{ data: mestres }, { data: atividades }] = await Promise.all([
    sb.from("mestres").select("obra_id").in("obra_id", ids).eq("ativo", true),
    sb.from("atividades").select("id, obra_id").in("obra_id", ids).eq("dia", hoje),
  ]);

  const atividadeIds = (atividades ?? []).map((a) => a.id);
  const { data: confirmacoes } = atividadeIds.length
    ? await sb
        .from("confirmacoes")
        .select("atividade_id, status")
        .in("atividade_id", atividadeIds)
        .neq("status", "pendente")
    : { data: [] };

  const obraDaAtividade = new Map(
    (atividades ?? []).map((a) => [a.id, a.obra_id]),
  );

  return obras.map((o) => ({
    id: o.id,
    nome: o.nome,
    cliente: o.cliente_nome,
    mestres: (mestres ?? []).filter((m) => m.obra_id === o.id).length,
    atividadesHoje: (atividades ?? []).filter((a) => a.obra_id === o.id).length,
    confirmadasHoje: (confirmacoes ?? []).filter(
      (c) => obraDaAtividade.get(c.atividade_id) === o.id,
    ).length,
  }));
}

export type Pendencia = { titulo: string; detalhe: string | null };

/**
 * O que ficou por fazer no último dia lançado antes de `dia`.
 *
 * Pendente, parcial e não feita contam. Só "feita" sai da lista: em obra, um
 * serviço começado e não terminado precisa reaparecer, senão some do checklist
 * e ninguém mais lembra dele.
 */
export async function pendenciasAntesDe(
  obraId: string,
  dia: string,
): Promise<{ deQualDia: string; itens: Pendencia[] }> {
  const sb = supabaseAdmin();

  const { data: anterior } = await sb
    .from("atividades")
    .select("dia")
    .eq("obra_id", obraId)
    .lt("dia", dia)
    .order("dia", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!anterior) return { deQualDia: "", itens: [] };

  const { data: atividades } = await sb
    .from("atividades")
    .select("id, titulo, detalhe")
    .eq("obra_id", obraId)
    .eq("dia", anterior.dia)
    .order("position");

  if (!atividades?.length) return { deQualDia: anterior.dia, itens: [] };

  const { data: confirmacoes } = await sb
    .from("confirmacoes")
    .select("atividade_id, status")
    .in(
      "atividade_id",
      atividades.map((a) => a.id),
    );

  const feitas = new Set(
    (confirmacoes ?? [])
      .filter((c) => c.status === "feita")
      .map((c) => c.atividade_id),
  );

  return {
    deQualDia: anterior.dia,
    itens: atividades
      .filter((a) => !feitas.has(a.id))
      .map((a) => ({ titulo: a.titulo, detalhe: a.detalhe })),
  };
}

export type BlocoDeConfirmacao = {
  id: string;
  type: Enums<"block_type">;
  texto: string | null;
  caminho: string | null;
  duracaoMs: number | null;
};

export type ConfirmacaoNaTela = {
  id: string;
  mestreNome: string;
  status: Enums<"confirmacao_status">;
  quando: string | null;
  blocos: BlocoDeConfirmacao[];
};

export type AtividadeNaTela = {
  id: string;
  position: number;
  titulo: string;
  detalhe: string | null;
  confirmacoes: ConfirmacaoNaTela[];
};

export type DetalheDaObra = {
  obra: {
    id: string;
    nome: string;
    cliente: string;
    endereco: string | null;
    marcaNome: string | null;
  };
  mestres: { id: string; nome: string; telefone: string | null; token: string }[];
  atividades: AtividadeNaTela[];
};

export async function carregarObra(
  obraId: string,
  dia: string,
): Promise<DetalheDaObra | null> {
  const sb = supabaseAdmin();
  const org = await orgAtual();

  const { data: obraBruta } = await sb
    .from("obras")
    .select("id, nome, cliente_nome, endereco, marca_nome")
    .eq("id", obraId)
    .eq("org_id", org)
    .maybeSingle();
  if (!obraBruta) return null;

  const obra = {
    id: obraBruta.id,
    nome: obraBruta.nome,
    cliente: obraBruta.cliente_nome,
    endereco: obraBruta.endereco,
    marcaNome: obraBruta.marca_nome,
  };

  const [{ data: mestres }, { data: atividades }] = await Promise.all([
    sb
      .from("mestres")
      .select("id, nome, telefone, token")
      .eq("obra_id", obraId)
      .eq("ativo", true)
      .order("created_at"),
    sb
      .from("atividades")
      .select("id, position, titulo, detalhe")
      .eq("obra_id", obraId)
      .eq("dia", dia)
      .order("position"),
  ]);

  const atividadeIds = (atividades ?? []).map((a) => a.id);

  const { data: confirmacoes } = atividadeIds.length
    ? await sb
        .from("confirmacoes")
        .select("id, atividade_id, mestre_id, status, completed_at")
        .in("atividade_id", atividadeIds)
    : { data: [] };

  const confirmacaoIds = (confirmacoes ?? []).map((c) => c.id);
  const { data: blocos } = confirmacaoIds.length
    ? await sb
        .from("confirmacao_blocos")
        .select("id, confirmacao_id, type, text_content, storage_path, duration_ms")
        .in("confirmacao_id", confirmacaoIds)
        .order("position")
    : { data: [] };

  const nomeDoMestre = new Map((mestres ?? []).map((m) => [m.id, m.nome]));

  return {
    obra,
    mestres: mestres ?? [],
    atividades: (atividades ?? []).map((a) => ({
      id: a.id,
      position: a.position,
      titulo: a.titulo,
      detalhe: a.detalhe,
      confirmacoes: (confirmacoes ?? [])
        .filter((c) => c.atividade_id === a.id)
        .map((c) => ({
          id: c.id,
          // Mestre inativo sai da lista mas a confirmação dele fica: o histórico
          // da obra não pode mudar porque alguém saiu da equipe.
          mestreNome: nomeDoMestre.get(c.mestre_id) ?? "Mestre removido",
          status: c.status,
          quando: c.completed_at,
          blocos: (blocos ?? [])
            .filter((b) => b.confirmacao_id === c.id)
            .map((b) => ({
              id: b.id,
              type: b.type,
              texto: b.text_content,
              caminho: b.storage_path,
              duracaoMs: b.duration_ms,
            })),
        })),
    })),
  };
}
