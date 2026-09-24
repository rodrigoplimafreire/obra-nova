/**
 * Sobe para o bucket as três fotos e o vídeo da cobertura do Terras Brasilis.
 *
 * Elas viviam em `rd-propostas/terrabrasilis/media/`, servidas pelo HTML
 * estático. Para o slug virar reescrita sem o condomínio perder o registro que
 * a própria proposta chama de "a base técnica usada para fechar este
 * orçamento", os arquivos precisam existir do lado do app.
 *
 * As legendas são as mesmas que estavam nas `<figcaption>` do HTML.
 *
 * Rodar com `--gravar`. É idempotente: se já houver mídia no orçamento, não
 * faz nada — rodar duas vezes não duplica a galeria.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const BUCKET = "propostas";
const MEDIA = resolve("..", "rd-propostas", "terrabrasilis", "media");
const GRAVAR = process.argv.includes("--gravar");

const ARQUIVOS: Array<{
  nome: string;
  mime: string;
  tipo: "foto" | "video";
  legenda: string;
}> = [
  {
    nome: "ima1.jpeg",
    mime: "image/jpeg",
    tipo: "foto",
    legenda: "Cobertura existente · vista superior",
  },
  {
    nome: "ima2.jpeg",
    mime: "image/jpeg",
    tipo: "foto",
    legenda: "Estrutura metálica · entrada",
  },
  {
    nome: "ima3.jpeg",
    mime: "image/jpeg",
    tipo: "foto",
    legenda: "Forro e fachada · detalhe",
  },
  {
    nome: "video1.mp4",
    mime: "video/mp4",
    tipo: "video",
    legenda: "Vídeo · situação atual da cobertura (sem áudio)",
  },
];

async function main() {
  const { data: orcamento } = await sb
    .from("orc_orcamentos")
    .select("id, cliente_nome")
    .eq("token", "terrabrasilis")
    .maybeSingle();
  if (!orcamento) throw new Error("Não achei o orçamento de token terrabrasilis.");

  const { data: jaTem } = await sb
    .from("orc_midias")
    .select("id")
    .eq("orcamento_id", orcamento.id);

  if ((jaTem ?? []).length > 0) {
    console.log(`\n${orcamento.cliente_nome} já tem ${jaTem!.length} mídias. Nada a fazer.`);
    return;
  }

  console.log(`\n${orcamento.cliente_nome}`);
  for (const a of ARQUIVOS) {
    const caminho = join(MEDIA, a.nome);
    if (!existsSync(caminho)) throw new Error(`Não achei ${caminho}.`);
    const bytes = readFileSync(caminho);
    console.log(`  ${a.nome} · ${(bytes.length / 1024 / 1024).toFixed(1)} MB · ${a.legenda}`);
  }

  if (!GRAVAR) {
    console.log("\nNada enviado. Rode com --gravar.");
    return;
  }

  let position = 0;
  for (const a of ARQUIVOS) {
    const bytes = readFileSync(join(MEDIA, a.nome));
    const destino = `${orcamento.id}/${a.nome}`;

    const { error: erroUpload } = await sb.storage
      .from(BUCKET)
      .upload(destino, bytes, { contentType: a.mime, upsert: true });
    if (erroUpload) throw new Error(`${a.nome}: ${erroUpload.message}`);

    position += 1;
    const { error } = await sb.from("orc_midias").insert({
      orcamento_id: orcamento.id,
      tipo: a.tipo,
      storage_path: destino,
      legenda: a.legenda,
      position,
    });
    if (error) throw new Error(`${a.nome}: ${error.message}`);
    console.log(`  enviado · ${destino}`);
  }

  console.log(`\n${position} mídias no orçamento. Agora republique: npm run publicar -- terrabrasilis`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
