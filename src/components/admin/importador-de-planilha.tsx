"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  criarBaseDePreco,
  finalizarImportacao,
  inserirLoteDeComposicoes,
  type LinhaImportada,
} from "@/lib/orcamento/acoes-precos";
import { Dialogo } from "@/components/comum/dialogo";
import { lerNumero } from "@/lib/orcamento/formato";
import type { BaseDePreco, FonteDePreco } from "@/lib/orcamento/precos";

/**
 * O import de uma planilha de preços — SINAPI, SEINFRA ou a tabela própria da
 * RD — em quatro passos: arquivo, mapeamento de colunas, dados da base,
 * confirmação com barra de progresso.
 *
 * Não existe leitor de SINAPI: existe mapeamento de coluna genérico. O motivo
 * é duplo — o XLSX da Caixa tem cabeçalho em várias linhas e célula mesclada,
 * então tentar reconhecer "a" planilha SINAPI quebraria a cada mudança de
 * layout; e o Reginato provavelmente tem a própria tabela de preços, que vale
 * mais que a pública porque é a praça real dele. Um mapeador só serve às três.
 */

type LinhaBruta = (string | number)[];

type Campo = "codigo" | "grupo" | "descricao" | "unidade" | "custo";

const CAMPOS: { chave: Campo; rotulo: string; obrigatorio: boolean }[] = [
  { chave: "descricao", rotulo: "Descrição", obrigatorio: true },
  { chave: "custo", rotulo: "Custo unitário", obrigatorio: true },
  { chave: "codigo", rotulo: "Código", obrigatorio: false },
  { chave: "grupo", rotulo: "Grupo", obrigatorio: false },
  { chave: "unidade", rotulo: "Unidade", obrigatorio: false },
];

const FONTES: { valor: FonteDePreco; rotulo: string }[] = [
  { valor: "sinapi", rotulo: "SINAPI" },
  { valor: "seinfra", rotulo: "SEINFRA-CE" },
  { valor: "propria", rotulo: "Tabela própria" },
  { valor: "outra", rotulo: "Outra" },
];

/** A, B, C… Z, AA, AB… — o de sempre, sem depender de biblioteca. */
function letraDaColuna(indice: number): string {
  let n = indice;
  let letra = "";
  do {
    letra = String.fromCharCode(65 + (n % 26)) + letra;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letra;
}

const TAMANHO_DO_LOTE = 500;

export function ImportadorDePlanilha({
  bases,
  aberto,
  aoFechar,
}: {
  bases: BaseDePreco[];
  aberto: boolean;
  aoFechar: () => void;
}) {
  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Importar planilha de preços"
      descricao="SINAPI, SEINFRA-CE ou a tabela própria da RD. Você diz qual coluna é qual."
    >
      {/* Remonta a cada abertura: passo, arquivo e mapeamento voltam ao zero
          em vez de guardar o estado de um import abandonado. */}
      {aberto && <MioloDoImportador bases={bases} aoFechar={aoFechar} />}
    </Dialogo>
  );
}

function MioloDoImportador({
  bases,
  aoFechar,
}: {
  bases: BaseDePreco[];
  aoFechar: () => void;
}) {
  const router = useRouter();

  const [linhas, setLinhas] = useState<LinhaBruta[] | null>(null);
  const [nomeDoArquivo, setNomeDoArquivo] = useState("");
  const [carregandoArquivo, setCarregandoArquivo] = useState(false);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);

  const [mapa, setMapa] = useState<Record<Campo, number | null>>({
    codigo: null,
    grupo: null,
    descricao: null,
    unidade: null,
    custo: null,
  });
  const [primeiraLinha, setPrimeiraLinha] = useState(2);

  const [nome, setNome] = useState("");
  const [fonte, setFonte] = useState<FonteDePreco>("propria");
  const [referencia, setReferencia] = useState("");
  const [desonerada, setDesonerada] = useState(false);
  const [substituir, setSubstituir] = useState("");

  const [importando, setImportando] = useState(false);
  const [progresso, setProgresso] = useState({ feitas: 0, total: 0 });
  const [erroImport, setErroImport] = useState<string | null>(null);
  const [concluido, setConcluido] = useState<number | null>(null);

  async function lerArquivo(arquivo: File) {
    setErroArquivo(null);
    setCarregandoArquivo(true);
    try {
      // Import dinâmico: o parser só entra no bundle de quem realmente abre o
      // importador, não no resto do painel.
      const XLSX = await import("xlsx");
      const buffer = await arquivo.arrayBuffer();
      const pasta = XLSX.read(buffer, { type: "array" });
      const aba = pasta.Sheets[pasta.SheetNames[0]];
      const bruto = XLSX.utils.sheet_to_json<LinhaBruta>(aba, {
        header: 1,
        raw: true,
        defval: "",
      });

      if (!bruto.length) {
        setErroArquivo("A planilha não tem linhas.");
        return;
      }

      setLinhas(bruto);
      setNomeDoArquivo(arquivo.name);

      // Chute de mapeamento pelo texto do cabeçalho, quando ele existir — o
      // Reginato só confirma em vez de escolher tudo do zero.
      const cabecalho = bruto[0].map((c) => String(c).toLowerCase());
      const chuta = (...termos: string[]) =>
        cabecalho.findIndex((c) => termos.some((t) => c.includes(t)));

      setMapa({
        codigo: chuta("código", "codigo", "cod."),
        grupo: chuta("grupo", "categoria", "classe"),
        descricao: chuta("descrição", "descricao", "serviço", "servico", "item"),
        unidade: chuta("unid", "un."),
        custo: chuta("custo", "preço", "preco", "valor"),
      });
    } catch {
      setErroArquivo(
        "Não consegui ler este arquivo. Confira se é .xlsx, .xls ou .csv.",
      );
    } finally {
      setCarregandoArquivo(false);
    }
  }

  const linhasMapeadas = useMemo<LinhaImportada[]>(() => {
    if (!linhas || mapa.descricao === null || mapa.custo === null) return [];

    const pegar = (linha: LinhaBruta, indice: number | null) =>
      indice === null ? null : String(linha[indice] ?? "").trim() || null;

    return linhas
      .slice(primeiraLinha - 1)
      .map((linha) => {
        const custo = lerNumero(pegar(linha, mapa.custo));
        return {
          codigo: pegar(linha, mapa.codigo),
          grupo: pegar(linha, mapa.grupo),
          descricao: pegar(linha, mapa.descricao) ?? "",
          unidade: pegar(linha, mapa.unidade),
          custoUnitario: custo,
        };
      })
      .filter(
        (l): l is LinhaImportada =>
          l.descricao.length > 0 &&
          l.custoUnitario !== null &&
          l.custoUnitario >= 0,
      );
  }, [linhas, mapa, primeiraLinha]);

  const mapeamentoCompleto = mapa.descricao !== null && mapa.custo !== null;
  const dadosDaBaseCompletos = nome.trim().length >= 2;

  async function importar() {
    setImportando(true);
    setErroImport(null);
    setProgresso({ feitas: 0, total: linhasMapeadas.length });

    const base = await criarBaseDePreco({
      nome: nome.trim(),
      fonte,
      referencia,
      desonerada,
      substituirBaseId: substituir || undefined,
    });

    if (!base.ok) {
      setErroImport(base.erro);
      setImportando(false);
      return;
    }

    let feitas = 0;
    for (let i = 0; i < linhasMapeadas.length; i += TAMANHO_DO_LOTE) {
      const lote = linhasMapeadas.slice(i, i + TAMANHO_DO_LOTE);
      const resultado = await inserirLoteDeComposicoes(base.baseId, lote);

      if (!resultado.ok) {
        setErroImport(
          `${resultado.erro} — ${feitas} de ${linhasMapeadas.length} linhas entraram antes da falha.`,
        );
        setImportando(false);
        return;
      }

      feitas += resultado.inseridas;
      setProgresso({ feitas, total: linhasMapeadas.length });
    }

    await finalizarImportacao();
    setConcluido(feitas);
    setImportando(false);
    router.refresh();
  }

  if (concluido !== null) {
    return (
      <>
        <div className="dialogo-corpo">
          <p className="aviso aviso-ok text-sm">
            <strong>{concluido}</strong>{" "}
            {concluido === 1
              ? "composição importada"
              : "composições importadas"}{" "}
            em &ldquo;{nome}&rdquo;. Já está valendo na busca do editor.
          </p>
        </div>
        <div className="dialogo-rodape">
          <button type="button" onClick={aoFechar} className="btn btn-primario">
            Fechar
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="dialogo-corpo">
        {/* Passo 1 — arquivo */}
        {!linhas && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="rotulo-campo">Arquivo (.xlsx, .xls ou .csv)</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const arquivo = e.target.files?.[0];
                  if (arquivo) void lerArquivo(arquivo);
                }}
                disabled={carregandoArquivo}
                className="campo py-2.5"
              />
            </label>
            {carregandoArquivo && (
              <p className="text-sm text-fumaca">Lendo o arquivo…</p>
            )}
            {erroArquivo && (
              <p className="aviso aviso-erro text-sm">{erroArquivo}</p>
            )}
          </div>
        )}

      {/* Passo 2 — mapeamento */}
      {linhas && !importando && concluido === null && (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-fumaca">
            <strong className="text-tinta">{nomeDoArquivo}</strong> ·{" "}
            {linhas.length} linhas lidas. Diga qual coluna é qual — o resto
            você deixa em branco.
          </p>

          <div className="overflow-x-auto rounded-sm border border-nevoa">
            <table className="tabela min-w-[36rem]">
              <thead>
                <tr>
                  {linhas[0].map((_, indice) => (
                    <th key={indice}>{letraDaColuna(indice)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.slice(0, 4).map((linha, i) => (
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
                      [campo.chave]: e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                  className="campo"
                >
                  <option value="">Nenhuma</option>
                  {linhas[0].map((_, indice) => (
                    <option key={indice} value={indice}>
                      {letraDaColuna(indice)}
                      {linhas[0][indice] ? ` — ${linhas[0][indice]}` : ""}
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
                onChange={(e) => setPrimeiraLinha(Number(e.target.value) || 1)}
                className="campo"
              />
              <span className="ajuda-campo">
                1 = a planilha não tem cabeçalho. 2 = a linha 1 é título.
              </span>
            </label>
          </div>

          {mapeamentoCompleto && (
            <p className="text-sm text-fumaca">
              <strong className="text-tinta">{linhasMapeadas.length}</strong>{" "}
              linhas prontas para importar (as sem descrição ou sem custo
              válido ficam de fora).
            </p>
          )}

          <div className="border-t border-nevoa pt-5">
            <p className="rotulo-campo mb-3">Dados desta base</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="rotulo-campo">Nome *</span>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="SEINFRA-CE — Julho/2026"
                  className="campo"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="rotulo-campo">Fonte</span>
                <select
                  value={fonte}
                  onChange={(e) => setFonte(e.target.value as FonteDePreco)}
                  className="campo"
                >
                  {FONTES.map((f) => (
                    <option key={f.valor} value={f.valor}>
                      {f.rotulo}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="rotulo-campo">Referência</span>
                <input
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="07/2026"
                  className="campo"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="rotulo-campo">Substituir base existente</span>
                <select
                  value={substituir}
                  onChange={(e) => setSubstituir(e.target.value)}
                  className="campo"
                >
                  <option value="">Nenhuma — base nova</option>
                  {bases
                    .filter((b) => b.ativa)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nome}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={desonerada}
                onChange={(e) => setDesonerada(e.target.checked)}
              />
              Tabela desonerada
            </label>
          </div>

            {erroImport && (
              <p className="aviso aviso-erro text-sm">{erroImport}</p>
            )}
          </div>
        )}

        {/* Passo 3 — progresso */}
        {importando && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-fumaca">
              Importando <strong className="text-tinta">{nome}</strong>…
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-cinza-100">
              <div
                className="h-full bg-amarelo transition-[width]"
                style={{
                  width: `${progresso.total ? (progresso.feitas / progresso.total) * 100 : 0}%`,
                }}
              />
            </div>
            <p className="font-mono text-xs text-cinza">
              {progresso.feitas} / {progresso.total}
            </p>
          </div>
        )}
      </div>

      <div className="dialogo-rodape">
        {linhas && !importando ? (
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
                !mapeamentoCompleto ||
                !dadosDaBaseCompletos ||
                linhasMapeadas.length === 0
              }
              className="btn btn-primario"
            >
              Importar {linhasMapeadas.length || ""}{" "}
              {linhasMapeadas.length === 1 ? "linha" : "linhas"}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={aoFechar}
            disabled={importando}
            className="btn btn-secundario"
          >
            Cancelar
          </button>
        )}
      </div>
    </>
  );
}
