-- Confirmação leve de identidade na abertura. Não é senha, não é conta: só
-- derruba o encaminhamento casual do link. A pessoa digita o próprio primeiro
-- nome ou os 4 últimos dígitos do celular que o admin cadastrou.
--
-- O token da URL continua sendo a credencial de verdade. Isto é uma segunda
-- barreira, barata para quem é dono do link e chata para quem recebeu de
-- terceiros.
alter table respondents add column if not exists phone_last4 text;

alter table respondents add constraint phone_last4_sao_4_digitos
  check (phone_last4 is null or phone_last4 ~ '^[0-9]{4}$');
