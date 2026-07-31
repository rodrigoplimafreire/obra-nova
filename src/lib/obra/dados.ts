import "server-only";
import { BUCKET, supabaseAdmin } from "@/lib/supabase/admin";
import { hojeNaObra } from "@/lib/admin/obras";
import type { Enums } from "@/lib/database.types";

/**
 * Leitura do canteiro pelo lado do mestre.
 *
 * O token nunca é validado no cliente: tudo roda no servidor com a service
 * key, e por isso o mestre não precisa de policy nenhuma.
 *
 * Não há verificação de identidade aqui, e é de propósito. O link é fixo e ele
 * volta nele todo dia às 16h30: pedir confirmação diária seria atrito diário.
 * O que protege é o token ser opaco e revogável.
 */

const VALIDADE_SEGUNDOS = 600;

/**
 * Segunda a sábado da semana de `dia`.
 *
 * Meio-dia UTC em todas as contas: com meia-noite, somar ou subtrair dias
 * atravessa a fronteira do fuso e a semana volta deslocada em um dia.
 */
export function semanaDe(dia: string): string[] {
  const base = new Date(`${dia}T12:00:00Z`);
  const diaDaSemana = base.getUTCDay();
  // Domingo (0) pertence à semana que começou na segunda anterior.
  const ateSegunda = diaDaSemana === 0 ? -6 : 1 - diaDaSemana;

  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + ateSegunda + i);
    return d.toISOString().slice(0, 10);
  });
}

export type ResumoDeAtividade = {
  id: string;
  titulo: string;
  detalhe: string | null;
  status: Enums<"confirmacao_status">;
  fotos: number;
  audios: number;
};

export type DiaDaSemana = { dia: string; atividades: ResumoDeAtividade[] };

export type SemanaDoMestre = {
  mestre: { id: string; nome: string; escritorio: boolean };
  obra: { id: string; nome: string; cliente: string };
  hoje: string;
  dias: DiaDaSemana[];
};

/** A semana inteira, para a abertura. Sem assinar arquivo: aqui só conta. */
export async function carregarSemanaDoMestre(
  token: string,
): Promise<SemanaDoMestre | null> {
  const sb = supabaseAdmin();

  const { data: mestre } = await sb
    .from("mestres")
    .select("id, nome, obra_id, ativo, escritorio")
    .eq("token", token)
    .maybeSingle();
  if (!mestre || !mestre.ativo) return null;

  const { data: obra } = await sb
    .from("obras")
    .select("id, nome, cliente_nome")
    .eq("id", mestre.obra_id)
    .maybeSingle();
  if (!obra) return null;

  const hoje = hojeNaObra();
  const dias = semanaDe(hoje);

  const { data: atividades } = await sb
    .from("atividades")
    .select("id, dia, titulo, detalhe")
    .eq("obra_id", obra.id)
    .gte("dia", dias[0])
    .lte("dia", dias[dias.length - 1])
    .order("dia")
    .order("position");

  const ids = (atividades ?? []).map((a) => a.id);

  const { data: confirmacoes } = ids.length
    ? await sb
        .from("confirmacoes")
        .select("id, atividade_id, status")
        .in("atividade_id", ids)
        .eq("mestre_id", mestre.id)
    : { data: [] };

  const confirmacaoIds = (confirmacoes ?? []).map((c) => c.id);
  const { data: blocos } = confirmacaoIds.length
    ? await sb
        .from("confirmacao_blocos")
        .select("confirmacao_id, type")
        .in("confirmacao_id", confirmacaoIds)
    : { data: [] };

  return {
    mestre: { id: mestre.id, nome: mestre.nome, escritorio: mestre.escritorio },
    obra: { id: obra.id, nome: obra.nome, cliente: obra.cliente_nome },
    hoje,
    dias: dias.map((dia) => ({
      dia,
      atividades: (atividades ?? [])
        .filter((a) => a.dia === dia)
        .map((a) => {
          const confirmacao = (confirmacoes ?? []).find(
            (c) => c.atividade_id === a.id,
          );
          const meus = (blocos ?? []).filter(
            (b) => b.confirmacao_id === confirmacao?.id,
          );
          return {
            id: a.id,
            titulo: a.titulo,
            detalhe: a.detalhe,
            status: confirmacao?.status ?? ("pendente" as const),
            fotos: meus.filter((b) => b.type === "image").length,
            audios: meus.filter((b) => b.type === "audio").length,
          };
        }),
    })),
  };
}

export type BlocoDoMestre = {
  id: string;
  type: Enums<"block_type">;
  texto: string | null;
  url: string | null;
  duracaoMs: number | null;
};

export type AtividadeDoMestre = {
  id: string;
  titulo: string;
  detalhe: string | null;
  status: Enums<"confirmacao_status">;
  blocos: BlocoDoMestre[];
};

export type DiaDoMestre = {
  mestre: { id: string; nome: string; escritorio: boolean };
  obra: { id: string; nome: string; cliente: string };
  dia: string;
  atividades: AtividadeDoMestre[];
};

/**
 * Em que dia este link pode escrever.
 *
 * O mestre confirma o dia de hoje e ponto: o registro do canteiro vale porque
 * é feito na hora. O escritório lança o que coletou por áudio, e nem sempre no
 * mesmo dia — por isso alcança a semana corrente inteira, e só ela. Liberar o
 * passado sem limite deixaria reescrever obra já entregue e já relatada.
 */
function diaAutorizado(escritorio: boolean, dia: string): boolean {
  const hoje = hojeNaObra();
  if (dia === hoje) return true;
  return escritorio && semanaDe(hoje).includes(dia);
}

export async function carregarDiaDoMestre(
  token: string,
  diaPedido?: string,
): Promise<DiaDoMestre | null> {
  const sb = supabaseAdmin();

  const { data: mestre } = await sb
    .from("mestres")
    .select("id, nome, obra_id, ativo, escritorio")
    .eq("token", token)
    .maybeSingle();
  if (!mestre || !mestre.ativo) return null;

  const { data: obra } = await sb
    .from("obras")
    .select("id, nome, cliente_nome")
    .eq("id", mestre.obra_id)
    .maybeSingle();
  if (!obra) return null;

  const dia =
    diaPedido && diaAutorizado(mestre.escritorio, diaPedido)
      ? diaPedido
      : hojeNaObra();

  const { data: atividades } = await sb
    .from("atividades")
    .select("id, titulo, detalhe")
    .eq("obra_id", obra.id)
    .eq("dia", dia)
    .order("position");

  const ids = (atividades ?? []).map((a) => a.id);

  const { data: confirmacoes } = ids.length
    ? await sb
        .from("confirmacoes")
        .select("id, atividade_id, status")
        .in("atividade_id", ids)
        .eq("mestre_id", mestre.id)
    : { data: [] };

  const confirmacaoIds = (confirmacoes ?? []).map((c) => c.id);
  const { data: blocos } = confirmacaoIds.length
    ? await sb
        .from("confirmacao_blocos")
        .select("id, confirmacao_id, type, text_content, storage_path, duration_ms")
        .in("confirmacao_id", confirmacaoIds)
        .order("position")
    : { data: [] };

  const assinados = await assinar(blocos ?? []);

  return {
    mestre: { id: mestre.id, nome: mestre.nome, escritorio: mestre.escritorio },
    obra: { id: obra.id, nome: obra.nome, cliente: obra.cliente_nome },
    dia,
    atividades: (atividades ?? []).map((a) => {
      const confirmacao = (confirmacoes ?? []).find((c) => c.atividade_id === a.id);
      return {
        id: a.id,
        titulo: a.titulo,
        detalhe: a.detalhe,
        status: confirmacao?.status ?? "pendente",
        blocos: assinados
          .filter((b) => b.confirmacao_id === confirmacao?.id)
          .map((b) => ({
            id: b.id,
            type: b.type,
            texto: b.text_content,
            url: b.url,
            duracaoMs: b.duration_ms,
          })),
      };
    }),
  };
}

async function assinar<T extends { storage_path: string | null }>(
  linhas: T[],
): Promise<(T & { url: string | null })[]> {
  const caminhos = linhas
    .map((l) => l.storage_path)
    .filter((c): c is string => Boolean(c));

  if (caminhos.length === 0) {
    return linhas.map((l) => ({ ...l, url: null }));
  }

  const { data } = await supabaseAdmin()
    .storage.from(BUCKET)
    .createSignedUrls(caminhos, VALIDADE_SEGUNDOS);

  const porCaminho = new Map((data ?? []).map((d) => [d.path ?? "", d.signedUrl]));

  return linhas.map((l) => ({
    ...l,
    url: l.storage_path ? (porCaminho.get(l.storage_path) ?? null) : null,
  }));
}

/**
 * Resolve token + atividade e garante a linha de `confirmacoes`.
 *
 * Só aceita atividade da obra do próprio mestre e de um dia que aquele link
 * pode escrever: sem isso, um token válido conseguiria escrever em atividade
 * de outra obra, ou o canteiro reabriria uma semana já relatada.
 */
export async function garantirConfirmacao(token: string, atividadeId: string) {
  const sb = supabaseAdmin();

  const { data: mestre } = await sb
    .from("mestres")
    .select("id, obra_id, ativo, escritorio")
    .eq("token", token)
    .maybeSingle();
  if (!mestre || !mestre.ativo) return null;

  const { data: atividade } = await sb
    .from("atividades")
    .select("id, obra_id, dia")
    .eq("id", atividadeId)
    .maybeSingle();

  if (!atividade) return null;
  if (atividade.obra_id !== mestre.obra_id) return null;
  if (!diaAutorizado(mestre.escritorio, atividade.dia)) return null;

  const { data: existente } = await sb
    .from("confirmacoes")
    .select("*")
    .eq("atividade_id", atividade.id)
    .eq("mestre_id", mestre.id)
    .maybeSingle();

  if (existente) return { mestre, atividade, confirmacao: existente };

  const { data: criada, error } = await sb
    .from("confirmacoes")
    .insert({ atividade_id: atividade.id, mestre_id: mestre.id })
    .select("*")
    .single();

  if (error || !criada) return null;
  return { mestre, atividade, confirmacao: criada };
}
