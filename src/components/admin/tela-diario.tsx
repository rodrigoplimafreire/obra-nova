"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cabecalho, Conteudo, Secao } from "./cabecalho";
import { Dialogo } from "@/components/comum/dialogo";
import { ItemDeMenu, Menu, SeparadorDeMenu } from "@/components/comum/menu";
import {
  publicarDia,
  revogarAcesso,
  salvarAjustes,
  salvarDia,
  tirarDiaDoAr,
} from "@/lib/diario/acoes";
import { copiarTexto } from "@/lib/clipboard";
import { SECOES } from "@/lib/diario/tipos";
import type { Diario, DiaDoDiario, DiaNoPainel } from "@/lib/diario/dados";
import type { Resultado } from "@/lib/admin/tipos";

/**
 * Escrever o dia e publicar.
 *
 * **Salvar e publicar são dois atos, e a tela não deixa confundir.** Salvar
 * guarda o rascunho e não muda nada no link; publicar tira a fotografia que o
 * leitor passa a ver. É a exigência do PRD ("novos registros não alteram
 * automaticamente o conteúdo publicado") aparecendo como dois botões com
 * destaques diferentes — e é por isso que o botão de publicar diz "Publicar
 * atualização" quando já existe publicação daquele dia.
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

/** O texto de cada seção, com o exemplo que diz o formato esperado. */
const AJUDA: Record<string, string> = {
  realizado: "O que ficou pronto. Um item por linha.",
  emAndamento: "O que começou e continua. Um item por linha.",
  pendencias: "O que está travado, com responsável e prazo quando houver.",
  proximosPassos: "O que vem em seguida, por responsável.",
};

export function TelaDoDiario({
  diario,
  hoje,
  atual,
  dias,
  urlBase,
}: {
  diario: Diario;
  hoje: string;
  atual: DiaNoPainel;
  dias: DiaDoDiario[];
  urlBase: string;
}) {
  const router = useRouter();
  const [ajustando, setAjustando] = useState(false);
  const [revogando, setRevogando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const [salvo, salvar, salvando] = useActionState<Resultado | null, FormData>(
    salvarDia,
    null,
  );
  const [publicado, publicar, publicando] = useActionState<
    Resultado | null,
    FormData
  >(publicarDia, null);
  const [retirado, tirar, tirando] = useActionState<Resultado | null, FormData>(
    tirarDiaDoAr,
    null,
  );

  useEffect(() => {
    if (salvo?.ok || publicado?.ok || retirado?.ok) router.refresh();
  }, [salvo, publicado, retirado, router]);

  const link = `${urlBase}/d/${diario.token}`;
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
        meta="Um link só, com a senha, e o histórico por data."
        acoes={
          <>
            <button
              type="button"
              onClick={copiar}
              className="btn btn-secundario btn-compacto"
            >
              {copiado ? "Copiado" : "Copiar link"}
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

              <ItemDeMenu
                // Aba nova: quem está escrevendo o dia não quer perder o
                // rascunho da tela para conferir como ele saiu.
                aoClicar={() =>
                  window.open(`/d/${diario.token}`, "_blank", "noopener")
                }
                nota="como o leitor vê"
              >
                Ver página
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
        {!diario.temSenha && (
          <p className="aviso aviso-atencao">
            Este diário ainda não tem senha, e sem senha ele não pode ser
            publicado — o link circula por WhatsApp e pode ser encaminhado.{" "}
            <button
              type="button"
              onClick={() => setAjustando(true)}
              className="btn-texto"
            >
              Definir agora
            </button>
          </p>
        )}

        <Secao titulo="O dia">
          <form action={salvar} className="cartao px-5 py-5">
            <input type="hidden" name="dia" value={atual.dia} />

            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-sans text-lg leading-tight font-semibold text-tinta first-letter:uppercase">
                  {comoData(atual.dia, DIA_LONGO)}
                </p>
                <p className="rotulo mt-1">
                  {atual.publicadoEm
                    ? `no ar desde ${HORA.format(new Date(atual.publicadoEm))}${
                        desatualizado ? " · há edição não publicada" : ""
                      }`
                    : "ainda não publicado"}
                </p>
              </div>

              {/* Trocar de data é navegação, não estado: o `<input type=date>`
                  empurra para a mesma tela noutro endereço. */}
              <div className="flex shrink-0 items-center gap-2">
                {atual.dia !== hoje && (
                  <Link
                    href="/admin/diario"
                    className="btn btn-sutil btn-compacto"
                  >
                    Hoje
                  </Link>
                )}
                <input
                  type="date"
                  aria-label="Data do relatório"
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

            <div className="flex flex-col gap-5">
              {SECOES.map(({ chave, rotulo }) => (
                <div key={chave}>
                  <label htmlFor={chave} className="rotulo-campo">
                    {rotulo}
                  </label>
                  <p className="mt-0.5 mb-2 text-xs text-cinza">
                    {AJUDA[chave]}
                  </p>
                  <textarea
                    id={chave}
                    name={chave}
                    // `key` na data: sem ela o React reusa o textarea ao trocar
                    // de dia e o texto do dia anterior fica na tela.
                    key={`${atual.dia}-${chave}`}
                    defaultValue={atual.rascunho[chave]}
                    rows={4}
                    className="campo"
                  />
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={salvando}
                className="btn btn-secundario"
              >
                {salvando ? "Salvando…" : "Salvar rascunho"}
              </button>

              <button
                type="submit"
                formAction={publicar}
                disabled={publicando || !diario.temSenha}
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
            </div>

            {/* Um recado por vez, do último ato. Três linhas de estado
                empilhadas seriam três coisas para ler antes de saber se deu
                certo. */}
            {(publicado?.erro || retirado?.erro || salvo?.erro) && (
              <p className="aviso aviso-erro mt-4">
                {publicado?.erro ?? retirado?.erro ?? salvo?.erro}
              </p>
            )}
            {!publicado?.erro && publicado?.ok && (
              <p className="aviso aviso-ok mt-4">
                Publicado. O link continua o mesmo.
              </p>
            )}
          </form>
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
  link,
}: {
  aberto: boolean;
  aoFechar: () => void;
  diario: Diario;
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
    </Dialogo>
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
        tem. Um novo é gerado, e você precisa enviá-lo outra vez. Os relatórios
        publicados continuam lá, no endereço novo.
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
