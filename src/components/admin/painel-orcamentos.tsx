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
import { AcoesDaLinha, type AcaoDeLinha } from "./acoes-da-linha";
import { ListaParaImprimir } from "./lista-para-imprimir";
import {
  excluir,
  mudarSituacao,
  republicar,
  virarObra,
} from "@/lib/orcamento/acoes-lista";
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
  empreiteira,
}: {
  orcamentos: ResumoDeOrcamento[];
  empreiteira: string;
}) {
  const [criando, setCriando] = useState(false);
  const [colando, setColando] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const naRua = orcamentos.filter((o) =>
    ["enviado", "visto", "negociando"].includes(o.situacao),
  );
  const aprovados = orcamentos.filter((o) => o.situacao === "aprovado");
  const viraramObra = orcamentos.filter((o) => o.obraId).length;
  const totalAprovado = aprovados.reduce(
    (acc, o) => acc + (o.valorAprovado ?? 0),
    0,
  );
  const totalLancado = orcamentos.reduce((acc, o) => acc + (o.total ?? 0), 0);

  const termo = busca.trim().toLowerCase();
  const visiveis = orcamentos.filter((o) => {
    if (!pertence(o, filtro)) return false;
    if (!termo) return true;
    return [o.cliente, o.numero, o.objeto]
      .filter(Boolean)
      .some((c) => c!.toLowerCase().includes(termo));
  });

  /**
   * O que dá para fazer com este orçamento sem abrir a tela dele.
   *
   * A lista muda com o estado: republicar não existe antes da primeira
   * publicação, virar obra some quando a obra já existe, e apagar sai de cena
   * assim que o cliente pode estar com o link na mão.
   */
  function acoesDoOrcamento(o: ResumoDeOrcamento): AcaoDeLinha[] {
    const lista: AcaoDeLinha[] = [];

    if (o.situacao !== "aprovado") {
      lista.push({
        rotulo: "Marcar como aprovado",
        executar: async () => (await mudarSituacao(o.id, "aprovado")).erro ?? null,
      });
    }
    if (o.situacao !== "negociando") {
      lista.push({
        rotulo: "Marcar como negociando",
        executar: async () =>
          (await mudarSituacao(o.id, "negociando")).erro ?? null,
      });
    }
    if (o.situacao !== "recusado") {
      lista.push({
        rotulo: "Marcar como recusado",
        executar: async () => (await mudarSituacao(o.id, "recusado")).erro ?? null,
      });
    }

    if (!o.obraId) {
      lista.push({
        rotulo: "Virar obra",
        nota: "Abre o canteiro e marca como aprovado",
        executar: async () => (await virarObra(o.id)).erro ?? null,
      });
    }

    if (o.versaoPublicada !== null) {
      lista.push({
        rotulo: "Republicar",
        nota: `Publica a v${o.versaoPublicada + 1}, mesmo link`,
        executar: async () => (await republicar(o.id)).erro ?? null,
      });
    }

    lista.push({
      rotulo: "Apagar",
      perigo: true,
      executar: async () => (await excluir(o.id)).erro ?? null,
      confirmar: {
        titulo: `Apagar o orçamento de ${o.cliente}?`,
        aviso:
          "Some com os itens, os áudios e o histórico. Não dá para desfazer.",
        palavra: "APAGAR",
      },
    });

    return lista;
  }

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
            {/* Imprime o que está à vista, com filtro e busca aplicados —
                é o recorte que a pessoa acabou de montar olhando a tela. */}
            {orcamentos.length > 0 && (
              <button
                type="button"
                onClick={() => window.print()}
                aria-label="Imprimir a lista"
                className="btn btn-secundario btn-icone"
              >
                <Impressora />
              </button>
            )}
          </div>
        }
      />

      <ListaParaImprimir
        orcamentos={visiveis}
        empreiteira={empreiteira}
        filtro={
          (FILTROS.find((f) => f.chave === filtro)?.rotulo ?? "Todos") +
          (termo ? ` · busca "${busca.trim()}"` : "")
        }
      />

      <Conteudo>
        <NovoOrcamento aberto={criando} aoFechar={() => setCriando(false)} />
        <ColarOrcamento aberto={colando} aoFechar={() => setColando(false)} />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
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
          {/* Saiu o "Itens sem preço". Ele nasceu quando todo orçamento era
              item a item; hoje a maioria é de escopo fechado, e "60 itens sem
              preço" é o normal, não um alerta. Indicador que acende sempre
              deixa de ser lido. Quem precisa da informação é a publicação, e
              ela já barra na hora certa. */}
          <Indicador
            rotulo="Viraram obra"
            valor={viraramObra}
            detalhe={viraramObra === 1 ? "no canteiro" : "nos canteiros"}
            dica="Orçamentos aprovados que já têm obra aberta."
          />
          {/* O tamanho da carteira: tudo que já foi orçado, fechado ou não.
              Fica ao lado do "Valor aprovado" de propósito — um é o que
              entrou, o outro é o que passou pela mesa, e ver os dois juntos
              é o que diz se o problema é falta de orçamento ou falta de
              fechamento. */}
          <Indicador
            rotulo="Valor lançado"
            valor={moeda(totalLancado)}
            detalhe="tudo que já foi orçado"
            dica="Soma de todos os orçamentos da lista, aprovados ou não. Não é dinheiro em caixa — é o volume que passou pela mesa."
          />
        </div>

        {/* Busca e filtro no cliente: a lista inteira já está aqui, e ir ao
            servidor para filtrar dez linhas daria latência sem devolver nada.
            Quando passar de algumas centenas, isto vira consulta. */}
        {orcamentos.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-nevoa pt-5">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por cliente, número ou serviço"
              aria-label="Buscar orçamento"
              className="campo min-w-0 flex-1 sm:max-w-80"
            />
            <div className="flex flex-wrap gap-1.5">
              {FILTROS.map((f) => (
                <button
                  key={f.chave}
                  type="button"
                  onClick={() => setFiltro(f.chave)}
                  className={`btn btn-compacto ${
                    filtro === f.chave ? "btn-primario" : "btn-secundario"
                  }`}
                >
                  {f.rotulo}
                  {f.chave !== "todos" && (
                    <span className="ml-1.5 opacity-60">
                      {contarPor(orcamentos, f.chave)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <Secao
          titulo={
            visiveis.length === orcamentos.length
              ? "Todos"
              : `${visiveis.length} de ${orcamentos.length}`
          }
        >
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
              {visiveis.map((o) => (
                <li
                  key={o.id}
                  className="relative flex items-center gap-2 rounded-lg border border-nevoa bg-white pr-3 transition md:hover:border-tinta"
                >
                  {/* O link é o conteúdo, e o menu fica fora dele. Menu dentro
                      de âncora navega antes de abrir. */}
                  <Link
                    href={`/admin/orcamentos/${o.id}`}
                    className="flex min-w-0 flex-1 flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between"
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
                      {o.obraId && (
                        <span className="selo selo-neutro">obra aberta</span>
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

                  <AcoesDaLinha acoes={acoesDoOrcamento(o)} />
                </li>
              ))}
            </ul>
          )}

          {orcamentos.length > 0 && visiveis.length === 0 && (
            <p className="py-8 text-center text-sm text-fumaca">
              Nenhum orçamento com esse filtro.
            </p>
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

/**
 * Os filtros são os quatro estados em que se olha a lista: tudo, o que está
 * na rua esperando resposta, o que fechou, e o que já virou canteiro. Um por
 * pergunta que a pessoa faz de manhã.
 */
type Filtro = "todos" | "na-rua" | "aprovados" | "obra";

const FILTROS: Array<{ chave: Filtro; rotulo: string }> = [
  { chave: "todos", rotulo: "Todos" },
  { chave: "na-rua", rotulo: "Na rua" },
  { chave: "aprovados", rotulo: "Aprovados" },
  { chave: "obra", rotulo: "Viraram obra" },
];

function pertence(o: ResumoDeOrcamento, filtro: Filtro): boolean {
  if (filtro === "todos") return true;
  if (filtro === "na-rua")
    return ["enviado", "visto", "negociando"].includes(o.situacao);
  if (filtro === "aprovados") return o.situacao === "aprovado";
  return o.obraId !== null;
}

function contarPor(lista: ResumoDeOrcamento[], filtro: Filtro): number {
  return lista.filter((o) => pertence(o, filtro)).length;
}

function Impressora() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9V3h12v6" />
      <rect x="4" y="9" width="16" height="8" rx="1.5" />
      <path d="M6 14h12v7H6Z" />
    </svg>
  );
}
