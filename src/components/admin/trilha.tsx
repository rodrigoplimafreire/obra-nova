"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * A trilha do topo do painel, do `Obra Nova UI.dc.html` (seção 02): a barra
 * branca de 64px começa com "Obras / Residencial Aroeira".
 *
 * **Por que precisa de contexto e não sai do caminho da URL.** A seção sai:
 * `/admin/orcamentos` é "Orçamentos". A última migalha não — o nome do cliente
 * e o número do orçamento vivem no banco, e quem os carregou foi a página, que
 * está *abaixo* da barra na árvore. Contexto flui para baixo, então a barra
 * guarda um estado e entrega o gravador para quem estiver embaixo.
 *
 * O `Cabecalho` de cada página chama `useMigalha` sozinho: nenhuma página
 * precisa saber que esta barra existe, e nenhuma pode esquecer de alimentá-la.
 */

const Gravar = createContext<(valor: string | null) => void>(() => {});

export function ProvedorDaTrilha({
  children,
}: {
  children: (migalha: string | null) => React.ReactNode;
}) {
  const [migalha, setMigalha] = useState<string | null>(null);

  // A identidade do setter é estável, então o efeito de quem grava não
  // reassina a cada render da casca.
  const valor = useMemo(() => setMigalha, []);

  return <Gravar.Provider value={valor}>{children(migalha)}</Gravar.Provider>;
}

/**
 * Publica a última migalha enquanto a página estiver montada.
 *
 * A limpeza devolve `null` para a trilha não ficar exibindo o nome de uma
 * página que já saiu da tela — o caso clássico é voltar de um orçamento para
 * a lista.
 */
export function useMigalha(rotulo: string | null) {
  const gravar = useContext(Gravar);

  useEffect(() => {
    gravar(rotulo);
    return () => gravar(null);
  }, [gravar, rotulo]);
}
