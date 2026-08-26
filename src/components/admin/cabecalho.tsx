"use client";

import Link from "next/link";
import { Cena } from "@/components/comum/cena";
import { Dica } from "@/components/comum/dica";
import { CenaVazio } from "@/components/comum/ilustracoes";
import { useMigalha } from "./trilha";

/**
 * Cabeçalho de página do painel. Um só padrão em todas as telas: título à
 * esquerda, ação principal à direita. Nada de botão espalhado.
 *
 * Medidas do `Obra Nova UI.dc.html`: título 24px no celular e 28px no desktop,
 * peso 600, `-.025em`. O app usava 30/36 em `extrabold` — quase meia escala
 * acima, e o resultado era um título que competia com o conteúdo em vez de
 * abrir a página.
 *
 * **Título e ação na mesma linha, em qualquer largura.** Antes empilhavam no
 * celular e o botão amarelo ocupava uma faixa inteira abaixo do título. No
 * documento o botão é quadrado de 36px ao lado do título; quem passa `acoes`
 * esconde o rótulo no celular (`hidden sm:inline`) e o botão vira ícone.
 *
 * Páginas de detalhe publicam o próprio título como última migalha da trilha
 * do topo. Quem chama não precisa saber que a trilha existe.
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
  // Só página de detalhe alimenta a trilha: numa lista, a seção já é a última
  // migalha e repetir o nome daria "Orçamentos / Orçamentos".
  useMigalha(voltarPara ? titulo : null);

  return (
    // Sem faixa e sem borda: no documento o cabeçalho da página é o primeiro
    // bloco dentro do padding de 24px, sobre o mesmo cal do resto. A versão
    // anterior desenhava uma tarja `papel` sobre um corpo `papel-fundo` e
    // partia a área de conteúdo em duas cores que não existem no sistema.
    <header className="flex items-end justify-between gap-4 px-5 pt-5 md:px-6 md:pt-6">
      <div className="min-w-0">
        {/* O link de voltar some no desktop: lá a trilha da barra do topo faz
            esse trabalho, e os dois juntos são duas maneiras de subir um
            nível na mesma tela. */}
        {voltarPara && (
          <Link
            href={voltarPara}
            className="rotulo mb-2 inline-block underline underline-offset-4 md:hidden"
          >
            ← {voltarRotulo ?? "Voltar"}
          </Link>
        )}
        <h1 className="font-sans text-2xl leading-tight font-semibold -tracking-[0.025em] text-tinta md:text-[1.75rem]">
          {titulo}
        </h1>
        {meta && <p className="rotulo mt-2">{meta}</p>}
      </div>

      {acoes && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
    </header>
  );
}

/**
 * Área de conteúdo.
 *
 * Largura cheia, com 24px de folga — como no documento. Antes era
 * `max-w-4xl mx-auto`: numa tela de 1920 sobravam quase 300px de vazio de cada
 * lado, e o título nascia longe da barra lateral em vez de alinhado com ela.
 *
 * O `pt-5` é o intervalo de 20px entre o cabeçalho da página e o primeiro
 * bloco, que o documento usa como `gap` da coluna.
 */
export function Conteudo({ children }: { children: React.ReactNode }) {
  return <div className="w-full px-5 pt-5 pb-6 md:px-6 md:pb-6">{children}</div>;
}

/**
 * Cartão numérico do topo.
 *
 * Medidas do `Obra Nova UI.dc.html`: número em 600, `-.03em`, tabular, e o
 * cartão com uma faixa de 3px no topo na cor do estado. O app usava
 * `extrabold` — o documento não tem esse peso em número, e ele engrossava o
 * dígito a ponto de brigar com o título da página.
 *
 * A faixa é o que faz o estado ser lido antes do número, que é a razão de o
 * documento pintar cada cartão de uma cor no painel do diário.
 */
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
  /** `arroio` é medida (quanto andou), `amarelo` é atenção. */
  destaque?: "tinta" | "amarelo" | "arroio";
  dica?: string;
}) {
  const faixa =
    destaque === "arroio"
      ? "border-t-arroio"
      : destaque === "amarelo"
        ? "border-t-atencao-forte"
        : "border-t-tinta";

  return (
    // `h-full`: quando o cartão está dentro de outro elemento (um link, no
    // Painel), o grid estica o pai mas não o cartão — e o que não tem linha de
    // detalhe fica mais baixo que os vizinhos. Como filho direto do grid isto
    // é redundante e inofensivo.
    <div className={`h-full rounded-lg border border-nevoa border-t-[3px] bg-white px-5 py-4 ${faixa}`}>
      {/* A dica envolve só o rótulo, não o cartão inteiro: ancorada no cartão
          ela abriria a 5rem de distância do texto que explica. */}
      <p className="rotulo">
        {dica ? <Dica texto={dica}>{rotulo}</Dica> : rotulo}
      </p>
      {/* Valor de texto ("Respondendo") não cabe no corpo de número e vazava
          para fora do cartão. Palavra longa entra menor. */}
      <p
        className={`mt-2 font-sans leading-tight font-semibold break-words -tracking-[0.03em] tabular-nums ${
          typeof valor === "string" && valor.length > 4
            ? "text-xl md:text-2xl"
            : "text-[2.125rem] leading-none"
        } ${
          destaque === "arroio"
            ? "text-arroio-tinta"
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

/**
 * Estado vazio: onde a explicação da tela mora.
 *
 * Antes cada painel abria com um parágrafo dentro de um cartão branco
 * explicando para que servia a tela. Ficava lá para sempre, inclusive depois
 * de a pessoa já ter usado a coisa cem vezes — texto encaixotado ocupando o
 * lugar do conteúdo. A explicação só vale enquanto não há nada para ver, então
 * é aqui que ela pertence: quando a lista enche, some sozinha.
 *
 * Sem borda de propósito. Caixa em volta de frase pesa e finge ser conteúdo;
 * espaço em branco lê como lugar esperando ser preenchido, que é o que isto é.
 *
 * A cena é a caçamba vazia — o mesmo desenho em toda lista sem registro, para
 * o estado ser reconhecido antes de ser lido.
 */
export function Vazio({
  titulo,
  children,
  acao,
  ilustracao,
}: {
  titulo: string;
  /** Uma ou duas linhas. Se precisar de mais, o problema é outro. */
  children: React.ReactNode;
  /** O mesmo botão do cabeçalho, repetido onde o olho já está. */
  acao?: React.ReactNode;
  /** Troca a cena padrão quando o vazio tem outra causa (busca, filtro). */
  ilustracao?: React.ReactNode;
}) {
  return (
    <Cena
      ilustracao={ilustracao ?? <CenaVazio />}
      titulo={titulo}
      acao={acao}
      // `cal` e não `fundo`: a área de conteúdo do painel passou a ser papel
      // (#f5f2ec). O miolo dos objetos da cena precisa casar com o fundo onde
      // ela está, senão aparece uma mancha clara no meio do desenho.
      tom="cal"
    >
      {children}
    </Cena>
  );
}

/**
 * O cartão de dados de uma entidade: os campos à vista e um "Editar" que abre
 * o diálogo.
 *
 * Existe como peça compartilhada porque as duas telas de detalhe resolviam
 * isto de jeitos diferentes. O orçamento mostrava os campos num cartão com
 * "Editar" dentro; a obra não mostrava campo nenhum — tinha um botão
 * "Configurações" no cabeçalho da página que abria um formulário no meio do
 * conteúdo. Mesmo trabalho, duas interfaces, e na obra os dados só existiam
 * enquanto o formulário estava aberto.
 *
 * Ver o que está preenchido e o que está vazio é metade do trabalho: campo em
 * branco aparece como "não preenchido", não some.
 */
export function CartaoDeDados({
  titulo,
  aoEditar,
  children,
  rodape,
}: {
  titulo: string;
  aoEditar: () => void;
  /** Os `<Dado>` do cartão. */
  children: React.ReactNode;
  /** Bloco extra abaixo da grade, separado por um traço. */
  rodape?: React.ReactNode;
}) {
  return (
    <section className="cartao px-5 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="rotulo">{titulo}</p>
        <button
          type="button"
          onClick={aoEditar}
          className="btn btn-secundario btn-compacto"
        >
          <Lapis />
          Editar
        </button>
      </div>

      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </dl>

      {rodape && (
        <div className="mt-4 border-t border-cinza-100 pt-4">{rodape}</div>
      )}
    </section>
  );
}

/** Um campo do `CartaoDeDados`. */
export function Dado({
  rotulo,
  valor,
  vazio = "não preenchido",
  mono,
  dica,
  acao,
}: {
  rotulo: string;
  valor: string | null;
  vazio?: string;
  mono?: boolean;
  dica?: string;
  /** Ação que só faz sentido para este campo, ao lado do valor. */
  acao?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="rotulo">
        {dica ? <Dica texto={dica}>{rotulo}</Dica> : rotulo}
      </dt>
      <dd
        className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm leading-snug break-words ${
          valor ? "text-tinta" : "text-cinza-400 italic"
        } ${mono && valor ? "font-mono" : ""}`}
      >
        {valor || vazio}
        {acao}
      </dd>
    </div>
  );
}

export function Lapis() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-3.5 w-3.5 fill-none stroke-current"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM14 6l4 4" />
    </svg>
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
