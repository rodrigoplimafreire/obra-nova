import Link from "next/link";
import { RodapeDaMarca } from "@/components/marca";
import type { SemanaDoMestre } from "@/lib/obra/dados";

/**
 * A abertura do mestre.
 *
 * A semana inteira aparece aqui de propósito: no canteiro, saber o que vem
 * depois muda o que se faz hoje. Mas só o dia de hoje é tocável, porque é só
 * nele que o mestre pode gravar — o link do escritório é a exceção, e nele os
 * outros dias viram links.
 */

const DIA_CURTO = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  timeZone: "UTC",
});

const DIA_LONGO = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  timeZone: "UTC",
});

const ROTULO_STATUS = {
  pendente: "Falta confirmar",
  feita: "Feita",
  parcial: "Parcial",
  nao_feita: "Não deu",
} as const;

export function AberturaDoMestre({
  token,
  semana,
}: {
  token: string;
  semana: SemanaDoMestre;
}) {
  const { mestre, obra, hoje, dias } = semana;

  const doDia = dias.find((d) => d.dia === hoje)?.atividades ?? [];
  const confirmadas = doDia.filter((a) => a.status !== "pendente").length;
  const tudoPronto = doDia.length > 0 && confirmadas === doDia.length;
  const primeiroNome = mestre.nome.split(/\s+/)[0];

  const proxima =
    doDia.find((a) => a.status === "pendente")?.id ?? doDia[0]?.id ?? null;

  const outrosDias = dias.filter((d) => d.dia !== hoje && d.atividades.length > 0);

  return (
    <main className="flex flex-1 flex-col bg-azul">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 pt-10 pb-8 md:max-w-2xl md:px-12 md:py-16">
        <p className="rotulo !text-papel/70">{obra.nome}</p>

        <h1 className="mt-6 font-sans text-[2.75rem] leading-[0.95] font-extrabold -tracking-[0.03em] text-white md:text-6xl">
          Olá, {primeiroNome}.
          <br />
          {tudoPronto ? "Dia fechado." : "Como foi hoje?"}
        </h1>

        <p className="mt-5 max-w-md text-lg leading-snug text-papel/90 md:text-xl">
          {doDia.length === 0
            ? "Não há serviço lançado para hoje. Quando houver, ele aparece aqui."
            : tudoPronto
              ? "Você já confirmou tudo de hoje. Se lembrar de alguma coisa, dá para completar."
              : "Diga como ficou cada serviço e mande a foto. A foto é o que o cliente vê no relatório."}
        </p>

        <p className="mt-6 font-mono text-[0.7rem] leading-relaxed tracking-widest text-papel/75 uppercase first-letter:uppercase">
          {DIA_LONGO.format(new Date(`${hoje}T12:00:00Z`))}
          {doDia.length > 0 &&
            ` · ${confirmadas} de ${doDia.length} confirmados`}
        </p>

        {doDia.length > 0 && (
          <ul className="mt-6 flex flex-col gap-2">
            {doDia.map((a, i) => (
              <li key={a.id}>
                <Link
                  href={`/o/${token}/a/${a.id}`}
                  className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 transition active:scale-[0.99]"
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[0.65rem] ${
                      a.status === "pendente"
                        ? "border border-papel/40 text-papel/80"
                        : "bg-limao text-tinta"
                    }`}
                  >
                    {a.status === "pendente" ? i + 1 : <Certo />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block leading-snug font-medium text-white">
                      {a.titulo}
                    </span>
                    <span className="mt-0.5 block font-mono text-[0.6rem] tracking-widest text-papel/70 uppercase">
                      {ROTULO_STATUS[a.status]}
                      {a.fotos > 0 &&
                        ` · ${a.fotos} ${a.fotos === 1 ? "foto" : "fotos"}`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {outrosDias.length > 0 && (
          <details className="mt-6 rounded-3xl bg-white/10 px-5 py-4">
            <summary className="cursor-pointer font-mono text-[0.7rem] tracking-widest text-papel/80 uppercase">
              {mestre.escritorio ? "A semana inteira" : "O resto da semana"}
            </summary>
            <ul className="mt-4 flex flex-col gap-3">
              {outrosDias.map((d) => {
                const feitas = d.atividades.filter(
                  (a) => a.status !== "pendente",
                ).length;
                const passado = d.dia < hoje;
                return (
                  <li key={d.dia}>
                    <p className="font-mono text-[0.65rem] tracking-widest text-papel/70 uppercase">
                      {DIA_CURTO.format(new Date(`${d.dia}T12:00:00Z`))} ·{" "}
                      {passado
                        ? `${feitas} de ${d.atividades.length} confirmados`
                        : `${d.atividades.length} ${d.atividades.length === 1 ? "serviço" : "serviços"}`}
                    </p>
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {d.atividades.map((a) =>
                        // Só o escritório alcança outro dia. Para o mestre a
                        // semana é informação, não formulário.
                        mestre.escritorio ? (
                          <li key={a.id}>
                            <Link
                              href={`/o/${token}/a/${a.id}?dia=${d.dia}`}
                              className="block text-sm leading-snug text-papel/85 underline underline-offset-4"
                            >
                              {a.titulo}
                            </Link>
                          </li>
                        ) : (
                          <li
                            key={a.id}
                            className="text-sm leading-snug text-papel/85"
                          >
                            {a.titulo}
                          </li>
                        ),
                      )}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </details>
        )}

        <div className="mt-auto pt-10">
          {proxima ? (
            <Link
              href={`/o/${token}/a/${proxima}`}
              className="flex w-full items-center justify-between gap-4 rounded-full bg-tinta py-4 pr-3 pl-7 text-left font-semibold text-papel transition active:scale-[0.99]"
            >
              {tudoPronto ? "Rever os serviços" : "Confirmar os serviços"}
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-limao text-tinta">
                <Seta />
              </span>
            </Link>
          ) : (
            <p className="rounded-3xl bg-white/10 px-5 py-4 text-sm leading-relaxed text-papel/90">
              Pode fechar. Quando o serviço do dia for lançado, é só voltar por
              este mesmo link.
            </p>
          )}

          <div className="mt-8">
            <RodapeDaMarca tom="escuro" nota="Quem está acompanhando" />
          </div>
        </div>
      </div>
    </main>
  );
}

function Certo() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-tinta" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5 9.5 18 20 6.5" />
    </svg>
  );
}

function Seta() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 stroke-current" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
