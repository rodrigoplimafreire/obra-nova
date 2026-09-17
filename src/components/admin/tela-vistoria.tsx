"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialogo } from "@/components/comum/dialogo";
import { Girando } from "@/components/comum/esqueleto";
import { Cabecalho, Conteudo } from "./cabecalho";
import { AcoesDaLinha } from "./acoes-da-linha";
import {
  adicionarAmbiente,
  adicionarServico,
  alternarConclusao,
  apagarVistoria,
  gerarOrcamentoDaVistoria,
  gravarMedida,
  removerAmbiente,
  removerMedicao,
  salvarAmbiente,
  salvarDadosDaVistoria,
} from "@/lib/vistoria/acoes";
import { escutarNoAmbiente, incluirItensDaVoz } from "@/lib/vistoria/acoes-voz";
import {
  AMBIENTES,
  SERVICOS,
  UNIDADES,
  sugestoesPara,
  type Ambiente,
  type Medicao,
  type VistoriaCompleta,
} from "@/lib/vistoria/constantes";
import {
  MODOS,
  ORDEM_DOS_MODOS,
  bruta,
  calcular,
  calculado,
  estadoInicial,
  faltaPara,
  resumoDaMedida,
  type Campo,
  type ItemDaVoz,
  type Modo,
} from "@/lib/vistoria/medicao";
import {
  GravadorDeAudio,
  ErroMicrofone,
  MENSAGENS_FALHA,
  type BlocoGravado,
} from "@/lib/audio/recorder";
import { data as dataBR, lerNumero, numero } from "@/lib/orcamento/formato";
import type { Resultado } from "@/lib/admin/tipos";

/**
 * A tela da visita.
 *
 * **Desenhada para ser usada em pé, com uma mão, diante do cliente.** Esse
 * requisito não mudou; o que mudou foi a leitura de quanto o desenho anterior
 * cobrava por ele.
 *
 * ## O que estava caro, medido em toques
 *
 * Incluir um serviço custava oito: rolar até o cartão do cômodo, abrir o
 * diálogo, escolher a disciplina entre dezoito pastilhas, preencher medida,
 * tocar em "usar como quantidade", conferir unidade, confirmar, e ver o
 * diálogo fechar — para reabrir tudo no serviço seguinte. Numa visita de três
 * cômodos e dez serviços, o levantamento inteiro era abrir e fechar modal.
 *
 * ## O que este desenho troca
 *
 * - **Um cômodo por vez.** A lista de todos os ambientes empilhados obrigava
 *   a procurar o certo a cada item. Agora há um cômodo ativo e um seletor de
 *   uma linha. O que se está vendo é o que está na tela.
 * - **Captura contínua, sem diálogo.** O campo de incluir serviço mora no pé
 *   da tela e não sai de lá: escreve, inclui, o campo limpa e o foco fica.
 *   Dez serviços são dez toques, não oitenta. É uma exceção consciente ao
 *   "todo CRUD em diálogo" — ver a nota adiante.
 * - **Medir é escolha, não etapa.** Cada linha abre a folha de medição, onde
 *   o **modo** vem primeiro e decide quais campos existem. A quantidade sai
 *   calculada e ninguém precisa copiá-la.
 * - **Falar.** O microfone na barra de captura grava a frase que ele já diz
 *   em voz alta ao cliente e devolve os serviços para conferência.
 *
 * ## A exceção ao diálogo, dita por extenso
 *
 * O `README` documenta que todo CRUD acontece em diálogo, e o motivo é bom: o
 * `<dialog>` nativo dá foco preso, Esc, fundo inerte e camada de topo sem
 * `z-index` brigando com a barra lateral. A captura contínua abre mão disso
 * de propósito, e só ela — medir e editar continuam em folha.
 *
 * O que se ganha é a repetição: um campo que não fecha é o que transforma
 * oito toques em um. O que se perde é pequeno **porque o alvo é pequeno**:
 * um campo de texto e um botão, sem foco para prender e sem nada atrás para
 * tornar inerte.
 */

export function TelaDaVistoria({ vistoria }: { vistoria: VistoriaCompleta }) {
  const [editandoDados, setEditandoDados] = useState(false);
  const [ambienteEmEdicao, setAmbienteEmEdicao] = useState<Ambiente | null>(null);
  const [medindo, setMedindo] = useState<Medicao | null>(null);
  const [escutando, setEscutando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const router = useRouter();

  /**
   * O cômodo em foco.
   *
   * `null` significa "ainda não escolhi", e aí vale o último da lista — que é
   * o recém-incluído, porque quem acabou de criar a cozinha quer lançar na
   * cozinha. Guardar o id e não o índice é o que mantém a escolha de pé
   * quando a lista se reordena por trás.
   */
  const [ambienteAtivoId, setAmbienteAtivoId] = useState<string | null>(null);

  const ambientes = vistoria.ambientes;
  const ativo = useMemo(
    () =>
      ambientes.find((a) => a.id === ambienteAtivoId) ?? ambientes.at(-1) ?? null,
    [ambientes, ambienteAtivoId],
  );

  const medidas = ambientes.reduce((s, a) => s + a.medicoes.length, 0);
  const semMedida = ambientes.reduce(
    (s, a) => s + a.medicoes.filter((m) => m.quantidade === null).length,
    0,
  );

  async function gerar() {
    setGerando(true);
    setErro(null);
    const r = await gerarOrcamentoDaVistoria(vistoria.id);
    if (r.ok && r.link) router.push(r.link);
    else setErro(r.erro ?? "Não consegui gerar o orçamento.");
    setGerando(false);
  }

  async function concluir() {
    setErro(null);
    const r = await alternarConclusao(vistoria.id);
    if (!r.ok) setErro(r.erro ?? "Não consegui mudar o estado da visita.");
  }

  return (
    <>
      <Cabecalho
        voltarPara="/admin/vistorias"
        voltarRotulo="Vistorias"
        titulo={vistoria.cliente}
        meta={[
          dataBR(vistoria.dataVisita),
          vistoria.endereco,
          vistoria.pedidoCliente ? `pedido: ${vistoria.pedidoCliente}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        acoes={
          <div className="flex items-center gap-2">
            {vistoria.orcamentoId ? (
              <Link
                href={`/admin/orcamentos/${vistoria.orcamentoId}`}
                className="btn btn-secundario"
              >
                Ver orçamento
              </Link>
            ) : (
              medidas > 0 && (
                <button
                  type="button"
                  onClick={gerar}
                  disabled={gerando}
                  className={`btn ${gerando ? "btn-carregando" : "btn-primario"}`}
                >
                  {gerando && <Girando />}
                  {gerando ? "Gerando…" : "Gerar orçamento"}
                </button>
              )
            )}
            <AcoesDaLinha
              acoes={[
                {
                  rotulo: vistoria.concluidaEm ? "Reabrir visita" : "Concluir visita",
                  executar: async () => {
                    await concluir();
                    return null;
                  },
                },
                {
                  rotulo: "Editar dados da visita",
                  executar: async () => {
                    setEditandoDados(true);
                    return null;
                  },
                },
                {
                  rotulo: "Apagar visita",
                  perigo: true,
                  executar: async () => {
                    const r = await apagarVistoria(vistoria.id);
                    return r.ok ? null : (r.erro ?? "Nao consegui apagar.");
                  },
                  confirmar: {
                    titulo: `Apagar a visita de ${vistoria.cliente}?`,
                    aviso: "Os ambientes e as medidas vão junto.",
                    palavra: "APAGAR",
                  },
                },
              ]}
            />
          </div>
        }
      />

      <Conteudo>
        {erro && <p className="aviso aviso-erro mb-4 text-sm">{erro}</p>}

        {vistoria.concluidaEm && (
          <p className="aviso mb-4 text-sm leading-relaxed">
            Visita concluída em {dataBR(vistoria.concluidaEm)}. Ainda dá para
            editar — obra tem detalhe que só aparece no dia seguinte.
          </p>
        )}

        {ambientes.length === 0 ? (
          <div className="cartao px-5 py-8 text-center">
            <p className="text-sm leading-relaxed text-cinza">
              Comece pelo ambiente. Toque no cômodo que você está vendo agora.
            </p>
            <BotoesDeAmbiente
              vistoriaId={vistoria.id}
              aoFalhar={setErro}
              jaUsados={[]}
              aoIncluir={() => setAmbienteAtivoId(null)}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <SeletorDeAmbientes
              ambientes={ambientes}
              ativoId={ativo?.id ?? null}
              aoTrocar={setAmbienteAtivoId}
              aoNovo={() => setAmbienteAtivoId(null)}
              vistoriaId={vistoria.id}
              aoFalhar={setErro}
            />

            {ativo && (
              <PainelDoAmbiente
                ambiente={ativo}
                aoEditar={() => setAmbienteEmEdicao(ativo)}
                aoMedir={setMedindo}
                aoFalhar={setErro}
                aoRemover={() => setAmbienteAtivoId(null)}
                aoFalar={() => setEscutando(true)}
              />
            )}

            {/* O placar fecha a tela: quantas medidas, quantas ainda sem
                número. É a pergunta que se faz ao sair da casa, e o "sem
                medida" é informação, não erro — por isso não é vermelho. */}
            <p className="rotulo text-center">
              {ambientes.length} ambiente{ambientes.length === 1 ? "" : "s"} ·{" "}
              {medidas} serviço{medidas === 1 ? "" : "s"}
              {semMedida > 0 && ` · ${semMedida} sem medida`}
            </p>
          </div>
        )}
      </Conteudo>

      <Dialogo
        aberto={editandoDados}
        aoFechar={() => setEditandoDados(false)}
        titulo="Dados da visita"
        estreito
      >
        {editandoDados && (
          <FormularioDeDados
            vistoria={vistoria}
            aoFechar={() => setEditandoDados(false)}
          />
        )}
      </Dialogo>

      <Dialogo
        aberto={ambienteEmEdicao !== null}
        aoFechar={() => setAmbienteEmEdicao(null)}
        titulo="Editar ambiente"
        estreito
      >
        {ambienteEmEdicao && (
          <FormularioDeAmbiente
            ambiente={ambienteEmEdicao}
            aoFechar={() => setAmbienteEmEdicao(null)}
          />
        )}
      </Dialogo>

      <Dialogo
        aberto={medindo !== null}
        aoFechar={() => setMedindo(null)}
        titulo="Medir o serviço"
        descricao="Escolha o que está medindo. A quantidade sai da conta sozinha."
      >
        {medindo && (
          <FolhaDeMedicao
            key={medindo.id}
            medicao={medindo}
            aoFechar={() => setMedindo(null)}
          />
        )}
      </Dialogo>

      <Dialogo
        aberto={escutando}
        aoFechar={() => setEscutando(false)}
        titulo="Falar os serviços"
        descricao="Diga o que vai ser feito neste cômodo, com as medidas. Você confere antes de entrar na lista."
        largo
      >
        {escutando && ativo && (
          <FolhaDaVoz
            ambiente={ativo}
            aoFechar={() => setEscutando(false)}
          />
        )}
      </Dialogo>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Ambientes                                                          */
/* ------------------------------------------------------------------ */

/**
 * O seletor de cômodo, em pastilhas.
 *
 * Não rola de lado. A rolagem horizontal escondia os últimos cômodos atrás da
 * borda, e num aparelho estreito o quinto ambiente simplesmente não existia
 * para quem não soubesse arrastar. Aqui elas quebram linha: ocupam mais altura
 * e não perdem nenhum.
 *
 * O número ao lado do nome é quantos serviços aquele cômodo já tem. É o que
 * responde "já passei por aqui?" sem precisar entrar.
 */
function SeletorDeAmbientes({
  ambientes,
  ativoId,
  aoTrocar,
  aoNovo,
  vistoriaId,
  aoFalhar,
}: {
  ambientes: Ambiente[];
  ativoId: string | null;
  aoTrocar: (id: string) => void;
  /** Zera a escolha para o cômodo recém-criado assumir o foco. */
  aoNovo: () => void;
  vistoriaId: string;
  aoFalhar: (e: string) => void;
}) {
  const [incluindo, setIncluindo] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {ambientes.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => aoTrocar(a.id)}
            aria-current={a.id === ativoId ? "true" : undefined}
            className={`pastilha ${a.id === ativoId ? "pastilha-ativa" : ""}`}
          >
            {a.nome}
            <span className="font-mono text-[0.65rem] opacity-70">
              {a.medicoes.length}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setIncluindo((v) => !v)}
          aria-expanded={incluindo}
          className="pastilha"
        >
          + Ambiente
        </button>
      </div>

      {incluindo && (
        <div className="cartao px-4 py-3">
          <BotoesDeAmbiente
            vistoriaId={vistoriaId}
            jaUsados={ambientes.map((a) => a.nome)}
            aoFalhar={aoFalhar}
            aoIncluir={() => {
              aoNovo();
              setIncluindo(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Os cômodos como botão de uma palavra.
 *
 * O que já foi incluído sai da lista: numa casa há um "Quarto" e depois outro,
 * mas o caso comum é não repetir, e mostrar o que já está lá convida ao
 * duplicado. Quem tem dois quartos usa o "Outro" e nomeia.
 */
function BotoesDeAmbiente({
  vistoriaId,
  jaUsados,
  aoFalhar,
  aoIncluir,
}: {
  vistoriaId: string;
  jaUsados: string[];
  aoFalhar: (e: string) => void;
  /**
   * Chamado quando um ambiente entra.
   *
   * Não recebe id, e não precisa: o ambiente novo nasce com a maior posição,
   * então ele **é** o último da lista. Quem chama zera a escolha e o cômodo
   * recém-criado vira o ativo pela regra que já existia. Devolver o id
   * obrigaria a ação a fazer `select` depois do `insert` para entregar um dado
   * que a ordenação já contém.
   */
  aoIncluir: () => void;
}) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [livre, setLivre] = useState(false);
  const [nome, setNome] = useState("");

  async function incluir(valor: string) {
    if (!valor.trim()) return;
    setOcupado(valor);
    const r = await adicionarAmbiente(vistoriaId, valor);
    if (!r.ok) aoFalhar(r.erro ?? "Não consegui incluir o ambiente.");
    else aoIncluir();
    setOcupado(null);
    setNome("");
    setLivre(false);
  }

  const disponiveis = AMBIENTES.filter((a) => !jaUsados.includes(a));

  return (
    <div className="flex flex-wrap gap-2">
      {disponiveis.map((a) => (
        <button
          key={a}
          type="button"
          disabled={ocupado !== null}
          onClick={() => incluir(a)}
          className="pastilha"
        >
          {ocupado === a ? <Girando /> : null}
          {a}
        </button>
      ))}

      {livre ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            incluir(nome);
          }}
          className="flex min-w-48 flex-1 gap-2"
        >
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoFocus
            placeholder="Nome do ambiente"
            className="campo min-h-11 flex-1"
          />
          <button
            type="submit"
            disabled={ocupado !== null}
            className="btn btn-primario btn-compacto min-h-11"
          >
            Incluir
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setLivre(true)}
          className="pastilha"
        >
          Outro…
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* O cômodo aberto                                                    */
/* ------------------------------------------------------------------ */

function PainelDoAmbiente({
  ambiente,
  aoEditar,
  aoMedir,
  aoFalhar,
  aoRemover,
  aoFalar,
}: {
  ambiente: Ambiente;
  aoEditar: () => void;
  aoMedir: (m: Medicao) => void;
  aoFalhar: (e: string) => void;
  aoRemover: () => void;
  aoFalar: () => void;
}) {
  return (
    <section className="cartao flex flex-col gap-3 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-tinta">{ambiente.nome}</h2>
          {ambiente.observacao && (
            <p className="mt-0.5 text-sm leading-relaxed text-fumaca">
              {ambiente.observacao}
            </p>
          )}
        </div>
        <AcoesDaLinha
          acoes={[
            {
              rotulo: "Editar ambiente",
              executar: async () => {
                aoEditar();
                return null;
              },
            },
            {
              rotulo: "Remover ambiente",
              perigo: true,
              executar: async () => {
                const r = await removerAmbiente(ambiente.id);
                if (r.ok) aoRemover();
                return r.ok ? null : (r.erro ?? "Nao consegui remover.");
              },
              confirmar: {
                titulo: `Remover ${ambiente.nome}?`,
                aviso: "As medidas deste ambiente vão junto.",
                palavra: "REMOVER",
              },
            },
          ]}
        />
      </div>

      {ambiente.medicoes.length === 0 ? (
        <p className="py-2 text-sm leading-relaxed text-cinza">
          Nenhum serviço aqui ainda. Escreva embaixo, toque numa sugestão, ou
          fale.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ambiente.medicoes.map((m) => (
            <LinhaDeServico
              key={m.id}
              medicao={m}
              ambienteId={ambiente.id}
              aoMedir={() => aoMedir(m)}
              aoFalhar={aoFalhar}
            />
          ))}
        </ul>
      )}

      <BarraDeCaptura
        ambiente={ambiente}
        aoFalhar={aoFalhar}
        aoFalar={aoFalar}
      />
    </section>
  );
}

/**
 * Uma linha do levantamento.
 *
 * A linha inteira é o botão de medir. O desenho anterior tinha um "Editar" de
 * dois dedos de largura ao lado do texto, e acertar nele em pé, andando, é
 * exatamente o tipo de mira que falha — a linha toda tem 56px de altura e a
 * largura da tela.
 *
 * "sem medida" não é aviso de erro. Um serviço reconhecido e ainda não medido
 * é estado normal da visita: se fosse vermelho, a tela ficaria vermelha
 * inteira nos primeiros cinco minutos e a cor pararia de significar algo.
 */
function LinhaDeServico({
  medicao,
  ambienteId,
  aoMedir,
  aoFalhar,
}: {
  medicao: Medicao;
  ambienteId: string;
  aoMedir: () => void;
  aoFalhar: (e: string) => void;
}) {
  const [removendo, setRemovendo] = useState(false);
  const resumo = resumoDaMedida(medicao, numero);

  return (
    <li className="flex items-stretch gap-2">
      <button type="button" onClick={aoMedir} className="linha-servico flex-1">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-tinta">
            {medicao.servico}
          </span>
          <span
            className={`mt-0.5 block font-mono text-[0.65rem] tracking-wider uppercase ${
              resumo ? "text-arroio-tinta" : "text-cinza"
            }`}
          >
            {resumo ?? "sem medida · tocar para medir"}
          </span>
          {medicao.observacao && (
            <span className="mt-1 block text-xs leading-relaxed text-fumaca">
              {medicao.observacao}
            </span>
          )}
        </span>
      </button>
      <button
        type="button"
        disabled={removendo}
        onClick={async () => {
          setRemovendo(true);
          const r = await removerMedicao(ambienteId, medicao.id);
          if (!r.ok) aoFalhar(r.erro ?? "Não consegui remover.");
          setRemovendo(false);
        }}
        aria-label={`Remover ${medicao.servico}`}
        className="flex w-11 shrink-0 items-center justify-center rounded-sm text-cinza transition hover:bg-papel-fundo hover:text-tinta"
      >
        {removendo ? (
          <Girando />
        ) : (
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className="h-4 w-4 fill-none stroke-current"
            strokeWidth={2}
            strokeLinecap="round"
          >
            <path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" />
          </svg>
        )}
      </button>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* A captura contínua                                                 */
/* ------------------------------------------------------------------ */

/**
 * O campo que não fecha.
 *
 * Três caminhos para a mesma coisa, e é de propósito: a sugestão para o que é
 * comum, o texto livre para o que não é, e a voz para quando as duas mãos
 * estão ocupadas. O terceiro é o que muda o dia — ver `FolhaDaVoz`.
 *
 * **A pastilha inclui no primeiro toque.** O `PRD-UX-VISTORIAS.md` pede
 * confirmação para evitar item por toque acidental, e aqui a decisão foi
 * outra, com o motivo escrito: exigir confirmação num nome de uma palavra
 * custa um toque extra em cada um dos dez serviços para prevenir um engano
 * que custa um toque para desfazer — a linha aparece na hora, com o botão de
 * remover ao lado. O saldo é dez contra um.
 */
function BarraDeCaptura({
  ambiente,
  aoFalhar,
  aoFalar,
}: {
  ambiente: Ambiente;
  aoFalhar: (e: string) => void;
  aoFalar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [incluindo, setIncluindo] = useState(false);
  const [todos, setTodos] = useState(false);
  const campoRef = useRef<HTMLInputElement>(null);

  const sugestoes = useMemo(() => {
    const base = todos ? SERVICOS : sugestoesPara(ambiente.nome);
    const busca = texto.trim().toLowerCase();
    if (!busca) return base;
    return SERVICOS.filter((s) => s.toLowerCase().includes(busca));
  }, [ambiente.nome, texto, todos]);

  const incluir = useCallback(
    async (servico: string) => {
      const nome = servico.trim();
      if (nome.length < 2 || incluindo) return;

      setIncluindo(true);
      const r = await adicionarServico(ambiente.id, nome);
      if (!r.ok) aoFalhar(r.erro ?? "Não consegui incluir o serviço.");
      setIncluindo(false);

      // O campo limpa e o foco fica: o próximo serviço começa a ser digitado
      // sem nenhum toque no meio. É o que transforma dez aberturas de diálogo
      // em dez palavras seguidas.
      setTexto("");
      campoRef.current?.focus();
    },
    [ambiente.id, aoFalhar, incluindo],
  );

  return (
    <div className="captura flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {sugestoes.slice(0, todos || texto ? 18 : 6).map((s) => (
          <button
            key={s}
            type="button"
            disabled={incluindo}
            onClick={() => incluir(s)}
            className="pastilha"
          >
            {s}
          </button>
        ))}
        {!texto && !todos && (
          <button
            type="button"
            onClick={() => setTodos(true)}
            className="pastilha text-cinza"
          >
            Ver todos
          </button>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          incluir(texto);
        }}
        className="flex items-center gap-2"
      >
        <input
          ref={campoRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          enterKeyHint="done"
          placeholder="Qual serviço será feito aqui?"
          aria-label={`Incluir serviço em ${ambiente.nome}`}
          className="campo min-h-[52px] flex-1"
        />
        <BotaoDeMicrofone aoFalar={aoFalar} />
        <button
          type="submit"
          disabled={incluindo || texto.trim().length < 2}
          className={`btn shrink-0 ${incluindo ? "btn-carregando" : "btn-primario"}`}
          style={{ height: 52 }}
        >
          {incluindo && <Girando />}
          Incluir
        </button>
      </form>
    </div>
  );
}

function BotaoDeMicrofone({ aoFalar }: { aoFalar: () => void }) {
  return (
    <button
      type="button"
      onClick={aoFalar}
      aria-label="Falar os serviços deste ambiente"
      title="Falar os serviços"
      className="botao-microfone"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="h-5 w-5 fill-none stroke-current"
        strokeWidth={1.8}
        strokeLinecap="round"
      >
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Folha de medição                                                   */
/* ------------------------------------------------------------------ */

/**
 * Medir: o modo primeiro, os campos depois.
 *
 * A inversão é o ponto. Antes havia três caixas — comprimento, largura,
 * altura — e a intenção ficava implícita: preencher duas de um jeito dava
 * piso, de outro dava parede, e `areaDe` adivinhava. Adivinhação erra onde
 * mais dói, que é o cômodo em que se mede as duas coisas.
 *
 * Aqui a pessoa diz o que está medindo e a folha mostra só o que aquilo pede.
 * A quantidade aparece calculada, em tempo real, e **não há botão para
 * copiá-la**: o número que a conta produziu é o número que vai para o banco.
 */
function FolhaDeMedicao({
  medicao,
  aoFechar,
}: {
  medicao: Medicao;
  aoFechar: () => void;
}) {
  const inicial = estadoInicial(medicao);
  const [modo, setModo] = useState<Modo>(inicial.modo);
  const [servico, setServico] = useState(medicao.servico);
  const [comprimento, setComprimento] = useState(inicial.comprimento);
  const [largura, setLargura] = useState(inicial.largura);
  const [altura, setAltura] = useState(inicial.altura);
  const [desconto, setDesconto] = useState(inicial.desconto);
  const [manual, setManual] = useState(inicial.quantidade);
  const [unidade, setUnidade] = useState(inicial.unidade);
  const [observacao, setObservacao] = useState(medicao.observacao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const dims = {
    comprimento: lerNumero(comprimento),
    largura: lerNumero(largura),
    altura: lerNumero(altura),
    desconto: lerNumero(desconto),
  };

  const auto = calcular(modo, dims);
  const areaCheia = bruta(modo, dims);
  const falta = faltaPara(modo, dims);
  const ehCalculado = calculado(modo);
  const quantidade = ehCalculado ? auto : lerNumero(manual);

  /**
   * Trocar de modo reaproveita a unidade que o modo impõe.
   *
   * Não limpa as dimensões: quem mediu a parede errado e troca para piso
   * normalmente quer os mesmos números com outra conta, e apagar o que foi
   * digitado no canteiro é pior que recalcular.
   */
  function trocarModo(novo: Modo) {
    setModo(novo);
    const imposta = MODOS[novo].unidade;
    if (imposta) setUnidade(imposta);
    if (novo === "verba") setManual("1");
  }

  const mostra = (campo: Campo) => MODOS[modo].campos.includes(campo);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const r = await gravarMedida(medicao.id, {
      servico,
      // As dimensões só vão para o banco quando o modo as usa. Guardar a
      // largura de quando ela era piso, num item que virou parede, deixaria
      // `modoDe()` lendo volume na próxima abertura.
      comprimento: mostra("comprimento") ? dims.comprimento : null,
      largura: mostra("largura") ? dims.largura : null,
      altura: mostra("altura") ? dims.altura : null,
      quantidade,
      unidade: unidade || null,
      observacao: observacao.trim() || null,
    });
    setSalvando(false);
    if (r.ok) aoFechar();
    else setErro(r.erro ?? "Não consegui salvar.");
  }

  return (
    <div className="dialogo-forma">
      <div className="dialogo-corpo flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Serviço *</span>
          <input
            value={servico}
            onChange={(e) => setServico(e.target.value)}
            className="campo"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="rotulo-campo">O que você está medindo?</span>
          <div className="flex flex-wrap gap-2">
            {ORDEM_DOS_MODOS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => trocarModo(m)}
                aria-pressed={modo === m}
                className={`pastilha ${modo === m ? "pastilha-ativa" : ""}`}
              >
                {MODOS[m].rotulo}
              </button>
            ))}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-fumaca">
            {MODOS[modo].ajuda}
          </p>
        </div>

        {MODOS[modo].campos.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {mostra("comprimento") && (
              <Medida
                rotulo="Comprimento (m)"
                valor={comprimento}
                aoMudar={setComprimento}
              />
            )}
            {mostra("largura") && (
              <Medida rotulo="Largura (m)" valor={largura} aoMudar={setLargura} />
            )}
            {mostra("altura") && (
              <Medida rotulo="Altura (m)" valor={altura} aoMudar={setAltura} />
            )}
            {mostra("desconto") && (
              <Medida
                rotulo="Vãos (m²)"
                valor={desconto}
                aoMudar={setDesconto}
              />
            )}
          </div>
        )}

        {/* O resultado, e a conta que o produziu. Ver a conta é o que deixa a
            pessoa confiar no número sem refazer na calculadora. */}
        <div className="rounded-sm border border-nevoa bg-papel-fundo px-4 py-3">
          {ehCalculado ? (
            auto !== null ? (
              <>
                <p className="font-mono text-lg text-tinta tabular-nums">
                  {numero(auto)} {MODOS[modo].unidade}
                </p>
                <p className="mt-0.5 text-xs text-fumaca">
                  {MODOS[modo].conta}
                  {areaCheia !== null && dims.desconto
                    ? ` — de ${numero(areaCheia)} m² menos ${numero(dims.desconto)} m²`
                    : ""}
                </p>
              </>
            ) : (
              <p className="text-sm text-cinza">
                {falta ?? "Revise as medidas: a conta não fecha."}
              </p>
            )
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex w-32 flex-col gap-1.5">
                <span className="rotulo-campo">Quantidade</span>
                <input
                  inputMode="decimal"
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  placeholder="0,00"
                  className="campo min-h-11 text-right tabular-nums"
                />
              </label>
              <label className="flex w-28 flex-col gap-1.5">
                <span className="rotulo-campo">Unidade</span>
                <select
                  value={unidade}
                  onChange={(e) => setUnidade(e.target.value)}
                  className="campo min-h-11"
                >
                  <option value="">—</option>
                  {UNIDADES.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Observação</span>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={2}
            placeholder="O que muda o preço: altura de pé-direito, acesso difícil, material do cliente."
            className="campo"
          />
        </label>

        {erro && <p className="aviso aviso-erro text-sm">{erro}</p>}
      </div>

      <div className="dialogo-rodape">
        <button type="button" onClick={aoFechar} className="btn btn-secundario">
          Cancelar
        </button>
        <button
          type="button"
          onClick={salvar}
          disabled={salvando || servico.trim().length < 2}
          className={`btn ${salvando ? "btn-carregando" : "btn-primario"}`}
        >
          {salvando && <Girando />}
          {salvando ? "Salvando…" : "Salvar medida"}
        </button>
      </div>
    </div>
  );
}

function Medida({
  rotulo,
  valor,
  aoMudar,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
}) {
  return (
    <label className="flex w-32 flex-col gap-1">
      <span className="rotulo-campo">{rotulo}</span>
      <input
        // `decimal` e não `numeric`: no Android o teclado numérico puro não
        // tem vírgula, e medida de obra é 4,20 quase sempre.
        inputMode="decimal"
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder="0,00"
        className="campo min-h-11 text-right tabular-nums"
      />
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Voz                                                                */
/* ------------------------------------------------------------------ */

type EstadoDaVoz = "parado" | "gravando" | "processando" | "conferindo";

/**
 * Falar o cômodo inteiro numa frase.
 *
 * É a única parte desta tela que muda a ordem de grandeza do trabalho, e não
 * por ser IA: é por ser o que ele **já faz**. Andando pela cozinha com o
 * cliente, o Reginato diz em voz alta "aqui a gente quebra o piso, quatro por
 * três, assenta porcelanato e troca os pontos" — e depois digita isso à noite.
 * O microfone só deixa de jogar fora a frase.
 *
 * ## Conferir não é cerimônia
 *
 * O que volta é proposta, não lançamento. Transcrição de canteiro tem
 * furadeira ao fundo, e "seis pontos" vira "sessenta" sem nenhum aviso. A
 * lista aparece editável, com o que foi ouvido à vista, e nada entra no banco
 * antes de um toque humano. É a regra do "publicar é ato humano", uma etapa
 * antes.
 *
 * ## Falhar não custa a gravação
 *
 * O áudio fica no estado do componente até a inclusão dar certo. Se a
 * transcrição cair — 4G de obra —, "tentar de novo" reenvia o mesmo arquivo
 * em vez de pedir para falar tudo outra vez.
 */
function FolhaDaVoz({
  ambiente,
  aoFechar,
}: {
  ambiente: Ambiente;
  aoFechar: () => void;
}) {
  const [estado, setEstado] = useState<EstadoDaVoz>("parado");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [transcricao, setTranscricao] = useState<string | null>(null);
  const [itens, setItens] = useState<ItemDaVoz[]>([]);
  const [segundos, setSegundos] = useState(0);

  const gravadorRef = useRef<GravadorDeAudio | null>(null);
  const blocoRef = useRef<BlocoGravado | null>(null);
  const relogioRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pararRelogio = useCallback(() => {
    if (relogioRef.current) clearInterval(relogioRef.current);
    relogioRef.current = null;
  }, []);

  /**
   * Fechar a folha no meio da gravação desliga o microfone.
   *
   * Sem isto o `MediaStream` continua aberto depois que o componente sai: no
   * celular isso é o ponto vermelho de "gravando" aceso na barra de status,
   * bateria indo embora e o microfone preso para qualquer outro app. Um
   * aparelho que fica escutando depois de a tela fechar é falha de confiança,
   * não só de recurso.
   */
  useEffect(
    () => () => {
      gravadorRef.current?.encerrar();
      gravadorRef.current = null;
      pararRelogio();
    },
    [pararRelogio],
  );

  async function comecar() {
    setErro(null);
    setAviso(null);
    try {
      const gravador = new GravadorDeAudio();
      await gravador.iniciar();
      gravadorRef.current = gravador;
      setSegundos(0);
      setEstado("gravando");
      relogioRef.current = setInterval(() => setSegundos((s) => s + 1), 1000);
    } catch (e) {
      const causa = e instanceof ErroMicrofone ? e.causa : "desconhecida";
      setErro(MENSAGENS_FALHA[causa]);
      setEstado("parado");
    }
  }

  async function pararEEnviar() {
    pararRelogio();
    const gravador = gravadorRef.current;
    if (!gravador) return;

    setEstado("processando");
    try {
      const bloco = await gravador.parar();
      gravadorRef.current = null;
      blocoRef.current = bloco;
      await enviar(bloco);
    } catch {
      setErro("Não consegui encerrar a gravação.");
      setEstado("parado");
    }
  }

  async function enviar(bloco: BlocoGravado) {
    setEstado("processando");
    setErro(null);

    const form = new FormData();
    form.append("ambienteId", ambiente.id);
    form.append("audio", bloco.blob);
    form.append("mime", bloco.mimeEscolhido);

    try {
      const r = await escutarNoAmbiente(form);
      if (!r.ok) {
        setErro(r.erro);
        setEstado("parado");
        return;
      }
      setTranscricao(r.texto);
      setItens(r.itens);
      setAviso(r.aviso);
      setEstado("conferindo");
    } catch {
      // Server Action que lança — conexão que cai no meio — rejeita a
      // promessa, e sem captura nenhum `setErro` roda: o progresso ficaria
      // girando para sempre. É a armadilha que o `README` já documenta.
      setErro("A conexão caiu no meio. O áudio está aqui — dá para reenviar.");
      setEstado("parado");
    }
  }

  async function confirmar() {
    setEstado("processando");
    const r = await incluirItensDaVoz(ambiente.id, itens);
    if (r.ok) {
      aoFechar();
      return;
    }
    setErro(r.erro ?? "Não consegui incluir.");
    setEstado("conferindo");
  }

  const podeReenviar = blocoRef.current !== null && estado === "parado";

  return (
    <div className="dialogo-forma">
      <div className="dialogo-corpo flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-fumaca">
          Falando em <strong className="text-tinta">{ambiente.nome}</strong>.
          Diga o serviço e a medida junto: “quebrar o piso, quatro por três,
          assentar porcelanato, seis pontos de luz”.
        </p>

        {estado === "parado" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <button
              type="button"
              onClick={comecar}
              className="botao-microfone"
              style={{ width: 72, height: 72 }}
              aria-label="Começar a gravar"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden
                className="h-7 w-7 fill-none stroke-current"
                strokeWidth={1.6}
                strokeLinecap="round"
              >
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
              </svg>
            </button>
            <p className="text-sm text-cinza">
              {podeReenviar ? "Ou grave de novo" : "Toque para falar"}
            </p>
            {podeReenviar && (
              <button
                type="button"
                onClick={() => enviar(blocoRef.current!)}
                className="btn btn-secundario"
              >
                Tentar de novo com o mesmo áudio
              </button>
            )}
          </div>
        )}

        {estado === "gravando" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <button
              type="button"
              onClick={pararEEnviar}
              className="botao-microfone botao-microfone-gravando"
              style={{ width: 72, height: 72 }}
              aria-label="Parar e enviar"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="h-6 w-6 fill-current">
                <rect x="7" y="7" width="10" height="10" rx="2" />
              </svg>
            </button>
            <p className="font-mono text-lg text-tinta tabular-nums">
              {String(Math.floor(segundos / 60)).padStart(2, "0")}:
              {String(segundos % 60).padStart(2, "0")}
            </p>
            <p className="text-sm text-cinza">Toque no quadrado para terminar</p>
          </div>
        )}

        {estado === "processando" && (
          <div className="flex items-center justify-center gap-3 py-8 text-sm text-cinza">
            <Girando />
            Ouvindo e separando os serviços…
          </div>
        )}

        {estado === "conferindo" && (
          <>
            {transcricao && (
              <div className="rounded-sm border border-nevoa bg-papel-fundo px-4 py-3">
                <p className="rotulo mb-1">O que eu ouvi</p>
                <p className="text-sm leading-relaxed text-fumaca">
                  {transcricao}
                </p>
              </div>
            )}

            {aviso && <p className="aviso text-sm">{aviso}</p>}

            {itens.length > 0 && (
              <ul className="flex flex-col gap-2">
                {itens.map((item, indice) => (
                  <li
                    key={indice}
                    className="flex flex-wrap items-center gap-2 rounded-sm border border-nevoa px-3 py-2.5"
                  >
                    <input
                      value={item.servico}
                      onChange={(e) =>
                        setItens((lista) =>
                          lista.map((i, n) =>
                            n === indice ? { ...i, servico: e.target.value } : i,
                          ),
                        )
                      }
                      aria-label={`Serviço ${indice + 1}`}
                      className="campo min-h-11 min-w-48 flex-1"
                    />
                    <span className="font-mono text-xs tracking-wider text-arroio-tinta uppercase">
                      {item.quantidade !== null
                        ? `${numero(item.quantidade)} ${item.unidade ?? ""}`.trim()
                        : "sem medida"}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setItens((lista) => lista.filter((_, n) => n !== indice))
                      }
                      aria-label={`Descartar ${item.servico}`}
                      className="flex h-11 w-11 items-center justify-center rounded-sm text-cinza transition hover:bg-papel-fundo hover:text-tinta"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden
                        className="h-4 w-4 fill-none stroke-current"
                        strokeWidth={2}
                        strokeLinecap="round"
                      >
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {erro && <p className="aviso aviso-erro text-sm">{erro}</p>}
      </div>

      <div className="dialogo-rodape">
        <button type="button" onClick={aoFechar} className="btn btn-secundario">
          {estado === "conferindo" ? "Descartar" : "Fechar"}
        </button>
        {estado === "conferindo" && itens.length > 0 && (
          <button
            type="button"
            onClick={confirmar}
            className="btn btn-primario"
          >
            Incluir {itens.length} serviço{itens.length === 1 ? "" : "s"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Formulários que não mudaram                                        */
/* ------------------------------------------------------------------ */

function FormularioDeDados({
  vistoria,
  aoFechar,
}: {
  vistoria: VistoriaCompleta;
  aoFechar: () => void;
}) {
  const [estado, acao, pendente] = useActionState<Resultado | null, FormData>(
    salvarDadosDaVistoria,
    null,
  );

  useEffect(() => {
    if (estado?.ok) aoFechar();
  }, [estado, aoFechar]);

  return (
    <form action={acao} className="dialogo-forma">
      <div className="dialogo-corpo flex flex-col gap-4">
        <input type="hidden" name="id" value={vistoria.id} />

        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Cliente *</span>
          <input
            name="cliente"
            defaultValue={vistoria.cliente}
            required
            className="campo"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Endereço</span>
          <input
            name="endereco"
            defaultValue={vistoria.endereco ?? ""}
            className="campo"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Observações da visita</span>
          <textarea
            name="observacoes"
            defaultValue={vistoria.observacoes ?? ""}
            rows={3}
            placeholder="O que vale para a obra inteira: acesso, horário, restrição do condomínio."
            className="campo"
          />
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
          {pendente ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}

function FormularioDeAmbiente({
  ambiente,
  aoFechar,
}: {
  ambiente: Ambiente;
  aoFechar: () => void;
}) {
  const [estado, acao, pendente] = useActionState<Resultado | null, FormData>(
    salvarAmbiente,
    null,
  );

  useEffect(() => {
    if (estado?.ok) aoFechar();
  }, [estado, aoFechar]);

  return (
    <form action={acao} className="dialogo-forma">
      <div className="dialogo-corpo flex flex-col gap-4">
        <input type="hidden" name="id" value={ambiente.id} />

        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Nome *</span>
          <input
            name="nome"
            defaultValue={ambiente.nome}
            required
            autoFocus
            className="campo"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Observação</span>
          <textarea
            name="observacao"
            defaultValue={ambiente.observacao ?? ""}
            rows={2}
            placeholder="Piso solto no canto, infiltração na parede da janela…"
            className="campo"
          />
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
          {pendente ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}
