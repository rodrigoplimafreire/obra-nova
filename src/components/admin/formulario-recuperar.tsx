"use client";

import { useState } from "react";
import { Girando } from "@/components/comum/esqueleto";
import { supabaseNavegador } from "@/lib/supabase/navegador";

/**
 * Pedido de recuperação de senha.
 *
 * Regra diferente do login: aqui a mensagem é **sempre a mesma**, exista ou
 * não uma conta com aquele e-mail. Login pode dizer "senha incorreta" porque
 * quem está tentando já declarou que sabe de uma conta; aqui a pessoa só
 * digitou um e-mail, e confirmar ou negar a existência da conta é vazar quem
 * tem cadastro no painel. O Supabase já segue essa regra no próprio backend —
 * o pedido "funciona" mesmo para e-mail que não existe.
 */
export function FormularioDeRecuperacao({
  aoVoltar,
}: {
  aoVoltar: () => void;
}) {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erroDeRede, setErroDeRede] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function pedir(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErroDeRede(null);

    try {
      await supabaseNavegador().auth.resetPasswordForEmail(email.trim(), {
        redirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/admin/redefinir-senha`
            : undefined,
      });
    } catch (e) {
      // Só erro de conexão de verdade aparece — nunca "e-mail não encontrado".
      setErroDeRede(
        `A conexão com o servidor falhou: ${e instanceof Error ? e.message : String(e)}`,
      );
      setEnviando(false);
      return;
    }

    setEnviado(true);
    setEnviando(false);
  }

  if (enviado) {
    return (
      <div className="mt-8 flex flex-col gap-4">
        <p className="aviso aviso-ok text-sm text-tinta">
          Se {email.trim()} tiver conta no painel, chega um link para trocar a
          senha. O link vale por um tempo curto.
        </p>
        <button
          type="button"
          onClick={aoVoltar}
          className="btn btn-campo btn-secundario em-escuro w-full"
        >
          Voltar para entrar
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={pedir} className="mt-8 flex flex-col gap-3">
      <p className="text-sm leading-relaxed text-concreto">
        Digite o e-mail da conta. Se ela existir, enviamos um link para trocar
        a senha.
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="rotulo">E-mail</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          autoFocus
          required
          className="campo campo-escuro"
        />
      </label>

      {erroDeRede && (
        <p className="aviso aviso-erro text-sm">{erroDeRede}</p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className={`btn btn-campo mt-2 w-full ${enviando ? "btn-carregando" : "btn-primario"}`}
      >
        {enviando && <Girando />}
        {enviando ? "Enviando…" : "Enviar link"}
      </button>

      <button
        type="button"
        onClick={aoVoltar}
        className="acao-texto mt-1 self-center text-concreto"
      >
        Voltar para entrar
      </button>
    </form>
  );
}
