import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/admin/sessao";
import { empreiteiraDaOrg, type Empreiteira } from "@/lib/admin/empreiteira";
import { lerDia } from "./publicacao";
import type { DiaPublicado, ItemDoDia, Secao } from "./tipos";

/**
 * Leitura do diário, para o painel e para a página de acompanhamento.
 *
 * A página pública lê com a service key e filtra por token, como todo o resto
 * do produto: quem abre o link não tem conta, e a RLS não teria como
 * distinguir quem é. A autorização é o token mais a senha, resolvidos no
 * servidor.
 */

export type Pessoa = { id: string; nome: string };

export type Diario = {
  id: string;
  token: string;
  /** O pedaço legível de `diario.rd.eng.br/<apelido>`, quando escolhido. */
  apelido: string | null;
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

  const COLUNAS = "id, token, apelido, titulo, autor_nome, senha";

  const { data: existente } = await sb
    .from("dia_diarios")
    .select(COLUNAS)
    .eq("org_id", orgId)
    .eq("autor_id", usuarioId)
    .maybeSingle();

  const linha =
    existente ??
    (
      await sb
        .from("dia_diarios")
        .insert({ org_id: orgId, autor_id: usuarioId })
        .select(COLUNAS)
        .single()
    ).data;

  if (!linha) throw new Error("Falha ao criar o diário.");

  return {
    id: linha.id,
    token: linha.token,
    apelido: linha.apelido,
    titulo: linha.titulo,
    autorNome: linha.autor_nome,
    // A senha em si nunca sai daqui: a tela só precisa saber se existe.
    temSenha: Boolean(linha.senha),
  };
}

/**
 * O elenco, na ordem em que a tela oferece.
 *
 * `posicao` antes do nome: quem escreve o diário entra com `-1` e fica sempre
 * no topo, porque é o responsável mais frequente de todos.
 */
export async function listarPessoas(diarioId: string): Promise<Pessoa[]> {
  const { data } = await supabaseAdmin()
    .from("dia_pessoas")
    .select("id, nome")
    .eq("diario_id", diarioId)
    .order("posicao")
    .order("nome");

  return data ?? [];
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

export type RegistroDoDia = {
  id: string;
  tipo: "texto" | "audio";
  texto: string | null;
  status: "pendente" | "transcrevendo" | "pronto" | "falhou";
  erro: string | null;
  duracaoMs: number | null;
  criadoEm: string;
};

/**
 * Um item de um dia anterior, oferecido para hoje.
 *
 * Ele **não é um item do dia**, e essa distinção é a decisão D14 do PRD: uma
 * sugestão que já nascesse dentro do relatório, esperando confirmação, é
 * exatamente o que faz planejamento virar entrega sem ninguém decidir. Aqui
 * ela vive fora até alguém tocar.
 */
export type SugestaoDeOntem = {
  /** O id do item de origem, que é o que o descarte grava. */
  id: string;
  dia: string;
  secao: Secao;
  texto: string;
  responsavel: string | null;
};

/** Uma linha que a IA propôs, esperando aceite. */
export type PropostaDaIA = {
  id: string;
  secao: Secao;
  texto: string;
  responsavel: string | null;
};

export type DiaNoPainel = {
  dia: string;
  itens: ItemDoDia[];
  /** O que a IA propôs e ainda não foi aceito nem descartado. */
  propostas: PropostaDaIA[];
  /** O que ficou em aberto no último dia com conteúdo antes deste. */
  sugestoes: SugestaoDeOntem[];
  publicadoEm: string | null;
  versao: number | null;
  registros: RegistroDoDia[];
};

/** O dia no painel: os itens do relatório e os registros que os alimentam. */
export async function carregarDia(
  diarioId: string,
  dia: string,
): Promise<DiaNoPainel> {
  const sb = supabaseAdmin();

  const { data: relatorio } = await sb
    .from("dia_relatorios")
    .select("id, editado_em, resumo_em, updated_at")
    .eq("diario_id", diarioId)
    .eq("dia", dia)
    .maybeSingle();

  if (!relatorio) {
    // Sem linha do dia ainda não há descarte possível, então a sugestão sai
    // inteira. É o caso de abrir o diário de manhã, antes de gravar nada.
    return {
      dia,
      itens: [],
      propostas: [],
      sugestoes: await sugestoesDeOntem(diarioId, dia, null),
      publicadoEm: null,
      versao: null,
      registros: [],
    };
  }

  const [{ data: publicacao }, { data: registros }, { data: itens }, { data: propostas }] =
    await Promise.all([
      sb
        .from("dia_publicacoes")
        .select("versao, publicado_em")
        .eq("relatorio_id", relatorio.id)
        .order("versao", { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb
        .from("dia_registros")
        .select("id, tipo, texto, status, erro, duracao_ms, created_at")
        .eq("relatorio_id", relatorio.id)
        .order("created_at"),
      sb
        .from("dia_itens")
        .select("id, secao, texto, responsavel, origem")
        .eq("relatorio_id", relatorio.id)
        .order("posicao")
        .order("created_at"),
      sb
        .from("dia_propostas")
        .select("id, secao, texto, responsavel")
        .eq("relatorio_id", relatorio.id)
        .order("posicao"),
    ]);

  const doDia = (itens ?? []).map((i) => ({
    id: i.id,
    secao: i.secao,
    texto: i.texto,
    responsavel: i.responsavel,
    origem: i.origem,
  }));

  return {
    dia,
    itens: doDia,
    propostas: propostas ?? [],
    sugestoes: await sugestoesDeOntem(diarioId, dia, relatorio.id, doDia),
    publicadoEm: publicacao?.publicado_em ?? null,
    versao: publicacao?.versao ?? null,
    registros: (registros ?? []).map((r) => ({
      id: r.id,
      tipo: r.tipo,
      texto: r.texto,
      status: r.status,
      erro: r.erro,
      duracaoMs: r.duracao_ms,
      criadoEm: r.created_at,
    })),
  };
}

/** Normaliza para comparar texto: sem acento, sem caixa, sem pontuação solta. */
function assinatura(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * O que ficou em aberto no último dia com conteúdo antes deste.
 *
 * **Só o último dia**, e não tudo que já ficou aberto alguma vez. Uma
 * pendência de três semanas atrás reaparecendo hoje viraria uma lista que
 * ninguém lê e que se descarta no atacado — e sugestão que se ignora em bloco
 * deixa de ser sugestão. O que continua importando volta a ser dito no dia
 * seguinte, que é como o diário funciona de verdade.
 *
 * Só `em_andamento` e `pendencias`: o que foi realizado ontem está fechado, e
 * o que era próximo passo vira o assunto do dia por conta própria.
 */
export async function sugestoesDeOntem(
  diarioId: string,
  dia: string,
  /** Nulo quando o dia de hoje ainda não tem linha. */
  relatorioDeHoje: string | null,
  itensDeHoje: ItemDoDia[] = [],
): Promise<SugestaoDeOntem[]> {
  const sb = supabaseAdmin();

  const { data: anteriores } = await sb
    .from("dia_relatorios")
    .select("id, dia")
    .eq("diario_id", diarioId)
    .lt("dia", dia)
    .order("dia", { ascending: false })
    .limit(10);

  if (!anteriores?.length) return [];

  const { data: candidatos } = await sb
    .from("dia_itens")
    .select("id, relatorio_id, secao, texto, responsavel")
    .in(
      "relatorio_id",
      anteriores.map((r) => r.id),
    )
    .in("secao", ["em_andamento", "pendencias"])
    .order("posicao");

  if (!candidatos?.length) return [];

  // O dia mais recente **que tem candidato**: pular os dias em que só houve
  // "realizado" é o que faz a sugestão sobreviver a um fim de semana.
  const diaPorRelatorio = new Map(anteriores.map((r) => [r.id, r.dia]));
  const maisRecente = candidatos
    .map((c) => diaPorRelatorio.get(c.relatorio_id) ?? "")
    .sort()
    .pop();

  const deOntem = candidatos.filter(
    (c) => diaPorRelatorio.get(c.relatorio_id) === maisRecente,
  );

  const descartados = new Set<string>();
  if (relatorioDeHoje) {
    const { data } = await sb
      .from("dia_descartes")
      .select("item_origem_id")
      .eq("relatorio_id", relatorioDeHoje);
    for (const d of data ?? []) descartados.add(d.item_origem_id);
  }

  // O que já foi dito hoje não volta a ser oferecido, tenha vindo da sugestão
  // ou do teclado. Comparar por texto normalizado pega os dois casos.
  const jaDito = new Set(itensDeHoje.map((i) => assinatura(i.texto)));

  return deOntem
    .filter((c) => !descartados.has(c.id) && !jaDito.has(assinatura(c.texto)))
    .map((c) => ({
      id: c.id,
      dia: diaPorRelatorio.get(c.relatorio_id) ?? "",
      secao: c.secao,
      texto: c.texto,
      responsavel: c.responsavel,
    }));
}

/* -------------------------------------------------------------------------- */
/* A página de acompanhamento                                                  */
/* -------------------------------------------------------------------------- */

export type DiarioPublico = {
  id: string;
  token: string;
  apelido: string | null;
  titulo: string | null;
  autorNome: string | null;
  temSenha: boolean;
  empreiteira: Empreiteira;
};

/**
 * Acha o diário pelo que veio na URL: o apelido legível ou o token.
 *
 * Os dois caminhos existem de propósito. O token é o endereço que já foi para
 * o WhatsApp antes de haver domínio próprio, e a Entrega 1 prometeu que ele
 * não muda; o apelido é o endereço bonito que passou a existir depois.
 * Prometer endereço fixo e depois trocá-lo seria quebrar a promessa no lugar
 * onde ela foi feita.
 */
async function acharDiario(identificador: string) {
  if (!identificador) return null;
  const sb = supabaseAdmin();

  const COLUNAS = "id, org_id, token, apelido, titulo, autor_nome, senha";

  const { data: porApelido } = await sb
    .from("dia_diarios")
    .select(COLUNAS)
    .eq("apelido", identificador.toLowerCase())
    .maybeSingle();
  if (porApelido) return porApelido;

  const { data: porToken } = await sb
    .from("dia_diarios")
    .select(COLUNAS)
    .eq("token", identificador)
    .maybeSingle();

  return porToken ?? null;
}

/**
 * O diário por apelido ou token. Devolve `null` para endereço inexistente, e
 * a rota responde 404 — igual ao orçamento e ao relatório.
 */
export async function carregarDiarioPorToken(
  identificador: string,
): Promise<DiarioPublico | null> {
  const data = await acharDiario(identificador);
  if (!data) return null;

  return {
    id: data.id,
    token: data.token,
    apelido: data.apelido,
    titulo: data.titulo,
    autorNome: data.autor_nome,
    temSenha: Boolean(data.senha),
    empreiteira: await empreiteiraDaOrg(data.org_id),
  };
}

/**
 * A senha guardada e o token canônico, para o gate.
 *
 * Devolve o token mesmo quando a pessoa entrou pelo apelido: é ele que dá
 * nome ao cookie, e assim destravar por um endereço destrava pelo outro
 * dentro do mesmo domínio, em vez de pedir a senha duas vezes.
 */
export async function autenticacaoDoDiario(
  identificador: string,
): Promise<{ token: string; senha: string | null } | null> {
  const data = await acharDiario(identificador);
  return data ? { token: data.token, senha: data.senha } : null;
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
