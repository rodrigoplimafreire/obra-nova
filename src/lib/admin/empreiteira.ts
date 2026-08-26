import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { orgAtual } from "./sessao";

/**
 * A identidade da empreiteira: o que o cliente vê quando abre o documento.
 *
 * Existe porque o produto é white label e essa parte não estava cumprida — o
 * logotipo do orçamento era arquivo fixo em `public/marcas/rd/` e o nome no
 * relatório era texto solto. Uma construtora que não fosse a RD não tinha como
 * assinar nada.
 *
 * O `nome` cai para o `name` da org quando ninguém preencheu. Como `name`
 * nasce sendo o e-mail (ver `garantirOrg`), isso pode devolver um e-mail — quem
 * consome trata, e o Perfil pede o nome de verdade.
 */

export type Empreiteira = {
  nome: string | null;
  documento: string | null;
  telefone: string | null;
  email: string | null;
  /** URL pública e estável do logotipo, pronta para o `src` de uma `<img>`. */
  logo: string | null;
  /** O caminho no bucket, para poder apagar o anterior ao trocar. */
  logoCaminho: string | null;
};

const BUCKET = "marca";

/** O bucket é público: a URL não expira e serve documento já publicado. */
export function urlDaMarca(caminho: string | null): string | null {
  if (!caminho) return null;
  return supabaseAdmin().storage.from(BUCKET).getPublicUrl(caminho).data
    .publicUrl;
}

function montar(linha: {
  name: string;
  nome_exibicao: string | null;
  documento: string | null;
  telefone: string | null;
  email_contato: string | null;
  logo_caminho: string | null;
}): Empreiteira {
  // `name` só entra como nome se não parecer o e-mail que o `garantirOrg`
  // usou para criar a org — senão o cliente veria um gmail no cabeçalho.
  const doBanco = linha.nome_exibicao?.trim();
  const fallback = linha.name.includes("@") ? null : linha.name;

  return {
    nome: doBanco || fallback,
    documento: linha.documento,
    telefone: linha.telefone,
    email: linha.email_contato,
    logo: urlDaMarca(linha.logo_caminho),
    logoCaminho: linha.logo_caminho,
  };
}

/** Para o painel: a empreiteira de quem está logado. */
export async function empreiteiraAtual(): Promise<Empreiteira> {
  const orgId = await orgAtual();
  return empreiteiraDaOrg(orgId);
}

/** Para as páginas públicas, que não têm sessão e chegam pelo token. */
export async function empreiteiraDaOrg(orgId: string): Promise<Empreiteira> {
  const { data } = await supabaseAdmin()
    .from("orgs")
    .select("name, nome_exibicao, documento, telefone, email_contato, logo_caminho")
    .eq("id", orgId)
    .maybeSingle();

  if (!data) {
    return {
      nome: null,
      documento: null,
      telefone: null,
      email: null,
      logo: null,
      logoCaminho: null,
    };
  }

  return montar(data);
}
