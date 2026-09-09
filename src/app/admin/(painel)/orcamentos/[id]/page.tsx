import { notFound } from "next/navigation";
import { carregarOrcamento, obrasParaVincular } from "@/lib/orcamento/dados";
import { custoComercialDoOrcamento } from "@/lib/pipeline/dados";
import { TelaDoOrcamento } from "@/components/admin/tela-orcamento";

export const dynamic = "force-dynamic";

/**
 * As Server Actions desta tela herdam este teto, e é por causa da fala:
 * transcrever e montar a tabela chamam provedor externo, e o padrão da
 * plataforma (10 a 15s) cortava a resposta no meio. O cliente ficava preso em
 * "Transcrevendo" porque a função morria antes de conseguir responder.
 *
 * 60s é o máximo do plano. Os tetos das chamadas externas ficam em 35s, para
 * caber aqui dentro com folga para gravar o erro e devolver.
 */
export const maxDuration = 60;

export default async function PaginaDoOrcamento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orcamento = await carregarOrcamento(id);

  // `carregarOrcamento` já filtra por org: orçamento de outra conta responde
  // 404 igual a id inexistente, sem dizer qual dos dois é.
  if (!orcamento) notFound();

  return (
    <TelaDoOrcamento
      orcamento={orcamento}
      obras={await obrasParaVincular()}
      // Só existe quando o documento nasceu de um pedido do pipeline: sem
      // pedido não há porte nem medição, e os números seriam genéricos
      // aparecendo numa tela onde ninguém pediu.
      custoComercial={await custoComercialDoOrcamento(id)}
      // Montada no servidor: o link que vai por WhatsApp precisa do endereço
      // público, e `window.location` no cliente daria o de desenvolvimento
      // quando alguém abrisse pelo túnel ou por IP da rede local.
      urlBase={process.env.NEXT_PUBLIC_SITE_URL ?? ""}
    />
  );
}
