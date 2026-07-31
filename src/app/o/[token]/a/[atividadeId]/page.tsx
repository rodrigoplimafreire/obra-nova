import { notFound } from "next/navigation";
import { carregarDiaDoMestre } from "@/lib/obra/dados";
import { ConfirmarAtividade } from "@/components/obra/confirmar-atividade";

export const dynamic = "force-dynamic";

export const metadata = { title: "Confirmar serviço" };

export default async function Atividade({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; atividadeId: string }>;
  searchParams: Promise<{ dia?: string }>;
}) {
  const { token, atividadeId } = await params;
  // `dia` só vale para o link do escritório, e a autorização é resolvida no
  // servidor: dia de fora da semana simplesmente cai no dia de hoje.
  const { dia } = await searchParams;

  const dados = await carregarDiaDoMestre(token, dia);
  if (!dados) notFound();

  // Atividade de outro dia ou de outra obra não existe para este mestre.
  if (!dados.atividades.some((a) => a.id === atividadeId)) notFound();

  return (
    <ConfirmarAtividade token={token} dados={dados} atividadeId={atividadeId} />
  );
}
