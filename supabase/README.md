# Banco

Projeto Supabase **`obra-nova`** — ref `wnzdsqpsowxmistbnhca`, região São Paulo
(`sa-east-1`), org `rodrigoplimafreire`.

As migrações vivem no projeto, aplicadas pelo MCP do Supabase. Esta pasta não
carrega cópia delas para não haver duas versões da verdade divergindo em
silêncio. Para trazer o schema para cá quando quiser versioná-lo:

```bash
npx supabase link --project-ref wnzdsqpsowxmistbnhca && npx supabase db pull
```

Aplicadas até agora:

| versão | nome |
| --- | --- |
| 20260731152439 | `schema_inicial_obra_nova` |
| — | `limites_do_bucket` |

## O que o schema garante, e por quê

- **`unique (obra_id, inicio, fim)` em `relatorios`.** Dois cliques em "gerar"
  criavam dois relatórios da mesma semana. A trava é do banco, não da rota.
- **`publicado_em` exige `status = 'pronto'` e `resultado` preenchido.** Impede
  publicar página vazia para quem paga a obra.
- **`unique (confirmacao_bloco_id, provider)` em `transcripts`.** O upsert da
  transcrição já dependia disso sem ter — reprocessar duplicava a linha.
- **`unique (obra_id, dia, position)` em `atividades`**, e por isso a reordenação
  passa por posições negativas antes de assentar.
- **RLS em todas as tabelas**, com policy só para `authenticated` e resolução de
  org via `private.eh_membro()` (`SECURITY DEFINER`, `search_path` vazio).

## Storage

Bucket **`gravacoes`**, privado, sem policy nenhuma — de propósito.

Com RLS ligada e sem policy para `anon`, ninguém lê nem escreve com a chave
pública. Todo acesso passa pelo servidor com a service key:

- upload → `createSignedUploadUrl` em `/api/o/[token]/upload-url`
- leitura no canteiro → `createSignedUrl` de 10 min
- fotos do relatório → `createSignedUrls` de 1 h, na renderização da página

Teto de 25 MB por arquivo e MIME restrito a áudio e imagem.

## Ninguém sem login lê tabela

O mestre e o cliente final não têm conta, e mesmo assim nenhuma rota deles usa
a chave anônima contra o banco. `/o/[token]` e `/rel/[token]` são Server
Components; o token é resolvido no servidor e só o que aquele token pode ver
volta para a página. É por isso que RLS deny-all para `anon` não atrapalha nada.
