"use server";

import { revalidatePath } from "next/cache";
import { BUCKET, supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/admin/sessao";
import { montarItensDaFala } from "@/lib/orcamento/itens-da-fala";
import { transcrever } from "./provedor";
import type { Resultado } from "@/lib/admin/tipos";

/**
 * CRUD do módulo de Transcrição, mais a ponte para o Orçamento.
 *
 * Os bytes do áudio nunca passam por aqui: o navegador pede URL assinada, envia
 * direto ao Storage e só então registra a linha. Áudio de WhatsApp de cinco
 * minutos passa fácil do teto de body de uma Server Action.
 */

const TAMANHO_MAXIMO = 25 * 1024 * 1024;
const EXTENSAO_VALIDA = /^[a-z0-9]{2,5}$/;

/**
 * Formatos que o Whisper aceita. `application/octet-stream` e vazio entram
 * porque o `.opus` do WhatsApp costuma chegar sem tipo declarado — o navegador
 * não reconhece a extensão. A validação de verdade é a extensão, logo abaixo.
 */
const MIMES = new Set([
  "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/webm", "audio/ogg",
  "audio/opus", "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav",
  "audio/flac", "audio/aac", "application/octet-stream", "",
]);

const EXTENSOES = new Set([
  "m4a", "mp3", "mp4", "mpeg", "mpga", "ogg", "opus", "wav", "webm", "flac", "aac",
]);

async function minhaTranscricao(id: string): Promise<string | null> {
  const { orgId } = await exigirAdmin();
  const { data } = await supabaseAdmin()
    .from("transcricoes")
    .select("id")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  return data ? orgId : null;
}

function revalidar(id?: string) {
  revalidatePath("/admin/transcricoes");
  if (id) revalidatePath(`/admin/transcricoes/${id}`);
}

export type UrlDeImportacao =
  | { ok: true; caminho: string; token: string; bucket: string }
  | { ok: false; erro: string };

/** Passo 1: a permissão para o navegador subir o arquivo direto ao Storage. */
export async function urlParaImportar(dados: {
  mimeType: string;
  extensao: string;
  tamanhoBytes: number;
}): Promise<UrlDeImportacao> {
  const { orgId } = await exigirAdmin();

  const mime = dados.mimeType.split(";")[0].trim().toLowerCase();
  const extensao = dados.extensao.toLowerCase();

  if (!EXTENSAO_VALIDA.test(extensao) || !EXTENSOES.has(extensao)) {
    return {
      ok: false,
      erro: "Formato não aceito. Use um áudio: opus, m4a, mp3, ogg, wav ou webm.",
    };
  }
  if (!MIMES.has(mime)) {
    return { ok: false, erro: `Formato não aceito: ${mime}` };
  }
  if (
    !Number.isFinite(dados.tamanhoBytes) ||
    dados.tamanhoBytes <= 0 ||
    dados.tamanhoBytes > TAMANHO_MAXIMO
  ) {
    return { ok: false, erro: "Arquivo acima do limite de 25 MB." };
  }

  // O caminho carrega a org: é o que permite limpar o Storage se a conta for
  // apagada, e impede que um caminho adivinhado caia noutra empreiteira.
  const caminho = `transcricoes/${orgId}/${crypto.randomUUID()}.${extensao}`;

  const { data, error } = await supabaseAdmin()
    .storage.from(BUCKET)
    .createSignedUploadUrl(caminho);

  if (error || !data) {
    return { ok: false, erro: error?.message ?? "Falha ao criar a URL." };
  }
  return { ok: true, caminho: data.path, token: data.token, bucket: BUCKET };
}

export type SaidaDaImportacao =
  | { ok: true; id: string }
  | { ok: false; erro: string };

/** Passo 2: o arquivo já está no Storage; aqui ele vira linha. */
export async function registrarImportacao(dados: {
  caminho: string;
  arquivoNome: string;
  mimeType: string;
  tamanhoBytes: number;
  duracaoMs: number | null;
}): Promise<SaidaDaImportacao> {
  const { id: usuarioId, orgId } = await exigirAdmin();

  const { data, error } = await supabaseAdmin()
    .from("transcricoes")
    .insert({
      org_id: orgId,
      arquivo_nome: dados.arquivoNome.slice(0, 200),
      storage_path: dados.caminho,
      mime_type: dados.mimeType || null,
      tamanho_bytes: dados.tamanhoBytes,
      duracao_ms: dados.duracaoMs,
      criado_por: usuarioId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, erro: error?.message ?? "Falha ao registrar o áudio." };
  }

  revalidar();
  return { ok: true, id: data.id };
}

export type SaidaDaTranscricao =
  | { ok: true; texto: string }
  | { ok: false; erro: string };

/**
 * Passo 3: o Whisper.
 *
 * Separado do registro pelo mesmo motivo do módulo de orçamento: a tela precisa
 * de degraus para mostrar progresso, e falhar aqui não pode custar o arquivo —
 * ele fica no Storage e o botão de tentar de novo reusa o mesmo áudio.
 */
export async function transcreverAvulsa(
  id: string,
): Promise<SaidaDaTranscricao> {
  if (!(await minhaTranscricao(id))) {
    return { ok: false, erro: "Transcrição inválida." };
  }

  const sb = supabaseAdmin();

  const { data: linha } = await sb
    .from("transcricoes")
    .select("storage_path, mime_type, arquivo_nome, texto, editado_em")
    .eq("id", id)
    .maybeSingle();

  if (!linha) return { ok: false, erro: "Transcrição não encontrada." };

  // Texto corrigido à mão não é atropelado por uma retranscrição, pela mesma
  // regra dos itens do orçamento: mão humana marca a linha.
  if (linha.editado_em && linha.texto) {
    return { ok: true, texto: linha.texto };
  }

  await sb
    .from("transcricoes")
    .update({ status: "transcrevendo", erro: null, updated_at: new Date().toISOString() })
    .eq("id", id);

  const { data: arquivo, error: erroDownload } = await sb.storage
    .from(BUCKET)
    .download(linha.storage_path);

  if (erroDownload || !arquivo) {
    const erro = erroDownload?.message ?? "Não consegui baixar o áudio.";
    await sb
      .from("transcricoes")
      .update({ status: "falhou", erro, updated_at: new Date().toISOString() })
      .eq("id", id);
    revalidar(id);
    return { ok: false, erro };
  }

  // Contexto de orçamento: o áudio do cliente fala de serviço e de preço, e é
  // aí que metro quadrado e metro linear não podem se confundir.
  const saida = await transcrever(
    arquivo,
    linha.mime_type,
    "orcamento",
    linha.arquivo_nome,
  );

  if (!saida.ok) {
    await sb
      .from("transcricoes")
      .update({
        status: "falhou",
        erro: saida.erro,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    revalidar(id);
    return { ok: false, erro: saida.erro };
  }

  await sb
    .from("transcricoes")
    .update({
      status: "pronta",
      texto: saida.texto,
      erro: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidar(id);
  return { ok: true, texto: saida.texto };
}

export async function renomearTranscricao(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const id = String(form.get("id") ?? "");
  if (!(await minhaTranscricao(id))) {
    return { ok: false, erro: "Transcrição inválida." };
  }

  const titulo = String(form.get("titulo") ?? "").trim();

  const { error } = await supabaseAdmin()
    .from("transcricoes")
    .update({
      titulo: titulo.length > 0 ? titulo.slice(0, 200) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false, erro: error.message };
  revalidar(id);
  return { ok: true };
}

export async function salvarTexto(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const id = String(form.get("id") ?? "");
  if (!(await minhaTranscricao(id))) {
    return { ok: false, erro: "Transcrição inválida." };
  }

  const texto = String(form.get("texto") ?? "").trim();
  if (texto.length < 1) {
    return { ok: false, erro: "O texto não pode ficar vazio." };
  }

  const { error } = await supabaseAdmin()
    .from("transcricoes")
    .update({
      texto,
      status: "pronta",
      // O carimbo é o que protege a correção de uma retranscrição posterior.
      editado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false, erro: error.message };
  revalidar(id);
  return { ok: true };
}

export async function apagarTranscricao(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const id = String(form.get("id") ?? "");
  if (!(await minhaTranscricao(id))) {
    return { ok: false, erro: "Transcrição inválida." };
  }

  const sb = supabaseAdmin();

  const { data: linha } = await sb
    .from("transcricoes")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await sb.from("transcricoes").delete().eq("id", id);
  if (error) return { ok: false, erro: error.message };

  // A cascata do banco não alcança o bucket: sem isto o áudio ficaria pagando
  // armazenamento para sempre, sem nada que aponte para ele.
  if (linha?.storage_path) {
    await sb.storage.from(BUCKET).remove([linha.storage_path]);
  }

  revalidar();
  return { ok: true, link: "/admin/transcricoes" };
}

export type SaidaDoOrcamento =
  | { ok: true; link: string; criados: number; valorFechado: number | null }
  | { ok: false; erro: string };

/**
 * A ponte: o texto vira orçamento com a tabela de custos já montada.
 *
 * Podia só criar o orçamento e deixar o texto colado numa observação, mas aí a
 * pessoa teria que ler e digitar os itens — que é exatamente o trabalho que o
 * módulo existe para tirar. O texto entra como bloco de fala e passa pela mesma
 * IA do "Falar orçamento", com as mesmas regras: preço que não foi dito fica
 * em branco.
 */
export async function criarOrcamentoDaTranscricao(
  id: string,
  cliente: string,
): Promise<SaidaDoOrcamento> {
  const orgId = await minhaTranscricao(id);
  if (!orgId) return { ok: false, erro: "Transcrição inválida." };

  const nome = cliente.trim();
  if (nome.length < 2) {
    return { ok: false, erro: "Diga para quem é o orçamento." };
  }

  const sb = supabaseAdmin();

  const { data: linha } = await sb
    .from("transcricoes")
    .select("texto, titulo, arquivo_nome")
    .eq("id", id)
    .maybeSingle();

  if (!linha?.texto) {
    return { ok: false, erro: "Esta transcrição ainda não tem texto." };
  }

  const { data: orcamento, error: erroOrcamento } = await sb
    .from("orc_orcamentos")
    .insert({
      org_id: orgId,
      cliente_nome: nome,
      objeto: linha.titulo?.trim() || null,
    })
    .select("id")
    .single();

  if (erroOrcamento || !orcamento) {
    return {
      ok: false,
      erro: erroOrcamento?.message ?? "Falha ao criar o orçamento.",
    };
  }

  const { data: bloco, error: erroBloco } = await sb
    .from("orc_blocos")
    .insert({
      orcamento_id: orcamento.id,
      pergunta_id: null,
      position: 1,
      type: "text",
      text_content: linha.texto,
    })
    .select("id")
    .single();

  if (erroBloco || !bloco) {
    return { ok: false, erro: erroBloco?.message ?? "Falha ao registrar o texto." };
  }

  const saida = await montarItensDaFala(orcamento.id, orgId, bloco.id);

  // Orçamento e texto já existem mesmo quando a IA falha. Levar a pessoa para
  // lá com a tabela vazia é melhor que desfazer tudo: ela tenta montar de novo
  // pelo botão da tabela, sem reimportar nada.
  await sb
    .from("transcricoes")
    .update({ orcamento_id: orcamento.id, updated_at: new Date().toISOString() })
    .eq("id", id);

  revalidar(id);
  revalidatePath("/admin/orcamentos");

  return {
    ok: true,
    link: `/admin/orcamentos/${orcamento.id}`,
    criados: saida.ok ? saida.criados : 0,
    valorFechado: saida.ok ? saida.valorFechado : null,
  };
}

export type SaidaDoUso =
  | {
      ok: true;
      criados: number;
      valorFechado: number | null;
      entendido: string;
      faltando: string[];
    }
  | { ok: false; erro: string };

/**
 * O caminho inverso: trazer uma transcrição para um orçamento que já existe.
 *
 * `criarOrcamentoDaTranscricao` resolve quem começa pelo áudio. Este resolve
 * quem já está com o orçamento aberto e lembra que tem o áudio do cliente
 * guardado — sem obrigar a sair, achar a transcrição e criar um orçamento novo
 * que ele teria que juntar ao que já tinha.
 *
 * O texto entra como bloco de fala e passa pela mesma IA, com as mesmas
 * regras. Uma transcrição pode alimentar mais de um orçamento: obra grande se
 * divide em etapas, e o áudio que fala das duas serve para as duas.
 */
export async function usarTranscricaoNoOrcamento(
  orcamentoId: string,
  transcricaoId: string,
): Promise<SaidaDoUso> {
  const orgId = await minhaTranscricao(transcricaoId);
  if (!orgId) return { ok: false, erro: "Transcrição inválida." };

  const sb = supabaseAdmin();

  // O orçamento tem que ser da mesma org: sem esta checagem, um id de outra
  // conta colaria o texto lá dentro.
  const { data: orcamento } = await sb
    .from("orc_orcamentos")
    .select("id")
    .eq("id", orcamentoId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!orcamento) return { ok: false, erro: "Orçamento inválido." };

  const { data: linha } = await sb
    .from("transcricoes")
    .select("texto, orcamento_id")
    .eq("id", transcricaoId)
    .maybeSingle();

  if (!linha?.texto) {
    return { ok: false, erro: "Esta transcrição ainda não tem texto." };
  }

  const { data: ultimo } = await sb
    .from("orc_blocos")
    .select("position")
    .eq("orcamento_id", orcamentoId)
    .order("position", { ascending: false })
    .limit(1);

  const { data: bloco, error: erroBloco } = await sb
    .from("orc_blocos")
    .insert({
      orcamento_id: orcamentoId,
      pergunta_id: null,
      position: (ultimo?.[0]?.position ?? 0) + 1,
      type: "text",
      text_content: linha.texto,
    })
    .select("id")
    .single();

  if (erroBloco || !bloco) {
    return { ok: false, erro: erroBloco?.message ?? "Falha ao trazer o texto." };
  }

  const saida = await montarItensDaFala(orcamentoId, orgId, bloco.id);
  if (!saida.ok) return { ok: false, erro: saida.erro };

  // Só marca o primeiro destino: a transcrição usada em dois orçamentos
  // continua apontando para aquele de onde ela nasceu.
  if (!linha.orcamento_id) {
    await sb
      .from("transcricoes")
      .update({ orcamento_id: orcamentoId, updated_at: new Date().toISOString() })
      .eq("id", transcricaoId);
  }

  revalidatePath(`/admin/orcamentos/${orcamentoId}`);
  revalidar(transcricaoId);

  return {
    ok: true,
    criados: saida.criados,
    valorFechado: saida.valorFechado,
    entendido: saida.entendido,
    faltando: saida.faltando,
  };
}
