"use client";

import { useActionState } from "react";
import { CenaEnviado } from "@/components/comum/ilustracoes";
import { aceitarOrcamento } from "@/lib/orcamento/acoes-publico";
import { moeda } from "@/lib/orcamento/formato";

/**
 * O aceite feito pelo cliente, na própria página.
 *
 * É o registro que nasce do lado de fora da empreiteira: não depende de
 * alguém lembrar de marcar no painel, e vale como prova do combinado para os
 * dois lados. O nome digitado entra no evento junto com a data e o valor.
 *
 * Sem confirmação em dois passos aqui de propósito — o aceite não é
 * destrutivo, e um segundo clique só afastaria quem está pronto para fechar.
 */
export function AceiteDoCliente({
  token,
  jaAprovado,
  total,
}: {
  token: string;
  jaAprovado: boolean;
  total: number;
}) {
  const [estado, aceitar, enviando] = useActionState<
    { ok?: boolean; erro?: string } | null,
    FormData
  >(aceitarOrcamento, null);

  if (jaAprovado || estado?.ok) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "28px",
        }}
      >
        {/* `--paper` amarrado ao `--ink` do documento, não deixado no padrão.
            O `brand.css` já usa o nome `--paper` para a nota cor de creme, e
            sem esta linha o miolo dos objetos sairia bege no meio da página
            preta. Inline vence a variável do `:root`. */}
        <div
          style={{
            width: "168px",
            color: "var(--white)",
            ["--paper" as string]: "var(--ink)",
            ["--bg" as string]: "var(--ink)",
          }}
          aria-hidden
        >
          <CenaEnviado />
        </div>

        <div className="paper-note">
          <p className="pin">Aceite registrado</p>
          <h3>Combinado.</h3>
          <p>
            O aceite deste orçamento foi registrado. A empreiteira já foi
            avisada e entra em contato para combinar o início.
          </p>
          <p className="pn-val">Valor acordado: {moeda(total)}</p>
        </div>
      </div>
    );
  }

  return (
    <form action={aceitar} className="accept-row">
      <input type="hidden" name="token" value={token} />
      {/* Estilo inline porque o `brand.css` só tem campo com id (`#gate-input`),
          e id não se repete numa página. São quatro propriedades; criar uma
          folha nova só para isto reabriria a discussão de ordem de cascata. */}
      <input
        name="nome"
        placeholder="Seu nome completo"
        required
        minLength={3}
        autoComplete="name"
        style={{
          minWidth: "min(100%, 18rem)",
          padding: "16px 18px",
          fontSize: "16px",
          color: "#fff",
          background: "var(--ink-3)",
          border: "1px solid var(--line)",
          borderRadius: "3px",
        }}
      />
      <button type="submit" disabled={enviando} className="btn solid big">
        {enviando ? "Registrando…" : "Aceitar orçamento"}
      </button>
      {estado?.erro && <p className="gate-error">{estado.erro}</p>}
    </form>
  );
}
