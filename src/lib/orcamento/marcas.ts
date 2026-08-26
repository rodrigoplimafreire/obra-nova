/**
 * As marcas que podem assinar o documento do cliente.
 *
 * O painel é sempre Obra Nova — é a ferramenta, e quem olha para ela é a
 * empreiteira. O documento é outra coisa: quem abre é cliente dela, e o preço
 * precisa chegar com a marca de quem vai executar a obra. Por isso a escolha
 * vive no orçamento, não numa constante do código.
 *
 * Acrescentar uma empreiteira é acrescentar uma entrada aqui e a folha de
 * estilo dela em `public/marcas/`. Nada de migração no banco: a coluna
 * `orc_orcamentos.marca` guarda só a chave.
 */

export type Marca = {
  /** O nome que assina o rodapé e a capa impressa. */
  nome: string;
  /** Folha de estilo do documento, servida de `public/`. */
  estilo: string;
  /**
   * Folha de impressão A4, entra com `media="print"`.
   *
   * Escrita por extenso e não deduzida do nome de `estilo`: já foi um
   * `replace("brand.css", "print.css")`, que não tem como acusar erro quando
   * a marca chama a folha dela de outra coisa — some sem barulho e a
   * impressão sai com o layout de tela.
   */
  impressao: string;
  /** Logo sobre fundo escuro. */
  logo: string;
  /** Cor de acento, para o que a folha não cobre (favicon, theme-color). */
  acento: string;
};

export const MARCAS: Record<string, Marca> = {
  rd: {
    nome: "RD Engenharia",
    // O mesmo brand.css de orcamentos.rd.eng.br, canônico e já afinado para a
    // impressão A4 — não traduzir para Tailwind.
    estilo: "/marcas/rd/brand.css",
    impressao: "/marcas/rd/print.css",
    logo: "/marcas/rd/logo-hor-laranja.png",
    acento: "#E8622C",
  },
  obra_nova: {
    nome: "Obra Nova",
    estilo: "/marcas/obra-nova/documento.css",
    impressao: "/marcas/obra-nova/print.css",
    // O lockup de `/marca` é de contorno `currentColor`, para entrar por
    // `mask-image` no painel. Aqui ele é `<img>`, e dentro de um `<img>` o
    // `currentColor` resolve preto — invisível na capa de tinta. Esta cópia
    // vem com a cal pintada no arquivo; o timbrado claro inverte.
    logo: "/marcas/obra-nova/logo-cal.svg",
    acento: "#F7E407",
  },
};

export const MARCA_PADRAO = "rd";

export function lerMarca(chave: string | null | undefined): Marca {
  return MARCAS[chave ?? ""] ?? MARCAS[MARCA_PADRAO];
}
