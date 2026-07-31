import "server-only";
import { BUCKET, supabaseAdmin } from "@/lib/supabase/admin";
import { normalizarRelatorio, type ResultadoDoRelatorio } from "./tipos";
import type { Enums } from "@/lib/database.types";

/**
 * Leitura do relatório, para o painel e para a página do cliente.
 *
 * As fotos saem daqui com URL assinada de validade curta, como todo arquivo
 * do projeto. O bucket é privado: não existe link permanente para imagem de
 * obra de cliente nenhum.
 */

const VALIDADE_SEGUNDOS = 3600;

export type FotoDoRelatorio = { id: string; url: string };

export type ServicoDoRelatorio = {
  id: string;
  titulo: string;
  detalhe: string | null;
  status: Enums<"confirmacao_status">;
  relato: string[];
  fotos: FotoDoRelatorio[];
};

export type DiaDoRelatorio = { dia: string; servicos: ServicoDoRelatorio[] };

export type RelatorioCompleto = {
  id: string;
  token: string;
  obra: {
    nome: string;
    cliente: string;
    endereco: string | null;
    marcaNome: string | null;
  };
  inicio: string;
  fim: string;
  status: Enums<"relatorio_status">;
  erro: string | null;
  publicadoEm: string | null;
  modelo: string | null;
  atualizadoEm: string;
  resultado: ResultadoDoRelatorio | null;
  dias: DiaDoRelatorio[];
  totais: { servicos: number; concluidos: number; fotos: number };
};

async function montar(linha: {
  id: string;
  token: string;
  obra_id: string;
  inicio: string;
  fim: string;
  status: Enums<"relatorio_status">;
  error: string | null;
  publicado_em: string | null;
  model: string | null;
  updated_at: string;
  resultado: unknown;
}): Promise<RelatorioCompleto | null> {
  const sb = supabaseAdmin();

  const { data: obra } = await sb
    .from("obras")
    .select("nome, cliente_nome, endereco, marca_nome")
    .eq("id", linha.obra_id)
    .maybeSingle();
  if (!obra) return null;

  const { data: atividades } = await sb
    .from("atividades")
    .select("id, dia, position, titulo, detalhe")
    .eq("obra_id", linha.obra_id)
    .gte("dia", linha.inicio)
    .lte("dia", linha.fim)
    .order("dia")
    .order("position");

  const ids = (atividades ?? []).map((a) => a.id);

  const { data: confirmacoes } = ids.length
    ? await sb
        .from("confirmacoes")
        .select("id, atividade_id, status")
        .in("atividade_id", ids)
    : { data: [] };

  const confirmacaoIds = (confirmacoes ?? []).map((c) => c.id);

  const { data: blocos } = confirmacaoIds.length
    ? await sb
        .from("confirmacao_blocos")
        .select("id, confirmacao_id, type, text_content, storage_path")
        .in("confirmacao_id", confirmacaoIds)
        .order("position")
    : { data: [] };

  const blocosLista = blocos ?? [];

  const { data: transcricoes } = blocosLista.length
    ? await sb
        .from("transcripts")
        .select("confirmacao_bloco_id, text")
        .in(
          "confirmacao_bloco_id",
          blocosLista.map((b) => b.id),
        )
        .eq("status", "done")
    : { data: [] };

  const textoDoAudio = new Map(
    (transcricoes ?? []).map((t) => [t.confirmacao_bloco_id, t.text ?? ""]),
  );

  // Uma assinatura só para todas as fotos do período.
  const caminhos = blocosLista
    .filter((b) => b.type === "image" && b.storage_path)
    .map((b) => b.storage_path as string);

  const urlPorCaminho = new Map<string, string>();
  if (caminhos.length) {
    const { data: assinadas } = await sb.storage
      .from(BUCKET)
      .createSignedUrls(caminhos, VALIDADE_SEGUNDOS);
    for (const a of assinadas ?? []) {
      if (a.path && a.signedUrl) urlPorCaminho.set(a.path, a.signedUrl);
    }
  }

  let concluidos = 0;
  let totalFotos = 0;

  const servicos = (atividades ?? []).map((a) => {
    const confirmacao = (confirmacoes ?? []).find((c) => c.atividade_id === a.id);
    const status = confirmacao?.status ?? ("pendente" as const);
    if (status === "feita") concluidos += 1;

    const meus = blocosLista.filter((b) => b.confirmacao_id === confirmacao?.id);

    const relato: string[] = [];
    const fotos: FotoDoRelatorio[] = [];

    for (const bloco of meus) {
      if (bloco.type === "text" && bloco.text_content) {
        relato.push(bloco.text_content);
      } else if (bloco.type === "audio") {
        const t = textoDoAudio.get(bloco.id);
        if (t) relato.push(t);
      } else if (bloco.type === "image" && bloco.storage_path) {
        const url = urlPorCaminho.get(bloco.storage_path);
        if (url) {
          fotos.push({ id: bloco.id, url });
          totalFotos += 1;
        }
      }
    }

    return {
      dia: a.dia,
      servico: { id: a.id, titulo: a.titulo, detalhe: a.detalhe, status, relato, fotos },
    };
  });

  const diasUnicos = [...new Set(servicos.map((s) => s.dia))];

  return {
    id: linha.id,
    token: linha.token,
    obra: {
      nome: obra.nome,
      cliente: obra.cliente_nome,
      endereco: obra.endereco,
      marcaNome: obra.marca_nome,
    },
    inicio: linha.inicio,
    fim: linha.fim,
    status: linha.status,
    erro: linha.error,
    publicadoEm: linha.publicado_em,
    modelo: linha.model,
    atualizadoEm: linha.updated_at,
    resultado: linha.resultado ? normalizarRelatorio(linha.resultado) : null,
    dias: diasUnicos.map((dia) => ({
      dia,
      servicos: servicos.filter((s) => s.dia === dia).map((s) => s.servico),
    })),
    totais: {
      servicos: (atividades ?? []).length,
      concluidos,
      fotos: totalFotos,
    },
  };
}

/** Para o painel: o relatório daquela semana, se já existir. */
export async function carregarRelatorioDaSemana(
  obraId: string,
  inicio: string,
  fim: string,
): Promise<RelatorioCompleto | null> {
  const { data } = await supabaseAdmin()
    .from("relatorios")
    .select("*")
    .eq("obra_id", obraId)
    .eq("inicio", inicio)
    .eq("fim", fim)
    .maybeSingle();

  return data ? montar(data) : null;
}

/**
 * Para o cliente final. Só devolve o que foi publicado: um texto escrito por
 * IA não vai para quem paga a obra antes de alguém ler e liberar.
 */
export async function carregarRelatorioPublicado(
  token: string,
): Promise<RelatorioCompleto | null> {
  const { data } = await supabaseAdmin()
    .from("relatorios")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (!data || !data.publicado_em || data.status !== "pronto") return null;
  return montar(data);
}
