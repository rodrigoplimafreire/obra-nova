"use client";

import { useActionState, useEffect, useState } from "react";
import { Dialogo } from "@/components/comum/dialogo";
import { Dica } from "@/components/comum/dica";
import { Girando } from "@/components/comum/esqueleto";
import {
  puxarNormasDoPerfil,
  removerNorma,
  salvarNorma,
  voltarAsNormasDoPerfil,
} from "@/lib/orcamento/acoes-normas";
import type { Resultado } from "@/lib/admin/tipos";
import type { NormaDoOrcamento, OrcamentoCompleto } from "@/lib/orcamento/dados";

/**
 * As normas técnicas da seção 5, quando esta obra cita outras.
 *
 * **Vazio não é pendência.** Sem nada aqui, o documento usa a lista do Perfil,
 * que é como sempre foi e serve para a maioria das propostas. O card existe
 * para a exceção: a obra só de estrutura que não deve citar assentamento de
 * porcelanato, nem impermeabilização de área molhada, nem instalação
 * hidrossanitária — disciplinas que não vão acontecer ali. Num documento feito
 * para imprimir e assinar, norma citada é escopo declarado.
 *
 * O caminho esperado é **puxar do Perfil e apagar o que não serve**: o
 * trabalho é tirar, não redigitar a ABNT. Se citar menos exigisse escrever
 * tudo de novo, ninguém faria, e a proposta seguiria prometendo disciplina que
 * a obra não tem.
 *
 * Ver `ESTRUTURA-DA-PROPOSTA.md`, seção 5.
 */

export function NormasDoDocumento({
  orcamento,
  normasDoPerfil,
}: {
  orcamento: OrcamentoCompleto;
  /** A lista do Perfil, mostrada quando o orçamento não escolheu as suas. */
  normasDoPerfil: string[];
}) {
  // `undefined` é diálogo fechado; `null` é diálogo aberto para incluir.
  const [emEdicao, setEmEdicao] = useState<
    NormaDoOrcamento | null | undefined
  >(undefined);
  const [ocupado, setOcupado] = useState<"puxar" | "voltar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const { normas } = orcamento;
  const proprias = normas.length > 0;

  async function correr(qual: "puxar" | "voltar") {
    setOcupado(qual);
    setErro(null);
    const r =
      qual === "puxar"
        ? await puxarNormasDoPerfil(orcamento.id)
        : await voltarAsNormasDoPerfil(orcamento.id);
    if (!r.ok) setErro(r.erro ?? "Não deu para fazer isso agora.");
    setOcupado(null);
  }

  return (
    <section className="cartao mt-6 px-5 py-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="rotulo">Normas técnicas</p>
          <span className={`selo ${proprias ? "selo-neutro" : "selo-neutro"}`}>
            {proprias
              ? `${normas.length} ${normas.length === 1 ? "norma" : "normas"} desta obra`
              : "as do Perfil"}
          </span>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {!proprias && normasDoPerfil.length > 0 && (
            <Dica texto="Traz as normas do Perfil para esta proposta, para você apagar as disciplinas que não existem nesta obra. O Perfil não muda.">
              <button
                type="button"
                onClick={() => correr("puxar")}
                disabled={ocupado !== null}
                className={`btn btn-compacto ${
                  ocupado === "puxar" ? "btn-carregando" : "btn-secundario"
                }`}
              >
                {ocupado === "puxar" && <Girando />}
                {ocupado === "puxar" ? "Puxando…" : "Puxar do Perfil"}
              </button>
            </Dica>
          )}

          {proprias && (
            <Dica texto="Apaga a lista desta proposta e volta a usar a do Perfil.">
              <button
                type="button"
                onClick={() => correr("voltar")}
                disabled={ocupado !== null}
                className={`btn btn-compacto ${
                  ocupado === "voltar" ? "btn-carregando" : "btn-secundario"
                }`}
              >
                {ocupado === "voltar" && <Girando />}
                {ocupado === "voltar" ? "Voltando…" : "Voltar às do Perfil"}
              </button>
            </Dica>
          )}

          <button
            type="button"
            onClick={() => setEmEdicao(null)}
            className="btn btn-compacto btn-secundario"
          >
            Incluir norma
          </button>
        </div>
      </div>

      {erro && <p className="aviso aviso-erro mb-4 text-sm">{erro}</p>}

      {proprias ? (
        <ul className="flex flex-col gap-2">
          {normas.map((n) => (
            <li
              key={n.id}
              className="flex items-start gap-3 rounded-sm border border-nevoa px-4 py-3"
            >
              <p className="min-w-0 flex-1 text-sm leading-relaxed text-tinta">
                {n.texto}
              </p>
              <div className="flex shrink-0 items-center gap-1">
                <BotaoLocal
                  rotulo="Editar"
                  aoClicar={() => setEmEdicao(n)}
                  caminho="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM14 6l4 4"
                />
                <BotaoDeRemocao
                  remover={() => removerNorma(orcamento.id, n.id)}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-cinza">
            Esta proposta cita as normas do Perfil, iguais às das outras. Mexa
            aqui só quando a obra tiver disciplinas diferentes — uma obra só de
            estrutura não deve citar assentamento de revestimento nem
            instalação hidrossanitária.
          </p>
          {normasDoPerfil.length > 0 && (
            <ul className="flex flex-col gap-1.5 border-t border-cinza-100 pt-3">
              {normasDoPerfil.map((n, i) => (
                <li key={i} className="text-sm leading-relaxed text-cinza">
                  {n}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Dialogo
        aberto={emEdicao !== undefined}
        aoFechar={() => setEmEdicao(undefined)}
        titulo={emEdicao ? "Editar norma" : "Incluir norma"}
        descricao="Sai na seção de condições comerciais, sob 'Normas técnicas aplicáveis'."
        estreito
      >
        {emEdicao !== undefined && (
          <FormularioDeNorma
            key={emEdicao?.id ?? "nova-norma"}
            orcamentoId={orcamento.id}
            norma={emEdicao}
            aoFechar={() => setEmEdicao(undefined)}
          />
        )}
      </Dialogo>
    </section>
  );
}

function FormularioDeNorma({
  orcamentoId,
  norma,
  aoFechar,
}: {
  orcamentoId: string;
  norma: NormaDoOrcamento | null;
  aoFechar: () => void;
}) {
  const [estado, acao, pendente] = useActionState<Resultado | null, FormData>(
    salvarNorma,
    null,
  );

  useEffect(() => {
    if (estado?.ok) aoFechar();
  }, [estado, aoFechar]);

  return (
    <form action={acao} className="dialogo-forma">
      <div className="dialogo-corpo flex flex-col gap-4">
        <input type="hidden" name="orcamentoId" value={orcamentoId} />
        {norma && <input type="hidden" name="id" value={norma.id} />}

        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Norma *</span>
          <textarea
            name="texto"
            defaultValue={norma?.texto ?? ""}
            placeholder="ABNT NBR 6118 — Projeto de estruturas de concreto: cobrimento de armadura, resistência do concreto e prazos de desforma."
            required
            autoFocus
            rows={4}
            className="campo"
          />
          <span className="ajuda-campo">
            A norma e o que ela garante nesta obra, como nas outras propostas.
          </span>
        </label>

        {estado && !estado.ok && (
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
          {pendente ? "Salvando…" : norma ? "Salvar" : "Incluir"}
        </button>
      </div>
    </form>
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
