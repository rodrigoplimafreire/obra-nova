"use client";

import { useActionState, useState } from "react";
import { entrarNoOrcamento } from "@/lib/orcamento/acoes-publico";
import { lerMarca } from "@/lib/orcamento/marcas";

/**
 * A tela de senha do orçamento.
 *
 * O markup segue os seletores do `brand.css` original (`#gate`, `#gate-input`,
 * `.gate-toggle`), inclusive o olho para revelar a senha — que já estava
 * previsto no sistema da RD e é a mesma heurística que faltava no login do
 * painel.
 *
 * A senha é conferida no servidor, sempre. A versão estática do
 * orcamentos.rd.eng.br comparava no navegador, o que basta para evitar o
 * curioso mas não para evitar o determinado; aqui o segredo nunca desce.
 */
export function GateDoOrcamento({
  token,
  marca,
  cliente,
}: {
  token: string;
  marca: string;
  /**
   * Aparece no título, antes da senha — igual às propostas em HTML da RD.
   *
   * É divulgação consciente: quem já tem o link fica sabendo para quem é o
   * orçamento. O Reginato já fazia assim, e o ganho é que a pessoa reconhece
   * o próprio nome e sabe que o link não veio trocado.
   */
  cliente: string;
}) {
  const tema = lerMarca(marca);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [estado, entrar, entrando] = useActionState<
    { erro?: string } | null,
    FormData
  >(entrarNoOrcamento, null);

  return (
    <>
      <link rel="stylesheet" href={tema.estilo} precedence="marca" />

      <div id="gate" className={estado?.erro ? "shake" : undefined}>
        <div className="gate-box">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="gate-logo" src={tema.logoEmpilhado} alt={tema.nome} />
          <p className="gate-eyebrow">Proposta confidencial</p>
          <h1 className="gate-title">Orçamento para {cliente}</h1>
          <p className="gate-sub">
            Este documento é privado. Digite a senha que você recebeu para
            acessar a proposta.
          </p>

          <form action={entrar} id="gate-form">
            <input type="hidden" name="token" value={token} />
            <div className="gate-field">
              <input
                id="gate-input"
                name="senha"
                type={mostrarSenha ? "text" : "password"}
                placeholder="Senha de acesso"
                aria-label="Senha de acesso"
                autoComplete="off"
                autoFocus
                required
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                aria-label={mostrarSenha ? "Esconder a senha" : "Mostrar a senha"}
                aria-pressed={mostrarSenha}
                className={`gate-toggle ${mostrarSenha ? "is-visible" : ""}`}
              >
                <svg className="icon-on" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <svg className="icon-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.4 5.2A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.5 6.6C3.8 8.3 2 12 2 12s3.5 7 10 7a9.9 9.9 0 0 0 3.4-.6" />
                </svg>
              </button>
            </div>

            <button type="submit" disabled={entrando} className="btn solid gate-btn">
              {entrando ? "Abrindo…" : "Acessar proposta"}
            </button>
          </form>

          {estado?.erro && <p className="gate-error">{estado.erro}</p>}
        </div>
      </div>
    </>
  );
}
