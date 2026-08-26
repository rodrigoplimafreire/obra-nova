/**
 * A marca em um lugar só. Manual Obra Nova v1.0.
 *
 * O símbolo são sete vias que se abrem a partir de um centro vazio — repetição
 * radial das duas hastes verticais, com o miolo livre de propósito.
 *
 * Os arquivos em `/marca` são de contorno fechado, como manda o manual: o
 * logotipo nunca é redigitado em Archivo. Eles entram por `mask-image` e não
 * por `<img>` — assim a cor vem de `currentColor` e as três variantes do
 * manual (grafite, cal e amarelo) são a mesma geometria pintada pelo contexto,
 * em vez de três arquivos que podem divergir com o tempo.
 */

/** Proporção do lockup, para a altura definir a largura sozinha. */
const PROPORCAO_LOCKUP = 706 / 137;

/**
 * Redução mínima do símbolo, do manual: abaixo disso os vértices fecham entre
 * si e o miolo some. Vale para o lockup também, porque nele o símbolo ocupa a
 * altura inteira.
 */
const MINIMO = 28;

function mascara(arquivo: string) {
  return {
    WebkitMaskImage: `url(/marca/${arquivo})`,
    maskImage: `url(/marca/${arquivo})`,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskPosition: "center",
    maskPosition: "center",
  } as const;
}

/** O símbolo: o N cortado pela via. Ícone do produto. */
export function Monograma({
  tamanho = 40,
  className = "",
}: {
  tamanho?: number;
  className?: string;
}) {
  const lado = Math.max(tamanho, MINIMO);
  return (
    <span
      aria-hidden
      style={{ ...mascara("logo-mark.svg"), width: lado, height: lado }}
      className={`inline-block shrink-0 bg-current ${className}`}
    />
  );
}

/**
 * A assinatura completa: símbolo e logotipo. `altura` é a do arquivo inteiro;
 * a largura sai da proporção, porque esticar invalida a assinatura.
 */
export function Logotipo({
  altura = MINIMO,
  className = "",
}: {
  altura?: number;
  className?: string;
}) {
  const alto = Math.max(altura, MINIMO);
  return (
    <span
      role="img"
      aria-label="Obra Nova"
      style={{
        ...mascara("logo-lockup.svg"),
        height: alto,
        width: alto * PROPORCAO_LOCKUP,
      }}
      className={`inline-block shrink-0 bg-current ${className}`}
    />
  );
}

/**
 * Assinatura de rodapé. `tom` acompanha o fundo: `claro` para telas de cal,
 * `escuro` para o grafite e o amarelo.
 */
export function RodapeDaMarca({
  tom = "claro",
  nome,
  logo,
  nota,
  semBorda = false,
}: {
  tom?: "claro" | "escuro";
  /** Quem assina o rodapé. O relatório de uma obra entregue em nome de outra
   *  empresa passa o nome dela aqui em vez de usar o padrão — mesmo rodapé,
   *  assinatura diferente. É o que faz o produto ser white label. */
  nome?: string;
  /** O logotipo da empreiteira, quando ela subiu um no Perfil. Vence o nome
   *  escrito: quem tem marca assina com ela, não com o nome digitado. */
  logo?: string | null;
  nota?: string;
  /** No painel a borda vem do container, que a alinha com a da barra lateral. */
  semBorda?: boolean;
}) {
  const escuro = tom === "escuro";
  // Assinatura de outra empresa não vem acompanhada da nossa marca. O
  // relatório é da empreiteira; nós somos o rodapé discreto, não o co-autor.
  const nosso = !nome && !logo;

  return (
    <footer
      className={`flex items-center gap-3 ${
        semBorda
          ? ""
          : `mt-auto border-t pt-5 ${escuro ? "border-white/15" : "border-nevoa"}`
      }`}
    >
      <div className="min-w-0">
        {nosso ? (
          <Logotipo className={escuro ? "text-papel" : "text-tinta"} />
        ) : logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt={nome ?? "Logotipo da empreiteira"}
            // `self-start` e altura fixa: sem os dois, o flex do rodapé estica
            // a imagem — é a mesma armadilha que já mordeu na capa impressa.
            className="h-8 w-auto max-w-[12rem] self-start object-contain"
          />
        ) : (
          <p
            className={`font-sans text-sm leading-none font-extrabold -tracking-[0.02em] ${
              escuro ? "text-papel" : "text-tinta"
            }`}
          >
            {nome}
          </p>
        )}
        {nota && (
          <p
            className={`mt-1.5 font-mono text-[0.6rem] tracking-widest uppercase ${
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
