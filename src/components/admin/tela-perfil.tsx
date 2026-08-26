"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Cabecalho, CartaoDeDados, Conteudo, Dado, Secao } from "./cabecalho";
import { AcessosDoPainel } from "./acessos-do-painel";
import {
  CampoDeDocumento,
  CampoDeTelefone,
  formatarDocumento,
  formatarTelefone,
} from "@/components/comum/campos";
import { Dialogo } from "@/components/comum/dialogo";
import { Girando } from "@/components/comum/esqueleto";
import {
  enviarAvatar,
  enviarLogo,
  removerAvatar,
  removerLogo,
  salvarEmpreiteira,
} from "@/lib/admin/acoes-perfil";
import { reduzirImagem } from "@/lib/imagem";
import { supabaseNavegador } from "@/lib/supabase/navegador";
import type { Acesso } from "@/lib/admin/acessos";
import type { Empreiteira } from "@/lib/admin/empreiteira";
import type { Resultado } from "@/lib/admin/tipos";

/**
 * Perfil: a empreiteira, a conta e a saída.
 *
 * Virou destino de navegação porque a conta não cabia mais num menu — no
 * celular ela simplesmente não existia, e a primeira tentativa (menu de três
 * pontos) abria recortada pelo `overflow-clip` da barra.
 *
 * A seção da empreiteira é a que tem consequência fora daqui: nome, contato e
 * logotipo aparecem no documento e no relatório que o **cliente** abre. A foto
 * do usuário não sai do painel. A tela deixa essa diferença escrita, porque de
 * outro modo alguém sobe a foto do rosto achando que está subindo a marca.
 */
export function TelaDePerfil({
  email,
  avatar,
  empreiteira,
  acessos,
}: {
  email: string;
  avatar: string | null;
  empreiteira: Empreiteira;
  /** Nulo para quem não é operador — e aí a seção inteira não existe. */
  acessos: Acesso[] | null;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [saindo, setSaindo] = useState(false);

  async function sair() {
    setSaindo(true);
    await supabaseNavegador().auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <>
      <Cabecalho titulo="Perfil" meta="Empreiteira, conta e acesso" />

      <Conteudo>
        <CartaoDeDados
          titulo="Empreiteira"
          aoEditar={() => setEditando(true)}
          rodape={<Logotipo logo={empreiteira.logo} />}
        >
          <>
            <Dado
              rotulo="Nome"
              valor={empreiteira.nome}
              vazio="não preenchido — o cliente vê isto"
              dica="Assina o documento do orçamento e o relatório semanal."
            />
            <Dado
              rotulo="CNPJ"
              valor={
                empreiteira.documento
                  ? formatarDocumento(empreiteira.documento)
                  : null
              }
              mono
            />
            <Dado
              rotulo="Telefone"
              valor={
                empreiteira.telefone
                  ? formatarTelefone(empreiteira.telefone)
                  : null
              }
              mono
              dica="É por aqui que o cliente liga depois de abrir o orçamento."
            />
            <Dado rotulo="E-mail de contato" valor={empreiteira.email} />

            <Dialogo
              aberto={editando}
              aoFechar={() => setEditando(false)}
              titulo="Dados da empreiteira"
              descricao="Aparecem no documento do orçamento e no relatório que o cliente abre."
            >
              {editando && (
                <FormularioDaEmpreiteira
                  empreiteira={empreiteira}
                  aoFechar={() => setEditando(false)}
                />
              )}
            </Dialogo>
          </>
        </CartaoDeDados>

        <Secao titulo="Sua conta">
          <div className="cartao flex flex-wrap items-center gap-5 px-5 py-5">
            <Retrato avatar={avatar} email={email} />

            <div className="min-w-0 flex-1">
              <p className="rotulo">E-mail</p>
              <p className="mt-1 font-mono text-sm break-words text-tinta">
                {email}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-cinza">
                Sua foto aparece só aqui dentro do painel. Quem assina o
                documento do cliente é o logotipo da empreiteira, acima.
              </p>
            </div>
          </div>
        </Secao>

        {acessos && <AcessosDoPainel acessos={acessos} euSou={email} />}

        <Secao titulo="Acesso">
          <div className="cartao px-5 py-5">
            {/* Para o operador esta frase seria repetição: a seção acima já
                mostra a lista e ainda deixa editá-la. */}
            {!acessos && (
              <p className="mb-4 border-b border-cinza-100 pb-4 text-sm leading-relaxed text-fumaca">
                Não existe cadastro público: quem entra no painel é incluído por
                nós, na configuração da conta.
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="min-w-0 text-sm leading-relaxed text-fumaca">
                Sair encerra a sessão neste aparelho. Nada do que já foi salvo
                se perde.
              </p>
              <button
                type="button"
                onClick={() => setConfirmando(true)}
                className="btn btn-secundario shrink-0"
              >
                <Porta />
                Sair
              </button>
            </div>
          </div>
        </Secao>
      </Conteudo>

      {/* Confirmação porque no celular o botão fica a um toque da aba de
          navegação, e sair sem querer no meio de um orçamento custa o
          retrabalho de entrar de novo. */}
      <Dialogo
        aberto={confirmando}
        aoFechar={() => setConfirmando(false)}
        titulo="Sair do painel?"
        descricao="Você vai precisar entrar de novo com e-mail e senha."
        estreito
      >
        <div className="dialogo-rodape">
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            className="btn btn-secundario"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void sair()}
            disabled={saindo}
            className={`btn ${saindo ? "btn-carregando" : "btn-primario"}`}
          >
            {saindo && <Girando />}
            {saindo ? "Saindo…" : "Sair"}
          </button>
        </div>
      </Dialogo>
    </>
  );
}

/**
 * O logotipo, no rodapé do cartão da empreiteira.
 *
 * Fundo xadrez atrás da imagem de propósito: quase todo logotipo vem PNG com
 * transparência, e sobre branco não dá para saber se o fundo é transparente ou
 * branco chapado — a diferença aparece só depois, no cabeçalho escuro do
 * documento, quando já foi para o cliente.
 */
function Logotipo({ logo }: { logo: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div
        className="flex h-20 w-40 shrink-0 items-center justify-center rounded-sm border border-nevoa p-2"
        style={{
          backgroundImage:
            "repeating-conic-gradient(#f0ede7 0% 25%, #ffffff 0% 50%)",
          backgroundSize: "14px 14px",
        }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt="Logotipo da empreiteira"
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <span className="text-center text-[0.65rem] leading-tight text-cinza-400">
            sem logotipo
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="rotulo">Logotipo</p>
        <p className="mt-1 text-xs leading-relaxed text-cinza">
          Assina o documento do orçamento e o relatório semanal. PNG, JPG ou
          WebP até 2 MB. PNG com fundo transparente é o que fica melhor sobre o
          cabeçalho escuro.
        </p>
        <div className="mt-3">
          <EnvioDeImagem
            acao={enviarLogo}
            rotulo={logo ? "Trocar logotipo" : "Enviar logotipo"}
            maiorLado={600}
            preservarPng
            aoRemover={logo ? removerLogo : undefined}
          />
        </div>
      </div>
    </div>
  );
}

/** A foto do usuário. Cai nas iniciais quando não há foto, como na barra. */
function Retrato({ avatar, email }: { avatar: string | null; email: string }) {
  const iniciais = (() => {
    const nome = email.split("@")[0] ?? "";
    const partes = nome.split(/[._-]+/).filter(Boolean);
    return (
      partes.length >= 2 ? `${partes[0][0]}${partes[1][0]}` : nome.slice(0, 2)
    ).toUpperCase();
  })();

  return (
    <div className="flex items-center gap-4">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
          alt=""
          className="h-16 w-16 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-arroio text-lg font-semibold text-papel">
          {iniciais}
        </span>
      )}

      <EnvioDeImagem
        acao={enviarAvatar}
        rotulo={avatar ? "Trocar foto" : "Enviar foto"}
        maiorLado={320}
        aoRemover={avatar ? removerAvatar : undefined}
      />
    </div>
  );
}

/**
 * Botão de upload com redução no navegador.
 *
 * A redução não é enfeite: Server Action tem teto de payload, e foto de
 * celular chega com 3 a 8 MB. Reduzindo antes, o que sobe é da ordem de
 * dezenas de kB e o teto nunca é assunto.
 */
function EnvioDeImagem({
  acao,
  rotulo,
  maiorLado,
  preservarPng = false,
  aoRemover,
}: {
  acao: (anterior: Resultado | null, form: FormData) => Promise<Resultado>;
  rotulo: string;
  maiorLado: number;
  preservarPng?: boolean;
  aoRemover?: () => Promise<Resultado>;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [estado, despachar, enviando] = useActionState<
    Resultado | null,
    FormData
  >(acao, null);
  const [preparando, setPreparando] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [removendo, setRemovendo] = useState(false);

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    // Zera já: sem isto, escolher o mesmo arquivo de novo não dispara `change`
    // e o botão parece morto.
    e.target.value = "";
    if (!arquivo) return;

    setErroLocal(null);
    setPreparando(true);
    try {
      const { blob, mimeType, extensao } = await reduzirImagem(
        arquivo,
        maiorLado,
        0.9,
        preservarPng && arquivo.type === "image/png"
          ? "image/png"
          : "image/jpeg",
      );

      const form = new FormData();
      form.append("arquivo", new File([blob], `imagem.${extensao}`, { type: mimeType }));
      despachar(form);
    } catch {
      setErroLocal("Não consegui ler esta imagem.");
    } finally {
      setPreparando(false);
    }
  }

  const ocupado = preparando || enviando;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={entrada}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={aoEscolher}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          disabled={ocupado}
          className={`btn btn-compacto ${ocupado ? "btn-carregando" : "btn-secundario"}`}
        >
          {ocupado && <Girando />}
          {ocupado ? "Enviando…" : rotulo}
        </button>

        {aoRemover && (
          <button
            type="button"
            disabled={removendo || ocupado}
            onClick={async () => {
              setRemovendo(true);
              await aoRemover();
              setRemovendo(false);
            }}
            className="acao-texto text-cinza disabled:opacity-40"
          >
            {removendo ? "Removendo…" : "Remover"}
          </button>
        )}
      </div>

      {(erroLocal || estado?.erro) && (
        <p className="aviso aviso-erro text-xs">{erroLocal ?? estado?.erro}</p>
      )}
    </div>
  );
}

function FormularioDaEmpreiteira({
  empreiteira,
  aoFechar,
}: {
  empreiteira: Empreiteira;
  aoFechar: () => void;
}) {
  const [estado, acao, pendente] = useActionState<Resultado | null, FormData>(
    salvarEmpreiteira,
    null,
  );

  useEffect(() => {
    if (estado?.ok) aoFechar();
  }, [estado, aoFechar]);

  return (
    <form action={acao} className="dialogo-forma">
      <div className="dialogo-corpo flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Nome da empreiteira *</span>
          <input
            name="nome"
            defaultValue={empreiteira.nome ?? ""}
            placeholder="RD Engenharia"
            required
            autoFocus
            className="campo"
          />
          <span className="ajuda-campo">
            Assina o documento do orçamento e o relatório semanal.
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">CNPJ</span>
            <CampoDeDocumento
              nome="documento"
              valorInicial={empreiteira.documento}
              placeholder="00.000.000/0000-00"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Telefone</span>
            <CampoDeTelefone
              nome="telefone"
              valorInicial={empreiteira.telefone}
              placeholder="(85) 99999-0000"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">E-mail de contato</span>
          <input
            name="email"
            type="email"
            defaultValue={empreiteira.email ?? ""}
            placeholder="contato@empreiteira.com.br"
            className="campo"
          />
          <span className="ajuda-campo">
            Onde o cliente responde. Pode ser diferente do e-mail de entrada no
            painel.
          </span>
        </label>

        {estado?.erro && <p className="aviso aviso-erro text-sm">{estado.erro}</p>}
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

function Porta() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h9M9 12h12m0 0-4-4m4 4-4 4" />
    </svg>
  );
}
