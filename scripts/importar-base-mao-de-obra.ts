/**
 * A planilha de preços de mão de obra do Reginato, de 2025, para dentro do
 * Obra Nova.
 *
 * O painel sempre teve a tela de Preços e as tabelas `orc_bases_de_preco` e
 * `orc_composicoes`, e elas estavam vazias desde o começo. É aqui que esta
 * planilha mora.
 *
 * **Duas bases, não uma.** A planilha traz valor mínimo e valor máximo por
 * serviço, e o Rodrigo disse o que cada um significa na prática da RD:
 *
 * - **empresa** — o valor máximo, que é o que se cobra de empresa;
 * - **empreita** — a média entre o mínimo e o máximo, que é o que se empreita
 *   com os funcionários.
 *
 * As duas levam **+10%**, porque a planilha é de 2025 e estamos em 2026.
 *
 * O arredondamento é para o centavo, e acontece **uma vez só**, no fim: média
 * e reajuste encadeados com arredondamento no meio produzem um centavo de
 * diferença que reaparece multiplicado por 82 m² de reboco.
 *
 * Rodar com `--gravar`. Refaz as duas bases do zero.
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
const REAJUSTE = 1.1;

type Linha = {
  grupo: string;
  descricao: string;
  unidade: string;
  minimo: number;
  maximo: number;
};

const TABELA: Linha[] = [
  // ---------------------------------------------------------- Fundação
  { grupo: "Fundação", descricao: "Brocas: furar com trado manual, 20 cm de boca", unidade: "m linear", minimo: 7, maximo: 10 },
  { grupo: "Fundação", descricao: "Sapata 80 × 80 concretada, com os arranques", unidade: "un", minimo: 200, maximo: 350 },
  { grupo: "Fundação", descricao: "Viga baldrame, de 30 × 20 até 40 × 20", unidade: "m linear", minimo: 100, maximo: 180 },
  { grupo: "Fundação", descricao: "Impermeabilização da viga", unidade: "m linear", minimo: 20, maximo: 40 },

  // ----------------------------------------------------- Supraestrutura
  { grupo: "Supraestrutura", descricao: "Alvenaria de fechamento", unidade: "m²", minimo: 40, maximo: 80 },
  { grupo: "Supraestrutura", descricao: "Chapisco", unidade: "m²", minimo: 3, maximo: 5 },
  { grupo: "Supraestrutura", descricao: "Reboco aprumado", unidade: "m²", minimo: 20, maximo: 40 },
  { grupo: "Supraestrutura", descricao: "Alvenaria com pilar estrutural", unidade: "m²", minimo: 50, maximo: 100 },
  { grupo: "Supraestrutura", descricao: "Laje", unidade: "m²", minimo: 100, maximo: 150 },

  // ------------------------------------------------------------ Elétrica
  { grupo: "Elétrica", descricao: "Ponto de eletroduto, infraestrutura", unidade: "un", minimo: 20, maximo: 40 },
  { grupo: "Elétrica", descricao: "Ponto elétrico: tomada, interruptor ou lâmpada", unidade: "un", minimo: 30, maximo: 50 },
  { grupo: "Elétrica", descricao: "Quadro de disjuntor com DR e DPS, por disjuntor", unidade: "un", minimo: 20, maximo: 40 },
  { grupo: "Elétrica", descricao: "Instalação de LED, spot ou fita", unidade: "un", minimo: 20, maximo: 30 },
  { grupo: "Elétrica", descricao: "Ventilador de teto", unidade: "un", minimo: 350, maximo: 450 },
  { grupo: "Elétrica", descricao: "Chuveiro com aterramento", unidade: "un", minimo: 150, maximo: 250 },
  { grupo: "Elétrica", descricao: "Trocar lâmpada, até 3 m (máximo 5 m)", unidade: "un", minimo: 25, maximo: 50 },
  { grupo: "Elétrica", descricao: "Instalação de torneira elétrica", unidade: "un", minimo: 150, maximo: 190 },

  // ----------------------------------------------------------- Hidráulica
  { grupo: "Hidráulica", descricao: "Instalação de água pluvial, por m² de obra", unidade: "m²", minimo: 20, maximo: 40 },
  { grupo: "Hidráulica", descricao: "Instalação hidráulica, por m² de obra", unidade: "m²", minimo: 11, maximo: 20 },
  { grupo: "Hidráulica", descricao: "Instalação de esgoto, por m² de obra", unidade: "m²", minimo: 19, maximo: 37 },
  { grupo: "Hidráulica", descricao: "Hidráulica e esgoto de um banheiro", unidade: "un", minimo: 1000, maximo: 1800 },
  { grupo: "Hidráulica", descricao: "Hidráulica e esgoto de uma cozinha", unidade: "un", minimo: 500, maximo: 800 },
  { grupo: "Hidráulica", descricao: "Hidráulica e esgoto de uma lavanderia", unidade: "un", minimo: 600, maximo: 900 },
  { grupo: "Hidráulica", descricao: "Instalação de vaso sanitário de chão", unidade: "un", minimo: 300, maximo: 400 },
  { grupo: "Hidráulica", descricao: "Instalação de vaso sanitário suspenso", unidade: "un", minimo: 600, maximo: 800 },
  { grupo: "Hidráulica", descricao: "Instalação de lavatório de louça", unidade: "un", minimo: 150, maximo: 300 },
  { grupo: "Hidráulica", descricao: "Instalação de acessórios de banheiro", unidade: "kit", minimo: 150, maximo: 250 },
  { grupo: "Hidráulica", descricao: "Instalação de pia de cozinha com armário", unidade: "un", minimo: 200, maximo: 300 },
  { grupo: "Hidráulica", descricao: "Instalação de tanque", unidade: "un", minimo: 200, maximo: 400 },

  // --------------------------------------------------------- Revestimentos
  { grupo: "Revestimentos", descricao: "Contrapiso", unidade: "m²", minimo: 25, maximo: 45 },
  { grupo: "Revestimentos", descricao: "Cerâmica comum", unidade: "m²", minimo: 25, maximo: 45 },
  { grupo: "Revestimentos", descricao: "Porcelanato, conforme o tamanho da peça", unidade: "m²", minimo: 40, maximo: 180 },
  { grupo: "Revestimentos", descricao: "Rejunte resinado ou flexível", unidade: "m²", minimo: 2, maximo: 4 },
  { grupo: "Revestimentos", descricao: "Rejunte acrílico ou epóxi", unidade: "m²", minimo: 5, maximo: 8 },

  // -------------------------------------------------------------- Cobertura
  { grupo: "Cobertura", descricao: "Cobertura de telha fibrocimento", unidade: "m²", minimo: 30, maximo: 60 },
  { grupo: "Cobertura", descricao: "Cobertura de telha sanduíche", unidade: "m²", minimo: 40, maximo: 70 },
  { grupo: "Cobertura", descricao: "Cobertura de telha colonial", unidade: "m²", minimo: 80, maximo: 150 },

  // ------------------------------------------- Portas, esquadrias e vãos
  { grupo: "Portas e esquadrias", descricao: "Instalação de batente com espuma expansiva ou massa", unidade: "un", minimo: 40, maximo: 80 },
  { grupo: "Portas e esquadrias", descricao: "Instalação de porta de madeira com guarnição", unidade: "un", minimo: 100, maximo: 180 },
  { grupo: "Portas e esquadrias", descricao: "Instalação de contramarco de alumínio", unidade: "un", minimo: 30, maximo: 50 },
  { grupo: "Portas e esquadrias", descricao: "Instalação de porta ou esquadria de aço, na massa", unidade: "un", minimo: 200, maximo: 350 },
  { grupo: "Portas e esquadrias", descricao: "Instalação de porta ou esquadria de aço, na espuma", unidade: "un", minimo: 150, maximo: 250 },
  { grupo: "Portas e esquadrias", descricao: "Remover esquadria ou porta e fechar o vão", unidade: "un", minimo: 300, maximo: 450 },
  { grupo: "Portas e esquadrias", descricao: "Abrir vão de porta ou esquadria para assentar", unidade: "un", minimo: 300, maximo: 450 },

  // ---------------------------------------------------------------- Pintura
  { grupo: "Pintura", descricao: "Pintura de parede: massa mais tinta", unidade: "m²", minimo: 65, maximo: 100 },
  { grupo: "Pintura", descricao: "Pintura de teto: massa mais tinta", unidade: "m²", minimo: 65, maximo: 80 },
  { grupo: "Pintura", descricao: "Cimento queimado", unidade: "m²", minimo: 110, maximo: 150 },
  { grupo: "Pintura", descricao: "Instalação de papel de parede", unidade: "m²", minimo: 25, maximo: 35 },
  { grupo: "Pintura", descricao: "Pintura de chão", unidade: "m²", minimo: 16, maximo: 25 },
  { grupo: "Pintura", descricao: "Aplicação de massa corrida", unidade: "m²", minimo: 16, maximo: 21 },
  { grupo: "Pintura", descricao: "Aplicação de massa acrílica", unidade: "m²", minimo: 26, maximo: 37 },
  { grupo: "Pintura", descricao: "Aplicação de epóxi em piscina, duas ou três demãos", unidade: "m²", minimo: 174, maximo: 260 },
  { grupo: "Pintura", descricao: "Aplicação de tinta acrílica, duas demãos", unidade: "m²", minimo: 15, maximo: 30 },
  { grupo: "Pintura", descricao: "Aplicação de textura grossa, selar ou pintar", unidade: "m²", minimo: 26, maximo: 34 },
  { grupo: "Pintura", descricao: "Aplicação de grafiato, selar ou pintar", unidade: "m²", minimo: 35, maximo: 51 },
  { grupo: "Pintura", descricao: "Aplicação de tinta látex, duas demãos", unidade: "m²", minimo: 14, maximo: 18 },
  { grupo: "Pintura", descricao: "Pintura de portas e janelas", unidade: "un", minimo: 200, maximo: 250 },
  { grupo: "Pintura", descricao: "Pintura de porta de madeira com batente, verniz", unidade: "un", minimo: 230, maximo: 270 },

  // --------------------------------------------------------------- Diversos
  { grupo: "Diversos", descricao: "Muro", unidade: "m²", minimo: 40, maximo: 80 },
  { grupo: "Diversos", descricao: "Muro de arrimo", unidade: "m²", minimo: 150, maximo: 250 },
  { grupo: "Diversos", descricao: "Instalar portão de abrir", unidade: "un", minimo: 250, maximo: 450 },
  { grupo: "Diversos", descricao: "Fazer um banheiro novo completo", unidade: "un", minimo: 4500, maximo: 6500 },
  { grupo: "Diversos", descricao: "Colocação de gesso", unidade: "m²", minimo: 20, maximo: 30 },
  { grupo: "Diversos", descricao: "Lavagem de caixa-d'água", unidade: "un", minimo: 310, maximo: 390 },
  { grupo: "Diversos", descricao: "Lavagem de telhado com jato", unidade: "m²", minimo: 13, maximo: 21 },
  { grupo: "Diversos", descricao: "Lavagem de parede", unidade: "m²", minimo: 5, maximo: 15 },
  { grupo: "Diversos", descricao: "Lavagem de piso", unidade: "m²", minimo: 7, maximo: 10 },
  { grupo: "Diversos", descricao: "Forro em drywall", unidade: "m²", minimo: 20, maximo: 30 },
  { grupo: "Diversos", descricao: "Lavagem de calha e rufos", unidade: "m linear", minimo: 13, maximo: 25 },
  { grupo: "Diversos", descricao: "Resinar telhas, duas a três demãos, lavagem inclusa", unidade: "m²", minimo: 23, maximo: 35 },

  // -------------------------------------------------------------- Logística
  { grupo: "Logística", descricao: "Deslocamento, por quilômetro", unidade: "km", minimo: 5.2, maximo: 10.26 },

  // ---------------------------------------------- Casa completa, por m²
  { grupo: "Obra completa", descricao: "Casa básica acabada, só mão de obra", unidade: "m²", minimo: 750, maximo: 850 },
  { grupo: "Obra completa", descricao: "Casa de médio padrão acabada, só mão de obra", unidade: "m²", minimo: 750, maximo: 900 },
  { grupo: "Obra completa", descricao: "Casa de alto padrão, parte cinza, fora de condomínio", unidade: "m²", minimo: 900, maximo: 1100 },
  { grupo: "Obra completa", descricao: "Casa de alto padrão, parte cinza, dentro de condomínio", unidade: "m²", minimo: 1100, maximo: 1300 },
];

/** Arredonda uma vez só, no fim. */
const reajustado = (v: number) => Math.round(v * REAJUSTE * 100) / 100;

const BASES = [
  {
    nome: "Mão de obra · empresa (2025 + 10%)",
    descricao: "valor máximo da planilha",
    preco: (l: Linha) => reajustado(l.maximo),
  },
  {
    nome: "Mão de obra · empreita (2025 + 10%)",
    descricao: "média entre o mínimo e o máximo",
    preco: (l: Linha) => reajustado((l.minimo + l.maximo) / 2),
  },
];

const moeda = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Código estável por serviço, para o item do orçamento poder apontar de volta. */
function codigo(l: Linha, n: number) {
  const prefixo = l.grupo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 3)
    .toUpperCase();
  return `${prefixo}-${String(n + 1).padStart(3, "0")}`;
}

async function main() {
  const { data: org } = await sb
    .from("orgs")
    .select("id")
    .eq("nome_exibicao", "RD Engenharia")
    .maybeSingle();
  if (!org) throw new Error("Não achei a org RD Engenharia.");

  const grupos = [...new Set(TABELA.map((l) => l.grupo))];
  console.log(`\n${TABELA.length} serviços em ${grupos.length} disciplinas`);
  for (const g of grupos) {
    console.log(`  ${g}: ${TABELA.filter((l) => l.grupo === g).length}`);
  }

  console.log(`\nExemplos, com os ${Math.round((REAJUSTE - 1) * 100)}% de reajuste:`);
  for (const d of ["Chapisco", "Reboco aprumado", "Forro em drywall"]) {
    const l = TABELA.find((x) => x.descricao.startsWith(d))!;
    console.log(
      `  ${l.descricao} (${l.unidade}): planilha ${moeda(l.minimo)}–${moeda(l.maximo)}` +
        ` → empreita ${moeda(BASES[1].preco(l))} · empresa ${moeda(BASES[0].preco(l))}`,
    );
  }

  if (!GRAVAR) {
    console.log("\nNada gravado. Rode com --gravar.");
    return;
  }

  for (const base of BASES) {
    // Refaz do zero: a base é um retrato da planilha, e meia atualização
    // deixaria preço velho convivendo com preço novo na mesma busca.
    const { data: antiga } = await sb
      .from("orc_bases_de_preco")
      .select("id")
      .eq("org_id", org.id)
      .eq("nome", base.nome)
      .maybeSingle();
    if (antiga) {
      await sb.from("orc_composicoes").delete().eq("base_id", antiga.id);
      await sb.from("orc_bases_de_preco").delete().eq("id", antiga.id);
    }

    const { data: nova, error } = await sb
      .from("orc_bases_de_preco")
      .insert({
        org_id: org.id,
        nome: base.nome,
        fonte: "propria" as const,
        referencia: `Planilha de preços de mão de obra 2025 — ${base.descricao}, com 10% de reajuste`,
        desonerada: false,
        ativa: true,
        linhas: TABELA.length,
      })
      .select("id")
      .single();
    if (error) throw new Error(`${base.nome}: ${error.message}`);

    const { error: erroComp } = await sb.from("orc_composicoes").insert(
      TABELA.map((l, n) => ({
        base_id: nova.id,
        codigo: codigo(l, n),
        grupo: l.grupo,
        descricao: l.descricao,
        unidade: l.unidade,
        custo_unitario: base.preco(l),
      })),
    );
    if (erroComp) throw new Error(`${base.nome} · composições: ${erroComp.message}`);

    const { count } = await sb
      .from("orc_composicoes")
      .select("id", { count: "exact", head: true })
      .eq("base_id", nova.id);
    if (count !== TABELA.length) {
      throw new Error(`${base.nome}: gravou ${count} de ${TABELA.length}.`);
    }
    console.log(`\n  ${base.nome} · ${count} composições`);
  }

  console.log("\nAs duas bases estão na tela de Preços do painel.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
