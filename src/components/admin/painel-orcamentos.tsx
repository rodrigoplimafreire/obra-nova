"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cabecalho, Conteudo, Indicador, Secao, Vazio } from "./cabecalho";
import { Dialogo } from "@/components/comum/dialogo";
import { Dica } from "@/components/comum/dica";
import { CampoDeTelefone } from "@/components/comum/campos";
import { Girando } from "@/components/comum/esqueleto";
import { criarOrcamento } from "@/lib/orcamento/acoes";
import { moeda } from "@/lib/orcamento/formato";
import { ColarOrcamento } from "./colar-orcamento";
import {
  COR_SITUACAO,
  ROTULO_SITUACAO,
} from "./publicacao-do-orcamento";
import type { Resultado } from "@/lib/admin/tipos";
import type { ResumoDeOrcamento } from "@/lib/orcamento/dados";

/**
 * A lista mostra a **situação comercial**, não o status de preparo.
 *
 * Antes ela mostrava `status`, que nunca saía de 'briefing' — todo orçamento
 * criado à mão aparecia como "Gravando" para sempre, o que era mentira porque
 * nada estava sendo gravado. Quem olha a lista quer saber onde a conversa
 * está, não em que etapa interna o documento se encontra.
 */

export function PainelDeOrcamentos({
  orcamentos,
}: {
  orcamentos: ResumoDeOrcamento[];
}) {
  const [criando, setCriando] = useState(false);
  const [colando, setColando] = useState(false);

  const aguardandoPreco = orcamentos.reduce((acc, o) => acc + o.semPreco, 0);
  const naRua = orcamentos.filter((o) =>
    ["enviado", "visto", "negociando"].includes(o.situacao),
  );
  const aprovados = orcamentos.filter((o) => o.situacao === "aprovado");
  const totalAprovado = aprovados.reduce(
    (acc, o) => acc + (o.valorAprovado ?? 0),
    0,
  );

  return (
    <>
      <Cabecalho
        titulo="Orçamentos"
        meta={`${orcamentos.length} ${orcamentos.length === 1 ? "orçamento" : "orçamentos"}`}
        // Ícone no celular, rótulo a partir de sm: no documento a ação da
        // lista é um quadrado de 36px ao lado do título, não uma faixa amarela
        // ocupando a largura da tela.
        acoes={
          <div className="flex items-center gap-2">
            {/* Colar é o caminho de todo dia — o material chega pronto no
                WhatsApp. O formulário em branco fica ao lado, para quando
                não há o que colar. */}
            <button
              type="button"
              onClick={() => setColando(true)}
              className="btn btn-primario"
            >
              <Colar />
              <span className="hidden sm:inline">Colar material</span>
            </button>
            <button
              type="button"
              onClick={() => setCriando(true)}
              aria-label="Novo orçamento em branco"
              className="btn btn-secundario btn-icone"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 fill-none stroke-current"
                strokeWidth={2.5}
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        }
      />

      <Conteudo>
        <NovoOrcamento aberto={criando} aoFechar={() => setCriando(false)} />
        <ColarOrcamento aberto={colando} aoFechar={() => setColando(false)} />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Indicador
            rotulo="Na rua"
            valor={naRua.length}
            detalhe="enviados, sem desfecho"
            dica="Orçamentos que já foram para o cliente e ainda não foram aprovados nem recusados."
          />
          <Indicador
            rotulo="Aprovados"
            valor={aprovados.length}
            destaque={aprovados.length > 0 ? "arroio" : undefined}
          />
          <Indicador
            rotulo="Valor aprovado"
            valor={moeda(totalAprovado)}
            detalhe="congelado no aceite"
            dica="Soma dos orçamentos aceitos, pelo valor que valia no dia do aceite."
          />
          <Indicador
            rotulo="Itens sem preço"
            valor={aguardandoPreco}
            destaque={aguardandoPreco > 0 ? "amarelo" : undefined}
            detalhe={
              aguardandoPreco > 0
                ? "impede publicar"
                : "nenhum item em branco"
            }
            dica="A IA nunca chuta preço. Item sem valor de venda bloqueia a publicação."
          />
        </div>

        <Secao titulo="Todos">
          {orcamentos.length === 0 ? (
            <Vazio
              titulo="Nenhum orçamento ainda"
              acao={
                <button
                  type="button"
                  onClick={() => setCriando(true)}
                  className="btn btn-primario"
                >
                  Criar o primeiro
                </button>
              }
            >
              Crie o orçamento, grave o serviço falando e deixe a IA montar a
              tabela de custos. O preço quem dá é você.
            </Vazio>
          ) : (
            <ul className="flex flex-col gap-3">
              {orcamentos.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/admin/orcamentos/${o.id}`}
                    className="flex flex-col gap-3 rounded-lg border border-nevoa bg-white px-5 py-4 transition md:flex-row md:items-center md:justify-between md:hover:border-tinta"
                  >
                    <span className="min-w-0">
                      <span className="block text-lg leading-tight font-semibold text-tinta">
                        {o.cliente}
                      </span>
                      <span className="mt-1.5 block font-mono text-[0.65rem] tracking-widest text-cinza uppercase">
                        {o.numero ?? "sem número"}
                        {o.objeto ? ` · ${o.objeto}` : ""}
                      </span>
                    </span>

                    <span className="flex shrink-0 items-center gap-3">
                      {o.semPreco > 0 && (
                        <span className="selo selo-atraso">
                          {o.semPreco} sem preço
                        </span>
                      )}
                      {o.situacao === "visto" && o.aberturas > 1 && (
                        <Dica texto="Quantas vezes o cliente abriu a página. Muitas aberturas sem resposta costumam ser hora de ligar.">
                          <span className="font-mono text-[0.6rem] tracking-widest text-cinza uppercase">
                            {o.aberturas}×
                          </span>
                        </Dica>
                      )}
                      <span className={`selo ${COR_SITUACAO[o.situacao]}`}>
                        {ROTULO_SITUACAO[o.situacao]}
                        {o.versaoPublicada ? ` v${o.versaoPublicada}` : ""}
                      </span>
                      <span className="font-sans text-base font-bold -tracking-[0.02em] text-tinta tabular-nums">
                        {moeda(o.total)}
                      </span>
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

function NovoOrcamento({
  aberto,
  aoFechar,
}: {
  aberto: boolean;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [estado, acao, pendente] = useActionState<Resultado | null, FormData>(
    criarOrcamento,
    null,
  );

  useEffect(() => {
    if (estado?.ok && estado.link) router.push(estado.link);
  }, [estado, router]);

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Novo orçamento"
      descricao="Só o cliente é obrigatório. O resto dá para completar depois, ou deixar a IA preencher a partir do áudio."
      estreito
    >
      <form action={acao} className="dialogo-forma">
        <div className="dialogo-corpo flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Cliente *</span>
            <input
              name="cliente"
              placeholder="Para quem é o orçamento"
              autoFocus
              required
              className="campo"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Objeto</span>
            <input
              name="objeto"
              placeholder="O serviço, em uma linha"
              className="campo"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Endereço da obra</span>
            <input name="endereco" className="campo" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Telefone</span>
            <CampoDeTelefone nome="contato" placeholder="(85) 99999-0000" />
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
            {pendente ? "Criando…" : "Criar e continuar"}
          </button>
        </div>
      </form>
    </Dialogo>
  );
}

/** Prancheta com folha: "trazer de fora o que já está escrito". */
function Colar() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 4H7a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-2" />
      <rect x="9" y="2.5" width="6" height="3.5" rx="1" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  );
}
