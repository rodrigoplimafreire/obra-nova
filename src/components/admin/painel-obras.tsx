"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cabecalho, Conteudo, Secao, Vazio } from "./cabecalho";
import { Dialogo } from "@/components/comum/dialogo";
import { Girando } from "@/components/comum/esqueleto";
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
            aria-label="Nova obra"
            className="btn btn-primario btn-icone sm:w-auto sm:px-5"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth={2.5} strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="hidden sm:inline">Nova obra</span>
          </button>
        }
      />

      <Conteudo>
        <Secao titulo="Obras ativas">
          {obras.length === 0 ? (
            <Vazio
              titulo="Nenhuma obra ainda"
              acao={
                <button
                  type="button"
                  onClick={() => setCriando(true)}
                  className="btn btn-primario"
                >
                  Criar a primeira obra
                </button>
              }
            >
              Uma obra por cliente. Você lança as atividades do dia, o mestre
              confirma no fim do expediente com foto e áudio, e na sexta sai o
              relatório da semana.
            </Vazio>
          ) : (
            <ul className="flex flex-col gap-3">
              {obras.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/admin/obras/${o.id}`}
                    className="flex items-center justify-between gap-4 rounded-lg border border-nevoa bg-white px-5 py-4 transition md:hover:border-tinta"
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

      <JanelaDeObra aberto={criando} aoFechar={() => setCriando(false)} />
    </>
  );
}

/**
 * Criar obra, no mesmo diálogo de todo o resto do painel.
 *
 * Era o último modal feito à mão do app, e divergia do sistema em seis pontos
 * ao mesmo tempo: `div` com `position: fixed` em vez do `<dialog>` nativo
 * (sem foco preso, sem Esc, sem travar a rolagem do fundo), raio de 2rem,
 * fundo cal em vez de branco, título em `extrabold` com um kicker que nenhum
 * outro diálogo tem, rótulo de campo fora do `rotulo-campo`, e — o que mais
 * confunde a mão — **os botões na ordem inversa**, com o primário à esquerda
 * ocupando a largura sobrante.
 *
 * A ordem importa mais que a aparência: em todos os outros diálogos o botão
 * que confirma é o último. Trocar de lugar num só treina o dedo a errar.
 */
function JanelaDeObra({
  aberto,
  aoFechar,
}: {
  aberto: boolean;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [estado, acao, pendente] = useActionState<Resultado | null, FormData>(
    criarObra,
    null,
  );

  useEffect(() => {
    if (estado?.ok && estado.link) router.push(estado.link);
  }, [estado, router]);

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Começar uma obra"
      descricao="O nome e o cliente aparecem no relatório que o cliente abre toda semana."
      estreito
    >
      <form action={acao} className="dialogo-forma">
        <div className="dialogo-corpo flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Nome da obra *</span>
            <input
              name="nome"
              required
              minLength={2}
              autoFocus
              placeholder="Reforma da Rua Padre Valdevino"
              className="campo"
            />
            <span className="ajuda-campo">Como a equipe chama.</span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Cliente *</span>
            <input
              name="cliente"
              required
              minLength={2}
              placeholder="Quem paga a obra"
              className="campo"
            />
            <span className="ajuda-campo">
              É o nome que vai no relatório da semana.
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Endereço</span>
            <input name="endereco" className="campo" />
          </label>

          {estado?.erro && (
            <p className="aviso aviso-erro text-sm">{estado.erro}</p>
          )}
        </div>

        <div className="dialogo-rodape">
          <button type="button" onClick={aoFechar} className="btn btn-secundario">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pendente}
            className={`btn ${pendente ? "btn-carregando" : "btn-primario"}`}
          >
            {pendente && <Girando />}
            {pendente ? "Criando…" : "Criar obra"}
          </button>
        </div>
      </form>
    </Dialogo>
  );
}
