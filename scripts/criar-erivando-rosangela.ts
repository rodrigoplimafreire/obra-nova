/**
 * Orçamento preliminar de reforma — Sr. Erivando e Sra. Rosangela.
 *
 * Mão de obra apenas, com **preço por item**: é um dos poucos da RD em que
 * cada linha tem quantidade e valor unitário, e por isso o total sai da soma
 * e não de um número digitado. `valor_fechado` fica nulo de propósito — com
 * ele preenchido o documento mostraria o número fixo e ignoraria a tabela,
 * que aqui é justamente o que o Reginato precisa conferir.
 *
 * **É versão preliminar, para revisão interna.** As premissas da composição
 * entram como observações, porque são exatamente o que o Reginato tem que
 * responder antes de o documento ir aos clientes: espessura do contrapiso,
 * formato do porcelanato do banheiro, acesso ao pavimento superior, escopo da
 * limpeza e do descarte.
 *
 * Existe um "Sr. Erivando" mais antigo no painel, de agosto, R$ 10.000,00 e
 * sem endereço. Este é outro orçamento — outro escopo e outro valor. Se for a
 * mesma pessoa, vale unificar o nome depois; criar em cima do antigo apagaria
 * um histórico que ninguém pediu para apagar.
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
const TOKEN = "erivando-rosangela";

const G1 = "1 · Gesso liso, preparação e pintura";
const G2 = "2 · Piso e porcelanato";
const G3 = "3 · Banheiro do pavimento superior";

type Item = {
  grupo: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  valor: number;
};

const ITENS: Item[] = [
  { grupo: G1, descricao: "Aplicação de fundo preparador nas paredes internas do pavimento superior, antes do gesso", quantidade: 102.63, unidade: "m²", valor: 10 },
  { grupo: G1, descricao: "Aplicação de selador no forro do pavimento superior", quantidade: 38.04, unidade: "m²", valor: 11.32 },
  { grupo: G1, descricao: "Aplicação de gesso liso nas paredes internas para regularização da superfície", quantidade: 102.63, unidade: "m²", valor: 35 },
  { grupo: G1, descricao: "Aplicação de massa corrida PVA nas paredes e no forro, incluindo lixamento", quantidade: 140.67, unidade: "m²", valor: 38 },
  { grupo: G1, descricao: "Pintura das paredes internas do pavimento superior", quantidade: 102.63, unidade: "m²", valor: 25 },
  { grupo: G1, descricao: "Pintura do forro do pavimento superior", quantidade: 38.04, unidade: "m²", valor: 30 },

  { grupo: G2, descricao: "Execução de contrapiso de regularização no pavimento superior", quantidade: 31.04, unidade: "m²", valor: 35 },
  { grupo: G2, descricao: "Assentamento de porcelanato 80 × 80 cm no piso interno", quantidade: 31.04, unidade: "m²", valor: 85 },
  { grupo: G2, descricao: "Instalação de rodapé em porcelanato", quantidade: 67, unidade: "m linear", valor: 25 },

  { grupo: G3, descricao: "Execução de contrapiso de regularização do banheiro", quantidade: 6.91, unidade: "m²", valor: 35 },
  { grupo: G3, descricao: "Impermeabilização de piso e paredes com argamassa polimérica, nas paredes até 2,00 m de altura", quantidade: 29.31, unidade: "m²", valor: 45 },
  { grupo: G3, descricao: "Assentamento de revestimento porcelanato nas paredes", quantidade: 35.84, unidade: "m²", valor: 95 },
  { grupo: G3, descricao: "Assentamento de porcelanato no piso do banheiro", quantidade: 6.91, unidade: "m²", valor: 100 },
  { grupo: G3, descricao: "Instalação de um sanitário, uma pia, um chuveiro e acessórios a discriminar", quantidade: 1, unidade: "conj", valor: 650 },
];

const CABECALHO = {
  cliente_nome: "Sr. Erivando e Sra. Rosangela",
  endereco: "Rua Guará, nº 430 · Potira II · Caucaia/CE",
  objeto: "Reforma do pavimento superior — mão de obra",
  senha: "Rosangela2026",
  validade_dias: 20,
  // Nulo de propósito: o total é a soma da tabela, item por item.
  valor_fechado: null,
  apresentacao:
    "Reforma do pavimento superior da residência: regularização das paredes com gesso liso, preparação e pintura, contrapiso e porcelanato, e o banheiro completo com impermeabilização. Orçamento de mão de obra — o material fica por conta dos contratantes.",
  intro_custos:
    "Cada serviço entra com a sua quantidade, o preço unitário e o total. O valor da obra é a soma da tabela, e cada etapa fecha com o seu próprio subtotal.",
  nota_custos:
    "Somente mão de obra. Materiais de construção, tintas, revestimentos, louças, metais e acessórios não estão inclusos. Alteração de escopo implica reajuste do valor.",
  status: "conferindo" as const,
};

/** As premissas da composição, que no documento entram como observações. */
const PREMISSAS: Array<{ titulo: string; texto: string }> = [
  {
    titulo: "Só mão de obra",
    texto:
      "Materiais de construção, tintas, revestimentos, louças, metais e acessórios não estão incluídos neste orçamento e ficam por conta dos contratantes, conforme especificação e programação acordadas com a RD.",
  },
  {
    titulo: "Gesso liso antes da massa corrida",
    texto:
      "A regularização com gesso liso antecede a massa corrida, conforme a condição das paredes descrita no levantamento. O sistema de preparação e acabamento será confirmado pelo responsável técnico.",
  },
  {
    titulo: "Assentamento e recortes",
    texto:
      "O assentamento considera cortes retos usuais e rejuntamento. Recortes especiais, nichos e acabamentos em meia-esquadria dependem de definição e revisão do preço.",
  },
  {
    titulo: "Rodapé sobreposto",
    texto:
      "O rodapé foi considerado sobreposto, com peças previamente cortadas. Corte das peças e instalação embutida precisam ser orçados à parte, se necessários.",
  },
  {
    titulo: "Pontos já existentes",
    texto:
      "A instalação de louças e metais considera pontos hidráulicos, de esgoto e elétricos existentes e prontos para conexão.",
  },
  {
    titulo: "A confirmar antes do fechamento",
    texto:
      "Espessura do contrapiso, formato do porcelanato do banheiro, condições de acesso e transporte dos materiais ao pavimento superior. Proteção dos ambientes, limpeza final e descarte de resíduos precisam ter escopo e valor definidos. Prazo de execução, forma de pagamento e validade serão definidos na revisão.",
  },
];

const PROJETO: Array<{ titulo: string; texto: string }> = [
  {
    titulo: "Paredes e forro · Gesso liso e pintura",
    texto:
      "Fundo preparador, gesso liso para regularizar 102,63 m² de parede, selador no forro, massa corrida PVA com lixamento e pintura de paredes e forro.",
  },
  {
    titulo: "Piso · Contrapiso e porcelanato",
    texto:
      "Contrapiso de regularização em 31,04 m², assentamento de porcelanato 80 × 80 cm e 67 metros de rodapé em porcelanato.",
  },
  {
    titulo: "Banheiro · Impermeabilização e louças",
    texto:
      "Contrapiso, impermeabilização com argamassa polimérica até 2,00 m de altura, porcelanato em piso e paredes e instalação de sanitário, pia, chuveiro e acessórios.",
  },
];

const moeda = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** O `total` da linha é coluna gerada; a conferência é sobre o mesmo cálculo. */
const totalDoItem = (i: Item) => Math.round(i.quantidade * i.valor * 100) / 100;

async function main() {
  const { data: org } = await sb
    .from("orgs")
    .select("id")
    .eq("nome_exibicao", "RD Engenharia")
    .maybeSingle();
  if (!org) throw new Error("Não achei a org RD Engenharia.");

  const grupos = [...new Set(ITENS.map((i) => i.grupo))];
  let soma = 0;

  console.log(`\n${CABECALHO.cliente_nome}`);
  console.log(`  ${CABECALHO.endereco}`);
  for (const g of grupos) {
    const doGrupo = ITENS.filter((i) => i.grupo === g);
    const sub = doGrupo.reduce((s, i) => s + totalDoItem(i), 0);
    soma += sub;
    console.log(`  ${g} — ${doGrupo.length} serviços · ${moeda(sub)}`);
  }
  console.log(`  total ${moeda(soma)}`);

  // O total da planilha que o Rodrigo passou. Se a soma divergir, é erro de
  // digitação de alguma linha, e gravar assim colocaria um número errado num
  // documento que vai ser assinado.
  const ESPERADO = 25807.77;
  if (Math.abs(soma - ESPERADO) > 0.01) {
    throw new Error(`soma ${moeda(soma)} ≠ ${moeda(ESPERADO)} da planilha.`);
  }
  console.log(`  confere com a planilha: ${moeda(ESPERADO)}`);

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
    const { error } = await sb
      .from("orc_orcamentos")
      .update(CABECALHO)
      .eq("id", id);
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
      quantidade: i.quantidade,
      unidade: i.unidade,
      valor_unitario: i.valor,
      origem: "humano" as const,
    })),
  );
  if (erroItens) throw new Error(`itens: ${erroItens.message}`);

  const { error: erroSecoes } = await sb.from("orc_secoes").insert([
    ...PROJETO.map((s, n) => ({
      orcamento_id: id,
      tipo: "projeto" as const,
      position: n + 1,
      titulo: s.titulo,
      texto: s.texto,
      origem: "humano" as const,
    })),
    ...PREMISSAS.map((s, n) => ({
      orcamento_id: id,
      tipo: "observacao" as const,
      position: n + 1,
      titulo: s.titulo,
      texto: s.texto,
      origem: "humano" as const,
    })),
  ]);
  if (erroSecoes) throw new Error(`seções: ${erroSecoes.message}`);

  // Confere no banco: um centavo de deriva no numeric passa despercebido aqui
  // e aparece na tabela que o cliente recebe.
  const { data: gravados } = await sb
    .from("orc_itens")
    .select("total")
    .eq("orcamento_id", id);
  const noBanco = (gravados ?? []).reduce((s, l) => s + Number(l.total ?? 0), 0);
  if (Math.abs(noBanco - ESPERADO) > 0.01) {
    throw new Error(`soma no banco ${moeda(noBanco)} ≠ ${moeda(ESPERADO)}.`);
  }

  console.log(`  ${ITENS.length} itens · ${PROJETO.length + PREMISSAS.length} seções`);
  console.log(`  soma no banco: ${moeda(noBanco)}`);
  console.log(`  token ${TOKEN} · senha ${CABECALHO.senha}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
