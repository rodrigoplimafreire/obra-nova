"use server";

import { revalidatePath } from "next/cache";
import { BUCKET, supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "./sessao";
import { pendenciasAntesDe } from "./obras";
import type { Resultado } from "./tipos";

/** Toda ação passa por `exigirAdmin()` antes de tocar no banco. */

const FORMATO_DE_DIA = /^\d{4}-\d{2}-\d{2}$/;

export async function criarObra(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const { orgId } = await exigirAdmin();

  const nome = String(form.get("nome") ?? "").trim();
  const cliente = String(form.get("cliente") ?? "").trim();
  const endereco = String(form.get("endereco") ?? "").trim() || null;

  if (nome.length < 2) return { ok: false, erro: "Escreva o nome da obra." };
  if (cliente.length < 2) {
    return { ok: false, erro: "Escreva para quem é a obra. É o nome que vai no relatório." };
  }

  const { data, error } = await supabaseAdmin()
    .from("obras")
    .insert({ org_id: orgId, nome, cliente_nome: cliente, endereco })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, erro: error?.message ?? "Falha ao criar a obra." };
  }

  // Toda obra nasce com o link do escritório. É por ele que lançamos o que o
  // cliente passou por áudio, quando o canteiro não lança sozinho — e ele
  // alcança a semana inteira, não só o dia de hoje.
  await supabaseAdmin()
    .from("mestres")
    .insert({ obra_id: data.id, nome: "Escritório", escritorio: true });

  revalidatePath("/admin/obras");
  return { ok: true, link: `/admin/obras/${data.id}` };
}

export async function atualizarObra(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const { orgId } = await exigirAdmin();

  const id = String(form.get("id") ?? "");
  const nome = String(form.get("nome") ?? "").trim();
  const cliente = String(form.get("cliente") ?? "").trim();
  const endereco = String(form.get("endereco") ?? "").trim() || null;
  // Quem assina o relatório do cliente. Vazio volta ao padrão da conta.
  const marcaNome = String(form.get("marcaNome") ?? "").trim() || null;

  if (!id) return { ok: false, erro: "Obra inválida." };
  if (nome.length < 2) return { ok: false, erro: "Escreva o nome da obra." };
  if (cliente.length < 2) {
    return { ok: false, erro: "Escreva para quem é a obra." };
  }

  const { error } = await supabaseAdmin()
    .from("obras")
    .update({
      nome,
      cliente_nome: cliente,
      endereco,
      marca_nome: marcaNome,
    })
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/admin/obras/${id}`);
  revalidatePath("/admin/obras");
  return { ok: true };
}

export async function adicionarMestre(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const { orgId } = await exigirAdmin();

  const obraId = String(form.get("obraId") ?? "");
  const nome = String(form.get("nome") ?? "").trim();
  const telefone = String(form.get("telefone") ?? "").trim() || null;

  if (!obraId) return { ok: false, erro: "Obra inválida." };
  if (nome.length < 2) return { ok: false, erro: "Escreva o nome do mestre." };

  const sb = supabaseAdmin();
  const { data: obra } = await sb
    .from("obras")
    .select("id")
    .eq("id", obraId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!obra) return { ok: false, erro: "Obra não encontrada." };

  const { data, error } = await sb
    .from("mestres")
    .insert({ obra_id: obraId, nome, telefone })
    .select("token")
    .single();

  if (error || !data) {
    return { ok: false, erro: error?.message ?? "Falha ao adicionar o mestre." };
  }

  revalidatePath(`/admin/obras/${obraId}`);
  return { ok: true, link: `/o/${data.token}` };
}

export async function removerMestre(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  await exigirAdmin();

  const obraId = String(form.get("obraId") ?? "");
  const mestreId = String(form.get("mestreId") ?? "");
  if (!obraId || !mestreId) return { ok: false, erro: "Mestre inválido." };

  // Inativa em vez de apagar: apagar levaria junto, por cascata, toda a
  // evidência que ele já mandou, e o relatório da semana ficaria com buraco.
  const { error } = await supabaseAdmin()
    .from("mestres")
    .update({ ativo: false })
    .eq("id", mestreId)
    .eq("obra_id", obraId);

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/admin/obras/${obraId}`);
  return { ok: true };
}

/**
 * Salva o checklist do dia a partir de um texto, uma atividade por linha.
 *
 * Não é apagar e reinserir. Uma atividade que o mestre já confirmou carrega
 * foto e áudio; sumir com ela por causa de uma edição de última hora apagaria
 * prova de serviço feito. Então: o que saiu da lista e ainda não foi tocado é
 * removido, e o que saiu mas já tem confirmação fica, com aviso.
 */
export async function salvarAtividadesDoDia(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const { orgId } = await exigirAdmin();

  const obraId = String(form.get("obraId") ?? "");
  const dia = String(form.get("dia") ?? "");
  const bruto = String(form.get("atividades") ?? "");

  if (!obraId) return { ok: false, erro: "Obra inválida." };
  if (!FORMATO_DE_DIA.test(dia)) return { ok: false, erro: "Data inválida." };

  const desejadas = bruto
    .split("\n")
    .map((l) => l.replace(/^\s*[-•*]\s*/, "").trim())
    .filter((l) => l.length > 0);

  if (desejadas.length > 40) {
    return { ok: false, erro: "São muitas atividades para um dia só. Deixe até 40." };
  }

  const sb = supabaseAdmin();

  const { data: obra } = await sb
    .from("obras")
    .select("id")
    .eq("id", obraId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!obra) return { ok: false, erro: "Obra não encontrada." };

  const { data: existentes } = await sb
    .from("atividades")
    .select("id, titulo")
    .eq("obra_id", obraId)
    .eq("dia", dia);

  const atuais = existentes ?? [];

  // Quais das existentes já têm confirmação: essas não podem ser removidas.
  const { data: confirmadas } = atuais.length
    ? await sb
        .from("confirmacoes")
        .select("atividade_id")
        .in(
          "atividade_id",
          atuais.map((a) => a.id),
        )
    : { data: [] };

  const temEvidencia = new Set(
    (confirmadas ?? []).map((c) => c.atividade_id),
  );

  const porTitulo = new Map(atuais.map((a) => [a.titulo, a]));
  const mantidas = new Set(
    desejadas.map((t) => porTitulo.get(t)?.id).filter((id): id is string => Boolean(id)),
  );

  // Saiu da lista e já tem evidência: fica, mas vai para o fim. Some da lista
  // do mestre como tarefa do dia e continua existindo como serviço registrado.
  const protegidas = atuais.filter(
    (a) => !mantidas.has(a.id) && temEvidencia.has(a.id),
  );

  const paraRemover = atuais
    .filter((a) => !mantidas.has(a.id) && !temEvidencia.has(a.id))
    .map((a) => a.id);

  if (paraRemover.length) {
    const { error } = await sb.from("atividades").delete().in("id", paraRemover);
    if (error) return { ok: false, erro: error.message };
  }

  // A ordem final: o que você pediu, e no fim o que ficou protegido.
  const finais = [
    ...desejadas.map((titulo) => ({ id: porTitulo.get(titulo)?.id, titulo })),
    ...protegidas.map((a) => ({ id: a.id, titulo: a.titulo })),
  ];

  // Duas passadas por causa do unique (obra_id, dia, position). A primeira
  // estaciona cada linha numa posição negativa DIFERENTE: mandar todas para -1
  // colidiria entre elas, que foi exatamente o bug que deixou uma atividade
  // parada em -1 e fora de ordem na tela.
  const jaNoBanco = finais.filter(
    (f): f is { id: string; titulo: string } => Boolean(f.id),
  );

  for (const [i, f] of jaNoBanco.entries()) {
    const { error } = await sb
      .from("atividades")
      .update({ position: -(i + 1) })
      .eq("id", f.id);
    if (error) return { ok: false, erro: error.message };
  }

  for (const [i, f] of finais.entries()) {
    if (f.id) {
      const { error } = await sb
        .from("atividades")
        .update({ position: i })
        .eq("id", f.id);
      if (error) return { ok: false, erro: error.message };
    } else {
      const { error } = await sb
        .from("atividades")
        .insert({ obra_id: obraId, dia, position: i, titulo: f.titulo });
      if (error) return { ok: false, erro: error.message };
    }
  }

  revalidatePath(`/admin/obras/${obraId}`);
  revalidatePath("/admin/obras");

  if (protegidas.length > 0) {
    const n = protegidas.length;
    return {
      ok: true,
      erro: `${n} ${n === 1 ? "atividade foi" : "atividades foram"} para o fim da lista em vez de sair: o mestre já confirmou, e apagar levaria junto a foto e o áudio.`,
    };
  }
  return { ok: true };
}

/** Título e texto de apoio de uma atividade. O apoio vira o subtítulo na tela
 *  do mestre, onde cabe a instrução que não cabe no título. */
export async function atualizarAtividade(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const { orgId } = await exigirAdmin();

  const id = String(form.get("id") ?? "");
  const obraId = String(form.get("obraId") ?? "");
  const titulo = String(form.get("titulo") ?? "").trim();
  const detalhe = String(form.get("detalhe") ?? "").trim() || null;

  if (!id || !obraId) return { ok: false, erro: "Atividade inválida." };
  if (titulo.length < 3) {
    return { ok: false, erro: "Escreva o que precisa ser feito." };
  }

  const sb = supabaseAdmin();

  // A atividade precisa ser de uma obra da org. Sem isto, um id solto no
  // formulário editaria atividade de qualquer obra.
  const { data: atividade } = await sb
    .from("atividades")
    .select("id, obra_id")
    .eq("id", id)
    .eq("obra_id", obraId)
    .maybeSingle();
  if (!atividade) return { ok: false, erro: "Atividade não encontrada." };

  const { data: obra } = await sb
    .from("obras")
    .select("id")
    .eq("id", obraId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!obra) return { ok: false, erro: "Obra não encontrada." };

  const { error } = await sb
    .from("atividades")
    .update({ titulo, detalhe })
    .eq("id", id);

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/admin/obras/${obraId}`);
  return { ok: true };
}

/**
 * Traz para hoje o que ficou por fazer no último dia lançado.
 *
 * Copia, não move: a linha do dia anterior guarda a foto, o áudio e o status
 * de quem tentou e não terminou. Mover apagaria a prova de que o serviço foi
 * atacado naquele dia, que é justamente o que o relatório precisa contar.
 */
export async function trazerPendencias(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const { orgId } = await exigirAdmin();

  const obraId = String(form.get("obraId") ?? "");
  const dia = String(form.get("dia") ?? "");
  if (!obraId) return { ok: false, erro: "Obra inválida." };
  if (!FORMATO_DE_DIA.test(dia)) return { ok: false, erro: "Data inválida." };

  const sb = supabaseAdmin();

  const { data: obra } = await sb
    .from("obras")
    .select("id")
    .eq("id", obraId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!obra) return { ok: false, erro: "Obra não encontrada." };

  const { itens: pendentes } = await pendenciasAntesDe(obraId, dia);
  if (pendentes.length === 0) {
    return { ok: false, erro: "Não há pendência do dia anterior para trazer." };
  }

  const { data: jaHoje } = await sb
    .from("atividades")
    .select("titulo, position")
    .eq("obra_id", obraId)
    .eq("dia", dia);

  const titulosDeHoje = new Set((jaHoje ?? []).map((a) => a.titulo));
  const novas = pendentes.filter((p) => !titulosDeHoje.has(p.titulo));

  if (novas.length === 0) {
    return { ok: false, erro: "As pendências já estão na lista de hoje." };
  }

  const proxima = Math.max(-1, ...(jaHoje ?? []).map((a) => a.position)) + 1;

  const { error } = await sb.from("atividades").insert(
    novas.map((p, i) => ({
      obra_id: obraId,
      dia,
      position: proxima + i,
      titulo: p.titulo,
      detalhe: p.detalhe,
    })),
  );

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/admin/obras/${obraId}`);
  revalidatePath("/admin/obras");
  return { ok: true };
}

/** Repete a última lista lançada. Em obra, boa parte do dia se repete. */
export async function copiarUltimoDia(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  await exigirAdmin();

  const obraId = String(form.get("obraId") ?? "");
  const dia = String(form.get("dia") ?? "");
  if (!obraId) return { ok: false, erro: "Obra inválida." };
  if (!FORMATO_DE_DIA.test(dia)) return { ok: false, erro: "Data inválida." };

  const sb = supabaseAdmin();

  const { data: jaTem } = await sb
    .from("atividades")
    .select("id")
    .eq("obra_id", obraId)
    .eq("dia", dia)
    .limit(1);

  if (jaTem?.length) {
    return { ok: false, erro: "Este dia já tem atividades. Edite a lista direto." };
  }

  const { data: anterior } = await sb
    .from("atividades")
    .select("dia")
    .eq("obra_id", obraId)
    .lt("dia", dia)
    .order("dia", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!anterior) {
    return { ok: false, erro: "Ainda não há um dia anterior para copiar." };
  }

  const { data: origem } = await sb
    .from("atividades")
    .select("position, titulo, detalhe")
    .eq("obra_id", obraId)
    .eq("dia", anterior.dia)
    .order("position");

  if (!origem?.length) {
    return { ok: false, erro: "O dia anterior está vazio." };
  }

  const { error } = await sb.from("atividades").insert(
    origem.map((a) => ({
      obra_id: obraId,
      dia,
      position: a.position,
      titulo: a.titulo,
      detalhe: a.detalhe,
    })),
  );

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/admin/obras/${obraId}`);
  return { ok: true };
}

export async function apagarObra(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const { orgId } = await exigirAdmin();

  const obraId = String(form.get("obraId") ?? "");
  const confirmacao = String(form.get("confirmacao") ?? "").trim();
  if (confirmacao !== "APAGAR") {
    return { ok: false, erro: "Escreva APAGAR para confirmar." };
  }

  const sb = supabaseAdmin();

  const { data: obra } = await sb
    .from("obras")
    .select("id")
    .eq("id", obraId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!obra) return { ok: false, erro: "Obra não encontrada." };

  // Os arquivos saem antes: o cascade do Postgres não alcança o Storage.
  const { data: atividades } = await sb
    .from("atividades")
    .select("id")
    .eq("obra_id", obraId);

  const atividadeIds = (atividades ?? []).map((a) => a.id);
  if (atividadeIds.length) {
    const { data: confirmacoes } = await sb
      .from("confirmacoes")
      .select("id")
      .in("atividade_id", atividadeIds);

    const confirmacaoIds = (confirmacoes ?? []).map((c) => c.id);
    if (confirmacaoIds.length) {
      const { data: blocos } = await sb
        .from("confirmacao_blocos")
        .select("storage_path")
        .in("confirmacao_id", confirmacaoIds);

      const caminhos = (blocos ?? [])
        .map((b) => b.storage_path)
        .filter((c): c is string => Boolean(c));
      if (caminhos.length) {
        await sb.storage.from(BUCKET).remove(caminhos);
      }
    }
  }

  await sb.from("obras").delete().eq("id", obraId);

  revalidatePath("/admin/obras");
  return { ok: true, link: "/admin/obras" };
}
