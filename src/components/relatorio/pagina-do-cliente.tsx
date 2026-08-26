import { RodapeDaMarca } from "@/components/marca";
import type { RelatorioCompleto } from "@/lib/relatorio/dados";

/**
 * O relatório como o cliente que paga a obra vê.
 *
 * Duas coisas separadas na página: o texto, que a IA escreveu a partir do
 * relato do mestre, e as fotos, que a IA nunca viu. O rodapé diz isso em voz
 * alta, porque quem lê tem o direito de saber o que foi máquina e o que foi
 * gente no canteiro.
 */

const PERIODO = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const DIA_LONGO = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  timeZone: "UTC",
});

const ROTULO_STATUS = {
  pendente: "Sem confirmação",
  feita: "Concluído",
  parcial: "Parcial",
  nao_feita: "Não realizado",
} as const;

const COR_STATUS = {
  pendente: "selo-neutro",
  feita: "selo-emdia",
  parcial: "selo-atencao",
  nao_feita: "selo-atraso",
} as const;

export function PaginaDoCliente({ relatorio }: { relatorio: RelatorioCompleto }) {
  const { obra, inicio, fim, resultado, dias, totais } = relatorio;
  const r = resultado;

  // O período guardado é a semana inteira, de segunda a sábado, porque é ele
  // que define a consulta. Mas anunciar "20/07 a 25/07" para o cliente quando
  // ninguém trabalhou no sábado soa a conta inflada. Aqui mostro o intervalo
  // que de fato teve serviço.
  const primeiroDia = dias[0]?.dia ?? inicio;
  const ultimoDia = dias[dias.length - 1]?.dia ?? fim;

  return (
    <main className="min-h-dvh bg-papel-fundo">
      <header className="bg-tinta px-5 py-10 md:px-8 md:py-14">
        <div className="mx-auto w-full max-w-3xl">
          <p className="rotulo rotulo-claro">Relatório da semana</p>
          <h1 className="mt-3 font-sans text-3xl leading-[1.05] font-extrabold -tracking-[0.03em] text-papel md:text-5xl">
            {obra.nome}
          </h1>
          <p className="mt-4 text-lg leading-snug text-nevoa">
            {obra.cliente}
          </p>
          {obra.endereco && (
            <p className="mt-1 text-sm text-concreto">{obra.endereco}</p>
          )}
          <p className="mt-5 font-mono text-[0.7rem] tracking-widest text-nevoa uppercase">
            {PERIODO.format(new Date(`${primeiroDia}T12:00:00Z`))} a{" "}
            {PERIODO.format(new Date(`${ultimoDia}T12:00:00Z`))}
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8 md:py-12">
        <div className="grid grid-cols-3 gap-3">
          <Numero rotulo="Serviços" valor={totais.servicos} />
          <Numero
            rotulo="Concluídos"
            valor={totais.concluidos}
            destaque={totais.concluidos === totais.servicos}
          />
          <Numero rotulo="Fotos" valor={totais.fotos} />
        </div>

        {r?.resumo && (
          <section className="mt-8">
            <h2 className="rotulo mb-3">Como foi a semana</h2>
            <p className="text-[1.05rem] leading-relaxed text-grafite">
              {r.resumo}
            </p>
          </section>
        )}

        {r && r.destaques.length > 0 && (
          <section className="mt-8">
            <h2 className="rotulo mb-3">O que avançou</h2>
            <ul className="flex flex-col gap-2">
              {r.destaques.map((d, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amarelo-tinta" />
                  <span className="leading-relaxed text-grafite">{d}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {r && r.atencao.length > 0 && (
          <section className="mt-8">
            <h2 className="rotulo mb-3">Pontos de atenção</h2>
            <ul className="flex flex-col gap-3">
              {r.atencao.map((a, i) => (
                <li
                  key={i}
                  className={`rounded-lg border-2 px-5 py-4 ${
                    a.precisaDecisao
                      ? "border-amarelo bg-amarelo/10"
                      : "border-nevoa bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="font-semibold text-tinta">{a.titulo}</p>
                    {a.precisaDecisao && (
                      <span className="rounded-full bg-amarelo px-2.5 py-0.5 font-mono text-[0.55rem] tracking-widest text-tinta uppercase">
                        precisa da sua decisão
                      </span>
                    )}
                  </div>
                  {a.descricao && (
                    <p className="mt-2 text-sm leading-relaxed text-grafite">
                      {a.descricao}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {r && r.pendencias.length > 0 && (
          <section className="mt-8">
            <h2 className="rotulo mb-3">O que não fechou</h2>
            <ul className="flex flex-col gap-3">
              {r.pendencias.map((p, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-nevoa bg-white px-5 py-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold text-tinta">{p.titulo}</p>
                    {p.dia && <span className="rotulo shrink-0">{p.dia}</span>}
                  </div>
                  {p.porque && (
                    <p className="mt-2 text-sm leading-relaxed text-grafite">
                      {p.porque}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-10">
          <h2 className="rotulo mb-3">Dia a dia no canteiro</h2>
          <div className="flex flex-col gap-6">
            {dias.map((d) => (
              <div key={d.dia}>
                <p className="font-sans text-lg font-extrabold -tracking-[0.02em] text-tinta first-letter:uppercase">
                  {DIA_LONGO.format(new Date(`${d.dia}T12:00:00Z`))}
                </p>

                <ul className="mt-3 flex flex-col gap-3">
                  {d.servicos.map((s) => (
                    <li
                      key={s.id}
                      className="rounded-lg border border-nevoa bg-white px-5 py-4"
                    >
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span
                          className={`selo ${COR_STATUS[s.status]}`}
                        >
                          {ROTULO_STATUS[s.status]}
                        </span>
                        <p className="font-semibold text-tinta">{s.titulo}</p>
                      </div>

                      {s.relato.map((texto, i) => (
                        <p
                          key={i}
                          className="mt-2.5 text-sm leading-relaxed text-grafite"
                        >
                          {texto}
                        </p>
                      ))}

                      {s.fotos.length > 0 && (
                        <ul className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
                          {s.fotos.map((f) => (
                            <li key={f.id}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={f.url}
                                alt={`Foto do serviço: ${s.titulo}`}
                                className="h-40 w-full rounded-sm object-cover"
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {r && r.proximosPassos.length > 0 && (
          <section className="mt-10">
            <h2 className="rotulo mb-3">O que vem na sequência</h2>
            <ul className="flex flex-col gap-2">
              {r.proximosPassos.map((p, i) => (
                <li key={i} className="flex gap-3">
                  <span className="rotulo mt-0.5 shrink-0">{i + 1}</span>
                  <span className="leading-relaxed text-grafite">{p}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {r && r.lacunas.length > 0 && (
          <section className="mt-8 rounded-lg border border-dashed border-nevoa px-5 py-4">
            <h2 className="rotulo mb-2">Este relatório não afirma</h2>
            <ul className="flex flex-col gap-1.5">
              {r.lacunas.map((l, i) => (
                <li key={i} className="text-sm leading-relaxed text-cinza">
                  {l}
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-12 border-t border-nevoa pt-6">
          <RodapeDaMarca
            nome={obra.marcaNome ?? undefined}
            logo={obra.marcaLogo}
            nota={
              obra.contato
                ? `Relatório de obra · ${obra.contato}`
                : "Relatório de obra"
            }
          />
          {/* A nota não pode afirmar quem digitou o relato: às vezes é o mestre
              no canteiro, às vezes é o escritório lançando o que a equipe
              passou por áudio. O que sempre vale é que o texto foi redigido
              automaticamente e revisado por gente antes de chegar aqui. */}
          <p className="mt-5 text-xs leading-relaxed text-cinza">
            O texto deste relatório foi redigido automaticamente a partir do
            relato da equipe da obra, e revisado antes de ser publicado. As
            fotos vêm do canteiro e não passaram por análise automática: elas
            estão aqui para você olhar. Qualquer dúvida sobre um serviço, fale
            com a equipe da obra.
          </p>
        </footer>
      </div>
    </main>
  );
}

function Numero({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: number;
  destaque?: boolean;
}) {
  return (
    <div className="rounded-lg border border-nevoa bg-white px-5 py-4">
      <p className="rotulo">{rotulo}</p>
      <p
        className={`mt-2 font-sans text-4xl leading-none font-extrabold -tracking-[0.03em] ${
          destaque ? "text-arroio-tinta" : "text-tinta"
        }`}
      >
        {valor}
      </p>
    </div>
  );
}
