"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

/**
 * As duas calculadoras que destravam a Precificação.
 *
 * Custo por hora e custo por km não são números que alguém tenha na cabeça, e
 * um campo em branco pedindo "custo por hora" é um beco: quem não sabe calcular
 * fecha a tela e a feature inteira morre no primeiro uso. Então a conta mora
 * aqui dentro, com as perguntas que a pessoa **sabe** responder.
 *
 * As respostas ficam em `localStorage`, e não no banco, de propósito. O que o
 * negócio precisa guardar é o resultado — R$ 70 a hora —, e esse vai para
 * `org_ajustes`. As premissas que levaram até ele são rascunho de quem estava
 * fazendo a conta, e servem para a pessoa reabrir e lembrar como chegou lá.
 */

type Rascunho = Record<string, string>;

const PADRAO_HORA: Rascunho = { retirada: "", fixos: "", horas: "40" };
const PADRAO_KM: Rascunho = { consumo: "", litro: "", fator: "2" };

/**
 * O rascunho é lido do `localStorage` por `useSyncExternalStore`, e não copiado
 * para dentro por um efeito. O servidor recebe o padrão, o cliente recebe o que
 * está gravado, e não há um render intermediário com o valor errado.
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

function lerCru(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    // Aba anônima ou armazenamento bloqueado: a calculadora só não lembra.
    return null;
  }
}

function useRascunho(chave: string, padrao: Rascunho) {
  const bruto = useSyncExternalStore(
    assinar,
    useCallback(() => lerCru(chave), [chave]),
    () => null,
  );

  const valores = useMemo(() => {
    if (!bruto) return padrao;
    try {
      return { ...padrao, ...(JSON.parse(bruto) as Rascunho) };
    } catch {
      return padrao;
    }
  }, [bruto, padrao]);

  const mudar = useCallback(
    (campo: string, valor: string) => {
      try {
        localStorage.setItem(chave, JSON.stringify({ ...valores, [campo]: valor }));
      } catch {
        /* idem */
      }
      // `storage` não dispara na aba que escreveu.
      ouvintes.forEach((f) => f());
    },
    [chave, valores],
  );

  return [valores, mudar] as const;
}

function num(v: string): number {
  return Number(v.replace(/\./g, "").replace(",", ".")) || 0;
}

function reais(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * O que custa uma hora sua.
 *
 * Não é o que se cobra do cliente — é o que a hora custa ao negócio. Tudo que
 * precisa sair do mês, dividido pelas horas que cabem nele. A hora gasta
 * fazendo orçamento custa igual à hora na obra: ela consome o mesmo mês.
 */
export function CalculadoraDeHora({
  aoCalcular,
}: {
  aoCalcular: (valor: string) => void;
}) {
  const [v, mudar] = useRascunho("obranova_calc_hora", PADRAO_HORA);

  // 4,33 semanas por mês: 52 semanas em 12 meses. Usar 4 perde meia semana por
  // mês e infla o custo da hora em 8%.
  const horasMes = num(v.horas) * 4.33;
  const total = num(v.retirada) + num(v.fixos);
  const custo = horasMes > 0 ? total / horasMes : 0;

  return (
    <Caixa titulo="Calcular o custo da hora">
      <Pergunta
        rotulo="Quanto você precisa tirar por mês"
        ajuda="O seu pró-labore: o que precisa entrar na sua conta para o mês fechar."
        valor={v.retirada}
        aoMudar={(x) => mudar("retirada", x)}
      />
      <Pergunta
        rotulo="Custos fixos do negócio por mês"
        ajuda="Contador, celular, internet, softwares, seguro, aluguel — o que sai todo mês independente de ter obra."
        valor={v.fixos}
        aoMudar={(x) => mudar("fixos", x)}
      />
      <Pergunta
        rotulo="Horas de trabalho por semana"
        ajuda="As horas que você realmente trabalha, não as que gostaria."
        valor={v.horas}
        aoMudar={(x) => mudar("horas", x)}
      />

      <Resultado
        pronto={custo > 0}
        conta={`(${reais(num(v.retirada))} + ${reais(num(v.fixos))}) ÷ ${Math.round(horasMes)} h por mês`}
        valor={custo}
        unidade="por hora"
        aoUsar={() => aoCalcular(reais(custo))}
      />
    </Caixa>
  );
}

/**
 * O que custa um quilômetro.
 *
 * Combustível é a parte que todo mundo lembra e é menos da metade da conta:
 * pneu, óleo, revisão, freio e a desvalorização do carro custam por quilômetro
 * rodado tanto quanto a gasolina. Ignorar isso é subsidiar a visita com o
 * próprio carro e não perceber.
 */
export function CalculadoraDeKm({
  aoCalcular,
}: {
  aoCalcular: (valor: string) => void;
}) {
  const [v, mudar] = useRascunho("obranova_calc_km", PADRAO_KM);

  const combustivel = num(v.consumo) > 0 ? num(v.litro) / num(v.consumo) : 0;
  const custo = combustivel * (num(v.fator) || 1);

  return (
    <Caixa titulo="Calcular o custo do km">
      <Pergunta
        rotulo="Consumo do carro (km por litro)"
        ajuda="Quantos quilômetros o carro faz com um litro, na estrada e na cidade misturados."
        valor={v.consumo}
        aoMudar={(x) => mudar("consumo", x)}
      />
      <Pergunta
        rotulo="Preço do litro"
        ajuda="O que você paga hoje no posto."
        valor={v.litro}
        aoMudar={(x) => mudar("litro", x)}
      />
      <Pergunta
        rotulo="Multiplicador do desgaste"
        ajuda="2 é a regra de bolso: pneu, óleo, revisão e desvalorização custam por km mais ou menos o mesmo que o combustível. Use 1 se quiser contar só a gasolina."
        valor={v.fator}
        aoMudar={(x) => mudar("fator", x)}
      />

      <Resultado
        pronto={custo > 0}
        conta={
          combustivel > 0
            ? `${reais(num(v.litro))} ÷ ${v.consumo} km/l = ${reais(combustivel)} de combustível, × ${v.fator}`
            : ""
        }
        valor={custo}
        unidade="por km"
        aoUsar={() => aoCalcular(reais(custo))}
      />
    </Caixa>
  );
}

function Caixa({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);

  // Fechada, é um link — não uma barra da largura da tela. Uma caixa vazia
  // ocupando a linha inteira compete com o campo que ela existe para ajudar.
  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="self-start text-sm text-arroio-tinta underline underline-offset-4"
      >
        Não sei — me ajude a calcular
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-nevoa bg-papel px-4 py-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="rotulo">{titulo}</p>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="text-sm text-cinza underline underline-offset-4"
        >
          Fechar
        </button>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

function Pergunta({
  rotulo,
  ajuda,
  valor,
  aoMudar,
}: {
  rotulo: string;
  ajuda: string;
  valor: string;
  aoMudar: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <span className="rotulo-campo">{rotulo}</span>
        <input
          inputMode="decimal"
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          // Sem `name`: estes campos são rascunho da conta e não podem viajar
          // no formulário que salva as premissas.
          className="campo w-24 text-right tabular-nums"
        />
      </span>
      <span className="max-w-prose text-xs text-cinza">{ajuda}</span>
    </label>
  );
}

function Resultado({
  pronto,
  conta,
  valor,
  unidade,
  aoUsar,
}: {
  pronto: boolean;
  conta: string;
  valor: number;
  unidade: string;
  aoUsar: () => void;
}) {
  if (!pronto) {
    return (
      <p className="text-sm text-fumaca">
        Preencha os três campos e o valor aparece aqui.
      </p>
    );
  }

  return (
    <div className="border-t border-cinza-100 pt-3">
      {/* A conta aparece escrita: quem vê de onde saiu o número consegue
          discordar dele, e discordar com fundamento é o ponto. */}
      <p className="font-mono text-[0.65rem] tracking-wide text-cinza">{conta}</p>
      <p className="mt-1 font-sans text-2xl leading-none font-semibold -tracking-[0.03em] text-tinta tabular-nums">
        R$ {reais(valor)}{" "}
        <span className="text-sm font-normal text-cinza">{unidade}</span>
      </p>
      <button
        type="button"
        onClick={aoUsar}
        className="btn btn-secundario btn-compacto mt-3"
      >
        Usar este valor
      </button>
    </div>
  );
}
