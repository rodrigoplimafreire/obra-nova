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
        <CartaoEsqueleto linhas={6} />
      </ConteudoEsqueleto>
    </>
  );
}
