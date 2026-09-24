"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SeletorDeEmpreiteira } from "./seletor-de-empreiteira";
import { ProvedorDaTrilha } from "./trilha";
import { Dialogo } from "@/components/comum/dialogo";
import { Logotipo } from "@/components/marca";
import type { OrgAcessivel } from "@/lib/admin/sessao";

/**
 * Casca do painel: navegação sempre no mesmo lugar.
 *
 * Segue o `Obra Nova UI.dc.html`, seções 01 (mobile) e 02 (desktop). Duas
 * montagens, os mesmos destinos:
 *
 * - **Celular**: barra fina grafite em cima (marca e avatar) e barra inferior
 *   fixa, branca, com borda névoa. Alvo de 64px, rótulo sempre visível.
 * - **Desktop**: barra lateral grafite com os destinos, e uma barra branca de
 *   64px no topo do conteúdo com a trilha à esquerda e o avatar à direita.
 *
 * **A regra do estado ativo, que o documento repete nas duas seções:** marca-se
 * com a *barra amarela*, nunca com fundo colorido. Na lateral a barra é à
 * esquerda (3px) sobre grafite; na barra inferior é acima (2px) com o símbolo
 * cheio.
 *
 * **O que saiu, e por quê.** Três coisas que o app tinha e o documento não:
 *
 * 1. O rótulo "Painel" sob a logo da lateral. A logo já diz onde se está, e o
 *    rótulo repetia a palavra que também é o nome de uma seção em outros
 *    produtos — ruído.
 * 2. O bloco de identidade no pé da lateral. A identidade subiu para o avatar
 *    da barra do topo, que é onde o documento a coloca, e "Sair" mora no
 *    Perfil.
 * 3. O rodapé "Obra Nova · Painel de obras" no fim do conteúdo. Assinatura de
 *    marca faz sentido na página que o *cliente* abre — e lá continua. Numa
 *    ferramenta interna, aberta dez vezes por dia, é só altura gasta.
 */

/**
 * `prefixos` em vez de um startsWith no href: cada item declara os caminhos que
 * são dele, porque /admin é prefixo de tudo que vem depois.
 */
type Destino = {
  href: string;
  rotulo: string;
  icone: () => React.ReactElement;
  prefixos: string[];
};

/**
 * Os quatro que ficam na barra do celular.
 *
 * São os de rotina em aparelho: o resumo do dia, a obra, a visita e o
 * documento. Barra inferior é alvo de 64px, e a partir de cinco colunas o
 * rótulo começa a quebrar — o nono destino não entrou empurrando os outros,
 * entrou atrás do "Mais".
 */
const PRINCIPAIS: Destino[] = [
  {
    href: "/admin",
    rotulo: "Painel",
    icone: Bussola,
    // Só a raiz: `/admin` é prefixo de tudo, então casar por prefixo deixaria
    // o Painel aceso em qualquer tela.
    prefixos: [],
  },
  {
    href: "/admin/obras",
    rotulo: "Obras",
    icone: Capacete,
    prefixos: ["/admin/obras"],
  },
  {
    href: "/admin/vistorias",
    rotulo: "Vistorias",
    icone: Trena,
    prefixos: ["/admin/vistorias"],
  },
  {
    href: "/admin/orcamentos",
    rotulo: "Orçamentos",
    icone: Prancheta,
    prefixos: ["/admin/orcamentos"],
  },
];

/**
 * O que mora atrás do "Mais".
 *
 * Não é "o que importa menos": é o que não se abre com o aparelho na mão no
 * meio da obra. Pipeline e Preços são trabalho de mesa, Transcrições é a
 * porta de entrada de um áudio avulso, e o Diário é escrito uma vez por dia.
 * Na lateral do desktop, onde sobra altura, os nove continuam à vista.
 */
const EXTRAS: Destino[] = [
  // Antes de Orçamentos na ordem da lateral porque é antes na vida: o pedido
  // chega, entra no funil, e só depois vira documento.
  {
    href: "/admin/pipeline",
    rotulo: "Pipeline",
    icone: Funil,
    prefixos: ["/admin/pipeline"],
  },
  {
    href: "/admin/transcricoes",
    rotulo: "Transcrições",
    icone: Onda,
    prefixos: ["/admin/transcricoes"],
  },
  {
    href: "/admin/precos",
    rotulo: "Preços",
    icone: Etiqueta,
    prefixos: ["/admin/precos"],
  },
  // Depois de Preços porque é vizinha dele na cabeça de quem usa: uma é a
  // tabela de referência que se importa de fora, a outra é o que a própria
  // empreiteira já cobrou. Quem vai orçar abre as duas.
  {
    href: "/admin/biblioteca",
    rotulo: "Biblioteca",
    icone: Estante,
    prefixos: ["/admin/biblioteca"],
  },
  {
    href: "/admin/diario",
    rotulo: "Diário",
    icone: Caderno,
    prefixos: ["/admin/diario"],
  },
  {
    href: "/admin/perfil",
    rotulo: "Perfil",
    icone: Pessoa,
    prefixos: ["/admin/perfil"],
  },
];

/**
 * A lateral do desktop mostra tudo, na ordem do fluxo de trabalho — e não na
 * ordem da barra do celular, que é ordem de frequência em aparelho.
 */
const ITENS: Destino[] = [
  PRINCIPAIS[0],
  PRINCIPAIS[1],
  EXTRAS[0],
  PRINCIPAIS[2],
  PRINCIPAIS[3],
  EXTRAS[1],
  EXTRAS[2],
  EXTRAS[3],
  EXTRAS[4],
  EXTRAS[5],
];

/** As iniciais do e-mail, para o avatar do documento (36px, arroio). */
function iniciais(email: string): string {
  const nome = email.split("@")[0] ?? "";
  const partes = nome.split(/[._-]+/).filter(Boolean);
  const letras =
    partes.length >= 2 ? `${partes[0][0]}${partes[1][0]}` : nome.slice(0, 2);
  return letras.toUpperCase();
}

export function Casca({
  email,
  avatar,
  orgs,
  orgAtiva,
  children,
}: {
  email: string;
  /** URL da foto do usuário. Sem ela, o avatar cai nas iniciais. */
  avatar: string | null;
  /** As empreiteiras acessíveis. Uma só, para usuário comum. */
  orgs: OrgAcessivel[];
  orgAtiva: string;
  children: React.ReactNode;
}) {
  const caminho = usePathname();
  const [gaveta, setGaveta] = useState(false);

  const ativo = (item: Destino) =>
    caminho === item.href || item.prefixos.some((p) => caminho.startsWith(p));

  const secao = ITENS.find(ativo) ?? null;
  const noPerfil = caminho.startsWith("/admin/perfil");
  const emExtra = EXTRAS.some(ativo);

  return (
    <ProvedorDaTrilha>
      {(migalha) => (
        <div className="flex min-h-dvh flex-col bg-papel">
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* ---------- Celular: barra fina no topo ---------- */}
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-tinta px-4 py-3 md:hidden">
            <Link href="/admin" aria-label="Painel" className="shrink-0">
              <Logotipo altura={24} className="text-papel" />
            </Link>

            {/* Entre o logo e o avatar: é o lugar onde a atenção já passa ao
                conferir onde está, sem virar uma faixa própria. */}
            <SeletorDeEmpreiteira orgs={orgs} ativa={orgAtiva} variante="topo" />

            <div className="ml-auto shrink-0">
              <Avatar email={email} avatar={avatar} destacado={noPerfil} />
            </div>
          </header>

          {/* ---------- Desktop: barra lateral ---------- */}
          {/* overflow-clip contém qualquer dica que encoste na borda sem criar
              um contexto de rolagem, que quebraria o sticky. */}
          <aside className="hidden shrink-0 flex-col overflow-clip bg-tinta md:sticky md:top-0 md:flex md:h-dvh md:w-60">
            <Link href="/admin" className="px-5 py-6">
              <Logotipo altura={28} className="text-papel" />
            </Link>

            {/* Sem padding lateral no nav: a barra amarela do item ativo nasce
                na borda da lateral, como no documento. Com padding ela
                flutuaria no meio do grafite. */}
            <nav className="flex-1">
              <ul className="flex flex-col">
                {ITENS.map((item) => {
                  const Icone = item.icone;
                  const selecionado = ativo(item);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={selecionado ? "page" : undefined}
                        className={`flex items-center gap-3 border-l-[3px] px-5 py-3 text-[0.9375rem] transition ${
                          selecionado
                            ? "border-amarelo bg-grafite font-semibold text-papel"
                            : "border-transparent text-cinza-400 hover:bg-grafite hover:text-papel"
                        }`}
                      >
                        <Icone />
                        {item.rotulo}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* No rodapé, fora do `nav`: não é destino, é contexto de tudo que
                está acima. Fica colado no fim da coluna porque o `nav` é
                flex-1. */}
            <SeletorDeEmpreiteira
              orgs={orgs}
              ativa={orgAtiva}
              variante="lateral"
            />
          </aside>

          <div className="flex min-w-0 flex-1 flex-col overflow-clip pb-[var(--altura-abas)] md:pb-0">
            {/* ---------- Desktop: barra do topo ---------- */}
            {/* Só no desktop: no celular a trilha seria uma quarta faixa de
                cromo numa tela que já tem cabeçalho, título e abas. */}
            <div className="hidden h-16 shrink-0 items-center justify-between gap-4 border-b border-nevoa bg-white px-6 md:flex">
              <nav aria-label="Trilha" className="min-w-0">
                <ol className="flex min-w-0 items-center gap-2 text-[0.8125rem]">
                  {secao ? (
                    <li className="shrink-0">
                      {migalha ? (
                        <Link
                          href={secao.href}
                          className="text-fumaca transition hover:text-tinta"
                        >
                          {secao.rotulo}
                        </Link>
                      ) : (
                        <span className="font-semibold text-tinta">
                          {secao.rotulo}
                        </span>
                      )}
                    </li>
                  ) : (
                    <li className="shrink-0 font-semibold text-tinta">Painel</li>
                  )}

                  {migalha && (
                    <>
                      <li aria-hidden className="shrink-0 text-concreto">
                        /
                      </li>
                      <li className="min-w-0 truncate font-semibold text-tinta">
                        {migalha}
                      </li>
                    </>
                  )}
                </ol>
              </nav>

              <Avatar email={email} avatar={avatar} destacado={noPerfil} />
            </div>

            <div className="flex-1">{children}</div>
          </div>

          {/* ---------- Celular: abas fixas embaixo ---------- */}
          {/* Fixa, e não no fim do fluxo: a navegação some da tela ao rolar uma
              lista longa se ela acompanhar o documento, e é justamente numa
              lista longa que dá vontade de trocar de seção. */}
          <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-nevoa bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
            <ul className="grid grid-cols-5">
              {PRINCIPAIS.map((item) => {
                const Icone = item.icone;
                const selecionado = ativo(item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={selecionado ? "page" : undefined}
                      // `-mt-px` puxa a barra amarela sobre a borda névoa do
                      // topo: as duas ocupam a mesma linha em vez de empilhar
                      // 3px de traço.
                      className={`-mt-px flex h-16 flex-col items-center justify-center gap-1.5 border-t-2 transition ${
                        selecionado
                          ? "border-amarelo text-tinta"
                          : "border-transparent text-cinza-400"
                      }`}
                    >
                      <Icone />
                      <span
                        className={`text-[0.625rem] leading-none ${
                          selecionado ? "font-semibold" : ""
                        }`}
                      >
                        {item.rotulo}
                      </span>
                    </Link>
                  </li>
                );
              })}

              {/* O quinto alvo não é um destino, é a gaveta. Acende igual aos
                  outros quando a tela aberta está lá dentro: senão a barra
                  diria que não se está em lugar nenhum. */}
              <li>
                <button
                  type="button"
                  onClick={() => setGaveta(true)}
                  aria-expanded={gaveta}
                  className={`-mt-px flex h-16 w-full flex-col items-center justify-center gap-1.5 border-t-2 transition ${
                    emExtra
                      ? "border-amarelo text-tinta"
                      : "border-transparent text-cinza-400"
                  }`}
                >
                  <Grade />
                  <span
                    className={`text-[0.625rem] leading-none ${
                      emExtra ? "font-semibold" : ""
                    }`}
                  >
                    Mais
                  </span>
                </button>
              </li>
            </ul>
          </nav>

          <Gaveta
            aberta={gaveta}
            aoFechar={() => setGaveta(false)}
            ativo={ativo}
          />
          </div>
        </div>
      )}
    </ProvedorDaTrilha>
  );
}

/**
 * A gaveta do "Mais".
 *
 * Um `<dialog>` pelo componente que o painel já usa: foco preso dentro, Esc
 * fechando e o resto da página inerte saem de graça, e no celular ele já sobe
 * como folha de baixo — que é a forma certa para uma gaveta acionada no pé da
 * tela.
 */
function Gaveta({
  aberta,
  aoFechar,
  ativo,
}: {
  aberta: boolean;
  aoFechar: () => void;
  ativo: (item: Destino) => boolean;
}) {
  return (
    <Dialogo
      aberto={aberta}
      aoFechar={aoFechar}
      titulo="Mais"
      descricao="O resto do aplicativo."
      estreito
    >
      <ul className="grid grid-cols-3 gap-2">
        {EXTRAS.map((item) => {
          const Icone = item.icone;
          const selecionado = ativo(item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                // Fechar no clique, e não num efeito que observa a rota: a
                // gaveta só se sai por aqui, e setState dentro de efeito é o
                // que o lint do projeto barra.
                onClick={aoFechar}
                aria-current={selecionado ? "page" : undefined}
                className={`flex h-24 flex-col items-center justify-center gap-2 rounded-cartao border px-2 text-center transition ${
                  selecionado
                    ? "border-tinta bg-papel text-tinta"
                    : "border-nevoa text-fumaca hover:border-concreto hover:text-tinta"
                }`}
              >
                <Icone />
                <span className="text-xs leading-tight">{item.rotulo}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Dialogo>
  );
}

/**
 * O avatar do documento: 36px, círculo arroio, iniciais em 13px semibold.
 *
 * É a porta da conta nas duas montagens — no celular fica no cabeçalho, no
 * desktop na barra do topo. Amarelo quando já se está no Perfil, porque um
 * atalho que aponta para onde você já está precisa dizer isso.
 */
function Avatar({
  email,
  avatar,
  destacado,
}: {
  email: string;
  avatar: string | null;
  destacado: boolean;
}) {
  return (
    <Link
      href="/admin/perfil"
      aria-label="Perfil e conta"
      aria-current={destacado ? "page" : undefined}
      // O anel amarelo substitui o fundo amarelo quando há foto: pintar o
      // fundo não marcaria nada atrás de uma imagem que cobre o círculo todo.
      className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-[0.8125rem] font-semibold transition ${
        avatar
          ? destacado
            ? "ring-2 ring-amarelo ring-offset-2 ring-offset-tinta"
            : ""
          : destacado
            ? "bg-amarelo text-tinta"
            : "bg-arroio text-papel"
      }`}
    >
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="" className="h-full w-full object-cover" />
      ) : (
        iniciais(email)
      )}
    </Link>
  );
}

function Bussola() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </svg>
  );
}

function Capacete() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 16a9 9 0 0 1 18 0M2 16h20v2H2zM10 3h4v4M9 16V7M15 16V7" />
    </svg>
  );
}

function Prancheta() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6v3H9zM6 5h1.5M16.5 5H18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1M9 11h6M9 15h4" />
    </svg>
  );
}

/** Funil: entra muito pedido em cima, sai obra fechada embaixo. */
function Funil() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z" />
    </svg>
  );
}

/** Trena: a medida tirada no local, que é o que a vistoria captura. */
function Trena() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h18v8H3zM7 8v3M11 8v4M15 8v3M19 8v4" />
    </svg>
  );
}

/** Onda sonora: o áudio que chegou de fora e vira texto. */
function Onda() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round">
      <path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4" />
    </svg>
  );
}

function Etiqueta() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3h6a1 1 0 0 1 1 1v6l-9.3 9.3a1 1 0 0 1-1.4 0L3.7 14.7a1 1 0 0 1 0-1.4L12 3Z" />
      <circle cx="15.5" cy="7.5" r="1.3" />
    </svg>
  );
}

/**
 * Estante: três lombadas na prateleira.
 *
 * Não um livro aberto — livro aberto é "ler agora", e a Biblioteca é o
 * contrário: é o acervo a que se volta. A lombada inclinada da direita é o
 * volume que alguém tirou e devolveu torto, que é como estante de verdade
 * fica.
 */
function Estante() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h3v16H4zM9.5 4h3v16h-3z" />
      <path d="m16 4.8 2.9.8-4 14.6-2.9-.8z" />
    </svg>
  );
}

/** Caderno: o dia escrito à mão, que é o que o Diário é. */
function Caderno() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM4 17h14M9 8h5M9 12h5" />
    </svg>
  );
}

/** A grade de nove pontos: o gesto universal de "o resto do aplicativo". */
function Grade() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 fill-current" aria-hidden>
      <circle cx="6" cy="6" r="1.7" />
      <circle cx="12" cy="6" r="1.7" />
      <circle cx="18" cy="6" r="1.7" />
      <circle cx="6" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="18" cy="12" r="1.7" />
      <circle cx="6" cy="18" r="1.7" />
      <circle cx="12" cy="18" r="1.7" />
      <circle cx="18" cy="18" r="1.7" />
    </svg>
  );
}

/** O busto do documento: círculo da cabeça e o arco dos ombros. */
function Pessoa() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
