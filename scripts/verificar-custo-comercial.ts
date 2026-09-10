/**
 * Trava o comportamento da conta de custo de um orçamento.
 *
 * O Rodrigo tropeçou nesta conta duas vezes: viu um "Custo estimado" de
 * R$ 129,59 e conferiu de cabeça só o quilômetro (50 × R$ 1,16 = R$ 58),
 * sem achar de onde vinha o resto. O resto eram os 48 minutos de esforço a
 * R$ 89,49/hora. A conta estava certa — o que faltava era a tela mostrar as
 * duas parcelas.
 *
 * Cada caso aqui é um cenário real, com o número conferido à mão. Se
 * `custoDeProducao` mudar e passar a somar só uma das parcelas, ou trocar a
 * ordem de tempo e km, este teste quebra antes de o Reginato mandar uma
 * proposta com preço errado.
 *
 *   npm run verificar:custo-comercial
 */

import { custoDeProducao } from "../src/lib/pipeline/precificacao";

let falhas = 0;

function ok(certo: boolean, o_que: string, detalhe = "") {
  console.log(
    `  ${certo ? "ok  " : "FALHA"} ${o_que}${detalhe ? ` — ${detalhe}` : ""}`,
  );
  if (!certo) falhas++;
}

// As premissas da RD hoje, da tela de Preços.
const CUSTO_HORA = 89.49;
const CUSTO_KM = 1.16;

console.log("\nO pedido do Thomas e Nathalia: 48 min, 50 km");
{
  const tempo = custoDeProducao(48, 0, CUSTO_HORA, 0);
  const km = custoDeProducao(0, 50, CUSTO_HORA, CUSTO_KM);
  const total = custoDeProducao(48, 50, CUSTO_HORA, CUSTO_KM);

  ok(tempo === 71.59, "a parcela de tempo", `48 min a R$ ${CUSTO_HORA}/h = R$ ${tempo}`);
  ok(km === 58, "a parcela de km", `50 km a R$ ${CUSTO_KM}/km = R$ ${km}`);
  ok(total === 129.59, "o custo estimado", `R$ ${total}`);
  ok(
    Math.round((tempo + km) * 100) / 100 === total,
    "o total é a soma das duas parcelas, não uma delas",
    `${tempo} + ${km} = ${total}`,
  );
}

console.log("\nSó deslocamento, sem tempo cronometrado");
{
  const total = custoDeProducao(0, 30, CUSTO_HORA, CUSTO_KM);
  ok(total === 34.8, "custa só o km", `30 km = R$ ${total}`);
}

console.log("\nSó tempo, sem deslocamento (estudo feito no escritório)");
{
  const total = custoDeProducao(120, 0, CUSTO_HORA, CUSTO_KM);
  ok(total === 178.98, "custa só o tempo", `2 h = R$ ${total}`);
}

console.log("\nSem custo/km lançado: o km não entra, o tempo ainda conta");
{
  const total = custoDeProducao(60, 40, CUSTO_HORA, null);
  ok(total === 89.49, "1 h de tempo, km ignorado", `R$ ${total}`);
}

console.log("\nPedido zerado: ninguém cronometrou nada");
{
  ok(custoDeProducao(0, 0, CUSTO_HORA, CUSTO_KM) === 0, "custo zero");
}

console.log("\nArredonda para o centavo, não deixa dízima passar");
{
  // 10 min a 89,49/h = 14,915 → 14,92 (meio para cima)
  const total = custoDeProducao(10, 0, CUSTO_HORA, 0);
  ok(total === 14.92, "10 min arredonda para R$ 14,92", `veio R$ ${total}`);
}

console.log(
  falhas === 0
    ? "\n✓ a conta de custo bate em todos os cenários\n"
    : `\n✗ ${falhas} caso(s) com conta errada\n`,
);
process.exit(falhas === 0 ? 0 : 1);
