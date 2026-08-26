/**
 * Verificação do bug de duplicação: 4 falas em sequência no mesmo orçamento.
 *
 * O bug: `montarMaterial` lia **todos** os blocos do orçamento, então cada
 * nova fala reprocessava as anteriores e reinseria tudo. Medido em produção:
 * 8 falas viraram 52 itens onde deviam ser 13, e o total geral saiu 3,74× maior
 * que o real.
 *
 * O que este script prova: com N falas, `orc_itens` fica com exatamente a soma
 * dos itens que cada fala gerou — nem a mais nem a menos. Se a regressão
 * voltar, a contagem final vem maior que a soma dos lotes e o script falha
 * dizendo quantos sobraram.
 *
 * Usa o caminho de **texto** (`registrarTextoDaFala`), não o de áudio: exercita
 * exatamente a mesma função de montagem sem depender de gravar som nem de
 * chamar o Whisper. A chamada à IA é real — é ela que estamos verificando.
 *
 * Rodar:  npx tsx scripts/verificar-falas-sequenciais.ts
 * Precisa de: .env.local com SUPABASE_* e GROQ_API_KEY.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !CHAVE) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const sb = createClient(URL, CHAVE, { auth: { persistSession: false } });

/** Uma frase por fala, cada uma com um serviço distinto e mensurável. */
const FALAS = [
  "Contrapiso de 30 metros quadrados, traço 1 para 4, a 18 reais o metro.",
  "Reboco interno, 60 metros quadrados, 12 reais e 50 o metro quadrado.",
  "Pintura da fachada externa, 120 metros quadrados. O preço eu ainda vou ver.",
  "Telhado com telha cerâmica, 180 metros quadrados, a 38 reais o metro.",
];

async function main() {
  const { montarItensDaFala } = await import(
    "../src/lib/orcamento/itens-da-fala"
  );

  const { data: org } = await sb.from("orgs").select("id").limit(1).single();
  if (!org) throw new Error("Nenhuma org no banco.");

  const { data: orcamento } = await sb
    .from("orc_orcamentos")
    .insert({
      org_id: org.id,
      cliente_nome: `[verificação] ${new Date().toISOString()}`,
      senha: "teste",
    })
    .select("id")
    .single();
  if (!orcamento) throw new Error("Não consegui criar o orçamento de teste.");

  console.log(`Orçamento de teste: ${orcamento.id}\n`);

  const porFala: number[] = [];

  try {
    for (const [i, texto] of FALAS.entries()) {
      const { data: ultimo } = await sb
        .from("orc_blocos")
        .select("position")
        .eq("orcamento_id", orcamento.id)
        .order("position", { ascending: false })
        .limit(1);

      const { data: bloco } = await sb
        .from("orc_blocos")
        .insert({
          orcamento_id: orcamento.id,
          position: (ultimo?.[0]?.position ?? 0) + 1,
          type: "text",
          text_content: texto,
        })
        .select("id")
        .single();
      if (!bloco) throw new Error(`Falha ao registrar a fala ${i + 1}.`);

      const saida = await montarItensDaFala(orcamento.id, org.id, bloco.id);
      if (!saida.ok) throw new Error(`Fala ${i + 1} falhou: ${saida.erro}`);

      porFala.push(saida.criados);
      console.log(
        `Fala ${i + 1}: ${saida.criados} ${saida.criados === 1 ? "item" : "itens"} · "${texto.slice(0, 45)}…"`,
      );
    }

    const esperado = porFala.reduce((a, b) => a + b, 0);

    const { count } = await sb
      .from("orc_itens")
      .select("id", { count: "exact", head: true })
      .eq("orcamento_id", orcamento.id);

    const obtido = count ?? 0;

    // A contagem por si não pega tudo: se a IA gerasse os mesmos itens de novo
    // e o total batesse por coincidência, passaria. Conferir descrições
    // repetidas fecha essa brecha.
    const { data: itens } = await sb
      .from("orc_itens")
      .select("descricao")
      .eq("orcamento_id", orcamento.id);

    const contagem = new Map<string, number>();
    for (const i of itens ?? []) {
      contagem.set(i.descricao, (contagem.get(i.descricao) ?? 0) + 1);
    }
    const repetidos = [...contagem.entries()].filter(([, n]) => n > 1);

    console.log(`\nSoma do que cada fala gerou: ${esperado}`);
    console.log(`Linhas em orc_itens:          ${obtido}`);

    if (obtido !== esperado) {
      console.error(
        `\n✗ FALHOU: ${obtido - esperado} ${Math.abs(obtido - esperado) === 1 ? "linha" : "linhas"} a ${obtido > esperado ? "mais" : "menos"}.`,
      );
      process.exitCode = 1;
      return;
    }

    if (repetidos.length > 0) {
      console.error("\n✗ FALHOU: descrições repetidas na tabela:");
      for (const [d, n] of repetidos) console.error(`  ${n}× ${d}`);
      process.exitCode = 1;
      return;
    }

    console.log("\n✓ PASSOU: nenhuma linha a mais, nenhuma descrição repetida.");
  } finally {
    await sb.from("orc_orcamentos").delete().eq("id", orcamento.id);
    console.log("\nOrçamento de teste removido.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
