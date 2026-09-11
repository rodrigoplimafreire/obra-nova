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
import { areaDe } from "../src/lib/vistoria/constantes";

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
