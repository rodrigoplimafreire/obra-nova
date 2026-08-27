/**
 * Traz as propostas de agosto do `rd-propostas` para dentro do Obra Nova.
 *
 * As propostas são HTML feito à mão, uma pasta por cliente. Elas compartilham
 * o vocabulário de classes do `_shared/brand.css` — `tr.ct-group` abre grupo,
 * `td.num.total` é valor de item, `.total-bar` é o total geral — mas **não**
 * compartilham formato: umas têm valor por item, outras só o preço fechado, e
 * uma guarda os valores num mapa de JavaScript. São três formas diferentes,
 * detectadas por arquivo.
 *
 * **Por que ele confere em vez de só importar.** O que está sendo movido é
 * dinheiro que já foi para o cliente. Um parser que erra uma linha não trava:
 * ele grava um número plausível e errado, e o erro só aparece quando alguém
 * comparar o painel com o PDF que o cliente tem na mão. Então cada proposta é
 * reconciliada — a soma dos itens lidos contra o total escrito na `.total-bar`
 * — e diferença acima de um centavo reprova a proposta inteira, que não é
 * gravada.
 *
 * Rodar:
 *   npm run importar:propostas           # confere e mostra, não grava
 *   npm run importar:propostas -- --gravar
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { parse, type HTMLElement } from "node-html-parser";

config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !CHAVE) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const sb = createClient(URL, CHAVE, { auth: { persistSession: false } });

const RAIZ = "C:/ProjetosDev/rd-propostas";
const GRAVAR = process.argv.includes("--gravar");

/**
 * As de agosto que são orçamento de cliente.
 *
 * Ficaram de fora, e o motivo importa para quem for repetir isto:
 * `izonete` e `terrabrasilis` são de julho; `campanha-agosto` é relatório de
 * marketing; `parceria` é proposta de sociedade — nenhuma das duas últimas tem
 * cliente nem preço de obra.
 */
const PASTAS = [
  "amanda-diego",
  "erivando",
  "gabriel-fernandes",
  "helano",
  "jeova-filho",
  "livonio",
  "rafael",
  "shopping-meirelles",
];

/**
 * Propostas que a conferência reprovou e que o Rodrigo resolveu na mão.
 *
 * Fica aqui, e não numa correção silenciosa no parser, porque a diferença é do
 * documento e não da leitura: quem reabrir isto em seis meses precisa saber que
 * a conta não fechava e quem decidiu o que valia.
 */
const DECISOES: Record<string, { valorCombinado: number; porque: string }> = {
  rafael: {
    valorCombinado: 17323.25,
    porque:
      "Os seis itens somam R$ 17.323,57, mas a barra de total do documento " +
      "entregue diz R$ 17.323,25 — parece dígito trocado. Rodrigo escolheu o " +
      "valor que o cliente recebeu (27/08/2026). Os itens entram como estão: " +
      "nenhum preço de linha foi mexido para fechar a conta, e o valor " +
      "combinado fica em `valor_fechado`.",
  },
};

type Item = {
  grupo: string | null;
  descricao: string;
  quantidade: number | null;
  unidade: string | null;
  total: number | null;
};

type Proposta = {
  pasta: string;
  cliente: string;
  titulo: string;
  forma: "valor-por-item" | "valores-no-js" | "sem-valor-por-item";
  itens: Item[];
  /** O total escrito na `.total-bar`. É contra ele que a soma é conferida. */
  totalDeclarado: number | null;
  apresentacao: string | null;
  senha: string | null;
};

function dinheiro(texto: string): number | null {
  const m = texto.match(/R\$\s*([\d.]+,\d{2}|\d+)/);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function numero(texto: string): number | null {
  const m = texto.trim().match(/^([\d.]*\d+(?:,\d+)?)/);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function limpar(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

/** Os valores do `var VALORES = { "1.1": 2700, ... }` do script.js. */
function valoresDoJs(pasta: string): Map<string, number> {
  const mapa = new Map<string, number>();
  const caminho = join(RAIZ, pasta, "script.js");
  if (!existsSync(caminho)) return mapa;

  const js = readFileSync(caminho, "utf8");
  const bloco = js.match(/var VALORES\s*=\s*\{([\s\S]*?)\n\};/);
  if (!bloco) return mapa;

  for (const m of bloco[1].matchAll(/"([\d.]+)"\s*:\s*([\d.]+)/g)) {
    mapa.set(m[1], Number(m[2]));
  }
  return mapa;
}

function lerProposta(pasta: string): Proposta {
  const html = readFileSync(join(RAIZ, pasta, "index.html"), "utf8");
  const raiz = parse(html);

  const titulo = limpar(raiz.querySelector("title")?.text ?? pasta);
  // "RD Engenharia · Proposta técnica — Sr. Erivando" → "Sr. Erivando"
  const cliente = limpar(titulo.split("—").pop() ?? pasta);

  const doJs = valoresDoJs(pasta);
  const forma: Proposta["forma"] = doJs.size
    ? "valores-no-js"
    : raiz.querySelector("td.total")
      ? "valor-por-item"
      : "sem-valor-por-item";

  const itens: Item[] = [];
  let grupo: string | null = null;

  // Só a primeira tabela de custo: quando há uma segunda (cronograma, resumo
  // por etapa), ela repete os mesmos valores agrupados, e somar as duas dobra
  // o orçamento.
  const tabela = raiz.querySelector("table.cost-table");
  for (const tr of tabela?.querySelectorAll("tr") ?? []) {
    if (tr.classList.contains("ct-group")) {
      grupo = limpar(tr.text);
      continue;
    }
    // `ct-subtotal` é a soma da etapa e `ct-sub` é subtítulo dentro dela. As
    // duas parecem linha de item para quem só olha `<td>`: sem esta guarda, a
    // proposta do Gabriel entrava com 13 itens inventados, oito deles
    // repetindo dinheiro que já estava nas linhas acima.
    if (
      tr.classList.contains("ct-subtotal") ||
      tr.classList.contains("ct-sub")
    ) {
      continue;
    }
    const tds = tr.querySelectorAll("td");
    if (tds.length === 0) continue;

    // A `.cr-unit` é uma observação dentro da célula ("se for de plástico, o
    // valor cai para..."). Entra como texto do item, mas não como preço — se
    // ficasse, o parser leria o valor da alternativa como o valor do item.
    const celulaDesc = tds[0];
    const nota = celulaDesc.querySelector(".cr-unit");
    const notaTexto = nota ? limpar(nota.text) : null;
    if (nota) nota.remove();
    const descricao = limpar(celulaDesc.text);
    if (!descricao) continue;

    let quantidade: number | null = null;
    let unidade: string | null = null;
    let total: number | null = null;

    if (forma === "valores-no-js") {
      const alvo = tr.querySelector("[data-val]");
      const chave = alvo?.getAttribute("data-val");
      total = chave ? (doJs.get(chave) ?? null) : null;
      const qtd = limpar(tds[1]?.text ?? "");
      quantidade = numero(qtd);
      unidade = qtd.replace(/^[\d.,\s]+/, "").trim() || null;
    } else if (tds.length >= 4) {
      quantidade = numero(limpar(tds[1].text));
      unidade = limpar(tds[2].text) || null;
      total = dinheiro(limpar(tds[3].text));
    } else if (tds.length >= 2) {
      // "3 un" numa coluna só.
      const qtd = limpar(tds[1].text);
      quantidade = numero(qtd);
      unidade = qtd.replace(/^[\d.,\s]+/, "").trim() || null;
      total = tds[2] ? dinheiro(limpar(tds[2].text)) : null;
    }

    itens.push({
      grupo,
      descricao: notaTexto ? `${descricao} (${notaTexto})` : descricao,
      quantidade,
      unidade,
      total,
    });
  }

  const barra = raiz.querySelector(".total-bar");
  const totalDeclarado = barra ? dinheiro(limpar(barra.text)) : null;

  const lede = raiz.querySelector("p.lede");
  const apresentacao = lede ? limpar(lede.text) : null;

  const js = existsSync(join(RAIZ, pasta, "script.js"))
    ? readFileSync(join(RAIZ, pasta, "script.js"), "utf8")
    : "";
  const senha = js.match(/var SENHA\s*=\s*"([^"]+)"/)?.[1] ?? null;

  return {
    pasta,
    cliente,
    titulo,
    forma,
    itens,
    totalDeclarado,
    apresentacao,
    senha,
  };
}

/**
 * Grava a proposta como orçamento em rascunho.
 *
 * **Rascunho, nunca publicado.** Estas propostas já foram entregues em HTML,
 * com senha própria; publicar de novo aqui geraria um segundo link para o mesmo
 * orçamento e ninguém saberia qual dos dois vale. Elas entram como histórico e
 * base para o próximo, e quem decide republicar é o Rodrigo, na tela.
 *
 * `origem: "humano"` em tudo: nada disto veio da IA, e a distinção existe para
 * o painel poder mostrar o que precisa de conferência.
 */
async function gravar(
  p: Proposta,
  orgId: string,
  /** O que a soma dos itens tem de dar no banco. Não é o valor cobrado. */
  somaEsperada: number | null,
  /** O valor combinado, quando difere da soma. Vem de `DECISOES`. */
  valorCombinado: number | null,
) {
  const decisao = DECISOES[p.pasta];
  const { data: orc, error } = await sb
    .from("orc_orcamentos")
    .insert({
      org_id: orgId,
      cliente_nome: p.cliente,
      objeto: p.titulo.split("·").pop()?.split("—")[0]?.trim() ?? null,
      apresentacao: p.apresentacao,
      situacao: "rascunho",
      status: "conferindo",
      marca: "rd",
      senha: p.senha,
      // Preço fechado cobre dois casos: a proposta de escopo, que não tem
      // valor por item e entraria valendo zero; e a proposta cujo total
      // combinado difere da soma das linhas, onde ele guarda o que vale.
      valor_fechado: valorCombinado,
      observacoes:
        `Importado de rd-propostas/${p.pasta} em ${new Date().toLocaleDateString("pt-BR")}.` +
        (decisao ? `\n\n${decisao.porque}` : ""),
    })
    .select("id")
    .single();

  if (error) throw new Error(`${p.pasta}: ${error.message}`);

  // `orc_itens.total` é coluna gerada: `quantidade * valor_unitario`. As
  // propostas dão o total da linha, não o unitário, então ele é derivado — e
  // a divisão pode não fechar em centavos exatos. Por isso a conferência de
  // verdade vem depois, lendo de volta o que o banco calculou.
  let colapsados = 0;

  const linhas = p.itens.map((i, n) => {
    const base = {
      orcamento_id: orc.id,
      grupo: i.grupo,
      position: n,
      origem: "humano" as const,
    };

    // Sem valor: entra como escopo, para o painel marcar em "itens sem preço".
    if (i.total === null) {
      return {
        ...base,
        descricao: i.descricao,
        quantidade: i.quantidade,
        unidade: i.unidade,
        valor_unitario: null,
        observacao: null,
      };
    }

    const qtd = i.quantidade && i.quantidade !== 0 ? i.quantidade : 1;
    const unitario = Math.round((i.total / qtd) * 100) / 100;

    // A proposta dá o total da linha; o banco guarda unitário em centavos e
    // multiplica. Quando o total não é múltiplo exato da quantidade — R$
    // 4.655,20 em 26,00 m — não existe unitário em centavos que reproduza a
    // linha, e insistir na quantidade faria o orçamento fechar num valor que
    // o cliente nunca viu. Nesse caso o dinheiro ganha: a linha vira valor
    // fechado, e a medida vai para a descrição, onde ninguém a perde de vista.
    // Arredonda do mesmo jeito que o banco vai arredondar a coluna gerada. Uma
    // tolerância de meio centavo aqui deixava passar linhas que o Postgres
    // fechava um centavo acima, e o orçamento inteiro reprovava no fim.
    const comoNoBanco = Math.round(unitario * qtd * 100) / 100;
    if (Math.abs(comoNoBanco - i.total) > 0.0001) {
      colapsados++;
      const medida = i.unidade
        ? `${i.quantidade?.toLocaleString("pt-BR") ?? ""} ${i.unidade}`.trim()
        : null;
      return {
        ...base,
        descricao: medida ? `${i.descricao} (${medida})` : i.descricao,
        quantidade: 1,
        unidade: null,
        valor_unitario: i.total,
        observacao: "Valor fechado da linha, como na proposta original.",
      };
    }

    return {
      ...base,
      descricao: i.descricao,
      quantidade: qtd,
      unidade: i.unidade,
      valor_unitario: unitario,
      observacao: null,
    };
  });

  if (colapsados) {
    console.log(
      `  ${colapsados} linha(s) entraram como valor fechado: o total não era múltiplo exato da quantidade`,
    );
  }

  if (linhas.length) {
    const { error: erroItens } = await sb.from("orc_itens").insert(linhas);
    if (erroItens) throw new Error(`${p.pasta} itens: ${erroItens.message}`);
  }

  if (somaEsperada !== null && p.itens.some((i) => i.total !== null)) {
    const { data: gravados } = await sb
      .from("orc_itens")
      .select("total")
      .eq("orcamento_id", orc.id);

    const somaNoBanco = (gravados ?? []).reduce(
      (s, l) => s + Number(l.total ?? 0),
      0,
    );

    if (Math.abs(somaNoBanco - somaEsperada) > 0.01) {
      // Derrubar o que acabou de entrar é melhor que deixar um orçamento que
      // parece certo e soma errado. Ninguém confere de novo depois.
      await sb.from("orc_orcamentos").delete().eq("id", orc.id);
      throw new Error(
        `${p.pasta}: depois de gravar, a soma no banco deu ${moeda(somaNoBanco)} para um esperado de ${moeda(somaEsperada)}. Nada foi mantido.`,
      );
    }
  }
}

function moeda(n: number | null): string {
  return n === null
    ? "—"
    : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function main() {
  const { data: org } = await sb
    .from("orgs")
    .select("id, nome_exibicao")
    .eq("nome_exibicao", "RD Engenharia")
    .maybeSingle();

  if (!org) {
    console.error("Não achei a org 'RD Engenharia'.");
    process.exit(1);
  }

  const { data: existentes } = await sb
    .from("orc_orcamentos")
    .select("id, cliente_nome")
    .eq("org_id", org.id);
  const jaTem = new Map(
    (existentes ?? []).map((o) => [o.cliente_nome.toLowerCase(), o.id]),
  );

  const propostas = PASTAS.map(lerProposta);
  let reprovadas = 0;

  console.log(
    GRAVAR ? "GRAVANDO em RD Engenharia\n" : "CONFERINDO — nada é gravado\n",
  );

  for (const p of propostas) {
    const comValor = p.itens.filter((i) => i.total !== null);
    const soma = comValor.reduce((s, i) => s + (i.total ?? 0), 0);
    const grupos = new Set(p.itens.map((i) => i.grupo).filter(Boolean)).size;

    console.log(`${p.cliente}  (${p.pasta})`);
    console.log(`  forma: ${p.forma}`);
    console.log(
      `  ${p.itens.length} itens em ${grupos} grupos · ${comValor.length} com valor`,
    );
    console.log(
      `  soma dos itens ${moeda(soma || null)} · total declarado ${moeda(p.totalDeclarado)}`,
    );

    let veredito: string;
    if (comValor.length === 0) {
      // Escopo fechado: a proposta lista o serviço e cobra um preço só. Não há
      // o que reconciliar, e o valor entra como `valor_fechado`.
      veredito = p.totalDeclarado
        ? "ok — preço fechado, sem valor por item"
        : "REPROVADA — nem valor por item nem total";
    } else if (p.forma === "valores-no-js" && p.totalDeclarado === null) {
      // Aqui a `.total-bar` não tem número: o JS a preenche somando o próprio
      // VALORES, então conferir a soma contra ela seria comparar a conta com
      // ela mesma. O que dá para provar é que nenhum valor ficou para trás:
      // todo `data-val` do HTML achou chave, e nenhuma chave sobrou sem linha.
      const chaves = valoresDoJs(p.pasta).size;
      veredito =
        comValor.length === chaves
          ? `ok — ${chaves} valores do script, todos casados com uma linha`
          : `REPROVADA — ${chaves} valores no script para ${comValor.length} linhas`;
    } else if (p.totalDeclarado === null) {
      veredito = "REPROVADA — itens com valor, mas sem total para conferir";
    } else if (Math.abs(soma - p.totalDeclarado) <= 0.01) {
      veredito = "ok — soma bate com o total";
    } else if (DECISOES[p.pasta]) {
      veredito = `ok — diferença de ${moeda(Math.abs(soma - p.totalDeclarado))} resolvida à mão, vale ${moeda(DECISOES[p.pasta].valorCombinado)}`;
    } else {
      veredito = `REPROVADA — diferença de ${moeda(Math.abs(soma - p.totalDeclarado))}`;
    }

    if (veredito.startsWith("REPROVADA")) reprovadas++;
    console.log(`  ${veredito}`);

    const existente = jaTem.get(p.cliente.toLowerCase());
    if (existente) {
      console.log(`  já existe um orçamento para este cliente (${existente})`);
    }

    if (GRAVAR && !veredito.startsWith("REPROVADA") && !existente) {
      const temValores = p.itens.some((i) => i.total !== null);
      await gravar(
        p,
        org.id,
        temValores ? soma : null,
        DECISOES[p.pasta]?.valorCombinado ??
          (temValores ? null : p.totalDeclarado),
      );
      console.log("  gravado.");
    } else if (GRAVAR && existente) {
      console.log("  pulado: já existe.");
    }

    console.log();
  }

  console.log(
    reprovadas === 0
      ? `${propostas.length} propostas conferidas, nenhuma reprovada.`
      : `${reprovadas} de ${propostas.length} reprovadas — nenhuma é gravada enquanto isso.`,
  );

  if (!GRAVAR) {
    console.log("\nNada foi gravado. Rode com --gravar depois de conferir.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
