"use client";

import { useActionState, useState } from "react";
import { Cabecalho, Conteudo, Secao, Vazio } from "./cabecalho";
import { Dialogo } from "@/components/comum/dialogo";
import { Dica } from "@/components/comum/dica";
import { CenaSemResultado } from "@/components/comum/ilustracoes";
import { ImportadorDePlanilha } from "./importador-de-planilha";
import {
  alternarBaseAtiva,
  excluirBaseDePreco,
} from "@/lib/orcamento/acoes-precos";
import type { Resultado } from "@/lib/admin/tipos";
import type { BaseDePreco } from "@/lib/orcamento/precos";

const ROTULO_FONTE: Record<BaseDePreco["fonte"], string> = {
  sinapi: "SINAPI",
  seinfra: "SEINFRA-CE",
  propria: "Própria",
  outra: "Outra",
};

export function PainelDePrecos({ bases }: { bases: BaseDePreco[] }) {
  const [importando, setImportando] = useState(false);
  const ativas = bases.filter((b) => b.ativa);

  return (
    <>
      <Cabecalho
        titulo="Preços"
        meta={`${ativas.length} ${ativas.length === 1 ? "base ativa" : "bases ativas"} · ${ativas.reduce((a, b) => a + b.linhas, 0)} composições na busca`}
        acoes={
          <button
            type="button"
            onClick={() => setImportando(true)}
            aria-label="Importar planilha"
            className="btn btn-primario btn-icone sm:w-auto sm:px-5"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 fill-none stroke-current"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3v12M7 10l5 5 5-5M4 19h16" />
            </svg>
            <span className="hidden sm:inline">Importar planilha</span>
          </button>
        }
      />

      <Conteudo>
        <ImportadorDePlanilha
          bases={bases}
          aberto={importando}
          aoFechar={() => setImportando(false)}
        />

        <Secao titulo="Bases">
          {bases.length === 0 ? (
            <Vazio
              titulo="Nenhuma base de preços"
              // A caçamba vazia é para lista sem registro. Aqui o que falta é
              // o que a busca do editor vai consultar, e a cena da lupa diz
              // isso: o grid existe, a peça é que não vem.
              ilustracao={<CenaSemResultado />}
              acao={
                <button
                  type="button"
                  onClick={() => setImportando(true)}
                  className="btn btn-primario"
                >
                  Importar a primeira
                </button>
              }
            >
              A base alimenta a busca do editor de orçamento — SINAPI,
              SEINFRA-CE ou a planilha própria da RD. Sem ela, todo custo é
              digitado à mão.
            </Vazio>
          ) : (
            <ul className="flex flex-col gap-3">
              {bases.map((b) => (
                <LinhaDeBase key={b.id} base={b} />
              ))}
            </ul>
          )}
        </Secao>
      </Conteudo>
    </>
  );
}

function LinhaDeBase({ base }: { base: BaseDePreco }) {
  const [confirmando, setConfirmando] = useState(false);
  const [estadoToggle, alternar, alternando] = useActionState<
    Resultado | null,
    FormData
  >(alternarBaseAtiva, null);
  const [estadoExclusao, excluir, excluindo] = useActionState<
    Resultado | null,
    FormData
  >(excluirBaseDePreco, null);

  return (
    <li className="cartao flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold text-tinta">
            {base.nome}
          </span>
          <span className="selo selo-neutro">{ROTULO_FONTE[base.fonte]}</span>
          {base.desonerada && <span className="selo selo-neutro">Desonerada</span>}
          <span className={`selo ${base.ativa ? "selo-emdia" : "selo-neutro"}`}>
            {base.ativa ? "Ativa" : "Inativa"}
          </span>
        </div>
        <p className="mt-1.5 font-mono text-[0.65rem] tracking-widest text-cinza uppercase">
          {base.referencia ?? "sem referência"} · {base.linhas}{" "}
          {base.linhas === 1 ? "composição" : "composições"}
        </p>
        {estadoToggle?.erro && (
          <p className="mt-1 text-xs text-atraso">{estadoToggle.erro}</p>
        )}
        {estadoExclusao?.erro && (
          <p className="mt-1 text-xs text-atraso">{estadoExclusao.erro}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* A explicação de "ativa" ficava num parágrafo no topo da página,
            longe do botão que faz a coisa. Aqui ela chega no momento da
            dúvida, que é quando alguém pensa em clicar. */}
        <form action={alternar}>
          <input type="hidden" name="id" value={base.id} />
          <input type="hidden" name="ativa" value={base.ativa ? "0" : "1"} />
          <Dica
            texto={
              base.ativa
                ? "Sai da busca do editor. Não apaga nada, e os itens que já usaram um custo daqui ficam com o número guardado."
                : "Volta a aparecer na busca do editor de orçamento."
            }
          >
            <button
              type="submit"
              disabled={alternando}
              className="btn btn-sutil btn-compacto"
            >
              {base.ativa ? "Desativar" : "Ativar"}
            </button>
          </Dica>
        </form>

        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="btn btn-secundario btn-compacto"
        >
          Apagar
        </button>
      </div>

      <Dialogo
        aberto={confirmando}
        aoFechar={() => setConfirmando(false)}
        titulo={`Apagar "${base.nome}"?`}
        descricao={`As ${base.linhas} composições desta base saem da busca para sempre. Os itens de orçamento que já usaram um custo daqui ficam com o número guardado — o custo é cópia, não referência.`}
        estreito
      >
        <form action={excluir} className="dialogo-forma">
          <div className="dialogo-corpo">
            <input type="hidden" name="id" value={base.id} />
            <p className="text-sm leading-relaxed text-fumaca">
              Se a intenção é só tirar da busca sem perder nada,{" "}
              <strong className="text-tinta">desativar</strong> resolve e tem
              volta.
            </p>
          </div>
          <div className="dialogo-rodape">
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="btn btn-secundario"
            >
              Cancelar
            </button>
            <button type="submit" disabled={excluindo} className="btn btn-perigo">
              {excluindo ? "Apagando…" : "Apagar base"}
            </button>
          </div>
        </form>
      </Dialogo>
    </li>
  );
}
