/**
 * Junta num arquivo só tudo o que a RD já orçou: serviço, quantidade, unidade
 * e — onde existir — preço unitário e total.
 *
 * As duas fontes, porque os orçamentos da RD vivem em dois lugares:
 *
 *  1. o banco do Obra Nova (`orc_orcamentos` + `orc_itens`);
 *  2. as propostas em HTML escrito à mão do `rd-propostas`, que nunca passaram
 *     pelo banco. Ali a tabela de custos é `table.cost-table`, e o cabeçalho
 *     muda de proposta para proposta — umas têm preço unitário, outras juntam
 *     "Qtd. / Unid." numa coluna só. Por isso o leitor é guiado pelo `<thead>`
 *     e não por posição de coluna.
 *
 * **Não inventa preço.** Item sem valor sai sem valor: a maioria das obras da
 * RD é de valor fechado, e preencher a lacuna com uma média seria fabricar um
 * número que o Reginato nunca deu.
 *
 * Rodar:  npx tsx --tsconfig scripts/tsconfig.json scripts/biblioteca-de-orcamentos.ts
 * Escreve em BIBLIOTECA-DE-ORCAMENTOS.md, na raiz.
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const PROPOSTAS = resolve("..", "rd-propostas");
const SAIDA = "BIBLIOTECA-DE-ORCAMENTOS.md";

type Linha = {
  origem: string;
  cliente: string;
  grupo: string | null;
  descricao: string;
  quantidade: string | null;
  unidade: string | null;
  valorUnitario: number | null;
  total: number | null;
};

// ------------------------------------------------------------------ HTML

const texto = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;| /g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&rsquo;|&#39;/g, "’")
    .replace(/&times;/g, "×")
    .replace(/&mdash;/g, "—")
    .replace(/\s+/g, " ")
    .trim();

/** "R$ 1.234,56" → 1234.56. Travessão e vazio viram nulo. */
function dinheiro(s: string | null): number | null {
  if (!s) return null;
  const limpo = s.replace(/[R$\s]/g, "");
  if (!/\d/.test(limpo)) return null;
  const n = Number(limpo.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function lerHtml(pasta: string): Linha[] {
  const arquivo = join(PROPOSTAS, pasta, "index.html");
  if (!existsSync(arquivo)) return [];
  const html = readFileSync(arquivo, "utf8");

  const cliente =
    texto(html.match(/<h1 class="gate-title">([\s\S]*?)<\/h1>/)?.[1] ?? "")
      .replace(/^Orçamento para (o |a )?/i, "") || pasta;

  const linhas: Linha[] = [];

  for (const tabela of html.match(/<table class="cost-table">[\s\S]*?<\/table>/g) ?? []) {
    const cabecalhos = (tabela.match(/<th[^>]*>[\s\S]*?<\/th>/g) ?? []).map((t) =>
      texto(t).toLowerCase(),
    );
    const acha = (...termos: string[]) =>
      cabecalhos.findIndex((c) => termos.some((t) => c.includes(t)));

    const iDesc = acha("descrição", "serviço", "item");
    const iQtd = acha("qtd");
    const iUnid = cabecalhos.findIndex((c) => /^unid/.test(c));
    const iUnit = acha("unitário");
    const iTotal = cabecalhos.findIndex((c) => /^(total|valor total|valor)$/.test(c));

    let grupo: string | null = null;

    for (const tr of tabela.match(/<tr[\s\S]*?<\/tr>/g) ?? []) {
      if (/<th/.test(tr)) continue;
      const celulas = (tr.match(/<td[\s\S]*?<\/td>/g) ?? []).map(texto);
      if (celulas.length === 0) continue;

      if (/class="[^"]*ct-group/.test(tr)) {
        grupo = celulas.join(" ").trim() || grupo;
        continue;
      }

      const descricao = celulas[iDesc >= 0 ? iDesc : 0] ?? "";
      if (!descricao) continue;

      // "Qtd. / Unid." numa coluna só: separa o número do resto — mas só
      // quando o resto é mesmo uma unidade. "0,80 × 1,20 m" é uma dimensão, e
      // partir ali produzia o item com unidade "× 1,20 m".
      let quantidade = iQtd >= 0 ? (celulas[iQtd] ?? null) : null;
      let unidade = iUnid >= 0 ? (celulas[iUnid] ?? null) : null;
      if (quantidade && unidade === null) {
        const m = quantidade.match(/^([\d.,]+)\s+(m²|m³|m linear|m|un\.?|unid\.?|vb|pç|conj|serv|peças?|colunas?|placas?|sapatas?|pilares?|vigas?|valas?|coberturas?)$/i);
        if (m) {
          quantidade = m[1];
          unidade = m[2];
        }
      }

      linhas.push({
        origem: `rd-propostas/${pasta}`,
        cliente,
        grupo,
        descricao,
        quantidade: quantidade && /\d/.test(quantidade) ? quantidade : null,
        unidade: unidade && unidade !== "—" ? unidade : null,
        valorUnitario: iUnit >= 0 ? dinheiro(celulas[iUnit] ?? null) : null,
        total: iTotal >= 0 ? dinheiro(celulas[iTotal] ?? null) : null,
      });
    }
  }
  return linhas;
}

// ------------------------------------------------------------------ saída

const moeda = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Célula de tabela markdown: o pipe do meio quebraria a linha inteira. */
const celula = (s: string | null) => (s ?? "—").replace(/\|/g, "\\|");

async function main() {
  // ---------- banco ----------
  // Arquivado fica de fora: é quase sempre a versão anterior de um orçamento
  // que continua vivo com outro id, e entraria aqui como serviço duplicado.
  // Os registros de teste também — "TESTE", "Teste colar MD", "Teste mobile"
  // têm preço inventado na hora de experimentar a tela, e é exatamente o tipo
  // de número que não pode virar referência.
  const { data: brutos } = await sb
    .from("orc_orcamentos")
    .select(
      "id, token, cliente_nome, objeto, endereco, status, situacao, valor_fechado, prazo, pagamento, created_at",
    )
    .neq("status", "arquivado")
    .order("created_at");

  const orcamentos = (brutos ?? []).filter(
    (o) => !/\bteste?s?\b/i.test(o.cliente_nome),
  );

  const { data: itens } = await sb
    .from("orc_itens")
    .select("orcamento_id, grupo, position, descricao, quantidade, unidade, valor_unitario, total")
    .is("removido_em", null)
    .order("position");

  const doBanco: Linha[] = [];
  const porOrcamento = new Map<string, Linha[]>();

  for (const o of orcamentos) {
    const meus = (itens ?? []).filter((i) => i.orcamento_id === o.id);
    const linhas = meus.map((i) => ({
      origem: `obra-nova/${o.token}`,
      cliente: o.cliente_nome,
      grupo: i.grupo,
      descricao: i.descricao,
      quantidade: i.quantidade != null ? String(i.quantidade) : null,
      unidade: i.unidade,
      valorUnitario: i.valor_unitario != null ? Number(i.valor_unitario) : null,
      total: i.total != null ? Number(i.total) : null,
    }));
    porOrcamento.set(o.id, linhas);
    doBanco.push(...linhas);
  }

  // ---------- html ----------
  const pastas = readdirSync(PROPOSTAS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_") && !d.name.startsWith("."))
    .map((d) => d.name)
    .sort();

  const estaticos = new Map<string, Linha[]>();
  for (const p of pastas) {
    const linhas = lerHtml(p);
    if (linhas.length) estaticos.set(p, linhas);
  }

  const todas = [...doBanco, ...[...estaticos.values()].flat()];

  // ---------- markdown ----------
  const md: string[] = [];
  const hoje = new Date().toLocaleDateString("pt-BR");

  md.push("# Biblioteca de orçamentos · RD Engenharia");
  md.push("");
  md.push(
    `Extração de **${todas.length} linhas de serviço** de todos os orçamentos já` +
      ` feitos pela RD, nas duas fontes: o banco do Obra Nova e as propostas em` +
      ` HTML do \`rd-propostas\`. Gerado em ${hoje} por` +
      ` \`scripts/biblioteca-de-orcamentos.ts\`.`,
  );
  md.push("");
  md.push(
    "**Sobre os preços:** a maioria das obras da RD é orçada por **valor" +
      " fechado** — um preço único para o escopo inteiro, sem preço por item." +
      " Por isso boa parte das linhas aqui tem quantidade e unidade, mas não" +
      " tem valor. Nada foi estimado para preencher lacuna.",
  );
  md.push("");

  // ---- índice
  md.push("## Índice de orçamentos");
  md.push("");
  md.push("| Cliente | Objeto | Valor fechado | Situação | Fonte |");
  md.push("|---|---|---:|---|---|");
  for (const o of orcamentos) {
    const n = porOrcamento.get(o.id)?.length ?? 0;
    md.push(
      `| ${celula(o.cliente_nome)} | ${celula(o.objeto)} (${n} itens) | ${
        o.valor_fechado != null ? moeda(Number(o.valor_fechado)) : "—"
      } | ${o.situacao} | Obra Nova \`${o.token}\` |`,
    );
  }
  for (const [pasta, linhas] of estaticos) {
    md.push(
      `| ${celula(linhas[0]?.cliente ?? pasta)} | — (${linhas.length} itens) | — | — | HTML \`${pasta}\` |`,
    );
  }
  md.push("");

  // ---- preços unitários observados
  const comPreco = todas.filter((l) => l.valorUnitario != null);
  md.push("## Preços unitários observados");
  md.push("");
  if (comPreco.length === 0) {
    md.push("_Nenhuma linha com preço unitário._");
  } else {
    md.push(
      `${comPreco.length} linhas têm preço unitário lançado. São as únicas` +
        " referências de preço por serviço que existem hoje.",
    );
    md.push("");
    md.push("| Serviço | Un. | Vlr. unitário | Cliente |");
    md.push("|---|---|---:|---|");
    for (const l of [...comPreco].sort((a, b) =>
      a.descricao.localeCompare(b.descricao, "pt-BR"),
    )) {
      md.push(
        `| ${celula(l.descricao)} | ${celula(l.unidade)} | ${moeda(l.valorUnitario!)} | ${celula(l.cliente)} |`,
      );
    }
  }
  md.push("");

  // ---- catálogo por orçamento
  md.push("## Catálogo completo, orçamento por orçamento");
  md.push("");

  const bloco = (titulo: string, sub: string, linhas: Linha[]) => {
    md.push(`### ${titulo}`);
    md.push("");
    if (sub) md.push(sub, "");
    let grupoAtual: string | null | undefined;
    for (const l of linhas) {
      if (l.grupo !== grupoAtual) {
        grupoAtual = l.grupo;
        md.push("");
        md.push(`**${grupoAtual ?? "Sem grupo"}**`);
        md.push("");
        md.push("| Serviço | Qtd | Un. | Vlr. unit. | Total |");
        md.push("|---|---:|---|---:|---:|");
      }
      md.push(
        `| ${celula(l.descricao)} | ${celula(l.quantidade)} | ${celula(l.unidade)} | ${
          l.valorUnitario != null ? moeda(l.valorUnitario) : "—"
        } | ${l.total != null ? moeda(l.total) : "—"} |`,
      );
    }
    md.push("");
  };

  for (const o of orcamentos) {
    const linhas = porOrcamento.get(o.id) ?? [];
    if (!linhas.length) continue;
    const partes = [
      o.objeto,
      o.endereco,
      o.valor_fechado != null ? `**${moeda(Number(o.valor_fechado))}**` : null,
      o.prazo,
      o.pagamento,
    ].filter(Boolean);
    bloco(o.cliente_nome, partes.join(" · "), linhas);
  }

  for (const [pasta, linhas] of estaticos) {
    bloco(`${linhas[0]?.cliente ?? pasta} (HTML)`, `\`rd-propostas/${pasta}\``, linhas);
  }

  writeFileSync(SAIDA, md.join("\n") + "\n", "utf8");

  console.log(`\n${SAIDA}`);
  console.log(`  ${todas.length} linhas · ${doBanco.length} do banco · ${todas.length - doBanco.length} do HTML`);
  console.log(`  ${orcamentos.length} orçamentos no banco · ${estaticos.size} propostas em HTML`);
  console.log(`  ${comPreco.length} linhas com preço unitário`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
