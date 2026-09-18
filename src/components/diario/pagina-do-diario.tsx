import Link from "next/link";
import { RodapeDaMarca } from "@/components/marca";
import {
  DIAS_DA_SEMANA,
  nomeDoMes,
  semanasDoMes,
} from "@/lib/diario/calendario";
import { mesVizinho } from "@/lib/tempo";
import {
  semDono,
  separarResponsavel,
  type DiaPublicado,
  type ItemPublicado,
} from "@/lib/diario/tipos";
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
 *
 * **A hierarquia da leitura** segue o que a pesquisa de ferramentas de status
 * diz e o PRD já pedia: primeiro o que ficou pronto, depois o que continua,
 * depois o que travou, por último o que vem. As quatro não têm o mesmo peso
 * visual de propósito — pendência é a única que pede ação de quem lê, e é a
 * única desenhada como cartão. Quatro listas idênticas obrigam a ler tudo
 * para descobrir o que importa.
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

const DIA_DA_SEMANA_CURTO = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
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
  base,
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
  /** O caminho de onde a página fala de si mesma. Ver a rota. */
  base: string;
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
  const maisRecente = datas[0] ?? null;

  const calendario = (
    <Calendario
      base={base}
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

      {/**
       * A fita dos últimos dias.
       *
       * Quase toda consulta é "hoje" ou "ontem", e abrir um calendário para
       * isso é atrito em cima do caso comum. A fita resolve o caso comum num
       * toque e deixa o calendário para o que ele é bom: achar uma data
       * distante. É `<a>` puro, como o resto da página.
       */}
      {datas.length > 1 && (
        <nav
          aria-label="Últimos dias"
          className="border-b border-nevoa bg-white"
        >
          <ul className="mx-auto flex w-full max-w-5xl gap-2 overflow-x-auto px-5 py-3 md:px-8">
            {datas.slice(0, 10).map((d) => {
              const atual = d === selecionado;
              return (
                <li key={d} className="shrink-0">
                  <Link
                    href={`${base}?dia=${d}`}
                    aria-current={atual ? "page" : undefined}
                    className={`flex min-w-16 flex-col items-center rounded-sm border px-3 py-2 transition ${
                      atual
                        ? "border-tinta bg-tinta text-papel"
                        : "border-nevoa text-fumaca hover:border-concreto hover:text-tinta"
                    }`}
                  >
                    <span className="font-mono text-[0.6rem] tracking-widest uppercase">
                      {d === hoje
                        ? "hoje"
                        : comoData(d, DIA_DA_SEMANA_CURTO).replace(".", "")}
                    </span>
                    <span className="mt-0.5 text-sm font-semibold tabular-nums">
                      {comoData(d, DIA_CURTO)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

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
              base={base}
              hoje={hoje}
              selecionado={selecionado}
              relatorio={relatorio}
              anterior={anterior}
              seguinte={seguinte}
              temAlgumaPublicacao={datas.length > 0}
              maisRecente={maisRecente}
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
  base,
  hoje,
  selecionado,
  relatorio,
  anterior,
  seguinte,
  temAlgumaPublicacao,
  maisRecente,
}: {
  base: string;
  hoje: string;
  selecionado: string;
  relatorio: DiaPublicado | null;
  anterior: string | null;
  seguinte: string | null;
  temAlgumaPublicacao: boolean;
  maisRecente: string | null;
}) {
  const ehHoje = selecionado === hoje;
  const noMaisRecente = selecionado === maisRecente;

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
      {!ehHoje && temAlgumaPublicacao && noMaisRecente && (
        <p className="aviso aviso-atencao mt-4">
          Ainda não há relatório de hoje. Este é o mais recente.
        </p>
      )}

      {relatorio ? (
        <div className="mt-6 flex flex-col gap-7">
          <Lista titulo="Realizado" itens={relatorio.realizado} tom="feito" />
          <Lista
            titulo="Em andamento"
            itens={relatorio.em_andamento}
            tom="andando"
          />
          <Pendencias itens={relatorio.pendencias} />
          <Lista
            titulo="Próximos passos"
            itens={relatorio.proximos_passos}
            tom="proximo"
            comDono
          />
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-dashed border-nevoa px-5 py-8 text-center">
          <p className="text-sm text-cinza">
            {temAlgumaPublicacao
              ? "Nenhum relatório publicado neste dia."
              : "Ainda não há relatório publicado neste diário."}
          </p>
        </div>
      )}

      {temAlgumaPublicacao && (
        <nav
          aria-label="Outros dias"
          className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-nevoa pt-5"
        >
          {anterior ? (
            <Link
              href={`${base}?dia=${anterior}`}
              className="btn btn-secundario btn-compacto"
            >
              ← {comoData(anterior, DIA_CURTO)}
            </Link>
          ) : (
            <span />
          )}

          {/* "Voltar ao último relatório" é ação do PRD, e some quando já se
              está nele — botão que não leva a lugar nenhum é ruído. */}
          {!noMaisRecente && maisRecente && (
            <Link
              href={`${base}?dia=${maisRecente}`}
              className="btn btn-sutil btn-compacto order-last w-full justify-center md:order-none md:w-auto"
            >
              Voltar ao último relatório
            </Link>
          )}

          {seguinte ? (
            <Link
              href={`${base}?dia=${seguinte}`}
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

const TOM = {
  feito: "bg-emdia",
  andando: "bg-atencao-forte",
  proximo: "bg-planejado",
} as const;

/**
 * Seção vazia não aparece — a regra que vale em toda página do produto.
 *
 * O marcador muda de cor por seção. Não é enfeite: numa página de quatro
 * listas seguidas, é o que permite achar "o que vem em seguida" sem reler o
 * título de cada bloco.
 */
function Lista({
  titulo,
  itens,
  tom,
  comDono = false,
}: {
  titulo: string;
  itens: ItemPublicado[];
  tom: keyof typeof TOM;
  comDono?: boolean;
}) {
  if (itens.length === 0) return null;

  return (
    <section>
      <h3 className="rotulo mb-3">{titulo}</h3>
      <ul className="flex flex-col gap-2.5">
        {itens.map((bruto, i) => {
          // `separarResponsavel` só age em publicação antiga, de quando o dono
          // morava dentro do texto. A coluna vence sempre que existir.
          const { texto, responsavel } = comDono
            ? separarResponsavel(bruto)
            : bruto;

          return (
            <li key={i} className="flex gap-3">
              <span
                className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${TOM[tom]}`}
              />
              <span className="min-w-0 leading-relaxed text-grafite">
                {responsavel && <Dono nome={responsavel} />}
                {texto}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Pendência é a única seção desenhada como cartão.
 *
 * É a única que pede alguma coisa de quem lê. Nas ferramentas de status que
 * funcionam, o bloqueio é o que sobe na página, não o que se perde no meio de
 * uma lista igual às outras.
 */
function Pendencias({ itens }: { itens: ItemPublicado[] }) {
  if (itens.length === 0) return null;

  return (
    <section>
      <h3 className="rotulo mb-3">Pendências</h3>
      <ul className="flex flex-col gap-2.5">
        {itens.map((bruto, i) => {
          const { texto, responsavel } = separarResponsavel(bruto);
          return (
            <li
              key={i}
              className="rounded-lg border border-nevoa border-l-[3px] border-l-atencao-forte bg-white px-5 py-4"
            >
              {/* No cartão o dono fica na linha de cima, e não colado no
                  texto: numa pendência de duas linhas, a segunda voltava para
                  a margem e o nome ficava boiando no meio da frase. */}
              {responsavel && <Dono nome={responsavel} bloco />}
              <span className="leading-relaxed text-grafite">{texto}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * O nome de quem tem a bola.
 *
 * "A definir" fica cinza e em itálico de propósito: ele é a ausência de um
 * responsável, e parecer um nome faria o leitor procurar por uma pessoa
 * chamada A Definir. A IA só escreve isso quando ninguém foi apontado — ela
 * não chuta dono, e a tela não finge que há um.
 */
function Dono({ nome, bloco = false }: { nome: string; bloco?: boolean }) {
  const indefinido = semDono(nome);

  return (
    <span
      className={`rounded-sm px-1.5 py-0.5 font-mono text-[0.65rem] tracking-wide uppercase ${
        // `block w-fit` e não `inline-block`: inline não quebra linha, e o
        // texto continuaria subindo para o lado do nome.
        bloco ? "mb-1.5 block w-fit" : "mr-2 inline-block align-baseline"
      } ${
        indefinido
          ? "bg-cinza-100 text-cinza italic"
          : "bg-papel-fundo text-tinta"
      }`}
    >
      {nome}
    </span>
  );
}

function Calendario({
  base,
  mes,
  hoje,
  selecionado,
  publicadas,
}: {
  base: string;
  mes: string;
  hoje: string;
  selecionado: string;
  publicadas: Set<string>;
}) {
  const semanas = semanasDoMes(mes);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <SetaDoMes base={base} mes={mesVizinho(mes, -1)} dia={selecionado} direcao="anterior" />
        <p className="text-sm font-semibold text-tinta first-letter:uppercase">
          {nomeDoMes(mes)}
        </p>
        <SetaDoMes base={base} mes={mesVizinho(mes, 1)} dia={selecionado} direcao="seguinte" />
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
                      base={base}
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
 * já mostrava. Ele continua visível, porque sumi-lo esconderia o calendário.
 */
function Celula({
  base,
  dia,
  ehHoje,
  selecionado,
  publicado,
}: {
  base: string;
  dia: string;
  ehHoje: boolean;
  selecionado: boolean;
  publicado: boolean;
}) {
  const numero = Number(dia.slice(8, 10));

  // O dia de hoje ganha um anel; o selecionado, fundo cheio. São dois estados
  // diferentes e precisam continuar distinguíveis quando caem no mesmo dia.
  const base_ =
    "flex h-9 w-full items-center justify-center rounded-sm text-sm tabular-nums transition";

  if (!publicado) {
    return (
      <span
        aria-current={ehHoje ? "date" : undefined}
        // Dia sem publicação é apagado, mas continua sendo a data do mês, e
        // não texto desabilitado: `cinza-400` mede 2,98:1 sobre branco e
        // reprova na AA. O anel de hoje sobe pelo mesmo motivo — indicador
        // de interface precisa de 3:1, e `concreto` dá 1,75.
        className={`${base_} text-cinza-500 ${ehHoje ? "ring-1 ring-cinza-500" : ""}`}
      >
        {numero}
      </span>
    );
  }

  return (
    <Link
      href={`${base}?dia=${dia}`}
      aria-current={selecionado ? "page" : ehHoje ? "date" : undefined}
      aria-label={`Relatório de ${comoData(dia, DIA_LONGO)}`}
      className={`${base_} font-semibold ${
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
  base,
  mes,
  dia,
  direcao,
}: {
  base: string;
  mes: string;
  /** O dia continua o mesmo: navegar o mês não troca o relatório aberto. */
  dia: string;
  direcao: "anterior" | "seguinte";
}) {
  return (
    <Link
      href={`${base}?dia=${dia}&mes=${mes}`}
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
