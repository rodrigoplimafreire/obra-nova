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
        <CartaoEsqueleto linhas={4} />
        <div className="mt-6">
          <CartaoEsqueleto linhas={3} />
        </div>
      </ConteudoEsqueleto>
    </>
  );
}
