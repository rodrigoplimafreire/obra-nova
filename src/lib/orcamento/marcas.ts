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
  /**
   * Versão empilhada, para a tela de senha.
   *
   * Ali o logo é o elemento principal e tem espaço vertical de sobra; o
   * horizontal do cabeçalho fica pequeno e tímido no meio da tela escura.
   */
  logoEmpilhado: string;
  /**
   * Ícone da aba do navegador, servido de `public/`.
   *
   * Não é o mesmo arquivo de `logo`: aquele é horizontal, pensado para o
   * cabeçalho do documento; favicon precisa de algo que sobrevive a 16px
   * quadrados. Confundir os dois é o erro que fez o cliente ver o ícone do
   * Obra Nova na aba de um orçamento assinado pela empreiteira dele — o
   * link é dela, a marca na aba tinha que ser dela também.
   */
  favicon: string;
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
    logoEmpilhado: "/marcas/rd/logo-vertical-laranja.png",
    favicon: "/marcas/rd/logo-vertical-laranja.png",
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
    // Não há versão empilhada do lockup; o horizontal serve.
    logoEmpilhado: "/marcas/obra-nova/logo-cal.svg",
    favicon: "/icon.svg",
    acento: "#F7E407",
  },
};

export const MARCA_PADRAO = "rd";

export function lerMarca(chave: string | null | undefined): Marca {
  return MARCAS[chave ?? ""] ?? MARCAS[MARCA_PADRAO];
}
