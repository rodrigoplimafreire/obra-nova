import Link from "next/link";
import { Monograma, RodapeDaMarca } from "@/components/marca";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <Monograma tamanho={56} />
      <h1 className="mt-6 font-sans text-4xl leading-[0.95] font-extrabold -tracking-[0.03em] text-tinta">
        Obra
        <br />
        Nova
      </h1>
      <p className="mt-4 text-base leading-relaxed text-fumaca">
        O relatório semanal que mostra ao seu cliente que a obra está andando.
        Se você recebeu um relatório, ele veio como um link só seu. Abra por ele.
      </p>

      <div className="mt-8 flex flex-col gap-2">
        <Link href="/admin/obras" className="btn btn-escuro">
          Entrar no painel
        </Link>
      </div>

      <RodapeDaMarca nota="Acompanhamento semanal de obra" />
    </main>
  );
}
