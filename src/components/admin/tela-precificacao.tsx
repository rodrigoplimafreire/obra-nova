"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cabecalho, Conteudo, Indicador, Secao } from "./cabecalho";
import { Girando } from "@/components/comum/esqueleto";
import { moeda, paraCampo } from "@/lib/orcamento/formato";
import { salvarPremissas } from "@/lib/pipeline/acoes";
import { horas } from "./painel-pipeline";
import { ETAPAS, ROTULO_ETAPA, PORTES } from "@/lib/pipeline/constantes";
import { pesoNaObra, type Carga } from "@/lib/pipeline/precificacao";
import type { PremissasComerciais } from "@/lib/pipeline/dados";

/**
 * Quanto embutir em cada proposta para pagar os orçamentos que não fecham.
 *
 * A tela é lida de cima para baixo como uma conta: o custo de produzir um
 * orçamento, quantos fecham, e o resultado — a carga. Os campos ficam **depois**
 * do resultado de propósito: quem abre esta tela pela segunda vez quer o
 * número, não o formulário.
 */
export function TelaDePrecificacao({
  premissas,
  carga,
  exemplos,
}: {
  premissas: PremissasComerciais;
  carga: Carga;
  /** Valores de obra reais da empreiteira, para o peso não ser hipotético. */
  exemplos: Array<{ cliente: string; valor: number }>;
}) {
  return (
    <>
      <Cabecalho
        titulo="Precificação"
        meta="Custo comercial a embutir"
        voltarPara="/admin/pipeline"
        voltarRotulo="Pipeline"
      />

      <Conteudo>
        <div className="flex flex-col gap-6">
          <Resultado carga={carga} exemplos={exemplos} />
          <Formulario premissas={premissas} carga={carga} />
        </div>
      </Conteudo>
    </>
  );
}

function Resultado({
  carga,
  exemplos,
}: {
  carga: Carga;
  exemplos: Array<{ cliente: string; valor: number }>;
}) {
  if (carga.impedimento) {
    return (
      <div className="rounded-lg border border-atencao-forte bg-atencao-fundo px-5 py-5">
        <p className="rotulo mb-2">Ainda não dá para calcular</p>
        <p className="text-sm text-tinta">{carga.impedimento}</p>
        <p className="mt-3 text-sm text-fumaca">
          Preencha abaixo e o número aparece aqui.
        </p>
      </div>
    );
  }

  return (
    <>
      <Secao titulo="A conta">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Indicador
            rotulo="Custa orçar"
            valor={moeda(carga.custoPorOrcamento)}
            detalhe={`${horas(carga.minutosPorOrcamento)}${carga.kmPorOrcamento > 0 ? ` · ${carga.kmPorOrcamento} km` : ""}`}
            dica="Quanto sai produzir um orçamento, do deslocamento à formatação da proposta."
          />
          <Indicador
            rotulo="Fecham"
            valor={`${carga.conversao}%`}
            detalhe={
              carga.fonteDaConversao === "medido"
                ? `medido em ${carga.comDesfecho} desfechos`
                : "estimativa sua"
            }
          />
          {/* O número que a feature existe para produzir. */}
          <Indicador
            rotulo="Embutir por obra"
            valor={moeda(carga.base)}
            detalhe="na obra média"
            destaque="arroio"
            dica="O custo do orçamento dividido pela taxa de conversão: cada obra fechada paga a si e às que se perderam."
          />
          <Indicador
            rotulo="Cobertura"
            valor={carga.cobertura === null ? "—" : `${carga.cobertura}%`}
            detalhe={
              carga.cobertura === null
                ? "sem desfecho ainda"
                : carga.cobertura < 95
                  ? "está recuperando menos"
                  : "se paga"
            }
            destaque={
              carga.cobertura !== null && carga.cobertura < 95 ? "amarelo" : undefined
            }
            dica="Com a mistura de portes que já aconteceu, esta carga recupera quanto do que foi gasto orçando. Abaixo de 100%, o peso de algum porte está baixo demais."
          />
        </div>

        {/* De onde veio cada número. Sem isto, premissa e medição parecem a
            mesma coisa — e uma delas é chute informado. */}
        <p className="mt-3 text-sm text-fumaca">
          {carga.fonteDoCusto === "medido"
            ? `O custo é a média real de ${carga.medidos} orçamentos com tempo lançado.`
            : `O custo vem do orçamento padrão que você definiu — ainda não há ${4 - carga.medidos} ${4 - carga.medidos === 1 ? "orçamento medido" : "orçamentos medidos"} suficientes para medir.`}{" "}
          {carga.fonteDaConversao === "medido"
            ? "A conversão é a sua, medida."
            : `A conversão é a sua estimativa — com ${6 - carga.comDesfecho} desfecho(s) a mais ela passa a ser medida.`}
        </p>
      </Secao>

      <Secao titulo="Por porte">
        <div className="grid gap-3 md:grid-cols-3">
          {PORTES.map((p) => (
            <div
              key={p}
              className="rounded-lg border border-nevoa bg-white px-5 py-4"
            >
              <p className="rotulo">Obra {p}</p>
              <p className="mt-2 font-sans text-2xl leading-none font-semibold -tracking-[0.03em] text-tinta tabular-nums">
                {moeda(carga.porPorte?.[p] ?? null)}
              </p>
            </div>
          ))}
        </div>

        {/* O peso sobre obras de verdade, não sobre exemplos inventados: é
            aqui que se vê se a carga derruba a venda da obra pequena. */}
        {exemplos.length > 0 && (
          <div className="mt-4 rounded-lg border border-nevoa bg-white px-5 py-4">
            <p className="rotulo mb-3">
              O que isso pesa nos seus orçamentos de verdade
            </p>
            <ul className="flex flex-col gap-2">
              {exemplos.map((e) => {
                const peso = pesoNaObra(carga.base ?? 0, e.valor);
                return (
                  <li
                    key={e.cliente}
                    className="flex items-center justify-between gap-3 border-b border-cinza-100 pb-2 last:border-0 last:pb-0"
                  >
                    <span className="min-w-0 truncate text-sm text-tinta">
                      {e.cliente}
                    </span>
                    <span className="flex shrink-0 items-center gap-4">
                      <span className="font-mono text-[0.65rem] text-cinza tabular-nums">
                        {moeda(e.valor)}
                      </span>
                      <span
                        className={`text-sm font-bold tabular-nums ${
                          (peso ?? 0) > 10 ? "text-amarelo-tinta" : "text-tinta"
                        }`}
                      >
                        {peso === null ? "—" : `${peso}%`}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-cinza">
              O custo de orçar não cresce com o tamanho da obra — por isso a
              carga é um valor, não um percentual. Onde ela passa de 10% da
              obra, vale pensar em cobrar o Estudo Preliminar em vez de embutir.
            </p>
          </div>
        )}
      </Secao>
    </>
  );
}

function Formulario({
  premissas,
  carga,
}: {
  premissas: PremissasComerciais;
  carga: Carga;
}) {
  const router = useRouter();
  const [estado, acao, pendente] = useActionState(salvarPremissas, null);

  useEffect(() => {
    if (estado?.ok) router.refresh();
  }, [estado, router]);

  const totalPadrao = premissas.padrao.reduce((s, p) => s + p.minutos, 0);

  return (
    <form action={acao} className="flex flex-col gap-6">
      <Secao titulo="O que custa a sua hora">
        <div className="grid gap-3 md:grid-cols-2">
          <Campo
            nome="custoHora"
            rotulo="Custo por hora"
            valor={paraCampo(premissas.custoHora)}
            ajuda="O que você precisa tirar por hora trabalhada, contando o mês inteiro."
          />
          <Campo
            nome="custoKm"
            rotulo="Custo por km"
            valor={paraCampo(premissas.custoKm)}
            ajuda="Combustível, desgaste e manutenção, por quilômetro."
          />
        </div>
      </Secao>

      <Secao titulo="O orçamento típico">
        <p className="mb-3 text-sm text-fumaca">
          Quanto tempo costuma levar cada etapa, num orçamento comum. É a base
          da conta enquanto não houver orçamentos medidos — e o app troca
          sozinho para o medido quando houver.
          {carga.fonteDoCusto === "medido" && (
            <> Hoje ele já está usando o medido; isto fica de reserva.</>
          )}
        </p>

        <div className="rounded-lg border border-nevoa bg-white px-5 py-4">
          <ul className="flex flex-col gap-3">
            {ETAPAS.map((etapa) => {
              const linha = premissas.padrao.find((p) => p.etapa === etapa);
              return (
                <li key={etapa} className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-1 flex-col gap-1.5">
                    <span className="rotulo-campo">{ROTULO_ETAPA[etapa]}</span>
                    <input
                      name={`min_${etapa}`}
                      type="number"
                      min={0}
                      defaultValue={linha?.minutos || ""}
                      placeholder="minutos"
                      className="campo"
                    />
                  </label>
                  {etapa === "deslocamento" && (
                    <label className="flex flex-1 flex-col gap-1.5">
                      <span className="rotulo-campo">Km rodados</span>
                      <input
                        name="padraoKm"
                        inputMode="decimal"
                        defaultValue={paraCampo(linha?.km ?? null)}
                        placeholder="ida e volta"
                        className="campo"
                      />
                    </label>
                  )}
                </li>
              );
            })}
          </ul>

          {totalPadrao > 0 && (
            <p className="mt-4 border-t border-cinza-100 pt-3 text-sm text-fumaca">
              Total do orçamento típico: <b>{horas(totalPadrao)}</b>
            </p>
          )}
        </div>
      </Secao>

      <Secao titulo="Quantos fecham, e o peso de cada porte">
        <div className="grid gap-3 md:grid-cols-2">
          <Campo
            nome="conversaoEstimada"
            rotulo="Conversão estimada (%)"
            valor={paraCampo(premissas.conversaoEstimada)}
            ajuda="De cada 100 orçamentos, quantos fecham. Um em três é 33."
          />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Campo
            nome="cargaP"
            rotulo="Peso · obra P"
            valor={String(premissas.multiplicador.P)}
            ajuda="Fração da carga média."
          />
          <Campo
            nome="cargaM"
            rotulo="Peso · obra M"
            valor={String(premissas.multiplicador.M)}
          />
          <Campo
            nome="cargaG"
            rotulo="Peso · obra G"
            valor={String(premissas.multiplicador.G)}
          />
        </div>

        <p className="mt-3 text-xs text-cinza">
          Peso 1 é a carga cheia. Baixar o da obra pequena a torna vendável, mas
          alguém precisa carregar a diferença — a <b>Cobertura</b>, lá em cima,
          é quem avisa quando ninguém está carregando.
        </p>
      </Secao>

      <Secao titulo="Ajuste do quadro">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Dias para sinalizar parado</span>
            <input
              name="diasParaParado"
              type="number"
              min={1}
              max={60}
              defaultValue={premissas.diasParaParado}
              className="campo"
            />
            <span className="text-xs text-cinza">
              Depois de quantos dias sem andar um pedido acende no quadro.
            </span>
          </label>
        </div>
      </Secao>

      {estado?.erro && <p className="aviso aviso-erro text-sm">{estado.erro}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pendente}
          className={`btn ${pendente ? "btn-carregando" : "btn-primario"}`}
        >
          {pendente && <Girando />}
          {pendente ? "Salvando…" : "Salvar premissas"}
        </button>
        <Link href="/admin/pipeline/analise" className="btn btn-secundario">
          Ver análise
        </Link>
      </div>
    </form>
  );
}

function Campo({
  nome,
  rotulo,
  valor,
  ajuda,
}: {
  nome: string;
  rotulo: string;
  valor: string;
  ajuda?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="rotulo-campo">{rotulo}</span>
      <input
        name={nome}
        inputMode="decimal"
        defaultValue={valor}
        placeholder="0,00"
        className="campo"
      />
      {ajuda && <span className="text-xs text-cinza">{ajuda}</span>}
    </label>
  );
}
