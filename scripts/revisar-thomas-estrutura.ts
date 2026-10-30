/**
 * Sr. Thomas: a estrutura passa a seguir o projeto estrutural.
 *
 * O orçamento de agosto previa seis sapatas, seis pilares, baldrame de
 * 11,60 m, laje H8 e viga em balanço no beiral — o que a RD calculou antes de
 * existir projeto. Agora existe: as pranchas 101101 e 101102 (formas e
 * detalhamento) e a estimativa do eng. Paulo Cesar Rodrigues Camarinho, de
 * 30/10/2026, que o Reginato mandou. O grupo 2 é reescrito pelo projeto:
 *
 * - **3 sapatas** em vez de 6: duas S1 de 90 × 120 cm, sob P2 e P3, e uma S2
 *   de 60 × 60 cm, sob P1. As S18 e S20 são existentes;
 * - **cinta C1** de 15 × 40 cm com 6,27 m (626,6 cm na planta), entre as S1 —
 *   o baldrame de 11,60 m vira 6,27 m, e a escavação acompanha;
 * - **3 pilares novos** — P1 15 × 30, P2 e P3 15 × 45 — e o **reforço do P18**
 *   existente, de 20 × 20 para 20 × 30 cm;
 * - **8 vigas, V1 a V8** — e não cinco, como saiu no áudio; a planta e o
 *   detalhamento mostram as oito —, mais o **reforço da viga existente** de
 *   12 × 50 cm entre P14 e V14 ("Reforço V8 existente" na prancha);
 * - **lajes L1 maciça e L2, L3, L4 treliçadas**, todas com 13 cm, fck 30 MPa.
 *   É aqui o "reforço maior" de que o Reginato falou: a laje sai de H8 para
 *   13 cm. A área lançada é a soma dos painéis do memorial, 25,93 m²; as vigas
 *   que os contornam estão no item das vigas, e a cobertura continua com o
 *   mesmo tamanho — os 42,71 m² de impermeabilização e piso não mudam.
 *
 * A viga em balanço do beiral (16,50 m) sai: no projeto, o beiral é a faixa
 * L4, de 45 cm, apoiada nas vigas V4 e V5.
 *
 * **O valor é do professor**: R$ 103.868,67, contra R$ 99.107,00. A entrada
 * de R$ 35.000,00 se mantém e as três parcelas são recalculadas sobre o
 * restante, com a última levando o centavo.
 *
 * As normas deixam de ser as do Perfil, que citam elétrica (a obra não tem)
 * e não citam estrutura (a obra é quase toda estrutura).
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
const TOKEN = "thomas";

const TOTAL = 103868.67;
const ENTRADA = 35000;
const RESTO = Math.round((TOTAL - ENTRADA) * 100); // em centavos
const PARCELA = Math.floor(RESTO / 3);
const ULTIMA = RESTO - 2 * PARCELA;
const cent = (c: number) => c / 100;

const moeda = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const C1 = 6.27;
const LAJES = Math.round((0.539 + 4.838 + 17.619 + 2.932) * 100) / 100;

const G1 = "1 · Serviços preliminares";
const G2 = "2 · Fundação, pilares, vigas e laje";

type Item = {
  grupo: string;
  descricao: string;
  quantidade: number | null;
  unidade: string | null;
  observacao?: string | null;
};

/** O grupo 2 inteiro, pelo projeto estrutural. */
const ESTRUTURA: Item[] = [
  {
    grupo: G2,
    descricao:
      "Sapatas isoladas: duas S1 de 90 × 120 cm, sob os pilares P2 e P3, e uma S2 de 60 × 60 cm, sob o pilar P1 — lastro de concreto magro, armadura de aço CA-50, fôrmas e concretagem",
    quantidade: 3,
    unidade: "sapatas",
  },
  {
    grupo: G2,
    descricao: "Baldrame em tijolo argamassado, para receber a cinta C1",
    quantidade: C1,
    unidade: "m linear",
  },
  {
    grupo: G2,
    descricao:
      "Cinta C1 de 15 × 40 cm entre as sapatas S1 — armadura de aço CA-50, fôrmas e concretagem",
    quantidade: C1,
    unidade: "m linear",
  },
  {
    grupo: G2,
    descricao:
      "Pilares P1 (15 × 30 cm), P2 e P3 (15 × 45 cm) — armadura de aço CA-50, fôrmas de madeira e concretagem",
    quantidade: 3,
    unidade: "pilares",
  },
  {
    grupo: G2,
    descricao:
      "Reforço do pilar existente P18, de 20 × 20 para 20 × 30 cm — armadura, fôrmas e concretagem",
    quantidade: 1,
    unidade: "pilar",
  },
  {
    grupo: G2,
    descricao:
      "Vigas V1 a V8, com seções de 15 × 27 a 45 × 27 cm — armadura de aço CA-50, fôrmas de madeira e concretagem",
    quantidade: 8,
    unidade: "vigas",
  },
  {
    grupo: G2,
    descricao:
      "Reforço da viga existente de 12 × 50 cm entre o pilar P14 e a viga V14 — armadura, fôrmas e concretagem",
    quantidade: 1,
    unidade: "viga",
  },
  {
    grupo: G2,
    descricao:
      "Lajes de 13 cm: L1 maciça e L2, L3 e L4 treliçadas, com vigotas, EPS, escoramento, fôrmas laterais e concretagem em concreto fck 30 MPa",
    quantidade: LAJES,
    unidade: "m²",
    observacao:
      "Área dos painéis de laje; as vigas que os contornam estão no item acima. A cobertura mantém o mesmo tamanho.",
  },
];

/** Ajustes nos preliminares, que dependem da fundação. */
const PRELIMINARES: Record<string, Partial<Item>> = {
  "Escavação para as vigas baldrame": {
    descricao: "Escavação para a cinta C1",
    quantidade: C1,
  },
  "Escavação das valas para as sapatas": { quantidade: 3 },
};

const NORMAS = [
  "ABNT NBR 16280 / NBR 5674 — Reforma em edificações: organização do canteiro, proteção da casa existente, ensacamento e destinação ambiental do entulho em caçambas licenciadas.",
  "ABNT NBR 6122 — Projeto e execução de fundações: cota de assentamento e geometria das sapatas S1 e S2 conforme o projeto estrutural.",
  "ABNT NBR 6118 — Projeto de estruturas de concreto: concreto fck 30 MPa, cobrimento das armaduras e detalhamento de sapatas, pilares, vigas e lajes conforme as pranchas 101101 e 101102.",
  "ABNT NBR 14931 — Execução de estruturas de concreto: fôrmas e escoramento, lançamento e adensamento, cura e plano de desforma.",
  "ABNT NBR 14859-1 — Lajes pré-fabricadas de concreto: vigotas treliçadas, EPS e capeamento das lajes L2, L3 e L4.",
  "ABNT NBR 9575 / NBR 9574 — Impermeabilização: manta sobre a laje regularizada, com teste de estanqueidade antes do acabamento.",
  "ABNT NBR 13753 — Revestimento de piso com placas cerâmicas: assentamento do porcelanato com argamassa colante, juntas e rejunte.",
  "ABNT NBR 5626 / NBR 8160 / NBR 10844 — Instalações hidrossanitárias e de águas pluviais: tubulação testada antes do fechamento.",
];

const SECOES_NOVAS: Record<string, string> = {
  "Fundação e estrutura":
    "A estrutura segue o projeto estrutural: três sapatas — duas S1 de 90 × 120 cm e uma S2 de 60 × 60 cm —, a cinta C1 entre elas, três pilares novos e o reforço do pilar existente P18, todos em aço CA-50 com fôrmas de madeira e concreto fck 30 MPa. Os pilares ficam embutidos na alvenaria — a área gourmet não ganha coluna aparente no meio do espaço.",
  "Vedação e laje":
    "Alvenaria de vedação em tijolos, oito vigas novas (V1 a V8) e o reforço da viga existente, e lajes de 13 cm — L1 maciça e L2, L3 e L4 treliçadas — com escoramento, fôrmas laterais e concretagem. O beiral é a faixa L4, apoiada nas vigas V4 e V5.",
};

async function main() {
  const { data: o } = await sb
    .from("orc_orcamentos")
    .select("id, valor_fechado")
    .eq("token", TOKEN)
    .single();
  if (!o) throw new Error("não achei o Thomas");

  const { data: itens } = await sb
    .from("orc_itens")
    .select("grupo, descricao, quantidade, unidade, observacao, removido_em")
    .eq("orcamento_id", o.id)
    .order("position");
  if (!itens?.length) throw new Error("sem itens");
  if (itens.some((i) => i.removido_em)) {
    throw new Error("há itens removidos guardados: reescrever a lista apagaria o histórico.");
  }

  // A lista nova: tudo como está, com o grupo 2 trocado no mesmo lugar.
  const novos: Item[] = [];
  let estruturaPosta = false;
  let ajustados = 0;
  for (const i of itens) {
    if (i.grupo === G2) {
      if (!estruturaPosta) {
        novos.push(...ESTRUTURA);
        estruturaPosta = true;
      }
      continue;
    }
    const ajuste = i.grupo === G1 ? PRELIMINARES[i.descricao] : undefined;
    if (ajuste) ajustados += 1;
    novos.push({
      grupo: i.grupo!,
      descricao: ajuste?.descricao ?? i.descricao,
      quantidade: ajuste?.quantidade ?? i.quantidade,
      unidade: i.unidade,
      observacao: i.observacao,
    });
  }
  if (!estruturaPosta) throw new Error("não achei o grupo 2.");
  if (ajustados !== Object.keys(PRELIMINARES).length) {
    throw new Error(`ajustei ${ajustados} preliminares e esperava ${Object.keys(PRELIMINARES).length}.`);
  }

  const antes = itens.filter((i) => i.grupo === G2);
  console.log(`\nSr. Thomas · ${itens.length} → ${novos.length} itens`);
  console.log(`  grupo 2: ${antes.length} linhas → ${ESTRUTURA.length}`);
  for (const e of ESTRUTURA) console.log(`    ${String(e.quantidade).padStart(6)} ${e.unidade?.padEnd(9)} ${e.descricao.slice(0, 70)}…`);
  console.log(`  lajes ${LAJES} m² · cinta ${C1} m`);
  console.log(`  total ${moeda(Number(o.valor_fechado))} → ${moeda(TOTAL)}`);
  console.log(`  pagamento: ${moeda(ENTRADA)} + ${moeda(cent(PARCELA))} + ${moeda(cent(PARCELA))} + ${moeda(cent(ULTIMA))}`);
  if (ENTRADA * 100 + 2 * PARCELA + ULTIMA !== Math.round(TOTAL * 100)) throw new Error("parcelas não fecham.");

  if (!GRAVAR) {
    console.log("\nNada gravado. Rode com --gravar.");
    return;
  }

  await sb.from("orc_itens").delete().eq("orcamento_id", o.id);
  const e1 = await sb.from("orc_itens").insert(
    novos.map((i, n) => ({
      orcamento_id: o.id,
      grupo: i.grupo,
      position: n + 1,
      descricao: i.descricao,
      observacao: i.observacao ?? null,
      quantidade: i.quantidade,
      unidade: i.unidade,
      valor_unitario: null,
      origem: "humano" as const,
    })),
  );
  if (e1.error) throw new Error(`itens: ${e1.error.message}`);

  const pagamento = `${moeda(ENTRADA)} na entrada e três parcelas de ${moeda(cent(PARCELA))}, ${moeda(cent(PARCELA))} e ${moeda(cent(ULTIMA))} a cada 20 dias úteis`;
  const e2 = await sb
    .from("orc_orcamentos")
    .update({
      valor_fechado: TOTAL,
      pagamento,
      apresentacao:
        "Ampliação completa da área gourmet, com a estrutura conforme o projeto estrutural: três sapatas e cinta, três pilares novos e o reforço de um pilar existente, oito vigas, lajes de 13 cm, alvenaria, churrasqueira nova, instalações hidrossanitárias e pluvial, impermeabilização e 99,40 m² de piso em porcelanato.",
      nota_custos: `Pagamento: ${moeda(ENTRADA)} na entrada, para a mobilização da equipe, e o valor restante em três parcelas de ${moeda(cent(PARCELA))}, ${moeda(cent(PARCELA))} e ${moeda(cent(ULTIMA))}, pagas no decorrer da obra, a cada 20 dias úteis. Mão de obra e material inclusos em todos os serviços, exceto o porcelanato e o material de assentamento, fornecidos pelo contratante — a RD executa o assentamento dos 99,40 m² e informa a quantidade a comprar, já com a perda de corte. A estrutura segue o projeto estrutural (pranchas 101101 e 101102). Maquinário, andaimes, fôrmas, escoramentos e descarte de entulho inclusos; emissão de nota fiscal e ART inclusas; alteração de escopo implica reajuste do valor e do prazo.`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", o.id);
  if (e2.error) throw new Error(e2.error.message);

  for (const [titulo, texto] of Object.entries(SECOES_NOVAS)) {
    const { data, error } = await sb
      .from("orc_secoes")
      .update({ texto })
      .eq("orcamento_id", o.id)
      .eq("titulo", titulo)
      .select("id");
    if (error || data?.length !== 1) throw new Error(`seção "${titulo}": ${error?.message ?? data?.length}`);
  }

  await sb.from("orc_normas").delete().eq("orcamento_id", o.id);
  const e3 = await sb
    .from("orc_normas")
    .insert(NORMAS.map((texto, n) => ({ orcamento_id: o.id, position: n + 1, texto })));
  if (e3.error) throw new Error(`normas: ${e3.error.message}`);

  console.log(`\n  gravado ✓  Agora publique:  npm run publicar -- ${TOKEN}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
