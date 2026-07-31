-- Obras — checklist diário do mestre de obras e relatório semanal do cliente.
--
-- Cinco decisões que valem explicação:
--
-- 1. A entrevista acontece uma vez; isto se repete todo dia. Por isso
--    `atividades` tem `dia`: a lista é lançada por data, não uma vez só.
-- 2. `confirmacoes` guarda quem confirmou, não só o quê. Uma obra pode ter mais
--    de um mestre, e na sexta importa saber de quem veio cada evidência.
-- 3. `confirmacao_blocos` repete a forma de `answer_blocks` de propósito: é o
--    mesmo material (texto, áudio, foto) e o mesmo Storage. Repetir a forma é o
--    que deixa a transcrição ser uma só.
-- 4. `transcripts` passou a apontar para um dos dois donos, em vez de ganhar uma
--    tabela gêmea. A correção do bug do prompt não-ASCII da Groq vive num lugar
--    só, e continua valendo para os dois fluxos.
-- 5. `relatorios` tem token próprio. O link do cliente final não pode ser o
--    mesmo do mestre: quem paga a obra vê o relatório pronto, não o checklist.

-- ── enums ────────────────────────────────────────────────────────────────────

create type confirmacao_status as enum ('pendente', 'feita', 'parcial', 'nao_feita');
create type relatorio_status as enum ('rascunho', 'gerando', 'pronto', 'falhou');

-- ── tabelas ──────────────────────────────────────────────────────────────────

create table obras (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  nome text not null,
  -- Quem paga a obra, e para quem o relatório de sexta é escrito.
  cliente_nome text not null,
  endereco text,
  ativa boolean not null default true,
  created_at timestamptz not null default now()
);

create index on obras (org_id, ativa);

create table mestres (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  nome text not null,
  telefone text,
  -- Link fixo, o mesmo todo dia: o mestre salva uma vez e volta nele às 16h30.
  token text not null unique default public.gerar_token(),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table atividades (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  dia date not null,
  position int not null,
  titulo text not null,
  detalhe text,
  created_at timestamptz not null default now(),
  unique (obra_id, dia, position)
);

create index on atividades (obra_id, dia);

create table confirmacoes (
  id uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references atividades(id) on delete cascade,
  mestre_id uuid not null references mestres(id) on delete cascade,
  status confirmacao_status not null default 'pendente',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (atividade_id, mestre_id)
);

create table confirmacao_blocos (
  id uuid primary key default gen_random_uuid(),
  confirmacao_id uuid not null references confirmacoes(id) on delete cascade,
  position int not null,
  type block_type not null,
  text_content text,
  storage_path text,
  mime_type text,
  duration_ms int,
  created_at timestamptz not null default now(),
  constraint bloco_obra_de_texto_tem_texto
    check (type <> 'text' or text_content is not null),
  constraint bloco_obra_de_arquivo_tem_caminho
    check (type = 'text' or storage_path is not null)
);

create index on confirmacao_blocos (confirmacao_id, position);

create table relatorios (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  inicio date not null,
  fim date not null,
  status relatorio_status not null default 'rascunho',
  provider text,
  model text,
  resultado jsonb,
  error text,
  -- Link do cliente final. Revogável: basta apagar a linha.
  token text not null unique default public.gerar_token(),
  publicado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on relatorios (obra_id, inicio desc);

-- ── transcrição compartilhada ────────────────────────────────────────────────
-- Um bloco de entrevista OU um bloco de obra, nunca os dois.

alter table transcripts
  add column confirmacao_bloco_id uuid
    references confirmacao_blocos(id) on delete cascade;

alter table transcripts alter column answer_block_id drop not null;

alter table transcripts
  add constraint transcricao_tem_um_dono
    check (num_nonnulls(answer_block_id, confirmacao_bloco_id) = 1);

-- O unique antigo não serve para o lado novo: em Postgres, NULLs contam como
-- distintos, então (null, 'groq') repetiria à vontade e a idempotência caía.
create unique index transcricao_por_bloco_de_obra
  on transcripts (confirmacao_bloco_id, provider)
  where confirmacao_bloco_id is not null;

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Mesma postura do resto: o mestre e o cliente final NÃO têm policy. O acesso
-- deles resolve token no servidor e usa a service key. Aqui só o admin da org.

alter table obras              enable row level security;
alter table mestres            enable row level security;
alter table atividades         enable row level security;
alter table confirmacoes       enable row level security;
alter table confirmacao_blocos enable row level security;
alter table relatorios         enable row level security;

create policy admin_obras on obras
  for all to authenticated
  using (private.eh_membro(org_id)) with check (private.eh_membro(org_id));

create policy admin_mestres on mestres
  for all to authenticated
  using (exists (
    select 1 from obras o
    where o.id = mestres.obra_id and private.eh_membro(o.org_id)
  ))
  with check (exists (
    select 1 from obras o
    where o.id = mestres.obra_id and private.eh_membro(o.org_id)
  ));

create policy admin_atividades on atividades
  for all to authenticated
  using (exists (
    select 1 from obras o
    where o.id = atividades.obra_id and private.eh_membro(o.org_id)
  ))
  with check (exists (
    select 1 from obras o
    where o.id = atividades.obra_id and private.eh_membro(o.org_id)
  ));

create policy admin_confirmacoes on confirmacoes
  for all to authenticated
  using (exists (
    select 1 from atividades a
    join obras o on o.id = a.obra_id
    where a.id = confirmacoes.atividade_id and private.eh_membro(o.org_id)
  ))
  with check (exists (
    select 1 from atividades a
    join obras o on o.id = a.obra_id
    where a.id = confirmacoes.atividade_id and private.eh_membro(o.org_id)
  ));

create policy admin_confirmacao_blocos on confirmacao_blocos
  for all to authenticated
  using (exists (
    select 1 from confirmacoes c
    join atividades a on a.id = c.atividade_id
    join obras o on o.id = a.obra_id
    where c.id = confirmacao_blocos.confirmacao_id and private.eh_membro(o.org_id)
  ))
  with check (exists (
    select 1 from confirmacoes c
    join atividades a on a.id = c.atividade_id
    join obras o on o.id = a.obra_id
    where c.id = confirmacao_blocos.confirmacao_id and private.eh_membro(o.org_id)
  ));

create policy admin_relatorios on relatorios
  for all to authenticated
  using (exists (
    select 1 from obras o
    where o.id = relatorios.obra_id and private.eh_membro(o.org_id)
  ))
  with check (exists (
    select 1 from obras o
    where o.id = relatorios.obra_id and private.eh_membro(o.org_id)
  ));

-- A policy antiga de transcripts só enxergava o lado da entrevista. Sem estender,
-- toda transcrição de obra ficaria invisível para o próprio admin que a gerou.
drop policy admin_transcripts on transcripts;

create policy admin_transcripts on transcripts
  for all to authenticated
  using (
    exists (
      select 1 from answer_blocks b
      join answers a on a.id = b.answer_id
      join invites i on i.id = a.invite_id
      join surveys s on s.id = i.survey_id
      where b.id = transcripts.answer_block_id and private.eh_membro(s.org_id)
    )
    or exists (
      select 1 from confirmacao_blocos cb
      join confirmacoes c on c.id = cb.confirmacao_id
      join atividades ativ on ativ.id = c.atividade_id
      join obras o on o.id = ativ.obra_id
      where cb.id = transcripts.confirmacao_bloco_id and private.eh_membro(o.org_id)
    )
  )
  with check (
    exists (
      select 1 from answer_blocks b
      join answers a on a.id = b.answer_id
      join invites i on i.id = a.invite_id
      join surveys s on s.id = i.survey_id
      where b.id = transcripts.answer_block_id and private.eh_membro(s.org_id)
    )
    or exists (
      select 1 from confirmacao_blocos cb
      join confirmacoes c on c.id = cb.confirmacao_id
      join atividades ativ on ativ.id = c.atividade_id
      join obras o on o.id = ativ.obra_id
      where cb.id = transcripts.confirmacao_bloco_id and private.eh_membro(o.org_id)
    )
  );
