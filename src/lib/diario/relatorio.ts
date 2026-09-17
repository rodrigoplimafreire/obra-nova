import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * A linha do dia, criada sob demanda.
 *
 * Existe porque três caminhos diferentes precisam dela e nenhum deles pode
 * exigir que a pessoa "crie o dia" antes: gravar um áudio, digitar um
 * registro e salvar o rascunho. O dia nasce no primeiro deles, qualquer que
 * seja, e a chave única `(diario_id, dia)` garante que nasça uma vez só.
 */
export async function garantirRelatorioDoDia(
  diarioId: string,
  dia: string,
): Promise<string | null> {
  const sb = supabaseAdmin();

  const { data: existente } = await sb
    .from("dia_relatorios")
    .select("id")
    .eq("diario_id", diarioId)
    .eq("dia", dia)
    .maybeSingle();

  if (existente) return existente.id;

  const { data: criado } = await sb
    .from("dia_relatorios")
    .insert({ diario_id: diarioId, dia })
    .select("id")
    .single();

  return criado?.id ?? null;
}
