# Como funcionam os orçamentos da RD Engenharia

Documento de contexto. Foi escrito para ser colado inteiro numa conversa com
outra IA, de modo que ela entenda o produto sem precisar de mais nada.
Atualizado em 23/09/2026.

---

## 1 · Quem é a RD

**RD Engenharia Construção e Reforma**, CNPJ 27.338.721/0001-62, sediada em
Fortaleza/CE e atuando na região metropolitana (Eusébio, Aquiraz).

- **Responsável técnico:** Francisco Reginato Dias — assina a ART e é quem
  define preço.
- **Contato:** (85) 98544-0117 · construcaereforma@rd.eng.br ·
  Instagram @rd_construcao_e_reforma
- **Lema que fecha os documentos:** "Deus seja o centro".

Obras típicas: reforma residencial, ampliação, recuperação de áreas externas,
cobertura, gesso e pintura, deck e área gourmet. Cliente final é pessoa física,
na maioria das vezes dona ou dono da casa. Há também condomínio e sala
comercial.

O **Rodrigo** é quem monta os documentos e cuida do sistema. O **Reginato** é
quem vai à obra, mede e precifica.

---

## 2 · O princípio que governa tudo

> **O orçamento é um contrato, não uma tabela de preços.**

Quem abre o link vai **imprimir, assinar e guardar**. Toda decisão de formato
sai daí:

- o documento precisa ser legível no papel A4, não só na tela;
- não pode depender de JavaScript para aparecer;
- assinatura é linha em branco, para caneta — nunca um nome em fonte cursiva
  fingindo assinatura;
- cláusula, garantia e norma não são enfeite: são o que o cliente vai cobrar
  depois.

---

## 3 · As sete seções canônicas

Formato definido pelo Rodrigo em 09/09/2026, a partir do modelo em PDF da RD.
**Não é sugestão: é o formato do produto.** Sai nesta ordem.

### 1 · Apresentação e escopo
Um parágrafo, no máximo. Diz o local da reforma, o endereço e o que o escopo
compreende em traços largos. Não repete a planilha — é o resumo que alguém
leria em voz alta ao telefone.

### 2 · Resumo orçamentário por módulo
Tabela das macroetapas com o prazo previsto de cada uma. Valor de mão de obra
por módulo e percentual do total **entram como colunas quando existem**. Quando
não existem — o caso comum, porque o Reginato passa preço fechado — a tabela
sai só com macroetapa e prazo. *Coluna inteira de travessão é pior que coluna
nenhuma.*

### 3 · Planilha orçamentária discriminada por item
**Item por item, nunca agrupado em blocos.** O cliente precisa conseguir
apontar a linha e perguntar "o que é isto". Cada linha leva o que existir:
quantitativo, unidade, medição, preço unitário, subtotal — e subtotal por
disciplina ao fim de cada grupo.

Quando falta quantidade ou preço unitário, a linha entra assim mesmo,
descrevendo o serviço, e o valor fica no fechamento do grupo.

### 4 · Cronograma executivo físico-financeiro
Planejamento em semanas, com metas físicas e financeiras por disciplina,
marcos semanais, caminho crítico e o que roda em paralelo. Tabela **e** leitura
visual: quem vai assinar não lê diagrama de Gantt, precisa enxergar "na semana
3 o banheiro está pronto e eu pago a segunda medição".

### 5 · Diretrizes técnicas e normas aplicáveis
Declara que os serviços seguem as normas técnicas brasileiras (ABNT NBR),
assegurando solidez, estanqueidade e durabilidade, e cita as normas das
disciplinas presentes no escopo. Exemplos usados de verdade: NBR 6122
(fundações), NBR 6118 e 14931 (estruturas de concreto), NBR 8545 (alvenaria),
NBR 7200 (revestimento em argamassa), NBR 13753 e 13755 (pisos e fachadas),
NBR 13245 (pintura), NBR 9574 e 9575 (impermeabilização), NBR 5626, 8160 e
10844 (hidráulica, esgoto e pluvial), NBR 16280 (reforma), NBR 10004
(resíduos), NR-18 e NR-35 (segurança e trabalho em altura).

### 6 · Condições comerciais, forma de pagamento e garantias
- **Forma de pagamento**, ajustada ao porte do orçamento.
- **Prazos** em semanas e em dias, corridos e úteis, os dois.
- **Horário de trabalho.**
- **Validade da proposta:** em torno de 20 dias.
- **Garantias legais:** 5 anos de solidez e estabilidade estrutural e de
  alvenaria — Art. 618 do Código Civil, que é **piso legal e não concessão da
  empreiteira**; 1 ano para acabamentos, instalações hidráulicas, elétricas e
  impermeabilizações; emissão de **ART/RRT** quando necessário.

### 7 · Assinaturas
Duas, lado a lado, e as duas linhas nascem **vazias**. Contratada: RD
Engenharia, com responsável técnico e CNPJ. Contratante: o cliente, com linha
de data.

### A regra que atravessa todas
**A seção só aparece quando há conteúdo.** Bloco de garantias em branco num
contrato é pior que bloco nenhum: parece que a empreiteira não dá garantia. Sem
macroetapa cadastrada não há seção 2; sem semana cadastrada não há seção 4, e o
documento vai direto da apresentação para a planilha. Nem toda obra tem
cronograma fechado.

**Exceção:** norma, garantia e assinatura não se omitem. São iguais em toda
proposta da RD e moram na ficha da empreiteira, não no orçamento.

---

## 4 · Onde os orçamentos vivem hoje

Existem **dois sistemas em paralelo**, e isso é histórico, não desenho.

### a) `rd-propostas` — as propostas escritas à mão (formato antigo)
Site estático em HTML, CSS e um `script.js`, uma pasta por cliente, publicado
na Vercel no domínio **orcamentos.rd.eng.br**. Cada pasta tem `index.html`,
`styles.css` (que só importa o `_shared/brand.css`) e `script.js`.

- Link curto e bonito: `orcamentos.rd.eng.br/<slug-do-cliente>`.
- Senha conferida **no navegador** (constante no `script.js`, guardada em
  `sessionStorage`) — segura contra o curioso, não contra o determinado.
- Não registra abertura, não tem aceite, não aparece em painel nenhum.
- Hoje restam **doze pastas**.

### b) `Obra Nova` — o produto (formato atual)
Aplicação Next.js com banco Postgres (Supabase), painel administrativo e
documento público em `/p/<token>`.

- O orçamento é cadastrado no painel, item por item.
- Senha conferida **no servidor**; o segredo nunca desce ao navegador.
- Registra quantas vezes o cliente abriu e quando viu pela primeira vez.
- Tem **aceite**: o cliente aprova no próprio documento, com nome e data.
- Aparece na lista de orçamentos, com situação e valor.

### Como os dois se ligam
O `vercel.json` do `rd-propostas` reescreve alguns slugs para o app, de modo
que o link curto continue valendo depois da migração:

```
/fatima  →  obra-nova/p/fatima
/thomas  →  obra-nova/p/thomas
```

Quando um orçamento migra, **a pasta estática é apagada no mesmo commit** — na
Vercel o arquivo vence a reescrita, e deixar os dois de pé serviria o documento
velho para sempre.

---

## 5 · Como o preço se forma

Esta é a regra mais importante, e a mais fácil de violar sem perceber:

> **Preço nunca é estimado. Sempre vem do Reginato.**

Uma IA que monta orçamento da RD **não inventa número**. Se falta preço, a
linha entra descrevendo o serviço e o valor fica no fechamento do grupo, ou o
documento não é publicado.

### Valor fechado é o caso comum
A maioria das obras sai com **um valor único**, mão de obra e material
inclusos, sem preço por item. A planilha serve para o cliente conferir **o que
será feito**, não quanto custa cada linha.

Quando há composição detalhada, a fórmula é:

```
mão de obra do serviço = quantidade × preço-base unitário × (1 + acréscimo)
```

O acréscimo é definido **por serviço** pelo Reginato e já contempla a margem da
RD. Esse tipo de conteúdo é **interno**: margem, acréscimo, faixa de preço e
composição **nunca** aparecem no documento que vai ao cliente.

### Material
Três arranjos possíveis, e o documento precisa dizer qual é:
1. **Mão de obra e material inclusos** — o mais comum.
2. **Só mão de obra** — o material fica por conta do cliente, conforme
   especificação e programação acordadas com a RD.
3. **Misto, com exceção nomeada** — por exemplo: tudo incluso *exceto* o
   porcelanato e o material de assentamento.

No caso 3, a exceção precisa aparecer **mais de uma vez** (na linha da
planilha, na nota abaixo do total e nas cláusulas). Exclusão que aparece uma
vez só vira discussão na hora de pagar.

### Ordens de grandeza reais
Dos 16 orçamentos hoje no painel: 13 com valor fechado, de **R$ 3.950,00** a
**R$ 99.107,00**, ticket médio em torno de **R$ 38 mil**. Quatro já aprovados.

---

## 6 · Forma de pagamento

Não há um padrão único. Os desenhos que aparecem de verdade:

- **50/50** — metade no início, metade na entrega.
- **70/30** — usado em obra com muito material adiantado.
- **30/40/30** — entrada na mobilização, medição, saldo na entrega.
- **Parcelas iguais a cada N dias úteis** — quatro partes iguais, uma no início
  e as demais a cada 15 ou 20 dias úteis.
- **Entrada cheia + parcelas iguais** — por exemplo R$ 35.000,00 na entrada e
  três parcelas de R$ 21.369,00 a cada 20 dias úteis.
- **Cartão de crédito em até 12x**, com acréscimo dos juros da máquina,
  costuma ser oferecido como alternativa.

O desenho canônico descrito na estrutura é: entrada para mobilização, primeira
medição, segunda (e terceira) medição, saldo final na entrega.

**Limitação atual do sistema, que vale registrar:** o app só sabe desenhar
*entrada + final* ou *parcelas todas iguais*. Combinações com primeira parcela
diferente das demais não cabem no modelo; nesses casos o campo de percentual
fica nulo de propósito — para o documento não imprimir um valor que não foi o
combinado — e o combinado sai por escrito no cartão "Forma de pagamento", que é
o primeiro da grade de condições comerciais.

**Regra de ouro na hora de escrever:** a soma das parcelas tem que bater com o
total, ao centavo. A última parcela é o resto da subtração, nunca o seu próprio
percentual — calcular cada uma por fora deixa o total um ou dois centavos
diferente, e o cliente confere na calculadora.

---

## 7 · Identidade visual

Sistema de marca próprio, compartilhado por todas as propostas.

- **Laranja obra `#E8622C`**, fundo `#0A0A0A`, papel `#F6F4EF`.
- Display **Archivo** (800 para títulos), rótulos em mono caixa-alta com
  espaçamento largo, assinatura em **Caveat**.
- Tela escura; a **planilha de custos sai sobre papel creme**, como uma
  planilha de obra de verdade dentro da página escura.
- Seções numeradas `01`, `02`… num rótulo mono laranja.
- Logo **sempre laranja sobre fundo escuro** — nunca a versão preta.

### Impressão A4
É primeira classe, não sobra. A folha de impressão gera:
1. **Capa** escura com logo, "Orçamento por escrito", cliente e número/data.
2. **Conteúdo timbrado** em papel claro, com logo colorida, razão social, CNPJ
   e cidade no topo, e contato no rodapé.

Some na impressão: senha, navegação, botões, animações. O par de assinaturas
sai lado a lado e não pode ser cortado pela quebra de página.

---

## 8 · Numeração, identificação e acesso

- **Número da proposta:** `RD-2026-0NN`, sequencial. O último emitido foi o
  **RD-2026-082** (Sr. Thomas, ampliação de área gourmet).
- **Data de emissão** e cidade aparecem na capa impressa.
- **Slug do cliente** é o endereço: `orcamentos.rd.eng.br/thomas`.
- **Senha por proposta**, no padrão `Nome + ano`: `Thomas2026`, `Fatima2026`,
  `Izonete2026`.
- Todo o domínio é `noindex, nofollow`, por `robots.txt`, por meta tag e por
  header HTTP. A raiz não lista os clientes — diz apenas "acesse pelo link que
  você recebeu".

---

## 9 · Ciclo de vida de um orçamento no app

**Status** (onde está no processo interno): `briefing` → `conferindo` →
`perguntas` → `respondido` → `publicado` → `arquivado`.

**Situação** (o que o cliente fez): `rascunho` → `enviado` → `visto` →
`negociando` → `aprovado` / `recusado` / `expirado`.

Publicar **congela** uma versão: o documento que o cliente lê é uma cópia
gravada, não uma consulta ao vivo. Republicar cria a versão seguinte. É o que
garante que o prazo e o preço que ele leu são os que foram combinados.

Publicação é **ato humano na tela**. Existe um caminho por linha de comando,
usado para orçamentos cujos dados foram gravados fora do painel, e ele pede
confirmação digitada e registra origem `cli` — quem olhar a linha do tempo
depois precisa saber que não foi alguém clicando.

---

## 10 · O que nunca fazer num orçamento da RD

1. **Inventar preço.** Nem unitário, nem estimado, nem "mais ou menos".
2. **Inventar prazo.** Prazo em documento assinado vira obrigação.
3. **Agrupar serviços em blocos** na planilha discriminada.
4. **Deixar coluna inteira de travessão**, ou seção em branco.
5. **Vazar conteúdo interno**: margem, acréscimo, faixa de preço, composição,
   pendências de medição, "a confirmar", "a definir".
6. **Assinar por alguém** — a linha nasce vazia.
7. **Depender de JavaScript** para o documento aparecer ou imprimir.
8. **Tratar a garantia de 5 anos como cortesia** — é o Art. 618, é piso legal.
9. **Deixar a soma das parcelas diferente do total.**
10. **Omitir a exclusão de material** quando ela existe.

---

## 11 · Vocabulário da casa

- **Medição** — vistoria de avanço que libera uma parcela.
- **Macroetapa / módulo** — bloco da obra no resumo orçamentário.
- **Chapim** — peça de arremate no topo de muro ou platibanda.
- **Sóculo** — base de concreto, apoio de bancada ou pilar.
- **Baldrame** — viga de fundação, no nível do solo.
- **Engastamento** — vínculo rígido entre peças estruturais.
- **Laje H8 treliçada** — laje pronta, 8 cm, com enchimento de EPS ou cerâmica.
- **Chapisco / reboco** — camadas de preparo da parede antes do acabamento.
- **Contrapiso** — camada de regularização sob o revestimento.
- **Verba (vb)** — unidade de item sem quantitativo, cobrado por serviço.
- **Conj / Serv** — unidades de item fechado, sem medida em m² ou metro.
- **ART** — Anotação de Responsabilidade Técnica, junto ao conselho de classe.
- **BDI** — margem embutida no preço de venda; fica no sistema, nunca no
  documento do cliente.
