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
  /**
   * A conta que recebe. Fica aqui, e não no orçamento, porque é o mesmo dado
   * em toda proposta da mesma empreiteira — e é lida ao vivo pelo mesmo motivo
   * do logotipo: trocar de banco não pode obrigar a republicar tudo que já foi
   * enviado.
   */
  banco: {
    titular: string | null;
    documento: string | null;
    nome: string | null;
    agencia: string | null;
    conta: string | null;
    pix: string | null;
  };
  /**
   * O que transforma o orçamento em proposta comercial.
   *
   * Mora aqui e não no orçamento porque é igual em toda proposta da mesma
   * empreiteira — garantia legal, horário de trabalho, normas. Redigitar a
   * cada proposta é como o dado some: na terceira vez alguém esquece, e o
   * documento que o cliente assina fica sem garantia escrita.
   */
  contrato: {
    responsavelTecnico: string | null;
    horarioTrabalho: string | null;
    /** Art. 618 do Código Civil: 5 anos é o piso legal para solidez. */
    garantiaSolidezAnos: number | null;
    garantiaAcabamentoAnos: number | null;
    emiteArt: boolean;
    /** Uma norma por linha. */
    normasTecnicas: string[];
    /** Um parágrafo por linha. */
    clausulasExtras: string[];
  };
};

/** Tem cláusula suficiente para o documento virar proposta comercial? */
export function contratoPreenchido(e: Empreiteira): boolean {
  const c = e.contrato;
  return Boolean(
    c.responsavelTecnico ||
      c.horarioTrabalho ||
      c.garantiaSolidezAnos ||
      c.normasTecnicas.length ||
      c.clausulasExtras.length,
  );
}

/** Texto multilinha vira lista, sem linha em branco. */
function linhas(texto: string | null): string[] {
  return (texto ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Tem o mínimo para o cliente conseguir pagar? */
export function contaPreenchida(e: Empreiteira): boolean {
  return Boolean(e.banco.pix || (e.banco.agencia && e.banco.conta));
}

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
  banco_titular: string | null;
  banco_documento: string | null;
  banco_nome: string | null;
  banco_agencia: string | null;
  banco_conta: string | null;
  banco_pix: string | null;
  responsavel_tecnico: string | null;
  horario_trabalho: string | null;
  garantia_solidez_anos: number | null;
  garantia_acabamento_anos: number | null;
  emite_art: boolean | null;
  normas_tecnicas: string | null;
  clausulas_extras: string | null;
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
    banco: {
      titular: linha.banco_titular,
      documento: linha.banco_documento,
      nome: linha.banco_nome,
      agencia: linha.banco_agencia,
      conta: linha.banco_conta,
      pix: linha.banco_pix,
    },
    contrato: {
      responsavelTecnico: linha.responsavel_tecnico,
      horarioTrabalho: linha.horario_trabalho,
      garantiaSolidezAnos: linha.garantia_solidez_anos,
      garantiaAcabamentoAnos: linha.garantia_acabamento_anos,
      emiteArt: linha.emite_art ?? true,
      normasTecnicas: linhas(linha.normas_tecnicas),
      clausulasExtras: linhas(linha.clausulas_extras),
    },
  };
}

const SEM_CONTRATO = {
  responsavelTecnico: null,
  horarioTrabalho: null,
  garantiaSolidezAnos: null,
  garantiaAcabamentoAnos: null,
  emiteArt: true,
  normasTecnicas: [] as string[],
  clausulasExtras: [] as string[],
};

const SEM_BANCO = {
  titular: null,
  documento: null,
  nome: null,
  agencia: null,
  conta: null,
  pix: null,
};

/** Para o painel: a empreiteira de quem está logado. */
export async function empreiteiraAtual(): Promise<Empreiteira> {
  const orgId = await orgAtual();
  return empreiteiraDaOrg(orgId);
}

/** Para as páginas públicas, que não têm sessão e chegam pelo token. */
export async function empreiteiraDaOrg(orgId: string): Promise<Empreiteira> {
  const { data } = await supabaseAdmin()
    .from("orgs")
    .select(
      "name, nome_exibicao, documento, telefone, email_contato, logo_caminho, banco_titular, banco_documento, banco_nome, banco_agencia, banco_conta, banco_pix, responsavel_tecnico, horario_trabalho, garantia_solidez_anos, garantia_acabamento_anos, emite_art, normas_tecnicas, clausulas_extras",
    )
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
      banco: SEM_BANCO,
      contrato: SEM_CONTRATO,
    };
  }

  return montar(data);
}
