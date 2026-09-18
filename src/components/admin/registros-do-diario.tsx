"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Composer } from "@/components/comum/composer";
import {
  apagarRegistro,
  registrarAudioDoDiario,
  registrarTextoDoDiario,
  transcreverRegistro,
  urlParaAudioDoDiario,
} from "@/lib/diario/acoes-registros";
import { extensaoPara, mimeBase } from "@/lib/audio/mime";
import { formatarDuracao, type BlocoGravado } from "@/lib/audio/recorder";
import type { RegistroDoDia } from "@/lib/diario/dados";

/**
 * Os registros do dia: fala ou escreve, e fica guardado na hora.
 *
 * **É aqui que "salvar rascunhos automaticamente" se cumpre**, e não num
 * temporizador: o que a pessoa falou ou digitou vira linha no banco no
 * instante em que entra, antes de qualquer resumo. Se a transcrição falhar,
 * o áudio continua no Storage; se a IA falhar, os registros continuam aqui.
 *
 * Três chamadas ao servidor para um áudio, e não uma, pelo motivo já
 * aprendido no "Falar orçamento": depois de parar a gravação, uma chamada só
 * deixava a tela parada por vários segundos sem distinguir "processando" de
 * "travou". Cada passo mostra o seu degrau.
 */

const ROTULO: Record<RegistroDoDia["status"], string> = {
  pendente: "Na fila",
  transcrevendo: "Transcrevendo",
  pronto: "Pronto",
  falhou: "Falhou",
};

const COR: Record<RegistroDoDia["status"], string> = {
  pendente: "selo-neutro",
  transcrevendo: "selo-planejado",
  pronto: "selo-emdia",
  falhou: "selo-atraso",
};

const HORA = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

export function RegistrosDoDiario({
  dia,
  registros,
}: {
  dia: string;
  registros: RegistroDoDia[];
}) {
  const router = useRouter();
  const [passo, setPasso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);

  const ocupado = passo !== null;

  async function enviarTexto(texto: string) {
    setErro(null);
    setPasso("Guardando");
    try {
      const saida = await registrarTextoDoDiario({ dia, texto });
      if (!saida.ok) setErro(saida.erro);
      else router.refresh();
    } finally {
      setPasso(null);
    }
  }

  async function enviarAudio(bloco: BlocoGravado) {
    setErro(null);
    try {
      setPasso("Enviando o áudio");

      // O servidor valida pelo mime base; o codec entre parâmetros quebraria
      // a comparação com a lista de aceitos.
      const base = mimeBase(bloco.mimeEscolhido);
      const permissao = await urlParaAudioDoDiario({
        mimeType: base,
        extensao: extensaoPara(base),
        tamanhoBytes: bloco.blob.size,
      });
      if (!permissao.ok) return setErro(permissao.erro);

      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      const { error } = await sb.storage
        .from(permissao.bucket)
        .uploadToSignedUrl(permissao.caminho, permissao.token, bloco.blob, {
          contentType: base || "application/octet-stream",
        });
      if (error) return setErro(`Falha ao enviar: ${error.message}`);

      const registro = await registrarAudioDoDiario({
        dia,
        caminho: permissao.caminho,
        mimeType: base,
        tamanhoBytes: bloco.blob.size,
        duracaoMs: bloco.duracaoMs,
      });
      if (!registro.ok) return setErro(registro.erro);

      // O áudio já está salvo a partir daqui. A transcrição pode falhar sem
      // custar a gravação, e a lista mostra o botão de tentar de novo.
      router.refresh();

      setPasso("Transcrevendo");
      const saida = await transcreverRegistro(registro.id);
      if (!saida.ok) setErro(saida.erro);
      router.refresh();
    } finally {
      setPasso(null);
    }
  }

  async function tentarDeNovo(id: string) {
    setErro(null);
    setPasso("Transcrevendo");
    try {
      const saida = await transcreverRegistro(id);
      if (!saida.ok) setErro(saida.erro);
      router.refresh();
    } finally {
      setPasso(null);
    }
  }

  async function apagar(id: string) {
    setApagando(id);
    try {
      const saida = await apagarRegistro(id);
      if (!saida.ok) setErro(saida.erro ?? "Não consegui apagar o registro.");
      else router.refresh();
    } finally {
      setApagando(null);
    }
  }

  return (
    <section className="cartao overflow-hidden">
      <div className="px-5 pt-5">
        <p className="rotulo">Registros do dia</p>
        <p className="mt-1.5 text-xs leading-relaxed text-cinza">
          Fale ou escreva ao longo do dia. Cada registro fica guardado na hora,
          e nada disto aparece no link: é o material que a IA organiza depois.
        </p>
      </div>

      {/* A explicação do ciclo só existe enquanto não há o que ver. Quando a
          lista enche ela some sozinha — mesma regra do `Vazio` do painel. */}
      {registros.length === 0 && (
        <p className="mt-4 px-5 text-sm leading-relaxed text-cinza">
          Nada registrado ainda neste dia. Toque no microfone e conte o que
          andou, ou escreva. Depois, em <strong>Gerar resumo</strong>, a IA
          organiza tudo nas quatro seções — e você lê antes de publicar.
        </p>
      )}

      {registros.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2 px-5">
          {registros.map((r) => (
            <li
              key={r.id}
              className="rounded-sm border border-nevoa bg-white px-4 py-3"
            >
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="rotulo">{HORA.format(new Date(r.criadoEm))}</span>

                {r.tipo === "audio" && (
                  <>
                    <span className="selo selo-neutro">
                      áudio
                      {r.duracaoMs ? ` ${formatarDuracao(r.duracaoMs)}` : ""}
                    </span>
                    {r.status !== "pronto" && (
                      <span className={`selo ${COR[r.status]}`}>
                        {ROTULO[r.status]}
                      </span>
                    )}
                  </>
                )}

                <button
                  type="button"
                  onClick={() => void apagar(r.id)}
                  disabled={apagando === r.id}
                  className="btn-texto ml-auto shrink-0 text-xs"
                >
                  {apagando === r.id ? "Apagando…" : "Apagar"}
                </button>
              </div>

              {r.texto ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-grafite">
                  {r.texto}
                </p>
              ) : r.status === "falhou" ? (
                <p className="text-sm leading-relaxed text-atraso">
                  {r.erro ?? "A transcrição falhou."}{" "}
                  <button
                    type="button"
                    onClick={() => void tentarDeNovo(r.id)}
                    disabled={ocupado}
                    className="btn-texto text-sm"
                  >
                    Tentar de novo
                  </button>
                </p>
              ) : (
                <p className="text-sm text-cinza italic">
                  O áudio está guardado. Transcrição ainda não disponível.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {erro && (
        <p className="aviso aviso-erro mx-5 mt-4">{erro}</p>
      )}

      {passo && (
        <p className="mx-5 mt-4 text-sm text-fumaca">{passo}…</p>
      )}

      {/* Sem `enviarImagem`: o Diário aceita áudio e texto, e só. Ver o
          comentário no Composer e a §5 do PRD-DIARIO.md. */}
      <div className="mt-4 border-t border-cinza-100 px-5 pt-4 pb-5">
        <Composer
          enviarTexto={enviarTexto}
          enviarAudio={enviarAudio}
          ocupado={ocupado}
          semMoldura
        />
      </div>
    </section>
  );
}
