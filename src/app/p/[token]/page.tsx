import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { carregarOrcamentoPublicado } from "@/lib/orcamento/publico";
import { gateLiberado } from "@/lib/orcamento/acoes-publico";
import { lerMarca } from "@/lib/orcamento/marcas";
import { DocumentoDoCliente } from "@/components/orcamento/documento-do-cliente";
import { GateDoOrcamento } from "@/components/orcamento/gate-do-orcamento";

export const dynamic = "force-dynamic";

/**
 * **Esta rota não tem `loading.tsx`, e não pode voltar a ter.**
 *
 * Tinha um esqueleto escuro, para o cliente no celular com sinal ruim não ver
 * tela branca. O preço disso era um limite de Suspense: o Next mandava o
 * esqueleto na hora e o documento depois, dentro de um `<div hidden>` que um
 * script do React revela no fim.
 *
 * Na build de produção essa revelação **nunca acontecia**. O React 19 enfileira
 * os blocos em `$RB` e espera o runtime do cliente mandar revelar; aqui a fila
 * ficava com os 3 blocos parados para sempre. Resultado: o cliente ficava no
 * "Carregando o orçamento…" eterno, e quem mandava imprimir levava uma folha
 * em branco — porque a única coisa visível na página era o esqueleto. Sem
 * erro no console, e em `next dev` funcionava.
 *
 * Sem `loading.tsx` não há limite de Suspense: o servidor termina a consulta
 * antes de responder e o HTML já sai com o documento inteiro. Custa alguns
 * décimos no primeiro byte e não depende de JavaScript nenhum — que é o certo
 * para um documento feito para ser lido e assinado.
 */

/**
 * O título da aba é da empreiteira, no formato das propostas em HTML da RD:
 * "RD Engenharia · Gesso drywall e pintura — Sr. Paulo Roberto".
 *
 * Um "Orçamento" genérico não ajuda quem tem várias abas abertas, e não
 * confirma de quem é o documento — a mesma razão do favicon por marca.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const orcamento = await carregarOrcamentoPublicado(token);

  const robots = { index: false, follow: false, nocache: true };
  if (!orcamento) return { title: "Orçamento", robots };

  const { marca, objeto, cliente } = orcamento.documento;
  const partes = [lerMarca(marca).nome, objeto].filter(Boolean).join(" · ");

  return { title: `${partes} — ${cliente}`, robots };
}

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
      <GateDoOrcamento
        token={token}
        marca={orcamento.documento.marca}
        cliente={orcamento.documento.cliente}
      />
    );
  }

  return (
    <DocumentoDoCliente
      documento={orcamento.documento}
      token={token}
      jaAprovado={orcamento.situacao === "aprovado"}
      aceite={orcamento.aceite}
      empreiteira={orcamento.empreiteira}
    />
  );
}
