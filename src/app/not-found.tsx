import Link from "next/link";
import { Cena } from "@/components/comum/cena";
import { CenaNaoEncontrado } from "@/components/comum/ilustracoes";
import { Logotipo } from "@/components/marca";

/**
 * 404.
 *
 * Não existia: o endereço errado caía na tela crua do Next, em Inter e inglês,
 * sem nada da marca. Importa mais aqui do que num app comum — os links do
 * produto circulam por WhatsApp e chegam truncados ou com caractere a mais,
 * então o cliente da obra bate nesta página com alguma frequência.
 *
 * Por isso a saída aponta para o painel *e* explica o caso do link: quem
 * chegou por WhatsApp não tem o que fazer no painel, e mandar essa pessoa para
 * o login seria um segundo beco.
 */
export default function NaoEncontrado() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-papel px-6 py-16">
      <Logotipo altura={28} className="text-tinta" />

      <Cena
        ilustracao={<CenaNaoEncontrado />}
        titulo="Este endereço não existe"
        tom="cal"
        acao={
          <Link href="/admin/login" className="btn btn-primario">
            Ir para o painel
          </Link>
        }
      >
        Se você chegou por um link recebido no WhatsApp, ele pode ter vindo
        cortado — peça para reenviarem.
      </Cena>
    </main>
  );
}
