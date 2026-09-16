"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { moeda } from "@/lib/orcamento/formato";
import {
  FUNIL,
  ROTULO_ESTADO,
  ROTULO_ORIGEM,
  ROTULO_TIPO,
  SAIDAS,
  type Estado,
  type PedidoNoQuadro,
} from "@/lib/pipeline/constantes";

/**
 * O quadro do funil como documento, para mandar ao Reginato toda semana.
 *
 * Mesmo princípio da `ListaParaImprimir` dos orçamentos: não é a tela
 * impressa. O quadro é feito de colunas que rolam de lado — no papel elas
 * cortariam na metade, e as três últimas etapas simplesmente não sairiam. Aqui
 * cada estado vira uma faixa da tabela, na ordem do funil, e o que rola de
 * lado na tela desce na folha.
 *
 * **Estado sem pedido não vira faixa.** Seis cabeçalhos com "Vazio" embaixo é
 * o tipo de folha que dá a impressão de que o funil parou — e o que se manda
 * de posição semanal é o que existe, não o esqueleto do processo.
 *
 * Vive escondido na tela e só aparece na impressão, pelo portal no `body`:
 * a regra de `@media print` esconde `body > *`, e um ancestral escondido
 * esconde o filho junto.
 */
export function PipelineParaImprimir({
  pedidos,
  empreiteira,
  semCustoHora,
}: {
  pedidos: PedidoNoQuadro[];
  empreiteira: string;
  /** Sem custo/hora não há coluna de custo — zero ali seria mentira. */
  semCustoHora: boolean;
}) {
  const montado = useMontado();

  const hoje = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const abertos = pedidos.filter(
    (p) => !["fechado", "perdido", "congelado"].includes(p.status),
  );
  const fechados = pedidos.filter((p) => p.status === "fechado");
  const perdidos = pedidos.filter((p) => p.status === "perdido");
  const parados = pedidos.filter((p) => p.parado);

  const naEsteira = abertos.reduce((s, p) => s + (p.valorOrcado ?? 0), 0);
  const totalFechado = fechados.reduce(
    (s, p) => s + (p.valorFechado ?? p.valorOrcado ?? 0),
    0,
  );
  const custoPerdido = perdidos.reduce((s, p) => s + (p.custoEstimado ?? 0), 0);

  const comDesfecho = fechados.length + perdidos.length;
  const conversao =
    comDesfecho === 0 ? null : Math.round((fechados.length / comDesfecho) * 100);

  // A ordem da folha é a ordem do funil, e as saídas vêm depois de tudo —
  // perder não é o passo seguinte a enviar.
  const faixas: Estado[] = [...FUNIL, ...SAIDAS];

  if (!montado) return null;

  return createPortal(
    <div data-imprimindo data-so-impressao className="impressao-lista">
      <header>
        <h1>{empreiteira}</h1>
        <p>Posição do funil · {hoje}</p>
      </header>

      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Obra</th>
            <th>Origem</th>
            <th className="num">Valor</th>
          </tr>
        </thead>
        {faixas.map((estado) => {
          const doEstado = pedidos.filter((p) => p.status === estado);
          if (doEstado.length === 0) return null;

          const soma = doEstado.reduce(
            (s, p) => s + (p.valorFechado ?? p.valorOrcado ?? 0),
            0,
          );

          return (
            <tbody key={estado}>
              <tr>
                <th colSpan={3} className="grupo">
                  {ROTULO_ESTADO[estado]} ({doEstado.length})
                </th>
                <th className="grupo num">{soma > 0 ? moeda(soma) : ""}</th>
              </tr>
              {doEstado.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.cliente}</strong>
                    <span className="numero"> · #{p.codigo}</span>
                    {/* O "parado" é o motivo de a folha existir: é o pedido que
                        ninguém tocou e que vira cliente perdido em silêncio. */}
                    {p.parado && (
                      <span className="alerta"> · {dias(p)}d parado</span>
                    )}
                  </td>
                  <td>
                    {[p.bairro, p.tipoObra ? ROTULO_TIPO[p.tipoObra] : null]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                    {p.motivoPerda && (
                      <span className="numero"> · {p.motivoPerda}</span>
                    )}
                  </td>
                  <td>{p.origem ? ROTULO_ORIGEM[p.origem] : "—"}</td>
                  <td className="num">
                    {moeda(p.valorFechado ?? p.valorOrcado)}
                  </td>
                </tr>
              ))}
            </tbody>
          );
        })}
      </table>

      {/* Três números que não se somam entre si: um é expectativa, um é
          dinheiro fechado e o outro é o que já foi gasto sem retorno. */}
      <div className="resumo">
        <div>
          <span className="k">Na esteira ({abertos.length})</span>
          <span className="v">{moeda(naEsteira)}</span>
        </div>
        <div>
          <span className="k">Fechado ({fechados.length})</span>
          <span className="v">{moeda(totalFechado)}</span>
        </div>
        {!semCustoHora && (
          <div>
            <span className="k">Custo do perdido ({perdidos.length})</span>
            <span className="v">{moeda(custoPerdido)}</span>
          </div>
        )}
      </div>

      <footer>
        {pedidos.length} {pedidos.length === 1 ? "pedido" : "pedidos"} ·{" "}
        {parados.length}{" "}
        {parados.length === 1 ? "parado" : "parados"} ·{" "}
        {conversao === null
          ? "sem desfecho ainda"
          : `conversão ${conversao}% (${fechados.length} de ${comDesfecho})`}{" "}
        · gerado no Obra Nova em {hoje}
      </footer>
    </div>,
    document.body,
  );
}

function dias(p: PedidoNoQuadro): number {
  if (!p.ultimoEventoEm) return 0;
  return Math.floor((Date.now() - new Date(p.ultimoEventoEm).getTime()) / 86_400_000);
}

/**
 * `false` no servidor e no primeiro render, `true` depois de hidratar.
 *
 * O portal precisa do `document`, que só existe no navegador; devolver o
 * mesmo `false` dos dois lados é o que impede o erro de hidratação.
 */
function useMontado(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
