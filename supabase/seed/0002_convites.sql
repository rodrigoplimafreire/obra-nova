-- Criar um respondente e o link dele.
--
-- É AQUI que sai o nome que aparece no "Oi, Fulano." da tela de abertura.
-- O respondente não faz login: o link com token único é a identificação dele.
-- Um link por pessoa — nunca compartilhe o mesmo link com duas pessoas, senão
-- as duas veem e editam as mesmas respostas.
--
-- Rode no SQL Editor:
-- https://supabase.com/dashboard/project/ezavgrzlqxpceswwboqn/sql/new

-- 1. Troque nome e e-mail e rode o bloco inteiro.
with novo as (
  insert into respondents (org_id, name, email, notes)
  values (
    '11111111-1111-1111-1111-111111111111',
    'Nome Sobrenome',          -- <<< troque
    'email@exemplo.com',       -- <<< troque (opcional, pode ser null)
    'ICP: médico'              -- <<< anotação livre, só para você
  )
  returning id, name
)
insert into invites (survey_id, respondent_id)
select '22222222-2222-2222-2222-222222222222', novo.id from novo
returning
  respondent_id,
  'https://entrevista-async.vercel.app/r/' || token as link;

-- 2. Para reler os links depois:
--
-- select r.name, r.email, i.status, i.last_seen_at,
--        'https://entrevista-async.vercel.app/r/' || i.token as link
-- from invites i
-- join respondents r on r.id = i.respondent_id
-- order by r.name;

-- 3. Para zerar as respostas de alguém e reenviar o mesmo link:
--
-- delete from answers where invite_id =
--   (select i.id from invites i join respondents r on r.id = i.respondent_id
--    where r.name = 'Nome Sobrenome');
-- update invites set status='pending', started_at=null, completed_at=null
--  where respondent_id = (select id from respondents where name = 'Nome Sobrenome');

-- 4. LGPD — apagar uma pessoa e tudo o que ela mandou (cascata):
--
-- delete from respondents where name = 'Nome Sobrenome';
--   Os arquivos no Storage ficam em entrevistas/{invite_id}/ e precisam ser
--   removidos pela API do Storage; isso entra no endpoint admin da Fase 4.
