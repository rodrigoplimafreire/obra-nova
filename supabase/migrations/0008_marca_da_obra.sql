-- Quem assina o relatório do cliente.
--
-- Fica na obra, não na org: hoje a conta inteira roda numa org só, e a
-- entrevista continua assinada por "Rodrigo Peixoto". O relatório de uma obra
-- que outra empresa (a RD Engenharia, por exemplo) entrega para o cliente
-- dela precisa de assinatura própria — e diferentes obras podem pertencer a
-- diferentes empreiteiras no futuro, então o campo pertence à obra.

alter table obras add column marca_nome text;
