# PRD — Diário de atividades

**Origem:** PRD "Diário | Obra Nova", recebido em 17/09/2026.
**Estado:** conferido contra o código e o banco `wnzdsqpsowxmistbnhca` em
17/09/2026, antes de virar escopo — o mesmo tratamento que `PRD-PIPELINE.md`,
`PRD-VISTORIA.md` e `PRD-UX-VISTORIAS.md` receberam.

O PRD está bem escrito e não supõe folha em branco em quase nada. O que ele
supõe é que **o relatório da obra já resolve o que ele pede**, e não resolve: o
link do relatório é por semana, não é fixo, e não tem senha. É daí que sai
quase todo o trabalho.

---

## 0. As premissas do PRD, conferidas

| # | O PRD supõe | Realidade | Consequência |
|---|---|---|---|
| P1 | "Reutilizar a captura e transcrição dos orçamentos, quando possível" | **Existe e foi escrito para isto.** `Composer` (texto, áudio e foto num pill só, com o comentário "hoje o canteiro, amanhã o que vier depois"), `GravadorDeAudio`, `transcrever()` com vocabulário por contexto, e o par upload-assinado + registro em degraus | Nada de gravador novo. Ver **D3** |
| P2 | Página protegida por senha, sem conta | **Existe no orçamento, não no relatório.** `/p/[token]` tem gate (`orc_orcamentos.senha`, cookie `orc_gate_<token>`, conferência no servidor). `/rel/[token]` abre para qualquer um que tenha o link | O gate é padrão pronto, mas mora dentro do módulo de orçamento. Ver **D4** |
| P3 | "O endereço permanece igual a cada nova publicação" | **O relatório da obra não faz isso.** `relatorios.token` é por semana: relatório novo, link novo. Quem faz é o orçamento, com o token no registro-pai | É a diferença estrutural do módulo. Ver **§2** |
| P4 | "O sistema respeita o fuso horário configurado para a empresa" | **Não existe coluna de fuso** em `orgs` nem em `org_ajustes` (conferido no banco). O app fixa `America/Sao_Paulo` em seis arquivos | Não construir a configuração. Ver **D6** |
| P5 | "Salvar rascunhos automaticamente" | Não há autosave em tela nenhuma hoje. Salvar é sempre ato — botão ou ação | Ver **D5**: o requisito se cumpre gravando o **registro** na hora, não com temporizador |
| P6 | "Novos registros não alteram automaticamente o conteúdo publicado" / "Publicar atualização" | O congelamento existe em duas formas: fotografia versionada (`orc_publicacoes`) e chave liga-desliga (`relatorios.publicado_em`) | Adotar a fotografia versionada. Ver **D2** |
| P7 | Reginato abre o link e consulta | **Inversão de papel.** Em todo o resto do app o Reginato *é o usuário*: ele orça, ele publica, ele vê o funil. Aqui ele é o leitor de fora, e o Rodrigo é quem escreve | Ver **§1** e **D1** |
| P8 | "Falhas na transcrição ou geração não apagam registros salvos" | **Já é o padrão da casa**, e foi caro de firmar: upload, transcrição e IA são três chamadas separadas, e o áudio fica no Storage quando a transcrição quebra | Nada a construir além de seguir o padrão |
| P9 | Calendário com navegação entre meses | O documento público **não pode depender de JavaScript**. Um limite de Suspense em `/p/[token]` deixou o cliente na tela de "Carregando…" eterna em produção — o comentário longo na página conta o caso | Calendário renderizado no servidor, navegação por link. Ver **D7** |
| P10 | O módulo é novo | Confirmado: nenhuma tabela `dia_*` no banco, e `/d` está livre entre as rotas (`admin`, `api`, `o`, `p`, `rel`) | — |

Nada do MVP sai do escopo por já existir. O que muda é **de onde cada peça
vem**: três das quatro dificuldades do PRD já foram resolvidas uma vez neste
código, em outro módulo, e o trabalho é generalizar em vez de reinventar.

---

## 1. Vocabulário: `relatorios` já é outra coisa

O nome mais perigoso do PRD é **relatório**. A tabela `relatorios` existe, é o
relatório **semanal da obra**, tem token próprio e página própria em
`/rel/[token]`. Reaproveitá-la para o diário criaria duas semânticas na mesma
tabela; ignorar que ela existe criaria dois "relatórios" no mesmo produto.

Prefixo por módulo, como `orc_`, `vist_` e `pipe_`:

| PRD | Obra Nova | Onde |
| --- | --- | --- |
| Diário | **Diário** — o canal. Um por autor e org. Dono do token e da senha | `dia_diarios` *(novo)* |
| Relatório do dia | **Relatório** — um por diário e data | `dia_relatorios` *(novo)* |
| Registro / atividade lançada | **Registro** — o material bruto, texto ou áudio | `dia_registros` *(novo)* |
| Publicação | **Publicação** — a fotografia congelada que o link serve | `dia_publicacoes` *(novo)* |
| "Informar a senha de acesso" | **Gate** | mesmo desenho de `/p/[token]` |
| Relatório semanal da obra | *(não é isto)* | `relatorios`, `/rel/[token]` — **não mexer** |

---

## 2. A diferença estrutural: o token mora no canal

É a única coisa que o PRD pede e que nenhum módulo faz hoje.

```
orçamento:  token em orc_orcamentos  → publicações versionadas  → /p/[token]    link fixo, um documento
relatório:  token em relatorios      → uma linha por semana     → /rel/[token]  link novo a cada semana
diário:     token em dia_diarios     → uma publicação por dia   → /d/[token]    link fixo, muitos dias
```

O orçamento já acerta a parte do "republicar não mata o link". O que ele não
tem é **histórico navegável no mesmo endereço**: um orçamento é um documento
só. O diário é um endereço com muitos dias atrás dele, e é por isso que o
calendário existe.

Disso decorre o formato das tabelas: o token, a senha e o autor ficam em
`dia_diarios`; o conteúdo do dia fica em `dia_relatorios`, com chave única
`(diario_id, dia)` — que é literalmente o "um relatório por autor e data" do
PRD virando restrição de banco.

---

## 3. Escopo, por entrega

### Entrega 1 — O canal e a página · **no ar em 17/09/2026**

Fecha a promessa inteira do PRD com o texto digitado. Áudio e IA são conforto
e entram na Entrega 2.

O que foi construído: `dia_diarios`, `dia_relatorios` e `dia_publicacoes` no
banco; `/admin/diario` para escrever, publicar, publicar atualização, tirar do
ar, trocar a senha e revogar; `/d/[token]` com gate, calendário e histórico;
`src/lib/acesso/gate.ts`, que o orçamento passou a usar também; e
`src/lib/tempo.ts`, que recolheu as duas cópias de "que dia é hoje".
Comportamento esperado na §16b de `TESTES-DE-COMPORTAMENTO.md`.

1. `dia_diarios` (org, autor, token, senha, título), `dia_relatorios` (diário,
   dia, as quatro seções, `atualizado_em`), `dia_publicacoes` (relatório,
   versão, dados, publicado em).
2. Tela `/admin/diario`: escrever o dia, ver o histórico, publicar.
3. Rota `/d/[token]`: gate, cabeçalho na marca da empreiteira, calendário,
   relatório do dia selecionado.
4. Publicar, publicar atualização e tirar do ar.

**Fim da entrega:** o Reginato abre um link no celular, digita a senha, lê o
dia de hoje e navega para ontem.

### Entrega 2 — Áudio e IA · **no ar em 17/09/2026**

5. `dia_registros`: texto ou áudio, vários por dia, gravados no instante em que
   entram.
6. `Composer` na tela do diário, sem o botão de foto (ver **§5**).
7. Transcrição pelo provedor que já existe, com vocabulário próprio (**D3**).
8. "Gerar resumo": a IA organiza os registros do dia nas quatro seções, sob as
   regras da §5 do PRD, que viram prompt.
9. Edição manual preservada até a pessoa confirmar a substituição.

O que foi construído além da lista: `npm run verificar:diario`, que chama a IA
de verdade contra um material armado para as armadilhas da §5 — uma frase no
futuro, uma pendência sem dono, um nome, um número e um áudio não transcrito.
É o único jeito de saber se a regra que mais importa continua valendo, porque
ela não se verifica lendo código. Ver **D10**.

### Entrega 3 — Acesso e compartilhamento · **no ar em 18/09/2026**

10. Copiar link e compartilhar no WhatsApp.
11. Trocar a senha.
12. Revogar o acesso — que **não** é a mesma coisa que tirar do ar (**D8**).

Entraram junto duas coisas que o PRD não pedia com estas palavras, e que a
leitura de ferramentas parecidas mostrou que faltavam: o **endereço próprio**
(`diario.rd.eng.br/rodrigo`, ver **D12**) e o **refino da página de leitura**
(**D13**).

### Entrega 4 — Menos digitar, mais tocar

Pedida pelo Rodrigo em 18/09/2026, depois de usar a tela: *"que ela fique
menos digitável e mais seletiva"*.

**O diagnóstico.** O diário é a escrita mais repetitiva que existe — os mesmos
projetos, as mesmas pessoas, os mesmos verbos, todo dia. A voz já tira parte
do trabalho de entrada, mas a **revisão continua sendo datilografia**: mover
"ajuste do contraste" de *Em andamento* para *Realizado* é recortar de um
campo e colar em outro. Esse é o gesto mais frequente do diário e o mais caro
da tela. E há uma repetição que ninguém devia digitar duas vezes: **o que
estava em andamento ontem é o assunto de hoje.**

Quatro camadas, nesta ordem, porque as três últimas só existem em cima da
primeira — enquanto a seção for um bloco de texto, qualquer uma delas vira
gambiarra de parsing.

**4a · Item em vez de bloco de texto** · *no ar em 18/09/2026*. As quatro seções deixam de ser
`textarea` com a convenção "um item por linha" e viram lista de itens
(`dia_itens`). Cada item tem seção, e trocar de seção é um toque. É a mais
cara: mexe no banco e no que a publicação congela.

**4b · Trazer ontem para hoje, por toque** · *no ar em 18/09/2026*. Ao abrir o dia, o que ontem estava
em *Em andamento* e em *Pendências* aparece como sugestão, com três toques
possíveis: **concluí**, **continua**, **saiu**. Um dia normal fecha sem uma
tecla.

**4c · Responsável como pastilha escolhida** · *no ar em 18/09/2026*. Um elenco pequeno por diário, e
um seletor no item. "A definir" vira opção da lista em vez de convenção de
texto. Hoje o nome é texto livre, e texto livre com nome próprio erra: a
transcrição escreve "Reginaldo" e a pastilha da página vira outra pessoa.

**4d · Revisar o resumo por aceite, não por edição** · *no ar em 18/09/2026*. "Gerar resumo" para de
escrever direto nos campos e passa a propor itens em cartões — **aceitar**,
**trocar de seção**, **descartar**, mais um "aceitar tudo". Ler e aprovar
deixa de ser reescrever.

---

## 4. Decisões

**D1 · O diário é do autor, não da obra.** O PRD diz "um relatório por autor e
data" e "vinculado ao autor e à empresa", e não menciona obra em lugar nenhum.
É coerente com quem lê: o leitor é a própria RD, então o diário não é
acompanhamento de canteiro — é prestação de contas de quem trabalha para ela.
Sem `obra_id`. Se um dia houver diário por obra, entra como coluna opcional;
nascer com ela seria inventar uma hierarquia que ninguém pediu.

**D2 · Publicar é fotografia versionada, como no orçamento.** O PRD exige que
registro novo não mexa no que já está publicado, e que a atualização seja ato
explícito. A chave `publicado_em` do relatório da obra não dá isso: ela publica
o rascunho vivo, e qualquer edição posterior vaza para o link na hora.
`dia_publicacoes` com versão resolve, e de quebra dá histórico do que foi dito
em cada versão.

**D3 · Reutilizar a captura, com vocabulário próprio.** `Composer`,
`GravadorDeAudio` e `transcrever()` entram como estão. O que **não** serve é o
vocabulário: os dois contextos de hoje (`obra`, `orcamento`) são listas de
alvenaria, contrapiso e metro linear, e o diário não fala disso. Entra um
terceiro contexto em `VOCABULARIO` — sem acento, pela razão já documentada lá
(a Groq devolve 500 com caractere fora de ASCII).

**D4 · Generalizar o gate sem reescrever o do orçamento.** O gate de hoje sabe
o nome da tabela e o prefixo do cookie. Extrair para um módulo de acesso que
receba os dois, e fazer o orçamento passar a usá-lo — **preservando a lição do
`path: "/"`**: o cookie já esteve em `/p/${token}` e isso quebrava o domínio
`orcamentos.rd.eng.br`, onde um rewrite serve `/p/nome` a partir de outro
caminho. O isolamento entre links está no nome do cookie, não no path.

**D5 · "Salvar automaticamente" se cumpre gravando o registro, não com
temporizador.** O material que não pode ser perdido é o que a pessoa falou ou
digitou, e ele vira linha no banco no instante em que entra — é o desenho que
já existe em `orc_blocos` e `confirmacao_blocos`. O resumo editado à mão salva
ao sair do campo e ao gerar. Um autosave por temporizador, além de não existir
em lugar nenhum do app, falha em silêncio, que é o pior jeito de falhar.

**D6 · Fuso: centralizar a constante, não criar configuração.** Hoje
`America/Sao_Paulo` está escrito em seis arquivos. A RD é de Fortaleza, que tem
o mesmo deslocamento desde o fim do horário de verão em 2019 — na prática o app
já acerta a data do Reginato. O trabalho útil é uma função só
(`hojeNaEmpreiteira()`) que os seis lugares passem a chamar, deixando **um**
ponto para mudar no dia em que houver empreiteira em outro fuso. Uma coluna de
fuso que ninguém preenche é pior que a constante: dá a impressão de
configurável e nunca foi testada com outro valor. *Isto cumpre o critério de
aceite em efeito, não em forma — registrado aqui para não parecer esquecimento.*

**D7 · O calendário não pode depender de JavaScript.** Estado na URL
(`/d/[token]?dia=2026-09-17`), meses navegados por `<a>`, tudo renderizado no
servidor. A página do orçamento já pagou essa conta uma vez, em produção, com o
cliente preso numa tela de carregando.

**D8 · Revogar e tirar do ar são ações diferentes.** Tirar do ar volta uma
publicação para rascunho, e o link continua valendo para os outros dias.
Revogar troca o token, e com isso **mata o link que já foi para o WhatsApp** —
o oposto da promessa do endereço fixo. As duas existem, com nomes diferentes, e
a de revogar avisa o que vai acontecer antes de acontecer.

**D9 · A barra do celular ganha um "Mais"** — decisão do Rodrigo em
17/09/2026, sobre a recomendação anterior de simplesmente entrar como nono
item. O padrão é o de superapp: quatro destinos de rotina em aparelho — Painel,
Obras, Vistorias, Orçamentos — e o quinto alvo abre a gaveta com o resto
(Pipeline, Transcrições, Preços, Diário, Perfil). Funcionalidade nova entra ali
sem apertar quem já estava. **A lateral do desktop não muda de regra:** lá
sobra altura, os nove continuam à vista, e a ordem é a do fluxo de trabalho —
Pipeline antes de Orçamentos —, não a de frequência.

*A barra estava em `grid-cols-6` com oito itens, ou seja, já quebrava em duas
fileiras antes do Diário existir.*

**D10 · A §5 do PRD vira teste, não só prompt.** Escrever as regras no prompt e
torcer não é verificação: o modelo muda, a Groq troca o catálogo, e a regra que
mais importa — planejamento não vira atividade concluída — falha em silêncio,
com o texto saindo bonito e errado. `npm run verificar:diario` cria um diário
de teste, chama a IA e confere o resultado item a item, apagando tudo no fim.
Foi ele que pegou o primeiro erro real: "amanhã eu vou publicar" saía como
`A definir`, e quem lê entende "ninguém assumiu". O nome do autor passou a
entrar no prompt — dizer de quem é a primeira pessoa do texto não é inventar
responsável.

**D11 · O nome de quem assina entra no prompt, o resto não.** A IA recebe os
registros do dia e o nome do autor. Não recebe orçamento, obra, cliente nem
histórico: material a mais é material para ela misturar, e o PRD pede para
organizar o que foi fornecido, não para cruzar fontes.

**D12 · O endereço próprio convive com o token, não o substitui.**
`diario.rd.eng.br/rodrigo` é um rewrite por host, como o
`orcamentos.rd.eng.br` já faz, e a rota de destino continua sendo `/d/[token]`
— que passou a resolver apelido **ou** token. O link antigo não podia morrer:
a Entrega 1 prometeu endereço fixo, e trocá-lo seria quebrar a promessa no
lugar exato onde ela foi feita.

Três consequências que não são óbvias:

- **`afterFiles`, não `beforeFiles`.** `beforeFiles` roda antes de olhar o
  sistema de arquivos, e `/:apelido` engoliria `/favicon.ico` e o `public/`.
- **A senha passa a ser a única barreira.** `/d/<32 caracteres>` não se
  adivinha; `/rodrigo` se adivinha na primeira tentativa. A trava de publicar
  sem senha, que já existia, deixa de ser zelo e vira o que segura a porta.
- **Revogar derruba o apelido junto.** Trocar só o token deixaria de pé
  justamente o endereço que circula e que é fácil de adivinhar — não seria
  revogação nenhuma.

**D13 · O que a pesquisa de ferramentas parecidas mudou na página.** Lido em
ferramentas de status assíncrono e em apps de diário de obra (Raken, Houzz
Pro, ConstructionOnline), três coisas se repetem e duas delas faltavam aqui:

1. **Primeiro o que ficou pronto**, depois o que continua, depois o que
   travou, por último o que vem. Já era a ordem do PRD; ficou confirmada.
2. **Bloqueio precisa de peso visual próprio.** Quatro listas idênticas
   obrigam a ler tudo para descobrir o que pede ação. Pendência passou a ser a
   única seção desenhada como cartão, com rail âmbar.
3. **O responsável na frente.** Pendências e próximos passos saem no formato
   `Responsável: o que precisa acontecer`, e a página desenha o nome como
   pastilha — quem lê acha o próprio nome sem ler a frase inteira. "A definir"
   sai em cinza e itálico: é a ausência de dono, e parecer um nome faria
   procurar por uma pessoa chamada A Definir.

E uma quarta, que veio de olhar o caso de uso em vez do concorrente: quase
toda consulta é "hoje" ou "ontem", e abrir calendário para isso é atrito em
cima do caso comum. A **fita dos últimos dias** resolve o comum num toque, e o
calendário volta a ser o que ele é bom: achar data distante.

**D14 · A sugestão de ontem nunca entra sozinha.** É a regra que sustenta a
Entrega 4 inteira, e a única que não pode dobrar por conveniência de tela. Se
um item reaparecer como "realizado" sem alguém ter tocado, é exatamente a
mentira que a §5 do PRD proíbe: planejamento virando entrega. A tela sugere; o
dedo decide. Por isso a sugestão vive **fora** do relatório do dia até ser
aceita — ela não é um item com estado "pendente de confirmação", ela ainda não
é um item.

**D16 · A IA propõe; ela não escreve no relatório.** Foi o que fez o diálogo
de confirmação desaparecer. Enquanto gerar o resumo apagava os itens e
escrevia os dela por cima, a tela **precisava** perguntar "quer mesmo
substituir o que você escreveu?" — e a pergunta era um remendo para um desenho
errado. Com a proposta numa tabela ao lado, o que está escrito nunca é tocado,
e não há o que confirmar. A regra da §5 ("preservar edições manuais até o
usuário confirmar a substituição") passa a ser cumprida por construção, e não
por diálogo.

**D17 · A IA não corrige nome próprio.** Descoberto pelo `verificar:diario`,
que na primeira versão exigia que "Reginaldo" virasse "Reginato" e falhou: o
modelo recusou, com razão. Trocar um nome que ela não pode conferir é inventar
responsável — e se Reginaldo for outra pessoa? O elenco no prompt serve para a
**grafia** de quem foi citado, não para adivinhar quem é quem. Quem desfaz a
confusão é o dedo: item com responsável fora do elenco fica âmbar no seletor, e
um toque resolve. A tela marca, não corrige.

**D15 · O item guarda de onde veio.** `dia_itens.origem` (`ia` / `humano`) é a
mesma coluna que `orc_itens` tem, pelo mesmo motivo: separar o que a máquina
escreveu do que a pessoa escreveu não é enfeite, é o que permite saber depois
se a IA está ajudando ou atrapalhando. Um item da IA que a pessoa editou passa
a ser `humano` — mão humana marca a linha.

---

## 5. Fora do escopo

Os cinco itens da §8 do PRD seguem fora: notificação automática por WhatsApp,
comentário e aprovação do Reginato, confirmação de leitura, relatório semanal e
indicadores, e integrações com Canva, Instagram e Google Agenda.

Mais dois, que o PRD deixa implícitos e é melhor deixar escritos:

- **Foto.** O PRD diz "aceitar áudio e texto", e só. O `Composer` tem o botão
  de câmera; na tela do diário ele fica escondido. Foto muda o custo da página
  (URL assinada, validade, bucket privado) e o PRD não pediu.
- **Diário com mais de um autor no mesmo link.** "Um relatório por autor e
  data" é por autor. Dois autores são dois diários e dois links.

---

## 6. Critérios de aceite

Os dez do PRD valem como escritos, com uma correção e uma adição:

- **Corrigido:** "o sistema respeita o fuso horário configurado para a empresa"
  vira "as datas do diário são resolvidas no fuso da empreiteira, hoje uma
  constante única no código" — ver **D6**.
- **Adicionado:** a página abre e imprime com JavaScript desligado, e o
  calendário continua navegável — ver **D7**.

---

## 7. Riscos e pendências

- **A senha é texto puro no banco.** É o desenho vigente do `/p/[token]`, e a
  decisão registrada em `PLANO-PORTAL-CLIENTE.md` é "senha simples, sem conta".
  O diário segue o precedente para não criar dois modelos de acesso; o dia em
  que isso mudar, muda para os dois juntos.
- **Teto de 60s da função na Vercel.** Transcrição e IA são chamadas separadas
  justamente por isso, e o provedor já tem teto de 35s. A tela do diário nasce
  com `maxDuration = 60`, como as outras que transcrevem.
- **25 MB por áudio**, herdados da importação avulsa. Áudio longo de diário
  passa fácil disso se alguém gravar meia hora — vale medir antes de prometer.
- **Sem testes automatizados**, como o resto do projeto. A verificação é `tsc`,
  `eslint`, `build` e medição no navegador; o comportamento esperado entra em
  `TESTES-DE-COMPORTAMENTO.md` junto com a Entrega 1.
