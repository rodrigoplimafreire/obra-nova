/**
 * Substituto do pacote `server-only` para os scripts de verificação.
 *
 * O pacote real lança ao ser importado fora de um Server Component — é a
 * guarda que impede código de servidor de vazar para o navegador, e ela está
 * certa. Um script de verificação roda em Node puro, onde essa guarda não tem
 * o que proteger, então aqui ela vira um módulo vazio.
 *
 * Ligado em `scripts/tsconfig.json`, e só lá: o app nunca vê este arquivo.
 */
export {};
