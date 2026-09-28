/**
 * Dois orçamentos novos: Sr. Sousa e Diaconia Shalom RG3.
 *
 * Os dois nascem **preliminares**, com a tarja ligada: as condições são
 * provisórias e ficam identificadas até a revisão do Reginato.
 *
 * **Sr. Sousa** — mão de obra, item a item, R$ 88.832,10 em dez etapas
 * precificadas. `valor_fechado` fica nulo porque o total geral *não existe
 * ainda*: falta o material e faltam parcelas de mão de obra. O documento soma
 * a tabela e rotula "Total geral", e a nota abaixo diz o que esse número não
 * inclui.
 *
 * O que não tem preço **não entra como item**. Item sem valor sairia com um
 * travessão na coluna, e a regra é que valor desconhecido apareça como "A
 * definir" — então a etapa 1, a impermeabilização que falta e a limpeza final
 * entram como observação, por escrito. Também é o que destrava a publicação: o
 * documento se recusa a publicar item sem preço quando não há valor fechado.
 *
 * **Diaconia Shalom RG3** — R$ 3.220,00 fechado, material e mão de obra
 * juntos, sem preço por linha. A discriminação entre os dois ainda não existe,
 * e distribuir o total por conta própria seria inventar número. Os sete
 * serviços entram sem valor, e o valor fechado responde pelo total.
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

type Item = {
  grupo: string;
  descricao: string;
  quantidade?: number;
  unidade?: string;
  valor?: number;
  observacao?: string;
};

type Secao = { tipo: "projeto" | "observacao" | "etapa"; titulo: string; texto: string };

type Proposta = {
  token: string;
  senha: string;
  /** Subtotal esperado de cada grupo, para a conferência antes de gravar. */
  subtotais?: Record<string, number>;
  esperado?: number;
  cabecalho: Record<string, unknown>;
  itens: Item[];
  secoes: Secao[];
};

// ============================================================== SR. SOUSA

const S2 = "2 · Estrutura frontal da ampliação";
const S3 = "3 · Alvenarias, elevação dos muros e abertura de vão";
const S4 = "4 · Coberturas, reservatório e proteção dos muros";
const S5 = "5 · Infraestrutura elétrica e hidrossanitária";
const S6 = "6 · Aterros, concretagem e contrapisos";
const S7 = "7 · Chapisco e reboco";
const S8 = "8 · Impermeabilização";
const S9 = "9 · Pisos, revestimentos e escada";
const S10 = "10 · Preparação e pintura das paredes do térreo";
const S11 = "11 · Louças, metais, testes e conclusão";

const SOUSA: Proposta = {
  token: "sousa",
  senha: "Sousa2026",
  esperado: 88832.1,
  subtotais: {
    [S2]: 9000,
    [S3]: 7707.85,
    [S4]: 12353.7,
    [S5]: 10000,
    [S6]: 10006.5,
    [S7]: 13209.75,
    [S8]: 118.8,
    [S9]: 15501.1,
    [S10]: 10284.4,
    [S11]: 650,
  },
  cabecalho: {
    cliente_nome: "Sr. Sousa",
    numero: "RD-2026-083",
    objeto:
      "Reforma do térreo, áreas externas e ampliação com pavimento superior",
    senha: "Sousa2026",
    prazo: "60 dias, sujeito à confirmação do escopo e da equipe",
    validade_dias: 20,
    valor_fechado: null,
    // Nulo de propósito: a entrada é de 30% e as três seguintes são iguais
    // entre si, e o documento só sabe desenhar entrada+final ou parcelas todas
    // iguais. Com o percentual preenchido ele imprimiria quatro de
    // R$ 22.208,03, que não é o combinado. O combinado vai por escrito.
    entrada_percentual: null,
    parcelas: 4,
    pagamento:
      "entrada de 30% (R$ 26.649,63) e três parcelas de R$ 20.727,49 a cada 20 dias",
    preliminar: true,
    apresentacao:
      "Reforma e acabamento do pavimento térreo, intervenções nas áreas externas e ampliação com pavimento superior sem divisórias internas. Os valores desta composição são de mão de obra; os materiais serão discriminados em orçamento separado.",
    intro_custos:
      "Os serviços estão na ordem de execução, etapa por etapa, com quantidade e preço de mão de obra. Os materiais não estão incluídos nestes valores.",
    nota_custos:
      "Somente mão de obra — os materiais serão orçados à parte e o total geral de materiais mais mão de obra ainda não está definido. O valor acima também não inclui as parcelas de mão de obra ainda sem preço: vistoria e definição técnica, o sistema completo de impermeabilização das áreas molhadas, e a limpeza final com descarte de resíduos. Pagamento: entrada de 30% (R$ 26.649,63) na aprovação e três parcelas de R$ 20.727,49 a cada 20 dias, conforme medição. Composição preliminar, sujeita à revisão técnica e a reajuste.",
    status: "conferindo" as const,
  },
  itens: [
    { grupo: S2, descricao: "Execução da estrutura frontal: duas sapatas de 1,20 × 1,20 m, dois pilares de 7,00 m (seção 30 × 15 cm) e uma viga de 6,00 m de vão livre (seção 60 × 15 cm)", quantidade: 1, unidade: "conj", valor: 9000, observacao: "Verba provisória. As dimensões reproduzem o levantamento e não constituem validação estrutural. Nova laje, reforços da estrutura existente e outros elementos necessários não estão precificados." },

    { grupo: S3, descricao: "Construção das duas paredes laterais do pavimento superior (duas faces de 8,63 × 4,00 m)", quantidade: 69.04, unidade: "m²", valor: 65, observacao: "Não considerados os fechamentos frontal e posterior." },
    { grupo: S3, descricao: "Elevação dos muros da frente, de 2,50 para 3,00 m", quantidade: 12.05, unidade: "m²", valor: 65 },
    { grupo: S3, descricao: "Execução de cinta de amarração dos muros", quantidade: 24.1, unidade: "m linear", valor: 70, observacao: "Preço provisório." },
    { grupo: S3, descricao: "Abertura e acabamento do vão de porta do banheiro social", quantidade: 1, unidade: "serv", valor: 750, observacao: "Verba provisória." },

    { grupo: S4, descricao: "Montagem da estrutura e cobertura colonial do pavimento superior", quantidade: 51.78, unidade: "m²", valor: 90, observacao: "Calculada pela projeção horizontal. Inclinação, beirais, calhas e rufos a definir." },
    { grupo: S4, descricao: "Montagem da estrutura e cobertura colonial dos fundos", quantidade: 15, unidade: "m²", valor: 90 },
    { grupo: S4, descricao: "Conjunto de apoio e abrigo da caixa-d'água de 500 litros (2,00 × 2,00 × 4,00 m): alvenaria, cinta, laje, cobertura e instalação do reservatório", quantidade: 1, unidade: "conj", valor: 5500, observacao: "Verba provisória. A execução depende da definição técnica e dos apoios necessários." },
    { grupo: S4, descricao: "Instalação de chapim nos muros da frente", quantidade: 24.1, unidade: "m linear", valor: 35 },

    { grupo: S5, descricao: "Instalações elétricas: infraestrutura, passagem de cabos, montagem e testes", quantidade: 1, unidade: "conj", valor: 8500, observacao: "Verba provisória, conforme levantamento a concluir. Confirmar o atendimento ao térreo, superior, garagem, fundos e reservatório." },
    { grupo: S5, descricao: "Adequações hidráulicas e de esgoto do banheiro da suíte", quantidade: 1, unidade: "conj", valor: 1500, observacao: "Verba provisória. As instalações embutidas antecedem os revestimentos; a montagem dos acabamentos e os testes finais acontecem na conclusão, sem nova cobrança desta verba." },

    { grupo: S6, descricao: "Espalhamento e compactação de aterro na garagem", quantidade: 21.72, unidade: "m³", valor: 60, observacao: "Volume geométrico para elevação de 40 cm; não representa volume de compra de material solto." },
    { grupo: S6, descricao: "Espalhamento e compactação de aterro nos fundos", quantidade: 6, unidade: "m³", valor: 60 },
    { grupo: S6, descricao: "Execução de lastro de concreto na garagem", quantidade: 54.3, unidade: "m²", valor: 35 },
    { grupo: S6, descricao: "Execução de piso em concreto nos fundos", quantidade: 12, unidade: "m²", valor: 35 },
    { grupo: S6, descricao: "Contrapiso da garagem", quantidade: 54.3, unidade: "m²", valor: 35 },
    { grupo: S6, descricao: "Contrapiso do pavimento térreo, incluindo os pisos dos banheiros", quantidade: 66, unidade: "m²", valor: 35 },
    { grupo: S6, descricao: "Contrapiso do pavimento superior", quantidade: 51.78, unidade: "m²", valor: 35, observacao: "Espessuras e especificações dos pisos a confirmar." },

    { grupo: S7, descricao: "Chapisco e reboco das duas faces das paredes laterais do superior", quantidade: 138.08, unidade: "m²", valor: 45 },
    { grupo: S7, descricao: "Chapisco e reboco da fachada térrea", quantidade: 18, unidade: "m²", valor: 45 },
    { grupo: S7, descricao: "Chapisco e reboco da face considerada dos muros dos fundos", quantidade: 45.82, unidade: "m²", valor: 45 },
    { grupo: S7, descricao: "Reboco da face interna dos muros existentes da frente", quantidade: 60.25, unidade: "m²", valor: 35 },
    { grupo: S7, descricao: "Chapisco e reboco da face interna da faixa de elevação dos muros", quantidade: 12.05, unidade: "m²", valor: 45 },
    { grupo: S7, descricao: "Reboco das paredes do banheiro social", quantidade: 18.23, unidade: "m²", valor: 35 },
    { grupo: S7, descricao: "Chapisco e reboco das paredes do banheiro da suíte", quantidade: 18.56, unidade: "m²", valor: 45 },

    { grupo: S8, descricao: "Impermeabilização do piso do banheiro da suíte — parcela quantificada", quantidade: 2.64, unidade: "m²", valor: 45, observacao: "Não representa o sistema completo de impermeabilização do banheiro; as paredes e as demais áreas molhadas serão definidas, medidas e acrescentadas." },

    { grupo: S9, descricao: "Assentamento de porcelanato no térreo, incluindo os pisos dos banheiros", quantidade: 66, unidade: "m²", valor: 85, observacao: "Considerados cortes usuais e rejuntamento. Formatos, paginação e acabamentos especiais a confirmar." },
    { grupo: S9, descricao: "Assentamento de porcelanato no pavimento superior", quantidade: 51.78, unidade: "m²", valor: 85 },
    { grupo: S9, descricao: "Revestimento das paredes da cozinha", quantidade: 20.28, unidade: "m²", valor: 95 },
    { grupo: S9, descricao: "Revestimento das paredes do banheiro da suíte", quantidade: 18.56, unidade: "m²", valor: 95 },
    { grupo: S9, descricao: "Revestimento da escada existente em porcelanato (80 cm de largura, 16 pisos e 17 espelhos)", quantidade: 1, unidade: "escada", valor: 1800, observacao: "Verba provisória. Patamares e medidas finais a conferir. Rodapés não incluídos, por falta de metragem; não considerado porcelanato na garagem." },

    { grupo: S10, descricao: "Preparação usual, massa corrida, lixamento e pintura das paredes do térreo (53,04 m de comprimento × 2,77 m de altura)", quantidade: 146.92, unidade: "m²", valor: 70, observacao: "Conferir descontos de portas, janelas e superfícies revestidas, para não haver sobreposição. Pintura de tetos, fachadas, muros e do pavimento superior não incluída." },

    { grupo: S11, descricao: "Instalação de sanitário, pia, chuveiro e acessórios do banheiro da suíte", quantidade: 1, unidade: "conj", valor: 650, observacao: "Verba provisória." },
  ],
  secoes: [
    { tipo: "projeto", titulo: "Ampliação · Estrutura e pavimento superior", texto: "Estrutura frontal com duas sapatas, dois pilares e viga, paredes laterais do superior, cobertura colonial em 51,78 m² e o conjunto do reservatório de 500 litros." },
    { tipo: "projeto", titulo: "Térreo · Acabamento completo", texto: "Contrapiso, porcelanato em 66,00 m², revestimento da cozinha e do banheiro da suíte, chapisco e reboco, e pintura de 146,92 m² de parede." },
    { tipo: "projeto", titulo: "Áreas externas · Garagem, muros e fundos", texto: "Aterro e lastro de concreto na garagem, piso em concreto e cobertura dos fundos, elevação dos muros da frente de 2,50 para 3,00 m, cinta de amarração e chapim." },

    { tipo: "observacao", titulo: "Áreas de referência", texto: "Terreno 6,00 × 25,00 m (150,00 m²); térreo 6,00 × 11,00 m (66,00 m²); pavimento superior 6,00 × 8,63 m (51,78 m²); garagem da frente 6,00 × 9,05 m (54,30 m²); cobertura dos fundos 6,00 × 2,50 m (15,00 m²); piso em concreto dos fundos 6,00 × 2,00 m (12,00 m²)." },
    { tipo: "observacao", titulo: "A área do pavimento superior precisa ser confirmada", texto: "A introdução do levantamento menciona dois pavimentos de 66,00 m², mas as medidas detalhadas do superior resultam em 51,78 m². Esta composição usa a medida detalhada. A diferença muda cobertura, contrapiso, porcelanato e alvenaria." },
    { tipo: "observacao", titulo: "Etapa 1 · Vistoria e definição técnica — a definir", texto: "Antes da execução: conferir medidas, acessos e condições da construção existente; confirmar a existência e as condições da laje que receberá o pavimento superior; definir a estrutura da ampliação e do reservatório; levantar os pontos elétricos e hidráulicos; definir proteção dos ambientes, instalações provisórias e logística de materiais. Esta etapa não tem verba própria incluída no total." },
    { tipo: "observacao", titulo: "Impermeabilização completa — a definir", texto: "Está quantificado apenas o piso do banheiro da suíte, com 2,64 m². As paredes e as demais áreas molhadas precisam ser definidas, medidas e acrescentadas ao orçamento." },
    { tipo: "observacao", titulo: "Limpeza final e descarte — a definir", texto: "A limpeza final, o descarte de resíduos e eventuais serviços adicionais de entrega ainda precisam ser precificados." },
    { tipo: "observacao", titulo: "Reboco ou apenas chapisco nos muros", texto: "Há divergência no levantamento entre \"muros rebocados\" e \"muros apenas chapiscados\". Os valores preservam o reboco das faces explicitamente solicitado, sujeito à confirmação. As demais superfícies externas do térreo, o chapisco externo dos muros e o reboco das paredes laterais da escada dependem de medição." },
    { tipo: "observacao", titulo: "Materiais, equipamentos e documentação", texto: "Materiais, fretes, equipamentos, andaimes, caçambas, projetos, ART e proteção dos ambientes ainda serão orçados. Falta também definir porta, box e acabamento do teto do banheiro da suíte, e confirmar formatos de revestimentos, rodapés, esquadrias e guarda-corpos." },

    { tipo: "etapa", titulo: "Antes do início", texto: "Conferência do levantamento, definição estrutural, fechamento do escopo e planejamento das compras." },
    { tipo: "etapa", titulo: "Dias 1 a 20", texto: "Estrutura, alvenarias, elevação dos muros e início das coberturas e das instalações. Compras de fundação, estrutura, alvenaria e primeiras instalações." },
    { tipo: "etapa", titulo: "Dias 21 a 40", texto: "Conclusão das coberturas e das instalações embutidas, aterros, concretagem, contrapisos, chapisco e reboco. Compras de coberturas, instalações, aterro, concreto e argamassas." },
    { tipo: "etapa", titulo: "Dias 41 a 60", texto: "Impermeabilização, pisos e revestimentos, pintura, louças, metais e testes finais. Compras de impermeabilizantes, porcelanatos, rejuntes, tintas, louças e metais." },
    { tipo: "etapa", titulo: "Sobre o prazo", texto: "Cronograma indicativo, sujeito à equipe disponível, ao fornecimento de materiais, às condições da obra e aos tempos técnicos de cura e secagem. Confirmar se o prazo contratual será contado em dias úteis ou corridos." },
  ],
};

// ======================================================= DIACONIA SHALOM RG3

const D = "Serviços, na ordem de execução";

const DIACONIA: Proposta = {
  token: "diaconia-shalom",
  senha: "Shalom2026",
  cabecalho: {
    cliente_nome: "Diaconia Shalom RG3",
    numero: "RD-2026-084",
    objeto: "Substituição de reparos de registros e tratamento de infiltração",
    senha: "Shalom2026",
    validade_dias: 20,
    valor_fechado: 3220,
    // 70/30 cabe no desenho do documento: com duas parcelas quem manda é o
    // percentual de entrada, e as contas saem exatas.
    entrada_percentual: 70,
    parcelas: 2,
    pagamento: "entrada na aprovação e saldo na conclusão, após os testes",
    preliminar: true,
    apresentacao:
      "Substituição dos reparos de seis registros no térreo e no pavimento superior, e investigação e tratamento de uma infiltração no pavimento superior. Valor com materiais e mão de obra inclusos.",
    intro_custos:
      "Os serviços estão na ordem de execução. O valor é único para o conjunto, com materiais e mão de obra inclusos.",
    nota_custos:
      "Materiais e mão de obra inclusos no valor. A discriminação entre as duas parcelas ainda será informada pela RD, e a soma das duas permanece em R$ 3.220,00. Não há preço individual por registro ou por etapa. Pagamento: 70% (R$ 2.254,00) na aprovação e 30% (R$ 966,00) na conclusão, após os testes e a entrega.",
    status: "conferindo" as const,
  },
  itens: [
    { grupo: D, descricao: "Vistoria e diagnóstico no pavimento superior: investigar a infiltração e verificar a possível origem na coluna falsa que abriga tubulações de água ou esgoto, e definir a intervenção necessária", quantidade: 1, unidade: "serv" },
    { grupo: D, descricao: "Cozinha: substituição do reparo do registro", quantidade: 1, unidade: "reparo" },
    { grupo: D, descricao: "Banheiro da suíte do térreo: substituição dos reparos do registro do chuveiro e do registro geral", quantidade: 2, unidade: "reparos" },
    { grupo: D, descricao: "Lavanderia: substituição do reparo do registro", quantidade: 1, unidade: "reparo" },
    { grupo: D, descricao: "Banheiro da suíte do pavimento superior: substituição dos reparos do registro do chuveiro e do registro geral", quantidade: 2, unidade: "reparos" },
    { grupo: D, descricao: "Tratamento da infiltração no pavimento superior, conforme a intervenção confirmada na vistoria", quantidade: 1, unidade: "serv" },
    { grupo: D, descricao: "Testes dos seis registros reparados e verificação de vazamentos nos pontos de intervenção", quantidade: 1, unidade: "conj" },
  ],
  secoes: [
    { tipo: "projeto", titulo: "Registros · Seis reparos", texto: "Substituição dos reparos de seis registros: cozinha, banheiro da suíte do térreo (chuveiro e geral), lavanderia e banheiro da suíte do superior (chuveiro e geral)." },
    { tipo: "projeto", titulo: "Infiltração · Diagnóstico e tratamento", texto: "Investigação da infiltração no pavimento superior, com verificação da coluna falsa que abriga as tubulações, e tratamento da causa identificada." },
    { tipo: "projeto", titulo: "Entrega · Testes", texto: "Teste dos seis registros reparados e verificação de vazamentos em todos os pontos de intervenção." },

    { tipo: "observacao", titulo: "A origem da infiltração é hipótese", texto: "A coluna falsa é a origem provável, e será confirmada na vistoria. A intervenção definitiva depende desse diagnóstico." },
    { tipo: "observacao", titulo: "O que a recomposição inclui", texto: "Antes da intervenção será esclarecido quais aberturas, substituições de tubulação e recomposições de reboco, revestimento ou pintura estão incluídas no valor. Serviços adicionais fora do escopo confirmado dependem de orçamento e aprovação prévia." },
    { tipo: "observacao", titulo: "Prazo a confirmar", texto: "O prazo será confirmado após a vistoria e a verificação da disponibilidade de reparos compatíveis com os registros existentes." },
  ],
};

const moeda = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const totalDoItem = (i: Item) =>
  i.valor == null || i.quantidade == null
    ? 0
    : Math.round(i.quantidade * i.valor * 100) / 100;

async function gravar(p: Proposta, orgId: string) {
  const nome = p.cabecalho.cliente_nome as string;
  const grupos = [...new Set(p.itens.map((i) => i.grupo))];

  console.log(`\n${nome}  (${p.token})`);
  let soma = 0;
  for (const g of grupos) {
    const doGrupo = p.itens.filter((i) => i.grupo === g);
    const sub = doGrupo.reduce((s, i) => s + totalDoItem(i), 0);
    soma += sub;
    const esperado = p.subtotais?.[g];
    if (esperado != null && Math.abs(sub - esperado) > 0.01) {
      throw new Error(`${g}: ${moeda(sub)} ≠ ${moeda(esperado)} do levantamento.`);
    }
    console.log(
      `  ${g} — ${doGrupo.length} ${doGrupo.length === 1 ? "serviço" : "serviços"}` +
        (sub > 0 ? ` · ${moeda(sub)}${esperado != null ? " ✓" : ""}` : " · sem preço por item"),
    );
  }

  if (p.esperado != null) {
    if (Math.abs(soma - p.esperado) > 0.01) {
      throw new Error(`total ${moeda(soma)} ≠ ${moeda(p.esperado)} do levantamento.`);
    }
    console.log(`  total ${moeda(soma)} ✓ confere com o levantamento`);
  } else {
    console.log(`  valor fechado ${moeda(p.cabecalho.valor_fechado as number)}`);
  }

  if (!GRAVAR) return;

  const { data: existe } = await sb
    .from("orc_orcamentos")
    .select("id")
    .eq("org_id", orgId)
    .eq("token", p.token)
    .maybeSingle();

  let id: string;
  if (existe) {
    id = existe.id;
    const { error } = await sb.from("orc_orcamentos").update(p.cabecalho).eq("id", id);
    if (error) throw new Error(error.message);
    await sb.from("orc_itens").delete().eq("orcamento_id", id);
    await sb.from("orc_secoes").delete().eq("orcamento_id", id);
    console.log(`  reescrevendo ${id}`);
  } else {
    const { data, error } = await sb
      .from("orc_orcamentos")
      .insert({ org_id: orgId, token: p.token, ...p.cabecalho })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    id = data.id;
    console.log(`  criado ${id}`);
  }

  const { error: erroItens } = await sb.from("orc_itens").insert(
    p.itens.map((i, n) => ({
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
    p.secoes.map((s) => ({
      orcamento_id: id,
      tipo: s.tipo,
      position: ++porTipo[s.tipo],
      titulo: s.titulo,
      texto: s.texto,
      origem: "humano" as const,
    })),
  );
  if (erroSecoes) throw new Error(`seções: ${erroSecoes.message}`);

  // Confere no banco: `total` é coluna gerada, e um centavo de deriva aparece
  // na tabela que o cliente recebe.
  if (p.esperado != null) {
    const { data: gravados } = await sb
      .from("orc_itens")
      .select("total")
      .eq("orcamento_id", id);
    const noBanco = (gravados ?? []).reduce((s, l) => s + Number(l.total ?? 0), 0);
    if (Math.abs(noBanco - p.esperado) > 0.01) {
      throw new Error(`soma no banco ${moeda(noBanco)} ≠ ${moeda(p.esperado)}.`);
    }
    console.log(`  soma no banco ${moeda(noBanco)} ✓`);
  }

  console.log(`  ${p.itens.length} itens · ${p.secoes.length} seções · senha ${p.senha}`);
}

async function main() {
  const { data: org } = await sb
    .from("orgs")
    .select("id")
    .eq("nome_exibicao", "RD Engenharia")
    .maybeSingle();
  if (!org) throw new Error("Não achei a org RD Engenharia.");

  for (const p of [SOUSA, DIACONIA]) await gravar(p, org.id);

  if (!GRAVAR) {
    console.log("\nNada gravado. Rode com --gravar.");
    return;
  }
  console.log("\nAgora publique:  npm run publicar -- sousa diaconia-shalom");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
