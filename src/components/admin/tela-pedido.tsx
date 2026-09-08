"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Cabecalho,
  CartaoDeDados,
  Conteudo,
  Dado,
  Indicador,
  Secao,
} from "./cabecalho";
import { Dialogo } from "@/components/comum/dialogo";
import { Girando } from "@/components/comum/esqueleto";
import { CampoDeTelefone } from "@/components/comum/campos";
import { moeda, data as dataBR, paraCampo } from "@/lib/orcamento/formato";
import { CronometroDeEtapa, LancamentoManual } from "./cronometro-de-etapa";
import { AcoesDaLinha } from "./acoes-da-linha";
import { horas } from "./painel-pipeline";
import {
  apagarPedido,
  apagarTempo,
  gerarOrcamentoDoPedido,
  mudarEstado,
  salvarDetalhes,
} from "@/lib/pipeline/acoes";
import {
  ESTADOS,
  ETAPAS,
  ORIGENS,
  PORTES,
  ROTULO_ESTADO,
  ROTULO_ETAPA,
  ROTULO_ORIGEM,
  ROTULO_TIPO,
  TIPOS_DE_OBRA,
  type Estado,
  type PedidoCompleto,
} from "@/lib/pipeline/constantes";

/**
 * A tela de um pedido.
 *
 * Três blocos, na ordem em que a pergunta aparece: onde isto está (estado e
 * marcos), quanto custou até agora (esforço), e o que se sabe do cliente
 * (detalhes). O histórico fica por último porque é consulta, não operação.
 */
export function TelaDoPedido({ pedido }: { pedido: PedidoCompleto }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);

  const porEtapa = ETAPAS.map((e) => ({
    etapa: e,
    minutos: pedido.tempos
      .filter((t) => t.etapa === e)
      .reduce((s, t) => s + t.minutos, 0),
  })).filter((x) => x.minutos > 0);

  const maior = Math.max(1, ...porEtapa.map((x) => x.minutos));

  return (
    <>
      <Cabecalho
        titulo={pedido.cliente}
        meta={`#${pedido.codigo} · ${ROTULO_ESTADO[pedido.status]}`}
        voltarPara="/admin/pipeline"
        voltarRotulo="Pipeline"
        acoes={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="btn btn-secundario"
            >
              Editar
            </button>
            <AcoesDaLinha
              acoes={[
                {
                  rotulo: "Apagar pedido",
                  perigo: true,
                  executar: async () => {
                    const r = await apagarPedido(pedido.id);
                    if (r.ok) router.push("/admin/pipeline");
                    return r.erro ?? null;
                  },
                  confirmar: {
                    titulo: `Apagar o pedido de ${pedido.cliente}?`,
                    aviso:
                      "Some com o histórico de estados e com todo o tempo registrado. Não dá para desfazer.",
                    palavra: "APAGAR",
                  },
                },
              ]}
            />
          </div>
        }
      />

      <Conteudo>
        <div className="flex flex-col gap-6">
          <Estados pedido={pedido} />

          <Secao titulo="Esforço">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Indicador
                  rotulo="Esforço"
                  valor={horas(pedido.totalMinutos)}
                  detalhe={`${pedido.etapasRegistradas} de ${ETAPAS.length} etapas medidas`}
                />
                <Indicador
                  rotulo="Deslocamento"
                  valor={pedido.kmTotal > 0 ? `${pedido.kmTotal} km` : "—"}
                  detalhe="rodados"
                />
                {/* Sem custo/hora o cartão diz que falta, em vez de mostrar
                    R$ 0,00 — que leria como "não custou nada". */}
                <Indicador
                  rotulo="Custo estimado"
                  valor={
                    pedido.custoEstimado === null
                      ? "—"
                      : moeda(pedido.custoEstimado)
                  }
                  detalhe={
                    pedido.custoHora === null
                      ? "falta o custo/hora"
                      : "tempo + deslocamento"
                  }
                />
                <Indicador
                  rotulo="Lead time"
                  valor={leadTime(pedido)}
                  detalhe="desde o pedido"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <CronometroDeEtapa
                  pedidoId={pedido.id}
                  aoRegistrar={() => router.refresh()}
                />
                <LancamentoManual
                  pedidoId={pedido.id}
                  aoRegistrar={() => router.refresh()}
                />
              </div>

              {/* A distribuição por etapa é a razão de ser desta feature: ela
                  é que responde se o gargalo está no estudo ou na visita. */}
              {porEtapa.length > 0 && (
                <div className="rounded-lg border border-nevoa bg-white px-5 py-4">
                  <p className="rotulo mb-3">Onde o tempo foi</p>
                  <ul className="flex flex-col gap-2.5">
                    {porEtapa.map((x) => (
                      <li key={x.etapa} className="flex items-center gap-3">
                        <span className="w-40 shrink-0 truncate text-sm text-tinta">
                          {ROTULO_ETAPA[x.etapa]}
                        </span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-cinza-100">
                          <span
                            className="block h-full rounded-full bg-arroio"
                            style={{ width: `${(x.minutos / maior) * 100}%` }}
                          />
                        </span>
                        <span className="w-16 shrink-0 text-right font-mono text-xs text-cinza tabular-nums">
                          {horas(x.minutos)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {pedido.tempos.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {pedido.tempos.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-nevoa bg-white px-4 py-3"
                    >
                      <span className="min-w-0">
                        <span className="text-sm font-semibold text-tinta">
                          {ROTULO_ETAPA[t.etapa]}
                        </span>
                        <span className="mt-0.5 block font-mono text-[0.6rem] tracking-widest text-cinza uppercase">
                          {dataBR(t.data)} · {t.fonte}
                          {t.km ? ` · ${t.km} km` : ""}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className="text-sm font-bold text-tinta tabular-nums">
                          {horas(t.minutos)}
                        </span>
                        <AcoesDaLinha
                          acoes={[
                            {
                              rotulo: "Apagar lançamento",
                              perigo: true,
                              executar: async () =>
                                (await apagarTempo(t.id, pedido.id)).erro ?? null,
                            },
                          ]}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Secao>

          <Secao titulo="O pedido">
            <div className="grid gap-3 md:grid-cols-2">
              <CartaoDeDados titulo="Cliente" aoEditar={() => setEditando(true)}>
                <Dado rotulo="Nome" valor={pedido.cliente} />
                <Dado rotulo="Telefone" valor={pedido.telefone ?? "—"} />
                <Dado rotulo="Bairro" valor={pedido.bairro ?? "—"} />
                <Dado
                  rotulo="Tipo de obra"
                  valor={pedido.tipoObra ? ROTULO_TIPO[pedido.tipoObra] : "—"}
                />
                <Dado
                  rotulo="Origem"
                  valor={pedido.origem ? ROTULO_ORIGEM[pedido.origem] : "—"}
                />
                <Dado rotulo="Porte" valor={pedido.porte ?? "—"} />
              </CartaoDeDados>

              <CartaoDeDados titulo="Números e datas" aoEditar={() => setEditando(true)}>
                <Dado rotulo="Pedido em" valor={dataBR(pedido.dataPedido)} />
                <Dado
                  rotulo="Estudo entregue"
                  valor={
                    pedido.dataEntregaEstudo
                      ? dataBR(pedido.dataEntregaEstudo)
                      : "—"
                  }
                />
                <Dado
                  rotulo="Orçamento enviado"
                  valor={
                    pedido.dataEnvioOrcamento
                      ? dataBR(pedido.dataEnvioOrcamento)
                      : "—"
                  }
                />
                <Dado
                  rotulo="Estudo cobrado"
                  valor={
                    pedido.estudoCobrado
                      ? `${moeda(pedido.estudoValor)}${pedido.estudoAbatido ? " · abatido" : ""}`
                      : "não"
                  }
                />
                <Dado
                  rotulo="Valor orçado"
                  valor={pedido.valorOrcado === null ? "—" : moeda(pedido.valorOrcado)}
                />
                <Dado
                  rotulo="Valor fechado"
                  valor={
                    pedido.valorFechado === null ? "—" : moeda(pedido.valorFechado)
                  }
                />
              </CartaoDeDados>
            </div>

            {/* O documento nasce daqui com cliente, telefone e bairro já
                preenchidos. Redigitar o que já foi digitado na entrada do funil
                é o atrito que faz alguém voltar para a planilha. */}
            <div className="mt-3">
              {pedido.orcamentoId ? (
                <p className="text-sm text-fumaca">
                  Documento vinculado:{" "}
                  <Link
                    href={`/admin/orcamentos/${pedido.orcamentoId}`}
                    className="underline underline-offset-4"
                  >
                    {pedido.orcamentoCliente ?? "abrir orçamento"}
                  </Link>
                </p>
              ) : (
                <GerarOrcamento pedidoId={pedido.id} />
              )}
            </div>

            {pedido.observacoes && (
              <p className="mt-3 text-sm whitespace-pre-line text-fumaca">
                {pedido.observacoes}
              </p>
            )}
          </Secao>

          <Secao titulo="Histórico">
            <ol className="flex flex-col gap-2">
              {pedido.eventos.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-nevoa bg-white px-4 py-3"
                >
                  <span className="text-sm text-tinta">
                    {e.anterior
                      ? `${ROTULO_ESTADO[e.anterior]} → ${ROTULO_ESTADO[e.novo]}`
                      : `Registrado como ${ROTULO_ESTADO[e.novo]}`}
                  </span>
                  <span className="shrink-0 font-mono text-[0.65rem] text-cinza">
                    {dataBR(e.em)}
                  </span>
                </li>
              ))}
            </ol>
          </Secao>
        </div>

        <EditarPedido
          pedido={pedido}
          aberto={editando}
          aoFechar={() => setEditando(false)}
        />
      </Conteudo>
    </>
  );
}

/**
 * A régua de estados.
 *
 * Um clique move o pedido. Perdido e fechado abrem diálogo, porque os dois
 * exigem um dado a mais e sem ele o banco recusa a gravação — melhor pedir
 * antes do que devolver erro depois.
 */
function Estados({ pedido }: { pedido: PedidoCompleto }) {
  const router = useRouter();
  const [pedindo, setPedindo] = useState<Estado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [indo, setIndo] = useState<Estado | null>(null);

  async function ir(estado: Estado) {
    if (estado === "perdido" || estado === "fechado") return setPedindo(estado);
    setIndo(estado);
    setErro(null);
    const r = await mudarEstado(pedido.id, estado);
    setIndo(null);
    if (!r.ok) return setErro(r.erro ?? "Não consegui mudar o estado.");
    router.refresh();
  }

  return (
    <Secao titulo="Estado">
      <div className="flex flex-wrap gap-1.5">
        {ESTADOS.map((e) => (
          <button
            key={e}
            type="button"
            disabled={indo !== null || e === pedido.status}
            onClick={() => ir(e)}
            className={`btn btn-compacto ${
              e === pedido.status ? "btn-primario" : "btn-secundario"
            }`}
          >
            {indo === e && <Girando />}
            {ROTULO_ESTADO[e]}
          </button>
        ))}
      </div>

      {pedido.parado && (
        <p className="aviso aviso-atencao mt-3 text-sm">
          Este pedido não anda há dias e ainda está no começo do funil. É o tipo
          de cliente que se perde por esquecimento, não por preço.
        </p>
      )}

      {pedido.motivoPerda && (
        <p className="mt-3 text-sm text-fumaca">
          <b>Motivo da perda:</b> {pedido.motivoPerda}
        </p>
      )}

      {erro && <p className="aviso aviso-erro mt-3 text-sm">{erro}</p>}

      {/* `key` no estado pedido: o diálogo remonta e o campo nasce certo,
          em vez de um efeito copiando prop para estado. */}
      <DesfechoObrigatorio
        key={pedindo ?? "nenhum"}
        pedido={pedido}
        estado={pedindo}
        aoFechar={() => setPedindo(null)}
      />
    </Secao>
  );
}

/** Perdido pede motivo, fechado pede valor. Sem isso o banco recusa. */
function DesfechoObrigatorio({
  pedido,
  estado,
  aoFechar,
}: {
  pedido: PedidoCompleto;
  estado: Estado | null;
  aoFechar: () => void;
}) {
  const router = useRouter();
  // Fechar já vem com o valor orçado preenchido: o mais comum é fechar pelo
  // que foi orçado, e quando não for é um campo para corrigir, não digitar.
  const [valor, setValor] = useState(
    estado === "fechado" ? paraCampo(pedido.valorOrcado) : "",
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!estado) return;
    setSalvando(true);
    setErro(null);
    const r = await mudarEstado(
      pedido.id,
      estado,
      estado === "perdido"
        ? { motivoPerda: valor }
        : { valorFechado: Number(valor.replace(/\./g, "").replace(",", ".")) },
    );
    setSalvando(false);
    if (!r.ok) return setErro(r.erro ?? "Não consegui gravar.");
    aoFechar();
    router.refresh();
  }

  const perdido = estado === "perdido";

  return (
    <Dialogo
      aberto={estado !== null}
      aoFechar={aoFechar}
      titulo={perdido ? "Marcar como perdido" : "Marcar como fechado"}
      descricao={
        perdido
          ? "O motivo é obrigatório. É ele que, somado aos outros, mostra se o problema é preço, prazo ou demora."
          : "O valor fechado é obrigatório: é a base de qualquer conta de margem depois."
      }
      estreito
    >
      <div className="dialogo-corpo flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">
            {perdido ? "Motivo da perda" : "Valor fechado"}
          </span>
          {perdido ? (
            <textarea
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              rows={3}
              autoFocus
              placeholder="Preço, prazo, sumiu, fechou com outro…"
              className="campo"
            />
          ) : (
            <input
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              autoFocus
              placeholder="0,00"
              className="campo"
            />
          )}
        </label>

        {erro && <p className="aviso aviso-erro text-sm">{erro}</p>}
      </div>

      <div className="dialogo-rodape">
        <button type="button" onClick={aoFechar} className="btn btn-secundario">
          Cancelar
        </button>
        <button
          type="button"
          onClick={salvar}
          disabled={salvando || !valor.trim()}
          className={`btn ${salvando ? "btn-carregando" : "btn-primario"}`}
        >
          {salvando && <Girando />}
          Confirmar
        </button>
      </div>
    </Dialogo>
  );
}

function EditarPedido({
  pedido,
  aberto,
  aoFechar,
}: {
  pedido: PedidoCompleto;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [estado, acao, pendente] = useActionState(salvarDetalhes, null);

  useEffect(() => {
    if (estado?.ok) {
      aoFechar();
      router.refresh();
    }
  }, [estado, aoFechar, router]);

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Editar pedido"
      descricao="O que não coube nos quatro campos da entrada."
      estreito
    >
      <form action={acao} className="dialogo-forma">
        <input type="hidden" name="id" value={pedido.id} />
        <div className="dialogo-corpo flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Cliente *</span>
            <input
              name="cliente"
              defaultValue={pedido.cliente}
              required
              className="campo"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Telefone</span>
            <CampoDeTelefone
              nome="telefone"
              valorInicial={pedido.telefone ?? ""}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Bairro</span>
            <input
              name="bairro"
              defaultValue={pedido.bairro ?? ""}
              className="campo"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Tipo de obra</span>
            <select
              name="tipoObra"
              defaultValue={pedido.tipoObra ?? ""}
              className="campo"
            >
              <option value="">—</option>
              {TIPOS_DE_OBRA.map((t) => (
                <option key={t} value={t}>
                  {ROTULO_TIPO[t]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Origem do lead</span>
            <select
              name="origem"
              defaultValue={pedido.origem ?? ""}
              className="campo"
            >
              <option value="">—</option>
              {ORIGENS.map((o) => (
                <option key={o} value={o}>
                  {ROTULO_ORIGEM[o]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Porte</span>
            <select
              name="porte"
              defaultValue={pedido.porte ?? ""}
              className="campo"
            >
              <option value="">—</option>
              {PORTES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Valor orçado</span>
            <input
              name="valorOrcado"
              inputMode="decimal"
              defaultValue={paraCampo(pedido.valorOrcado)}
              placeholder="0,00"
              className="campo"
            />
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="estudoCobrado"
              defaultChecked={pedido.estudoCobrado}
            />
            <span className="text-sm text-tinta">Estudo preliminar cobrado</span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Valor do estudo</span>
            <input
              name="estudoValor"
              inputMode="decimal"
              defaultValue={paraCampo(pedido.estudoValor)}
              placeholder="0,00"
              className="campo"
            />
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="estudoAbatido"
              defaultChecked={pedido.estudoAbatido}
            />
            <span className="text-sm text-tinta">
              Estudo abatido do valor da obra
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Observações</span>
            <textarea
              name="observacoes"
              defaultValue={pedido.observacoes ?? ""}
              rows={3}
              className="campo"
            />
          </label>

          {estado?.erro && (
            <p className="aviso aviso-erro text-sm">{estado.erro}</p>
          )}
        </div>

        <div className="dialogo-rodape">
          <button type="button" onClick={aoFechar} className="btn btn-secundario">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pendente}
            className={`btn ${pendente ? "btn-carregando" : "btn-primario"}`}
          >
            {pendente && <Girando />}
            Salvar
          </button>
        </div>
      </form>
    </Dialogo>
  );
}

/**
 * Cria o orçamento já preenchido e abre a tela dele.
 */
function GerarOrcamento({ pedidoId }: { pedidoId: string }) {
  const router = useRouter();
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar() {
    setIndo(true);
    setErro(null);
    const r = await gerarOrcamentoDoPedido(pedidoId);
    if (r.ok && r.id) return router.push(`/admin/orcamentos/${r.id}`);
    setIndo(false);
    setErro(r.erro ?? "Não consegui gerar o orçamento.");
  }

  return (
    <>
      <button
        type="button"
        onClick={gerar}
        disabled={indo}
        className={`btn ${indo ? "btn-carregando" : "btn-secundario"}`}
      >
        {indo && <Girando />}
        {indo ? "Gerando…" : "Gerar orçamento deste pedido"}
      </button>
      {erro && <p className="aviso aviso-erro mt-2 text-sm">{erro}</p>}
    </>
  );
}

/**
 * Dias entre o pedido e o desfecho — ou até hoje, se ainda está na rua.
 * É o lead time do PRD, e ele sai de graça dos eventos.
 */
function leadTime(pedido: PedidoCompleto): string {
  const inicio = new Date(pedido.dataPedido).getTime();
  const fim =
    pedido.status === "fechado" || pedido.status === "perdido"
      ? new Date(pedido.eventos[0]?.em ?? Date.now()).getTime()
      : Date.now();
  const dias = Math.max(0, Math.round((fim - inicio) / 86_400_000));
  return `${dias} ${dias === 1 ? "dia" : "dias"}`;
}
