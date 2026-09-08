/**
 * Prova a conta da carga comercial.
 *
 * É a função que vai dizer ao Rodrigo quanto cobrar. Se ela errar, o erro não
 * aparece numa tela quebrada — aparece meses depois, num negócio que trabalhou
 * o ano inteiro e não sobrou nada. Então cada caso aqui é um cenário de
 * verdade, com o número conferido à mão.
 *
 *   npm run verificar:precificacao
 */

import { calcularCarga, pesoNaObra } from "../src/lib/pipeline/precificacao";
import type { PedidoNoQuadro, Porte } from "../src/lib/pipeline/constantes";

let falhas = 0;

function ok(certo: boolean, o_que: string, detalhe = "") {
  console.log(`  ${certo ? "ok  " : "FALHA"} ${o_que}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!certo) falhas++;
}

/** A tabela do Rodrigo: a visita do Zé, etapa por etapa. */
const PADRAO = [
  { etapa: "deslocamento" as const, minutos: 60, km: 40 },
  { etapa: "visita_tecnica" as const, minutos: 90, km: null },
  { etapa: "estudo_projeto" as const, minutos: 240, km: null },
  { etapa: "planilha_custos" as const, minutos: 120, km: null },
  { etapa: "formatacao_proposta" as const, minutos: 60, km: null },
  { etapa: "outro" as const, minutos: 0, km: null },
];

const MULT: Record<Porte, number> = { P: 0.5, M: 1, G: 1.6 };

function pedido(p: Partial<PedidoNoQuadro>): PedidoNoQuadro {
  return {
    id: Math.random().toString(36),
    codigo: 1,
    cliente: "x",
    telefone: null,
    tipoObra: null,
    bairro: null,
    origem: null,
    porte: null,
    status: "novo_pedido",
    dataPedido: "2026-09-01",
    valorOrcado: null,
    valorFechado: null,
    motivoPerda: null,
    orcamentoId: null,
    totalMinutos: 0,
    kmTotal: 0,
    etapasRegistradas: 0,
    custoEstimado: null,
    ultimoEventoEm: null,
    parado: false,
    ...p,
  };
}

console.log("\nDia 1: sem histórico nenhum, valem as premissas");

const dia1 = calcularCarga({
  custoHora: 60,
  custoKm: 1.5,
  padrao: PADRAO,
  conversaoEstimada: 33.33,
  multiplicador: MULT,
  pedidos: [],
});

// 570 min = 9,5 h × 60 = 570,00 + 40 km × 1,50 = 60,00 → 630,00
ok(dia1.custoPorOrcamento === 630, "custo do orçamento padrão", `R$ ${dia1.custoPorOrcamento}`);
ok(dia1.fonteDoCusto === "premissa", "diz que o custo veio da premissa");
ok(dia1.fonteDaConversao === "premissa", "diz que a conversão veio da premissa");
// 630 / 0,3333 = 1890,19
ok(
  dia1.base !== null && Math.abs(dia1.base - 1890.19) < 0.02,
  "a carga base é o custo dividido pela conversão",
  `R$ ${dia1.base}`,
);
ok(dia1.porPorte?.M === dia1.base, "o porte médio é a carga base");
ok(
  dia1.porPorte !== null && dia1.porPorte.P < dia1.porPorte.G,
  "obra pequena carrega menos que a grande",
  `P ${dia1.porPorte?.P} · G ${dia1.porPorte?.G}`,
);
ok(dia1.cobertura === null, "sem desfecho, não há cobertura para conferir");
ok(dia1.impedimento === null, "com as premissas preenchidas, a conta fecha");

console.log("\nO que falta é dito em português, não em silêncio");

const semCusto = calcularCarga({ ...entradasBase(), custoHora: null });
ok(semCusto.base === null, "sem custo/hora não há carga");
ok(/custo por hora/i.test(semCusto.impedimento ?? ""), "e o motivo é dito");

const semPadrao = calcularCarga({
  ...entradasBase(),
  padrao: PADRAO.map((p) => ({ ...p, minutos: 0 })),
});
ok(/orçamento padrão/i.test(semPadrao.impedimento ?? ""), "sem o padrão, avisa qual falta");

const semConversao = calcularCarga({ ...entradasBase(), conversaoEstimada: null });
ok(/convers/i.test(semConversao.impedimento ?? ""), "sem conversão, avisa");

console.log("\nConversão zero é caso de negócio, não divisão por zero");

const nadaFecha = calcularCarga({
  ...entradasBase(),
  conversaoEstimada: null,
  pedidos: Array.from({ length: 6 }, () =>
    pedido({ status: "perdido", custoEstimado: 630 }),
  ),
});
ok(nadaFecha.conversao === 0, "a conversão medida é zero");
ok(nadaFecha.base === null, "não devolve Infinity");
ok(
  /nenhum orçamento fechou/i.test(nadaFecha.impedimento ?? ""),
  "e explica que não há onde embutir",
);

console.log("\nO medido assume quando há histórico bastante");

const quatroMedidos = Array.from({ length: 4 }, () =>
  pedido({ totalMinutos: 300, kmTotal: 20, custoEstimado: 330 }),
);
const comMedicao = calcularCarga({ ...entradasBase(), pedidos: quatroMedidos });
ok(comMedicao.fonteDoCusto === "medido", "com 4 medidos, o custo passa a ser o medido");
// 300 min = 5 h × 60 = 300 + 20 km × 1,50 = 30 → 330
ok(comMedicao.custoPorOrcamento === 330, "e é a média real, não o padrão", `R$ ${comMedicao.custoPorOrcamento}`);

const tresMedidos = calcularCarga({ ...entradasBase(), pedidos: quatroMedidos.slice(0, 3) });
ok(
  tresMedidos.fonteDoCusto === "premissa",
  "com 3, ainda não: um orçamento atípico dominaria a média",
);

const cincoDesfechos = calcularCarga({
  ...entradasBase(),
  pedidos: [
    ...Array.from({ length: 2 }, () => pedido({ status: "fechado" })),
    ...Array.from({ length: 3 }, () => pedido({ status: "perdido" })),
  ],
});
ok(
  cincoDesfechos.fonteDaConversao === "premissa" && cincoDesfechos.conversao === 33.33,
  "com 5 desfechos a conversão medida ainda não vale",
);

const seisDesfechos = calcularCarga({
  ...entradasBase(),
  pedidos: [
    ...Array.from({ length: 2 }, () => pedido({ status: "fechado", custoEstimado: 630 })),
    ...Array.from({ length: 4 }, () => pedido({ status: "perdido", custoEstimado: 630 })),
  ],
});
ok(seisDesfechos.fonteDaConversao === "medido", "com 6, passa a valer");
ok(seisDesfechos.conversao === 33.3, "2 de 6 = 33,3%", `${seisDesfechos.conversao}%`);

console.log("\nA cobertura acusa carga bonita e insuficiente");

// Seis obras pequenas: quatro perdidas, duas fechadas. Gasto 6 × 630 = 3.780.
// Recuperado 2 × (1890,19 × 0,5) = 1.890,19 → 50% do gasto.
const soPequenas = calcularCarga({
  ...entradasBase(),
  pedidos: [
    ...Array.from({ length: 2 }, () =>
      pedido({ status: "fechado", porte: "P", custoEstimado: 630 }),
    ),
    ...Array.from({ length: 4 }, () =>
      pedido({ status: "perdido", porte: "P", custoEstimado: 630 }),
    ),
  ],
});
ok(
  soPequenas.cobertura !== null && soPequenas.cobertura < 60,
  "carteira só de obra pequena não se paga com peso 0,5",
  `${soPequenas.cobertura}% do gasto`,
);

// Mesma carteira, tudo médio: recupera 2 × 1890,19 = 3.780,38 sobre 3.780 → 100%.
const soMedias = calcularCarga({
  ...entradasBase(),
  pedidos: [
    ...Array.from({ length: 2 }, () =>
      pedido({ status: "fechado", porte: "M", custoEstimado: 630 }),
    ),
    ...Array.from({ length: 4 }, () =>
      pedido({ status: "perdido", porte: "M", custoEstimado: 630 }),
    ),
  ],
});
ok(
  soMedias.cobertura !== null && Math.abs(soMedias.cobertura - 100) < 1,
  "com peso 1 na conversão medida, a carga se paga exatamente",
  `${soMedias.cobertura}%`,
);

console.log("\nO peso na obra, que é a decisão comercial");

ok(pesoNaObra(1890.19, 10000) === 18.9, "R$ 1.890 numa obra de R$ 10 mil é 18,9%");
ok(pesoNaObra(1890.19, 61553) === 3.1, "na obra do Bismarck, 3,1%");
ok(pesoNaObra(1890.19, 0) === null, "obra sem valor não vira divisão por zero");

function entradasBase() {
  return {
    custoHora: 60,
    custoKm: 1.5,
    padrao: PADRAO,
    conversaoEstimada: 33.33,
    multiplicador: MULT,
    pedidos: [] as PedidoNoQuadro[],
  };
}

console.log(
  falhas === 0
    ? "\nA conta está certa nos casos que importam.\n"
    : `\n${falhas} verificação(ões) falharam.\n`,
);
if (falhas > 0) process.exit(1);
