/**
 * Os materiais do Sr. Sousa, com quantidade levantada do escopo e preço de
 * referência de mercado.
 *
 * **Substitui a estimativa de 40% sobre a mão de obra.** O Reginato disse que
 * 40% era baixo, e o levantamento confirma: numa obra com 118 m² de
 * porcelanato, telhado colonial em 67 m² e estrutura de concreto, o material
 * passa de três quartos da mão de obra.
 *
 * **Como cada linha se forma, e o que ela não é.**
 *
 * A *quantidade* é calculada do escopo: área de parede vezes o consumo usual
 * de blocos, volume de concreto pela seção das peças, área de telhado pelo
 * número de telhas por m². São coeficientes de consumo da construção, não
 * chute.
 *
 * O *preço unitário* é de referência de mercado, de setembro de 2026, na faixa
 * média — nem a marca mais barata nem a importada. **Não é cotação de
 * fornecedor.** Nenhuma loja assinou estes valores, e é por isso que a tabela
 * do documento diz "preço de referência" e que a proposta segue preliminar: o
 * Reginato fecha com o depósito dele e os números mudam.
 *
 * As perdas estão embutidas na quantidade, não num percentual solto no fim —
 * 10% em revestimento cerâmico, que é o que o corte consome de verdade.
 *
 * Rodar com `--gravar`. Refaz a lista do zero a cada rodada.
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
const TOKEN = "sousa";

type Material = {
  grupo: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  /** Preço unitário de referência. O total da linha é quantidade × valor. */
  valor: number;
};

const G2 = "2 · Estrutura frontal da ampliação";
const G3 = "3 · Alvenarias, elevação dos muros e abertura de vão";
const G4 = "4 · Coberturas, reservatório e proteção dos muros";
const G5 = "5 · Infraestrutura elétrica e hidrossanitária";
const G6 = "6 · Aterros, concretagem e contrapisos";
const G7 = "7 · Chapisco e reboco";
const G8 = "8 · Impermeabilização";
const G9 = "9 · Pisos, revestimentos e escada";
const G10 = "10 · Preparação e pintura das paredes do térreo";
const G11 = "11 · Louças, metais, testes e conclusão";
const G12 = "12 · Fachada e muro da frente";

const MATERIAIS: Material[] = [
  // ---- 2 · Estrutura: 2 sapatas 1,20×1,20×0,40, 2 pilares 7,00 m (30×15),
  //      1 viga 6,00 m (60×15) → 2,32 m³ + perdas
  { grupo: G2, descricao: "Concreto usinado fck 25 MPa, para sapatas, pilares e viga", quantidade: 2.4, unidade: "m³", valor: 620 },
  { grupo: G2, descricao: "Aço CA-50 e CA-60, armadura das sapatas, pilares e viga", quantidade: 240, unidade: "kg", valor: 8.5 },
  { grupo: G2, descricao: "Compensado e sarrafo para fôrmas", quantidade: 25, unidade: "m²", valor: 45 },
  { grupo: G2, descricao: "Arame recozido, pregos, espaçadores e desmoldante", quantidade: 1, unidade: "conj", valor: 250 },

  // ---- 3 · Alvenaria: 69,04 m² de parede + 12,05 m² de elevação = 81,09 m²;
  //      cinta de 24,10 m (15×15)
  { grupo: G3, descricao: "Bloco cerâmico de vedação, 9 × 19 × 39 cm", quantidade: 2030, unidade: "un", valor: 1.8 },
  { grupo: G3, descricao: "Cimento CP-II 32, saco de 50 kg, argamassa de assentamento", quantidade: 13, unidade: "sc", valor: 40 },
  { grupo: G3, descricao: "Areia média lavada", quantidade: 2.5, unidade: "m³", valor: 130 },
  { grupo: G3, descricao: "Cal hidratada CH-III, saco de 20 kg", quantidade: 10, unidade: "sc", valor: 25 },
  { grupo: G3, descricao: "Concreto e aço da cinta de amarração dos muros", quantidade: 24.1, unidade: "m linear", valor: 34 },
  { grupo: G3, descricao: "Madeira da fôrma da cinta, verga e contraverga do vão de porta", quantidade: 1, unidade: "conj", valor: 500 },

  // ---- 4 · Coberturas: 51,78 + 15,00 = 66,78 m² de telhado; chapim 24,10 m
  { grupo: G4, descricao: "Telha cerâmica colonial", quantidade: 1135, unidade: "un", valor: 1.9 },
  { grupo: G4, descricao: "Madeiramento do telhado: terças, caibros e ripas", quantidade: 66.78, unidade: "m²", valor: 85 },
  { grupo: G4, descricao: "Cumeeira, pregos e parafusos de fixação", quantidade: 1, unidade: "conj", valor: 500 },
  { grupo: G4, descricao: "Caixa-d'água de 500 litros com conexões e boia", quantidade: 1, unidade: "un", valor: 550 },
  { grupo: G4, descricao: "Alvenaria, concreto, aço e cobertura do abrigo do reservatório", quantidade: 1, unidade: "conj", valor: 1800 },
  { grupo: G4, descricao: "Chapim de concreto para o topo dos muros", quantidade: 24.1, unidade: "m linear", valor: 55 },

  // ---- 5 · Instalações
  { grupo: G5, descricao: "Eletrodutos, caixas de passagem, cabos, quadro de distribuição e disjuntores", quantidade: 1, unidade: "conj", valor: 4800 },
  { grupo: G5, descricao: "Tomadas, interruptores e espelhos", quantidade: 1, unidade: "conj", valor: 1700 },
  { grupo: G5, descricao: "Tubos e conexões de PVC de água fria e esgoto, registros e adesivos", quantidade: 1, unidade: "conj", valor: 1400 },

  // ---- 6 · Aterro 27,72 m³; lastro 54,30 m²; piso 12,00 m²;
  //      contrapisos 54,30 + 66,00 + 51,78 = 172,08 m²
  { grupo: G6, descricao: "Material de aterro, posto na obra", quantidade: 27.72, unidade: "m³", valor: 75 },
  { grupo: G6, descricao: "Concreto para o lastro da garagem e o piso dos fundos", quantidade: 4.76, unidade: "m³", valor: 620 },
  { grupo: G6, descricao: "Cimento CP-II 32, saco de 50 kg, para os contrapisos", quantidade: 35, unidade: "sc", valor: 40 },
  { grupo: G6, descricao: "Areia média lavada para os contrapisos", quantidade: 9, unidade: "m³", valor: 130 },
  { grupo: G6, descricao: "Tela de aço soldada e lona plástica", quantidade: 1, unidade: "conj", valor: 900 },

  // ---- 7 · Chapisco e reboco: 292,76 m²
  { grupo: G7, descricao: "Cimento CP-II 32, saco de 50 kg, para chapisco e reboco", quantidade: 73, unidade: "sc", valor: 40 },
  { grupo: G7, descricao: "Areia média lavada", quantidade: 8.8, unidade: "m³", valor: 130 },
  { grupo: G7, descricao: "Cal hidratada CH-III, saco de 20 kg", quantidade: 44, unidade: "sc", valor: 25 },
  { grupo: G7, descricao: "Adesivo para chapisco e tela de encontro de materiais", quantidade: 1, unidade: "conj", valor: 400 },

  // ---- 8 · Impermeabilização: 2,64 m² de piso
  { grupo: G8, descricao: "Argamassa polimérica, tela de poliéster e primer", quantidade: 1, unidade: "conj", valor: 350 },

  // ---- 9 · Revestimentos: piso 117,78 m² + 10% de perda; paredes 57,07 + 10%
  { grupo: G9, descricao: "Porcelanato 80 × 80 cm para os pisos do térreo e do superior, com 10% de perda de corte", quantidade: 130, unidade: "m²", valor: 75 },
  { grupo: G9, descricao: "Revestimento cerâmico das paredes da cozinha e dos dois banheiros, com 10% de perda", quantidade: 63, unidade: "m²", valor: 70 },
  { grupo: G9, descricao: "Porcelanato dos pisos e espelhos da escada", quantidade: 10, unidade: "m²", valor: 90 },
  { grupo: G9, descricao: "Argamassa colante AC-III, saco de 20 kg", quantidade: 50, unidade: "sc", valor: 32 },
  { grupo: G9, descricao: "Rejunte acrílico, espaçadores e perfis de acabamento", quantidade: 1, unidade: "conj", valor: 1200 },

  // ---- 10 · Pintura: 146,92 m²
  { grupo: G10, descricao: "Selador acrílico, lata de 18 litros", quantidade: 3, unidade: "lata", valor: 220 },
  { grupo: G10, descricao: "Massa corrida PVA, balde de 25 kg", quantidade: 20, unidade: "balde", valor: 120 },
  { grupo: G10, descricao: "Tinta acrílica fosca, lata de 18 litros, duas demãos", quantidade: 2, unidade: "lata", valor: 350 },
  { grupo: G10, descricao: "Lixas, fita crepe, lona de proteção, rolos e pincéis", quantidade: 1, unidade: "conj", valor: 250 },

  // ---- 11 · Louças e metais do banheiro da suíte
  // Dois banheiros: o social e o da suíte. A lista anterior contemplava um só.
  // A pia comum sai — já foi encomendada —, e no lugar dela entra a bancada.
  { grupo: G11, descricao: "Vaso sanitário com caixa acoplada e assento", quantidade: 2, unidade: "un", valor: 700 },
  { grupo: G11, descricao: "Bancada em granito Verde Ubatuba, com cuba e frontão", quantidade: 2, unidade: "un", valor: 950 },
  { grupo: G11, descricao: "Chuveiro e registro de acabamento", quantidade: 2, unidade: "conj", valor: 350 },
  { grupo: G11, descricao: "Torneiras, sifões, engates flexíveis e acessórios", quantidade: 2, unidade: "conj", valor: 550 },

  // ---- 12 · Fachada: vão de 6,00 × 3,00 m = 18,00 m², em peça grande
  //      (aprox. 1,50 × 1,00 m), com 10% de perda de corte
  { grupo: G12, descricao: "Porcelanato de grande formato, aproximadamente 1,50 × 1,00 m, para o revestimento da fachada, com 10% de perda de corte", quantidade: 20, unidade: "m²", valor: 180 },
  { grupo: G12, descricao: "Argamassa colante AC-III para grandes formatos, saco de 20 kg", quantidade: 14, unidade: "sc", valor: 42 },
  { grupo: G12, descricao: "Rejunte para fachada, perfis de arremate e cantoneiras", quantidade: 1, unidade: "conj", valor: 900 },
];

const moeda = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const totalDaLinha = (m: Material) =>
  Math.round(m.quantidade * m.valor * 100) / 100;

async function main() {
  const { data: o } = await sb
    .from("orc_orcamentos")
    .select("id, cliente_nome")
    .eq("token", TOKEN)
    .maybeSingle();
  if (!o) throw new Error(`Não achei o orçamento de token ${TOKEN}.`);

  const { data: itens } = await sb
    .from("orc_itens")
    .select("grupo, total")
    .eq("orcamento_id", o.id)
    .is("removido_em", null);

  const maoDeObra = (itens ?? []).reduce((a, i) => a + Number(i.total ?? 0), 0);

  /**
   * Os 20% de imprevistos, **destrinchados por etapa** e não numa linha só no
   * fim.
   *
   * Cobrem o que a lista não enxerga: material estrutural que não fica
   * aparente, complemento da fachada e a sobra que toda obra consome. Cada
   * etapa carrega a sua parte, proporcional ao que ela custa — a etapa de
   * revestimento gera mais imprevisto que a de impermeabilização.
   *
   * Entra como linha visível, e não embutido no preço unitário: somar 20% ao
   * saco de cimento faria o documento anunciar R$ 48,00 num insumo que o
   * mercado vende a R$ 40,00, e o cliente que confere numa loja pegaria a RD
   * em contradição.
   */
  const IMPREVISTOS = 20;

  const base = [...MATERIAIS];
  const grupos = [...new Set(base.map((m) => m.grupo))];
  const comImprevistos: Material[] = [];
  for (const g of grupos) {
    const doGrupo = base.filter((m) => m.grupo === g);
    comImprevistos.push(...doGrupo);
    const sub = doGrupo.reduce((s, m) => s + totalDaLinha(m), 0);
    comImprevistos.push({
      grupo: g,
      descricao: `Imprevistos, materiais estruturais não aparentes e complementos — ${IMPREVISTOS}% sobre os materiais desta etapa`,
      quantidade: 1,
      unidade: "vb",
      valor: Math.round(sub * IMPREVISTOS) / 100,
    });
  }
  MATERIAIS.length = 0;
  MATERIAIS.push(...comImprevistos);

  let soma = 0;

  console.log(`\n${o.cliente_nome}`);
  for (const g of grupos) {
    const doGrupo = MATERIAIS.filter((m) => m.grupo === g);
    const sub = doGrupo.reduce((s, m) => s + totalDaLinha(m), 0);
    soma += sub;
    console.log(`  ${g}`);
    console.log(`     ${doGrupo.length} insumos · ${moeda(sub)}`);
  }

  console.log(`\n  materiais    ${moeda(soma)}`);
  console.log(`  mão de obra  ${moeda(maoDeObra)}`);
  console.log(`  total geral  ${moeda(maoDeObra + soma)}`);
  console.log(
    `  material sobre a mão de obra: ${((soma / maoDeObra) * 100).toFixed(1)}%`,
  );

  if (!GRAVAR) {
    console.log("\nNada gravado. Rode com --gravar.");
    return;
  }

  await sb.from("orc_materiais").delete().eq("orcamento_id", o.id);
  const { error } = await sb.from("orc_materiais").insert(
    MATERIAIS.map((m, n) => ({
      orcamento_id: o.id,
      grupo: m.grupo,
      position: n + 1,
      descricao: m.descricao,
      quantidade: m.quantidade,
      unidade: m.unidade,
      valor: m.valor,
    })),
  );
  if (error) throw new Error(error.message);

  // O percentual deixa de valer: o valor agora vem da lista, e deixar o campo
  // preenchido faria o documento anunciar "previsão de 40%" ao lado de uma
  // tabela que diz outra coisa.
  await sb
    .from("orc_orcamentos")
    .update({ material_percentual: null, updated_at: new Date().toISOString() })
    .eq("id", o.id);

  const { data: gravados } = await sb
    .from("orc_materiais")
    .select("quantidade, valor")
    .eq("orcamento_id", o.id);
  const noBanco = (gravados ?? []).reduce(
    (a, m) => a + Number(m.quantidade ?? 1) * Number(m.valor ?? 0),
    0,
  );
  if (Math.abs(noBanco - soma) > 0.01) {
    throw new Error(`soma no banco ${moeda(noBanco)} ≠ ${moeda(soma)}.`);
  }

  console.log(`\n  ${MATERIAIS.length} insumos gravados · ${moeda(noBanco)}`);
  console.log(`\nAgora republique:  npm run publicar -- ${TOKEN}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
