/**
 * Verificação do documento do cliente quando **falta preço** — o caso da Dona
 * Regina — e da proposta inteira precificada, que não pode ter mudado.
 *
 * Nenhum banco e nenhuma rede: monta o documento publicado em memória,
 * renderiza o componente com `react-dom/server` e confere o HTML que o cliente
 * receberia.
 *
 * O que está garantido com pendência, e por que cada um importa:
 *
 * 1. a tabela de materiais **aparece** mesmo sem nenhuma cotação — antes ela
 *    sumia inteira, e o cliente lia a proposta sem saber que havia material
 *    previsto, nem o Reginato tinha onde precificar;
 * 2. nenhum "R$ 0,00" no documento: preço ausente não é preço zero;
 * 3. valor e total pendentes saem como "a definir", nas duas tabelas;
 * 4. a barra da planilha diz **subtotal**, não "Total geral" — R$ 3.698,10 é a
 *    mão de obra de uma etapa, não o preço da obra;
 * 5. etapa de material sem nenhum preço **não** fecha com linha de subtotal;
 * 6. sem `entradaPercentual` não há seção de parcelas: não se divide em
 *    parcelas um total que ainda não existe.
 *
 * E o segundo cenário é a trava contra regressão: com tudo precificado o
 * documento volta a dizer "Total da mão de obra", "Total dos materiais" e o
 * total geral em dinheiro.
 *
 * Rodar:  npx tsx --tsconfig scripts/tsconfig.json scripts/verificar-material-pendente.ts
 *         (com `--html`, imprime as barras de total)
 */

import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { lerDocumento } from "@/lib/orcamento/publicacao";
import { DocumentoDoCliente } from "@/components/orcamento/documento-do-cliente";

// O `tsx` compila o JSX de `src/` com o runtime clássico — o tsconfig do Next
// diz `preserve`, e quem resolve o JSX na aplicação é o compilador do Next.
// Fora dele, o componente procura `React` no escopo global.
(globalThis as unknown as { React: typeof React }).React = React;

const E3 = "3 · Chapisco e reboco";
const E4 = "4 · Forro PVC";

/** O esqueleto comum aos dois cenários. */
const base = {
  versao: 1,
  cliente: "Dona Regina",
  numero: "RD-2026-085",
  endereco: "Rua 323, nº 115 — Jangurussu (cidade a confirmar)",
  objeto: "Chapisco e reboco, forro PVC e três registros",
  prazo: null,
  entradaPercentual: null,
  parcelas: 2,
  pagamento: null,
  validadeDias: 20,
  marca: "rd",
  preliminar: true,
  materialPercentual: null,
  secoes: [],
  modulos: [],
  cronograma: [],
  midias: [],
  opcoes: [],
  valorFechado: null,
  publicadoEm: new Date().toISOString(),
};

const REBOCO = [
  { grupo: E3, descricao: "Chapisco e reboco do muro de divisa dos fundos", quantidade: 22.36, unidade: "m²", valorUnitario: 45, total: 1006.2 },
  { grupo: E3, descricao: "Chapisco e reboco do muro lateral", quantidade: 13.11, unidade: "m²", valorUnitario: 45, total: 589.95 },
];

/** Dona Regina: o forro sem preço, e os dois materiais sem cotação. */
const PENDENTE = {
  ...base,
  itens: [
    ...REBOCO,
    { grupo: E4, descricao: "Instalação de forro PVC", quantidade: 10.3, unidade: "m²", valorUnitario: null, total: null },
  ],
  materiais: [
    { grupo: E3, descricao: "Cimento, areia, cal e aditivos", quantidade: 1, unidade: "vb", valor: null },
    { grupo: E4, descricao: "Réguas de forro PVC", quantidade: 10.3, unidade: "m²", valor: null },
  ],
  total: 1596.15,
  totalGeral: 1596.15,
};

/** A mesma proposta depois de o Reginato fechar os preços. */
const FECHADO = {
  ...base,
  itens: [
    ...REBOCO,
    { grupo: E4, descricao: "Instalação de forro PVC", quantidade: 10.3, unidade: "m²", valorUnitario: 60, total: 618 },
  ],
  materiais: [
    { grupo: E3, descricao: "Cimento, areia, cal e aditivos", quantidade: 1, unidade: "vb", valor: 900 },
    { grupo: E4, descricao: "Réguas de forro PVC", quantidade: 10.3, unidade: "m²", valor: 40 },
  ],
  total: 2214.15,
  totalGeral: 3526.15,
};

function render(bruto: unknown) {
  const documento = lerDocumento(bruto);
  if (!documento) throw new Error("lerDocumento recusou o documento de teste.");
  const html = renderToStaticMarkup(
    createElement(DocumentoDoCliente, {
      documento,
      token: "dona-regina",
      jaAprovado: false,
    }),
  );
  if (process.argv.includes("--html")) {
    for (const m of html.matchAll(/<div class="total-bar"[\s\S]*?<\/div>/g)) {
      console.log(`    ${m[0]}`);
    }
  }
  return html;
}

const falhas: string[] = [];
const confere = (certo: boolean, oQue: string) => {
  console.log(`  ${certo ? "✓" : "✗"} ${oQue}`);
  if (!certo) falhas.push(oQue);
};

/**
 * A barra de total daquele rótulo, com o valor que ela anuncia.
 *
 * O espaço do `Intl` é o inquebrável (U+00A0), e comparar com espaço comum
 * daria falha sem defeito nenhum.
 */
const barra = (html: string, rotulo: string) => {
  const m = html.match(
    new RegExp(
      `<span class="tb-label">${rotulo}</span><span class="tb-value">([^<]*)</span>`,
    ),
  );
  return m?.[1]?.replace(/\u00a0/g, " ") ?? null;
};

/** Quantas células saem com o preço pendente escrito. */
const celulasADefinir = (html: string) => (html.match(/>a definir</g) ?? []).length;

const comPendencia = render(PENDENTE);

console.log("\nCom preço pendente (o caso da Dona Regina)\n");

confere(
  comPendencia.includes("Réguas de forro PVC"),
  "a tabela de materiais aparece sem nenhum material cotado",
);
confere(!comPendencia.includes("R$ 0,00"), 'nenhum "R$ 0,00" no documento');
// Duas células do forro (valor e total), quatro dos dois insumos, duas no
// cartão do topo (materiais e total geral) e duas nas barras de total.
confere(
  celulasADefinir(comPendencia) === 10,
  'as dez células sem preço saem como "a definir"',
);
confere(
  !/<td class="num">—<\/td>/.test(comPendencia),
  "travessão não ocupa coluna de valor",
);
confere(
  barra(comPendencia, "Mão de obra · subtotal precificado") === "R$ 1.596,15",
  'a planilha fecha em "Mão de obra · subtotal precificado", com o número do que está precificado',
);
confere(
  barra(comPendencia, "Materiais") === "a definir",
  'a barra de materiais diz "a definir", não um total',
);
confere(
  barra(comPendencia, "Total geral · mão de obra \\+ material") === "a definir",
  "o total geral não é anunciado em dinheiro enquanto há pendência",
);
confere(
  !comPendencia.includes(`Subtotal · ${E4}`),
  "etapa de material sem preço não fecha com subtotal",
);
confere(
  comPendencia.includes(`Subtotal · ${E3}`),
  "a etapa precificada mantém o subtotal",
);
confere(
  !comPendencia.includes('id="pagamento"'),
  "sem percentual de entrada, não há seção de parcelas",
);
confere(
  comPendencia.includes("ainda não foram cotados"),
  "a introdução dos materiais diz que os preços não foram cotados",
);

const fechado = render(FECHADO);

console.log("\nCom tudo precificado (a mesma proposta, depois do Reginato)\n");

confere(
  barra(fechado, "Total da mão de obra") === "R$ 2.214,15",
  'volta a dizer "Total da mão de obra"',
);
confere(
  barra(fechado, "Total dos materiais") === "R$ 1.312,00",
  'volta a dizer "Total dos materiais"',
);
confere(
  barra(fechado, "Total geral · mão de obra \\+ material") === "R$ 3.526,15",
  "o total geral sai em dinheiro",
);
confere(celulasADefinir(fechado) === 0, 'nenhum "a definir" sobra no documento');
confere(
  fechado.includes(`Subtotal · ${E4}`),
  "toda etapa precificada fecha com subtotal",
);

/** Proposta de preço único, sem material: tem que seguir exatamente como era. */
const FECHADA_SEM_MATERIAL = {
  ...base,
  valorFechado: 7157,
  itens: [
    { grupo: null, descricao: "Reforma de apartamento, escopo fechado", quantidade: 1, unidade: "vb", valorUnitario: null, total: null },
  ],
  materiais: [],
  total: 7157,
  totalGeral: 7157,
};

const semMaterial = render(FECHADA_SEM_MATERIAL);

console.log("\nPreço único, sem material (as propostas antigas)\n");

confere(
  barra(semMaterial, "Valor fechado") === "R$ 7.157,00",
  'segue dizendo "Valor fechado", com o preço único',
);
confere(
  !semMaterial.includes("Total dos materiais") &&
    !semMaterial.includes("Total geral · mão de obra"),
  "sem lista de material, a segunda tabela não aparece",
);
confere(
  celulasADefinir(semMaterial) === 0,
  'sem preço por item, as colunas de valor não saem — e nada de "a definir"',
);

if (falhas.length > 0) {
  console.error(`\n${falhas.length} ${falhas.length === 1 ? "falha" : "falhas"}.`);
  process.exit(1);
}
console.log("\nTudo certo.");
