# Plano — Portal do cliente final e paridade de publicação

Companheiro do `PRD.md` (Console do Operador), não substituto. Este documento
cobre um nível abaixo: não é o Rodrigo cobrando a empreiteira (isso é o PRD,
`contratos`/`lotes`, Entrega 3), é **a empreiteira cobrando o cliente final
dela** — o Reginato e o Sr. Livônio, a Dona Izonete. Por isso as tabelas novas
aqui têm nome diferente (`clientes`, `pedidos`, `pacotes_cliente`) e não tocam
em `contratos`/`lotes` do PRD.

## Como usar este documento

Uma fase por sessão nova do Claude Code. Não continue isto na mesma conversa
que já fez outra coisa — é exatamente o hábito que causa o chat pesado que
gerou este plano. Ao abrir uma sessão nova: aponte para este arquivo e para
`PRD.md`, diga qual fase, e pronto — o contexto que importa está aqui, não no
histórico da conversa.

Ao terminar uma fase, marque `[x]` abaixo antes de fechar a sessão.

## Decisões já tomadas (não reabrir sem motivo novo)

- **Canal do cliente**: migrar de vez para o `/p/[token]` do próprio Obra
  Nova. O `rd-propostas` (HTML manual) fica como está para quem já tem link —
  nada migra para trás.
- **Domínio**: endereço novo em paralelo (ex.: `app.rd.eng.br`), não mexe em
  `orcamentos.rd.eng.br` enquanto o `rd-propostas` ainda for o canal de
  clientes antigos.
- **Paridade mínima antes do primeiro cliente novo**: só a seção de
  pagamento. Cronograma e múltiplas opções (caso Jeová) esperam o primeiro
  cliente que precisar.
- **Unidade de consumo do pacote**: 1 por **pedido** do cliente, não por
  orçamento gerado. Duas opções para o mesmo pedido (Drywall/Bloco) gastam 1,
  não 2.
- **Pacote é por cliente**, não universal — a maioria é avulso; pacote é
  perfil de cliente recorrente.
- **Acesso do cliente final**: link único e permanente por cliente, com
  senha simples. Sem conta, sem cadastro — mesmo padrão que já existe por
  orçamento avulso, só que abrangendo a lista.
- **Escopo do portal**: só orçamentos + status + consumo do pacote. Progresso
  de obra (`/o/[token]`, `/rel/[token]`) fica de fora — é outro público, e
  bate mais com a Entrega 4 do PRD (Cobrança) se algum dia unificar.

## Fase 0 — Consertar "Falar orçamento" para valor fechado

**Por quê primeiro:** é o bug que o Rodrigo relatou hoje, é pequeno, e resolve
sozinho parte do objetivo maior (parar de precisar do Claude Code para
autoria de rotina). Quatro das oito propostas de agosto importadas eram
exatamente essa forma — preço fechado, sem item por item — então não é caso
raro, é metade dos casos reais.

**O bug:** `itens-da-fala.ts` assume que toda fala vira itens. Quando o
Reginato só passa um valor total ("Mão de Obra Total Estimada: R$ 24.325,00"),
a IA não tem itens para extrair, `normalizar()` devolve array vazio, e o fluxo
responde "Não consegui identificar nenhum serviço" — em vez de reconhecer que
não havia serviço nenhum para identificar, só um preço.

**O que fazer:**
- Prompt (`INSTRUCOES`): ensinar que valor total sem detalhamento é resultado
  válido — devolver `itens: []` e um campo novo `valorFechado` (number ou
  null), nunca inventar item para caber a regra.
- `normalizar()`: ler `valorFechado`.
- `montarItensDaFala()`: quando `itens.length === 0` e `valorFechado` não é
  nulo, gravar em `orc_orcamentos.valor_fechado` em vez de retornar erro.
  Estender `SaidaDaMontagem` com um caso `fechado` para a tela distinguir "N
  itens criados" de "valor fechado registrado, sem itens".
- UI (`falar-orcamento.tsx`): mensagem de sucesso para o caso `fechado`.

**Toca em um lugar só**: `montarItensDaFala` é usado tanto por "Falar
orçamento" quanto pelo módulo de Transcrição — conserta os dois.

- [ ] Feito

## Fase 1 — Paridade de pagamento no `/p/[token]`

**Pré-requisito**: nenhum, pode rodar em paralelo com a Fase 0.

Hoje `orc_orcamentos.pagamento` é uma etiqueta de texto solto
(`DocumentoDoCliente` linha ~172). Precisa virar a seção rica que já existe no
`rd-propostas`: duas parcelas + cartão de dados bancários.

**Schema:**
```sql
alter table orgs add column banco_titular text,
                  add column banco_documento text,
                  add column banco_nome text,
                  add column banco_agencia text,
                  add column banco_conta text,
                  add column banco_pix text;

alter table orc_orcamentos add column parcelas int; -- null = à vista, 2 = 50/50
```
Dados bancários na org (não no orçamento): é o mesmo dado em toda proposta da
mesma empreiteira, e outra empreiteira que entrar depois tem o dela.

**UI**: seção "Forma de pagamento" em `DocumentoDoCliente`, condicional a
`parcelas` não ser nulo, com os valores calculados a partir do total (mesmo
cuidado de arredondamento do import de hoje — a soma das parcelas tem que
fechar em centavo exato, mesmo que uma fique com 1 centavo a mais). Tela de
Perfil ganha os campos bancários, ao lado dos que já existem
(CNPJ/telefone/logo).

- [ ] Feito

## Fase 2 — Domínio

**Pré-requisito**: Fase 1 (não faz sentido apontar domínio para uma página
sem a seção de pagamento).

- Adicionar `app.rd.eng.br` (ou nome que o Rodrigo escolher) ao projeto
  `obra-nova` na Vercel. `rd.eng.br` já é domínio dele, então é configuração,
  não infra nova.
- Confirmar que o link de `/p/[token]` funciona sob o novo domínio antes de
  usar em produção com cliente real.

- [ ] Feito

## Fase 3 — `clientes`, `pedidos`, `pacotes_cliente`

**Pré-requisito**: Fases 0–2 (senão não há onde publicar o primeiro orçamento
gerado sob este modelo).

```sql
create table clientes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  nome text not null,
  contato text,                 -- telefone/WhatsApp, para onde vai o link
  token text not null default gerar_token(),
  senha text,
  criado_em timestamptz not null default now()
);
-- RLS: mesmo padrão de org_id = orgAtual() já usado em obras/orc_orcamentos.

create table pedidos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  observacao text,
  criado_em timestamptz not null default now()
);
-- 1 pedido → N orc_orcamentos (caso Jeová: 1 pedido, 2 orçamentos).

alter table orc_orcamentos add column pedido_id uuid references pedidos(id);
-- nulável: orçamento avulso/antigo continua sem pedido, sem quebrar nada.

create table pacotes_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  quantidade int not null,      -- quantos pedidos o pacote cobre
  validade date,                -- nulo = não vence
  observacao text,
  criado_em timestamptz not null default now()
);

alter table pedidos add column pacote_id uuid references pacotes_cliente(id);
-- atribuído na criação do pedido, ao pacote mais antigo com saldo — mesmo
-- princípio de "atribuição, não recontagem" do PRD §5.3: uma vez atribuído,
-- não recalcula se a regra mudar depois.
```

**UI mínima**: ao criar orçamento (painel ou Transcrição), escolher/criar
`cliente` em vez de digitar `cliente_nome` livre — é o que faz o resto
funcionar. Aba "Pacote" na ficha do cliente (quantidade, validade, saldo),
espelhando `/operador/[org]` do PRD, um nível abaixo.

**Migração de dados**: os 8 orçamentos importados de agosto ficam sem
`cliente_id` até serem revisados manualmente — não adivinhar qual `cliente_nome`
texto vira qual `clientes.id` novo.

- [ ] Feito

## Fase 4 — Portal do cliente (`/c/[token]`)

**Pré-requisito**: Fase 3.

Rota pública `/c/[token]`, gate de senha (reaproveita `GateDoOrcamento`),
lista todos os `orc_orcamentos` do cliente via `pedidos.cliente_id`, com
status e consumo do pacote vigente (se houver). Sem progresso de obra, sem
histórico de mensagens — só a lista.

- [ ] Feito

## Fora de escopo por enquanto

- Progresso de obra unificado no portal do cliente (Entrega 4 do PRD, se um
  dia decidir juntar).
- Cronograma e múltiplas opções no `/p/[token]` — só quando um cliente
  precisar de fato.
- Migrar links antigos do `rd-propostas` para o Obra Nova.
