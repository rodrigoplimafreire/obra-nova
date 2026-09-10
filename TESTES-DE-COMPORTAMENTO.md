# Testes de comportamento — Obra Nova

O que o sistema faz, módulo por módulo, no formato **entrada → saída esperada**,
com os casos de borda.

Não é documentação de código: é o contrato observável. Se alguma linha aqui
deixar de ser verdade, ou o comportamento regrediu ou este documento
envelheceu — e os dois são bug.

**Como foi levantado:** lido do código-fonte (guardas das Server Actions,
funções puras, constraints do Postgres). Onde não consegui confirmar por
leitura, está marcado com ⚠️ **não verificado**.

**O que já roda sozinho:**

```bash
npm run verificar:precificacao      # a conta da carga comercial
npm run verificar:custo-comercial   # tempo + km de um orçamento
npm run verificar:pipeline          # 18 checagens no banco, auto-limpantes
npm run verificar:colagem           # o parser de orçamento colado
npm run verificar:valor-fechado
npm run verificar:falas
npm run verificar:org
```

O resto deste documento é o comportamento que **ainda não tem** teste
automatizado. A coluna "coberto" diz qual script prova cada bloco.

---

## 1 · Acesso ao painel

| Entrada | Saída esperada |
| --- | --- |
| E-mail fora da allowlist tenta entrar | Acesso negado; a conta pode existir no Auth mas não vê painel |
| E-mail na allowlist, senha certa | Sessão criada; `orgAtual()` resolve a empreiteira |
| Sessão expirada em Server Component | `exigirAdmin()` derruba para `/admin/login` |
| Usuário de outra org abre `/admin/orcamentos/<id>` alheio | **404**, não 403 — não revela que o id existe |
| `trocarOrg(orgId)` sem vínculo | `{ ok: false, erro: "Você não tem acesso a esta empreiteira." }` |
| `liberarAcesso("nao-é-email")` | `{ ok: false, erro: "Isso não parece um e-mail." }` |
| `tirarAcesso(<próprio e-mail>)` | `{ ok: false, erro: "Você não pode remover o seu próprio acesso." }` |
| `confirmarEmailDeConta` de e-mail sem conta | `"Não existe conta com este e-mail. A pessoa precisa se cadastrar primeiro."` |
| `confirmarEmailDeConta` de e-mail já confirmado | `"Este e-mail já estava confirmado."` |

**Bordas**

- O middleware (`src/proxy.ts`) só casa `/admin/:path*`. As rotas públicas
  (`/p`, `/o`, `/rel`) **não** passam por renovação de sessão — entram por
  token, sem cookie de auth.
- RLS é a única coisa que separa empreiteiras. Escrita administrativa usa
  service key e **precisa** filtrar `org_id` na mão; esquecer o filtro é
  vazamento entre clientes, e o teste disso é o `verificar:org`.

---

## 2 · Orçamento — dados do documento

| Entrada | Saída esperada |
| --- | --- |
| `criarOrcamento` com cliente vazio | `"Escreva para quem é o orçamento."` |
| `criarOrcamento` com cliente preenchido | Orçamento em `situacao: rascunho`, `status: briefing`, token gerado, `validade_dias: 15`, `parcelas: 2`, `bdi_padrao: 30` |
| `atualizarOrcamento` com validade `0` ou `366` | `"A validade precisa ficar entre 1 e 365 dias."` |
| `atualizarOrcamento` com valor fechado negativo | `"O valor fechado não pode ser negativo."` |
| `atualizarOrcamento` com BDI `-1` ou `501` | `"O BDI precisa ficar entre 0% e 500%."` |
| `numerarOrcamento` no primeiro do ano | `RD-2026-001` |
| `numerarOrcamento` com `RD-2026-007` já usado | `RD-2026-008` — continua do **maior**, não da contagem |
| `arquivarOrcamento` | Some da lista ativa; não apaga |
| `excluirOrcamento` | Apaga em definitivo, com cascata |
| `gerarObraDoOrcamento` de orçamento aprovado | Obra criada; `orc_orcamentos.obra_id` preenchido |

**Bordas**

- Numeração continua do maior número **do ano corrente** na org. Orçamento
  apagado deixa buraco e o buraco não é reaproveitado — senão um número que já
  foi para a rua sairia duas vezes.
- Validade e BDI têm limite **nos dois lados**. Zero dias de validade é um
  documento nascido vencido.

---

## 3 · Orçamento — planilha de itens

| Entrada | Saída esperada |
| --- | --- |
| `adicionarItem` com descrição vazia | `"Escreva o que é o serviço ou o material."` |
| `adicionarItem` com qtd 12 e unitário 45,00 | Linha criada; `total` = **90 é errado** → `540,00`, calculado pelo Postgres |
| `atualizarItem` com quantidade negativa | `"A quantidade não pode ser negativa."` |
| `atualizarItem` com valor negativo | `"O valor não pode ser negativo."` |
| `atualizarItem` com custo negativo | `"O custo não pode ser negativo."` |
| `removerItem` | Soft delete (`removido_em`); reaparece em "removidos" e dá para voltar |
| `moverItem` com direção diferente de cima/baixo | `"Direção inválida."` |
| `moverItem` no primeiro item para cima | Sem efeito, sem erro ⚠️ **não verificado** |
| Item sem `valor_unitario` | `total` fica `null`; a linha sai no documento com travessão |

**Bordas**

- **`orc_itens.total` é coluna GERADA** (`quantidade × valor_unitario`). Não dá
  para gravar total direto. Linha de fechamento de grupo precisa de
  `quantidade: 1, unidade: 'vb'` e o valor no unitário — senão soma zero.
- **`unique (orcamento_id, position)` conta linhas soft-deleted.** Substituir a
  planilha inteira reusando as mesmas positions viola a constraint. O padrão
  adotado é abrir uma faixa nova (100+, 200+, …).
- Descontos **não** entram como item de valor negativo — há
  `orc_itens_valor_unitario_check`. Desconto vira texto em `nota_custos` ou
  ajuste no `valor_fechado`.

---

## 4 · Orçamento — preço, custo e margem

| Entrada | Saída esperada |
| --- | --- |
| Item com custo 100 e BDI 30% | Preço sugerido 130,00 ⚠️ **não verificado** (confirmar a fórmula em `precos.ts`) |
| Orçamento com 10 itens, 3 sem custo | `semCusto: 3`; margem calculada **só** sobre os 7 com custo |
| `custoTotal` = 0 | `margemPercentual: null` — não divide por zero |
| `valor_fechado` preenchido | `total` = valor fechado, **ignorando** a soma dos itens |
| `valor_fechado` nulo | `total` = soma dos itens vivos |
| `criarBaseDePreco` sem nome | `"Dê um nome para esta base de preços."` |
| `alternarBaseAtiva` / `excluirBaseDePreco` sem id | `"Base inválida."` |
| `inserirLoteDeComposicoes` em base inexistente | `"Base não encontrada."` |

**Bordas**

- `semCusto` **não bloqueia** publicar — falta de custo é problema de margem.
  `semPreco` **bloqueia** — falta de preço é documento errado.
- Margem é sempre parcial quando `semCusto > 0`. A tela precisa dizer isso; um
  percentual bonito sobre metade dos itens é pior que nenhum.

---

## 5 · Orçamento — entrada por fala (áudio e texto)

| Entrada | Saída esperada |
| --- | --- |
| `urlDeUpload` com mime fora da lista | `"Formato não aceito: <mime>"` |
| `urlDeUpload` com extensão inválida | `"Extensão inválida."` |
| `urlDeUpload` com arquivo > 25 MB | `"Arquivo acima do limite de 25 MB."` |
| `registrarTextoDaFala` com texto vazio | `"Escreva o que precisa ser feito."` |
| Qualquer ação com orçamento de outra org | `"Orçamento inválido."` |
| `transcreverDaFala` com provedor fora do ar | Bloco fica com status de falha; dá para `retranscrever` |
| `montarTabelaDaFala` com a fala sem número | Itens sem preço, **nunca** com preço inventado |

**Bordas**

- **Preço nunca é estimado pela IA.** Se a fala não disse o valor, a linha nasce
  sem preço e a publicação trava até alguém preencher. Essa é a regra mais
  importante do módulo.
- O teto das Server Actions desta tela é `maxDuration = 60`; as chamadas
  externas ficam em 35 s para caber com folga para gravar o erro.

---

## 6 · Orçamento — colagem e importação de planilha

| Entrada | Saída esperada |
| --- | --- |
| `entenderColagem` com 7 imagens | `"No máximo 6 imagens por vez."` |
| `entenderColagem` com 5 áudios | `"No máximo 4 áudios por vez."` |
| `criarDaColagem` sem nome do cliente | `"Falta o nome do cliente."` |
| `criarDaColagem` sem senha | `"Falta a senha do link."` |
| `criarDaColagem` com zero itens reconhecidos | `"Nenhum item para gravar."` |
| `acrescentarDaColagem` com zero itens | `"Nenhum item para acrescentar."` |
| `importarItens` com planilha sem descrição em nenhuma linha | `"Nenhuma linha com descrição válida."` |

**Coberto por** `npm run verificar:colagem`.

---

## 7 · Orçamento — textos do documento

| Entrada | Saída esperada |
| --- | --- |
| Todos os 4 parágrafos vazios | Documento sai com as frases genéricas; publicar **não** trava |
| `salvarSecao` com título < 2 caracteres | `"Escreva um título."` |
| `salvarSecao` com texto < 2 caracteres | `"Escreva o texto do bloco."` |
| `salvarSecao` com tipo fora de projeto/observacao/etapa | `"Tipo de bloco inválido."` |
| `moverSecao` no primeiro bloco para cima | Sem troca; sem erro ⚠️ **não verificado** |
| `escreverTextosComIA` sem itens na tabela | Botão desabilitado na UI; a ação em si ⚠️ **não verificado** |
| Campo salvo como string vazia | Grava `null`, não `""` — apagar é uma decisão |

---

## 8 · Orçamento — planejamento (seções 2 e 4 da proposta)

| Entrada | Saída esperada |
| --- | --- |
| Nenhuma macroetapa cadastrada | Seção "Resumo orçamentário" **não aparece** no documento |
| Nenhuma semana cadastrada | Seção "Cronograma executivo" **não aparece** |
| Macroetapas sem valor nem percentual | Tabela sai com 2 colunas: macroetapa e prazo |
| Ao menos uma macroetapa com valor | Coluna "Valor" aparece; as sem valor mostram travessão |
| `salvarModulo` com nome < 2 caracteres | `"Escreva o nome da macroetapa."` |
| `salvarSemana` com semana `0` ou `105` | `"A semana precisa ser um número de 1 a 104."` |
| `salvarSemana` repetindo uma semana existente | `"A semana N já está no cronograma."` (traduz o 23505 do Postgres) |
| `puxarModulosDosGrupos` com módulos já cadastrados | `"Já existem macroetapas. Apague antes de puxar."` |
| `puxarModulosDosGrupos` com planilha sem grupos | `"A planilha não tem grupos para puxar."` |
| `puxarModulosDosGrupos` numa planilha com 3 grupos | 3 módulos, na ordem de aparição, com valor e percentual; **prazo em branco** |
| Grupo com soma zero | `valor: null` e `percentual: null` — não grava percentual falso |
| Meta física com 3 linhas | 3 marcadores no documento; linhas em branco descartadas |

**Bordas**

- A ordem é a da planilha, não alfabética: a planilha já está na ordem em que a
  obra acontece.
- `position` de módulo novo nasce do **maior já usado**, não da contagem —
  senão apagar do meio repetiria uma position viva.

---

## 9 · Publicação e versionamento

| Entrada | Saída esperada |
| --- | --- |
| `publicarOrcamento` com zero itens | `"Inclua ao menos um item antes de publicar."` |
| `publicar` com 7 itens sem preço e sem valor fechado | `"7 itens estão sem preço de venda. Preencha antes de enviar ao cliente."` |
| Mesmo caso, com **1** item sem preço | `"1 item está sem preço de venda…"` — concorda em número |
| `publicar` com itens sem preço **mas** com `valor_fechado` | Publica; o total é o valor fechado |
| `publicar` sem senha definida | `"Defina uma senha em Dados do orçamento: o link circula por WhatsApp…"` |
| Primeira publicação | `versao: 1` |
| Publicar de novo | `versao: 2`; a v1 continua no histórico |
| Republicar orçamento em negociação | Situação **não** rebaixa: quem negociava segue negociando |
| `republicar` de orçamento nunca publicado | `"Este orçamento nunca foi publicado."` |
| `republicar` sem senha | `"Sem senha definida."` |
| Item removido depois de publicar | Não aparece na publicação existente — o snapshot está congelado |

**Bordas**

- **O snapshot congela conteúdo e preço; a empreiteira é lida ao vivo.** Trocar
  o logotipo, o telefone ou o banco muda todos os documentos já enviados, de
  propósito. Trocar o preço de um item, não.
- `montarDocumento` remapeia campo a campo. **Custo nunca entra no snapshot** —
  o cliente não pode ler a margem da empreiteira.
- Publicação anterior a uma feature nova (ex.: cronograma) não tem o campo;
  `lerDocumento` devolve array vazio e a seção simplesmente não aparece. Nunca
  quebra.

---

## 10 · Documento do cliente (`/p/<token>`)

| Entrada | Saída esperada |
| --- | --- |
| Token inexistente | **404** com a página "Este endereço não existe" |
| Token válido, orçamento nunca publicado | **404** — quem tem o link não precisa saber que existe |
| Token válido, com senha, sem cookie | Tela de gate |
| Senha errada | `"Senha incorreta."` |
| Senha certa | Cookie `orc_gate_<token>`, `httpOnly`, `path: /`, 30 dias; abertura registrada |
| Segunda visita, mesmo navegador | Entra direto, sem pedir senha |
| Senha do orçamento A no orçamento B | Não abre — o cookie é por token, pelo **nome** |
| Orçamento sem senha | Abre direto, sem gate |
| Robô de preview do WhatsApp abre o link | **Não** conta como abertura (o gate nunca é passado) |
| Clicar em "Imprimir" | Abre o diálogo de impressão do navegador |
| `aceitarOrcamento` sem cookie de gate | `"Sessão expirada. Recarregue a página e entre de novo."` |
| `aceitarOrcamento` com nome de 2 letras | `"Escreva seu nome completo para registrar o aceite."` |
| `aceitarOrcamento` válido | Situação vira `aprovado`; `valor_aprovado` congelado; evento `aceito` com nome, versão e valor |
| `aceitarOrcamento` num já aprovado | `{ ok: true }` — idempotente, não duplica evento |
| Orçamento aprovado | Formulário some; aparece o comprovante com quem aceitou, quando, versão e valor |
| Aprovado pelo painel (sem aceite do cliente) | Comprovante **sem** a linha "Aceito por" — não mostra campo vazio |

**Bordas**

- O documento **não pode depender de JavaScript para aparecer**. Esta rota não
  tem `loading.tsx` por isso — ver o comentário em `src/app/p/[token]/page.tsx`.
- Imprimir tem dois caminhos (GET direto e resposta do gate) e os dois precisam
  funcionar, sem imprimir em dobro. Guarda de 800 ms em `__imprimirRD`.
- No domínio `orcamentos.rd.eng.br` a URL é `/cliente/`, servida por rewrite a
  partir de `/p/cliente`. **O cookie do gate precisa ter `path: /`** — com o
  path antigo ele nunca voltava e a senha era pedida a cada visita.

---

## 11 · Pipeline — pedidos e estados

| Entrada | Saída esperada |
| --- | --- |
| `criarPedido` sem nome do cliente | `"O nome do cliente é obrigatório."` |
| `criarPedido` válido | Pedido em `novo_pedido`, com `codigo` sequencial |
| `mudarEstado` para valor fora da lista | `"Estado inválido."` |
| `mudarEstado` para `fechado` sem valor fechado | `"Um pedido fechado precisa do valor fechado."` |
| `mudarEstado` válido | Estado trocado + linha em `pipe_eventos` (anterior → novo) |
| Pedido em `novo_pedido` há mais de 5 dias sem evento | `parado: true` no quadro |
| Pedido em `fechado` há 30 dias | `parado: false` — só o começo do funil é vigiado |
| `apagarPedido` | Some com o histórico de estados e todo o tempo registrado |
| `salvarDetalhes` sem id | `"Pedido não informado."` |

**Coberto por** `npm run verificar:pipeline` (18 checagens).

---

## 12 · Pipeline — tempo e deslocamento

| Entrada | Saída esperada |
| --- | --- |
| `lancarTempo` com etapa fora da lista | `"Etapa inválida."` |
| `lancarTempo` com 0 ou minutos negativos | `"Informe quantos minutos, acima de zero."` |
| `lancarTempo` com 48 min e 50 km | Linha em `pipe_tempos`; o resumo do pedido soma |
| Dois lançamentos na mesma etapa | Somam; `etapas_registradas` conta etapas **distintas** |
| Pedido com 48 min, 50 km, custo/h 89,49, custo/km 1,16 | `custo_estimado` = **R$ 129,59** |
| Detalhe do card | `"R$ 71,59 de tempo + R$ 58,00 de km"` |
| Pedido sem nenhum tempo lançado | `custo_estimado` = 0, e a tela mostra "sem tempo registrado" — **não** R$ 0,00 |
| Org sem `custo_hora` | `custo_estimado: null`; a tela diz "falta o custo/hora" |
| Org com `custo_hora` mas sem `custo_km` | O km não entra; o tempo ainda conta |

**Coberto por** `npm run verificar:custo-comercial`.

**Bordas**

- A conta é sempre **as duas parcelas**: `minutos ÷ 60 × custo/hora + km ×
  custo/km`. Uma função só (`custoDeProducao`), porque a mesma fórmula vive na
  view do Postgres, na tela e no cálculo da carga.
- Arredonda para o centavo: 10 min a R$ 89,49/h → R$ 14,92.

---

## 13 · Precificação — carga comercial

| Entrada | Saída esperada |
| --- | --- |
| Sem custo/hora | `impedimento: "Falta o custo por hora…"`; `base: null` |
| Sem orçamento padrão e sem medição | `"Falta o orçamento padrão: quantos minutos cada etapa costuma levar."` |
| Sem conversão estimada e sem histórico | `"Falta a conversão estimada — de cada 10 orçamentos, quantos fecham."` |
| Conversão 0% | `"Nenhum orçamento fechou ainda…"`; `base: null` — **não** `Infinity` |
| 3 pedidos medidos | `fonteDoCusto: "premissa"` — usa a tabela digitada |
| 4 pedidos medidos | `fonteDoCusto: "medido"` — a média assume (`MINIMO_PARA_CUSTO = 4`) |
| 5 desfechos | `fonteDaConversao: "premissa"` |
| 6 desfechos, 2 fechados | `fonteDaConversao: "medido"`, `conversao: 33,3` (`MINIMO_PARA_CONVERSAO = 6`) |
| Custo R$ 630 e conversão 33,3% | `base` ≈ R$ 1.890 — o dele e o dos dois perdidos |
| Multiplicadores P 0,5 / M 1 / G 1,6 | `porPorte` = base × multiplicador |
| Pedido fechado sem porte | Entra como **M** no cálculo de cobertura |
| Nenhum desfecho ainda | `cobertura: null` — não há o que comparar |
| Carga R$ 1.890 numa obra de R$ 10.000 | `pesoNaObra` = 18,9% |
| Obra com valor 0 | `pesoNaObra: null` — não divide por zero |

**Coberto por** `npm run verificar:precificacao` (26 checagens).

**Bordas**

- A carga é **política de preço, não medição**. É média por porte porque, no dia
  em que a proposta é montada, ninguém sabe quais das próximas vão se perder.
- `cobertura` é a conferência que impede a carga de ser bonita e insuficiente:
  compara o que as fechadas recuperariam contra o gasto em **todas** com
  desfecho.

---

## 14 · Transcrições avulsas

| Entrada | Saída esperada |
| --- | --- |
| Upload de arquivo não-áudio | `"Formato não aceito. Use um áudio: opus, m4a, mp3, ogg, wav ou webm."` |
| Upload > 25 MB | `"Arquivo acima do limite de 25 MB."` |
| `salvarTexto` com texto vazio | `"O texto não pode ficar vazio."` |
| `criarOrcamentoDaTranscricao` sem nome do cliente | `"Diga para quem é o orçamento."` |
| `criarOrcamentoDaTranscricao` de transcrição sem texto | `"Esta transcrição ainda não tem texto."` |
| `usarTranscricaoNoOrcamento` em orçamento de outra org | `"Orçamento inválido."` |
| Qualquer ação com id de outra org | `"Transcrição inválida."` |

---

## 15 · Obras e relatório semanal

| Entrada | Saída esperada |
| --- | --- |
| `criarObra` com nome < 2 caracteres | `"Escreva o nome da obra."` |
| `criarObra` sem cliente | `"Escreva para quem é a obra. É o nome que vai no relatório."` |
| `adicionarMestre` com nome < 2 caracteres | `"Escreva o nome do mestre."` |
| `salvarAtividadesDoDia` com data mal formada | `"Data inválida."` |
| `salvarAtividadesDoDia` com 41 atividades | `"São muitas atividades para um dia só. Deixe até 40."` |
| `atualizarAtividade` com título vazio | `"Escreva o que precisa ser feito."` |
| `trazerPendencias` sem pendência ontem | `"Não há pendência do dia anterior para trazer."` |
| `trazerPendencias` com pendências já trazidas | `"As pendências já estão na lista de hoje."` |
| `gerarRelatorioDaSemana` com período inválido | `"Período inválido."` |
| `publicarRelatorio` de relatório em rascunho | `"Só dá para publicar um relatório pronto."` |
| `/rel/<token>` de relatório despublicado | Não abre ⚠️ **não verificado** (confirmar se 404 ou aviso) |
| `/o/<token>` — mestre no canteiro | Checklist do dia, sem login |

---

## 16 · Perfil, empreiteira e marca

| Entrada | Saída esperada |
| --- | --- |
| Org sem `nome_exibicao`, `name` = "fulano@gmail.com" | `nome: null` — **não** mostra e-mail no cabeçalho do documento |
| Org sem `nome_exibicao`, `name` = "RD Engenharia" | `nome: "RD Engenharia"` |
| `contaPreenchida` com só PIX | `true` |
| `contaPreenchida` com agência **e** conta | `true` |
| `contaPreenchida` com só agência | `false` |
| `contratoPreenchido` com nenhuma cláusula | `false` → a seção de condições **não aparece** |
| `contratoPreenchido` com só o responsável técnico | `true` |
| `normas_tecnicas` com linhas em branco no meio | Linhas vazias descartadas; `\r\n` e `\n` tratados igual |
| `lerMarca(null)` ou chave desconhecida | Cai em `MARCA_PADRAO` (`"rd"`) |
| Logo trocado no Perfil | Muda em **todos** os documentos já publicados |

**Bordas**

- Bloco de garantias em branco num contrato é pior que bloco nenhum: parece que
  a empreiteira não dá garantia. Por isso a seção some inteira quando vazia.
- Ainda **não há tela no Perfil** para editar as cláusulas do contrato — elas se
  gravam direto no banco.

---

## 17 · Número e moeda (transversal)

*Esta tabela foi conferida rodando as funções, não deduzida do código.*

| Entrada | Saída esperada |
| --- | --- |
| `moeda(3950)` | `"R$ 3.950,00"` |
| `moeda(null)` / `moeda(undefined)` | `"—"` |
| `moeda(0)` | `"R$ 0,00"` — zero é um valor, não ausência |
| `lerNumero("1.234,56")` | `1234.56` |
| `lerNumero("1234.56")` | `1234.56` |
| `lerNumero("1234,56")` | `1234.56` |
| `lerNumero("R$ 1.234,56")` | `1234.56` |
| `lerNumero("1.234")` | `1.234` — o **último** separador é o decimal |
| `lerNumero("")` / `lerNumero(null)` | `null` — vazio não é zero, é "não foi falado ainda" |
| `lerNumero("abc")` | `null` |
| `paraCampo(1234.56)` | `"1234,56"` |
| `paraCampo(null)` | `""` |

**Borda que precisa de decisão sua:** a regra do último separador existe para
distinguir `"1.5"` (um e meio) de quem digita vírgula. O efeito colateral,
confirmado rodando: **`lerNumero("1.234")` devolve `1.234`, não `1234`.**

Quem digitar `1.234` querendo "mil duzentos e trinta e quatro" grava um real e
vinte e três centavos. É a única linha deste documento que descreve um
comportamento que talvez você não queira. Me diga e eu conserto.

---

## O que este documento ainda não cobre

Coisas que existem no produto e que eu **não** consegui especificar por leitura
de código nesta passada:

- A fórmula exata do BDI em `precos.ts` (§4)
- O comportamento de `moverItem` / `moverSecao` nas pontas da lista
- O que `/rel/<token>` responde para relatório despublicado
- `escreverTextosComIA` sem itens
- O parser de colagem linha a linha (tem teste próprio, mas os casos não estão
  descritos aqui)
- Upload de foto no canteiro: limites, formatos, compressão

Cada um desses é uma linha ⚠️ acima. Me diga quais importam e eu levanto.
