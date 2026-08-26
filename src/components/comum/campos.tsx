"use client";

import { useState } from "react";
import { lerNumero } from "@/lib/orcamento/formato";

/**
 * Campos com máscara.
 *
 * A máscara é só apresentação: o que trafega no `FormData` é o texto formatado,
 * e quem interpreta do outro lado é o `lerNumero()` do servidor — que já sabe
 * ler "R$ 1.234,56", "1234.56" e "1.234,56" pela regra do último separador.
 * Não existe campo escondido com o valor cru, de propósito: dois valores para
 * o mesmo dado é uma chance de eles divergirem.
 *
 * Todos formatam ao digitar, não ao sair do campo. Ver o "R$" e a vírgula
 * aparecerem enquanto se digita é o que evita a dúvida de "escrevi centavos ou
 * reais?" — e essa dúvida, num orçamento, custa caro.
 */

/** Só os dígitos, para a máscara reconstruir do zero a cada tecla. */
function digitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/**
 * Dinheiro, no jeito que o caixa eletrônico faz: os dígitos entram pela
 * direita e a vírgula anda sozinha. Digitar "1", "2", "3" vira R$ 1,23.
 *
 * É o único comportamento que não exige da pessoa saber onde a vírgula fica —
 * ela nunca precisa digitá-la.
 */
export function formatarMoeda(bruto: string): string {
  const d = digitos(bruto).slice(0, 12);
  if (!d) return "";
  const centavos = Number(d) / 100;
  return centavos.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Quantidade: aceita vírgula digitada, porque aqui a pessoa pensa em "80" e
 * não em "8000 centésimos". Máscara de dinheiro seria hostil para medida.
 */
export function formatarQuantidade(bruto: string): string {
  const limpo = bruto.replace(/[^\d,]/g, "");
  const [inteiro, ...resto] = limpo.split(",");
  const decimais = resto.join("").slice(0, 3);
  const comMilhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (resto.length === 0) return comMilhar;
  return `${comMilhar},${decimais}`;
}

/** Percentual: número com até uma casa e o símbolo à direita. */
export function formatarPercentual(bruto: string): string {
  const limpo = bruto.replace(/[^\d,]/g, "");
  if (!limpo) return "";
  const [inteiro, ...resto] = limpo.split(",");
  const cortado = inteiro.slice(0, 3);
  if (resto.length === 0) return `${cortado}%`;
  return `${cortado},${resto.join("").slice(0, 1)}%`;
}

/**
 * Telefone brasileiro, fixo ou celular. A máscara segue a contagem de dígitos:
 * abre parêntese no DDD, e o hífen entra na posição certa para 8 ou 9 dígitos.
 */
export function formatarTelefone(bruto: string): string {
  const d = digitos(bruto).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * CNPJ ou CPF, decidido pela contagem de dígitos.
 *
 * Os dois no mesmo campo porque empreiteira pequena às vezes fatura como
 * pessoa física, e obrigar a escolher o tipo antes de digitar é uma pergunta
 * que a própria contagem responde: até 11 dígitos é CPF, acima é CNPJ.
 */
export function formatarDocumento(bruto: string): string {
  const d = digitos(bruto).slice(0, 14);
  if (d.length === 0) return "";

  if (d.length <= 11) {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }

  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/**
 * Exibir o que veio do banco é outro problema que formatar o que se digita.
 *
 * A máscara de dinheiro empurra dígitos pela direita: `18.5` guardado passaria
 * por ela e viraria R$ 1,85. Por isso todo campo tem duas funções — uma para a
 * tecla, outra para o valor que já existe.
 */
function exibirMoeda(valor: string | number): string {
  const n = typeof valor === "number" ? valor : lerNumero(valor);
  if (n === null) return "";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function exibirQuantidade(valor: string | number): string {
  const n = typeof valor === "number" ? valor : lerNumero(valor);
  if (n === null) return "";
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

function exibirPercentual(valor: string | number): string {
  const n = typeof valor === "number" ? valor : lerNumero(valor);
  if (n === null) return "";
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

type PropsBase = {
  nome: string;
  valorInicial?: string | number | null;
  placeholder?: string;
  obrigatorio?: boolean;
  className?: string;
  aoMudar?: (bruto: string) => void;
};

function CampoMascarado({
  nome,
  valorInicial,
  placeholder,
  obrigatorio,
  className = "campo",
  formatar,
  exibir,
  aoMudar,
  ...resto
}: PropsBase & {
  /** Aplicada a cada tecla. */
  formatar: (bruto: string) => string;
  /** Aplicada uma vez, ao valor que veio do banco. */
  exibir: (valor: string | number) => string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const [valor, setValor] = useState(() =>
    valorInicial === null || valorInicial === undefined || valorInicial === ""
      ? ""
      : exibir(valorInicial),
  );

  return (
    <input
      {...resto}
      name={nome}
      value={valor}
      onChange={(e) => {
        const novo = formatar(e.target.value);
        setValor(novo);
        aoMudar?.(novo);
      }}
      placeholder={placeholder}
      required={obrigatorio}
      // `decimal` traz o teclado numérico com vírgula no celular; `numeric`
      // traria só dígitos e a pessoa não conseguiria digitar centavos onde a
      // máscara não os insere sozinha.
      inputMode="decimal"
      autoComplete="off"
      className={className}
    />
  );
}

export function CampoDeMoeda(props: PropsBase) {
  return (
    <CampoMascarado {...props} formatar={formatarMoeda} exibir={exibirMoeda} />
  );
}

export function CampoDeQuantidade(props: PropsBase) {
  return (
    <CampoMascarado
      {...props}
      formatar={formatarQuantidade}
      exibir={exibirQuantidade}
    />
  );
}

export function CampoDePercentual(props: PropsBase) {
  return (
    <CampoMascarado
      {...props}
      formatar={formatarPercentual}
      exibir={exibirPercentual}
    />
  );
}

export function CampoDeTelefone(props: PropsBase) {
  return (
    <CampoMascarado
      {...props}
      formatar={formatarTelefone}
      exibir={(v) => formatarTelefone(String(v))}
      inputMode="tel"
      autoComplete="tel"
    />
  );
}

export function CampoDeDocumento(props: PropsBase) {
  return (
    <CampoMascarado
      {...props}
      formatar={formatarDocumento}
      exibir={(v) => formatarDocumento(String(v))}
      inputMode="numeric"
    />
  );
}

/**
 * O valor numérico de um campo mascarado, para contas ao vivo na tela.
 * Reusa o mesmo parser do servidor: se os dois divergissem, a margem mostrada
 * enquanto se digita não bateria com a que é gravada.
 */
export function valorDoCampo(mascarado: string): number | null {
  return lerNumero(mascarado);
}
