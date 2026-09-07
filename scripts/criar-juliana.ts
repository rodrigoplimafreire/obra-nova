/**
 * Monta (e remonta) os itens do orçamento da Sra. Juliana.
 *
 * **Item por item, como o Reginato escreveu.** A primeira versão juntou cada
 * bloco numa linha só, com o escopo espremido na observação — a cliente abria
 * a tabela e via três linhas gigantes. Agora cada serviço numerado é uma linha
 * da tabela, agrupada pelo bloco, e o bloco fecha com a sua linha de "Valor da
 * mão de obra". É a forma do documento original: o cliente lê o que vai ser
 * feito e vê o preço de cada frente.
 *
 * Só os fechamentos de bloco têm valor; as linhas de escopo saem com "—",
 * porque o orçamento não tem preço por serviço e inventar um seria mentira.
 *
 * Rodar com `--gravar` para escrever. Se o orçamento já existir, os itens são
 * substituídos — o orçamento, o token e a senha continuam os mesmos, para o
 * link que já foi para a cliente não morrer.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(URL, CHAVE, { auth: { persistSession: false } });

const GRAVAR = process.argv.includes("--gravar");

type Item = {
  grupo: string;
  descricao: string;
  quantidade?: number | null;
  unidade?: string | null;
  observacao?: string | null;
  /** Só as linhas de fechamento de bloco têm valor. */
  valor?: number | null;
};

const G1 = "1 · Closet e banheiro";
const G2 = "2 · Construção do deck";
const G3 = "3 · Lavabo";

const ITENS: Item[] = [
  // ---------- 1 · Closet e banheiro ----------
  {
    grupo: G1,
    descricao:
      "Remoção de uma janela do banheiro, em esquadria de alumínio (0,49 × 1,00 m)",
  },
  {
    grupo: G1,
    descricao:
      "Remoção de uma janela do quarto, em esquadria de alumínio (1,19 × 1,70 m)",
  },
  {
    grupo: G1,
    descricao:
      "Demolição parcial de meia parede do quarto, na parte da janela existente, para abrir um vão de porta de 2,10 × 0,65 m",
  },
  {
    grupo: G1,
    descricao: "Fechamento de alvenaria do vão da janela, com acabamento de reboco",
    quantidade: 1.2,
    unidade: "m²",
  },
  {
    grupo: G1,
    descricao: "Nicho no espaço da janela do banheiro (1,00 × 0,49 m)",
  },
  {
    grupo: G1,
    descricao:
      "Abertura do vão e instalação de janela basculante no banheiro",
  },
  {
    grupo: G1,
    descricao: "Parede de gesso drywall",
    quantidade: 6.25,
    unidade: "m²",
  },
  {
    grupo: G1,
    descricao: "Ponto de luz no teto do closet e interruptor",
  },
  {
    grupo: G1,
    descricao: "Massa corrida nas paredes do closet",
    quantidade: 14.73,
    unidade: "m²",
    observacao:
      "As paredes têm grafiato: são necessárias duas demãos de gesso liso e duas de massa corrida para o acabamento final.",
  },
  {
    grupo: G1,
    descricao: "Selador nas paredes e no forro do closet",
    quantidade: 25.2,
    unidade: "m²",
  },
  {
    grupo: G1,
    descricao: "Pintura das paredes e do forro do closet",
    quantidade: 25.2,
    unidade: "m²",
  },
  {
    grupo: G1,
    descricao:
      "Grafiato na parede do closet do lado da varanda, na mesma cor da existente",
  },
  { grupo: G1, descricao: "Retirada de entulho e limpeza pós-obra" },
  { grupo: G1, descricao: "Valor da mão de obra", valor: 5900 },

  // ---------- 2 · Construção do deck ----------
  {
    grupo: G2,
    descricao: "Retirada do revestimento em pedra Cariri na área do chuveiro",
  },
  {
    grupo: G2,
    descricao:
      "Limpeza e regularização do solo, com retirada da grama existente",
  },
  { grupo: G2, descricao: "Instalações hidrossanitárias e elétricas do deck" },
  {
    grupo: G2,
    descricao: "Piso em concreto armado do deck",
    quantidade: 21.55,
    unidade: "m²",
    observacao:
      "Lastro de concreto do tipo radier, com malha de ferro pop 10×10 — fundação mais rápida.",
  },
  {
    grupo: G2,
    descricao:
      "Alvenaria para complemento do muro onde fica a cobertura do deck, rebocada e com chapim",
    quantidade: 15.58,
    unidade: "m²",
  },
  {
    grupo: G2,
    descricao:
      "Cobertura em telha sanduíche com fundo amadeirado e estrutura metálica na cor preta",
    quantidade: 27.88,
    unidade: "m²",
  },
  {
    grupo: G2,
    descricao:
      "Churrasqueira de 2,60 × 0,70 × 0,80 m, em tijolo maciço vermelho por fora e revestida com tijolo refratário por dentro",
  },
  {
    grupo: G2,
    descricao: "Retirada da textura da parede do lado do deck",
    quantidade: 24.46,
    unidade: "m²",
  },
  {
    grupo: G2,
    descricao: "Revestimento em porcelanato 80×80 na parede do deck",
    quantidade: 24.46,
    unidade: "m²",
  },
  {
    grupo: G2,
    descricao: "Assentamento de piso em porcelanato 80×80 no deck",
    quantidade: 19.11,
    unidade: "m²",
  },
  {
    grupo: G2,
    descricao:
      "Mureta de tijolo maciço vermelho/concreto na divisa do trilho do portão",
  },
  {
    grupo: G2,
    descricao:
      "Área para chuveiro de 1,20 × 1,20 × 2,10 m, com piso de concreto e parede revestida",
    observacao: "Revestimento a escolher.",
  },
  {
    grupo: G2,
    descricao:
      "Bancada de granito de 2,00 × 0,60 m com cuba embutida, bancada de 1,90 × 0,60 m e bancada de apoio na churrasqueira",
  },
  { grupo: G2, descricao: "Limpeza pós-obra e retirada de entulho" },
  { grupo: G2, descricao: "Valor da mão de obra", valor: 26146 },

  // ---------- 3 · Lavabo ----------
  {
    grupo: G3,
    descricao: "Alvenaria do lavabo e laje de cobertura",
    quantidade: 9.36,
    unidade: "m²",
  },
  {
    grupo: G3,
    descricao: "Chapisco e reboco do lavabo",
    quantidade: 18.72,
    unidade: "m²",
  },
  { grupo: G3, descricao: "Instalações hidrossanitárias do lavabo" },
  {
    grupo: G3,
    descricao: "Revestimento em porcelanato do lavabo",
    quantidade: 12.48,
    unidade: "m²",
  },
  {
    grupo: G3,
    descricao: "Piso em porcelanato do lavabo",
    quantidade: 1.44,
    unidade: "m²",
  },
  {
    grupo: G3,
    descricao: "Revestimento em porcelanato das paredes externas do lavabo",
    quantidade: 9.36,
    unidade: "m²",
  },
  {
    grupo: G3,
    descricao: "Instalação de vaso sanitário, pia e acessórios do lavabo",
  },
  { grupo: G3, descricao: "Instalação de porta de 2,10 × 0,60 m do lavabo" },
  { grupo: G3, descricao: "Limpeza pós-obra e descarte de entulho" },
  { grupo: G3, descricao: "Valor da mão de obra", valor: 7500 },
];

const CABECALHO = {
  cliente_nome: "Sra. Juliana",
  endereco: "Rua Jatobá, nº 61 · Cajazeiras · Fortaleza/CE",
  objeto: "Ampliação de quarto, closet, deck e lavabo",
  senha: "Juliana2026",
  prazo: "35 dias úteis",
  // Acima de duas parcelas o documento divide em partes iguais; a entrada só
  // é lida quando são duas. Fica gravada para não deixar o campo vazio.
  entrada_percentual: 33.33,
  parcelas: 3,
  pagamento: "a primeira no início da obra e as demais a cada 12 dias úteis",
  intro_custos:
    "O escopo está separado por frente de trabalho, serviço por serviço. Cada frente fecha com o seu valor de mão de obra.",
  // As linhas de escopo não têm preço próprio — o preço é por frente —, e o
  // documento se recusa a publicar item sem preço enquanto não houver um valor
  // fechado. Ele é a soma das três frentes, não um número à parte.
  valor_fechado: 39546,
  nota_custos:
    "Cada frente de trabalho tem o seu valor de mão de obra; o total acima é a soma das três. Alteração de escopo implica reajuste do valor.",
  status: "conferindo" as const,
};

function moeda(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function main() {
  const { data: org } = await sb
    .from("orgs")
    .select("id")
    .eq("nome_exibicao", "RD Engenharia")
    .maybeSingle();
  if (!org) throw new Error("Não achei a org RD Engenharia.");

  const soma = ITENS.reduce((s, i) => s + (i.valor ?? 0), 0);
  const grupos = [...new Set(ITENS.map((i) => i.grupo))];

  console.log(`\n${CABECALHO.cliente_nome}`);
  console.log(`  ${ITENS.length} linhas em ${grupos.length} frentes`);
  for (const g of grupos) {
    const doGrupo = ITENS.filter((i) => i.grupo === g);
    const fechamento = doGrupo.find((i) => i.valor != null);
    console.log(
      `    ${g} — ${doGrupo.length - 1} serviços · ${moeda(fechamento!.valor!)}`,
    );
  }
  console.log(`  total ${moeda(soma)}`);

  if (!GRAVAR) {
    console.log("\nNada gravado. Rode com --gravar.");
    return;
  }

  const { data: existe } = await sb
    .from("orc_orcamentos")
    .select("id, token")
    .eq("org_id", org.id)
    .eq("cliente_nome", CABECALHO.cliente_nome)
    .maybeSingle();

  let id: string;
  let token: string;

  if (existe) {
    // Substitui os itens sem tocar no orçamento: o token está no link que a
    // cliente pode já ter, e trocá-lo seria quebrar o endereço dela.
    id = existe.id;
    token = existe.token;
    const { error } = await sb
      .from("orc_orcamentos")
      .update(CABECALHO)
      .eq("id", id);
    if (error) throw new Error(error.message);
    await sb.from("orc_itens").delete().eq("orcamento_id", id);
    console.log(`\n  reescrevendo os itens de ${id}`);
  } else {
    const { data: orc, error } = await sb
      .from("orc_orcamentos")
      .insert({ org_id: org.id, ...CABECALHO })
      .select("id, token")
      .single();
    if (error) throw new Error(error.message);
    id = orc.id;
    token = orc.token;
  }

  const linhas = ITENS.map((i, n) => ({
    orcamento_id: id,
    grupo: i.grupo,
    position: n + 1,
    descricao: i.descricao,
    observacao: i.observacao ?? null,
    // `orc_itens.total` é coluna gerada (quantidade × valor_unitario): sem
    // quantidade o valor da linha vira nulo e a soma do documento dá zero.
    // As linhas de fechamento entram como uma verba.
    quantidade: i.valor != null ? 1 : (i.quantidade ?? null),
    unidade: i.valor != null ? "vb" : (i.unidade ?? null),
    valor_unitario: i.valor ?? null,
    origem: "humano" as const,
  }));

  const { error: erroItens } = await sb.from("orc_itens").insert(linhas);
  if (erroItens) throw new Error(`itens: ${erroItens.message}`);

  // Confere o que ficou no banco. Um centavo de deriva num numeric(12,2) passa
  // despercebido aqui e aparece na tabela que a cliente recebe.
  const { data: gravados } = await sb
    .from("orc_itens")
    .select("total")
    .eq("orcamento_id", id);
  const noBanco = (gravados ?? []).reduce((s, l) => s + Number(l.total ?? 0), 0);
  if (Math.abs(noBanco - soma) > 0.01) {
    throw new Error(
      `soma no banco ${moeda(noBanco)} ≠ ${moeda(soma)}. Confira antes de publicar.`,
    );
  }

  console.log(`  ${linhas.length} linhas gravadas · ${id} · token ${token}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
