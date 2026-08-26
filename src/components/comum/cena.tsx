/**
 * A moldura de um estado de tela: ilustração, título, uma linha, e a saída.
 *
 * A regra vem do documento de identidade, seção "Em tela": *uma* ilustração
 * por tela, no máximo 200px de lado, sempre com título, uma linha de
 * explicação e a ação de saída. O componente existe para essa regra não
 * depender de alguém lembrar dela — quem usa recebe a proporção e o espaço
 * prontos, e a ação de saída é um parâmetro à vista.
 *
 * **Por que `tom` é o nome da superfície e não uma cor.** As cenas não têm cor
 * própria: o traço é `currentColor` e o miolo dos objetos é `var(--paper)`.
 * Quando `--paper` é igual ao fundo onde a cena está, os objetos ficam
 * recortados e só o traço lê — que é o efeito de desenho técnico sobre papel.
 * Errar esse par não quebra nada, só deixa a cena com uma mancha branca no
 * meio. Por isso quem chama declara **onde** a cena está, não que cor usar.
 */

const TONS = {
  /** Fundo do painel (#e7e2da): estados vazios das listas. */
  fundo: { paper: "var(--color-papel-fundo)", texto: "text-tinta" },
  /** Dentro de cartão branco. */
  branco: { paper: "#ffffff", texto: "text-tinta" },
  /** Superfície cal (#f5f2ec): páginas públicas e telas soltas. */
  cal: { paper: "var(--color-papel)", texto: "text-tinta" },
  /** Grafite (#14181a): login e qualquer tela escura. Inverte a cena inteira. */
  grafite: { paper: "var(--color-tinta)", texto: "text-papel" },
} as const;

export type TomDaCena = keyof typeof TONS;

export function Cena({
  ilustracao,
  titulo,
  children,
  acao,
  tom = "fundo",
  largura = 168,
  className = "",
}: {
  ilustracao: React.ReactNode;
  titulo: string;
  /** Uma linha. Se precisar de duas, o estado está explicando demais. */
  children?: React.ReactNode;
  /** A saída: o que a pessoa faz agora. Sem ela a tela é um beco. */
  acao?: React.ReactNode;
  tom?: TomDaCena;
  /** Teto de 200px pelo documento. */
  largura?: number;
  className?: string;
}) {
  const { paper, texto } = TONS[tom];

  return (
    <div
      className={`flex flex-col items-center px-5 py-12 text-center ${texto} ${className}`}
    >
      <div
        // `--bg` acompanha `--paper`: as duas variáveis são o mesmo fundo em
        // toda aplicação dentro do app. Elas só se separam na prancha da marca,
        // onde a cena vai sobre chapa amarela e o miolo é branco.
        style={{ width: Math.min(largura, 200), ["--paper" as string]: paper, ["--bg" as string]: paper }}
        aria-hidden
      >
        {ilustracao}
      </div>

      <p className="mt-6 font-sans text-lg leading-tight font-bold -tracking-[0.02em]">
        {titulo}
      </p>

      {children && (
        <p
          className={`mt-2 max-w-md text-sm leading-relaxed ${
            tom === "grafite" ? "text-nevoa" : "text-cinza"
          }`}
        >
          {children}
        </p>
      )}

      {acao && <div className="mt-6 flex flex-wrap justify-center gap-3">{acao}</div>}
    </div>
  );
}
