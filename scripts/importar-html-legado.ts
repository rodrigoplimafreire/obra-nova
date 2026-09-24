/**
 * Traz para o painel as propostas que só existiam como HTML escrito à mão.
 *
 * Sete das dez já tinham sido importadas numa rodada anterior; este script
 * completa o serviço em vez de duplicar:
 *
 * - **proposta que não existe no painel** → cria o orçamento, com o slug como
 *   token e a senha que estava no `script.js`;
 * - **proposta que já existe** → acrescenta só os itens que faltam, comparando
 *   pela descrição normalizada, e preenche o valor fechado quando ele está
 *   nulo no banco e a barra laranja do HTML tem o número.
 *
 * Nada é sobrescrito: item que já está no banco fica como está, mesmo que o
 * HTML discorde. Quem editou foi uma pessoa na tela, e a tela ganha do arquivo.
 *
 * **Não publica, e não mexe no `rd-propostas`.** O link estático que já foi
 * para o cliente continua servindo o mesmo documento de sempre. Portar para o
 * painel é trazer o histórico para dentro — migrar o link é outra decisão, uma
 * proposta de cada vez.
 *
 * Rodar com `--gravar` para escrever. Sem a flag, mostra o diagnóstico.
 */

import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { lerProposta, normalizar } from "./ler-propostas-html";

config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const RAIZ = resolve("..", "rd-propostas");
const GRAVAR = process.argv.includes("--gravar");

/**
 * Acrescentar itens a um orçamento que já existe pede flag própria, e não vem
 * junto do `--gravar`.
 *
 * O diff por descrição normalizada acusa muita coisa que **não** é item
 * faltando: no Sr. Livônio as quatro linhas "só no HTML" são as mesmas do
 * banco com um "cm" a mais no fim ("80×80 cm" contra "80×80"); no Jeová Filho
 * a mesma porta aparece duas vezes porque a proposta tem dois blocos de opção;
 * e no Gabriel Fernandes entram títulos de etapa ("7.3 Piso da garagem") que
 * moram na coluna de descrição sem ser `.ct-group`.
 *
 * Gravar isso encheria a Biblioteca de serviço repetido com dois nomes — que é
 * exatamente o que ela existe para evitar. A conferência é do Rodrigo, uma
 * proposta de cada vez.
 */
const COMPLETAR = process.argv.includes("--completar");

/**
 * Slug → nome do cliente como ele está no banco.
 *
 * Escrito à mão porque casar por nome dá errado nos dois sentidos: "Terras
 * Brasilis" no HTML é "Condomínio Botânico Terras Brasilis" na vida, e
 * "Izonete" aparece como "Dona Izonete". Uma linha por proposta é mais honesto
 * que uma heurística que acerta oito de dez.
 */
const CLIENTES: Record<string, string> = {
  "amanda-diego": "Amanda e Diego",
  erivando: "Sr. Erivando",
  "gabriel-fernandes": "Gabriel Fernandes",
  helano: "Sr. Helano",
  izonete: "Dona Izonete",
  "jeova-filho": "Jeová Filho",
  livonio: "Sr. Livônio",
  rafael: "Sr. Rafael",
  "shopping-meirelles": "Shopping Meirelles",
  terrabrasilis: "Condomínio Botânico Terras Brasilis",
};

const OBJETOS: Record<string, string> = {
  izonete: "Reforma de apartamento",
  terrabrasilis: "Reforma de cobertura, forro PVC e pintura da estrutura",
};

const moeda = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function main() {
  const { data: org } = await sb
    .from("orgs")
    .select("id")
    .eq("nome_exibicao", "RD Engenharia")
    .maybeSingle();
  if (!org) throw new Error("Não achei a org RD Engenharia.");

  const pastas = readdirSync(RAIZ, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_") && !d.name.startsWith("."))
    .map((d) => d.name)
    .sort();

  let criados = 0;
  let acrescentados = 0;
  let valoresPreenchidos = 0;

  for (const slug of pastas) {
    const proposta = lerProposta(RAIZ, slug);
    if (!proposta || proposta.itens.length === 0) continue;

    const nome = CLIENTES[slug];
    if (!nome) {
      console.log(`\n${slug}: sem cliente mapeado — pulando.`);
      continue;
    }

    const { data: existente } = await sb
      .from("orc_orcamentos")
      .select("id, cliente_nome, valor_fechado")
      .eq("org_id", org.id)
      .eq("cliente_nome", nome)
      .neq("status", "arquivado")
      .maybeSingle();

    console.log(`\n${nome}  (${slug})`);
    console.log(`  HTML: ${proposta.itens.length} itens · ${moeda(proposta.valorFechado)}`);

    if (!existente) {
      console.log(`  não está no painel → criar`);
      if (!GRAVAR) continue;

      const { data: novo, error } = await sb
        .from("orc_orcamentos")
        .insert({
          org_id: org.id,
          token: slug,
          cliente_nome: nome,
          objeto: OBJETOS[slug] ?? null,
          senha: proposta.senha,
          valor_fechado: proposta.valorFechado,
          validade_dias: 20,
          status: "conferindo" as const,
          observacoes:
            `Proposta escrita à mão, importada de orcamentos.rd.eng.br/${slug}. ` +
            `O documento que o cliente recebeu continua sendo o HTML original.`,
        })
        .select("id")
        .single();
      if (error) throw new Error(`${nome}: ${error.message}`);

      const linhas = proposta.itens.map((i, n) => ({
        orcamento_id: novo.id,
        grupo: i.grupo,
        position: n + 1,
        descricao: i.quantidadeTexto
          ? `${i.descricao} (${i.quantidadeTexto})`
          : i.descricao,
        quantidade: i.quantidade,
        unidade: i.unidade,
        valor_unitario: i.valorUnitario,
        origem: "humano" as const,
      }));
      const { error: erroItens } = await sb.from("orc_itens").insert(linhas);
      if (erroItens) throw new Error(`${nome} · itens: ${erroItens.message}`);

      console.log(`  criado · ${linhas.length} itens · token ${slug}`);
      criados++;
      continue;
    }

    // Já existe: completa o que falta, sem tocar no que está lá.
    const { data: atuais } = await sb
      .from("orc_itens")
      .select("descricao, position")
      .eq("orcamento_id", existente.id)
      .is("removido_em", null);

    const jaTem = new Set((atuais ?? []).map((i) => normalizar(i.descricao)));
    const ultima = Math.max(0, ...(atuais ?? []).map((i) => i.position));
    const faltando = proposta.itens.filter((i) => !jaTem.has(normalizar(i.descricao)));

    console.log(`  painel: ${atuais?.length ?? 0} itens · ${moeda(existente.valor_fechado != null ? Number(existente.valor_fechado) : null)}`);

    if (faltando.length === 0) {
      console.log(`  nada a acrescentar`);
    } else {
      console.log(
        `  ${faltando.length} descrições só no HTML` +
          (COMPLETAR ? ":" : " (confira; --completar para gravar):"),
      );
      for (const i of faltando) console.log(`    · ${i.descricao.slice(0, 72)}`);
      if (GRAVAR && COMPLETAR) {
        const linhas = faltando.map((i, n) => ({
          orcamento_id: existente.id,
          grupo: i.grupo,
          position: ultima + n + 1,
          descricao: i.quantidadeTexto
            ? `${i.descricao} (${i.quantidadeTexto})`
            : i.descricao,
          quantidade: i.quantidade,
          unidade: i.unidade,
          valor_unitario: i.valorUnitario,
          origem: "humano" as const,
        }));
        const { error } = await sb.from("orc_itens").insert(linhas);
        if (error) throw new Error(`${nome} · itens: ${error.message}`);
        acrescentados += linhas.length;
      }
    }

    if (existente.valor_fechado == null && proposta.valorFechado != null) {
      console.log(`  valor fechado em branco → ${moeda(proposta.valorFechado)}`);
      if (GRAVAR) {
        await sb
          .from("orc_orcamentos")
          .update({ valor_fechado: proposta.valorFechado, updated_at: new Date().toISOString() })
          .eq("id", existente.id);
        valoresPreenchidos++;
      }
    }
  }

  console.log(
    GRAVAR
      ? `\n${criados} orçamentos criados · ${acrescentados} itens acrescentados · ${valoresPreenchidos} valores preenchidos`
      : "\nNada gravado. Rode com --gravar.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
