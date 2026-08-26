import { Autenticacao } from "@/components/admin/autenticacao";
import {
  CenaAcessoRestrito,
  CenaEntrar,
} from "@/components/comum/ilustracoes";
import { Logotipo } from "@/components/marca";

export const dynamic = "force-dynamic";

const MENSAGENS: Record<string, string> = {
  "sem-acesso": "Este e-mail não está na lista de acesso do painel.",
  "allowlist-vazia":
    "ADMIN_EMAIL_ALLOWLIST não está configurada no ambiente. Sem ela o painel fica trancado.",
};

/**
 * A entrada do painel.
 *
 * Duas colunas no desktop, uma no celular. A ilustração fica de fora do
 * celular de propósito: ali a altura é do teclado, e empurrar o campo de senha
 * para baixo da dobra por causa de um desenho é trocar a função pela vitrine.
 *
 * A cena muda com o motivo do erro. "Este e-mail não está na lista" é um caso
 * de porta trancada, não de senha errada — o tapume com cadeado diz isso antes
 * de a frase ser lida, e evita que a pessoa fique tentando outra senha.
 */
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const barrado = erro === "sem-acesso";

  return (
    <main className="flex flex-1 flex-col bg-tinta">
      <div className="mx-auto grid w-full max-w-4xl flex-1 items-center gap-16 px-6 py-16 md:grid-cols-[1fr_20rem] md:gap-20">
        {/* `--paper` casado com o grafite do fundo: os objetos ficam recortados
            e só o traço aparece, que é a cena invertida do documento. */}
        <div
          className="hidden flex-col items-start gap-8 text-papel md:flex"
          style={{ ["--paper" as string]: "var(--color-tinta)" }}
        >
          {/* 200px é o teto do documento de identidade. */}
          <div className="w-full max-w-[12.5rem]" aria-hidden>
            {barrado ? <CenaAcessoRestrito /> : <CenaEntrar />}
          </div>
          <div>
            <p className="font-sans text-2xl leading-tight font-bold -tracking-[0.02em]">
              {barrado ? "Porta trancada" : "Gestão de obra sem improviso"}
            </p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-nevoa">
              {barrado
                ? "O acesso ao painel é liberado um a um, pela empreiteira."
                : "Orçamento que vira obra, e obra que vira relatório toda semana."}
            </p>
          </div>
        </div>

        <div className="flex w-full max-w-sm flex-col md:max-w-none">
          <Logotipo altura={30} className="text-papel" />
          <p className="rotulo rotulo-claro mt-7">Painel</p>

          {erro && MENSAGENS[erro] && (
            <p className="mt-6 aviso aviso-erro text-sm leading-relaxed text-tinta">
              {MENSAGENS[erro]}
            </p>
          )}

          <Autenticacao />
        </div>
      </div>
    </main>
  );
}
