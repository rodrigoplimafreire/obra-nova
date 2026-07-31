-- O índice parcial da 0006 não serve para upsert.
--
-- `ON CONFLICT (confirmacao_bloco_id, provider)` só casa com um índice parcial
-- se a query repetir o mesmo `WHERE`, e o PostgREST não manda cláusula nenhuma:
-- ele só passa a lista de colunas. Resultado: o upsert da transcrição de obra
-- morreria com "no unique or exclusion constraint matching the ON CONFLICT
-- specification".
--
-- Índice total resolve e não afeta o lado da entrevista: em Postgres, NULLs
-- contam como distintos num unique, então as linhas de entrevista (que têm
-- confirmacao_bloco_id nulo) continuam convivendo sem colidir entre si.

drop index transcricao_por_bloco_de_obra;

create unique index transcricao_por_bloco_de_obra
  on transcripts (confirmacao_bloco_id, provider);
