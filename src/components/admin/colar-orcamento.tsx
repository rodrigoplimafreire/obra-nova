"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialogo } from "@/components/comum/dialogo";
import { Girando } from "@/components/comum/esqueleto";
import {
  acrescentarDaColagem,
  criarDaColagem,
  entenderColagem,
  type AudioColado,
} from "@/lib/orcamento/acoes-colagem";
import type { Colagem, ImagemColada } from "@/lib/orcamento/colagem";

/**
 * Colar o que o cliente mandou e sair com o orçamento pronto.
 *
 * Substitui o formulário de "Novo orçamento" para o caminho de todo dia: o
 * material chega pronto no WhatsApp, e redigitar cliente, endereço e vinte
 * linhas de serviço num formulário é trabalho que a máquina faz melhor.
 *
 * **A conferência não é opcional.** A tela sempre mostra o que a IA entendeu
 * antes de gravar, com os valores à vista. É a única defesa contra um número
 * lido errado — e o modelo que enxerga imagem, nesta conta, é o mais fraco dos
 * disponíveis: num teste ele chamou o logotipo da RD de "ícone do React".
 */

const LIMITE_ARQUIVO = 20 * 1024 * 1024;

export function ColarOrcamento({
  aberto,
  aoFechar,
  /**
   * Quando vem preenchido, a colagem **acrescenta** itens a este orçamento em
   * vez de criar um novo. É o ajuste que o cliente manda depois: trocou a
   * metragem, incluiu um serviço, mandou o preço que faltava.
   */
  orcamentoId,
}: {
  aberto: boolean;
  aoFechar: () => void;
  orcamentoId?: string;
}) {
  const acrescentando = Boolean(orcamentoId);

  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={
        acrescentando
          ? "Colar material neste orçamento"
          : "Colar o material do cliente"
      }
      descricao={
        acrescentando
          ? "O que a IA entender entra como itens novos, no fim da tabela. Cliente, endereço e objeto ficam como estão."
          : "Cole o texto que ele mandou, com print de tabela se houver. A IA monta o orçamento e você confere antes de gravar."
      }
    >
      {aberto && <Miolo aoFechar={aoFechar} orcamentoId={orcamentoId} />}
    </Dialogo>
  );
}

function Miolo({
  aoFechar,
  orcamentoId,
}: {
  aoFechar: () => void;
  orcamentoId?: string;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [imagens, setImagens] = useState<Array<ImagemColada & { nome: string }>>([]);
  const [audios, setAudios] = useState<AudioColado[]>([]);
  const [lendo, setLendo] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [colagem, setColagem] = useState<Colagem | null>(null);
  const [senha, setSenha] = useState("");

  /**
   * Um caminho só para os três tipos que o cliente manda.
   *
   * Imagem vai para o modelo de visão, áudio para o Whisper, e arquivo de
   * texto é lido aqui mesmo e emendado no campo — não faz sentido gastar
   * chamada de IA para abrir um `.txt`.
   */
  async function anexar(arquivos: FileList | File[]) {
    const novasImagens: Array<ImagemColada & { nome: string }> = [];
    const novosAudios: AudioColado[] = [];
    const novosTextos: string[] = [];

    for (const arquivo of Array.from(arquivos)) {
      const ehTexto =
        arquivo.type.startsWith("text/") ||
        /\.(txt|csv|md)$/i.test(arquivo.name);

      if (arquivo.size > LIMITE_ARQUIVO) {
        setErro(`${arquivo.name || "arquivo"} passa de 20 MB.`);
        continue;
      }

      if (ehTexto) {
        novosTextos.push(`--- ${arquivo.name} ---\n${await arquivo.text()}`);
        continue;
      }

      if (!arquivo.type.startsWith("image/") && !arquivo.type.startsWith("audio/")) {
        setErro(
          `${arquivo.name || "arquivo"}: só imagem, áudio ou texto. PDF e Word ainda não.`,
        );
        continue;
      }

      const base64 = await new Promise<string>((resolve) => {
        const leitor = new FileReader();
        leitor.onload = () =>
          resolve(String(leitor.result).split(",")[1] ?? "");
        leitor.readAsDataURL(arquivo);
      });

      if (arquivo.type.startsWith("audio/")) {
        novosAudios.push({
          mimeType: arquivo.type,
          base64,
          nome: arquivo.name || `áudio ${audios.length + novosAudios.length + 1}`,
        });
      } else {
        novasImagens.push({
          mimeType: arquivo.type,
          base64,
          nome: arquivo.name || `print ${imagens.length + novasImagens.length + 1}`,
        });
      }
    }

    if (novasImagens.length)
      setImagens((a) => [...a, ...novasImagens].slice(0, 6));
    if (novosAudios.length) setAudios((a) => [...a, ...novosAudios].slice(0, 4));
    if (novosTextos.length)
      setTexto((t) => [t.trim(), ...novosTextos].filter(Boolean).join("\n\n"));
  }

  /**
   * Um `Ctrl+V` só resolve os dois casos: print da tabela vem como arquivo no
   * clipboard, texto vem como texto. Obrigar a pessoa a escolher entre "colar"
   * e "anexar" seria devolver a ela um trabalho que o navegador já sabe fazer.
   */
  async function aoColar(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const arquivos = Array.from(e.clipboardData.files);
    if (arquivos.length) {
      e.preventDefault();
      await anexar(arquivos);
    }
  }

  async function ler() {
    setErro(null);
    setLendo(true);
    try {
      const saida = await entenderColagem(
        texto,
        imagens.map(({ mimeType, base64 }) => ({ mimeType, base64 })),
        audios,
      );
      if (!saida.ok) {
        setErro(saida.erro);
        return;
      }
      setColagem(saida.colagem);
      setSenha(sugerirSenha(saida.slug));
    } catch (e) {
      setErro(
        `A conexão caiu no meio (${e instanceof Error ? e.message : String(e)}). Nada foi gravado.`,
      );
    } finally {
      setLendo(false);
    }
  }

  async function gravar() {
    if (!colagem) return;
    setErro(null);
    setGravando(true);
    try {
      if (orcamentoId) {
        const saida = await acrescentarDaColagem(orcamentoId, colagem);
        if (!saida.ok) {
          setErro(saida.erro ?? "Não consegui acrescentar.");
          setGravando(false);
          return;
        }
        aoFechar();
        router.refresh();
        return;
      }

      const saida = await criarDaColagem(colagem, senha);
      if (!saida.ok) {
        setErro(saida.erro);
        setGravando(false);
        return;
      }
      router.push(saida.link);
    } catch (e) {
      setErro(
        `A conexão caiu no meio (${e instanceof Error ? e.message : String(e)}). Confira a lista de orçamentos.`,
      );
      setGravando(false);
    }
  }

  // ---------- Passo 2: conferir ----------
  if (colagem) {
    const total = colagem.itens.reduce(
      (s, i) => s + (i.valorUnitario ?? 0) * (i.quantidade ?? 1),
      0,
    );

    return (
      <>
        <div className="dialogo-corpo flex flex-col gap-5">
          {/* Antes de tudo, porque é sobre dinheiro faltando.

              A IA às vezes não emite a linha de fechamento de um grupo —
              medido, nove rodadas do mesmo texto, três sem o "Valor de
              material". Isso não dá erro nem tela vazia: sobra um item com
              preço, o orçamento parece completo, e sai R$ 5.718 abaixo do que
              o cliente escreveu. A conferência é por regex contra o texto cru,
              que é a única fonte que não alucina. Ver `conferirTotais`. */}
          {colagem.conferencia.faltando.length > 0 && (
            <div className="aviso aviso-erro text-sm leading-relaxed">
              <p className="font-semibold">
                {colagem.conferencia.faltando.length === 1
                  ? "Um valor que você colou não entrou na tabela."
                  : `${colagem.conferencia.faltando.length} valores que você colou não entraram na tabela.`}
              </p>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
                {colagem.conferencia.faltando.map((t, n) => (
                  <li key={n}>
                    <b>{t.rotulo}</b> — {moeda(t.valor)}
                  </li>
                ))}
              </ul>
              <p className="mt-2">
                A tabela abaixo soma {moeda(colagem.conferencia.somaDosItens)}.
                Acrescente a linha que falta antes de gravar, ou peça para ler
                de novo.
              </p>
            </div>
          )}

          {colagem.entendido && (
            <p className="aviso text-sm leading-relaxed">
              {colagem.entendido}
            </p>
          )}

          {/* Acrescentando, o cabeçalho não aparece: quem já conferiu cliente
              e endereço uma vez não quer que uma mensagem de ajuste os
              reescreva por baixo. */}
          {!orcamentoId && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo
                  rotulo="Cliente *"
                  valor={colagem.cliente ?? ""}
                  aoMudar={(v) => setColagem({ ...colagem, cliente: v || null })}
                />
                <Campo
                  rotulo="Objeto"
                  valor={colagem.objeto ?? ""}
                  aoMudar={(v) => setColagem({ ...colagem, objeto: v || null })}
                />
              </div>
              <Campo
                rotulo="Endereço"
                valor={colagem.endereco ?? ""}
                aoMudar={(v) => setColagem({ ...colagem, endereco: v || null })}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo
                  rotulo="Prazo"
                  valor={colagem.prazo ?? ""}
                  aoMudar={(v) => setColagem({ ...colagem, prazo: v || null })}
                />
                <Campo
                  rotulo="Senha do link *"
                  valor={senha}
                  aoMudar={setSenha}
                  dica="O cliente digita para abrir."
                />
              </div>
            </>
          )}

          <div>
            <p className="rotulo mb-2">
              {colagem.itens.length} itens · soma {moeda(total)}
            </p>
            <ul className="flex max-h-72 flex-col gap-px overflow-y-auto rounded-sm border border-cinza-100 bg-cinza-100">
              {colagem.itens.map((i, n) => (
                <li key={n} className="bg-papel px-3 py-2">
                  {i.grupo && (
                    <p className="font-mono text-[0.6rem] tracking-widest text-cinza uppercase">
                      {i.grupo}
                    </p>
                  )}
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 text-sm text-tinta">
                      {i.descricao}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-fumaca">
                      {i.quantidade !== null
                        ? `${i.quantidade} ${i.unidade ?? ""}`
                        : "—"}
                      {i.valorUnitario !== null && (
                        <strong className="ml-2 text-tinta">
                          {moeda(i.valorUnitario)}
                        </strong>
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-cinza">
              Confira os valores contra o que o cliente mandou. Dá para ajustar
              cada linha depois, na tabela do orçamento.
            </p>
          </div>

          {colagem.duvidas.length > 0 && (
            <div>
              <p className="rotulo mb-1">A IA ficou em dúvida</p>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed text-fumaca">
                {colagem.duvidas.map((d, n) => (
                  <li key={n}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          {erro && <p className="aviso aviso-erro text-sm">{erro}</p>}
        </div>

        <div className="dialogo-rodape">
          <button
            type="button"
            onClick={() => setColagem(null)}
            disabled={gravando}
            className="btn btn-secundario"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={() => void gravar()}
            disabled={gravando}
            className={`btn ${gravando ? "btn-carregando" : "btn-primario"}`}
          >
            {gravando && <Girando />}
            {gravando
              ? orcamentoId ? "Acrescentando…" : "Criando…"
              : orcamentoId ? "Acrescentar à tabela" : "Criar orçamento"}
          </button>
        </div>
      </>
    );
  }

  // ---------- Passo 1: colar ----------
  return (
    <>
      <div className="dialogo-corpo flex flex-col gap-4">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onPaste={(e) => void aoColar(e)}
          onDrop={(e) => {
            e.preventDefault();
            void anexar(e.dataTransfer.files);
          }}
          onDragOver={(e) => e.preventDefault()}
          autoFocus
          rows={12}
          placeholder={
            "Cole aqui tudo que o cliente mandou.\n\nNome, endereço, lista de serviços, medidas, valores — do jeito que veio, sem organizar. Print de tabela também: cole a imagem aqui dentro."
          }
          className="campo resize-y font-mono text-[0.8125rem] leading-relaxed"
        />

        {/* O `Ctrl+V` resolve o print, mas não o áudio do WhatsApp: aquilo é
            arquivo salvo no aparelho, e o clipboard nunca vê. Sem este botão
            não havia caminho nenhum para áudio nem para arquivo baixado. */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="btn btn-secundario cursor-pointer">
            <Clipe />
            Anexar arquivo
            <input
              type="file"
              multiple
              accept="image/*,audio/*,text/plain,text/csv,.txt,.csv,.md"
              onChange={(e) => {
                if (e.target.files) void anexar(e.target.files);
                // Zera para o mesmo arquivo poder ser escolhido de novo depois
                // de removido — sem isto o `change` não dispara na segunda vez.
                e.target.value = "";
              }}
              className="hidden"
            />
          </label>
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-cinza">
            Imagem, áudio de WhatsApp ou arquivo de texto. PDF e Word ainda
            não — por enquanto, copie o conteúdo e cole acima.
          </p>
        </div>

        {imagens.length > 0 && (
          <div>
            <p className="rotulo mb-2">{imagens.length} imagem(ns)</p>
            <ul className="flex flex-wrap gap-2">
              {imagens.map((img, n) => (
                <li
                  key={n}
                  className="flex items-center gap-2 rounded-sm border border-nevoa bg-papel px-3 py-1.5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:${img.mimeType};base64,${img.base64}`}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-xs object-cover"
                  />
                  <span className="max-w-40 truncate text-xs text-fumaca">
                    {img.nome}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setImagens((a) => a.filter((_, i) => i !== n))
                    }
                    aria-label={`Tirar ${img.nome}`}
                    className="text-cinza transition hover:text-tinta"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-atencao">
              Imagem é lida por um modelo que erra mais que o de texto. Confira
              número por número na tela seguinte.
            </p>
          </div>
        )}

        {audios.length > 0 && (
          <div>
            <p className="rotulo mb-2">{audios.length} áudio(s)</p>
            <ul className="flex flex-col gap-1.5">
              {audios.map((a, n) => (
                <li
                  key={n}
                  className="flex items-center gap-2 rounded-sm border border-nevoa bg-papel px-3 py-2"
                >
                  <Onda />
                  <span className="min-w-0 flex-1 truncate text-xs text-fumaca">
                    {a.nome}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAudios((l) => l.filter((_, i) => i !== n))}
                    aria-label={`Tirar ${a.nome}`}
                    className="text-cinza transition hover:text-tinta"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-cinza">
              Transcritos antes de a IA montar a tabela. Leva alguns segundos
              cada um.
            </p>
          </div>
        )}

        {erro && <p className="aviso aviso-erro text-sm">{erro}</p>}
      </div>

      <div className="dialogo-rodape">
        <button
          type="button"
          onClick={aoFechar}
          disabled={lendo}
          className="btn btn-secundario"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void ler()}
          disabled={
            lendo ||
            (!texto.trim() && imagens.length === 0 && audios.length === 0)
          }
          className={`btn ${lendo ? "btn-carregando" : "btn-primario"}`}
        >
          {lendo && <Girando />}
          {lendo ? "Lendo…" : "Ler o material"}
        </button>
      </div>
    </>
  );
}

function Campo({
  rotulo,
  valor,
  aoMudar,
  dica,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  dica?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="rotulo-campo">{rotulo}</span>
      <input
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className="campo"
      />
      {dica && <span className="ajuda-campo">{dica}</span>}
    </label>
  );
}

function moeda(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Segue o padrão que a RD já usa nos links antigos: `Livonio2026`,
 * `Helano2026`. Editável — é sugestão, não imposição.
 */
function sugerirSenha(slug: string): string {
  if (!slug) return "";
  return slug.charAt(0).toUpperCase() + slug.slice(1) + new Date().getFullYear();
}

function Clipe() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7.5-7.5" />
    </svg>
  );
}

function Onda() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 shrink-0 fill-none stroke-arroio"
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" />
    </svg>
  );
}
