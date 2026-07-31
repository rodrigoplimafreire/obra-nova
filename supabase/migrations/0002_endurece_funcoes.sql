-- Correção dos três avisos do linter de segurança do Supabase.
--
-- O helper de RLS não pode ficar no schema `public`: o PostgREST expõe tudo que
-- está lá em /rest/v1/rpc/, e uma função SECURITY DEFINER chamável por `anon` é
-- superfície de ataque. `revoke execute ... from anon` não basta, porque
-- `PUBLIC` recebe EXECUTE por padrão. A saída é um schema que a API não expõe.
--
-- E `set search_path = ''` nas duas funções: sem isso, quem controla o
-- search_path controla quais funções a minha função acaba chamando.

create schema if not exists private;
revoke all on schema private from anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.eh_membro(alvo uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.org_members m
    where m.org_id = alvo and m.user_id = auth.uid()
  );
$$;

revoke all on function private.eh_membro(uuid) from public;
grant execute on function private.eh_membro(uuid) to authenticated;

drop policy admin_orgs on orgs;
drop policy admin_surveys on surveys;
drop policy admin_respondents on respondents;
drop policy admin_questions on questions;
drop policy admin_invites on invites;
drop policy admin_answers on answers;
drop policy admin_answer_blocks on answer_blocks;
drop policy admin_transcripts on transcripts;
drop policy admin_followups on followups;

create policy admin_orgs on orgs
  for all to authenticated
  using (private.eh_membro(id)) with check (private.eh_membro(id));

create policy admin_surveys on surveys
  for all to authenticated
  using (private.eh_membro(org_id)) with check (private.eh_membro(org_id));

create policy admin_respondents on respondents
  for all to authenticated
  using (private.eh_membro(org_id)) with check (private.eh_membro(org_id));

create policy admin_questions on questions
  for all to authenticated
  using (exists (
    select 1 from surveys s
    where s.id = questions.survey_id and private.eh_membro(s.org_id)
  ))
  with check (exists (
    select 1 from surveys s
    where s.id = questions.survey_id and private.eh_membro(s.org_id)
  ));

create policy admin_invites on invites
  for all to authenticated
  using (exists (
    select 1 from surveys s
    where s.id = invites.survey_id and private.eh_membro(s.org_id)
  ))
  with check (exists (
    select 1 from surveys s
    where s.id = invites.survey_id and private.eh_membro(s.org_id)
  ));

create policy admin_answers on answers
  for all to authenticated
  using (exists (
    select 1 from invites i
    join surveys s on s.id = i.survey_id
    where i.id = answers.invite_id and private.eh_membro(s.org_id)
  ))
  with check (exists (
    select 1 from invites i
    join surveys s on s.id = i.survey_id
    where i.id = answers.invite_id and private.eh_membro(s.org_id)
  ));

create policy admin_answer_blocks on answer_blocks
  for all to authenticated
  using (exists (
    select 1 from answers a
    join invites i on i.id = a.invite_id
    join surveys s on s.id = i.survey_id
    where a.id = answer_blocks.answer_id and private.eh_membro(s.org_id)
  ))
  with check (exists (
    select 1 from answers a
    join invites i on i.id = a.invite_id
    join surveys s on s.id = i.survey_id
    where a.id = answer_blocks.answer_id and private.eh_membro(s.org_id)
  ));

create policy admin_transcripts on transcripts
  for all to authenticated
  using (exists (
    select 1 from answer_blocks b
    join answers a on a.id = b.answer_id
    join invites i on i.id = a.invite_id
    join surveys s on s.id = i.survey_id
    where b.id = transcripts.answer_block_id and private.eh_membro(s.org_id)
  ))
  with check (exists (
    select 1 from answer_blocks b
    join answers a on a.id = b.answer_id
    join invites i on i.id = a.invite_id
    join surveys s on s.id = i.survey_id
    where b.id = transcripts.answer_block_id and private.eh_membro(s.org_id)
  ));

create policy admin_followups on followups
  for all to authenticated
  using (exists (
    select 1 from answers a
    join invites i on i.id = a.invite_id
    join surveys s on s.id = i.survey_id
    where a.id = followups.answer_id and private.eh_membro(s.org_id)
  ))
  with check (exists (
    select 1 from answers a
    join invites i on i.id = a.invite_id
    join surveys s on s.id = i.survey_id
    where a.id = followups.answer_id and private.eh_membro(s.org_id)
  ));

drop function public.eh_membro(uuid);

create or replace function public.gerar_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select rtrim(
    translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_'),
    '='
  );
$$;
