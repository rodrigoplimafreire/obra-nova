import { NextResponse } from "next/server";
import { BUCKET, supabaseAdmin } from "@/lib/supabase/admin";
import { garantirConfirmacao } from "@/lib/obra/dados";

/**
 * Signed upload URL escopada à confirmação.
 *
 * Os bytes vão do navegador direto ao Storage: o body de uma função da Vercel
 * tem teto de 4,5 MB e foto de obra tirada no celular estoura isso fácil.
 */

const MIMES_AUDIO = new Set(["audio/mp4", "audio/webm", "audio/ogg", "audio/mpeg"]);
const MIMES_IMAGEM = new Set(["image/jpeg", "image/png", "image/heic"]);

const TAMANHO_MAXIMO = 25 * 1024 * 1024;
const EXTENSAO_VALIDA = /^[a-z0-9]{2,5}$/;

export async function POST(
  request: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;

  let corpo: {
    atividadeId?: string;
    tipo?: string;
    mimeType?: string;
    extensao?: string;
    tamanhoBytes?: number;
  };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const tipo = corpo.tipo === "audio" || corpo.tipo === "image" ? corpo.tipo : null;
  const mime = (corpo.mimeType ?? "").split(";")[0].trim().toLowerCase();
  const extensao = (corpo.extensao ?? "").toLowerCase();
  const tamanho = Number(corpo.tamanhoBytes ?? 0);

  if (!tipo) {
    return NextResponse.json({ erro: "Tipo inválido." }, { status: 400 });
  }
  const aceitos = tipo === "audio" ? MIMES_AUDIO : MIMES_IMAGEM;
  if (!aceitos.has(mime)) {
    return NextResponse.json(
      { erro: `Formato não aceito: ${mime || "(vazio)"}` },
      { status: 400 },
    );
  }
  if (!EXTENSAO_VALIDA.test(extensao)) {
    return NextResponse.json({ erro: "Extensão inválida." }, { status: 400 });
  }
  if (!Number.isFinite(tamanho) || tamanho <= 0 || tamanho > TAMANHO_MAXIMO) {
    return NextResponse.json(
      { erro: `Arquivo acima do limite de ${TAMANHO_MAXIMO / 1024 / 1024} MB.` },
      { status: 400 },
    );
  }

  const contexto = await garantirConfirmacao(token, String(corpo.atividadeId ?? ""));
  if (!contexto) {
    return NextResponse.json({ erro: "Link ou atividade inválidos." }, { status: 404 });
  }

  // O caminho carrega a obra: é o que permite limpar o Storage ao apagar a obra.
  const caminho = `obras/${contexto.atividade.obra_id}/${contexto.confirmacao.id}/${crypto.randomUUID()}.${extensao}`;

  const { data, error } = await supabaseAdmin()
    .storage.from(BUCKET)
    .createSignedUploadUrl(caminho);

  if (error || !data) {
    return NextResponse.json(
      { erro: error?.message ?? "Falha ao criar a URL de upload." },
      { status: 502 },
    );
  }

  return NextResponse.json({ bucket: BUCKET, caminho: data.path, token: data.token });
}
