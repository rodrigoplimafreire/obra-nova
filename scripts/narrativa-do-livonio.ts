/**
 * Reescreve a narrativa do Sr. Livônio para o escopo que a tabela vende.
 *
 * Quando o Reginato revisou o escopo, em 27/08/2026, a planilha e o valor
 * acompanharam — 31,00 m² e R$ 24.325,00, com reforço estrutural e
 * reinstalação do telhado existente — mas a apresentação e os cards do projeto
 * ficaram descrevendo o orçamento anterior: acréscimo de pavimento completo,
 * 72,35 m², alvenaria nova e telhado colonial novo, por R$ 85.500,00.
 *
 * O documento ficou se contradizendo, e para pior: a narrativa prometia mais
 * do que a tabela cobra. Quem lia a abertura entendia que ia receber um
 * pavimento inteiro erguido e coberto pelo preço do reforço. Num documento
 * feito para imprimir e assinar, isso não é texto desatualizado — é o escopo
 * do contrato dizendo duas coisas diferentes na mesma página.
 *
 * **A narrativa nova sai da tabela, item por item**, e não do que eu suponho
 * que a obra seja. Onde o card antigo dizia 70 m², 10 sapatas e duas lajes, a
 * planilha diz 31 m², 8 sapatas e uma laje; é a planilha que manda, porque é
 * ela que o Reginato revisou. O card de "Fechamento · Alvenaria e telhado" sai
 * inteiro, por não ter uma única linha que o sustente, e no lugar entra o
 * grupo 4.0 — a reinstalação —, que existia na tabela e não tinha card nenhum.
 *
 * Entra também uma observação dizendo **o que não está incluído**. É a parte
 * que enganava, e deixar o silêncio no lugar da promessa não resolve: o
 * cliente precisa ler que a alvenaria e a cobertura nova do pavimento são obra
 * posterior.
 *
 * O `objeto` era "Orçamento e cronograma", que não diz nada e ainda promete um
 * cronograma que o orçamento não tem.
 *
 * **Nada de preço muda aqui.** O `valor_fechado` de R$ 24.325,00 e as 11
 * linhas da planilha ficam exatamente como o Reginato deixou.
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
const TOKEN = "9nH18Do_-dgbGqny4FQO6McR9qtUn0pz";

/** O que a planilha revisada diz, e que a narrativa tem de respeitar. */
const DA_PLANILHA = {
  area: 31,
  sapatas: 8,
  pilares: 8,
  vigas: 33.42,
  valorFechado: 24325,
  itens: 11,
};

const OBJETO = "Reforço estrutural e laje para pavimento superior — 31 m²";

const APRESENTACAO =
  "Execução da estrutura em concreto armado que vai receber o pavimento " +
  "superior: reforço da fundação com oito sapatas, oito pilares, vigas e uma " +
  "laje de 31 m², já com a abertura prevista para a escada. O telhado e o " +
  "forro PVC existentes são desmontados, guardados e reinstalados ao fim do " +
  "serviço — não são substituídos. A alvenaria e a cobertura do pavimento " +
  "novo não fazem parte deste orçamento.";

const SECOES: Array<{ tipo: "projeto" | "observacao"; titulo: string; texto: string }> = [
  {
    tipo: "projeto",
    titulo: "Preparação · Telhado e forro desmontados para reuso",
    texto:
      "O forro PVC e o telhado — telhas, ripamento e caibros — são retirados com cuidado sobre os 31 m² e armazenados. As mesmas peças voltam ao lugar no fim da obra, e é por isso que a desmontagem é feita peça por peça e não derrubada.",
  },
  {
    tipo: "projeto",
    titulo: "Fundação · Oito sapatas de 70×70",
    texto:
      "Oito valas de 80×80 cm escavadas à mão e, dentro delas, a forma, a armação e a concretagem de oito sapatas de 70×70 cm — a base que vai receber a carga da estrutura nova.",
  },
  {
    tipo: "projeto",
    titulo: "Superestrutura · Pilares, vigas e laje",
    texto:
      "Oito pilares de 300×30×15, 33,42 m de vigas de 50×15 e a laje treliçada de 31 m² com escoramento e capeamento, já com a abertura de 2,00 × 0,86 m para a escada que vai subir depois.",
  },
  {
    tipo: "projeto",
    titulo: "Reinstalação · O telhado de volta no lugar",
    texto:
      "Remontagem da estrutura do telhado, reinstalação das telhas e dos acabamentos de cumeeira, e recolocação do forro PVC guardado na primeira etapa — a casa volta coberta como estava, agora sobre a laje nova.",
  },
  {
    tipo: "observacao",
    titulo: "O que este orçamento não inclui",
    texto:
      "O serviço é a estrutura: fundação, pilares, vigas e laje. A alvenaria do pavimento superior, a cobertura nova, os revestimentos e as instalações são obra posterior e não estão neste valor. O telhado e o forro que saem no começo são os mesmos que voltam no fim.",
  },
  {
    tipo: "observacao",
    titulo: "Abertura para a escada já prevista",
    texto:
      "A laje é concretada com a abertura de 2,00 × 0,86 m no lugar da escada futura, o que evita ter de cortar laje pronta depois — serviço mais caro e que deixa a estrutura mais fraca do que se a abertura já nasce com ela.",
  },
  {
    tipo: "observacao",
    titulo: "Telhado reaproveitado",
    texto:
      "Não há compra de telha, caibro, ripa nem forro: o que existe hoje é desmontado, guardado no canteiro e reinstalado. Peças que se quebrem na desmontagem são repostas à parte, com o seu aval.",
  },
];

async function main() {
  const { data: o } = await sb
    .from("orc_orcamentos")
    .select("id, cliente_nome, objeto, valor_fechado, apresentacao")
    .eq("token", TOKEN)
    .maybeSingle();
  if (!o) throw new Error(`Não achei o orçamento de token ${TOKEN}.`);

  /*
   * A narrativa nova afirma números — 31 m², 8 sapatas, 8 pilares, 33,42 m de
   * viga. Se a planilha não os sustentar, o script para: foi exatamente por
   * narrativa e tabela andarem soltas que este orçamento precisou de conserto.
   */
  const { data: itens } = await sb
    .from("orc_itens")
    .select("descricao, quantidade, unidade, grupo")
    .eq("orcamento_id", o.id);
  if (!itens?.length) throw new Error("não achei os itens.");

  const acha = (re: RegExp) => itens.find((i) => re.test(i.descricao));
  const confere = (o_que: string, achado: unknown, esperado: number) => {
    if (achado === null || achado === undefined || Math.abs(Number(achado) - esperado) > 0.01) {
      throw new Error(`${o_que}: a planilha diz ${achado}, e a narrativa afirma ${esperado}.`);
    }
    console.log(`  ${o_que} = ${esperado} ✓`);
  };

  console.log(`\n${o.cliente_nome} · conferindo a narrativa contra a planilha\n`);
  confere("laje, em m²", acha(/laje pré-moldada|laje tre/i)?.quantidade, DA_PLANILHA.area);
  confere("sapatas", acha(/sapatas 70×70|sapatas 70x70/i)?.quantidade, DA_PLANILHA.sapatas);
  confere("pilares", acha(/pilares de 300/i)?.quantidade, DA_PLANILHA.pilares);
  confere("vigas, em m", acha(/vigas de 50/i)?.quantidade, DA_PLANILHA.vigas);

  if (itens.length !== DA_PLANILHA.itens) {
    throw new Error(`a planilha tem ${itens.length} linhas, e eu contava ${DA_PLANILHA.itens}.`);
  }
  if (Number(o.valor_fechado) !== DA_PLANILHA.valorFechado) {
    throw new Error(
      `o valor fechado é ${o.valor_fechado}, e eu contava ${DA_PLANILHA.valorFechado}.`,
    );
  }
  if (acha(/alvenaria|telhado colonial com oit/i)) {
    throw new Error("a planilha tem alvenaria ou telhado novo: a narrativa nova estaria errada.");
  }
  console.log(`  ${itens.length} linhas · valor fechado inalterado ✓`);

  console.log(`\n  sai:   ${o.apresentacao?.slice(0, 76)}…`);
  console.log(`  entra: ${APRESENTACAO.slice(0, 76)}…`);
  console.log(
    `\n  ${SECOES.filter((s) => s.tipo === "projeto").length} cards de projeto` +
      ` · ${SECOES.filter((s) => s.tipo === "observacao").length} observações`,
  );

  if (!GRAVAR) {
    console.log("\nNada gravado. Rode com --gravar.");
    return;
  }

  const { data: etapas } = await sb
    .from("orc_secoes")
    .select("titulo, texto, origem")
    .eq("orcamento_id", o.id)
    .eq("tipo", "etapa")
    .order("position");

  await sb.from("orc_secoes").delete().eq("orcamento_id", o.id);
  const { error: erroSecoes } = await sb.from("orc_secoes").insert([
    ...SECOES.map((s, n) => ({
      orcamento_id: o.id,
      tipo: s.tipo,
      position: n + 1,
      titulo: s.titulo,
      texto: s.texto,
      origem: "humano" as const,
    })),
    ...(etapas ?? []).map((e, n) => ({
      orcamento_id: o.id,
      tipo: "etapa" as const,
      position: SECOES.length + n + 1,
      titulo: e.titulo,
      texto: e.texto,
      origem: e.origem,
    })),
  ]);
  if (erroSecoes) throw new Error(`seções: ${erroSecoes.message}`);

  // valor_fechado e itens não se tocam: isto é conserto de texto.
  const { error } = await sb
    .from("orc_orcamentos")
    .update({
      objeto: OBJETO,
      apresentacao: APRESENTACAO,
      updated_at: new Date().toISOString(),
    })
    .eq("id", o.id);
  if (error) throw new Error(error.message);

  const { data: depois } = await sb
    .from("orc_orcamentos")
    .select("valor_fechado, apresentacao")
    .eq("id", o.id)
    .single();
  if (Number(depois?.valor_fechado) !== DA_PLANILHA.valorFechado) {
    throw new Error("o valor fechado mudou, e não devia.");
  }
  /*
   * O vestígio a caçar é a **afirmação** do escopo antigo, não a palavra solta:
   * a apresentação nova cita a alvenaria justamente para dizer que ela não
   * entra, e um `/alvenaria/` simples condenaria a frase que conserta o
   * problema. Na primeira versão deste script foi o que aconteceu.
   */
  const VESTIGIOS = [
    { nome: "a área antiga", re: /72,35|70 m²/ },
    { nome: "o valor antigo", re: /85\.?500/ },
    { nome: "o telhado novo", re: /telhado colonial/i },
    { nome: "a alvenaria como serviço incluído", re: /elevação das paredes/i },
    { nome: "as duas lajes", re: /duas lajes/i },
  ];
  const texto = [depois?.apresentacao, OBJETO, ...SECOES.map((s) => s.texto)].join(" ");
  for (const v of VESTIGIOS) {
    if (v.re.test(texto)) throw new Error(`a narrativa ainda afirma ${v.nome}.`);
  }
  if (!/não inclui/i.test(SECOES.map((s) => s.titulo).join(" "))) {
    throw new Error("falta a observação dizendo o que não está incluído.");
  }

  console.log(`\n  narrativa trocada · ${SECOES.length} cards · valor intacto ✓`);
  console.log(`\nAgora republique:  npm run publicar -- ${TOKEN}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
