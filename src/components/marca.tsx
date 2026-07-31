/**
 * A marca em um lugar só.
 *
 * Enquanto a identidade do Obra Nova não fica pronta, o monograma é
 * tipográfico: as iniciais dentro do disco, sem arquivo de imagem. É de
 * propósito — o produto não pode sair assinado com a marca de outra coisa, e um
 * placeholder honesto é melhor do que a marca errada.
 *
 * Para trocar por um arquivo, é aqui e em nenhum outro lugar: troque o corpo de
 * `Monograma` por um `next/image` e devolva as referências em
 * `src/app/layout.tsx` (ícone e imagem de preview do WhatsApp).
 */

export function Monograma({
  tamanho = 40,
  className = "",
}: {
  tamanho?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.36 }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-limao font-sans font-extrabold -tracking-[0.04em] text-tinta ${className}`}
    >
      ON
    </span>
  );
}

/**
 * Assinatura de rodapé. `tom` acompanha o fundo: `claro` para telas de papel,
 * `escuro` para o azul e o preto.
 */
export function RodapeDaMarca({
  tom = "claro",
  nome,
  nota,
  semBorda = false,
}: {
  tom?: "claro" | "escuro";
  /** Quem assina o rodapé. O relatório de uma obra entregue em nome de outra
   *  empresa passa o nome dela aqui em vez de usar o padrão — mesmo rodapé,
   *  assinatura diferente. É o que faz o produto ser white label. */
  nome?: string;
  nota?: string;
  /** No painel a borda vem do container, que a alinha com a da barra lateral. */
  semBorda?: boolean;
}) {
  const escuro = tom === "escuro";
  // Assinatura de outra empresa não vem acompanhada do nosso monograma. O
  // relatório é da empreiteira; nós somos o rodapé discreto, não o co-autor.
  const nosso = !nome;

  return (
    <footer
      className={`flex items-center gap-3 ${
        semBorda
          ? ""
          : `mt-auto border-t pt-5 ${escuro ? "border-white/15" : "border-nevoa"}`
      }`}
    >
      {nosso && (
        <Monograma tamanho={28} className={escuro ? "opacity-90" : ""} />
      )}
      <div className="min-w-0">
        <p
          className={`font-sans text-sm leading-none font-extrabold -tracking-[0.02em] ${
            escuro ? "text-papel" : "text-tinta"
          }`}
        >
          {nome ?? "Obra Nova"}
        </p>
        {nota && (
          <p
            className={`mt-1 font-mono text-[0.6rem] tracking-widest uppercase ${
              escuro ? "text-papel/60" : "text-cinza"
            }`}
          >
            {nota}
          </p>
        )}
      </div>
    </footer>
  );
}
