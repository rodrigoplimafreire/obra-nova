# Estrutura canônica da proposta comercial

Todo orçamento que o Obra Nova gera para o cliente final sai **nesta ordem, com
estas sete seções**. Definido pelo Rodrigo em 09/09/2026, a partir do modelo em
PDF da RD Engenharia. Não é sugestão: é o formato do produto, do mesmo jeito
que o LP Factory tem arquétipos.

O documento é um **contrato**, não uma tabela de preços. Quem abre o link vai
imprimir, assinar e guardar.

---

## 1 · Apresentação & escopo dos serviços

Um parágrafo, no máximo. Diz:

- o local da reforma (a residência, a sala comercial, o galpão)
- o endereço
- o que o escopo compreende, em traços largos

Não repete a planilha. É o resumo que alguém leria em voz alta ao telefone.

## 2 · Resumo orçamentário por módulo

Tabela das macroetapas com o prazo previsto de cada uma.

Quando houver valor de mão de obra por módulo, ou o percentual que cada módulo
representa do total, **entram nas colunas**. Quando não houver — que é o caso
comum, porque o Reginato passa o preço fechado — a tabela sai só com macroetapa
e prazo. Uma coluna de valores vazia é pior que coluna nenhuma.

## 3 · Planilha orçamentária discriminada por item

**Item por item.** Nunca agrupado em blocos. Já houve correção sobre isso: o
cliente precisa conseguir apontar a linha e perguntar "o que é isto".

Cada linha leva o que existir: quantitativo, unidade, medição, preço unitário e
subtotal. E subtotal por disciplina ao fim de cada grupo.

Quando faltar quantidade ou preço unitário de um item, a linha entra assim
mesmo, descrevendo o serviço, e o valor fica no fechamento do grupo. O que não
pode é a IA inventar número: **preço nunca é estimado**, sempre vem do
Reginato.

## 4 · Cronograma executivo físico-financeiro

Planejamento em semanas, com as metas físicas e financeiras por disciplina.
Deixa explícitos os marcos semanais, o caminho crítico e o que roda em
paralelo.

Tabela **e** uma leitura visual. O cliente que vai assinar não lê diagrama de
Gantt; precisa enxergar "na semana 3 o banheiro está pronto e eu pago a segunda
medição" sem esforço.

## 5 · Diretrizes técnicas & normas aplicáveis

Declara que os serviços seguem as normas técnicas brasileiras (ABNT NBR),
assegurando solidez, estanqueidade e durabilidade. Cita as normas das
disciplinas presentes no escopo — reforma, gesso, revestimento,
impermeabilização, instalação elétrica e hidrossanitária.

## 6 · Condições comerciais, forma de pagamento & garantias

**Forma de pagamento**, ajustada ao porte do orçamento. O desenho usual:

1. entrada, para a mobilização
2. primeira medição
3. segunda (e terceira, se houver) medição
4. saldo final na entrega

**Prazos e condições:** em semanas e em dias — corridos e úteis, os dois.

**Horário de trabalho.**

**Validade da proposta:** em torno de 20 dias.

**Garantias legais e responsabilidade técnica:**

- **5 anos** de solidez e estabilidade estrutural e de alvenaria — Art. 618 do
  Código Civil, que é piso legal e não concessão da empreiteira
- **1 ano** para acabamentos, instalações hidráulicas, elétricas e
  impermeabilizações
- emissão de **ART/RRT** quando necessário, junto ao conselho de classe

## 7 · Assinaturas

Duas, lado a lado, e as duas linhas nascem **vazias** — é para assinar à mão no
papel, não nome em fonte cursiva fingindo assinatura.

- **Contratada:** RD Engenharia, com o responsável técnico e o CNPJ
- **Contratante:** o cliente, com linha de data

---

## O que isto obriga no código

- As cláusulas, garantias, horário, normas e responsável técnico moram em
  colunas da tabela `orgs` — são iguais em toda proposta da mesma empreiteira,
  e redigitar a cada uma é como o dado some.
- A seção só aparece quando há conteúdo. Bloco de garantias em branco num
  contrato é pior que bloco nenhum: parece que a empreiteira não dá garantia.
- Imprimir tem que funcionar, e o documento não pode depender de JavaScript
  para aparecer. Ver o comentário em `src/app/p/[token]/page.tsx`.
