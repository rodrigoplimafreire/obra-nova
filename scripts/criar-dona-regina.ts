/**
 * O orçamento da Dona Regina — Rua 323, nº 115, Jangurussu.
 *
 * Chapisco e reboco nos muros e paredes dos fundos (82,18 m²), forro PVC
 * (10,30 m²) e três registros para isolar cozinha, banheiro e área de serviço.
 *
 * **Nasce rascunho, e preliminar.** Um único serviço tem preço: a mão de obra
 * de chapisco e reboco, R$ 3.698,10, pelos R$ 45,00/m² que as composições
 * anteriores usaram. Esse número é **subtotal de uma etapa**, não o valor da
 * obra — o documento o rotula "Mão de obra · subtotal" justamente porque há
 * linha sem preço na mesma tabela.
 *
 * Tudo o mais entra **sem valor**, com a linha descrevendo o serviço, e sai no
 * documento como "a definir". Era possível deixar de fora o que não tem preço,
 * como foi feito no Sr. Sousa, mas aqui é o contrário do que se quer: o
 * Reginato vai precificar em cima desta lista, e o que não está escrito não é
 * lembrado. Preço nenhum foi estimado — nem o do forro, nem o dos registros,
 * nem o dos materiais.
 *
 * **O que de propósito não foi preenchido:**
 *
 * - `valor_fechado` nulo: o total da obra não existe ainda.
 * - `entrada_percentual` nulo, e por isso a seção "Forma de pagamento" não sai.
 *   Com percentual preenchido o documento desenharia parcelas sobre
 *   R$ 3.698,10, que é a conta errada em cima do número errado.
 * - `prazo` nulo: quem sabe o prazo é o Reginato, depois da vistoria.
 * - Sem macroetapa em `orc_modulos`: a seção 2 existe para mostrar o prazo de
 *   cada etapa, e prazo é exatamente o que não há. Sem semana em
 *   `orc_cronograma`, pela mesma razão. Ver ESTRUTURA-DA-PROPOSTA.md.
 *
 * A publicação continua travada enquanto houver item sem preço e sem valor
 * fechado — e isto está certo: esta proposta não vai ao cliente pela metade.
 *
 * Rodar com `--gravar`. Refaz itens, materiais e seções a cada rodada.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

/**
 * O cliente nasce só na hora de gravar, e não no topo do módulo: sem
 * `--gravar` este script é uma conferência de contas, e tem que rodar na
 * máquina de quem não tem a chave de serviço à mão.
 */
const banco = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

const GRAVAR = process.argv.includes("--gravar");

const TOKEN = "dona-regina";
const SENHA = "Regina2026";

type Item = {
  grupo: string;
  descricao: string;
  quantidade?: number;
  unidade?: string;
  /** Preço de venda da mão de obra. Ausente = a definir pelo Reginato. */
  valor?: number;
  observacao?: string;
};

/** Material sem `valor` sai no documento como "a definir". Nunca como zero. */
type Material = {
  grupo: string;
  descricao: string;
  quantidade?: number;
  unidade?: string;
  valor?: number;
};

type Secao = {
  tipo: "projeto" | "observacao" | "etapa";
  titulo: string;
  texto: string;
};

const E1 = "1 · Conferência e preparação";
const E2 = "2 · Instalação dos registros";
const E3 = "3 · Chapisco e reboco";
const E4 = "4 · Forro PVC";
const E5 = "5 · Verificação e entrega";

/**
 * O levantamento, face a face. As áreas são brutas — uma face de cada parede
 * ou muro —, e os produtos conferem com o que o Peixoto mediu:
 *
 *   5,44 × 4,11 = 22,36    muro de divisa dos fundos
 *   3,19 × 4,11 = 13,11    muro lateral
 *   3,55 × 5,91 = 20,98    fachada dos fundos
 *   3,19 × 2,85 =  9,09    fachada lateral do superior
 *   6,82 × 2,44 = 16,64    lavanderia (2,23 + 2,72 + 1,87 de comprimento)
 *                 ------
 *                  82,18 m²  × R$ 45,00 = R$ 3.698,10
 *
 *   1,88 × 5,48 = 10,30 m²  forro PVC
 */
const M2_CHAPISCO = 82.18;
const M2_FORRO = 10.3;
const PRECO_REBOCO = 45;

const ITENS: Item[] = [
  { grupo: E1, descricao: "Conferência das medidas e das condições das superfícies a receber chapisco e reboco", quantidade: 1, unidade: "serv", observacao: "As áreas desta composição são brutas, com uma face de cada parede ou muro. Portas, janelas e demais vãos serão descontados na conferência." },
  { grupo: E1, descricao: "Definição dos acessos para execução nas áreas elevadas", quantidade: 1, unidade: "serv", observacao: "Andaimes, plataformas e equipamentos de acesso serão discriminados depois da vistoria." },
  { grupo: E1, descricao: "Proteção dos ambientes e dos elementos próximos à intervenção", quantidade: 1, unidade: "serv" },
  { grupo: E1, descricao: "Verificação do percurso das tubulações e dos pontos de instalação dos registros", quantidade: 1, unidade: "serv" },

  { grupo: E2, descricao: "Instalação de registro para isolamento da cozinha", quantidade: 1, unidade: "un", observacao: "As intervenções hidráulicas acontecem antes do acabamento das paredes afetadas. Tipo e diâmetro dos registros, acessibilidade das tubulações e eventual remanejamento a confirmar." },
  { grupo: E2, descricao: "Instalação de registro para isolamento do banheiro", quantidade: 1, unidade: "un" },
  { grupo: E2, descricao: "Instalação de registro para isolamento da área de serviço", quantidade: 1, unidade: "un" },
  { grupo: E2, descricao: "Testes de funcionamento e verificação de vazamentos antes do fechamento dos trechos de parede abertos", quantidade: 1, unidade: "conj" },

  { grupo: E3, descricao: "Chapisco e reboco do muro de divisa dos fundos (5,44 × 4,11 m)", quantidade: 22.36, unidade: "m²", valor: PRECO_REBOCO, observacao: "O preço de R$ 45,00/m² é referência preliminar, vinda das composições anteriores da RD. O Reginato revisa a adequação dele às alturas e às condições de acesso desta obra." },
  { grupo: E3, descricao: "Chapisco e reboco do muro lateral (3,19 × 4,11 m)", quantidade: 13.11, unidade: "m²", valor: PRECO_REBOCO },
  { grupo: E3, descricao: "Chapisco e reboco da fachada dos fundos (3,55 × 5,91 m)", quantidade: 20.98, unidade: "m²", valor: PRECO_REBOCO },
  { grupo: E3, descricao: "Chapisco e reboco da fachada lateral do pavimento superior (3,19 × 2,85 m)", quantidade: 9.09, unidade: "m²", valor: PRECO_REBOCO },
  { grupo: E3, descricao: "Chapisco e reboco das paredes da lavanderia (2,23 + 2,72 + 1,87 m de comprimento × 2,44 m de altura)", quantidade: 16.64, unidade: "m²", valor: PRECO_REBOCO },

  { grupo: E4, descricao: "Instalação de forro PVC na área de 1,88 × 5,48 m", quantidade: M2_FORRO, unidade: "m²", observacao: "Instalado depois dos serviços de argamassa que possam afetá-lo. Os 10,30 m² são a área instalada; as perdas de corte entram na compra. Cor, modelo, altura de instalação e existência de estrutura aproveitável a confirmar." },

  { grupo: E5, descricao: "Conferência dos acabamentos do chapisco e reboco", quantidade: 1, unidade: "serv" },
  { grupo: E5, descricao: "Conferência da fixação e do acabamento do forro PVC", quantidade: 1, unidade: "serv" },
  { grupo: E5, descricao: "Verificação do isolamento independente dos três setores hidráulicos", quantidade: 1, unidade: "conj" },
  { grupo: E5, descricao: "Limpeza e destinação dos resíduos da execução", quantidade: 1, unidade: "serv", observacao: "A verba de limpeza e descarte será confirmada antes do fechamento." },
];

/**
 * Os materiais, etapa por etapa, **todos sem preço**.
 *
 * A quantidade só aparece onde ela existe de verdade: a área de forro, que é
 * medida, e os três registros, que são contados. A argamassa depende da
 * espessura média do reboco e das condições da base, e chutar saco de cimento
 * aqui seria inventar número na mesma linha em que o documento promete não
 * inventar.
 */
const MATERIAIS: Material[] = [
  { grupo: E1, descricao: "Proteção dos ambientes, andaimes e equipamentos de acesso às áreas elevadas", quantidade: 1, unidade: "conj" },

  { grupo: E2, descricao: "Registros, conexões e tubos para o isolamento dos três setores", quantidade: 3, unidade: "un" },
  { grupo: E2, descricao: "Materiais de recomposição dos trechos de parede abertos para a instalação", quantidade: 1, unidade: "conj" },

  { grupo: E3, descricao: `Cimento, areia, cal e aditivos para chapisco e reboco em ${M2_CHAPISCO.toLocaleString("pt-BR")} m² — consumo conforme a espessura média definida, as condições da base e a composição adotada`, quantidade: 1, unidade: "vb" },

  { grupo: E4, descricao: "Réguas de forro PVC", quantidade: M2_FORRO, unidade: "m²" },
  { grupo: E4, descricao: "Estrutura de fixação do forro", quantidade: 1, unidade: "conj" },
  { grupo: E4, descricao: "Perfis de acabamento perimetral", quantidade: 1, unidade: "conj" },
  { grupo: E4, descricao: "Fixadores e acessórios de montagem", quantidade: 1, unidade: "conj" },

  { grupo: E5, descricao: "Materiais de limpeza e descarte dos resíduos da execução", quantidade: 1, unidade: "conj" },
];

const SECOES: Secao[] = [
  { tipo: "projeto", titulo: "Chapisco e reboco · 82,18 m²", texto: "Muro de divisa dos fundos (22,36 m²), muro lateral (13,11 m²), fachada dos fundos (20,98 m²), fachada lateral do pavimento superior (9,09 m²) e paredes da lavanderia (16,64 m²)." },
  { tipo: "projeto", titulo: "Forro PVC · 10,30 m²", texto: "Fornecimento e instalação de forro PVC na área de 1,88 × 5,48 m, com estrutura de fixação, perfis de acabamento perimetral e acessórios de montagem." },
  { tipo: "projeto", titulo: "Registros · Três setores isolados", texto: "Instalação de três registros para que cozinha, banheiro e área de serviço possam ser isolados individualmente, com teste de funcionamento e verificação de vazamentos." },

  { tipo: "observacao", titulo: "As áreas são brutas e serão conferidas", texto: "O levantamento considera uma face de cada parede ou muro informado, com as quantidades arredondadas em duas casas por item. Portas, janelas e demais vãos serão descontados antes do fechamento, e a área líquida pode ser menor que os 82,18 m² desta composição." },
  { tipo: "observacao", titulo: "O preço de R$ 45,00/m² é referência preliminar", texto: "O valor vem das composições anteriores da RD e responde apenas pela mão de obra de chapisco e reboco, em R$ 3.698,10. É subtotal de uma etapa, não o valor da obra. O Reginato revisa a adequação do preço às alturas e às condições de acesso desta obra." },
  { tipo: "observacao", titulo: "Os materiais ainda não foram cotados", texto: "A lista de materiais entra discriminada por etapa, sem preço: os valores saem da cotação do Reginato com o depósito. A argamassa depende da espessura média do reboco, das condições da base e da composição adotada, e por isso a quantidade também fica pendente." },
  { tipo: "observacao", titulo: "O que a cotação do forro precisa contemplar", texto: "Réguas de PVC, estrutura de fixação, perfis de acabamento perimetral, fixadores e acessórios, e a mão de obra de montagem e instalação. Confirmar cor, modelo, altura de instalação e se há estrutura aproveitável. Os 10,30 m² são a área instalada; as perdas de corte entram na compra." },
  { tipo: "observacao", titulo: "Registros · o que falta definir", texto: "Tipo e diâmetro dos registros, acessibilidade das tubulações e necessidade de remanejamento para que os três setores sejam isolados individualmente. Também o que a recomposição dos trechos abertos inclui em reboco, revestimento e pintura." },
  { tipo: "observacao", titulo: "Prazo e forma de pagamento a definir", texto: "O prazo de execução será definido pelo Reginato depois da vistoria e da confirmação da equipe e dos materiais. Entrada, saldo e vencimentos ainda não estão definidos: as parcelas só serão calculadas quando houver valor total e percentual de entrada acordados. Se o prazo justificar parcelas intermediárias, os pagamentos serão organizados a cada 20 dias, vinculados ao cronograma." },
  { tipo: "observacao", titulo: "Fora desta composição", texto: "Pintura, impermeabilização e recuperação de patologias não foram descritas no levantamento e não estão precificadas. Locação de andaimes, equipamentos e fretes, caso necessários, serão apresentados separadamente." },
  { tipo: "observacao", titulo: "Confirmações para a emissão final", texto: "Cidade e identificação completa da cliente; áreas líquidas após a conferência dos vãos; condições das bases e necessidade de retirada do reboco existente; espessura média do novo reboco; acesso às fachadas e necessidade de andaimes; modelo do PVC e estrutura de fixação; tipo, diâmetro e localização dos três registros; eventual remanejamento de tubulações e recomposição das aberturas; materiais, fretes, limpeza e descarte; e por fim valor final, prazo, pagamento e validade da proposta." },

  { tipo: "etapa", titulo: "Antes do início", texto: "Vistoria com conferência das medidas e das condições das superfícies, definição dos acessos às áreas elevadas, proteção dos ambientes e verificação do percurso das tubulações." },
  { tipo: "etapa", titulo: "Primeiro, os registros", texto: "A instalação dos três registros vem antes do acabamento das paredes afetadas, com teste de funcionamento e verificação de vazamentos antes de fechar os trechos abertos." },
  { tipo: "etapa", titulo: "Depois, chapisco e reboco", texto: "Execução dos 82,18 m² de chapisco e reboco nos muros, nas fachadas e nas paredes da lavanderia, incluindo a recomposição dos trechos abertos para os registros." },
  { tipo: "etapa", titulo: "Por último, o forro e a entrega", texto: "O forro PVC é instalado depois dos serviços de argamassa que possam afetá-lo. Na entrega, conferência dos acabamentos e da fixação do forro, verificação do isolamento dos três setores, limpeza e descarte dos resíduos." },
  { tipo: "etapa", titulo: "Sobre a sequência", texto: "A ordem é técnica e está definida; as datas não. O prazo em semanas e em dias será informado depois da vistoria, junto com a disponibilidade da equipe e dos materiais." },
];

const CABECALHO = {
  cliente_nome: "Dona Regina",
  numero: "RD-2026-085",
  endereco: "Rua 323, nº 115 — Jangurussu (cidade a confirmar)",
  objeto:
    "Chapisco e reboco dos muros e paredes dos fundos, forro PVC e instalação de três registros",
  senha: SENHA,
  prazo: null,
  validade_dias: 20,
  valor_fechado: null,
  entrada_percentual: null,
  pagamento: null,
  material_percentual: null,
  preliminar: true,
  apresentacao:
    "Execução de chapisco e reboco nos muros e paredes dos fundos da residência da Dona Regina, na Rua 323, nº 115, Jangurussu, com instalação de forro PVC na área de 1,88 × 5,48 m e de três registros para que cozinha, banheiro e área de serviço possam ser isolados individualmente. Os materiais entram discriminados por etapa, em tabela própria.",
  intro_custos:
    "Os serviços estão na ordem de execução, item por item, com a medição de cada um. Os valores desta tabela são de mão de obra; os materiais vêm na tabela seguinte. O que ainda não foi precificado aparece como a definir — nenhum valor foi estimado.",
  nota_custos:
    "Composição preliminar. O único serviço precificado é a mão de obra de chapisco e reboco, em R$ 3.698,10, por R$ 45,00/m² de referência — é subtotal de uma etapa, e não o valor da obra. Mão de obra de registros, forro, preparação e limpeza, e todos os materiais, serão precificados pela RD. O valor total da obra, com materiais e mão de obra, ainda será definido, assim como prazo, entrada e vencimentos. Proposta sujeita à revisão técnica do responsável e a reajuste.",
  status: "conferindo" as const,
  situacao: "rascunho" as const,
};

const moeda = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const totalDoItem = (i: Item) =>
  i.valor == null || i.quantidade == null
    ? null
    : Math.round(i.quantidade * i.valor * 100) / 100;

/** O que a conferência tem que bater, antes de qualquer gravação. */
const SUBTOTAIS: Record<string, number | null> = {
  [E1]: null,
  [E2]: null,
  [E3]: 3698.1,
  [E4]: null,
  [E5]: null,
};

async function main() {
  const grupos = [...new Set(ITENS.map((i) => i.grupo))];

  const area = ITENS.filter((i) => i.grupo === E3).reduce(
    (s, i) => s + (i.quantidade ?? 0),
    0,
  );
  if (Math.abs(area - M2_CHAPISCO) > 0.001) {
    throw new Error(`as faces somam ${area} m², e o levantamento diz ${M2_CHAPISCO} m².`);
  }

  console.log(`\nDona Regina  (${TOKEN})`);
  let soma = 0;
  for (const g of grupos) {
    const doGrupo = ITENS.filter((i) => i.grupo === g);
    const comPreco = doGrupo.filter((i) => totalDoItem(i) !== null);
    const sub = comPreco.reduce((s, i) => s + (totalDoItem(i) ?? 0), 0);
    soma += sub;
    const esperado = SUBTOTAIS[g];
    if (esperado != null && Math.abs(sub - esperado) > 0.01) {
      throw new Error(`${g}: ${moeda(sub)} ≠ ${moeda(esperado)} do levantamento.`);
    }
    if (esperado == null && comPreco.length > 0) {
      throw new Error(`${g} ganhou preço, e o levantamento não tem preço para esta etapa.`);
    }
    console.log(
      `  ${g} — ${doGrupo.length} ${doGrupo.length === 1 ? "serviço" : "serviços"}` +
        (sub > 0 ? ` · ${moeda(sub)} ✓` : " · a definir"),
    );
  }

  if (Math.abs(soma - 3698.1) > 0.01) {
    throw new Error(`mão de obra precificada ${moeda(soma)} ≠ ${moeda(3698.1)}.`);
  }
  console.log(`\n  mão de obra precificada  ${moeda(soma)} ✓  (${M2_CHAPISCO.toLocaleString("pt-BR")} m² × ${moeda(PRECO_REBOCO)})`);
  console.log(`  mão de obra a definir    ${ITENS.filter((i) => i.valor == null).length} serviços`);
  console.log(`  materiais                ${MATERIAIS.length} insumos, todos a definir`);
  console.log(`  total da obra            a definir`);

  if (MATERIAIS.some((m) => m.valor != null)) {
    throw new Error("material com preço: nenhum foi cotado, e o levantamento não traz valor.");
  }

  if (!GRAVAR) {
    console.log("\nNada gravado. Rode com --gravar.");
    return;
  }

  const sb = banco();

  const { data: org } = await sb
    .from("orgs")
    .select("id")
    .eq("nome_exibicao", "RD Engenharia")
    .maybeSingle();
  if (!org) throw new Error("Não achei a org RD Engenharia.");

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
    await sb.from("orc_materiais").delete().eq("orcamento_id", id);
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

  const { error: erroMateriais } = await sb.from("orc_materiais").insert(
    MATERIAIS.map((m, n) => ({
      orcamento_id: id,
      grupo: m.grupo,
      position: n + 1,
      descricao: m.descricao,
      quantidade: m.quantidade ?? null,
      unidade: m.unidade ?? null,
      valor: m.valor ?? null,
    })),
  );
  if (erroMateriais) throw new Error(`materiais: ${erroMateriais.message}`);

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

  // `total` é coluna gerada pelo banco, e um centavo de deriva aparece na
  // tabela que a cliente recebe.
  const { data: gravados } = await sb
    .from("orc_itens")
    .select("total")
    .eq("orcamento_id", id);
  const noBanco = (gravados ?? []).reduce((s, l) => s + Number(l.total ?? 0), 0);
  if (Math.abs(noBanco - 3698.1) > 0.01) {
    throw new Error(`soma no banco ${moeda(noBanco)} ≠ ${moeda(3698.1)}.`);
  }
  console.log(`  soma no banco ${moeda(noBanco)} ✓`);
  console.log(
    `  ${ITENS.length} itens · ${MATERIAIS.length} materiais · ${SECOES.length} seções · senha ${SENHA}`,
  );
  console.log(
    "\nFica rascunho de propósito. A publicação segue travada enquanto houver\n" +
      "item sem preço, e é o Reginato que preenche o que falta na tela do orçamento.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
