/**
 * A colagem entende o material cru do cliente?
 *
 * Os dois textos abaixo são os que o Rodrigo mandou de verdade em 28/08/2026,
 * copiados sem tocar — inclusive os erros de digitação ("Reinstalções",
 * "pacaviras") e a bagunça de numeração. É esse material que a tela vai
 * receber, então é com ele que a extração tem que ser conferida, não com um
 * exemplo limpo que eu escreveria para passar.
 *
 * O script não grava nada. Ele imprime o que a IA entendeu e confere as somas
 * contra os valores que o Rodrigo já validou à mão.
 *
 * Rodar:  npm run verificar:colagem
 */

import { config } from "dotenv";
import { lerColagem, sugerirSlug } from "@/lib/orcamento/colagem";

config({ path: ".env.local" });

const CASOS = [
  {
    nome: "Garagem Santa Terezinha",
    esperado: { cliente: /santa terezinha/i, slug: "santaterezinha", total: 14418 },
    texto: `Orçamento de muro de 12.00 metros de comprimento por 3.50 metros de altura.

Cliente: garagem Santa Terezinha
Endereço: rua Alves ribeiro n530
Bairro: Messejana
Cidade: fortaleza

Serviço a serem executados.

1-Demolição.
1.1. Demolição de 28.00m2 de muro existente.
1.2. Retirada de entulho e descarte.

2- fundações.
2.1. Escavação de 12.00 metros linear de vigas baldrame de 0.20cm espessura por 0.25cm de profundidade (duas fiadas de tijolo deitado argamassado + formas de madeira +armadura de aço + concretagem).
2.2. Escavação de 5 buracos para brocas de fundação de 1.50m de profundidade por 0.25cm de circunferência (forma de madeira + armadura de aço + concretagem).

3- ALVENARIA E ESTRUTURA.
3.1. Construção de 42.00 m2 de alvenaria com 5 Pilar de 3.50mx0.25x0.15 e 2 cintas de amarração de 12.00x0.15 (blocos de tijolo furado + formas de madeira + armadura de aço + concretagem).
3.2. Limpeza pós obra.

Valor total da mão de obra: 8.700,00

Lista de material.
1- 5 armadura de aço para os pilar de 5.00x0.20x0.10.
2- 2 armadura de aço para a viga baldrame de 6.00x0.20x0.10.
3- 4 armadura de aço para as cintas de amarração de 6.00x0.15x0.10.
4- 2 1/2m3 de areia grossa.
5- 2 m3 de brita 1.
6- 20 sacos de cimento de 50kg CPlll.
7- 1m3 de arisco.
8- 1 balde de aditivo de 18 litros.
9- 8 tábuas de pinos de 300x30.
10- pregos com cabeça 18/27.

Valor de material: R$ 5.718,00`,
  },
  {
    nome: "Sr. Paulo Roberto",
    esperado: { cliente: /paulo roberto/i, slug: "pauloroberto", total: 10102 },
    texto: `Orçamento de gesso drywall e pintura.

Cliente: Sr. Paulo Roberto
Endereço: rua alameda das pacaviras, n249
Bairro: cidade 2000
Cidade: fortaleza

Tipos de serviços: gesso drywall e pintura.

1-gesso drywall.
1.1 Instalação de 27.90 M2 de forro em gesso drywall.
1.2 aplicação de 94.01 m2 em gesso liso nas paredes internas para correção das paredes (paredes com reboco imperfeitas).

Gesso: R$ 4.530,00

Obs: gesso incluso material e mão de obra.

2- pintura.
2.1 aplicação de 94,01 metros quadrado de massa corrida nas parede interna.
2.2 aplicação de 94.01 m2 de fundo preparador nas paredes para receber gesso liso e massa corrida.
2.3 pintura de 27.90 metros quadrado de forro.
2.4 pintura de 94.01 m2 de paredes internas.
2.5 pintura de 22.76 metros quadrado de fachada.
2.6 pintura de 7.99 metros quadrado de parede da escada.
2.7 limpeza pós obra.

Pintura: R$ 5.572,00`,
  },
  {
    nome: "Tabela em Markdown (o caminho do Gemini)",
    esperado: { cliente: /marcos/i, slug: "marcosvieira", total: 6800 },
    texto: `Cliente: Marcos Vieira
Endereço: Rua das Flores, 88 - Aldeota, Fortaleza

## Mão de obra

| Item | Descrição | Qtd | Unid. |
|---|---|---|---|
| 1.1 | Demolição de piso cerâmico | 45,00 | m² |
| 1.2 | Regularização de contrapiso | 45,00 | m² |
| 1.3 | Assentamento de porcelanato | 45,00 | m² |

**Valor total da mão de obra: R$ 6.800,00**`,
  },
];

function moeda(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function main() {
  let falhas = 0;

  // A conta Groq e de 8.000 tokens/minuto: tres casos seguidos estouram.
  // O app tem repeticao com espera; aqui a pausa e explicita para o teste
  // medir a extracao, e nao a cota.
  const esperaEntreCasos = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let primeiro = true;

  for (const caso of CASOS) {
    if (!primeiro) await esperaEntreCasos(65_000);
    primeiro = false;

    console.log(`\n${"=".repeat(60)}\n${caso.nome}\n${"=".repeat(60)}`);

    const saida = await lerColagem(caso.texto);
    if (!saida.ok) {
      console.log(`FALHOU — ${saida.erro}`);
      falhas++;
      continue;
    }

    const c = saida.colagem;
    const total = c.itens.reduce(
      (s, i) => s + (i.valorUnitario ?? 0) * (i.quantidade ?? 1),
      0,
    );
    const slug = c.cliente ? sugerirSlug(c.cliente) : "(sem cliente)";

    console.log(`cliente:  ${c.cliente ?? "(null)"}`);
    console.log(`slug:     ${slug}`);
    console.log(`endereço: ${c.endereco ?? "(null)"}`);
    console.log(`objeto:   ${c.objeto ?? "(null)"}`);
    console.log(`prazo:    ${c.prazo ?? "(null)"}`);
    console.log(`entrada:  ${c.entradaPercentual ?? "(null)"}`);
    console.log(`\nitens (${c.itens.length}):`);

    let grupo: string | null = null;
    for (const i of c.itens) {
      if (i.grupo !== grupo) {
        grupo = i.grupo;
        console.log(`  [${grupo ?? "sem grupo"}]`);
      }
      const qtd = i.quantidade !== null ? `${i.quantidade} ${i.unidade ?? ""}` : "—";
      const val = i.valorUnitario !== null ? moeda(i.valorUnitario) : "—";
      console.log(`    ${i.descricao.slice(0, 62).padEnd(64)} ${qtd.padEnd(12)} ${val}`);
    }

    console.log(`\nsoma: ${moeda(total)} · esperado: ${moeda(caso.esperado.total)}`);

    const conferir = (nome: string, ok: boolean) => {
      console.log(`  ${ok ? "ok    " : "FALHOU"}  ${nome}`);
      if (!ok) falhas++;
    };

    conferir("cliente reconhecido", Boolean(c.cliente && caso.esperado.cliente.test(c.cliente)));
    conferir(`slug = ${caso.esperado.slug}`, slug === caso.esperado.slug);
    conferir("endereço extraído", Boolean(c.endereco));
    conferir("objeto extraído", Boolean(c.objeto));
    conferir("soma bate com o total validado à mão", Math.abs(total - caso.esperado.total) < 0.01);
    conferir("não inventou prazo", c.prazo === null);
    conferir("não inventou parcela", c.entradaPercentual === null);

    if (c.duvidas.length) {
      console.log("\n  dúvidas que a IA levantou:");
      for (const d of c.duvidas) console.log(`    · ${d}`);
    }
  }

  console.log(falhas === 0 ? "\nTudo certo." : `\n${falhas} verificação(ões) falharam.`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
