import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/admin/sessao";
import { empreiteiraDaOrg, type Empreiteira } from "@/lib/admin/empreiteira";
import { lerDia } from "./publicacao";
import { RASCUNHO_VAZIO, type DiaPublicado, type RascunhoDoDia } from "./tipos";

/**
 * Leitura do diário, para o painel e para a página de acompanhamento.
 *
 * A página pública lê com a service key e filtra por token, como todo o resto
 * do produto: quem abre o link não tem conta, e a RLS não teria como
 * distinguir quem é. A autorização é o token mais a senha, resolvidos no
 * servidor.
 */

export type Diario = {
  id: string;
  token: string;
  titulo: string | null;
  autorNome: string | null;
  temSenha: boolean;
};

/** Uma data com relatório, para a lista do painel e para o calendário. */
export type DiaDoDiario = {
  dia: string;
  publicado: boolean;
  /** Há edição no rascunho depois da última publicação. */
  desatualizado: boolean;
};

/**
 * O diário de quem está logado, criado na primeira visita.
 *
 * Nasce junto com a primeira abertura da tela, como `garantirOrg` faz na
 * primeira entrada no painel: um diário vazio não custa nada e o link já
 * existe quando a pessoa quiser mandar. O que ele **não** tem é senha, e sem
 * senha a publicação trava — a mesma regra do orçamento.
 */
export async function garantirDiario(): Promise<Diario> {
  const { orgId, id: usuarioId } = await exigirAdmin();
  const sb = supabaseAdmin();

  const { data: existente } = await sb
    .from("dia_diarios")
    .select("id, token, titulo, autor_nome, senha")
    .eq("org_id", orgId)
    .eq("autor_id", usuarioId)
    .maybeSingle();

  if (existente) {
    return {
      id: existente.id,
      token: existente.token,
      titulo: existente.titulo,
      autorNome: existente.autor_nome,
      // A senha em si nunca sai daqui: a tela só precisa saber se existe.
      temSenha: Boolean(existente.senha),
    };
  }

  const { data: criado, error } = await sb
    .from("dia_diarios")
    .insert({ org_id: orgId, autor_id: usuarioId })
    .select("id, token, titulo, autor_nome, senha")
    .single();

  if (error || !criado) {
    throw new Error(error?.message ?? "Falha ao criar o diário.");
  }

  return {
    id: criado.id,
    token: criado.token,
    titulo: criado.titulo,
    autorNome: criado.autor_nome,
    temSenha: false,
  };
}

/** As datas que já têm relatório, da mais recente para a mais antiga. */
export async function listarDias(diarioId: string): Promise<DiaDoDiario[]> {
  const sb = supabaseAdmin();

  const { data: relatorios } = await sb
    .from("dia_relatorios")
    .select("id, dia, updated_at")
    .eq("diario_id", diarioId)
    .order("dia", { ascending: false });

  if (!relatorios?.length) return [];

  const { data: publicacoes } = await sb
    .from("dia_publicacoes")
    .select("relatorio_id, publicado_em")
    .in(
      "relatorio_id",
      relatorios.map((r) => r.id),
    )
    .order("versao", { ascending: false });

  // A primeira que aparece é a de maior versão, pela ordenação acima.
  const ultima = new Map<string, string>();
  for (const p of publicacoes ?? []) {
    if (!ultima.has(p.relatorio_id)) ultima.set(p.relatorio_id, p.publicado_em);
  }

  return relatorios.map((r) => {
    const publicadoEm = ultima.get(r.id);
    return {
      dia: r.dia,
      publicado: Boolean(publicadoEm),
      // Meio segundo de folga: gravar o rascunho e inserir a publicação são
      // duas escritas, e a segunda sempre carimba depois da primeira.
      desatualizado: Boolean(
        publicadoEm &&
          new Date(r.updated_at).getTime() - new Date(publicadoEm).getTime() >
            500,
      ),
    };
  });
}

export type DiaNoPainel = {
  dia: string;
  rascunho: RascunhoDoDia;
  publicadoEm: string | null;
  versao: number | null;
};

/** O rascunho de uma data, para a tela de escrever. */
export async function carregarDia(
  diarioId: string,
  dia: string,
): Promise<DiaNoPainel> {
  const sb = supabaseAdmin();

  const { data: relatorio } = await sb
    .from("dia_relatorios")
    .select("id, realizado, em_andamento, pendencias, proximos_passos")
    .eq("diario_id", diarioId)
    .eq("dia", dia)
    .maybeSingle();

  if (!relatorio) {
    return { dia, rascunho: { ...RASCUNHO_VAZIO }, publicadoEm: null, versao: null };
  }

  const { data: publicacao } = await sb
    .from("dia_publicacoes")
    .select("versao, publicado_em")
    .eq("relatorio_id", relatorio.id)
    .order("versao", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    dia,
    rascunho: {
      realizado: relatorio.realizado ?? "",
      emAndamento: relatorio.em_andamento ?? "",
      pendencias: relatorio.pendencias ?? "",
      proximosPassos: relatorio.proximos_passos ?? "",
    },
    publicadoEm: publicacao?.publicado_em ?? null,
    versao: publicacao?.versao ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* A página de acompanhamento                                                  */
/* -------------------------------------------------------------------------- */

export type DiarioPublico = {
  id: string;
  token: string;
  titulo: string | null;
  autorNome: string | null;
  temSenha: boolean;
  empreiteira: Empreiteira;
};

/**
 * O diário por token. Devolve `null` para token inexistente, e a rota
 * responde 404 — igual ao orçamento e ao relatório.
 */
export async function carregarDiarioPorToken(
  token: string,
): Promise<DiarioPublico | null> {
  if (!token) return null;

  const { data } = await supabaseAdmin()
    .from("dia_diarios")
    .select("id, org_id, token, titulo, autor_nome, senha")
    .eq("token", token)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    token: data.token,
    titulo: data.titulo,
    autorNome: data.autor_nome,
    temSenha: Boolean(data.senha),
    empreiteira: await empreiteiraDaOrg(data.org_id),
  };
}

/** A senha guardada, para o gate conferir. Só o gate chama isto. */
export async function senhaDoDiario(token: string): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from("dia_diarios")
    .select("senha")
    .eq("token", token)
    .maybeSingle();
  return data?.senha ?? null;
}

/**
 * O que foi publicado numa data. Rascunho nunca aparece aqui: o link serve a
 * fotografia, e mais nada.
 */
export async function carregarDiaPublicado(
  diarioId: string,
  dia: string,
): Promise<DiaPublicado | null> {
  const sb = supabaseAdmin();

  const { data: relatorio } = await sb
    .from("dia_relatorios")
    .select("id")
    .eq("diario_id", diarioId)
    .eq("dia", dia)
    .maybeSingle();
  if (!relatorio) return null;

  const { data: publicacao } = await sb
    .from("dia_publicacoes")
    .select("dados")
    .eq("relatorio_id", relatorio.id)
    .order("versao", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!publicacao) return null;

  return lerDia(publicacao.dados);
}

/**
 * Todas as datas publicadas, da mais recente para a mais antiga.
 *
 * Uma consulta só para as três perguntas da página: qual dia abrir, quais
 * marcar no calendário e quais são o anterior e o seguinte. O volume é uma
 * data por dia de trabalho — filtrar por mês no banco custaria uma ida a São
 * Paulo por navegação de mês, para economizar linhas que cabem na memória.
 */
export async function datasPublicadas(diarioId: string): Promise<string[]> {
  const sb = supabaseAdmin();

  const { data: relatorios } = await sb
    .from("dia_relatorios")
    .select("id, dia")
    .eq("diario_id", diarioId)
    .order("dia", { ascending: false });

  if (!relatorios?.length) return [];

  const { data: publicacoes } = await sb
    .from("dia_publicacoes")
    .select("relatorio_id")
    .in(
      "relatorio_id",
      relatorios.map((r) => r.id),
    );

  const comPublicacao = new Set((publicacoes ?? []).map((p) => p.relatorio_id));
  return relatorios.filter((r) => comPublicacao.has(r.id)).map((r) => r.dia);
}
