/**
 * As duas opções de material do Jeová Filho.
 *
 * Mesmo vão, dois jeitos de fechar: gesso drywall a R$ 3.249,60 e gesso bloco
 * a R$ 3.897,60. A proposta escrita à mão mostrava as duas em abas e ele
 * escolhia; o painel tinha só a primeira, porque o documento do app não sabia
 * mostrar opção.
 *
 * `valor_fechado` fica nulo: com duas opções não existe um total só, e cada
 * aba soma a sua.
 *
 * Rodar com `--gravar`. Idempotente: refaz opções e itens do zero.
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
const CLIENTE = "Jeová Filho";

type Item = { descricao: string; quantidade: number; unidade: string; total: number };

const OPCOES: Array<{
  nome: string;
  descricao: string;
  esperado: number;
  itens: Item[];
}> = [
  {
    nome: "Opção 1 · Gesso drywall",
    descricao: "Mais rápida de executar e mais leve sobre a estrutura.",
    esperado: 3249.6,
    itens: [
      { descricao: "Construção de parede de gesso drywall", quantidade: 11.04, unidade: "m²", total: 1987.2 },
      { descricao: "Instalação de porta (porta já existente — inclui só o forramento)", quantidade: 1, unidade: "unid", total: 450 },
      { descricao: "Pintura de parede de gesso drywall", quantidade: 22.04, unidade: "m²", total: 662.4 },
      { descricao: "Limpeza pós-obra", quantidade: 1, unidade: "serv", total: 150 },
    ],
  },
  {
    nome: "Opção 2 · Gesso bloco",
    descricao: "Mais robusta e com melhor desempenho acústico.",
    esperado: 3897.6,
    itens: [
      { descricao: "Construção de parede de gesso bloco", quantidade: 11.04, unidade: "m²", total: 1435.2 },
      { descricao: "Aplicação de massa corrida na parede construída", quantidade: 22.08, unidade: "m²", total: 850 },
      { descricao: "Aplicação de selador", quantidade: 22.08, unidade: "m²", total: 250 },
      { descricao: "Pintura da parede construída", quantidade: 22.08, unidade: "m²", total: 662.4 },
      { descricao: "Instalação de porta (porta já existente — inclui só o forramento)", quantidade: 1, unidade: "unid", total: 450 },
      { descricao: "Limpeza pós-obra", quantidade: 1, unidade: "serv", total: 250 },
    ],
  },
];

const moeda = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function main() {
  const { data: o } = await sb
    .from("orc_orcamentos")
    .select("id, token, valor_fechado")
    .eq("cliente_nome", CLIENTE)
    .neq("status", "arquivado")
    .maybeSingle();
  if (!o) throw new Error(`Não achei o orçamento de ${CLIENTE}.`);

  console.log(`\n${CLIENTE}  (${o.token})`);
  for (const op of OPCOES) {
    const soma = op.itens.reduce((s, i) => s + i.total, 0);
    console.log(`  ${op.nome} — ${op.itens.length} itens · ${moeda(soma)}`);
    if (Math.abs(soma - op.esperado) > 0.01) {
      throw new Error(`${op.nome}: soma ${moeda(soma)} ≠ ${moeda(op.esperado)} do HTML.`);
    }
  }
  console.log("  as duas conferem com a proposta original");

  if (!GRAVAR) {
    console.log("\nNada gravado. Rode com --gravar.");
    return;
  }

  // O item aponta para a opção; apagar a opção com `on delete set null`
  // deixaria itens órfãos, então os itens saem primeiro.
  await sb.from("orc_itens").delete().eq("orcamento_id", o.id);
  await sb.from("orc_opcoes").delete().eq("orcamento_id", o.id);

  // Com duas opções não existe um total só: cada aba soma a sua.
  await sb
    .from("orc_orcamentos")
    .update({ valor_fechado: null, updated_at: new Date().toISOString() })
    .eq("id", o.id);

  let position = 0;
  for (const [n, op] of OPCOES.entries()) {
    const { data: opcao, error } = await sb
      .from("orc_opcoes")
      .insert({
        orcamento_id: o.id,
        nome: op.nome,
        descricao: op.descricao,
        position: n + 1,
      })
      .select("id")
      .single();
    if (error) throw new Error(`${op.nome}: ${error.message}`);

    const linhas = op.itens.map((i) => {
      position += 1;

      // `total` é coluna gerada (quantidade × valor_unitario), e o preço do
      // HTML é o da linha inteira — o unitário teria de sair da divisão. Nem
      // sempre ela fecha em dois decimais: R$ 662,40 em 22,04 m² dá
      // R$ 30,0544…, e o total volta R$ 662,30. Dez centavos a menos que a
      // proposta que o cliente já tem.
      //
      // Onde divide exato, a linha mantém quantidade e unidade. Onde não
      // divide, a medida vai para a descrição e a linha entra como verba com
      // o valor exato: o cliente continua lendo os 22,04 m², e o total é o
      // mesmo do documento original.
      const unitario = Math.round((i.total / i.quantidade) * 100) / 100;
      const exato = Math.abs(unitario * i.quantidade - i.total) < 0.005;

      return exato
        ? {
            orcamento_id: o.id,
            opcao_id: opcao.id,
            position,
            descricao: i.descricao,
            quantidade: i.quantidade,
            unidade: i.unidade,
            valor_unitario: unitario,
            origem: "humano" as const,
          }
        : {
            orcamento_id: o.id,
            opcao_id: opcao.id,
            position,
            descricao: `${i.descricao} (${i.quantidade
              .toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ${i.unidade})`,
            quantidade: 1,
            unidade: "vb",
            valor_unitario: i.total,
            origem: "humano" as const,
          };
    });

    const { error: erroItens } = await sb.from("orc_itens").insert(linhas);
    if (erroItens) throw new Error(`${op.nome} · itens: ${erroItens.message}`);
  }

  // Confere no banco: o unitário arredondado pode não reproduzir o total do
  // HTML, e um documento que soma diferente da proposta original é pior que
  // nenhum.
  const { data: opcoes } = await sb
    .from("orc_opcoes")
    .select("id, nome")
    .eq("orcamento_id", o.id)
    .order("position");

  console.log();
  for (const [n, op] of (opcoes ?? []).entries()) {
    const { data: itens } = await sb
      .from("orc_itens")
      .select("total")
      .eq("opcao_id", op.id);
    const soma = (itens ?? []).reduce((s, i) => s + Number(i.total ?? 0), 0);
    const esperado = OPCOES[n].esperado;
    const bate = Math.abs(soma - esperado) <= 0.01;
    console.log(`  ${op.nome}: ${moeda(soma)} ${bate ? "✓" : `≠ ${moeda(esperado)}`}`);
    if (!bate) {
      throw new Error(
        `${op.nome} soma ${moeda(soma)} no banco, e a proposta diz ${moeda(esperado)}.`,
      );
    }
  }

  console.log(`\nAgora republique:  npm run publicar -- ${o.token}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
