import { notFound } from "next/navigation";
import { carregarTranscricao } from "@/lib/transcricao/avulsas";
import { TelaDaTranscricao } from "@/components/admin/tela-transcricao";

export const dynamic = "force-dynamic";

/**
 * Transcrever de novo e criar orçamento chamam provedor externo. Sem este
 * teto a plataforma corta a resposta em 10 a 15s e a tela fica sem saber.
 */
export const maxDuration = 60;

export default async function PaginaDaTranscricao({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // `carregarTranscricao` já filtra por org: áudio de outra conta responde 404
  // igual a id inexistente, sem dizer qual dos dois é.
  const transcricao = await carregarTranscricao(id);
  if (!transcricao) notFound();

  return <TelaDaTranscricao transcricao={transcricao} />;
}
