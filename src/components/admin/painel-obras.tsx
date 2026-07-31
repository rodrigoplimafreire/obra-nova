"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cabecalho, Conteudo, Secao } from "./cabecalho";
import { criarObra } from "@/lib/admin/acoes-obra";
import type { Resultado } from "@/lib/admin/tipos";
import type { ResumoDeObra } from "@/lib/admin/obras";

export function PainelDeObras({ obras }: { obras: ResumoDeObra[] }) {
  const [criando, setCriando] = useState(false);

  return (
    <>
      <Cabecalho
        titulo="Obras"
        meta={`${obras.length} ${obras.length === 1 ? "obra" : "obras"} em andamento`}
        acoes={
          <button
            type="button"
            onClick={() => setCriando(true)}
            className="btn btn-principal"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={2.5} strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nova obra
          </button>
        }
      />

      <Conteudo>
        <p className="rounded-3xl border border-nevoa bg-white px-5 py-4 text-sm leading-relaxed text-fumaca">
          Uma obra por cliente. Você lança as atividades do dia, o mestre
          confirma no fim do expediente com foto e áudio, e na sexta sai o
          relatório da semana.
        </p>

        <Secao titulo="Obras ativas">
          {obras.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-nevoa bg-white px-5 py-10 text-center text-sm text-cinza">
              Nenhuma obra ainda. Crie a primeira lá em cima.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {obras.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/admin/obras/${o.id}`}
                    className="flex items-center justify-between gap-4 rounded-3xl border border-nevoa bg-white px-5 py-4 transition md:hover:border-tinta"
                  >
                    <span className="min-w-0">
                      <span className="block text-lg leading-tight font-semibold text-tinta">
                        {o.nome}
                      </span>
                      <span className="mt-1.5 block font-mono text-[0.65rem] tracking-widest text-cinza uppercase">
                        {o.cliente} · {o.mestres}{" "}
                        {o.mestres === 1 ? "mestre" : "mestres"}
                      </span>
                    </span>

                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-right">
                        <span className="block font-sans text-2xl leading-none font-extrabold -tracking-[0.03em] text-tinta">
                          {o.confirmadasHoje}/{o.atividadesHoje}
                        </span>
                        <span className="rotulo mt-1 block">Hoje</span>
                      </span>
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-cinza" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Secao>
      </Conteudo>

      {criando && <JanelaDeObra aoFechar={() => setCriando(false)} />}
    </>
  );
}

function JanelaDeObra({ aoFechar }: { aoFechar: () => void }) {
  const router = useRouter();
  const [estado, acao, pendente] = useActionState<Resultado | null, FormData>(
    criarObra,
    null,
  );

  useEffect(() => {
    if (estado?.ok && estado.link) router.push(estado.link);
  }, [estado, router]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/50 sm:items-center sm:p-6">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-papel p-6 sm:rounded-[2rem]">
        <form action={acao}>
          <p className="rotulo">Nova obra</p>
          <h2 className="mt-2 font-sans text-2xl leading-tight font-extrabold -tracking-[0.02em] text-tinta">
            Começar uma obra
          </h2>

          <label className="mt-5 block">
            <span className="text-sm font-medium text-grafite">Nome da obra</span>
            <span className="mt-0.5 block text-xs text-cinza">
              Como a equipe chama. Ex.: “Reforma da Rua Padre Valdevino”.
            </span>
            <input name="nome" required minLength={2} className="campo mt-1.5" />
          </label>

          <label className="mt-4 block">
            <span className="text-sm font-medium text-grafite">Cliente</span>
            <span className="mt-0.5 block text-xs text-cinza">
              Quem paga a obra. É o nome que vai no relatório da semana.
            </span>
            <input name="cliente" required minLength={2} className="campo mt-1.5" />
          </label>

          <label className="mt-4 block">
            <span className="text-sm font-medium text-grafite">Endereço</span>
            <input name="endereco" className="campo mt-1.5" />
          </label>

          {estado?.erro && (
            <p className="mt-4 rounded-2xl bg-alerta/20 px-4 py-3 text-sm text-alerta-tinta">
              {estado.erro}
            </p>
          )}

          <div className="mt-6 flex gap-2">
            <button
              type="submit"
              disabled={pendente}
              className="btn btn-principal flex-1"
            >
              {pendente ? "Criando…" : "Criar obra"}
            </button>
            <button type="button" onClick={aoFechar} className="btn btn-vazado">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
