"use client";

import { useActionState, useState } from "react";
import { entrarNoDiario } from "@/lib/diario/acoes-publico";
import { Logotipo } from "@/components/marca";
import type { Empreiteira } from "@/lib/admin/empreiteira";

/**
 * A tela de senha do diário.
 *
 * Não usa o `brand.css` da RD como o gate do orçamento: aquele documento é
 * papel timbrado de proposta, com tipografia própria. Este é uma página de
 * acompanhamento contínuo, e veste a mesma roupa do relatório de obra.
 *
 * A senha é conferida no servidor, sempre. O segredo nunca desce para o
 * navegador — ver `@/lib/acesso/gate`.
 */
export function GateDoDiario({
  token,
  titulo,
  empreiteira,
}: {
  token: string;
  titulo: string | null;
  empreiteira: Empreiteira;
}) {
  const [mostrar, setMostrar] = useState(false);
  const [estado, entrar, entrando] = useActionState<
    { erro?: string } | null,
    FormData
  >(entrarNoDiario, null);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-tinta px-5 py-12">
      <div className="w-full max-w-sm">
        {empreiteira.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={empreiteira.logo}
            alt={empreiteira.nome ?? ""}
            className="mb-8 h-12 w-auto object-contain"
          />
        ) : (
          <Logotipo altura={28} className="mb-8 text-papel" />
        )}

        <p className="rotulo rotulo-claro">Acompanhamento</p>
        <h1 className="mt-3 font-sans text-2xl leading-tight font-semibold -tracking-[0.025em] text-papel">
          {titulo ?? "Diário de atividades"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-nevoa">
          Esta página é privada. Digite a senha que você recebeu para ver os
          relatórios.
        </p>

        <form action={entrar} className="mt-7 flex flex-col gap-3">
          <input type="hidden" name="token" value={token} />

          <div className="relative flex items-center">
            <input
              name="senha"
              type={mostrar ? "text" : "password"}
              placeholder="Senha de acesso"
              aria-label="Senha de acesso"
              autoComplete="off"
              autoFocus
              required
              className="campo campo-escuro pr-12"
            />
            <button
              type="button"
              onClick={() => setMostrar((v) => !v)}
              aria-label={mostrar ? "Esconder a senha" : "Mostrar a senha"}
              aria-pressed={mostrar}
              className="absolute right-1.5 flex h-10 w-10 items-center justify-center rounded-sm text-cinza-400 transition hover:bg-white/8 hover:text-papel"
            >
              {mostrar ? <OlhoFechado /> : <Olho />}
            </button>
          </div>

          <button
            type="submit"
            disabled={entrando}
            className="btn btn-primario w-full"
          >
            {entrando ? "Abrindo…" : "Entrar"}
          </button>
        </form>

        {estado?.erro && (
          <p className="mt-3 text-sm text-atraso-fundo">{estado.erro}</p>
        )}
      </div>
    </main>
  );
}

function Olho() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function OlhoFechado() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.4 5.2A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.5 6.6C3.8 8.3 2 12 2 12s3.5 7 10 7a9.9 9.9 0 0 0 3.4-.6" />
    </svg>
  );
}
