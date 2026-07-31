-- Análise por IA de uma pesquisa inteira.
--
-- Guardada como jsonb porque o formato da síntese ainda vai mudar enquanto o
-- prompt amadurece — criar colunas agora seria migrar a cada ajuste. O que
-- não muda é o vínculo com a pesquisa e a rastreabilidade do modelo usado.

create type analysis_status as enum ('running', 'done', 'failed');

create table analyses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys(id) on delete cascade,
  status analysis_status not null default 'running',
  provider text not null,
  model text not null,
  -- Quantos respondentes entraram nesta análise: uma síntese de 2 pessoas não
  -- vale o mesmo que uma de 5, e eu preciso ver isso na tela.
  respondentes int not null default 0,
  resultado jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on analyses (survey_id, created_at desc);

alter table analyses enable row level security;

create policy admin_analyses on analyses
  for all to authenticated
  using (exists (
    select 1 from surveys s
    where s.id = analyses.survey_id and private.eh_membro(s.org_id)
  ))
  with check (exists (
    select 1 from surveys s
    where s.id = analyses.survey_id and private.eh_membro(s.org_id)
  ));
