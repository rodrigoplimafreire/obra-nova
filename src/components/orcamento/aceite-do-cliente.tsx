"use client";

import { useActionState } from "react";
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

const DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

function carimbo(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // "07/09/2026, 15:36" vira "07/09/2026 · 15h36": hora com dois-pontos ao
  // lado de uma data com barras vira sopa de pontuação num comprovante.
  return DATA_HORA.format(d).replace(", ", " · ").replace(":", "h");
}

export function AceiteDoCliente({
  token,
  jaAprovado,
  total,
  versao,
  cliente,
  aceite,
}: {
  token: string;
  jaAprovado: boolean;
  total: number;
  versao: number;
  cliente: string;
  aceite: { nome: string | null; em: string | null } | null;
}) {
  const [estado, aceitar, enviando] = useActionState<
    { ok?: boolean; erro?: string } | null,
    FormData
  >(aceitarOrcamento, null);

  if (jaAprovado || estado?.ok) {
    /**
     * O comprovante do aceite.
     *
     * Era uma ilustração de papel com um visto desenhado à mão sobre uma nota
     * cor de creme torta, e o Reginato leu como infantil — com razão: esta é a
     * parte do documento que registra um compromisso de dezenas de milhares de
     * reais, e ela estava com cara de bilhete de geladeira. O que substitui é
     * um comprovante: quem aceitou, quando, por qual valor e sobre qual versão
     * do orçamento. Os mesmos quatro campos que alguém procuraria se
     * precisasse provar o combinado depois.
     *
     * O nome pode faltar quando a empreiteira aprovou pelo painel em vez de o
     * cliente ter aceitado aqui — nesse caso a linha some em vez de mostrar
     * um traço, porque campo vazio em comprovante levanta dúvida.
     */
    const quando = carimbo(aceite?.em ?? null);
    const linhas: [string, string][] = [
      ...(aceite?.nome ? ([["Aceito por", aceite.nome]] as [string, string][]) : []),
      ["Contratante", cliente],
      ...(quando ? ([["Registrado em", quando]] as [string, string][]) : []),
      ["Versão do orçamento", String(versao)],
    ];

    return (
      <div className="aceite-ok">
        <p className="ao-selo">Aceite registrado</p>
        <h3 className="ao-titulo">Proposta aceita</h3>

        <dl className="ao-dados">
          {linhas.map(([rotulo, valor]) => (
            <div key={rotulo}>
              <dt>{rotulo}</dt>
              <dd>{valor}</dd>
            </div>
          ))}
        </dl>

        <div className="ao-valor">
          <span className="ao-valor-rot">Valor acordado</span>
          <span className="ao-valor-num">{moeda(total)}</span>
        </div>

        <p className="ao-nota">
          A empreiteira foi notificada e entra em contato para combinar o
          início. Este registro fica guardado com a data e o valor acima.
        </p>
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
