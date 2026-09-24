/**
 * Traz para o banco os textos que só existiam no HTML escrito à mão.
 *
 * Os oito orçamentos antigos já estavam no painel, mas **só com a tabela**: as
 * `orc_secoes` estavam vazias, e `prazo` e `pagamento` em branco. O HTML tem
 * tudo isso — três cartões de "O projeto", a lista de observações técnicas, a
 * linha do tempo de "como a obra acontece" e a nota de papel com prazo ou
 * forma de pagamento.
 *
 * Sem este passo, trocar o link por reescrita entregaria ao cliente um
 * documento mais pobre do que o que ele já tem: a tabela e o preço, sem nada
 * em volta. O `.pcard` vira seção de projeto, o `.obs-list li` vira observação
 * e o `.timeline li` vira etapa — os três tipos de `orc_secoes`. O HTML e o
 * app dizem a mesma coisa com marcação diferente.
 *
 * Não sobrescreve: orçamento que já tem seção cadastrada fica como está, e
 * campo preenchido no banco vence o do arquivo. Quem editou foi uma pessoa na
 * tela.
 *
 * Rodar com `--gravar`.
 */

import { resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { lerTextos } from "./ler-propostas-html";

config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const RAIZ = resolve("..", "rd-propostas");
const GRAVAR = process.argv.includes("--gravar");

const CLIENTES: Record<string, string> = {
  "amanda-diego": "Amanda e Diego",
  erivando: "Sr. Erivando",
  "gabriel-fernandes": "Gabriel Fernandes",
  helano: "Sr. Helano",
  "jeova-filho": "Jeová Filho",
  livonio: "Sr. Livônio",
  rafael: "Sr. Rafael",
  "shopping-meirelles": "Shopping Meirelles",
};

/**
 * A `.paper-note` não tem um assunto fixo: numas propostas ela é o prazo, em
 * outras a validade, em outras a forma de pagamento. O título diz qual é.
 */
function destinoDaNota(titulo: string | null): "prazo" | "pagamento" | null {
  if (!titulo) return null;
  const t = titulo.toLowerCase();
  if (t.includes("pagamento")) return "pagamento";
  if (t.includes("prazo") || t.includes("dias")) return "prazo";
  return null;
}

async function main() {
  const { data: org } = await sb
    .from("orgs")
    .select("id")
    .eq("nome_exibicao", "RD Engenharia")
    .maybeSingle();
  if (!org) throw new Error("Não achei a org RD Engenharia.");

  for (const [slug, nome] of Object.entries(CLIENTES)) {
    const textos = lerTextos(RAIZ, slug);
    if (!textos) {
      console.log(`\n${nome}: sem HTML.`);
      continue;
    }

    const { data: o } = await sb
      .from("orc_orcamentos")
      .select("id, prazo, pagamento, apresentacao, intro_custos")
      .eq("org_id", org.id)
      .eq("cliente_nome", nome)
      .neq("status", "arquivado")
      .maybeSingle();
    if (!o) {
      console.log(`\n${nome}: não está no painel.`);
      continue;
    }

    const { count } = await sb
      .from("orc_secoes")
      .select("id", { count: "exact", head: true })
      .eq("orcamento_id", o.id);

    const p = textos.secoes.filter((s) => s.tipo === "projeto").length;
    const ob = textos.secoes.filter((s) => s.tipo === "observacao").length;
    const e = textos.secoes.filter((s) => s.tipo === "etapa").length;
    console.log(`\n${nome}  (${slug})`);
    console.log(`  HTML: ${p} projeto · ${ob} observação · ${e} etapa`);
    console.log(`  painel: ${count ?? 0} seções`);

    const campos: Record<string, string> = {};
    const destino = destinoDaNota(textos.notaTitulo);
    if (destino === "prazo" && !o.prazo && textos.notaTitulo) {
      campos.prazo = textos.notaTitulo;
    }
    if (destino === "pagamento" && !o.pagamento && textos.notaTexto) {
      campos.pagamento = textos.notaTexto;
    }
    if (!o.apresentacao && textos.apresentacao) {
      campos.apresentacao = textos.apresentacao;
    }
    if (!o.intro_custos && textos.introCustos) {
      campos.intro_custos = textos.introCustos;
    }

    for (const [k, v] of Object.entries(campos)) {
      console.log(`  ${k} ← ${v.slice(0, 64)}${v.length > 64 ? "…" : ""}`);
    }

    // A nota que não vira prazo nem pagamento (validade, por exemplo) entra
    // como observação: é conteúdo que o cliente lia e perderia.
    const extras = [...textos.secoes];
    if (!destino && textos.notaTitulo && textos.notaTexto) {
      extras.push({
        tipo: "observacao",
        titulo: textos.notaTitulo,
        texto: textos.notaTexto,
      });
      console.log(`  nota "${textos.notaTitulo}" → observação`);
    }

    if (!GRAVAR) continue;

    if ((count ?? 0) === 0 && extras.length > 0) {
      const { error } = await sb.from("orc_secoes").insert(
        extras.map((s, n) => ({
          orcamento_id: o.id,
          tipo: s.tipo,
          position: n + 1,
          titulo: s.titulo,
          texto: s.texto,
          origem: "humano" as const,
        })),
      );
      if (error) throw new Error(`${nome} · seções: ${error.message}`);
      console.log(`  ${extras.length} seções gravadas`);
    }

    if (Object.keys(campos).length > 0) {
      const { error } = await sb
        .from("orc_orcamentos")
        .update({ ...campos, updated_at: new Date().toISOString() })
        .eq("id", o.id);
      if (error) throw new Error(`${nome}: ${error.message}`);
    }
  }

  if (!GRAVAR) console.log("\nNada gravado. Rode com --gravar.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
