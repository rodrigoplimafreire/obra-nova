/**
 * Verificação do bug relatado pelo Rodrigo: "Falar orçamento" com valor
 * fechado, sem item nenhum, dava erro.
 *
 * O texto abaixo é o que ele realmente colou — só o total da mão de obra do
 * Sr. Livônio, sem preço por linha. Antes do conserto, isso caía em
 * "Nenhum item utilizável" e devolvia erro. Depois, tem que gravar em
 * `valor_fechado` e voltar `ok: true`.
 *
 * Cria um orçamento descartável, roda a IA de verdade contra a Groq, confere
 * o resultado e apaga o orçamento no fim — sucesso ou falha.
 *
 * Rodar:  npx tsx scripts/verificar-valor-fechado.ts
 * Precisa de: .env.local com SUPABASE_* e GROQ_API_KEY.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { montarItensDaFala } from "@/lib/orcamento/itens-da-fala";

config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !CHAVE) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const sb = createClient(URL, CHAVE, { auth: { persistSession: false } });

/**
 * De propósito, sem nenhum detalhamento de serviço — é a queixa literal do
 * Rodrigo: "o cliente passou só um valor do orçamento, o valor total da mão
 * de obra". Um texto com escopo numerado (1.0, 1.1, ...) e só o preço por
 * linha faltando é OUTRO caso — aí a IA acerta em criar itens sem preço, não
 * em recair para valor fechado. Este script testa o caso realmente sem
 * detalhamento nenhum.
 */
const TEXTO_DO_REGINATO = `Reforma completa do banheiro social, valor fechado de mão de obra: R$ 24.325,00`;

async function main() {
  const { data: org } = await sb.from("orgs").select("id").limit(1).single();
  if (!org) throw new Error("Nenhuma org no banco para testar.");

  const { data: orcamento, error: erroOrc } = await sb
    .from("orc_orcamentos")
    .insert({ org_id: org.id, cliente_nome: "[teste] verificar-valor-fechado" })
    .select("id")
    .single();
  if (erroOrc || !orcamento) throw new Error(erroOrc?.message ?? "sem id");

  const limpar = () =>
    sb.from("orc_orcamentos").delete().eq("id", orcamento.id);

  try {
    const { data: bloco, error: erroBloco } = await sb
      .from("orc_blocos")
      .insert({
        orcamento_id: orcamento.id,
        pergunta_id: null,
        position: 1,
        type: "text",
        text_content: TEXTO_DO_REGINATO,
      })
      .select("id")
      .single();
    if (erroBloco || !bloco) throw new Error(erroBloco?.message ?? "sem bloco");

    console.log("Chamando a IA com o texto real do Reginato (só valor, sem itens)...\n");
    const saida = await montarItensDaFala(orcamento.id, org.id, bloco.id);

    if (!saida.ok) {
      console.log(`FALHOU  — voltou erro: "${saida.erro}"`);
      console.log("\nEsse é exatamente o bug relatado. Não corrigido.");
      process.exitCode = 1;
      return;
    }

    console.log(`ok      — ok: true`);
    console.log(`ok      — criados: ${saida.criados} (esperado: 0)`);
    console.log(`ok      — valorFechado: ${saida.valorFechado} (esperado: 24325)`);

    const { data: gravado } = await sb
      .from("orc_orcamentos")
      .select("valor_fechado")
      .eq("id", orcamento.id)
      .single();

    const bateNoBanco = Number(gravado?.valor_fechado) === 24325;
    console.log(
      `${bateNoBanco ? "ok     " : "FALHOU "} — valor_fechado no banco: ${gravado?.valor_fechado} (esperado: 24325.00)`,
    );

    const semItens =
      (
        await sb
          .from("orc_itens")
          .select("id", { count: "exact", head: true })
          .eq("orcamento_id", orcamento.id)
      ).count === 0;
    console.log(
      `${semItens ? "ok     " : "FALHOU "} — nenhum item inventado na tabela`,
    );

    const tudoCerto =
      saida.criados === 0 &&
      saida.valorFechado === 24325 &&
      bateNoBanco &&
      semItens;

    console.log(tudoCerto ? "\nTudo certo." : "\nAlguma verificação falhou.");
    process.exitCode = tudoCerto ? 0 : 1;
  } finally {
    await limpar();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
