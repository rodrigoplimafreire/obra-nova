# Obra Nova

Três módulos, um app, o mesmo ciclo de trabalho da empreiteira.

**Orçamento** é a entrada: o serviço é contado por áudio, a IA transcreve e já
escreve as linhas da tabela de custos, e sai o documento com link e senha para o
cliente. Aprovado, o orçamento vira obra num clique.

**Transcrição** é a porta de entrada de fora: o cliente manda áudio no
WhatsApp, o empreiteiro baixa e importa aqui. O texto sai em segundos, dá para
copiar para qualquer lugar, e dele nasce um orçamento com a tabela já montada.

**Relatório** é o acompanhamento: toda semana o cliente abre um link e vê foto,
relato e o que vem em seguida, sem o empreiteiro perder tempo explicando por
WhatsApp.

Orçamento e obra se conhecem por `orc_orcamentos.obra_id`, nulo até o cliente aprovar —
quase todo orçamento nasce antes da obra existir, porque é ele que decide se ela
vai existir.

**Modelo de operação: white label com onboarding manual.** O setup de cada
cliente é feito por nós, não por autoatendimento. Não existe cadastro público,
trial nem cobrança dentro do produto — isso é contrato, fora do sistema.

## Origem

Fork de `entrevista-async`, do qual saiu toda a superfície de entrevista
(pesquisas, `/r`, `/spike`, análise, export). O que ficou é o módulo de obra,
já testado em aparelho real: canteiro, relatório e a página do cliente.

## Stack

Next.js 16 (App Router, Server Components, Server Actions) · TypeScript ·
Tailwind 4 · Supabase (Postgres, Storage, Auth) · deploy na Vercel.
Sem Vite, sem SPA, sem gerenciador de estado global.

## Rodar local

```bash
npm install
cp .env.local.example .env.local   # preencha
npm run dev
```

## Rotas

| Rota | Quem abre |
| --- | --- |
| `/admin/obras` | painel: lista de obras, com pendência do dia |
| `/admin/obras/[id]` | a obra: checklist do dia, equipe, relatório da semana |
| `/admin/orcamentos` | painel: lista de orçamentos, com o que está sem preço |
| `/admin/orcamentos/[id]` | o orçamento: dados, tabela de custos, virar obra |
| `/admin/transcricoes` | painel: os áudios importados e o que saiu deles |
| `/admin/transcricoes/[id]` | a transcrição: texto editável, copiar, virar orçamento |
| `/admin/precos` | painel: bases de preço (SINAPI/SEINFRA/própria), import |
| `/p/[token]` | o cliente da RD: o orçamento publicado, com senha e aceite |
| `/o/[token]` | o mestre, no canteiro: a semana dele |
| `/o/[token]/a/[atividadeId]` | confirmar um serviço com foto, áudio e texto |
| `/rel/[token]` | o cliente final: o relatório publicado |

## Decisões que valem lembrar

### Do módulo de orçamento

- **A IA não escreve HTML.** Ela devolve JSON validado e o React renderiza. É o
  que garante que todo orçamento saia na mesma tabela, com a mesma impressão.
- **A IA não inventa preço.** Valor que não foi falado fica `null` e aparece
  marcado. `0` sairia impresso como "de graça"; `null` sai como "sem preço" e
  bloqueia o envio.
- **`orc_itens.total` é coluna gerada pelo banco.** Com a conta em código, tela
  e PDF arredondariam em dois lugares e um dia divergiriam num centavo.
- **Publicar congela por versão.** `orc_publicacoes` guarda a fotografia do
  documento; editar o rascunho depois não muda o que o cliente já viu. O token
  fica no orçamento, então republicar não mata o link que já foi.
- **Apagar item é reversível** enquanto é rascunho (`removido_em`), e apagar o
  orçamento inteiro limpa os áudios no Storage — a cascata do banco não alcança
  o bucket.
- **Cada item guarda `origem` e `editado_em`**, para a regeração mesclar em vez
  de atropelar a correção humana.

### Da base de preços

- **Custo e venda são colunas separadas, sempre.** `orc_itens.custo_unitario`
  é o que a obra gasta (tabela ou digitado); `valor_unitario` é o preço de
  venda, o que sai no documento. O custo **nunca** vai para o cliente — vive
  só no editor, como dado de decisão.
- **Uma base é uma fotografia.** "SEINFRA-CE, 07/2026" não muda depois de
  importada, pelo mesmo motivo de `orc_publicacoes`: um item que aponta para
  uma composição não pode ver o custo mudar debaixo dele sem aviso.
  Reimportar cria base nova; a antiga vira `ativa = false` e some da busca,
  mas os itens que já usaram um custo dela continuam com o número guardado
  (é cópia, não referência ao vivo).
- **A busca usa `word_similarity`, não `ILIKE`.** Comparar a string inteira
  reprovaria "forro pvc" contra "Forro de PVC branco, com acabamento em
  réguas" pela diferença de tamanho — o pg_trgm tem uma função para achar o
  melhor trecho, e é essa que a RPC `orc_buscar_composicoes` usa.
- **BDI é sugestão, não trava.** `orc_orcamentos.bdi_padrao` só pré-preenche o
  preço de venda quando o campo está vazio; editar por cima nunca é
  sobrescrito por uma escolha de composição depois.
- **Import é em lotes, não um upload só.** A Server Action tem teto de
  payload e o SINAPI completo passa de 10 mil linhas — o cliente parseia a
  planilha (biblioteca `xlsx`, no navegador) e manda em pedaços de 500.
- **Mapeamento de coluna genérico, não leitor de SINAPI.** O XLSX da Caixa
  tem cabeçalho em várias linhas e célula mesclada; um leitor dedicado
  quebraria a cada mudança de layout. E o Reginato provavelmente tem a
  própria planilha de preços, que vale mais que a pública.

### Do módulo de Transcrição

- **Tabela própria, não `orc_blocos`.** A transcrição nasce antes de existir
  orçamento e pode nunca virar um — muito áudio de cliente é pergunta,
  reclamação ou combinação de horário. Pendurá-la num orçamento obrigaria a
  criar um só para receber o áudio.
- **O `.opus` do WhatsApp chega sem tipo declarado.** O navegador não reconhece
  a extensão e manda `application/octet-stream` ou string vazia. Por isso a
  validação de verdade é a **extensão do arquivo**, e o nome original viaja até
  o provedor: é ele que decide o container pela extensão que recebe.
- **Corrigir o texto carimba `editado_em`**, e transcrever de novo respeita o
  carimbo. Mesma regra dos itens do orçamento: mão humana marca a linha.
- **Virar orçamento roda a mesma IA do "Falar orçamento".** Podia só colar o
  texto numa observação, mas aí sobraria para a pessoa ler e digitar os itens —
  que é exatamente o trabalho que o módulo existe para tirar.
- **A ponte é de mão dupla.** Da transcrição sai "Criar orçamento", para quem
  começa pelo áudio; de dentro da tabela de custos sai "Usar uma transcrição",
  para quem já está com o orçamento aberto e lembra que tem o áudio guardado.
  Só o primeiro sentido deixava a segunda pessoa criando um orçamento paralelo
  para depois juntar os dois à mão.
- **Uma transcrição pode alimentar mais de um orçamento.** Obra grande se
  divide em etapas, e o áudio que fala das duas serve para as duas.
  `transcricoes.orcamento_id` marca só o primeiro destino.
- **O que o cliente usa mora em `tipos.ts`.** As telas são componentes cliente,
  e importar `nomeDaTranscricao` do módulo de dados arrastava `supabaseAdmin` e
  `next/headers` para o bundle do navegador. `tsc` não vê essa fronteira; só o
  build (ou abrir a página) acusa.

### Da voz

- **Cada fala processa só a si mesma.** `montarTabelaDaFala` recebe o `blocoId`
  e não só o orçamento. A primeira versão lia todos os blocos, o que servia
  para "um briefing, uma geração" mas não para o fluxo real, que é
  incremental: a cada nova fala a IA relia a conversa inteira e reescrevia
  tudo, e o insert acrescentava. Medido em produção — 8 falas viraram 52 itens
  onde deviam ser 13, e o total geral saiu 3,74× maior que o real.
  Regressão coberta por `npm run verificar:falas`.
- **Índice único não resolveria isso**, diferente do caso de `orgs.name`: duas
  linhas idênticas na tabela de custos podem ser legítimas (duas portas iguais
  em cômodos diferentes). A guarda tem que ser lógica de aplicação.
- **Toda chamada a provedor externo tem teto, e o teto cabe dentro da função.**
  Sem `AbortSignal.timeout`, o `fetch` do Node espera indefinidamente quando a
  Groq pendura a conexão. Mas teto não basta: com 60s, o timeout disparava aos
  61,3s e gravava o erro no banco **depois** de a plataforma já ter cortado a
  resposta — o aparelho nunca recebia nada. Hoje são 35s nas duas chamadas,
  contra `maxDuration = 60` na página do orçamento.
- **O cliente envolve tudo em try/catch.** Server Action que *lança* — conexão
  de celular que cai, resposta cortada — rejeita a promessa, e sem captura
  nenhum `setErro` roda: o progresso fica girando para sempre. Congelar em
  "Transcrevendo" foi exatamente isso.
- **Falhar não custa a gravação.** O `blocoId` fica no estado, e "tentar de
  novo" retoma da transcrição em vez de mandar gravar outra vez. A transcrição
  é o passo mais frágil da corrente e o áudio já está salvo quando ela quebra.
- **Placeholder de campo que cresce sozinho tem que caber em uma linha.** A
  altura vem do `scrollHeight`, e com o campo vazio o navegador reporta uma
  linha — o placeholder não entra na conta e o que passa disso é cortado.
  Medido: "Prefira gravar, ou escreva aqui" pedia 201px onde havia 155.
- **Falar dá em linha de tabela, não em questionário.** A primeira versão fazia
  a IA devolver de três a oito perguntas antes de orçar. Na prática era um
  desvio: quem falou o serviço inteiro tinha que responder de novo, por escrito,
  o que já tinha dito. Hoje a transcrição vira direto item na tabela, e a edição
  acontece onde ela já existia — na própria tabela.
- **O que não foi falado fica nulo.** A IA não estima preço nem inventa medida;
  quantidade e valor que não saíram da boca do empreiteiro voltam `null`, e a
  tela lista o que ficou faltando. `semPreco` já bloqueia a publicação, então o
  buraco é visível sem precisar virar pergunta.
- **Três chamadas ao servidor onde caberia uma.** `registrarAudio`,
  `transcrever` e `montarTabela` são separadas porque o progresso precisa de
  degraus para mostrar: a queixa que originou a tela foi justamente a interface
  parada por vários segundos depois de parar a gravação. Falhar no meio não
  perde o que já foi feito.
- **Etapa e erro são estados separados no cliente.** Juntá-los apagava a
  informação de *onde* parou; com os dois, a lista marca qual passo quebrou.
- **Importar planilha existe ao lado de falar.** Nem todo orçamento nasce da
  voz — quando já existe tabela pronta, o caminho curto é o mapeamento de
  coluna, o mesmo da base de preços.
- **A transcrição roda aguardando.** Quem acabou de falar está olhando a tela, e
  é o único momento em que a espera é aceitável. Se falhar, o áudio continua
  guardado — o que foi falado nunca se perde.
- **`mimeEscolhido`, não `mimeDoBlob`:** no WebKit o blob volta com `type`
  vazio, e é o que pedimos ao MediaRecorder que descreve o arquivo.

### Dos textos do documento

- **A tabela sozinha não é uma proposta.** Toda proposta que a RD monta à mão
  abre apresentando o serviço, explica o que vem antes dos números, fecha
  dizendo o que está incluso, e lista observação técnica e as etapas da obra.
  O app produzia só a tabela, e o resultado lia como planilha exportada. Os
  campos de texto e a tabela `orc_secoes` existem para fechar essa distância.
- **Aqui a IA pode escrever, e em `itens-da-fala.ts` não podia.** A diferença
  não é de confiança no modelo, é de custo do erro: número errado vira
  prejuízo e passa despercebido na conferência; prosa errada aparece na hora,
  na tela, e se corrige digitando. O que continua proibido é inventar **fato**
  — medida, prazo, material ou garantia que não esteja na tabela nem na fala.
- **Regra mecânica se aplica em código, não em prompt.** Pedir "só a inicial
  maiúscula" deu Title Case numa rodada e minúscula na outra; a função
  `capitalizar` resolveu de vez. O prompt orienta estilo, o código garante
  forma.
- **Reescrever com IA substitui o que a IA escreveu e preserva o que a mão
  tocou.** Blocos `origem = 'ia'` são apagados e refeitos; os editados viram
  `humano` e sobrevivem. Os quatro parágrafos soltos só são preenchidos quando
  estão vazios.
- **Texto que falta não bloqueia publicar**, diferente de preço que falta.
  Cada campo vazio tem uma frase padrão no documento, e a numeração das seções
  é calculada — orçamento sem "O projeto" abre no 01, não no 02.

### Da identidade da empreiteira

- **O logotipo é da empreiteira; a foto é do usuário.** Moram na mesma tela e
  em lugares diferentes: o logotipo em `orgs.logo_caminho`, porque assina o
  documento do cliente; a foto no `user_metadata` do Auth, porque é da pessoa e
  não sai do painel.
- **O bucket `marca` é público, e é de propósito.** O logotipo é lido pelo
  cliente na página do orçamento e do relatório, sem sessão. URL assinada
  expiraria e quebraria documento já publicado.
- **Logotipo e contato são lidos ao vivo, não da fotografia publicada.**
  Publicar congela conteúdo e preço — é disso que o cliente precisa poder
  confiar. Papel timbrado é outra coisa: trocar o logo ou o telefone tem que
  valer para o documento que já está na rua, senão a empreiteira precisa
  republicar tudo para o cliente conseguir ligar.
- **`orgs.name` continua sendo a chave técnica** (nasce como o e-mail, tem
  índice único). Quem aparece para o cliente é `nome_exibicao` — separar os
  dois evita que renomear a empreiteira esbarre na unicidade.

### Da publicação e do acompanhamento

- **O custo é deixado para trás em `lib/orcamento/publicacao.ts`.** A garantia
  não é "o template não renderiza": `montarDocumento()` constrói um objeto novo
  que não tem `custo_unitario`, margem nem BDI, e é esse objeto que vira
  `orc_publicacoes.dados`. Qualquer tela futura que leia o documento vai ler
  dali e continuar sem acesso ao custo. Verificado no HTML servido: zero
  ocorrências de custo, margem, BDI ou composição.
- **Publicar congela.** O rascunho continua editável; o cliente só vê conteúdo
  novo quando alguém publica de novo, e aí vira v2. O token mora no orçamento,
  não na publicação — republicar não mata o link que já foi.
- **Dois eixos, duas colunas.** `status` é o preparo do documento; `situacao`
  é a conversa com o cliente (enviado, visto, negociando, aprovado, recusado,
  expirado). Antes era um enum só, que nunca saía de `briefing` e mostrava
  "Gravando" para sempre na lista.
- **"Visto" é medido, não declarado.** A página é servida por nós, então a
  abertura é registrada — mas só depois do gate de senha, senão o robô de
  preview do WhatsApp contaria como leitura. Por isso `visto` não está na lista
  de situações marcáveis à mão: transformaria um fato em opinião.
- **O aceite nasce do lado de fora.** O botão está na página do cliente, não no
  painel. Vira prova do combinado para os dois lados e não depende de a
  empreiteira lembrar de marcar. `valor_aprovado` é cópia congelada no
  instante do aceite.
- **Publicar exige preço em tudo e senha definida.** Item sem valor de venda
  viraria linha em branco no documento, e link sem senha é link aberto para
  quem receber encaminhado.

### Da porta de entrada

`/admin/login` tem três modos num componente só (`Autenticacao`), trocados por
estado local — sem navegação, porque "esqueci a senha" é a mesma pessoa
mudando de ideia sobre qual formulário preencher, não uma rota diferente.

- **Criar conta é diferente de ganhar acesso.** A conta nasce no Supabase
  Auth; quem decide se ela entra no painel continua sendo a
  `ADMIN_EMAIL_ALLOWLIST`. O formulário de cadastro checa a lista **depois**
  de criar a conta (`emailNaAllowlist()`, em `acoes-sessao.ts`) e diz a
  verdade: pode ter criado a conta e ainda não ter acesso. Se a confirmação
  por e-mail estiver desligada e a conta não estiver na lista, a sessão recém
  aberta é encerrada na hora — não faz sentido segurar login que não abre
  nada.
- **Recuperação de senha nunca confirma se a conta existe.** Diferente do
  login (onde "senha incorreta" é uma mensagem aceitável, porque quem tenta já
  declarou saber de uma conta), aqui a mensagem de sucesso é **sempre a
  mesma**, exista ou não o e-mail — é a própria regra do Supabase, e o código
  não tenta ser mais específico que o backend.
- **`/admin/redefinir-senha` fica fora do grupo `(painel)`**, como o login: o
  link do e-mail monta uma sessão de recuperação, não uma sessão de admin, e
  `exigirAdmin()` mandaria essa pessoa de volta para o login antes de ela
  trocar a senha.
- Ouve `onAuthStateChange`, não checa a sessão uma vez só: o
  `@supabase/ssr` processa o token da URL de forma assíncrona, e checar no
  primeiro render quase sempre pegaria o estado de antes dela existir.

### De desempenho e espera

- **`exigirAdmin()` é memoizada com `cache()` do React.** Não é enfeite: cada
  chamada faz uma ida à rede (`getUser()` valida o JWT no Supabase, não lê
  cookie local) mais uma consulta ao banco. E ela é chamada em cascata — o
  layout chama, e cada função de dados chama de novo por dentro de
  `orgAtual()`. Numa tela de orçamento eram três, mais a do proxy: quatro
  validações contra São Paulo para desenhar uma página.
- **Depois do login, navegação dura (`window.location.assign`).** O roteador
  guarda em cache a resposta RSC de cada rota; `/admin` já tinha sido visitada
  deslogada, respondendo com o desvio para o login. Navegar por dentro do
  roteador servia essa cópia velha, e a pessoa voltava para o login — daí o
  "preciso sair e entrar de novo". Um carregamento completo, uma vez por
  sessão, é barato perto de depender de corrida entre cache e cookie.
- **`loading.tsx` em toda rota do painel**, com esqueleto no formato da tela
  que vem depois. O documento define as cores (`#EDEEEC` no que é título,
  `#F5F2EC` no texto); a pulsação é acréscimo nosso, porque esqueleto parado
  numa conexão ruim é indistinguível de tela quebrada.
- **`.btn-carregando` + `.girando` para botão trabalhando.** Trocar só o texto
  deixa a dúvida de se o clique pegou, e num botão de ícone `disabled` sozinho
  é idêntico a "não funcionou".
- A página do cliente tem esqueleto próprio, escuro: ela abre na rua, no
  celular, muitas vezes com sinal ruim — e tela branca ali parece link
  quebrado.

### Dos dois módulos

- **Bucket privado, sempre.** Upload por signed URL direto do navegador para o
  Storage; leitura por URL assinada de validade curta. Os bytes não passam pela
  Vercel, que tem teto de 4,5 MB por requisição.
- **A leitura pública não usa a chave anônima.** `/rel/[token]` é Server
  Component com service key e só devolve `publicado_em` preenchido e
  `status = 'pronto'`. Não publicado responde 404 igual a token inexistente.
- **Publicar é ato humano.** O texto é escrito por IA a partir das transcrições;
  ninguém manda para quem paga a obra sem alguém ler e liberar.
- **Editar o checklist não apaga evidência.** Atividade que já tem confirmação
  não é removida — vai para o fim da lista, com aviso.
- **O dia é resolvido no fuso de São Paulo**, nunca no do servidor. A Vercel roda
  em UTC e depois das 21h o checklist apareceria vazio, na data errada.
- **Duração de áudio por cronômetro**, nunca por metadata: o container sai sem
  cabeçalho e `audio.duration` vira `Infinity`.

## Duas marcas, dois papéis

O **painel é sempre Obra Nova**: é a ferramenta, e quem olha para ela é a
empreiteira. O **documento do cliente carrega a marca de quem executa a obra**,
escolhida por orçamento em `orc_orcamentos.marca` — receber um preço assinado
por outra empresa confunde quem está contratando.

O registro de temas fica em `src/lib/orcamento/marcas.ts` e os arquivos em
`public/marcas/`. A RD entra com o `brand.css` original de
orcamentos.rd.eng.br, sem tradução para Tailwind: aquele sistema é canônico e a
impressão A4 dele já passou por três armadilhas resolvidas (logo esticada pelo
flex da capa, `h1` global vencendo o branco do título, e margem "nenhuma" do
Chrome descartando o `@page`).

Empreiteira nova é uma entrada no registro mais a folha dela em `public/marcas/`.
Nada de migração: a coluna guarda só a chave, e por isso é `text` e não enum.

## Design System

Implementado a partir de `Obra Nova Design System.dc.html`, no projeto
**Identidade Obra Nova** (`3e53a66c-05ab-4c38-8659-c8a3d67804ff`), lido pelo
DesignSync. Os tokens e componentes vivem em `src/app/globals.css`.

O que o documento fixa e o código segue:

- **Raio curto**, porque a marca é angular: `0` tabela e faixa, `4` botão e
  campo, `8` card e modal, pílula só em selo de estado. Nada mais é pílula.
- **Cinco variantes de botão** e nada além: `.btn-primario`, `.btn-secundario`,
  `.btn-sutil`, `.btn-perigo`, `.btn-texto`. Um único botão amarelo por tela.
- **Três alturas**: 32 compacto, 40 padrão, 52 campo. O de campo é o único
  usado no mobile — no canteiro o alvo precisa ser grande.
- **Desabilitado tem cor própria**, não `opacity`: opacidade sobre amarelo vira
  um bege que parece um terceiro estado.
- **Campo de 44 no desktop, 52 no mobile**, rótulo sempre acima e sempre
  visível. Placeholder não substitui rótulo: no sol do canteiro, cinza claro
  desaparece. Erro é texto, não só borda vermelha.
- **Aviso é faixa lateral de 4px** na cor do estado, sobre branco, sem raio —
  não caixa tingida.
- **Número que se compara é mono tabular alinhado à direita**, sempre.
- **Campo de número tem máscara**, em `components/comum/campos.tsx`. Dinheiro
  entra pela direita como no caixa eletrônico (digitar 1‑2‑3 vira R$ 1,23), e
  a pessoa nunca precisa digitar a vírgula. Telefone abre parêntese no DDD e
  põe o hífen na posição certa para 8 ou 9 dígitos.

  Duas funções por campo, e a distinção importa: **formatar o que se digita**
  não é **exibir o que veio do banco**. Passar `18.5` guardado pela máscara de
  digitação daria R$ 1,85.

  A máscara é só apresentação — o que trafega no `FormData` é o texto
  formatado, e quem lê do outro lado é `lerNumero()`, que já entende
  "R$ 1.234,56". Nada de campo escondido com o valor cru: dois valores para o
  mesmo dado é chance de divergirem.

### Sobre a dica de ajuda

`.dica::after` foi abandonado. A casca usa `overflow-clip` nos containers e a
tabela de custos rola na horizontal — dica ancorada no próprio elemento era
recortada em toda borda, e as variantes `dica-cima`/`dica-esq` só remendavam
os casos que alguém lembrava de marcar.

O componente `<Dica>` renderiza o balão num **portal no `body`**, com
`position: fixed`: nenhum ancestral recorta, e a posição sai da medida real da
tela — vira para cima quando não cabe embaixo e encosta na margem em vez de
sair pela lateral. Ninguém declara direção.

Só onde existe mouse. No toque o balão fica preso depois do tap; nesses
aparelhos a informação vive no texto de apoio do campo.
- **Todo CRUD acontece em diálogo**: modal centrado no desktop, folha de baixo
  no celular. `src/components/comum/dialogo.tsx`, sobre `<dialog>` nativo.

### Sobre o `<dialog>`

O elemento nativo entrega de graça, e correto, o que uma `div` com
`position: fixed` erraria: foco preso no painel, Esc, resto da página inerte
para leitor de tela, e camada de topo — sem `z-index` disputando com a barra
lateral.

Três coisas ficaram por nossa conta:

- **O `cancel` não borbulha**, e o React delega eventos na raiz da árvore. O
  `onCancel` como prop do JSX nunca dispara: o Esc fecharia o elemento sem
  avisar o React, deixando o estado dizendo "aberto" com a tela fechada. Por
  isso o listener é nativo, num `useEffect`.
- **A rolagem do corpo trava na mão.** O fundo fica inerte, mas continua
  rolando atrás no iOS.
- **Clique no fundo tem como alvo o próprio `<dialog>`**, então comparar
  `event.target` com a referência basta para fechar.

No celular o rodapé é `column-reverse`: a ação principal aparece **em cima**,
onde o polegar alcança, enquanto no DOM ela continua sendo a última — ordem de
tabulação e de leitor de tela permanecem as convencionais.

Antes disso o código tinha botões-pílula, cards de raio 24 e uma variante de
entrada inventada com disco amarelo. Nada disso existia no sistema.

## Marca do produto

Manual Obra Nova v1.0, importado do projeto de design.

O símbolo são **sete vias que se abrem a partir de um centro vazio** — repetição
radial das duas hastes verticais, com o miolo livre de propósito.

**Cores.** Amarelo Obra `#F7E407` e Grafite `#14181A` mandam. **Arroio
`#2E7D74`** é a cor do dado que corre: progresso, medição. Concreto e Cal só
sustentam.

A regra que o código segue:

- **grafite é estrutura** — superfícies escuras, botões redondos, texto
- **amarelo é o acento, um por tela** — a ação principal é área cheia de
  amarelo com texto grafite; como texto só na variante `amarelo-tinta`
- **arroio é medida, nunca ação** — barra de progresso, número que diz quanto
  andou. Como texto pequeno, `arroio-tinta`: o tom cheio dá 4,3:1 sobre cal e
  reprova na AA

Tipografia: **Archivo** para tudo que fala, **IBM Plex Mono** para tudo que
mede. Sem serifada.

O logotipo é arquivo de contorno fechado — nunca redigitado em Archivo. Vive em
`public/marca/` e entra por `mask-image`, então a cor vem de `currentColor`: as
três variantes do manual (grafite, cal e amarelo) são a mesma geometria pintada
pelo contexto, em vez de três arquivos que divergem com o tempo. Trocar o
desenho é trocar dois arquivos, em `src/components/marca.tsx`.

A **redução mínima de 28px** do manual está no código, não na disciplina:
`Monograma` e `Logotipo` fazem `Math.max` com ela. Abaixo disso os vértices
fecham entre si e o miolo some.

## O link do escritório

Toda obra nasce com um mestre chamado **Escritório**, criado junto com ela. É
por esse link que lançamos o que o cliente passou por áudio, quando o canteiro
não lança sozinho. A diferença está numa coluna só, `mestres.escritorio`:

- **mestre**: escreve no dia de hoje e em nenhum outro. O registro do canteiro
  vale porque é feito na hora.
- **escritório**: escreve em qualquer dia da semana corrente, porque nem sempre
  a coleta acontece no mesmo dia. A semana passada continua fechada — relatório
  já publicado não se reescreve.

A regra vive em `diaAutorizado()`, em `src/lib/obra/dados.ts`, e é aplicada
tanto na leitura da tela quanto em `garantirConfirmacao()`. Passar `?dia=` na
URL sem ser o escritório não faz nada: cai no dia de hoje.

## Pendências conhecidas

- `public/og-image.png` e `public/fav-ico.png` ainda são os da entrevista.
- `SUPABASE_SERVICE_ROLE_KEY` está vazia no `.env.local` — pegar a secret key no
  painel do projeto `obra-nova` antes de rodar.
- Sem lembrete automático: quem lembra de fechar a semana é você.
- Sem cobrança no produto. Assinatura é contrato, fora do sistema.
- Um cliente com login próprio ainda não existe: hoje há uma org só, a nossa.
  O caminho está aberto (a org vem do banco), mas mover obras para orgs
  separadas é migração de dados quando a hora chegar.
