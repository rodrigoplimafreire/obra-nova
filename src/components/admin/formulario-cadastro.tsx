"use client";

import { useState } from "react";
import { CampoDeSenha } from "@/components/comum/campo-senha";
import { Girando } from "@/components/comum/esqueleto";
import { emailNaAllowlist } from "@/lib/admin/acoes-sessao";
import { supabaseNavegador } from "@/lib/supabase/navegador";

/**
 * Criar conta é diferente de ganhar acesso.
 *
 * A conta nasce no Supabase Auth; quem decide se ela entra no painel é a
 * `ADMIN_EMAIL_ALLOWLIST`, uma lista que só o administrador edita. Por isso
 * toda mensagem de sucesso aqui é condicionada: primeiro confirma que a conta
 * foi criada, depois checa a lista e diz a verdade sobre o que falta.
 */
export function FormularioDeCadastro({
  aoVoltar,
}: {
  aoVoltar: () => void;
}) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function cadastrar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);
    setMensagem(null);

    const emailLimpo = email.trim();

    let resultado;
    try {
      resultado = await supabaseNavegador().auth.signUp({
        email: emailLimpo,
        password: senha,
        options: {
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/admin/login`
              : undefined,
        },
      });
    } catch (e) {
      setErro(
        `A conexão com o servidor falhou: ${e instanceof Error ? e.message : String(e)}`,
      );
      setEnviando(false);
      return;
    }

    const { data, error } = resultado;

    if (error) {
      setErro(`Não consegui criar a conta: ${error.message}`);
      setEnviando(false);
      return;
    }

    // O Supabase não distingue "e-mail já cadastrado" por erro — devolve um
    // usuário com `identities` vazio. É a técnica dele contra enumeração de
    // conta por e-mail, e a mensagem aqui preserva a mesma ambiguidade.
    const jaExistia = (data.user?.identities?.length ?? 0) === 0;
    if (jaExistia) {
      setMensagem(
        "Se este e-mail ainda não tinha conta, você recebe um link de confirmação agora. Se já tinha, nada muda — tente entrar ou recuperar a senha.",
      );
      setEnviando(false);
      return;
    }

    const permitido = await emailNaAllowlist(emailLimpo);

    if (data.session) {
      // Confirmação por e-mail está desligada neste ambiente: a conta já
      // nasce logada.
      if (permitido) {
        window.location.assign("/admin");
        return;
      }
      // Sem acesso ainda: não faz sentido segurar uma sessão que não abre
      // nada. Desloga para o estado ficar consistente com a mensagem.
      await supabaseNavegador().auth.signOut();
      setMensagem(
        `Conta criada. Mas ${emailLimpo} ainda não está na lista de acesso deste painel — peça para o administrador liberar.`,
      );
      setEnviando(false);
      return;
    }

    // Confirmação por e-mail ligada: a conta existe, mas precisa do clique no
    // link antes de logar.
    setMensagem(
      permitido
        ? `Conta criada. Confira ${emailLimpo} e clique no link para confirmar.`
        : `Conta criada. Confira ${emailLimpo} para confirmar — e peça para o administrador liberar este e-mail na lista de acesso.`,
    );
    setEnviando(false);
  }

  if (mensagem) {
    return (
      <div className="mt-8 flex flex-col gap-4">
        <p className="aviso aviso-ok text-sm text-tinta">{mensagem}</p>
        <button type="button" onClick={aoVoltar} className="btn btn-campo w-full btn-secundario em-escuro">
          Voltar para entrar
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={cadastrar} className="mt-8 flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="rotulo">E-mail</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
          className="campo campo-escuro"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="rotulo">Senha</span>
        <CampoDeSenha
          nome="senha"
          valor={senha}
          aoMudar={setSenha}
          autoComplete="new-password"
          minimo={6}
        />
        <span className="text-xs text-concreto">Pelo menos 6 caracteres.</span>
      </label>

      {erro && <p className="aviso aviso-erro text-sm">{erro}</p>}

      <button
        type="submit"
        disabled={enviando}
        className={`btn btn-campo mt-2 w-full ${enviando ? "btn-carregando" : "btn-primario"}`}
      >
        {enviando && <Girando />}
        {enviando ? "Criando…" : "Criar conta"}
      </button>

      <p className="mt-2 text-center text-sm text-concreto">
        Já tem conta?{" "}
        <button
          type="button"
          onClick={aoVoltar}
          className="font-semibold text-papel underline underline-offset-2"
        >
          Entrar
        </button>
      </p>
    </form>
  );
}
