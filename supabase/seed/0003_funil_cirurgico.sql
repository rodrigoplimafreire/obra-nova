-- Pesquisa de produção: descoberta sobre o funil cirúrgico.
--
-- Vem do Bloco 1 do roteiro do WhatsCirurgia — o de quantificar a dor. Os
-- Blocos 2 (escopo do piloto) e 3 (preço) NÃO entram aqui de propósito:
-- pitch e ancoragem de preço dependem do que a pessoa acabou de dizer e
-- precisam de conversa ao vivo. Mandar proposta por formulário queimaria a
-- carta antes da hora.
--
-- As perguntas marcadas com `is_core` são a espinha: valem igual para o
-- médico, a esposa, a enfermeira, a secretária e a gestora de clínica, e é
-- por elas que dá para comparar as visões depois.

insert into surveys (id, org_id, title, intro_text, estimated_minutes)
values (
  '44444444-4444-4444-4444-444444444444',
  '11111111-1111-1111-1111-111111111111',
  'O caminho até a cirurgia',
  'Quero entender como funciona hoje, de verdade, a parte administrativa que leva um paciente até a cirurgia: o que trava, o que atrasa e quanto isso custa. Responda no seu tempo. Se puder, prefira o áudio, porque é mais rápido para você e traz mais detalhes do que o texto. Suas respostas ficam comigo, servem ao meu trabalho de consultoria e passam por transcrição automática, o que inclui envio a um serviço fora do Brasil. Por isso, evite citar nomes de pacientes ou qualquer dado que permita identificá-los.',
  20
)
on conflict (id) do nothing;

insert into questions (survey_id, position, text, helper_text, is_core) values
  ('44444444-4444-4444-4444-444444444444', 1,
   'Me conta como é hoje o caminho de um paciente até a cirurgia, do começo ao fim.',
   'Da indicação até o dia da cirurgia, do jeito que acontece de verdade, com os perrengues. Por áudio costuma ser mais fácil de contar.',
   true),

  ('44444444-4444-4444-4444-444444444444', 2,
   'Quantas cirurgias você faz por mês, em quantos hospitais, e quais convênios aparecem mais?',
   'Número aproximado já ajuda muito. Não precisa consultar nada.',
   false),

  ('44444444-4444-4444-4444-444444444444', 3,
   'Quem acompanha esses casos no dia a dia, e onde essa pessoa anota as coisas?',
   'Planilha, caderno, WhatsApp, memória: vale qualquer resposta. Quero saber como é na prática, não como deveria ser.',
   true),

  ('44444444-4444-4444-4444-444444444444', 4,
   'Num mês comum, quantas autorizações travam, demoram demais ou voltam negadas?',
   'Se o número não estiver na ponta da língua, um palpite honesto serve.',
   true),

  ('44444444-4444-4444-4444-444444444444', 5,
   'Quando um caso trava, quanto fica parado em dinheiro?',
   'Pode somar em voz alta: honorário, material, sala reservada, o que fizer sentido. Não precisa ser exato.',
   true),

  ('44444444-4444-4444-4444-444444444444', 6,
   'Me conta a última vez que uma cirurgia atrasou ou caiu por causa de papelada.',
   'O caso específico, não o problema em geral. O que aconteceu, quem percebeu, e como terminou.',
   true),

  ('44444444-4444-4444-4444-444444444444', 7,
   'Algum hospital ou convênio de vocês já usa algum sistema para isso? Como tem sido?',
   'Se experimentaram alguma ferramenta e largaram no meio, isso me interessa ainda mais do que as que deram certo.',
   false),

  ('44444444-4444-4444-4444-444444444444', 8,
   'Daqui a seis meses, o que precisaria ter mudado para você dizer que essa parte parou de atrapalhar?',
   'E se nada mudar, o que isso custa para você, em dinheiro, tempo ou cansaço.',
   true),

  ('44444444-4444-4444-4444-444444444444', 9,
   'Quem mais convive de perto com isso e valeria a pena eu ouvir?',
   'Pode ser alguém da sua equipe ou de outro lugar. Só o nome e como falar com a pessoa já basta.',
   false)
on conflict (survey_id, position) do nothing;
