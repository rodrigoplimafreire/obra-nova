# PRD — Pipeline de Orçamentos e Tempo por Etapa

**Origem:** PRD v1.0 de 08/set/2026, Rodrigo Peixoto.
**Estado:** construído. Este documento é o PRD com as premissas resolvidas
contra o schema real e as decisões de implementação registradas.

---

## 0. As premissas do PRD, conferidas

O PRD pedia para marcar isto antes de codar. Foi conferido contra o banco
`wnzdsqpsowxmistbnhca` e contra o código, e **quatro das cinco estavam erradas**
— construir em cima delas teria gerado retrabalho.

| # | Premissa do PRD | Realidade | O que mudou |
|---|---|---|---|
| P1 | Existem `tenants`, `quotes`, `quote_revisions` | **Não.** Existem `orgs`, `orc_orcamentos`, `orc_publicacoes` | Nomes traduzidos, ver §1 |
| P2 | Auth Supabase e RLS por `tenant_id` | **Sim, mas por outro caminho.** RLS existe em todas as tabelas, via `private.eh_membro(org_id)` e a tabela `org_members` — não por claim no JWT | A policy nova copia exatamente o padrão existente |
| P3 | O gerador por áudio já cria um `quote` | **Sim**, cria `orc_orcamentos` | O pipeline pluga nele nos dois sentidos (§4) |
| P4 | Stack React + Vite | **Não.** Next.js 16 App Router, Server Components e Server Actions | Sem SPA, sem cliente de dados: as telas leem no servidor |

**A decisão de produto:** construído como feature **multi-tenant**, conforme a
recomendação do próprio PRD. Custo marginal foi de fato baixo — o app inteiro já
é multi-tenant, e não fazer assim teria sido o caminho mais trabalhoso.

**Tradução de nomes.** O código deste projeto é em português e o domínio de
orçamento usa o prefixo `orc_`. O pipeline seguiu a mesma casa:

| PRD | Aqui |
|---|---|
| `tenants` | `orgs` |
| `quotes` | `orc_orcamentos` |
| `pipeline_items` | `pipe_pedidos` |
| `pipeline_events` | `pipe_eventos` |
| `time_entries` | `pipe_tempos` |
| `tenant_settings` | `org_ajustes` |

---

## 1. O que foi construído

### Feature 1 — Pipeline

- **Quadro** (`/admin/pipeline`): colunas são os seis estados do funil, em
  ordem. Perdido e congelado ficam **fora da esteira**, num rodapé recolhido —
  são fins, não etapas, e enfileirá-los faria "perdido" parecer o passo depois
  de "enviado".
- **Cadastro rápido**: os quatro campos do PRD, com os seletores em botão de
  toque em vez de `select`. O `select` nativo no celular abre uma roleta que
  cobre a tela e custa três toques; o pedido chega por WhatsApp, na rua.
- **Detalhe** (`/admin/pipeline/[id]`): estado, esforço, dados, histórico.
- **Badge de parado**: dias sem evento, configurável (o PRD fixa 5; ficou
  ajustável porque o número certo só aparece depois de umas semanas de uso).

### Feature 2 — Tempo por etapa

- **Cronômetro** com estado em `localStorage`, guardando o **instante de
  início** e não os segundos decorridos — é isso que faz a conta continuar certa
  depois de o navegador do celular descartar a aba.
- **Lançamento manual** ao lado, não escondido. Não é fallback de segunda
  classe: uma feature que só mede o que foi cronometrado mede os dias bons e
  perde os dias corridos, que são justamente os que explicam a demora.
- **Análise** (`/admin/pipeline/analise`) com os indicadores derivados.

### O que **não** entrou (fora de escopo v1, como o PRD manda)

Fila offline com sincronização, notificação push, exportação em PDF, WhatsApp.

---

## 2. Decisões de implementação que valem registro

**As regras de integridade vivem no banco, não na tela.** `perdido` sem motivo
e `fechado` sem valor são `check` em `pipe_pedidos`. A tela repete a validação
só para a mensagem sair em português; a garantia é embaixo, porque a tela não é
o único caminho de escrita — há scripts, e vai haver mais.

**O evento é gravado por trigger.** O lead time inteiro é derivado de
`pipe_eventos`. Se o registro dependesse da Server Action, um caminho de escrita
que esquecesse de gravar apagaria a medida sem ninguém perceber.

**`changed_by` é assinado pela ação, não pelo trigger.** O trigger usa
`auth.uid()`, que é nulo quando a escrita vem pela chave de serviço — que é como
este app fala com o banco. A ação assina o evento recém-nascido.

**Custo nulo é nulo, nunca zero.** `custo_estimado` propaga nulo quando
`org_ajustes.custo_hora` está vazio, e a tela diz que falta calcular. R$ 0,00
exibido como verdade é pior que número nenhum: leva a decidir errado com
confiança.

**Numeração por empreiteira.** `#42` é o 42º pedido *daquela* construtora, não
um serial global. Um `unique (org_id, codigo)` é a rede: numa corrida o segundo
insert falha alto em vez de gravar dois #42.

**As funções de gatilho não são chamáveis por RPC.** O `EXECUTE` implícito a
`PUBLIC` foi revogado — revogar de `anon`/`authenticated` não bastaria, porque é
de `PUBLIC` que os dois herdam.

---

## 3. Integração com o gerador de orçamento (§4 do PRD)

Regra única do PRD: **nada de digitação dupla.** Implementada nos dois sentidos.

- **Pedido → documento:** o botão "Gerar orçamento deste pedido" cria o
  `orc_orcamentos` já com cliente, telefone e endereço, vincula os dois e move o
  pedido para `orcamento_em_producao`. Se o vínculo falhar, o orçamento criado é
  apagado — órfão é pior que não ter criado.
- **Documento → pedido:** publicar a proposta leva o pedido vinculado para
  `orcamento_enviado` e preenche a data. Só avança quem ainda não passou desse
  ponto: um pedido já fechado não volta a "enviado" porque alguém republicou uma
  correção de vírgula.

---

## 4. Verificação

`npm run verificar:pipeline` prova contra o banco de verdade, e limpa o que
cria mesmo quando falha no meio:

- código sequencial por empreiteira, atribuído por trigger
- nascimento e transições viram evento, com o estado anterior
- perdido sem motivo e fechado sem valor são recusados **pelo banco**
- motivo só com espaço em branco também é recusado
- várias entradas na mesma etapa somam; etapas distintas são contadas certo
- custo nulo com premissa vazia, e a conta certa com premissa preenchida
- apagar o pedido leva tempo e histórico junto

Dezoito verificações, todas passando.

---

## 5. O que falta, e é do Rodrigo

1. **Cadastrar os 7 orçamentos parados.** É o critério de pronto da v0.1 do PRD
   e depende de dados que só ele tem.
2. **Calcular o custo/hora e o custo/km da RD.** Até lá, toda a coluna de custo
   fica em branco de propósito — inclusive o "custo do orçamento perdido", que o
   PRD aponta como o número mais importante da lista.
3. **A conversa comercial do §7 do PRD:** se a RD paga pela feature ou se ela
   entra no pacote da parceria. Isso não é decisão de código.

## 6. Achado fora do escopo

Duas funções antigas — `vincular_operador_as_orgs()` e
`vincular_operadores_a_org()` — são `security definer` e continuam chamáveis por
`anon` via `/rest/v1/rpc`. É o mesmo conserto de uma linha que foi aplicado às
do pipeline, mas mexer nelas sem conferir quem as chama poderia quebrar o
vínculo de operador, então ficaram como estão.
