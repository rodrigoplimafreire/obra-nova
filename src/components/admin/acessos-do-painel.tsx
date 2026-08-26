"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Secao } from "./cabecalho";
import { Dialogo } from "@/components/comum/dialogo";
import { Girando } from "@/components/comum/esqueleto";
import {
  confirmarEmailDeConta,
  liberarAcesso,
  tirarAcesso,
} from "@/lib/admin/acoes-acessos";
import type { Acesso } from "@/lib/admin/acessos";
import type { Resultado } from "@/lib/admin/tipos";

/**
 * Os usuários da plataforma. Só o admin vê esta seção.
 *
 * Cada pessoa trabalha dentro da empreiteira dela e não enxerga as outras; o
 * admin é o único com vínculo em todas — e esse vínculo nasce sozinho, por
 * trigger, para não depender de alguém lembrar de criá-lo.
 *
 * **O que ela conserta** é uma espera invisível. A lista de acesso morava numa
 * variável de ambiente, então liberar alguém exigia deploy — e ninguém no
 * painel ficava sabendo que havia gente parada na porta. Uma pessoa criou conta
 * e esperou dezoito dias sem que nada na tela contasse.
 *
 * Por isso a lista mostra **o estado da conta**, não só o e-mail. "Nunca
 * entrou" e "não confirmou o e-mail" são as duas travas que não deixam rastro
 * em lugar nenhum; se elas não aparecerem aqui, não aparecem.
 */
export function AcessosDoPainel({
  acessos,
  euSou,
}: {
  acessos: Acesso[];
  euSou: string;
}) {
  const [liberando, setLiberando] = useState(false);

  return (
    <Secao titulo="Usuários">
      <div className="cartao px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <p className="min-w-0 max-w-prose text-sm leading-relaxed text-fumaca">
            Criar conta não dá acesso: quem entra é quem está nesta lista. Cada
            pessoa trabalha dentro da empreiteira dela e não enxerga as outras.
            Você é o único que vê todas.
          </p>
          <button
            type="button"
            onClick={() => setLiberando(true)}
            className="btn btn-secundario shrink-0"
          >
            Novo usuário
          </button>
        </div>

        <ul className="mt-4 flex flex-col gap-px overflow-hidden rounded-sm border border-cinza-100 bg-cinza-100">
          {acessos.map((a) => (
            <Pessoa key={a.email} acesso={a} euSou={euSou} />
          ))}
        </ul>
      </div>

      <Dialogo
        aberto={liberando}
        aoFechar={() => setLiberando(false)}
        titulo="Novo usuário"
        descricao="Você libera a entrada, não a senha: a pessoa ainda cria a conta dela e escolhe a própria senha."
        estreito
      >
        {liberando && <Formulario aoFechar={() => setLiberando(false)} />}
      </Dialogo>
    </Secao>
  );
}

function Pessoa({ acesso, euSou }: { acesso: Acesso; euSou: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<"confirmar" | "remover" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const souEu = acesso.email === euSou;

  async function rodar(qual: "confirmar" | "remover") {
    setErro(null);
    setOcupado(qual);
    try {
      const saida =
        qual === "confirmar"
          ? await confirmarEmailDeConta(acesso.email)
          : await tirarAcesso(acesso.email);
      if (!saida.ok) {
        setErro(saida.erro ?? "Não consegui concluir.");
        setOcupado(null);
        return;
      }
      router.refresh();
      setOcupado(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setOcupado(null);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-papel px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-sm break-words text-tinta">
          {acesso.email}
          {souEu && <span className="rotulo ml-2">você</span>}
        </p>

        <p className="mt-0.5 text-xs text-fumaca">
          {acesso.ehAdmin ? (
            <span className="font-semibold text-tinta">
              Admin — vê todas as empreiteiras
            </span>
          ) : acesso.empreiteira ? (
            acesso.empreiteira
          ) : (
            <span className="text-cinza">
              Sem empreiteira: ganha uma nova no primeiro login
            </span>
          )}
          {acesso.nota && <span className="text-cinza"> · {acesso.nota}</span>}
        </p>

        <Situacao acesso={acesso} />
        {erro && <p className="aviso aviso-erro mt-2 text-sm">{erro}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {acesso.aguardandoConfirmacao && (
          <button
            type="button"
            onClick={() => void rodar("confirmar")}
            disabled={ocupado !== null}
            className="btn btn-secundario btn-compacto"
          >
            {ocupado === "confirmar" && <Girando />}
            Confirmar e-mail
          </button>
        )}

        {/* O e-mail que vem da variável de ambiente não tem linha na tabela:
            remover aqui não faria nada, e um botão que não faz nada é pior que
            botão nenhum. */}
        {!acesso.doAmbiente && !souEu && (
          <button
            type="button"
            onClick={() => void rodar("remover")}
            disabled={ocupado !== null}
            className="btn btn-secundario btn-compacto"
          >
            {ocupado === "remover" && <Girando />}
            Remover
          </button>
        )}
      </div>
    </li>
  );
}

/** A frase que diz se a pessoa conseguiu entrar — o ponto todo da lista. */
function Situacao({ acesso }: { acesso: Acesso }) {
  if (acesso.aguardandoConfirmacao) {
    return (
      <p className="mt-1 text-xs leading-relaxed text-atencao">
        Criou conta mas não confirmou o e-mail. Enquanto isso, não entra — e
        nada avisa a pessoa disso.
      </p>
    );
  }
  if (!acesso.ultimoAcesso) {
    return (
      <p className="mt-1 text-xs text-cinza">
        Liberado, mas ainda não entrou nenhuma vez.
      </p>
    );
  }
  return (
    <p className="mt-1 text-xs text-cinza">
      Último acesso em{" "}
      {new Date(acesso.ultimoAcesso).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })}
      .
    </p>
  );
}

function Formulario({ aoFechar }: { aoFechar: () => void }) {
  const router = useRouter();
  const [estado, acao, pendente] = useActionState<Resultado | null, FormData>(
    liberarAcesso,
    null,
  );

  useEffect(() => {
    if (estado?.ok) {
      router.refresh();
      aoFechar();
    }
  }, [estado, aoFechar, router]);

  return (
    <form action={acao} className="dialogo-forma">
      <div className="dialogo-corpo flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">E-mail *</span>
          <input
            name="email"
            type="email"
            placeholder="pessoa@exemplo.com"
            required
            autoFocus
            className="campo"
          />
          <span className="ajuda-campo">
            Precisa ser o mesmo e-mail com que ela vai criar a conta.
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Empreiteira</span>
          <input
            name="empreiteira"
            placeholder="Construtora Silva"
            className="campo"
          />
          <span className="ajuda-campo">
            O espaço de trabalho dela: obras, orçamentos, transcrições e preços
            ficam aqui dentro, e ninguém de fora vê. Em branco, ela ganha um
            espaço novo batizado com o próprio e-mail.
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Quem é</span>
          <input
            name="nota"
            placeholder="Amiga testando o painel"
            className="campo"
          />
          <span className="ajuda-campo">
            Só para você lembrar daqui a três meses por que este e-mail está na
            lista.
          </span>
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
          {pendente ? "Cadastrando…" : "Cadastrar"}
        </button>
      </div>
    </form>
  );
}
