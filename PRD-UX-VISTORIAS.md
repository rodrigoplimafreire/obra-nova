# PRD — Simplificação da UX de Vistorias | Obra Nova

Versão 1.0 · 16/09/2026 · Responsável de produto: Rodrigo Peixoto

**Objetivo:** permitir que Reginato registre o que precisa ser feito, por ambiente, durante a visita e aproveite esse levantamento no orçamento, com pouca digitação e sem perder o trabalho ao interromper a tarefa.

**Status:** especificação proposta para desenvolvimento. Não representa funcionalidade entregue nem resultado de teste com usuário.

**Procedência:** redigido pelo Codex a partir do pacote de contexto do projeto.
Conferido contra o código em 16/09/2026, sobre o commit `025fe65`. A §0 abaixo
é a conferência; da §1 em diante o texto é o original, sem alteração.

---

## 0. As premissas do PRD, conferidas

Mesmo tratamento que `PRD-PIPELINE.md` e `PRD-VISTORIA.md` receberam. A
diferença é que desta vez **todas as afirmações factuais se confirmam** — este
PRD leu o código antes de escrever, e a própria §2 dele declara os limites da
análise em vez de fingir auditoria completa.

### 0.1 Verificação

| O PRD afirma | Confere | Onde |
| --- | --- | --- |
| Formulário mostra 18 sugestões de serviço | ✅ | `src/lib/vistoria/constantes.ts`, `SERVICOS` |
| `areaDe` prioriza C × L; cai para C × A sem largura | ✅ | `constantes.ts`, `areaDe()` |
| É preciso tocar em "Usar … m² como quantidade" | ✅ | `tela-vistoria.tsx:700` |
| Unidade inicia em m² antes de definir o serviço | ✅ | `tela-vistoria.tsx:720` |
| "Gerar orçamento" e "Concluir visita" coexistem no cabeçalho | ✅ | `tela-vistoria.tsx:118` e `:127` |
| Conversão sempre grava `valor_unitario: null` | ✅ | `src/lib/vistoria/acoes.ts:455` |
| Ambiente vira `orc_itens.grupo` | ✅ | `acoes.ts:449`, formato `1 - COZINHA` |
| A lista promete salvar a cada campo, e os formulários exigem submissão | ✅ | promessa em `painel-vistorias.tsx:64`; botões "Salvar" em `tela-vistoria.tsx:543`, `:608`, `:759` |
| Quatro indicadores antecedem as listas | ✅ | `painel-vistorias.tsx:69–75` |
| `vist_medicoes` não tem preço, modo de medição nem desconto | ✅ | `src/lib/database.types.ts` |
| A checagem de `orcamento_id` não protege contra concorrência | ✅ | `acoes.ts:379` — é leitura-depois-escrita |

Nenhuma correção factual a fazer. O que segue são consequências, não erros.

### 0.2 O que este PRD fecha

- **D3 (linguagem das fórmulas)** — resolvida, e melhor do que estava proposta:
  sete modos de medição em vez de uma sintaxe de fórmula a inventar. A Tela D é
  a decisão.
- **D2 (offline)** — resolvida como "conectado, com proteção local do que está
  em edição". O mérito está em **não prometer o que não entrega**: criar visita,
  mudar estrutura e gerar orçamento exigem rede, e isso está escrito.
- **D6 (a quarta porta de entrada)** — resolvida: fala, colagem, transcrição e
  edição manual continuam (§4).

**D4** (limites de foto) fica sem efeito nesta entrega, porque fotos saíram do
escopo. **D5** (papéis) continua fora, como já estava.

### 0.3 Três decisões que são do Rodrigo, não do Codex

**1 · A §1 reverte o achado central do `PRD-VISTORIA.md`.**
Aquele documento cravou "Entrega 1 antes da 2, sem exceção", porque vistoria
sobre biblioteca vazia não sugere nada e o Reginato digita igual, com mais
cliques antes. A reversão está atribuída ao Rodrigo e é **defensável**: as
descrições vêm dos 35 candidatos minerados, e o preço passa a ser capturado na
visita (Tela E), no instante em que ele sabe o número — que era o papel que a
biblioteca cheia ia cumprir.

O custo, dito por extenso para não ser redescoberto: `composicao_id` continua
nulo em 100% dos itens, e a meta de 70% de reutilização sai do horizonte sem
data. O caminho de volta é o **UX15** (favoritos por uso e frequência), hoje
P1 — é ele que enche a biblioteca sozinha, pelo uso, sem sessão de cadastro.
**Recomendação: promover UX15 a P0.** É barato agora e caro de recuperar depois.

**2 · A §9 quebra um padrão documentado.**
"Todo CRUD acontece em diálogo" está no `README.md` com o raciocínio inteiro:
o `<dialog>` nativo entrega foco preso, Esc, resto da página inerte para leitor
de tela e camada de topo, sem `z-index` disputando com a barra lateral. A
inclusão contínua na tela do ambiente abre mão disso em troca de menos
repetição no canteiro.

O PRD admite a exceção e justifica, o que é honesto. Mas é a única decisão que
**sobrepõe um padrão** em vez de preencher um vazio, e por isso precisa de um
sim explícito. Se o sim vier, o que o `<dialog>` dava de graça passa a ser
trabalho nosso — foco e ordem de leitura inclusive.

**3 · A §10 exige migração em produção.**
Preço de venda, modo de medição e desconto de área não existem em
`vist_medicoes`. Como as migrações são aplicadas pelo MCP direto no projeto
Supabase e **não são versionadas no repositório**, isso é alteração em produção
sem rede de proteção.

O próprio PRD manda não mexer no banco com base apenas nos tipos do pacote — e
está certo. **Rodar `npx supabase db pull` antes de começar**, como
`supabase/README.md` já sugere. Essa é a hora.

### 0.4 A lacuna que o PRD vê e não fecha

**UX09 (clique duplo não cria dois orçamentos).** O PRD nota que a checagem de
`orcamento_id` sozinha não garante proteção contra concorrência, e a
verificação confirma: `acoes.ts:379` lê e depois escreve, sem nada no meio.

A correção é no banco, não na aplicação — restrição de unicidade sobre o
vínculo vistoria ↔ orçamento. **Decidir junto com a migração da §0.3, item 3**,
numa ida só ao schema em vez de duas.

### 0.5 O que sai de escopo sem ser nomeado como corte

**Fotos.** Eram **F05** no `PRD-VISTORIA.md`, dentro do MVP, e a §4 deste
documento as coloca em "Fora". Não é erro — é escolha legítima para um piloto
de UX — mas fica registrado aqui como corte, e não como esquecimento.

---

## 1. Contexto e decisão de produto

O Obra Nova já possui vistoria, ambientes, serviços, medidas, cálculo simples de área e geração de orçamento. A mudança é simplificar a experiência existente e completar a precificação durante a visita. Não criar aplicativo, biblioteca ou orçamento paralelo.

Reginato visita, conversa, mede e avalia o serviço. O celular deve acompanhar essa atividade sem exigir que ele termine um formulário completo a cada observação.

**Decisão explícita de Rodrigo:** disponibilizar para uso e aprender com Reginato depois. Revisar previamente os 35 serviços candidatos ou cadastrar 20 composições deixa de ser condição de lançamento. Os candidatos podem ajudar na descrição; seus preços históricos não serão preenchidos automaticamente.

Este documento substitui, para esta entrega, a exigência do PRD anterior de biblioteca validada antes da evolução da vistoria. Mantém as regras financeiras, de publicação e de organização por ambiente.

## 2. Base da análise e limites

Fontes: ZIP fornecido pelo usuário, `CONTEXTO-DO-PROJETO.md`, `PRD-VISTORIA.md`, `servicos-candidatos.md`, `src/components/admin/tela-vistoria.tsx`, `painel-vistorias.tsx` e `src/lib/vistoria/{acoes,constantes}.ts`.

A análise foi feita sobre o código fornecido. Não houve captura da interface autenticada, teste em celular, consulta ao banco de produção ou observação de Reginato. Portanto, este é um PRD fundamentado no código e no relato do usuário, não uma auditoria visual concluída. Contraste, tamanho efetivo, comportamento do teclado e tempo de tarefa precisam ser verificados na implementação.

| Evidência no código atual | Hipótese de dificuldade | Resposta proposta |
| --- | --- | --- |
| Formulário mostra 18 sugestões de serviço, descrição, três dimensões, quantidade, unidade e observação | Excesso de decisões para registrar algo simples | Captura curta; medição e preço aparecem quando necessários |
| Cada inclusão abre um diálogo e fecha após salvar | Repetição de abertura e fechamento interrompe o levantamento | Adicionar vários serviços em sequência na tela do ambiente |
| `areaDe` prioriza comprimento × largura; usa comprimento × altura se largura estiver ausente | Intenção da medição fica implícita | Escolher o que medir; exibir os campos e a conta correspondentes |
| É necessário tocar em “Usar ... m² como quantidade” | Medida calculada pode não chegar à quantidade | Quantidade derivada automaticamente no modo de cálculo, com resultado visível |
| Unidade inicia em m² mesmo antes de definir o serviço | Usuário pode manter unidade inadequada | Unidade explícita; sem inferência silenciosa para descrição livre |
| “Gerar orçamento” e “Concluir visita” coexistem no cabeçalho | Dúvida sobre qual ação encerra o trabalho | Uma ação principal por contexto: revisar, depois criar rascunho |
| Lista afirma salvar a cada campo, mas formulários exigem submissão | Expectativa de proteção diferente da persistência real | Estado de salvamento verdadeiro e preservação do rascunho |
| Todos os ambientes são apresentados em sequência; quatro indicadores antecedem as listas | Retomada e serviço atual podem perder prioridade | Continuar visita em destaque e trabalhar em um ambiente por vez |
| Conversão sempre grava `valor_unitario: null` | Preço informado depois exige outra etapa | Preço opcional durante a visita, transferido ao orçamento |

Manter os acertos: cliente como único dado obrigatório na abertura, nomes livres, medidas opcionais, agrupamento por ambiente, orçamento editável e publicação humana.

## 3. Usuário, tarefa e princípios

**Usuário principal:** Reginato, responsável pelo levantamento e pelas decisões técnicas da RD Engenharia. Rodrigo acompanha a adoção e a preparação dos orçamentos.

**Tarefa central:** “Enquanto olho um ambiente, quero registrar os serviços e as medidas que já sei, deixar o restante pendente e continuar de onde parei.”

Princípios:

1. Registrar primeiro; detalhar quando a informação estiver disponível.
2. Mostrar um ambiente por vez, com troca rápida entre eles.
3. Priorizar serviços concretos; categorias ajudam a encontrar, mas não completam o escopo técnico sozinhas.
4. Nunca obrigar a precificar para registrar um serviço.
5. Usar frases do trabalho: “Adicionar serviço”, “Medir”, “Preço para o cliente”, “Continuar visita”. Não exibir nomes de tabelas ou termos técnicos de implementação.
6. Informar o que está salvo, pendente e pronto para a próxima etapa.

## 4. Escopo desta versão

**Incluído:** lista orientada à retomada; início rápido; foco por ambiente; inclusão contínua de serviços; descrição editável; medição contextual; preço de venda opcional; resumo por ambiente; revisão antes da conversão; salvamento e recuperação; tratamento de erros; preservação dos orçamentos existentes.

**Fora:** reconhecimento de planta, geração 3D, fotos, nova captura de voz na vistoria, biblioteca de preços aprovada automaticamente, margem mínima, novos papéis, publicação automática, sincronização de alterações da vistoria com orçamento já gerado e funcionamento completo sem rede. Os caminhos atuais por fala, colagem, transcrição e edição manual continuam disponíveis.

## 5. Fluxo proposto

**Visitas → Continuar ou iniciar → Ambiente → Adicionar serviços → Medir/precificar quando possível → Revisar levantamento → Criar rascunho de orçamento.**

A navegação é livre: medir e precificar são ações opcionais dentro do ambiente, não etapas obrigatórias de um assistente linear. O usuário pode trocar de ambiente ou sair antes da revisão.

### Tela A — Visitas

- Destacar “Continuar visita” com cliente, data e último ambiente trabalhado, quando essa informação existir.
- Ação principal: “Nova visita”. Busca por cliente/endereço e listas “Em andamento” e “Com orçamento”. Visitas concluídas sem orçamento continuam acessíveis com indicação própria.
- Mostrar quantidade de ambientes e serviços; chamar registros de serviços, não de medidas, quando a medida ainda estiver vazia.
- Remover os quatro indicadores do topo da experiência de campo; não eliminá-los de possíveis relatórios administrativos.
- Cartão abre a visita diretamente. Retomar não exige informar novamente cliente ou endereço.

### Tela B — Iniciar visita

- Pedir apenas “Para quem é a visita?”. Endereço, data e vínculo com pedido ficam em “Mais informações”.
- Ao abrir a partir de um pedido, herdar os dados disponíveis e preservar o vínculo, sem redigitação.
- Botão: “Começar levantamento”. Após salvar no servidor, abrir escolha do primeiro ambiente.
- Se não houver rede, informar que é necessário conectar para criar a visita nesta versão; preservar o texto digitado enquanto a tela permanecer aberta.

### Tela C — Ambiente em trabalho

- Cabeçalho compacto: cliente, nome do ambiente e estado de salvamento.
- Seletor “Trocar ambiente” mostra cômodos cadastrados e “Adicionar ambiente”; não depende de rolagem horizontal para funcionar.
- Lista curta dos serviços daquele cômodo, com descrição, quantidade/unidade e preço quando preenchidos.
- Campo “Qual serviço será feito aqui?” e ação “Adicionar serviço”. Permitir inclusão contínua sem reabrir diálogo a cada item.
- Exibir no máximo seis sugestões iniciais, pesquisáveis. Descrições candidatas são editáveis e não carregam preço. “Ver todos” amplia as opções sem ocupar a tela inicial.
- Ao selecionar sugestão, abrir sua descrição na captura rápida; confirmar inclusão para evitar itens por toque acidental. Após adicionar, limpar a captura e manter o ambiente.
- Cada item oferece “Medir”, “Preço” e edição da descrição. Observações ficam em “Detalhes”.
- Pendências aparecem em texto: “Falta quantidade”, “Unidade a definir” e “Preço a definir”. Não usar vermelho para dados que são opcionais nesta etapa.
- Ação persistente “Revisar levantamento”, com contagem de serviços. O teclado não pode encobrir o campo ou a ação de adicionar.

### Tela D — Medição contextual

Ao tocar em “Medir”, abrir uma folha inferior com a descrição do serviço e o ambiente visíveis. Uma folha de cada vez; nenhuma sequência de modais aninhados.

| Modo escolhido | Campos | Resultado |
| --- | --- | --- |
| Já sei a quantidade | Quantidade e unidade | Valor digitado |
| Área de piso/teto | Comprimento e largura, em metros | Comprimento × largura, em m² |
| Área de parede | Comprimento e altura, em metros; desconto opcional em m² | Comprimento × altura − desconto |
| Comprimento | Comprimento em metros | Quantidade em m |
| Volume | Comprimento, largura e altura, em metros | Produto das três dimensões, em m³ |
| Contagem | Número de unidades e unidade de contagem | Quantidade informada |
| Serviço completo | Confirmação explícita de cobrança global | Quantidade 1; unidade vb |

- Nenhum modo pressupõe automaticamente todas as paredes de um cômodo. Explicar “Esta medição corresponde à área informada”. Múltiplas superfícies podem ser registradas em itens separados nesta versão.
- Mostrar conta e resultado assim que houver dados suficientes, sem botão adicional para copiar a área. Enquanto faltar dimensão, mostrar “Preencha ... para calcular”, nunca zero fictício.
- O modo calculado controla a quantidade. “Informar quantidade manualmente” muda o modo explicitamente e avisa que a quantidade não acompanhará novas dimensões.
- Dimensões em metros, com unidade ao lado do rótulo. Aceitar vírgula decimal e validar entradas inválidas; não transformar ponto decimal em multiplicação por mil silenciosamente.
- Não permitir dimensão negativa nem desconto maior que a área bruta. Resultado zero exige revisão e não torna o item pronto para publicar.
- Exibir até duas casas decimais, mantendo cálculo interno e regra de arredondamento definidos de forma consistente entre tela e servidor.

### Tela E — Preço opcional

- Rótulo contextual: “Preço para o cliente — R$/m²”, “R$/un” ou “Preço do serviço completo”, conforme a unidade escolhida.
- Sem unidade, pedir sua definição antes de apresentar um total calculado; o serviço pode permanecer sem preço.
- Mostrar quantidade × preço e subtotal imediatamente. Exemplo fictício de verificação: 12 m² × R$ 50,00 = R$ 600,00.
- “Definir depois” mantém preço nulo. Não substituir ausência por zero e não preencher a partir das faixas históricas.
- Custo permanece separado do preço de venda. Nesta entrega, sua edição pode continuar no editor de orçamento; não adicionar mais um campo obrigatório à visita.
- Para valor fechado, usar o modo “Serviço completo” com quantidade 1 confirmada; não distribuir automaticamente uma verba entre serviços.

### Tela F — Revisar levantamento

- Agrupar por ambiente; listar descrição, quantidade, unidade, preço e subtotal quando disponíveis.
- Mostrar contadores clicáveis: serviços sem quantidade, sem unidade e sem preço. Tocar leva ao item mantendo o contexto de retorno.
- Se houver pendências, exibir “Subtotal dos itens preenchidos” e a quantidade pendente. Não chamar soma parcial de total final.
- Ação principal: “Criar rascunho de orçamento”. Microtexto: “Você poderá revisar antes de enviar ao cliente”.
- Dados incompletos não impedem criar rascunho, desde que haja cliente, ambiente e ao menos um serviço com descrição. Publicação continua sujeita às validações completas.
- “Concluir visita” sai do cabeçalho principal. Quando necessário, fica como “Encerrar levantamento sem gerar orçamento” nas opções secundárias. Reabrir permanece possível.
- Após gerar, abrir o editor do orçamento e confirmar a transferência. Na visita, exibir “Orçamento criado” e “Abrir orçamento”.

## 6. Requisitos e critérios de aceite

| ID | Prioridade | Requisito verificável |
| --- | --- | --- |
| UX01 | P0 | Criar visita com apenas cliente; voltar à lista e retomá-la sem redigitação |
| UX02 | P0 | Alternar entre ambientes preservando serviço em edição, rolagem e dados já salvos |
| UX03 | P0 | Adicionar três serviços seguidos no mesmo ambiente sem abrir três formulários completos |
| UX04 | P0 | Serviços livres funcionam com biblioteca vazia; sugestões são editáveis e não trazem preços históricos |
| UX05 | P0 | Medição mostra somente campos do modo escolhido; quantidade calculada não exige cópia manual |
| UX06 | P0 | Preço preenchido manualmente chega ao mesmo item no orçamento; preço ausente permanece nulo |
| UX07 | P0 | Resumo diferencia soma parcial de total completo e permite corrigir cada pendência |
| UX08 | P0 | Revisar e gerar são etapas distintas; gerar nunca publica nem envia mensagem ao cliente |
| UX09 | P0 | Clique duplo, repetição após falha e requisições concorrentes não criam dois orçamentos para a mesma conversão |
| UX10 | P0 | Falha de salvar mostra erro e tentativa novamente, preservando o conteúdo digitado |
| UX11 | P0 | Sem preço ou senha, publicação continua bloqueada; custo interno não aparece na proposta |
| UX12 | P0 | Orçamentos anteriores e demais portas de entrada mantêm comportamento e agrupamento |
| UX13 | P0 | Após gerar, editar a visita não modifica silenciosamente o orçamento; aviso orienta ajustes no editor |
| UX14 | P1 | Duplicar serviço no ambiente preserva descrição/unidade, pede revisão de quantidade e preço e identifica cópia |
| UX15 | P1 | Favoritos de descrição surgem por uso explícito ou frequência, sem promover preços automaticamente |

P0 compõe o piloto funcional; P1 fica após o primeiro retorno de Reginato. A biblioteca validada e a meta de 70% de reutilização não são gates deste piloto.

## 7. Salvamento, interrupções e conectividade

**Decisão proposta para esta versão:** operação conectada com proteção local do trabalho em edição. Não prometer operação completa offline.

- Captura nova só vira serviço depois de “Adicionar”; enquanto digitada, é um rascunho. Isso evita linhas vazias ou acidentais.
- Após adicionar, alterações válidas são salvas automaticamente, com pequeno atraso de agrupamento e tentativa ao sair do campo. Não recriar o item em cada salvamento.
- Estados visíveis e distintos: “Salvando…”, “Salvo”, “Alterações neste aparelho” e “Não foi possível salvar. Tentar novamente”. “Salvo” exige confirmação do servidor.
- Antes de navegar dentro da visita, manter o rascunho local. Ao reabrir, oferecer “Continuar edição” quando houver conteúdo não confirmado.
- Proteção local requer persistência real, não apenas estado React. Escopar por usuário, organização, visita e item; não guardar senha da proposta ou credenciais. Descartar cópia confirmada e remover dados locais ao sair da conta.
- Se a gravação local falhar, avisar e manter a edição aberta. Não prometer recuperação após fechamento nesse caso.
- Em queda de rede, manter o conteúdo em edição e permitir retomar o salvamento quando conectado. Criar visita, mudar estruturas que dependam do servidor e gerar orçamento precisam de conexão nesta versão.
- Em conflito com alteração mais recente no servidor, mostrar as duas versões e pedir escolha; não sobrescrever silenciosamente.
- Toda ação assíncrona termina em sucesso ou erro tratável; nenhum indicador pode ficar girando indefinidamente após rejeição da chamada.
- Após gerar orçamento, impedir conversão repetida. Se houve falha de resposta, localizar o resultado já criado antes de tentar novamente.

## 8. Regras preservadas e integridade

1. Destino dos serviços continua sendo `orc_itens`. Ambiente continua em `grupo`, no formato existente. Não alterar orçamentos antigos.
2. `obra_id` permanece nulo até aprovação e posterior conversão pelo fluxo existente.
3. IA não inventa preço, medida, prazo ou escopo. A sugestão textual deve ser conferida e editável.
4. Custo e venda permanecem separados. Ausência é nulo; zero é um valor explicitamente informado, nunca padrão.
5. `orc_itens.total` é calculado pelo banco; não receber escrita direta. Cálculos da interface servem à prévia e devem ser reconciliados com o servidor.
6. Geração é transferência para rascunho. Publicar continua sendo ato humano com preço e senha; publicação permanece congelada por versão.
7. Dados gerados e vínculo entre vistoria e orçamento devem ser consistentes: sucesso só depois de itens e vínculos confirmados, com reversão ou recuperação em caso de falha parcial.
8. Alteração posterior de vistoria não atualiza itens do orçamento automaticamente. Aviso persistente: “Este levantamento já gerou um orçamento. Ajuste a proposta em Abrir orçamento”.

## 9. Direção de interface e acessibilidade

Manter identidade Obra Nova: grafite para estrutura, amarelo para ação principal e verde Arroio para medidas, usando variante de texto apropriada. Archivo para texto; IBM Plex Mono para números. Documento do cliente permanece na marca RD.

- Uma ação principal por contexto; botões secundários discretos, sem esconder a saída ou a retomada.
- Alvos de toque projetados com pelo menos 44 × 44 px, espaçamento entre ações e rótulos claros.
- Rótulos completos, como “Comprimento (m)”; placeholder não substitui label. Teclado decimal para medidas e preços.
- Corpo legível, referência inicial de 16 px nos campos; funcionar com ampliação de texto sem cortar ações.
- Não depender apenas de cor para erro, pendência ou sucesso. Anunciar salvamento/erro de forma acessível sem interromper cada tecla.
- Ordem de foco acompanha a tarefa. Folha inferior contém foco e o devolve ao item ao fechar; navegação por teclado permanece possível.
- Verificar telas de 360, 390 e 768 px, teclado virtual aberto, orientação e áreas seguras do celular. Sem rolagem horizontal no fluxo central.
- Reutilizar componentes existentes. A inclusão contínua na tela do ambiente é uma exceção proposta ao padrão atual de todo CRUD em diálogo: reduz repetição. Medidas e preço continuam em folha inferior.

## 10. Mapa de implementação

| Área existente | Mudança prevista |
| --- | --- |
| `painel-vistorias.tsx` | Retomada prioritária, busca, estados e lista simplificada |
| `tela-vistoria.tsx` | Ambiente ativo, captura contínua, folhas de medida/preço, revisão e feedback de persistência |
| `src/lib/vistoria/constantes.ts` | Tipos dos modos, regras de medição, descrições sugeridas sem preço |
| `src/lib/vistoria/acoes.ts` | Persistir valor informado; validar medidas; transferência completa e recuperação sem duplicação |
| `src/lib/vistoria/dados.ts` | Ler campos e estados necessários sem perder isolamento da organização |
| `src/lib/database.types.ts` | Regenerar a partir do schema efetivamente aplicado, quando alterado |
| Componentes comuns | Reutilizar campos, folhas, foco, mensagens e estados de carregamento |
| Documentação existente | Registrar validação pelo uso e corrigir promessa de salvamento por campo |

Dados novos propostos em `vist_medicoes`: preço de venda opcional, modo de medição e desconto de área, com nomes e tipos fechados ao inspecionar o schema real. Registros existentes devem ser tratados como quantidade manual, preservando dimensões e números, sem recalcular o histórico automaticamente.

O vínculo de origem da medição com item gerado deve permitir conferir a transferência. A estratégia de transação e de unicidade deve ser definida após verificar o banco; a checagem atual de `orcamento_id` antes de inserir, sozinha, não garante proteção contra concorrência.

Não alterar banco de produção com base apenas nos tipos do ZIP. O pacote não contém as migrações e os scripts `verificar:*` referenciados no `package.json`; recuperar esses insumos no ambiente de desenvolvimento antes de executar seus gates. Este PRD não aplica migração nem autoriza deploy.

## 11. Entregas

**Etapa 1 — Estrutura da UX:** retomada, ambiente ativo, inclusão contínua, campos progressivos e revisão. Conferir navegação em celular com dados fictícios identificados.

**Etapa 2 — Fluxo funcional:** medição explícita, preço opcional, proteção de rascunho, tratamento de falhas e conversão íntegra. Cumprir P0 antes de usar em orçamento real.

**Etapa 3 — Piloto com Reginato:** primeiro orçamento real, registrar dificuldades e ajustar. Sem sessão prévia obrigatória de validação de catálogo. Deploy segue a autorização específica exigida pelo projeto, após versão concreta verificada.

## 12. Validação pelo uso e métricas

Roteiro do primeiro uso: abrir visita de um cliente real; registrar três ambientes e dez serviços; medir o que estiver disponível; informar alguns preços; interromper e retomar; revisar; gerar rascunho; conferir itens com o levantamento. Não publicar automaticamente para testar.

Ao final, perguntar apenas: “Onde você parou para pensar?”, “O que precisou digitar de novo?” e “O que faltou para terminar?”. Registrar serviço/contexto do problema e priorizar o que bloqueou a tarefa.

| Indicador | Como observar | Meta proposta, não resultado medido |
| --- | --- | --- |
| Autonomia | Ajuda necessária para adicionar os três primeiros serviços | Completar sem orientação externa |
| Captura simples | Tempo ativo para adicionar serviço com nome disponível | Até 20 s após conhecer o fluxo, excluindo medição física |
| Perda de trabalho | Interromper durante edição e retomar | Nenhum conteúdo confirmado perdido; recuperar rascunho local conforme estado informado |
| Retrabalho | Itens redigitados no orçamento por falha de transferência | Zero |
| Integridade | Conferir dez itens, quantidades, unidades, preço e grupo | Correspondência completa |
| Clareza | Reginato identificar subtotal parcial e itens pendentes | Sem confundir com orçamento pronto para envio |
| Esforço percebido | Pergunta de facilidade de 1 a 5 após a tarefa | Pelo menos 4; investigar qualquer bloqueio independentemente da nota |

O primeiro uso orienta ajustes; não comprova ganho generalizável. Medir duração ativa na tela separada de tempo de visita. Reutilizar `pipe_tempos` para duração operacional; eventos específicos de interface, se implementados, devem registrar IDs e duração, sem texto de cliente, medidas ou preços em logs analíticos. Metas de redução percentual só depois de existir linha de base comparável.

## 13. Cenários obrigatórios antes do piloto

1. Criar visita com catálogo vazio; adicionar serviço livre e retomá-lo.
2. Calcular piso 4 × 3 = 12 m²; parede 4 × 2,8 − 2 = 9,2 m²; volume 2 × 3 × 0,1 = 0,6 m³. Valores são exemplos de teste.
3. Trocar do modo calculado para manual sem sobrescrever silenciosamente o valor escolhido.
4. Informar 12 m² e R$ 50,00; verificar R$ 600,00 na prévia e no item gerado. Deixar outro item sem preço e conferir soma parcial sinalizada.
5. Registrar cobrança global confirmada: 1 vb × valor informado, sem confundir valor total com preço por m².
6. Interromper edição, simular erro de rede, tentar novamente e conferir ausência de perda ou duplicação.
7. Gerar duas vezes rapidamente e após falha de resposta; obter um único orçamento corretamente vinculado.
8. Tentar publicar com preço ou senha faltante; verificar bloqueio. Confirmar que custo interno não aparece no documento.
9. Abrir orçamento antigo e outros caminhos de entrada; confirmar que permanecem utilizáveis.
10. Usar com teclado virtual, texto ampliado e navegação por teclado; verificar ações visíveis, rótulos e foco.

No projeto real, executar `tsc`, lint e build; recuperar os scripts de regressão existentes antes de rodá-los e conferir se usam dados de produção. Verificação visual e funcional deve acompanhar os cenários acima; este documento não afirma que essas verificações já ocorreram.

**Resultado esperado da entrega:** Reginato consegue registrar o levantamento aos poucos, entender o que falta e transformar os dados em orçamento revisável, com menos interrupções e sem depender de uma biblioteca previamente aprovada.
