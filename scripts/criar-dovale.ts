/**
 * Loja Dovale: cobertura, estrutura metálica, forro, elétrica e rede.
 *
 * Fonte: o levantamento do Rodrigo, o laudo de inspeção predial da engenheira
 * Maria Viviane Lucena Dodo (CREA 363320CE, junho de 2026, parecer NÃO
 * CONFORME, cobertura e elétrica em risco CRÍTICO) e oito fotos da obra.
 *
 * **Nenhum preço veio junto.** Tudo saiu da tabela de mão de obra da RD
 * (2025 + 10%, faixa de empresa) onde ela tem o serviço, e de estimativa
 * minha onde não tem — e cada estimativa está marcada. Por isso o documento
 * nasce **preliminar**, com a tarja:
 *
 * - da tabela: forro de drywall R$ 33/m², lavagem de telhado R$ 23,10/m²,
 *   ponto de eletroduto R$ 44, ponto elétrico R$ 55, disjuntor no quadro R$ 44;
 * - meus: demolição do forro, pintura anticorrosiva por metro de perfil e por
 *   tesoura, correção da tesoura rompida, troca de terça, troca de calha,
 *   retirada da elétrica antiga e remanejamento do rack.
 *
 * **Três premissas que mudam o valor**, escritas no documento:
 *
 * 1. **Só mão de obra.** O levantamento não diz, e é o regime de quase toda
 *    proposta da RD. Com material, o total sobe muito — perfis, calhas,
 *    chapas de drywall, cabos, quadro e disjuntores.
 * 2. **O forro novo entra.** O texto fala em demolição; o laudo recomenda
 *    remover o forro e instalar drywall novo, e a primeira foto já mostra a
 *    estrutura galvanizada pendurada. Se for só demolição, saem R$ 5.732,10.
 * 3. **57 pontos elétricos** para os cinco cômodos — 20 de iluminação, 24
 *    tomadas, 8 interruptores e 5 de ar-condicionado. A contagem não veio;
 *    é a densidade normal de loja com depósito, e o levantamento confirma.
 *
 * **Amianto.** As telhas existentes contêm amianto, proibido desde 2017. A
 * manutenção não usa jato de alta pressão, não corta nem lixa telha, e a
 * telha trocada é de fibrocimento sem amianto. O descarte do que sair é
 * resíduo classe D e vai para destino licenciado — à parte.
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

/* As medidas do levantamento. */
const FORRO = r2(5.39 * 7.84 + 6.81 * 9.57 + 3.21 * 14.74 + 4.67 * 4.06);
const GALPAO = r2(10.12 * 18.69);
const TERCAS = r2(8 * 18.69);
const COLUNAS = 8 * 4;
const TERCAS_NOVAS = r2(2 * 18.69);
const CALHAS = r2(2 * 18.69);

const PONTOS = { iluminacao: 20, tomada: 24, interruptor: 8, ar: 5 };
const TOTAL_PONTOS = Object.values(PONTOS).reduce((a, b) => a + b, 0);

const G1 = "1 · Forro";
const G2 = "2 · Estrutura metálica e cobertura";
const G3 = "3 · Instalação elétrica";
const G4 = "4 · Rede de dados";

type Item = {
  grupo: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  valor: number;
  observacao?: string;
};

const ESTIMATIVA = "Preço estimado pela RD: a tabela de mão de obra não tem este serviço.";

const ITENS: Item[] = [
  {
    grupo: G1,
    descricao:
      "Demolição do forro de gesso em placas danificado por vícios construtivos e umidade, com ensacamento do entulho — quatro áreas: 5,39 × 7,84 m, 6,81 × 9,57 m, 3,21 × 14,74 m e 4,67 × 4,06 m",
    quantidade: FORRO,
    unidade: "m²",
    valor: 15,
    observacao: ESTIMATIVA,
  },
  {
    grupo: G1,
    descricao:
      "Instalação de forro em gesso drywall nas mesmas áreas, com estrutura, chapas e tratamento de juntas",
    quantidade: FORRO,
    unidade: "m²",
    valor: 33,
    observacao:
      "Recomendado pelo laudo. Executado só depois de resolvida a cobertura, para o forro novo não receber a mesma água.",
  },

  {
    grupo: G2,
    descricao:
      "Lixamento e pintura de proteção anticorrosiva, com fundo e acabamento, de 8 terças de 18,69 m",
    quantidade: TERCAS,
    unidade: "m",
    valor: 18,
    observacao: ESTIMATIVA,
  },
  {
    grupo: G2,
    descricao:
      "Lixamento e pintura de proteção anticorrosiva, com fundo e acabamento, de tesoura metálica de 10,12 m de vão — banzos, montantes e diagonais",
    quantidade: 4,
    unidade: "un",
    valor: 500,
    observacao: ESTIMATIVA,
  },
  {
    grupo: G2,
    descricao:
      "Lixamento e pintura de proteção anticorrosiva, com fundo e acabamento, de 8 colunas metálicas de 4,00 m",
    quantidade: COLUNAS,
    unidade: "m",
    valor: 18,
    observacao: ESTIMATIVA,
  },
  {
    grupo: G2,
    descricao:
      "Correção da tesoura com o banzo inferior rompido por corrosão: escoramento, corte e substituição do perfil inferior de 10,12 m, com soldagem",
    quantidade: 1,
    unidade: "serv",
    valor: 1200,
    observacao: `${ESTIMATIVA} O laudo pede intervenção imediata nesta peça.`,
  },
  {
    grupo: G2,
    descricao: "Substituição de 2 terças de 18,69 m, com retirada das peças comprometidas",
    quantidade: TERCAS_NOVAS,
    unidade: "m",
    valor: 25,
    observacao: ESTIMATIVA,
  },
  {
    grupo: G2,
    descricao:
      "Retirada das 2 calhas de zinco danificadas e instalação de calhas novas de 20 × 10 cm",
    quantidade: CALHAS,
    unidade: "m",
    valor: 35,
    observacao: ESTIMATIVA,
  },
  {
    grupo: G2,
    descricao:
      "Manutenção do telhado de fibrocimento: limpeza a baixa pressão, revisão das fixações e vedações e troca pontual das telhas danificadas",
    quantidade: GALPAO,
    unidade: "m²",
    valor: 23.1,
    observacao:
      "Telhas com amianto: sem jato de alta pressão, sem corte e sem lixamento. A telha trocada é de fibrocimento sem amianto.",
  },

  {
    grupo: G3,
    descricao:
      "Retirada da instalação existente: cabos, eletrodutos de garganta e canaletas aparentes",
    quantidade: 1,
    unidade: "serv",
    valor: 800,
    observacao: ESTIMATIVA,
  },
  {
    grupo: G3,
    descricao: "Infraestrutura em eletroduto rígido com caixas de passagem, por ponto",
    quantidade: TOTAL_PONTOS,
    unidade: "un",
    valor: 44,
  },
  {
    grupo: G3,
    descricao: "Pontos de iluminação, com passagem de cabos",
    quantidade: PONTOS.iluminacao,
    unidade: "un",
    valor: 55,
  },
  {
    grupo: G3,
    descricao: "Pontos de tomada, com passagem de cabos",
    quantidade: PONTOS.tomada,
    unidade: "un",
    valor: 55,
  },
  {
    grupo: G3,
    descricao: "Pontos de interruptor, com passagem de cabos",
    quantidade: PONTOS.interruptor,
    unidade: "un",
    valor: 55,
  },
  {
    grupo: G3,
    descricao: "Pontos de ar-condicionado em circuito dedicado",
    quantidade: PONTOS.ar,
    unidade: "un",
    valor: 55,
  },
  {
    grupo: G3,
    descricao:
      "Montagem do quadro de distribuição de 24 posições com 18 disjuntores DIN, DR e DPS, com folga para disjuntores futuros",
    quantidade: 18,
    unidade: "disjuntor",
    valor: 44,
  },

  {
    grupo: G4,
    descricao:
      "Tubulação para passagem do cabeamento de dados até o escritório, em eletroduto, com cerca de 10 m",
    quantidade: 10,
    unidade: "m",
    valor: 25,
    observacao: ESTIMATIVA,
  },
  {
    grupo: G4,
    descricao:
      "Remanejamento do rack do servidor para o escritório: desmontagem, transporte, fixação, passagem e reconexão dos cabos",
    quantidade: 1,
    unidade: "serv",
    valor: 450,
    observacao: `${ESTIMATIVA} Configuração de rede e de equipamentos não incluída.`,
  },
];

const CABECALHO = {
  cliente_nome: "Dovale Fortaleza Comércio de Chaves e Ferragens",
  endereco: "Rua Senador Pompeu, 1850, José Bonifácio, Fortaleza/CE",
  objeto: "Recuperação da cobertura, estrutura metálica, forro e instalação elétrica",
  senha: "Dovale2026",
  validade_dias: 20,
  valor_fechado: null,
  prazo: null,
  entrada_percentual: null,
  parcelas: 2,
  pagamento: "condições de pagamento a definir com a Dovale",
  marca: "rd",
  preliminar: true,
  apresentacao:
    "Recuperação do galpão da loja Dovale, de 10,12 × 18,69 m, a partir do laudo de inspeção predial que classificou a cobertura e a instalação elétrica em risco crítico: tratamento da estrutura metálica e correção da tesoura rompida, troca de terças e calhas, manutenção do telhado de fibrocimento, forro novo em drywall, instalação elétrica nova em eletroduto rígido e remanejamento do rack de rede para o escritório. Orçamento de mão de obra.",
  intro_custos:
    "Os serviços estão item a item, na ordem em que a obra deve acontecer: primeiro o que estanca a água, depois o que ela estragou. Os valores são de mão de obra; o material fica por conta da contratante.",
  nota_custos:
    "Somente mão de obra. Os preços seguem a tabela de mão de obra da RD onde ela tem o serviço; os demais são estimativa da RD e estão marcados na própria linha. A contagem de 57 pontos elétricos é premissa para cinco cômodos e será confirmada em levantamento. Não estão incluídos material, locação de andaime ou plataforma para o trabalho a 5 m de altura, caçamba, descarte das telhas e resíduos com amianto em destino licenciado, nem configuração de rede.",
};

type Secao = { tipo: "projeto" | "observacao" | "etapa"; titulo: string; texto: string };

const SECOES: Secao[] = [
  {
    tipo: "projeto",
    titulo: "Cobertura · Primeiro estancar a água",
    texto:
      "O laudo aponta a cobertura como origem de quase tudo: frestas, telhas fissuradas, arremates soltos e calhas de zinco danificadas deixam a água entrar. Por isso a obra começa por cima — calhas novas de 20 × 10 cm, revisão de fixações e vedações e troca das telhas quebradas.",
  },
  {
    tipo: "projeto",
    titulo: "Estrutura metálica · Corrosão tratada e tesoura recuperada",
    texto:
      "Terças, tesouras e colunas são lixadas até o metal são e recebem fundo anticorrosivo e acabamento. A tesoura com o banzo inferior rompido pela corrosão é escorada, e o perfil inferior de 10,12 m é substituído e soldado. Duas terças de 18,69 m saem e dão lugar a peças novas.",
  },
  {
    tipo: "projeto",
    titulo: "Elétrica · Instalação nova, longe da umidade",
    texto:
      "Os cabos aparentes e os eletrodutos de garganta saem. A instalação nova corre em eletroduto rígido com caixas de passagem, com pontos de iluminação, tomadas, interruptores e circuitos dedicados de ar-condicionado, e um quadro de 24 posições com 18 disjuntores, DR e DPS, com folga para crescer.",
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
      "O rack do servidor muda para o escritório, com tubulação própria de cerca de 10 m para o cabeamento de dados, separada da elétrica.",
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
    titulo: "Pontos elétricos a confirmar",
    texto:
      "A quantidade de pontos — 20 de iluminação, 24 tomadas, 8 interruptores e 5 de ar-condicionado — é estimada para os cinco cômodos. O levantamento em obra define o número final, e a diferença é ajustada por escrito, pelo mesmo preço por ponto.",
  },
  {
    tipo: "observacao",
    titulo: "Material por conta da contratante",
    texto:
      "Os valores são de mão de obra. Perfis, calhas, telhas, tinta anticorrosiva, chapas e estrutura de drywall, eletrodutos, cabos, quadro, disjuntores e acessórios ficam por conta da Dovale, conforme a especificação acordada com a RD.",
  },

  {
    tipo: "etapa",
    titulo: "Aprovação e programação",
    texto:
      "Você aprova a proposta, confirmamos o levantamento elétrico e combinamos data de início, pagamento e compra dos materiais.",
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

const moeda = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const totalDaLinha = (i: Item) => r2(i.quantidade * i.valor);

async function main() {
  if (TOTAL_PONTOS !== 57) throw new Error(`os pontos somam ${TOTAL_PONTOS}, e eu contava 57.`);
  for (const f of FOTOS) {
    if (!existsSync(`${FOTOS_DIR}/${f.arquivo}`)) throw new Error(`não achei ${f.arquivo}`);
  }

  const grupos = [...new Set(ITENS.map((i) => i.grupo))];
  let total = 0;
  console.log(`\nDovale · forro ${FORRO} m² · galpão ${GALPAO} m² · ${TOTAL_PONTOS} pontos\n`);
  for (const g of grupos) {
    const sub = r2(ITENS.filter((i) => i.grupo === g).reduce((s, i) => s + totalDaLinha(i), 0));
    total += sub;
    console.log(`  ${g.padEnd(38)} ${moeda(sub).padStart(13)}`);
  }
  total = r2(total);
  console.log(`  ${"TOTAL".padEnd(38)} ${moeda(total).padStart(13)}`);
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
    for (const t of ["orc_itens", "orc_secoes", "orc_normas", "orc_midias"] as const) {
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
      quantidade: i.quantidade,
      unidade: i.unidade,
      valor_unitario: i.valor,
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

  const { data: g } = await sb.from("orc_itens").select("total").eq("orcamento_id", id);
  const noBanco = r2((g ?? []).reduce((s, l) => s + Number(l.total ?? 0), 0));
  if (Math.abs(noBanco - total) > 0.01) throw new Error(`soma ${noBanco} ≠ ${total}`);
  console.log(`\n  gravado · soma no banco ${moeda(noBanco)} ✓`);
  console.log(`\nAgora publique:  npm run publicar -- ${TOKEN}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
