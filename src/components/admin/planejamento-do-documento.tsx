"use client";

import { useActionState, useEffect, useState } from "react";
import { Dialogo } from "@/components/comum/dialogo";
import { Dica } from "@/components/comum/dica";
import { Girando } from "@/components/comum/esqueleto";
import { ItemDeMenu, Menu } from "@/components/comum/menu";
import {
  puxarModulosDosGrupos,
  removerModulo,
  removerSemana,
  salvarModulo,
  salvarSemana,
} from "@/lib/orcamento/acoes-planejamento";
import { moeda, paraCampo } from "@/lib/orcamento/formato";
import type { Resultado } from "@/lib/admin/tipos";
import type {
  ModuloDoOrcamento,
  OrcamentoCompleto,
  SemanaDoCronograma,
} from "@/lib/orcamento/dados";

/**
 * O planejamento que vai no documento: as macroetapas (seção 2 da proposta
 * canônica) e o cronograma semana a semana (seção 4).
 *
 * **As duas seções são opcionais, e essa é a regra do produto.** Nem toda obra
 * tem cronograma físico-financeiro; muitas nem têm valor por macroetapa. O que
 * o Reginato não informar simplesmente não aparece para o cliente — melhor um
 * documento mais curto que uma tabela com colunas vazias, que passa a
 * impressão de proposta malfeita.
 *
 * Ver `ESTRUTURA-DA-PROPOSTA.md`.
 */

export function PlanejamentoDoDocumento({
  orcamento,
}: {
  orcamento: OrcamentoCompleto;
}) {
  // `undefined` é diálogo fechado; `null` é diálogo aberto para incluir.
  const [moduloEmEdicao, setModuloEmEdicao] = useState<
    ModuloDoOrcamento | null | undefined
  >(undefined);
  const [semanaEmEdicao, setSemanaEmEdicao] = useState<
    SemanaDoCronograma | null | undefined
  >(undefined);
  const [puxando, setPuxando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const { modulos, cronograma } = orcamento;
  const vazio = modulos.length === 0 && cronograma.length === 0;

  async function puxar() {
    setPuxando(true);
    setErro(null);
    const r = await puxarModulosDosGrupos(orcamento.id);
    if (!r.ok) setErro(r.erro ?? "Não deu para puxar da planilha.");
    setPuxando(false);
  }

  return (
    <section className="cartao mt-6 px-5 py-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="rotulo">Planejamento</p>
          {!vazio && (
            <span className="selo selo-neutro">
              {modulos.length}{" "}
              {modulos.length === 1 ? "macroetapa" : "macroetapas"} ·{" "}
              {cronograma.length}{" "}
              {cronograma.length === 1 ? "semana" : "semanas"}
            </span>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {modulos.length === 0 && orcamento.itens.length > 0 && (
            <Dica texto="Traz os grupos da planilha como macroetapas, já com o valor e o percentual de cada um. O prazo fica em branco para você preencher.">
              <button
                type="button"
                onClick={puxar}
                disabled={puxando}
                className={`btn btn-compacto ${
                  puxando ? "btn-carregando" : "btn-secundario"
                }`}
              >
                {puxando && <Girando />}
                {puxando ? "Puxando…" : "Puxar da planilha"}
              </button>
            </Dica>
          )}

          <Menu>
            <ItemDeMenu
              aoClicar={() => setModuloEmEdicao(null)}
              nota="macroetapa e prazo previsto"
            >
              Incluir macroetapa
            </ItemDeMenu>
            <ItemDeMenu
              aoClicar={() => setSemanaEmEdicao(null)}
              nota="metas físicas e financeiras da semana"
            >
              Incluir semana
            </ItemDeMenu>
          </Menu>
        </div>
      </div>

      {erro && <p className="aviso aviso-erro mb-4 text-sm">{erro}</p>}

      {vazio ? (
        <div className="py-6 text-center">
          <p className="text-sm leading-relaxed text-cinza">
            Sem planejamento, o documento vai direto da apresentação para a
            planilha — que é o certo quando a obra não tem cronograma fechado.
            Preencha só o que o cliente combinou.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {modulos.length > 0 && (
            <ListaDeModulos
              orcamentoId={orcamento.id}
              modulos={modulos}
              aoEditar={setModuloEmEdicao}
            />
          )}
          {cronograma.length > 0 && (
            <ListaDeSemanas
              orcamentoId={orcamento.id}
              semanas={cronograma}
              aoEditar={setSemanaEmEdicao}
            />
          )}
        </div>
      )}

      <Dialogo
        aberto={moduloEmEdicao !== undefined}
        aoFechar={() => setModuloEmEdicao(undefined)}
        titulo={moduloEmEdicao ? "Editar macroetapa" : "Incluir macroetapa"}
        descricao="Aparece no resumo por módulo, antes da planilha. Valor e percentual são opcionais."
        estreito
      >
        {moduloEmEdicao !== undefined && (
          <FormularioDeModulo
            key={moduloEmEdicao?.id ?? "novo-modulo"}
            orcamentoId={orcamento.id}
            modulo={moduloEmEdicao}
            aoFechar={() => setModuloEmEdicao(undefined)}
          />
        )}
      </Dialogo>

      <Dialogo
        aberto={semanaEmEdicao !== undefined}
        aoFechar={() => setSemanaEmEdicao(undefined)}
        titulo={semanaEmEdicao ? "Editar semana" : "Incluir semana"}
        descricao="Uma linha do cronograma executivo. Só o número da semana é obrigatório."
        estreito
      >
        {semanaEmEdicao !== undefined && (
          <FormularioDeSemana
            key={semanaEmEdicao?.id ?? "nova-semana"}
            orcamentoId={orcamento.id}
            semana={semanaEmEdicao}
            proxima={
              cronograma.reduce((m, c) => Math.max(m, c.semana), 0) + 1
            }
            aoFechar={() => setSemanaEmEdicao(undefined)}
          />
        )}
      </Dialogo>
    </section>
  );
}

function ListaDeModulos({
  orcamentoId,
  modulos,
  aoEditar,
}: {
  orcamentoId: string;
  modulos: ModuloDoOrcamento[];
  aoEditar: (m: ModuloDoOrcamento) => void;
}) {
  return (
    <div>
      <p className="rotulo mb-2">
        <Dica texto="Seção 2 do documento: as macroetapas com o prazo previsto de cada uma.">
          Resumo por módulo
        </Dica>
      </p>
      <ul className="flex flex-col gap-2">
        {modulos.map((m) => (
          <li
            key={m.id}
            className="flex items-start gap-3 rounded-sm border border-nevoa px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-tinta">{m.nome}</p>
              <p className="mt-0.5 font-mono text-[0.65rem] tracking-wider text-cinza uppercase">
                {[
                  m.prazo ?? "prazo em branco",
                  m.valor !== null ? moeda(m.valor) : null,
                  m.percentual !== null ? `${m.percentual}%` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <BotaoLocal
                rotulo="Editar"
                aoClicar={() => aoEditar(m)}
                caminho="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM14 6l4 4"
              />
              <BotaoDeRemocao remover={() => removerModulo(orcamentoId, m.id)} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ListaDeSemanas({
  orcamentoId,
  semanas,
  aoEditar,
}: {
  orcamentoId: string;
  semanas: SemanaDoCronograma[];
  aoEditar: (s: SemanaDoCronograma) => void;
}) {
  return (
    <div className="border-t border-cinza-100 pt-4">
      <p className="rotulo mb-2">
        <Dica texto="Seção 4 do documento: o cronograma executivo, semana a semana, com metas físicas e financeiras.">
          Cronograma executivo
        </Dica>
      </p>
      <ul className="flex flex-col gap-2">
        {semanas.map((s) => (
          <li
            key={s.id}
            className="flex items-start gap-3 rounded-sm border border-nevoa px-4 py-3"
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-papel-fundo font-mono text-xs font-semibold text-tinta">
              {s.semana}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-tinta">
                {s.titulo ?? `Semana ${s.semana}`}
                {s.critico && (
                  <span className="ml-2 font-mono text-[0.55rem] tracking-widest text-atencao-forte uppercase">
                    caminho crítico
                  </span>
                )}
              </p>
              {s.fisico && (
                <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-line text-fumaca">
                  {s.fisico}
                </p>
              )}
              {(s.marco || s.financeiro !== null) && (
                <p className="mt-1 font-mono text-[0.65rem] tracking-wider text-cinza uppercase">
                  {[s.marco, s.financeiro !== null ? moeda(s.financeiro) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <BotaoLocal
                rotulo="Editar"
                aoClicar={() => aoEditar(s)}
                caminho="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM14 6l4 4"
              />
              <BotaoDeRemocao remover={() => removerSemana(orcamentoId, s.id)} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BotaoLocal({
  rotulo,
  aoClicar,
  caminho,
}: {
  rotulo: string;
  aoClicar: () => void;
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
      <Traco caminho={caminho} />
    </button>
  );
}

/**
 * Remover chama a ação direto, sem `<form>`.
 *
 * As ações daqui recebem argumentos nomeados em vez de `FormData` — são duas
 * strings, e passar por campo escondido só para caber num formulário deixaria
 * o id do registro escrito no HTML sem ganho nenhum.
 */
function BotaoDeRemocao({ remover }: { remover: () => Promise<Resultado> }) {
  const [pendente, setPendente] = useState(false);

  return (
    <button
      type="button"
      disabled={pendente}
      aria-label="Remover"
      title="Remover"
      onClick={async () => {
        setPendente(true);
        await remover();
        setPendente(false);
      }}
      className="flex h-7 w-7 items-center justify-center rounded-sm text-cinza transition hover:bg-papel-fundo hover:text-tinta"
    >
      {pendente ? (
        <span className="girando" aria-hidden />
      ) : (
        <Traco caminho="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" />
      )}
    </button>
  );
}

function Traco({ caminho }: { caminho: string }) {
  return (
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
  );
}

function FormularioDeModulo({
  orcamentoId,
  modulo,
  aoFechar,
}: {
  orcamentoId: string;
  modulo: ModuloDoOrcamento | null;
  aoFechar: () => void;
}) {
  const [estado, acao, pendente] = useActionState<Resultado | null, FormData>(
    salvarModulo,
    null,
  );

  useEffect(() => {
    if (estado?.ok) aoFechar();
  }, [estado, aoFechar]);

  return (
    <form action={acao} className="dialogo-forma">
      <div className="dialogo-corpo flex flex-col gap-4">
        <input type="hidden" name="orcamentoId" value={orcamentoId} />
        {modulo && <input type="hidden" name="id" value={modulo.id} />}

        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Macroetapa *</span>
          <input
            name="nome"
            defaultValue={modulo?.nome ?? ""}
            placeholder="Demolições e retiradas"
            required
            autoFocus
            className="campo"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Prazo previsto</span>
          <input
            name="prazo"
            defaultValue={modulo?.prazo ?? ""}
            placeholder="2 semanas"
            className="campo"
          />
          <span className="ajuda-campo">
            Como você fala: 2 semanas, 10 dias úteis, junto com a alvenaria.
          </span>
        </label>

        <div className="flex flex-wrap gap-4">
          <label className="flex min-w-32 flex-1 flex-col gap-1.5">
            <span className="rotulo-campo">Valor</span>
            <input
              name="valor"
              inputMode="decimal"
              defaultValue={modulo ? paraCampo(modulo.valor) : ""}
              placeholder="8.500,00"
              className="campo text-right tabular-nums"
            />
          </label>
          <label className="flex min-w-32 flex-1 flex-col gap-1.5">
            <span className="rotulo-campo">% do total</span>
            <input
              name="percentual"
              inputMode="decimal"
              defaultValue={modulo ? paraCampo(modulo.percentual) : ""}
              placeholder="18"
              className="campo text-right tabular-nums"
            />
          </label>
        </div>
        <span className="ajuda-campo -mt-2">
          Os dois são opcionais. Em branco, a tabela sai só com macroetapa e
          prazo — que é o normal quando o preço é fechado.
        </span>

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
          {pendente ? "Salvando…" : modulo ? "Salvar" : "Incluir"}
        </button>
      </div>
    </form>
  );
}

function FormularioDeSemana({
  orcamentoId,
  semana,
  proxima,
  aoFechar,
}: {
  orcamentoId: string;
  semana: SemanaDoCronograma | null;
  proxima: number;
  aoFechar: () => void;
}) {
  const [estado, acao, pendente] = useActionState<Resultado | null, FormData>(
    salvarSemana,
    null,
  );

  useEffect(() => {
    if (estado?.ok) aoFechar();
  }, [estado, aoFechar]);

  return (
    <form action={acao} className="dialogo-forma">
      <div className="dialogo-corpo flex flex-col gap-4">
        <input type="hidden" name="orcamentoId" value={orcamentoId} />
        {semana && <input type="hidden" name="id" value={semana.id} />}

        <div className="flex flex-wrap gap-4">
          <label className="flex w-24 flex-col gap-1.5">
            <span className="rotulo-campo">Semana *</span>
            <input
              name="semana"
              inputMode="numeric"
              defaultValue={semana?.semana ?? proxima}
              required
              autoFocus
              className="campo text-right tabular-nums"
            />
          </label>
          <label className="flex min-w-48 flex-1 flex-col gap-1.5">
            <span className="rotulo-campo">Título</span>
            <input
              name="titulo"
              defaultValue={semana?.titulo ?? ""}
              placeholder="Demolição e infraestrutura"
              className="campo"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Metas físicas</span>
          <textarea
            name="fisico"
            defaultValue={semana?.fisico ?? ""}
            rows={3}
            placeholder={"Demolição do piso do banheiro\nRemoção da bancada"}
            className="campo"
          />
          <span className="ajuda-campo">
            Uma por linha. É o que o cliente vê acontecendo na obra naquela
            semana.
          </span>
        </label>

        <div className="flex flex-wrap gap-4">
          <label className="flex min-w-40 flex-1 flex-col gap-1.5">
            <span className="rotulo-campo">Marco financeiro</span>
            <input
              name="marco"
              defaultValue={semana?.marco ?? ""}
              placeholder="1ª medição"
              className="campo"
            />
          </label>
          <label className="flex min-w-32 flex-1 flex-col gap-1.5">
            <span className="rotulo-campo">Valor</span>
            <input
              name="financeiro"
              inputMode="decimal"
              defaultValue={semana ? paraCampo(semana.financeiro) : ""}
              placeholder="12.000,00"
              className="campo text-right tabular-nums"
            />
          </label>
        </div>

        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            name="critico"
            defaultChecked={semana?.critico ?? false}
            className="mt-0.5"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm text-tinta">Caminho crítico</span>
            <span className="ajuda-campo">
              Atraso nesta semana empurra a entrega inteira. Sai marcada no
              documento.
            </span>
          </span>
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
          {pendente ? "Salvando…" : semana ? "Salvar" : "Incluir"}
        </button>
      </div>
    </form>
  );
}
