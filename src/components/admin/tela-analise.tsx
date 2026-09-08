"use client";

import Link from "next/link";
import { Cabecalho, Conteudo, Indicador, Secao, Vazio } from "./cabecalho";
import { moeda } from "@/lib/orcamento/formato";
import { horas } from "./painel-pipeline";
import {
  ORIGENS,
  ROTULO_ORIGEM,
  type AjustesDaOrg,
  type PedidoNoQuadro,
} from "@/lib/pipeline/constantes";

/**
 * A tela que responde às perguntas do PRD.
 *
 * A pergunta central é uma só: **onde o tempo vai**. Se a maior fatia estiver
 * na visita técnica, automatizar a redação do orçamento resolve pouco, e a
 * feature inteira serviu para descobrir isso antes de investir errado.
 *
 * O segundo número em importância é o custo do que se perdeu. É ele que dá o
 * argumento para cobrar pelo Estudo Preliminar — sem ele a conversa é "acho
 * que dá trabalho", com ele é um valor.
 */
export function TelaDeAnalise({
  pedidos,
  ajustes,
}: {
  pedidos: PedidoNoQuadro[];
  ajustes: AjustesDaOrg;
}) {
  const fechados = pedidos.filter((p) => p.status === "fechado");
  const perdidos = pedidos.filter((p) => p.status === "perdido");
  const comDesfecho = fechados.length + perdidos.length;

  const conversao =
    comDesfecho === 0 ? null : Math.round((fechados.length / comDesfecho) * 100);

  // A média só conta quem tem tempo lançado: incluir os que ninguém mediu
  // puxaria a média para baixo e faria parecer que orçamento é rápido.
  const medidos = pedidos.filter((p) => p.totalMinutos > 0);
  const mediaMinutos =
    medidos.length === 0
      ? null
      : Math.round(
          medidos.reduce((s, p) => s + p.totalMinutos, 0) / medidos.length,
        );

  const custoPerdido = perdidos.reduce((s, p) => s + (p.custoEstimado ?? 0), 0);
  const semCusto = ajustes.custoHora === null;

  const porOrigem = ORIGENS.map((o) => {
    const daOrigem = pedidos.filter((p) => p.origem === o);
    const f = daOrigem.filter((p) => p.status === "fechado").length;
    const d = f + daOrigem.filter((p) => p.status === "perdido").length;
    return { origem: o, total: daOrigem.length, fechados: f, comDesfecho: d };
  }).filter((x) => x.total > 0);

  // Lead time do pedido até o envio do orçamento — o gargalo real, em dias.
  const enviados = pedidos.filter((p) => p.status !== "novo_pedido");
  const leadMedio =
    enviados.length === 0
      ? null
      : Math.round(
          enviados.reduce((s, p) => s + diasDesde(p.dataPedido), 0) /
            enviados.length,
        );

  return (
    <>
      <Cabecalho
        titulo="Análise"
        meta="Pipeline e esforço"
        voltarPara="/admin/pipeline"
        voltarRotulo="Pipeline"
        acoes={
          <Link href="/admin/pipeline/precificacao" className="btn btn-secundario">
            Precificação
          </Link>
        }
      />

      <Conteudo>
        {semCusto && (
          <p className="aviso aviso-atencao mb-4 text-sm">
            Sem o custo por hora da empreiteira, os números de custo ficam de
            fora. Não é dado que se chuta: R$ 0,00 exibido como se fosse verdade
            estragaria a decisão que esta tela existe para apoiar.{" "}
            <Link
              href="/admin/pipeline/precificacao"
              className="underline underline-offset-4"
            >
              Definir agora
            </Link>
            .
          </p>
        )}

        {pedidos.length === 0 ? (
          <Vazio titulo="Nada para analisar ainda">
            Os números aparecem conforme os pedidos entram no pipeline e o tempo
            é registrado.
          </Vazio>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Indicador
                rotulo="Conversão"
                valor={conversao === null ? "—" : `${conversao}%`}
                detalhe={
                  comDesfecho === 0
                    ? "sem desfecho ainda"
                    : `${fechados.length} de ${comDesfecho}`
                }
                destaque="arroio"
              />
              <Indicador
                rotulo="Tempo por orçamento"
                valor={mediaMinutos === null ? "—" : horas(mediaMinutos)}
                detalhe={
                  medidos.length === 0
                    ? "nenhum medido"
                    : `média de ${medidos.length} medidos`
                }
                dica="Base para precificar o Estudo Preliminar. Só entram os pedidos com tempo lançado."
              />
              <Indicador
                rotulo="Custo do perdido"
                valor={semCusto ? "—" : moeda(custoPerdido)}
                detalhe={semCusto ? "falta o custo/hora" : `${perdidos.length} pedidos`}
                destaque={!semCusto && custoPerdido > 0 ? "amarelo" : undefined}
                dica="Quanto custou produzir orçamento que não fechou. É o argumento para cobrar pelo Estudo."
              />
              <Indicador
                rotulo="Lead time"
                valor={leadMedio === null ? "—" : `${leadMedio} d`}
                detalhe="do pedido até andar"
              />
            </div>

            <DistribuicaoDeEsforco pedidos={pedidos} />

            <Secao titulo="Conversão por origem">
              {porOrigem.length === 0 ? (
                <p className="text-sm text-fumaca">
                  Nenhum pedido tem origem registrada.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {porOrigem.map((x) => (
                    <li
                      key={x.origem}
                      className="flex items-center justify-between gap-3 rounded-lg border border-nevoa bg-white px-4 py-3"
                    >
                      <span className="text-sm font-semibold text-tinta">
                        {ROTULO_ORIGEM[x.origem]}
                      </span>
                      <span className="flex items-center gap-4">
                        <span className="font-mono text-[0.65rem] text-cinza uppercase">
                          {x.total} {x.total === 1 ? "pedido" : "pedidos"}
                        </span>
                        <span className="text-sm font-bold text-tinta tabular-nums">
                          {x.comDesfecho === 0
                            ? "—"
                            : `${Math.round((x.fechados / x.comDesfecho) * 100)}%`}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Secao>
          </div>
        )}

      </Conteudo>
    </>
  );
}

/**
 * A hipótese central do PRD, em barras.
 *
 * Se estudo e planilha somarem a maior parte, automatizar a produção do
 * orçamento vale a pena. Se a visita técnica dominar, o gargalo é a rua, e
 * nenhuma IA resolve.
 */
function DistribuicaoDeEsforco({ pedidos }: { pedidos: PedidoNoQuadro[] }) {
  const total = pedidos.reduce((s, p) => s + p.totalMinutos, 0);

  if (total === 0) {
    return (
      <Secao titulo="Onde o tempo vai">
        <p className="text-sm text-fumaca">
          Nenhum tempo registrado ainda. Esta é a pergunta que o pipeline existe
          para responder — sem lançamento, ela fica em aberto.
        </p>
      </Secao>
    );
  }

  // O detalhe por etapa mora no pedido; aqui só dá para somar o que a lista
  // traz. Fica o total e a média, e o corte por etapa é a tela de cada pedido.
  const medidos = pedidos.filter((p) => p.totalMinutos > 0);

  return (
    <Secao titulo="Onde o tempo vai">
      <div className="grid gap-3 md:grid-cols-3">
        <Indicador rotulo="Total medido" valor={horas(total)} />
        <Indicador
          rotulo="Pedidos com tempo"
          valor={`${medidos.length} de ${pedidos.length}`}
          detalhe="cobertura do registro"
          destaque={
            medidos.length / Math.max(1, pedidos.length) < 0.8
              ? "amarelo"
              : undefined
          }
        />
        <Indicador
          rotulo="Km rodados"
          valor={`${pedidos.reduce((s, p) => s + p.kmTotal, 0)} km`}
        />
      </div>
    </Secao>
  );
}

function diasDesde(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}
