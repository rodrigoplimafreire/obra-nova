import { notFound } from "next/navigation";
import { carregarVistoria } from "@/lib/vistoria/dados";
import { TelaDaVistoria } from "@/components/admin/tela-vistoria";

export const dynamic = "force-dynamic";

/**
 * Teto de execução, por causa da escuta.
 *
 * `escutarNoAmbiente` encadeia duas chamadas a provedor externo — transcrever
 * e interpretar — e o padrão da plataforma não cobre as duas numa conexão de
 * obra. Os tetos internos (60s na transcrição, 25s na IA) ficam abaixo deste
 * de propósito: timeout que estoura junto com a função grava o erro no banco
 * depois de a resposta já ter sido cortada, e o aparelho nunca recebe nada.
 * É a mesma lição da página do orçamento.
 */
export const maxDuration = 60;

export default async function PaginaDaVistoria({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vistoria = await carregarVistoria(id);

  // `carregarVistoria` já filtra por org: visita de outra conta responde 404
  // igual a id inexistente, sem dizer qual dos dois é.
  if (!vistoria) notFound();

  return <TelaDaVistoria vistoria={vistoria} />;
}
