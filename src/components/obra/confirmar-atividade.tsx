"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Composer } from "@/components/comum/composer";
import { PlayerDeAudio } from "@/components/comum/player-audio";
import { extensaoPara } from "@/lib/audio/mime";
import type { BlocoGravado } from "@/lib/audio/recorder";
import { reduzirImagem } from "@/lib/imagem";
import { supabaseBrowser } from "@/lib/supabase/browser";
// `import type` some na compilação, então puxar de um módulo server-only não
// arrasta a service key para o bundle.
import type { DiaDoMestre } from "@/lib/obra/dados";
import type { Enums } from "@/lib/database.types";

/**
 * Confirmar um serviço do dia.
 *
 * Cabeçalho escuro com o serviço, os números navegáveis e o "Próximo"; o
 * rodapé é só entrada. A gramática é a do WhatsApp, que é o único aplicativo
 * que o mestre usa o dia inteiro.
 */

type Pendente = {
  id: string;
  previa: string;
  estado: "enviando" | "salvo" | "erro";
  tentar: () => Promise<void>;
};

/** "pendente" é o estado inicial, não uma escolha: fora da lista de botões. */
type Escolha = Exclude<Enums<"confirmacao_status">, "pendente">;

const OPCOES: { valor: Escolha; rotulo: string; nota: string }[] = [
  { valor: "feita", rotulo: "Feita", nota: "Terminou hoje" },
  { valor: "parcial", rotulo: "Parcial", nota: "Começou, falta terminar" },
  { valor: "nao_feita", rotulo: "Não deu", nota: "Não foi possível" },
];

const COR_OPCAO = {
  feita: "border-limao bg-limao text-limao-tinta",
  parcial: "border-azul bg-azul text-white",
  nao_feita: "border-alerta bg-alerta text-alerta-tinta",
} as const;

export function ConfirmarAtividade({
  token,
  dados,
  atividadeId,
}: {
  token: string;
  dados: DiaDoMestre;
  atividadeId: string;
}) {
  const router = useRouter();
  const { obra, atividades } = dados;

  const posicao = atividades.findIndex((a) => a.id === atividadeId);
  const atividade = atividades[posicao];
  const total = atividades.length;
  const ultima = posicao >= total - 1;

  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [salvandoStatus, setSalvandoStatus] = useState(false);
  const [navegando, iniciarNavegacao] = useTransition();
  const [destino, setDestino] = useState<string | null>(null);

  // O card provisório sai quando o real chega do servidor.
  useEffect(() => {
    setPendentes((atual) => atual.filter((p) => p.estado !== "salvo"));
  }, [atividade?.blocos]);

  function registrarPendente(previa: string, acao: () => Promise<Response>) {
    const id = crypto.randomUUID();

    const tentar = async () => {
      setPendentes((atual) =>
        atual.map((p) => (p.id === id ? { ...p, estado: "enviando" } : p)),
      );
      try {
        const resposta = await acao();
        if (!resposta.ok) throw new Error(String(resposta.status));
        setPendentes((atual) =>
          atual.map((p) => (p.id === id ? { ...p, estado: "salvo" } : p)),
        );
        router.refresh();
      } catch {
        setPendentes((atual) =>
          atual.map((p) => (p.id === id ? { ...p, estado: "erro" } : p)),
        );
      }
    };

    setPendentes((atual) => [...atual, { id, previa, estado: "enviando", tentar }]);
    return tentar();
  }

  async function marcar(status: Escolha) {
    if (salvandoStatus) return;
    setSalvandoStatus(true);
    await fetch(`/api/o/${token}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ atividadeId, status }),
    }).catch(() => {});
    setSalvandoStatus(false);
    router.refresh();
  }

  async function enviarTexto(texto: string) {
    await registrarPendente(texto, () =>
      fetch(`/api/o/${token}/blocos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ atividadeId, tipo: "text", texto }),
      }),
    );
  }

  /** Upload em duas etapas: URL assinada, bytes direto ao Storage, depois o registro. */
  async function enviarMidia(
    blob: Blob,
    tipo: "audio" | "image",
    mimeType: string,
    extensao: string,
    duracaoMs?: number,
  ) {
    const enviar = async () => {
      const pedido = await fetch(`/api/o/${token}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          atividadeId,
          tipo,
          mimeType,
          extensao,
          tamanhoBytes: blob.size,
        }),
      });
      if (!pedido.ok) return pedido;

      const dadosUpload = await pedido.json();
      const { error } = await supabaseBrowser()
        .storage.from(dadosUpload.bucket)
        .uploadToSignedUrl(dadosUpload.caminho, dadosUpload.token, blob, {
          contentType: mimeType,
        });
      if (error) return new Response(null, { status: 502 });

      return fetch(`/api/o/${token}/blocos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          atividadeId,
          tipo,
          storagePath: dadosUpload.caminho,
          mimeType,
          duracaoMs,
        }),
      });
    };

    await registrarPendente(tipo === "audio" ? "Áudio" : "Foto", enviar);
  }

  async function enviarAudio(bloco: BlocoGravado) {
    await enviarMidia(
      bloco.blob,
      "audio",
      bloco.mimeEscolhido,
      extensaoPara(bloco.mimeEscolhido),
      bloco.duracaoMs,
    );
  }

  async function enviarImagem(arquivo: File) {
    const { blob, mimeType, extensao } = await reduzirImagem(arquivo);
    await enviarMidia(blob, "image", mimeType, extensao);
  }

  async function remover(id: string) {
    setRemovendo(id);
    await fetch(`/api/o/${token}/blocos/${id}`, { method: "DELETE" }).catch(() => {});
    setRemovendo(null);
    router.refresh();
  }

  function irPara(id: string) {
    if (id === atividadeId || navegando) return;
    setDestino(id);
    iniciarNavegacao(() => router.push(`/o/${token}/a/${id}`));
  }

  function avancar() {
    if (navegando) return;
    setDestino(ultima ? null : atividades[posicao + 1].id);
    iniciarNavegacao(() =>
      router.push(ultima ? `/o/${token}` : `/o/${token}/a/${atividades[posicao + 1].id}`),
    );
  }

  function voltar() {
    if (navegando) return;
    setDestino(null);
    iniciarNavegacao(() =>
      router.push(posicao > 0 ? `/o/${token}/a/${atividades[posicao - 1].id}` : `/o/${token}`),
    );
  }

  if (!atividade) return null;

  const temFoto = atividade.blocos.some((b) => b.type === "image");
  const marcado = atividade.status !== "pendente";

  return (
    // h-dvh, não min-h: é isso que prende o composer embaixo.
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="relative shrink-0 rounded-b-[2rem] bg-tinta px-5 pt-5 pb-6 md:px-8 md:pt-7 md:pb-8">
        {navegando && (
          <span className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-fumaca">
            <span className="animate-barra block h-full w-1/3 bg-limao" />
          </span>
        )}

        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={voltar}
            disabled={navegando}
            aria-label="Voltar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-papel/25 disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-papel" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
          </button>

          <p className="rotulo min-w-0 flex-1 truncate text-center">
            {obra.nome}
          </p>

          <button
            type="button"
            onClick={avancar}
            disabled={navegando}
            className={`flex h-10 shrink-0 items-center gap-2 rounded-full pr-3 pl-5 text-sm font-semibold transition ${
              marcado
                ? "bg-limao text-tinta active:scale-[0.98] disabled:opacity-60"
                : "border border-papel/20 text-papel/70"
            }`}
          >
            {ultima ? "Concluir" : "Próximo"}
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              {ultima ? <path d="M4 12.5 9.5 18 20 6.5" /> : <path d="M5 12h14M13 6l6 6-6 6" />}
            </svg>
          </button>
        </div>

        {/* Clicáveis: dá para pular para qualquer serviço, em qualquer ordem. */}
        <ol className="mx-auto mt-5 flex w-full max-w-2xl gap-2 overflow-x-auto pb-1">
          {atividades.map((a, i) => {
            const indo = navegando && destino === a.id;
            const atual = a.id === atividadeId;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => irPara(a.id)}
                  disabled={navegando}
                  aria-current={atual ? "step" : undefined}
                  aria-label={`Ir para o serviço ${i + 1}${
                    a.status !== "pendente" ? ", já confirmado" : ""
                  }`}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-xs transition ${
                    indo ? "animate-pulse bg-limao text-tinta" : ""
                  } ${
                    !indo && atual
                      ? "bg-azul text-white"
                      : !indo && a.status !== "pendente"
                        ? "bg-papel text-tinta active:scale-95 md:hover:bg-white"
                        : !indo
                          ? "border border-fumaca text-cinza active:scale-95 md:hover:border-nevoa md:hover:text-nevoa"
                          : ""
                  } ${navegando && !indo ? "opacity-40" : ""}`}
                >
                  {i + 1}
                </button>
              </li>
            );
          })}
        </ol>

        <div className="mx-auto w-full max-w-2xl">
          <p className="rotulo mt-5">
            Serviço {posicao + 1} de {total}
          </p>
          <h1 className="mt-2 font-serif text-[1.6rem] leading-tight text-papel md:text-3xl">
            {atividade.titulo}
          </h1>
          {atividade.detalhe && (
            <p className="mt-2 text-sm leading-relaxed text-nevoa md:text-base">
              {atividade.detalhe}
            </p>
          )}
        </div>
      </header>

      <div
        className={`min-h-0 flex-1 overflow-y-auto px-4 py-5 transition-opacity md:px-8 ${
          navegando ? "opacity-50" : ""
        }`}
      >
        <div className="mx-auto w-full max-w-2xl">
          <p className="rotulo mb-3">Como ficou</p>
          <div className="grid grid-cols-3 gap-2">
            {OPCOES.map((o) => {
              const escolhido = atividade.status === o.valor;
              return (
                <button
                  key={o.valor}
                  type="button"
                  onClick={() => void marcar(o.valor)}
                  disabled={salvandoStatus}
                  aria-pressed={escolhido}
                  className={`rounded-3xl border-2 px-3 py-4 text-center transition active:scale-[0.98] disabled:opacity-60 ${
                    escolhido ? COR_OPCAO[o.valor] : "border-nevoa bg-white text-tinta"
                  }`}
                >
                  <span className="block leading-tight font-semibold">
                    {o.rotulo}
                  </span>
                  <span
                    className={`mt-1 block text-[0.7rem] leading-tight ${
                      escolhido ? "opacity-80" : "text-cinza"
                    }`}
                  >
                    {o.nota}
                  </span>
                </button>
              );
            })}
          </div>

          {marcado && !temFoto && (
            <p className="mt-4 rounded-2xl bg-alerta/20 px-4 py-3 text-sm leading-relaxed text-alerta-tinta">
              Falta a foto. É ela que vai no relatório do cliente como prova do
              serviço.
            </p>
          )}

          <p className="rotulo mt-7 mb-3">O que você mandou</p>

          {atividade.blocos.length === 0 && pendentes.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-nevoa bg-white px-5 py-8 text-center text-sm leading-relaxed text-cinza">
              Mande uma foto do serviço. Se quiser explicar alguma coisa, grave
              um áudio, é mais rápido que escrever.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {atividade.blocos.map((b) => (
                <li
                  key={b.id}
                  className={`rounded-3xl border border-nevoa/70 bg-white px-4 py-3.5 transition-opacity ${
                    removendo === b.id ? "opacity-40" : ""
                  }`}
                >
                  {b.type === "text" && (
                    <p className="text-[0.95rem] leading-relaxed whitespace-pre-wrap text-tinta">
                      {b.texto}
                    </p>
                  )}
                  {b.type === "audio" && (
                    <PlayerDeAudio src={b.url} duracaoMs={b.duracaoMs} />
                  )}
                  {b.type === "image" && b.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.url}
                      alt="Foto do serviço"
                      className="max-h-80 w-full rounded-2xl object-cover"
                    />
                  )}

                  <div className="mt-2.5 flex items-center justify-between border-t border-nevoa/50 pt-2.5">
                    <span className="rotulo">
                      {b.type === "image" ? "Foto" : b.type === "audio" ? "Áudio" : "Texto"}
                    </span>
                    <button
                      type="button"
                      onClick={() => void remover(b.id)}
                      disabled={removendo === b.id}
                      className="font-mono text-[0.65rem] tracking-widest text-cinza uppercase underline underline-offset-2"
                    >
                      {removendo === b.id ? "apagando" : "apagar"}
                    </button>
                  </div>
                </li>
              ))}

              {pendentes.map((p) => (
                <li
                  key={p.id}
                  className="rounded-3xl border border-nevoa/70 bg-white/70 px-4 py-3.5"
                >
                  <p className="text-[0.95rem] leading-relaxed whitespace-pre-wrap text-fumaca">
                    {p.previa}
                  </p>
                  <div className="mt-2.5 flex items-center gap-3 border-t border-nevoa/50 pt-2.5">
                    {p.estado === "erro" ? (
                      <>
                        <span className="rotulo !text-alerta-tinta">
                          não foi enviado
                        </span>
                        <button
                          type="button"
                          onClick={() => void p.tentar()}
                          className="acao-texto text-azul"
                        >
                          tentar de novo
                        </button>
                      </>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-nevoa border-t-azul" />
                        <span className="rotulo">
                          {p.estado === "salvo" ? "salvo" : "enviando"}
                        </span>
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Composer
        enviarTexto={enviarTexto}
        enviarAudio={enviarAudio}
        enviarImagem={enviarImagem}
        ocupado={navegando}
        destaque="foto"
      />
    </div>
  );
}
