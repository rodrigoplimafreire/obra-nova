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
 * **O erro que esta barra existe para impedir** é publicar um orçamento na
 * marca errada. É erro silencioso: nada na tela avisa, nada falha, e quem
 * descobre é o cliente final do outro cliente. Por isso a barra é fixa, larga,
 * e leva a cor de acento da empreiteira — precisa ser impossível de não ver,
 * não discreta e elegante.
 *
 * Só aparece para operador com mais de uma empreiteira. Usuário comum tem uma
 * org e não pode trocar; para ele esta faixa seria enfeite sem função, tomando
 * altura de tela em cima do conteúdo.
 */
export function BarraDeContexto({
  orgs,
  ativa,
}: {
  orgs: OrgAcessivel[];
  ativa: string;
}) {
  const [escolhendo, setEscolhendo] = useState(false);
  const atual = orgs.find((o) => o.id === ativa);

  if (orgs.length < 2 || !atual) return null;

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-amarelo-ativo bg-amarelo px-4 py-2 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {atual.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={atual.logo}
              alt=""
              className="h-6 w-auto max-w-[6rem] shrink-0 object-contain"
            />
          ) : null}
          <p className="min-w-0 truncate text-sm text-tinta">
            <span className="font-mono text-[0.65rem] tracking-widest uppercase opacity-70">
              Atuando por
            </span>{" "}
            <strong className="font-semibold">{atual.nome}</strong>
          </p>
        </div>

        <button
          type="button"
          onClick={() => setEscolhendo(true)}
          className="btn btn-secundario btn-compacto shrink-0"
        >
          Trocar
        </button>
      </div>

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
