"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cabecalho, Conteudo, Indicador, Vazio } from "./cabecalho";
import { Dialogo } from "@/components/comum/dialogo";
import { CampoDeTelefone } from "@/components/comum/campos";
import { Girando } from "@/components/comum/esqueleto";
import { moeda } from "@/lib/orcamento/formato";
import { criarPedido } from "@/lib/pipeline/acoes";
import {
  FUNIL,
  ORIGENS,
  PORTES,
  ROTULO_ESTADO,
  ROTULO_ORIGEM,
  ROTULO_TIPO,
  SAIDAS,
  TIPOS_DE_OBRA,
  type Estado,
  type PedidoNoQuadro,
} from "@/lib/pipeline/constantes";

/**
 * O quadro do funil.
 *
 * Colunas são estados, e a ordem delas é a ordem em que o trabalho anda. As
 * duas saídas — perdido e congelado — ficam fora da esteira, num rodapé
 * recolhido: elas não são etapas, são fins, e misturá-las com o funil faria
 * parecer que perder é o passo seguinte a enviar.
 *
 * Rolagem horizontal com colunas de largura fixa. A alternativa seria espremer
 * seis colunas na largura da tela, e num celular cada card viraria uma tira de
 * 50px onde não cabe nem o nome do cliente.
 */
export function PainelDePipeline({
  pedidos,
  semCustoHora,
}: {
  pedidos: PedidoNoQuadro[];
  /** A empreiteira ainda não calculou o custo/hora. */
  semCustoHora: boolean;
}) {
  const [criando, setCriando] = useState(false);

  const parados = pedidos.filter((p) => p.parado);
  const abertos = pedidos.filter(
    (p) => !["fechado", "perdido", "congelado"].includes(p.status),
  );
  const fechados = pedidos.filter((p) => p.status === "fechado");
  const perdidos = pedidos.filter((p) => p.status === "perdido");

  // Conversão sobre o que já teve desfecho. Contar os que ainda estão na rua
  // como perdidos derrubaria o número sem nada ter dado errado.
  const comDesfecho = fechados.length + perdidos.length;
  const conversao =
    comDesfecho === 0 ? null : Math.round((fechados.length / comDesfecho) * 100);

  const custoPerdido = perdidos.reduce((s, p) => s + (p.custoEstimado ?? 0), 0);

  return (
    <>
      <Cabecalho
        titulo="Pipeline"
        meta={`${pedidos.length} ${pedidos.length === 1 ? "pedido" : "pedidos"}`}
        acoes={
          <div className="flex items-center gap-2">
            <Link href="/admin/pipeline/analise" className="btn btn-secundario">
              <span className="hidden sm:inline">Análise</span>
              <span className="sm:hidden">
                <Grafico />
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setCriando(true)}
              className="btn btn-primario"
            >
              <Mais />
              <span className="hidden sm:inline">Novo pedido</span>
            </button>
          </div>
        }
      />

      <Conteudo>
        <NovoPedido aberto={criando} aoFechar={() => setCriando(false)} />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Indicador
            rotulo="Na esteira"
            valor={abertos.length}
            detalhe="pedidos sem desfecho"
            dica="Tudo que entrou e ainda não fechou, não se perdeu e não foi congelado."
          />
          <Indicador
            rotulo="Parados"
            valor={parados.length}
            destaque={parados.length > 0 ? "amarelo" : undefined}
            detalhe="sem andar há dias"
            dica="Pedidos no começo do funil que não mudam de estado há mais dias do que o limite configurado."
          />
          <Indicador
            rotulo="Conversão"
            valor={conversao === null ? "—" : `${conversao}%`}
            detalhe={
              comDesfecho === 0
                ? "sem desfecho ainda"
                : `${fechados.length} de ${comDesfecho} com desfecho`
            }
            dica="Fechados sobre o total que já teve desfecho. Quem ainda está na rua não conta como perdido."
          />
          <Indicador
            rotulo="Custo do perdido"
            valor={semCustoHora ? "—" : moeda(custoPerdido)}
            destaque={!semCustoHora && custoPerdido > 0 ? "amarelo" : undefined}
            detalhe={
              semCustoHora ? "falta o custo/hora" : `${perdidos.length} pedidos`
            }
            dica="Quanto custou produzir os orçamentos que não fecharam. É o número que justifica cobrar pelo Estudo Preliminar."
          />
        </div>

        {/* O aviso não é decoração: sem custo/hora, mostrar R$ 0,00 seria
            afirmar que produzir orçamento é de graça. */}
        {semCustoHora && (
          <div className="mt-4">
            <p className="aviso aviso-atencao text-sm">
              O custo por hora da empreiteira ainda não foi calculado, então o
              custo dos orçamentos não aparece.{" "}
              <Link
                href="/admin/pipeline/analise"
                className="underline underline-offset-4"
              >
                Definir agora
              </Link>
              .
            </p>
          </div>
        )}

        {pedidos.length === 0 ? (
          <div className="mt-6">
            <Vazio
              titulo="Nenhum pedido registrado"
              acao={
                <button
                  type="button"
                  onClick={() => setCriando(true)}
                  className="btn btn-primario"
                >
                  Registrar o primeiro
                </button>
              }
            >
              Todo pedido de orçamento que chega entra aqui em quatro campos. O
              quadro mostra o que está parado antes de virar cliente perdido.
            </Vazio>
          </div>
        ) : (
          <>
            <div className="-mx-5 mt-6 overflow-x-auto px-5 pb-2 md:-mx-6 md:px-6">
              <div className="flex min-w-max gap-3">
                {FUNIL.map((estado) => (
                  <Coluna
                    key={estado}
                    estado={estado}
                    pedidos={pedidos.filter((p) => p.status === estado)}
                  />
                ))}
              </div>
            </div>

            <Saidas
              pedidos={pedidos.filter((p) =>
                SAIDAS.includes(p.status as Estado),
              )}
            />
          </>
        )}
      </Conteudo>
    </>
  );
}

function Coluna({
  estado,
  pedidos,
}: {
  estado: Estado;
  pedidos: PedidoNoQuadro[];
}) {
  const soma = pedidos.reduce(
    (s, p) => s + (p.valorFechado ?? p.valorOrcado ?? 0),
    0,
  );

  return (
    <section className="flex w-72 shrink-0 flex-col gap-2">
      <header className="flex items-baseline justify-between gap-2 border-b border-nevoa pb-2">
        <h2 className="rotulo">{ROTULO_ESTADO[estado]}</h2>
        <span className="font-mono text-[0.7rem] text-cinza tabular-nums">
          {pedidos.length}
        </span>
      </header>

      {soma > 0 && (
        <p className="font-mono text-[0.65rem] tracking-wider text-cinza uppercase tabular-nums">
          {moeda(soma)}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {pedidos.map((p) => (
          <li key={p.id}>
            <Cartao pedido={p} />
          </li>
        ))}
      </ul>

      {pedidos.length === 0 && (
        <p className="rounded-lg border border-dashed border-nevoa px-3 py-6 text-center text-xs text-fumaca">
          Vazio
        </p>
      )}
    </section>
  );
}

function Cartao({ pedido }: { pedido: PedidoNoQuadro }) {
  const valor = pedido.valorFechado ?? pedido.valorOrcado;

  return (
    <Link
      href={`/admin/pipeline/${pedido.id}`}
      className={`block rounded-lg border bg-white px-4 py-3 transition md:hover:border-tinta ${
        pedido.parado ? "border-atencao-forte" : "border-nevoa"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[0.65rem] text-cinza">
          #{pedido.codigo}
        </span>
        {pedido.parado && (
          <span className="selo selo-atencao">{diasParados(pedido)}d parado</span>
        )}
      </div>

      <p className="mt-1 leading-tight font-semibold text-tinta">
        {pedido.cliente}
      </p>

      <p className="mt-1 font-mono text-[0.6rem] tracking-widest text-cinza uppercase">
        {[
          pedido.bairro,
          pedido.tipoObra ? ROTULO_TIPO[pedido.tipoObra] : null,
        ]
          .filter(Boolean)
          .join(" · ") || "sem detalhe"}
      </p>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="font-mono text-[0.6rem] text-cinza uppercase">
          {pedido.totalMinutos > 0 ? horas(pedido.totalMinutos) : "sem tempo"}
        </span>
        {valor !== null && (
          <span className="text-sm font-bold text-tinta tabular-nums">
            {moeda(valor)}
          </span>
        )}
      </div>
    </Link>
  );
}

/** Perdidos e congelados: fins, não etapas. Ficam recolhidos. */
function Saidas({ pedidos }: { pedidos: PedidoNoQuadro[] }) {
  const [aberto, setAberto] = useState(false);
  if (pedidos.length === 0) return null;

  return (
    <div className="mt-6 border-t border-nevoa pt-4">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="rotulo flex items-center gap-2 underline underline-offset-4"
      >
        {aberto ? "Esconder" : "Ver"} perdidos e congelados ({pedidos.length})
      </button>

      {aberto && (
        <ul className="mt-3 flex flex-col gap-2">
          {pedidos.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/pipeline/${p.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-nevoa bg-white px-4 py-3 transition md:hover:border-tinta"
              >
                <span className="min-w-0">
                  <span className="font-mono text-[0.65rem] text-cinza">
                    #{p.codigo}
                  </span>{" "}
                  <span className="font-semibold text-tinta">{p.cliente}</span>
                  {p.motivoPerda && (
                    <span className="mt-0.5 block text-xs text-cinza">
                      {p.motivoPerda}
                    </span>
                  )}
                </span>
                <span className="selo selo-neutro shrink-0">
                  {ROTULO_ESTADO[p.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * O cadastro rápido: quatro campos.
 *
 * Mobile primeiro de verdade — o pedido chega por WhatsApp, na rua, e se só
 * funcionar sentado no computador não vai ser usado. Por isso os seletores são
 * botões de toque e não `select`: menos toques, alvo maior, e o valor fica à
 * vista sem abrir nada.
 */
function NovoPedido({
  aberto,
  aoFechar,
}: {
  aberto: boolean;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [estado, acao, pendente] = useActionState(criarPedido, null);
  const [tipoObra, setTipoObra] = useState<string>("");
  const [origem, setOrigem] = useState<string>("");
  const [porte, setPorte] = useState<string>("");

  useEffect(() => {
    if (estado?.ok && estado.id) {
      aoFechar();
      router.refresh();
    }
  }, [estado, aoFechar, router]);

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Novo pedido"
      descricao="Quatro campos e pronto. O resto se completa depois, na tela do pedido."
      estreito
    >
      <form action={acao} className="dialogo-forma">
        <div className="dialogo-corpo flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Cliente *</span>
            <input
              name="cliente"
              placeholder="Quem pediu o orçamento"
              autoFocus
              required
              className="campo"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Bairro</span>
            <input name="bairro" placeholder="Onde é a obra" className="campo" />
          </label>

          <Escolha
            rotulo="Tipo de obra"
            nome="tipoObra"
            valor={tipoObra}
            aoEscolher={setTipoObra}
            opcoes={TIPOS_DE_OBRA.map((t) => ({
              valor: t,
              rotulo: ROTULO_TIPO[t],
            }))}
          />

          {/* A origem é o único campo que não dá para recuperar depois: daqui
              a uma semana ninguém lembra se veio de indicação ou do Instagram.
              Por isso ela está no cadastro rápido e não no detalhe. */}
          <Escolha
            rotulo="Origem do lead"
            nome="origem"
            valor={origem}
            aoEscolher={setOrigem}
            opcoes={ORIGENS.map((o) => ({ valor: o, rotulo: ROTULO_ORIGEM[o] }))}
          />

          <details className="group">
            <summary className="rotulo cursor-pointer list-none underline underline-offset-4">
              Telefone e porte (opcional)
            </summary>
            <div className="mt-4 flex flex-col gap-5">
              <label className="flex flex-col gap-1.5">
                <span className="rotulo-campo">Telefone</span>
                <CampoDeTelefone nome="telefone" placeholder="(85) 99999-0000" />
              </label>
              <Escolha
                rotulo="Porte"
                nome="porte"
                valor={porte}
                aoEscolher={setPorte}
                opcoes={PORTES.map((p) => ({ valor: p, rotulo: p }))}
              />
            </div>
          </details>

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
            {pendente ? "Registrando…" : "Registrar"}
          </button>
        </div>
      </form>
    </Dialogo>
  );
}

/**
 * Seletor de um valor entre poucos, em botões.
 *
 * `select` nativo no celular abre uma roleta que cobre a tela e exige três
 * toques. Aqui são cinco opções visíveis, um toque, e o `input` escondido
 * mantém o formulário sendo um formulário.
 */
function Escolha({
  rotulo,
  nome,
  valor,
  aoEscolher,
  opcoes,
}: {
  rotulo: string;
  nome: string;
  valor: string;
  aoEscolher: (v: string) => void;
  opcoes: Array<{ valor: string; rotulo: string }>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="rotulo-campo">{rotulo}</span>
      <input type="hidden" name={nome} value={valor} />
      <div className="flex flex-wrap gap-1.5">
        {opcoes.map((o) => (
          <button
            key={o.valor}
            type="button"
            // Clicar de novo no que já está escolhido desmarca: sem isso, um
            // toque errado num campo opcional não teria como ser desfeito.
            onClick={() => aoEscolher(valor === o.valor ? "" : o.valor)}
            className={`btn btn-compacto ${
              valor === o.valor ? "btn-primario" : "btn-secundario"
            }`}
          >
            {o.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}

export function horas(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

function diasParados(p: PedidoNoQuadro): number {
  if (!p.ultimoEventoEm) return 0;
  const ms = Date.now() - new Date(p.ultimoEventoEm).getTime();
  return Math.floor(ms / 86_400_000);
}

function Mais() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth={2.5}
      strokeLinecap="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function Grafico() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}
