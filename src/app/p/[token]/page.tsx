import { notFound } from "next/navigation";
import { carregarOrcamentoPublicado } from "@/lib/orcamento/publico";
import { gateLiberado } from "@/lib/orcamento/acoes-publico";
import { DocumentoDoCliente } from "@/components/orcamento/documento-do-cliente";
import { GateDoOrcamento } from "@/components/orcamento/gate-do-orcamento";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Orçamento",
  // O link vai por WhatsApp para uma pessoa só, e leva preço dentro.
  robots: { index: false, follow: false, nocache: true },
};

export default async function PaginaDoOrcamento({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Sem publicação, responde 404 igual a token inexistente: quem tem o link e
  // ainda não foi liberado não precisa saber que o orçamento existe.
  const orcamento = await carregarOrcamentoPublicado(token);
  if (!orcamento) notFound();

  if (orcamento.temSenha && !(await gateLiberado(token))) {
    return (
      <GateDoOrcamento token={token} marca={orcamento.documento.marca} />
    );
  }

  return (
    <DocumentoDoCliente
      documento={orcamento.documento}
      token={token}
      jaAprovado={orcamento.situacao === "aprovado"}
      empreiteira={orcamento.empreiteira}
    />
  );
}
