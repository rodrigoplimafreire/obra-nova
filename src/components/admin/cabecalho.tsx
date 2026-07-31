import Link from "next/link";

/**
 * Cabeçalho de página do painel. Um só padrão em todas as telas: título à
 * esquerda, ação principal à direita. Nada de botão espalhado.
 */
export function Cabecalho({
  titulo,
  meta,
  voltarPara,
  voltarRotulo,
  acoes,
}: {
  titulo: string;
  meta?: string;
  voltarPara?: string;
  voltarRotulo?: string;
  acoes?: React.ReactNode;
}) {
  return (
    <header className="border-b border-nevoa bg-papel px-5 py-6 md:px-8 md:py-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {voltarPara && (
            <Link
              href={voltarPara}
              className="rotulo inline-block underline underline-offset-4"
            >
              ← {voltarRotulo ?? "Voltar"}
            </Link>
          )}
          <h1
            className={`font-sans text-3xl leading-none font-extrabold -tracking-[0.03em] text-tinta md:text-4xl ${
              voltarPara ? "mt-3" : ""
            }`}
          >
            {titulo}
          </h1>
          {meta && <p className="rotulo mt-2.5">{meta}</p>}
        </div>

        {acoes && <div className="flex shrink-0 gap-2">{acoes}</div>}
      </div>
    </header>
  );
}

/** Área de conteúdo, com a mesma coluna do cabeçalho. */
export function Conteudo({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-6 md:px-8 md:py-8">
      {children}
    </div>
  );
}

/** Cartão numérico do topo, como no painel de referência. */
export function Indicador({
  rotulo,
  valor,
  detalhe,
  destaque,
  dica,
}: {
  rotulo: string;
  valor: number | string;
  detalhe?: string;
  destaque?: "tinta" | "amarelo";
  dica?: string;
}) {
  return (
    <div
      data-dica={dica}
      className={`rounded-3xl border border-nevoa bg-white px-5 py-4 ${dica ? "dica" : ""}`}
    >
      <p className="rotulo">{rotulo}</p>
      {/* Valor de texto ("Respondendo") não cabe no corpo de número e vazava
          para fora do cartão. Palavra longa entra menor. */}
      <p
        className={`mt-2 font-sans leading-tight font-extrabold break-words -tracking-[0.03em] ${
          typeof valor === "string" && valor.length > 4
            ? "text-xl md:text-2xl"
            : "text-4xl leading-none"
        } ${
          destaque === "tinta"
            ? "text-tinta"
            : destaque === "amarelo"
              ? "text-amarelo-tinta"
              : "text-tinta"
        }`}
      >
        {valor}
      </p>
      {detalhe && <p className="mt-1.5 text-xs text-cinza">{detalhe}</p>}
    </div>
  );
}

/** Bloco de seção dentro do conteúdo, com título e ação opcional. */
export function Secao({
  titulo,
  acao,
  children,
}: {
  titulo: string;
  acao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 first:mt-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="rotulo">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}
