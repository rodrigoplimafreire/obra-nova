import { notFound } from "next/navigation";
import { carregarSemanaDoMestre } from "@/lib/obra/dados";
import { AberturaDoMestre } from "@/components/obra/abertura-do-mestre";

export const dynamic = "force-dynamic";

export const metadata = { title: "Serviços do dia" };

export default async function DiaDoMestre({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const semana = await carregarSemanaDoMestre(token);
  if (!semana) notFound();

  return <AberturaDoMestre token={token} semana={semana} />;
}
