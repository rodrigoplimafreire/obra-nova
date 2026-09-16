# Obra Nova — contexto para retomar o projeto em outra ferramenta

Escrito em 16/09/2026 para levar o projeto a outro assistente (Codex/ChatGPT).
É um resumo de entrada: o detalhe mora nos documentos apontados em cada seção,
todos no repositório. Quando este arquivo e o código divergirem, o código manda.

---

## 1 · O que é, e para quem

Ferramenta de gestão para empreiteira pequena. **Três módulos num app só**, no
mesmo ciclo de trabalho:

- **Orçamento** — a entrada. O empreiteiro conta o serviço falando, a IA
  transcreve e escreve as linhas da tabela de custos, ele corrige, e sai um
  documento com link e senha para o cliente. Aprovado, vira obra num clique.
- **Transcrição** — a porta de entrada de fora. O cliente manda áudio no
  WhatsApp, o empreiteiro importa aqui, o texto sai em segundos e dele nasce um
  orçamento com a tabela montada.
- **Relatório** — o acompanhamento. Toda semana o cliente abre um link e vê
  foto, relato e o que vem em seguida.

A ligação entre eles é `orc_orcamentos.obra_id`, **nulo até o cliente aprovar** —
quase todo orçamento nasce antes da obra existir, porque é ele que decide se ela
vai existir.

**Cliente real:** RD Engenharia (Reginato Dias), Fortaleza/CE. O documento que o
cliente final abre sai na marca da RD, não na do Obra Nova.

**Modelo de operação:** white label com onboarding manual. Não existe cadastro
público, trial nem cobrança dentro do produto — isso é contrato, fora do
sistema. Acesso liberado e-mail a e-mail (`ADMIN_EMAIL_ALLOWLIST`, hoje tela do
operador).

**Origem:** fork de `entrevista-async`; toda a superfície de entrevista foi
removida.

---

## 2 · Stack e operação

Next.js **16** (App Router, Server Components, Server Actions, `src/proxy.ts`
como middleware) · React 19 · TypeScript · Tailwind 4 · Supabase (Postgres,
Storage, Auth) · Groq (`llama-3.3-70b-versatile`, `whisper-large-v3-turbo`) ·
deploy na Vercel. Sem Vite, sem SPA, sem estado global.

> **Aviso do `AGENTS.md`:** esta versão do Next tem breaking changes em relação
> ao que a maioria dos modelos conhece. Ler `node_modules/next/dist/docs/` antes
> de escrever código de framework. *(Vale igual para o Codex.)*

- Projeto Supabase: `wnzdsqpsowxmistbnhca`, região São Paulo.
- Deploy: `npx vercel --prod --yes` na raiz. **Não há git remote** — o deploy é
  sempre pela CLI. Domínio: `obra-nova-two.vercel.app`.
- **Pedir autorização antes de todo deploy.** É regra do cliente.
- Antes de qualquer deploy: `npx tsc --noEmit` e `npm run build`.
- **Sem testes automatizados.** A verificação é `tsc`, `eslint`, `build`, os
  scripts `npm run verificar:*` (regressões específicas, rodadas contra o banco
  real) e medição no navegador.

Rodar local: `npm install`, `cp .env.local.example .env.local` (preencher),
`npm run dev`. As variáveis estão comentadas uma a uma no `.env.local.example`.

---

## 3 · Rotas

| Rota | Quem abre |
| --- | --- |
| `/admin/obras`, `/admin/obras/[id]` | painel da obra: checklist do dia, equipe, relatório |
| `/admin/orcamentos`, `/admin/orcamentos/[id]` | o orçamento: dados, tabela de custos, virar obra |
| `/admin/transcricoes`, `/admin/transcricoes/[id]` | áudios importados, texto editável, virar orçamento |
| `/admin/precos` | bases de preço (SINAPI/SEINFRA/própria), import |
| `/admin/pipeline`, `/admin/pipeline/[id]`, `/analise`, `/precificacao` | funil de pedidos, tempo por etapa, carga comercial |
| `/admin/vistorias`, `/admin/vistorias/[id]` | levantamento da visita, no celular |
| `/admin/perfil` | perfil da pessoa + identidade da empreiteira |
| `/p/[token]` | **o cliente da RD**: o orçamento publicado, com senha e aceite |
| `/o/[token]`, `/o/[token]/a/[atividadeId]` | **o mestre, no canteiro**: a semana dele |
| `/rel/[token]` | **o cliente final**: o relatório publicado |

`/admin/login` e `/admin/redefinir-senha` ficam fora do grupo `(painel)`.

---

## 4 · Banco (tabelas vivas)

As migrações vivem no projeto Supabase, aplicadas pelo MCP — **não há cópia
versionada no repo**, de propósito (`supabase/README.md` explica). Os tipos
gerados em `src/lib/database.types.ts` são o melhor mapa do schema.

- **Org e acesso:** `orgs`, `org_members`, `operadores`, `acessos`,
  `org_ajustes`, `org_orcamento_padrao`
- **Obra:** `obras`, `mestres`, `atividades`, `confirmacoes`,
  `confirmacao_blocos`, `relatorios`, `transcripts`
- **Orçamento:** `orc_orcamentos`, `orc_itens`, `orc_blocos`,
  `orc_transcricoes`, `orc_eventos`, `orc_geracoes`, `orc_secoes`,
  `orc_modulos`, `orc_cronograma`, `orc_publicacoes`
- **Preços:** `orc_bases_de_preco`, `orc_composicoes` (RPC
  `orc_buscar_composicoes`)
- **Pipeline:** `pipe_pedidos`, `pipe_eventos`, `pipe_tempos`, view
  `pipe_pedidos_resumo`
- **Vistoria:** `vist_vistorias`, `vist_ambientes`, `vist_medicoes`
- **Transcrição avulsa:** `transcricoes`
- Morto: `orc_perguntas` e o enum `perguntas` podem ser removidos.

Garantias que o schema impõe (o porquê está em `supabase/README.md`): RLS em
todas as tabelas com resolução de org via `private.eh_membro()`;
`unique (obra_id, inicio, fim)` em `relatorios`; `publicado_em` exige
`status = 'pronto'`; `unique (obra_id, dia, position)` em `atividades`; e
`orc_itens.total` é **coluna gerada** (`quantidade × valor_unitario`), que não
aceita escrita direta.

**Storage:** bucket `gravacoes` **privado, sem policy nenhuma** — todo acesso
passa pelo servidor com a service key, e o upload vai por signed URL direto do
navegador (a Vercel tem teto de 4,5 MB por requisição). O bucket `marca` é
**público de propósito**: o logotipo é lido sem sessão na página do cliente, e
URL assinada expiraria quebrando documento já publicado.

---

## 5 · As regras que não se quebram

Estas são o produto. Quebrá-las é bug, não trade-off.

**Dinheiro**

- **A IA nunca estima preço.** Valor que não foi falado fica `null` e aparece
  marcado. `0` sairia impresso como "de graça"; `null` sai como "sem preço" e
  **bloqueia a publicação**.
- **Custo e venda são colunas separadas, sempre.** `orc_itens.custo_unitario` é
  o que a obra gasta; `valor_unitario` é o preço de venda. O custo **nunca** vai
  para o cliente — vive só no editor, como dado de decisão.
- **Publicar congela por versão.** `orc_publicacoes` guarda a fotografia; editar
  o rascunho depois não muda o que o cliente já viu. O token fica no orçamento,
  então republicar não mata o link que já foi.
- **Uma base de preços é uma fotografia.** Reimportar cria base nova; a antiga
  vira `ativa = false`. Item que já usou um custo dela guarda o número — é
  cópia, não referência ao vivo.
- **Publicar exige preço em tudo e senha definida.**
- **Logotipo e contato são lidos ao vivo**, não da fotografia publicada: papel
  timbrado tem que valer para o documento que já está na rua.

**Prosa**

- **A IA não escreve HTML.** Devolve JSON validado e o React renderiza — é o que
  garante que todo orçamento saia na mesma tabela, com a mesma impressão.
- Nos textos do documento a IA **pode** escrever. A diferença não é confiança no
  modelo, é custo do erro: número errado vira prejuízo silencioso, prosa errada
  aparece na hora e se corrige digitando. Continua proibido inventar **fato** —
  medida, prazo, material ou garantia que não esteja na tabela nem na fala.
- **Regra mecânica se aplica em código, não em prompt** (a função
  `capitalizar()` existe porque o prompt dava Title Case numa rodada e minúscula
  na outra).
- Reescrever com IA substitui o que a IA escreveu (`origem = 'ia'`) e **preserva
  o que a mão tocou** (`editado_em`, `origem = 'humano'`). Mesma regra nos itens
  e nas transcrições.

**Trabalho humano**

- **Publicar é ato humano.** Ninguém manda para quem paga a obra sem alguém ler
  e liberar.
- **O aceite nasce do lado de fora** — o botão está na página do cliente, não no
  painel. `valor_aprovado` é cópia congelada no instante do aceite.
- **Editar o checklist não apaga evidência.** Atividade que já tem confirmação
  vai para o fim da lista, com aviso.
- **`visto` não é marcável à mão** — é registrado na abertura da página, e só
  depois do gate de senha (senão o robô de preview do WhatsApp contaria como
  leitura). Marcar à mão transformaria um fato em opinião.

**Estrutura da proposta** — `ESTRUTURA-DA-PROPOSTA.md` é normativo: sete seções
fixas, item por item (nunca agrupado), **seção só aparece quando há conteúdo**,
coluna inteira de travessão é pior que coluna nenhuma, e as duas assinaturas
nascem vazias.

---

## 6 · Armadilhas já pagas (não redescobrir)

O `README.md` tem a lista longa com o raciocínio de cada uma. As que mais
custaram:

- **Cada fala processa só a si mesma.** `montarTabelaDaFala` recebe o `blocoId`,
  não o orçamento. A versão que lia todos os blocos fez 8 falas virarem 52 itens
  onde deviam ser 13, com total 3,74× maior que o real. Medido em produção;
  regressão coberta por `npm run verificar:falas`. Índice único não resolveria:
  duas linhas idênticas podem ser legítimas (duas portas iguais em cômodos
  diferentes) — a guarda tem que ser lógica de aplicação.
- **Toda chamada a provedor externo tem teto, e o teto cabe dentro da função.**
  35s nas duas chamadas, contra `maxDuration = 60` na página do orçamento.
- **O cliente envolve Server Action em try/catch** — sem isso a promessa
  rejeitada não roda nenhum `setErro`, e o progresso fica girando para sempre.
- **Falhar não custa a gravação:** o `blocoId` fica no estado e "tentar de novo"
  retoma da transcrição.
- **`exigirAdmin()` é memoizada com `cache()` do React** — sem isso eram quatro
  validações de JWT contra São Paulo para desenhar uma página.
- **Depois do login, navegação dura** (`window.location.assign`): o roteador
  serve a resposta RSC de quando a rota respondia com desvio para o login.
- **O dia é resolvido no fuso de São Paulo**, nunca no do servidor — a Vercel
  roda em UTC e depois das 21h o checklist apareceria vazio.
- **Duração de áudio por cronômetro**, nunca por metadata: o container sai sem
  cabeçalho e `audio.duration` vira `Infinity`.
- **O `.opus` do WhatsApp chega sem tipo declarado** — a validação de verdade é
  a extensão do arquivo, e o nome original viaja até o provedor.
- **`mimeEscolhido`, não `mimeDoBlob`:** no WebKit o blob volta com `type` vazio.
- **`<dialog>` nativo:** o evento `cancel` não borbulha e o React delega na raiz,
  então o listener é nativo num `useEffect`; a rolagem do corpo trava na mão
  (iOS); no celular o rodapé é `column-reverse`, para a ação principal ficar em
  cima sem mudar a ordem do DOM.
- **Imprimir não pode depender de JavaScript** — ver o comentário em
  `src/app/p/[token]/page.tsx`.
- **O que o cliente usa mora em `tipos.ts`.** Importar do módulo de dados
  arrasta `supabaseAdmin` e `next/headers` para o bundle do navegador. `tsc` não
  vê essa fronteira; só o build (ou abrir a página) acusa.

---

## 7 · Design system e marca

Manual Obra Nova v1.0. **Grafite `#14181A` é estrutura**; **Amarelo Obra
`#F7E407` é o acento, um por tela**; **Arroio `#2E7D74` é medida, nunca ação**
(como texto, só `arroio-tinta`: o tom cheio dá 4,3:1 sobre cal e reprova na AA).
Tipografia: **Archivo** para tudo que fala, **IBM Plex Mono** para tudo que mede.
Sem serifada.

O logotipo entra por `mask-image` a partir de `public/marca/`, então a cor vem de
`currentColor` — as três variantes do manual são a mesma geometria pintada pelo
contexto. A redução mínima de 28px está no código (`Math.max`), não na
disciplina.

**Duas marcas, dois papéis:** o painel é sempre Obra Nova, porque é a ferramenta;
o documento que o cliente abre sai na marca da empreiteira.

Todo CRUD acontece em diálogo (`src/components/comum/dialogo.tsx`): modal
centrado no desktop, folha de baixo no celular. A dica de ajuda é portal no
`body` com `position: fixed`, e só onde existe mouse. `loading.tsx` em toda rota
do painel, com esqueleto no formato da tela que vem depois.

---

## 8 · Onde o projeto está, e o que vem

Commits recentes: minerador de serviços → vistoria no celular → D1 decidida →
pipeline no papel.

**Vistoria** (`PRD-VISTORIA.md`) — o achado que reordenou tudo: a biblioteca de
preços **não estava faltando, estava vazia** (0 composições; 322 de 322 itens sem
`composicao_id`). Por isso a Entrega 1 foi minerar os 322 itens já lançados, não
construir tela: vistoria que sugere de uma biblioteca vazia não sugere nada.

- **Entrega 1** — minerador pronto (`npm run minerar:servicos` →
  `servicos-candidatos.md`). Falta a sessão de revisão com o Reginato e gravar o
  resultado como composições. Critério de aceite: ≥ 20 composições ativas, e um
  orçamento novo montado com ≥ 70% dos itens vindos delas.
- **Entrega 2** — tela de vistoria existe (`src/components/admin/tela-vistoria.tsx`,
  `src/lib/vistoria/`). A vistoria **gera itens no orçamento**; não é um
  orçamento paralelo.
- **D1 decidida em 11/09:** **ambiente vira o grupo do item** (`1 - COZINHA` no
  lugar de `1 - MÃO DE OBRA`) nos orçamentos que nascem de vistoria. Custo
  aceito e registrado: esses orçamentos não separam mão de obra de material, e
  os antigos não mudam.
- **D2, D3 e D6 propostas em `PRD-UX-VISTORIAS.md`** (16/09/2026): offline vira
  "conectado com proteção local"; a linguagem de fórmula vira sete modos de
  medição; as quatro portas de entrada continuam. **D4** (foto) fica sem efeito
  porque fotos saíram do escopo daquela entrega; **D5** (papéis) segue fora.
  Aquele documento também reverte a exigência de biblioteca validada antes da
  evolução da vistoria — decisão do Rodrigo, com o custo registrado na §0.3.
- **Regra que não pode ser afrouxada para o fluxo novo caber:** item sem preço
  bloqueia a publicação, sem senha bloqueia.

**Pipeline** (`PRD-PIPELINE.md`) — pipeline, tempo por etapa e precificação
comercial estão no ar. O que falta é **do Rodrigo, não do código**: cadastrar os
7 orçamentos parados, preencher custo/hora, custo/km, o orçamento típico e a
conversão estimada (até lá a coluna de custo fica em branco de propósito — nada
foi chutado no lugar dele), e a conversa comercial sobre quem paga a feature.
`pipe_tempos` tem **2 lançamentos no banco inteiro**: sem o Reginato usar o
cronômetro nas próximas visitas, não há como demonstrar redução de tempo — só
impressão. Por isso as metas de tempo viraram "primeiro medir".

**Portal do cliente** (`PLANO-PORTAL-CLIENTE.md`) — Fases 0 e 1 entregues (valor
fechado no "Falar orçamento", seção de pagamento no `/p/[token]`). Fases 2 a 4
(domínio próprio em paralelo, `clientes`/`pedidos`/`pacotes_cliente`,
`/c/[token]`) não começaram. As decisões da seção "não reabrir sem motivo novo"
valem — entre elas: consumo de pacote é 1 por **pedido**, não por orçamento
gerado; pacote é por cliente, não universal; acesso do cliente final é link único
e permanente com senha simples, sem conta.

**Console do operador** (`PRD.md`) — o Rodrigo cobrando a empreiteira:
contratos, lotes, cota como saldo, cobrança, CLI. Entrega 1 (org ativa e papel de
operador) feita; o resto não começou. Não confundir com o portal acima: lá é a
empreiteira cobrando o cliente final dela, e por isso as tabelas têm nomes
diferentes.

**Ideia de negócio, só idealizada:** cobrar de 2,5% a 5% sobre o **valor
aprovado**, com escala decrescente ou teto. Nada implementado;
`orc_orcamentos.valor_aprovado` já congela a base de cálculo no aceite.

---

## 9 · Pendências conhecidas

- `tela-obra.tsx:362` tem `setState` dentro de efeito — lint pré-existente.
- `public/og-image.png` e `public/fav-ico.png` ainda são os da entrevista.
- Três ilustrações sem uso: Sem sinal, Sessão expirada, Processando.
- Sem busca global e sem notificações na barra do topo — não implementados para
  não colocar controle que não funciona.
- Sem lembrete automático de fechar a semana.
- Duas funções antigas — `vincular_operador_as_orgs()` e
  `vincular_operadores_a_org()` — são `security definer` e continuam chamáveis
  por `anon` via `/rest/v1/rpc`. Conserto de uma linha, mas exige conferir quem
  as chama.
- Um cliente com login próprio ainda não existe: hoje há uma org só. O caminho
  está aberto (a org vem do banco), mas separar orgs é migração de dados.

---

## 10 · Mapa dos documentos

| Arquivo | O que tem |
| --- | --- |
| `AGENTS.md` | o aviso sobre o Next 16 — curto e obrigatório |
| `ESTRUTURA-DA-PROPOSTA.md` | as sete seções canônicas da proposta (normativo) |
| `README.md` | as decisões de arquitetura com o porquê de cada uma — o documento mais denso |
| `about.md` | estado do código em 11/08/2026, armadilhas e padrões de UI. **Atenção:** a pendência da marca "Obra Nova" quebrada já foi resolvida — os três arquivos existem em `public/marcas/obra-nova/`. É o documento mais antigo do conjunto; conferir contra o código antes de agir |
| `TESTES-DE-COMPORTAMENTO.md` | especificação de comportamento, módulo a módulo — o mais perto de suíte de testes que existe |
| `PRD.md` | Console do Operador (o Rodrigo cobrando a empreiteira) |
| `PRD-PIPELINE.md` | pipeline, tempo por etapa, precificação comercial |
| `PRD-VISTORIA.md` | vistoria; a §0 confere as premissas contra o código |
| `PRD-UX-VISTORIAS.md` | simplificação da UX da vistoria; §0 conferida em 16/09/2026. **Reverte a exigência de biblioteca validada** do `PRD-VISTORIA.md` — ler a §0.3 antes de agir |
| `PLANO-PORTAL-CLIENTE.md` | portal do cliente final, fase a fase |
| `servicos-candidatos.md` | saída do minerador, aguardando revisão do Reginato |
| `supabase/README.md` | o que o schema garante, e por quê |

**Convenção de escrita dos documentos:** todo PRD que chega de fora é conferido
contra o código e o banco **antes** de virar escopo — a §0 de `PRD-PIPELINE.md` e
`PRD-VISTORIA.md` é o padrão. Um PRD que supõe folha em branco faz reescrever o
que já está no ar, e o glossário da §1 do PRD da vistoria existe exatamente para
isso: o mesmo conceito com dois nomes cria tabela paralela.

**Convenção do código:** nomes em português — `acoes-*.ts` para Server Actions,
`dados.ts` para leitura, `tela-*.tsx` para a tela de um registro, `painel-*.tsx`
para a lista. Comentário explica **por quê**, não o quê.
