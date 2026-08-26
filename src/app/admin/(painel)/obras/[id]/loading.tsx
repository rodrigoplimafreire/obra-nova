import {
  CabecalhoEsqueleto,
  CartaoEsqueleto,
  ConteudoEsqueleto,
  IndicadoresEsqueleto,
} from "@/components/comum/esqueleto";

export default function Carregando() {
  return (
    <>
      <CabecalhoEsqueleto />
      <ConteudoEsqueleto>
        <IndicadoresEsqueleto />
        <div className="mt-8 flex flex-col gap-3">
          <CartaoEsqueleto linhas={2} />
          <CartaoEsqueleto linhas={2} />
        </div>
      </ConteudoEsqueleto>
    </>
  );
}
