/**
 * Publica um orçamento pela linha de comando.
 *
 * **Isto contorna uma trava deliberada, e por isso pede confirmação digitada.**
 * O PRD diz que publicação é ato humano na tela, e que a CLI não tem caminho
 * próprio de escrita. Este script respeita a segunda metade — reusa
 * `carregarOrcamento` e `montarDocumento`, exatamente as mesmas funções que a
 * Server Action usa, em vez de montar o JSON à mão — mas contorna a primeira,
 * a pedido do Rodrigo, para publicar orçamentos cujos dados foram gravados
 * fora da tela.
 *
 * O que ele **não** reproduz da ação do painel: a checagem de sessão
 * (`exigirAdmin`), que é o que amarra a publicação a uma pessoa. Por isso
 * `publicado_por` fica nulo e o evento sai com origem `cli` — quem olhar a
 * linha do tempo depois precisa saber que não foi alguém clicando.
 *
 * Rodar:  npx tsx scripts/publicar.ts <id-ou-token> [mais ids...]
 */

import { createInterface } from "node:readline/promises";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { carregarOrcamento } from "@/lib/orcamento/dados";
import { montarDocumento } from "@/lib/orcamento/publicacao";

config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !CHAVE) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const sb = createClient(URL, CHAVE, { auth: { persistSession: false } });

function moeda(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function main() {
  const alvos = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (alvos.length === 0) {
    console.error("Uso: npx tsx scripts/publicar.ts <id-ou-token> [...]");
    process.exit(1);
  }

  // Resolve tudo e mostra ANTES de perguntar: confirmar no escuro não é
  // confirmação. O que aparece aqui é o que o cliente vai ver.
  const planos: Array<{ id: string; orgId: string; rotulo: string; versao: number }> = [];

  for (const alvo of alvos) {
    const ehUuid = /^[0-9a-f-]{36}$/i.test(alvo);
    const { data: linha } = await sb
      .from("orc_orcamentos")
      .select("id, org_id")
      .eq(ehUuid ? "id" : "token", alvo)
      .maybeSingle();

    if (!linha) {
      console.error(`Não achei orçamento para "${alvo}".`);
      process.exit(1);
    }

    const orcamento = await carregarOrcamento(linha.id, linha.org_id);
    if (!orcamento) {
      console.error(`Não consegui carregar ${linha.id}.`);
      process.exit(1);
    }

    // As mesmas travas da tela. Contornar a confirmação humana não é
    // contornar as regras que protegem o cliente.
    if (orcamento.itens.length === 0) {
      console.error(`${orcamento.cliente}: nenhum item lançado.`);
      process.exit(1);
    }
    if (orcamento.valorFechado === null && orcamento.semPreco > 0) {
      console.error(
        `${orcamento.cliente}: ${orcamento.semPreco} item(ns) sem preço de venda.`,
      );
      process.exit(1);
    }
    if (!orcamento.senha) {
      console.error(`${orcamento.cliente}: sem senha definida.`);
      process.exit(1);
    }

    const versao = (orcamento.versaoPublicada ?? 0) + 1;
    planos.push({
      id: linha.id,
      orgId: linha.org_id,
      rotulo: `${orcamento.cliente} · ${moeda(orcamento.valorFechado ?? orcamento.total)} · v${versao}${versao > 1 ? " (republicação)" : ""}`,
      versao,
    });
  }

  console.log("\nVai publicar:\n");
  for (const p of planos) console.log(`  ${p.rotulo}`);

  const leitor = createInterface({ input: process.stdin, output: process.stdout });
  const resposta = await leitor.question(
    `\nIsto fica visível para o cliente. Digite PUBLICAR para confirmar: `,
  );
  leitor.close();

  if (resposta.trim() !== "PUBLICAR") {
    console.log("Cancelado. Nada foi publicado.");
    process.exit(1);
  }

  console.log();
  for (const plano of planos) {
    const orcamento = await carregarOrcamento(plano.id, plano.orgId);
    if (!orcamento) continue;

    const dados = montarDocumento(orcamento, plano.versao);

    const { error } = await sb.from("orc_publicacoes").insert({
      orcamento_id: plano.id,
      versao: plano.versao,
      dados,
      publicado_por: null,
    });
    if (error) {
      console.error(`${plano.rotulo}: ${error.message}`);
      process.exit(1);
    }

    // Republicar não rebaixa conversa que já andou: quem estava negociando
    // continua negociando. Mesma regra da tela.
    const recomeca =
      orcamento.situacao === "rascunho" || orcamento.situacao === "expirado";

    await sb
      .from("orc_orcamentos")
      .update({
        status: "publicado",
        updated_at: new Date().toISOString(),
        ...(recomeca ? { situacao: "enviado" as const } : {}),
      })
      .eq("id", plano.id);

    await sb.from("orc_eventos").insert({
      orcamento_id: plano.id,
      tipo: plano.versao === 1 ? "publicado" : "republicado",
      usuario_id: null,
      detalhe: { versao: plano.versao, total: dados.total, origem: "cli" },
    });

    console.log(`  publicado — ${plano.rotulo}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
