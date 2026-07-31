import { FormularioDeLogin } from "@/components/admin/formulario-login";
import { Monograma } from "@/components/marca";

export const dynamic = "force-dynamic";

const MENSAGENS: Record<string, string> = {
  "sem-acesso": "Este e-mail não está na lista de acesso do painel.",
  "allowlist-vazia":
    "ADMIN_EMAIL_ALLOWLIST não está configurada no ambiente. Sem ela o painel fica trancado.",
};

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  return (
    <main className="flex flex-1 flex-col bg-tinta">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
        <Monograma tamanho={56} />
        <p className="rotulo mt-6">Painel</p>
        <h1 className="mt-3 font-sans text-4xl leading-[0.95] font-extrabold -tracking-[0.03em] text-papel">
          Obra
          <br />
          Nova
        </h1>

        {erro && MENSAGENS[erro] && (
          <p className="mt-6 rounded-2xl bg-alerta/20 px-4 py-3 text-sm leading-relaxed text-alerta">
            {MENSAGENS[erro]}
          </p>
        )}

        <FormularioDeLogin />
      </div>
    </main>
  );
}
