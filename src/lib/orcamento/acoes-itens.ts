"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/admin/sessao";
import { lerNumero } from "./formato";
import type { Resultado } from "@/lib/admin/tipos";

/**
 * CRUD da tabela de custos.
 *
 * Três regras atravessam tudo aqui:
 *
 * 1. **`valor_unitario` nulo é informação**, não campo vazio: quer dizer que o
 *    preço não foi dito. Quem preenche é gente. Por isso `lerNumero("")`
 *    devolve `null` e não zero — zero seria "de graça", e sairia impresso.
 * 2. **Mão humana marca a linha.** Toda escrita daqui carimba `editado_em` e,
 *    quando o item nasce na mão, `origem = 'humano'`. É o que permite a
 *    regeração da Fase 2 mesclar em vez de atropelar.
 * 3. **Apagar é reversível** enquanto o orçamento é rascunho: grava
 *    `removido_em`. A linha some da tabela e continua recuperável.
 * 4. **`custo_unitario` é separado de `valor_unitario`.** Um é o que a obra
 *    custa (tabela ou digitado), o outro é o preço de venda que sai no
 *    documento do cliente. Nunca confundir os dois em uma leitura futura.
 */

async function orcamentoDaOrg(orcamentoId: string): Promise<boolean> {
  const { orgId } = await exigirAdmin();
  const { data } = await supabaseAdmin()
    .from("orc_orcamentos")
    .select("id")
    .eq("id", orcamentoId)
    .eq("org_id", orgId)
    .maybeSingle();
  return Boolean(data);
}

function revalidar(orcamentoId: string) {
  revalidatePath(`/admin/orcamentos/${orcamentoId}`);
  revalidatePath("/admin/orcamentos");
}

export async function adicionarItem(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const orcamentoId = String(form.get("orcamentoId") ?? "");
  if (!(await orcamentoDaOrg(orcamentoId))) {
    return { ok: false, erro: "Orçamento inválido." };
  }

  const descricao = String(form.get("descricao") ?? "").trim();
  if (descricao.length < 2) {
    return { ok: false, erro: "Escreva o que é o serviço ou o material." };
  }

  const sb = supabaseAdmin();

  // A última posição da tabela, inclusive contando o que foi removido: reusar
  // a posição de um item apagado quebraria o índice único se ele voltasse.
  const { data: ultimo } = await sb
    .from("orc_itens")
    .select("position")
    .eq("orcamento_id", orcamentoId)
    .order("position", { ascending: false })
    .limit(1);

  const { error } = await sb.from("orc_itens").insert({
    orcamento_id: orcamentoId,
    position: (ultimo?.[0]?.position ?? 0) + 1,
    grupo: String(form.get("grupo") ?? "").trim() || null,
    descricao,
    quantidade: lerNumero(String(form.get("quantidade") ?? "")),
    unidade: String(form.get("unidade") ?? "").trim() || null,
    valor_unitario: lerNumero(String(form.get("valorUnitario") ?? "")),
    custo_unitario: lerNumero(String(form.get("custoUnitario") ?? "")),
    // Quem decide se o vínculo com a composição continua válido é o editor,
    // no navegador: escolher uma sugestão preenche este campo escondido,
    // editar descrição ou custo depois o limpa. Aqui só se grava o que veio.
    composicao_id: String(form.get("composicaoId") ?? "").trim() || null,
    observacao: String(form.get("observacao") ?? "").trim() || null,
    origem: "humano",
    editado_em: new Date().toISOString(),
  });

  if (error) return { ok: false, erro: error.message };

  revalidar(orcamentoId);
  return { ok: true };
}

export async function atualizarItem(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const orcamentoId = String(form.get("orcamentoId") ?? "");
  const id = String(form.get("id") ?? "");
  if (!id || !(await orcamentoDaOrg(orcamentoId))) {
    return { ok: false, erro: "Item inválido." };
  }

  const descricao = String(form.get("descricao") ?? "").trim();
  if (descricao.length < 2) {
    return { ok: false, erro: "Escreva o que é o serviço ou o material." };
  }

  const quantidade = lerNumero(String(form.get("quantidade") ?? ""));
  const valorUnitario = lerNumero(String(form.get("valorUnitario") ?? ""));
  const custoUnitario = lerNumero(String(form.get("custoUnitario") ?? ""));

  if (quantidade !== null && quantidade < 0) {
    return { ok: false, erro: "A quantidade não pode ser negativa." };
  }
  if (valorUnitario !== null && valorUnitario < 0) {
    return { ok: false, erro: "O valor não pode ser negativo." };
  }
  if (custoUnitario !== null && custoUnitario < 0) {
    return { ok: false, erro: "O custo não pode ser negativo." };
  }

  const { error } = await supabaseAdmin()
    .from("orc_itens")
    .update({
      grupo: String(form.get("grupo") ?? "").trim() || null,
      descricao,
      quantidade,
      unidade: String(form.get("unidade") ?? "").trim() || null,
      valor_unitario: valorUnitario,
      custo_unitario: custoUnitario,
      composicao_id: String(form.get("composicaoId") ?? "").trim() || null,
      observacao: String(form.get("observacao") ?? "").trim() || null,
      editado_em: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("orcamento_id", orcamentoId);

  if (error) return { ok: false, erro: error.message };

  revalidar(orcamentoId);
  return { ok: true };
}

export async function removerItem(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const orcamentoId = String(form.get("orcamentoId") ?? "");
  const id = String(form.get("id") ?? "");
  if (!id || !(await orcamentoDaOrg(orcamentoId))) {
    return { ok: false, erro: "Item inválido." };
  }

  const voltar = form.get("voltar") === "1";

  const { error } = await supabaseAdmin()
    .from("orc_itens")
    .update({ removido_em: voltar ? null : new Date().toISOString() })
    .eq("id", id)
    .eq("orcamento_id", orcamentoId);

  if (error) return { ok: false, erro: error.message };

  revalidar(orcamentoId);
  return { ok: true };
}

/**
 * Sobe ou desce um item na tabela.
 *
 * Trocar duas posições direto viola o índice único `(orcamento_id, position)`
 * no meio da troca, porque o Postgres valida linha a linha. A saída é a mesma
 * das atividades do outro produto: estacionar uma delas numa posição negativa,
 * que nenhum item legítimo ocupa, e só então assentar as duas.
 */
export async function moverItem(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const orcamentoId = String(form.get("orcamentoId") ?? "");
  const id = String(form.get("id") ?? "");
  const direcao = String(form.get("direcao") ?? "");

  if (!id || !(await orcamentoDaOrg(orcamentoId))) {
    return { ok: false, erro: "Item inválido." };
  }
  if (direcao !== "cima" && direcao !== "baixo") {
    return { ok: false, erro: "Direção inválida." };
  }

  const sb = supabaseAdmin();

  const { data: atual } = await sb
    .from("orc_itens")
    .select("id, position")
    .eq("id", id)
    .eq("orcamento_id", orcamentoId)
    .maybeSingle();
  if (!atual) return { ok: false, erro: "Item não encontrado." };

  // O vizinho é o próximo item VIVO: pular os removidos evita a troca que não
  // mexe em nada visível na tela.
  const consulta = sb
    .from("orc_itens")
    .select("id, position")
    .eq("orcamento_id", orcamentoId)
    .is("removido_em", null)
    .limit(1);

  const { data: vizinhos } =
    direcao === "cima"
      ? await consulta
          .lt("position", atual.position)
          .order("position", { ascending: false })
      : await consulta.gt("position", atual.position).order("position");

  const vizinho = vizinhos?.[0];
  if (!vizinho) return { ok: true };

  // A vaga negativa é derivada da posição de origem, não um -1 fixo: se duas
  // trocas correrem juntas no mesmo orçamento, elas não disputam a mesma vaga.
  await sb
    .from("orc_itens")
    .update({ position: -(atual.position + 1) })
    .eq("id", atual.id);
  await sb
    .from("orc_itens")
    .update({ position: atual.position })
    .eq("id", vizinho.id);
  const { error } = await sb
    .from("orc_itens")
    .update({ position: vizinho.position })
    .eq("id", atual.id);

  if (error) return { ok: false, erro: error.message };

  revalidar(orcamentoId);
  return { ok: true };
}
