import { NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { garantirConfirmacao } from "@/lib/obra/dados";
import { transcreverBlocoDeObra } from "@/lib/transcricao/pipeline";

/**
 * Cria um bloco de evidência. Autosave por bloco: cada foto, áudio ou
 * observação grava na hora. Sinal ruim no canteiro não pode custar o dia todo.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;

  let corpo: {
    atividadeId?: string;
    tipo?: string;
    texto?: string;
    storagePath?: string;
    mimeType?: string;
    duracaoMs?: number;
  };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const tipo = corpo.tipo;
  if (tipo !== "text" && tipo !== "audio" && tipo !== "image") {
    return NextResponse.json({ erro: "Tipo inválido." }, { status: 400 });
  }

  const texto = (corpo.texto ?? "").trim();
  if (tipo === "text" && !texto) {
    return NextResponse.json({ erro: "Texto vazio." }, { status: 400 });
  }
  if (tipo !== "text" && !corpo.storagePath) {
    return NextResponse.json({ erro: "Arquivo ausente." }, { status: 400 });
  }

  const contexto = await garantirConfirmacao(token, String(corpo.atividadeId ?? ""));
  if (!contexto) {
    return NextResponse.json({ erro: "Link ou atividade inválidos." }, { status: 404 });
  }

  const sb = supabaseAdmin();

  // O caminho precisa pertencer a esta confirmação. Sem isto, um token válido
  // poderia apontar um bloco para o arquivo de outra obra.
  if (
    corpo.storagePath &&
    !corpo.storagePath.startsWith(
      `obras/${contexto.atividade.obra_id}/${contexto.confirmacao.id}/`,
    )
  ) {
    return NextResponse.json({ erro: "Caminho fora da confirmação." }, { status: 400 });
  }

  const { data: ultimo } = await sb
    .from("confirmacao_blocos")
    .select("position")
    .eq("confirmacao_id", contexto.confirmacao.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: bloco, error } = await sb
    .from("confirmacao_blocos")
    .insert({
      confirmacao_id: contexto.confirmacao.id,
      position: (ultimo?.position ?? 0) + 1,
      type: tipo,
      text_content: tipo === "text" ? texto : null,
      storage_path: corpo.storagePath ?? null,
      mime_type: corpo.mimeType ?? null,
      duration_ms: Number.isFinite(corpo.duracaoMs) ? corpo.duracaoMs : null,
    })
    .select("id")
    .single();

  if (error || !bloco) {
    return NextResponse.json(
      { erro: error?.message ?? "Falha ao gravar." },
      { status: 502 },
    );
  }

  // A transcrição roda depois da resposta: quem está no canteiro não espera.
  if (tipo === "audio") {
    after(async () => {
      await transcreverBlocoDeObra(bloco.id).catch(() => {});
    });
  }

  return NextResponse.json({ id: bloco.id });
}

// A transcrição de um áudio longo pode passar do padrão de 10s da Vercel.
export const maxDuration = 120;
