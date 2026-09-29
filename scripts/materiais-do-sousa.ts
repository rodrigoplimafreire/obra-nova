/**
 * Os materiais do Sr. Sousa, discriminados por etapa.
 *
 * **O valor de cada linha é derivado, não inventado.** A regra é a que o
 * Rodrigo definiu: 40% sobre a mão de obra. Aqui ela é aplicada **por etapa**,
 * sobre o subtotal daquela etapa — a etapa que custa mais de mão de obra
 * consome mais material, que é como a obra se comporta. A soma das dez linhas
 * fecha nos 40% do total, e o script confere isso antes de gravar.
 *
 * **O que eu não faço é dar preço a cada insumo.** Dizer que o saco de cimento
 * custa X e o porcelanato custa Y seria fabricar número, e preço na RD vem do
 * Reginato. O que a linha traz é *quais* materiais entram naquela etapa —
 * especificação técnica, que se lê do escopo — e quanto a etapa inteira deve
 * consumir. Quando houver cotação, cada insumo ganha a sua linha e o seu preço.
 *
 * Rodar com `--gravar`. Refaz a lista do zero a cada rodada.
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
const TOKEN = "sousa";
const PERCENTUAL = 40;

/**
 * Os insumos de cada etapa, lidos do escopo dos serviços.
 *
 * A chave é o rótulo do grupo na planilha de serviços: as duas tabelas têm de
 * se ler lado a lado.
 */
const INSUMOS: Record<string, string> = {
  "2 · Estrutura frontal da ampliação":
    "Concreto estrutural, aço CA-50 e CA-60 para as sapatas, pilares e viga, madeira e desmoldante para as fôrmas, arame recozido, espaçadores e pregos.",
  "3 · Alvenarias, elevação dos muros e abertura de vão":
    "Blocos cerâmicos, cimento, areia média e cal para a argamassa de assentamento, aço e madeira para a cinta de amarração, verga e contraverga do vão de porta.",
  "4 · Coberturas, reservatório e proteção dos muros":
    "Telha colonial, madeiramento do telhado (terças, caibros e ripas), cumeeira, pregos e parafusos, caixa-d'água de 500 litros, concreto, aço e blocos do abrigo do reservatório, e peças de chapim.",
  "5 · Infraestrutura elétrica e hidrossanitária":
    "Eletrodutos, cabos, caixas de passagem, quadro de distribuição, disjuntores, tomadas e interruptores; tubos e conexões de PVC de água fria e esgoto, registros, adesivo plástico e fita veda-rosca.",
  "6 · Aterros, concretagem e contrapisos":
    "Material de aterro, brita, cimento e areia para o lastro, o piso de concreto e os contrapisos, tela de aço e lona plástica.",
  "7 · Chapisco e reboco":
    "Cimento, areia média lavada, cal hidratada e adesivo para chapisco, com tela onde houver encontro de materiais diferentes.",
  "8 · Impermeabilização":
    "Argamassa polimérica impermeabilizante, tela de poliéster para estruturação e primer de preparo da base.",
  "9 · Pisos, revestimentos e escada":
    "Porcelanato dos pisos do térreo e do superior, revestimento das paredes da cozinha e dos banheiros, porcelanato da escada, argamassa colante AC-III, rejunte, espaçadores e perfis de acabamento.",
  "10 · Preparação e pintura das paredes do térreo":
    "Fundo preparador, massa corrida PVA, lixas, fita crepe, lona de proteção e tinta acrílica de acabamento.",
  "11 · Louças, metais, testes e conclusão":
    "Vaso sanitário, lavatório, chuveiro, torneiras, sifões, engates flexíveis, tubo de ligação e acessórios do banheiro da suíte.",
};

const moeda = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function main() {
  const { data: o } = await sb
    .from("orc_orcamentos")
    .select("id, cliente_nome, material_percentual")
    .eq("token", TOKEN)
    .maybeSingle();
  if (!o) throw new Error(`Não achei o orçamento de token ${TOKEN}.`);

  const { data: itens } = await sb
    .from("orc_itens")
    .select("grupo, total, position")
    .eq("orcamento_id", o.id)
    .is("removido_em", null)
    .order("position");

  // Subtotal de mão de obra por etapa, na ordem em que a planilha os desenha.
  const porEtapa = new Map<string, number>();
  for (const i of itens ?? []) {
    const g = i.grupo ?? "Sem grupo";
    porEtapa.set(g, (porEtapa.get(g) ?? 0) + Number(i.total ?? 0));
  }

  const maoDeObra = [...porEtapa.values()].reduce((a, b) => a + b, 0);
  const esperado = Math.round(maoDeObra * PERCENTUAL) / 100;

  console.log(`\n${o.cliente_nome}`);
  console.log(`  mão de obra  ${moeda(maoDeObra)}`);
  console.log(`  material ${PERCENTUAL}%  ${moeda(esperado)}\n`);

  const etapas = [...porEtapa.entries()];
  const linhas = etapas.map(([grupo, subtotal], n) => {
    const insumo = INSUMOS[grupo];
    if (!insumo) throw new Error(`Sem lista de insumos para "${grupo}".`);
    return {
      grupo,
      descricao: insumo,
      // A última absorve o resto da divisão: dez valores arredondados por fora
      // somariam um ou dois centavos a mais ou a menos que os 40%, e o cliente
      // confere na calculadora.
      valor:
        n === etapas.length - 1
          ? 0 // preenchido abaixo
          : Math.round(subtotal * PERCENTUAL) / 100,
      position: n + 1,
    };
  });
  const somaParciais = linhas.slice(0, -1).reduce((a, l) => a + l.valor, 0);
  linhas[linhas.length - 1].valor = Math.round((esperado - somaParciais) * 100) / 100;

  for (const l of linhas) {
    console.log(`  ${l.grupo}`);
    console.log(`     ${moeda(l.valor)}  ·  ${l.descricao.slice(0, 62)}…`);
  }

  const soma = linhas.reduce((a, l) => a + l.valor, 0);
  console.log(`\n  soma das linhas ${moeda(soma)}`);
  if (Math.abs(soma - esperado) > 0.01) {
    throw new Error(`soma ${moeda(soma)} ≠ ${moeda(esperado)} dos ${PERCENTUAL}%.`);
  }
  console.log(`  confere com os ${PERCENTUAL}% da mão de obra ✓`);

  if (!GRAVAR) {
    console.log("\nNada gravado. Rode com --gravar.");
    return;
  }

  await sb.from("orc_materiais").delete().eq("orcamento_id", o.id);
  const { error } = await sb
    .from("orc_materiais")
    .insert(linhas.map((l) => ({ orcamento_id: o.id, ...l })));
  if (error) throw new Error(error.message);

  const { data: gravados } = await sb
    .from("orc_materiais")
    .select("valor")
    .eq("orcamento_id", o.id);
  const noBanco = (gravados ?? []).reduce((a, m) => a + Number(m.valor ?? 0), 0);
  if (Math.abs(noBanco - esperado) > 0.01) {
    throw new Error(`soma no banco ${moeda(noBanco)} ≠ ${moeda(esperado)}.`);
  }

  console.log(`\n  ${linhas.length} linhas gravadas · soma no banco ${moeda(noBanco)}`);
  console.log(`  total geral ${moeda(maoDeObra + noBanco)}`);
  console.log(`\nAgora republique:  npm run publicar -- ${TOKEN}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
