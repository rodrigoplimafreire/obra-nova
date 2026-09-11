"use client";

import { useActionState, useEffect, useState } from "react";
import { Dialogo } from "@/components/comum/dialogo";
import { Girando } from "@/components/comum/esqueleto";
import { Cabecalho, Conteudo } from "./cabecalho";
import { AcoesDaLinha } from "./acoes-da-linha";
import {
  adicionarAmbiente,
  alternarConclusao,
  apagarVistoria,
  removerAmbiente,
  removerMedicao,
  salvarAmbiente,
  salvarDadosDaVistoria,
  salvarMedicao,
} from "@/lib/vistoria/acoes";
import {
  AMBIENTES,
  SERVICOS,
  UNIDADES,
  areaDe,
  type Ambiente,
  type Medicao,
  type VistoriaCompleta,
} from "@/lib/vistoria/constantes";
import { data as dataBR, numero, paraCampo } from "@/lib/orcamento/formato";
import type { Resultado } from "@/lib/admin/tipos";

/**
 * A tela da visita.
 *
 * **Desenhada para ser usada em pé, com uma mão, diante do cliente.** É o
 * requisito que manda no layout, e o PRD é explícito: se virar preenchimento
 * burocrático, o Reginato larga e volta para a prancheta.
 *
 * O que isso obriga:
 *
 * - **Toque, não digitação.** Ambiente e serviço entram por botão de uma
 *   palavra. Texto livre existe, mas é o caminho longo, não o padrão.
 * - **Um campo obrigatório por vez.** Ambiente pede só o nome; medição pede só
 *   o serviço. Medida, unidade e observação podem ficar para depois.
 * - **Salva ao confirmar cada bloco**, não no fim. Ver `acoes.ts`.
 * - **Nada de foto ainda** — é a fatia seguinte, e a decisão D4 do PRD
 *   (limite, formato, compressão) continua em aberto.
 */

export function TelaDaVistoria({ vistoria }: { vistoria: VistoriaCompleta }) {
  const [editandoDados, setEditandoDados] = useState(false);
  const [ambienteEmEdicao, setAmbienteEmEdicao] = useState<Ambiente | null>(
    null,
  );
  const [medicaoEmEdicao, setMedicaoEmEdicao] = useState<{
    ambienteId: string;
    medicao: Medicao | null;
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const medidas = vistoria.ambientes.reduce(
    (s, a) => s + a.medicoes.length,
    0,
  );

  async function concluir() {
    setErro(null);
    const r = await alternarConclusao(vistoria.id);
    if (!r.ok) setErro(r.erro ?? "Não consegui mudar o estado da visita.");
  }

  return (
    <>
      <Cabecalho
        voltarPara="/admin/vistorias"
        voltarRotulo="Vistorias"
        titulo={vistoria.cliente}
        meta={[
          dataBR(vistoria.dataVisita),
          vistoria.endereco,
          vistoria.pedidoCliente ? `pedido: ${vistoria.pedidoCliente}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        acoes={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={concluir}
              className={`btn ${vistoria.concluidaEm ? "btn-secundario" : "btn-primario"}`}
            >
              {vistoria.concluidaEm ? "Reabrir" : "Concluir visita"}
            </button>
            <AcoesDaLinha
              acoes={[
                {
                  rotulo: "Editar dados da visita",
                  executar: async () => {
                    setEditandoDados(true);
                    return null;
                  },
                },
                {
                  rotulo: "Apagar visita",
                  perigo: true,
                  executar: async () => {
                    const r = await apagarVistoria(vistoria.id);
                    return r.ok ? null : (r.erro ?? "Nao consegui apagar.");
                  },
                  confirmar: {
                    titulo: `Apagar a visita de ${vistoria.cliente}?`,
                    aviso:
                      "Some com todos os ambientes e medidas levantados. Não dá para desfazer.",
                    palavra: "APAGAR",
                  },
                },
              ]}
            />
          </div>
        }
      />

      <Conteudo>
        {erro && <p className="aviso aviso-erro mb-4 text-sm">{erro}</p>}

        {vistoria.concluidaEm && (
          <p className="aviso mb-4 text-sm leading-relaxed">
            Visita concluída em {dataBR(vistoria.concluidaEm)}. Ainda dá para
            editar — obra tem detalhe que só aparece no dia seguinte.
          </p>
        )}

        {vistoria.observacoes && (
          <p className="mb-4 text-sm leading-relaxed text-fumaca">
            {vistoria.observacoes}
          </p>
        )}

        {vistoria.ambientes.length === 0 ? (
          <div className="cartao px-5 py-8 text-center">
            <p className="text-sm leading-relaxed text-cinza">
              Comece pelo ambiente. Toque no cômodo que você está vendo agora.
            </p>
            <BotoesDeAmbiente
              vistoriaId={vistoria.id}
              aoFalhar={setErro}
              jaUsados={[]}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="rotulo">
              {vistoria.ambientes.length} ambiente
              {vistoria.ambientes.length === 1 ? "" : "s"} · {medidas} medida
              {medidas === 1 ? "" : "s"}
            </p>

            {vistoria.ambientes.map((a) => (
              <CartaoDeAmbiente
                key={a.id}
                ambiente={a}
                aoEditar={() => setAmbienteEmEdicao(a)}
                aoMedir={(medicao) =>
                  setMedicaoEmEdicao({ ambienteId: a.id, medicao })
                }
                aoFalhar={setErro}
              />
            ))}

            <div className="cartao px-5 py-5">
              <p className="rotulo mb-1">Incluir ambiente</p>
              <BotoesDeAmbiente
                vistoriaId={vistoria.id}
                aoFalhar={setErro}
                jaUsados={vistoria.ambientes.map((a) => a.nome)}
              />
            </div>
          </div>
        )}
      </Conteudo>

      <Dialogo
        aberto={editandoDados}
        aoFechar={() => setEditandoDados(false)}
        titulo="Dados da visita"
        estreito
      >
        {editandoDados && (
          <FormularioDeDados
            vistoria={vistoria}
            aoFechar={() => setEditandoDados(false)}
          />
        )}
      </Dialogo>

      <Dialogo
        aberto={ambienteEmEdicao !== null}
        aoFechar={() => setAmbienteEmEdicao(null)}
        titulo="Editar ambiente"
        estreito
      >
        {ambienteEmEdicao && (
          <FormularioDeAmbiente
            ambiente={ambienteEmEdicao}
            aoFechar={() => setAmbienteEmEdicao(null)}
          />
        )}
      </Dialogo>

      <Dialogo
        aberto={medicaoEmEdicao !== null}
        aoFechar={() => setMedicaoEmEdicao(null)}
        titulo={medicaoEmEdicao?.medicao ? "Editar serviço" : "Incluir serviço"}
        descricao="Só o serviço é obrigatório. Medida e unidade podem ficar para depois."
        estreito
      >
        {medicaoEmEdicao && (
          <FormularioDeMedicao
            key={medicaoEmEdicao.medicao?.id ?? `novo-${medicaoEmEdicao.ambienteId}`}
            ambienteId={medicaoEmEdicao.ambienteId}
            medicao={medicaoEmEdicao.medicao}
            aoFechar={() => setMedicaoEmEdicao(null)}
          />
        )}
      </Dialogo>
    </>
  );
}

/**
 * Os cômodos como botão de uma palavra.
 *
 * O que já foi incluído sai da lista: numa casa há um "Quarto" e depois outro,
 * mas o caso comum é não repetir, e mostrar o que já está lá convida ao
 * duplicado. Quem tem dois quartos usa o "Outro" e nomeia.
 */
function BotoesDeAmbiente({
  vistoriaId,
  jaUsados,
  aoFalhar,
}: {
  vistoriaId: string;
  jaUsados: string[];
  aoFalhar: (e: string) => void;
}) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [livre, setLivre] = useState(false);
  const [nome, setNome] = useState("");

  async function incluir(valor: string) {
    if (!valor.trim()) return;
    setOcupado(valor);
    const r = await adicionarAmbiente(vistoriaId, valor);
    if (!r.ok) aoFalhar(r.erro ?? "Não consegui incluir o ambiente.");
    setOcupado(null);
    setNome("");
    setLivre(false);
  }

  const disponiveis = AMBIENTES.filter((a) => !jaUsados.includes(a));

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {disponiveis.map((a) => (
        <button
          key={a}
          type="button"
          disabled={ocupado !== null}
          onClick={() => incluir(a)}
          // `min-h-11`: alvo de toque de 44px, que é o mínimo para acertar de
          // pé, com o celular numa mão só.
          className="btn btn-secundario btn-compacto min-h-11"
        >
          {ocupado === a ? <Girando /> : null}
          {a}
        </button>
      ))}

      {livre ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            incluir(nome);
          }}
          className="flex min-w-48 flex-1 gap-2"
        >
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoFocus
            placeholder="Nome do ambiente"
            className="campo min-h-11 flex-1"
          />
          <button
            type="submit"
            disabled={ocupado !== null}
            className="btn btn-primario btn-compacto min-h-11"
          >
            Incluir
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setLivre(true)}
          className="btn btn-secundario btn-compacto min-h-11"
        >
          Outro…
        </button>
      )}
    </div>
  );
}

function CartaoDeAmbiente({
  ambiente,
  aoEditar,
  aoMedir,
  aoFalhar,
}: {
  ambiente: Ambiente;
  aoEditar: () => void;
  aoMedir: (m: Medicao | null) => void;
  aoFalhar: (e: string) => void;
}) {
  const [removendo, setRemovendo] = useState(false);

  return (
    <section className="cartao px-5 py-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-tinta">{ambiente.nome}</p>
          {ambiente.observacao && (
            <p className="mt-0.5 text-sm leading-relaxed text-fumaca">
              {ambiente.observacao}
            </p>
          )}
        </div>
        <AcoesDaLinha
          acoes={[
            {
              rotulo: "Editar ambiente",
              executar: async () => {
                aoEditar();
                return null;
              },
            },
            {
              rotulo: "Remover ambiente",
              perigo: true,
              executar: async () => {
                setRemovendo(true);
                const r = await removerAmbiente(ambiente.id);
                setRemovendo(false);
                return r.ok ? null : (r.erro ?? "Nao consegui remover.");
              },
              confirmar: {
                titulo: `Remover ${ambiente.nome}?`,
                aviso: "As medidas deste ambiente vão junto.",
                palavra: "REMOVER",
              },
            },
          ]}
        />
      </div>

      {ambiente.medicoes.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2">
          {ambiente.medicoes.map((m) => (
            <li
              key={m.id}
              className="flex items-start gap-3 rounded-sm border border-nevoa px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-tinta">{m.servico}</p>
                <p className="mt-0.5 font-mono text-[0.65rem] tracking-wider text-cinza uppercase">
                  {resumoDaMedida(m) ?? "sem medida"}
                </p>
                {m.observacao && (
                  <p className="mt-1 text-xs leading-relaxed text-fumaca">
                    {m.observacao}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => aoMedir(m)}
                className="btn btn-secundario btn-compacto shrink-0"
              >
                Editar
              </button>
              <button
                type="button"
                disabled={removendo}
                onClick={async () => {
                  const r = await removerMedicao(ambiente.id, m.id);
                  if (!r.ok) aoFalhar(r.erro ?? "Não consegui remover.");
                }}
                aria-label="Remover serviço"
                title="Remover serviço"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-cinza transition hover:bg-papel-fundo hover:text-tinta"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  className="h-3.5 w-3.5 fill-none stroke-current"
                  strokeWidth={2}
                  strokeLinecap="round"
                >
                  <path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => aoMedir(null)}
        className="btn btn-secundario btn-compacto min-h-11 w-full"
      >
        + Serviço neste ambiente
      </button>
    </section>
  );
}

/** "12 m² · 4,00 × 3,00" — a quantidade primeiro, as medidas como prova. */
function resumoDaMedida(m: Medicao): string | null {
  const dimensoes = [m.comprimento, m.largura, m.altura]
    .filter((v): v is number => v !== null)
    .map((v) => numero(v));

  const qtd =
    m.quantidade !== null ? `${numero(m.quantidade)} ${m.unidade ?? ""}`.trim() : null;
  const medidas = dimensoes.length >= 2 ? dimensoes.join(" × ") : null;

  return [qtd, medidas].filter(Boolean).join(" · ") || null;
}

function FormularioDeDados({
  vistoria,
  aoFechar,
}: {
  vistoria: VistoriaCompleta;
  aoFechar: () => void;
}) {
  const [estado, acao, pendente] = useActionState<Resultado | null, FormData>(
    salvarDadosDaVistoria,
    null,
  );

  useEffect(() => {
    if (estado?.ok) aoFechar();
  }, [estado, aoFechar]);

  return (
    <form action={acao} className="dialogo-forma">
      <div className="dialogo-corpo flex flex-col gap-4">
        <input type="hidden" name="id" value={vistoria.id} />

        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Cliente *</span>
          <input
            name="cliente"
            defaultValue={vistoria.cliente}
            required
            className="campo"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Endereço</span>
          <input
            name="endereco"
            defaultValue={vistoria.endereco ?? ""}
            className="campo"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Observações da visita</span>
          <textarea
            name="observacoes"
            defaultValue={vistoria.observacoes ?? ""}
            rows={3}
            placeholder="O que vale para a obra inteira: acesso, horário, restrição do condomínio."
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
          {pendente ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}

function FormularioDeAmbiente({
  ambiente,
  aoFechar,
}: {
  ambiente: Ambiente;
  aoFechar: () => void;
}) {
  const [estado, acao, pendente] = useActionState<Resultado | null, FormData>(
    salvarAmbiente,
    null,
  );

  useEffect(() => {
    if (estado?.ok) aoFechar();
  }, [estado, aoFechar]);

  return (
    <form action={acao} className="dialogo-forma">
      <div className="dialogo-corpo flex flex-col gap-4">
        <input type="hidden" name="id" value={ambiente.id} />

        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Nome *</span>
          <input
            name="nome"
            defaultValue={ambiente.nome}
            required
            autoFocus
            className="campo"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Observação</span>
          <textarea
            name="observacao"
            defaultValue={ambiente.observacao ?? ""}
            rows={2}
            placeholder="Piso solto no canto, infiltração na parede da janela…"
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
          {pendente ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}

function FormularioDeMedicao({
  ambienteId,
  medicao,
  aoFechar,
}: {
  ambienteId: string;
  medicao: Medicao | null;
  aoFechar: () => void;
}) {
  const [estado, acao, pendente] = useActionState<Resultado | null, FormData>(
    salvarMedicao,
    null,
  );
  const [servico, setServico] = useState(medicao?.servico ?? "");
  const [comprimento, setComprimento] = useState(
    medicao ? paraCampo(medicao.comprimento) : "",
  );
  const [largura, setLargura] = useState(
    medicao ? paraCampo(medicao.largura) : "",
  );
  const [altura, setAltura] = useState(medicao ? paraCampo(medicao.altura) : "");
  const [quantidade, setQuantidade] = useState(
    medicao ? paraCampo(medicao.quantidade) : "",
  );

  useEffect(() => {
    if (estado?.ok) aoFechar();
  }, [estado, aoFechar]);

  const virgula = (s: string) => {
    const n = Number(s.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) && s.trim() !== "" ? n : null;
  };

  const area = areaDe(
    virgula(comprimento),
    virgula(largura),
    virgula(altura),
  );

  return (
    <form action={acao} className="dialogo-forma">
      <div className="dialogo-corpo flex flex-col gap-4">
        <input type="hidden" name="ambienteId" value={ambienteId} />
        {medicao && <input type="hidden" name="id" value={medicao.id} />}

        <div className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Serviço *</span>
          <div className="flex flex-wrap gap-2">
            {SERVICOS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setServico(s)}
                className={`btn btn-compacto min-h-11 ${
                  servico === s ? "btn-primario" : "btn-secundario"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <input
            name="servico"
            value={servico}
            onChange={(e) => setServico(e.target.value)}
            required
            placeholder="ou escreva o serviço"
            className="campo mt-1"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Medidas</span>
          <div className="flex flex-wrap gap-2">
            <Medida rotulo="Compr." valor={comprimento} aoMudar={setComprimento} nome="comprimento" />
            <Medida rotulo="Larg." valor={largura} aoMudar={setLargura} nome="largura" />
            <Medida rotulo="Alt." valor={altura} aoMudar={setAltura} nome="altura" />
          </div>
          {area !== null && (
            <button
              type="button"
              onClick={() => setQuantidade(paraCampo(area))}
              className="mt-1 self-start text-xs text-arroio-tinta underline"
            >
              Usar {numero(area)} m² como quantidade
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex min-w-28 flex-1 flex-col gap-1.5">
            <span className="rotulo-campo">Quantidade</span>
            <input
              name="quantidade"
              inputMode="decimal"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              className="campo min-h-11 text-right tabular-nums"
            />
          </label>
          <label className="flex min-w-28 flex-1 flex-col gap-1.5">
            <span className="rotulo-campo">Unidade</span>
            <select
              name="unidade"
              defaultValue={medicao?.unidade ?? "m²"}
              className="campo min-h-11"
            >
              <option value="">—</option>
              {UNIDADES.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Observação</span>
          <textarea
            name="observacao"
            defaultValue={medicao?.observacao ?? ""}
            rows={2}
            placeholder="O que muda o preço: altura de pé-direito, acesso difícil, material do cliente."
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
          {pendente ? "Salvando…" : medicao ? "Salvar" : "Incluir"}
        </button>
      </div>
    </form>
  );
}

function Medida({
  rotulo,
  nome,
  valor,
  aoMudar,
}: {
  rotulo: string;
  nome: string;
  valor: string;
  aoMudar: (v: string) => void;
}) {
  return (
    <label className="flex w-24 flex-col gap-1">
      <span className="font-mono text-[0.6rem] tracking-widest text-cinza uppercase">
        {rotulo}
      </span>
      <input
        name={nome}
        // `decimal` e não `numeric`: no Android o teclado numérico puro não
        // tem vírgula, e medida de obra é 4,20 quase sempre.
        inputMode="decimal"
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder="0,00"
        className="campo min-h-11 text-right tabular-nums"
      />
    </label>
  );
}
