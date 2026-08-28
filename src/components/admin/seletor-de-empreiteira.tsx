"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialogo } from "@/components/comum/dialogo";
import { Girando } from "@/components/comum/esqueleto";
import { trocarOrg } from "@/lib/admin/acoes-org";
import type { OrgAcessivel } from "@/lib/admin/sessao";

/**
 * Por qual empreiteira o operador está atuando agora.
 *
 * **O erro que isto existe para impedir** é publicar um orçamento na marca
 * errada. É erro silencioso: nada na tela avisa, nada falha, e quem descobre é
 * o cliente final do outro cliente.
 *
 * A primeira versão era uma faixa amarela fixa atravessando o topo da tela.
 * Resolvia a visibilidade e criou outro problema: uma tarja gritante presente
 * em todas as telas o tempo todo, roubando altura e atenção de quem já sabe
 * onde está. Aviso que nunca sai de cena vira paisagem — deixa de ser lido e
 * continua cobrando o espaço.
 *
 * Agora mora onde a navegação mora: rodapé da barra lateral no desktop, linha
 * no cabeçalho do celular. Continua sempre visível e sempre legível, mas como
 * parte do mobiliário em vez de alarme.
 *
 * Só aparece para quem tem mais de uma empreiteira. Para usuário comum seria
 * enfeite sem função.
 */
export function SeletorDeEmpreiteira({
  orgs,
  ativa,
  variante,
}: {
  orgs: OrgAcessivel[];
  ativa: string;
  /** `lateral` é o rodapé do menu do desktop; `topo` é o cabeçalho do celular. */
  variante: "lateral" | "topo";
}) {
  const [escolhendo, setEscolhendo] = useState(false);
  const atual = orgs.find((o) => o.id === ativa);

  if (orgs.length < 2 || !atual) return null;

  return (
    <>
      {variante === "lateral" ? (
        <button
          type="button"
          onClick={() => setEscolhendo(true)}
          className="flex w-full items-center gap-3 border-t border-cinza-600 px-5 py-4 text-left transition hover:bg-grafite"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[0.6rem] tracking-widest text-cinza-400 uppercase">
              Atuando por
            </span>
            <span className="mt-0.5 block truncate text-sm font-semibold text-papel">
              {atual.nome}
            </span>
          </span>
          <Trocar />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setEscolhendo(true)}
          className="flex min-w-0 items-center gap-1.5 rounded-sm px-2 py-1 text-left transition hover:bg-grafite"
        >
          <span className="min-w-0 truncate text-[0.8125rem] font-semibold text-papel">
            {atual.nome}
          </span>
          <Trocar />
        </button>
      )}

      <Dialogo
        aberto={escolhendo}
        aoFechar={() => setEscolhendo(false)}
        titulo="Trocar de empreiteira"
        descricao="Tudo no painel passa a mostrar os dados de quem você escolher: orçamentos, obras, preços e a marca que assina o documento."
        estreito
      >
        {escolhendo && (
          <Escolha
            orgs={orgs}
            ativa={ativa}
            aoFechar={() => setEscolhendo(false)}
          />
        )}
      </Dialogo>
    </>
  );
}

/** Duas setas trocando de lugar. Diz "alternar" sem precisar da palavra. */
function Trocar() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 shrink-0 fill-none stroke-cinza-400"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 8h13m0 0-3-3m3 3-3 3M20 16H7m0 0 3-3m-3 3 3 3" />
    </svg>
  );
}

function Escolha({
  orgs,
  ativa,
  aoFechar,
}: {
  orgs: OrgAcessivel[];
  ativa: string;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [indo, setIndo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function trocar(id: string) {
    if (id === ativa) return aoFechar();
    setErro(null);
    setIndo(id);
    try {
      const saida = await trocarOrg(id);
      if (!saida.ok) {
        setErro(saida.erro ?? "Não consegui trocar de empreiteira.");
        setIndo(null);
        return;
      }
      // **Fechar vem antes de navegar, e é o conserto de um travamento.**
      // Só o caminho de erro limpava o estado; no sucesso, `indo` continuava
      // apontando para a org escolhida e o diálogo seguia montado. Como
      // `router.push` para a rota em que já se está não repinta nada por si,
      // não havia nenhum evento que apagasse o giro — a tela ficava carregando
      // para sempre, com a troca já feita no servidor.
      aoFechar();

      // Volta para a raiz do painel: continuar na mesma URL levaria a um
      // orçamento que pertence à empreiteira anterior, e a tela responderia
      // 404 sem explicar por quê.
      router.push("/admin");
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setIndo(null);
    }
  }

  return (
    <>
      <div className="dialogo-corpo flex flex-col gap-2">
        {orgs.map((o) => {
          const atual = o.id === ativa;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => void trocar(o.id)}
              disabled={indo !== null}
              className={`flex items-center gap-3 rounded-sm border px-4 py-3 text-left transition disabled:opacity-50 ${
                atual ? "border-tinta bg-papel" : "border-nevoa hover:bg-papel"
              }`}
            >
              {o.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={o.logo}
                  alt=""
                  className="h-6 w-auto max-w-[5rem] shrink-0 object-contain"
                />
              ) : (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-arroio text-[0.6rem] font-semibold text-papel">
                  {o.nome.slice(0, 2).toUpperCase()}
                </span>
              )}

              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-tinta">
                {o.nome}
              </span>

              {indo === o.id ? (
                <Girando />
              ) : atual ? (
                <span className="rotulo shrink-0">atual</span>
              ) : null}
            </button>
          );
        })}

        {erro && <p className="aviso aviso-erro mt-2 text-sm">{erro}</p>}
      </div>

      <div className="dialogo-rodape">
        <button
          type="button"
          onClick={aoFechar}
          disabled={indo !== null}
          className="btn btn-secundario"
        >
          Cancelar
        </button>
      </div>
    </>
  );
}
