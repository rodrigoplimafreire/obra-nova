# Storage — bucket `gravacoes`

O SQL de schema e RLS entra na Fase 1. Aqui só o mínimo para o spike rodar.

## Criar o bucket

No Supabase Studio → Storage → New bucket:

- **Name:** `gravacoes`
- **Public bucket:** **desmarcado**. Nunca público — nem agora, nem depois.
- **File size limit:** 25 MB
- **Allowed MIME types:** `audio/mp4`, `audio/webm`, `audio/ogg`, `image/jpeg`, `image/png`, `image/heic`

Ou por SQL:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gravacoes',
  'gravacoes',
  false,
  26214400,
  array['audio/mp4','audio/webm','audio/ogg','image/jpeg','image/png','image/heic']
)
on conflict (id) do nothing;
```

## Políticas

Nenhuma, de propósito.

Com RLS ligada e sem policy para `anon`/`authenticated`, ninguém lê nem escreve
com a chave pública. Todo acesso do spike passa pelo servidor com a service key,
que ignora RLS por definição:

- upload → `createSignedUploadUrl` em `/api/spike/upload-url`
- leitura → `createSignedUrl` (5 min) em `/api/spike/play-url`

As policies de admin por `org_id` entram na Fase 1, junto com as tabelas.

## Região

Escolha **South America (São Paulo)** ao criar o projeto. As respostas vão
tangenciar dado de saúde; manter os arquivos no Brasil elimina uma discussão
inteira de LGPD que não vale a pena ter depois.
