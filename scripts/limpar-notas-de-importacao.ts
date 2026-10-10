/**
 * Tira a nota de importação do campo que vai ao cliente.
 *
 * Em 27/08/2026 o importador do `rd-propostas` registrou o que fez no campo
 * `observacoes` de cada orçamento. O campo não é bloco de recado interno: ele
 * sai no documento do cliente, na seção "O que vale saber". Oito propostas
 * ficaram mostrando a quem ia assinar um texto com o nome do Rodrigo, valores
 * de versões antigas e nomes de coluna entre acentos graves — o do Sr. Rafael
 * dizia que "os seis itens somam R$ 17.323,57, mas a barra de total diz
 * R$ 17.323,25 — parece dígito trocado".
 *
 * O Rafael foi limpo junto com a sua revisão de escopo. Este script faz as
 * outras sete.
 *
 * **As notas não se perdem.** As sete estão na íntegra em
 * `scripts/HISTORICO-DA-IMPORTACAO.md`, porque duas guardam coisa que não
 * existe em outro lugar: a do Jeová explica por que só a opção em Drywall foi
 * importada, e a do Livônio avisa que o Reginato revisou o escopo de 72,35 m²
 * para 31,00 m² e que a narrativa do documento pode não ter acompanhado. Essa
 * segunda é pendência real, e sair do campo do cliente não a resolve — fica
 * registrada no arquivo para ser conferida.
 *
 * Limpar o campo não muda o que o cliente vê: o documento é uma **cópia
 * congelada** em `orc_publicacoes`. Só republicar troca a cópia, e por isso o
 * script republica cada uma — e para antes de tudo se alguma tiver aceite
 * registrado, porque aí a republicação deixaria de ser conserto de texto.
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

async function main() {
  const { data: alvos, error } = await sb
    .from("orc_orcamentos")
    .select("id, token, cliente_nome, status, observacoes")
    .ilike("observacoes", "%rd-propostas%")
    .order("cliente_nome");
  if (error) throw new Error(error.message);
  if (!alvos?.length) {
    console.log("\nNenhuma nota de importação no campo do cliente. Nada a fazer.");
    return;
  }

  console.log(`\n${alvos.length} propostas com nota de importação:\n`);

  for (const o of alvos) {
    // Aceite registrado muda a natureza da coisa: aí não é conserto de texto.
    const { data: aceites, error: erroEventos } = await sb
      .from("orc_eventos")
      .select("tipo, created_at")
      .eq("orcamento_id", o.id)
      .in("tipo", ["aceito", "recusado"]);
    if (erroEventos) throw new Error(`eventos de ${o.cliente_nome}: ${erroEventos.message}`);
    if (aceites?.length) {
      throw new Error(
        `${o.cliente_nome} tem ${aceites[0].tipo} em ${aceites[0].created_at}:` +
          ` republicar apagaria a versão que o cliente respondeu. Pare e decida com o Rodrigo.`,
      );
    }

    const linhas = o.observacoes!.split("\n").filter((l: string) => l.trim());
    console.log(`  ${o.cliente_nome} · ${o.token} · ${o.status} · ${linhas.length} parágrafo(s)`);
  }

  if (!GRAVAR) {
    console.log("\nNenhum aceite registrado — republicar é seguro.");
    console.log("Nada gravado. Rode com --gravar.\n");
    console.log("Depois republique, uma por uma:");
    for (const o of alvos) console.log(`  npm run publicar -- ${o.token}`);
    return;
  }

  for (const o of alvos) {
    const { error: erroUpdate } = await sb
      .from("orc_orcamentos")
      .update({ observacoes: null, updated_at: new Date().toISOString() })
      .eq("id", o.id);
    if (erroUpdate) throw new Error(`${o.cliente_nome}: ${erroUpdate.message}`);
  }

  const { data: sobrou } = await sb
    .from("orc_orcamentos")
    .select("cliente_nome")
    .ilike("observacoes", "%rd-propostas%");
  if (sobrou?.length) {
    throw new Error(`sobraram ${sobrou.length}: ${sobrou.map((s) => s.cliente_nome).join(", ")}`);
  }

  console.log(`\n  ${alvos.length} campos limpos ✓`);
  console.log(`\nFalta trocar a cópia congelada de cada uma:`);
  for (const o of alvos) console.log(`  npm run publicar -- ${o.token}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
