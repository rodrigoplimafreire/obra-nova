# Obra Nova — o que existe hoje

Documento de contexto para retomar o projeto em outra sessão. Escrito em
11/08/2026. O que está aqui é o estado real do código, não a intenção.

---

## 1. O que é

Ferramenta de gestão de obra para empreiteira pequena. Dois módulos num app só,
que se conhecem por uma coluna:

**Orçamento** é a entrada. O empreiteiro conta o serviço falando, a IA
transcreve e escreve as linhas da tabela de custos, ele corrige o que precisa, e
sai um documento com link e senha para o cliente. Aprovado, o orçamento vira
obra num clique.

**Relatório** é o acompanhamento. Toda semana o cliente abre um link e vê o que
foi executado, as fotos e o que vem em seguida — sem o empreiteiro perder tempo
explicando por WhatsApp.

A ligação é `orc_orcamentos.obra_id`, nulo até o cliente aprovar. Quase todo
orçamento nasce antes da obra existir, porque é ele que decide se ela vai
existir.

**Cliente real:** RD Engenharia (Reginato Dias), Fortaleza/CE. O documento que
o cliente final abre sai na marca da RD, não na do Obra Nova.

**Modelo de operação:** white label com onboarding manual. Não existe cadastro
público, trial nem cobrança dentro do produto — isso é contrato, fora do
sistema. O acesso é liberado por e-mail, um a um, via `ADMIN_EMAIL_ALLOWLIST`.

**Ideia de negócio, só idealizada:** cobrar de 2,5% a 5% por orçamento
aprovado. A recomendação foi cobrar sobre o **valor aprovado** (não o recebido)
e usar escala decrescente ou teto — 5% de R$ 85 mil dá R$ 4.250, e um número
desse cria o incentivo de esconder o trabalho grande do sistema. Nada disso
está implementado; `orc_orcamentos.valor_aprovado` já congela a base de cálculo
no aceite.

---

## 2. Stack

Next.js 16 (App Router, Server Components, Server Actions, `proxy.ts` como
middleware) · React 19 · TypeScript · Tailwind 4 · Supabase (Postgres, Storage,
Auth) · Groq (`llama-3.3-70b-versatile` e `whisper-large-v3-turbo`) · deploy na
Vercel.

Sem Vite, sem SPA, sem gerenciador de estado global.

> **Atenção:** o `AGENTS.md` do repositório avisa que esta versão do Next tem
> breaking changes em relação ao que a maioria dos modelos conhece. Ler
> `node_modules/next/dist/docs/` antes de escrever código de framework.

**Deploy:** `npx vercel --prod --yes` na raiz. Não há git remote — o deploy é
sempre pela CLI. Domínio: `obra-nova-two.vercel.app`. Projeto Supabase:
`wnzdsqpsowxmistbnhca`.

**Pedir autorização antes de todo deploy.** É regra do cliente.

---

## 3. Rotas

| Rota | Quem abre |
| --- | --- |
| `/` | redireciona para `/admin/login` |
| `/admin/login` | entrada do painel (entrar, criar conta, recuperar senha) |
| `/admin/obras` | lista de obras |
| `/admin/obras/[id]` | a obra: checklist do dia, mestres, relatório da semana |
| `/admin/orcamentos` | lista de orçamentos |
| `/admin/orcamentos/[id]` | o orçamento: dados, tabela, textos, publicação |
| `/admin/precos` | bases de preço (SINAPI/SEINFRA/própria) |
| `/admin/perfil` | conta e saída |
| `/p/[token]` | **o cliente da RD**: o orçamento publicado, com senha e aceite |
| `/o/[token]` | **o mestre, no canteiro**: a semana dele |
| `/o/[token]/a/[atividadeId]` | confirmar um serviço com foto, áudio e texto |
| `/rel/[token]` | **o cliente final**: o relatório publicado |

O `proxy.ts` protege só `/admin/:path*`. As rotas com token são públicas por
desenho — o segredo é o token, e no caso do orçamento também a senha.

---

## 4. Banco

20 tabelas. As que importam:

**Obra:** `obras` → `atividades` (o que fazer, por dia) → `confirmacoes` (o que
o mestre respondeu) → `confirmacao_blocos` (foto, áudio, texto) →
`transcripts`. `mestres` guarda os tokens de acesso ao canteiro. `relatorios`
é o semanal publicado.

**Orçamento:** `orc_orcamentos` (33 colunas) → `orc_itens` (a tabela de custos)
→ `orc_publicacoes` (as fotografias versionadas). `orc_blocos` +
`orc_transcricoes` guardam a fala. `orc_secoes` são os blocos de texto do
documento. `orc_bases_de_preco` → `orc_composicoes` é a base de preços.
`orc_geracoes` audita cada chamada de IA. `orc_eventos` registra o que o
cliente fez com o link.

**Conta:** `orgs` + `org_members`. Uma org por conta; a de hoje se chama
"Obra Nova".

**Restos que podem sair:** `orc_perguntas` e o valor `perguntas` do enum
`orc_geracao_etapa` sobraram do fluxo de perguntas que foi removido. Estão
inertes.

---

## 5. As regras que não se quebram

Estas atravessam o código todo. Quebrar qualquer uma estraga o produto, não só
o estilo.

### Dinheiro

- **A IA nunca inventa preço.** Valor que não foi falado fica `null`, nunca `0`
  — zero sairia impresso como "de graça". `null` aparece como "sem preço" e
  **bloqueia a publicação**.
- **A IA nunca inventa quantidade.** "A sala toda" não vira 30 m².
- **Custo e venda são colunas separadas.** `custo_unitario` é o que a obra
  gasta; `valor_unitario` é o que o cliente paga. O custo **nunca** sai no
  documento — `lib/orcamento/publicacao.ts` é o ponto único onde ele é deixado
  para trás, e o tipo `ItemDeOrigem` nem tem o campo.
- **`orc_itens.total` é coluna gerada pelo banco.** Com a conta em código, tela
  e PDF arredondariam em dois lugares e um dia divergiriam num centavo.
- **Publicar congela.** `orc_publicacoes` guarda a fotografia; editar o
  rascunho depois não muda o que o cliente já viu. Republicar mantém o link.

### Prosa

- **A IA pode escrever texto, e não pode escrever número.** A diferença não é
  confiança no modelo, é custo do erro: número errado vira prejuízo e passa
  despercebido na conferência; prosa errada aparece na hora, na tela, e se
  corrige digitando.
- **Mas não pode inventar fato** — medida, prazo, material ou garantia que não
  esteja na tabela nem na fala.
- **Regra mecânica se aplica em código, não em prompt.** Pedir "só a inicial
  maiúscula" deu Title Case numa rodada e minúscula na outra. A função
  `capitalizar` resolveu de vez. O prompt orienta estilo; o código garante
  forma.

### Trabalho humano

- **Mão humana marca a linha.** Todo item carrega `origem` (`ia` | `humano`) e
  `editado_em`. Reescrever com IA apaga só o que a IA escreveu.
- **Apagar é reversível** enquanto é rascunho (`removido_em`).
- **Publicar é ato humano.** Nada publica sozinho.

---

## 6. Design system

Três documentos no projeto Claude Design `3e53a66c-05ab-4c38-8659-c8a3d67804ff`:

- `Obra Nova Brand.dc.html` — manual de marca
- `Obra Nova Design System.dc.html` — tokens e componentes
- `Obra Nova UI.dc.html` — as montagens de tela (mobile e desktop)
- `Obra Nova Ilustrações v2.dc.html` — as dez cenas de estado

**Ler pelo MCP DesignSync (`get_project` / `get_file`), nunca por WebFetch** —
a URL do claude.ai devolve 403, e implementar de segunda mão já produziu
componentes errados uma vez.

### O que o sistema manda

**Amarelo é ação. Grafite é estrutura. Arroio é dado e progresso.** Nunca
inverter. Um único botão amarelo por tela.

**Archivo fala, IBM Plex Mono mede.** Todo número que se compara — prazo,
medição, percentual, código, dinheiro — é mono tabular.

**O item de navegação ativo se marca com barra amarela, nunca com fundo
colorido.** Na lateral é 3px à esquerda sobre grafite; na barra inferior é 2px
acima com o símbolo cheio.

**Alvo mínimo de 44px no mobile**, 52–56 em campo. A obra é lida no sol, por
gente com pressa.

**Status tem cor e palavra**, nunca só cor.

### Ilustrações

Dez cenas de estado em `components/comum/ilustracoes.tsx`, traço de desenho
técnico: duas espessuras (2,2 contorno / 1,2 detalhe), hachura a 45° no lugar
de massa preta, tracejado só para marcar ausência, canto vivo, objeto no lugar
de gente. Uma por tela, teto de 200px.

As cenas não têm cor: o traço é `currentColor` e o miolo é `var(--paper)`.
Casar `--paper` com o fundo inverte a cena inteira. Quem faz isso é o
componente `<Cena>`.

**Usadas hoje:** Entrar (login), Não encontrado (404), Falha (erro), Vazio
(listas), Sem resultado (Preços), Acesso restrito (login barrado), Enviado
(aceite do cliente).
**Prontas e sem uso:** Sem sinal, Sessão expirada, Processando.

---

## 7. Armadilhas descobertas (a parte cara)

Cada uma custou tempo. Estão aqui para não custarem de novo.

### PowerShell

- **`Get-Content -Raw` + `Set-Content` corrompe acento.** Já mangueou 6 arquivos
  .tsx de uma vez. Usar `[System.IO.File]::ReadAllText/WriteAllText` com
  `UTF8Encoding($false)`.
- **`[id]` é wildcard de classe de caractere.** `Test-Path`/`Remove-Item` numa
  pasta `[id]` não acham nada. Usar `-LiteralPath`. Isso mordeu duas vezes.
- **`Set-Location` não afeta chamadas .NET** — elas usam o CWD do processo.
- **Line endings:** os arquivos do projeto usam `\n`. Um `.Replace()` com
  `` `r`n `` no padrão silenciosamente não casa nada.
- **Pipe para `vercel env add` grava o `\n` dentro do valor.** As 9 variáveis
  ficaram com quebra de linha no fim e o login quebrou em produção. Usar
  arquivo + redirect do `cmd`.

### SVG

- **`id` de `<pattern>` é global ao documento** e `url(#x)` resolve para a
  **primeira** definição da página. Duas cenas em fundos diferentes usavam a
  hachura da primeira — sobre grafite, pintava preto no preto. Resolvido com
  `useId()`, o que obrigou o arquivo a ser `"use client"`.
- **`--paper` colide com o `brand.css` da RD**, que declara `--paper: #F6F4EF`
  no `:root` para a nota creme. Cena solta dentro do documento do cliente herda
  o creme. O `<Cena>` grava a variável inline, que vence.

### CSS e layout

- **`.obs-list li` do brand.css é grid `auto 1fr` e espera dois filhos.** Sem o
  ícone, o texto cai na coluna `auto` e quebra na metade da largura. Medido: 493
  de 992px.
- **`padding` dentro de elemento com altura fixa não reserva espaço** — com
  `border-box` ele come a própria altura. A barra de abas cobria o rodapé até a
  reserva subir para a coluna.
- **`max-w-4xl mx-auto` centralizava o conteúdo do painel** e deixava ~300px de
  vazio de cada lado numa tela de 1920. O documento usa largura cheia com 24px.
- **Logo esticada em pai flex-column** — resolver com `self-start`.

### React / Next

- **`onCancel` de `<dialog>` nunca dispara pelo JSX**: o evento `cancel` não
  borbulha e o React delega na raiz. Precisa de listener nativo em `useEffect`.
- **`exigirAdmin` precisa de `cache()`.** Sem ele eram 4 validações de sessão
  contra São Paulo por página, porque a função é chamada em cascata.
- **O RSC cache do router servia a resposta deslogada** depois do login — daí o
  "precisa sair e entrar de novo". Resolve com `router.refresh()`.
- **`garantirOrg` precisa ser à prova de corrida.** O login dispara duas
  requisições quase simultâneas e nasceram duas orgs com 41ms de diferença, com
  os dados da pessoa espalhados entre elas. Índice único em `orgs.name` +
  upsert com `ignoreDuplicates`.

### Verificação

- **Medir geometria, não contar elementos.** "Renderizou" não é "está certo".
  Vários dos bugs acima só apareceram medindo largura efetiva, cor pintada e
  `elementFromPoint`.
- **Cuidado com o próprio instrumento.** Duas vezes um teste meu deu falso
  negativo: `classList` revertido pelo React, e varredura de `styleSheets`
  pulando a folha do Tailwind num `catch`. Quando o resultado surpreender,
  desconfiar do teste antes da conclusão.

---

## 8. Padrões de UI (o que seguir ao acrescentar tela)

- **Diálogo:** sempre `components/comum/dialogo.tsx` — `<dialog>` nativo, modal
  no desktop e folha de baixo no celular. Nunca `div` com `position: fixed`.
- **Ordem dos botões:** Cancelar primeiro, o que confirma por último. Sempre.
- **Campo:** `<label className="flex flex-col gap-1.5">` + `rotulo-campo` +
  `campo` + `ajuda-campo` **depois** do campo.
- **Erro:** `aviso aviso-erro text-sm`, sem `text-tinta` por cima.
- **Cartão de dados de entidade:** `CartaoDeDados` + `Dado`, com "Editar"
  dentro do cartão abrindo diálogo. Os campos ficam à vista sempre; vazio
  aparece como "não preenchido", não some.
- **Estado vazio:** `Vazio`, sem borda, com a explicação da tela dentro dele —
  quando a lista enche, a explicação some sozinha.
- **Ação secundária:** menu de três pontos (`comum/menu.tsx`), não mais um
  botão na barra.
- **Máscara:** telefone e dinheiro passam por `comum/campos.tsx`. Separar
  `formatar` (digitando) de `exibir` (vindo do banco) — sem isso, `18.5` do
  banco virava R$ 1,85.
- **Um botão amarelo por tela.**

---

## 9. Feedback recorrente do cliente

Ele testa como usuário real e é específico. O que ele cobra:

- **CRUD completo e *descobrível*.** "Não consigo editar nada" apareceu duas
  vezes, para telas diferentes.
- **Modal no desktop, bottom sheet no mobile.** Formulário inline recebeu
  "está muito rude!".
- **Estados de carregamento em tudo.** Tela parada durante processamento é
  queixa dele, não detalhe.
- **Máscaras e tooltips que não cortam.**
- **Ele olha a tela como designer.** Padding, cor de faixa, tamanho de título,
  ordem de botão — tudo isso ele vê e cobra.
- **Consistência entre fluxos.** Duas telas resolvendo o mesmo problema de
  jeitos diferentes é bug para ele.

---

## 10. Pendências conhecidas

- **A marca "Obra Nova" do seletor de documento está quebrada.**
  `lib/orcamento/marcas.ts` aponta para `/marcas/obra-nova/documento.css`, que
  não existe em `public/marcas/` (só existe `rd/`). Selecionar essa opção
  publica documento sem estilo. *(Há uma sessão de background rodando nisso.)*
- **`tela-obra.tsx:362`** tem `setState` dentro de efeito — erro de lint
  pré-existente, no `ItemDeAtividade`.
- **Três ilustrações sem uso**: Sem sinal (não há detecção de offline),
  Sessão expirada (o proxy só redireciona, sem sinalizar motivo), Processando.
- **Sem busca global e sem notificações** — o documento de UI prevê os dois na
  barra do topo; não foram implementados para não colocar controle que não
  funciona.
- **`orc_perguntas`** e o enum `perguntas` podem ser removidos.
- **Sem testes automatizados.** A verificação hoje é `tsc`, `eslint`, `build` e
  medição no navegador.

---

## 11. Como rodar

```bash
npm install
cp .env.local.example .env.local   # preencher
npm run dev
```

Variáveis: as do Supabase (URL, anon key, service key), `GROQ_API_KEY`,
`ADMIN_EMAIL_ALLOWLIST`, `ANALYSIS_MODEL` (opcional).

Antes de qualquer deploy: `npx tsc --noEmit` e `npm run build`.
