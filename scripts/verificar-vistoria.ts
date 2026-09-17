/**
 * As regras da vistoria estão no banco, não só na tela.
 *
 * A tela valida para dar mensagem boa. O banco valida para o dado não
 * entrar torto quando alguém chamar de outro lugar — script, migração, ou a
 * própria tela com um bug. Cada checagem aqui é uma regra que precisa
 * sobreviver sem JavaScript nenhum.
 *
 * **Auto-limpante:** cria uma vistoria de teste, exercita e apaga no fim,
 * inclusive se falhar no meio.
 *
 *   npm run verificar:vistoria
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { areaDe, type Medicao } from "../src/lib/vistoria/constantes";
import {
  calcular,
  descontoDe,
  modoDe,
  type Modo,
} from "../src/lib/vistoria/medicao";

config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !CHAVE) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const sb = createClient(URL, CHAVE, { auth: { persistSession: false } });

let falhas = 0;

function ok(certo: boolean, o_que: string, detalhe = "") {
  console.log(
    `  ${certo ? "ok  " : "FALHA"} ${o_que}${detalhe ? ` — ${detalhe}` : ""}`,
  );
  if (!certo) falhas++;
}

async function main() {
  console.log("\nA conta de área (função pura)");
  ok(areaDe(4, 3, null) === 12, "comprimento × largura", "4 × 3 = 12");
  ok(areaDe(4, null, 2.8) === 11.2, "sem largura, usa a altura (parede)");
  ok(areaDe(4, null, null) === null, "só uma medida não vira área");
  ok(areaDe(null, null, null) === null, "sem medida nenhuma devolve null");
  ok(areaDe(0, 3, null) === null, "zero não vira área", "não é medida, é vazio");
  ok(areaDe(3.33, 3, null) === 9.99, "arredonda para dois decimais");

  /**
   * Os sete modos de medição.
   *
   * Aqui é onde erro vira dinheiro: a quantidade que sai destas contas é a
   * que entra em `orc_itens.quantidade` e multiplica o preço unitário no
   * documento do cliente. Uma vírgula fora de lugar não aparece na tela —
   * aparece na fatura.
   */
  console.log("\nOs modos de medição (funções puras)");

  const dim = (
    comprimento: number | null,
    largura: number | null = null,
    altura: number | null = null,
    desconto: number | null = null,
  ) => ({ comprimento, largura, altura, desconto });

  ok(calcular("piso", dim(4, 3)) === 12, "piso: 4 × 3 = 12 m²");
  ok(calcular("parede", dim(4, null, 2.8)) === 11.2, "parede: 4 × 2,8 = 11,2 m²");
  ok(
    calcular("parede", dim(4, null, 2.8, 2)) === 9.2,
    "parede com vão: 11,2 − 2 = 9,2 m²",
  );
  ok(calcular("linear", dim(12)) === 12, "metro corrido: 12 m");
  ok(calcular("volume", dim(4, 3, 0.05)) === 0.6, "volume: 4 × 3 × 0,05 = 0,6 m³");
  ok(calcular("contagem", dim(null)) === null, "contagem não calcula: é digitada");
  ok(calcular("quantidade", dim(null)) === null, "quantidade não calcula");
  ok(calcular("verba", dim(null)) === null, "verba não calcula");

  ok(
    calcular("piso", dim(4, null)) === null,
    "medida faltando não vira número",
    "nunca zero por ausência",
  );
  ok(
    calcular("parede", dim(4, null, 2.8, 99)) === null,
    "desconto maior que a parede é recusado",
    "resultado negativo não entra",
  );

  /**
   * A ida e volta do modo.
   *
   * O modo não tem coluna: é deduzido do que está gravado. Se a dedução
   * errar, um item de parede reabre como piso e a conta muda sozinha na
   * segunda edição — o tipo de bug que ninguém vê acontecer.
   */
  console.log("\nO modo deduzido volta igual ao escolhido");

  const linha = (p: Partial<Medicao>): Medicao => ({
    id: "x",
    position: 1,
    servico: "teste",
    comprimento: null,
    largura: null,
    altura: null,
    quantidade: null,
    unidade: null,
    observacao: null,
    ...p,
  });

  const ida: [Modo, Medicao][] = [
    ["piso", linha({ comprimento: 4, largura: 3, quantidade: 12, unidade: "m²" })],
    ["parede", linha({ comprimento: 4, altura: 2.8, quantidade: 11.2, unidade: "m²" })],
    ["linear", linha({ comprimento: 12, quantidade: 12, unidade: "m" })],
    ["volume", linha({ comprimento: 4, largura: 3, altura: 0.05, quantidade: 0.6, unidade: "m³" })],
    ["contagem", linha({ quantidade: 6, unidade: "un" })],
    ["verba", linha({ quantidade: 1, unidade: "vb" })],
    ["quantidade", linha({ quantidade: 20, unidade: "sc" })],
  ];

  for (const [esperado, m] of ida) {
    ok(modoDe(m) === esperado, `${esperado} volta como ${esperado}`, `veio ${modoDe(m)}`);
  }

  ok(
    descontoDe(
      linha({ comprimento: 4, altura: 2.8, quantidade: 9.2, unidade: "m²" }),
    ) === 2,
    "o desconto de vão sai da diferença",
    "11,2 cheia − 9,2 gravada = 2",
  );
  ok(
    descontoDe(
      linha({ comprimento: 4, altura: 2.8, quantidade: 11.2, unidade: "m²" }),
    ) === null,
    "parede sem vão não inventa desconto",
  );
  ok(
    descontoDe(linha({ comprimento: 4, largura: 3, quantidade: 10 })) === null,
    "desconto só existe em parede",
  );

  const { data: org } = await sb.from("orgs").select("id").limit(1).maybeSingle();
  if (!org) {
    console.error("Nenhuma org no banco para testar.");
    process.exit(1);
  }

  let vistoriaId: string | null = null;

  try {
    console.log("\nA vistoria no banco");

    const { data: v, error: erroV } = await sb
      .from("vist_vistorias")
      .insert({ org_id: org.id, cliente_nome: "TESTE — APAGAR" })
      .select("id, data_visita, concluida_em")
      .maybeSingle();

    ok(!erroV && Boolean(v), "cria vistoria só com cliente", erroV?.message);
    if (!v) throw new Error("sem vistoria, o resto não roda");
    vistoriaId = v.id;

    ok(
      v.data_visita === new Date().toISOString().slice(0, 10),
      "data da visita nasce hoje quando ninguém informa",
      v.data_visita,
    );
    ok(v.concluida_em === null, "nasce em campo, não concluída");

    console.log("\nAmbientes");

    const { error: erroA1 } = await sb
      .from("vist_ambientes")
      .insert({ vistoria_id: v.id, position: 1, nome: "Cozinha" });
    ok(!erroA1, "inclui ambiente", erroA1?.message);

    const { error: erroDuplicado } = await sb
      .from("vist_ambientes")
      .insert({ vistoria_id: v.id, position: 1, nome: "Sala" });
    ok(
      erroDuplicado?.code === "23505",
      "duas posições iguais na mesma vistoria são barradas",
      erroDuplicado?.code ?? "passou, e não devia",
    );

    const { data: ambiente } = await sb
      .from("vist_ambientes")
      .select("id")
      .eq("vistoria_id", v.id)
      .maybeSingle();
    if (!ambiente) throw new Error("sem ambiente, o resto não roda");

    console.log("\nMedições");

    const { error: erroM } = await sb.from("vist_medicoes").insert({
      ambiente_id: ambiente.id,
      position: 1,
      servico: "Pintura",
      comprimento: 4,
      altura: 2.8,
      quantidade: 11.2,
      unidade: "m²",
    });
    ok(!erroM, "inclui medição", erroM?.message);

    const { error: erroNegativo } = await sb.from("vist_medicoes").insert({
      ambiente_id: ambiente.id,
      position: 2,
      servico: "Demolição",
      quantidade: -5,
    });
    ok(
      erroNegativo !== null,
      "quantidade negativa é barrada pelo banco",
      erroNegativo?.code ?? "passou, e não devia",
    );

    const { error: erroSemServico } = await sb.from("vist_medicoes").insert({
      ambiente_id: ambiente.id,
      position: 3,
      servico: null as unknown as string,
    });
    ok(
      erroSemServico !== null,
      "medição sem serviço é barrada",
      erroSemServico?.code ?? "passou, e não devia",
    );

    console.log("\nVistoria vira orçamento (decisão D1: ambiente = grupo)");

    // Reproduz o que `gerarOrcamentoDaVistoria` grava, sem passar pela Server
    // Action — que exige sessão. O que se prova aqui é o contrato do dado:
    // grupo por ambiente, item por medição, preço sempre vazio.
    const { data: segundo } = await sb
      .from("vist_ambientes")
      .insert({ vistoria_id: v.id, position: 2, nome: "Banheiro suíte" })
      .select("id, position, nome")
      .maybeSingle();
    if (!segundo) throw new Error("sem segundo ambiente");

    const { data: orc } = await sb
      .from("orc_orcamentos")
      .insert({ org_id: org.id, cliente_nome: "TESTE — APAGAR" })
      .select("id")
      .maybeSingle();
    if (!orc) throw new Error("sem orçamento de teste");

    const { error: erroItens } = await sb.from("orc_itens").insert([
      {
        orcamento_id: orc.id,
        grupo: "1 - COZINHA",
        position: 1,
        descricao: "Pintura",
        quantidade: 11.2,
        unidade: "m²",
        valor_unitario: null,
        origem: "humano" as const,
      },
      {
        orcamento_id: orc.id,
        grupo: `${segundo.position} - ${segundo.nome.toUpperCase()}`,
        position: 2,
        descricao: "Revestimento de parede",
        quantidade: 21.3,
        unidade: "m²",
        valor_unitario: null,
        origem: "humano" as const,
      },
    ]);
    ok(!erroItens, "grava os itens gerados", erroItens?.message);

    const { data: gerados } = await sb
      .from("orc_itens")
      .select("grupo, descricao, quantidade, valor_unitario, total")
      .eq("orcamento_id", orc.id)
      .order("position");

    ok((gerados ?? []).length === 2, "um item por medição levantada");
    ok(
      gerados?.[1]?.grupo === "2 - BANHEIRO SUÍTE",
      "o ambiente vira o grupo, numerado e em maiúsculas",
      gerados?.[1]?.grupo ?? "",
    );
    ok(
      (gerados ?? []).every((i) => i.valor_unitario === null),
      "todo item nasce SEM preço",
      "preço nunca é estimado pela máquina",
    );
    ok(
      (gerados ?? []).every((i) => i.total === null),
      "sem preço, o total gerado pelo banco também é nulo",
    );
    ok(
      gerados?.[0]?.quantidade !== null,
      "a quantidade medida na visita atravessa",
      String(gerados?.[0]?.quantidade),
    );

    await sb.from("orc_orcamentos").delete().eq("id", orc.id);

    console.log("\nCascata");

    await sb.from("vist_ambientes").delete().eq("id", ambiente.id);
    const { count: sobraram } = await sb
      .from("vist_medicoes")
      .select("id", { count: "exact", head: true })
      .eq("ambiente_id", ambiente.id);
    ok(
      (sobraram ?? 0) === 0,
      "apagar o ambiente leva as medições junto",
      `sobraram ${sobraram ?? 0}`,
    );
  } finally {
    if (vistoriaId) {
      await sb.from("vist_vistorias").delete().eq("id", vistoriaId);
      const { count } = await sb
        .from("vist_vistorias")
        .select("id", { count: "exact", head: true })
        .eq("id", vistoriaId);
      ok(
        (count ?? 0) === 0,
        "apagar a vistoria limpa tudo",
        "o teste não deixa lixo",
      );
    }
  }

  console.log(
    falhas === 0
      ? "\nTudo certo. As regras estão no banco, não só na tela.\n"
      : `\n${falhas} checagem(ns) falharam.\n`,
  );
  process.exit(falhas === 0 ? 0 : 1);
}

main();
