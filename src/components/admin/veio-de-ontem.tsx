"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  aceitarSugestao,
  descartarSugestao,
} from "@/lib/diario/acoes-itens";
import { ROTULO_DA_SECAO } from "@/lib/diario/tipos";
import type { SugestaoDeOntem } from "@/lib/diario/dados";

/**
 * O que ficou em aberto no último dia, oferecido para hoje.
 *
 * É a parte da Entrega 4 que mais corta digitação: num dia normal, metade do
 * relatório é o que já estava andando ontem. Três toques resolvem cada linha.
 *
 * **A sugestão vive fora do relatório até alguém tocar** — decisão D14 do
 * `PRD-DIARIO.md`. Um item que já nascesse dentro da lista, esperando
 * confirmação, é exatamente o que faz planejamento virar entrega sem ninguém
 * decidir; e é isso que a §5 do PRD proíbe. Por isso este cartão é cinza, fica
 * acima das seções, e some quando a última linha é resolvida.
 */

const DIA_CURTO = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

export function VeioDeOntem({
  dia,
  sugestoes,
}: {
  dia: string;
  sugestoes: SugestaoDeOntem[];
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  if (sugestoes.length === 0) return null;

  async function resolver(
    id: string,
    acao: () => Promise<{ ok: boolean; erro?: string }>,
  ) {
    setOcupado(id);
    setErro(null);
    try {
      const saida = await acao();
      if (!saida.ok) setErro(saida.erro ?? "Não consegui fazer isso.");
      else router.refresh();
    } finally {
      setOcupado(null);
    }
  }

  const deQuando = sugestoes[0]?.dia;

  return (
    <section className="mt-6 rounded-cartao border border-dashed border-concreto bg-papel px-5 py-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="rotulo">Ficou em aberto</p>
        {deQuando && (
          <p className="text-xs text-cinza first-letter:uppercase">
            de {DIA_CURTO.format(new Date(`${deQuando}T12:00:00Z`))}
          </p>
        )}
      </div>

      {erro && <p className="aviso aviso-erro mb-3">{erro}</p>}

      <ul className="flex flex-col gap-2">
        {sugestoes.map((s) => (
          <li
            key={s.id}
            className={`rounded-sm border border-nevoa bg-white px-4 py-3 transition ${
              ocupado === s.id ? "opacity-50" : ""
            }`}
          >
            <p className="text-sm leading-snug text-tinta">
              {s.responsavel && (
                <span className="mr-2 rounded-sm bg-papel px-1.5 py-0.5 font-mono text-[0.65rem] tracking-wide text-fumaca uppercase">
                  {s.responsavel}
                </span>
              )}
              {s.texto}
            </p>

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={ocupado === s.id}
                onClick={() =>
                  void resolver(s.id, () =>
                    aceitarSugestao({ dia, origemId: s.id, secao: "realizado" }),
                  )
                }
                className="btn btn-secundario btn-compacto"
              >
                Concluí
              </button>

              <button
                type="button"
                disabled={ocupado === s.id}
                onClick={() =>
                  void resolver(s.id, () =>
                    aceitarSugestao({ dia, origemId: s.id, secao: s.secao }),
                  )
                }
                className="btn btn-secundario btn-compacto"
              >
                Continua {ROTULO_DA_SECAO[s.secao].toLowerCase()}
              </button>

              <button
                type="button"
                disabled={ocupado === s.id}
                onClick={() =>
                  void resolver(s.id, () =>
                    descartarSugestao({ dia, origemId: s.id }),
                  )
                }
                className="btn-texto ml-auto text-xs"
              >
                Saiu
              </button>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs leading-relaxed text-cinza">
        Nada disto entra no dia sozinho. O que você não tocar simplesmente não
        aparece no relatório.
      </p>
    </section>
  );
}
