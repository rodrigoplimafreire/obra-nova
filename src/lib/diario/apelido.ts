/**
 * O apelido do diário: o pedaço legível de `diario.rd.eng.br/rodrigo`.
 *
 * Duas coisas moram aqui, e as duas precisam valer no servidor e na tela:
 * o formato, porque o apelido vira caminho de URL e um espaço ali quebra a
 * rota em vez de dar erro; e a lista de palavras que a aplicação já usa, para
 * ninguém reservar `admin` e descobrir depois que o painel sumiu do domínio.
 */

/** O host do diário da empreiteira. Ver o rewrite em `next.config.ts`. */
export const HOST_DO_DIARIO = "diario.rd.eng.br";

/**
 * Nomes que a aplicação já responde, e por isso não podem virar apelido.
 *
 * `d`, `o`, `p` e `rel` são as rotas públicas; `admin` e `api` são o resto do
 * produto; os dois últimos são arquivos que o navegador pede sozinho.
 */
const RESERVADOS = new Set([
  "admin",
  "api",
  "d",
  "o",
  "p",
  "rel",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "icon",
  "diario",
]);

const FORMATO = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export type VereditoDoApelido =
  | { ok: true; apelido: string }
  | { ok: false; erro: string };

/**
 * Normaliza e julga. Aceita o que a pessoa digitou com maiúscula, acento ou
 * espaço, porque ninguém digita slug — digita nome.
 */
export function lerApelido(bruto: string): VereditoDoApelido {
  const limpo = bruto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    // Tira o acento e deixa a letra: "joão" vira "joao", não "jo o".
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s_.]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!limpo) {
    return { ok: false, erro: "Escreva um endereço, como `rodrigo`." };
  }
  if (limpo.length < 3) {
    return { ok: false, erro: "O endereço precisa de ao menos 3 caracteres." };
  }
  if (limpo.length > 40) {
    return { ok: false, erro: "O endereço passa de 40 caracteres." };
  }
  if (RESERVADOS.has(limpo)) {
    return { ok: false, erro: `\`${limpo}\` é usado pelo sistema. Escolha outro.` };
  }
  if (!FORMATO.test(limpo)) {
    return { ok: false, erro: "Use só letras, números e hífen." };
  }

  return { ok: true, apelido: limpo };
}

/** O endereço que a pessoa copia e manda. */
export function enderecoDoDiario(
  apelido: string | null,
  token: string,
  urlBase: string,
): string {
  // Sem apelido, o link continua sendo o do token — ele nunca deixa de valer.
  return apelido
    ? `https://${HOST_DO_DIARIO}/${apelido}`
    : `${urlBase}/d/${token}`;
}
