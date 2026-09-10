/**
 * Os serviços que a RD mais orça, extraídos do que ela já orçou.
 *
 * **Entrega 1 do `PRD-VISTORIA.md`.** A biblioteca de serviços existe e está
 * vazia: `orc_composicoes` tem zero linhas, e os itens dos orçamentos foram
 * todos digitados, colados ou ditados. Uma tela de vistoria que sugere itens
 * de uma biblioteca vazia não sugere nada.
 *
 * A matéria-prima para enchê-la já está no banco. Este script lê os itens
 * vivos, agrupa as descrições parecidas e devolve os serviços recorrentes com
 * a unidade e a faixa de preço que a RD de fato pratica.
 *
 * **Não grava nada.** A saída é para o Reginato conferir, corrigir e nomear —
 * preço é dele, não do script. Ver a §3 do PRD: preço de biblioteca é memória,
 * não estimativa.
 *
 *   npm run minerar:servicos
 *   npm run minerar:servicos -- --min 2   (aparecer em ao menos 2 orçamentos)
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";

config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !CHAVE) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const sb = createClient(URL, CHAVE, { auth: { persistSession: false } });

/** Aparecer em N orçamentos distintos. Repetir na mesma obra não é recorrência. */
function argumento(nome: string, padrao: number): number {
  const args = process.argv.slice(2);
  const colado = args.find((a) => a.startsWith(`--${nome}=`));
  if (colado) {
    const n = Number(colado.slice(nome.length + 3));
    return Number.isFinite(n) ? n : padrao;
  }
  const i = args.indexOf(`--${nome}`);
  // `i + 1 < args.length` importa: sem ele, `--min` no fim da linha lia
  // `undefined` e o filtro inteiro virava NaN, devolvendo zero serviços.
  if (i !== -1 && i + 1 < args.length) {
    const n = Number(args[i + 1]);
    return Number.isFinite(n) ? n : padrao;
  }
  return padrao;
}

const MINIMO = argumento("min", 2);

/**
 * Sobreposição de palavras a partir da qual dois itens são o mesmo serviço.
 *
 * 0,6 calibrado nos dados reais da RD. Medido nos 322 itens:
 *
 *   0,45 → 40 serviços recorrentes, mas junta "demolição de muro" com
 *          "demolição de piso" e "retirada de boxes" com "retirada de portas"
 *   0,60 → 35 recorrentes, sem essas fusões           ← padrão
 *   0,70 → 26 recorrentes; começa a partir o que é o mesmo serviço
 *
 * 35 cai dentro dos "20 a 50 serviços mais recorrentes" que o PRD pede.
 */
const CORTE = argumento("corte", 0.6);

/**
 * Palavras que não distinguem um serviço de outro.
 *
 * Sem tirar, "demolição DE piso" e "demolição DO piso" caem em grupos
 * diferentes por causa de uma preposição.
 */
const VAZIAS = new Set([
  "de", "do", "da", "dos", "das", "e", "em", "no", "na", "nos", "nas",
  "com", "para", "por", "o", "a", "os", "as", "um", "uma", "ao", "aos",
  "que", "sobre", "sob", "ate", "the",
]);

/** Linha de fechamento de grupo não é serviço — é o total. */
const FECHAMENTO =
  /^\s*(valor|total|subtotal|preco|preço)\b.*(total|geral|obra|material|servico|serviço|mao|mão)?/i;

function normalizar(descricao: string): string[] {
  return descricao
    .normalize("NFD")
    // Os diacríticos, já separados das letras pelo NFD. Em escapes unicode
    // porque o intervalo literal some quando o arquivo é reeditado.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Medidas e números não distinguem o serviço: "pintura de 27 m2" e
    // "pintura de 94 m2" são o mesmo serviço com quantidade diferente.
    .replace(/\d+([.,]\d+)?/g, " ")
    .replace(/\b(m2|m3|ml|cm|mm|kg|un|vb|pc|sc|gl|bd|l|x)\b/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !VAZIAS.has(t));
}

/** Quanto dois conjuntos de palavras se sobrepõem. 1 = iguais, 0 = nada em comum. */
function semelhanca(a: Set<string>, b: Set<string>): number {
  let comuns = 0;
  for (const t of a) if (b.has(t)) comuns++;
  const uniao = a.size + b.size - comuns;
  return uniao === 0 ? 0 : comuns / uniao;
}

/**
 * A ação do serviço — demolir, instalar, pintar — reduzida à raiz.
 *
 * **É o que separa dois serviços que falam do mesmo objeto.** Sem isto,
 * "Demolição de piso cerâmico" e "Instalação de revestimento cerâmico" caem no
 * mesmo grupo, porque partilham quase todas as palavras; e aí a "faixa
 * praticada" mistura R$ 300 de demolição com R$ 2.200 de assentamento, que é
 * exatamente o número que não pode ir errado para dentro da biblioteca.
 *
 * Seis letras da primeira palavra: junta demolição/demolições e
 * instalação/instalações sem precisar de um stemmer de verdade.
 */
function acao(tokens: string[]): string {
  return (tokens[0] ?? "").slice(0, 6);
}

type Linha = {
  descricao: string;
  unidade: string | null;
  valorUnitario: number | null;
  orcamentoId: string;
};

type Grupo = {
  acao: string;
  tokens: Set<string>;
  linhas: Linha[];
};

function mediana(ns: number[]): number {
  const s = [...ns].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function moeda(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** A descrição mais curta do grupo: costuma ser a mais genérica, boa como nome. */
function representante(linhas: Linha[]): string {
  return [...linhas].sort((a, b) => a.descricao.length - b.descricao.length)[0]
    .descricao;
}

function maisComum(vs: (string | null)[]): string | null {
  const conta = new Map<string, number>();
  for (const v of vs) if (v) conta.set(v, (conta.get(v) ?? 0) + 1);
  let melhor: string | null = null;
  let max = 0;
  for (const [v, n] of conta) if (n > max) { melhor = v; max = n; }
  return melhor;
}

async function main() {
  const { data, error } = await sb
    .from("orc_itens")
    .select("descricao, unidade, valor_unitario, orcamento_id")
    .is("removido_em", null);

  if (error) {
    console.error("Falha ao ler os itens:", error.message);
    process.exit(1);
  }

  const todas = (data ?? []) as {
    descricao: string;
    unidade: string | null;
    valor_unitario: number | null;
    orcamento_id: string;
  }[];

  const linhas: Linha[] = todas
    .filter((i) => !FECHAMENTO.test(i.descricao))
    .map((i) => ({
      descricao: i.descricao.trim(),
      unidade: i.unidade,
      valorUnitario: i.valor_unitario,
      orcamentoId: i.orcamento_id,
    }));

  const fechamentos = todas.length - linhas.length;

  // Agrupamento guloso: cada item entra no primeiro grupo parecido o bastante.
  // O(n·grupos) — com algumas centenas de itens, isso roda instantaneamente, e
  // um algoritmo melhor só valeria a pena com ordem de grandeza a mais.
  const grupos: Grupo[] = [];
  for (const linha of linhas) {
    const lista = normalizar(linha.descricao);
    const tokens = new Set(lista);
    if (tokens.size === 0) continue;
    const verbo = acao(lista);

    const achado = grupos.find(
      (g) => g.acao === verbo && semelhanca(g.tokens, tokens) >= CORTE,
    );
    if (achado) {
      achado.linhas.push(linha);
      for (const t of tokens) achado.tokens.add(t);
    } else {
      grupos.push({ acao: verbo, tokens, linhas: [linha] });
    }
  }

  const relatorio = grupos
    .map((g) => {
      const orcamentos = new Set(g.linhas.map((l) => l.orcamentoId));
      const precos = g.linhas
        .map((l) => l.valorUnitario)
        .filter((v): v is number => v !== null && v > 0);
      return {
        nome: representante(g.linhas),
        ocorrencias: g.linhas.length,
        orcamentos: orcamentos.size,
        unidade: maisComum(g.linhas.map((l) => l.unidade)),
        precos,
        variantes: [...new Set(g.linhas.map((l) => l.descricao))],
        // O maior preço passando de três vezes o menor quase sempre quer dizer
        // que o agrupamento juntou dois serviços diferentes — e não que a RD
        // cobra três vezes mais pelo mesmo trabalho. O script não sabe qual
        // dos dois é; sabe que não deve entregar essa faixa calado.
        suspeito:
          precos.length > 1 && Math.max(...precos) > Math.min(...precos) * 3,
      };
    })
    .filter((r) => r.orcamentos >= MINIMO)
    .sort((a, b) => b.orcamentos - a.orcamentos || b.ocorrencias - a.ocorrencias);

  // ---------- relatório na tela ----------
  console.log(`\nItens vivos lidos: ${todas.length}`);
  console.log(`Linhas de fechamento ignoradas: ${fechamentos}`);
  console.log(`Serviços distintos encontrados: ${grupos.length}`);
  console.log(`Recorrentes (em ${MINIMO}+ orçamentos): ${relatorio.length}\n`);

  for (const [i, r] of relatorio.entries()) {
    const faixa =
      r.precos.length === 0
        ? "sem preço lançado"
        : r.precos.length === 1
          ? moeda(r.precos[0])
          : `${moeda(Math.min(...r.precos))} a ${moeda(Math.max(...r.precos))} · mediana ${moeda(mediana(r.precos))}`;

    console.log(
      `${String(i + 1).padStart(2, "0")}. ${r.nome}${r.suspeito ? "   ⚠ faixa larga: confira se são dois serviços" : ""}` +
        `\n    ${r.orcamentos} orçamento(s) · ${r.ocorrencias} ocorrência(s)` +
        ` · unidade ${r.unidade ?? "—"} · ${faixa}`,
    );
    if (r.variantes.length > 1) {
      for (const v of r.variantes.slice(1, 4)) console.log(`      ~ ${v}`);
      if (r.variantes.length > 4) {
        console.log(`      ~ (+${r.variantes.length - 4} outras redações)`);
      }
    }
  }

  // ---------- markdown para conferência ----------
  const md: string[] = [
    "# Serviços candidatos à biblioteca da RD",
    "",
    `Minerado de ${todas.length} itens vivos em ${new Set(linhas.map((l) => l.orcamentoId)).size} orçamentos.`,
    "",
    "**Nada disto está gravado.** É rascunho para o Reginato conferir: o nome,",
    "a unidade e o preço que vale como referência. Preço é dele.",
    "",
    "⚠️ = a faixa de preco e larga demais para um servico so. Provavelmente",
    "o agrupamento juntou dois. Confira antes de usar o valor.",
    "",
    "| # | Serviço | Orçamentos | Ocorrências | Unidade | Faixa praticada |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const [i, r] of relatorio.entries()) {
    const faixa =
      r.precos.length === 0
        ? "—"
        : r.precos.length === 1
          ? moeda(r.precos[0])
          : `${moeda(Math.min(...r.precos))} – ${moeda(Math.max(...r.precos))}`;
    md.push(
      `| ${i + 1} | ${r.nome.replace(/\|/g, "/")}${r.suspeito ? " ⚠️" : ""} | ${r.orcamentos} | ${r.ocorrencias} | ${r.unidade ?? "—"} | ${faixa} |`,
    );
  }

  const saida = "servicos-candidatos.md";
  writeFileSync(saida, md.join("\n") + "\n", "utf8");
  console.log(`\nTabela para conferência gravada em ${saida}\n`);
}

main();
