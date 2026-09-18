"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  adicionarItem,
  editarItem,
  moverItem,
  removerItem,
} from "@/lib/diario/acoes-itens";
import { ROTULO_DA_SECAO, SECOES, type ItemDoDia, type Secao } from "@/lib/diario/tipos";

/**
 * O relatório do dia, item a item.
 *
 * **Esta tela existe para ser tocada, não digitada.** Antes eram quatro
 * `textarea` com a convenção "um item por linha", e o gesto mais frequente do
 * diário — mover "ajuste do contraste" de *Em andamento* para *Realizado* —
 * custava recortar de um campo e colar em outro. Aqui é um `<select>`: a
 * linha troca de seção e o servidor só mexe numa coluna.
 *
 * O texto continua editável, porque corrigir uma palavra da transcrição é
 * inevitável. Mas corrigir é a exceção; mover e marcar é o dia a dia.
 */

export function ItensDoDia({
  dia,
  itens,
}: {
  dia: string;
  itens: ItemDoDia[];
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function executar(chave: string, acao: () => Promise<{ ok: boolean; erro?: string }>) {
    setOcupado(chave);
    setErro(null);
    try {
      const saida = await acao();
      if (!saida.ok) setErro(saida.erro ?? "Não consegui fazer isso.");
      else router.refresh();
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {erro && <p className="aviso aviso-erro">{erro}</p>}

      {SECOES.map(({ chave, rotulo, ajuda, comResponsavel }) => {
        const daSecao = itens.filter((i) => i.secao === chave);

        return (
          <section key={chave}>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
              <h3 className="rotulo-campo">{rotulo}</h3>
              <p className="text-xs text-cinza">{ajuda}</p>
            </div>

            <ul className="flex flex-col gap-1.5">
              {daSecao.map((item) => (
                <Linha
                  key={item.id}
                  item={item}
                  comResponsavel={comResponsavel}
                  ocupado={ocupado === item.id}
                  aoMover={(secao) =>
                    executar(item.id, () => moverItem(item.id, secao))
                  }
                  aoEditar={(texto, responsavel) =>
                    executar(item.id, () =>
                      editarItem({ id: item.id, texto, responsavel }),
                    )
                  }
                  aoRemover={() =>
                    executar(item.id, () => removerItem(item.id))
                  }
                />
              ))}

              <li>
                <Adicionar
                  rotulo={rotulo}
                  ocupado={ocupado === `novo-${chave}`}
                  aoAdicionar={(texto) =>
                    executar(`novo-${chave}`, () =>
                      adicionarItem({ dia, secao: chave, texto }),
                    )
                  }
                />
              </li>
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/**
 * Uma linha do relatório.
 *
 * O texto salva ao sair do campo, e não a cada tecla: uma chamada por
 * caractere entupiria a rede e ainda carimbaria `editado_em` mil vezes. Sair
 * do campo é o momento em que a pessoa terminou de pensar.
 */
function Linha({
  item,
  comResponsavel,
  ocupado,
  aoMover,
  aoEditar,
  aoRemover,
}: {
  item: ItemDoDia;
  comResponsavel: boolean;
  ocupado: boolean;
  aoMover: (secao: Secao) => void;
  aoEditar: (texto: string, responsavel: string | null) => void;
  aoRemover: () => void;
}) {
  const [texto, setTexto] = useState(item.texto);
  const [responsavel, setResponsavel] = useState(item.responsavel ?? "");

  function salvarSeMudou() {
    const limpo = texto.trim();
    const dono = responsavel.trim();
    if (!limpo) return setTexto(item.texto);
    if (limpo === item.texto && dono === (item.responsavel ?? "")) return;
    aoEditar(limpo, dono || null);
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-sm border border-nevoa bg-white px-3 py-2 transition ${
        ocupado ? "opacity-50" : ""
      }`}
    >
      {comResponsavel && (
        <input
          value={responsavel}
          onChange={(e) => setResponsavel(e.target.value)}
          onBlur={salvarSeMudou}
          placeholder="Quem"
          aria-label="Responsável"
          className="w-24 shrink-0 rounded-sm bg-papel px-2 py-1 font-mono text-[0.7rem] text-tinta uppercase outline-none focus:ring-2 focus:ring-tinta"
        />
      )}

      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={salvarSeMudou}
        aria-label="Texto do item"
        className="min-w-40 flex-1 bg-transparent text-sm leading-snug text-tinta outline-none"
      />

      {/* O seletor é a razão de esta entrega existir: trocar de seção era
          recortar e colar entre dois campos, e virou um toque. */}
      <select
        value={item.secao}
        onChange={(e) => aoMover(e.target.value as Secao)}
        disabled={ocupado}
        aria-label={`Seção de "${item.texto.slice(0, 40)}"`}
        className="shrink-0 rounded-sm border border-concreto bg-papel px-2 py-1 text-xs text-fumaca"
      >
        {SECOES.map((s) => (
          <option key={s.chave} value={s.chave}>
            {ROTULO_DA_SECAO[s.chave]}
          </option>
        ))}
      </select>

      {/* Pastilha só quando a linha é da IA: o padrão é humano, e marcar o
          padrão é ruído. Some no instante em que alguém edita. */}
      {item.origem === "ia" && (
        <span className="selo selo-planejado shrink-0">IA</span>
      )}

      <button
        type="button"
        onClick={aoRemover}
        disabled={ocupado}
        aria-label={`Remover "${item.texto.slice(0, 40)}"`}
        className="shrink-0 rounded-sm px-1.5 py-1 text-cinza-500 transition hover:bg-papel hover:text-atraso"
      >
        <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-none stroke-current" strokeWidth={1.8} strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

/** A última linha de cada seção: escreve e Enter. */
function Adicionar({
  rotulo,
  ocupado,
  aoAdicionar,
}: {
  rotulo: string;
  ocupado: boolean;
  aoAdicionar: (texto: string) => void;
}) {
  const [texto, setTexto] = useState("");

  function enviar() {
    const limpo = texto.trim();
    if (!limpo) return;
    setTexto("");
    aoAdicionar(limpo);
  }

  return (
    <input
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          enviar();
        }
      }}
      onBlur={enviar}
      disabled={ocupado}
      placeholder={`Adicionar em ${rotulo.toLowerCase()}…`}
      aria-label={`Adicionar item em ${rotulo}`}
      // Sem borda até receber foco: uma caixa vazia por seção, sempre à
      // vista, viraria quatro molduras competindo com os itens de verdade.
      className="w-full rounded-sm border border-transparent px-3 py-2 text-sm text-tinta outline-none placeholder:text-cinza-500 focus:border-concreto focus:bg-white"
    />
  );
}
