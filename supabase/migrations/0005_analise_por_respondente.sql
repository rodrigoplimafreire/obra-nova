-- Análise individual, além da síntese da pesquisa inteira.
--
-- invite_id nulo = análise do conjunto (o que já existia). Preenchido = leitura
-- de uma pessoa só: como ela fala, o que a incomoda, o que ela evita dizer.
-- São perguntas diferentes, então o prompt é outro e o resultado tem forma
-- própria — daí o `escopo` para a tela saber o que está renderizando.

create type analysis_scope as enum ('pesquisa', 'respondente');

alter table analyses add column invite_id uuid references invites(id) on delete cascade;
alter table analyses add column escopo analysis_scope not null default 'pesquisa';

create index on analyses (invite_id, created_at desc);
