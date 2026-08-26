"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * Menu de ações secundárias, atrás de três pontos.
 *
 * Existe por um motivo só: tela com muito botão não é tela poderosa, é tela
 * sem hierarquia. A ação que se usa todo dia fica à vista; as que se usam uma
 * vez por orçamento — republicar, tirar do ar, marcar resposta — vivem aqui.
 * Escondidas não, secundárias sim: continuam a um toque, com rótulo escrito
 * por extenso, o que é mais legível que quatro botões disputando atenção.
 *
 * Fecha no clique fora e no Esc. O `fechar` chega aos itens por contexto para
 * cada um não precisar receber o callback à mão.
 */

const ContextoDeFechar = createContext<() => void>(() => {});

export function Menu({
  rotulo = "Mais ações",
  children,
}: {
  rotulo?: string;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;

    function aoClicarFora(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }

    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label={rotulo}
        aria-expanded={aberto}
        className="btn btn-secundario btn-compacto btn-icone"
      >
        <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-current">
          <circle cx="12" cy="5" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="12" cy="19" r="1.6" />
        </svg>
      </button>

      {aberto && (
        <ContextoDeFechar.Provider value={() => setAberto(false)}>
          {/* `right-0` porque o gatilho mora sempre no canto direito de um
              cabeçalho. O pai precisa estar encostado à direita, senão o
              painel abre para fora da tela no celular. */}
          <div className="absolute top-full right-0 z-20 mt-2 w-60 cartao py-1 shadow-lg">
            {children}
          </div>
        </ContextoDeFechar.Provider>
      )}
    </div>
  );
}

/**
 * Uma linha do menu. `tipo="submit"` para quando a ação é Server Action e o
 * item precisa viver dentro de um `<form>`.
 */
export function ItemDeMenu({
  children,
  nota,
  aoClicar,
  icone,
  perigo = false,
  tipo = "button",
  desabilitado = false,
}: {
  children: React.ReactNode;
  /** Segunda linha, para o que o rótulo sozinho não explica. */
  nota?: string;
  aoClicar?: () => void;
  icone?: React.ReactNode;
  perigo?: boolean;
  tipo?: "button" | "submit";
  desabilitado?: boolean;
}) {
  const fechar = useContext(ContextoDeFechar);

  return (
    <button
      type={tipo}
      disabled={desabilitado}
      onClick={() => {
        fechar();
        aoClicar?.();
      }}
      className={`flex w-full items-start gap-2.5 px-4 py-3 text-left transition hover:bg-papel-fundo disabled:opacity-40 ${
        perigo ? "text-atraso" : "text-tinta"
      }`}
    >
      {icone && <span className="mt-0.5 shrink-0">{icone}</span>}
      <span className="min-w-0">
        <span className="block text-sm leading-snug">{children}</span>
        {nota && (
          <span className="mt-0.5 block text-xs leading-snug text-cinza">
            {nota}
          </span>
        )}
      </span>
    </button>
  );
}

/** Risco fino entre grupos de itens. */
export function SeparadorDeMenu() {
  return <div className="my-1 border-t border-cinza-100" />;
}
