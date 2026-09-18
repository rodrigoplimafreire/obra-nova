"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  aceitarProposta,
  aceitarTodasAsPropostas,
  descartarProposta,
  moverProposta,
} from "@/lib/diario/acoes-propostas";
import { ROTULO_DA_SECAO, SECOES, type Secao } from "@/lib/diario/tipos";
import type { PropostaDaIA } from "@/lib/diario/dados";

/**
 * O que a IA propôs, esperando aceite.
 *
 * **Isto é o que fez o diálogo de confirmação sumir.** Antes, gerar o resumo
 * apagava os itens do dia e escrevia os da IA por cima, então a tela precisava
 * perguntar "quer mesmo substituir o que você escreveu?". Com a proposta ao
 * lado, o que está escrito nunca é tocado — e não há o que confirmar.
 *
 * "Aceitar tudo" existe porque o caso comum é a IA acertar: quem gerou o
 * resumo já leu os registros, e revisar cinco linhas uma a uma para concordar
 * com as cinco é trabalho sem resultado. Quem discorda de uma descarta aquela
 * e aceita o resto.
 */
export function SugestaoDaIA({
  dia,
  propostas,
}: {
  dia: string;
  propostas: PropostaDaIA[];
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  if (propostas.length === 0) return null;

  async function executar(
    chave: string,
    acao: () => Promise<{ ok: boolean; erro?: string }>,
  ) {
    setOcupado(chave);
    setErro(null);
    try {
      const saida = await acao();
      if (!saida.ok) setErro(saida.erro ?? "Não consegui fazer isso.");
      else router.refresh();
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section className="mt-6 rounded-cartao border-2 border-planejado/40 bg-planejado-fundo px-5 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="rotulo">A IA propôs</p>
          <p className="mt-1 text-xs text-cinza">
            Nada disto entra no relatório sozinho. Leia, e aceite o que estiver
            certo.
          </p>
        </div>

        <button
          type="button"
          disabled={ocupado !== null}
          onClick={() =>
            void executar("todas", () => aceitarTodasAsPropostas(dia))
          }
          className="btn btn-primario btn-compacto shrink-0"
        >
          Aceitar {propostas.length === 1 ? "a única" : "as " + propostas.length}
        </button>
      </div>

      {erro && <p className="aviso aviso-erro mb-3">{erro}</p>}

      <ul className="flex flex-col gap-2">
        {propostas.map((p) => (
          <li
            key={p.id}
            className={`flex flex-wrap items-center gap-2 rounded-sm border border-nevoa bg-white px-3 py-2 transition ${
              ocupado === p.id ? "opacity-50" : ""
            }`}
          >
            <span className="min-w-40 flex-1 text-sm leading-snug text-tinta">
              {/* Diz de onde a linha veio: esta não é nova, é a pendência de
                  ontem que o registro de hoje resolveu. Aceitar baixa as
                  duas. */}
              {p.deOntem && (
                <span className="mr-2 rounded-sm bg-cinza-100 px-1.5 py-0.5 font-mono text-[0.6rem] tracking-wide text-fumaca uppercase">
                  de ontem
                </span>
              )}
              {p.responsavel && (
                <span className="mr-2 rounded-sm bg-papel px-1.5 py-0.5 font-mono text-[0.65rem] tracking-wide text-fumaca uppercase">
                  {p.responsavel}
                </span>
              )}
              {p.texto}
            </span>

            {/* Corrigir a seção **antes** de aceitar: quando a IA erra, erra o
                lugar, não o conteúdo. Aceitar e mover depois seriam dois
                toques para o mesmo conserto. */}
            <select
              value={p.secao}
              disabled={ocupado !== null}
              onChange={(e) =>
                void executar(p.id, () =>
                  moverProposta(p.id, e.target.value as Secao),
                )
              }
              aria-label={`Seção proposta para "${p.texto.slice(0, 40)}"`}
              className="shrink-0 rounded-sm border border-concreto bg-papel px-2 py-1 text-xs text-fumaca"
            >
              {SECOES.map((s) => (
                <option key={s.chave} value={s.chave}>
                  {ROTULO_DA_SECAO[s.chave]}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={ocupado !== null}
              onClick={() =>
                void executar(p.id, () => aceitarProposta(p.id))
              }
              className="btn btn-secundario btn-compacto shrink-0"
            >
              Aceitar
            </button>

            <button
              type="button"
              disabled={ocupado !== null}
              onClick={() =>
                void executar(p.id, () => descartarProposta(p.id))
              }
              aria-label={`Descartar "${p.texto.slice(0, 40)}"`}
              className="shrink-0 rounded-sm px-1.5 py-1 text-cinza-500 transition hover:bg-papel hover:text-atraso"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
