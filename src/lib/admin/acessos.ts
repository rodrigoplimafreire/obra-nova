import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Quem pode entrar no painel.
 *
 * A lista morava só em `ADMIN_EMAIL_ALLOWLIST`, variável de ambiente na
 * Vercel. Enquanto o painel teve um usuário só, isso não incomodou. O custo
 * apareceu quando o Rodrigo mandou o link para alguém testar: a pessoa criou a
 * conta, bateu na lista, e ficou dezoito dias parada na porta — porque liberar
 * um e-mail exigia editar a variável e redeployar, e nada na tela dele contava
 * que havia alguém esperando.
 *
 * Agora a lista é a tabela `acessos`, editável pelo operador na tela de Perfil.
 *
 * **A variável continua valendo, somada à tabela.** Não é dívida técnica, é
 * resgate: se a tabela for esvaziada por engano, ou se uma migration der errado
 * no meio, o e-mail do operador ainda entra pela variável e conserta. Uma
 * allowlist que pode se apagar sozinha tranca o dono do lado de fora.
 */

/** Só a variável de ambiente. Separada para a checagem de "lista vazia". */
function doAmbiente(): string[] {
  return (process.env.ADMIN_EMAIL_ALLOWLIST ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export type Veredito =
  /** Nem tabela nem variável têm nada: o painel ficaria trancado para todos. */
  | "sem-lista"
  | "liberado"
  | "fora";

/**
 * O e-mail pode entrar?
 *
 * Devolve três estados em vez de um booleano porque "não pode entrar" e "não
 * existe lista nenhuma" pedem telas diferentes: a segunda é erro de
 * configuração e precisa dizer isso, senão o dono do sistema fica olhando para
 * "sem acesso" sem entender que o problema é dele.
 */
export async function conferirAcesso(email: string): Promise<Veredito> {
  const alvo = email.trim().toLowerCase();
  const ambiente = doAmbiente();

  if (ambiente.includes(alvo)) return "liberado";

  const { data, error } = await supabaseAdmin()
    .from("acessos")
    .select("email")
    .eq("email", alvo)
    .maybeSingle();

  // Erro de leitura não pode virar "liberado" nem "sem-lista": na dúvida, a
  // porta fica fechada, e quem está na variável continua entrando.
  if (error) return ambiente.length === 0 ? "sem-lista" : "fora";
  if (data) return "liberado";

  if (ambiente.length > 0) return "fora";

  // Fora da variável, fora da linha — mas talvez a tabela tenha gente, e o
  // problema seja só este e-mail. Uma tabela vazia com variável vazia é que é
  // painel trancado.
  const { count } = await supabaseAdmin()
    .from("acessos")
    .select("email", { count: "exact", head: true });

  return (count ?? 0) === 0 ? "sem-lista" : "fora";
}

export type Acesso = {
  email: string;
  nota: string | null;
  criadoEm: string;
  /** Já entrou alguma vez? Distingue "convidado" de "usando". */
  ultimoAcesso: string | null;
  /** Criou conta mas não confirmou o e-mail — trava silenciosa mais comum. */
  aguardandoConfirmacao: boolean;
  /** Veio da variável de ambiente, então não dá para remover pela tela. */
  doAmbiente: boolean;
};

/**
 * A lista para a tela do operador, cruzada com o estado real da conta.
 *
 * Mostrar só os e-mails seria repetir o erro que originou tudo isto: o operador
 * precisa ver que alguém foi convidado e **ainda não conseguiu entrar**, senão
 * a espera continua invisível.
 */
export async function listarAcessos(): Promise<Acesso[]> {
  const sb = supabaseAdmin();

  const [{ data: linhas }, { data: contas }] = await Promise.all([
    sb.from("acessos").select("email, nota, criado_em").order("criado_em"),
    sb.auth.admin.listUsers({ perPage: 200 }),
  ]);

  const porEmail = new Map(
    (contas?.users ?? []).flatMap((u) =>
      u.email ? [[u.email.toLowerCase(), u] as const] : [],
    ),
  );

  const daTabela: Acesso[] = (linhas ?? []).map((l) => {
    const conta = porEmail.get(l.email);
    return {
      email: l.email,
      nota: l.nota,
      criadoEm: l.criado_em,
      ultimoAcesso: conta?.last_sign_in_at ?? null,
      aguardandoConfirmacao: Boolean(conta) && !conta?.email_confirmed_at,
      doAmbiente: false,
    };
  });

  const jaListados = new Set(daTabela.map((a) => a.email));

  const doEnv: Acesso[] = doAmbiente()
    .filter((e) => !jaListados.has(e))
    .map((email) => {
      const conta = porEmail.get(email);
      return {
        email,
        nota: null,
        criadoEm: conta?.created_at ?? "",
        ultimoAcesso: conta?.last_sign_in_at ?? null,
        aguardandoConfirmacao: Boolean(conta) && !conta?.email_confirmed_at,
        doAmbiente: true,
      };
    });

  return [...doEnv, ...daTabela];
}
