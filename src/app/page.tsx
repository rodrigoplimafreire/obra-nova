import Link from "next/link";
import { Logotipo, RodapeDaMarca } from "@/components/marca";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <Logotipo altura={34} className="text-tinta" />

      <p className="mt-8 font-sans text-[1.75rem] leading-[1.15] font-bold -tracking-[0.025em] text-tinta text-pretty">
        A obra que você acompanha do bolso.
      </p>
      <p className="mt-4 text-base leading-relaxed text-fumaca">
        Toda semana, o relatório do que andou no canteiro: o que foi executado,
        as fotos e o que vem em seguida. Se você recebeu um relatório, ele veio
        como um link só seu. Abra por ele.
      </p>

      <div className="mt-8 flex flex-col gap-2">
        <Link href="/admin/obras" className="btn btn-escuro">
          Entrar no painel
        </Link>
      </div>

      <RodapeDaMarca nota="Gestão de obra sem improviso" />
    </main>
  );
}
