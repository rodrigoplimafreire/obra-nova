/**
 * Cria o orçamento da Sra. Juliana na org RD Engenharia.
 *
 * Mesma forma do Joanio/Sheila: o documento traz **valor por bloco** de
 * serviço, então cada bloco é um item com o seu valor e o escopo detalhado
 * fica na observação da linha.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(URL, CHAVE, { auth: { persistSession: false } });

const GRAVAR = process.argv.includes("--gravar");

const ITENS = [
  {
    descricao: "Closet e banheiro",
    valor: 5900,
    observacao:
      "Remoção da janela do banheiro em esquadria de alumínio (0,49 × 1,00 m) · remoção da janela do quarto em esquadria de alumínio (1,19 × 1,70 m) · demolição parcial de meia parede do quarto, na parte da janela, para abrir um vão de porta de 2,10 × 0,65 m · fechamento de 1,20 m² de alvenaria no vão da janela, com acabamento de reboco · nicho no espaço da janela do banheiro (1,00 × 0,49 m) · abertura do vão e instalação de janela basculante no banheiro · parede de gesso drywall de 6,25 m² · ponto de luz no teto do closet e interruptor · 14,73 m² de massa corrida nas paredes do closet — como as paredes têm grafiato, são duas demãos de gesso liso e duas de massa corrida para o acabamento final · 25,20 m² de selador nas paredes e forro · 25,20 m² de pintura de paredes e forro · grafiato na parede do lado da varanda, na mesma cor da existente · retirada de entulho e limpeza pós-obra.",
  },
  {
    descricao: "Construção do deck",
    valor: 26146,
    observacao:
      "Retirada do revestimento em pedra Cariri na área do chuveiro · limpeza e regularização do solo, com retirada da grama existente · instalações hidrossanitárias e elétricas do deck · 21,55 m² de piso em concreto armado — lastro tipo radier com malha de ferro pop 10×10, fundação mais rápida · 15,58 m² de alvenaria para complemento do muro onde vai a cobertura, rebocado e com chapim · 27,88 m² de cobertura em telha sanduíche com fundo amadeirado e estrutura metálica preta · churrasqueira de 2,60 × 0,70 × 0,80 m em tijolo maciço vermelho por fora e refratário por dentro · retirada de 24,46 m² de textura da parede do lado do deck · 24,46 m² de revestimento em porcelanato 80×80 na parede do deck · 19,11 m² de piso em porcelanato 80×80 · mureta de tijolo maciço vermelho/concreto na divisa do trilho do portão · área de chuveiro de 1,20 × 1,20 × 2,10 m, com piso de concreto e parede revestida (revestimento a escolher) · bancada de granito de 2,00 × 0,60 m com cuba embutida, bancada de 1,90 × 0,60 m e bancada de apoio na churrasqueira · limpeza pós-obra e retirada de entulho.",
  },
  {
    descricao: "Lavabo",
    valor: 7500,
    observacao:
      "9,36 m² de alvenaria do lavabo e laje de cobertura · 18,72 m² de chapisco e reboco · instalações hidrossanitárias · 12,48 m² de revestimento em porcelanato interno · 1,44 m² de piso em porcelanato · 9,36 m² de revestimento em porcelanato nas paredes externas · instalação de vaso sanitário, pia e acessórios · instalação de porta de 2,10 × 0,60 m · limpeza pós-obra e descarte de entulho.",
  },
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
  observacoes: null,
  valor_fechado: null,
  intro_custos:
    "Cada linha é uma frente de trabalho, com o escopo detalhado abaixo do título. Os valores são de mão de obra.",
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

  const soma = ITENS.reduce((s, i) => s + i.valor, 0);
  console.log(`\n${CABECALHO.cliente_nome}`);
  console.log(`  ${ITENS.length} blocos · soma ${moeda(soma)}`);
  console.log(`  ${CABECALHO.parcelas}× · prazo ${CABECALHO.prazo}`);
  for (const i of ITENS) console.log(`    ${i.descricao} — ${moeda(i.valor)}`);

  if (!GRAVAR) {
    console.log("\nNada gravado. Rode com --gravar.");
    return;
  }

  const { data: existe } = await sb
    .from("orc_orcamentos")
    .select("id")
    .eq("org_id", org.id)
    .eq("cliente_nome", CABECALHO.cliente_nome)
    .maybeSingle();
  if (existe) {
    console.log(`  já existe (${existe.id}) — nada feito.`);
    return;
  }

  const { data: orc, error } = await sb
    .from("orc_orcamentos")
    .insert({ org_id: org.id, ...CABECALHO })
    .select("id, token")
    .single();
  if (error) throw new Error(error.message);

  const linhas = ITENS.map((i, n) => ({
    orcamento_id: orc.id,
    grupo: null,
    position: n + 1,
    descricao: i.descricao,
    observacao: i.observacao,
    quantidade: 1,
    unidade: "vb",
    valor_unitario: i.valor,
    origem: "humano" as const,
  }));

  const { error: erroItens } = await sb.from("orc_itens").insert(linhas);
  if (erroItens) {
    await sb.from("orc_orcamentos").delete().eq("id", orc.id);
    throw new Error(`itens: ${erroItens.message}`);
  }

  // Confere o que ficou no banco. Um centavo de deriva num numeric(12,2) passa
  // despercebido aqui e aparece na tabela que a cliente recebe.
  const { data: gravados } = await sb
    .from("orc_itens")
    .select("total")
    .eq("orcamento_id", orc.id);
  const noBanco = (gravados ?? []).reduce((s, l) => s + Number(l.total ?? 0), 0);
  if (Math.abs(noBanco - soma) > 0.01) {
    await sb.from("orc_orcamentos").delete().eq("id", orc.id);
    throw new Error(
      `soma no banco ${moeda(noBanco)} ≠ ${moeda(soma)}. Nada mantido.`,
    );
  }

  console.log(`\n  gravado ${orc.id} · token ${orc.token}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
