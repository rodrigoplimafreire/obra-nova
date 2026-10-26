/**
 * Loja Dovale: cobertura, estrutura metálica, forro, elétrica e rede.
 *
 * Fonte: o levantamento do Rodrigo, o laudo de inspeção predial da engenheira
 * Maria Viviane Lucena Dodo (CREA 363320CE, junho de 2026, parecer NÃO
 * CONFORME, cobertura e elétrica em risco CRÍTICO) e oito fotos da obra.
 *
 * **Os preços são do Rodrigo**, por macroetapa, com material e mão de obra:
 * R$ 69.679,00. A primeira versão saiu preliminar, com estimativa minha linha a
 * linha e só mão de obra; esta substitui tudo aquilo.
 *
 * Como o preço vem por macroetapa e não por linha, o documento usa as duas
 * seções que a estrutura canônica tem para isso: a **seção 2**, o resumo por
 * módulo, leva o valor e o percentual de cada macroetapa; a **seção 3**, a
 * planilha, leva os serviços item a item, sem valor por linha, e o total
 * fecha em `valor_fechado`. Distribuir os R$ 22.457,00 do forro entre a
 * demolição e o drywall novo seria inventar a divisão.
 *
 * O valor do forro confirma o que a primeira versão supunha: R$ 129 o m² com
 * material não é só demolição, é demolição mais forro novo — o que o laudo
 * recomenda.
 *
 * **Nota fiscal**: acréscimo de 15% quando o cliente pedir, a pedido do
 * Rodrigo. O valor com nota sai escrito, para o cliente não fazer a conta.
 *
 * **Amianto.** As telhas existentes contêm amianto, proibido desde 2017. A
 * manutenção não usa jato de alta pressão, não corta nem lixa telha, e a
 * telha trocada é de fibrocimento sem amianto.
 *
 * Rodar com `--gravar`.
 */

import { readFileSync, existsSync } from "node:fs";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const GRAVAR = process.argv.includes("--gravar");
const ORG = "add1ea68-41ad-4a17-8083-c87390ea2ad3";
const TOKEN = "dovale";
const BUCKET = "propostas";
const FOTOS_DIR =
  "C:/Users/User/AppData/Local/Temp/claude/C--ProjetosDev-obra-nova/bbce08c5-5543-484a-b3a5-898aad69f57f/scratchpad/dovale-zip";

const r2 = (n: number) => Math.round(n * 100) / 100;

const TOTAL = 69679;
const NOTA_FISCAL = 0.15;
const COM_NOTA = r2(TOTAL * (1 + NOTA_FISCAL));

/* As medidas do levantamento. */
const FORRO = 173.7;
const GALPAO = r2(10.12 * 18.69);

const G1 = "1 · Forro";
const G2 = "2 · Estrutura metálica";
const G3 = "3 · Calhas";
const G4 = "4 · Telhado";
const G5 = "5 · Instalação elétrica";
const G6 = "6 · Rede de dados";

/** Seção 2: o preço do Rodrigo, por macroetapa. Soma conferida contra o total. */
const MODULOS: Array<{ grupo: string; nome: string; valor: number }> = [
  { grupo: G1, nome: "Forro: demolição e forro novo em drywall", valor: 22457 },
  { grupo: G2, nome: "Estrutura metálica: tratamento, tesoura e terças", valor: 12027 },
  { grupo: G3, nome: "Substituição das calhas", valor: 4100 },
  { grupo: G4, nome: "Manutenção do telhado de fibrocimento", valor: 3650 },
  { grupo: G5, nome: "Instalação elétrica completa", valor: 26435 },
  { grupo: G6, nome: "Remanejamento do rack de rede", valor: 1010 },
];

type Item = {
  grupo: string;
  descricao: string;
  quantidade?: number;
  unidade?: string;
  observacao?: string;
};

const ITENS: Item[] = [
  {
    grupo: G1,
    descricao:
      "Demolição do forro de gesso em placas danificado por vícios construtivos e umidade, com ensacamento do entulho — quatro áreas: 5,39 × 7,84 m, 6,81 × 9,57 m, 3,21 × 14,74 m e 4,67 × 4,06 m",
    quantidade: FORRO,
    unidade: "m²",
  },
  {
    grupo: G1,
    descricao:
      "Instalação de forro em gesso drywall nas mesmas áreas, com estrutura, chapas e tratamento de juntas",
    quantidade: FORRO,
    unidade: "m²",
    observacao:
      "Recomendado pelo laudo. Executado só depois de resolvida a cobertura, para o forro novo não receber a mesma água.",
  },

  {
    grupo: G2,
    descricao:
      "Lixamento e pintura de proteção anticorrosiva, com fundo e acabamento, de 8 terças de 18,69 m",
    quantidade: 8,
    unidade: "un",
  },
  {
    grupo: G2,
    descricao:
      "Lixamento e pintura de proteção anticorrosiva, com fundo e acabamento, de 4 tesouras metálicas de 10,12 m de vão — banzos, montantes e diagonais",
    quantidade: 4,
    unidade: "un",
  },
  {
    grupo: G2,
    descricao:
      "Lixamento e pintura de proteção anticorrosiva, com fundo e acabamento, de 8 colunas metálicas de 4,00 m",
    quantidade: 8,
    unidade: "un",
  },
  {
    grupo: G2,
    descricao:
      "Correção da tesoura com o banzo inferior danificado por oxidação: escoramento, corte e substituição do perfil inferior de 10,12 m, com soldagem",
    quantidade: 1,
    unidade: "un",
    observacao: "O laudo pede intervenção imediata nesta peça.",
  },
  {
    grupo: G2,
    descricao: "Substituição de 2 terças de 18,69 m, com retirada das peças comprometidas",
    quantidade: 2,
    unidade: "un",
  },

  {
    grupo: G3,
    descricao:
      "Retirada das 2 calhas de zinco danificadas e instalação de calhas novas de 20 × 10 cm",
    quantidade: 37.38,
    unidade: "m",
  },

  {
    grupo: G4,
    descricao:
      "Manutenção do telhado de fibrocimento: limpeza a baixa pressão, revisão das fixações e vedações e troca pontual das telhas danificadas (10,12 × 18,69 m)",
    quantidade: GALPAO,
    unidade: "m²",
    observacao:
      "Telhas com amianto: sem jato de alta pressão, sem corte e sem lixamento. A telha trocada é de fibrocimento sem amianto.",
  },

  {
    grupo: G5,
    descricao:
      "Retirada da instalação existente: cabos, eletrodutos de garganta e canaletas aparentes",
    quantidade: 1,
    unidade: "serv",
  },
  {
    grupo: G5,
    descricao:
      "Infraestrutura nova em eletroduto rígido com caixas de passagem, nos cinco cômodos (10,12 × 18,69 m, pé-direito de 2,70 m)",
    quantidade: 1,
    unidade: "serv",
  },
  {
    grupo: G5,
    descricao: "Passagem dos cabos elétricos em todos os circuitos",
    quantidade: 1,
    unidade: "serv",
  },
  {
    grupo: G5,
    descricao:
      "Pontos de tomada, iluminação, interruptores e ar-condicionado, com circuitos dedicados para os aparelhos de ar",
    quantidade: 1,
    unidade: "serv",
  },
  {
    grupo: G5,
    descricao:
      "Montagem do quadro de distribuição de 24 posições com 18 disjuntores DIN, com folga para disjuntores futuros",
    quantidade: 1,
    unidade: "un",
  },

  {
    grupo: G6,
    descricao:
      "Tubulação para passagem do cabeamento de dados até o escritório, com cerca de 10 m",
    quantidade: 10,
    unidade: "m",
  },
  {
    grupo: G6,
    descricao:
      "Remanejamento do rack do servidor de internet para o escritório: desmontagem, fixação, passagem e reconexão dos cabos",
    quantidade: 1,
    unidade: "serv",
  },
];

const moeda = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CABECALHO = {
  cliente_nome: "Dovale Fortaleza Comércio de Chaves e Ferragens",
  endereco: "Rua Senador Pompeu, 1850, José Bonifácio, Fortaleza/CE",
  objeto: "Recuperação da cobertura, estrutura metálica, forro e instalação elétrica",
  senha: "Dovale2026",
  validade_dias: 20,
  valor_fechado: TOTAL,
  prazo: null,
  entrada_percentual: null,
  parcelas: 2,
  pagamento: "condições de pagamento a definir com a Dovale",
  marca: "rd",
  preliminar: false,
  // O card de resumo calcula e mostra o total com nota a partir daqui.
  nota_fiscal_percentual: NOTA_FISCAL * 100,
  apresentacao:
    "Recuperação do galpão da loja Dovale, de 10,12 × 18,69 m, a partir do laudo de inspeção predial que classificou a cobertura e a instalação elétrica em risco crítico: forro novo em drywall, tratamento da estrutura metálica e correção da tesoura danificada, troca de terças e calhas, manutenção do telhado de fibrocimento, instalação elétrica nova em eletroduto rígido e remanejamento do rack de rede para o escritório. Material e mão de obra inclusos.",
  intro_custos:
    "Os serviços estão item a item, na ordem das macroetapas. O valor de cada macroetapa está no resumo orçamentário acima; o total abaixo inclui material e mão de obra.",
  nota_custos: `Valor com material e mão de obra. Com emissão de nota fiscal há acréscimo de 15%, e o total passa a ${moeda(COM_NOTA)}. Não estão incluídos a locação de andaime ou plataforma para o trabalho a 5 m de altura, o descarte das telhas e resíduos com amianto em destino licenciado, nem a configuração de rede e de equipamentos.`,
};

type Secao = { tipo: "projeto" | "observacao" | "etapa"; titulo: string; texto: string };

const SECOES: Secao[] = [
  {
    tipo: "projeto",
    titulo: "Cobertura · Primeiro estancar a água",
    texto:
      "O laudo aponta a cobertura como origem de quase tudo: frestas, telhas fissuradas, arremates soltos e calhas de zinco danificadas deixam a água entrar. Por isso a obra começa por cima — 37,38 m de calhas novas de 20 × 10 cm, revisão de fixações e vedações e troca das telhas quebradas.",
  },
  {
    tipo: "projeto",
    titulo: "Estrutura metálica · Corrosão tratada e tesoura recuperada",
    texto:
      "Terças, tesouras e colunas são lixadas até o metal são e recebem fundo anticorrosivo e acabamento. A tesoura com o banzo inferior danificado pela oxidação é escorada, e o perfil inferior de 10,12 m é substituído e soldado. Duas terças de 18,69 m saem e dão lugar a peças novas.",
  },
  {
    tipo: "projeto",
    titulo: "Elétrica · Instalação nova, longe da umidade",
    texto:
      "Os cabos aparentes e os eletrodutos de garganta saem. A instalação nova corre em eletroduto rígido com caixas de passagem nos cinco cômodos, com pontos de tomada, iluminação, interruptores e circuitos de ar-condicionado, e um quadro de 24 posições com 18 disjuntores, com folga para crescer.",
  },
  {
    tipo: "projeto",
    titulo: "Forro · Drywall novo depois da cobertura resolvida",
    texto:
      "O forro de gesso em placas, ondulado e fissurado pela água, é demolido nas quatro áreas, somando 173,70 m², e substituído por forro em drywall — mas só depois de a cobertura estar estanque, como o laudo recomenda.",
  },
  {
    tipo: "projeto",
    titulo: "Rede · Rack para o escritório",
    texto:
      "O rack do servidor de internet muda para o escritório, com tubulação própria de cerca de 10 m para o cabeamento de dados, separada da elétrica.",
  },

  {
    tipo: "observacao",
    titulo: "Nota fiscal",
    texto: `Os valores desta proposta são sem nota fiscal. Com emissão de nota fiscal, há acréscimo de 15%: o total de ${moeda(TOTAL)} passa a ${moeda(COM_NOTA)}.`,
  },
  {
    tipo: "observacao",
    titulo: "Telhas com amianto",
    texto:
      "As telhas existentes contêm fibras de amianto. A manutenção é feita sem jato de alta pressão, sem corte e sem lixamento das telhas, com a equipe protegida, e as telhas trocadas são de fibrocimento sem amianto. O descarte do material retirado é feito em destino licenciado e não está neste valor.",
  },
  {
    tipo: "observacao",
    titulo: "Trabalho a 5 m de altura",
    texto:
      "Toda a cobertura e a estrutura ficam a cerca de 5,00 m. O serviço segue a NR-35, com equipe treinada e ancoragem. A locação de andaime ou plataforma não está incluída.",
  },
  {
    tipo: "observacao",
    titulo: "Material e mão de obra inclusos",
    texto:
      "O valor cobre o material e a mão de obra dos serviços descritos: chapas e estrutura de drywall, perfis, tinta anticorrosiva, calhas, telhas de reposição, eletrodutos, cabos, quadro, disjuntores e a tubulação da rede.",
  },

  {
    tipo: "etapa",
    titulo: "Aprovação e programação",
    texto: "Você aprova a proposta e combinamos data de início e condições de pagamento.",
  },
  {
    tipo: "etapa",
    titulo: "Cobertura e estrutura",
    texto:
      "Correção da tesoura, troca das terças, tratamento anticorrosivo, calhas novas e manutenção do telhado.",
  },
  {
    tipo: "etapa",
    titulo: "Elétrica e rede",
    texto:
      "Retirada da instalação antiga, infraestrutura nova, pontos, quadro de distribuição e remanejamento do rack.",
  },
  {
    tipo: "etapa",
    titulo: "Forro e entrega",
    texto:
      "Demolição do forro antigo, forro novo em drywall, testes da instalação elétrica e vistoria final com você.",
  },
];

/** As normas que o próprio laudo cita, mais as das disciplinas da obra. */
const NORMAS = [
  "ABNT NBR 16280 / NBR 5674 — Reforma e manutenção de edificações: organização do canteiro, proteção das áreas contíguas e da mercadoria da loja, ensacamento e destinação do entulho.",
  "ABNT NBR 8800 — Estruturas de aço: recuperação da tesoura e substituição das terças com perfis e soldas compatíveis com a estrutura existente.",
  "ABNT NBR ISO 12944 — Proteção anticorrosiva por pintura: preparo da superfície até o metal são, fundo anticorrosivo e acabamento.",
  "ABNT NBR 10844 — Instalações prediais de águas pluviais: calhas dimensionadas e instaladas com caimento contínuo.",
  "ABNT NBR 15758 — Sistemas construtivos em chapas de gesso para drywall: estrutura, fixação das chapas e tratamento de juntas do forro.",
  "ABNT NBR 5410 e NR-10 — Instalações elétricas de baixa tensão: circuitos separados, condutores em eletroduto, dispositivo DR, DPS e aterramento.",
  "NR-35 — Trabalho em altura: equipe treinada, análise de risco e sistema de ancoragem para os serviços na cobertura.",
  "NR-15, Anexo 12 — Amianto: manuseio sem geração de poeira, proteção da equipe e destinação controlada do material retirado.",
];

const FOTOS: Array<{ arquivo: string; legenda: string }> = [
  {
    arquivo: "WhatsApp Image 2026-10-26 at 16.28.01.jpeg",
    legenda: "Telhas de fibrocimento manchadas pela umidade e estrutura metálica corroída",
  },
  {
    arquivo: "WhatsApp Image 2026-10-26 at 16.28.08 (2).jpeg",
    legenda: "Forro de gesso fissurado e pilar com escorrimento de água",
  },
  {
    arquivo: "WhatsApp Image 2026-10-26 at 16.28.09.jpeg",
    legenda: "Encontro do pilar com o forro: fissuras e infiltração da cobertura",
  },
  {
    arquivo: "WhatsApp Image 2026-10-26 at 16.28.02.jpeg",
    legenda: "Forro de PVC desprendido junto à parede",
  },
  {
    arquivo: "WhatsApp Image 2026-10-26 at 16.28.08.jpeg",
    legenda: "Quadro de distribuição atual",
  },
  {
    arquivo: "WhatsApp Image 2026-10-26 at 16.28.08 (1).jpeg",
    legenda: "Caixa de passagem aberta e cabos aparentes",
  },
  {
    arquivo: "WhatsApp Image 2026-10-26 at 16.28.09 (1).jpeg",
    legenda: "Rack de rede que vai para o escritório",
  },
];

async function main() {
  const soma = MODULOS.reduce((s, m) => s + m.valor, 0);
  if (soma !== TOTAL) throw new Error(`as macroetapas somam ${soma}, e o total é ${TOTAL}.`);
  for (const m of MODULOS) {
    if (!ITENS.some((i) => i.grupo === m.grupo)) throw new Error(`${m.grupo} sem itens.`);
  }
  for (const f of FOTOS) {
    if (!existsSync(`${FOTOS_DIR}/${f.arquivo}`)) throw new Error(`não achei ${f.arquivo}`);
  }

  console.log(`\nDovale · ${moeda(TOTAL)} com material · com nota ${moeda(COM_NOTA)}\n`);
  for (const m of MODULOS) {
    console.log(
      `  ${m.nome.padEnd(52)} ${moeda(m.valor).padStart(12)}  ${((m.valor / TOTAL) * 100).toFixed(1)}%`,
    );
  }
  console.log(`\n  ${ITENS.length} itens · ${SECOES.length} seções · ${NORMAS.length} normas · ${FOTOS.length} fotos`);

  if (!GRAVAR) {
    console.log("\nNada gravado. Rode com --gravar.");
    return;
  }

  const { data: existente } = await sb.from("orc_orcamentos").select("id").eq("token", TOKEN).maybeSingle();
  let id: string;
  if (existente) {
    id = existente.id;
    await sb.from("orc_orcamentos").update(CABECALHO).eq("id", id);
    for (const t of ["orc_itens", "orc_secoes", "orc_normas", "orc_midias", "orc_modulos"] as const) {
      await sb.from(t).delete().eq("orcamento_id", id);
    }
  } else {
    const { data, error } = await sb
      .from("orc_orcamentos")
      .insert({ org_id: ORG, token: TOKEN, ...CABECALHO })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    id = data.id;
  }

  const e1 = await sb.from("orc_itens").insert(
    ITENS.map((i, n) => ({
      orcamento_id: id,
      grupo: i.grupo,
      position: n + 1,
      descricao: i.descricao,
      observacao: i.observacao ?? null,
      quantidade: i.quantidade ?? null,
      unidade: i.unidade ?? null,
      valor_unitario: null,
      origem: "humano" as const,
    })),
  );
  if (e1.error) throw new Error(`itens: ${e1.error.message}`);

  const e2 = await sb.from("orc_secoes").insert(
    SECOES.map((s, n) => ({
      orcamento_id: id,
      tipo: s.tipo,
      position: n + 1,
      titulo: s.titulo,
      texto: s.texto,
      origem: "humano" as const,
    })),
  );
  if (e2.error) throw new Error(`seções: ${e2.error.message}`);

  const e3 = await sb.from("orc_normas").insert(
    NORMAS.map((texto, n) => ({ orcamento_id: id, position: n + 1, texto })),
  );
  if (e3.error) throw new Error(`normas: ${e3.error.message}`);

  const e5 = await sb.from("orc_modulos").insert(
    MODULOS.map((m, n) => ({
      orcamento_id: id,
      position: n + 1,
      nome: m.nome,
      prazo: null,
      valor: m.valor,
      percentual: Math.round((m.valor / TOTAL) * 1000) / 10,
    })),
  );
  if (e5.error) throw new Error(`módulos: ${e5.error.message}`);

  for (const [n, f] of FOTOS.entries()) {
    const destino = `${id}/situacao-${String(n + 1).padStart(2, "0")}.jpg`;
    const up = await sb.storage
      .from(BUCKET)
      .upload(destino, readFileSync(`${FOTOS_DIR}/${f.arquivo}`), {
        contentType: "image/jpeg",
        upsert: true,
      });
    if (up.error) throw new Error(`${f.arquivo}: ${up.error.message}`);
    const e4 = await sb.from("orc_midias").insert({
      orcamento_id: id,
      tipo: "foto",
      storage_path: destino,
      legenda: f.legenda,
      position: n + 1,
    });
    if (e4.error) throw new Error(`mídia: ${e4.error.message}`);
  }
  await sb
    .from("orc_orcamentos")
    .update({
      midias_titulo: "A situação hoje",
      midias_texto:
        "Registros da vistoria. O laudo de inspeção predial classificou a cobertura e a instalação elétrica em risco crítico, a estrutura metálica de médio a crítico e os forros em risco médio.",
    })
    .eq("id", id);

  console.log(`\n  gravado ✓`);
  console.log(`\nAgora publique:  npm run publicar -- ${TOKEN}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
