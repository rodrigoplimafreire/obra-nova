"use client";

import Link from "next/link";
import { Cabecalho, Conteudo, Indicador, Secao } from "./cabecalho";
import { moeda } from "@/lib/orcamento/formato";
import type { VisaoDoDia } from "@/lib/admin/visao-do-dia";

/**
 * A abertura do painel.
 *
 * `/admin` só redirecionava para Obras, e não havia lugar que respondesse "o
 * que precisa de mim hoje?" — a resposta estava repartida entre três telas.
 *
 * Nada aqui é número novo: todos já existiam nas listas. O que muda é o
 * agrupamento, por urgência em vez de por seção. E cada cartão leva para o
 * lugar onde se resolve aquilo — indicador que não é porta é só enfeite.
 */

const DATA = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  timeZone: "America/Sao_Paulo",
});

export function TelaDeInicio({
  visao,
  nome,
}: {
  visao: VisaoDoDia;
  /** O nome da empreiteira, quando preenchido no Perfil. */
  nome: string | null;
}) {
  const comecando = !visao.temOrcamento && !visao.temObra;

  return (
    <>
      <Cabecalho
        titulo={nome ?? "Painel"}
        meta={DATA.format(new Date()).replace(",", " ·")}
      />

      <Conteudo>
        {comecando ? (
          <PrimeirosPassos visao={visao} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Atalho href="/admin/orcamentos">
                <Indicador
                  rotulo="Na rua"
                  valor={visao.orcamentosNaRua}
                  detalhe="enviados, sem desfecho"
                  destaque={visao.orcamentosNaRua > 0 ? "arroio" : undefined}
                />
              </Atalho>
              <Atalho href="/admin/orcamentos">
                <Indicador
                  rotulo="Itens sem preço"
                  valor={visao.itensSemPreco}
                  detalhe={
                    visao.itensSemPreco > 0 ? "impede publicar" : "nada travado"
                  }
                  destaque={visao.itensSemPreco > 0 ? "amarelo" : undefined}
                />
              </Atalho>
              <Atalho href="/admin/obras">
                <Indicador
                  rotulo="Obras ativas"
                  valor={visao.obrasAtivas}
                />
              </Atalho>
              <Atalho href="/admin/obras">
                <Indicador
                  rotulo="Falta confirmar"
                  valor={visao.confirmacoesPendentes}
                  detalhe="serviços de hoje"
                  destaque={
                    visao.confirmacoesPendentes > 0 ? "amarelo" : undefined
                  }
                />
              </Atalho>
            </div>

            <Secao titulo="Fechado">
              <div className="cartao flex flex-wrap items-end justify-between gap-4 px-5 py-5">
                <div className="min-w-0">
                  <p className="rotulo">Valor aprovado</p>
                  <p className="mt-2 font-sans text-[2.125rem] leading-none font-semibold -tracking-[0.03em] text-tinta tabular-nums">
                    {moeda(visao.valorAprovado)}
                  </p>
                  <p className="mt-1.5 text-xs text-cinza">
                    Congelado no aceite de cada orçamento.
                  </p>
                </div>
                <Link href="/admin/orcamentos" className="btn btn-secundario btn-compacto">
                  Ver orçamentos
                </Link>
              </div>
            </Secao>

            {/* O roteiro continua aparecendo depois do primeiro orçamento até o
                ciclo fechar: quem criou e parou no meio precisa mais de
                direção do que quem ainda não começou. */}
            {!visao.temObra && <PrimeirosPassos visao={visao} compacto />}
          </>
        )}
      </Conteudo>
    </>
  );
}

/** O cartão inteiro vira link, sem perder o desenho do `Indicador`. */
function Atalho({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    // `block h-full` para o link ocupar a altura que o grid lhe deu: sem isso
    // ele encolhe no conteúdo e o cartão de dentro não tem o que preencher.
    <Link href={href} className="block h-full rounded-lg transition md:hover:opacity-80">
      {children}
    </Link>
  );
}

/**
 * O roteiro de quem acabou de receber a conta.
 *
 * A ordem é a do produto, não a do cadastro: começa pelo **orçamento**, que é
 * o que decide se a obra existe. Cadastrar obra antes de ter serviço fechado é
 * encher o painel de coisa que talvez não aconteça.
 */
function PrimeirosPassos({
  visao,
  compacto = false,
}: {
  visao: VisaoDoDia;
  compacto?: boolean;
}) {
  const passos = [
    {
      feito: visao.temOrcamento,
      titulo: "Crie o primeiro orçamento",
      texto: "Só o nome do cliente é obrigatório.",
      href: "/admin/orcamentos",
      acao: "Ir para Orçamentos",
    },
    {
      feito: visao.temFala,
      titulo: "Fale o serviço",
      texto: "A IA transcreve e monta a tabela de custos. Você corrige.",
      href: "/admin/orcamentos",
      acao: "Abrir o orçamento",
    },
    {
      feito: visao.temPublicacao,
      titulo: "Publique para o cliente",
      texto: "Sai um link com senha, na marca da empreiteira.",
      href: "/admin/orcamentos",
      acao: "Publicar",
    },
    {
      feito: visao.temObra,
      titulo: "Aprovado? Vire obra",
      texto: "O canteiro nasce com os dados do orçamento.",
      href: "/admin/obras",
      acao: "Ver obras",
    },
  ];

  const feitos = passos.filter((p) => p.feito).length;
  const proximo = passos.find((p) => !p.feito);

  return (
    <section className={compacto ? "mt-8" : ""}>
      <div className="overflow-hidden rounded-lg bg-tinta">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4">
          <div className="min-w-0">
            <p className="rotulo rotulo-claro">Primeiros passos</p>
            <p className="mt-2 font-sans text-xl leading-tight font-semibold -tracking-[0.02em] text-papel">
              Comece pelo orçamento, não pelo cadastro
            </p>
            <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-nevoa">
              É o orçamento que decide se a obra existe. Aprovado, ele vira
              canteiro com um clique.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="flex gap-1" aria-hidden>
              {passos.map((p, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-6 rounded-full ${p.feito ? "bg-amarelo" : "bg-grafite"}`}
                />
              ))}
            </div>
            <p className="font-mono text-[0.65rem] tracking-widest text-concreto uppercase">
              {feitos} de {passos.length}
            </p>
          </div>
        </div>

        <ul className="border-t border-grafite">
          {passos.map((p, i) => {
            const atual = p === proximo;
            return (
              <li
                key={i}
                className="flex flex-wrap items-center gap-3 border-b border-grafite px-5 py-3.5 last:border-b-0"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[0.65rem]">
                  {p.feito ? (
                    <Certo />
                  ) : (
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                        atual
                          ? "border-amarelo text-amarelo"
                          : "border-fumaca text-cinza-400"
                      }`}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm font-semibold ${p.feito ? "text-cinza-400 line-through" : "text-papel"}`}
                  >
                    {p.titulo}
                  </span>
                  {!p.feito && (
                    <span className="mt-0.5 block text-xs leading-snug text-nevoa">
                      {p.texto}
                    </span>
                  )}
                </span>

                {atual && (
                  <Link href={p.href} className="btn btn-primario btn-compacto shrink-0">
                    {p.acao}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Certo() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 fill-none stroke-arroio"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12.5 9.5 18 20 6.5" />
    </svg>
  );
}
