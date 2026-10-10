/**
 * Refaz o orçamento do Sr. Rafael com o levantamento reduzido.
 *
 * O serviço é o mesmo — tratamento de infiltração na altura do rodapé, com
 * corte atravessando a parede, massa corrida e pintura. O que mudou foram as
 * quantidades, e por isso **os preços unitários ficam como estão**: o cliente
 * já viu R$ 20,00 o metro de rodapé, R$ 85,00 o metro de tratamento, R$ 38,00
 * o m² de massa e R$ 25,00 o m² de pintura. Reduzir escopo não é remarcar
 * preço, e remarcar junto esconderia qual das duas coisas mudou.
 *
 * **A medição do tratamento.** O levantamento traz a garagem com 10,46 m e o
 * quarto com 20,76 m — somados, 31,22 m —, e o rodapé, a massa e a pintura com
 * 62,44 m, o dobro exato: 31,22 m é o corrido de parede, e 62,44 m são as duas
 * faces dela.
 *
 * **O tratamento entra pelas duas faces**, 62,44 m, como a pintura e o rodapé.
 * Foi a decisão do Rodrigo depois de ver as duas leituras lado a lado: o corte
 * atravessa a parede, mas o serviço acontece dos dois lados e é cobrado nos
 * dois. Os 31,22 m continuam declarados aqui como conferência — prendem um
 * número ao outro, e o script para antes de gravar se o levantamento de um
 * ambiente mudar.
 *
 * O `valor_fechado` passa a ser nulo: com todas as linhas precificadas, o
 * total vira a soma da tabela e não pode divergir dela.
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

/** O corrido de parede que recebe o corte, por ambiente. */
const PAREDES = [
  { local: "Garagem", corrido: 10.46, altura: "1,00 m" },
  { local: "Quarto", corrido: 20.76, altura: "0,10 m" },
];

const CORRIDO = 31.22; // 10,46 + 20,76
const DUAS_FACES = 62.44; // o rodapé, a massa e a tinta existem nos dois lados
const ALTURA_MASSA = 1.0;
const ALTURA_PINTURA = 2.7;

type Item = {
  descricao: string;
  quantidade: number;
  unidade: string;
  valor: number;
  observacao?: string;
};

const ITENS: Item[] = [
  {
    descricao:
      "Retirada de rodapé em porcelanato existente, com reaproveitamento para reinstalação após o tratamento",
    quantidade: DUAS_FACES,
    unidade: "m linear",
    valor: 20,
    observacao: "Os mesmos rodapés voltam ao lugar: não há compra de peça nova.",
  },
  {
    descricao:
      "Tratamento de infiltração das paredes na altura do rodapé — corte de 10 cm de altura atravessando a parede de um lado ao outro, executado a cada 2,00 m, com areia grossa, rebotech e cimento, técnica de viga baldrame sem armadura",
    quantidade: DUAS_FACES,
    unidade: "m linear",
    valor: 85,
    observacao:
      "Garagem e quarto: 31,22 m de corrido de parede, medidos nos dois lados.",
  },
  {
    descricao:
      "Correção e aplicação de massa corrida nas paredes tratadas, faixa de 1,00 m de altura nas duas faces",
    quantidade: Math.round(DUAS_FACES * ALTURA_MASSA * 100) / 100,
    unidade: "m²",
    valor: 38,
  },
  {
    descricao: "Correção de rufo do telhado, lado direito da varanda",
    quantidade: 1,
    unidade: "Serv",
    valor: 750,
    observacao: "Permanece do orçamento anterior, sem alteração.",
  },
  {
    descricao:
      "Pintura das paredes com tinta látex na cor existente, até 2,70 m de altura nas duas faces",
    quantidade: Math.round(DUAS_FACES * ALTURA_PINTURA * 100) / 100,
    unidade: "m²",
    valor: 25,
  },
  {
    descricao: "Limpeza pós-obra e descarte de entulho",
    quantidade: 1,
    unidade: "Serv",
    valor: 450,
  },
];

const moeda = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const totalDaLinha = (i: Item) => Math.round(i.quantidade * i.valor * 100) / 100;

async function main() {
  const { data: o } = await sb
    .from("orc_orcamentos")
    .select("id, cliente_nome, valor_fechado")
    .eq("token", TOKEN)
    .maybeSingle();
  if (!o) throw new Error(`Não achei o orçamento de token ${TOKEN}.`);

  const anterior = Number(o.valor_fechado ?? 0);

  // Confere a leitura das medidas antes de gravar.
  const soma = Math.round(PAREDES.reduce((s, p) => s + p.corrido, 0) * 100) / 100;
  if (Math.abs(soma - CORRIDO) > 0.01) {
    throw new Error(`garagem + quarto = ${soma} m, e o corrido declarado é ${CORRIDO} m.`);
  }
  if (Math.abs(CORRIDO * 2 - DUAS_FACES) > 0.01) {
    throw new Error(
      `as duas faces deveriam dar ${CORRIDO * 2} m, e o levantamento diz ${DUAS_FACES} m.`,
    );
  }

  console.log(`\n${o.cliente_nome}`);
  for (const p of PAREDES) {
    console.log(`  ${p.local}: ${p.corrido} m de corrido, altura ${p.altura}`);
  }
  console.log(`  corrido ${CORRIDO} m · duas faces ${DUAS_FACES} m ✓\n`);

  let total = 0;
  for (const i of ITENS) {
    const t = totalDaLinha(i);
    total += t;
    console.log(
      `  ${i.quantidade} ${i.unidade} × ${moeda(i.valor)} = ${moeda(t)}  ${i.descricao.slice(0, 48)}…`,
    );
  }
  total = Math.round(total * 100) / 100;

  console.log(`\n  total ${moeda(total)}`);
  console.log(`  anterior ${moeda(anterior)} · redução ${moeda(anterior - total)}`);

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

  await sb
    .from("orc_orcamentos")
    .update({
      objeto: "Tratamento de infiltração nas paredes, com pintura",
      // Nulo: o total passa a ser a soma da tabela e não pode divergir dela.
      valor_fechado: null,
      apresentacao:
        "Tratamento de infiltração nas paredes da garagem e do quarto, com corte atravessando a parede na altura do rodapé, recomposição, massa corrida e pintura. O rodapé em porcelanato é retirado e reinstalado, reaproveitando as mesmas peças. Inclui a correção do rufo do telhado, no lado direito da varanda.",
      nota_custos:
        "Escopo reduzido em relação à versão anterior, com os mesmos preços unitários. Todos os serviços de parede são medidos nos dois lados: 62,44 m, de um corrido de 31,22 m entre a garagem e o quarto. Os rodapés são reaproveitados, sem compra de peça nova. A correção do rufo permanece do orçamento anterior.",
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

  console.log(`\n  ${ITENS.length} linhas · soma no banco ${moeda(noBanco)} ✓`);
  console.log(`\nAgora republique:  npm run publicar -- ${TOKEN}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
