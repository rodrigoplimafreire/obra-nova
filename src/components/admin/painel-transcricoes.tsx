"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cabecalho, Conteudo, Secao, Vazio } from "./cabecalho";
import { Girando } from "@/components/comum/esqueleto";
import { CenaProcessando } from "@/components/comum/ilustracoes";
import {
  registrarImportacao,
  transcreverAvulsa,
  urlParaImportar,
} from "@/lib/transcricao/acoes-avulsas";
import {
  nomeDaTranscricao,
  type ResumoDeTranscricao,
  type StatusDaTranscricao,
} from "@/lib/transcricao/tipos";
// Mesma função do gravador: duração se formata num lugar só.
import { formatarDuracao } from "@/lib/audio/recorder";

/**
 * A lista de áudios importados.
 *
 * A importação é o único jeito de criar aqui, então ela é a ação principal e
 * não mora atrás de diálogo: escolher arquivo já abre o seletor do sistema.
 */

const ROTULO: Record<StatusDaTranscricao, string> = {
  pendente: "Na fila",
  transcrevendo: "Transcrevendo",
  pronta: "Pronta",
  falhou: "Falhou",
};

const COR: Record<StatusDaTranscricao, string> = {
  pendente: "selo-neutro",
  transcrevendo: "selo-planejado",
  pronta: "selo-emdia",
  falhou: "selo-atraso",
};

/** Os formatos que o WhatsApp entrega, mais os comuns de gravador. */
const ACEITOS = ".opus,.ogg,.m4a,.mp3,.mp4,.wav,.webm,.aac,.flac,audio/*";

export function PainelDeTranscricoes({
  transcricoes,
}: {
  transcricoes: ResumoDeTranscricao[];
}) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);
  const [passo, setPasso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function importar(arquivo: File) {
    setErro(null);
    setImportando(true);
    try {
      setPasso("Enviando o áudio");

      const extensao = arquivo.name.split(".").pop()?.toLowerCase() ?? "";
      const permissao = await urlParaImportar({
        mimeType: arquivo.type,
        extensao,
        tamanhoBytes: arquivo.size,
      });
      if (!permissao.ok) return setErro(permissao.erro);

      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      const { error } = await sb.storage
        .from(permissao.bucket)
        .uploadToSignedUrl(permissao.caminho, permissao.token, arquivo, {
          // O `.opus` do WhatsApp chega com tipo vazio; sem um valor aqui o
          // Storage grava como `text/plain` e o download depois vem corrompido.
          contentType: arquivo.type || "application/octet-stream",
        });
      if (error) return setErro(`Falha ao enviar: ${error.message}`);

      const registro = await registrarImportacao({
        caminho: permissao.caminho,
        arquivoNome: arquivo.name,
        mimeType: arquivo.type,
        tamanhoBytes: arquivo.size,
        duracaoMs: await medirDuracao(arquivo),
      });
      if (!registro.ok) return setErro(registro.erro);

      setPasso("Transcrevendo");
      const saida = await transcreverAvulsa(registro.id);

      // Mesmo falhando a transcrição, o áudio está salvo e a linha existe: a
      // pessoa vai para a tela dele e tenta de novo de lá.
      router.push(`/admin/transcricoes/${registro.id}`);
      if (!saida.ok) setErro(saida.erro);
    } catch (e) {
      // Server Action que lança — conexão que cai no meio do upload — rejeita
      // a promessa. Sem captura a tela ficaria girando sem dizer nada.
      setErro(
        `A conexão caiu no meio do envio (${e instanceof Error ? e.message : String(e)}).`,
      );
    } finally {
      setImportando(false);
      setPasso(null);
    }
  }

  return (
    <>
      <Cabecalho
        titulo="Transcrições"
        meta={`${transcricoes.length} ${transcricoes.length === 1 ? "áudio" : "áudios"}`}
        acoes={
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            disabled={importando}
            aria-label="Importar áudio"
            className={`btn btn-icone sm:w-auto sm:px-5 ${importando ? "btn-carregando" : "btn-primario"}`}
          >
            {importando ? <Girando /> : <IconeImportar />}
            <span className="hidden sm:inline">
              {importando ? (passo ?? "Enviando…") : "Importar áudio"}
            </span>
          </button>
        }
      />

      <input
        ref={entrada}
        type="file"
        accept={ACEITOS}
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          // Zera já: sem isto, escolher o mesmo arquivo de novo não dispara
          // `change` e o botão parece morto.
          e.target.value = "";
          if (arquivo) void importar(arquivo);
        }}
        className="hidden"
      />

      <Conteudo>
        {erro && <p className="aviso aviso-erro mb-4 text-sm">{erro}</p>}

        {importando && (
          <p className="aviso aviso-atencao mb-4 flex items-center gap-2 text-sm">
            <Girando />
            {passo}… não feche esta tela.
          </p>
        )}

        <Secao titulo="Áudios">
          {transcricoes.length === 0 ? (
            <Vazio
              titulo="Nenhum áudio ainda"
              ilustracao={<CenaProcessando />}
              acao={
                <button
                  type="button"
                  onClick={() => entrada.current?.click()}
                  className="btn btn-primario"
                >
                  Importar o primeiro
                </button>
              }
            >
              Baixe o áudio que o cliente mandou no WhatsApp e traga aqui. A
              transcrição sai em segundos, e dela nasce o orçamento.
            </Vazio>
          ) : (
            <ul className="flex flex-col gap-3">
              {transcricoes.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/admin/transcricoes/${t.id}`}
                    className="flex flex-col gap-2 rounded-lg border border-nevoa bg-white px-5 py-4 transition md:hover:border-tinta"
                  >
                    <span className="flex flex-wrap items-center justify-between gap-3">
                      <span className="min-w-0 text-base leading-tight font-semibold text-tinta">
                        {nomeDaTranscricao({
                          titulo: t.titulo,
                          arquivoNome: t.arquivoNome,
                          criadoEm: t.criadoEm,
                        })}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {t.virouOrcamento && (
                          <span className="selo selo-neutro">virou orçamento</span>
                        )}
                        <span className={`selo ${COR[t.status]}`}>
                          {ROTULO[t.status]}
                        </span>
                      </span>
                    </span>

                    {t.previa && (
                      <span className="line-clamp-2 text-sm leading-relaxed text-fumaca">
                        {t.previa}
                      </span>
                    )}

                    <span className="font-mono text-[0.65rem] tracking-widest text-cinza uppercase">
                      {new Date(t.criadoEm).toLocaleDateString("pt-BR")}
                      {t.duracaoMs ? ` · ${formatarDuracao(t.duracaoMs)}` : ""}
                      {t.editado ? " · editado" : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Secao>
      </Conteudo>
    </>
  );
}

/**
 * A duração do áudio, lida no navegador.
 *
 * Serve só para a lista dizer "3m12" — se falhar, a linha existe do mesmo
 * jeito. Por isso resolve com `null` em vez de rejeitar: um metadado bonito
 * não pode impedir a importação de um arquivo que o Whisper leria bem.
 */
function medirDuracao(arquivo: File): Promise<number | null> {
  return new Promise((resolver) => {
    try {
      const url = URL.createObjectURL(arquivo);
      const audio = new Audio();
      const limpar = () => URL.revokeObjectURL(url);

      const desistir = setTimeout(() => {
        limpar();
        resolver(null);
      }, 4000);

      audio.addEventListener("loadedmetadata", () => {
        clearTimeout(desistir);
        const ms = Number.isFinite(audio.duration)
          ? Math.round(audio.duration * 1000)
          : null;
        limpar();
        resolver(ms);
      });
      audio.addEventListener("error", () => {
        clearTimeout(desistir);
        limpar();
        resolver(null);
      });

      audio.preload = "metadata";
      audio.src = url;
    } catch {
      resolver(null);
    }
  });
}

function IconeImportar() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 15V3M7 8l5-5 5 5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
