"use client";

import { useActionState, useRef, useState } from "react";
import { Dica } from "@/components/comum/dica";
import { Girando } from "@/components/comum/esqueleto";
import {
  enviarMidia,
  excluirMidia,
  renomearMidia,
} from "@/lib/orcamento/acoes-midias";
import type { Resultado } from "@/lib/admin/tipos";
import type { MidiaDoOrcamento, OrcamentoCompleto } from "@/lib/orcamento/dados";

/**
 * As fotos e o vídeo da situação atual, no cartão do orçamento.
 *
 * É o "antes" da obra: a proposta abre com ele, e o cliente reconhece a própria
 * casa antes de ver qualquer número. As propostas escritas à mão da RD sempre
 * fizeram assim — o Terras Brasilis mostra três fotos e um vídeo da cobertura,
 * e o texto os chama de "a base técnica usada para fechar este orçamento".
 *
 * **A legenda não é enfeite.** "Cobertura existente · vista superior" diz ao
 * cliente o que ele está olhando; foto sem legenda num documento técnico vira
 * decoração. Ela é opcional porque obrigar a escrever antes de enviar faria o
 * Rodrigo enviar tudo sem legenda de uma vez — melhor enviar e nomear depois.
 *
 * Seção opcional, como as outras: sem mídia, o documento abre direto no
 * projeto.
 */

export function MidiasDoDocumento({
  orcamento,
}: {
  orcamento: OrcamentoCompleto;
}) {
  const midias = orcamento.midias;
  const entrada = useRef<HTMLInputElement>(null);

  const [envio, enviar, enviando] = useActionState<Resultado | null, FormData>(
    enviarMidia,
    null,
  );

  return (
    <section className="cartao mt-6 px-5 py-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="rotulo">
            <Dica texto="Abre o documento do cliente, antes do projeto e dos números.">
              Situação atual
            </Dica>
          </p>
          {midias.length > 0 && (
            <span className="selo selo-neutro">
              {midias.length} {midias.length === 1 ? "arquivo" : "arquivos"}
            </span>
          )}
        </div>

        <form action={enviar}>
          <input type="hidden" name="orcamentoId" value={orcamento.id} />
          <input
            ref={entrada}
            type="file"
            name="arquivo"
            accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/webm"
            className="sr-only"
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
          />
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            disabled={enviando}
            className="btn btn-secundario btn-compacto"
          >
            {enviando ? <Girando /> : "Enviar foto ou vídeo"}
          </button>
        </form>
      </div>

      {envio?.ok === false && (
        <p className="mb-3 text-sm text-perigo">{envio.erro}</p>
      )}

      {midias.length === 0 ? (
        <p className="text-sm text-cinza">
          Sem foto, o documento abre direto no projeto. Com foto, o cliente vê o
          que existe hoje antes de ver o preço — que é como as propostas da RD
          sempre começaram.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {midias.map((m) => (
            <Cartao key={m.id} midia={m} orcamentoId={orcamento.id} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Cartao({
  midia,
  orcamentoId,
}: {
  midia: MidiaDoOrcamento;
  orcamentoId: string;
}) {
  const [legenda, setLegenda] = useState(midia.legenda ?? "");
  const [, renomear] = useActionState<Resultado | null, FormData>(
    renomearMidia,
    null,
  );
  const [, excluir, excluindo] = useActionState<Resultado | null, FormData>(
    excluirMidia,
    null,
  );

  return (
    <li className="overflow-hidden rounded-sm border border-nevoa">
      {midia.tipo === "video" ? (
        <video
          src={midia.url}
          className="aspect-video w-full bg-tinta object-cover"
          muted
          playsInline
          preload="metadata"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={midia.url}
          alt={midia.legenda ?? "Foto da situação atual"}
          className="aspect-[4/3] w-full object-cover"
        />
      )}

      <div className="flex items-center gap-2 border-t border-nevoa p-2">
        <form action={renomear} className="min-w-0 flex-1">
          <input type="hidden" name="orcamentoId" value={orcamentoId} />
          <input type="hidden" name="id" value={midia.id} />
          <input
            name="legenda"
            value={legenda}
            onChange={(e) => setLegenda(e.target.value)}
            onBlur={(e) => e.currentTarget.form?.requestSubmit()}
            placeholder="Legenda"
            aria-label="Legenda da mídia"
            className="campo w-full !min-h-9 !py-1 !text-sm"
          />
        </form>

        <form action={excluir}>
          <input type="hidden" name="orcamentoId" value={orcamentoId} />
          <input type="hidden" name="id" value={midia.id} />
          <button
            type="submit"
            disabled={excluindo}
            aria-label="Excluir"
            className="btn btn-secundario btn-compacto btn-icone"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 fill-none stroke-current"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" />
            </svg>
          </button>
        </form>
      </div>
    </li>
  );
}
