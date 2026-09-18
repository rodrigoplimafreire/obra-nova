import type { Metadata } from "next";

/**
 * O cartão que o WhatsApp desenha quando o link é colado na conversa.
 *
 * **É o primeiro contato do cliente com o documento**, e por muito tempo ele
 * saía errado: o `layout.tsx` define `openGraph` com "Obra Nova — O
 * acompanhamento semanal da sua obra, com foto e relato", e as páginas
 * públicas sobrescreviam só o `title`. Resultado: quem recebia um orçamento da
 * RD via um cartão com a marca do fornecedor de software dela e uma frase
 * sobre relatório de obra com foto.
 *
 * O comentário no `layout.tsx` já dizia que preview com marca errada é pior
 * que preview nenhum. Faltava alguém aplicar isso nas três rotas.
 *
 * **Nada do conteúdo entra aqui.** O cartão do WhatsApp fica visível para
 * quem estiver no grupo, para quem receber encaminhado e para o robô que
 * gerou a prévia — é vitrine, não documento. Ele diz o que é e de quem é, e
 * para saber o resto a pessoa abre e digita a senha.
 *
 * Sem `images` de propósito, mantendo a decisão do `layout.tsx`: logotipo de
 * empreiteira costuma ser marca larga e transparente, e num cartão de
 * WhatsApp isso aparece cortado ou invisível. Título e remetente certos valem
 * mais que imagem quebrada.
 */
export function previewDoLinkPublico({
  titulo,
  descricao,
  empreiteira,
}: {
  titulo: string;
  /** Uma frase. Diz o que é e que é privado, nunca o que está escrito. */
  descricao: string;
  /** Aparece como remetente do cartão. Nulo cai no nome do produto. */
  empreiteira: string | null;
}): Metadata {
  return {
    title: titulo,
    description: descricao,
    // O link circula por WhatsApp e carrega token. Nada disso vai para índice.
    robots: { index: false, follow: false, nocache: true },
    openGraph: {
      title: titulo,
      description: descricao,
      siteName: empreiteira ?? "Obra Nova",
      type: "website",
    },
  };
}
