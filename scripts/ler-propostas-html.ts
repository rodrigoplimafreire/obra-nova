/**
 * Leitor das propostas em HTML escrito à mão do `rd-propostas`.
 *
 * Mora aqui, e não dentro de um dos scripts, porque dois precisam dele: o que
 * gera a biblioteca em Markdown e o que importa as propostas antigas para o
 * banco. Ler o mesmo HTML de dois jeitos diferentes é como os dois números
 * passam a discordar.
 *
 * **O cabeçalho manda, não a posição da coluna.** Cada proposta foi escrita à
 * mão numa época diferente: umas têm "Vlr. unitário" e "Total", outras só
 * "Valor", e outras juntam "Qtd. / Unid." numa coluna só.
 *
 * **O que não é serviço fica de fora:**
 *
 * - linha de **subtotal** (`.ct-subtotal`) — é a soma das linhas acima, e
 *   entrava na biblioteca como se fosse um serviço chamado "Subtotal · Etapa 3";
 * - a **tabela-resumo** de fechamento, cujo cabeçalho é "Etapa / Valor total" e
 *   não tem coluna de descrição de serviço. Ela repete em nove linhas o que a
 *   tabela de cima já disse em quarenta e nove.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type ItemHtml = {
  grupo: string | null;
  descricao: string;
  quantidade: number | null;
  /** O texto cru da quantidade, quando não é um número puro ("1,50 × 1,20 m"). */
  quantidadeTexto: string | null;
  unidade: string | null;
  valorUnitario: number | null;
  total: number | null;
};

export type PropostaHtml = {
  slug: string;
  cliente: string;
  senha: string | null;
  /** O total da barra laranja. Nulo quando a proposta calcula por JavaScript. */
  valorFechado: number | null;
  itens: ItemHtml[];
};

export const texto = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;| /g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&rsquo;|&#39;/g, "’")
    .replace(/&times;/g, "×")
    .replace(/&mdash;/g, "—")
    .replace(/\s+/g, " ")
    .trim();

/** "R$ 1.234,56" → 1234.56. Travessão, vazio e texto viram nulo. */
export function dinheiro(s: string | null | undefined): number | null {
  if (!s) return null;
  const limpo = s.replace(/[R$\s]/g, "");
  if (!/^-?[\d.,]+$/.test(limpo)) return null;
  const n = Number(limpo.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** "13,96" → 13.96. "1,50 × 1,20 m" não é número e volta nulo. */
export function numero(s: string | null | undefined): number | null {
  if (!s) return null;
  if (!/^[\d.,]+$/.test(s.trim())) return null;
  const n = Number(s.trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const UNIDADES =
  /^(m²|m³|m linear|m|un\.?|unid\.?|vb|pç|conj|serv|peças?|colunas?|placas?|sapatas?|pilares?|vigas?|valas?|coberturas?)$/i;

export function lerProposta(raiz: string, slug: string): PropostaHtml | null {
  const arquivo = join(raiz, slug, "index.html");
  if (!existsSync(arquivo)) return null;
  const html = readFileSync(arquivo, "utf8");

  const cliente =
    texto(html.match(/<h1 class="gate-title">([\s\S]*?)<\/h1>/)?.[1] ?? "")
      .replace(/^Orçamento para (o |a )?/i, "")
      .trim() || slug;

  const script = join(raiz, slug, "script.js");
  const senha = existsSync(script)
    ? (readFileSync(script, "utf8").match(/var SENHA\s*=\s*"([^"]*)"/)?.[1] ?? null)
    : null;

  // A barra laranja pode ter o preço antigo riscado dentro dela; o valor que
  // vale é o último texto de dinheiro que aparece no bloco.
  const barra = html.match(/<span class="tb-value"[^>]*>([\s\S]*?)<\/span>\s*<\/div>/)?.[1] ?? "";
  const cifras = (texto(barra).match(/R\$ ?[\d.,]+/g) ?? []).map(dinheiro);
  const valorFechado = cifras.filter((v): v is number => v != null).pop() ?? null;

  const itens: ItemHtml[] = [];

  for (const tabela of html.match(/<table class="cost-table">[\s\S]*?<\/table>/g) ?? []) {
    const cabecalhos = (tabela.match(/<th[^>]*>[\s\S]*?<\/th>/g) ?? []).map((t) =>
      texto(t).toLowerCase(),
    );
    const acha = (...termos: string[]) =>
      cabecalhos.findIndex((c) => termos.some((t) => c.includes(t)));

    const iDesc = acha("descrição", "serviço");
    // Sem coluna de descrição de serviço não é tabela de escopo: é o resumo
    // por etapa que fecha a proposta.
    if (iDesc < 0) continue;

    const iQtd = acha("qtd");
    const iUnid = cabecalhos.findIndex((c) => /^unid/.test(c));
    const iUnit = acha("unitário");
    const iTotal = cabecalhos.findIndex((c) => /^(total|valor total|valor)$/.test(c));

    let grupo: string | null = null;

    for (const tr of tabela.match(/<tr[\s\S]*?<\/tr>/g) ?? []) {
      if (/<th/.test(tr)) continue;
      if (/class="[^"]*ct-subtotal/.test(tr)) continue;

      const celulas = (tr.match(/<td[\s\S]*?<\/td>/g) ?? []).map(texto);
      if (celulas.length === 0) continue;

      if (/class="[^"]*ct-group/.test(tr)) {
        grupo = celulas.join(" ").trim() || grupo;
        continue;
      }

      const descricao = celulas[iDesc] ?? "";
      if (!descricao || descricao === "—") continue;

      let bruto = iQtd >= 0 ? (celulas[iQtd] ?? null) : null;
      let unidade = iUnid >= 0 ? (celulas[iUnid] ?? null) : null;

      // "Qtd. / Unid." numa coluna só — mas só separa quando o resto é mesmo
      // uma unidade. "1,50 × 1,20 m" é dimensão, e parti-la produzia o item
      // com unidade "× 1,20 m".
      if (bruto && unidade === null) {
        const m = bruto.match(/^([\d.,]+)\s+(.+)$/);
        if (m && UNIDADES.test(m[2])) {
          bruto = m[1];
          unidade = m[2];
        }
      }

      itens.push({
        grupo,
        descricao,
        quantidade: numero(bruto),
        quantidadeTexto: bruto && numero(bruto) == null ? bruto : null,
        unidade: unidade && unidade !== "—" ? unidade : null,
        valorUnitario: iUnit >= 0 ? dinheiro(celulas[iUnit]) : null,
        total: iTotal >= 0 ? dinheiro(celulas[iTotal]) : null,
      });
    }
  }

  return { slug, cliente, senha, valorFechado, itens };
}

/** Descrições iguais escritas diferente são o mesmo serviço. */
export function normalizar(descricao: string): string {
  return descricao
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
