/**
 * Os modos de medição da visita.
 *
 * Substitui a decisão D3 do `PRD-VISTORIA.md` — "que linguagem tem a fórmula" —
 * por uma resposta mais barata: **não tem linguagem**. São sete modos fechados,
 * cada um com os campos que ele pede e a conta que ele faz. Quem mede uma
 * parede escolhe "Parede" e vê comprimento e altura; não vê largura, não
 * escreve fórmula, não decide nada.
 *
 * O ganho não é de tela, é de erro: `areaDe` antes adivinhava a intenção pela
 * ausência de campo (tinha largura? é piso; só altura? é parede), e adivinhar
 * dá errado justamente no caso ambíguo — o cômodo em que se mede piso e parede.
 *
 * **Fora de `server-only` de propósito:** a tela da visita é componente de
 * cliente e precisa calcular enquanto se digita, sem ida ao servidor. Mesma
 * razão de `constantes.ts`.
 *
 * ## Por que nenhuma coluna nova
 *
 * O modo **não é gravado**. Ele é deduzido do que está no banco por
 * `modoDe()`, e a dedução é possível porque cada modo preenche uma combinação
 * distinta de campos. Isso mantém a entrega inteira sem migração — e a §0.3
 * do `PRD-UX-VISTORIAS.md` registra por que mexer no schema de produção é
 * decisão à parte, do Rodrigo.
 *
 * O desconto de vãos também não tem coluna, e também não precisa: num item de
 * parede, `comprimento × altura` é a área bruta e `quantidade` é a líquida, de
 * modo que a diferença entre as duas **é** o desconto. Guardar o número
 * separado seria guardar o mesmo dado duas vezes, que é como as duas versões
 * divergem.
 */

import { paraCampo } from "@/lib/orcamento/formato";
import type { Medicao } from "./constantes";

export type Modo =
  | "quantidade"
  | "piso"
  | "parede"
  | "linear"
  | "volume"
  | "contagem"
  | "verba";

export type Campo = "comprimento" | "largura" | "altura" | "desconto";

type Definicao = {
  /** O que aparece na pastilha. Uma palavra, para caber no celular. */
  rotulo: string;
  /** A frase que explica o que está sendo medido, na folha aberta. */
  ajuda: string;
  campos: Campo[];
  /** A unidade que o modo impõe. `null` = quem escolhe é a pessoa. */
  unidade: string | null;
  /** Como a conta se lê, para aparecer ao lado do resultado. */
  conta: string | null;
};

export const MODOS: Record<Modo, Definicao> = {
  piso: {
    rotulo: "Piso",
    ajuda: "Área de piso ou teto: o retângulo do chão.",
    campos: ["comprimento", "largura"],
    unidade: "m²",
    conta: "comprimento × largura",
  },
  parede: {
    rotulo: "Parede",
    ajuda:
      "Área de uma parede. O desconto tira porta e janela, em m², e é opcional.",
    campos: ["comprimento", "altura", "desconto"],
    unidade: "m²",
    conta: "comprimento × altura − desconto",
  },
  linear: {
    rotulo: "Metro",
    ajuda: "Comprimento corrido: rodapé, bancada, tubulação.",
    campos: ["comprimento"],
    unidade: "m",
    conta: null,
  },
  volume: {
    rotulo: "Volume",
    ajuda: "Volume: contrapiso, aterro, concreto.",
    campos: ["comprimento", "largura", "altura"],
    unidade: "m³",
    conta: "comprimento × largura × altura",
  },
  contagem: {
    rotulo: "Contagem",
    ajuda: "Quantas peças: pontos de luz, louças, portas.",
    campos: [],
    unidade: "un",
    conta: null,
  },
  quantidade: {
    rotulo: "Quantidade",
    ajuda: "Você já sabe o número. Digite a quantidade e escolha a unidade.",
    campos: [],
    unidade: null,
    conta: null,
  },
  verba: {
    rotulo: "Serviço completo",
    ajuda:
      "Cobrança fechada pelo serviço inteiro, sem medir. Entra como 1 vb.",
    campos: [],
    unidade: "vb",
    conta: null,
  },
};

/** A ordem das pastilhas: o que mais se mede em obra primeiro. */
export const ORDEM_DOS_MODOS: Modo[] = [
  "piso",
  "parede",
  "linear",
  "volume",
  "contagem",
  "quantidade",
  "verba",
];

/** O modo calcula a quantidade sozinho? Se sim, o campo vira só leitura. */
export function calculado(modo: Modo): boolean {
  return MODOS[modo].campos.some((c) => c !== "desconto");
}

export type Dimensoes = {
  comprimento: number | null;
  largura: number | null;
  altura: number | null;
  desconto: number | null;
};

/**
 * Um serviço proposto pela escuta, antes de virar linha no banco.
 *
 * Mora aqui, e não junto do prompt em `itens-da-voz.ts`, porque a tela de
 * conferência é componente de cliente. Importar o tipo de um módulo
 * `server-only` arrastaria `supabaseAdmin` para o bundle do navegador — o
 * `tsc` não vê essa fronteira, só o build acusa. É a mesma razão de
 * `transcricao/tipos.ts` existir separado de `transcricao/avulsas.ts`.
 */
export type ItemDaVoz = {
  servico: string;
  modo: Modo;
  comprimento: number | null;
  largura: number | null;
  altura: number | null;
  quantidade: number | null;
  unidade: string | null;
};

/**
 * A quantidade que o modo produz, ou `null` enquanto falta medida.
 *
 * **Nunca devolve zero por falta de dado.** Zero é um número que alguém
 * informou; ausência é ausência, e a tela diz o que falta em vez de mostrar
 * "0,00" — que pareceria medida tirada e valeria linha em branco no orçamento.
 */
export function calcular(modo: Modo, d: Dimensoes): number | null {
  const { comprimento: c, largura: l, altura: a, desconto } = d;

  let bruto: number | null = null;
  switch (modo) {
    case "piso":
      bruto = c !== null && l !== null ? c * l : null;
      break;
    case "parede":
      bruto = c !== null && a !== null ? c * a - (desconto ?? 0) : null;
      break;
    case "linear":
      bruto = c;
      break;
    case "volume":
      bruto = c !== null && l !== null && a !== null ? c * l * a : null;
      break;
    default:
      return null;
  }

  if (bruto === null || !Number.isFinite(bruto)) return null;
  // Resultado negativo ou nulo significa desconto maior que a parede. É erro
  // de digitação, e a tela cobra revisão em vez de gravar um número impossível.
  if (bruto <= 0) return null;
  return Math.round(bruto * 100) / 100;
}

/** A área bruta, antes do desconto — o "de" do "de 11,2 tira 2". */
export function bruta(modo: Modo, d: Dimensoes): number | null {
  if (modo !== "parede") return null;
  if (d.comprimento === null || d.altura === null) return null;
  const v = d.comprimento * d.altura;
  return v > 0 ? Math.round(v * 100) / 100 : null;
}

/**
 * O que ainda falta para o modo fechar a conta, em português.
 *
 * Existe para a folha nunca mostrar resultado vazio sem dizer por quê: campo
 * em branco com traço ao lado parece tela quebrada.
 */
export function faltaPara(modo: Modo, d: Dimensoes): string | null {
  const nomes: Record<Campo, string> = {
    comprimento: "o comprimento",
    largura: "a largura",
    altura: "a altura",
    desconto: "o desconto",
  };
  const faltando = MODOS[modo].campos
    .filter((campo) => campo !== "desconto" && d[campo] === null)
    .map((campo) => nomes[campo]);

  if (faltando.length === 0) return null;
  if (faltando.length === 1) return `Preencha ${faltando[0]} para calcular.`;
  return `Preencha ${faltando.slice(0, -1).join(", ")} e ${faltando.at(-1)} para calcular.`;
}

/**
 * De volta do banco para o modo, sem coluna que diga qual era.
 *
 * A ordem dos testes importa: volume antes de piso, porque volume também tem
 * comprimento e largura. Um registro gravado antes desta tela cai em
 * `quantidade` ou no modo que suas dimensões descrevem — em nenhum caso o
 * número muda, que é a regra do `PRD-UX-VISTORIAS.md` sobre histórico.
 */
export function modoDe(m: Medicao): Modo {
  const { comprimento: c, largura: l, altura: a } = m;
  const semDimensao = c === null && l === null && a === null;

  if (semDimensao) {
    if (m.unidade === "vb") return "verba";
    if (m.unidade === "un") return "contagem";
    return "quantidade";
  }
  if (c !== null && l !== null && a !== null) return "volume";
  if (c !== null && l !== null) return "piso";
  if (c !== null && a !== null) return "parede";
  if (c !== null && m.unidade === "m") return "linear";
  return "quantidade";
}

/**
 * O desconto de vãos, deduzido da diferença entre área bruta e quantidade.
 *
 * Só faz sentido em parede, e só quando a quantidade gravada é menor que a
 * área cheia — se for igual, não houve desconto; se for maior, alguém digitou
 * a quantidade à mão por cima e o desconto não é o que explica a diferença.
 */
export function descontoDe(m: Medicao): number | null {
  if (modoDe(m) !== "parede") return null;
  if (m.comprimento === null || m.altura === null || m.quantidade === null) {
    return null;
  }
  const cheia = m.comprimento * m.altura;
  const diferenca = Math.round((cheia - m.quantidade) * 100) / 100;
  return diferenca > 0 ? diferenca : null;
}

/** O estado inicial da folha, para um item que já existe ou para um novo. */
export function estadoInicial(m: Medicao | null): {
  modo: Modo;
  comprimento: string;
  largura: string;
  altura: string;
  desconto: string;
  quantidade: string;
  unidade: string;
} {
  const modo = m ? modoDe(m) : "piso";
  return {
    modo,
    comprimento: m ? paraCampo(m.comprimento) : "",
    largura: m ? paraCampo(m.largura) : "",
    altura: m ? paraCampo(m.altura) : "",
    desconto: m ? paraCampo(descontoDe(m)) : "",
    quantidade: m ? paraCampo(m.quantidade) : "",
    unidade: m?.unidade ?? MODOS[modo].unidade ?? "",
  };
}

/**
 * O resumo de uma linha: a quantidade primeiro, as medidas como prova.
 *
 * "12 m² · 4,00 × 3,00" — quem confere o orçamento quer o número que vai para
 * a planilha; quem confere a visita quer de onde ele saiu.
 */
export function resumoDaMedida(
  m: Medicao,
  fmt: (v: number | null) => string,
): string | null {
  const dimensoes = [m.comprimento, m.largura, m.altura]
    .filter((v): v is number => v !== null)
    .map(fmt);

  const qtd =
    m.quantidade !== null ? `${fmt(m.quantidade)} ${m.unidade ?? ""}`.trim() : null;

  const partes = [qtd, dimensoes.length > 1 ? dimensoes.join(" × ") : null];
  const texto = partes.filter(Boolean).join(" · ");
  return texto || null;
}
