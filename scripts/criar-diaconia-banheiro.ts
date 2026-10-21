/**
 * Segundo orçamento da Diaconia Shalom RG3: banheiro, pintura e guarda-roupa.
 *
 * Os valores que o Rodrigo passou foram **revistos contra o que a RD já
 * cobrou**, e não contra tabela de mercado. O mercado nacional avulso fica em
 * R$ 35 a 80 o m² de assentamento e R$ 40 a 100 o m² de impermeabilização —
 * abaixo do que a RD pratica, e não serve de âncora: aquilo é diarista, e aqui
 * há empresa, ART e responsável técnico. As referências usadas são as linhas
 * dos próprios orçamentos anteriores, de obra comparável:
 *
 * - **Gabriel Fernandes**, banheiro pequeno com box: demolição de piso
 *   cerâmico com argamassa R$ 78,62/m², remoção de revestimento de parede
 *   R$ 31,81/m², remoção no box com argamassa R$ 77,09/m²;
 * - **Erivando e Rosangela**, banheiro por m²: impermeabilização com
 *   argamassa polimérica R$ 45,00/m², assentamento de revestimento de parede
 *   R$ 95,00/m², assentamento de piso de banheiro R$ 100,00/m²;
 * - **Rafael** e **Erivando**: massa corrida R$ 38,00/m², pintura R$ 25,00/m²;
 * - **Jeová Filho**: gesso em chapa, material e mão de obra, R$ 180,00/m²;
 * - **Dona Regina**: registro com abertura e recomposição de parede,
 *   R$ 300,00 a unidade.
 *
 * **O que mudou, e por quê.**
 *
 * O grupo 3 era o erro grande. Os R$ 1.412,00 dividem-se por 54,27 m² em
 * R$ 26,02 o metro — que é o preço de pintura da casa. Ou seja, aquele valor
 * paga o item 3.4 e **mais nada**: a raspagem de massa com espátula de aço nos
 * dois quartos e o fechamento do rasgo ficaram de fora da conta. Não é
 * desconto, é omissão, e sozinha ela responde por quase toda a diferença.
 *
 * O guarda-roupa de 2,70 × 1,50 não é um painel de 4,05 m². Com laterais,
 * divisórias, tampo, fundo e prateleiras, a área desenvolvida passa de 13 m²,
 * e é sobre ela que o gesso se paga. Ao preço do Jeová dá R$ 2.363,40 — e a
 * peça da Dona Izonete, com nichos, custou R$ 3.110,00 em material e mão de
 * obra. Os R$ 1.638,00 saem a R$ 124,75 por metro desenvolvido, abaixo até da
 * parede de gesso bloco simples, que é serviço mais fácil que um móvel.
 *
 * O banheiro estava perto: R$ 3.500,00 contra R$ 3.839,59 somando linha a
 * linha pelas referências acima.
 *
 * **Nada baixou.** As duas ressalvas não são de preço, são de escopo, e por
 * isso os valores ficam de pé e o aviso vai por escrito:
 *
 * 1. a **vistoria** do item 1 pode já estar paga. O orçamento anterior desta
 *    mesma Diaconia (`diaconia-shalom`, R$ 3.220,00, que o cliente já abriu)
 *    começa por "vistoria e diagnóstico no pavimento superior: investigar a
 *    infiltração". Se for a mesma visita, esta linha sai;
 * 2. os **registros** do item 2.9 aparecem nos dois documentos, mas são
 *    serviços diferentes: lá era a troca do reparo, a peça interna; aqui é o
 *    registro inteiro, que exige abrir a parede. O documento diz isso ao
 *    cliente, para ele não ler como cobrança repetida.
 *
 * **Quantidades que faltam.** Os itens 3.1 e 3.3 não vieram medidos. Entram
 * com a área assumida escrita na própria linha — 4,05 m² na parede do
 * guarda-roupa e 13,57 m² numa face do segundo quarto —, para o Reginato
 * corrigir com a medida real. Prazo e parcelas também não vieram.
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
const TOKEN = "diaconia-shalom-banheiro";

const G1 = "1 · Vistoria técnica";
const G2 = "2 · Banheiro";
const G3 = "3 · Pintura e correção de paredes";
const G4 = "4 · Guarda-roupa de gesso";

type Item = {
  grupo: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  valor: number;
  observacao?: string;
};

/**
 * A área desenvolvida do guarda-roupa, que é o que se paga em gesso.
 * Profundidade de 0,55 m, duas divisórias e seis prateleiras — a composição
 * fica escrita aqui porque é a premissa que muda o preço.
 */
const GUARDA_ROUPA = {
  laterais: 2 * (2.7 * 0.55),
  divisorias: 2 * (2.7 * 0.55),
  tampo: 1.5 * 0.55,
  prateleiras: 6 * (0.7 * 0.55),
  fundo: 2.7 * 1.5,
};
const AREA_GUARDA_ROUPA =
  Math.round(Object.values(GUARDA_ROUPA).reduce((a, b) => a + b, 0) * 100) / 100;

const ITENS: Item[] = [
  {
    grupo: G1,
    descricao:
      "Vistoria técnica para identificar a origem da infiltração, com abertura de rasgo na parede para inspeção e definição da intervenção",
    quantidade: 1,
    unidade: "serv",
    valor: 550,
    observacao:
      "O fechamento do rasgo é executado no item 3.2, depois de confirmada a correção.",
  },

  {
    grupo: G2,
    descricao: "Retirada do box e reinstalação após os serviços",
    quantidade: 1,
    unidade: "serv",
    valor: 350,
    observacao: "O mesmo box volta ao lugar: não há compra de peça nova.",
  },
  {
    grupo: G2,
    descricao: "Retirada do vaso sanitário e reinstalação após os serviços",
    quantidade: 1,
    unidade: "serv",
    valor: 280,
    observacao: "O mesmo aparelho volta ao lugar, com vedação nova.",
  },
  {
    grupo: G2,
    descricao:
      "Demolição do piso cerâmico do banheiro e retirada da argamassa de assentamento",
    quantidade: 3.64,
    unidade: "m²",
    valor: 80,
  },
  {
    grupo: G2,
    descricao:
      "Retirada do revestimento cerâmico das paredes do banheiro, na altura de 52 cm até o box, para receber a impermeabilização",
    quantidade: 2.5,
    unidade: "m²",
    valor: 32,
  },
  {
    grupo: G2,
    descricao:
      "Retirada do revestimento cerâmico das paredes do box, na altura de 1,60 m — três fiadas de peça —, com remoção da argamassa para receber a impermeabilização",
    quantidade: 5.12,
    unidade: "m²",
    valor: 77,
    observacao:
      "Mais caro que a retirada da parede comum porque sai também a argamassa, até a alvenaria.",
  },
  {
    grupo: G2,
    descricao:
      "Aplicação de impermeabilização com argamassa polimérica Tecplus Top Quartzolit no piso e nas paredes preparadas",
    quantidade: 11.25,
    unidade: "m²",
    valor: 45,
  },
  {
    grupo: G2,
    descricao: "Assentamento do revestimento cerâmico das paredes do banheiro",
    quantidade: 7.62,
    unidade: "m²",
    valor: 95,
  },
  {
    grupo: G2,
    descricao: "Assentamento do piso cerâmico do banheiro",
    quantidade: 3.64,
    unidade: "m²",
    valor: 100,
  },
  {
    grupo: G2,
    descricao:
      "Substituição completa do registro geral do banheiro e do registro do chuveiro, com abertura e recomposição do trecho de parede",
    quantidade: 2,
    unidade: "un",
    valor: 300,
    observacao:
      "Serviço diferente do orçamento anterior: lá foi trocado o reparo, a peça interna; aqui sai o registro inteiro, o que exige abrir a parede.",
  },
  {
    grupo: G2,
    descricao: "Limpeza pós-obra do banheiro e descarte de entulho",
    quantidade: 1,
    unidade: "serv",
    valor: 250,
  },

  {
    grupo: G3,
    descricao:
      "Primeiro quarto, parede do guarda-roupa: retirada parcial da massa corrida com espátula de aço para correção do fundo, aplicação de massa corrida e pintura",
    quantidade: 4.05,
    unidade: "m²",
    valor: 90,
    observacao:
      "Área assumida: a face de 2,70 × 1,50 m que o guarda-roupa cobre. A medida real confirma a linha.",
  },
  {
    grupo: G3,
    descricao:
      "Fechamento do rasgo aberto na vistoria, com gesso, aplicação de massa corrida e pintura",
    quantidade: 1,
    unidade: "serv",
    valor: 280,
  },
  {
    grupo: G3,
    descricao:
      "Segundo quarto, parede com infiltração aparente: retirada parcial da massa corrida com espátula de aço e aplicação de massa corrida",
    quantidade: 13.57,
    unidade: "m²",
    valor: 65,
    observacao:
      "Área assumida: uma face do segundo quarto, um quarto dos 54,27 m². A medida real confirma a linha.",
  },
  {
    grupo: G3,
    descricao: "Pintura das paredes do segundo quarto",
    quantidade: 54.27,
    unidade: "m²",
    valor: 25,
  },

  {
    grupo: G4,
    descricao:
      "Montagem de guarda-roupa de gesso de 2,70 m de altura por 1,50 m de largura, sem portas, com laterais, divisórias, tampo, fundo e prateleiras — material e mão de obra inclusos",
    quantidade: AREA_GUARDA_ROUPA,
    unidade: "m²",
    valor: 180,
    observacao:
      "Medido pela área desenvolvida, e não pela frente de 4,05 m²: laterais, divisórias, tampo, fundo e seis prateleiras, com 0,55 m de profundidade. Único item deste orçamento com material incluído.",
  },
];

/** O que o Rodrigo passou, por grupo, para o script mostrar a diferença. */
const ORIGINAL: Record<string, number> = { [G1]: 550, [G2]: 3500, [G3]: 1412, [G4]: 1638 };

const CABECALHO = {
  cliente_nome: "Diaconia Shalom RG3",
  objeto: "Reforma de banheiro, pintura e guarda-roupa de gesso",
  senha: "Shalom2026",
  validade_dias: 20,
  // Nulo: todas as linhas têm preço, e o total é a soma da tabela.
  valor_fechado: null,
  // Nulos de propósito: prazo e divisão de parcelas não vieram, e inventar
  // percentual num documento de assinar é pior que deixar por escrito.
  prazo: null,
  entrada_percentual: null,
  parcelas: 2,
  pagamento:
    "entrada na aprovação e saldo na conclusão, no mesmo desenho da proposta anterior — a confirmar com a Diaconia",
  marca: "rd",
  apresentacao:
    "Correção da infiltração identificada em vistoria, reforma do banheiro com impermeabilização e revestimento novos, pintura e correção das paredes dos dois quartos, e montagem de um guarda-roupa de gesso no primeiro quarto. Os serviços são de mão de obra, com exceção do guarda-roupa, que sai com material incluído.",
  intro_custos:
    "Os serviços estão item a item, na ordem de execução, com quantidade e preço de cada um. Só o guarda-roupa de gesso traz material incluído; nos demais, o material fica por conta da contratante.",
  nota_custos:
    "Somente mão de obra, exceto o guarda-roupa de gesso, que sai com material e mão de obra. Os preços seguem o que a RD praticou em obras comparáveis, e não estimativa de tabela. Duas áreas entram assumidas e estão marcadas na própria linha: a parede do guarda-roupa, no item 3.1, e a face do segundo quarto, no item 3.3 — a medição em obra confirma as duas. A substituição dos registros não repete o orçamento anterior: lá foi trocado o reparo interno, aqui sai o registro inteiro. Prazo e divisão das parcelas serão definidos com a Diaconia.",
};

type Secao = { tipo: "projeto" | "observacao" | "etapa"; titulo: string; texto: string };

const SECOES: Secao[] = [
  {
    tipo: "projeto",
    titulo: "Diagnóstico · Achar a origem antes de fechar",
    texto:
      "A parede é aberta num rasgo para a vistoria confirmar de onde vem a água. Só depois de identificada e corrigida a origem é que o rasgo se fecha e a parede recebe massa e pintura — fechar antes seria esconder o problema atrás do acabamento novo.",
  },
  {
    tipo: "projeto",
    titulo: "Banheiro · Impermeabilizar antes de revestir",
    texto:
      "O piso e as faixas de parede atingidas saem até a alvenaria, levando junto a argamassa de assentamento. A superfície limpa recebe argamassa polimérica Tecplus Top no piso e nas paredes, e só sobre ela volta o revestimento cerâmico. O box e o vaso sanitário são retirados antes e recolocados no fim.",
  },
  {
    tipo: "projeto",
    titulo: "Registros · Troca da peça inteira",
    texto:
      "O registro geral do banheiro e o do chuveiro são substituídos por completo, e não só no reparo interno. A troca exige abrir o trecho de parede e recompô-lo depois, e é por isso que acontece junto com a reforma do banheiro, enquanto o revestimento ainda está fora.",
  },
  {
    tipo: "projeto",
    titulo: "Quartos · Raspar o fundo antes de pintar",
    texto:
      "Nas paredes atingidas pela umidade a massa corrida antiga é raspada com espátula de aço até o fundo firme. Massa nova sobre fundo solto descasca de novo em pouco tempo, e o serviço voltaria inteiro.",
  },
  {
    tipo: "projeto",
    titulo: "Primeiro quarto · Guarda-roupa de gesso",
    texto:
      "Montagem de um guarda-roupa de 2,70 m de altura por 1,50 m de largura, sem portas, com laterais, divisórias, tampo, fundo e prateleiras. É o único item do orçamento que já vem com o material.",
  },

  {
    tipo: "observacao",
    titulo: "Duas medidas ainda por confirmar",
    texto:
      "A raspagem e o emassamento do item 3.1 e do item 3.3 entram com a área assumida escrita na linha — 4,05 m² na parede do guarda-roupa e 13,57 m² numa face do segundo quarto. A medição em obra confirma as duas antes do início, e qualquer diferença é ajustada por escrito.",
  },
  {
    tipo: "observacao",
    titulo: "Os registros não são cobrança repetida",
    texto:
      "A proposta anterior incluía a troca do reparo dos registros — a peça interna, sem abrir parede. Como a infiltração persistiu, agora sai o registro inteiro, serviço diferente e mais extenso. São duas intervenções distintas, não a mesma duas vezes.",
  },
  {
    tipo: "observacao",
    titulo: "O guarda-roupa sem portas",
    texto:
      "O valor cobre a estrutura em gesso com prateleiras e divisórias, montada no lugar, com material incluído. Portas, puxadores e pintura de acabamento do móvel não estão neste preço.",
  },
  {
    tipo: "observacao",
    titulo: "Material por conta da contratante",
    texto:
      "Fora o guarda-roupa, os valores são de mão de obra. Revestimento cerâmico, argamassa, rejunte, impermeabilizante, registros, massa e tinta ficam por conta da Diaconia, conforme a especificação e a programação acordadas com a RD.",
  },

  {
    tipo: "etapa",
    titulo: "Aprovação e programação",
    texto:
      "Você aprova a proposta e combinamos a data de início, as condições de pagamento e a compra dos materiais.",
  },
  {
    tipo: "etapa",
    titulo: "Banheiro: demolição e impermeabilização",
    texto:
      "Retirada do box e do vaso, demolição do piso e das faixas de revestimento, troca dos registros e aplicação da impermeabilização.",
  },
  {
    tipo: "etapa",
    titulo: "Banheiro: revestimento e recolocação",
    texto:
      "Assentamento do piso e do revestimento das paredes, recolocação do box e do vaso sanitário, e limpeza.",
  },
  {
    tipo: "etapa",
    titulo: "Quartos: correção, pintura e guarda-roupa",
    texto:
      "Fechamento do rasgo, raspagem e emassamento das paredes atingidas, pintura do segundo quarto e montagem do guarda-roupa de gesso.",
  },
];

/**
 * As normas das disciplinas que existem nesta obra, e só elas.
 *
 * Fica de fora a NBR 5410, de instalação elétrica, que o Perfil cita e esta
 * obra não tem. Entram as de reforma, revestimento, impermeabilização e
 * hidrossanitária, que o escopo usa de fato, mais a de gesso em chapa, pelo
 * guarda-roupa.
 */
const NORMAS = [
  "ABNT NBR 16280 / NBR 5674 — Reforma e gestão em edificações: organização do canteiro, proteção contra poeira nas áreas contíguas, ensacamento e destinação ambiental de entulho em caçambas licenciadas.",
  "ABNT NBR 9575 / NBR 9574 — Impermeabilização: argamassa polimérica aplicada em demãos cruzadas sobre substrato preparado, com reforço nos cantos e teste de estanqueidade antes do revestimento.",
  "ABNT NBR 13753 / NBR 13754 — Revestimento de pisos e paredes com placas cerâmicas: assentamento com argamassa colante, juntas de dilatação e rejunte impermeabilizado.",
  "ABNT NBR 5626 / NBR 8160 — Instalações hidrossanitárias: substituição de registros em tubulação soldável de PVC, com teste de pressão e verificação de vazamentos antes do fechamento da parede.",
  "ABNT NBR 15758 — Sistemas construtivos em chapas de gesso: montagem da estrutura, fixação das chapas e tratamento de juntas do guarda-roupa.",
];

const moeda = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const totalDaLinha = (i: Item) => Math.round(i.quantidade * i.valor * 100) / 100;

async function main() {
  if (Math.abs(AREA_GUARDA_ROUPA - 13.13) > 0.01) {
    throw new Error(`a área desenvolvida deu ${AREA_GUARDA_ROUPA} e eu contava 13,13 m².`);
  }

  const grupos = [...new Set(ITENS.map((i) => i.grupo))];
  let total = 0;

  console.log(`\nDiaconia Shalom RG3 · revisão dos valores\n`);
  for (const g of grupos) {
    const doGrupo = ITENS.filter((i) => i.grupo === g);
    const sub = Math.round(doGrupo.reduce((s, i) => s + totalDaLinha(i), 0) * 100) / 100;
    total += sub;
    for (const i of doGrupo) {
      console.log(
        `  ${String(i.quantidade).padStart(7)} ${i.unidade.padEnd(5)}` +
          ` × ${moeda(i.valor).padStart(9)} = ${moeda(totalDaLinha(i)).padStart(11)}` +
          `  ${i.descricao.slice(0, 54)}…`,
      );
    }
    const antes = ORIGINAL[g];
    const d = Math.round((sub - antes) * 100) / 100;
    console.log(
      `  ${g} — ${moeda(sub)}  ·  passado ${moeda(antes)}  ·  ${d >= 0 ? "+" : ""}${moeda(d)}` +
        ` (${d >= 0 ? "+" : ""}${((d / antes) * 100).toFixed(1)}%)\n`,
    );
  }
  total = Math.round(total * 100) / 100;

  const antesTotal = Object.values(ORIGINAL).reduce((a, b) => a + b, 0);
  console.log(`  TOTAL ${moeda(total)}  ·  passado ${moeda(antesTotal)}` +
    `  ·  +${moeda(total - antesTotal)} (+${(((total - antesTotal) / antesTotal) * 100).toFixed(1)}%)`);
  console.log(`\n  ${ITENS.length} itens · ${SECOES.length} seções · ${NORMAS.length} normas`);

  if (!GRAVAR) {
    console.log("\nNada gravado. Rode com --gravar.");
    return;
  }

  const { data: existente } = await sb
    .from("orc_orcamentos")
    .select("id")
    .eq("token", TOKEN)
    .maybeSingle();

  let id: string;
  if (existente) {
    id = existente.id;
    await sb.from("orc_orcamentos").update(CABECALHO).eq("id", id);
    await sb.from("orc_itens").delete().eq("orcamento_id", id);
    await sb.from("orc_secoes").delete().eq("orcamento_id", id);
    await sb.from("orc_normas").delete().eq("orcamento_id", id);
    console.log(`\n  atualizado ${id}`);
  } else {
    const { data, error } = await sb
      .from("orc_orcamentos")
      .insert({ org_id: ORG, token: TOKEN, ...CABECALHO })
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
      quantidade: i.quantidade,
      unidade: i.unidade,
      valor_unitario: i.valor,
      origem: "humano" as const,
    })),
  );
  if (erroItens) throw new Error(`itens: ${erroItens.message}`);

  const porTipo = { projeto: 0, observacao: 0, etapa: 0 };
  let pos = 0;
  const { error: erroSecoes } = await sb.from("orc_secoes").insert(
    SECOES.map((s) => {
      porTipo[s.tipo] += 1;
      return {
        orcamento_id: id,
        tipo: s.tipo,
        position: ++pos,
        titulo: s.titulo,
        texto: s.texto,
        origem: "humano" as const,
      };
    }),
  );
  if (erroSecoes) throw new Error(`seções: ${erroSecoes.message}`);

  const { error: erroNormas } = await sb.from("orc_normas").insert(
    NORMAS.map((texto, i) => ({ orcamento_id: id, position: i + 1, texto })),
  );
  if (erroNormas) throw new Error(`normas: ${erroNormas.message}`);

  const { data: gravados } = await sb
    .from("orc_itens")
    .select("total")
    .eq("orcamento_id", id);
  const noBanco =
    Math.round((gravados ?? []).reduce((s, l) => s + Number(l.total ?? 0), 0) * 100) / 100;
  if (Math.abs(noBanco - total) > 0.01) {
    throw new Error(`soma no banco ${moeda(noBanco)} ≠ ${moeda(total)}.`);
  }

  console.log(`  ${ITENS.length} itens · soma no banco ${moeda(noBanco)} ✓`);
  console.log(`  ${porTipo.projeto} cards · ${porTipo.observacao} observações · ${porTipo.etapa} etapas`);
  console.log(`\nAgora publique:  npm run publicar -- ${TOKEN}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
