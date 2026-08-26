"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialogo } from "@/components/comum/dialogo";
import { Girando } from "@/components/comum/esqueleto";
import {
  importarItens,
  type ItemImportado,
} from "@/lib/orcamento/acoes-importar-itens";
import { lerNumero } from "@/lib/orcamento/formato";

/**
 * Traz uma planilha de orçamento pronta para dentro da tabela.
 *
 * Mesmo mapeamento de coluna do importador de preços, e pelo mesmo motivo:
 * cada planilha tem um layout, e reconhecer "a" planilha certa quebra no
 * primeiro arquivo diferente. Aqui o alvo são as colunas da tabela de custos —
 * descrição, quantidade, unidade, custo e venda.
 */

type LinhaBruta = (string | number)[];
type Campo = "grupo" | "descricao" | "quantidade" | "unidade" | "custo" | "venda";

const CAMPOS: { chave: Campo; rotulo: string; obrigatorio: boolean }[] = [
  { chave: "descricao", rotulo: "Descrição", obrigatorio: true },
  { chave: "quantidade", rotulo: "Qtd.", obrigatorio: false },
  { chave: "unidade", rotulo: "Unid.", obrigatorio: false },
  { chave: "custo", rotulo: "Custo", obrigatorio: false },
  { chave: "venda", rotulo: "Venda", obrigatorio: false },
  { chave: "grupo", rotulo: "Grupo", obrigatorio: false },
];

function letraDaColuna(indice: number): string {
  let n = indice;
  let letra = "";
  do {
    letra = String.fromCharCode(65 + (n % 26)) + letra;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letra;
}

export function ImportarItens({
  orcamentoId,
  aberto,
  aoFechar,
}: {
  orcamentoId: string;
  aberto: boolean;
  aoFechar: () => void;
}) {
  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Importar tabela"
      descricao="Traga um orçamento já pronto do seu computador. Você diz qual coluna é qual."
    >
      {aberto && <Miolo orcamentoId={orcamentoId} aoFechar={aoFechar} />}
    </Dialogo>
  );
}

function Miolo({
  orcamentoId,
  aoFechar,
}: {
  orcamentoId: string;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [linhas, setLinhas] = useState<LinhaBruta[] | null>(null);
  const [nomeDoArquivo, setNomeDoArquivo] = useState("");
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [importados, setImportados] = useState<number | null>(null);
  const [primeiraLinha, setPrimeiraLinha] = useState(2);

  const [mapa, setMapa] = useState<Record<Campo, number | null>>({
    grupo: null,
    descricao: null,
    quantidade: null,
    unidade: null,
    custo: null,
    venda: null,
  });

  async function lerArquivo(arquivo: File) {
    setErro(null);
    setLendo(true);
    try {
      // Import dinâmico: o parser só entra no bundle de quem abre o
      // importador, não no resto do painel.
      const XLSX = await import("xlsx");
      const pasta = XLSX.read(await arquivo.arrayBuffer(), { type: "array" });
      const aba = pasta.Sheets[pasta.SheetNames[0]];
      const bruto = XLSX.utils.sheet_to_json<LinhaBruta>(aba, {
        header: 1,
        raw: true,
        defval: "",
      });

      if (!bruto.length) {
        setErro("A planilha não tem linhas.");
        return;
      }

      setLinhas(bruto);
      setNomeDoArquivo(arquivo.name);

      // Chute pelo cabeçalho, para ele confirmar em vez de escolher tudo.
      const cabecalho = bruto[0].map((c) => String(c).toLowerCase());
      const chuta = (...termos: string[]) =>
        cabecalho.findIndex((c) => termos.some((t) => c.includes(t)));

      setMapa({
        grupo: chuta("grupo", "etapa", "categoria"),
        descricao: chuta("descri", "serviço", "servico", "item"),
        quantidade: chuta("qtd", "quant"),
        unidade: chuta("unid", "un."),
        custo: chuta("custo"),
        venda: chuta("venda", "valor", "preço", "preco", "unitário", "unitario"),
      });
    } catch {
      setErro("Não consegui ler este arquivo. Confira se é .xlsx, .xls ou .csv.");
    } finally {
      setLendo(false);
    }
  }

  const mapeadas = useMemo<ItemImportado[]>(() => {
    if (!linhas || mapa.descricao === null) return [];

    const pegar = (linha: LinhaBruta, indice: number | null) =>
      indice === null ? null : String(linha[indice] ?? "").trim() || null;

    return linhas
      .slice(primeiraLinha - 1)
      .map((linha) => ({
        grupo: pegar(linha, mapa.grupo),
        descricao: pegar(linha, mapa.descricao) ?? "",
        quantidade: lerNumero(pegar(linha, mapa.quantidade)),
        unidade: pegar(linha, mapa.unidade),
        custoUnitario: lerNumero(pegar(linha, mapa.custo)),
        valorUnitario: lerNumero(pegar(linha, mapa.venda)),
      }))
      .filter((l) => l.descricao.length >= 2);
  }, [linhas, mapa, primeiraLinha]);

  async function importar() {
    setImportando(true);
    setErro(null);

    const r = await importarItens(orcamentoId, mapeadas);

    if (!r.ok) {
      setErro(r.erro ?? "Falha ao importar.");
      setImportando(false);
      return;
    }

    setImportados(r.importados ?? mapeadas.length);
    setImportando(false);
    router.refresh();
  }

  if (importados !== null) {
    return (
      <>
        <div className="dialogo-corpo">
          <p className="aviso aviso-ok text-sm">
            <strong>{importados}</strong>{" "}
            {importados === 1 ? "item importado" : "itens importados"}. Confira
            os valores antes de publicar.
          </p>
        </div>
        <div className="dialogo-rodape">
          <button type="button" onClick={aoFechar} className="btn btn-primario">
            Ver a tabela
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="dialogo-corpo flex flex-col gap-4">
        {!linhas ? (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="rotulo-campo">Arquivo (.xlsx, .xls ou .csv)</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const arquivo = e.target.files?.[0];
                  if (arquivo) void lerArquivo(arquivo);
                }}
                disabled={lendo}
                className="campo py-2.5"
              />
            </label>
            {lendo && (
              <p className="flex items-center gap-2 text-sm text-fumaca">
                <Girando />
                Lendo o arquivo…
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-fumaca">
              <strong className="text-tinta">{nomeDoArquivo}</strong> ·{" "}
              {linhas.length} linhas. Diga qual coluna é qual — o resto deixa em
              branco.
            </p>

            <div className="overflow-x-auto rounded-sm border border-nevoa">
              <table className="tabela min-w-[36rem]">
                <thead>
                  <tr>
                    {linhas[0].map((_, i) => (
                      <th key={i}>{letraDaColuna(i)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.slice(0, 3).map((linha, i) => (
                    <tr key={i}>
                      {linha.map((celula, j) => (
                        <td key={j} className="truncate">
                          {String(celula)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CAMPOS.map((campo) => (
                <label key={campo.chave} className="flex flex-col gap-1.5">
                  <span className="rotulo-campo">
                    {campo.rotulo}
                    {campo.obrigatorio && " *"}
                  </span>
                  <select
                    value={mapa[campo.chave] ?? ""}
                    onChange={(e) =>
                      setMapa((m) => ({
                        ...m,
                        [campo.chave]:
                          e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                    className="campo"
                  >
                    <option value="">Nenhuma</option>
                    {linhas[0].map((_, i) => (
                      <option key={i} value={i}>
                        {letraDaColuna(i)}
                        {linhas[0][i] ? ` — ${linhas[0][i]}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ))}

              <label className="flex flex-col gap-1.5">
                <span className="rotulo-campo">Primeira linha de dados</span>
                <input
                  type="number"
                  min={1}
                  value={primeiraLinha}
                  onChange={(e) =>
                    setPrimeiraLinha(Number(e.target.value) || 1)
                  }
                  className="campo"
                />
                <span className="ajuda-campo">
                  1 se não tem cabeçalho. 2 se a linha 1 é título.
                </span>
              </label>
            </div>

            {mapa.descricao !== null && (
              <p className="text-sm text-fumaca">
                <strong className="text-tinta">{mapeadas.length}</strong> linhas
                prontas (as sem descrição ficam de fora).
              </p>
            )}
          </>
        )}

        {erro && <p className="aviso aviso-erro text-sm">{erro}</p>}
      </div>

      <div className="dialogo-rodape">
        {linhas ? (
          <>
            <button
              type="button"
              onClick={() => setLinhas(null)}
              className="btn btn-secundario"
            >
              Trocar arquivo
            </button>
            <button
              type="button"
              onClick={() => void importar()}
              disabled={
                importando || mapa.descricao === null || mapeadas.length === 0
              }
              className={`btn ${importando ? "btn-carregando" : "btn-primario"}`}
            >
              {importando && <Girando />}
              {importando
                ? "Importando…"
                : `Importar ${mapeadas.length || ""} ${mapeadas.length === 1 ? "linha" : "linhas"}`}
            </button>
          </>
        ) : (
          <button type="button" onClick={aoFechar} className="btn btn-secundario">
            Cancelar
          </button>
        )}
      </div>
    </>
  );
}
