"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialogo } from "@/components/comum/dialogo";
import { Girando } from "@/components/comum/esqueleto";
import { ItemDeMenu, Menu, SeparadorDeMenu } from "@/components/comum/menu";
import {
  despublicarOrcamento,
  marcarSituacao,
  publicarOrcamento,
} from "@/lib/orcamento/acoes-publicacao";
import { gerarObraDoOrcamento } from "@/lib/orcamento/acoes";
import { copiarTexto } from "@/lib/clipboard";
import { data, moeda } from "@/lib/orcamento/formato";
import type { Resultado } from "@/lib/admin/tipos";
import type {
  OrcamentoCompleto,
  SituacaoDoOrcamento,
} from "@/lib/orcamento/dados";

/**
 * O bloco que transforma a tabela de custos em documento e acompanha a
 * conversa com o cliente até ela virar obra.
 *
 * Publicar é ato humano e é ato de congelamento — o rascunho continua
 * editável, mas o que o cliente vê só muda quando alguém publica de novo. A
 * mesma disciplina do relatório da obra.
 *
 * **Um card, não três.** Antes "virar obra" morava num cartão próprio logo
 * acima, perguntando "Cliente aprovou?" enquanto o cartão de baixo já dizia,
 * em selo, se o cliente tinha aprovado. Duas seções falando do mesmo estado, e
 * seis botões visíveis ao mesmo tempo.
 *
 * **A prominência segue o estado, não a lista de funcionalidades.** Só existe
 * um botão em destaque por vez, e ele é sempre o próximo passo real: publicar
 * quando não foi publicado, virar obra quando o cliente aprovou. O resto —
 * republicar, tirar do ar, marcar resposta — é raro e mora no menu.
 */

export const ROTULO_SITUACAO: Record<SituacaoDoOrcamento, string> = {
  rascunho: "Não enviado",
  enviado: "Enviado",
  visto: "Visto pelo cliente",
  negociando: "Em negociação",
  aprovado: "Aprovado",
  recusado: "Recusado",
  expirado: "Expirado",
};

export const COR_SITUACAO: Record<SituacaoDoOrcamento, string> = {
  rascunho: "selo-neutro",
  enviado: "selo-planejado",
  visto: "selo-atencao",
  negociando: "selo-atencao",
  aprovado: "selo-emdia",
  recusado: "selo-atraso",
  expirado: "selo-atraso",
};

export function PublicacaoDoOrcamento({
  orcamento,
  urlBase,
}: {
  orcamento: OrcamentoCompleto;
  urlBase: string;
}) {
  const router = useRouter();
  const [publicado, publicar, publicando] = useActionState<
    Resultado | null,
    FormData
  >(publicarOrcamento, null);
  const [despublicando, setDespublicando] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const [virandoObra, setVirandoObra] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (publicado?.ok) router.refresh();
  }, [publicado, router]);

  const noAr = orcamento.versaoPublicada !== null;
  const link = `${urlBase}/p/${orcamento.token}`;

  const impedimentos: string[] = [];
  if (orcamento.itens.length === 0) impedimentos.push("nenhum item lançado");
  if (orcamento.valorFechado === null && orcamento.semPreco > 0) {
    impedimentos.push(
      `${orcamento.semPreco} ${orcamento.semPreco === 1 ? "item sem preço de venda" : "itens sem preço de venda"}`,
    );
  }
  if (!orcamento.senha) impedimentos.push("sem senha definida");

  return (
    <section className="cartao mt-6 px-5 py-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="rotulo">Documento do cliente</p>
          <span className={`selo ${COR_SITUACAO[orcamento.situacao]}`}>
            {ROTULO_SITUACAO[orcamento.situacao]}
          </span>
          {noAr && (
            <span className="selo selo-neutro">v{orcamento.versaoPublicada}</span>
          )}
        </div>

        {noAr && (
          <Menu>
            <ItemDeMenu
              aoClicar={() => setMarcando(true)}
              nota="quando ele responde por telefone ou pessoalmente"
            >
              Marcar resposta
            </ItemDeMenu>

            {/* Fora do estado aprovado, virar obra é adiantar o pedido — fica
                disponível, mas sem disputar destaque com o próximo passo. */}
            {!orcamento.obraId && orcamento.situacao !== "aprovado" && (
              <ItemDeMenu
                aoClicar={() => setVirandoObra(true)}
                nota="abre o canteiro com os dados daqui"
              >
                Virar obra
              </ItemDeMenu>
            )}

            <SeparadorDeMenu />

            <form action={publicar}>
              <input type="hidden" name="id" value={orcamento.id} />
              <ItemDeMenu
                tipo="submit"
                desabilitado={publicando}
                nota="congela o rascunho atual; o link continua o mesmo"
              >
                {publicando
                  ? "Publicando…"
                  : `Republicar (v${(orcamento.versaoPublicada ?? 0) + 1})`}
              </ItemDeMenu>
            </form>

            <ItemDeMenu
              perigo
              aoClicar={() => setDespublicando(true)}
              nota="o link para de funcionar; o rascunho fica"
            >
              Tirar do ar
            </ItemDeMenu>
          </Menu>
        )}
      </div>

      {!noAr ? (
        <>
          <p className="text-sm leading-relaxed text-fumaca">
            O cliente abre por link e senha. Custo e margem{" "}
            <strong className="text-tinta">não vão junto</strong>.
          </p>

          {impedimentos.length > 0 && (
            <p className="aviso aviso-atencao mt-3 text-sm">
              Falta resolver: {impedimentos.join(", ")}.
            </p>
          )}
          {publicado?.erro && (
            <p className="aviso aviso-erro mt-3 text-sm">{publicado.erro}</p>
          )}

          <form action={publicar} className="mt-4">
            <input type="hidden" name="id" value={orcamento.id} />
            <button
              type="submit"
              disabled={publicando || impedimentos.length > 0}
              className={`btn ${publicando ? "btn-carregando" : "btn-primario"}`}
            >
              {publicando && <Girando />}
              {publicando ? "Publicando…" : "Publicar para o cliente"}
            </button>
          </form>
        </>
      ) : (
        <>
          {/* Link e senha juntos: são as duas coisas que o cliente precisa
              receber, e mandar uma sem a outra não serve para nada. */}
          <div className="rounded-sm border border-nevoa bg-papel">
            <div className="flex items-center gap-1 px-3 py-2">
              <code className="min-w-0 flex-1 truncate font-mono text-xs text-fumaca">
                {link}
              </code>
              <BotaoDeIcone
                rotulo={copiado ? "Copiado" : "Copiar link"}
                aoClicar={async () => {
                  if (await copiarTexto(link)) {
                    setCopiado(true);
                    setTimeout(() => setCopiado(false), 2000);
                  }
                }}
              >
                {copiado ? (
                  <path d="M4 12.5 9.5 18 20 6.5" />
                ) : (
                  <>
                    <rect x="9" y="9" width="11" height="11" rx="2" />
                    <path d="M5 15V5a2 2 0 0 1 2-2h8" />
                  </>
                )}
              </BotaoDeIcone>
              <BotaoDeIcone rotulo="Abrir em nova aba" href={link}>
                <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
              </BotaoDeIcone>
            </div>

            {orcamento.senha && (
              <p className="border-t border-nevoa px-3 py-2 font-mono text-[0.65rem] tracking-widest text-cinza uppercase">
                Senha <b className="ml-1 text-tinta">{orcamento.senha}</b>
              </p>
            )}
          </div>

          <Acompanhamento orcamento={orcamento} />

          <ProximoPasso
            orcamento={orcamento}
            aoVirarObra={() => setVirandoObra(true)}
          />

          {publicado?.erro && (
            <p className="aviso aviso-erro mt-3 text-sm">{publicado.erro}</p>
          )}
        </>
      )}

      <DialogoDeDespublicar
        orcamento={orcamento}
        aberto={despublicando}
        aoFechar={() => setDespublicando(false)}
      />
      <DialogoDeSituacao
        orcamento={orcamento}
        aberto={marcando}
        aoFechar={() => setMarcando(false)}
      />
      <DialogoDeVirarObra
        orcamento={orcamento}
        aberto={virandoObra}
        aoFechar={() => setVirandoObra(false)}
      />
    </section>
  );
}

/** Ícone clicável do bloco de link: botão ou link externo, mesmo desenho. */
function BotaoDeIcone({
  rotulo,
  aoClicar,
  href,
  children,
}: {
  rotulo: string;
  aoClicar?: () => void;
  href?: string;
  children: React.ReactNode;
}) {
  const classe =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-cinza transition hover:bg-cinza-100 hover:text-tinta";
  const icone = (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={rotulo}
        title={rotulo}
        className={classe}
      >
        {icone}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-label={rotulo}
      title={rotulo}
      className={classe}
    >
      {icone}
    </button>
  );
}

/**
 * O único botão em destaque do card, e só quando o estado pede.
 *
 * Aprovado e ainda sem obra é o momento em que virar obra deixa de ser uma
 * possibilidade e passa a ser o que falta fazer. Com obra criada, vira atalho.
 */
function ProximoPasso({
  orcamento,
  aoVirarObra,
}: {
  orcamento: OrcamentoCompleto;
  aoVirarObra: () => void;
}) {
  if (orcamento.obraId) {
    return (
      <Link
        href={`/admin/obras/${orcamento.obraId}`}
        className="mt-4 flex items-center gap-2 text-sm font-semibold text-tinta underline decoration-cinza-200 underline-offset-4 transition hover:decoration-current"
      >
        Abrir a obra: {orcamento.obraNome ?? "obra removida"}
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="h-3.5 w-3.5 fill-none stroke-current"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Link>
    );
  }

  if (orcamento.situacao !== "aprovado") return null;

  return (
    <button
      type="button"
      onClick={aoVirarObra}
      className="btn btn-primario mt-4"
    >
      Virar obra
    </button>
  );
}

/**
 * Virar obra ganhou confirmação porque cria registro em outro módulo. Antes
 * era um submit direto num cartão que ficava aberto o tempo todo — clique
 * errado criava obra que depois precisava ser apagada à mão.
 */
function DialogoDeVirarObra({
  orcamento,
  aberto,
  aoFechar,
}: {
  orcamento: OrcamentoCompleto;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [estado, gerar, gerando] = useActionState<Resultado | null, FormData>(
    gerarObraDoOrcamento,
    null,
  );

  useEffect(() => {
    if (estado?.ok && estado.link) router.push(estado.link);
  }, [estado, router]);

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Abrir a obra deste orçamento?"
      descricao="Cliente, endereço e nome vão junto, e a obra nasce com o link do escritório pronto para o mestre."
      estreito
    >
      <form action={gerar} className="dialogo-forma">
        <div className="dialogo-corpo">
          <input type="hidden" name="id" value={orcamento.id} />
          <p className="text-sm leading-relaxed text-fumaca">
            O orçamento continua aqui, agora ligado ao canteiro. Você cai direto
            na obra criada.
          </p>
          {estado?.erro && (
            <p className="aviso aviso-erro mt-3 text-sm">{estado.erro}</p>
          )}
        </div>
        <div className="dialogo-rodape">
          <button type="button" onClick={aoFechar} className="btn btn-secundario">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={gerando}
            className={`btn ${gerando ? "btn-carregando" : "btn-primario"}`}
          >
            {gerando && <Girando />}
            {gerando ? "Criando…" : "Criar a obra"}
          </button>
        </div>
      </form>
    </Dialogo>
  );
}

/** O que dá para saber sem perguntar a ninguém: se abriu, quando, quantas vezes. */
function Acompanhamento({ orcamento }: { orcamento: OrcamentoCompleto }) {
  if (orcamento.situacao === "aprovado") {
    return (
      <p className="aviso aviso-ok mt-4 text-sm">
        Aprovado em {data(orcamento.aprovadoEm)} pelo valor de{" "}
        <strong>{moeda(orcamento.valorAprovado ?? orcamento.total)}</strong>.
      </p>
    );
  }

  if (orcamento.situacao === "recusado") {
    return (
      <p className="aviso aviso-erro mt-4 text-sm">
        Recusado em {data(orcamento.recusadoEm)}
        {orcamento.motivoRecusa ? `: ${orcamento.motivoRecusa}` : "."}
      </p>
    );
  }

  if (!orcamento.vistoEm) {
    return (
      <p className="mt-4 text-sm text-cinza">
        O cliente ainda não abriu a página.
      </p>
    );
  }

  return (
    <p className="mt-4 text-sm text-fumaca">
      Aberto {orcamento.aberturas}{" "}
      {orcamento.aberturas === 1 ? "vez" : "vezes"} · primeira em{" "}
      {data(orcamento.vistoEm)}
      {orcamento.vistoUltimaEm && orcamento.aberturas > 1
        ? `, última em ${data(orcamento.vistoUltimaEm)}`
        : ""}
      .
    </p>
  );
}

function DialogoDeDespublicar({
  orcamento,
  aberto,
  aoFechar,
}: {
  orcamento: OrcamentoCompleto;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [estado, despublicar, indo] = useActionState<Resultado | null, FormData>(
    despublicarOrcamento,
    null,
  );

  useEffect(() => {
    if (estado?.ok) {
      router.refresh();
      aoFechar();
    }
  }, [estado, router, aoFechar]);

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Tirar o orçamento do ar?"
      descricao="O link para de funcionar e passa a responder como endereço inexistente. O rascunho fica intacto, e o mesmo link volta a valer se você publicar de novo."
      estreito
    >
      <form action={despublicar} className="dialogo-forma">
        <div className="dialogo-corpo">
          <input type="hidden" name="id" value={orcamento.id} />
          <p className="text-sm leading-relaxed text-fumaca">
            As versões publicadas são apagadas. Se o cliente já tinha aberto, o
            histórico de abertura continua guardado.
          </p>
          {estado?.erro && (
            <p className="aviso aviso-erro mt-3 text-sm">{estado.erro}</p>
          )}
        </div>
        <div className="dialogo-rodape">
          <button type="button" onClick={aoFechar} className="btn btn-secundario">
            Cancelar
          </button>
          <button type="submit" disabled={indo} className="btn btn-perigo">
            {indo ? "Tirando…" : "Tirar do ar"}
          </button>
        </div>
      </form>
    </Dialogo>
  );
}

/**
 * Marcação manual do desfecho, para quando o cliente responde por fora.
 *
 * `visto` não está na lista de propósito: ele é medido por nós quando a página
 * abre. Deixar marcar na mão transformaria um fato em opinião.
 */
function DialogoDeSituacao({
  orcamento,
  aberto,
  aoFechar,
}: {
  orcamento: OrcamentoCompleto;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [escolha, setEscolha] = useState<SituacaoDoOrcamento>("negociando");
  const [estado, marcar, marcando] = useActionState<Resultado | null, FormData>(
    marcarSituacao,
    null,
  );

  useEffect(() => {
    if (estado?.ok) {
      router.refresh();
      aoFechar();
    }
  }, [estado, router, aoFechar]);

  const opcoes: { valor: SituacaoDoOrcamento; rotulo: string; nota: string }[] = [
    { valor: "negociando", rotulo: "Em negociação", nota: "pediu ajuste no preço ou no escopo" },
    { valor: "aprovado", rotulo: "Aprovado", nota: "fechou por telefone ou pessoalmente" },
    { valor: "recusado", rotulo: "Recusado", nota: "não vai fechar" },
    { valor: "expirado", rotulo: "Expirado", nota: "passou a validade sem resposta" },
  ];

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Como o cliente respondeu?"
      descricao="Use quando a resposta vier por fora do sistema. Se ele aceitar pela própria página, isso é registrado sozinho."
      estreito
    >
      <form action={marcar} className="dialogo-forma">
        <div className="dialogo-corpo flex flex-col gap-3">
          <input type="hidden" name="id" value={orcamento.id} />
          <input type="hidden" name="situacao" value={escolha} />

          {opcoes.map((o) => (
            <label
              key={o.valor}
              className={`flex cursor-pointer items-start gap-3 rounded-sm border px-4 py-3 transition ${
                escolha === o.valor
                  ? "border-tinta bg-papel"
                  : "border-nevoa hover:bg-papel"
              }`}
            >
              <input
                type="radio"
                name="escolha"
                checked={escolha === o.valor}
                onChange={() => setEscolha(o.valor)}
                className="mt-1"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-tinta">
                  {o.rotulo}
                </span>
                <span className="block text-xs text-cinza">{o.nota}</span>
              </span>
            </label>
          ))}

          {escolha === "recusado" && (
            <label className="flex flex-col gap-1.5">
              <span className="rotulo-campo">Motivo (opcional)</span>
              <input
                name="motivo"
                placeholder="preço, prazo, escolheu outro…"
                className="campo"
              />
              <span className="ajuda-campo">
                Saber por que se perde é o que faz o próximo orçamento ser
                melhor.
              </span>
            </label>
          )}

          {escolha === "aprovado" && (
            <p className="aviso aviso-ok text-sm">
              O valor de <strong>{moeda(orcamento.total)}</strong> fica
              congelado como valor aprovado.
            </p>
          )}

          {estado?.erro && (
            <p className="aviso aviso-erro text-sm">{estado.erro}</p>
          )}
        </div>

        <div className="dialogo-rodape">
          <button type="button" onClick={aoFechar} className="btn btn-secundario">
            Cancelar
          </button>
          <button type="submit" disabled={marcando} className="btn btn-primario">
            {marcando ? "Salvando…" : "Registrar"}
          </button>
        </div>
      </form>
    </Dialogo>
  );
}
