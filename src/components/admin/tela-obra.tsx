"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Cabecalho,
  CartaoDeDados,
  Conteudo,
  Dado,
  Indicador,
  Secao,
} from "./cabecalho";
import { copiarTexto } from "@/lib/clipboard";
import { CampoDeTelefone } from "@/components/comum/campos";
import { Dialogo } from "@/components/comum/dialogo";
import { Dica } from "@/components/comum/dica";
import { Girando } from "@/components/comum/esqueleto";
import {
  adicionarMestre,
  atualizarAtividade,
  atualizarObra,
  copiarUltimoDia,
  removerMestre,
  salvarAtividadesDoDia,
  trazerPendencias,
} from "@/lib/admin/acoes-obra";
import { AbaDeRelatorio } from "./aba-relatorio";
import type { Resultado } from "@/lib/admin/tipos";
import type { AtividadeNaTela, DetalheDaObra, Pendencia } from "@/lib/admin/obras";
import type { RelatorioCompleto } from "@/lib/relatorio/dados";

const ROTULO_STATUS = {
  pendente: "Aguardando",
  feita: "Feita",
  parcial: "Parcial",
  nao_feita: "Não feita",
} as const;

/* Os selos de estado do documento: cor de fundo clara com o texto no tom
   forte da mesma família, e sempre a palavra junto — a obra é lida no sol, por
   gente com pressa, e cor sozinha não diz nada para quem não distingue. */
const COR_STATUS = {
  pendente: "selo-neutro",
  feita: "selo-emdia",
  parcial: "selo-atencao",
  nao_feita: "selo-atraso",
} as const;

const DIA_POR_EXTENSO = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  timeZone: "UTC",
});

const DIA_CURTO = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

function formatarDiaCurto(dia: string) {
  if (!dia) return "";
  return DIA_CURTO.format(new Date(`${dia}T12:00:00Z`));
}

type Aba = "checklist" | "mestres" | "relatorio";

export function TelaDaObra({
  detalhe,
  dia,
  hoje,
  aba,
  pendencias,
  semana,
  relatorio,
}: {
  detalhe: DetalheDaObra;
  dia: string;
  hoje: string;
  aba: Aba;
  pendencias: { deQualDia: string; itens: Pendencia[] };
  semana: { inicio: string; fim: string; temServicos: boolean };
  relatorio: RelatorioCompleto | null;
}) {
  const router = useRouter();
  const { obra, mestres, atividades } = detalhe;

  const confirmadas = atividades.filter((a) =>
    a.confirmacoes.some((c) => c.status !== "pendente"),
  ).length;

  return (
    <>
      <Cabecalho
        voltarPara="/admin/obras"
        voltarRotulo="Obras"
        titulo={obra.nome}
        meta={`${obra.cliente}${obra.endereco ? ` · ${obra.endereco}` : ""}`}
      />

      <Conteudo>
        {/* Cartão sempre à vista, com "Editar" dentro — o mesmo padrão do
            orçamento. Antes era um botão "Configurações" no cabeçalho que
            abria um formulário no meio da página, e os dados da obra só
            existiam na tela enquanto o formulário estivesse aberto. */}
        <DadosDaObra obra={obra} />

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Indicador rotulo="Atividades" valor={atividades.length} />
          <Indicador
            rotulo="Confirmadas"
            valor={`${confirmadas}/${atividades.length}`}
            destaque={
              atividades.length > 0 && confirmadas === atividades.length
                ? "arroio"
                : undefined
            }
          />
          <Indicador rotulo="Mestres" valor={mestres.length} />
          <Indicador
            rotulo="Dia"
            valor={dia === hoje ? "Hoje" : dia.split("-").reverse().slice(0, 2).join("/")}
          />
        </div>

        <div className="mt-6 mb-6 flex gap-2 border-b border-nevoa">
          {(
            [
              ["checklist", "Checklist"],
              ["relatorio", "Relatório"],
              ["mestres", `Mestres (${mestres.length})`],
            ] as const
          ).map(([chave, rotulo]) => (
            <Link
              key={chave}
              href={`/admin/obras/${obra.id}?dia=${dia}&aba=${chave}`}
              aria-current={aba === chave ? "page" : undefined}
              className={`-mb-px border-b-2 px-1 pb-3 text-sm font-semibold transition ${
                aba === chave
                  ? "border-tinta text-tinta"
                  : "border-transparent text-cinza"
              }`}
            >
              {rotulo}
            </Link>
          ))}
        </div>

        {aba === "checklist" ? (
          <>
            <Secao
              titulo="Dia"
              acao={
                <input
                  type="date"
                  value={dia}
                  max={hoje}
                  onChange={(e) => {
                    if (e.target.value) {
                      router.push(
                        `/admin/obras/${obra.id}?dia=${e.target.value}&aba=checklist`,
                      );
                    }
                  }}
                  className="rounded-full border border-nevoa bg-white px-3 py-1.5 font-mono text-xs text-grafite"
                />
              }
            >
              {/* first-letter, não capitalize: em português só a primeira letra
                  sobe. `capitalize` devolvia "Segunda-Feira, 27 De Julho". */}
              <p className="text-sm text-cinza first-letter:uppercase">
                {DIA_POR_EXTENSO.format(new Date(`${dia}T12:00:00Z`))}
              </p>
            </Secao>

            <EditorDoDia
              obraId={obra.id}
              dia={dia}
              atividades={atividades.map((a) => a.titulo)}
              temMestre={mestres.length > 0}
              pendencias={pendencias}
            />

            <Secao titulo="Serviços deste dia">
              {atividades.length === 0 ? (
                <p className="rounded-lg border border-dashed border-nevoa bg-white px-5 py-10 text-center text-sm text-cinza">
                  Sem atividades lançadas para este dia.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {atividades.map((a, i) => (
                    <ItemDeAtividade
                      key={a.id}
                      atividade={a}
                      obraId={obra.id}
                      numero={i + 1}
                    />
                  ))}
                </ul>
              )}
            </Secao>
          </>
        ) : aba === "relatorio" ? (
          <AbaDeRelatorio
            obraId={obra.id}
            inicio={semana.inicio}
            fim={semana.fim}
            relatorio={relatorio}
            temServicos={semana.temServicos}
          />
        ) : (
          <Mestres obraId={obra.id} mestres={mestres} />
        )}
      </Conteudo>
    </>
  );
}

function DadosDaObra({ obra }: { obra: DetalheDaObra["obra"] }) {
  const [editando, setEditando] = useState(false);

  return (
    <CartaoDeDados titulo="Dados da obra" aoEditar={() => setEditando(true)}>
      <>
        <Dado rotulo="Nome da obra" valor={obra.nome} />
        <Dado rotulo="Cliente" valor={obra.cliente} />
        <Dado rotulo="Endereço" valor={obra.endereco} />
        <Dado
          rotulo="Quem assina o relatório"
          valor={obra.marcaNome}
          vazio="usa o nome padrão da conta"
          dica="Aparece no rodapé do relatório que o cliente recebe. Preencha com o nome da empreiteira quando o relatório sai em nome dela, não seu."
        />

        <Dialogo
          aberto={editando}
          aoFechar={() => setEditando(false)}
          titulo="Dados da obra"
          descricao="O nome e o cliente aparecem no relatório que o cliente abre toda semana."
        >
          {editando && (
            <FormularioDaObra obra={obra} aoFechar={() => setEditando(false)} />
          )}
        </Dialogo>
      </>
    </CartaoDeDados>
  );
}

function FormularioDaObra({
  obra,
  aoFechar,
}: {
  obra: DetalheDaObra["obra"];
  aoFechar: () => void;
}) {
  const [estado, acao, pendente] = useActionState<Resultado | null, FormData>(
    atualizarObra,
    null,
  );

  useEffect(() => {
    if (estado?.ok) aoFechar();
  }, [estado, aoFechar]);

  return (
    <form action={acao} className="dialogo-forma">
      <div className="dialogo-corpo flex flex-col gap-4">
        <input type="hidden" name="id" value={obra.id} />

        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Nome da obra *</span>
          <input
            name="nome"
            defaultValue={obra.nome}
            required
            minLength={2}
            className="campo"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Cliente *</span>
          <input
            name="cliente"
            defaultValue={obra.cliente}
            required
            minLength={2}
            className="campo"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Endereço</span>
          <input
            name="endereco"
            defaultValue={obra.endereco ?? ""}
            className="campo"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Quem assina o relatório do cliente</span>
          <input
            name="marcaNome"
            defaultValue={obra.marcaNome ?? ""}
            placeholder="Ex.: RD Engenharia"
            className="campo"
          />
          <span className="ajuda-campo">
            Aparece no rodapé do relatório que o cliente recebe. Em branco, usa
            o nome padrão da conta.
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
  );
}

/**
 * Um serviço do dia: o que você pediu em cima, o que voltou do canteiro
 * embaixo. O texto de apoio se edita aqui, e é ele que vira o subtítulo na
 * tela do mestre — o lugar da instrução que não cabe no título.
 */
function ItemDeAtividade({
  atividade,
  obraId,
  numero,
}: {
  atividade: AtividadeNaTela;
  obraId: string;
  numero: number;
}) {
  const [editando, setEditando] = useState(false);
  const [estado, acao, salvando] = useActionState<Resultado | null, FormData>(
    atualizarAtividade,
    null,
  );

  useEffect(() => {
    if (estado?.ok) setEditando(false);
  }, [estado?.ok]);

  if (editando) {
    return (
      <li className="rounded-lg border-2 border-tinta bg-white px-5 py-4">
        <form action={acao}>
          <p className="rotulo">Editando o serviço {numero}</p>
          <input type="hidden" name="id" value={atividade.id} />
          <input type="hidden" name="obraId" value={obraId} />

          <label className="mt-3 flex flex-col gap-1.5">
            <span className="rotulo-campo">O que fazer *</span>
            <textarea
              name="titulo"
              rows={2}
              defaultValue={atividade.titulo}
              required
              minLength={3}
              className="campo resize-y"
            />
          </label>

          <label className="mt-3 flex flex-col gap-1.5">
            <span className="rotulo-campo">Texto de apoio (opcional)</span>
            <textarea
              name="detalhe"
              rows={2}
              defaultValue={atividade.detalhe ?? ""}
              className="campo resize-y text-sm"
            />
            <span className="ajuda-campo">
              Aparece menor, embaixo do serviço, na tela do mestre. Use para a
              medida, o cuidado, o horário: o que evita a dúvida no canteiro.
            </span>
          </label>

          {estado?.erro && (
            <p className="mt-2 aviso aviso-erro text-sm">{estado.erro}</p>
          )}

          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={salvando} className="btn btn-primario">
              {salvando ? "Salvando…" : "Salvar"}
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="btn btn-secundario"
            >
              Cancelar
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-nevoa bg-white px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tinta font-mono text-[0.6rem] text-papel">
          {numero}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-tinta">{atividade.titulo}</p>
          {atividade.detalhe ? (
            <p className="mt-1 text-sm leading-relaxed text-cinza">
              {atividade.detalhe}
            </p>
          ) : (
            <p className="mt-1 text-xs text-cinza italic">
              Sem texto de apoio.
            </p>
          )}

          {atividade.confirmacoes.length === 0 ? (
            <p className="mt-2 font-mono text-[0.6rem] tracking-widest text-cinza uppercase">
              Aguardando o mestre
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {atividade.confirmacoes.map((c) => (
                <li key={c.id} className="border-t border-nevoa/60 pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`selo ${COR_STATUS[c.status]}`}
                    >
                      {ROTULO_STATUS[c.status]}
                    </span>
                    <span className="rotulo">{c.mestreNome}</span>
                    <Evidencia blocos={c.blocos} />
                  </div>
                  {c.blocos
                    .filter((b) => b.type === "text" && b.texto)
                    .map((b) => (
                      <p
                        key={b.id}
                        className="mt-2 text-sm leading-relaxed text-grafite"
                      >
                        {b.texto}
                      </p>
                    ))}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 border-t border-nevoa/60 pt-3">
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="acao-texto text-amarelo-tinta"
            >
              editar
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

function Evidencia({
  blocos,
}: {
  blocos: DetalheDaObra["atividades"][number]["confirmacoes"][number]["blocos"];
}) {
  const fotos = blocos.filter((b) => b.type === "image").length;
  const audios = blocos.filter((b) => b.type === "audio").length;
  if (fotos === 0 && audios === 0) return null;

  return (
    <span className="font-mono text-[0.6rem] tracking-widest text-amarelo-tinta uppercase">
      {fotos > 0 && `${fotos} ${fotos === 1 ? "foto" : "fotos"}`}
      {fotos > 0 && audios > 0 && " · "}
      {audios > 0 && `${audios} ${audios === 1 ? "áudio" : "áudios"}`}
    </span>
  );
}

function EditorDoDia({
  obraId,
  dia,
  atividades,
  temMestre,
  pendencias,
}: {
  obraId: string;
  dia: string;
  atividades: string[];
  temMestre: boolean;
  pendencias: { deQualDia: string; itens: Pendencia[] };
}) {
  const [texto, setTexto] = useState(atividades.join("\n"));
  const [salvar, acaoSalvar, salvando] = useActionState<Resultado | null, FormData>(
    salvarAtividadesDoDia,
    null,
  );
  const [copia, acaoCopiar, copiando] = useActionState<Resultado | null, FormData>(
    copiarUltimoDia,
    null,
  );
  const [trazido, acaoTrazer, trazendo] = useActionState<Resultado | null, FormData>(
    trazerPendencias,
    null,
  );

  const naLista = new Set(atividades);
  const aTrazer = pendencias.itens.filter((p) => !naLista.has(p.titulo));

  return (
    <Secao
      titulo="Lançar o dia"
      acao={
        atividades.length === 0 ? (
          <form action={acaoCopiar}>
            <input type="hidden" name="obraId" value={obraId} />
            <input type="hidden" name="dia" value={dia} />
            <button type="submit" disabled={copiando} className="btn btn-secundario">
              {copiando ? "Copiando…" : "Repetir último dia"}
            </button>
          </form>
        ) : undefined
      }
    >
      {/* O que não foi terminado ontem precisa reaparecer, senão some do
          checklist e ninguém mais lembra. Fica como um toque em vez de
          automático: quem decide o que entra no dia é quem toca a obra. */}
      {aTrazer.length > 0 && (
        <form
          action={acaoTrazer}
          className="mb-4 rounded-lg border-2 border-amarelo bg-amarelo/10 px-5 py-4"
        >
          <input type="hidden" name="obraId" value={obraId} />
          <input type="hidden" name="dia" value={dia} />

          <p className="rotulo !text-amarelo-tinta">
            Ficou pendente em {formatarDiaCurto(pendencias.deQualDia)}
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {aTrazer.map((p) => (
              <li key={p.titulo} className="text-sm leading-snug text-grafite">
                {p.titulo}
              </li>
            ))}
          </ul>

          {trazido?.erro && (
            <p className="mt-3 text-sm text-tinta">{trazido.erro}</p>
          )}

          <button
            type="submit"
            disabled={trazendo}
            className="btn btn-primario mt-4"
          >
            {trazendo
              ? "Trazendo…"
              : `Trazer ${aTrazer.length} para este dia`}
          </button>
        </form>
      )}

      <form action={acaoSalvar}>
        <input type="hidden" name="obraId" value={obraId} />
        <input type="hidden" name="dia" value={dia} />

        <textarea
          name="atividades"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={Math.max(5, texto.split("\n").length + 1)}
          placeholder={"Uma atividade por linha. Por exemplo:\nRebocar a parede dos fundos\nAssentar o piso do banheiro\nRetirar entulho da calçada"}
          className="campo resize-y text-sm leading-relaxed"
        />
        <p className="mt-1.5 text-xs text-cinza">
          Uma por linha, para lançar rápido. O texto de apoio de cada serviço se
          escreve abaixo, no card, em “editar”.
        </p>

        {!temMestre && (
          <p className="mt-3 aviso aviso-erro text-sm leading-relaxed text-tinta">
            Esta obra ainda não tem mestre cadastrado. Sem isso não há para quem
            mandar o checklist. Cadastre um lá embaixo.
          </p>
        )}

        {copia?.erro && (
          <p className="mt-3 aviso aviso-erro text-sm">
            {copia.erro}
          </p>
        )}

        {salvar?.erro && (
          <p
            className={`mt-3 aviso text-sm leading-relaxed ${
              salvar.ok ? "aviso-ok" : "aviso-erro"
            }`}
          >
            {salvar.erro}
          </p>
        )}

        <button
          type="submit"
          disabled={salvando}
          className="btn btn-primario mt-4"
        >
          {salvando ? "Salvando…" : "Salvar o dia"}
        </button>
      </form>
    </Secao>
  );
}

function Mestres({
  obraId,
  mestres,
}: {
  obraId: string;
  mestres: DetalheDaObra["mestres"];
}) {
  const [adicionando, setAdicionando] = useState(false);

  return (
    <Secao
      titulo="Mestres de obra"
      acao={
        <button
          type="button"
          onClick={() => setAdicionando((v) => !v)}
          className="btn btn-secundario"
        >
          {adicionando ? "Fechar" : "Adicionar mestre"}
        </button>
      }
    >
      {adicionando && (
        <FormularioDeMestre
          obraId={obraId}
          aoTerminar={() => setAdicionando(false)}
        />
      )}

      {mestres.length === 0 ? (
        <p className="rounded-lg border border-dashed border-nevoa bg-white px-5 py-10 text-center text-sm text-cinza">
          Nenhum mestre nesta obra ainda.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {mestres.map((m) => (
            <LinhaDeMestre key={m.id} obraId={obraId} mestre={m} />
          ))}
        </ul>
      )}
    </Secao>
  );
}

function FormularioDeMestre({
  obraId,
  aoTerminar,
}: {
  obraId: string;
  aoTerminar: () => void;
}) {
  const [estado, acao, pendente] = useActionState<Resultado | null, FormData>(
    adicionarMestre,
    null,
  );

  return (
    <form
      action={acao}
      className="mb-3 rounded-lg border border-nevoa bg-white px-5 py-4"
    >
      <input type="hidden" name="obraId" value={obraId} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="rotulo-campo">Nome *</span>
          <input name="nome" required minLength={2} className="campo" />
        </label>
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="rotulo-campo">Celular</span>
          {/* Máscara de telefone, como em todo campo de telefone do app. Este
              era o único que aceitava o número cru. */}
          <CampoDeTelefone nome="telefone" placeholder="(85) 99999-0000" />
        </label>
      </div>

      {estado?.erro && (
        <p className="mt-3 aviso aviso-erro text-sm">
          {estado.erro}
        </p>
      )}

      {estado?.ok && (
        <p className="mt-3 aviso aviso-atencao text-sm leading-relaxed text-tinta">
          Mestre cadastrado. O link fixo dele já aparece na lista, é só mandar
          no WhatsApp uma vez.
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={pendente} className="btn btn-primario">
          {pendente ? "Salvando…" : "Cadastrar"}
        </button>
        <button type="button" onClick={aoTerminar} className="btn btn-secundario">
          Fechar
        </button>
      </div>
    </form>
  );
}

function LinhaDeMestre({
  obraId,
  mestre,
}: {
  obraId: string;
  mestre: DetalheDaObra["mestres"][number];
}) {
  const [copiado, setCopiado] = useState(false);
  const [, acaoRemover, removendo] = useActionState<Resultado | null, FormData>(
    removerMestre,
    null,
  );

  async function copiarLink() {
    const url = `${window.location.origin}/o/${mestre.token}`;
    if (await copiarTexto(url)) {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-nevoa bg-white px-5 py-4">
      <div className="min-w-0">
        <p className="font-semibold text-tinta">{mestre.nome}</p>
        {mestre.telefone && (
          <p className="mt-0.5 font-mono text-[0.65rem] tracking-widest text-cinza">
            {mestre.telefone}
          </p>
        )}
      </div>

      <div className="flex shrink-0 gap-2">
        <Dica texto="Link fixo do mestre. Ele usa o mesmo todo dia.">
          <button
            type="button"
            onClick={() => void copiarLink()}
            className="btn btn-secundario"
          >
            {copiado ? "Copiado" : "Copiar link"}
          </button>
        </Dica>
        <form action={acaoRemover}>
          <input type="hidden" name="obraId" value={obraId} />
          <input type="hidden" name="mestreId" value={mestre.id} />
          <Dica texto="Tira o mestre da obra. O que ele já mandou continua no relatório.">
            <button
              type="submit"
              disabled={removendo}
              className="btn btn-secundario"
            >
              Remover
            </button>
          </Dica>
        </form>
      </div>
    </li>
  );
}
