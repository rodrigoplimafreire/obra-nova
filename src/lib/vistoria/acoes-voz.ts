"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/admin/sessao";
import { transcrever } from "@/lib/transcricao/provedor";
import { itensDaVoz } from "./itens-da-voz";
import type { ItemDaVoz } from "./medicao";

/**
 * Falar o levantamento, dentro do cômodo.
 *
 * O gargalo da visita não é a tela, é a mão: o Reginato está de trena, em pé,
 * conversando com o cliente. Digitar dez serviços é dez vezes parar a conversa.
 * Falar "piso da cozinha quatro por três, quebrar o revestimento antigo, seis
 * pontos de luz" é uma frase, e ele já fala isso — só que para o ar.
 *
 * ## Por que o áudio não é gravado no Storage
 *
 * A fala do orçamento sobe para o bucket antes de transcrever, e por bom
 * motivo: lá o áudio é o documento do briefing, dura minutos e é a prova do
 * que o cliente pediu. Aqui é o oposto — a fala é um comando de dez segundos,
 * descartável assim que virou linha, e guardá-la custaria coluna nova e
 * caminho de bucket para um dado que ninguém vai reouvir.
 *
 * A regra "falhar não custa a gravação" continua valendo, e é atendida no
 * outro lado: o `Blob` fica no estado do navegador até a inclusão dar certo,
 * então "tentar de novo" reenvia o mesmo áudio sem pedir para gravar outra vez.
 *
 * ## Por que devolve em vez de gravar
 *
 * A IA ouviu; ela não decidiu. O que volta é uma lista para conferência, e
 * nada entra no banco antes de alguém olhar — é a mesma regra do "publicar é
 * ato humano", aplicada uma etapa antes. Numa transcrição de canteiro, com
 * furadeira ao fundo, a conferência não é cerimônia: é o que impede "seis
 * pontos de luz" de virar "sessenta".
 */

export type SaidaDaEscuta =
  | { ok: true; texto: string; itens: ItemDaVoz[]; aviso: string | null }
  | { ok: false; erro: string };

/** O ambiente pertence a uma visita desta org? Devolve a vistoria. */
async function vistoriaDoAmbiente(ambienteId: string): Promise<string | null> {
  const { orgId } = await exigirAdmin();
  const sb = supabaseAdmin();

  const { data: ambiente } = await sb
    .from("vist_ambientes")
    .select("vistoria_id")
    .eq("id", ambienteId)
    .maybeSingle();
  if (!ambiente) return null;

  const { data: vistoria } = await sb
    .from("vist_vistorias")
    .select("id")
    .eq("id", ambiente.vistoria_id)
    .eq("org_id", orgId)
    .maybeSingle();

  return vistoria ? vistoria.id : null;
}

/**
 * Passo 1: ouvir e propor.
 *
 * Transcreve e interpreta numa chamada só. São dois passos no orçamento
 * porque lá cada um demora e o progresso precisa de degraus; aqui a fala é
 * curta e o par leva poucos segundos — dois degraus seriam dois piscares.
 */
export async function escutarNoAmbiente(
  form: FormData,
): Promise<SaidaDaEscuta> {
  const ambienteId = String(form.get("ambienteId") ?? "");
  if (!(await vistoriaDoAmbiente(ambienteId))) {
    return { ok: false, erro: "Ambiente inválido." };
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return { ok: false, erro: "O áudio não chegou. Grave de novo." };
  }

  const mime = String(form.get("mime") ?? "") || null;
  const transcricao = await transcrever(audio, mime, "obra");

  if (!transcricao.ok) {
    return {
      ok: false,
      erro: `Não consegui transcrever: ${transcricao.erro}`,
    };
  }

  const texto = transcricao.texto.trim();
  if (texto.length < 3) {
    return { ok: false, erro: "Não entendi nada do áudio. Tente mais perto." };
  }

  const saida = await itensDaVoz(texto);

  // A IA falhar não apaga a transcrição: o texto volta mesmo assim, e a tela
  // deixa incluir à mão a partir do que foi ouvido. Perder os dois porque um
  // quebrou seria perder o trabalho por causa da automação.
  if (!saida.ok) {
    return { ok: true, texto, itens: [], aviso: saida.erro };
  }

  return {
    ok: true,
    texto,
    itens: saida.itens,
    aviso:
      saida.itens.length === 0
        ? "Ouvi o áudio, mas não reconheci serviço nenhum nele."
        : null,
  };
}

/**
 * Passo 2: gravar o que foi conferido.
 *
 * Insere em lote, na ordem em que foi falado. Um `insert` só, não um por item:
 * dez idas ao banco no 4G do canteiro é meio minuto de espera, e uma falha no
 * meio deixaria metade da fala gravada.
 */
export async function incluirItensDaVoz(
  ambienteId: string,
  itens: ItemDaVoz[],
): Promise<{ ok: boolean; erro?: string; incluidos?: number }> {
  const vistoriaId = await vistoriaDoAmbiente(ambienteId);
  if (!vistoriaId) return { ok: false, erro: "Ambiente inválido." };

  const limpos = itens.filter((i) => i.servico.trim().length >= 2);
  if (limpos.length === 0) return { ok: false, erro: "Nada para incluir." };

  const sb = supabaseAdmin();
  const { data: ultima } = await sb
    .from("vist_medicoes")
    .select("position")
    .eq("ambiente_id", ambienteId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const base = (ultima?.position ?? 0) + 1;

  const { error } = await sb.from("vist_medicoes").insert(
    limpos.map((i, indice) => ({
      ambiente_id: ambienteId,
      position: base + indice,
      servico: i.servico.trim(),
      comprimento: i.comprimento,
      largura: i.largura,
      altura: i.altura,
      quantidade: i.quantidade,
      unidade: i.unidade,
      observacao: null,
    })),
  );

  if (error) return { ok: false, erro: error.message };

  revalidatePath(`/admin/vistorias/${vistoriaId}`);
  revalidatePath("/admin/vistorias");
  return { ok: true, incluidos: limpos.length };
}
