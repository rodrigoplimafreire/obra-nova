/**
 * As normas que o orçamento do Sr. Livônio cita.
 *
 * Até aqui ele citava as cinco do Perfil da RD, que são de reforma de
 * acabamento: assentamento de porcelanato, impermeabilização de área molhada,
 * elétrica de baixa tensão e hidrossanitária. A obra dele não tem nada disso —
 * é escavação, sapata, pilar, viga, laje e a recolocação do telhado existente.
 * Um documento que vai ser assinado sob ART citando disciplina que não vai
 * acontecer declara escopo errado.
 *
 * **O que fica do Perfil:** a NBR 16280 / 5674, de reforma e gestão de
 * edificações. Canteiro, poeira e destinação de entulho valem aqui como valem
 * em qualquer obra, e o orçamento tem linha de limpeza e remoção de entulho.
 *
 * **O que entra**, pelo que a planilha de fato vende:
 *
 * - **6122**, porque há oito valas e oito sapatas;
 * - **6118** e **14931**, o projeto e a execução do concreto armado dos
 *   pilares, das vigas e da laje — a segunda cobre fôrma, escoramento e
 *   desforma, que são itens explícitos da tabela;
 * - **14859-1**, a laje pré-fabricada com vigota, que é o que "treliçada"
 *   quer dizer (a 14861 é de alveolar protendida, outra peça);
 * - **6120**, as ações para o cálculo, porque a estrutura nova nasce para
 *   receber de volta o telhado que foi desmontado.
 *
 * **A escolha é minha, e quem assina a ART é o Reginato.** Os números e os
 * títulos foram conferidos, mas norma citada em proposta é declaração técnica
 * do responsável, não redação de documento — ele confirma antes de o cliente
 * assinar.
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

const NORMAS = [
  "ABNT NBR 16280 / NBR 5674 — Reforma e gestão em edificações: organização do canteiro, proteção contra poeira nas áreas contíguas, ensacamento e destinação ambiental de entulho em caçambas licenciadas.",
  "ABNT NBR 6122 — Projeto e execução de fundações: verificação do solo de apoio, cota de assentamento e geometria das sapatas conforme a carga de cada pilar.",
  "ABNT NBR 6118 — Projeto de estruturas de concreto: cobrimento de armadura, resistência característica do concreto e detalhamento de pilares, vigas e laje.",
  "ABNT NBR 14931 — Execução de estruturas de concreto: fôrmas e escoramento, lançamento e adensamento do concreto, cura e prazos mínimos de desforma.",
  "ABNT NBR 14859-1 — Lajes pré-fabricadas de concreto: vigotas, elementos de enchimento e capeamento da laje treliçada, com escoramento até a cura.",
  "ABNT NBR 6120 — Ações para o cálculo de estruturas de edificações: a estrutura nova é dimensionada para receber de volta o telhado e o forro existentes.",
];

/**
 * As disciplinas que **não** entram, e a linha da planilha que provaria o
 * contrário. Se alguma aparecer na tabela, a escolha aqui está errada e o
 * script para antes de gravar.
 */
const NAO_ENTRAM: Array<{ disciplina: string; re: RegExp }> = [
  { disciplina: "revestimento cerâmico", re: /porcelanato|cerâmic|revestiment|rejunt|azulejo/i },
  { disciplina: "impermeabilização", re: /impermeabiliz/i },
  { disciplina: "elétrica", re: /elétric|eletric|tomada|circuito|fiaç/i },
  { disciplina: "hidrossanitária", re: /hidr|esgoto|tubulaç|louça|metais sanit/i },
];

async function main() {
  const { data: o } = await sb
    .from("orc_orcamentos")
    .select("id, cliente_nome")
    .eq("token", TOKEN)
    .maybeSingle();
  if (!o) throw new Error(`Não achei o orçamento de token ${TOKEN}.`);

  const { data: itens } = await sb
    .from("orc_itens")
    .select("descricao, grupo")
    .eq("orcamento_id", o.id);
  if (!itens?.length) throw new Error("não achei os itens.");

  console.log(`\n${o.cliente_nome} · conferindo as disciplinas do escopo\n`);
  const tudo = itens.map((i) => `${i.grupo ?? ""} ${i.descricao}`).join(" ");
  for (const d of NAO_ENTRAM) {
    const achado = itens.find((i) => d.re.test(`${i.grupo ?? ""} ${i.descricao}`));
    if (achado) {
      throw new Error(
        `a planilha tem ${d.disciplina} ("${achado.descricao.slice(0, 60)}…"),` +
          ` e a lista de normas não cita essa disciplina.`,
      );
    }
    console.log(`  sem ${d.disciplina} na planilha ✓`);
  }

  // E o contrário: o que as normas novas afirmam tem de estar lá.
  for (const [o_que, re] of [
    ["fundação", /sapata|vala|fundaç/i],
    ["concreto armado", /pilar|viga|concretagem|armaç/i],
    ["laje", /laje/i],
    ["telhado a recolocar", /telhado|telha/i],
  ] as const) {
    if (!re.test(tudo)) throw new Error(`a planilha não tem ${o_que}.`);
    console.log(`  ${o_que} na planilha ✓`);
  }

  console.log(`\n  ${NORMAS.length} normas:\n`);
  for (const n of NORMAS) console.log(`    ${n.split("—")[0].trim()}`);

  if (!GRAVAR) {
    console.log("\nNada gravado. Rode com --gravar.");
    return;
  }

  await sb.from("orc_normas").delete().eq("orcamento_id", o.id);
  const { error } = await sb.from("orc_normas").insert(
    NORMAS.map((texto, i) => ({
      orcamento_id: o.id,
      position: i + 1,
      texto,
    })),
  );
  if (error) throw new Error(`normas: ${error.message}`);

  const { data: gravadas } = await sb
    .from("orc_normas")
    .select("texto")
    .eq("orcamento_id", o.id)
    .order("position");
  if (gravadas?.length !== NORMAS.length) {
    throw new Error(`gravei ${gravadas?.length} e esperava ${NORMAS.length}.`);
  }

  console.log(`\n  ${gravadas.length} normas gravadas ✓`);
  console.log(`\nAgora republique:  npm run publicar -- ${TOKEN}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
