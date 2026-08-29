"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialogo } from "@/components/comum/dialogo";
import { Girando } from "@/components/comum/esqueleto";
import { ItemDeMenu, Menu, SeparadorDeMenu } from "@/components/comum/menu";

/**
 * As ações de um orçamento, direto na lista.
 *
 * Antes disto, mudar a situação de um orçamento pedia abrir a tela dele,
 * rolar até o cartão de publicação e voltar. Para dez orçamentos numa
 * terça-feira, é o suficiente para a pessoa não atualizar nada — e uma lista
 * que não reflete a realidade deixa de valer como lista.
 *
 * A confirmação existe só onde apagar é definitivo. Marcar situação errada se
 * desfaz marcando de novo; pedir "tem certeza?" a cada clique treina a pessoa
 * a clicar em "sim" sem ler, e aí o aviso que importa também passa batido.
 */

export type AcaoDeLinha = {
  rotulo: string;
  nota?: string;
  /** Devolve mensagem de erro, ou null quando deu certo. */
  executar: () => Promise<string | null>;
  perigo?: boolean;
  /** Pede confirmação escrita. Só para o que não se desfaz. */
  confirmar?: { titulo: string; aviso: string; palavra: string };
};

export function AcoesDaLinha({ acoes }: { acoes: AcaoDeLinha[] }) {
  const router = useRouter();
  const [, transicao] = useTransition();
  const [rodando, setRodando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<AcaoDeLinha | null>(null);
  const [palavra, setPalavra] = useState("");

  async function rodar(acao: AcaoDeLinha) {
    setErro(null);
    setRodando(acao.rotulo);
    try {
      const falha = await acao.executar();
      if (falha) {
        setErro(falha);
        return;
      }
      setConfirmando(null);
      setPalavra("");
      transicao(() => router.refresh());
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setRodando(null);
    }
  }

  return (
    <>
      {/* `stopPropagation` porque a linha inteira é um link: sem isto, abrir o
          menu navegaria para o orçamento antes de o menu aparecer. */}
      <span
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <Menu>
          {acoes.map((acao, n) => (
            <div key={acao.rotulo}>
              {n > 0 && acao.perigo && <SeparadorDeMenu />}
              <ItemDeMenu
                nota={acao.nota}
                perigo={acao.perigo}
                desabilitado={rodando !== null}
                aoClicar={() => {
                  if (acao.confirmar) {
                    setPalavra("");
                    setErro(null);
                    setConfirmando(acao);
                  } else {
                    void rodar(acao);
                  }
                }}
              >
                {acao.rotulo}
              </ItemDeMenu>
            </div>
          ))}
        </Menu>
      </span>

      <Dialogo
        aberto={confirmando !== null}
        aoFechar={() => setConfirmando(null)}
        titulo={confirmando?.confirmar?.titulo ?? ""}
        descricao={confirmando?.confirmar?.aviso}
        estreito
      >
        {confirmando?.confirmar && (
          <>
            <div className="dialogo-corpo flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="rotulo-campo">
                  Escreva {confirmando.confirmar.palavra} para confirmar
                </span>
                <input
                  value={palavra}
                  onChange={(e) => setPalavra(e.target.value)}
                  autoFocus
                  className="campo font-mono"
                />
              </label>
              {erro && <p className="aviso aviso-erro text-sm">{erro}</p>}
            </div>
            <div className="dialogo-rodape">
              <button
                type="button"
                onClick={() => setConfirmando(null)}
                className="btn btn-secundario"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  rodando !== null ||
                  palavra.trim() !== confirmando.confirmar.palavra
                }
                onClick={() => void rodar(confirmando)}
                className={`btn ${rodando ? "btn-carregando" : "btn-primario"}`}
              >
                {rodando && <Girando />}
                {confirmando.rotulo}
              </button>
            </div>
          </>
        )}
      </Dialogo>

      {/* Fora do diálogo: erro de ação sem confirmação não tem onde aparecer. */}
      {erro && !confirmando && (
        <span className="selo selo-atraso" title={erro}>
          falhou
        </span>
      )}
    </>
  );
}
