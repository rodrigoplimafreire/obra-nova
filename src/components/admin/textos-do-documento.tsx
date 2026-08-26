"use client";

import { useActionState, useEffect, useState } from "react";
import { Dialogo } from "@/components/comum/dialogo";
import { Dica } from "@/components/comum/dica";
import { Girando } from "@/components/comum/esqueleto";
import { ItemDeMenu, Menu } from "@/components/comum/menu";
import {
  escreverTextosComIA,
  moverSecao,
  removerSecao,
  salvarSecao,
  salvarTextos,
} from "@/lib/orcamento/acoes-textos";
import type { Resultado } from "@/lib/admin/tipos";
import type {
  OrcamentoCompleto,
  SecaoDoOrcamento,
  TipoDeSecao,
} from "@/lib/orcamento/dados";

/**
 * Os textos que envolvem a tabela no documento do cliente.
 *
 * Toda proposta que a RD monta à mão tem isto: abre apresentando o serviço,
 * explica o que vem antes dos números, fecha dizendo o que está incluso, lista
 * observação técnica e as etapas da obra. Sem esses textos o documento é uma
 * planilha exportada; com eles é uma proposta escrita para uma pessoa.
 *
 * Tudo é opcional. O documento tem frase genérica para cada campo em branco, e
 * publicar nunca fica bloqueado por falta de texto — diferente do preço, que
 * bloqueia. Texto ausente é documento mais seco; preço ausente é documento
 * errado.
 */

const RASGO: Record<TipoDeSecao, { titulo: string; ajuda: string; vazio: string }> =
  {
    projeto: {
      titulo: "O projeto",
      ajuda: "Como o serviço foi pensado, por frente de trabalho. Aparece antes da tabela.",
      vazio: "Explique a abordagem antes de mostrar os números.",
    },
    observacao: {
      titulo: "Observações técnicas",
      ajuda: "O que o cliente precisa saber antes de aprovar. Aparece depois da tabela.",
      vazio: "O que está incluso, o que não está, o que exige cuidado.",
    },
    etapa: {
      titulo: "Do aceite à entrega",
      ajuda: "Os passos do serviço, na ordem. Aparece depois das observações.",
      vazio: "Do aceite à vistoria final, passo a passo.",
    },
  };

export function TextosDoDocumento({
  orcamento,
}: {
  orcamento: OrcamentoCompleto;
}) {
  const [editandoTextos, setEditandoTextos] = useState(false);
  const [secaoEmEdicao, setSecaoEmEdicao] = useState<{
    tipo: TipoDeSecao;
    secao: SecaoDoOrcamento | null;
  } | null>(null);
  const [escrevendo, setEscrevendo] = useState(false);
  const [erroDaIA, setErroDaIA] = useState<string | null>(null);

  const paragrafos = [
    orcamento.apresentacao,
    orcamento.introCustos,
    orcamento.notaCustos,
    orcamento.introAceite,
  ];
  const escritos = paragrafos.filter(Boolean).length;
  const vazio = escritos === 0 && orcamento.secoes.length === 0;

  async function escrever() {
    setEscrevendo(true);
    setErroDaIA(null);
    const r = await escreverTextosComIA(orcamento.id);
    if (!r.ok) setErroDaIA(r.erro);
    setEscrevendo(false);
  }

  return (
    <section className="cartao mt-6 px-5 py-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="rotulo">Textos do documento</p>
          {!vazio && (
            <span className="selo selo-neutro">
              {escritos}/4 · {orcamento.secoes.length}{" "}
              {orcamento.secoes.length === 1 ? "bloco" : "blocos"}
            </span>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Dica texto="A IA lê a tabela e o que você falou, e escreve um rascunho de cada texto. Ela não inventa medida, prazo nem material que não estejam ali.">
            <button
              type="button"
              onClick={escrever}
              disabled={escrevendo || orcamento.itens.length === 0}
              className={`btn btn-compacto ${
                escrevendo
                  ? "btn-carregando"
                  : vazio
                    ? "btn-primario"
                    : "btn-secundario"
              }`}
            >
              {escrevendo && <Girando />}
              {escrevendo ? "Escrevendo…" : "Escrever com IA"}
            </button>
          </Dica>

          <Menu>
            <ItemDeMenu
              aoClicar={() => setEditandoTextos(true)}
              nota="abertura, antes e depois da tabela, aceite"
            >
              Editar os parágrafos
            </ItemDeMenu>
            {(Object.keys(RASGO) as TipoDeSecao[]).map((tipo) => (
              <ItemDeMenu
                key={tipo}
                aoClicar={() => setSecaoEmEdicao({ tipo, secao: null })}
                nota={RASGO[tipo].ajuda}
              >
                Incluir em “{RASGO[tipo].titulo}”
              </ItemDeMenu>
            ))}
          </Menu>
        </div>
      </div>

      {erroDaIA && <p className="aviso aviso-erro mb-4 text-sm">{erroDaIA}</p>}

      {vazio ? (
        <div className="py-6 text-center">
          <p className="text-sm leading-relaxed text-cinza">
            {orcamento.itens.length === 0
              ? "Lance os itens primeiro. Os textos são escritos a partir da tabela."
              : "Sem textos, o documento é só a tabela. Deixe a IA escrever um rascunho a partir dos itens e ajuste o que quiser."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <Paragrafo
            rotulo="Abertura"
            valor={orcamento.apresentacao}
            onde="no topo, abaixo do título"
          />
          <Paragrafo
            rotulo="Antes da tabela"
            valor={orcamento.introCustos}
            onde="prepara a leitura dos números"
          />
          <Paragrafo
            rotulo="Depois do total"
            valor={orcamento.notaCustos}
            onde="o que o valor inclui"
          />
          <Paragrafo
            rotulo="Antes do aceite"
            valor={orcamento.introAceite}
            onde="o que acontece ao aprovar"
          />

          {(Object.keys(RASGO) as TipoDeSecao[]).map((tipo) => {
            const blocos = orcamento.secoes.filter((s) => s.tipo === tipo);
            if (blocos.length === 0) return null;
            return (
              <ListaDeBlocos
                key={tipo}
                tipo={tipo}
                orcamentoId={orcamento.id}
                blocos={blocos}
                aoEditar={(secao) => setSecaoEmEdicao({ tipo, secao })}
              />
            );
          })}
        </div>
      )}

      <Dialogo
        aberto={editandoTextos}
        aoFechar={() => setEditandoTextos(false)}
        titulo="Textos do documento"
        descricao="Deixe em branco o que não quiser. O documento tem uma frase padrão para cada campo vazio."
      >
        {editandoTextos && (
          <FormularioDeTextos
            orcamento={orcamento}
            aoFechar={() => setEditandoTextos(false)}
          />
        )}
      </Dialogo>

      <Dialogo
        aberto={secaoEmEdicao !== null}
        aoFechar={() => setSecaoEmEdicao(null)}
        titulo={
          secaoEmEdicao?.secao
            ? "Editar bloco"
            : `Incluir em “${secaoEmEdicao ? RASGO[secaoEmEdicao.tipo].titulo : ""}”`
        }
        descricao={secaoEmEdicao ? RASGO[secaoEmEdicao.tipo].ajuda : undefined}
        estreito
      >
        {secaoEmEdicao && (
          <FormularioDeSecao
            key={secaoEmEdicao.secao?.id ?? `novo-${secaoEmEdicao.tipo}`}
            orcamentoId={orcamento.id}
            tipo={secaoEmEdicao.tipo}
            secao={secaoEmEdicao.secao}
            aoFechar={() => setSecaoEmEdicao(null)}
          />
        )}
      </Dialogo>
    </section>
  );
}

function Paragrafo({
  rotulo,
  valor,
  onde,
}: {
  rotulo: string;
  valor: string | null;
  onde: string;
}) {
  return (
    <div className="min-w-0">
      <p className="rotulo">
        <Dica texto={`Onde aparece: ${onde}.`}>{rotulo}</Dica>
      </p>
      <p
        className={`mt-1 text-sm leading-relaxed ${
          valor ? "text-tinta" : "text-cinza-400 italic"
        }`}
      >
        {valor ?? "em branco — o documento usa a frase padrão"}
      </p>
    </div>
  );
}

function ListaDeBlocos({
  tipo,
  orcamentoId,
  blocos,
  aoEditar,
}: {
  tipo: TipoDeSecao;
  orcamentoId: string;
  blocos: SecaoDoOrcamento[];
  aoEditar: (secao: SecaoDoOrcamento) => void;
}) {
  return (
    <div className="border-t border-cinza-100 pt-4">
      <p className="rotulo mb-2">
        <Dica texto={RASGO[tipo].ajuda}>{RASGO[tipo].titulo}</Dica>
      </p>
      <ul className="flex flex-col gap-2">
        {blocos.map((s, i) => (
          <li
            key={s.id}
            className="flex items-start gap-3 rounded-sm border border-nevoa px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-tinta">{s.titulo}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-fumaca">
                {s.texto}
              </p>
              {s.origem === "ia" && (
                <p className="mt-1 font-mono text-[0.55rem] tracking-widest text-cinza uppercase">
                  escrito pela IA
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <BotaoLocal
                rotulo="Editar bloco"
                aoClicar={() => aoEditar(s)}
                caminho="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM14 6l4 4"
              />
              {i > 0 && (
                <BotaoDeAcao
                  acao={moverSecao}
                  campos={{ orcamentoId, id: s.id, direcao: "cima" }}
                  rotulo="Subir"
                  caminho="M12 19V5M5 12l7-7 7 7"
                />
              )}
              {i < blocos.length - 1 && (
                <BotaoDeAcao
                  acao={moverSecao}
                  campos={{ orcamentoId, id: s.id, direcao: "baixo" }}
                  rotulo="Descer"
                  caminho="M12 5v14M19 12l-7 7-7-7"
                />
              )}
              <BotaoDeAcao
                acao={removerSecao}
                campos={{ orcamentoId, id: s.id }}
                rotulo="Remover"
                caminho="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13"
              />
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

function BotaoDeAcao({
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
        {pendente ? <span className="girando" aria-hidden /> : <Traco caminho={caminho} />}
      </button>
    </form>
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

function FormularioDeTextos({
  orcamento,
  aoFechar,
}: {
  orcamento: OrcamentoCompleto;
  aoFechar: () => void;
}) {
  const [estado, acao, pendente] = useActionState<Resultado | null, FormData>(
    salvarTextos,
    null,
  );

  useEffect(() => {
    if (estado?.ok) aoFechar();
  }, [estado, aoFechar]);

  return (
    <form action={acao} className="dialogo-forma">
      <div className="dialogo-corpo flex flex-col gap-4">
        <input type="hidden" name="id" value={orcamento.id} />

        <CampoDeTexto
          rotulo="Abertura"
          nome="apresentacao"
          valor={orcamento.apresentacao}
          ajuda="No topo, logo abaixo do título. Diz o que vai ser feito, em duas ou três frases."
          exemplo="Reforma da cobertura e do forro da casa em Messejana, com troca completa das telhas e instalação de forro de PVC."
        />
        <CampoDeTexto
          rotulo="Antes da tabela"
          nome="introCustos"
          valor={orcamento.introCustos}
          ajuda="Prepara a leitura dos números."
          exemplo="Os itens estão separados por frente de trabalho. Cada valor já inclui material e mão de obra."
        />
        <CampoDeTexto
          rotulo="Depois do total"
          nome="notaCustos"
          valor={orcamento.notaCustos}
          ajuda="O que o valor inclui e o que não inclui."
          exemplo="Valores em reais, material e mão de obra inclusos. A retirada do entulho está contemplada."
        />
        <CampoDeTexto
          rotulo="Antes do aceite"
          nome="introAceite"
          valor={orcamento.introAceite}
          ajuda="O que acontece quando ele aprova."
          exemplo="Ao aprovar, combinamos a data de início pelo WhatsApp e o serviço entra na agenda."
        />

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
          {pendente ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}

function CampoDeTexto({
  rotulo,
  nome,
  valor,
  ajuda,
  exemplo,
}: {
  rotulo: string;
  nome: string;
  valor: string | null;
  ajuda: string;
  exemplo: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="rotulo-campo">{rotulo}</span>
      <textarea
        name={nome}
        defaultValue={valor ?? ""}
        rows={3}
        placeholder={exemplo}
        className="campo"
      />
      <span className="ajuda-campo">{ajuda}</span>
    </label>
  );
}

function FormularioDeSecao({
  orcamentoId,
  tipo,
  secao,
  aoFechar,
}: {
  orcamentoId: string;
  tipo: TipoDeSecao;
  secao: SecaoDoOrcamento | null;
  aoFechar: () => void;
}) {
  const [estado, acao, pendente] = useActionState<Resultado | null, FormData>(
    salvarSecao,
    null,
  );

  useEffect(() => {
    if (estado?.ok) aoFechar();
  }, [estado, aoFechar]);

  return (
    <form action={acao} className="dialogo-forma">
      <div className="dialogo-corpo flex flex-col gap-4">
        <input type="hidden" name="orcamentoId" value={orcamentoId} />
        <input type="hidden" name="tipo" value={tipo} />
        {secao && <input type="hidden" name="id" value={secao.id} />}

        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Título *</span>
          <input
            name="titulo"
            defaultValue={secao?.titulo ?? ""}
            placeholder={
              tipo === "etapa" ? "Medição no local" : "Estrutura em drywall"
            }
            required
            autoFocus
            className="campo"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Texto *</span>
          <textarea
            name="texto"
            defaultValue={secao?.texto ?? ""}
            rows={4}
            required
            placeholder="Uma a três frases."
            className="campo"
          />
          <span className="ajuda-campo">{RASGO[tipo].vazio}</span>
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
          {pendente ? "Salvando…" : secao ? "Salvar" : "Incluir"}
        </button>
      </div>
    </form>
  );
}
