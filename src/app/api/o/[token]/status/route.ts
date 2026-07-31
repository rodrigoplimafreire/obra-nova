import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { garantirConfirmacao } from "@/lib/obra/dados";

const STATUS_VALIDOS = new Set(["pendente", "feita", "parcial", "nao_feita"]);

/** Marca como o serviço terminou o dia. Só o status: a evidência vai por bloco. */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;

  let corpo: { atividadeId?: string; status?: string };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const status = String(corpo.status ?? "");
  if (!STATUS_VALIDOS.has(status)) {
    return NextResponse.json({ erro: "Situação inválida." }, { status: 400 });
  }

  const contexto = await garantirConfirmacao(token, String(corpo.atividadeId ?? ""));
  if (!contexto) {
    return NextResponse.json({ erro: "Link ou atividade inválidos." }, { status: 404 });
  }

  const { error } = await supabaseAdmin()
    .from("confirmacoes")
    .update({
      status: status as "pendente" | "feita" | "parcial" | "nao_feita",
      // Volta a nulo se ele desmarcar: `completed_at` preenchido com status
      // pendente mentiria para o relatório da semana.
      completed_at: status === "pendente" ? null : new Date().toISOString(),
    })
    .eq("id", contexto.confirmacao.id);

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
