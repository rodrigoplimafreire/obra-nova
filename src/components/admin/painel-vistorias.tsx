"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Dialogo } from "@/components/comum/dialogo";
import { Girando } from "@/components/comum/esqueleto";
import { Cabecalho, Conteudo, Indicador, Vazio } from "./cabecalho";
import { criarVistoria } from "@/lib/vistoria/acoes";
import { data as dataBR } from "@/lib/orcamento/formato";
import type { Resultado } from "@/lib/admin/tipos";
import type { VistoriaNaLista } from "@/lib/vistoria/constantes";

/**
 * As visitas, em ordem de quando aconteceram.
 *
 * A lista existe para responder duas perguntas no fim do dia: o que eu
 * levantei hoje, e o que já dá para virar orçamento. Por isso a separação é
 * entre **em campo** e **concluída**, e não por cliente ou por data.
 */

export function PainelDeVistorias({
  vistorias,
  pedidos,
}: {
  vistorias: VistoriaNaLista[];
  pedidos: { id: string; rotulo: string }[];
}) {
  const [criando, setCriando] = useState(false);

  const emCampo = vistorias.filter((v) => !v.concluidaEm);
  const concluidas = vistorias.filter((v) => v.concluidaEm);

  return (
    <>
      <Cabecalho
        titulo="Vistorias"
        meta="O levantamento da visita, feito no celular"
        acoes={
          <button
            type="button"
            onClick={() => setCriando(true)}
            className="btn btn-primario"
          >
            Nova visita
          </button>
        }
      />

      <Conteudo>
        {vistorias.length === 0 ? (
          <Vazio
            titulo="Nenhuma visita registrada"
            acao={
              <button
                type="button"
                onClick={() => setCriando(true)}
                className="btn btn-primario"
              >
                Nova visita
              </button>
            }
          >
            Abra uma visita antes de sair para o cliente. Ambientes, serviços e
            medidas entram pelo celular, ali mesmo, e ficam salvos a cada campo.
          </Vazio>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Indicador rotulo="Em campo" valor={emCampo.length} />
              <Indicador rotulo="Concluídas" valor={concluidas.length} />
              <Indicador
                rotulo="Viraram orçamento"
                valor={vistorias.filter((v) => v.orcamentoId).length}
              />
              <Indicador
                rotulo="Medidas levantadas"
                valor={vistorias.reduce((s, v) => s + v.medicoes, 0)}
              />
            </div>

            {emCampo.length > 0 && (
              <Grupo titulo="Em campo" vistorias={emCampo} />
            )}
            {concluidas.length > 0 && (
              <Grupo titulo="Concluídas" vistorias={concluidas} />
            )}
          </>
        )}
      </Conteudo>

      <Dialogo
        aberto={criando}
        aoFechar={() => setCriando(false)}
        titulo="Nova visita"
        descricao="Só o nome é obrigatório. O resto se preenche no local."
        estreito
      >
        {criando && (
          <FormularioDeVistoria
            pedidos={pedidos}
            aoFechar={() => setCriando(false)}
          />
        )}
      </Dialogo>
    </>
  );
}

function Grupo({
  titulo,
  vistorias,
}: {
  titulo: string;
  vistorias: VistoriaNaLista[];
}) {
  return (
    <section className="mt-6">
      <p className="rotulo mb-2">{titulo}</p>
      <ul className="flex flex-col gap-2">
        {vistorias.map((v) => (
          <li key={v.id}>
            <Link
              href={`/admin/vistorias/${v.id}`}
              className="flex items-center gap-3 rounded-sm border border-nevoa bg-white px-4 py-3 transition hover:border-tinta"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-tinta">
                  {v.cliente}
                </p>
                <p className="mt-0.5 truncate font-mono text-[0.65rem] tracking-wider text-cinza uppercase">
                  {[
                    dataBR(v.dataVisita),
                    `${v.ambientes} ambiente${v.ambientes === 1 ? "" : "s"}`,
                    `${v.medicoes} medida${v.medicoes === 1 ? "" : "s"}`,
                    v.endereco,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {v.orcamentoId && (
                <span className="selo selo-neutro shrink-0">virou orçamento</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FormularioDeVistoria({
  pedidos,
  aoFechar,
}: {
  pedidos: { id: string; rotulo: string }[];
  aoFechar: () => void;
}) {
  // Sem `useEffect` de fechar: a ação termina em `redirect` para a vistoria
  // recém-criada, então não há retorno de sucesso para observar.
  const [estado, acao, pendente] = useActionState<Resultado | null, FormData>(
    criarVistoria,
    null,
  );

  return (
    <form action={acao} className="dialogo-forma">
      <div className="dialogo-corpo flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Cliente *</span>
          <input
            name="cliente"
            required
            autoFocus
            placeholder="Sra. Heloneida"
            className="campo"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Endereço</span>
          <input
            name="endereco"
            placeholder="Condomínio Portugal Village, Bloco C, 404 — Aquiraz"
            className="campo"
          />
        </label>

        <div className="flex flex-wrap gap-4">
          <label className="flex min-w-40 flex-1 flex-col gap-1.5">
            <span className="rotulo-campo">Data da visita</span>
            <input type="date" name="dataVisita" className="campo" />
            <span className="ajuda-campo">Em branco, é hoje.</span>
          </label>

          {pedidos.length > 0 && (
            <label className="flex min-w-48 flex-1 flex-col gap-1.5">
              <span className="rotulo-campo">Pedido do pipeline</span>
              <select name="pedidoId" defaultValue="" className="campo">
                <option value="">Sem vínculo</option>
                {pedidos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.rotulo}
                  </option>
                ))}
              </select>
              <span className="ajuda-campo">
                Liga a visita ao pedido que já está no funil.
              </span>
            </label>
          )}
        </div>

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
          {pendente ? "Abrindo…" : "Abrir visita"}
        </button>
      </div>
    </form>
  );
}
