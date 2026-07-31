import { NextResponse } from "next/server";
import { BUCKET, supabaseAdmin } from "@/lib/supabase/admin";

/** Apaga um bloco. Foto errada, áudio cortado: no canteiro isso acontece. */
export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ token: string; id: string }> },
) {
  const { token, id } = await ctx.params;
  const sb = supabaseAdmin();

  const { data: mestre } = await sb
    .from("mestres")
    .select("id, ativo")
    .eq("token", token)
    .maybeSingle();
  if (!mestre || !mestre.ativo) {
    return NextResponse.json({ erro: "Link inválido." }, { status: 404 });
  }

  const { data: bloco } = await sb
    .from("confirmacao_blocos")
    .select("id, confirmacao_id, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!bloco) {
    return NextResponse.json({ erro: "Bloco não encontrado." }, { status: 404 });
  }

  // O bloco precisa ser de uma confirmação do próprio mestre. Sem esta checagem
  // um token válido apagaria evidência de qualquer obra.
  const { data: confirmacao } = await sb
    .from("confirmacoes")
    .select("id, mestre_id")
    .eq("id", bloco.confirmacao_id)
    .maybeSingle();

  if (!confirmacao || confirmacao.mestre_id !== mestre.id) {
    return NextResponse.json({ erro: "Bloco de outra pessoa." }, { status: 403 });
  }

  if (bloco.storage_path) {
    await sb.storage.from(BUCKET).remove([bloco.storage_path]);
  }
  await sb.from("confirmacao_blocos").delete().eq("id", bloco.id);

  return NextResponse.json({ ok: true });
}
