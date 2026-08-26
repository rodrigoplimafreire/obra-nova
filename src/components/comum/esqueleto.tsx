/**
 * Esqueleto de carregamento.
 *
 * As barras seguem o bloco "Carregando · esqueleto" do design system: cinza
 * 100 para o que é título e cal para o que é texto corrido. A pulsação não
 * está no documento, mas entra por um motivo prático — esqueleto parado por
 * dois segundos numa conexão ruim é indistinguível de tela quebrada.
 *
 * O desenho imita o formato da tela que vem depois, e não um spinner genérico:
 * é o que faz a página parecer que está chegando em vez de estar travada, e
 * evita o salto de layout quando o conteúdo real assume.
 */

/**
 * O círculo que gira dentro de um botão trabalhando.
 *
 * Vem com `btn-carregando` na classe do botão: o documento pede as duas coisas
 * juntas, porque trocar só o texto deixa a dúvida de se o clique pegou.
 */
export function Girando() {
  return <span className="girando" aria-hidden />;
}

export function Barra({
  largura = "100%",
  altura = 12,
  forte = false,
  className = "",
}: {
  largura?: string;
  altura?: number;
  /** Título e número usam o tom mais escuro; texto corrido, o mais claro. */
  forte?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-sm ${forte ? "bg-cinza-100" : "bg-papel"} ${className}`}
      style={{ width: largura, height: altura }}
    />
  );
}

/** Cartão de conteúdo, do tamanho de uma linha de lista. */
export function CartaoEsqueleto({ linhas = 2 }: { linhas?: number }) {
  return (
    <div className="cartao flex flex-col gap-2.5 px-5 py-4">
      <Barra largura="40%" altura={14} forte />
      {Array.from({ length: linhas }).map((_, i) => (
        <Barra key={i} largura={i % 2 === 0 ? "80%" : "64%"} />
      ))}
    </div>
  );
}

/** Os cartões numéricos do topo das telas do painel. */
export function IndicadoresEsqueleto({ quantos = 4 }: { quantos?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {Array.from({ length: quantos }).map((_, i) => (
        <div key={i} className="cartao flex flex-col gap-3 px-5 py-4">
          <Barra largura="60%" altura={10} forte />
          <Barra largura="45%" altura={28} forte />
        </div>
      ))}
    </div>
  );
}

/**
 * O cabeçalho da página. Repete a estrutura do `Cabecalho` real para o título
 * não pular de lugar quando o conteúdo chegar.
 */
export function CabecalhoEsqueleto() {
  // Mesma caixa do `Cabecalho` real — largura cheia, 24px de folga, sem faixa
  // nem borda. Quando os dois divergem, o título salta de lugar no instante em
  // que o conteúdo chega, que é o oposto do que o esqueleto existe para fazer.
  return (
    <div className="w-full px-5 pt-5 md:px-6 md:pt-6">
      <Barra largura="min(14rem, 55%)" altura={28} forte />
      <div className="mt-3">
        <Barra largura="min(20rem, 70%)" altura={11} />
      </div>
    </div>
  );
}

/** Conteúdo com a mesma caixa do `Conteudo` real. */
export function ConteudoEsqueleto({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full px-5 pt-5 pb-6 md:px-6"
    >
      <span className="sr-only">Carregando…</span>
      {children}
    </div>
  );
}

/** A tabela de custos, enquanto os itens não chegam. */
export function TabelaEsqueleto({ linhas = 4 }: { linhas?: number }) {
  return (
    <div className="cartao overflow-hidden">
      <div className="border-b border-nevoa bg-papel px-4 py-3">
        <Barra largura="30%" altura={10} forte />
      </div>
      {Array.from({ length: linhas }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-6 border-b border-cinza-100 px-4 py-4 last:border-b-0"
        >
          <Barra largura={i % 2 === 0 ? "42%" : "34%"} altura={13} />
          <Barra largura="72px" altura={13} />
        </div>
      ))}
    </div>
  );
}
