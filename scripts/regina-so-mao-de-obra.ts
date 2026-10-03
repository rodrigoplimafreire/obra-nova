/**
 * Refaz a Dona Regina só com mão de obra, pelos preços da planilha de 2025 com
 * os 10% de reajuste.
 *
 * Sai o material inteiro — tabela e valores — e os serviços deixam de usar os
 * R$ 45,00/m² do levantamento antigo: passam a sair da base
 * **"Mão de obra · empresa (2025 + 10%)"**, que é o valor máximo da planilha,
 * o que a RD cobra de empresa.
 *
 * Chapisco e reboco viram **duas linhas**, e isso é melhoria, não detalhe: a
 * planilha do Reginato precifica os dois separados (R$ 5,50 e R$ 44,00 o m²
 * depois do reajuste), e juntá-los num número só esconderia de onde o preço
 * veio. O m² total continua sendo o mesmo 82,18.
 *
 * **Três linhas não vêm da planilha**, e o script diz quais: a preparação, a
 * instalação dos registros e a limpeza final não têm serviço equivalente na
 * tabela. Entram como verba, e ficam marcadas na observação da linha para o
 * Reginato saber exatamente o que conferir.
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
const BASE = "Mão de obra · empresa (2025 + 10%)";

const G1 = "1 · Conferência e preparação";
const G2 = "2 · Instalação dos registros";
const G3 = "3 · Chapisco e reboco";
const G4 = "4 · Forro PVC";
const G5 = "5 · Verificação e entrega";

const AREAS = [
  { local: "Muro de divisa dos fundos", calculo: "5,44 × 4,11 m", area: 22.36 },
  { local: "Muro lateral", calculo: "3,19 × 4,11 m", area: 13.11 },
  { local: "Fachada dos fundos", calculo: "3,55 × 5,91 m", area: 20.98 },
  { local: "Fachada lateral do pavimento superior", calculo: "3,19 × 2,85 m", area: 9.09 },
  { local: "Paredes da lavanderia", calculo: "(2,23 + 2,72 + 1,87) × 2,44 m", area: 16.64 },
];

const AREA_TOTAL = 82.18;
const AREA_FORRO = 10.3;

const moeda = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** O preço de um serviço na base, pela descrição exata. */
async function daBase(baseId: string, descricao: string): Promise<number> {
  const { data } = await sb
    .from("orc_composicoes")
    .select("custo_unitario, unidade")
    .eq("base_id", baseId)
    .eq("descricao", descricao)
    .maybeSingle();
  if (!data?.custo_unitario) {
    throw new Error(`"${descricao}" não está na base ${BASE}.`);
  }
  return Number(data.custo_unitario);
}

async function main() {
  const { data: org } = await sb
    .from("orgs")
    .select("id")
    .eq("nome_exibicao", "RD Engenharia")
    .maybeSingle();
  if (!org) throw new Error("Não achei a org RD Engenharia.");

  const { data: base } = await sb
    .from("orc_bases_de_preco")
    .select("id")
    .eq("org_id", org.id)
    .eq("nome", BASE)
    .maybeSingle();
  if (!base) throw new Error(`Base "${BASE}" não encontrada. Rode o importador antes.`);

  const chapisco = await daBase(base.id, "Chapisco");
  const reboco = await daBase(base.id, "Reboco aprumado");
  const forro = await daBase(base.id, "Forro em drywall");

  /** Verbas sem equivalente na planilha — marcadas como tal na linha. */
  const VERBA_PREPARO = 450;
  const VERBA_REGISTRO = 300;
  const VERBA_LIMPEZA = 600;

  const DA_PLANILHA = `Preço da planilha de mão de obra 2025 da RD, com os 10% de reajuste.`;
  const VERBA = `Verba: a planilha de mão de obra não tem serviço equivalente. A conferir com o Reginato.`;

  type Item = {
    grupo: string;
    descricao: string;
    quantidade: number;
    unidade: string;
    valor: number;
    observacao: string;
  };

  const ITENS: Item[] = [
    {
      grupo: G1,
      descricao:
        "Conferência das medidas e das condições das superfícies, definição dos acessos às áreas elevadas, proteção dos ambientes e verificação do percurso das tubulações",
      quantidade: 1,
      unidade: "serv",
      valor: VERBA_PREPARO,
      observacao: VERBA,
    },

    ...["cozinha", "banheiro", "área de serviço"].map((setor) => ({
      grupo: G2,
      descricao: `Instalação de registro para isolamento da ${setor}, com abertura e recomposição do trecho de parede`,
      quantidade: 1,
      unidade: "un",
      valor: VERBA_REGISTRO,
      observacao: VERBA,
    })),

    ...AREAS.map((a) => ({
      grupo: G3,
      descricao: `Chapisco — ${a.local.toLowerCase()} (${a.calculo})`,
      quantidade: a.area,
      unidade: "m²",
      valor: chapisco,
      observacao: DA_PLANILHA,
    })),
    ...AREAS.map((a) => ({
      grupo: G3,
      descricao: `Reboco aprumado — ${a.local.toLowerCase()}`,
      quantidade: a.area,
      unidade: "m²",
      valor: reboco,
      observacao: DA_PLANILHA,
    })),

    {
      grupo: G4,
      descricao:
        "Instalação de forro, com estrutura de fixação e perfis de acabamento (1,88 × 5,48 m)",
      quantidade: AREA_FORRO,
      unidade: "m²",
      valor: forro,
      observacao: `${DA_PLANILHA} A planilha precifica o forro em drywall; o de PVC usa a mesma mão de obra.`,
    },

    {
      grupo: G5,
      descricao:
        "Conferência dos acabamentos, verificação do isolamento independente dos três setores hidráulicos, limpeza final e destinação dos resíduos",
      quantidade: 1,
      unidade: "serv",
      valor: VERBA_LIMPEZA,
      observacao: VERBA,
    },
  ];

  const totalDaLinha = (i: Item) => Math.round(i.quantidade * i.valor * 100) / 100;
  const grupos = [...new Set(ITENS.map((i) => i.grupo))];
  let soma = 0;

  console.log(`\nDona Regina · só mão de obra · base "${BASE}"`);
  console.log(`  chapisco ${moeda(chapisco)}/m² · reboco ${moeda(reboco)}/m² · forro ${moeda(forro)}/m²\n`);

  for (const g of grupos) {
    const doGrupo = ITENS.filter((i) => i.grupo === g);
    const sub = doGrupo.reduce((s, i) => s + totalDaLinha(i), 0);
    soma += sub;
    console.log(`  ${g} — ${doGrupo.length} linhas · ${moeda(sub)}`);
  }
  soma = Math.round(soma * 100) / 100;

  // As áreas continuam sendo as do levantamento, somadas duas vezes porque
  // chapisco e reboco são serviços distintos sobre a mesma parede.
  const m2 = Math.round(AREAS.reduce((s, a) => s + a.area, 0) * 100) / 100;
  if (Math.abs(m2 - AREA_TOTAL) > 0.01) {
    throw new Error(`áreas somam ${m2} m², e o levantamento diz ${AREA_TOTAL} m².`);
  }

  console.log(`\n  ${m2} m² de chapisco e ${m2} m² de reboco`);
  console.log(`  total de mão de obra ${moeda(soma)}`);
  console.log(`  alvo do Rodrigo R$ 6.500,00 · diferença ${moeda(soma - 6500)}`);

  if (!GRAVAR) {
    console.log("\nNada gravado. Rode com --gravar.");
    return;
  }

  const { data: o } = await sb
    .from("orc_orcamentos")
    .select("id")
    .eq("token", "regina")
    .maybeSingle();
  if (!o) throw new Error("Não achei o orçamento de token regina.");

  // O material sai inteiro: tabela e valores.
  await sb.from("orc_materiais").delete().eq("orcamento_id", o.id);
  await sb.from("orc_itens").delete().eq("orcamento_id", o.id);

  const { error } = await sb.from("orc_itens").insert(
    ITENS.map((i, n) => ({
      orcamento_id: o.id,
      grupo: i.grupo,
      position: n + 1,
      descricao: i.descricao,
      observacao: i.observacao,
      quantidade: i.quantidade,
      unidade: i.unidade,
      valor_unitario: i.valor,
      origem: "humano" as const,
    })),
  );
  if (error) throw new Error(`itens: ${error.message}`);

  const { data: gravados } = await sb
    .from("orc_itens")
    .select("total")
    .eq("orcamento_id", o.id);
  const noBanco =
    Math.round((gravados ?? []).reduce((s, l) => s + Number(l.total ?? 0), 0) * 100) / 100;
  if (Math.abs(noBanco - soma) > 0.01) {
    throw new Error(`soma no banco ${moeda(noBanco)} ≠ ${moeda(soma)}.`);
  }

  const { count: sobrouMaterial } = await sb
    .from("orc_materiais")
    .select("id", { count: "exact", head: true })
    .eq("orcamento_id", o.id);
  if (sobrouMaterial !== 0) throw new Error(`sobraram ${sobrouMaterial} materiais.`);

  await sb
    .from("orc_orcamentos")
    .update({
      objeto: "Chapisco e reboco, forro PVC e três registros — mão de obra",
      apresentacao:
        "Execução de chapisco e reboco nos muros e paredes dos fundos, instalação de forro PVC e instalação de três registros para separar os setores hidráulicos da cozinha, do banheiro e da área de serviço. Orçamento de mão de obra: os materiais ficam por conta da contratante.",
      intro_custos:
        "Os serviços estão na ordem de execução, com a quantidade e o preço de mão de obra de cada um. Chapisco e reboco entram em linhas separadas, como na tabela de preços da RD.",
      nota_custos:
        "Somente mão de obra — os materiais ficam por conta da contratante, conforme as especificações e a programação acordadas com a RD. Os preços seguem a planilha de mão de obra de 2025 da RD, com 10% de reajuste, na faixa praticada com empresa. A preparação, a instalação dos registros e a limpeza final entram como verba, por não terem serviço equivalente na planilha, e serão conferidas pelo Reginato. Não estão incluídas pintura, impermeabilização e recuperação de patologias, que não foram descritas no levantamento, nem locação de andaimes, equipamentos e fretes, que serão apresentados separadamente se necessários. Prazo, entrada e parcelas serão definidos após a vistoria. Rascunho para revisão interna.",
      updated_at: new Date().toISOString(),
    })
    .eq("id", o.id);

  console.log(`\n  ${ITENS.length} linhas · material removido`);
  console.log(`  soma no banco ${moeda(noBanco)} ✓`);
  console.log(`\nAgora republique:  npm run publicar -- regina`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
