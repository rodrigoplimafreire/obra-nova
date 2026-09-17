import Link from "next/link";
import { RodapeDaMarca } from "@/components/marca";
import {
  DIAS_DA_SEMANA,
  nomeDoMes,
  semanasDoMes,
} from "@/lib/diario/calendario";
import { mesVizinho } from "@/lib/tempo";
import type { DiaPublicado } from "@/lib/diario/tipos";
import type { Empreiteira } from "@/lib/admin/empreiteira";

/**
 * A página que o Reginato abre.
 *
 * **Sem `"use client"`, e sem um só manipulador de evento.** Tudo que muda de
 * estado aqui — o dia selecionado, o mês do calendário, o anterior e o
 * seguinte — viaja na URL e volta do servidor. O calendário é uma grade de
 * `<a>`, e o "Ver calendário" do celular é um `<details>`: o navegador abre e
 * fecha sozinho, sem script.
 *
 * Não é purismo. É a decisão D7 do `PRD-DIARIO.md`, e ela existe porque a
 * página do orçamento já ficou em branco em produção por depender de um
 * script para revelar o conteúdo.
 */

const DIA_LONGO = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const DIA_CURTO = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

const HORA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/** `2026-09-17` vira uma data legível sem passar pelo fuso do navegador. */
function comoData(dia: string, formato: Intl.DateTimeFormat): string {
  return formato.format(new Date(`${dia}T12:00:00Z`));
}

export function PaginaDoDiario({
  token,
  titulo,
  autor,
  empreiteira,
  hoje,
  selecionado,
  mes,
  datas,
  relatorio,
  anterior,
  seguinte,
}: {
  token: string;
  titulo: string | null;
  autor: string | null;
  empreiteira: Empreiteira;
  hoje: string;
  selecionado: string;
  mes: string;
  /** Todas as datas publicadas, da mais recente para a mais antiga. */
  datas: string[];
  relatorio: DiaPublicado | null;
  anterior: string | null;
  seguinte: string | null;
}) {
  const publicadas = new Set(datas);
  const calendario = (
    <Calendario
      token={token}
      mes={mes}
      hoje={hoje}
      selecionado={selecionado}
      publicadas={publicadas}
    />
  );

  return (
    <main className="min-h-dvh bg-papel-fundo">
      <header className="bg-tinta px-5 py-8 md:px-8 md:py-12">
        <div className="mx-auto w-full max-w-5xl">
          {empreiteira.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={empreiteira.logo}
              alt={empreiteira.nome ?? ""}
              className="mb-6 h-10 w-auto object-contain"
            />
          ) : (
            empreiteira.nome && (
              <p className="rotulo rotulo-claro mb-4">{empreiteira.nome}</p>
            )
          )}

          <h1 className="font-sans text-3xl leading-[1.05] font-extrabold -tracking-[0.03em] text-papel md:text-4xl">
            {titulo ?? "Diário de atividades"}
          </h1>
          {autor && <p className="mt-3 text-lg text-nevoa">{autor}</p>}
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-5 py-7 md:px-8 md:py-10">
        {/* No celular o relatório é o que importa, e o calendário fica atrás
            de um toque. No desktop os dois convivem em duas colunas. */}
        <details className="mb-6 rounded-lg border border-nevoa bg-white md:hidden">
          <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-tinta">
            Ver calendário
          </summary>
          <div className="border-t border-cinza-100 px-4 pt-4 pb-5">
            {calendario}
          </div>
        </details>

        <div className="md:flex md:items-start md:gap-8">
          <aside className="hidden shrink-0 md:block md:w-72">
            <div className="rounded-lg border border-nevoa bg-white px-4 pt-4 pb-5">
              {calendario}
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <Relatorio
              token={token}
              hoje={hoje}
              selecionado={selecionado}
              relatorio={relatorio}
              anterior={anterior}
              seguinte={seguinte}
              temAlgumaPublicacao={datas.length > 0}
              maisRecente={datas[0] ?? null}
            />
          </div>
        </div>

        <footer className="mt-12 border-t border-nevoa pt-6">
          <RodapeDaMarca
            nome={empreiteira.nome ?? undefined}
            logo={empreiteira.logo}
            nota={
              empreiteira.telefone
                ? `Diário de atividades · ${empreiteira.telefone}`
                : "Diário de atividades"
            }
          />
        </footer>
      </div>
    </main>
  );
}

function Relatorio({
  token,
  hoje,
  selecionado,
  relatorio,
  anterior,
  seguinte,
  temAlgumaPublicacao,
  maisRecente,
}: {
  token: string;
  hoje: string;
  selecionado: string;
  relatorio: DiaPublicado | null;
  anterior: string | null;
  seguinte: string | null;
  temAlgumaPublicacao: boolean;
  maisRecente: string | null;
}) {
  const ehHoje = selecionado === hoje;

  return (
    <article>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="rotulo">{ehHoje ? "Hoje" : "Relatório de"}</p>
          <h2 className="mt-1 font-sans text-xl leading-tight font-semibold -tracking-[0.025em] text-tinta first-letter:uppercase md:text-2xl">
            {comoData(selecionado, DIA_LONGO)}
          </h2>
        </div>

        {relatorio && (
          <p className="rotulo shrink-0">
            atualizado em {HORA.format(new Date(relatorio.publicadoEm))}
          </p>
        )}
      </div>

      {/* O aviso só aparece quando há o que avisar: existe publicação, mas não
          a de hoje. Quem abre precisa saber que está lendo ontem. */}
      {!ehHoje && temAlgumaPublicacao && selecionado === maisRecente && (
        <p className="aviso aviso-atencao mt-4">
          Ainda não há relatório de hoje. Este é o mais recente.
        </p>
      )}

      {relatorio ? (
        <div className="mt-6 flex flex-col gap-6">
          <Secao titulo="Realizado" itens={relatorio.realizado} />
          <Secao titulo="Em andamento" itens={relatorio.emAndamento} />
          <Secao titulo="Pendências" itens={relatorio.pendencias} />
          <Secao titulo="Próximos passos" itens={relatorio.proximosPassos} />
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-dashed border-nevoa px-5 py-8 text-center">
          <p className="text-sm text-cinza">
            {temAlgumaPublicacao
              ? "Nenhum relatório publicado neste dia."
              : "Ainda não há relatório publicado neste diário."}
          </p>
          {temAlgumaPublicacao && maisRecente && maisRecente !== selecionado && (
            <Link
              href={`/d/${token}?dia=${maisRecente}`}
              className="btn btn-secundario btn-compacto mt-4 inline-flex"
            >
              Ver o último relatório
            </Link>
          )}
        </div>
      )}

      {temAlgumaPublicacao && (
        <nav
          aria-label="Outros dias"
          className="mt-8 flex items-center justify-between gap-3 border-t border-nevoa pt-5"
        >
          {anterior ? (
            <Link
              href={`/d/${token}?dia=${anterior}`}
              className="btn btn-secundario btn-compacto"
            >
              ← {comoData(anterior, DIA_CURTO)}
            </Link>
          ) : (
            <span />
          )}

          {seguinte ? (
            <Link
              href={`/d/${token}?dia=${seguinte}`}
              className="btn btn-secundario btn-compacto"
            >
              {comoData(seguinte, DIA_CURTO)} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </article>
  );
}

/** Seção vazia não aparece — a regra que vale em toda página do produto. */
function Secao({ titulo, itens }: { titulo: string; itens: string[] }) {
  if (itens.length === 0) return null;

  return (
    <section>
      <h3 className="rotulo mb-3">{titulo}</h3>
      <ul className="flex flex-col gap-2">
        {itens.map((item, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amarelo-tinta" />
            <span className="leading-relaxed text-grafite">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Calendario({
  token,
  mes,
  hoje,
  selecionado,
  publicadas,
}: {
  token: string;
  mes: string;
  hoje: string;
  selecionado: string;
  publicadas: Set<string>;
}) {
  const semanas = semanasDoMes(mes);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <SetaDoMes token={token} mes={mesVizinho(mes, -1)} dia={selecionado} direcao="anterior" />
        <p className="text-sm font-semibold text-tinta first-letter:uppercase">
          {nomeDoMes(mes)}
        </p>
        <SetaDoMes token={token} mes={mesVizinho(mes, 1)} dia={selecionado} direcao="seguinte" />
      </div>

      <table className="w-full table-fixed">
        <caption className="sr-only">
          Dias com relatório publicado em {nomeDoMes(mes)}
        </caption>
        <thead>
          <tr>
            {DIAS_DA_SEMANA.map((letra, i) => (
              <th
                key={i}
                scope="col"
                // `cinza-500` e não `cinza-400`: medido no navegador, o 400
                // dá 2,98:1 sobre branco e reprova na AA. Aqui é rótulo de
                // coluna, não texto desabilitado.
                className="pb-2 text-center font-mono text-[0.65rem] font-normal tracking-widest text-cinza-500 uppercase"
              >
                {letra}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {semanas.map((semana, i) => (
            <tr key={i}>
              {semana.map((dia, j) => (
                <td key={j} className="p-0.5 text-center">
                  {dia && (
                    <Celula
                      token={token}
                      dia={dia}
                      ehHoje={dia === hoje}
                      selecionado={dia === selecionado}
                      publicado={publicadas.has(dia)}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 text-xs leading-relaxed text-cinza">
        Os dias em destaque têm relatório publicado.
      </p>
    </div>
  );
}

/**
 * O dia do calendário.
 *
 * Dia sem publicação **não é link**: clicar num dia vazio e cair numa página
 * que diz "nenhum relatório" é trabalho para descobrir o que a própria grade
 * já mostrava. Ele continua visível, porque some-lo esconderia o calendário.
 */
function Celula({
  token,
  dia,
  ehHoje,
  selecionado,
  publicado,
}: {
  token: string;
  dia: string;
  ehHoje: boolean;
  selecionado: boolean;
  publicado: boolean;
}) {
  const numero = Number(dia.slice(8, 10));

  // O dia de hoje ganha um anel; o selecionado, fundo cheio. São dois estados
  // diferentes e precisam continuar distinguíveis quando caem no mesmo dia.
  const base =
    "flex h-9 w-full items-center justify-center rounded-sm text-sm tabular-nums transition";

  if (!publicado) {
    return (
      <span
        aria-current={ehHoje ? "date" : undefined}
        // Dia sem publicação é apagado, mas continua sendo a data do mês, e
        // não texto desabilitado: `cinza-400` mede 2,98:1 sobre branco e
        // reprova na AA. O anel de hoje sobe pelo mesmo motivo — indicador
        // de interface precisa de 3:1, e `concreto` dá 1,75.
        className={`${base} text-cinza-500 ${ehHoje ? "ring-1 ring-cinza-500" : ""}`}
      >
        {numero}
      </span>
    );
  }

  return (
    <Link
      href={`/d/${token}?dia=${dia}`}
      aria-current={selecionado ? "page" : ehHoje ? "date" : undefined}
      aria-label={`Relatório de ${comoData(dia, DIA_LONGO)}`}
      className={`${base} font-semibold ${
        selecionado
          ? "bg-tinta text-papel"
          : `text-tinta hover:bg-papel ${ehHoje ? "ring-1 ring-tinta" : "bg-amarelo-vazado"}`
      }`}
    >
      {numero}
    </Link>
  );
}

function SetaDoMes({
  token,
  mes,
  dia,
  direcao,
}: {
  token: string;
  mes: string;
  /** O dia continua o mesmo: navegar o mês não troca o relatório aberto. */
  dia: string;
  direcao: "anterior" | "seguinte";
}) {
  return (
    <Link
      href={`/d/${token}?dia=${dia}&mes=${mes}`}
      aria-label={`Mês ${direcao === "anterior" ? "anterior" : "seguinte"}`}
      className="flex h-8 w-8 items-center justify-center rounded-sm text-cinza-500 transition hover:bg-papel hover:text-tinta"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="h-4 w-4 fill-none stroke-current"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={direcao === "anterior" ? "m14 6-6 6 6 6" : "m10 6 6 6-6 6"} />
      </svg>
    </Link>
  );
}
