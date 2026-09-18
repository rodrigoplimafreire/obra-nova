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
  salvarDia,
  tirarDiaDoAr,
  type SaidaDoResumoDoDia,
} from "@/lib/diario/acoes";
import { RegistrosDoDiario } from "./registros-do-diario";
import { copiarTexto } from "@/lib/clipboard";
import { enderecoDoDiario, HOST_DO_DIARIO } from "@/lib/diario/apelido";
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
  const [gerando, setGerando] = useState(false);
  const [resumo, setResumo] = useState<SaidaDoResumoDoDia | null>(null);

  /**
   * Gerar o resumo, e perguntar antes de atropelar mão humana.
   *
   * A primeira chamada volta com `precisaConfirmar` quando o texto foi
   * editado depois do último resumo. Aí a tela mostra o diálogo, e só a
   * segunda chamada — a confirmada — substitui.
   */
  async function gerar(confirmado: boolean) {
    setGerando(true);
    setResumo(null);
    try {
      const saida = await gerarResumoDoDia(atual.dia, confirmado);
      setResumo(saida);
      if (saida.ok) router.refresh();
    } finally {
      setGerando(false);
    }
  }

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

        <Secao titulo="O relatório do dia">
          <form action={salvar} className="cartao px-5 py-5">
            <input type="hidden" name="dia" value={atual.dia} />

            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-cinza-100 pb-3">
              <p className="text-xs leading-relaxed text-cinza">
                {atual.registros.length === 0
                  ? "A IA organiza os registros do dia, aqui em cima, nas quatro seções."
                  : `${atual.registros.length} ${atual.registros.length === 1 ? "registro" : "registros"} no dia.`}
                {atual.editadoDepoisDoResumo && atual.registros.length > 0 && (
                  <> Este texto foi editado à mão depois do último resumo.</>
                )}
              </p>

              <button
                type="button"
                onClick={() => void gerar(false)}
                disabled={gerando || atual.registros.length === 0}
                className="btn btn-secundario btn-compacto shrink-0"
              >
                {gerando ? "Organizando…" : "Gerar resumo"}
              </button>
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
                    /**
                     * A chave leva a data **e** o instante da última escrita.
                     * Só a data não basta: depois de gerar o resumo o React
                     * reaproveitaria o mesmo `<textarea>`, e o valor antigo
                     * continuaria no DOM — a IA teria escrito e a tela não
                     * mostraria.
                     */
                    key={`${atual.dia}-${atual.atualizadoEm ?? "novo"}-${chave}`}
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

            {/* Um recado por vez, do último ato. Quatro linhas de estado
                empilhadas seriam quatro coisas para ler antes de saber se deu
                certo. O do resumo que pede confirmação não entra aqui: ele
                abre o diálogo, logo abaixo. */}
            {(publicado?.erro ||
              retirado?.erro ||
              salvo?.erro ||
              (resumo?.erro && !resumo.precisaConfirmar)) && (
              <p className="aviso aviso-erro mt-4">
                {publicado?.erro ??
                  retirado?.erro ??
                  salvo?.erro ??
                  resumo?.erro}
              </p>
            )}
            {!publicado?.erro && publicado?.ok && (
              <p className="aviso aviso-ok mt-4">
                Publicado. O link continua o mesmo.
              </p>
            )}
            {resumo?.ok && (
              <p className="aviso aviso-ok mt-4">
                Resumo escrito a partir de {resumo.registros}{" "}
                {resumo.registros === 1 ? "registro" : "registros"}. Leia antes
                de publicar.
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

      {/* A confirmação de substituir o texto escrito à mão. Ela existe porque
          a §5 do PRD exige preservar a edição manual até alguém confirmar —
          e porque perder um parágrafo revisado para uma geração automática é
          o tipo de erro que faz a pessoa parar de usar o botão. */}
      <Dialogo
        aberto={Boolean(resumo?.precisaConfirmar)}
        aoFechar={() => setResumo(null)}
        titulo="Substituir o que você escreveu?"
        descricao="Este dia foi editado à mão depois do último resumo."
        estreito
      >
        <p className="text-sm leading-relaxed text-grafite">
          Gerar de novo reescreve as quatro seções a partir dos registros, e o
          texto que está lá agora se perde. Os registros do dia não são
          tocados.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setResumo(null)}
            className="btn btn-secundario"
          >
            Manter o meu texto
          </button>
          <button
            type="button"
            onClick={() => void gerar(true)}
            disabled={gerando}
            className="btn btn-primario"
          >
            {gerando ? "Organizando…" : "Substituir"}
          </button>
        </div>
      </Dialogo>
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
