"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logotipo, RodapeDaMarca } from "@/components/marca";
import { supabaseNavegador } from "@/lib/supabase/navegador";

/**
 * Casca do painel: navegação sempre no mesmo lugar.
 *
 * Barra lateral escura no desktop, barra superior no celular. A árvore com as
 * obras e as abas dentro dela foi testada e removida: empilhava três níveis num
 * espaço estreito e competia com as abas da própria página, que já dizem a
 * mesma coisa.
 */

/**
 * `prefixos` em vez de um startsWith no href: cada item declara os caminhos que
 * são dele, porque /admin é prefixo de tudo que vem depois.
 */
const ITENS = [
  {
    href: "/admin/obras",
    rotulo: "Obras",
    icone: Capacete,
    prefixos: ["/admin/obras"],
  },
];

export function Casca({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const caminho = usePathname();
  const router = useRouter();

  const ativo = (item: (typeof ITENS)[number]) =>
    caminho === item.href || item.prefixos.some((p) => caminho.startsWith(p));

  async function sair() {
    await supabaseNavegador().auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh flex-col bg-papel-fundo md:flex-row">
      {/* overflow-clip: a dica do botão Sair fica na borda de baixo da barra e
          seu tooltip (absolute, invisível mas presente no layout) vazava
          38px abaixo da tela — o fundo quase branco do body aparecia como
          uma barra sob a sidebar e a página. */}
      <aside className="flex shrink-0 flex-col overflow-clip bg-tinta md:sticky md:top-0 md:h-dvh md:w-60">
        <Link
          href="/admin"
          className="flex flex-col gap-1.5 px-5 py-4 md:px-6 md:py-6"
        >
          <Logotipo altura={22} className="text-papel" />
          <p className="rotulo rotulo-claro">Painel</p>
        </Link>

        {/* A rolagem horizontal precisa ficar no nav: no ul ela não contém,
            porque o ul é filho flex e não encolhe abaixo do conteúdo. */}
        <nav className="overflow-x-auto px-3 pb-3 md:flex-1 md:overflow-visible">
          <ul className="flex gap-1 md:flex-col">
            {ITENS.map((item) => {
              const Icone = item.icone;
              const selecionado = ativo(item);
              return (
                <li key={item.href} className="shrink-0 md:w-full">
                  <Link
                    href={item.href}
                    aria-current={selecionado ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                      selecionado
                        ? "bg-papel text-tinta"
                        : "text-nevoa md:hover:bg-grafite"
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

        {/* Altura compartilhada com o rodapé do conteúdo: é o que faz os dois
            traços virarem uma linha só ao chegar no fim da página. */}
        <div className="hidden h-[var(--altura-rodape)] shrink-0 flex-col justify-center border-t border-fumaca px-5 md:flex">
          <p className="truncate font-mono text-[0.6rem] text-concreto">{email}</p>
          <button
            type="button"
            onClick={() => void sair()}
            className="mt-1.5 self-start font-mono text-[0.65rem] tracking-widest text-nevoa uppercase underline underline-offset-2"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* clip nos dois eixos e não hidden: contém qualquer dica que encoste na
          borda sem criar um contexto de rolagem, que quebraria o sticky da
          barra lateral. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-clip">
        <div className="flex-1">{children}</div>

        <div className="flex h-[var(--altura-rodape)] shrink-0 items-center">
          <div className="mx-auto w-full max-w-4xl px-5 md:px-8">
            <RodapeDaMarca nota="Painel de obras" semBorda />
          </div>
        </div>
      </div>
    </div>
  );
}

function Capacete() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 16a9 9 0 0 1 18 0M2 16h20v2H2zM10 3h4v4M9 16V7M15 16V7" />
    </svg>
  );
}
