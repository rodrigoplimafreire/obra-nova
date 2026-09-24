"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Cabecalho, Conteudo, Secao, Vazio } from "./cabecalho";
import { Dica } from "@/components/comum/dica";
import { CenaSemResultado } from "@/components/comum/ilustracoes";
import { moeda } from "@/lib/orcamento/formato";
import type { ServicoDaBiblioteca } from "@/lib/orcamento/biblioteca";

/**
 * A Biblioteca: o que a empreiteira já orçou, para consultar antes de orçar de
 * novo.
 *
 * **A busca é a tela.** Quem abre aqui não veio navegar uma árvore de
 * categorias; veio com um serviço na cabeça — "quanto foi o m² de reboco?" — e
 * quer digitar "reboco" e ver. Por isso o campo é a primeira coisa, com foco
 * automático, e os filtros são pastilhas ao lado, não um formulário.
 *
 * **O preço não é média.** Cada serviço mostra o último preço praticado e, se
 * houve mais de um, a faixa. Abrir a linha mostra cada ocorrência com cliente e
 * data. Média de dois orçamentos separados por um ano é número bonito e
 * inútil — quem vai orçar precisa saber de quando é o preço e de que obra.
 *
 * A exportação sai do que está na tela, com os filtros aplicados: exportar a
 * base inteira quando se está olhando três linhas é dar trabalho a quem já
 * tinha achado o que queria.
 */

type Filtro = "todos" | "com-preco" | "sem-preco";

const DATA = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

function baixar(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

/** Campo de CSV: o ponto e vírgula é o separador que o Excel-pt-BR espera. */
function csv(valor: string | number | null): string {
  if (valor == null) return "";
  const s = String(valor);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function PainelDaBiblioteca({
  servicos,
}: {
  servicos: ServicoDaBiblioteca[];
}) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [aberto, setAberto] = useState<string | null>(null);

  const termos = busca
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const visiveis = useMemo(() => {
    return servicos.filter((s) => {
      if (filtro === "com-preco" && s.ultimoUnitario == null) return false;
      if (filtro === "sem-preco" && s.ultimoUnitario != null) return false;
      if (termos.length === 0) return true;
      // Busca também no cliente: "o que a gente fez na casa da Izonete" é uma
      // pergunta tão comum quanto "quanto custou o reboco".
      const alvo = `${s.chave} ${s.grupos.join(" ")} ${s.ocorrencias
        .map((o) => o.cliente)
        .join(" ")}`
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();
      return termos.every((t) => alvo.includes(t));
    });
  }, [servicos, filtro, termos]);

  const comPreco = servicos.filter((s) => s.ultimoUnitario != null).length;
  const ocorrencias = servicos.reduce((soma, s) => soma + s.vezes, 0);

  const exportarMd = () => {
    const linhas = [
      "# Biblioteca de serviços · Obra Nova",
      "",
      `${visiveis.length} serviços${busca ? ` para "${busca}"` : ""}, exportados em ${new Date().toLocaleDateString("pt-BR")}.`,
      "",
      "| Serviço | Un. | Último preço | Faixa | Vezes | Onde |",
      "|---|---|---:|---|---:|---|",
      ...visiveis.map((s) => {
        const faixa =
          s.menorUnitario != null && s.maiorUnitario !== s.menorUnitario
            ? `${moeda(s.menorUnitario)} – ${moeda(s.maiorUnitario!)}`
            : "—";
        const onde = [...new Set(s.ocorrencias.map((o) => o.cliente))].join(", ");
        return `| ${s.descricao.replace(/\|/g, "\\|")} | ${s.unidade ?? "—"} | ${
          s.ultimoUnitario != null ? moeda(s.ultimoUnitario) : "—"
        } | ${faixa} | ${s.vezes} | ${onde.replace(/\|/g, "\\|")} |`;
      }),
    ];
    baixar("biblioteca-de-servicos.md", linhas.join("\n") + "\n", "text/markdown");
  };

  const exportarCsv = () => {
    const linhas = [
      ["Serviço", "Unidade", "Último preço", "Menor", "Maior", "Vezes", "Clientes"]
        .map(csv)
        .join(";"),
      ...visiveis.map((s) =>
        [
          csv(s.descricao),
          csv(s.unidade),
          csv(s.ultimoUnitario),
          csv(s.menorUnitario),
          csv(s.maiorUnitario),
          csv(s.vezes),
          csv([...new Set(s.ocorrencias.map((o) => o.cliente))].join(", ")),
        ].join(";"),
      ),
    ];
    // BOM: sem ele o Excel no Windows abre "Demolição" como "DemoliÃ§Ã£o".
    baixar("biblioteca-de-servicos.csv", "﻿" + linhas.join("\n") + "\n", "text/csv");
  };

  return (
    <>
      <Cabecalho
        titulo="Biblioteca"
        meta={`${servicos.length} serviços · ${ocorrencias} vezes orçados · ${comPreco} com preço`}
        acoes={
          servicos.length > 0 ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={exportarCsv}
                className="btn btn-secundario btn-icone sm:w-auto sm:px-5"
                aria-label="Exportar CSV"
              >
                <Baixar />
                <span className="hidden sm:inline">CSV</span>
              </button>
              <button
                type="button"
                onClick={exportarMd}
                className="btn btn-primario btn-icone sm:w-auto sm:px-5"
                aria-label="Exportar Markdown"
              >
                <Baixar />
                <span className="hidden sm:inline">Markdown</span>
              </button>
            </div>
          ) : undefined
        }
      />

      <Conteudo>
        {servicos.length === 0 ? (
          <Vazio titulo="Nada orçado ainda">
            A Biblioteca se enche sozinha: cada serviço lançado num orçamento
            aparece aqui na hora, com o preço e a obra em que foi usado.
          </Vazio>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar serviço, grupo ou cliente…"
                aria-label="Buscar na biblioteca"
                autoFocus
                className="campo flex-1"
              />
              <div className="flex gap-2">
                {(
                  [
                    ["todos", "Todos"],
                    ["com-preco", "Com preço"],
                    ["sem-preco", "Sem preço"],
                  ] as const
                ).map(([valor, rotulo]) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setFiltro(valor)}
                    aria-pressed={filtro === valor}
                    className={`pastilha ${filtro === valor ? "pastilha-ativa" : ""}`}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
            </div>

            <Secao
              titulo={
                visiveis.length === servicos.length
                  ? "Serviços"
                  : `${visiveis.length} de ${servicos.length}`
              }
            >
              {visiveis.length === 0 ? (
                <Vazio
                  titulo="Nada com esse termo"
                  ilustracao={<CenaSemResultado />}
                >
                  Tente uma palavra sozinha — “reboco”, “pintura”, “laje”. A
                  busca é por pedaço do texto, não por frase inteira.
                </Vazio>
              ) : (
                <div className="cartao overflow-hidden">
                  <table className="tabela">
                    <thead>
                      <tr>
                        <th>Serviço</th>
                        <th>Un.</th>
                        <th className="num">Último preço</th>
                        <th className="num">Vezes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiveis.map((s) => {
                        const expandido = aberto === s.chave;
                        return (
                          <tr key={s.chave}>
                            <td colSpan={4} className="!p-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setAberto(expandido ? null : s.chave)
                                }
                                aria-expanded={expandido}
                                className="grid w-full grid-cols-[1fr_auto_auto_auto] items-start gap-4 p-4 text-left hover:bg-papel-fundo"
                              >
                                <span>
                                  <span className="block text-sm">
                                    {s.descricao}
                                  </span>
                                  {s.grupos.length > 0 && (
                                    <span className="mt-1 block font-mono text-[0.625rem] uppercase tracking-wider text-cinza">
                                      {s.grupos.join(" · ")}
                                    </span>
                                  )}
                                </span>
                                <span className="font-mono text-[0.8125rem] text-cinza">
                                  {s.unidade ?? "—"}
                                </span>
                                <span className="text-right font-mono text-[0.8125rem] tabular-nums">
                                  {s.ultimoUnitario != null ? (
                                    <>
                                      {moeda(s.ultimoUnitario)}
                                      {s.menorUnitario !== s.maiorUnitario && (
                                        <span className="mt-0.5 block text-[0.6875rem] text-cinza">
                                          {moeda(s.menorUnitario!)} –{" "}
                                          {moeda(s.maiorUnitario!)}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <Dica texto="Orçamento de valor fechado: o preço não foi lançado por item.">
                                      <span className="text-cinza">—</span>
                                    </Dica>
                                  )}
                                </span>
                                <span className="text-right font-mono text-[0.8125rem] tabular-nums text-cinza">
                                  {s.vezes}×
                                </span>
                              </button>

                              {expandido && (
                                <div className="border-t border-cinza-100 bg-papel px-4 py-3">
                                  <ul className="grid gap-2">
                                    {s.ocorrencias.map((o, i) => (
                                      <li
                                        key={i}
                                        className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[0.8125rem]"
                                      >
                                        <Link
                                          href={`/admin/orcamentos/${o.orcamentoId}`}
                                          className="underline decoration-cinza-200 underline-offset-2 hover:decoration-tinta"
                                        >
                                          {o.cliente}
                                        </Link>
                                        <span className="font-mono text-cinza">
                                          {o.quantidade != null
                                            ? `${o.quantidade} ${o.unidade ?? ""}`
                                            : (o.unidade ?? "—")}
                                          {o.valorUnitario != null &&
                                            ` · ${moeda(o.valorUnitario)}`}
                                          {o.total != null &&
                                            ` · total ${moeda(o.total)}`}
                                          {" · "}
                                          {DATA.format(new Date(o.em))}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Secao>
          </>
        )}
      </Conteudo>
    </>
  );
}

function Baixar() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3v12M7 10l5 5 5-5M4 19h16" />
    </svg>
  );
}
