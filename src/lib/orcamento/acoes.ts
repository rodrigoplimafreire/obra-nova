"use server";

import { revalidatePath } from "next/cache";
import { BUCKET, supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/admin/sessao";
import { proximoNumero } from "./dados";
import { lerNumero } from "./formato";
import { MARCA_PADRAO } from "./marcas";
import type { Resultado } from "@/lib/admin/tipos";

/**
 * CRUD do orçamento em si — o cabeçalho do documento.
 *
 * Toda ação passa por `exigirAdmin()` antes de tocar no banco, e toda escrita
 * filtra por `org_id` além do `id`: a RLS já protegeria, mas estas rotas usam a
 * service key, que passa por cima dela. O filtro é a proteção de verdade aqui.
 */

function texto(form: FormData, campo: string): string | null {
  return String(form.get(campo) ?? "").trim() || null;
}

export async function criarOrcamento(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const { orgId, id: userId } = await exigirAdmin();

  const cliente = String(form.get("cliente") ?? "").trim();
  if (cliente.length < 2) {
    return { ok: false, erro: "Escreva para quem é o orçamento." };
  }

  const { data, error } = await supabaseAdmin()
    .from("orc_orcamentos")
    .insert({
      org_id: orgId,
      cliente_nome: cliente,
      cliente_contato: texto(form, "contato"),
      endereco: texto(form, "endereco"),
      objeto: texto(form, "objeto"),
      criado_por: userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, erro: error?.message ?? "Falha ao criar o orçamento." };
  }

  revalidatePath("/admin/orcamentos");
  return { ok: true, link: `/admin/orcamentos/${data.id}` };
}

export async function atualizarOrcamento(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const { orgId } = await exigirAdmin();

  const id = String(form.get("id") ?? "");
  if (!id) return { ok: false, erro: "Orçamento inválido." };

  const cliente = String(form.get("cliente") ?? "").trim();
  if (cliente.length < 2) {
    return { ok: false, erro: "Escreva para quem é o orçamento." };
  }

  const validade = lerNumero(String(form.get("validadeDias") ?? ""));
  if (validade !== null && (validade < 1 || validade > 365)) {
    return { ok: false, erro: "A validade precisa ficar entre 1 e 365 dias." };
  }

  // Preço fechado é exceção, não regra: quando vem preenchido, ele manda sobre
  // a soma dos itens e a tabela sai sem coluna de valor. Vazio volta ao normal.
  const valorFechado = lerNumero(String(form.get("valorFechado") ?? ""));
  if (valorFechado !== null && valorFechado < 0) {
    return { ok: false, erro: "O valor fechado não pode ser negativo." };
  }

  // BDI é ponto de partida, não trava: usado só para pré-preencher o preço de
  // venda de item novo. Por isso o teto é largo — 0 a 500% — e não impede nada
  // se ele quiser digitar um número fora do comum.
  const bdi = lerNumero(String(form.get("bdiPadrao") ?? ""));
  if (bdi !== null && (bdi < 0 || bdi > 500)) {
    return { ok: false, erro: "O BDI precisa ficar entre 0% e 500%." };
  }

  const { error } = await supabaseAdmin()
    .from("orc_orcamentos")
    .update({
      cliente_nome: cliente,
      cliente_contato: texto(form, "contato"),
      endereco: texto(form, "endereco"),
      objeto: texto(form, "objeto"),
      prazo: texto(form, "prazo"),
      pagamento: texto(form, "pagamento"),
      observacoes: texto(form, "observacoes"),
      senha: texto(form, "senha"),
      obra_id: texto(form, "obraId"),
      marca: texto(form, "marca") ?? MARCA_PADRAO,
      validade_dias: validade ?? 15,
      valor_fechado: valorFechado,
      bdi_padrao: bdi ?? 30,
    })
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/admin/orcamentos/${id}`);
  revalidatePath("/admin/orcamentos");
  return { ok: true };
}

/**
 * Dá número ao documento. Só uma vez: o número que já foi para o cliente não
 * muda, mesmo que o orçamento seja reescrito inteiro depois.
 */
export async function numerarOrcamento(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const { orgId } = await exigirAdmin();
  const id = String(form.get("id") ?? "");
  if (!id) return { ok: false, erro: "Orçamento inválido." };

  const sb = supabaseAdmin();
  const { data: atual } = await sb
    .from("orc_orcamentos")
    .select("numero")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!atual) return { ok: false, erro: "Orçamento não encontrado." };
  if (atual.numero) return { ok: true };

  const { error } = await sb
    .from("orc_orcamentos")
    .update({ numero: await proximoNumero() })
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/admin/orcamentos/${id}`);
  return { ok: true };
}

/**
 * O orçamento vira obra.
 *
 * É a costura entre os dois módulos: o preço foi aprovado, agora existe um
 * canteiro para acompanhar. A obra nasce com os dados que o orçamento já tem e
 * com o link do escritório, igual a qualquer obra criada à mão — daí a
 * duplicação do insert do mestre, que é a regra do outro módulo e não desta
 * ação.
 *
 * Idempotente: orçamento que já tem obra devolve a obra existente em vez de
 * criar a segunda.
 */
export async function gerarObraDoOrcamento(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const { orgId } = await exigirAdmin();
  const id = String(form.get("id") ?? "");
  if (!id) return { ok: false, erro: "Orçamento inválido." };

  const sb = supabaseAdmin();

  const { data: orcamento } = await sb
    .from("orc_orcamentos")
    .select("id, obra_id, cliente_nome, objeto, endereco")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!orcamento) return { ok: false, erro: "Orçamento não encontrado." };
  if (orcamento.obra_id) {
    return { ok: true, link: `/admin/obras/${orcamento.obra_id}` };
  }

  const { data: obra, error } = await sb
    .from("obras")
    .insert({
      org_id: orgId,
      nome: orcamento.objeto ?? `Obra de ${orcamento.cliente_nome}`,
      cliente_nome: orcamento.cliente_nome,
      endereco: orcamento.endereco,
    })
    .select("id")
    .single();

  if (error || !obra) {
    return { ok: false, erro: error?.message ?? "Falha ao criar a obra." };
  }

  await sb
    .from("mestres")
    .insert({ obra_id: obra.id, nome: "Escritório", escritorio: true });

  await sb
    .from("orc_orcamentos")
    .update({ obra_id: obra.id })
    .eq("id", id)
    .eq("org_id", orgId);

  revalidatePath("/admin/obras");
  revalidatePath(`/admin/orcamentos/${id}`);
  return { ok: true, link: `/admin/obras/${obra.id}` };
}

/**
 * Arquivar tira da lista sem apagar nada. É o que se faz com orçamento que o
 * cliente recusou: some da tela, continua existindo para consulta.
 */
export async function arquivarOrcamento(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const { orgId } = await exigirAdmin();
  const id = String(form.get("id") ?? "");
  if (!id) return { ok: false, erro: "Orçamento inválido." };

  const voltar = form.get("voltar") === "1";

  const { error } = await supabaseAdmin()
    .from("orc_orcamentos")
    .update({ status: voltar ? "conferindo" : "arquivado" })
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/admin/orcamentos");
  revalidatePath(`/admin/orcamentos/${id}`);
  return { ok: true };
}

/**
 * Apagar de verdade, com cascata para itens, perguntas, áudios e publicações.
 *
 * Fica atrás de uma confirmação por digitação na tela, e é recusado depois de
 * publicado: o cliente pode estar com o link aberto. Para esse caso existe o
 * arquivar.
 */
export async function excluirOrcamento(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const { orgId } = await exigirAdmin();
  const id = String(form.get("id") ?? "");
  if (!id) return { ok: false, erro: "Orçamento inválido." };

  const sb = supabaseAdmin();

  const { data: alvo } = await sb
    .from("orc_orcamentos")
    .select("id, cliente_nome")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!alvo) return { ok: false, erro: "Orçamento não encontrado." };

  const { count } = await sb
    .from("orc_publicacoes")
    .select("id", { count: "exact", head: true })
    .eq("orcamento_id", id);

  if (count && count > 0) {
    return {
      ok: false,
      erro: "Este orçamento já foi enviado ao cliente. Arquive em vez de apagar.",
    };
  }

  // A cascata do banco não alcança o Storage: sem isto os áudios ficariam
  // órfãos no bucket para sempre, ocupando cota e sem nada que os aponte.
  const { data: arquivos } = await sb
    .from("orc_blocos")
    .select("storage_path")
    .eq("orcamento_id", id)
    .not("storage_path", "is", null);

  const caminhos = (arquivos ?? [])
    .map((b) => b.storage_path)
    .filter((c): c is string => Boolean(c));

  if (caminhos.length) await sb.storage.from(BUCKET).remove(caminhos);

  const { error } = await sb
    .from("orc_orcamentos")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/admin/orcamentos");
  return { ok: true, link: "/admin/orcamentos" };
}
