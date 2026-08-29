"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { moeda } from "@/lib/orcamento/formato";
import { ROTULO_SITUACAO } from "./publicacao-do-orcamento";
import type { ResumoDeOrcamento } from "@/lib/orcamento/dados";

/**
 * A lista de orçamentos como documento, para mandar ao cliente.
 *
 * Não é a tela impressa. Imprimir a tela levaria barra lateral, filtros,
 * botões de ação e as três colunas de indicador — cromo que só faz sentido
 * para quem está operando. Quem recebe isto é o Reginato querendo saber o que
 * está na rua e o que fechou, e para ele o documento é uma tabela com nome,
 * situação e valor.
 *
 * Vive escondido na tela e só aparece na impressão. A alternativa seria uma
 * rota `/imprimir` própria, que renderizaria de novo no servidor e perderia o
 * filtro e a busca que a pessoa aplicou antes de clicar — e imprimir uma lista
 * diferente da que está à vista é o tipo de surpresa que faz a pessoa não
 * confiar no botão.
 */
export function ListaParaImprimir({
  orcamentos,
  empreiteira,
  filtro,
}: {
  orcamentos: ResumoDeOrcamento[];
  empreiteira: string;
  /** O recorte que estava aplicado, escrito no cabeçalho para não enganar. */
  filtro: string;
}) {
  /**
   * Portal para o `body`, e não uma `div` no meio da árvore.
   *
   * A regra de impressão esconde `body > *` e mostra só o que estiver marcado.
   * Renderizado aqui dentro, este bloco teria a barra lateral e o conteúdo
   * como ancestrais — e esconder o ancestral esconde o filho junto, por mais
   * `display: block` que se ponha nele.
   */
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const hoje = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const aprovados = orcamentos.filter((o) => o.situacao === "aprovado");
  const naRua = orcamentos.filter((o) =>
    ["enviado", "visto", "negociando"].includes(o.situacao),
  );
  const totalAprovado = aprovados.reduce(
    (s, o) => s + (o.valorAprovado ?? 0),
    0,
  );
  const totalNaRua = naRua.reduce((s, o) => s + (o.total ?? 0), 0);

  if (!montado) return null;

  return createPortal(
    <div data-imprimindo data-so-impressao className="impressao-lista">
      <header>
        <h1>{empreiteira}</h1>
        <p>
          Posição dos orçamentos · {filtro} · {hoje}
        </p>
      </header>

      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Serviço</th>
            <th>Situação</th>
            <th className="num">Valor</th>
          </tr>
        </thead>
        <tbody>
          {orcamentos.map((o) => (
            <tr key={o.id}>
              <td>
                <strong>{o.cliente}</strong>
                {o.numero && <span className="numero"> · {o.numero}</span>}
              </td>
              <td>{o.objeto ?? "—"}</td>
              <td>
                {ROTULO_SITUACAO[o.situacao]}
                {o.obraId ? " · obra aberta" : ""}
              </td>
              <td className="num">{moeda(o.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Os dois números que o cliente quer: o que já entrou e o que ainda
          pode entrar. Somados nunca — um é dinheiro fechado, o outro é
          expectativa, e juntar os dois num total só seria mentira otimista. */}
      <div className="resumo">
        <div>
          <span className="k">Aprovado ({aprovados.length})</span>
          <span className="v">{moeda(totalAprovado)}</span>
        </div>
        <div>
          <span className="k">Na rua ({naRua.length})</span>
          <span className="v">{moeda(totalNaRua)}</span>
        </div>
      </div>

      <footer>
        {orcamentos.length}{" "}
        {orcamentos.length === 1 ? "orçamento" : "orçamentos"} · gerado no Obra
        Nova em {hoje}
      </footer>
    </div>,
    document.body,
  );
}
