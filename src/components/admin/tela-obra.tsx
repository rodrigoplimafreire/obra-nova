"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cabecalho, Conteudo, Indicador, Secao } from "./cabecalho";
import { copiarTexto } from "@/lib/clipboard";
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

const COR_STATUS = {
  pendente: "bg-nevoa text-fumaca",
  feita: "bg-limao text-limao-tinta",
  parcial: "bg-azul-vazado text-azul",
  nao_feita: "bg-alerta/25 text-alerta-tinta",
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
  const [configAberta, setConfigAberta] = useState(false);

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
        acoes={
          <button
            type="button"
            onClick={() => setConfigAberta((a) => !a)}
            className="btn btn-vazado"
          >
            Configurações
          </button>
        }
      />

      <Conteudo>
        {configAberta && (
          <DadosDaObra obra={obra} aoFechar={() => setConfigAberta(false)} />
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Indicador rotulo="Atividades" valor={atividades.length} />
          <Indicador
            rotulo="Confirmadas"
            valor={`${confirmadas}/${atividades.length}`}
            destaque={
              atividades.length > 0 && confirmadas === atividades.length
                ? "limao"
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
                  ? "border-azul text-tinta"
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
                <p className="rounded-3xl border border-dashed border-nevoa bg-white px-5 py-10 text-center text-sm text-cinza">
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

function DadosDaObra({
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

  return (
    <form
      action={acao}
      className="mb-6 rounded-3xl border border-nevoa bg-white p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="rotulo">Configurações da obra</p>
        <button type="button" onClick={aoFechar} className="acao-texto text-cinza">
          fechar
        </button>
      </div>

      <input type="hidden" name="id" value={obra.id} />

      <label className="mt-4 block">
        <span className="text-sm font-medium text-grafite">Nome da obra</span>
        <input name="nome" defaultValue={obra.nome} required minLength={2} className="campo mt-1.5" />
      </label>

      <label className="mt-4 block">
        <span className="text-sm font-medium text-grafite">Cliente</span>
        <input
          name="cliente"
          defaultValue={obra.cliente}
          required
          minLength={2}
          className="campo mt-1.5"
        />
      </label>

      <label className="mt-4 block">
        <span className="text-sm font-medium text-grafite">Endereço</span>
        <input name="endereco" defaultValue={obra.endereco ?? ""} className="campo mt-1.5" />
      </label>

      <label className="mt-4 block">
        <span className="text-sm font-medium text-grafite">
          Quem assina o relatório do cliente
        </span>
        <span className="mt-0.5 block text-xs text-cinza">
          Aparece no rodapé do relatório que o cliente recebe. Em branco, usa o
          nome padrão da conta. Preencha com o nome da empreiteira quando o
          relatório sai em nome dela, não seu.
        </span>
        <input
          name="marcaNome"
          defaultValue={obra.marcaNome ?? ""}
          placeholder="Ex.: RD Engenharia"
          className="campo mt-1.5"
        />
      </label>

      {estado?.erro && (
        <p className="mt-3 text-sm text-alerta-tinta">{estado.erro}</p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button type="submit" disabled={pendente} className="btn btn-escuro">
          {pendente ? "Salvando…" : "Salvar"}
        </button>
        {estado?.ok && (
          <span className="font-mono text-[0.65rem] tracking-widest text-azul uppercase">
            salvo
          </span>
        )}
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
      <li className="rounded-3xl border-2 border-azul bg-white px-5 py-4">
        <form action={acao}>
          <p className="rotulo">Editando o serviço {numero}</p>
          <input type="hidden" name="id" value={atividade.id} />
          <input type="hidden" name="obraId" value={obraId} />

          <label className="mt-3 block">
            <span className="text-sm font-medium text-grafite">O que fazer</span>
            <textarea
              name="titulo"
              rows={2}
              defaultValue={atividade.titulo}
              required
              minLength={3}
              className="campo mt-1.5 resize-y"
            />
          </label>

          <label className="mt-3 block">
            <span className="text-sm font-medium text-grafite">
              Texto de apoio (opcional)
            </span>
            <span className="mt-0.5 block text-xs text-cinza">
              Aparece menor, embaixo do serviço, na tela do mestre. Use para a
              medida, o cuidado, o horário: o que evita a dúvida no canteiro.
            </span>
            <textarea
              name="detalhe"
              rows={2}
              defaultValue={atividade.detalhe ?? ""}
              className="campo mt-1.5 resize-y text-sm"
            />
          </label>

          {estado?.erro && (
            <p className="mt-2 text-sm text-alerta-tinta">{estado.erro}</p>
          )}

          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={salvando} className="btn btn-escuro">
              {salvando ? "Salvando…" : "Salvar"}
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="btn btn-vazado"
            >
              Cancelar
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="rounded-3xl border border-nevoa bg-white px-5 py-4">
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
                      className={`rounded-full px-2.5 py-0.5 font-mono text-[0.6rem] tracking-widest uppercase ${COR_STATUS[c.status]}`}
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
              className="acao-texto text-azul"
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
    <span className="font-mono text-[0.6rem] tracking-widest text-azul uppercase">
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
            <button type="submit" disabled={copiando} className="btn btn-vazado">
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
          className="mb-4 rounded-3xl border-2 border-limao bg-limao/10 px-5 py-4"
        >
          <input type="hidden" name="obraId" value={obraId} />
          <input type="hidden" name="dia" value={dia} />

          <p className="rotulo !text-limao-tinta">
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
            <p className="mt-3 text-sm text-alerta-tinta">{trazido.erro}</p>
          )}

          <button
            type="submit"
            disabled={trazendo}
            className="btn btn-escuro mt-4"
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
          <p className="mt-3 rounded-2xl bg-alerta/20 px-4 py-3 text-sm leading-relaxed text-alerta-tinta">
            Esta obra ainda não tem mestre cadastrado. Sem isso não há para quem
            mandar o checklist. Cadastre um lá embaixo.
          </p>
        )}

        {copia?.erro && (
          <p className="mt-3 rounded-2xl bg-alerta/20 px-4 py-3 text-sm text-alerta-tinta">
            {copia.erro}
          </p>
        )}

        {salvar?.erro && (
          <p
            className={`mt-3 rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              salvar.ok
                ? "bg-azul-vazado text-azul"
                : "bg-alerta/20 text-alerta-tinta"
            }`}
          >
            {salvar.erro}
          </p>
        )}

        <button
          type="submit"
          disabled={salvando}
          className="btn btn-principal mt-4"
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
          className="btn btn-vazado"
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
        <p className="rounded-3xl border border-dashed border-nevoa bg-white px-5 py-10 text-center text-sm text-cinza">
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
      className="mb-3 rounded-3xl border border-nevoa bg-white px-5 py-4"
    >
      <input type="hidden" name="obraId" value={obraId} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="block flex-1">
          <span className="text-sm font-medium text-grafite">Nome</span>
          <input name="nome" required minLength={2} className="campo mt-1.5" />
        </label>
        <label className="block flex-1">
          <span className="text-sm font-medium text-grafite">Celular</span>
          <input name="telefone" inputMode="tel" className="campo mt-1.5" />
        </label>
      </div>

      {estado?.erro && (
        <p className="mt-3 rounded-2xl bg-alerta/20 px-4 py-3 text-sm text-alerta-tinta">
          {estado.erro}
        </p>
      )}

      {estado?.ok && (
        <p className="mt-3 rounded-2xl bg-limao/30 px-4 py-3 text-sm leading-relaxed text-limao-tinta">
          Mestre cadastrado. O link fixo dele já aparece na lista, é só mandar
          no WhatsApp uma vez.
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={pendente} className="btn btn-principal">
          {pendente ? "Salvando…" : "Cadastrar"}
        </button>
        <button type="button" onClick={aoTerminar} className="btn btn-vazado">
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
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-nevoa bg-white px-5 py-4">
      <div className="min-w-0">
        <p className="font-semibold text-tinta">{mestre.nome}</p>
        {mestre.telefone && (
          <p className="mt-0.5 font-mono text-[0.65rem] tracking-widest text-cinza">
            {mestre.telefone}
          </p>
        )}
      </div>

      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => void copiarLink()}
          data-dica="Link fixo do mestre. Ele usa o mesmo todo dia."
          className="dica dica-esq btn btn-vazado"
        >
          {copiado ? "Copiado" : "Copiar link"}
        </button>
        <form action={acaoRemover}>
          <input type="hidden" name="obraId" value={obraId} />
          <input type="hidden" name="mestreId" value={mestre.id} />
          <button
            type="submit"
            disabled={removendo}
            data-dica="Tira o mestre da obra. O que ele já mandou continua no relatório."
            className="dica dica-esq btn btn-vazado"
          >
            Remover
          </button>
        </form>
      </div>
    </li>
  );
}
