import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  carregarDiaPublicado,
  carregarDiarioPorToken,
  datasPublicadas,
} from "@/lib/diario/dados";
import { diarioLiberado } from "@/lib/diario/acoes-publico";
import { diaValido, hojeNaEmpreiteira, mesDoDia, mesValido } from "@/lib/tempo";
import { GateDoDiario } from "@/components/diario/gate-do-diario";
import { PaginaDoDiario } from "@/components/diario/pagina-do-diario";

export const dynamic = "force-dynamic";

/**
 * **Esta rota não tem `loading.tsx`, e não pode ganhar um.**
 *
 * Pela mesma razão que `/p/[token]` não tem — o comentário longo lá conta o
 * caso inteiro. Em resumo: `loading.tsx` cria um limite de Suspense, o React
 * 19 enfileira os blocos e espera o runtime do cliente revelar, e na build de
 * produção essa revelação não aconteceu. O leitor ficava na tela de
 * carregando para sempre.
 *
 * Sem limite de Suspense o HTML já sai inteiro do servidor, e a página não
 * depende de JavaScript nenhum — que é o que sustenta o calendário navegável
 * por link (decisão D7 do `PRD-DIARIO.md`).
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const diario = await carregarDiarioPorToken(token);

  // O link vai por WhatsApp para uma pessoa só. Nada de buscador.
  const robots = { index: false, follow: false, nocache: true };
  if (!diario) return { title: "Diário", robots };

  const partes = [diario.empreiteira.nome, diario.titulo ?? "Diário de atividades"]
    .filter(Boolean)
    .join(" · ");

  return { title: partes, robots };
}

export default async function Diario({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ dia?: string; mes?: string }>;
}) {
  const { token } = await params;

  const diario = await carregarDiarioPorToken(token);
  if (!diario) notFound();

  // A senha vem antes de qualquer leitura de conteúdo: sem ela, nem a lista
  // de datas publicadas sai daqui.
  if (diario.temSenha && !(await diarioLiberado(token))) {
    return (
      <GateDoDiario
        token={token}
        titulo={diario.titulo}
        empreiteira={diario.empreiteira}
      />
    );
  }

  const { dia: diaPedido, mes: mesPedido } = await searchParams;

  const datas = await datasPublicadas(diario.id);
  const hoje = hojeNaEmpreiteira();

  /**
   * Onde a página abre, na ordem do PRD: o dia pedido na URL, senão hoje se
   * houver publicação de hoje, senão a publicação mais recente. Sem nenhuma
   * das três, o dia de hoje — e a página diz que ainda não há nada.
   */
  const selecionado =
    diaPedido && diaValido(diaPedido)
      ? diaPedido
      : datas.includes(hoje)
        ? hoje
        : (datas[0] ?? hoje);

  const mes =
    mesPedido && mesValido(mesPedido) ? mesPedido : mesDoDia(selecionado);

  // Só busca o conteúdo de uma data que de fato foi publicada: pedir um dia
  // qualquer na URL não pode virar caminho para o rascunho.
  const relatorio = datas.includes(selecionado)
    ? await carregarDiaPublicado(diario.id, selecionado)
    : null;

  /**
   * O anterior e o seguinte por comparação de data, e não por posição na
   * lista: a data pedida na URL pode não ter publicação nenhuma, e aí não há
   * posição. Por índice, a seta de "anterior" apontava para o dia mais
   * recente — uma seta para trás levando para a frente no tempo.
   */
  const anterior = datas.find((d) => d < selecionado) ?? null;
  const seguinte = datas.filter((d) => d > selecionado).pop() ?? null;

  return (
    <PaginaDoDiario
      token={token}
      titulo={diario.titulo}
      autor={diario.autorNome}
      empreiteira={diario.empreiteira}
      hoje={hoje}
      selecionado={selecionado}
      mes={mes}
      datas={datas}
      relatorio={relatorio}
      anterior={anterior}
      seguinte={seguinte}
    />
  );
}
