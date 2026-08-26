"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProvedorDaTrilha } from "./trilha";
import { Logotipo } from "@/components/marca";

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
const ITENS = [
  {
    href: "/admin",
    rotulo: "Painel",
    icone: Bussola,
    // Só a raiz: `/admin` é prefixo de tudo, então casar por prefixo deixaria
    // o Painel aceso em qualquer tela.
    prefixos: [] as string[],
  },
  {
    href: "/admin/obras",
    rotulo: "Obras",
    icone: Capacete,
    prefixos: ["/admin/obras"],
  },
  {
    href: "/admin/orcamentos",
    rotulo: "Orçamentos",
    icone: Prancheta,
    prefixos: ["/admin/orcamentos"],
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
  {
    href: "/admin/perfil",
    rotulo: "Perfil",
    icone: Pessoa,
    prefixos: ["/admin/perfil"],
  },
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
  children,
}: {
  email: string;
  /** URL da foto do usuário. Sem ela, o avatar cai nas iniciais. */
  avatar: string | null;
  children: React.ReactNode;
}) {
  const caminho = usePathname();

  const ativo = (item: (typeof ITENS)[number]) =>
    caminho === item.href || item.prefixos.some((p) => caminho.startsWith(p));

  const secao = ITENS.find(ativo) ?? null;
  const noPerfil = caminho.startsWith("/admin/perfil");

  return (
    <ProvedorDaTrilha>
      {(migalha) => (
        <div className="flex min-h-dvh flex-col bg-papel md:flex-row">
          {/* ---------- Celular: barra fina no topo ---------- */}
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-tinta px-4 py-3 md:hidden">
            <Link href="/admin" aria-label="Painel">
              <Logotipo altura={24} className="text-papel" />
            </Link>

            <Avatar email={email} avatar={avatar} destacado={noPerfil} />
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
            <ul className="grid grid-cols-6">
              {ITENS.map((item) => {
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
            </ul>
          </nav>
        </div>
      )}
    </ProvedorDaTrilha>
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

/** O busto do documento: círculo da cabeça e o arco dos ombros. */
function Pessoa() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
