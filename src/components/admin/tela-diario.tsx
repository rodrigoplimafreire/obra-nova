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

  /**
   * O convite que vai para o WhatsApp.
   *
   * Saía como "RD Engenharia: https://…", porque usava o título do diário — e
   * o título que a pessoa escreve primeiro costuma ser o nome da própria
   * empreiteira. Quem recebia não sabia o que era aquilo nem quem mandou.
   *
   * A senha **não entra aqui**, e é um segundo botão. Não é zelo de
   * segurança teatral: link e senha na mesma mensagem viajam juntos no
   * encaminhamento, e a senha existe exatamente para o link encaminhado não
   * abrir sozinho.
   */
  const convite = `https://wa.me/?text=${encodeURIComponent(
    [
      `Diário de atividades${diario.autorNome ? ` — ${diario.autorNome}` : ""}`,
      "Acompanhe por aqui, todo dia:",
      link,
      "A senha eu mando na sequência.",
    ].join("\n"),
  )}`;

  const envioDaSenha = `https://wa.me/?text=${encodeURIComponent(
    "A senha do diário é:",
  )}`;

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
                  window.open(convite, "_blank", "noopener")
                }
                nota="abre a conversa com o link pronto"
              >
                Compartilhar no WhatsApp
              </ItemDeMenu>

              <ItemDeMenu
                aoClicar={() => window.open(envioDaSenha, "_blank", "noopener")}
                desabilitado={!diario.temSenha}
                nota="em mensagem separada, para o link encaminhado não abrir sozinho"
              >
                Mandar a senha
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
                  window.open(convite, "_blank", "noopener")
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
                {atual.sugestoes.length > 0 && atual.registros.length > 0 && (
                  <>
                    {" "}
                    Ela lê também {atual.sugestoes.length} em aberto de ontem, e
                    baixa os que você tiver mencionado.
                  </>
                )}
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


/**
 * TÃ­tulo, quem assina, o endereÃ§o e a senha.
 *
 * **Usa `dialogo-corpo` e `dialogo-rodape`, como todos os outros diÃ¡logos do
 * painel.** A primeira versÃ£o nÃ£o usava, e o resultado foi o esperado: os
 * campos encostavam nas bordas do painel, o conteÃºdo passava dos 86dvh do
 * `.dialogo-painel` â€” que tem `overflow: hidden` â€” e o botÃ£o de salvar ficava
 * cortado fora da tela. A estrutura existe justamente para isto: cabeÃ§alho e
 * rodapÃ© fixos, miolo rolando.
 *
 * O texto de ajuda tambÃ©m encolheu. Ele tinha trÃªs parÃ¡grafos de duas linhas,
 * cada um mais pesado que o campo que explicava, e formulÃ¡rio em que a
 * explicaÃ§Ã£o ocupa metade da altura Ã© formulÃ¡rio que ninguÃ©m lÃª.
 *
 * A ordem mudou junto: endereÃ§o e senha primeiro, porque sÃ£o o que a pessoa
 * vem mexer. TÃ­tulo e nome se acertam uma vez e nÃ£o se toca mais.
 */
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
    // `aoFechar` muda de identidade a cada render de quem chama; incluÃ­-lo
    // reabriria o efeito sem necessidade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, router]);

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Acesso ao link"
      descricao="O endereÃ§o Ã© fixo e nÃ£o muda quando vocÃª publica. A senha Ã© o que protege o que estÃ¡ atrÃ¡s dele."
      estreito
    >
      <form action={salvar} className="dialogo-forma">
        <div className="dialogo-corpo flex flex-col gap-5">
          <div>
            <label htmlFor="apelido" className="rotulo-campo">
              EndereÃ§o
            </label>
            {/* O host colado no campo, como prefixo fixo: sem ele a pessoa
                digita a URL inteira e a validaÃ§Ã£o recusa por causa da barra. */}
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
            <p className="mt-1.5 text-xs text-cinza">
              Letras, nÃºmeros e hÃ­fen. O link longo nunca deixa de valer.
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
                diario.temSenha
                  ? "definida â€” digite para trocar"
                  : "ao menos 6 caracteres"
              }
              autoComplete="off"
              className="campo mt-2"
            />
            {/* Em claro de propÃ³sito: quem digita aqui vai ditar essa senha
                por WhatsApp, e esconder o que se estÃ¡ criando sÃ³ gera erro de
                digitaÃ§Ã£o. NÃ£o Ã© a senha de uma conta. */}
            <p className="mt-1.5 text-xs text-cinza">
              Fica visÃ­vel porque vocÃª vai passÃ¡-la adiante. Em branco, remove.
            </p>
          </div>

          <div className="border-t border-cinza-100 pt-5">
            <label htmlFor="titulo" className="rotulo-campo">
              TÃ­tulo
            </label>
            <input
              id="titulo"
              name="titulo"
              defaultValue={diario.titulo ?? ""}
              placeholder="DiÃ¡rio de atividades"
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
              placeholder="Seu nome"
              className="campo mt-2"
            />
            <p className="mt-1.5 text-xs text-cinza">
              Vai no cabeÃ§alho da pÃ¡gina, e Ã© como a IA sabe de quem Ã© o
              &ldquo;eu&rdquo; dos seus registros.
            </p>
          </div>

          <Elenco pessoas={pessoas} />

          {estado?.erro && <p className="aviso aviso-erro">{estado.erro}</p>}
        </div>

        <div className="dialogo-rodape">
          <button
            type="button"
            onClick={aoFechar}
            className="btn btn-secundario"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className={`btn ${salvando ? "btn-carregando" : "btn-primario"}`}
          >
            {salvando ? "Salvandoâ€¦" : "Salvar"}
          </button>
        </div>
      </form>
    </Dialogo>
  );
}

/**
 * Quem pode responder por um item.
 *
 * A lista nasce do uso â€” do nome de quem assina e do que jÃ¡ estava escrito nos
 * dias anteriores â€” e cresce pelo &ldquo;Outroâ€¦&rdquo; do seletor. Aqui sÃ³ se
 * tira, que Ã© o que o uso nÃ£o resolve sozinho: a conversÃ£o trouxe "Rodrigo" e
 * "Rodrigo Peixoto" como duas pessoas, e sÃ³ quem escreve sabe que sÃ£o a mesma.
 *
 * **Os botÃµes sÃ£o `type="button"`.** Dentro de um `<form>`, botÃ£o sem tipo Ã©
 * `submit`: remover uma pessoa salvaria os ajustes e fecharia o diÃ¡logo.
 */
function Elenco({ pessoas }: { pessoas: Pessoa[] }) {
  const router = useRouter();
  const [removendo, setRemovendo] = useState<string | null>(null);

  if (pessoas.length === 0) return null;

  return (
    <div className="border-t border-cinza-100 pt-5">
      <p className="rotulo-campo">Quem responde</p>
      <p className="mt-1 mb-2.5 text-xs text-cinza">
        O que o seletor de responsÃ¡vel oferece. Tirar daqui nÃ£o mexe nos dias
        jÃ¡ escritos.
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
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  className="h-3.5 w-3.5 fill-none stroke-current"
                  strokeWidth={2}
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Revogar Ã© a Ãºnica aÃ§Ã£o daqui que nÃ£o tem volta, e a tela diz isso antes.
 *
 * Tirar do ar devolve um dia ao rascunho e o endereÃ§o continua valendo.
 * Revogar troca o endereÃ§o â€” o link que jÃ¡ foi para o WhatsApp para de
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
      descricao="Use quando o link tiver ido para quem nÃ£o devia."
      estreito
    >
      <form action={revogar} className="dialogo-forma">
        <div className="dialogo-corpo flex flex-col gap-4">
          <input type="hidden" name="token" value={token} />

          <p className="text-sm leading-relaxed text-grafite">
            Este endereÃ§o para de funcionar na hora, para todo mundo que jÃ¡ o
            tem. O apelido tambÃ©m Ã© liberado â€” senÃ£o a parte fÃ¡cil de adivinhar
            continuaria de pÃ©, e nÃ£o haveria revogaÃ§Ã£o nenhuma.
          </p>

          <p className="rounded-sm bg-papel px-4 py-3 font-mono text-xs break-all text-fumaca">
            {link}
          </p>

          <p className="text-sm leading-relaxed text-grafite">
            VocÃª escolhe um novo em seguida e envia outra vez. Os relatÃ³rios
            publicados continuam lÃ¡.
          </p>

          {estado?.erro && <p className="aviso aviso-erro">{estado.erro}</p>}
        </div>

        <div className="dialogo-rodape">
          <button
            type="button"
            onClick={aoFechar}
            className="btn btn-secundario"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={revogando}
            className={`btn ${revogando ? "btn-carregando" : "btn-perigo"}`}
          >
            {revogando ? "Revogandoâ€¦" : "Revogar e gerar outro"}
          </button>
        </div>
      </form>
    </Dialogo>
  );
}

