"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialogo } from "@/components/comum/dialogo";
import { Girando } from "@/components/comum/esqueleto";
import { criarDaColagem, entenderColagem } from "@/lib/orcamento/acoes-colagem";
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

const LIMITE_IMAGEM = 8 * 1024 * 1024;

export function ColarOrcamento({
  aberto,
  aoFechar,
}: {
  aberto: boolean;
  aoFechar: () => void;
}) {
  return (
    <Dialogo
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Colar o material do cliente"
      descricao="Cole o texto que ele mandou, com print de tabela se houver. A IA monta o orçamento e você confere antes de gravar."
    >
      {aberto && <Miolo aoFechar={aoFechar} />}
    </Dialogo>
  );
}

function Miolo({ aoFechar }: { aoFechar: () => void }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [imagens, setImagens] = useState<Array<ImagemColada & { nome: string }>>([]);
  const [lendo, setLendo] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [colagem, setColagem] = useState<Colagem | null>(null);
  const [senha, setSenha] = useState("");

  async function anexar(arquivos: FileList | File[]) {
    const novas: Array<ImagemColada & { nome: string }> = [];
    for (const arquivo of Array.from(arquivos)) {
      if (!arquivo.type.startsWith("image/")) continue;
      if (arquivo.size > LIMITE_IMAGEM) {
        setErro(`${arquivo.name || "imagem"} passa de 8 MB.`);
        continue;
      }
      const base64 = await new Promise<string>((resolve) => {
        const leitor = new FileReader();
        leitor.onload = () =>
          resolve(String(leitor.result).split(",")[1] ?? "");
        leitor.readAsDataURL(arquivo);
      });
      novas.push({
        mimeType: arquivo.type,
        base64,
        nome: arquivo.name || `print ${imagens.length + novas.length + 1}`,
      });
    }
    if (novas.length) setImagens((atuais) => [...atuais, ...novas].slice(0, 6));
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
          {colagem.entendido && (
            <p className="aviso text-sm leading-relaxed">
              {colagem.entendido}
            </p>
          )}

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
            {gravando ? "Criando…" : "Criar orçamento"}
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
          disabled={lendo || (!texto.trim() && imagens.length === 0)}
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
