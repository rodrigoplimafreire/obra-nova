"use client";

import { useActionState, useState } from "react";
import { Secao } from "./cabecalho";
import { copiarTexto } from "@/lib/clipboard";
import {
  despublicarRelatorio,
  gerarRelatorioDaSemana,
  publicarRelatorio,
} from "@/lib/admin/acoes-relatorio";
import type { Resultado } from "@/lib/admin/tipos";
import type { RelatorioCompleto } from "@/lib/relatorio/dados";

/**
 * Gerar, ler e liberar o relatório da semana.
 *
 * Gerar e publicar são dois botões separados porque são dois atos diferentes:
 * o primeiro é a máquina escrevendo, o segundo é você assinando embaixo. Um
 * texto de IA não vai para quem paga a obra sem alguém ter lido.
 */

const PERIODO = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

const QUANDO = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

export function AbaDeRelatorio({
  obraId,
  inicio,
  fim,
  relatorio,
  temServicos,
}: {
  obraId: string;
  inicio: string;
  fim: string;
  relatorio: RelatorioCompleto | null;
  temServicos: boolean;
}) {
  const [gerado, acaoGerar, gerando] = useActionState<Resultado | null, FormData>(
    gerarRelatorioDaSemana,
    null,
  );

  const periodo = `${PERIODO.format(new Date(`${inicio}T12:00:00Z`))} a ${PERIODO.format(new Date(`${fim}T12:00:00Z`))}`;
  const r = relatorio?.resultado;

  return (
    <>
      <Secao
        titulo={`Semana de ${periodo}`}
        acao={
          <form action={acaoGerar}>
            <input type="hidden" name="obraId" value={obraId} />
            <input type="hidden" name="inicio" value={inicio} />
            <input type="hidden" name="fim" value={fim} />
            <button
              type="submit"
              disabled={gerando || !temServicos}
              className="btn btn-principal"
            >
              {gerando
                ? "Escrevendo…"
                : relatorio
                  ? "Gerar de novo"
                  : "Gerar relatório"}
            </button>
          </form>
        }
      >
        {!temServicos && (
          <p className="rounded-3xl border border-dashed border-nevoa bg-white px-5 py-10 text-center text-sm leading-relaxed text-cinza">
            Não há serviço lançado nesta semana. Use o seletor de data na aba
            Checklist para escolher outra.
          </p>
        )}

        {gerado?.erro && (
          <p className="mb-4 rounded-2xl bg-alerta/20 px-4 py-3 text-sm leading-relaxed text-alerta-tinta">
            {gerado.erro}
          </p>
        )}

        {relatorio?.status === "falhou" && (
          <p className="mb-4 rounded-2xl bg-alerta/20 px-4 py-3 text-sm leading-relaxed text-alerta-tinta">
            A última tentativa falhou. {relatorio.erro}
          </p>
        )}

        {temServicos && !relatorio && !gerado?.erro && (
          <p className="rounded-3xl border border-dashed border-nevoa bg-white px-5 py-10 text-center text-sm leading-relaxed text-cinza">
            Toque em Gerar relatório. A IA lê o que o mestre relatou na semana e
            escreve o texto para o cliente. As fotos entram sozinhas, sem passar
            por ela.
          </p>
        )}
      </Secao>

      {relatorio && r && (
        <>
          <Publicacao obraId={obraId} relatorio={relatorio} />

          <Secao titulo="Como o cliente vai ler">
            <div className="flex flex-col gap-4">
              {r.resumo && (
                <div className="rounded-3xl border border-nevoa bg-white px-5 py-4">
                  <p className="rotulo">Como foi a semana</p>
                  <p className="mt-2 leading-relaxed text-grafite">{r.resumo}</p>
                </div>
              )}

              {r.destaques.length > 0 && (
                <div className="rounded-3xl border border-nevoa bg-white px-5 py-4">
                  <p className="rotulo mb-2">O que avançou</p>
                  <ul className="flex flex-col gap-1.5">
                    {r.destaques.map((d, i) => (
                      <li key={i} className="text-sm leading-relaxed text-grafite">
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {r.atencao.length > 0 && (
                <div className="rounded-3xl border-2 border-limao bg-limao/10 px-5 py-4">
                  <p className="rotulo !text-limao-tinta">Pontos de atenção</p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {r.atencao.map((a, i) => (
                      <li key={i}>
                        <p className="text-sm font-semibold text-tinta">
                          {a.titulo}
                          {a.precisaDecisao && (
                            <span className="ml-2 font-mono text-[0.55rem] tracking-widest text-limao-tinta uppercase">
                              precisa de decisão
                            </span>
                          )}
                        </p>
                        {a.descricao && (
                          <p className="text-sm leading-relaxed text-grafite">
                            {a.descricao}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {r.pendencias.length > 0 && (
                <div className="rounded-3xl border border-nevoa bg-white px-5 py-4">
                  <p className="rotulo mb-2">O que não fechou</p>
                  <ul className="flex flex-col gap-2">
                    {r.pendencias.map((p, i) => (
                      <li key={i}>
                        <p className="text-sm font-semibold text-tinta">
                          {p.titulo}
                          {p.dia && (
                            <span className="ml-2 font-mono text-[0.55rem] tracking-widest text-cinza">
                              {p.dia}
                            </span>
                          )}
                        </p>
                        {p.porque && (
                          <p className="text-sm leading-relaxed text-grafite">
                            {p.porque}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {r.proximosPassos.length > 0 && (
                <div className="rounded-3xl border border-nevoa bg-white px-5 py-4">
                  <p className="rotulo mb-2">O que vem na sequência</p>
                  <ul className="flex flex-col gap-1.5">
                    {r.proximosPassos.map((p, i) => (
                      <li key={i} className="text-sm leading-relaxed text-grafite">
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {r.lacunas.length > 0 && (
                <div className="rounded-3xl border border-dashed border-nevoa px-5 py-4">
                  <p className="rotulo mb-2">O relatório não afirma</p>
                  <ul className="flex flex-col gap-1.5">
                    {r.lacunas.map((l, i) => (
                      <li key={i} className="text-sm leading-relaxed text-cinza">
                        {l}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-xs leading-relaxed text-cinza">
                Escrito por {relatorio.modelo} em{" "}
                {QUANDO.format(new Date(relatorio.atualizadoEm))}, a partir do
                relato do mestre. A IA não vê as fotos: elas entram na página do
                cliente direto do canteiro. Leia antes de publicar, o nome que
                está em jogo é o seu.
              </p>
            </div>
          </Secao>
        </>
      )}
    </>
  );
}

function Publicacao({
  obraId,
  relatorio,
}: {
  obraId: string;
  relatorio: RelatorioCompleto;
}) {
  const [copiado, setCopiado] = useState(false);
  const [publicado, acaoPublicar, publicando] = useActionState<
    Resultado | null,
    FormData
  >(publicarRelatorio, null);
  const [, acaoDespublicar, despublicando] = useActionState<
    Resultado | null,
    FormData
  >(despublicarRelatorio, null);

  const noAr = Boolean(relatorio.publicadoEm);

  async function copiarLink() {
    const url = `${window.location.origin}/rel/${relatorio.token}`;
    if (await copiarTexto(url)) {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  }

  return (
    <Secao titulo="Link do cliente">
      <div
        className={`rounded-3xl border-2 px-5 py-4 ${
          noAr ? "border-limao bg-limao/10" : "border-nevoa bg-white"
        }`}
      >
        <p className="text-sm leading-relaxed text-grafite">
          {noAr
            ? "O relatório está no ar. Quem tiver o link consegue abrir."
            : "Ainda não está no ar. Leia o texto acima e publique quando estiver de acordo."}
        </p>

        {noAr && (
          <p className="mt-2 font-mono text-[0.65rem] break-all text-cinza">
            /rel/{relatorio.token}
          </p>
        )}

        {publicado?.erro && (
          <p className="mt-3 rounded-2xl bg-alerta/20 px-4 py-3 text-sm text-alerta-tinta">
            {publicado.erro}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {noAr ? (
            <>
              <button
                type="button"
                onClick={() => void copiarLink()}
                className="btn btn-principal"
              >
                {copiado ? "Copiado" : "Copiar link do cliente"}
              </button>
              <form action={acaoDespublicar}>
                <input type="hidden" name="obraId" value={obraId} />
                <input type="hidden" name="relatorioId" value={relatorio.id} />
                <button
                  type="submit"
                  disabled={despublicando}
                  className="btn btn-vazado"
                >
                  {despublicando ? "Tirando…" : "Tirar do ar"}
                </button>
              </form>
            </>
          ) : (
            <form action={acaoPublicar}>
              <input type="hidden" name="obraId" value={obraId} />
              <input type="hidden" name="relatorioId" value={relatorio.id} />
              <button
                type="submit"
                disabled={publicando}
                className="btn btn-principal"
              >
                {publicando ? "Publicando…" : "Publicar para o cliente"}
              </button>
            </form>
          )}
        </div>
      </div>
    </Secao>
  );
}
