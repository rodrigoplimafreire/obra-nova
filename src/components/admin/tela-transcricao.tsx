"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cabecalho, Conteudo, Secao } from "./cabecalho";
import { Dialogo } from "@/components/comum/dialogo";
import { Girando } from "@/components/comum/esqueleto";
import { ItemDeMenu, Menu, SeparadorDeMenu } from "@/components/comum/menu";
import { copiarTexto } from "@/lib/clipboard";
import { formatarDuracao } from "@/lib/audio/recorder";
import {
  apagarTranscricao,
  criarOrcamentoDaTranscricao,
  renomearTranscricao,
  salvarTexto,
  transcreverAvulsa,
} from "@/lib/transcricao/acoes-avulsas";
import {
  nomeDaTranscricao,
  type TranscricaoCompleta,
} from "@/lib/transcricao/tipos";
import type { Resultado } from "@/lib/admin/tipos";

/**
 * O áudio importado e o que saiu dele.
 *
 * O texto é a peça central da tela, e é editável no lugar — a transcrição erra
 * nome de material e número, e corrigir aqui vale mais que corrigir depois,
 * dentro do orçamento, onde o erro já virou preço.
 *
 * Duas saídas: copiar, para levar o texto a qualquer lugar; e virar orçamento,
 * que é o caminho que o módulo existe para encurtar.
 */
export function TelaDaTranscricao({
  transcricao,
}: {
  transcricao: TranscricaoCompleta;
}) {
  const router = useRouter();
  const [renomeando, setRenomeando] = useState(false);
  const [criando, setCriando] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [retranscrevendo, setRetranscrevendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const nome = nomeDaTranscricao({
    titulo: transcricao.titulo,
    arquivoNome: transcricao.arquivoNome,
    criadoEm: transcricao.criadoEm,
  });

  async function retranscrever() {
    setErro(null);
    setRetranscrevendo(true);
    try {
      const saida = await transcreverAvulsa(transcricao.id);
      if (!saida.ok) setErro(saida.erro);
      else router.refresh();
    } catch (e) {
      setErro(
        `A conexão caiu no meio do processo (${e instanceof Error ? e.message : String(e)}). O áudio continua guardado.`,
      );
    } finally {
      setRetranscrevendo(false);
    }
  }

  return (
    <>
      <Cabecalho
        voltarPara="/admin/transcricoes"
        voltarRotulo="Transcrições"
        titulo={nome}
        meta={[
          new Date(transcricao.criadoEm).toLocaleDateString("pt-BR"),
          transcricao.duracaoMs ? formatarDuracao(transcricao.duracaoMs) : null,
          transcricao.editado ? "editado à mão" : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        acoes={
          <Menu>
            <ItemDeMenu
              aoClicar={() => setRenomeando(true)}
              nota="o nome que aparece na lista"
            >
              Renomear
            </ItemDeMenu>
            <ItemDeMenu
              aoClicar={() => void retranscrever()}
              desabilitado={retranscrevendo}
              nota={
                transcricao.editado
                  ? "seu texto corrigido não é sobrescrito"
                  : "usa o mesmo áudio, sem reimportar"
              }
            >
              {retranscrevendo ? "Transcrevendo…" : "Transcrever de novo"}
            </ItemDeMenu>
            <SeparadorDeMenu />
            <ItemDeMenu
              perigo
              aoClicar={() => setApagando(true)}
              nota="apaga o áudio também"
            >
              Apagar
            </ItemDeMenu>
          </Menu>
        }
      />

      <Conteudo>
        {erro && <p className="aviso aviso-erro mb-4 text-sm">{erro}</p>}

        {transcricao.status === "falhou" && !transcricao.texto && (
          <div className="cartao mb-4 flex flex-wrap items-center justify-between gap-4 px-5 py-5">
            <div className="min-w-0">
              <p className="rotulo">Não deu para transcrever</p>
              <p className="mt-1 text-sm leading-relaxed text-fumaca">
                {transcricao.erro ?? "O provedor não respondeu."} O áudio está
                guardado — dá para tentar de novo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void retranscrever()}
              disabled={retranscrevendo}
              className={`btn shrink-0 ${retranscrevendo ? "btn-carregando" : "btn-primario"}`}
            >
              {retranscrevendo && <Girando />}
              {retranscrevendo ? "Transcrevendo…" : "Tentar de novo"}
            </button>
          </div>
        )}

        {transcricao.texto ? (
          <Texto id={transcricao.id} texto={transcricao.texto} />
        ) : (
          transcricao.status !== "falhou" && (
            <div className="cartao flex items-center gap-3 px-5 py-8">
              <Girando />
              <p className="text-sm text-fumaca">
                Transcrevendo o áudio. Isso leva alguns segundos.
              </p>
            </div>
          )
        )}

        {transcricao.texto && (
          <Secao titulo="O que fazer com isto">
            <div className="cartao flex flex-wrap items-center justify-between gap-4 px-5 py-5">
              {transcricao.virouOrcamento ? (
                <>
                  <p className="min-w-0 text-sm leading-relaxed text-fumaca">
                    Este áudio já virou orçamento. Dá para criar outro, se for
                    o caso de dividir o serviço em dois.
                  </p>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link
                      href={`/admin/orcamentos/${transcricao.virouOrcamento}`}
                      className="btn btn-secundario"
                    >
                      Abrir o orçamento
                    </Link>
                    <button
                      type="button"
                      onClick={() => setCriando(true)}
                      className="btn btn-sutil"
                    >
                      Criar outro
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="min-w-0 text-sm leading-relaxed text-fumaca">
                    A IA lê este texto e já monta a tabela de custos. Preço que
                    o cliente não falou fica em branco, como sempre.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCriando(true)}
                    className="btn btn-primario shrink-0"
                  >
                    Criar orçamento
                  </button>
                </>
              )}
            </div>
          </Secao>
        )}
      </Conteudo>

      <DialogoDeRenomear
        transcricao={transcricao}
        nome={nome}
        aberto={renomeando}
        aoFechar={() => setRenomeando(false)}
      />
      <DialogoDeOrcamento
        id={transcricao.id}
        aberto={criando}
        aoFechar={() => setCriando(false)}
      />
      <DialogoDeApagar
        id={transcricao.id}
        nome={nome}
        aberto={apagando}
        aoFechar={() => setApagando(false)}
      />
    </>
  );
}

/**
 * O texto, com edição no lugar.
 *
 * Não abre diálogo: o texto é o conteúdo da tela, e tirá-lo de onde está para
 * corrigir uma palavra obrigaria a ler duas vezes. O botão de copiar fica ao
 * lado porque é a saída mais usada — o empreiteiro cola no WhatsApp, no
 * caderno, onde quiser.
 */
function Texto({ id, texto }: { id: string; texto: string }) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(texto);
  const [copiado, setCopiado] = useState(false);
  const [estado, acao, pendente] = useActionState<Resultado | null, FormData>(
    salvarTexto,
    null,
  );

  useEffect(() => {
    if (estado?.ok) setEditando(false);
  }, [estado]);

  // O texto pode mudar por baixo (retranscrever), e o rascunho precisa
  // acompanhar enquanto ninguém estiver editando.
  useEffect(() => {
    if (!editando) setRascunho(texto);
  }, [texto, editando]);

  return (
    <section className="cartao px-5 py-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="rotulo">Transcrição</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              if (await copiarTexto(texto)) {
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2000);
              }
            }}
            className="btn btn-secundario btn-compacto"
          >
            {copiado ? "Copiado" : "Copiar"}
          </button>
          {!editando && (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="btn btn-sutil btn-compacto"
            >
              Corrigir
            </button>
          )}
        </div>
      </div>

      {editando ? (
        <form action={acao}>
          <input type="hidden" name="id" value={id} />
          <textarea
            name="texto"
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            rows={12}
            className="campo h-auto resize-y py-3 leading-relaxed"
          />
          <p className="ajuda-campo mt-1.5">
            Corrija nome de material e número. Depois de corrigir, transcrever
            de novo não sobrescreve o que você escreveu.
          </p>

          {estado?.erro && (
            <p className="aviso aviso-erro mt-3 text-sm">{estado.erro}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setRascunho(texto);
                setEditando(false);
              }}
              className="btn btn-secundario"
            >
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
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-tinta">
          {texto}
        </p>
      )}
    </section>
  );
}

function DialogoDeRenomear({
  transcricao,
  nome,
  aberto,
  aoFechar,
}: {
  transcricao: TranscricaoCompleta;
  nome: string;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const [estado, acao, pendente] = useActionState<Resultado | null, FormData>(
    renomearTranscricao,
    null,
  );

  useEffect(() => {
    if (estado?.ok) aoFechar();
  }, [estado, aoFechar]);

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Renomear"
      descricao="Sem nome, a lista mostra o nome do arquivo como ele veio."
      estreito
    >
      {aberto && (
        <form action={acao} className="dialogo-forma">
          <div className="dialogo-corpo flex flex-col gap-4">
            <input type="hidden" name="id" value={transcricao.id} />
            <label className="flex flex-col gap-1.5">
              <span className="rotulo-campo">Nome</span>
              <input
                name="titulo"
                defaultValue={transcricao.titulo ?? ""}
                placeholder={nome}
                autoFocus
                className="campo"
              />
              <span className="ajuda-campo">
                Ex.: &ldquo;Dona Izonete — banheiro&rdquo;.
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
              {pendente ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      )}
    </Dialogo>
  );
}

/**
 * Criar o orçamento a partir do texto.
 *
 * Pede só o cliente, como o "Novo orçamento" da outra tela — é o único campo
 * obrigatório lá, e pedir mais aqui atrasaria o caminho que o módulo encurta.
 */
function DialogoDeOrcamento({
  id,
  aberto,
  aoFechar,
}: {
  id: string;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [cliente, setCliente] = useState("");
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    setErro(null);
    setIndo(true);
    try {
      const saida = await criarOrcamentoDaTranscricao(id, cliente);
      if (!saida.ok) {
        setErro(saida.erro);
        setIndo(false);
        return;
      }
      // Segue para o orçamento sem baixar o `indo`: a navegação leva alguns
      // instantes e o botão precisa continuar travado até a tela trocar.
      router.push(saida.link);
    } catch (e) {
      setErro(
        `A conexão caiu no meio (${e instanceof Error ? e.message : String(e)}). Confira a lista de orçamentos antes de tentar de novo.`,
      );
      setIndo(false);
    }
  }

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Criar orçamento com este texto"
      descricao="A IA lê a transcrição e monta a tabela de custos. Você confere e ajusta."
      estreito
    >
      {aberto && (
        <>
          <div className="dialogo-corpo flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="rotulo-campo">Cliente *</span>
              <input
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Para quem é o orçamento"
                autoFocus
                className="campo"
              />
              <span className="ajuda-campo">
                O resto dá para completar depois, no orçamento.
              </span>
            </label>

            {indo && (
              <p className="aviso aviso-atencao flex items-center gap-2 text-sm">
                <Girando />
                Montando a tabela… não feche esta tela.
              </p>
            )}
            {erro && <p className="aviso aviso-erro text-sm">{erro}</p>}
          </div>

          <div className="dialogo-rodape">
            <button
              type="button"
              onClick={aoFechar}
              disabled={indo}
              className="btn btn-secundario"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void criar()}
              disabled={indo || cliente.trim().length < 2}
              className={`btn ${indo ? "btn-carregando" : "btn-primario"}`}
            >
              {indo && <Girando />}
              {indo ? "Criando…" : "Criar e abrir"}
            </button>
          </div>
        </>
      )}
    </Dialogo>
  );
}

function DialogoDeApagar({
  id,
  nome,
  aberto,
  aoFechar,
}: {
  id: string;
  nome: string;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [estado, acao, pendente] = useActionState<Resultado | null, FormData>(
    apagarTranscricao,
    null,
  );

  useEffect(() => {
    if (estado?.ok && estado.link) router.push(estado.link);
  }, [estado, router]);

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={`Apagar “${nome}”?`}
      descricao="O áudio sai do Storage junto. O orçamento que já nasceu deste texto continua."
      estreito
    >
      {aberto && (
        <form action={acao} className="dialogo-forma">
          <div className="dialogo-corpo">
            <input type="hidden" name="id" value={id} />
            <p className="text-sm leading-relaxed text-fumaca">
              Não dá para desfazer. Se quiser guardar o texto, copie antes.
            </p>
            {estado?.erro && (
              <p className="aviso aviso-erro mt-3 text-sm">{estado.erro}</p>
            )}
          </div>
          <div className="dialogo-rodape">
            <button type="button" onClick={aoFechar} className="btn btn-secundario">
              Cancelar
            </button>
            <button type="submit" disabled={pendente} className="btn btn-perigo">
              {pendente ? "Apagando…" : "Apagar"}
            </button>
          </div>
        </form>
      )}
    </Dialogo>
  );
}
