/**
 * Traz para o banco os dois orçamentos que nasceram como HTML escrito à mão no
 * `rd-propostas`: a Dona Fátima (áreas externas) e o Sr. Thomas (ampliação de
 * área gourmet).
 *
 * Eram arquivos estáticos: não apareciam no painel, não contavam abertura, não
 * tinham aceite e a senha era conferida no navegador. Depois deste script o
 * documento passa a sair de `/p/<token>`, e o `vercel.json` do `rd-propostas`
 * reescreve `/fatima` e `/thomas` para lá — o link curto que já foi para o
 * cliente continua valendo.
 *
 * **O token é o slug, de propósito** (`fatima`, `thomas`), como o
 * `heloneida` e o `joanioesheila`: é o que deixa a reescrita legível.
 *
 * **A Dona Fátima reusa o rascunho que já existia no painel** ("Fátima
 * Marasini", criado em 18/09/2026, sem nenhum item). Criar um segundo
 * orçamento para a mesma pessoa deixaria a lista com duas linhas dela.
 *
 * `entrada_percentual` fica **nula nos dois**, e isso é deliberado: as duas
 * obras têm parcelas desiguais — 30/40/30 na Fátima, e três de R$ 21.369,00
 * mais R$ 35.000,00 na entrega no Thomas — e o documento só sabe montar
 * entrada+final ou parcelas iguais. Com o percentual preenchido ele imprimiria
 * valores que não são os combinados. O combinado real vai por escrito em
 * `nota_custos`, abaixo do total.
 *
 * Rodar com `--gravar` para escrever. Sem a flag, só mostra o que faria.
 * Publicar é passo separado: `npm run publicar -- fatima thomas`.
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
};

type Proposta = {
  /** Token e slug da reescrita. */
  token: string;
  /** Para achar o rascunho que já existe, quando existe. */
  clienteAnterior?: string;
  cabecalho: Record<string, unknown>;
  itens: Item[];
};

// ============================================================ DONA FÁTIMA

const F1 = "1 · Estrutura e granito";
const F2 = "2 · Pintura e revestimento";
const F3 = "3 · Piscina, deck e área de lazer";
const F4 = "4 · Bancada, prateleira e entrada";

const FATIMA: Proposta = {
  token: "fatima",
  clienteAnterior: "Fátima Marasini",
  cabecalho: {
    cliente_nome: "Dona Fátima Marasini",
    objeto: "Recuperação e manutenção das áreas externas",
    senha: "Fatima2026",
    validade_dias: 20,
    valor_fechado: 69860,
    parcelas: 3,
    entrada_percentual: null,
    pagamento: "30% na entrada, 40% na medição e 30% na entrega",
    apresentacao:
      "Recuperação e manutenção completa das áreas externas da residência — tratamento das vigas, granito Verde Ubatuba, pintura das paredes e das colunas, revestimento, piscina, deck, pergolado e entrada principal. Mão de obra e material inclusos.",
    intro_custos:
      "Todos os serviços contratados estão relacionados abaixo, um por linha. O orçamento é fechado por escopo — mão de obra e material num valor único, sem preço individual por item.",
    nota_custos:
      "Mão de obra R$ 49.900,00 e material R$ 19.960,00. Pagamento: R$ 20.958,00 (30%) na entrada, para a mobilização; R$ 27.944,00 (40%) na medição; R$ 20.958,00 (30%) no saldo final, na entrega. Também aceitamos cartão de crédito em até 12x, com acréscimo de juros da máquina. Material, mão de obra, maquinário e despesas com trabalhadores inclusos; emissão de nota fiscal e ART inclusas; alteração de escopo implica reajuste do valor.",
    status: "conferindo" as const,
  },
  itens: [
    { grupo: F1, descricao: "Tratamento das vigas", quantidade: 9.53, unidade: "m linear" },
    { grupo: F1, descricao: "Retirada do granito Verde Ubatuba (19,94 m × 0,70 m)", quantidade: 13.96, unidade: "m²" },
    { grupo: F1, descricao: "Intervenção nas 13 placas de granito soltas", quantidade: 13, unidade: "placas" },
    { grupo: F1, descricao: "Regularização das superfícies após a retirada do granito", quantidade: 13.96, unidade: "m²" },
    { grupo: F1, descricao: "Demolição da laje sobre a bancada", quantidade: 1.23, unidade: "m²" },

    { grupo: F2, descricao: "Preparação e pintura das paredes — frente, piscina, superiores, entrada, fundos e lavanderia", quantidade: 239.33, unidade: "m²" },
    { grupo: F2, descricao: "Preparação e pintura das quatro colunas", quantidade: 4, unidade: "colunas" },
    { grupo: F2, descricao: "Revestimento das quatro colunas, até 3,27 m de altura", quantidade: 23.28, unidade: "m²" },
    { grupo: F2, descricao: "Pintura da parede acima do telhado dos fundos", quantidade: 1, unidade: "Serv" },
    { grupo: F2, descricao: "Preparação e pintura das paredes da caixa-d’água", quantidade: 1, unidade: "Conj" },
    { grupo: F2, descricao: "Preparação e pintura das grades das janelas (duas grades e uma oval)", quantidade: 3, unidade: "unid." },
    { grupo: F2, descricao: "Complemento de revestimento abaixo da pia, junto ao ralo", quantidade: 1, unidade: "Serv" },

    { grupo: F3, descricao: "Limpeza das pastilhas da piscina (2,10 × 2,89 m)", quantidade: 6.07, unidade: "m²" },
    { grupo: F3, descricao: "Limpeza do revestimento do deck (4,10 × 3,17 m)", quantidade: 13.0, unidade: "m²" },
    { grupo: F3, descricao: "Serviço no pergolado de madeira", quantidade: 12.43, unidade: "m²" },
    { grupo: F3, descricao: "Serviço no espaço de terra", quantidade: 26.91, unidade: "m²" },

    { grupo: F4, descricao: "Serviço na bancada da pia", quantidade: 1.17, unidade: "m²" },
    { grupo: F4, descricao: "Serviço na prateleira", quantidade: 0.78, unidade: "m²" },
    { grupo: F4, descricao: "Serviço nos degraus da entrada principal", quantidade: 3.89, unidade: "m²" },
  ],
};

// ============================================================ SR. THOMAS

const T1 = "1 · Serviços preliminares";
const T2 = "2 · Fundação, pilares, vigas e laje";
const T3 = "3 · Instalações hidrossanitárias e pluvial";
const T4 = "4 · Piso, contrapiso e impermeabilização";
const T5 = "5 · Alvenaria, churrasqueira e sóculos";
const T6 = "6 · Revestimentos, porcelanato e chapim";
const T7 = "7 · Entrega";

const THOMAS: Proposta = {
  token: "thomas",
  cabecalho: {
    cliente_nome: "Sr. Thomas",
    endereco: "Alphaville G1-04 · Eusébio/CE",
    objeto: "Ampliação de área gourmet",
    senha: "Thomas2026",
    prazo: "60 dias úteis",
    validade_dias: 20,
    valor_fechado: 99107,
    parcelas: 4,
    entrada_percentual: null,
    pagamento:
      "três parcelas de R$ 21.369,00 a cada 20 dias úteis e R$ 35.000,00 na entrega",
    apresentacao:
      "Ampliação completa da área gourmet: fundação em sapatas e viga baldrame, seis pilares, vigas e laje, alvenaria, churrasqueira nova, instalações hidrossanitárias e pluvial, impermeabilização e 99,40 m² de piso em porcelanato.",
    intro_custos:
      "Todos os serviços contratados estão relacionados abaixo, um por linha. O orçamento é fechado por escopo — mão de obra e material num valor único, sem preço individual por item.",
    nota_custos:
      "Pagamento: três parcelas de R$ 21.369,00 a cada 20 dias úteis no decorrer da obra, e R$ 35.000,00 na entrega. Mão de obra e material inclusos em todos os serviços, exceto o porcelanato e o material de assentamento, fornecidos pelo contratante — a RD executa o assentamento dos 99,40 m² e informa a quantidade a comprar, já com a perda de corte. Maquinário, andaimes, fôrmas, escoramentos e descarte de entulho inclusos; emissão de nota fiscal e ART inclusas; alteração de escopo implica reajuste do valor e do prazo.",
    status: "conferindo" as const,
  },
  itens: [
    { grupo: T1, descricao: "Retirada da grama existente, com folga para a área de trabalho", quantidade: 50.0, unidade: "m²" },
    { grupo: T1, descricao: "Escavação para as vigas baldrame", quantidade: 11.7, unidade: "m linear" },
    { grupo: T1, descricao: "Escavação das valas para as sapatas", quantidade: 6, unidade: "valas" },
    { grupo: T1, descricao: "Aterro", quantidade: 15.96, unidade: "m³" },
    { grupo: T1, descricao: "Demolição da churrasqueira existente", quantidade: 1, unidade: "unid." },
    { grupo: T1, descricao: "Demolição do balcão do deck", quantidade: 1, unidade: "unid." },
    { grupo: T1, descricao: "Retirada da bancada do deck", quantidade: 1, unidade: "unid." },
    { grupo: T1, descricao: "Retirada de uma janela do deck", quantidade: 1, unidade: "unid." },
    { grupo: T1, descricao: "Retirada do revestimento da parede do deck", quantidade: 1, unidade: "Serv" },
    { grupo: T1, descricao: "Demolição do piso cerâmico/porcelanato e do contrapiso existente", quantidade: 66.04, unidade: "m²" },
    { grupo: T1, descricao: "Retirada de entulho e descarte", quantidade: 1, unidade: "Serv" },

    { grupo: T2, descricao: "Armadura de aço CA-50 de 6 sapatas, caixarias e concretagem", quantidade: 6, unidade: "sapatas" },
    { grupo: T2, descricao: "Baldrame em tijolo argamassado, para receber a viga baldrame", quantidade: 11.6, unidade: "m linear" },
    { grupo: T2, descricao: "Armadura de aço CA-50, montagem das caixarias e concretagem das vigas baldrame", quantidade: 11.6, unidade: "m linear" },
    { grupo: T2, descricao: "Armadura de aço CA-50 de 6 pilares, fôrmas de madeira e concretagem", quantidade: 6, unidade: "pilares", observacao: "Pilares embutidos na alvenaria a ser construída." },
    { grupo: T2, descricao: "Armadura de aço CA-50 de 4 vigas de 5,20 m, fôrmas de madeira e concretagem", quantidade: 4, unidade: "vigas" },
    { grupo: T2, descricao: "Armadura de aço CA-50 de 2 vigas de 8,30 m, fôrmas de madeira e concretagem", quantidade: 2, unidade: "vigas" },
    { grupo: T2, descricao: "Armadura de aço CA-50 da viga em balanço/beiral da laje, fôrmas de madeira e concretagem", quantidade: 16.5, unidade: "m linear" },
    { grupo: T2, descricao: "Montagem da laje H8, escoramentos, fôrmas laterais, tela de aço POP 10×10 e concretagem", quantidade: 42.71, unidade: "m²" },

    { grupo: T3, descricao: "Instalação hidráulica", quantidade: 1, unidade: "Conj" },
    { grupo: T3, descricao: "Instalação de esgoto", quantidade: 1, unidade: "Conj" },
    { grupo: T3, descricao: "Instalação da tubulação de água pluvial da laje", quantidade: 1, unidade: "Conj" },

    { grupo: T4, descricao: "Compactação do solo da área construída, para receber a concretagem", quantidade: 1, unidade: "Serv" },
    { grupo: T4, descricao: "Instalação de malha de aço POP 15×15 e concretagem", quantidade: 42.71, unidade: "m²" },
    { grupo: T4, descricao: "Argamassa de regularização do piso da laje, para receber a impermeabilização", quantidade: 42.71, unidade: "m²" },
    { grupo: T4, descricao: "Contrapiso e argamassa de regularização, para receber o porcelanato", quantidade: 99.4, unidade: "m²" },
    { grupo: T4, descricao: "Aplicação de manta de impermeabilização no piso da laje", quantidade: 42.71, unidade: "m²" },

    { grupo: T5, descricao: "Construção da churrasqueira em alvenaria (2,60 × 1,20 × 0,70 m)", quantidade: 1, unidade: "unid." },
    { grupo: T5, descricao: "Construção de parede de alvenaria", quantidade: 23.71, unidade: "m²" },
    { grupo: T5, descricao: "Construção de parede de alvenaria para o balcão", quantidade: 5.18, unidade: "m²" },
    { grupo: T5, descricao: "Construção de sóculos de concreto", quantidade: 2, unidade: "unid." },

    { grupo: T6, descricao: "Correção de reboco na parede onde era o antigo deck", quantidade: 7.4, unidade: "m²" },
    { grupo: T6, descricao: "Chapisco nas paredes do balcão e no lado da churrasqueira", quantidade: 57.78, unidade: "m²" },
    { grupo: T6, descricao: "Reboco do balcão e das paredes da área da churrasqueira", quantidade: 57.78, unidade: "m²" },
    { grupo: T6, descricao: "Chapisco e reboco da platibanda", quantidade: 20.64, unidade: "m linear" },
    { grupo: T6, descricao: "Instalação de chapim de 20 cm", quantidade: 21.0, unidade: "m linear" },
    { grupo: T6, descricao: "Assentamento do piso em porcelanato", quantidade: 99.4, unidade: "m²", observacao: "Mão de obra; o porcelanato e o material de assentamento são fornecidos pelo contratante." },

    { grupo: T7, descricao: "Limpeza final, retirada e descarte de entulho", quantidade: 1, unidade: "Serv" },
  ],
};

function moeda(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function gravar(p: Proposta, orgId: string) {
  const cliente = p.cabecalho.cliente_nome as string;

  // Procura pelo token primeiro — é ele que identifica a proposta depois da
  // primeira rodada. Só então pelo nome do rascunho que já estava no painel.
  const { data: porToken } = await sb
    .from("orc_orcamentos")
    .select("id")
    .eq("org_id", orgId)
    .eq("token", p.token)
    .maybeSingle();

  let existente = porToken;
  if (!existente && p.clienteAnterior) {
    const { data } = await sb
      .from("orc_orcamentos")
      .select("id")
      .eq("org_id", orgId)
      .eq("cliente_nome", p.clienteAnterior)
      .maybeSingle();
    existente = data;
  }

  let id: string;
  if (existente) {
    id = existente.id;
    const { error } = await sb
      .from("orc_orcamentos")
      .update({ ...p.cabecalho, token: p.token })
      .eq("id", id);
    if (error) throw new Error(`${cliente}: ${error.message}`);
    await sb.from("orc_itens").delete().eq("orcamento_id", id);
    console.log(`  reusando ${id}`);
  } else {
    const { data, error } = await sb
      .from("orc_orcamentos")
      .insert({ org_id: orgId, token: p.token, ...p.cabecalho })
      .select("id")
      .single();
    if (error) throw new Error(`${cliente}: ${error.message}`);
    id = data.id;
    console.log(`  criado ${id}`);
  }

  const linhas = p.itens.map((i, n) => ({
    orcamento_id: id,
    grupo: i.grupo,
    position: n + 1,
    descricao: i.descricao,
    observacao: i.observacao ?? null,
    quantidade: i.quantidade ?? null,
    unidade: i.unidade ?? null,
    // Sem preço por item: o orçamento é de valor fechado, e inventar um preço
    // de linha para fazer a soma bater seria número que o Reginato não deu.
    valor_unitario: null,
    origem: "humano" as const,
  }));

  const { error } = await sb.from("orc_itens").insert(linhas);
  if (error) throw new Error(`${cliente} · itens: ${error.message}`);

  const { count } = await sb
    .from("orc_itens")
    .select("id", { count: "exact", head: true })
    .eq("orcamento_id", id);
  if (count !== linhas.length) {
    throw new Error(`${cliente}: gravou ${count} de ${linhas.length} linhas.`);
  }

  console.log(`  ${count} linhas · token ${p.token} · senha ${p.cabecalho.senha}`);
}

async function main() {
  const { data: org } = await sb
    .from("orgs")
    .select("id")
    .eq("nome_exibicao", "RD Engenharia")
    .maybeSingle();
  if (!org) throw new Error("Não achei a org RD Engenharia.");

  for (const p of [FATIMA, THOMAS]) {
    const grupos = [...new Set(p.itens.map((i) => i.grupo))];
    console.log(`\n${p.cabecalho.cliente_nome}`);
    console.log(
      `  ${p.itens.length} linhas em ${grupos.length} grupos · ${moeda(p.cabecalho.valor_fechado as number)}`,
    );
    if (GRAVAR) await gravar(p, org.id);
  }

  if (!GRAVAR) {
    console.log("\nNada gravado. Rode com --gravar.");
    return;
  }
  console.log("\nAgora publique:  npm run publicar -- fatima thomas");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
