"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialogo } from "@/components/comum/dialogo";
import { Girando } from "@/components/comum/esqueleto";
import { Composer } from "@/components/comum/composer";
import { urlDeUpload } from "@/lib/orcamento/acoes-conversa";
import {
  montarTabelaDaFala,
  registrarAudioDaFala,
  registrarTextoDaFala,
  transcreverDaFala,
} from "@/lib/orcamento/acoes-fala";
import { extensaoPara, mimeBase } from "@/lib/audio/mime";
import type { BlocoGravado } from "@/lib/audio/recorder";

/**
 * Falar o orçamento e ver a tabela nascer.
 *
 * A queixa que originou esta tela: depois de parar a gravação, nada acontecia
 * na interface por vários segundos — upload, transcrição e IA rodavam em
 * silêncio, e não dava para distinguir "processando" de "travou".
 *
 * Aqui cada etapa é uma linha que muda de estado à vista. São três chamadas ao
 * servidor em vez de uma justamente por isso: o progresso precisa de degraus
 * para mostrar.
 *
 * Falhar no meio não perde o que já foi feito. Se a transcrição quebrar, o
 * áudio continua gravado; se a IA quebrar, a transcrição continua lá.
 */

/**
 * A etapa e o erro são estados separados, e isso importa.
 *
 * Juntá-los num só ("erro" como etapa) apagava a informação de **onde** parou:
 * a lista de progresso não tinha como marcar qual passo falhou, e a pessoa via
 * três linhas apagadas sem saber se o áudio subiu. Com os dois separados,
 * `etapa` continua apontando o passo que quebrou e `erro` diz o motivo.
 */
type Passo = "enviando" | "transcrevendo" | "montando";
type Etapa = Passo | "pronto";

const ROTULOS: Record<Etapa, string> = {
  enviando: "Enviando o áudio",
  transcrevendo: "Transcrevendo o que você falou",
  montando: "Montando a tabela",
  pronto: "Pronto",
};

const ORDEM: Passo[] = ["enviando", "transcrevendo", "montando"];

export function FalarOrcamento({
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
      titulo="Falar o orçamento"
      descricao="Conte o serviço como se estivesse explicando para um colega. A IA quebra o que você falou em linhas da tabela."
    >
      {/* Remonta a cada abertura: o progresso de uma gravação anterior não
          reaparece na próxima. */}
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
  const [etapa, setEtapa] = useState<Etapa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [transcricao, setTranscricao] = useState<string | null>(null);
  /**
   * O bloco desta fala, guardado assim que o áudio sobe.
   *
   * É o que permite "tentar de novo" retomar do passo que quebrou em vez de
   * mandar gravar tudo outra vez. A transcrição é o passo mais frágil da
   * corrente — depende de provedor externo — e o áudio já está salvo no
   * Storage quando ela falha. Perder a gravação por causa disso era a parte
   * cara do erro.
   */
  const [blocoId, setBlocoId] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    criados: number;
    entendido: string;
    faltando: string[];
  } | null>(null);

  async function subirAudio(bloco: BlocoGravado): Promise<string | null> {
    // O servidor valida pelo mime base; o codec entre parâmetros quebraria a
    // comparação com a lista de aceitos.
    const base = mimeBase(bloco.mimeEscolhido);
    const permissao = await urlDeUpload({
      orcamentoId,
      tipo: "audio",
      mimeType: base,
      extensao: extensaoPara(base),
      tamanhoBytes: bloco.blob.size,
    });
    if (!permissao.ok) {
      setErro(permissao.erro);
      return null;
    }

    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { error } = await sb.storage
      .from(permissao.bucket)
      .uploadToSignedUrl(permissao.caminho, permissao.token, bloco.blob, {
        contentType: base,
      });

    if (error) {
      setErro(`Falha ao enviar o áudio: ${error.message}`);
      return null;
    }
    return permissao.caminho;
  }

  /**
   * Transforma qualquer exceção em erro visível na etapa onde parou.
   *
   * Sem isto a tela congelava: se a Server Action **lançasse** em vez de
   * devolver `{ ok: false }` — conexão do celular que cai, resposta cortada
   * pelo limite de execução da função — a promessa rejeitava, nenhum
   * `setErro` rodava, e o progresso ficava girando em "Transcrevendo" para
   * sempre. Aconteceu em produção: o servidor gravou o erro no banco aos 61s e
   * o aparelho nunca soube.
   */
  async function protegido(trabalho: () => Promise<void>) {
    try {
      await trabalho();
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : String(e);
      setErro(
        `A conexão caiu no meio do processo (${mensagem}). O que já foi enviado está salvo — dá para tentar de novo.`,
      );
    }
  }

  /** Da transcrição em diante. Serve para o primeiro envio e para o retry. */
  async function transcreverEMontar(bloco: string) {
    setEtapa("transcrevendo");
    const texto = await transcreverDaFala({ orcamentoId, blocoId: bloco });
    if (!texto.ok) return setErro(texto.erro);
    setTranscricao(texto.texto);

    setEtapa("montando");
    // O mesmo `blocoId` do passo anterior: é ele que diz à IA qual fala virar
    // item. Mandar só o orçamento fazia o servidor reprocessar tudo que já
    // tinha sido dito e duplicar a tabela inteira.
    const tabela = await montarTabelaDaFala(orcamentoId, bloco);
    if (!tabela.ok) return setErro(tabela.erro);

    setResultado({
      criados: tabela.criados,
      entendido: tabela.entendido,
      faltando: tabela.faltando,
    });
    setEtapa("pronto");
    router.refresh();
  }

  /** O caminho completo: áudio → transcrição → tabela. */
  async function processarAudio(gravado: BlocoGravado) {
    setErro(null);
    setResultado(null);
    setTranscricao(null);
    setBlocoId(null);

    await protegido(async () => {
      // A etapa fica onde parou. Quem marca a falha é o `erro`, e é por isso
      // que a lista mostra qual passo quebrou em vez de apagar todos.
      setEtapa("enviando");
      const caminho = await subirAudio(gravado);
      if (!caminho) return;

      const registro = await registrarAudioDaFala({
        orcamentoId,
        caminho,
        mimeType: mimeBase(gravado.mimeEscolhido),
        duracaoMs: gravado.duracaoMs,
      });
      if (!registro.ok) return setErro(registro.erro);

      setBlocoId(registro.blocoId);
      await transcreverEMontar(registro.blocoId);
    });
  }

  async function processarTexto(texto: string) {
    setErro(null);
    setResultado(null);
    setBlocoId(null);

    await protegido(async () => {
      setEtapa("montando");
      const registro = await registrarTextoDaFala({ orcamentoId, texto });
      if (!registro.ok) return setErro(registro.erro);

      setBlocoId(registro.blocoId);
      const tabela = await montarTabelaDaFala(orcamentoId, registro.blocoId);
      if (!tabela.ok) return setErro(tabela.erro);

      setResultado({
        criados: tabela.criados,
        entendido: tabela.entendido,
        faltando: tabela.faltando,
      });
      setEtapa("pronto");
      router.refresh();
    });
  }

  /** Retoma do passo que quebrou, sem pedir para gravar de novo. */
  async function tentarDeNovo() {
    setErro(null);
    if (!blocoId) {
      setEtapa(null);
      return;
    }
    await protegido(() => transcreverEMontar(blocoId));
  }

  // ---------- Resultado ----------
  if (etapa === "pronto" && resultado) {
    return (
      <>
        <div className="dialogo-corpo flex flex-col gap-4">
          <p className="aviso aviso-ok text-sm">
            <span>
              <strong className="block">
                {resultado.criados}{" "}
                {resultado.criados === 1
                  ? "item entrou na tabela"
                  : "itens entraram na tabela"}
              </strong>
              Confira e ajuste o que precisar — tudo é editável.
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
          <button
            type="button"
            onClick={() => {
              setEtapa(null);
              setResultado(null);
            }}
            className="btn btn-secundario"
          >
            Falar mais
          </button>
          <button type="button" onClick={aoFechar} className="btn btn-primario">
            Ver a tabela
          </button>
        </div>
      </>
    );
  }

  // ---------- Progresso ----------
  const emAndamento = etapa !== null && etapa !== "pronto";

  if (emAndamento) {
    const indiceAtual = ORDEM.indexOf(etapa as Passo);
    const falhou = erro !== null;

    return (
      <>
        <div className="dialogo-corpo flex flex-col gap-4">
          <ul className="flex flex-col gap-3">
            {ORDEM.map((passo, i) => {
              const feito = i < indiceAtual;
              const agora = i === indiceAtual;
              return (
                <li key={passo} className="flex items-center gap-3 text-sm">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    {feito && <Certo />}
                    {agora && (falhou ? <Cruz /> : <Girando />)}
                    {!agora && !feito && (
                      <span className="h-2 w-2 rounded-full bg-cinza-200" />
                    )}
                  </span>
                  <span className={feito || agora ? "text-tinta" : "text-cinza-400"}>
                    {ROTULOS[passo]}
                  </span>
                </li>
              );
            })}
          </ul>

          {transcricao && (
            <div className="border-t border-cinza-100 pt-4">
              <p className="rotulo mb-1">Transcrição</p>
              <p className="text-sm leading-relaxed text-fumaca">
                {transcricao}
              </p>
            </div>
          )}

          {falhou && (
            <>
              <p className="aviso aviso-erro text-sm">{erro}</p>
              {blocoId && (
                <p className="text-xs leading-relaxed text-cinza">
                  Sua gravação está guardada. Tentar de novo continua de onde
                  parou, sem precisar falar outra vez.
                </p>
              )}
            </>
          )}

          {!falhou && (
            <p className="text-xs text-cinza">
              Isso leva alguns segundos. Pode deixar a tela aberta — o que já
              foi feito está salvo.
            </p>
          )}
        </div>

        <div className="dialogo-rodape">
          {falhou ? (
            <>
              <button
                type="button"
                onClick={aoFechar}
                className="btn btn-secundario"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => void tentarDeNovo()}
                className="btn btn-primario"
              >
                Tentar de novo
              </button>
            </>
          ) : (
            <button type="button" disabled className="btn btn-carregando">
              <Girando />
              Trabalhando…
            </button>
          )}
        </div>
      </>
    );
  }

  // ---------- Gravação ----------
  return (
    <>
      <div className="dialogo-corpo flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-fumaca">
          Diga o que o cliente pediu, onde é, o que precisa ser feito, as
          medidas que você já sabe e os preços que já tem na cabeça. Quanto mais
          número você falar, menos sobra para preencher depois.
        </p>

        {erro && <p className="aviso aviso-erro text-sm">{erro}</p>}

        <Composer
          ocupado={false}
          destaque="audio"
          enviarTexto={processarTexto}
          enviarAudio={processarAudio}
          enviarImagem={async () => {
            setErro(
              "Foto ainda não entra na montagem da tabela — a IA não vê imagem. Use o áudio ou o texto.",
            );
          }}
        />
      </div>

      <div className="dialogo-rodape">
        <button type="button" onClick={aoFechar} className="btn btn-secundario">
          Cancelar
        </button>
      </div>
    </>
  );
}

function Certo() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 fill-none stroke-arroio"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12.5 9.5 18 20 6.5" />
    </svg>
  );
}

function Cruz() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 fill-none stroke-atraso"
      strokeWidth={2.5}
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
