"use client";

import { useEffect } from "react";
import { Cena } from "@/components/comum/cena";
import { CenaFalha } from "@/components/comum/ilustracoes";
import { Logotipo } from "@/components/marca";

/**
 * Erro não tratado em qualquer rota.
 *
 * Não existia. Uma exceção no servidor derrubava a pessoa na tela padrão do
 * Next — em produção, um "Application error" sem marca e sem saída.
 *
 * `reset()` é a ação principal porque a maioria das falhas aqui é de rede ou
 * de consulta que expirou: tentar de novo resolve, e resolve sem perder onde a
 * pessoa estava. O `digest` aparece pequeno no rodapé — é o que liga o que ela
 * viu ao registro do servidor, e sem ele o suporte começa do zero.
 */
export default function Erro({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-papel px-6 py-16">
      <Logotipo altura={28} className="text-tinta" />

      <Cena
        ilustracao={<CenaFalha />}
        titulo="Alguma coisa caiu aqui do lado"
        tom="cal"
        acao={
          <button type="button" onClick={reset} className="btn btn-primario">
            Tentar de novo
          </button>
        }
      >
        A falha é nossa, não sua. Nada do que você já tinha salvo se perdeu.
      </Cena>

      {error.digest && (
        <p className="font-mono text-[0.65rem] tracking-widest text-cinza-400 uppercase">
          Código {error.digest}
        </p>
      )}
    </main>
  );
}
