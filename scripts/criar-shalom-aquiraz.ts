/**
 * Shalom Aquiraz RG4: dois orçamentos, a capela e a área externa.
 *
 * Saem em dois documentos porque têm regimes de preço diferentes. A área
 * externa é preço fechado de material e mão de obra, R$ 7.608,00, sem valor por
 * linha — distribuir o total pelos nove serviços seria inventar a divisão. A
 * capela é item a item. O documento não sabe misturar valor fechado com linha
 * precificada, e juntar os dois numa linha única violaria o "item por item,
 * nunca agrupado" da estrutura canônica.
 *
 * O bloco da área externa veio sem nome de cliente. Pelos serviços — calha,
 * calçada e textura das paredes externas, todas causas de infiltração — é a
 * parte de fora da mesma capela, e entra com o mesmo cliente.
 *
 * **Área externa: mantida.** Linha a linha pelo histórico da RD a conta dá
 * cerca de R$ 6.630, R$ 978 abaixo do fechado — dentro da incerteza do
 * material da calha e da textura, que a RD nunca precificou. Pela regra,
 * mantém-se o valor e sinaliza-se.
 *
 * **Capela: revista.** Os preços sem valor saem do que a RD já cobrou:
 * rodapé R$ 20/m e corte contra umidade ascendente R$ 85/m (Rafael, trecho
 * curto — no Gabriel Fernandes foi R$ 70/m, mas em 100 m), massa corrida
 * R$ 28/m² (o preço do Rodrigo no Rafael), vaso de chão R$ 440 (tabela RD
 * 2025+10%), ponto de água com abertura e recomposição R$ 300 (Dona Regina).
 * O ponto de esgoto, R$ 350, não tem precedente: é número meu.
 *
 * As duas pinturas subiram. A observação do Rodrigo diz que pintura inclui
 * material, e as duas estavam a R$ 25/m² — que é só a mão de obra da casa. A
 * das paredes vai a R$ 31 (R$ 25 + R$ 6 de material); a do forro a R$ 46, porque
 * forro novo de drywall pede selador e a RD cobrou, no Erivando, R$ 30 de
 * pintura de forro mais selador à parte, só mão de obra.
 *
 * O forro, R$ 120/m² com material, está dentro do que a base e o mercado dão,
 * e fica.
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
const ORG = "add1ea68-41ad-4a17-8083-c87390ea2ad3";
const CLIENTE = "Shalom Aquiraz RG4";

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
  cabecalho: Record<string, unknown>;
  itens: Item[];
  secoes: Secao[];
  normas: string[];
};

const PAGAMENTO =
  "entrada na aprovação e saldo na conclusão — divisão a confirmar com a Shalom";

const NORMA_REFORMA =
  "ABNT NBR 16280 / NBR 5674 — Reforma e gestão em edificações: organização do canteiro, proteção contra poeira nas áreas contíguas, ensacamento e destinação ambiental de entulho em caçambas licenciadas.";

/* ------------------------------------------------------------- capela */

const C1 = "1 · Vaso sanitário com caixa acoplada";
const C2 = "2 · Capela: tratamento de infiltração";
const C3 = "3 · Quarto ao lado da capela: tratamento de infiltração";
const C4 = "4 · Forro de gesso drywall";

const CAPELA: Proposta = {
  token: "shalom-aquiraz-capela",
  cabecalho: {
    cliente_nome: CLIENTE,
    objeto: "Capela: tratamento de infiltração, vaso sanitário e forro de drywall",
    senha: "Shalom2026",
    validade_dias: 20,
    valor_fechado: null,
    prazo: null,
    entrada_percentual: null,
    parcelas: 2,
    pagamento: PAGAMENTO,
    marca: "rd",
    apresentacao:
      "Tratamento da umidade ascendente nas paredes da capela e do quarto ao lado, com corte no rodapé a cada 2,00 m, massa corrida e pintura; troca do vaso sanitário por um modelo com caixa acoplada, com adequação dos pontos de água e esgoto; e forro novo de gesso drywall, pintado em branco neve. Forro e pinturas saem com material incluído; os demais serviços são de mão de obra.",
    intro_custos:
      "Os serviços estão item a item, na ordem de execução, com quantidade e preço de cada um. O forro e as pinturas trazem material incluído; nos demais, o material fica por conta da contratante.",
    nota_custos:
      "Forro de drywall e pinturas com material e mão de obra; demais serviços somente mão de obra. Os preços seguem o que a RD praticou em obras comparáveis. A massa corrida da capela entra numa faixa de 1,00 m de altura sobre os 9,48 m tratados, área assumida e marcada na própria linha, que a medição em obra confirma. Prazo e divisão das parcelas serão definidos com a Shalom.",
  },
  itens: [
    {
      grupo: C1,
      descricao:
        "Retirada do vaso sanitário simples existente e instalação do novo vaso com caixa acoplada",
      quantidade: 1,
      unidade: "un",
      valor: 440,
    },
    {
      grupo: C1,
      descricao:
        "Adequação do ponto de água para a caixa acoplada, com abertura e recomposição do trecho de parede",
      quantidade: 1,
      unidade: "un",
      valor: 300,
    },
    {
      grupo: C1,
      descricao:
        "Adequação do ponto de esgoto para o novo vaso, com abertura e recomposição do trecho de piso",
      quantidade: 1,
      unidade: "un",
      valor: 350,
    },

    {
      grupo: C2,
      descricao: "Retirada do rodapé, com reaproveitamento para reinstalação após o tratamento",
      quantidade: 9.48,
      unidade: "m linear",
      valor: 20,
      observacao: "Os mesmos rodapés voltam ao lugar: não há compra de peça nova.",
    },
    {
      grupo: C2,
      descricao:
        "Tratamento de umidade ascendente: rasgo de 10 cm de altura no rodapé, intercalado a cada 2,00 m, preenchido com cimento, areia e rebotec",
      quantidade: 9.48,
      unidade: "m linear",
      valor: 85,
    },
    {
      grupo: C2,
      descricao:
        "Correção com massa corrida nas paredes que receberam o tratamento de infiltração",
      quantidade: 9.48,
      unidade: "m²",
      valor: 28,
      observacao:
        "Área assumida: faixa de 1,00 m de altura sobre os 9,48 m tratados. A medida real confirma a linha.",
    },
    {
      grupo: C2,
      descricao: "Pintura das paredes da capela, com material incluído",
      quantidade: 47,
      unidade: "m²",
      valor: 31,
    },

    {
      grupo: C3,
      descricao: "Retirada do rodapé cerâmico e reinstalação após o tratamento",
      quantidade: 13.57,
      unidade: "m linear",
      valor: 20,
    },
    {
      grupo: C3,
      descricao:
        "Tratamento de umidade ascendente: rasgo de 10 cm de altura no rodapé, intercalado a cada 2,00 m e atravessando a parede de um lado ao outro, preenchido com cimento, areia e rebotec",
      quantidade: 13.57,
      unidade: "m linear",
      valor: 85,
    },

    {
      grupo: C4,
      descricao:
        "Instalação de forro em gesso drywall, com estrutura, chapas e tratamento de juntas — material e mão de obra",
      quantidade: 54.34,
      unidade: "m²",
      valor: 120,
    },
    {
      grupo: C4,
      descricao:
        "Pintura do forro na cor branco neve, com selador e duas demãos — material e mão de obra",
      quantidade: 54.34,
      unidade: "m²",
      valor: 46,
      observacao: "Chapa de drywall nova absorve tinta de modo desigual sem selador.",
    },
  ],
  secoes: [
    {
      tipo: "projeto",
      titulo: "Paredes · Barreira contra a umidade que sobe do chão",
      texto:
        "Na capela e no quarto ao lado a umidade sobe pela base das paredes. O tratamento abre um rasgo de 10 cm no rodapé, em trechos intercalados a cada 2,00 m — no quarto, atravessando a parede de um lado ao outro —, e o preenche com cimento, areia e rebotec. O rodapé é retirado antes e recolocado depois.",
    },
    {
      tipo: "projeto",
      titulo: "Capela · Massa e pintura",
      texto:
        "As paredes tratadas recebem massa corrida, e os 47,00 m² de parede da capela são pintados, com material incluído.",
    },
    {
      tipo: "projeto",
      titulo: "Banheiro · Vaso com caixa acoplada",
      texto:
        "O vaso simples dá lugar a um modelo com caixa acoplada. A troca pede um ponto de água novo, mais baixo, e o ajuste da saída de esgoto no piso — por isso os dois pontos estão discriminados.",
    },
    {
      tipo: "projeto",
      titulo: "Forro · Gesso drywall em branco neve",
      texto:
        "54,34 m² de forro novo em gesso drywall, com estrutura, chapas e tratamento de juntas, pintado com selador e duas demãos na cor branco neve. Material e mão de obra inclusos.",
    },
    {
      tipo: "observacao",
      titulo: "Corte em trechos de 2,00 m",
      texto:
        "O rasgo é feito intercalado, nunca de uma vez só, para não comprometer a estabilidade das paredes durante o tratamento.",
    },
    {
      tipo: "observacao",
      titulo: "Material por conta da contratante",
      texto:
        "Forro e pinturas já incluem o material. Nos demais serviços — vaso, tubos e conexões, cimento, areia, rebotec e massa corrida — o material fica por conta da Shalom, conforme a especificação acordada com a RD.",
    },
    {
      tipo: "etapa",
      titulo: "Aprovação e programação",
      texto:
        "Você aprova a proposta e combinamos a data de início, as condições de pagamento e a compra dos materiais.",
    },
    {
      tipo: "etapa",
      titulo: "Tratamento das paredes",
      texto:
        "Retirada dos rodapés, rasgos intercalados e preenchimento na capela e no quarto, e reinstalação dos rodapés.",
    },
    {
      tipo: "etapa",
      titulo: "Vaso sanitário e forro",
      texto:
        "Adequação dos pontos de água e esgoto, instalação do vaso com caixa acoplada e montagem do forro de drywall.",
    },
    {
      tipo: "etapa",
      titulo: "Acabamento e entrega",
      texto: "Massa corrida, pintura das paredes e do forro, e vistoria final com você.",
    },
  ],
  normas: [
    NORMA_REFORMA,
    "ABNT NBR 9575 / NBR 9574 — Impermeabilização: barreira contra umidade ascendente executada em trechos intercalados, sobre substrato limpo e com cura adequada antes do acabamento.",
    "ABNT NBR 5626 / NBR 8160 — Instalações hidrossanitárias: ponto de água para a caixa acoplada e ajuste da saída de esgoto, com teste de estanqueidade antes do fechamento.",
    "ABNT NBR 15758 — Sistemas construtivos em chapas de gesso para drywall: estrutura, fixação das chapas e tratamento de juntas do forro.",
  ],
};

/* ------------------------------------------------------- área externa */

const E1 = "1 · Calha";
const E2 = "2 · Piso da calçada";
const E3 = "3 · Paredes externas";
const E4 = "4 · Limpeza";

const AREA_EXTERNA: Proposta = {
  token: "shalom-aquiraz-area-externa",
  cabecalho: {
    cliente_nome: CLIENTE,
    objeto: "Área externa: calha, piso da calçada e textura das paredes",
    senha: "Shalom2026",
    validade_dias: 20,
    valor_fechado: 7608,
    prazo: null,
    entrada_percentual: null,
    parcelas: 2,
    pagamento: PAGAMENTO,
    marca: "rd",
    apresentacao:
      "Serviços na área externa: instalação de calha de PVC, refazimento do piso da calçada em concreto e recuperação de duas paredes externas, com retirada da textura antiga, correção do reboco, fundo preparador e textura nova. Material e mão de obra inclusos.",
    intro_custos:
      "Este orçamento é fechado com material e mão de obra: todos os serviços abaixo estão incluídos num valor único.",
    nota_custos:
      "Valor único com material e mão de obra para o escopo descrito. A correção de reboco cobre os trechos danificados encontrados após a retirada da textura.",
  },
  itens: [
    { grupo: E1, descricao: "Instalação de calha de PVC 125 mm", quantidade: 12, unidade: "m" },
    {
      grupo: E2,
      descricao: "Demolição do piso da calçada para execução do piso novo",
      quantidade: 6.63,
      unidade: "m²",
    },
    {
      grupo: E2,
      descricao: "Compactação do solo para receber o concreto",
      quantidade: 6.63,
      unidade: "m²",
    },
    {
      grupo: E2,
      descricao: "Concretagem do piso da calçada",
      quantidade: 6.63,
      unidade: "m²",
    },
    {
      grupo: E3,
      descricao: "Retirada da textura antiga de duas paredes externas",
      quantidade: 34.83,
      unidade: "m²",
    },
    {
      grupo: E3,
      descricao: "Correção do reboco danificado das duas paredes",
      quantidade: 1,
      unidade: "serv",
    },
    {
      grupo: E3,
      descricao: "Aplicação de fundo preparador para receber a textura",
      quantidade: 34.83,
      unidade: "m²",
    },
    {
      grupo: E3,
      descricao: "Aplicação de textura nas duas paredes externas",
      quantidade: 34.83,
      unidade: "m²",
    },
    { grupo: E4, descricao: "Retirada de entulho e limpeza", quantidade: 1, unidade: "serv" },
  ],
  secoes: [
    {
      tipo: "projeto",
      titulo: "Calha · Água do telhado longe das paredes",
      texto:
        "12,00 m de calha de PVC 125 mm recolhem a água do telhado antes que ela escorra pela fachada e encharque a base das paredes.",
    },
    {
      tipo: "projeto",
      titulo: "Calçada · Piso novo em concreto",
      texto:
        "O piso existente da calçada é demolido, o solo é compactado e recebe 6,63 m² de concreto novo.",
    },
    {
      tipo: "projeto",
      titulo: "Paredes externas · Textura refeita sobre base sã",
      texto:
        "A textura antiga sai dos 34,83 m² das duas paredes, o reboco danificado é corrigido, e só então vêm o fundo preparador e a textura nova. Textura sobre reboco solto descasca de novo.",
    },
    {
      tipo: "observacao",
      titulo: "Material e mão de obra inclusos",
      texto:
        "Calha, concreto, fundo preparador, textura e a argamassa da correção de reboco estão no valor, assim como a mão de obra e a retirada do entulho.",
    },
    {
      tipo: "etapa",
      titulo: "Aprovação e programação",
      texto: "Você aprova a proposta e combinamos a data de início e as condições de pagamento.",
    },
    {
      tipo: "etapa",
      titulo: "Calha e calçada",
      texto: "Instalação da calha, demolição, compactação e concretagem do piso da calçada.",
    },
    {
      tipo: "etapa",
      titulo: "Paredes externas e entrega",
      texto:
        "Retirada da textura, correção do reboco, fundo preparador, textura nova, limpeza e vistoria final com você.",
    },
  ],
  normas: [
    NORMA_REFORMA,
    "ABNT NBR 10844 — Instalações prediais de águas pluviais: calha dimensionada e instalada com caimento contínuo para o escoamento.",
  ],
};

const moeda = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function gravar(p: Proposta) {
  const total = Math.round(
    p.itens.reduce((s, i) => s + (i.valor ? (i.quantidade ?? 1) * i.valor : 0), 0) * 100,
  ) / 100;
  const fechado = p.cabecalho.valor_fechado as number | null;
  console.log(`\n${p.token}: ${p.itens.length} itens · ${fechado ? `fechado ${moeda(fechado)}` : moeda(total)}`);
  if (!GRAVAR) return;

  const { data: existente } = await sb.from("orc_orcamentos").select("id").eq("token", p.token).maybeSingle();
  let id: string;
  if (existente) {
    id = existente.id;
    await sb.from("orc_orcamentos").update(p.cabecalho).eq("id", id);
    for (const t of ["orc_itens", "orc_secoes", "orc_normas"] as const) {
      await sb.from(t).delete().eq("orcamento_id", id);
    }
  } else {
    const { data, error } = await sb
      .from("orc_orcamentos")
      .insert({ org_id: ORG, token: p.token, ...p.cabecalho } as never)
      .select("id")
      .single();
    if (error) throw new Error(`${p.token}: ${error.message}`);
    id = data.id;
  }

  const r1 = await sb.from("orc_itens").insert(
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
  if (r1.error) throw new Error(`itens: ${r1.error.message}`);

  const r2 = await sb.from("orc_secoes").insert(
    p.secoes.map((s, n) => ({
      orcamento_id: id,
      tipo: s.tipo,
      position: n + 1,
      titulo: s.titulo,
      texto: s.texto,
      origem: "humano" as const,
    })),
  );
  if (r2.error) throw new Error(`seções: ${r2.error.message}`);

  const r3 = await sb.from("orc_normas").insert(
    p.normas.map((texto, n) => ({ orcamento_id: id, position: n + 1, texto })),
  );
  if (r3.error) throw new Error(`normas: ${r3.error.message}`);

  if (!fechado) {
    const { data: g } = await sb.from("orc_itens").select("total").eq("orcamento_id", id);
    const noBanco = Math.round((g ?? []).reduce((s, l) => s + Number(l.total ?? 0), 0) * 100) / 100;
    if (Math.abs(noBanco - total) > 0.01) throw new Error(`soma ${noBanco} ≠ ${total}`);
  }
  console.log(`  gravado ✓`);
}

async function main() {
  await gravar(CAPELA);
  await gravar(AREA_EXTERNA);
  if (!GRAVAR) console.log("\nNada gravado. Rode com --gravar.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
