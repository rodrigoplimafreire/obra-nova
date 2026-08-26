# PRD — Obra Nova: Console do Operador

Versão consolidada, 26/08/2026. **Este é o único PRD válido do projeto.**
Substitui o PRD de "motor de orçamentos multi-tenant" (tabelas `tenants` /
`quotes` / `quote_revisions`, `content_md`, migração para Gemini), que fica
engavetado — as razões estão na seção 2.

Leia `about.md` antes de escrever qualquer linha. Ele descreve o estado real do
código; este documento descreve apenas o delta.

---

## 0. Como usar este documento

Ordem de leitura para quem vai implementar: seção 1 (o que já existe, para não
reconstruir), seção 2 (o que é proibido, para não regredir), seção 3 (o achado
que define tudo), depois as entregas na seção 9, na ordem.

Regra que governa o documento: **nada aqui é construído fora da ordem das
entregas.** Cada entrega é utilizável sozinha e tem critério de aceite
verificável. Se um pedido futuro cair na seção 2 ou na seção 10, recuse e cite
a seção.

---

## 1. O que já existe e não deve ser reconstruído

Verificado no código em 26/08/2026:

- **Multi-tenancy.** `orgs` + `org_members`, `org_id` em todas as tabelas de
  domínio, policies de RLS escritas. Acrescentar empreiteira **não** exige
  migração de schema.
- **Versionamento e auditoria.** `orc_publicacoes` (fotografia do documento
  publicado, com `versao`), `orc_geracoes` (cada chamada de IA), `orc_eventos`
  (o que o cliente fez com o link).
- **Base de preços por org.** `orc_bases_de_preco` → `orc_composicoes`, com
  `org_id`, fonte SINAPI/SEINFRA/própria e import.
- **Congelamento comercial.** `valor_aprovado` e `aprovado_em` congelam a base
  de cálculo de qualquer comissão futura.
- **Documento na marca do cliente.** `orc_orcamentos.marca` +
  `lib/orcamento/marcas.ts` — hoje constante de código; a seção 5.1 move isso
  para dado.
- **Integridade do dinheiro.** `custo_unitario` separado de `valor_unitario`,
  `orc_itens.total` como coluna gerada pelo banco, preço `null` bloqueando
  publicação.

---

## 2. O que NÃO fazer

Lista fechada.

| Não fazer | Por quê |
| --- | --- |
| Trocar `orc_itens` por um campo `content_md` (Markdown) | Mata a separação `custo_unitario`/`valor_unitario`, a coluna gerada `total` e a regra "preço `null` bloqueia publicação". Com texto livre, preço alucinado fica indistinguível de preço real. |
| Criar tabela `tenants` | É a `orgs`, que já existe, já tem RLS e já está em 72 pontos do código. |
| Criar `quote_revisions` | É a `orc_publicacoes`, que já versiona — e versiona a coisa certa (o documento publicado), não o rascunho. |
| Migrar Groq → Gemini | Custo de migração sem hipótese associada. Transcrição e extração funcionam. |
| Cadastro público, trial, cobrança dentro do produto | O modelo é white label com onboarding manual. Cobrança é contrato, fora do sistema. |
| Editor de Markdown para o cliente | Prosa já é editável em `orc_secoes`. Número se edita como item estruturado, nunca como texto. |
| Ler dados de outra org com service key para "facilitar o console" | A RLS é a única coisa que impede uma empreiteira de ver a outra. Ver seção 3. |
| Busca global, notificações, dashboard do cliente final | Previstos no documento de UI, sem usuário que peça. |

---

## 3. O achado que define a arquitetura

`lib/admin/sessao.ts` resolve a org assim:

```ts
.from("org_members").select("org_id").eq("user_id", userId)
.order("created_at").limit(1).maybeSingle()
```

**Um usuário = a primeira org em que ele entrou.** Toda função de dados chama
`orgAtual()` por dentro. Se o operador virar membro de várias orgs para poder
lê-las, nada quebra visivelmente: o sistema passa a ler a org errada, em
silêncio, misturando dados de duas empreiteiras.

O núcleo desta feature, portanto, não é o CRM nem a cota. É trocar a org
**implícita** pela org **ativa explícita**. Feito nesse único ponto, o resto do
código continua igual — que é exatamente o que o comentário do próprio arquivo
previu.

### Como fazer

1. `orgAtual()` passa a resolver: org ativa da sessão, se houver e se for
   válida; senão, a única membership do usuário; senão, `/admin/login`.
2. A org ativa vive num cookie. **O cookie é palpite, não autorização.** Em
   toda resolução, conferir que existe linha em `org_members` para
   (usuário, org do cookie). Cookie apontando para org sem vínculo é ignorado —
   não é erro 500 e não é acesso.
3. `garantirOrg()` continua criando org na primeira entrada **apenas para
   usuário sem nenhuma membership**. Operador já tem várias; nunca deve nascer
   org nova para ele.
4. `exigirAdmin()` passa a devolver também `ehOperador` e a lista de orgs
   acessíveis.
5. Manter o `cache()` do React em `exigirAdmin` — sem ele são quatro validações
   de sessão por página, e a razão está documentada no próprio arquivo.

### O que não fazer aqui

Service key continua restrita ao que já usa hoje (resolver sessão, storage
assinado). Toda leitura do console passa pela RLS, com o operador como membro
de verdade.

---

## 4. Papel de operador

Duas coisas separadas, e a separação é o que mantém a RLS intacta:

| Conceito | Onde mora | O que garante |
| --- | --- | --- |
| **Autorização de dados** | `org_members` + RLS | O que o usuário pode ler e escrever. Não muda. |
| **Capacidade de console** | tabela nova `operadores` | Se ele pode trocar de org, ver a lista de clientes e mexer em cota e cobrança. |

```sql
create table operadores (
  user_id uuid primary key,
  criado_em timestamptz not null default now()
);
```

Ser operador é global, não por org. O operador ganha acesso aos dados de uma
empreiteira sendo inserido em `org_members` daquela org — o mesmo mecanismo de
sempre, sem policy nova e sem exceção no RLS.

`ADMIN_EMAIL_ALLOWLIST` continua sendo a porta de entrada do painel. Allowlist
diz quem entra; `operadores` diz quem comanda.

---

## 5. Modelo de dados

Todo dinheiro usa o mesmo tipo numérico já usado em `orc_itens` — não
introduzir centavos em inteiro e criar duas convenções de dinheiro no banco.
Toda tabela nova tem `org_id` e RLS pelo mesmo padrão das existentes.

### 5.1 Identidade da empreiteira

Hoje a identidade do documento está em `lib/orcamento/marcas.ts`, constante de
código, com arquivos em `public/marcas/`. Acrescentar empreiteira exige deploy.
Este é o único gargalo de código entre o estado atual e o segundo cliente.

Mover para `orgs`: nome de assinatura, cor de acento, logo (já existe
`logo_caminho`) e folha de estilo do documento — a folha como arquivo no bucket
público `marca`, subida no onboarding, com a folha `obra-nova` como padrão
quando a org não tem a sua. `lerMarca` passa a resolver a partir da org do
orçamento; `rd` e `obra_nova` viram linhas de dados.

A folha de estilo **não** vira campo de texto livre editável por formulário.

### 5.2 Contratos e lotes — a cota como saldo

A cota não é um inteiro na org. É saldo de lotes comprados, porque o cliente
compra 15, consome 11, compra mais 15, e você precisa saber o que venceu, o que
sobrou e o que já foi cobrado.

```sql
create table contratos (
  id uuid primary key,
  org_id uuid not null references orgs(id),
  nome text not null,                 -- "Pacote 15", "Mensal 20"
  modalidade text not null,           -- 'pacote' | 'mensal'
  valor numeric,                      -- o que foi vendido
  inicio date not null,
  fim date,                           -- nulo = vigente
  status text not null,               -- 'ativo' | 'encerrado' | 'suspenso'
  observacao text,
  created_at timestamptz not null default now()
);

create table lotes (
  id uuid primary key,
  org_id uuid not null references orgs(id),
  contrato_id uuid references contratos(id),
  quantidade int not null,            -- quantos orçamentos este lote dá direito
  validade date,                      -- nulo = não vence
  observacao text,
  created_at timestamptz not null default now()
);
```

### 5.3 Consumo — atribuição, não recontagem

Acrescentar `orc_orcamentos.lote_id` (nulável) e `orc_orcamentos.consome_cota`
(booleano, padrão `true`).

**Na primeira publicação** — e só na primeira, `orc_publicacoes.versao = 1` —
se `consome_cota` for verdadeiro, o orçamento é atribuído ao lote mais antigo
ainda válido e com saldo. Republicar corrige um documento e nunca consome de
novo.

Se não houver lote com saldo, **a publicação acontece do mesmo jeito** e
`lote_id` fica nulo. Isso não é falha: é a linha "fora do pacote", que significa
*isto ainda não foi cobrado*.

Por que atribuir em vez de contar por consulta: contagem por consulta muda de
resposta quando a regra muda, e o histórico do que já foi faturado não pode
mudar retroativamente. `lote_id` congela a decisão no momento em que foi
tomada — o mesmo princípio de `valor_aprovado`.

`consome_cota = false` cobre cortesia, refação de erro seu e orçamento de
demonstração. Toda troca desse campo é registrada em `orc_eventos`.

### 5.4 Cobrança

```sql
create table pagamentos (
  id uuid primary key,
  org_id uuid not null references orgs(id),
  contrato_id uuid references contratos(id),
  valor numeric not null,
  recebido_em date not null,
  forma text,                         -- 'pix' | 'transferencia' | 'boleto' | 'outro'
  observacao text,
  created_at timestamptz not null default now()
);

create table recebimentos_previstos (
  id uuid primary key,
  org_id uuid not null references orgs(id),
  contrato_id uuid references contratos(id),
  valor numeric not null,
  vence_em date not null,
  status text not null,               -- 'previsto' | 'recebido' | 'cancelado'
  pagamento_id uuid references pagamentos(id),
  observacao text
);
```

Registro manual. **Sem gateway de pagamento, sem emissão de nota, sem
integração bancária.**

Um previsto vira recebido quando um pagamento é vinculado a ele. Um pagamento
pode existir sem previsto (avulso). Nunca deduzir status por data: vencido e
não pago continua `previsto`, e a tela é que mostra em vermelho.

---

## 6. Telas

### 6.1 Barra de contexto — o item mais importante desta seção

Quando o operador está atuando por uma empreiteira, isso precisa ser
**impossível de não ver**: barra fixa no topo com o nome da empreiteira e a cor
de acento dela, e o botão de trocar. O erro que esta barra existe para impedir é
publicar um orçamento na marca errada — erro silencioso, que só o cliente final
descobre.

Trocar de org é ato deliberado, com confirmação quando há rascunho aberto.
Nunca trocar automaticamente.

### 6.2 `/operador` — a lista de clientes

Uma tabela, uma linha por empreiteira:

| Coluna | Conteúdo |
| --- | --- |
| Empreiteira | Nome e logo pequeno |
| Plano | Contrato ativo, ou "sem contrato" |
| Cota | consumido / contratado no lote vigente, com barra |
| Fora do pacote | Orçamentos publicados sem lote — **a coluna que vira dinheiro** |
| Último orçamento | Data e situação do último publicado |
| Pagamento | Último recebido e próximo previsto, com vencido em vermelho |
| — | Ação: entrar na conta |

Ordenação padrão: quem tem "fora do pacote" maior que zero primeiro; depois
vencido; depois pelo mais recente. A lista deve responder *quem eu preciso
cobrar hoje* sem nenhum clique.

### 6.3 `/operador/[org]` — a ficha do cliente

Cabeçalho com identidade e três números: consumido no lote vigente, fora do
pacote, saldo a receber. Abas:

- **Orçamentos** — todos, com data, valor, situação comercial, se consumiu cota
  e de qual lote. Filtro por período e por lote.
- **Plano e cota** — contratos e lotes, com quantidade, validade e saldo.
  Ações: novo contrato, novo lote, encerrar contrato.
- **Cobrança** — pagamentos recebidos e previstos, com registro manual.
- **Identidade** — nome de assinatura, logo, cor, folha de estilo, cadastro.
  É aqui que a implantação acontece.
- **Linha do tempo** — fluxo único, do mais recente para o mais antigo:
  orçamento publicado, cliente abriu o link, aprovou, recusou, pagamento
  registrado, lote acrescentado. Reaproveita `orc_eventos` e acrescenta os
  eventos comerciais novos.

A linha do tempo é o que substitui o WhatsApp como memória. Só presta se os
eventos comerciais entrarem nela — registrar pagamento tem que gerar evento,
não só linha em tabela.

---

## 7. CLI do operador

Um comando, rodando local, autenticado como o operador, que opera **por dentro
das mesmas funções de servidor que a tela usa**.

**Regra que não se negocia:** a CLI não pode ter caminho próprio de escrita. Se
ela chamar o banco direto, existirão duas implementações das regras de dinheiro,
e um dia elas divergem — e o lado que diverge é o que ninguém está olhando. A
CLI é uma casca de linha de comando por cima de `lib/orcamento/acoes*.ts`.

```
obra clientes                          # lista, com cota e fora do pacote
obra orcamentos --org <slug>           # lista
obra novo --org <slug> --cliente "..." # cria rascunho, devolve o id
obra fala <id> --arquivo audio.m4a     # transcreve e extrai itens
obra itens <id>                        # mostra a tabela de custos
obra publicar <id>                     # ver abaixo
obra cota --org <slug>                 # saldo por lote
```

### Publicar pela CLI

Decisão do dono do produto: a CLI publica. Isso convive com a invariante
"publicar é ato humano" porque quem digita o comando é uma pessoa — mas só se a
pessoa enxergar os números antes. Portanto:

1. `obra publicar <id>` sempre imprime primeiro: empreiteira, marca que vai
   assinar, número de itens, itens sem preço e o **valor total**.
2. Só publica depois de confirmação digitada. Não existe flag que pule a
   confirmação — nem `--sim`, nem `--force`, nem variável de ambiente.
3. A regra "preço `null` bloqueia publicação" continua no núcleo, não na CLI.
   A CLI não valida nada por conta própria; chama a mesma ação e mostra o erro
   que vier.
4. O evento fica registrado com origem `cli`, para a linha do tempo distinguir
   o que saiu pela tela do que saiu por comando.

O risco que a confirmação cobre não é errar um comando. É um agente rodando a
sequência inteira sem ninguém ler o total antes de o documento chegar ao
cliente final.

---

## 8. Invariantes

As do `about.md` valem inteiras, com destaque para as que atravessam este
trabalho:

- A IA nunca escreve número — nem preço, nem quantidade. Valor não falado é
  `null`, nunca `0`, e `null` bloqueia a publicação.
- `custo_unitario` nunca sai no documento do cliente. Ponto único:
  `lib/orcamento/publicacao.ts`.
- `orc_itens.total` é coluna gerada pelo banco. Nunca calcular em código.
- Publicar congela. Publicar é ato humano.
- Regra mecânica se aplica em código, não em prompt.

Novas, próprias deste PRD:

- **Cookie de org ativa é palpite; `org_members` é a verdade.**
- **Service key não lê dados de cliente para o console.**
- **Cota nunca bloqueia publicação.** No máximo avisa. Contrato decide.
- **Só a versão 1 da publicação consome cota.**
- **`lote_id` congela a atribuição.** Não recalcular consumo retroativamente.
- **A CLI não tem caminho próprio de escrita.**
- **Publicação pela CLI exige confirmação digitada, sempre.**
- **Nada do console aparece para usuário não-operador** — nem rota, nem menu,
  nem campo.

---

## 9. Entregas

Ordem obrigatória. A Entrega 1 é pré-requisito técnico de todas; a 2 é a que
destrava o segundo cliente.

### Entrega 1 — Org ativa e papel de operador
Trocar `orgAtual()`, criar `operadores`, barra de contexto, troca de org.
**Aceite:** com o operador membro de duas orgs, entrar em cada uma e confirmar
que listas, orçamentos e preços mostram os dados da org ativa — e que trocar de
org troca tudo. Um usuário comum não percebe nenhuma diferença.

### Entrega 2 — Identidade por dado
Marca vinda de `orgs`, aba Identidade, migração de `rd` e `obra_nova`.
**Aceite:** implantar uma empreiteira nova, do zero até o primeiro orçamento
publicado na marca dela, **sem editar arquivo do repositório e sem deploy**.
Cronometrar; meta abaixo de 30 minutos.

### Entrega 3 — Contratos, lotes e consumo
Tabelas, atribuição na primeira publicação, lista `/operador`, aba Plano e cota.
**Aceite:** publicar três orçamentos numa org com lote de dois e ver dois
atribuídos e um marcado como fora do pacote, sem que a terceira publicação
falhe. Republicar qualquer um dos três não altera o saldo.

### Entrega 4 — Cobrança e linha do tempo
Pagamentos, previstos, aba Cobrança, linha do tempo unificada.
**Aceite:** responder, só olhando `/operador`, quem está com pagamento vencido e
quem tem orçamento fora do pacote — sem abrir planilha.

### Entrega 5 — CLI
Comandos acima, sobre as mesmas ações de servidor.
**Aceite:** criar, transcrever, revisar e publicar um orçamento de ponta a ponta
por linha de comando, com a confirmação imprimindo o total correto — e o evento
aparecendo na linha do tempo com origem `cli`.

---

## 10. Fora de escopo

- Gateway de pagamento, emissão de nota fiscal, conciliação bancária.
- Autoatendimento: cadastro público, trial, contratação de plano pelo cliente.
- Bloqueio automático de publicação por cota estourada.
- Relatórios financeiros e gráficos, além da lista de vencimentos.
- Múltiplos operadores com permissões diferentes entre si. Hoje é um; quando
  forem dois com poderes iguais, basta outra linha em `operadores`.
- Convite de usuário por org. Enquanto forem poucas empreiteiras e um operador,
  `ADMIN_EMAIL_ALLOWLIST` basta. Gatilho para revisar: a terceira empreiteira,
  ou a primeira que peça acesso para dois usuários.

---

## 11. Riscos

| Risco | Mitigação |
| --- | --- |
| Ler ou escrever na org errada | Cookie validado contra `org_members` em toda resolução; barra de contexto sempre visível; troca deliberada. |
| Publicar na marca errada | A marca vem da org do orçamento, e a confirmação da CLI imprime qual marca vai assinar. |
| Duas implementações das regras de dinheiro | CLI proibida de ter caminho próprio de escrita. |
| Console vira planilha bonita e não é usado | A lista `/operador` ordena por cobrança pendente. Se depois de um mês ainda for preciso abrir planilha para saber quem cobrar, a Entrega 4 falhou e deve ser revista, não expandida. |
| Escopo crescer para SaaS | Seções 2 e 10. |

---

## 12. Instrumentação — sem código

A decisão de preço do serviço depende de uma pergunta ainda sem resposta:
**quanto tempo leva, de fato, um orçamento do início à publicação?**

Já é mensurável com os dados que existem: `orc_orcamentos.created_at` contra o
`publicado_em` da primeira linha de `orc_publicacoes` daquele orçamento. Rode a
consulta antes de decidir qualquer preço. **Não construa tela para isso.**

O que a consulta não mede é a ida e volta com o cliente antes de o orçamento
nascer no sistema. Esse pedaço se mede a mão, no relógio, nos próximos dez. Se
ele for maior que o tempo de produção, o gargalo do serviço não é o software — e
nenhuma tarefa deste PRD ajuda.

---

## 13. Antes de qualquer deploy

`npx tsc --noEmit` e `npm run build`. **Pedir autorização antes de todo
deploy** — é regra do cliente. Deploy é sempre pela CLI da Vercel; não há git
remote.

O `AGENTS.md` avisa que esta versão do Next tem breaking changes em relação ao
que a maioria dos modelos conhece: ler `node_modules/next/dist/docs/` antes de
escrever código de framework.
