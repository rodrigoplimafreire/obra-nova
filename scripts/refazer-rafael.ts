/**
 * Orçamento do Sr. Rafael — levantamento final do tratamento de infiltração.
 *
 * O levantamento passou a discriminar o tratamento **por ambiente**, com medida
 * e altura próprias, e isso resolve a discussão das duas faces: cada parede vem
 * medida uma vez, do jeito que foi conferida na obra. Onde antes havia uma
 * linha de 62,44 m de tratamento, agora há três serviços diferentes:
 *
 * - **garagem**, 10,46 × 1,00 m → 10,46 m² de faixa tratada;
 * - **quarto**, 20,76 m → o corte de 10 cm atravessando a parede a cada 2,00 m;
 * - **banheiro**, 4,00 × 1,50 m → retirada do reboco, impermeabilizante
 *   Tecplus, chapisco e reboco novo. Parede nova no escopo.
 *
 * Os dois primeiros em metro quadrado e o do quarto em metro corrido porque são
 * serviços distintos, não o mesmo serviço medido de dois jeitos. O rodapé, a
 * massa corrida e a pintura seguem os 62,44 m do levantamento.
 *
 * **Os preços.** Os que o cliente já viu ficam: R$ 20,00 o metro de rodapé,
 * R$ 85,00 o metro do corte do quarto, R$ 38,00 o m² de massa, R$ 25,00 o m² de
 * pintura, R$ 750,00 o rufo e R$ 450,00 a limpeza. O rufo ganhou a medida de
 * 5,18 m no levantamento, mas continua como verba pelo mesmo valor: a medida
 * entra na descrição, e o cliente não vê um preço que mudou sem motivo.
 *
 * O tratamento em m² da garagem e do banheiro é **serviço novo neste
 * orçamento** e não tem preço anterior para preservar. São quatro operações na
 * mesma parede — retirar o reboco, impermeabilizar, chapiscar e rebocar — e o
 * valor foi montado somando o que a RD já pratica: R$ 45,00/m² de
 * impermeabilização, da proposta da Dona Fátima, mais R$ 5,50 de chapisco e
 * R$ 44,00 de reboco da planilha de mão de obra 2025 com os 10% de reajuste,
 * mais a retirada do reboco velho. Dá R$ 110,00 o m², e é a única linha deste
 * orçamento que o Reginato ainda não validou.
 *
 * **Três consertos no documento**, que só apareceram ao reler a proposta
 * publicada:
 *
 * 1. O campo `observacoes` carregava a nota interna da importação — "os seis
 *    itens somam R$ 17.323,57, mas a barra de total diz R$ 17.323,25", com o
 *    nome do Rodrigo e o `valor_fechado` entre acentos graves. Esse campo sai
 *    no documento do cliente, não é bloco de recado interno, e o texto ainda
 *    descrevia uma versão de seis itens que já foi substituída duas vezes.
 *    Sai inteiro.
 * 2. Dois cards de observação começavam repetindo o próprio título — "Corte em
 *    trechos de 2,00 m O corte no rodapé…" —, defeito que o importador deixou.
 * 3. Os cards do projeto descreviam só o corte tipo viga baldrame, que agora é
 *    a técnica de um ambiente entre três. Passam a dizer as duas.
 *
 * Rodar com `--gravar`.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const GRAVAR = process.argv.includes("--gravar");
const TOKEN = "NBMBKcxrrq264MOl3UtGYgSXS_MYKjpU";

/** Tratamento em m²: retirar reboco, impermeabilizar, chapiscar, rebocar. */
const TRATAMENTO_M2 = 110;

/** O corrido de parede do levantamento, que o rodapé, a massa e a tinta seguem. */
const CORRIDO = 62.44;

type Item = {
  descricao: string;
  quantidade: number;
  unidade: string;
  valor: number;
  observacao?: string;
  novo?: boolean;
};

const ITENS: Item[] = [
  {
    descricao:
      "Retirada de rodapé em porcelanato e reinstalação após o tratamento, reaproveitando as mesmas peças",
    quantidade: CORRIDO,
    unidade: "m linear",
    valor: 20,
    observacao: "Os mesmos rodapés voltam ao lugar: não há compra de peça nova.",
  },
  {
    descricao:
      "Tratamento de infiltração da garagem, em faixa de 1,00 m de altura (10,46 × 1,00 m)",
    quantidade: 10.46,
    unidade: "m²",
    valor: TRATAMENTO_M2,
    observacao:
      "Retirada do reboco comprometido, aplicação de impermeabilizante, chapisco e reboco novo.",
    novo: true,
  },
  {
    descricao: "Correção do rufo do telhado, no lado direito da varanda (5,18 m)",
    quantidade: 1,
    unidade: "Serv",
    valor: 750,
    observacao: "Mesmo valor do orçamento anterior.",
  },
  {
    descricao:
      "Tratamento de infiltração do rodapé do quarto — corte de 10 cm de altura atravessando a parede de um lado ao outro, executado a cada 2,00 m, com areia grossa, rebotech e cimento, técnica de viga baldrame sem armadura (20,76 m)",
    quantidade: 20.76,
    unidade: "m linear",
    valor: 85,
  },
  {
    descricao:
      "Tratamento de infiltração de uma parede do banheiro, no lado da cozinha (4,00 × 1,50 m)",
    quantidade: 6,
    unidade: "m²",
    valor: TRATAMENTO_M2,
    observacao:
      "Retirada do reboco, aplicação de impermeabilizante Tecplus, chapisco e reboco novo.",
    novo: true,
  },
  {
    descricao:
      "Aplicação de massa corrida PVA após o tratamento, em faixa de 1,00 m de altura (62,44 × 1,00 m)",
    quantidade: CORRIDO,
    unidade: "m²",
    valor: 38,
  },
  {
    descricao:
      "Pintura das paredes após o tratamento, com tinta látex na cor existente, até 2,70 m de altura (62,44 × 2,70 m)",
    quantidade: Math.round(CORRIDO * 2.7 * 100) / 100,
    unidade: "m²",
    valor: 25,
  },
  {
    descricao: "Retirada de entulho e limpeza pós-obra",
    quantidade: 1,
    unidade: "Serv",
    valor: 450,
  },
];

/**
 * As medidas do levantamento, conferidas contra o que foi lançado. Prendem um
 * número ao outro: se a medida de um ambiente mudar, o script para antes de
 * gravar em vez de publicar uma quantidade que ninguém conferiu.
 */
const CONFERENCIAS: Array<{ o_que: string; esperado: number; linha: number }> = [
  { o_que: "garagem, 10,46 × 1,00 m", esperado: 10.46, linha: 1 },
  { o_que: "quarto, 20,76 m de corrido", esperado: 20.76, linha: 3 },
  { o_que: "banheiro, 4,00 × 1,50 m", esperado: 6, linha: 4 },
  { o_que: "massa corrida, 62,44 × 1,00 m", esperado: 62.44, linha: 5 },
  { o_que: "pintura, 62,44 × 2,70 m", esperado: 168.59, linha: 6 },
];

/**
 * Os cards do documento. Os de `projeto` passam a descrever as duas técnicas
 * de tratamento, e os de `observacao` perdem o título repetido no começo do
 * texto. As etapas do "do aceite à entrega" não mudam.
 */
const SECOES: Array<{ tipo: "projeto" | "observacao"; titulo: string; texto: string }> = [
  {
    tipo: "projeto",
    titulo: "Garagem e banheiro · Reboco refeito com impermeabilizante",
    texto:
      "Na faixa atingida pela umidade o reboco comprometido é retirado até a alvenaria, a parede recebe impermeabilizante, e vêm chapisco e reboco novos por cima — 1,00 m de altura na garagem e 1,50 m na parede do banheiro, no lado da cozinha.",
  },
  {
    tipo: "projeto",
    titulo: "Quarto · Corte tipo viga baldrame",
    texto:
      "No rodapé do quarto a infiltração sobe pela base da parede, e o tratamento é outro: corte de 10 cm de altura atravessando a parede de um lado ao outro, a cada 2,00 m, preenchido com areia grossa, rebotech e cimento — sem armadura.",
  },
  {
    tipo: "projeto",
    titulo: "Acabamento · Massa corrida e pintura",
    texto:
      "Massa corrida nas áreas tratadas e pintura de toda a extensão das paredes com tinta látex na cor já existente, deixando o acabamento uniforme.",
  },
  {
    tipo: "projeto",
    titulo: "Cobertura · Rufo da varanda",
    texto:
      "Correção dos 5,18 m de rufo do telhado no lado direito da varanda — a frente de infiltração que vem de cima, e não da base das paredes.",
  },
  {
    tipo: "observacao",
    titulo: "Corte em trechos de 2,00 m",
    texto:
      "No quarto, o corte no rodapé é feito por etapas de 2,00 m, nunca de uma vez só, exatamente para não comprometer a estrutura da parede durante o tratamento.",
  },
  {
    tipo: "observacao",
    titulo: "Rodapé reaproveitado",
    texto:
      "O rodapé em porcelanato retirado é preservado e reinstalado após o tratamento — não é necessário comprar rodapé novo.",
  },
  {
    tipo: "observacao",
    titulo: "Cada ambiente com a sua técnica",
    texto:
      "A garagem e a parede do banheiro levam retirada de reboco, impermeabilizante e reboco novo; o quarto leva o corte atravessando a parede. São soluções diferentes porque a umidade chega de maneiras diferentes em cada ponto.",
  },
  {
    tipo: "observacao",
    titulo: "Infiltração também pela cobertura",
    texto:
      "Além do tratamento nas paredes, o rufo do telhado do lado direito da varanda é corrigido — outra fonte de infiltração identificada na vistoria.",
  },
];

const moeda = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const totalDaLinha = (i: Item) => Math.round(i.quantidade * i.valor * 100) / 100;

async function main() {
  const { data: o } = await sb
    .from("orc_orcamentos")
    .select("id, cliente_nome")
    .eq("token", TOKEN)
    .maybeSingle();
  if (!o) throw new Error(`Não achei o orçamento de token ${TOKEN}.`);

  // A versão anterior sai da soma das linhas: o valor_fechado já é nulo.
  const { data: antes } = await sb
    .from("orc_itens")
    .select("total")
    .eq("orcamento_id", o.id);
  const anterior =
    Math.round((antes ?? []).reduce((s, l) => s + Number(l.total ?? 0), 0) * 100) / 100;

  console.log(`\n${o.cliente_nome} · levantamento final\n`);
  for (const c of CONFERENCIAS) {
    const lancado = ITENS[c.linha].quantidade;
    if (Math.abs(lancado - c.esperado) > 0.01) {
      throw new Error(
        `${c.o_que}: lançado ${lancado}, e o levantamento dá ${c.esperado}.`,
      );
    }
    console.log(`  ${c.o_que} = ${c.esperado} ✓`);
  }

  let total = 0;
  console.log();
  for (const [n, i] of ITENS.entries()) {
    const t = totalDaLinha(i);
    total += t;
    console.log(
      `  ${n + 1}. ${String(i.quantidade).padStart(6)} ${i.unidade.padEnd(8)}` +
        ` × ${moeda(i.valor).padStart(9)} = ${moeda(t).padStart(11)}` +
        `${i.novo ? "  ← preço novo" : ""}`,
    );
  }
  total = Math.round(total * 100) / 100;

  console.log(`\n  total ${moeda(total)}`);
  console.log(
    `  versão anterior ${moeda(anterior)} · diferença ${moeda(total - anterior)}`,
  );

  if (!GRAVAR) {
    console.log("\nNada gravado. Rode com --gravar.");
    return;
  }

  await sb.from("orc_itens").delete().eq("orcamento_id", o.id);
  const { error } = await sb.from("orc_itens").insert(
    ITENS.map((i, n) => ({
      orcamento_id: o.id,
      position: n + 1,
      descricao: i.descricao,
      observacao: i.observacao ?? null,
      quantidade: i.quantidade,
      unidade: i.unidade,
      valor_unitario: i.valor,
      origem: "humano" as const,
    })),
  );
  if (error) throw new Error(`itens: ${error.message}`);

  /*
   * Os cards de projeto e observação são reescritos, e as etapas do "do aceite
   * à entrega" ficam como estão — mas a posição é única por orçamento, e os
   * cards novos são mais que os antigos. Em vez de empurrar as etapas uma a
   * uma, o que colidiria no meio do caminho, elas são lidas, tudo é apagado e
   * a lista volta inteira na ordem certa.
   */
  const { data: etapas, error: erroEtapas } = await sb
    .from("orc_secoes")
    .select("titulo, texto, origem")
    .eq("orcamento_id", o.id)
    .eq("tipo", "etapa")
    .order("position");
  if (erroEtapas) throw new Error(`etapas: ${erroEtapas.message}`);
  if (!etapas?.length) throw new Error("não achei as etapas para recolocar.");

  await sb.from("orc_secoes").delete().eq("orcamento_id", o.id);
  const { error: erroSecoes } = await sb.from("orc_secoes").insert([
    ...SECOES.map((s, n) => ({
      orcamento_id: o.id,
      tipo: s.tipo,
      position: n + 1,
      titulo: s.titulo,
      texto: s.texto,
      origem: "humano" as const,
    })),
    ...etapas.map((e, n) => ({
      orcamento_id: o.id,
      tipo: "etapa" as const,
      position: SECOES.length + n + 1,
      titulo: e.titulo,
      texto: e.texto,
      origem: e.origem,
    })),
  ]);
  if (erroSecoes) throw new Error(`seções: ${erroSecoes.message}`);

  await sb
    .from("orc_orcamentos")
    .update({
      objeto: "Tratamento de infiltração nas paredes, com pintura",
      // A nota interna da importação saía no documento do cliente, e descrevia
      // uma versão de seis itens que já não existe.
      observacoes: null,
      // Nulo: o total é a soma da tabela e não pode divergir dela.
      valor_fechado: null,
      apresentacao:
        "Tratamento de infiltração na garagem, no rodapé do quarto e numa parede do banheiro, cada ambiente com a técnica que a sua condição pede. O rodapé em porcelanato é retirado e reinstalado, reaproveitando as mesmas peças, e as paredes recebem massa corrida e pintura depois do tratamento. Inclui a correção do rufo do telhado, no lado direito da varanda.",
      nota_custos:
        "Cada ambiente é medido do jeito que foi conferido na obra: a garagem e a parede do banheiro em metro quadrado, porque levam retirada de reboco, impermeabilizante, chapisco e reboco novo; o quarto em metro corrido, porque leva o corte de 10 cm atravessando a parede a cada 2,00 m. O rodapé, a massa corrida e a pintura seguem os 62,44 m de corrido do levantamento. Os rodapés são reaproveitados, sem compra de peça nova. A correção do rufo permanece pelo valor do orçamento anterior.",
      updated_at: new Date().toISOString(),
    })
    .eq("id", o.id);

  const { data: gravados } = await sb
    .from("orc_itens")
    .select("total")
    .eq("orcamento_id", o.id);
  const noBanco =
    Math.round((gravados ?? []).reduce((s, l) => s + Number(l.total ?? 0), 0) * 100) / 100;
  if (Math.abs(noBanco - total) > 0.01) {
    throw new Error(`soma no banco ${moeda(noBanco)} ≠ ${moeda(total)}.`);
  }

  const { data: conferido } = await sb
    .from("orc_orcamentos")
    .select("observacoes")
    .eq("id", o.id)
    .single();
  if (conferido?.observacoes) {
    throw new Error("a nota interna continua no campo que vai ao cliente.");
  }

  console.log(`\n  ${ITENS.length} linhas · soma no banco ${moeda(noBanco)} ✓`);
  console.log(
    `  ${SECOES.length} cards reescritos · ${etapas.length} etapas recolocadas` +
      ` · nota interna removida ✓`,
  );
  console.log(`\nAgora republique:  npm run publicar -- ${TOKEN}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
