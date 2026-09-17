"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "./sessao";
import { listarAcessos, type Acesso } from "./acessos";

/**
 * Liberar e tirar acesso ao painel. Só operador.
 *
 * Toda ação aqui reconfere `ehOperador` por dentro. O menu escondido na
 * interface não é proteção: uma Server Action é um endpoint, e quem souber o
 * caminho chama sem passar por tela nenhuma.
 */

export type Resultado = { ok: boolean; erro?: string };

async function exigirOperadorNaAcao() {
  const admin = await exigirAdmin();
  if (!admin.ehOperador) throw new Error("Só o operador administra acessos.");
  return admin;
}

export async function listarAcessosDoPainel(): Promise<Acesso[]> {
  await exigirOperadorNaAcao();
  return listarAcessos();
}

/** Assinatura de `useActionState`, como as outras formas do painel. */
export async function liberarAcesso(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const admin = await exigirOperadorNaAcao();

  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const nota = String(form.get("nota") ?? "");
  /**
   * `empreiteira` é a escolha do seletor: o id de uma que existe, `nova` para
   * criar, ou `propria` para a pessoa ganhar um espaço batizado com o e-mail
   * dela no primeiro login.
   *
   * Antes era o nome digitado, comparado contra `orgs.name`. Ver
   * `listarEmpreiteiras` para o que isso custava.
   *
   * **Vazio é recusado, não tratado como padrão.** Pôr alguém na empreiteira
   * errada é dar a ela os orçamentos e os clientes de outra pessoa; a escolha
   * tem que ser dita. O `required` do formulário já barra antes, e isto é a
   * mesma regra do lado do servidor, onde ela vale de verdade.
   */
  const escolha = String(form.get("empreiteira") ?? "").trim();
  const nomeNovo = String(form.get("empreiteiraNova") ?? "").trim();

  if (!email.includes("@") || email.startsWith("@")) {
    return { ok: false, erro: "Isso não parece um e-mail." };
  }

  const sb = supabaseAdmin();

  // A empreiteira é criada aqui, no convite, e não no primeiro login da
  // pessoa. Assim o admin já a vê na barra de contexto antes mesmo de ela
  // entrar — e o trigger `org_nova_vincula_operadores` cuida do vínculo.
  let orgId: string | null = null;

  if (!escolha) {
    return { ok: false, erro: "Escolha a empreiteira desta pessoa." };
  }

  if (escolha === "propria") {
    orgId = null;
  } else if (escolha === "nova") {
    if (nomeNovo.length < 2) {
      return { ok: false, erro: "Escreva o nome da empreiteira nova." };
    }

    // `name` tem índice único e é a chave técnica; `nome_exibicao` é o que
    // aparece para o cliente. Nascem iguais e o Perfil renomeia o de exibição
    // depois, sem esbarrar na unicidade.
    const { data: jaExiste } = await sb
      .from("orgs")
      .select("id")
      .eq("name", nomeNovo)
      .maybeSingle();

    if (jaExiste) {
      return {
        ok: false,
        erro: `Já existe uma empreiteira chamada "${nomeNovo}". Escolha ela na lista.`,
      };
    }

    const { data: nova, error: erroOrg } = await sb
      .from("orgs")
      .insert({ name: nomeNovo, nome_exibicao: nomeNovo })
      .select("id")
      .single();

    if (erroOrg) return { ok: false, erro: erroOrg.message };
    orgId = nova.id;
  } else {
    // Só um id que existe passa. Valor inventado no formulário não vira org
    // nova pelas costas — é justamente o que o campo de texto fazia.
    const { data: existente } = await sb
      .from("orgs")
      .select("id")
      .eq("id", escolha)
      .maybeSingle();

    if (!existente) {
      return { ok: false, erro: "Essa empreiteira não existe mais." };
    }
    orgId = existente.id;
  }

  const { error } = await sb.from("acessos").upsert(
    {
      email,
      nota: nota.trim() || null,
      org_id: orgId,
      criado_por: admin.id,
    },
    { onConflict: "email" },
  );

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function tirarAcesso(emailBruto: string): Promise<Resultado> {
  const admin = await exigirOperadorNaAcao();
  const email = emailBruto.trim().toLowerCase();

  // Tirar o próprio acesso é o jeito de se trancar do lado de fora sem
  // perceber. A variável de ambiente resgataria, mas contar com isso é ruim.
  if (email === admin.email) {
    return { ok: false, erro: "Você não pode remover o seu próprio acesso." };
  }

  const { error } = await supabaseAdmin()
    .from("acessos")
    .delete()
    .eq("email", email);

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/admin/perfil");
  return { ok: true };
}

/**
 * Confirma o e-mail de quem criou conta e nunca recebeu (ou nunca abriu) a
 * mensagem de confirmação do Supabase.
 *
 * Existe porque essa é a trava que não deixa rastro: a conta aparece criada, a
 * pessoa jura que se cadastrou, e o login recusa sem dizer o motivo. Foi
 * exatamente o que segurou uma pessoa por dezoito dias.
 *
 * Não define nem revela senha: quem for liberado assim continua entrando por
 * "Esqueci minha senha", que é o caminho normal e não passa por ninguém.
 */
export async function confirmarEmailDeConta(
  emailBruto: string,
): Promise<Resultado> {
  await exigirOperadorNaAcao();
  const email = emailBruto.trim().toLowerCase();

  const sb = supabaseAdmin();
  const { data, error: erroLista } = await sb.auth.admin.listUsers({
    perPage: 200,
  });
  if (erroLista) return { ok: false, erro: erroLista.message };

  const conta = data.users.find((u) => u.email?.toLowerCase() === email);
  if (!conta) {
    return {
      ok: false,
      erro: "Não existe conta com este e-mail. A pessoa precisa se cadastrar primeiro.",
    };
  }
  if (conta.email_confirmed_at) {
    return { ok: false, erro: "Este e-mail já estava confirmado." };
  }

  const { error } = await sb.auth.admin.updateUserById(conta.id, {
    email_confirm: true,
  });
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/admin/perfil");
  return { ok: true };
}
