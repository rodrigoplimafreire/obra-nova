/**
 * Sobe as quatro pranchas de fachada do Sr. Sousa.
 *
 * As descrições dos quatro modelos já estavam nas observações do documento,
 * mas descrever fachada sem mostrar é pedir ao cliente que imagine — e a
 * escolha é visual. Agora as pranchas aparecem na seção de mídia, com a
 * elevação, as cotas e a tabela de elementos de cada uma.
 *
 * **A seção de mídia nasceu para a situação atual da obra** — as fotos da
 * cobertura do Terras Brasilis. Aqui é o contrário: é projeto, não registro.
 * Por isso o orçamento passa a levar `midias_titulo` e `midias_texto`, e a
 * seção deixa de dizer "O que existe hoje" nesta proposta.
 *
 * Rodar com `--gravar`. Idempotente: se já houver mídia, não faz nada.
 */

import { readFileSync, existsSync } from "node:fs";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const BUCKET = "propostas";
const GRAVAR = process.argv.includes("--gravar");

const PASTA =
  "C:/Users/User/AppData/Local/Temp/claude/C--ProjetosDev-obra-nova/bbce08c5-5543-484a-b3a5-898aad69f57f/images";

/**
 * A ordem é a das opções, não a dos arquivos: o Rodrigo mandou as pranchas na
 * ordem 02, 03, 01, 04, e no documento elas têm de sair 01 a 04. Conferi arquivo
 * por arquivo antes de montar esta lista.
 */
const PRANCHAS: Array<{ arquivo: string; legenda: string }> = [
  {
    arquivo: "8.jpg",
    legenda: "Opção 01 · Contemporânea biofílica com jardineira",
  },
  {
    arquivo: "6.jpg",
    legenda: "Opção 02 · Nobre marmorizada Calacata com pórtico LED",
  },
  {
    arquivo: "7.jpg",
    legenda: "Opção 03 · Volumétrica grafite com pedra Fulget e spots",
  },
  {
    arquivo: "9.jpg",
    legenda: "Opção 04 · Elegance cinza urbano com revestimento 3D",
  },
];

const TITULO = "Quatro fachadas em estudo";
const TEXTO =
  "O muro da frente tem 6,00 m de vão por 3,00 m de altura, com a numeração nº 41. Estas são as quatro pranchas em estudo, com a elevação, as cotas e os elementos de cada modelo. A fachada é escopo à parte: o valor depende do modelo escolhido e não está incluído no total desta proposta.";

async function main() {
  const { data: orcamento } = await sb
    .from("orc_orcamentos")
    .select("id, cliente_nome")
    .eq("token", "sousa")
    .maybeSingle();
  if (!orcamento) throw new Error("Não achei o orçamento de token sousa.");

  const { data: jaTem } = await sb
    .from("orc_midias")
    .select("id")
    .eq("orcamento_id", orcamento.id);

  if ((jaTem ?? []).length > 0) {
    console.log(`\n${orcamento.cliente_nome} já tem ${jaTem!.length} mídias. Nada a fazer.`);
    return;
  }

  console.log(`\n${orcamento.cliente_nome}`);
  for (const p of PRANCHAS) {
    const caminho = `${PASTA}/${p.arquivo}`;
    if (!existsSync(caminho)) throw new Error(`Não achei ${caminho}.`);
    const bytes = readFileSync(caminho);
    console.log(
      `  ${p.arquivo} · ${(bytes.length / 1024).toFixed(0)} KB · ${p.legenda}`,
    );
  }

  if (!GRAVAR) {
    console.log("\nNada enviado. Rode com --gravar.");
    return;
  }

  let position = 0;
  for (const p of PRANCHAS) {
    const bytes = readFileSync(`${PASTA}/${p.arquivo}`);
    position += 1;
    // O nome no bucket é o da opção, não o do arquivo temporário: quem for
    // olhar o storage daqui a seis meses precisa saber o que é cada um.
    const destino = `${orcamento.id}/fachada-opcao-${String(position).padStart(2, "0")}.jpg`;

    const { error: erroUpload } = await sb.storage
      .from(BUCKET)
      .upload(destino, bytes, { contentType: "image/jpeg", upsert: true });
    if (erroUpload) throw new Error(`${p.arquivo}: ${erroUpload.message}`);

    const { error } = await sb.from("orc_midias").insert({
      orcamento_id: orcamento.id,
      tipo: "foto",
      storage_path: destino,
      legenda: p.legenda,
      position,
    });
    if (error) throw new Error(`${p.arquivo}: ${error.message}`);
    console.log(`  enviado · ${destino}`);
  }

  const { error } = await sb
    .from("orc_orcamentos")
    .update({
      midias_titulo: TITULO,
      midias_texto: TEXTO,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orcamento.id);
  if (error) throw new Error(error.message);

  console.log(`\n${position} pranchas · seção "${TITULO}"`);
  console.log("Agora republique:  npm run publicar -- sousa");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
