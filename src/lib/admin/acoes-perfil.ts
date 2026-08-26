"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "./sessao";
import type { Resultado } from "./tipos";

/**
 * Perfil: a identidade da empreiteira e a foto de quem usa o painel.
 *
 * As duas coisas moram no mesmo lugar da tela mas em lugares diferentes do
 * banco, e a distinção importa: o **logotipo é da empreiteira** e vai para o
 * documento que o cliente abre; a **foto é do usuário** e não sai do painel.
 * Numa conta com duas pessoas, a segunda troca a própria foto sem tocar na
 * marca de ninguém.
 */

const BUCKET = "marca";
const TETO_BYTES = 2 * 1024 * 1024;
const TIPOS = ["image/png", "image/jpeg", "image/webp"];

/** Campo em branco volta a `null`: apagar é uma decisão, não um vazio. */
function ouNulo(form: FormData, campo: string): string | null {
  const valor = String(form.get(campo) ?? "").trim();
  return valor.length > 0 ? valor : null;
}

function revalidar() {
  revalidatePath("/admin", "layout");
}

export async function salvarEmpreiteira(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const { orgId } = await exigirAdmin();

  const { error } = await supabaseAdmin()
    .from("orgs")
    .update({
      nome_exibicao: ouNulo(form, "nome"),
      documento: ouNulo(form, "documento"),
      telefone: ouNulo(form, "telefone"),
      email_contato: ouNulo(form, "email"),
    })
    .eq("id", orgId);

  if (error) return { ok: false, erro: error.message };

  revalidar();
  return { ok: true };
}

/**
 * Valida o arquivo aqui também, e não só no `accept` do input.
 *
 * O `accept` é sugestão de navegador — quem manda a requisição à mão passa por
 * cima. O bucket tem os mesmos limites configurados; esta checagem existe para
 * a mensagem de erro ser em português em vez de um código de storage.
 */
function conferirArquivo(arquivo: File | null): string | null {
  if (!arquivo || arquivo.size === 0) return "Escolha uma imagem.";
  if (!TIPOS.includes(arquivo.type)) {
    return "Formato não aceito. Use PNG, JPG ou WebP.";
  }
  if (arquivo.size > TETO_BYTES) return "A imagem passa de 2 MB.";
  return null;
}

/** Apaga o arquivo anterior; sem isto o bucket vira depósito de versão velha. */
async function apagarAnterior(caminho: string | null) {
  if (!caminho) return;
  await supabaseAdmin().storage.from(BUCKET).remove([caminho]);
}

export async function enviarLogo(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const { orgId } = await exigirAdmin();

  const arquivo = form.get("arquivo") as File | null;
  const problema = conferirArquivo(arquivo);
  if (problema || !arquivo) return { ok: false, erro: problema ?? "Falhou." };

  const sb = supabaseAdmin();

  const { data: org } = await sb
    .from("orgs")
    .select("logo_caminho")
    .eq("id", orgId)
    .maybeSingle();

  // O tempo no nome derruba o cache do CDN: o bucket é público e o caminho
  // fixo faria o logotipo antigo continuar aparecendo depois da troca.
  const extensao = arquivo.type === "image/png" ? "png" : arquivo.type === "image/webp" ? "webp" : "jpg";
  const caminho = `logo/${orgId}-${Date.now()}.${extensao}`;

  const { error: erroUpload } = await sb.storage
    .from(BUCKET)
    .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });

  if (erroUpload) return { ok: false, erro: erroUpload.message };

  const { error } = await sb
    .from("orgs")
    .update({ logo_caminho: caminho })
    .eq("id", orgId);

  if (error) {
    await sb.storage.from(BUCKET).remove([caminho]);
    return { ok: false, erro: error.message };
  }

  await apagarAnterior(org?.logo_caminho ?? null);
  revalidar();
  return { ok: true };
}

export async function removerLogo(): Promise<Resultado> {
  const { orgId } = await exigirAdmin();
  const sb = supabaseAdmin();

  const { data: org } = await sb
    .from("orgs")
    .select("logo_caminho")
    .eq("id", orgId)
    .maybeSingle();

  const { error } = await sb
    .from("orgs")
    .update({ logo_caminho: null })
    .eq("id", orgId);
  if (error) return { ok: false, erro: error.message };

  await apagarAnterior(org?.logo_caminho ?? null);
  revalidar();
  return { ok: true };
}

/**
 * A foto do usuário vive no `user_metadata` do Auth, não numa tabela nossa.
 *
 * É o lugar certo: o dado é da pessoa, não da empreiteira, e o `exigirAdmin`
 * já carrega o usuário em toda requisição — ler a foto não custa consulta
 * nova. Guardamos o caminho, não a URL: se o bucket mudar de endereço um dia,
 * o que está gravado continua válido.
 */
export async function enviarAvatar(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const { id: usuarioId, avatarCaminho } = await exigirAdmin();

  const arquivo = form.get("arquivo") as File | null;
  const problema = conferirArquivo(arquivo);
  if (problema || !arquivo) return { ok: false, erro: problema ?? "Falhou." };

  const sb = supabaseAdmin();
  const extensao = arquivo.type === "image/png" ? "png" : "jpg";
  const caminho = `avatar/${usuarioId}-${Date.now()}.${extensao}`;

  const { error: erroUpload } = await sb.storage
    .from(BUCKET)
    .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });

  if (erroUpload) return { ok: false, erro: erroUpload.message };

  const { error } = await sb.auth.admin.updateUserById(usuarioId, {
    user_metadata: { avatar_caminho: caminho },
  });

  if (error) {
    await sb.storage.from(BUCKET).remove([caminho]);
    return { ok: false, erro: error.message };
  }

  await apagarAnterior(avatarCaminho);
  revalidar();
  return { ok: true };
}

export async function removerAvatar(): Promise<Resultado> {
  const { id: usuarioId, avatarCaminho } = await exigirAdmin();

  const { error } = await supabaseAdmin().auth.admin.updateUserById(usuarioId, {
    user_metadata: { avatar_caminho: null },
  });
  if (error) return { ok: false, erro: error.message };

  await apagarAnterior(avatarCaminho);
  revalidar();
  return { ok: true };
}
