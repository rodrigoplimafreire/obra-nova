# Histórico da importação do rd-propostas

Em 27/08/2026 as propostas estáticas de `rd-propostas` foram importadas para o
Obra Nova. O importador registrou o que fez no campo `observacoes` de cada
orçamento — e esse foi o erro: `observacoes` **vai no documento do cliente**,
na seção "O que vale saber", e não é bloco de recado interno. Oito propostas
ficaram mostrando ao cliente a nota de importação, com o nome do Rodrigo e
nomes de coluna entre acentos graves.

Em 10/10/2026 as oito foram limpas e republicadas. As notas ficam aqui, na
íntegra, porque duas delas guardam decisões e pendências que não estão em
nenhum outro lugar.

---

## Sr. Rafael

> Importado de rd-propostas/rafael em 27/08/2026.
>
> Os seis itens somam R$ 17.323,57, mas a barra de total do documento entregue
> diz R$ 17.323,25 — parece dígito trocado. Rodrigo escolheu o valor que o
> cliente recebeu (27/08/2026). Os itens entram como estão: nenhum preço de
> linha foi mexido para fechar a conta, e o valor combinado fica em
> `valor_fechado`.

Obsoleto: o escopo foi refeito duas vezes depois disso, e hoje a proposta tem
oito itens e R$ 12.611,47, com o total saindo da soma da tabela.

## Sr. Livônio

> Importado de rd-propostas/livonio em 27/08/2026.
>
> Atualizado em 27/08/2026: Reginato revisou o escopo (o.tel envio direto).
> Área caiu de 72,35 m² para 31,00 m², e o valor de R$ 85.500,00 para
> R$ 24.325,00. Escopo mudou de acréscimo de pavimento completo (com alvenaria)
> para reforço estrutural (sapatas, pilares, vigas, laje) com reinstalação do
> telhado e forro existentes, não construção de novos. A proposta publicada em
> orcamentos.rd.eng.br/livonio ainda mostra o escopo e valor antigos —
> narrativa (hero, cronograma de 16 semanas, premissas com estimativa de
> materiais) não foi reescrita até confirmar com o Rodrigo.

**Resolvido em 10/10/2026.** A pendência era real: a apresentação e os três
cards do projeto descreviam 70 m², dez sapatas, duas lajes, alvenaria nova e
telhado colonial novo, enquanto a planilha revisada traz 31 m², oito sapatas,
uma laje e a *reinstalação* do telhado existente. A narrativa prometia mais do
que a tabela cobra. Foi reescrita a partir da planilha, item por item, por
`scripts/narrativa-do-livonio.ts`, e o documento ganhou uma observação dizendo
o que **não** está incluído. Nenhum preço foi tocado.

## Jeová Filho

> Completado a partir de rd-propostas/jeova-filho em 27/08/2026: faltavam a
> pintura e a limpeza pós-obra. A proposta original oferecia duas opções —
> Drywall (R$ 3.249,60) e Bloco (R$ 3.897,60). Aqui está só a de Drywall, por
> decisão do Rodrigo; a alternativa em Bloco segue apenas no HTML.

Resolvido depois: o documento ganhou as abas de opção, e as duas alternativas
convivem na proposta.

## As outras cinco

Sem conteúdo além da linha de importação:

- **Sr. Helano** — "Importado de rd-propostas/helano em 27/08/2026."
- **Shopping Meirelles** — "Importado de rd-propostas/shopping-meirelles em 27/08/2026."
- **Gabriel Fernandes** — "Importado de rd-propostas/gabriel-fernandes em 27/08/2026."
- **Amanda e Diego** — "Importado de rd-propostas/amanda-diego em 27/08/2026."
- **Sr. Erivando** — "Importado de rd-propostas/erivando em 27/08/2026."

---

## O que isto deixa como regra

`observacoes`, `apresentacao`, `intro_custos` e `nota_custos` são **campos do
cliente**. Nota de processo, decisão interna e pendência de revisão não entram
em nenhum deles — vão para um commit, para este arquivo ou para `orc_eventos`.
