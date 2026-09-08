"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cabecalho, Conteudo, Indicador } from "./cabecalho";
import { Girando } from "@/components/comum/esqueleto";
import { moeda, paraCampo } from "@/lib/orcamento/formato";
import { salvarPremissas } from "@/lib/pipeline/acoes";
import { horas } from "./painel-pipeline";
import { ETAPAS, ROTULO_ETAPA, PORTES } from "@/lib/pipeline/constantes";
import { pesoNaObra, type Carga } from "@/lib/pipeline/precificacao";
import { CalculadoraDeHora, CalculadoraDeKm } from "./calculadoras-de-custo";
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
        <div className="flex flex-col gap-5">
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
      <div className="rounded-lg border border-atencao-forte bg-atencao-fundo px-5 py-4">
        <p className="rotulo mb-1.5">Ainda não dá para calcular</p>
        <p className="max-w-prose text-sm text-tinta">{carga.impedimento}</p>
        <p className="mt-2 text-sm text-fumaca">
          Preencha abaixo e o número aparece aqui.
        </p>
      </div>
    );
  }

  return (
    <>
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
      <p className="max-w-prose text-sm text-fumaca">
        {carga.fonteDoCusto === "medido"
          ? `O custo é a média real de ${carga.medidos} orçamentos com tempo lançado.`
          : "O custo vem do orçamento típico que você definiu; com 4 orçamentos medidos ele passa a ser medido."}{" "}
        {carga.fonteDaConversao === "medido"
          ? "A conversão é a sua, medida."
          : `A conversão é a sua estimativa — faltam ${Math.max(0, 6 - carga.comDesfecho)} desfecho(s) para ela virar medida.`}
      </p>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-nevoa bg-white px-5 py-5">
          <p className="rotulo mb-4">Quanto embutir, por porte</p>
          <ul className="flex flex-col">
            {PORTES.map((p) => (
              <li
                key={p}
                className="flex items-baseline justify-between gap-3 border-b border-cinza-100 py-2.5 last:border-0"
              >
                <span className="text-sm text-tinta">Obra {p}</span>
                <span className="font-sans text-lg font-semibold text-tinta tabular-nums">
                  {moeda(carga.porPorte?.[p] ?? null)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* O peso sobre obras de verdade, não sobre exemplos inventados: é
            aqui que se vê se a carga derruba a venda da obra pequena. */}
        {exemplos.length > 0 && (
          <section className="rounded-lg border border-nevoa bg-white px-5 py-5">
            <p className="rotulo">O que pesa nos seus orçamentos</p>
            <p className="mt-1.5 max-w-prose text-sm text-fumaca">
              A carga é um valor, não um percentual — orçar não custa mais só
              porque a obra é maior.
            </p>
            <ul className="mt-4 flex flex-col">
              {exemplos.map((e) => {
                const peso = pesoNaObra(carga.base ?? 0, e.valor);
                return (
                  <li
                    key={e.cliente}
                    className="flex items-baseline justify-between gap-3 border-b border-cinza-100 py-2.5 last:border-0"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-tinta">
                      {e.cliente}
                    </span>
                    <span className="shrink-0 font-mono text-[0.65rem] text-cinza tabular-nums">
                      {moeda(e.valor)}
                    </span>
                    <span
                      className={`w-14 shrink-0 text-right text-sm font-bold tabular-nums ${
                        (peso ?? 0) > 10 ? "text-amarelo-tinta" : "text-tinta"
                      }`}
                    >
                      {peso === null ? "—" : `${peso}%`}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-cinza">
              Onde passa de 10% da obra, vale cobrar o Estudo Preliminar em vez
              de embutir.
            </p>
          </section>
        )}
      </div>
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

  // Controlados, para as calculadoras poderem escrever neles.
  const [custoHora, setCustoHora] = useState(paraCampo(premissas.custoHora));
  const [custoKm, setCustoKm] = useState(paraCampo(premissas.custoKm));

  const totalPadrao = premissas.padrao.reduce((s, p) => s + p.minutos, 0);

  return (
    /**
     * Duas colunas em tela larga, e **campo de número com largura de número**.
     *
     * A versão anterior era uma coluna só, sem largura máxima: num monitor de
     * 1400px, o campo para digitar "60 minutos" tinha 1370px e 99% dele era
     * vazio. Fila de caixas gigantes e quase vazias não parece formulário,
     * parece defeito — e o olho não acha onde escrever.
     */
    <form action={acao} className="flex flex-col gap-5">
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Cartao
          titulo="O que custa o seu tempo"
          nota="Os dois valores que transformam minutos e quilômetros em dinheiro."
        >
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Numero
                nome="custoHora"
                rotulo="Custo por hora"
                prefixo="R$"
                sufixo="/hora"
                valor={custoHora}
                aoMudar={setCustoHora}
              />
              <p className="max-w-prose text-xs text-cinza">
                O que uma hora sua custa ao negócio — não o que você cobra do
                cliente.
              </p>
              <CalculadoraDeHora aoCalcular={setCustoHora} />
            </div>

            <div className="flex flex-col gap-2 border-t border-cinza-100 pt-5">
              <Numero
                nome="custoKm"
                rotulo="Custo por km"
                prefixo="R$"
                sufixo="/km"
                valor={custoKm}
                aoMudar={setCustoKm}
              />
              <p className="max-w-prose text-xs text-cinza">
                Quanto custa <b>um</b> quilômetro. A distância de cada cliente
                você lança no pedido dele.
              </p>
              <CalculadoraDeKm aoCalcular={setCustoKm} />
            </div>
          </div>
        </Cartao>

        {/* O orçamento típico é uma tabela de minutos e sempre foi — então
            desenha como tabela, com o total no rodapé, e não como seis campos
            empilhados de largura inteira. */}
        <Cartao
          titulo="O orçamento típico"
          nota="Num orçamento comum, do começo ao fim, quanto tempo cada parte leva? Se ainda não sabe, chute pela última visita — número aproximado vale mais que campo vazio."
        >
          <ul className="flex flex-col">
            {ETAPAS.map((etapa) => {
              const linha = premissas.padrao.find((p) => p.etapa === etapa);
              return (
                // `flex-wrap`: sem ele a linha vira um piso de largura mínima
                // que empurra a coluna inteira do grid, e a tela transborda no
                // celular — foi o que aconteceu na primeira versão.
                <li
                  key={etapa}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-cinza-100 py-2 last:border-0"
                >
                  {/* Piso de 7rem no rótulo: no celular, a linha do
                      deslocamento passa a quebrar e os dois campos descem para
                      a segunda linha, em vez de o nome virar "Desloc…". Nome
                      cortado é pior que linha alta. */}
                  <label
                    htmlFor={`min_${etapa}`}
                    className="min-w-28 flex-1 truncate text-sm text-tinta"
                  >
                    {ROTULO_ETAPA[etapa]}
                  </label>

                  <span className="flex shrink-0 items-center gap-1.5">
                    <input
                      id={`min_${etapa}`}
                      name={`min_${etapa}`}
                      type="number"
                      min={0}
                      defaultValue={linha?.minutos || ""}
                      placeholder="0"
                      className="campo w-20 text-right tabular-nums"
                    />
                    <span className="w-6 font-mono text-[0.65rem] text-cinza">
                      min
                    </span>

                    {/* Km só existe no deslocamento. O vão nas outras linhas
                        alinha a coluna de minutos — mas só a partir de `sm`:
                        no celular ele seria 110px de nada empurrando a tela. */}
                    {etapa === "deslocamento" ? (
                      <>
                        <input
                          name="padraoKm"
                          inputMode="decimal"
                          defaultValue={paraCampo(linha?.km ?? null)}
                          placeholder="0"
                          aria-label="Km rodados, ida e volta"
                          className="campo w-20 text-right tabular-nums"
                        />
                        <span className="w-6 font-mono text-[0.65rem] text-cinza">
                          km
                        </span>
                      </>
                    ) : (
                      <span className="hidden w-[6.875rem] sm:block" aria-hidden />
                    )}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex items-baseline justify-between border-t border-nevoa pt-3">
            <span className="rotulo">Total</span>
            <span className="font-sans text-lg font-semibold text-tinta tabular-nums">
              {totalPadrao > 0 ? horas(totalPadrao) : "—"}
            </span>
          </div>

          {carga.fonteDoCusto === "medido" && (
            <p className="mt-3 text-xs text-cinza">
              A conta já usa o tempo medido dos seus orçamentos. Isto fica de
              reserva.
            </p>
          )}
        </Cartao>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Cartao
          titulo="Quantos fecham"
          nota="Vale até haver 6 pedidos com desfecho registrados — daí o app mede sozinho."
        >
          <Numero
            nome="conversaoEstimada"
            rotulo="Conversão estimada"
            sufixo="%"
            valor={paraCampo(premissas.conversaoEstimada)}
          />
          <p className="mt-2 max-w-prose text-xs text-cinza">
            De cada 10 orçamentos que você entrega, quantos viram obra? Se são
            3, escreva <b>30</b>.
          </p>
        </Cartao>

        <Cartao
          titulo="Peso de cada porte"
          nota="Peso 1 é a carga cheia. Baixar o da obra pequena a torna vendável, mas alguém precisa carregar a diferença."
        >
          <div className="flex flex-wrap gap-5">
            <Numero
              nome="cargaP"
              rotulo="Obra P"
              valor={String(premissas.multiplicador.P)}
              estreito
            />
            <Numero
              nome="cargaM"
              rotulo="Obra M"
              valor={String(premissas.multiplicador.M)}
              estreito
            />
            <Numero
              nome="cargaG"
              rotulo="Obra G"
              valor={String(premissas.multiplicador.G)}
              estreito
            />
          </div>
          <p className="mt-3 max-w-prose text-xs text-cinza">
            A <b>Cobertura</b>, lá em cima, é quem avisa quando ninguém está
            carregando a diferença.
          </p>
        </Cartao>
      </div>

      <Cartao
        titulo="Ajuste do quadro"
        nota="Depois de quantos dias sem andar um pedido acende no quadro."
      >
        <Numero
          nome="diasParaParado"
          rotulo="Dias para sinalizar parado"
          sufixo="dias"
          valor={String(premissas.diasParaParado)}
          estreito
        />
      </Cartao>

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

/** Bloco de formulário: título, uma linha de contexto, e o conteúdo. */
function Cartao({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-nevoa bg-white px-5 py-5">
      <p className="rotulo">{titulo}</p>
      {/* `max-w-prose`: linha de texto de 1300px ninguém lê até o fim. */}
      {nota && <p className="mt-1.5 max-w-prose text-sm text-fumaca">{nota}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * Campo numérico com largura de número.
 *
 * Rótulo à esquerda, valor à direita, unidade colada nele — como linha de
 * extrato. Um `input` de 1300px para digitar "60" é o que fazia esta tela
 * parecer quebrada.
 */
function Numero({
  nome,
  rotulo,
  prefixo,
  sufixo,
  valor,
  aoMudar,
  estreito,
}: {
  nome: string;
  rotulo: string;
  prefixo?: string;
  sufixo?: string;
  valor: string;
  /** Quando passado, o campo é controlado — é o que deixa a calculadora
   *  escrever nele. Sem isso, `defaultValue` e o botão brigariam. */
  aoMudar?: (v: string) => void;
  /** Rótulo em cima, para valores de um ou dois dígitos lado a lado. */
  estreito?: boolean;
}) {
  return (
    <label
      className={
        estreito
          ? "flex flex-col gap-1.5"
          : "flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5"
      }
    >
      <span className="rotulo-campo">{rotulo}</span>
      <span className="flex items-center gap-1.5">
        {prefixo && <span className="text-sm text-cinza">{prefixo}</span>}
        <input
          name={nome}
          inputMode="decimal"
          {...(aoMudar
            ? { value: valor, onChange: (e) => aoMudar(e.target.value) }
            : { defaultValue: valor })}
          placeholder="0"
          className={`campo text-right tabular-nums ${estreito ? "w-20" : "w-28"}`}
        />
        {sufixo && (
          <span className="font-mono text-[0.65rem] whitespace-nowrap text-cinza">
            {sufixo}
          </span>
        )}
      </span>
    </label>
  );
}
