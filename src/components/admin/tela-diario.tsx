"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cabecalho, Conteudo, Secao } from "./cabecalho";
import { Dialogo } from "@/components/comum/dialogo";
import { ItemDeMenu, Menu, SeparadorDeMenu } from "@/components/comum/menu";
import {
  gerarResumoDoDia,
  publicarDia,
  revogarAcesso,
  salvarAjustes,
  tirarDiaDoAr,
  type SaidaDoResumoDoDia,
} from "@/lib/diario/acoes";
import { ItensDoDia } from "./itens-do-dia";
import { SugestaoDaIA } from "./sugestao-da-ia";
import { RegistrosDoDiario } from "./registros-do-diario";
import { VeioDeOntem } from "./veio-de-ontem";
import { removerPessoa } from "@/lib/diario/acoes-pessoas";
import { copiarTexto } from "@/lib/clipboard";
import { enderecoDoDiario, HOST_DO_DIARIO } from "@/lib/diario/apelido";
import type {
  Diario,
  DiaDoDiario,
  DiaNoPainel,
  Pessoa,
} from "@/lib/diario/dados";
import type { Resultado } from "@/lib/admin/tipos";

/**
 * Escrever o dia e publicar.
 *
 * **Editar e publicar são dois atos, e a tela não deixa confundir.** Cada item
 * se salva sozinho ao ser mexido, e nada disso toca o link; publicar tira a
 * fotografia que o leitor passa a ver. É a exigência do PRD ("novos registros
 * não alteram automaticamente o conteúdo publicado") virando duas escritas
 * separadas — e é por isso que o botão diz "Publicar atualização" quando já
 * existe publicação daquele dia.
 *
 * Não há botão "Salvar": ele existia para mandar quatro `textarea` de uma vez,
 * e sumiu junto com elas na Entrega 4a. Botão de salvar numa tela que já salva
 * sozinha é convite para a pessoa achar que perdeu o que escreveu.
 *
 * A data viaja na URL (`?dia=`), não em estado do React: recarregar a página,
 * voltar no navegador e mandar o endereço para si mesmo continuam funcionando.
 */

const DIA_LONGO = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  timeZone: "UTC",
});

const DIA_CURTO = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

const HORA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

function comoData(dia: string, formato: Intl.DateTimeFormat): string {
  return formato.format(new Date(`${dia}T12:00:00Z`));
}


export function TelaDoDiario({
  diario,
  hoje,
  atual,
  dias,
  pessoas,
  urlBase,
}: {
  diario: Diario;
  hoje: string;
  atual: DiaNoPainel;
  dias: DiaDoDiario[];
  pessoas: Pessoa[];
  urlBase: string;
}) {
  const router = useRouter();
  const [ajustando, setAjustando] = useState(false);
  const [revogando, setRevogando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [resumo, setResumo] = useState<SaidaDoResumoDoDia | null>(null);

  /**
   * Gerar o resumo.
   *
   * Não pergunta nada, e não precisa: desde a Entrega 4d a IA **propõe** em
   * vez de escrever, então o que está no relatório nunca é tocado. O diálogo
   * de "quer mesmo substituir o que você escreveu?" sumiu junto com o motivo
   * dele.
   */
  async function gerar() {
    setGerando(true);
    setResumo(null);
    try {
      const saida = await gerarResumoDoDia(atual.dia);
      setResumo(saida);
      if (saida.ok) router.refresh();
    } finally {
      setGerando(false);
    }
  }

  const [publicado, publicar, publicando] = useActionState<
    Resultado | null,
    FormData
  >(publicarDia, null);
  const [retirado, tirar, tirando] = useActionState<Resultado | null, FormData>(
    tirarDiaDoAr,
    null,
  );

  useEffect(() => {
    if (publicado?.ok || retirado?.ok) router.refresh();
  }, [publicado, retirado, router]);

  // Com apelido, o link é o da empreiteira; sem ele, continua sendo o do
  // token — que nunca deixa de valer.
  const link = enderecoDoDiario(diario.apelido, diario.token, urlBase);
  const noAr = atual.publicadoEm !== null;
  const registroDoDia = dias.find((d) => d.dia === atual.dia);
  const desatualizado = registroDoDia?.desatualizado ?? false;

  async function copiar() {
    if (await copiarTexto(link)) {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  }

  return (
    <>
      <Cabecalho
        titulo="Diário"
        acoes={
          <>
            <button
              type="button"
              // Aba nova: quem está escrevendo o dia não quer perder o
              // rascunho da tela para conferir como ele saiu.
              onClick={() => window.open(link, "_blank", "noopener")}
              className="btn btn-secundario btn-compacto"
            >
              Ver página
            </button>

            <Menu>
              <ItemDeMenu
                aoClicar={() => setAjustando(true)}
                nota="título, quem assina e a senha do link"
              >
                Acesso ao link
              </ItemDeMenu>

              <ItemDeMenu
                aoClicar={() =>
                  window.open(
                    `https://wa.me/?text=${encodeURIComponent(`${diario.titulo ?? "Diário de atividades"}: ${link}`)}`,
                    "_blank",
                    "noopener",
                  )
                }
                nota="abre a conversa com o link pronto"
              >
                Compartilhar no WhatsApp
              </ItemDeMenu>

              <SeparadorDeMenu />

              <ItemDeMenu
                aoClicar={() => setRevogando(true)}
                perigo
                nota="troca o endereço e derruba o link que já foi enviado"
              >
                Revogar o acesso
              </ItemDeMenu>
            </Menu>
          </>
        }
      />

      <Conteudo>
        {/**
         * O endereço, à vista.
         *
         * Ele já existiu só atrás do menu `⋮`, e o resultado foi previsível:
         * o diário ficou semanas sem apelido, o link bonito respondia 404, e
         * não havia nada na tela que dissesse isso. O endereço é o produto
         * desta tela — é o que se manda para quem vai ler. Ele vem primeiro,
         * com o estado da senha do lado, porque os dois juntos é que dizem se
         * dá para mandar.
         */}
        <section className="cartao px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div className="min-w-0">
              <p className="rotulo">Endereço do diário</p>

              {diario.apelido ? (
                <p className="mt-1.5 font-mono text-sm break-all text-tinta">
                  {link.replace(/^https?:\/\//, "")}
                </p>
              ) : (
                <p className="mt-1.5 text-sm leading-snug text-fumaca">
                  Link longo, sem nome.{" "}
                  <button
                    type="button"
                    onClick={() => setAjustando(true)}
                    className="btn-texto"
                  >
                    Escolher um endereço
                  </button>{" "}
                  como {HOST_DO_DIARIO}/seu-nome.
                </p>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copiar}
                className="btn btn-secundario btn-compacto"
              >
                {copiado ? "Copiado" : "Copiar"}
              </button>
              <button
                type="button"
                onClick={() =>
                  window.open(
                    `https://wa.me/?text=${encodeURIComponent(`${diario.titulo ?? "Diário de atividades"}: ${link}`)}`,
                    "_blank",
                    "noopener",
                  )
                }
                className="btn btn-primario btn-compacto"
              >
                WhatsApp
              </button>
            </div>
          </div>

          {/* A senha é a outra metade do endereço: sem ela a publicação trava,
              e com endereço legível ela passa a ser a única barreira. */}
          <p className="mt-3 border-t border-cinza-100 pt-3 text-xs leading-relaxed text-cinza">
            {diario.temSenha ? (
              <>
                Senha definida. Quem abrir precisa dela, e ela não vem no link —
                mande separado.{" "}
                <button
                  type="button"
                  onClick={() => setAjustando(true)}
                  className="btn-texto"
                >
                  Trocar
                </button>
              </>
            ) : (
              <span className="text-atraso">
                Sem senha, o diário não pode ser publicado — o link circula por
                WhatsApp e pode ser encaminhado.{" "}
                <button
                  type="button"
                  onClick={() => setAjustando(true)}
                  className="btn-texto"
                >
                  Definir agora
                </button>
              </span>
            )}
          </p>
        </section>

        {/* A data manda na tela inteira — nos registros e no resumo —, então
            ela fica acima das duas, e não dentro de uma delas. */}
        <div className="mt-6 mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-sans text-lg leading-tight font-semibold text-tinta first-letter:uppercase">
              {comoData(atual.dia, DIA_LONGO)}
            </p>
            {/* Selo, e não texto miúdo: é o estado que decide se o botão da
                direita diz "Publicar" ou "Publicar atualização". */}
            <p className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`selo ${
                  !atual.publicadoEm
                    ? "selo-neutro"
                    : desatualizado
                      ? "selo-atencao"
                      : "selo-emdia"
                }`}
              >
                {!atual.publicadoEm
                  ? "Rascunho"
                  : desatualizado
                    ? "Editado depois de publicar"
                    : "No ar"}
              </span>
              {atual.publicadoEm && (
                <span className="rotulo">
                  desde {HORA.format(new Date(atual.publicadoEm))}
                </span>
              )}
            </p>
          </div>

          {/* Trocar de data é navegação, não estado: o `<input type=date>`
              empurra para a mesma tela noutro endereço. */}
          <div className="flex shrink-0 items-center gap-2">
            {atual.dia !== hoje && (
              <Link href="/admin/diario" className="btn btn-sutil btn-compacto">
                Hoje
              </Link>
            )}
            <input
              type="date"
              aria-label="Data do relatório"
              // `key` na data: sem ela o campo guarda a data anterior ao
              // navegar, e a tela passa a mostrar um dia e o seletor outro.
              key={atual.dia}
              defaultValue={atual.dia}
              max={hoje}
              onChange={(e) => {
                if (e.target.value) {
                  router.push(`/admin/diario?dia=${e.target.value}`);
                }
              }}
              className="campo w-auto"
            />
          </div>
        </div>

        <RegistrosDoDiario dia={atual.dia} registros={atual.registros} />

        {/* Antes das seções, e fora delas: o que veio de ontem ainda não é
            item do dia. Ver o comentário no componente e a decisão D14. */}
        <VeioDeOntem dia={atual.dia} sugestoes={atual.sugestoes} />

        <Secao titulo="O relatório do dia">
          <div className="cartao px-5 py-5">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-cinza-100 pb-3">
              <p className="text-xs leading-relaxed text-cinza">
                {atual.registros.length === 0
                  ? "A IA organiza os registros do dia, aqui em cima, nas quatro seções."
                  : `${atual.registros.length} ${atual.registros.length === 1 ? "registro" : "registros"} no dia.`}

              </p>

              <button
                type="button"
                onClick={() => void gerar()}
                disabled={gerando || atual.registros.length === 0}
                className="btn btn-secundario btn-compacto shrink-0"
              >
                {gerando ? "Organizando…" : "Gerar resumo"}
              </button>
            </div>

            <SugestaoDaIA dia={atual.dia} propostas={atual.propostas} />

            <div className="mt-6">
              <ItensDoDia
                dia={atual.dia}
                itens={atual.itens}
                pessoas={pessoas}
              />
            </div>

            {/* Publicar é um `form` porque a ação recebe `FormData`. Os itens
                já se salvam sozinhos, um a um — não há rascunho a enviar
                junto, e por isso o botão "Salvar" deixou de existir. */}
            <form className="mt-6 flex flex-wrap items-center gap-2">
              <input type="hidden" name="dia" value={atual.dia} />

              <button
                type="submit"
                formAction={publicar}
                disabled={publicando || !diario.temSenha || atual.itens.length === 0}
                className="btn btn-primario"
              >
                {publicando
                  ? "Publicando…"
                  : noAr
                    ? "Publicar atualização"
                    : "Publicar"}
              </button>

              {noAr && (
                <button
                  type="submit"
                  formAction={tirar}
                  disabled={tirando}
                  className="btn btn-sutil"
                >
                  {tirando ? "Retirando…" : "Tirar do ar"}
                </button>
              )}
            </form>

            {/* Um recado por vez, do último ato. Três linhas de estado
                empilhadas seriam três coisas para ler antes de saber se deu
                certo. O do resumo que pede confirmação não entra aqui: ele
                abre o diálogo, logo abaixo. */}
            {(publicado?.erro || retirado?.erro || resumo?.erro) && (
              <p className="aviso aviso-erro mt-4">
                {publicado?.erro ?? retirado?.erro ?? resumo?.erro}
              </p>
            )}
            {!publicado?.erro && publicado?.ok && (
              <p className="aviso aviso-ok mt-4">
                Publicado. O link continua o mesmo.
              </p>
            )}
            {resumo?.ok && (
              <p className="aviso aviso-ok mt-4">
                {resumo.propostas}{" "}
                {resumo.propostas === 1 ? "linha proposta" : "linhas propostas"}{" "}
                a partir de {resumo.registros}{" "}
                {resumo.registros === 1 ? "registro" : "registros"}. Nada entrou
                no relatório ainda.
              </p>
            )}
          </div>
        </Secao>

        <Secao titulo="Histórico">
          {dias.length === 0 ? (
            <p className="text-sm text-cinza">
              Nenhum dia escrito ainda. O primeiro é o de hoje, aí em cima.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {dias.map((d) => (
                <li key={d.dia}>
                  <Link
                    href={`/admin/diario?dia=${d.dia}`}
                    aria-current={d.dia === atual.dia ? "page" : undefined}
                    className={`flex items-center justify-between gap-3 rounded-sm border px-4 py-3 transition ${
                      d.dia === atual.dia
                        ? "border-tinta bg-white"
                        : "border-nevoa bg-white hover:border-concreto"
                    }`}
                  >
                    <span className="text-sm text-tinta first-letter:uppercase">
                      {comoData(d.dia, DIA_CURTO)}
                    </span>

                    <span
                      className={`selo ${
                        !d.publicado
                          ? "selo-neutro"
                          : d.desatualizado
                            ? "selo-atencao"
                            : "selo-emdia"
                      }`}
                    >
                      {!d.publicado
                        ? "Rascunho"
                        : d.desatualizado
                          ? "Editado depois"
                          : "No ar"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Secao>
      </Conteudo>

      <Ajustes
        aberto={ajustando}
        aoFechar={() => setAjustando(false)}
        diario={diario}
        pessoas={pessoas}
        link={link}
      />

      <Revogacao
        aberto={revogando}
        aoFechar={() => setRevogando(false)}
        token={diario.token}
        link={link}
      />


    </>
  );
}

/** Título, quem assina e a senha do link. */
function Ajustes({
  aberto,
  aoFechar,
  diario,
  pessoas,
  link,
}: {
  aberto: boolean;
  aoFechar: () => void;
  diario: Diario;
  pessoas: Pessoa[];
  link: string;
}) {
  const router = useRouter();
  const [estado, salvar, salvando] = useActionState<Resultado | null, FormData>(
    salvarAjustes,
    null,
  );

  useEffect(() => {
    if (estado?.ok) {
      router.refresh();
      aoFechar();
    }
    // `aoFechar` muda de identidade a cada render de quem chama; incluí-lo
    // reabriria o efeito sem necessidade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, router]);

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Acesso ao link"
      descricao="O endereço é fixo e não muda quando você publica. A senha é o que protege o que está atrás dele."
      estreito
    >
      <form action={salvar} className="flex flex-col gap-4">
        <div>
          <label htmlFor="titulo" className="rotulo-campo">
            Título
          </label>
          <input
            id="titulo"
            name="titulo"
            defaultValue={diario.titulo ?? ""}
            placeholder="Diário de atividades"
            className="campo mt-2"
          />
        </div>

        <div>
          <label htmlFor="autorNome" className="rotulo-campo">
            Quem assina
          </label>
          <input
            id="autorNome"
            name="autorNome"
            defaultValue={diario.autorNome ?? ""}
            placeholder="Seu nome, como aparece no cabeçalho"
            className="campo mt-2"
          />
          <p className="mt-2 text-xs leading-relaxed text-cinza">
            Aparece no cabeçalho da página e entra no resumo: é como a IA sabe
            de quem é o &ldquo;eu&rdquo; dos seus registros.
          </p>
        </div>

        <div>
          <label htmlFor="apelido" className="rotulo-campo">
            Endereço
          </label>
          {/* O host fica colado no campo, como prefixo fixo: sem ele a pessoa
              digita a URL inteira e a validação recusa por causa da barra. */}
          <div className="mt-2 flex items-stretch">
            <span className="flex shrink-0 items-center rounded-l-[var(--radius-controle)] border border-r-0 border-concreto bg-papel px-3 font-mono text-xs text-fumaca">
              {HOST_DO_DIARIO}/
            </span>
            <input
              id="apelido"
              name="apelido"
              defaultValue={diario.apelido ?? ""}
              placeholder="rodrigo"
              autoComplete="off"
              spellCheck={false}
              className="campo min-w-0 flex-1 rounded-l-none font-mono"
            />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-cinza">
            Letras, números e hífen. Em branco, o link continua sendo o
            endereço longo — e ele nunca deixa de valer, mesmo depois que você
            escolher um apelido.
          </p>
        </div>

        <div>
          <label htmlFor="senha" className="rotulo-campo">
            Senha de acesso
          </label>
          <input
            id="senha"
            name="senha"
            type="text"
            defaultValue=""
            placeholder={
              diario.temSenha ? "definida — digite para trocar" : "ao menos 6 caracteres"
            }
            autoComplete="off"
            className="campo mt-2"
          />
          {/* Em claro de propósito: quem digita aqui vai ditar essa senha por
              WhatsApp, e esconder o que se está criando só gera erro de
              digitação. Não é a senha de uma conta. */}
          <p className="mt-2 text-xs leading-relaxed text-cinza">
            Fica visível porque você vai passá-la adiante. Apagar o campo
            remove a senha, e sem senha o diário não pode ser publicado.
          </p>
        </div>

        <p className="rounded-sm bg-papel px-4 py-3 font-mono text-xs break-all text-fumaca">
          {link}
        </p>

        {estado?.erro && <p className="aviso aviso-erro">{estado.erro}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={aoFechar}
            className="btn btn-secundario"
          >
            Cancelar
          </button>
          <button type="submit" disabled={salvando} className="btn btn-primario">
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>

      {/* Fora do `<form>` de propósito: `<form>` aninhado não existe, e um
          botão de remover ali dentro submeteria os ajustes junto. */}
      <Elenco pessoas={pessoas} />
    </Dialogo>
  );
}

/**
 * Quem pode responder por um item.
 *
 * A lista nasce do uso — do nome de quem assina e do que já estava escrito nos
 * dias anteriores — e cresce pelo "Outro…" do seletor. Aqui só se tira, que é
 * o que o uso não resolve sozinho: a conversão trouxe "Rodrigo" e "Rodrigo
 * Peixoto" como duas pessoas, e só quem escreve sabe que são a mesma.
 */
function Elenco({ pessoas }: { pessoas: Pessoa[] }) {
  const router = useRouter();
  const [removendo, setRemovendo] = useState<string | null>(null);

  if (pessoas.length === 0) return null;

  return (
    <section className="mt-6 border-t border-cinza-100 pt-5">
      <p className="rotulo-campo">Quem responde</p>
      <p className="mt-1 mb-3 text-xs leading-relaxed text-cinza">
        A lista que o seletor de responsável oferece, e os nomes que a IA usa.
        Tirar alguém daqui não mexe nos dias já escritos.
      </p>

      <ul className="flex flex-wrap gap-1.5">
        {pessoas.map((p) => (
          <li key={p.id}>
            <span className="inline-flex items-center gap-1.5 rounded-sm bg-papel py-1 pr-1 pl-2.5 text-sm text-tinta">
              {p.nome}
              <button
                type="button"
                disabled={removendo === p.id}
                onClick={async () => {
                  setRemovendo(p.id);
                  await removerPessoa(p.id);
                  setRemovendo(null);
                  router.refresh();
                }}
                aria-label={`Tirar ${p.nome} da lista`}
                className="rounded-sm px-1 text-cinza-500 transition hover:text-atraso"
              >
                <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth={2} strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Revogar é a única ação daqui que não tem volta, e a tela diz isso antes.
 *
 * Tirar do ar devolve um dia ao rascunho e o endereço continua valendo.
 * Revogar troca o endereço — o link que já foi para o WhatsApp para de
 * funcionar, para sempre.
 */
function Revogacao({
  aberto,
  aoFechar,
  token,
  link,
}: {
  aberto: boolean;
  aoFechar: () => void;
  token: string;
  link: string;
}) {
  const router = useRouter();
  const [estado, revogar, revogando] = useActionState<
    Resultado | null,
    FormData
  >(revogarAcesso, null);

  useEffect(() => {
    if (estado?.ok) {
      router.refresh();
      aoFechar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, router]);

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Revogar o acesso"
      descricao="Use quando o link tiver ido para quem não devia."
      estreito
    >
      <p className="text-sm leading-relaxed text-grafite">
        O endereço abaixo para de funcionar na hora, para todo mundo que já o
        tem. O apelido também é liberado, senão a parte fácil de adivinhar
        continuaria de pé e não haveria revogação nenhuma. Você escolhe um novo
        em seguida e envia outra vez. Os relatórios publicados continuam lá.
      </p>

      <p className="mt-4 rounded-sm bg-papel px-4 py-3 font-mono text-xs break-all text-fumaca">
        {link}
      </p>

      {estado?.erro && <p className="aviso aviso-erro mt-4">{estado.erro}</p>}

      <form action={revogar} className="mt-5 flex justify-end gap-2">
        <input type="hidden" name="token" value={token} />
        <button type="button" onClick={aoFechar} className="btn btn-secundario">
          Cancelar
        </button>
        <button type="submit" disabled={revogando} className="btn btn-perigo">
          {revogando ? "Revogando…" : "Revogar e gerar outro"}
        </button>
      </form>
    </Dialogo>
  );
}
