import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { empreiteiraDaOrg, type Empreiteira } from "@/lib/admin/empreiteira";
import { lerDocumento, type DocumentoPublicado } from "./publicacao";

/**
 * O que a página do cliente enxerga.
 *
 * Leitura por token, com service key, e nunca pela chave anônima — o cliente
 * final não tem conta e a RLS não teria como distinguir quem é. O filtro é o
 * token, e é o servidor que o resolve.
 *
 * Só a última versão publicada aparece. Sem publicação, a função devolve
 * `null` e a rota responde 404, igual a token inexistente: quem tem o link e
 * ainda não foi liberado não precisa saber que o orçamento existe.
 */

export type OrcamentoPublico = {
  id: string;
  token: string;
  temSenha: boolean;
  situacao: string;
  aprovadoEm: string | null;
  /**
   * Quem aceitou e quando, lido do evento que a própria ação de aceite grava.
   *
   * O documento mostra isso de volta para o cliente porque um aceite sem nome
   * e sem data não é registro de nada — é um selo bonito. Vem do evento e não
   * de uma coluna nova: o `orc_eventos` já é a memória do que aconteceu, e
   * duplicar o nome em `orc_orcamentos` criaria duas verdades.
   */
  aceite: { nome: string | null; em: string | null } | null;
  documento: DocumentoPublicado;
  /**
   * A empreiteira, lida ao vivo e não da fotografia publicada.
   *
   * Publicar congela **conteúdo e preço** — é disso que o cliente precisa
   * poder confiar. Logotipo e telefone são papel timbrado: quando a
   * empreiteira troca o logo ou muda o telefone, o certo é que o documento
   * antigo passe a mostrar o novo, e não que ela precise republicar tudo para
   * o cliente conseguir ligar.
   */
  empreiteira: Empreiteira;
};

export async function carregarOrcamentoPublicado(
  token: string,
): Promise<OrcamentoPublico | null> {
  if (!token) return null;
  const sb = supabaseAdmin();

  const { data: orcamento } = await sb
    .from("orc_orcamentos")
    .select("id, token, senha, situacao, aprovado_em, org_id")
    .eq("token", token)
    .maybeSingle();
  if (!orcamento) return null;

  const { data: publicacao } = await sb
    .from("orc_publicacoes")
    .select("dados, versao")
    .eq("orcamento_id", orcamento.id)
    .order("versao", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!publicacao) return null;

  const documento = lerDocumento(publicacao.dados);
  if (!documento) return null;

  return {
    id: orcamento.id,
    token: orcamento.token,
    // A senha em si nunca sai daqui: a página só precisa saber se existe.
    temSenha: Boolean(orcamento.senha),
    situacao: orcamento.situacao,
    aprovadoEm: orcamento.aprovado_em,
    aceite: await lerAceite(orcamento.id, orcamento.aprovado_em),
    documento,
    empreiteira: await empreiteiraDaOrg(orcamento.org_id),
  };
}

/**
 * O nome de quem aceitou, do último evento de aceite.
 *
 * Devolve a data mesmo sem nome: orçamento aprovado pelo painel não passa por
 * aqui e não tem quem assine, e nesse caso o documento mostra só a data.
 */
async function lerAceite(
  orcamentoId: string,
  aprovadoEm: string | null,
): Promise<{ nome: string | null; em: string | null } | null> {
  if (!aprovadoEm) return null;

  const { data } = await supabaseAdmin()
    .from("orc_eventos")
    .select("detalhe, created_at")
    .eq("orcamento_id", orcamentoId)
    .eq("tipo", "aceito")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const detalhe = data?.detalhe as { nome?: unknown } | null;
  const nome = typeof detalhe?.nome === "string" ? detalhe.nome.trim() : null;

  return { nome: nome || null, em: data?.created_at ?? aprovadoEm };
}

/** Confere a senha do gate. Comparação no servidor, nunca no navegador. */
export async function senhaConfere(
  token: string,
  tentativa: string,
): Promise<boolean> {
  const { data } = await supabaseAdmin()
    .from("orc_orcamentos")
    .select("senha")
    .eq("token", token)
    .maybeSingle();

  if (!data?.senha) return false;
  return data.senha.trim() === tentativa.trim();
}

/**
 * Marca que o cliente abriu.
 *
 * Roda depois do gate, não antes: abrir a URL não é ler a proposta, e contar o
 * bot do WhatsApp que faz preview do link como "o cliente viu" seria mentira
 * na tela de quem vai decidir se liga hoje.
 *
 * Nunca rebaixa a situação — quem já está negociando ou aprovado não volta
 * para "visto" só porque abriu de novo.
 */
export async function registrarAbertura(token: string): Promise<void> {
  const sb = supabaseAdmin();

  const { data: orcamento } = await sb
    .from("orc_orcamentos")
    .select("id, situacao, visto_em, aberturas")
    .eq("token", token)
    .maybeSingle();
  if (!orcamento) return;

  const agora = new Date().toISOString();
  const primeira = !orcamento.visto_em;

  await sb
    .from("orc_orcamentos")
    .update({
      visto_em: orcamento.visto_em ?? agora,
      visto_ultima_em: agora,
      aberturas: orcamento.aberturas + 1,
      ...(["rascunho", "enviado"].includes(orcamento.situacao)
        ? { situacao: "visto" as const }
        : {}),
    })
    .eq("id", orcamento.id);

  // Um evento por abertura, para a linha do tempo mostrar o ritmo: quatro
  // aberturas em dois dias sem resposta diz mais que "visto".
  await sb.from("orc_eventos").insert({
    orcamento_id: orcamento.id,
    tipo: "aberto",
    detalhe: { primeira },
  });
}
