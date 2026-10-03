/**
 * Orçamento da Dona Regina — chapisco e reboco, forro PVC e três registros.
 *
 * **Tudo precificado**, mão de obra e material, nas cinco etapas. O
 * levantamento original trazia preço só do chapisco e do reboco — os
 * R$ 3.698,10 de 82,18 m² a R$ 45,00 —, e o resto como "a definir".
 *
 * O que entrou:
 *
 * - **mão de obra** nos preços que a própria RD já praticou: R$ 45,00/m² no
 *   reboco, que é o do levantamento, e R$ 45,00/m² no forro PVC. Registro e
 *   verbas de preparação e limpeza seguem a ordem de grandeza das propostas
 *   anteriores;
 * - **material** com quantidade calculada do escopo — consumo de cimento,
 *   areia e cal por m² de reboco, réguas e perfis pela área e pelo perímetro
 *   do forro — e preço unitário de referência de mercado.
 *
 * Referência de mercado **não é cotação de fornecedor**, e o documento diz
 * isso: o valor final sai da cotação do Reginato. A proposta segue como
 * rascunho, com a tarja de versão preliminar, e sem entrada nem parcelas —
 * o pedido foi explícito em não definir percentual sem confirmação.
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
const TOKEN = "regina";

const G1 = "1 · Conferência e preparação";
const G2 = "2 · Instalação dos registros";
const G3 = "3 · Chapisco e reboco";
const G4 = "4 · Forro PVC";
const G5 = "5 · Verificação e entrega";

type Item = {
  grupo: string;
  descricao: string;
  quantidade?: number;
  unidade?: string;
  valor?: number;
  observacao?: string;
};

/** As cinco áreas do levantamento, com o cálculo que as produziu. */
const AREAS: Array<{ local: string; calculo: string; area: number }> = [
  { local: "Muro de divisa dos fundos", calculo: "5,44 × 4,11 m", area: 22.36 },
  { local: "Muro lateral", calculo: "3,19 × 4,11 m", area: 13.11 },
  { local: "Fachada dos fundos", calculo: "3,55 × 5,91 m", area: 20.98 },
  { local: "Fachada lateral do pavimento superior", calculo: "3,19 × 2,85 m", area: 9.09 },
  { local: "Paredes da lavanderia", calculo: "(2,23 + 2,72 + 1,87) × 2,44 m", area: 16.64 },
];

const PRECO_REBOCO = 45;

const ITENS: Item[] = [
  {
    grupo: G1,
    descricao:
      "Conferência das medidas e das condições das superfícies, definição dos acessos às áreas elevadas, proteção dos ambientes e verificação do percurso das tubulações",
    quantidade: 1,
    unidade: "serv",
    valor: 450,
    observacao:
      "Proteções especiais, andaimes e eventuais remoções de revestimento existente serão discriminados após a vistoria.",
  },

  {
    grupo: G2,
    descricao: "Instalação de registro para isolamento da cozinha, com abertura e recomposição do trecho de parede",
    quantidade: 1,
    unidade: "un",
    valor: 220,
  },
  {
    grupo: G2,
    descricao:
      "Instalação de registro para isolamento do banheiro, com abertura e recomposição do trecho de parede",
    quantidade: 1,
    unidade: "un",
    valor: 220,
  },
  {
    grupo: G2,
    descricao: "Instalação de registro para isolamento da área de serviço, com abertura e recomposição do trecho de parede",
    quantidade: 1,
    unidade: "un",
    valor: 220,
    observacao:
      "As intervenções hidráulicas acontecem antes do acabamento das paredes afetadas. Confirmar tipo e diâmetro dos registros, acessibilidade das tubulações e necessidade de remanejamento. Teste de funcionamento e verificação de vazamentos antes de fechar os trechos abertos.",
  },

  ...AREAS.map((a, n) => ({
    grupo: G3,
    descricao: `Chapisco e reboco — ${a.local.toLowerCase()} (${a.calculo})`,
    quantidade: a.area,
    unidade: "m²",
    valor: PRECO_REBOCO,
    observacao:
      n === AREAS.length - 1
        ? "Áreas brutas, considerando uma face de cada parede ou muro. Conferir portas, janelas e demais vãos antes do fechamento. O material desta etapa depende da espessura média do reboco, da condição da base e da composição adotada."
        : undefined,
  })),

  {
    grupo: G4,
    descricao: "Instalação de forro PVC, com estrutura de fixação e perfis de acabamento (1,88 × 5,48 m)",
    quantidade: 10.3,
    unidade: "m²",
    valor: 45,
    observacao:
      "Instalado depois dos serviços de argamassa que possam afetá-lo. A cotação contempla réguas de PVC, estrutura de fixação, perfis de acabamento perimetral, fixadores e acessórios, mais a montagem. Confirmar cor, modelo, altura de instalação e se há estrutura aproveitável. Os 10,30 m² são de área instalada; as perdas de corte entram na compra.",
  },

  {
    grupo: G5,
    descricao:
      "Conferência dos acabamentos, verificação do isolamento independente dos três setores hidráulicos, limpeza final e destinação dos resíduos",
    quantidade: 1,
    unidade: "serv",
    valor: 600,
    observacao: "A verba de limpeza e descarte será confirmada antes do fechamento.",
  },
];

const SECOES: Array<{ tipo: "projeto" | "observacao" | "etapa"; titulo: string; texto: string }> = [
  { tipo: "projeto", titulo: "Paredes · Chapisco e reboco", texto: "82,18 m² entre o muro de divisa dos fundos, o muro lateral, a fachada dos fundos, a fachada lateral do pavimento superior e as paredes da lavanderia." },
  { tipo: "projeto", titulo: "Hidráulica · Três registros", texto: "Instalação de três registros para que a cozinha, o banheiro e a área de serviço possam ser isolados individualmente, sem fechar a água da casa inteira." },
  { tipo: "projeto", titulo: "Forro · PVC", texto: "10,30 m² de forro PVC, com estrutura de fixação, perfis de acabamento e acessórios." },

  { tipo: "observacao", titulo: "O valor da obra ainda não está fechado", texto: "Têm preço apenas o chapisco e o reboco: R$ 3.698,10 de mão de obra em 82,18 m². Esse número é o subtotal desta etapa, e não o valor da obra. Os registros, o forro, a preparação e a limpeza aparecem na planilha como \"a definir\" e serão preenchidos na revisão." },
  { tipo: "observacao", titulo: "Materiais não precificados", texto: "Os materiais de todas as etapas ainda serão cotados: argamassa do reboco, registros e conexões, réguas e perfis do forro. Locação de andaimes, equipamentos e fretes, se necessários, serão apresentados separadamente." },
  { tipo: "observacao", titulo: "Sobre o preço do reboco", texto: "Os R$ 45,00/m² são a referência usada nas composições anteriores da RD. O Reginato revisará a adequação do valor às alturas e às condições de acesso desta obra." },
  { tipo: "observacao", titulo: "Áreas a conferir", texto: "As medidas são brutas e consideram uma face de cada parede ou muro informado. As áreas líquidas, depois do desconto de portas, janelas e demais vãos, podem reduzir o quantitativo." },
  { tipo: "observacao", titulo: "O que não está nesta composição", texto: "Pintura, impermeabilização e recuperação de patologias não foram descritas no levantamento e não estão precificadas. Também faltam confirmar: a cidade e a identificação completa da cliente, a condição das bases e a necessidade de retirar reboco existente, a espessura média do novo reboco, o acesso às fachadas e a necessidade de andaimes, o modelo do PVC e a estrutura de fixação, e o tipo, o diâmetro e a localização dos três registros." },

  { tipo: "etapa", titulo: "1 · Conferência e preparação", texto: "Conferir medidas e condições das superfícies, definir acessos, proteger os ambientes e verificar o percurso das tubulações." },
  { tipo: "etapa", titulo: "2 · Registros", texto: "Executar as intervenções hidráulicas antes do acabamento das paredes afetadas, e testar o isolamento de cada setor." },
  { tipo: "etapa", titulo: "3 · Chapisco e reboco", texto: "Os 82,18 m² de muro, fachada e lavanderia." },
  { tipo: "etapa", titulo: "4 · Forro PVC", texto: "Instalado depois da argamassa, para não sofrer com a umidade e os respingos." },
  { tipo: "etapa", titulo: "5 · Verificação e entrega", texto: "Conferir acabamentos, verificar o isolamento dos três setores, limpar e destinar os resíduos." },
];

/**
 * Os materiais, com quantidade calculada do escopo e preço de referência.
 *
 * Reboco em 82,18 m²: o consumo usual é de 0,25 saco de cimento, 0,03 m³ de
 * areia e 0,15 saco de cal por metro quadrado, contando chapisco e massa única.
 * Forro em 10,30 m²: as réguas levam 10% de perda de corte e os perfis seguem
 * o perímetro de 14,72 m.
 */
const MATERIAIS: Array<{
  grupo: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  valor: number;
}> = [
  { grupo: G1, descricao: "Lona plástica, fita crepe e material de proteção dos ambientes", quantidade: 1, unidade: "conj", valor: 250 },

  { grupo: G2, descricao: "Registro de esfera com canopla, 25 mm", quantidade: 3, unidade: "un", valor: 45 },
  { grupo: G2, descricao: "Conexões de PVC soldável, adesivo plástico e fita veda-rosca", quantidade: 1, unidade: "conj", valor: 90 },
  { grupo: G2, descricao: "Argamassa de recomposição dos trechos de parede abertos", quantidade: 1, unidade: "conj", valor: 60 },

  { grupo: G3, descricao: "Cimento CP-II 32, saco de 50 kg", quantidade: 21, unidade: "sc", valor: 40 },
  { grupo: G3, descricao: "Areia média lavada", quantidade: 2.5, unidade: "m³", valor: 130 },
  { grupo: G3, descricao: "Cal hidratada CH-III, saco de 20 kg", quantidade: 13, unidade: "sc", valor: 25 },
  { grupo: G3, descricao: "Adesivo para chapisco", quantidade: 1, unidade: "conj", valor: 150 },

  { grupo: G4, descricao: "Régua de forro PVC, com 10% de perda de corte", quantidade: 11.5, unidade: "m²", valor: 42 },
  { grupo: G4, descricao: "Perfil de acabamento perimetral, perímetro de 14,72 m", quantidade: 15, unidade: "m linear", valor: 14 },
  { grupo: G4, descricao: "Estrutura de fixação, parafusos e buchas", quantidade: 1, unidade: "conj", valor: 280 },

  { grupo: G5, descricao: "Sacaria e caçamba para o descarte dos resíduos", quantidade: 1, unidade: "conj", valor: 350 },
];

const CABECALHO = {
  cliente_nome: "Dona Regina",
  numero: "RD-2026-085",
  endereco: "Rua 323, nº 115 · Jangurussu",
  objeto: "Chapisco e reboco, forro PVC e instalação de três registros",
  senha: "Regina2026",
  validade_dias: 20,
  valor_fechado: null,
  total_a_definir: false,
  // Nulos de propósito: o pedido foi explícito em não definir percentual de
  // entrada nem parcelas sem confirmação.
  entrada_percentual: null,
  pagamento: null,
  prazo: null,
  preliminar: true,
  apresentacao:
    "Execução de chapisco e reboco nos muros e paredes dos fundos, instalação de forro PVC e instalação de três registros para separar os setores hidráulicos da cozinha, do banheiro e da área de serviço.",
  intro_custos:
    "Os serviços estão na ordem de execução, etapa por etapa, com a mão de obra de cada um. Os materiais vêm na segunda tabela, insumo por insumo.",
  nota_custos:
    "A mão de obra está detalhada etapa por etapa na primeira planilha; os materiais, insumo por insumo, na segunda. As quantidades de material são levantadas do escopo, com as perdas de corte já embutidas. Os preços unitários são de referência de mercado e não são cotação de fornecedor: o valor final sai da cotação do Reginato com o depósito. Não estão incluídas pintura, impermeabilização e recuperação de patologias, que não foram descritas no levantamento, nem locação de andaimes, equipamentos e fretes, que serão apresentados separadamente se necessários. Prazo, entrada e parcelas serão definidos pelo Reginato após a vistoria. Rascunho para revisão interna.",
  status: "conferindo" as const,
};

const moeda = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function main() {
  const { data: org } = await sb
    .from("orgs")
    .select("id")
    .eq("nome_exibicao", "RD Engenharia")
    .maybeSingle();
  if (!org) throw new Error("Não achei a org RD Engenharia.");

  // Confere o levantamento antes de gravar: área por área, e a soma.
  console.log(`\n${CABECALHO.cliente_nome}  (${CABECALHO.endereco})`);
  let somaAreas = 0;
  for (const a of AREAS) {
    console.log(`  ${a.local} · ${a.calculo} = ${a.area.toFixed(2)} m²`);
    somaAreas += a.area;
  }
  somaAreas = Math.round(somaAreas * 100) / 100;
  if (Math.abs(somaAreas - 82.18) > 0.01) {
    throw new Error(`soma das áreas ${somaAreas} ≠ 82,18 m² do levantamento.`);
  }

  const subtotal =
    Math.round(
      AREAS.reduce((s, a) => s + Math.round(a.area * PRECO_REBOCO * 100) / 100, 0) * 100,
    ) / 100;
  console.log(`\n  ${somaAreas} m² × ${moeda(PRECO_REBOCO)} = ${moeda(subtotal)}`);
  if (Math.abs(subtotal - 3698.1) > 0.01) {
    throw new Error(`subtotal ${moeda(subtotal)} ≠ ${moeda(3698.1)} do levantamento.`);
  }
  console.log(`  confere com o levantamento ✓`);

  const semPreco = ITENS.filter((i) => i.valor == null).length;
  if (semPreco > 0) {
    throw new Error(`${semPreco} item(ns) sem preço — o pedido foi precificar tudo.`);
  }

  const maoDeObra =
    Math.round(
      ITENS.reduce(
        (a, i) => a + Math.round((i.quantidade ?? 1) * (i.valor ?? 0) * 100) / 100,
        0,
      ) * 100,
    ) / 100;
  const material =
    Math.round(
      MATERIAIS.reduce((a, m) => a + Math.round(m.quantidade * m.valor * 100) / 100, 0) *
        100,
    ) / 100;

  console.log(`\n  ${ITENS.length} serviços · ${MATERIAIS.length} insumos`);
  console.log(`  mão de obra  ${moeda(maoDeObra)}`);
  console.log(`  materiais    ${moeda(material)}`);
  console.log(`  total geral  ${moeda(maoDeObra + material)}`);

  if (!GRAVAR) {
    console.log("\nNada gravado. Rode com --gravar.");
    return;
  }

  const { data: existe } = await sb
    .from("orc_orcamentos")
    .select("id")
    .eq("org_id", org.id)
    .eq("token", TOKEN)
    .maybeSingle();

  let id: string;
  if (existe) {
    id = existe.id;
    const { error } = await sb.from("orc_orcamentos").update(CABECALHO).eq("id", id);
    if (error) throw new Error(error.message);
    await sb.from("orc_itens").delete().eq("orcamento_id", id);
    await sb.from("orc_secoes").delete().eq("orcamento_id", id);
    console.log(`\n  reescrevendo ${id}`);
  } else {
    const { data, error } = await sb
      .from("orc_orcamentos")
      .insert({ org_id: org.id, token: TOKEN, ...CABECALHO })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    id = data.id;
    console.log(`\n  criado ${id}`);
  }

  const { error: erroItens } = await sb.from("orc_itens").insert(
    ITENS.map((i, n) => ({
      orcamento_id: id,
      grupo: i.grupo,
      position: n + 1,
      descricao: i.descricao,
      observacao: i.observacao ?? null,
      quantidade: i.quantidade ?? null,
      unidade: i.unidade ?? null,
      valor_unitario: i.valor ?? null,
      origem: "humano" as const,
    })),
  );
  if (erroItens) throw new Error(`itens: ${erroItens.message}`);

  const porTipo = { projeto: 0, observacao: 0, etapa: 0 };
  const { error: erroSecoes } = await sb.from("orc_secoes").insert(
    SECOES.map((s) => ({
      orcamento_id: id,
      tipo: s.tipo,
      position: ++porTipo[s.tipo],
      titulo: s.titulo,
      texto: s.texto,
      origem: "humano" as const,
    })),
  );
  if (erroSecoes) throw new Error(`seções: ${erroSecoes.message}`);

  await sb.from("orc_materiais").delete().eq("orcamento_id", id);
  const { error: erroMateriais } = await sb.from("orc_materiais").insert(
    MATERIAIS.map((m, n) => ({
      orcamento_id: id,
      grupo: m.grupo,
      position: n + 1,
      descricao: m.descricao,
      quantidade: m.quantidade,
      unidade: m.unidade,
      valor: m.valor,
    })),
  );
  if (erroMateriais) throw new Error(`materiais: ${erroMateriais.message}`);

  // Confere no banco: `total` do item é coluna gerada, e um centavo de deriva
  // aparece na tabela que a cliente recebe.
  const { data: gravados } = await sb
    .from("orc_itens")
    .select("total, grupo")
    .eq("orcamento_id", id);
  const noBanco =
    Math.round((gravados ?? []).reduce((s, l) => s + Number(l.total ?? 0), 0) * 100) / 100;
  const reboco =
    Math.round(
      (gravados ?? [])
        .filter((l) => l.grupo === G3)
        .reduce((s, l) => s + Number(l.total ?? 0), 0) * 100,
    ) / 100;
  if (Math.abs(reboco - 3698.1) > 0.01) {
    throw new Error(`chapisco e reboco ${moeda(reboco)} ≠ ${moeda(3698.1)}.`);
  }
  if (Math.abs(noBanco - maoDeObra) > 0.01) {
    throw new Error(`mão de obra no banco ${moeda(noBanco)} ≠ ${moeda(maoDeObra)}.`);
  }

  const { data: mats } = await sb
    .from("orc_materiais")
    .select("quantidade, valor")
    .eq("orcamento_id", id);
  const matNoBanco =
    Math.round(
      (mats ?? []).reduce(
        (s, m) => s + Number(m.quantidade ?? 1) * Number(m.valor ?? 0),
        0,
      ) * 100,
    ) / 100;
  if (Math.abs(matNoBanco - material) > 0.01) {
    throw new Error(`materiais no banco ${moeda(matNoBanco)} ≠ ${moeda(material)}.`);
  }

  console.log(`  ${ITENS.length} itens · ${MATERIAIS.length} insumos · ${SECOES.length} seções`);
  console.log(`  chapisco e reboco ${moeda(reboco)} ✓ confere com o levantamento`);
  console.log(`  mão de obra ${moeda(noBanco)} · materiais ${moeda(matNoBanco)}`);
  console.log(`  total geral ${moeda(noBanco + matNoBanco)}`);
  console.log(`  token ${TOKEN} · senha ${CABECALHO.senha}`);
  console.log(`\nAgora publique:  npm run publicar -- ${TOKEN}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
