# PRD — Vistoria de Orçamento

**Origem:** PRD "Obra Nova — Orçamento Inteligente", v1.0, setembro/2026.
**Estado:** corrigido contra o código e o banco `wnzdsqpsowxmistbnhca` em
10/09/2026. O PRD original descreve o Obra Nova como folha em branco; ele não
é. Construir na ordem que o documento propunha significaria reescrever cinco
funcionalidades que já estão no ar.

Mesmo tratamento que `PRD-PIPELINE.md` recebeu: as premissas primeiro, o
escopo depois.

---

## 0. As premissas do PRD, conferidas

| # | O PRD supõe | Realidade | Consequência |
|---|---|---|---|
| P1 | A biblioteca de serviços precisa ser criada | **Existe.** `orc_bases_de_preco` + `orc_composicoes`, com tela em `/admin/precos`, importador de planilha e busca por RPC (`orc_buscar_composicoes`) | **Não construir de novo.** Ver §2 — o problema dela é outro |
| P2 | Rascunho de orçamento é funcionalidade nova (F09) | **Existe.** Todo orçamento nasce em `situacao: rascunho` | F09 sai do escopo |
| P3 | Revisão humana precisa ser criada (F10) | **Existe, e é mais dura que o PRD pede.** Publicar é ato explícito, e trava com item sem preço ou sem senha | F10 sai do escopo. **Cuidado para não afrouxar** |
| P4 | Modelo de proposta precisa ser criado (F11) | **Existe e vai além.** Sete seções canônicas, cláusulas, garantias, duas assinaturas e impressão — ver `ESTRUTURA-DA-PROPOSTA.md` | F11 sai do escopo |
| P5 | Status e histórico precisam ser criados (F12) | **Existem.** `orc_eventos`, `pipe_eventos`, situação, `motivo_perda`, `pipe_tempos` por etapa | F12 sai do escopo |
| P6 | Há papéis distintos (responsável técnico, orçamentista, gestor) | **Não.** `org_members` tem `org_id`, `user_id`, `created_at`. Sem coluna de papel — todo mundo da org é igual | Ver §5, decisão D5 |
| P7 | O tempo entre visita e orçamento é ~2 semanas | **Não medido.** A máquina de medir existe (`pipe_tempos`), mas tem **2 lançamentos** no banco inteiro | A meta vira "medir", não "reduzir" — ver §6 |
| P8 | Orçamento parado é ">7 dias" | Configurável em `org_ajustes.dias_para_parado`, hoje **5** | Alinhar o número ou justificar a mudança |

**Cinco das doze funcionalidades do MVP já estão prontas.** O que sobra —
e o que importa — é o levantamento estruturado da visita: F01 a F05, F07 e F08.

---

## 1. Vocabulário: o mesmo conceito com dois nomes

O PRD inventa nomes para coisas que já existem. Usar os nomes dele criaria
tabelas paralelas.

| PRD | Obra Nova | Onde |
| --- | --- | --- |
| Oportunidade | **Pedido** | `pipe_pedidos` |
| Proposta enviada ao cliente | **Publicação** | `orc_publicacoes` (snapshot congelado) |
| Biblioteca de serviços | **Base de preços / composições** | `orc_bases_de_preco`, `orc_composicoes` |
| Item de orçamento | **Item** | `orc_itens` |
| Status da proposta | **Situação** | `orc_orcamentos.situacao` |
| Ambiente | *(não existe)* | conceito novo — ver D1 |

---

## 2. O gargalo real não é software

Este é o achado que reordena o projeto.

```
orc_bases_de_preco .................  0 linhas
orc_composicoes ....................  0 linhas
orc_itens com composicao_id ........  0  (de 322 itens vivos)
```

A biblioteca **não está faltando — está vazia**. Foi construída, ninguém
preencheu, e os 322 itens dos 20 orçamentos existentes foram todos digitados,
colados ou ditados.

O PRD acerta ao dizer que "o ganho de velocidade dependerá menos de IA e mais
de uma biblioteca bem construída". Mas então a **primeira entrega não pode ser
a tela de vistoria**: uma vistoria que sugere itens de uma biblioteca vazia não
sugere nada, e o Reginato digita igual — com mais cliques antes.

**A primeira entrega é popular a biblioteca.** E há matéria-prima pronta: os
322 itens já lançados são o histórico real de como a RD orça. Minerar a
recorrência ali é mais rápido e mais fiel que a "descoberta" que o PRD propõe
(mapear 5 a 10 orçamentos à mão), porque os 20 orçamentos já estão no banco.

---

## 3. Onde este PRD colide com uma regra dura do produto

**"Preço nunca é estimado pela IA"** (ver `rd-orcamento` na memória do
projeto, e a regra 1 do prompt de colagem). É a regra que mais custou para
firmar: item sem valor dito nasce sem preço, e a publicação trava até alguém
preencher.

O PRD pede "preço de referência" na biblioteca e "cálculo automático". **Isso
não viola a regra**, desde que fique escrito por quê:

- Preço de biblioteca é **preço do Reginato, cadastrado por ele**. É memória,
  não estimativa. Legítimo.
- Preço inferido pela IA a partir de descrição, foto ou média de mercado
  continua **proibido**.
- A distinção precisa aparecer na tela. O banco já suporta: `orc_itens.origem`
  (`ia` / `humano`) e `orc_itens.composicao_id` dizem de onde cada valor veio.

O PRD já pede isso na §11 ("valores sugeridos devem indicar sua origem"). Aqui
fica explícito que a origem **não é decorativa**: é o que separa preço lembrado
de preço inventado.

---

## 4. Escopo corrigido do MVP

### Entrega 1 — Encher a biblioteca (sem tela de vistoria)

Sem isto, o resto não entrega valor.

1. **Minerador de recorrência**: script que lê os 322 itens vivos e agrupa por
   descrição semelhante, devolvendo os serviços mais repetidos com unidade e
   faixa de valor praticada. Saída para conferência humana, não para gravação
   automática.
2. **Revisão do Reginato**: ele confirma, corrige e nomeia os 20 a 50 serviços
   que viram a base. Uma sessão de trabalho, não um formulário.
3. **Gravar como composições** na base já existente.
4. **Medir**: a partir daqui, `composicao_id` deixa de ser sempre nulo, e a
   métrica "% de itens reutilizados" passa a existir de verdade.

**Critério de aceite:** a base da RD tem ao menos 20 composições ativas, e um
orçamento novo consegue ser montado com ≥ 70% dos itens vindos dela.

### Entrega 2 — Vistoria estruturada

Só o que não existe: **F01–F05**.

| ID | O que | Observação |
| --- | --- | --- |
| F01 | Vistoria vinculada a um **pedido** existente | Reusa `pipe_pedidos`; não cria "oportunidade" |
| F02 | Ambientes | Conceito novo — depende de **D1** |
| F03 | Checklist de serviços por ambiente | Alimentado pela biblioteca da Entrega 1 |
| F04 | Medições | Depende de **D3** (fórmulas) |
| F05 | Fotos e observações | Bucket já existe; depende de **D4** |

A vistoria **gera itens no orçamento**, ela não é um orçamento paralelo. O
destino de tudo continua sendo `orc_itens`.

### Entrega 3 — Sugestão e cálculo

F07 e F08, em cima da biblioteca cheia e da vistoria pronta.

### Fora do MVP

- Papéis e aprovação por margem mínima (§5, D5)
- IA sobre voz, sketch e foto — o PRD já coloca depois, e está certo
- Qualquer reconstrução de F06, F09, F10, F11, F12

---

## 5. Decisões que travam o desenvolvimento

O PRD original não decide estas seis. **Nenhuma linha de código da Entrega 2
deve ser escrita antes delas** — são escolhas de produto, não de implementação.

**D1 · Ambiente é uma dimensão nova ou vira o grupo? — DECIDIDO em 11/09/2026**

**Ambiente vira o grupo do item.** Decisão do Rodrigo.

`orc_itens.grupo` é texto livre e hoje carrega a divisão que o Reginato usa nos
orçamentos digitados: `1 - MÃO DE OBRA`, `2 - MATERIAIS`. A decisão troca isso
por `1 - COZINHA`, `2 - BANHEIRO SUÍTE` **nos orçamentos que nascerem de
vistoria** — a planilha do cliente passa a ser lida por cômodo, e não por
natureza de custo.

O que a decisão custa, dito por extenso para não ser redescoberto depois:

- Um orçamento gerado por vistoria **não separa mão de obra de material**. Se
  a RD precisar dessa divisão num orçamento específico, ela volta a ser feita
  à mão no editor, renomeando grupo.
- Os orçamentos antigos não mudam: a decisão vale para o que a vistoria gera,
  não é migração.
- Se um dia as duas dimensões forem necessárias ao mesmo tempo, aí sim entra
  coluna nova em `orc_itens` — e aí é schema, não convenção.

**D2 · A vistoria funciona sem sinal?**
"Continuar depois sem perder dados", numa obra, no celular. Autosave contra o
servidor resolve queda de aba, não resolve ausência de rede. Offline-first
muda a arquitetura inteira (fila local, resolução de conflito) e é a decisão
mais cara deste PRD.

**D3 · Que linguagem tem a fórmula?**
`largura × altura − vãos` é um exemplo, não uma especificação. Quem escreve?
O que acontece quando falta uma medida? A fórmula pode calcular **quantidade**
— não pode escrever o total: `orc_itens.total` é coluna gerada
(`quantidade × valor_unitario`) e não aceita escrita direta.

**D4 · Fotos: limite, formato, compressão.**
O app já tem upload com teto de 25 MB para áudio e um bucket configurado.
Faltam os números para foto e se comprime no cliente.

**D5 · Papéis entram no MVP?**
"Orçamentista / apoio", "responsável técnico" e "aprovação especial abaixo de
margem mínima" pressupõem permissões distintas. `org_members` não tem papel
nenhum. Ou isso sai do MVP, ou vira trabalho explícito com schema, tela e
política de RLS.

**D6 · A vistoria é a quarta porta de entrada. As outras três continuam?**
Hoje um orçamento nasce por **fala**, por **colagem** ou **à mão**. A vistoria
seria a quarta. Manter as quatro é manter quatro caminhos de teste; aposentar
alguma é decisão que precisa ser dita.

---

## 6. Métricas corrigidas

A máquina de medir já existe — `pipe_tempos` (minutos e km por etapa),
`pipe_eventos` (troca de estado com data) e a coluna `parado` na view. O que
falta é **uso**: dois lançamentos no banco inteiro.

Então as metas do PRD estão invertidas: elas comparam contra um "atual" que
nunca foi medido.

| Métrica | O PRD diz | Corrigido |
| --- | --- | --- |
| Tempo visita → pré-orçamento | ~2 semanas → mesmo dia | **Primeiro medir.** Meta só depois de 10 pedidos com etapas cronometradas |
| Tempo de digitação | ~1–2 h → < 30 min | Idem — a etapa `planilha_custos` já existe para isso |
| % de itens da biblioteca | 0% → > 70% | **0% está certo e é medível hoje** (`composicao_id` nulo em 322 de 322). Meta válida |
| Orçamentos parados | > 7 dias | Alinhar com `org_ajustes.dias_para_parado`, hoje **5** |
| Perda por demora | não medida | `motivo_perda` já existe; falta a rotina de preencher |

**Pré-requisito de qualquer meta de tempo:** o Reginato usar o cronômetro do
pipeline nas próximas visitas. Sem isso, o piloto não tem como demonstrar
redução — só impressão.

---

## 7. Critérios de aceite, com número

Os do PRD original não são verificáveis ("suficientemente bom", "redução
mensurável"). Reescritos:

1. A base de preços da RD tem **≥ 20 composições ativas**, revisadas pelo
   Reginato.
2. Num orçamento novo montado por vistoria, **≥ 70% dos itens** têm
   `composicao_id` preenchido.
3. Uma vistoria completa (3 ambientes, 10 serviços, 5 fotos) é registrada em
   **≤ 15 minutos** de tela, medido com o cronômetro do próprio pipeline.
4. Ao encerrar a vistoria, os itens aparecem no orçamento em `situacao:
   rascunho`, editáveis, com subtotal e total corretos.
5. **A trava de publicação continua valendo**: item sem preço bloqueia, sem
   senha bloqueia. Nenhum caminho novo pode contornar.
6. Todo item gerado pela vistoria mostra de onde veio o valor: composição,
   digitado à mão, ou sem preço.
7. Os tempos de visita, rascunho, revisão e envio ficam registrados em
   `pipe_tempos` **sem digitação extra** — o cronômetro roda dentro da vistoria.

---

## 8. Riscos, com os do PRD mais os que ele não viu

Os cinco do PRD original continuam válidos. Faltavam três:

| Risco | Mitigação |
| --- | --- |
| **Construir vistoria sobre biblioteca vazia** — o erro mais provável, porque a tela é a parte visível e a biblioteca é a chata | Entrega 1 antes da 2, sem exceção |
| **Reconstruir o que existe** por causa do vocabulário do PRD | O glossário da §1 é normativo |
| **Afrouxar a trava de publicação** para o fluxo novo caber | Critério de aceite 5 |

---

## 9. Próximo passo

O PRD sugere um protótipo navegável. Antes dele, duas coisas mais baratas e
mais decisivas:

1. **Rodar o minerador** sobre os 322 itens e levar a lista ao Reginato. É meia
   hora de máquina e uma conversa, e é o que destrava tudo.
2. **Fechar D1 e D2** — ambiente × grupo, e se a vistoria funciona sem sinal.
   As duas mudam o schema, e decidir depois de ter tela é retrabalho garantido.
