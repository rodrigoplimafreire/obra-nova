import {
  CabecalhoEsqueleto,
  CartaoEsqueleto,
  ConteudoEsqueleto,
} from "@/components/comum/esqueleto";

export default function Carregando() {
  return (
    <>
      <CabecalhoEsqueleto />
      <ConteudoEsqueleto>
        <CartaoEsqueleto linhas={3} />
        <div className="mt-8">
          <CartaoEsqueleto linhas={1} />
        </div>
      </ConteudoEsqueleto>
    </>
  );
}
