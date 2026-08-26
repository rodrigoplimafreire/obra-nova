import { FormularioDeRedefinicao } from "@/components/admin/formulario-redefinir-senha";
import { Logotipo } from "@/components/marca";

export const dynamic = "force-dynamic";

/**
 * Fora do grupo `(painel)` de propósito, como `/admin/login`: quem chega aqui
 * não tem sessão de admin — tem, no máximo, a sessão temporária que o link de
 * recuperação monta. `exigirAdmin()` mandaria essa pessoa para o login antes
 * de ela conseguir trocar a senha.
 */
export default function RedefinirSenha() {
  return (
    <main className="flex flex-1 flex-col bg-tinta">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
        <Logotipo altura={30} className="text-papel" />
        <p className="rotulo rotulo-claro mt-7">Painel</p>
        <h1 className="mt-3 font-sans text-4xl leading-[0.95] font-extrabold -tracking-[0.03em] text-papel">
          Nova senha
        </h1>

        <FormularioDeRedefinicao />
      </div>
    </main>
  );
}
