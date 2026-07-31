-- Fixture de desenvolvimento. NÃO é dado real.
--
-- Existe para que `/r/{token}` tenha o que renderizar enquanto a Fase 2 é
-- construída. Apagar antes do uso real:
--
--   delete from respondents where id = '33333333-3333-3333-3333-333333333333';
--
-- O cascade leva junto o convite, as respostas e os blocos.

insert into respondents (id, org_id, name, notes)
values (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'Respondente de teste',
  'Fixture de desenvolvimento. Apagar antes do uso real.'
)
on conflict (id) do nothing;

insert into invites (survey_id, respondent_id)
values (
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
)
on conflict (survey_id, respondent_id) do nothing;

-- O token sai do default `public.gerar_token()`. Para descobrir qual foi:
--   select token from invites;
