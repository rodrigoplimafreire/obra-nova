"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Dialogo } from "@/components/comum/dialogo";
import { Girando } from "@/components/comum/esqueleto";
import { lancarTempo } from "@/lib/pipeline/acoes";
import { ETAPAS, ROTULO_ETAPA, type Etapa } from "@/lib/pipeline/constantes";

/**
 * Registro de esforço: cronômetro de um toque, com formulário manual ao lado.
 *
 * O manual **não é fallback de segunda classe**. Ninguém lembra de iniciar
 * cronômetro toda vez, e uma feature que só mede o que foi cronometrado mede
 * os dias bons e perde os dias corridos — que são justamente os que explicam
 * por que o orçamento não sai. Os dois caminhos gravam a mesma coisa; o campo
 * `fonte` guarda por qual deles veio, para depois dar para saber se o número
 * é cronometrado ou lembrado.
 *
 * O estado do cronômetro vive em `localStorage` porque a visita técnica dura
 * horas e o navegador do celular descarta aba em segundo plano sem avisar.
 * Guardar o instante de início (e não os segundos decorridos) é o que faz a
 * conta continuar certa depois de a aba morrer.
 */

const CHAVE = "obranova_cronometro";

type Corrida = { pedidoId: string; etapa: Etapa; inicio: number };

/**
 * O cronômetro é estado do navegador, não do React — por isso é lido por
 * `useSyncExternalStore` e não por um efeito que copia para dentro.
 *
 * Além de ser a forma certa (nada de render em cascata no primeiro paint, e o
 * servidor recebe `null` sem divergir do cliente), isto resolve de graça um
 * problema real: o `storage` do navegador avisa **as outras abas**. Duas abas
 * abertas no mesmo pedido passam a ver o mesmo cronômetro, em vez de cada uma
 * achar que é dona dele e a mesma hora ser contada duas vezes.
 */
const ouvintes = new Set<() => void>();

function assinar(aviso: () => void) {
  ouvintes.add(aviso);
  window.addEventListener("storage", aviso);
  return () => {
    ouvintes.delete(aviso);
    window.removeEventListener("storage", aviso);
  };
}

/** Devolve a string crua: `useSyncExternalStore` compara por identidade, e
 *  objeto novo a cada leitura entraria em laço infinito. */
function instantaneo(): string | null {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    // Aba anônima ou armazenamento bloqueado: sem cronômetro, sem quebrar.
    return null;
  }
}

const instantaneoNoServidor = () => null;

function gravar(c: Corrida | null) {
  try {
    if (c) localStorage.setItem(CHAVE, JSON.stringify(c));
    else localStorage.removeItem(CHAVE);
  } catch {
    /* sem armazenamento, o cronômetro só não sobrevive a fechar a aba */
  }
  // `storage` não dispara na aba que escreveu; o aviso local é o que faz esta
  // tela reagir ao próprio clique.
  ouvintes.forEach((f) => f());
}

function interpretar(bruto: string | null): Corrida | null {
  if (!bruto) return null;
  try {
    const c = JSON.parse(bruto) as Corrida;
    return typeof c?.inicio === "number" && c.pedidoId ? c : null;
  } catch {
    // JSON de uma versão antiga do formato.
    return null;
  }
}

export function CronometroDeEtapa({
  pedidoId,
  aoRegistrar,
}: {
  pedidoId: string;
  aoRegistrar: () => void;
}) {
  const bruto = useSyncExternalStore(
    assinar,
    instantaneo,
    instantaneoNoServidor,
  );
  const corrida = useMemo(() => interpretar(bruto), [bruto]);

  const [agora, setAgora] = useState(() => Date.now());
  const [etapa, setEtapa] = useState<Etapa>("estudo_projeto");
  const [confirmando, setConfirmando] = useState<number | null>(null);

  useEffect(() => {
    if (!corrida) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [corrida]);

  const meu = corrida?.pedidoId === pedidoId ? corrida : null;
  const deOutro = corrida && corrida.pedidoId !== pedidoId ? corrida : null;

  function iniciar() {
    gravar({ pedidoId, etapa, inicio: Date.now() });
    setAgora(Date.now());
  }

  function parar() {
    if (!meu) return;
    // Menos de um minuto ainda conta como um: zero seria recusado pelo banco, e
    // "não registrei porque foi rápido" é como o dado começa a sumir.
    const minutos = Math.max(1, Math.round((Date.now() - meu.inicio) / 60000));
    setEtapa(meu.etapa);
    gravar(null);
    setConfirmando(minutos);
  }

  function descartar() {
    gravar(null);
  }

  const decorrido = meu ? Math.max(0, agora - meu.inicio) : 0;

  return (
    <>
      {meu ? (
        <div className="flex flex-col gap-3 rounded-lg border border-arroio bg-emdia-fundo px-5 py-4">
          <p className="rotulo">{ROTULO_ETAPA[meu.etapa]} · rodando</p>
          <p className="font-sans text-[2.5rem] leading-none font-semibold -tracking-[0.03em] text-tinta tabular-nums">
            {relogio(decorrido)}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={parar} className="btn btn-primario">
              Parar e registrar
            </button>
            <button
              type="button"
              onClick={descartar}
              className="btn btn-secundario"
            >
              Descartar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-nevoa bg-white px-5 py-4">
          <p className="rotulo">Cronômetro</p>

          {/* Um cronômetro por vez: dois rodando ao mesmo tempo contariam a
              mesma hora duas vezes, e o custo do orçamento sairia inflado. */}
          {deOutro ? (
            <p className="text-sm text-cinza">
              Há um cronômetro rodando em outro pedido. Pare aquele antes de
              começar este.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {ETAPAS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEtapa(e)}
                    className={`btn btn-compacto ${
                      etapa === e ? "btn-primario" : "btn-secundario"
                    }`}
                  >
                    {ROTULO_ETAPA[e]}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={iniciar}
                className="btn btn-primario w-full justify-center py-3 sm:w-auto"
              >
                Iniciar
              </button>
            </>
          )}
        </div>
      )}

      {/* `key` nos minutos: o diálogo **remonta** a cada parada, e o campo
          nasce já com o valor certo. Sincronizar por efeito era copiar prop
          para estado — um render a mais e uma chance de os dois discordarem. */}
      <ConfirmarTempo
        key={confirmando ?? "parado"}
        pedidoId={pedidoId}
        etapa={etapa}
        minutos={confirmando}
        aoFechar={() => setConfirmando(null)}
        aoRegistrar={aoRegistrar}
      />
    </>
  );
}

/**
 * A confirmação depois de parar.
 *
 * Os minutos vêm preenchidos mas editáveis, porque cronômetro esquecido ligado
 * durante o almoço é o caso comum, não a exceção — e gravar 240 minutos de
 * estudo que foram 40 estraga a média que a feature inteira existe para medir.
 */
function ConfirmarTempo({
  pedidoId,
  etapa,
  minutos,
  aoFechar,
  aoRegistrar,
}: {
  pedidoId: string;
  etapa: Etapa;
  minutos: number | null;
  aoFechar: () => void;
  aoRegistrar: () => void;
}) {
  const [valor, setValor] = useState(String(minutos ?? ""));
  const [km, setKm] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const r = await lancarTempo(pedidoId, {
      etapa,
      minutos: Number(valor),
      km: km ? Number(km.replace(",", ".")) : null,
      fonte: "cronometro",
    });
    setSalvando(false);
    if (!r.ok) return setErro(r.erro ?? "Não consegui registrar.");
    aoFechar();
    aoRegistrar();
  }

  return (
    <Dialogo
      aberto={minutos !== null}
      aoFechar={aoFechar}
      titulo="Registrar o tempo"
      descricao={ROTULO_ETAPA[etapa]}
      estreito
    >
      <div className="dialogo-corpo flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Minutos</span>
          <input
            type="number"
            min={1}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            autoFocus
            className="campo"
          />
        </label>

        {etapa === "deslocamento" && (
          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Km rodados</span>
            <input
              inputMode="decimal"
              value={km}
              onChange={(e) => setKm(e.target.value)}
              placeholder="opcional"
              className="campo"
            />
          </label>
        )}

        {erro && <p className="aviso aviso-erro text-sm">{erro}</p>}
      </div>

      <div className="dialogo-rodape">
        <button type="button" onClick={aoFechar} className="btn btn-secundario">
          Cancelar
        </button>
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className={`btn ${salvando ? "btn-carregando" : "btn-primario"}`}
        >
          {salvando && <Girando />}
          {salvando ? "Registrando…" : "Registrar"}
        </button>
      </div>
    </Dialogo>
  );
}

/**
 * Lançamento manual. Quinze segundos: etapa, minutos, pronto.
 */
export function LancamentoManual({
  pedidoId,
  aoRegistrar,
}: {
  pedidoId: string;
  aoRegistrar: () => void;
}) {
  const [etapa, setEtapa] = useState<Etapa>("estudo_projeto");
  const [minutos, setMinutos] = useState("");
  const [km, setKm] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const campoMinutos = useRef<HTMLInputElement>(null);

  const salvar = useCallback(async () => {
    setSalvando(true);
    setErro(null);
    const r = await lancarTempo(pedidoId, {
      etapa,
      minutos: Number(minutos),
      km: km ? Number(km.replace(",", ".")) : null,
      fonte: "manual",
    });
    setSalvando(false);
    if (!r.ok) return setErro(r.erro ?? "Não consegui registrar.");
    setMinutos("");
    setKm("");
    campoMinutos.current?.focus();
    aoRegistrar();
  }, [pedidoId, etapa, minutos, km, aoRegistrar]);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-nevoa bg-white px-5 py-4">
      <p className="rotulo">Lançar tempo à mão</p>

      <div className="flex flex-wrap gap-1.5">
        {ETAPAS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEtapa(e)}
            className={`btn btn-compacto ${
              etapa === e ? "btn-primario" : "btn-secundario"
            }`}
          >
            {ROTULO_ETAPA[e]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-28 flex-1 flex-col gap-1.5">
          <span className="rotulo-campo">Minutos</span>
          <input
            ref={campoMinutos}
            type="number"
            min={1}
            value={minutos}
            onChange={(e) => setMinutos(e.target.value)}
            // Enter salva: o gesto de quem lança três etapas seguidas.
            onKeyDown={(e) => {
              if (e.key === "Enter" && minutos) void salvar();
            }}
            className="campo"
          />
        </label>

        {etapa === "deslocamento" && (
          <label className="flex min-w-28 flex-1 flex-col gap-1.5">
            <span className="rotulo-campo">Km</span>
            <input
              inputMode="decimal"
              value={km}
              onChange={(e) => setKm(e.target.value)}
              className="campo"
            />
          </label>
        )}

        <button
          type="button"
          onClick={salvar}
          disabled={salvando || !minutos}
          className={`btn ${salvando ? "btn-carregando" : "btn-primario"}`}
        >
          {salvando && <Girando />}
          Lançar
        </button>
      </div>

      {erro && <p className="aviso aviso-erro text-sm">{erro}</p>}
    </div>
  );
}

function relogio(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  const dois = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${dois(m)}:${dois(seg)}` : `${dois(m)}:${dois(seg)}`;
}
