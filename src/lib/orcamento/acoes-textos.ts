"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/admin/sessao";
import { escreverTextosDoDocumento } from "./textos-do-documento";
import type { Resultado } from "@/lib/admin/tipos";
import type { Enums } from "@/lib/database.types";

/**
 * Os textos do documento: os quatro parágrafos soltos e os blocos com título.
 *
 * Nada aqui é obrigatório para publicar. Um orçamento sem texto nenhum sai
 * como sempre saiu — a funcionalidade acrescenta voz, não requisito.
 */

const TIPOS = ["projeto", "observacao", "etapa"] as const;
type TipoDeSecao = Enums<"orc_secao_tipo">;

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
}

/** Campo em branco volta a `null`, não a string vazia: apagar é uma decisão. */
function ouNulo(form: FormData, campo: string): string | null {
  const valor = String(form.get(campo) ?? "").trim();
  return valor.length > 0 ? valor : null;
}

export async function salvarTextos(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const id = String(form.get("id") ?? "");
  if (!(await orcamentoDaOrg(id))) {
    return { ok: false, erro: "Orçamento inválido." };
  }

  const { error } = await supabaseAdmin()
    .from("orc_orcamentos")
    .update({
      apresentacao: ouNulo(form, "apresentacao"),
      intro_custos: ouNulo(form, "introCustos"),
      nota_custos: ouNulo(form, "notaCustos"),
      intro_aceite: ouNulo(form, "introAceite"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false, erro: error.message };

  revalidar(id);
  return { ok: true };
}

function lerTipo(form: FormData): TipoDeSecao | null {
  const bruto = String(form.get("tipo") ?? "");
  return TIPOS.find((t) => t === bruto) ?? null;
}

export async function salvarSecao(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const orcamentoId = String(form.get("orcamentoId") ?? "");
  if (!(await orcamentoDaOrg(orcamentoId))) {
    return { ok: false, erro: "Orçamento inválido." };
  }

  const tipo = lerTipo(form);
  if (!tipo) return { ok: false, erro: "Tipo de bloco inválido." };

  const titulo = String(form.get("titulo") ?? "").trim();
  const texto = String(form.get("texto") ?? "").trim();
  if (titulo.length < 2) return { ok: false, erro: "Escreva um título." };
  if (texto.length < 2) return { ok: false, erro: "Escreva o texto do bloco." };

  const sb = supabaseAdmin();
  const id = String(form.get("id") ?? "");

  if (id) {
    // Editar à mão tira o carimbo da IA: o bloco passa a ser texto do Reginato,
    // e a etiqueta "escrito pela IA" some da tela.
    const { error } = await sb
      .from("orc_secoes")
      .update({
        titulo,
        texto,
        origem: "humano",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("orcamento_id", orcamentoId);

    if (error) return { ok: false, erro: error.message };
    revalidar(orcamentoId);
    return { ok: true };
  }

  // Posição por tipo: cada lista tem a sua ordem, e as três convivem na
  // mesma tabela.
  const { data: ultima } = await sb
    .from("orc_secoes")
    .select("position")
    .eq("orcamento_id", orcamentoId)
    .eq("tipo", tipo)
    .order("position", { ascending: false })
    .limit(1);

  const { error } = await sb.from("orc_secoes").insert({
    orcamento_id: orcamentoId,
    tipo,
    position: (ultima?.[0]?.position ?? 0) + 1,
    titulo,
    texto,
    origem: "humano",
  });

  if (error) return { ok: false, erro: error.message };
  revalidar(orcamentoId);
  return { ok: true };
}

export async function removerSecao(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const orcamentoId = String(form.get("orcamentoId") ?? "");
  if (!(await orcamentoDaOrg(orcamentoId))) {
    return { ok: false, erro: "Orçamento inválido." };
  }

  // Sem lixeira, diferente dos itens da tabela: um parágrafo se reescreve em
  // trinta segundos, e a IA reescreve todos de uma vez. Guardar removido aqui
  // seria peso sem ganho.
  const { error } = await supabaseAdmin()
    .from("orc_secoes")
    .delete()
    .eq("id", String(form.get("id") ?? ""))
    .eq("orcamento_id", orcamentoId);

  if (error) return { ok: false, erro: error.message };
  revalidar(orcamentoId);
  return { ok: true };
}

export async function moverSecao(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const orcamentoId = String(form.get("orcamentoId") ?? "");
  if (!(await orcamentoDaOrg(orcamentoId))) {
    return { ok: false, erro: "Orçamento inválido." };
  }

  const id = String(form.get("id") ?? "");
  const paraCima = String(form.get("direcao") ?? "") === "cima";

  const sb = supabaseAdmin();
  const { data: atual } = await sb
    .from("orc_secoes")
    .select("id, tipo, position")
    .eq("id", id)
    .eq("orcamento_id", orcamentoId)
    .maybeSingle();
  if (!atual) return { ok: false, erro: "Bloco não encontrado." };

  // A vizinha dentro do mesmo tipo. Ordenar e trocar as posições duas a duas
  // sobrevive a buraco na sequência, que aparece toda vez que um bloco é
  // apagado no meio.
  const { data: vizinha } = await sb
    .from("orc_secoes")
    .select("id, position")
    .eq("orcamento_id", orcamentoId)
    .eq("tipo", atual.tipo)
    [paraCima ? "lt" : "gt"]("position", atual.position)
    .order("position", { ascending: !paraCima })
    .limit(1)
    .maybeSingle();

  if (!vizinha) return { ok: true };

  await Promise.all([
    sb
      .from("orc_secoes")
      .update({ position: vizinha.position })
      .eq("id", atual.id),
    sb
      .from("orc_secoes")
      .update({ position: atual.position })
      .eq("id", vizinha.id),
  ]);

  revalidar(orcamentoId);
  return { ok: true };
}

export type ResultadoDaEscrita =
  | { ok: true; blocos: number }
  | { ok: false; erro: string };

/**
 * A IA escreve os textos a partir da tabela e da fala.
 *
 * **Substitui, não acumula.** Rodar duas vezes não gera oito observações: os
 * blocos que a IA escreveu antes saem, os que foram editados à mão ficam. É a
 * mesma disciplina do resto do módulo — trabalho humano não se atropela.
 *
 * Os quatro parágrafos soltos só são preenchidos se estiverem vazios, pela
 * mesma razão.
 */
export async function escreverTextosComIA(
  orcamentoId: string,
): Promise<ResultadoDaEscrita> {
  if (!(await orcamentoDaOrg(orcamentoId))) {
    return { ok: false, erro: "Orçamento inválido." };
  }

  const saida = await escreverTextosDoDocumento(orcamentoId);
  if (!saida.ok) return { ok: false, erro: saida.erro };

  const sb = supabaseAdmin();
  const { textos } = saida;

  const { data: atual } = await sb
    .from("orc_orcamentos")
    .select("apresentacao, intro_custos, nota_custos, intro_aceite")
    .eq("id", orcamentoId)
    .maybeSingle();

  const { error: erroTextos } = await sb
    .from("orc_orcamentos")
    .update({
      apresentacao: atual?.apresentacao ?? textos.apresentacao,
      intro_custos: atual?.intro_custos ?? textos.introCustos,
      nota_custos: atual?.nota_custos ?? textos.notaCustos,
      intro_aceite: atual?.intro_aceite ?? textos.introAceite,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orcamentoId);

  if (erroTextos) return { ok: false, erro: erroTextos.message };

  await sb
    .from("orc_secoes")
    .delete()
    .eq("orcamento_id", orcamentoId)
    .eq("origem", "ia");

  const novos = [
    ...textos.projeto.map((b, i) => ({ ...b, tipo: "projeto" as const, i })),
    ...textos.observacoes.map((b, i) => ({
      ...b,
      tipo: "observacao" as const,
      i,
    })),
    ...textos.etapas.map((b, i) => ({ ...b, tipo: "etapa" as const, i })),
  ];

  if (novos.length > 0) {
    // Entram depois do que já existe, por tipo, para não brigar de posição
    // com os blocos escritos à mão.
    const { data: existentes } = await sb
      .from("orc_secoes")
      .select("tipo, position")
      .eq("orcamento_id", orcamentoId);

    const maior = new Map<string, number>();
    for (const e of existentes ?? []) {
      maior.set(e.tipo, Math.max(maior.get(e.tipo) ?? 0, e.position));
    }

    const { error } = await sb.from("orc_secoes").insert(
      novos.map((b) => ({
        orcamento_id: orcamentoId,
        tipo: b.tipo,
        position: (maior.get(b.tipo) ?? 0) + b.i + 1,
        titulo: b.titulo,
        texto: b.texto,
        origem: "ia" as const,
      })),
    );

    if (error) return { ok: false, erro: error.message };
  }

  revalidar(orcamentoId);
  return { ok: true, blocos: novos.length };
}
