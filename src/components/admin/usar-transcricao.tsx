"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialogo } from "@/components/comum/dialogo";
import { Girando } from "@/components/comum/esqueleto";
import { usarTranscricaoNoOrcamento } from "@/lib/transcricao/acoes-avulsas";
import { listarProntasParaUso } from "@/lib/transcricao/acoes-listar";
import { nomeDaTranscricao, type ResumoDeTranscricao } from "@/lib/transcricao/tipos";

/**
 * Trazer uma transcrição para um orçamento que já existe.
 *
 * O caminho de ida — criar orçamento a partir da transcrição — já existe no
 * módulo de Transcrição. Este é a volta: quem já está com o orçamento aberto e
 * lembra que tem o áudio do cliente guardado não precisa sair, achar a
 * transcrição e criar um orçamento novo para depois juntar os dois.
 *
 * A lista carrega ao abrir, e não junto da página: são poucas linhas, mas
 * carregá-las em toda tela de orçamento seria uma consulta por visita para uma
 * função que a maioria das visitas não usa.
 */
export function UsarTranscricao({
  orcamentoId,
  aberto,
  aoFechar,
}: {
  orcamentoId: string;
  aberto: boolean;
  aoFechar: () => void;
}) {
  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Usar uma transcrição"
      descricao="A IA lê o texto do áudio e acrescenta as linhas na tabela. O que já está lá não se perde."
    >
      {aberto && <Miolo orcamentoId={orcamentoId} aoFechar={aoFechar} />}
    </Dialogo>
  );
}

function Miolo({
  orcamentoId,
  aoFechar,
}: {
  orcamentoId: string;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [lista, setLista] = useState<ResumoDeTranscricao[] | null>(null);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [montando, setMontando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    criados: number;
    valorFechado: number | null;
    entendido: string;
    faltando: string[];
  } | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const linhas = await listarProntasParaUso();
        if (vivo) setLista(linhas);
      } catch {
        if (vivo) {
          setLista([]);
          setErro("Não consegui carregar as transcrições.");
        }
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  async function usar() {
    if (!escolhida) return;
    setErro(null);
    setMontando(true);
    try {
      const saida = await usarTranscricaoNoOrcamento(orcamentoId, escolhida);
      if (!saida.ok) {
        setErro(saida.erro);
        return;
      }
      setResultado({
        criados: saida.criados,
        valorFechado: saida.valorFechado,
        entendido: saida.entendido,
        faltando: saida.faltando,
      });
      router.refresh();
    } catch (e) {
      // Server Action que lança deixa a tela girando sem dizer nada. Mesma
      // captura do "Falar orçamento", pelo mesmo motivo.
      setErro(
        `A conexão caiu no meio (${e instanceof Error ? e.message : String(e)}). Confira a tabela antes de tentar de novo.`,
      );
    } finally {
      setMontando(false);
    }
  }

  // ---------- Resultado ----------
  if (resultado) {
    return (
      <>
        <div className="dialogo-corpo flex flex-col gap-4">
          <p className="aviso aviso-ok text-sm">
            <span>
              {resultado.valorFechado !== null ? (
                <>
                  <strong className="block">
                    Valor fechado de{" "}
                    {resultado.valorFechado.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}{" "}
                    registrado
                  </strong>
                  Sem tabela de itens — a transcrição só trouxe o total.
                  Confira em &quot;Valor fechado&quot;.
                </>
              ) : (
                <>
                  <strong className="block">
                    {resultado.criados}{" "}
                    {resultado.criados === 1
                      ? "item entrou na tabela"
                      : "itens entraram na tabela"}
                  </strong>
                  Confira e ajuste o que precisar — tudo é editável.
                </>
              )}
            </span>
          </p>

          {resultado.entendido && (
            <div>
              <p className="rotulo mb-1">O que eu entendi</p>
              <p className="text-sm leading-relaxed text-fumaca">
                {resultado.entendido}
              </p>
            </div>
          )}

          {resultado.faltando.length > 0 && (
            <div>
              <p className="rotulo mb-1">Ficou faltando</p>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed text-fumaca">
                {resultado.faltando.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="dialogo-rodape">
          <button type="button" onClick={aoFechar} className="btn btn-primario">
            Ver a tabela
          </button>
        </div>
      </>
    );
  }

  // ---------- Carregando a lista ----------
  if (lista === null) {
    return (
      <div className="dialogo-corpo flex items-center gap-3 py-8">
        <Girando />
        <p className="text-sm text-fumaca">Buscando suas transcrições…</p>
      </div>
    );
  }

  // ---------- Nenhuma pronta ----------
  if (lista.length === 0) {
    return (
      <>
        <div className="dialogo-corpo">
          <p className="text-sm leading-relaxed text-fumaca">
            Você ainda não tem transcrição pronta. Importe no módulo de
            Transcrição o áudio que o cliente mandou no WhatsApp — o texto sai
            em segundos e volta para cá.
          </p>
          {erro && <p className="aviso aviso-erro mt-3 text-sm">{erro}</p>}
        </div>
        <div className="dialogo-rodape">
          <button type="button" onClick={aoFechar} className="btn btn-secundario">
            Fechar
          </button>
          <Link href="/admin/transcricoes" className="btn btn-primario">
            Ir para Transcrições
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="dialogo-corpo flex flex-col gap-3">
        {lista.map((t) => {
          const marcada = escolhida === t.id;
          return (
            <label
              key={t.id}
              className={`flex cursor-pointer items-start gap-3 rounded-sm border px-4 py-3 transition ${
                marcada ? "border-tinta bg-papel" : "border-nevoa hover:bg-papel"
              }`}
            >
              <input
                type="radio"
                name="transcricao"
                checked={marcada}
                onChange={() => setEscolhida(t.id)}
                disabled={montando}
                className="mt-1 shrink-0"
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-tinta">
                    {nomeDaTranscricao({
                      titulo: t.titulo,
                      arquivoNome: t.arquivoNome,
                      criadoEm: t.criadoEm,
                    })}
                  </span>
                  {t.virouOrcamento && (
                    <span className="selo selo-neutro">já usada</span>
                  )}
                </span>
                {t.previa && (
                  <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-cinza">
                    {t.previa}
                  </span>
                )}
              </span>
            </label>
          );
        })}

        {montando && (
          <p className="aviso aviso-atencao flex items-center gap-2 text-sm">
            <Girando />
            Montando a tabela… não feche esta tela.
          </p>
        )}
        {erro && <p className="aviso aviso-erro text-sm">{erro}</p>}
      </div>

      <div className="dialogo-rodape">
        <button
          type="button"
          onClick={aoFechar}
          disabled={montando}
          className="btn btn-secundario"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void usar()}
          disabled={!escolhida || montando}
          className={`btn ${montando ? "btn-carregando" : "btn-primario"}`}
        >
          {montando && <Girando />}
          {montando ? "Montando…" : "Trazer para a tabela"}
        </button>
      </div>
    </>
  );
}
