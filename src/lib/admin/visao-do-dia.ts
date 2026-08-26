import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { orgAtual } from "./sessao";

/**
 * A visão do dia: o que atravessa os dois módulos.
 *
 * `/admin` só redirecionava para Obras, então não existia lugar que
 * respondesse "o que precisa de mim hoje?" — a resposta estava repartida entre
 * três telas. Aqui ela é uma consulta só, e nenhum número é novo: todos já
 * existem nas listas, agrupados por assunto em vez de por seção.
 *
 * Os quatro que ficaram são os que mudam decisão hoje. `orçamentos na rua`
 * pede telefonema; `sem preço` bloqueia envio; `confirmações pendentes` é o
 * mestre que ainda não respondeu; `obras em andamento` é o volume que se está
 * carregando. O resto é histórico e mora nas listas.
 */

export type VisaoDoDia = {
  /** Enviados e ainda sem desfecho. */
  orcamentosNaRua: number;
  /** Itens sem preço de venda, somando todos os orçamentos. Bloqueiam envio. */
  itensSemPreco: number;
  /** Soma congelada no aceite. */
  valorAprovado: number;
  obrasAtivas: number;
  /** Serviços lançados para hoje que o mestre ainda não confirmou. */
  confirmacoesPendentes: number;

  /** Para o roteiro de primeiros passos. */
  temOrcamento: boolean;
  temFala: boolean;
  temPublicacao: boolean;
  temObra: boolean;
};

function hojeEmSaoPaulo(): string {
  // `sv-SE` dá ISO (AAAA-MM-DD) sem precisar montar a string à mão.
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

export async function carregarVisaoDoDia(): Promise<VisaoDoDia> {
  const sb = supabaseAdmin();
  const org = await orgAtual();
  const hoje = hojeEmSaoPaulo();

  const { data: orcamentos } = await sb
    .from("orc_orcamentos")
    .select("id, situacao, valor_aprovado, status")
    .eq("org_id", org)
    .neq("status", "arquivado");

  const ids = (orcamentos ?? []).map((o) => o.id);

  const [{ data: itens }, { data: publicacoes }, { data: blocos }] =
    await Promise.all([
      ids.length
        ? sb
            .from("orc_itens")
            .select("valor_unitario")
            .in("orcamento_id", ids)
            .is("removido_em", null)
        : Promise.resolve({ data: [] }),
      ids.length
        ? sb.from("orc_publicacoes").select("id").in("orcamento_id", ids).limit(1)
        : Promise.resolve({ data: [] }),
      ids.length
        ? sb.from("orc_blocos").select("id").in("orcamento_id", ids).limit(1)
        : Promise.resolve({ data: [] }),
    ]);

  const { data: obras } = await sb
    .from("obras")
    .select("id")
    .eq("org_id", org)
    .eq("ativa", true);

  const idsDeObra = (obras ?? []).map((o) => o.id);

  const { data: atividades } = idsDeObra.length
    ? await sb
        .from("atividades")
        .select("id")
        .in("obra_id", idsDeObra)
        .eq("dia", hoje)
    : { data: [] };

  const idsDeAtividade = (atividades ?? []).map((a) => a.id);

  // Pendente é atividade de hoje **sem** confirmação respondida. A consulta
  // traz as respondidas e a conta é por diferença: `confirmacoes` só ganha
  // linha quando o mestre abre, então contar por lá deixaria de fora o serviço
  // que ninguém tocou — que é justamente o que interessa.
  const { data: respondidas } = idsDeAtividade.length
    ? await sb
        .from("confirmacoes")
        .select("atividade_id")
        .in("atividade_id", idsDeAtividade)
        .neq("status", "pendente")
    : { data: [] };

  const naRua = (orcamentos ?? []).filter((o) =>
    ["enviado", "visto", "negociando"].includes(o.situacao),
  ).length;

  return {
    orcamentosNaRua: naRua,
    itensSemPreco: (itens ?? []).filter((i) => i.valor_unitario === null).length,
    valorAprovado: (orcamentos ?? [])
      .filter((o) => o.situacao === "aprovado")
      .reduce((acc, o) => acc + (o.valor_aprovado ?? 0), 0),
    obrasAtivas: idsDeObra.length,
    confirmacoesPendentes: idsDeAtividade.length - (respondidas ?? []).length,

    temOrcamento: ids.length > 0,
    temFala: (blocos ?? []).length > 0,
    temPublicacao: (publicacoes ?? []).length > 0,
    temObra: idsDeObra.length > 0,
  };
}
