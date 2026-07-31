"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase/navegador";

export function FormularioDeLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault();
    setEntrando(true);
    setErro(null);

    const { error } = await supabaseNavegador().auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });

    if (error) {
      // A mensagem do Supabase é genérica de propósito: não confirma se o
      // e-mail existe. Mantenho assim.
      setErro("E-mail ou senha incorretos.");
      setEntrando(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={entrar} className="mt-8 flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="rotulo">E-mail</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
          className="rounded-2xl border border-fumaca bg-grafite px-4 py-3 text-papel outline-none focus:border-azul"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="rotulo">Senha</span>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="current-password"
          required
          className="rounded-2xl border border-fumaca bg-grafite px-4 py-3 text-papel outline-none focus:border-azul"
        />
      </label>

      {erro && (
        <p className="rounded-2xl bg-alerta/20 px-4 py-3 text-sm text-alerta">
          {erro}
        </p>
      )}

      <button
        type="submit"
        disabled={entrando}
        className="mt-2 flex items-center justify-between gap-4 rounded-full bg-papel py-4 pr-3 pl-7 text-left font-semibold text-tinta disabled:opacity-60"
      >
        {entrando ? "Entrando…" : "Entrar"}
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-limao">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-tinta" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </button>
    </form>
  );
}
