-- Seed de perguntas.
--
-- ATENÇÃO: o texto das perguntas abaixo é RASCUNHO MEU, não seu. É a espinha
-- genérica de uma entrevista de descoberta — as seis marcadas com `is_core`
-- são as que se repetem entre ICPs e permitem comparação depois. Antes de
-- mandar o link para o médico, reescreva com as suas palavras e acrescente as
-- perguntas específicas do ICP dele.
--
-- Idempotente: rodar de novo não duplica.

insert into orgs (id, name)
values ('11111111-1111-1111-1111-111111111111', 'Rodrigo Peixoto')
on conflict (id) do nothing;

insert into surveys (id, org_id, title, intro_text, estimated_minutes)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Entrevista de descoberta',
  'São perguntas abertas sobre o seu dia a dia. Você responde por texto, áudio ou foto, no seu tempo, e pode parar e voltar depois, sem perder nada. Se puder, prefira o áudio: é mais rápido e traz mais detalhes. Suas respostas serão usadas no meu trabalho de consultoria e analisadas com apoio de inteligência artificial, o que inclui envio do áudio a um serviço de transcrição fora do Brasil. Por isso, evite citar nomes ou dados que identifiquem pacientes.',
  20
)
on conflict (id) do nothing;

insert into questions (survey_id, position, text, helper_text, is_core) values
  ('22222222-2222-2222-2222-222222222222', 1,
   'Me conta como é um dia normal seu de trabalho, do começo ao fim.',
   'Sem resumir. Quanto mais detalhes, melhor: da hora em que você chega até a hora de ir embora.',
   true),

  ('22222222-2222-2222-2222-222222222222', 2,
   'Qual foi a última vez que alguma coisa no seu trabalho te fez perder tempo ou paciência?',
   'Conte um caso específico, e não o problema em geral. O que aconteceu naquele dia?',
   true),

  ('22222222-2222-2222-2222-222222222222', 3,
   'Se você pudesse apagar uma tarefa da sua semana, qual seria?',
   'E o que mudaria na sua semana se ela deixasse de existir.',
   true),

  ('22222222-2222-2222-2222-222222222222', 4,
   'O que você já tentou para resolver isso?',
   'Vale contar também o que não deu certo. O que você desistiu de usar ajuda tanto quanto o que ficou.',
   true),

  ('22222222-2222-2222-2222-222222222222', 5,
   'Como você decide que vale a pena aprender uma coisa nova no trabalho?',
   'Pense na última coisa que você começou a usar, e também na última que largou no meio.',
   true),

  ('22222222-2222-2222-2222-222222222222', 6,
   'Se nada mudar nos próximos doze meses, qual é o custo disso para você?',
   'Pode ser dinheiro, tempo ou cansaço, o que for mais real para você.',
   true)
on conflict (survey_id, position) do nothing;
