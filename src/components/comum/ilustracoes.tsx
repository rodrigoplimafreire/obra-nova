"use client";

import { useId } from "react";

/**
 * As dez cenas de estado de tela — "Obra Nova Ilustrações v2".
 *
 * Traço de desenho técnico, não caricatura. As seis regras do documento de
 * identidade, que valem para qualquer cena nova:
 *
 * 1. **Duas espessuras.** 2,2 no contorno, 1,2 no detalhe. A hierarquia vem da
 *    espessura, nunca do tamanho.
 * 2. **Hachura, não mancha.** Volume se resolve com linhas a 45°, passo 7.
 *    Massa chapada só em peça de até 20px.
 * 3. **Tracejado é ausência.** A linha interrompida marca o que falta ou o que
 *    caiu. Nunca é decoração.
 * 4. **Canto vivo.** `stroke-linejoin: miter`. Curva só quando o objeto é
 *    curvo — lente, relógio, arco de sinal.
 * 5. **Cota e registro** fecham a composição. Uma de cada, no máximo.
 * 6. **Objeto no lugar de gente.** Estrutura, ferramenta e documento contam a
 *    história.
 *
 * **Como a cor funciona.** Nada aqui é colorido: o desenho é `currentColor` e
 * o miolo dos objetos é `var(--paper)`. Trocar as duas inverte a cena inteira,
 * hachura incluída — é por isso que a mesma ilustração serve sobre amarelo,
 * sobre grafite e sobre cal sem nenhuma variante de arquivo. Quem define o par
 * é o `<Cena>`.
 *
 * **Nunca use uma cena sem o `<Cena>` em volta.** O `brand.css` da RD, que o
 * documento do cliente carrega, declara `--paper: #F6F4EF` no `:root` para a
 * nota cor de creme — nome igual, significado outro. Uma cena solta dentro
 * daquela página herdaria o creme no miolo dos objetos. O `<Cena>` grava
 * `--paper` e `--bg` inline no elemento que envolve o SVG, e inline sempre
 * vence a variável do documento.
 *
 * **Por que isto é `"use client"` só para gerar um `id`.** `id` de SVG é global
 * ao documento, e `fill="url(#x)"` sempre resolve para a **primeira** definição
 * de `#x` na página. Com um id fixo por cena, repetir a mesma cena em dois
 * fundos diferentes fazia as duas usarem a hachura da primeira: medido no
 * navegador, a cena sobre grafite pintava a hachura em #14181A — preto sobre
 * preto, invisível — porque herdava o `currentColor` da cópia sobre amarelo.
 * `useId()` dá um id por instância e fecha esse buraco. O custo é o componente
 * virar cliente; como são SVG sem estado nem efeito, é só marcação, e vale o
 * preço de não ter uma classe inteira de bug silencioso.
 */

const SVG = {
  viewBox: "0 0 240 240",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round",
  strokeLinejoin: "miter",
  className: "block h-auto w-full",
} as const;

/** A hachura a 45°, passo 7 — o cinza do sistema, sem usar cinza. */
function Hachura({ id }: { id: string }) {
  return (
    <defs>
      <pattern
        id={id}
        width="7"
        height="7"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <path d="M0 0 V7" stroke="currentColor" strokeWidth={1.1} />
      </pattern>
    </defs>
  );
}

const PAPEL = "var(--paper, #FFFFFF)";
const FUNDO = "var(--bg, #F7E407)";

/** Login · acesso. Formulário sobre a mesa, com a chave chegando pela esquerda. */
export function CenaEntrar() {
  const h = useId();
  return (
    <svg {...SVG} aria-hidden>
      <Hachura id={h} />
      <rect x="52" y="52" width="136" height="136" fill={PAPEL} />
      <path d="M52 78 H188" />
      <rect x="60" y="61" width="7" height="7" strokeWidth={1.2} />
      <rect x="71" y="61" width="7" height="7" strokeWidth={1.2} />
      <rect x="82" y="61" width="7" height="7" strokeWidth={1.2} />
      <rect x="74" y="96" width="92" height="22" strokeWidth={1.6} />
      <path d="M84 107 H122" strokeWidth={1.2} />
      <rect x="74" y="126" width="92" height="22" strokeWidth={1.6} />
      <circle cx="85" cy="137" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="93" cy="137" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="101" cy="137" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="109" cy="137" r="2.2" fill="currentColor" stroke="none" />
      <rect x="74" y="158" width="92" height="22" fill={`url(#${h})`} />
      <circle cx="26" cy="137" r="11" />
      <circle cx="26" cy="137" r="4" strokeWidth={1.2} />
      <path d="M37 137 H74" />
      <path d="M56 137 V147 M64 137 V145" strokeWidth={1.6} />
      <path d="M52 202 H188 M52 197 v10 M188 197 v10" strokeWidth={1.2} />
      <path d="M198 60 h14 M205 53 v14" strokeWidth={1.2} />
    </svg>
  );
}

/** Erro 500 · indisponível. O telhado que desabou e a placa de alerta. */
export function CenaFalha() {
  const h = useId();
  return (
    <svg {...SVG} aria-hidden>
      <Hachura id={h} />
      <rect x="40" y="56" width="160" height="128" fill={PAPEL} />
      <path d="M40 80 H200" />
      <rect x="48" y="64" width="7" height="7" strokeWidth={1.2} />
      <rect x="59" y="64" width="7" height="7" strokeWidth={1.2} />
      <rect x="70" y="64" width="7" height="7" strokeWidth={1.2} />
      <path
        d="M120 100 L178 170 M120 100 V170"
        strokeWidth={1.2}
        strokeDasharray="5 5"
      />
      <path d="M62 170 L120 100" />
      <path d="M132 122 L178 170" />
      <path d="M120 100 l9 6 l-9 5 l9 6 l-6 5" strokeWidth={1.6} />
      <path d="M52 170 H188" />
      <path d="M52 176 H188" strokeWidth={1.2} strokeDasharray="4 4" />
      <path d="M176 34 L202 78 H150 Z" fill={`url(#${h})`} />
      <path d="M176 48 v14" strokeWidth={2} />
      <circle cx="176" cy="69" r="1.8" fill="currentColor" stroke="none" />
      <path d="M32 196 h14 M39 189 v14" strokeWidth={1.2} />
    </svg>
  );
}

/** 404 · página inexistente. A planta com um quadrante que não existe. */
export function CenaNaoEncontrado() {
  return (
    <svg {...SVG} aria-hidden>
      <rect x="44" y="46" width="152" height="140" fill={PAPEL} />
      <path
        d="M44 96 H196 M44 140 H196 M104 46 V186 M160 46 V186"
        strokeWidth={1.2}
      />
      <rect x="104" y="96" width="56" height="44" fill={FUNDO} stroke="none" />
      <rect
        x="104"
        y="96"
        width="56"
        height="44"
        strokeWidth={1.6}
        strokeDasharray="6 5"
      />
      <circle cx="150" cy="150" r="28" fill={PAPEL} />
      <circle cx="150" cy="150" r="21" strokeWidth={1.2} />
      <path d="M142 150 h16 M150 142 v16" strokeWidth={1.2} />
      <path d="M170 170 L196 196" strokeWidth={3.4} />
      <path d="M44 202 H196 M44 197 v10 M196 197 v10" strokeWidth={1.2} />
      <path d="M204 40 h14 M211 33 v14" strokeWidth={1.2} />
    </svg>
  );
}

/** Lista vazia · sem registros. A caçamba vazia sob as linhas do que caberia. */
export function CenaVazio() {
  return (
    <svg {...SVG} aria-hidden>
      <rect
        x="70"
        y="38"
        width="92"
        height="16"
        strokeWidth={1.4}
        strokeDasharray="6 5"
      />
      <rect
        x="80"
        y="62"
        width="72"
        height="16"
        strokeWidth={1.4}
        strokeDasharray="6 5"
      />
      <rect
        x="90"
        y="86"
        width="52"
        height="16"
        strokeWidth={1.4}
        strokeDasharray="6 5"
      />
      <path d="M60 148 H160 V190 H60 Z" fill={PAPEL} />
      <path d="M160 148 L192 124 V166 L160 190" fill={PAPEL} />
      <path d="M60 148 L92 124 H192 L160 148" fill={PAPEL} />
      <path d="M70 152 H150 L176 133 H96 Z" fill={PAPEL} strokeWidth={1.2} />
      <path
        d="M60 148 L70 152 M160 148 L150 152 M92 124 L96 133 M192 124 L176 133"
        strokeWidth={1.2}
      />
      <rect x="86" y="160" width="48" height="20" strokeWidth={1.4} />
      <path d="M94 170 H126" strokeWidth={1.2} />
      <path d="M40 202 H200 M40 197 v10 M200 197 v10" strokeWidth={1.2} />
      <path d="M32 60 h14 M39 53 v14" strokeWidth={1.2} />
    </svg>
  );
}

/** Busca · filtro sem retorno. A lupa sobre o grid, e a peça que não veio. */
export function CenaSemResultado() {
  const h = useId();
  return (
    <svg {...SVG} aria-hidden>
      <Hachura id={h} />
      <rect
        x="54"
        y="50"
        width="34"
        height="34"
        fill={`url(#${h})`}
        strokeWidth={1.6}
      />
      <rect x="94" y="50" width="34" height="34" strokeWidth={1.6} />
      <rect
        x="134"
        y="50"
        width="34"
        height="34"
        fill={`url(#${h})`}
        strokeWidth={1.6}
      />
      <rect x="54" y="90" width="34" height="34" strokeWidth={1.6} />
      <rect
        x="94"
        y="90"
        width="34"
        height="34"
        fill={`url(#${h})`}
        strokeWidth={1.6}
      />
      <rect x="134" y="90" width="34" height="34" strokeWidth={1.6} />
      <rect
        x="54"
        y="130"
        width="34"
        height="34"
        fill={`url(#${h})`}
        strokeWidth={1.6}
      />
      <rect x="94" y="130" width="34" height="34" strokeWidth={1.6} />
      <rect
        x="134"
        y="130"
        width="34"
        height="34"
        strokeWidth={1.6}
        strokeDasharray="6 5"
      />
      <circle cx="151" cy="147" r="32" fill={PAPEL} fillOpacity={0.92} />
      <circle cx="151" cy="147" r="24" strokeWidth={1.2} />
      <path d="M143 147 h16 M151 139 v16" strokeWidth={1.2} />
      <path d="M174 170 L198 194" strokeWidth={3.4} />
      <path d="M54 196 H168 M54 191 v10 M168 191 v10" strokeWidth={1.2} />
    </svg>
  );
}

/** Offline · sem conexão. A torre com o arco de sinal interrompido. */
export function CenaSemSinal() {
  const h = useId();
  return (
    <svg {...SVG} aria-hidden>
      <Hachura id={h} />
      <path d="M92 194 L114 74 M148 194 L126 74" />
      <path
        d="M96 170 H144 M101 146 H139 M105 122 H135 M110 98 H130"
        strokeWidth={1.6}
      />
      <path
        d="M96 170 L139 146 M144 170 L101 146 M101 146 L135 122 M139 146 L105 122 M105 122 L130 98 M135 122 L110 98"
        strokeWidth={1.2}
      />
      <path d="M120 74 V56" />
      <path d="M104 40 A20 20 0 0 0 104 66" strokeWidth={1.8} />
      <path d="M136 40 A20 20 0 0 1 136 66" strokeWidth={1.8} />
      <path
        d="M92 28 A34 34 0 0 0 92 78"
        strokeWidth={1.4}
        strokeDasharray="5 5"
      />
      <path
        d="M148 28 A34 34 0 0 1 148 78"
        strokeWidth={1.4}
        strokeDasharray="5 5"
      />
      <circle cx="120" cy="52" r="4" fill="currentColor" stroke="none" />
      <path d="M142 26 L172 60" strokeWidth={2.6} />
      <path d="M52 194 H188" />
      <rect
        x="52"
        y="194"
        width="136"
        height="12"
        fill={`url(#${h})`}
        stroke="none"
      />
      <path d="M186 96 h14 M193 89 v14" strokeWidth={1.2} />
    </svg>
  );
}

/** Permissão · 403. O tapume com o cadeado. */
export function CenaAcessoRestrito() {
  const h = useId();
  return (
    <svg {...SVG} aria-hidden>
      <Hachura id={h} />
      <rect x="48" y="72" width="20" height="112" fill={PAPEL} strokeWidth={1.8} />
      <rect
        x="72"
        y="72"
        width="20"
        height="112"
        fill={`url(#${h})`}
        strokeWidth={1.8}
      />
      <rect x="96" y="72" width="20" height="112" fill={PAPEL} strokeWidth={1.8} />
      <rect x="120" y="72" width="20" height="112" fill={PAPEL} strokeWidth={1.8} />
      <rect
        x="144"
        y="72"
        width="20"
        height="112"
        fill={`url(#${h})`}
        strokeWidth={1.8}
      />
      <rect x="168" y="72" width="20" height="112" fill={PAPEL} strokeWidth={1.8} />
      <path d="M48 164 L188 92" strokeWidth={1.2} />
      <path d="M104 118 v-12 a16 16 0 0 1 32 0 v12" strokeWidth={2.2} />
      <rect x="98" y="118" width="44" height="34" fill={PAPEL} />
      <circle cx="120" cy="131" r="3.4" strokeWidth={1.6} />
      <path d="M120 134 v7" strokeWidth={1.6} />
      <path d="M36 184 H200" />
      <path d="M36 196 H200" strokeWidth={1.2} strokeDasharray="5 5" />
      <path d="M196 46 h14 M203 39 v14" strokeWidth={1.2} />
    </svg>
  );
}

/** Sucesso · confirmação. O documento carimbado e o traço de envio. */
export function CenaEnviado() {
  const h = useId();
  return (
    <svg {...SVG} aria-hidden>
      <Hachura id={h} />
      <g transform="rotate(-3 104 120)">
        <rect x="48" y="50" width="112" height="140" fill={PAPEL} />
        <path
          d="M64 78 H144 M64 96 H132 M64 114 H148 M64 132 H120"
          strokeWidth={1.2}
        />
      </g>
      <circle cx="158" cy="158" r="28" fill={`url(#${h})`} />
      <circle cx="158" cy="158" r="21" strokeWidth={1.2} strokeDasharray="4 4" />
      <path d="M147 158 l8 9 l17 -20" strokeWidth={3} />
      <path
        d="M152 44 C178 22 204 26 212 46"
        strokeWidth={1.4}
        strokeDasharray="5 5"
      />
      <path d="M212 46 l-9 -3 M212 46 l-3 -9" strokeWidth={1.4} />
      <path d="M40 202 H176 M40 197 v10 M176 197 v10" strokeWidth={1.2} />
    </svg>
  );
}

/** Carregando · fila de envio. O guindaste com a carga no ar. */
export function CenaProcessando() {
  const h = useId();
  return (
    <svg {...SVG} aria-hidden>
      <Hachura id={h} />
      <path d="M66 190 V64 M78 190 V64" />
      <path
        d="M66 178 L78 160 M78 178 L66 160 M66 148 L78 130 M78 148 L66 130 M66 118 L78 100 M78 118 L66 100 M66 88 L78 70 M78 88 L66 70"
        strokeWidth={1.2}
      />
      <path d="M46 64 H190" />
      <path d="M46 64 L72 42 L166 62" strokeWidth={1.6} />
      <path d="M96 64 L108 46 M126 64 L138 48" strokeWidth={1.2} />
      <rect x="44" y="52" width="16" height="14" fill="currentColor" stroke="none" />
      <path d="M152 66 V108" />
      <rect x="136" y="108" width="32" height="30" fill={`url(#${h})`} />
      <path
        d="M176 122 A44 44 0 0 1 146 164"
        strokeWidth={1.4}
        strokeDasharray="5 5"
      />
      <path d="M146 164 l10 1 M146 164 l1 -10" strokeWidth={1.4} />
      <path d="M40 190 H200" />
      <path d="M52 202 H92" strokeWidth={4} />
      <path d="M96 202 H136" strokeWidth={4} strokeDasharray="4 6" />
    </svg>
  );
}

/** Tempo esgotado · reentrar. O relógio com a volta que não fechou. */
export function CenaSessaoExpirada() {
  const h = useId();
  return (
    <svg {...SVG} aria-hidden>
      <Hachura id={h} />
      <circle cx="120" cy="120" r="46" fill={PAPEL} />
      <path
        d="M120 120 L120 74 A46 46 0 0 1 166 120 Z"
        fill={`url(#${h})`}
        strokeWidth={1.2}
      />
      <circle cx="120" cy="120" r="38" strokeWidth={1.2} />
      <path
        d="M120 82 v8 M158 120 h-8 M120 158 v-8 M82 120 h8"
        strokeWidth={1.6}
      />
      <path d="M120 120 V94" strokeWidth={2.6} />
      <path d="M120 120 L142 130" strokeWidth={2.6} />
      <circle cx="120" cy="120" r="3.4" fill="currentColor" stroke="none" />
      <path
        d="M120 58 A62 62 0 1 1 58 120"
        strokeWidth={1.4}
        strokeDasharray="6 5"
      />
      <path d="M58 120 l-6 -9 M58 120 l9 -6" strokeWidth={1.4} />
      <path d="M74 196 H166 M74 191 v10 M166 191 v10" strokeWidth={1.2} />
      <path d="M196 60 h14 M203 53 v14" strokeWidth={1.2} />
    </svg>
  );
}
