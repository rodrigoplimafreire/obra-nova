-- Fase 1 — schema e RLS.
--
-- Duas notas sobre decisões que aparecem aqui:
--
-- 1. `position` no lugar de `order`. `order` é palavra reservada em SQL e
--    obrigaria aspas duplas em toda query.
-- 2. `followups` referencia o bloco e o pai. A réplica quase sempre aponta para
--    um bloco específico ("no segundo áudio você falou X"), e sem o pai não dá
--    para saber qual resposta responde qual réplica numa ida e volta.

create extension if not exists pgcrypto with schema extensions;

-- ── enums ────────────────────────────────────────────────────────────────────

create type invite_status as enum ('pending', 'in_progress', 'completed');
create type answer_status as enum ('pending', 'in_progress', 'completed');
create type block_type as enum ('text', 'audio', 'image');
create type followup_author as enum ('admin', 'respondent');
create type transcript_status as enum ('pending', 'done', 'failed');

-- ── tabelas ──────────────────────────────────────────────────────────────────

create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Quem é admin de qual org. A allowlist de e-mail vive no app; isto é o
-- vínculo depois do login.
create table org_members (
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table surveys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  title text not null,
  intro_text text,
  estimated_minutes int,
  created_at timestamptz not null default now()
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys(id) on delete cascade,
  position int not null,
  text text not null,
  helper_text text,
  -- A espinha de 5–6 perguntas idênticas entre ICPs, para comparar depois.
  is_core boolean not null default false,
  created_at timestamptz not null default now(),
  unique (survey_id, position)
);

create table respondents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

create table invites (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys(id) on delete cascade,
  respondent_id uuid not null references respondents(id) on delete cascade,
  -- Token opaco aleatório. Assinatura não acrescentaria nada: a resolução
  -- bate no banco de qualquer forma, e assim o link é revogável.
  token text not null unique,
  status invite_status not null default 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (survey_id, respondent_id)
);

create table answers (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references invites(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  status answer_status not null default 'pending',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (invite_id, question_id)
);

create table answer_blocks (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references answers(id) on delete cascade,
  position int not null,
  type block_type not null,
  text_content text,
  storage_path text,
  -- O mime real detectado na gravação, não o que o blob reporta.
  mime_type text,
  duration_ms int,
  created_at timestamptz not null default now(),
  constraint bloco_de_texto_tem_texto
    check (type <> 'text' or text_content is not null),
  constraint bloco_de_arquivo_tem_caminho
    check (type = 'text' or storage_path is not null)
);

create index on answer_blocks (answer_id, position);

create table transcripts (
  id uuid primary key default gen_random_uuid(),
  answer_block_id uuid not null references answer_blocks(id) on delete cascade,
  provider text not null,
  status transcript_status not null default 'pending',
  text text,
  language text,
  confidence real,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Idempotência: reprocessar um bloco atualiza a linha, não duplica.
  unique (answer_block_id, provider)
);

create table followups (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references answers(id) on delete cascade,
  -- A qual bloco a réplica se refere. Nulo quando é sobre a resposta inteira.
  answer_block_id uuid references answer_blocks(id) on delete set null,
  -- Encadeia pergunta do admin e resposta do respondente.
  parent_followup_id uuid references followups(id) on delete cascade,
  author followup_author not null,
  type block_type not null default 'text',
  text_content text,
  storage_path text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index on followups (answer_id, created_at);

-- ── token ────────────────────────────────────────────────────────────────────

create or replace function public.gerar_token()
returns text
language sql
volatile
as $$
  select rtrim(
    translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_'),
    '='
  );
$$;

alter table invites alter column token set default public.gerar_token();

-- ── RLS ──────────────────────────────────────────────────────────────────────
--
-- Postura: RLS ligada em tudo. O respondente NÃO tem policy — todo acesso dele
-- passa por Route Handler no servidor, que resolve token → invite_id e usa a
-- service key. O que existe aqui é o acesso do admin autenticado, restrito à
-- própria org.

alter table orgs           enable row level security;
alter table org_members    enable row level security;
alter table surveys        enable row level security;
alter table questions      enable row level security;
alter table respondents    enable row level security;
alter table invites        enable row level security;
alter table answers        enable row level security;
alter table answer_blocks  enable row level security;
alter table transcripts    enable row level security;
alter table followups      enable row level security;

-- SECURITY DEFINER para não recursar na própria policy de org_members.
create or replace function public.eh_membro(alvo uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from org_members m
    where m.org_id = alvo and m.user_id = auth.uid()
  );
$$;

revoke execute on function public.eh_membro(uuid) from anon;

create policy admin_orgs on orgs
  for all to authenticated
  using (public.eh_membro(id)) with check (public.eh_membro(id));

create policy admin_org_members on org_members
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy admin_surveys on surveys
  for all to authenticated
  using (public.eh_membro(org_id)) with check (public.eh_membro(org_id));

create policy admin_respondents on respondents
  for all to authenticated
  using (public.eh_membro(org_id)) with check (public.eh_membro(org_id));

create policy admin_questions on questions
  for all to authenticated
  using (exists (
    select 1 from surveys s
    where s.id = questions.survey_id and public.eh_membro(s.org_id)
  ))
  with check (exists (
    select 1 from surveys s
    where s.id = questions.survey_id and public.eh_membro(s.org_id)
  ));

create policy admin_invites on invites
  for all to authenticated
  using (exists (
    select 1 from surveys s
    where s.id = invites.survey_id and public.eh_membro(s.org_id)
  ))
  with check (exists (
    select 1 from surveys s
    where s.id = invites.survey_id and public.eh_membro(s.org_id)
  ));

create policy admin_answers on answers
  for all to authenticated
  using (exists (
    select 1 from invites i
    join surveys s on s.id = i.survey_id
    where i.id = answers.invite_id and public.eh_membro(s.org_id)
  ))
  with check (exists (
    select 1 from invites i
    join surveys s on s.id = i.survey_id
    where i.id = answers.invite_id and public.eh_membro(s.org_id)
  ));

create policy admin_answer_blocks on answer_blocks
  for all to authenticated
  using (exists (
    select 1 from answers a
    join invites i on i.id = a.invite_id
    join surveys s on s.id = i.survey_id
    where a.id = answer_blocks.answer_id and public.eh_membro(s.org_id)
  ))
  with check (exists (
    select 1 from answers a
    join invites i on i.id = a.invite_id
    join surveys s on s.id = i.survey_id
    where a.id = answer_blocks.answer_id and public.eh_membro(s.org_id)
  ));

create policy admin_transcripts on transcripts
  for all to authenticated
  using (exists (
    select 1 from answer_blocks b
    join answers a on a.id = b.answer_id
    join invites i on i.id = a.invite_id
    join surveys s on s.id = i.survey_id
    where b.id = transcripts.answer_block_id and public.eh_membro(s.org_id)
  ))
  with check (exists (
    select 1 from answer_blocks b
    join answers a on a.id = b.answer_id
    join invites i on i.id = a.invite_id
    join surveys s on s.id = i.survey_id
    where b.id = transcripts.answer_block_id and public.eh_membro(s.org_id)
  ));

create policy admin_followups on followups
  for all to authenticated
  using (exists (
    select 1 from answers a
    join invites i on i.id = a.invite_id
    join surveys s on s.id = i.survey_id
    where a.id = followups.answer_id and public.eh_membro(s.org_id)
  ))
  with check (exists (
    select 1 from answers a
    join invites i on i.id = a.invite_id
    join surveys s on s.id = i.survey_id
    where a.id = followups.answer_id and public.eh_membro(s.org_id)
  ));

-- ── LGPD ─────────────────────────────────────────────────────────────────────
-- Apagar um respondente leva junto convites, respostas, blocos, transcrições e
-- réplicas por cascata. Os arquivos no Storage são apagados pelo endpoint
-- admin, que lê os storage_path antes do delete.
