"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Indicador } from "./cabecalho";
import { Dialogo } from "@/components/comum/dialogo";
import { Dica } from "@/components/comum/dica";
import { Girando } from "@/components/comum/esqueleto";
import { ItemDeMenu, Menu, SeparadorDeMenu } from "@/components/comum/menu";
import { FalarOrcamento } from "./falar-orcamento";
import { UsarTranscricao } from "./usar-transcricao";
import { ImportarItens } from "./importar-itens";
import {
  adicionarItem,
  atualizarItem,
  moverItem,
  removerItem,
} from "@/lib/orcamento/acoes-itens";
import { buscarComposicoes } from "@/lib/orcamento/acoes-precos";
import { lerNumero, moeda, numero } from "@/lib/orcamento/formato";
import {
  CampoDeQuantidade,
  formatarMoeda,
} from "@/components/comum/campos";
import type { Resultado } from "@/lib/admin/tipos";
import type { ItemDoOrcamento } from "@/lib/orcamento/dados";
import type { LinhaDeBusca } from "@/lib/database.types";

/**
 * A tabela de custos, editável linha a linha.
 *
 * O desenho copia a `.cost-table` das propostas da RD porque o Reginato usa o
 * Obra Prima e pediu que a proposta se parecesse com a planilha de obra dele.
 * Aqui ela ganha o que a proposta impressa não tem: a linha vira formulário no
 * clique, com busca na base de preços e duas colunas que nunca saem juntas do
 * editor — **custo** (o que a obra gasta) e **venda** (o que o cliente paga).
 * A margem entre as duas é decisão dele, não conta automática: o BDI só
 * sugere o ponto de partida.
 *
 * Item sem preço não fica discreto. Ele é a coisa mais visível da tela, porque
 * é o que impede o documento de ir para o cliente.
 */

export function TabelaDeCustos({
  orcamentoId,
  itens,
  removidos,
  total,
  valorFechado,
  bdiPadrao,
  custoTotal,
  margemValor,
  margemPercentual,
  semCusto,
}: {
  orcamentoId: string;
  itens: ItemDoOrcamento[];
  removidos: ItemDoOrcamento[];
  total: number;
  valorFechado: number | null;
  bdiPadrao: number;
  custoTotal: number;
  margemValor: number;
  margemPercentual: number | null;
  semCusto: number;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [adicionando, setAdicionando] = useState(false);
  const [falando, setFalando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [usandoTranscricao, setUsandoTranscricao] = useState(false);
  const [verRemovidos, setVerRemovidos] = useState(false);

  const semPreco = itens.filter((i) => i.valorUnitario === null).length;
  const itemizado = valorFechado === null;
  const emEdicao = itens.find((i) => i.id === editando) ?? null;

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="rotulo">Detalhamento de custos</h2>

        {/* Quatro maneiras de encher a tabela, e por isso duas à vista e as
            outras no menu: falar e incluir à mão são as de todo dia; usar uma
            transcrição e importar planilha acontecem quando existe material
            pronto. Somar um quarto botão em linha era o caminho fácil e
            devolveria a barra cheia de botão que já foi problema aqui. */}
        <div className="ml-auto hidden items-center gap-2 sm:flex">
          <Dica texto="Conte o serviço falando. A IA transcreve e quebra em linhas da tabela.">
            <button
              type="button"
              onClick={() => setFalando(true)}
              className="btn btn-primario"
            >
              <Microfone />
              Falar orçamento
            </button>
          </Dica>
          <button
            type="button"
            onClick={() => setAdicionando(true)}
            className="btn btn-secundario"
          >
            <IconeMais />
            Incluir item
          </button>
          <Menu>
            <ItemDeMenu
              icone={<IconeOnda />}
              aoClicar={() => setUsandoTranscricao(true)}
              nota="o áudio que o cliente mandou, já transcrito"
            >
              Usar uma transcrição
            </ItemDeMenu>
            <ItemDeMenu
              icone={<IconeImportar />}
              aoClicar={() => setImportando(true)}
              nota="planilha pronta; você diz qual coluna é qual"
            >
              Importar tabela
            </ItemDeMenu>
            {removidos.length > 0 && (
              <>
                <SeparadorDeMenu />
                <ItemDeMenu aoClicar={() => setVerRemovidos((v) => !v)}>
                  {verRemovidos
                    ? "Esconder removidos"
                    : `Removidos (${removidos.length})`}
                </ItemDeMenu>
              </>
            )}
          </Menu>
        </div>

        {/* No mobile os três em linha quebravam e empurravam a tabela para
            baixo. "Falar" continua à vista — é o caminho principal — com
            rótulo encurtado; o resto entra num menu de três pontos. */}
        <div className="ml-auto flex items-center gap-2 sm:hidden">
          <button
            type="button"
            onClick={() => setFalando(true)}
            className="btn btn-primario"
          >
            <Microfone />
            Falar
          </button>
          <Menu>
            <ItemDeMenu
              icone={<IconeOnda />}
              aoClicar={() => setUsandoTranscricao(true)}
            >
              Usar uma transcrição
            </ItemDeMenu>
            <ItemDeMenu
              icone={<IconeImportar />}
              aoClicar={() => setImportando(true)}
            >
              Importar tabela
            </ItemDeMenu>
            <ItemDeMenu icone={<IconeMais />} aoClicar={() => setAdicionando(true)}>
              Incluir item
            </ItemDeMenu>
            {removidos.length > 0 && (
              <>
                <SeparadorDeMenu />
                <ItemDeMenu aoClicar={() => setVerRemovidos((v) => !v)}>
                  {verRemovidos
                    ? "Esconder removidos"
                    : `Removidos (${removidos.length})`}
                </ItemDeMenu>
              </>
            )}
          </Menu>
        </div>
      </div>

      {semPreco > 0 && (
        <p className="mb-3 aviso aviso-erro text-sm leading-relaxed text-tinta">
          <strong>{semPreco}</strong>{" "}
          {semPreco === 1 ? "item está" : "itens estão"} sem preço. A IA não
          preenche valor que ninguém falou, então isso fica com você antes de
          enviar.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-nevoa bg-white">
        <table className="w-full min-w-[54rem] border-collapse">
          <thead>
            <tr className="border-b border-nevoa">
              <Th className="w-[32%]">Descrição</Th>
              <Th className="text-right">Qtd.</Th>
              <Th>Unid.</Th>
              <Th
                className="text-right"
                dica="O que a obra gasta. Vem da base de preços ou é digitado. Nunca sai no documento do cliente."
              >
                Custo
              </Th>
              <Th
                className="text-right"
                dica="O preço que o cliente paga. É este que vai para o documento."
              >
                Venda
              </Th>
              <Th className="text-right" dica="Quantidade × valor de venda.">
                Total
              </Th>
              <Th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {itens.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-cinza">
                  Nenhum item ainda. Grave o serviço, traga uma transcrição do
                  áudio que o cliente mandou, ou inclua na mão.
                </td>
              </tr>
            )}

            {itens.map((item, indice) => {
              const grupoNovo =
                item.grupo && item.grupo !== itens[indice - 1]?.grupo;

              return (
                <FragmentoDeLinha key={item.id}>
                  {grupoNovo && (
                    <tr className="bg-papel-fundo">
                      <td
                        colSpan={7}
                        className="px-4 py-2.5 text-sm font-bold text-tinta"
                      >
                        {item.grupo}
                      </td>
                    </tr>
                  )}

                  <LinhaLida
                    orcamentoId={orcamentoId}
                    item={item}
                    primeiro={indice === 0}
                    ultimo={indice === itens.length - 1}
                    aoEditar={() => setEditando(item.id)}
                  />
                </FragmentoDeLinha>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Custo, margem e o aviso de margem parcial. Não vai para o documento
          do cliente — vive só aqui, no editor. */}
      {itemizado && custoTotal > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Indicador rotulo="Custo total" valor={moeda(custoTotal)} />
          <Indicador
            rotulo="Margem"
            valor={moeda(margemValor)}
            detalhe={
              margemPercentual !== null
                ? `${margemPercentual.toFixed(1)}%`
                : undefined
            }
            destaque={margemValor < 0 ? "amarelo" : undefined}
          />
          {semCusto > 0 && (
            <Indicador
              rotulo="Sem custo"
              valor={semCusto}
              destaque="amarelo"
              detalhe="margem parcial"
            />
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg bg-tinta px-6 py-5">
        <p className="font-mono text-xs tracking-widest text-concreto uppercase">
          {valorFechado !== null ? "Valor fechado" : "Total geral"}
        </p>
        <p className="font-sans text-3xl font-extrabold -tracking-[0.03em] text-papel tabular-nums">
          {moeda(valorFechado ?? total)}
        </p>
      </div>

      {valorFechado !== null && (
        <p className="mt-2 font-mono text-[0.65rem] tracking-widest text-cinza uppercase">
          O valor fechado manda sobre a soma dos itens · soma: {moeda(total)}
        </p>
      )}

      {verRemovidos && removidos.length > 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-nevoa bg-white px-5 py-4">
          <p className="rotulo mb-3">Removidos</p>
          <ul className="flex flex-col gap-2">
            {removidos.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 text-sm text-cinza"
              >
                <span className="min-w-0 truncate line-through">
                  {item.descricao}
                </span>
                <BotaoDeAcao
                  acao={removerItem}
                  campos={{ orcamentoId, id: item.id, voltar: "1" }}
                  rotulo="Restaurar"
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Um diálogo só, montado fora da tabela. Antes o formulário era uma
          `<tr>` com `colSpan`, o que empurrava a tabela inteira para baixo a
          cada edição e obrigava o formulário a caber numa célula. */}
      <EditorDeItem
        orcamentoId={orcamentoId}
        item={emEdicao}
        aberto={adicionando || editando !== null}
        bdiPadrao={bdiPadrao}
        aoFechar={() => {
          setEditando(null);
          setAdicionando(false);
        }}
      />

      <FalarOrcamento
        orcamentoId={orcamentoId}
        aberto={falando}
        aoFechar={() => setFalando(false)}
      />

      <UsarTranscricao
        orcamentoId={orcamentoId}
        aberto={usandoTranscricao}
        aoFechar={() => setUsandoTranscricao(false)}
      />

      <ImportarItens
        orcamentoId={orcamentoId}
        aberto={importando}
        aoFechar={() => setImportando(false)}
      />
    </section>
  );
}

function Microfone() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function IconeImportar() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  );
}

/** Onda sonora — o mesmo símbolo do módulo de Transcrição na navegação. */
function IconeOnda() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4" />
    </svg>
  );
}

function IconeMais() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}


/** Um grupo e sua linha vêm como irmãos do `tbody`, não aninhados. */
function FragmentoDeLinha({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Th({
  children,
  className = "",
  dica,
}: {
  children?: React.ReactNode;
  className?: string;
  /** Colunas cujo nome sozinho não diz o que a coluna é. */
  dica?: string;
}) {
  return (
    <th
      className={`px-4 py-3 text-left font-mono text-[0.6rem] font-normal tracking-widest text-cinza uppercase ${className}`}
    >
      {dica ? <Dica texto={dica}>{children}</Dica> : children}
    </th>
  );
}

function LinhaLida({
  orcamentoId,
  item,
  primeiro,
  ultimo,
  aoEditar,
}: {
  orcamentoId: string;
  item: ItemDoOrcamento;
  primeiro: boolean;
  ultimo: boolean;
  aoEditar: () => void;
}) {
  const semPreco = item.valorUnitario === null;

  const margem =
    item.custoUnitario !== null && item.valorUnitario !== null
      ? item.valorUnitario - item.custoUnitario
      : null;

  return (
    <tr className="border-b border-nevoa/70 last:border-b-0">
      <td className="px-4 py-3 align-top">
        <button
          type="button"
          onClick={aoEditar}
          className="text-left text-sm leading-snug text-tinta underline decoration-transparent underline-offset-4 transition hover:decoration-current"
        >
          {item.descricao}
        </button>
        {item.observacao && (
          <p className="mt-1 text-xs leading-snug text-cinza">{item.observacao}</p>
        )}
        {item.origem === "ia" && !item.editadoEm && (
          <p className="mt-1 font-mono text-[0.55rem] tracking-widest text-cinza uppercase">
            escrito pela IA
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-right align-top font-mono text-xs text-fumaca tabular-nums">
        {numero(item.quantidade)}
      </td>
      <td className="px-4 py-3 align-top font-mono text-[0.65rem] tracking-wider text-cinza uppercase">
        {item.unidade ?? "—"}
      </td>
      <td className="px-4 py-3 text-right align-top font-mono text-xs text-cinza tabular-nums">
        {item.custoUnitario === null ? "—" : moeda(item.custoUnitario)}
      </td>
      <td
        className={`px-4 py-3 text-right align-top font-mono text-xs tabular-nums ${
          semPreco ? "text-tinta" : "text-fumaca"
        }`}
      >
        {semPreco ? "sem preço" : moeda(item.valorUnitario)}
        {margem !== null && (
          <span className="mt-0.5 block font-mono text-[0.6rem] text-cinza">
            margem {moeda(margem)}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right align-top text-sm font-bold text-tinta tabular-nums">
        {item.total === null ? "—" : moeda(item.total)}
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex items-center justify-end gap-1">
          {/* Editar é botão de verdade, com ícone e rótulo. Antes a única
              forma de abrir o editor era clicar na descrição — função que
              existia e ninguém encontrava, o que na prática é função que não
              existe. */}
          <BotaoIconeLocal
            aoClicar={aoEditar}
            rotulo="Editar item"
            caminho="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM14 6l4 4"
          />
          {!primeiro && (
            <BotaoIcone
              acao={moverItem}
              campos={{ orcamentoId, id: item.id, direcao: "cima" }}
              rotulo="Subir"
              caminho="M12 19V5M5 12l7-7 7 7"
            />
          )}
          {!ultimo && (
            <BotaoIcone
              acao={moverItem}
              campos={{ orcamentoId, id: item.id, direcao: "baixo" }}
              rotulo="Descer"
              caminho="M12 5v14M19 12l-7 7-7-7"
            />
          )}
          <BotaoIcone
            acao={removerItem}
            campos={{ orcamentoId, id: item.id }}
            rotulo="Remover"
            caminho="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13"
          />
        </div>
      </td>
    </tr>
  );
}

/** Botão de ícone que não chama Server Action — só muda estado local. */
function BotaoIconeLocal({
  aoClicar,
  rotulo,
  caminho,
}: {
  aoClicar: () => void;
  rotulo: string;
  caminho: string;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-label={rotulo}
      title={rotulo}
      className="flex h-7 w-7 items-center justify-center rounded-sm text-cinza transition hover:bg-papel-fundo hover:text-tinta"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="h-3.5 w-3.5 fill-none stroke-current"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={caminho} />
      </svg>
    </button>
  );
}

/**
 * O editor de item, em diálogo.
 *
 * `key` no componente interno, e não estado sincronizado por efeito: trocar de
 * item ou alternar entre incluir e editar remonta o formulário do zero, e os
 * campos voltam a nascer com o valor certo. Sem isso, abrir o item B depois do
 * A mostraria os números do A.
 */
function EditorDeItem({
  orcamentoId,
  item,
  aberto,
  bdiPadrao,
  aoFechar,
}: {
  orcamentoId: string;
  item: ItemDoOrcamento | null;
  aberto: boolean;
  bdiPadrao: number;
  aoFechar: () => void;
}) {
  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={item ? "Editar item" : "Incluir item"}
      descricao={
        item
          ? "O custo fica só aqui. O cliente vê o valor de venda."
          : "Busque na base de preços ou preencha à mão."
      }
    >
      {aberto && (
        <FormularioDeItem
          key={item?.id ?? "novo"}
          orcamentoId={orcamentoId}
          item={item}
          bdiPadrao={bdiPadrao}
          aoFechar={aoFechar}
        />
      )}
    </Dialogo>
  );
}

function FormularioDeItem({
  orcamentoId,
  item,
  bdiPadrao,
  aoFechar,
}: {
  orcamentoId: string;
  item: ItemDoOrcamento | null;
  bdiPadrao: number;
  aoFechar: () => void;
}) {
  const [estado, acao, pendente] = useActionState<Resultado | null, FormData>(
    item ? atualizarItem : adicionarItem,
    null,
  );
  const primeiroCampo = useRef<HTMLInputElement>(null);

  const [descricao, setDescricao] = useState(item?.descricao ?? "");
  const [unidade, setUnidade] = useState(item?.unidade ?? "");
  // Já formatados como dinheiro: o `lerNumero` do servidor lê "R$ 1.234,56"
  // sem problema, e ver o valor guardado no mesmo formato do que se digita
  // evita a dúvida de "isto são reais ou centavos?".
  const [custoUnitario, setCustoUnitario] = useState(
    item?.custoUnitario === null || item?.custoUnitario === undefined
      ? ""
      : moeda(item.custoUnitario),
  );
  const [valorUnitario, setValorUnitario] = useState(
    item?.valorUnitario === null || item?.valorUnitario === undefined
      ? ""
      : moeda(item.valorUnitario),
  );
  const [composicaoId, setComposicaoId] = useState(item?.composicaoId ?? "");

  const margem = useMemo(() => {
    const custo = lerNumero(custoUnitario);
    const venda = lerNumero(valorUnitario);
    if (custo === null || venda === null || custo <= 0) return null;
    return { valor: venda - custo, percentual: ((venda - custo) / custo) * 100 };
  }, [custoUnitario, valorUnitario]);

  function aoEscolherComposicao(linha: LinhaDeBusca) {
    setDescricao(linha.descricao);
    setUnidade(linha.unidade ?? "");
    setCustoUnitario(moeda(linha.custo_unitario));
    setComposicaoId(linha.id);
    // Só sugere o preço de venda quando o campo está vazio: escolher uma
    // composição nunca atropela um número que a pessoa já tinha digitado.
    if (!valorUnitario.trim()) {
      const sugestao =
        Math.round(linha.custo_unitario * (1 + bdiPadrao / 100) * 100) / 100;
      setValorUnitario(moeda(sugestao));
    }
  }

  useEffect(() => {
    if (estado?.ok) aoFechar();
  }, [estado, aoFechar]);

  useEffect(() => {
    primeiroCampo.current?.focus();
  }, []);

  return (
    <form action={acao} className="dialogo-forma">
      <div className="dialogo-corpo flex flex-col gap-4">
        <input type="hidden" name="orcamentoId" value={orcamentoId} />
        {item && <input type="hidden" name="id" value={item.id} />}
        <input type="hidden" name="composicaoId" value={composicaoId} />

        <BuscaDeComposicao
          bdiPadrao={bdiPadrao}
          aoEscolher={aoEscolherComposicao}
        />

        <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Grupo</span>
            <input
              name="grupo"
              defaultValue={item?.grupo ?? ""}
              placeholder="1. Serviços preliminares"
              className="campo"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Descrição *</span>
            <input
              ref={primeiroCampo}
              name="descricao"
              value={descricao}
              onChange={(e) => {
                setDescricao(e.target.value);
                setComposicaoId("");
              }}
              required
              className="campo"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Quantidade</span>
            <CampoDeQuantidade
              nome="quantidade"
              valorInicial={item?.quantidade}
              placeholder="0"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Unidade</span>
            <input
              name="unidade"
              value={unidade}
              onChange={(e) => setUnidade(e.target.value)}
              placeholder="m², un, vb"
              className="campo"
            />
          </label>
        </div>

        {/* As duas colunas que nunca saem juntas do editor: o que a obra
            gasta, e o que o cliente paga. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Custo unitário</span>
            <input
              name="custoUnitario"
              inputMode="decimal"
              value={custoUnitario}
              onChange={(e) => {
                setCustoUnitario(formatarMoeda(e.target.value));
                setComposicaoId("");
              }}
              placeholder="da base, ou digite"
              autoComplete="off"
              className="campo"
            />
            <span className="ajuda-campo">
              Nunca vai para o documento do cliente.
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Valor de venda</span>
            <input
              name="valorUnitario"
              inputMode="decimal"
              value={valorUnitario}
              onChange={(e) => setValorUnitario(formatarMoeda(e.target.value))}
              placeholder="em branco = sem preço"
              autoComplete="off"
              className="campo"
            />
            <span className="ajuda-campo">
              {margem
                ? `margem ${moeda(margem.valor)} · ${margem.percentual.toFixed(1)}%`
                : `sugestão com BDI de ${numero(bdiPadrao)}%: preencha o custo`}
            </span>
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Observação</span>
          <input
            name="observacao"
            defaultValue={item?.observacao ?? ""}
            placeholder="premissa, condição, o que está incluso"
            className="campo"
          />
        </label>

        {estado?.erro && <p className="aviso aviso-erro text-sm">{estado.erro}</p>}
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
          {pendente ? "Salvando…" : item ? "Salvar" : "Incluir"}
        </button>
      </div>
    </form>
  );
}

/**
 * Busca da base de preços, separada da descrição: escrever aqui não muda nada
 * até uma sugestão ser escolhida. Usa `word_similarity`, então "forro pvc"
 * acha "Forro de PVC branco, com acabamento em réguas" mesmo sem bater string
 * inteira. Seleção por `onMouseDown` — dispara antes do `blur` do campo,
 * senão o clique fecharia a lista antes de registrar.
 */
function BuscaDeComposicao({
  bdiPadrao,
  aoEscolher,
}: {
  bdiPadrao: number;
  aoEscolher: (linha: LinhaDeBusca) => void;
}) {
  const [consulta, setConsulta] = useState("");
  const [resultados, setResultados] = useState<LinhaDeBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  function digitar(valor: string) {
    setConsulta(valor);
    setAberto(true);
    if (temporizador.current) clearTimeout(temporizador.current);

    if (valor.trim().length < 3) {
      setResultados([]);
      return;
    }

    temporizador.current = setTimeout(async () => {
      setBuscando(true);
      const linhas = await buscarComposicoes(valor);
      setResultados(linhas);
      setBuscando(false);
    }, 300);
  }

  const mostrarLista = aberto && consulta.trim().length >= 3;

  return (
    <div className="relative">
      <label className="flex flex-col gap-1.5">
        <span className="rotulo-campo">Buscar na base de preços</span>
        <input
          value={consulta}
          onChange={(e) => digitar(e.target.value)}
          onFocus={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          placeholder="forro pvc, alvenaria, esquadria…"
          className="campo"
        />
      </label>

      {mostrarLista && (
        <div className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto cartao">
          {buscando && (
            <p className="px-4 py-3 text-sm text-cinza">Buscando…</p>
          )}
          {!buscando && resultados.length === 0 && (
            <p className="px-4 py-3 text-sm text-cinza">
              Nada encontrado nas bases ativas.
            </p>
          )}
          {resultados.map((r) => (
            <button
              key={r.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                aoEscolher(r);
                setConsulta("");
                setResultados([]);
                setAberto(false);
              }}
              className="flex w-full flex-col items-start gap-0.5 border-b border-cinza-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-papel-fundo"
            >
              <span className="text-sm text-tinta">{r.descricao}</span>
              <span className="font-mono text-[0.65rem] tracking-wider text-cinza uppercase">
                {r.base_nome}
                {r.codigo ? ` · ${r.codigo}` : ""} · {r.unidade ?? "—"} ·{" "}
                custo {moeda(r.custo_unitario)} → venda sugerida{" "}
                {moeda(
                  Math.round(r.custo_unitario * (1 + bdiPadrao / 100) * 100) /
                    100,
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Ação de uma linha só: um formulário com campos escondidos. Sem `onClick` que
 * chama a Server Action à mão, para o botão continuar funcionando enquanto o
 * JavaScript da página ainda não hidratou.
 */
function BotaoDeAcao({
  acao,
  campos,
  rotulo,
}: {
  acao: (anterior: Resultado | null, form: FormData) => Promise<Resultado>;
  campos: Record<string, string>;
  rotulo: string;
}) {
  const [, despachar, pendente] = useActionState<Resultado | null, FormData>(
    acao,
    null,
  );

  return (
    <form action={despachar}>
      {Object.entries(campos).map(([nome, valor]) => (
        <input key={nome} type="hidden" name={nome} value={valor} />
      ))}
      <button
        type="submit"
        disabled={pendente}
        className="acao-texto text-cinza disabled:opacity-40"
      >
        {pendente ? "Aguarde…" : rotulo}
      </button>
    </form>
  );
}

function BotaoIcone({
  acao,
  campos,
  rotulo,
  caminho,
}: {
  acao: (anterior: Resultado | null, form: FormData) => Promise<Resultado>;
  campos: Record<string, string>;
  rotulo: string;
  caminho: string;
}) {
  const [, despachar, pendente] = useActionState<Resultado | null, FormData>(
    acao,
    null,
  );

  return (
    <form action={despachar}>
      {Object.entries(campos).map(([nome, valor]) => (
        <input key={nome} type="hidden" name={nome} value={valor} />
      ))}
      <button
        type="submit"
        disabled={pendente}
        aria-label={rotulo}
        title={rotulo}
        className="flex h-7 w-7 items-center justify-center rounded-sm text-cinza transition hover:bg-papel-fundo hover:text-tinta"
      >
        {/* O círculo substitui o ícone: num botão só de ícone, `disabled`
            sozinho é indistinguível de "não funcionou". */}
        {pendente ? (
          <span className="girando" aria-hidden />
        ) : (
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className="h-3.5 w-3.5 fill-none stroke-current"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={caminho} />
          </svg>
        )}
      </button>
    </form>
  );
}
