# Obra Nova

O relatório semanal que mostra ao cliente final que a obra está andando. O
empreiteiro não perde tempo explicando por WhatsApp: o cliente abre um link,
vê foto, relato e o que vem na semana seguinte.

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
| `/o/[token]` | o mestre, no canteiro: a semana dele |
| `/o/[token]/a/[atividadeId]` | confirmar um serviço com foto, áudio e texto |
| `/rel/[token]` | o cliente final: o relatório publicado |

## Decisões que valem lembrar

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
