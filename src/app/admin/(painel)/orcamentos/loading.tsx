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
          <CartaoEsqueleto linhas={1} />
          <CartaoEsqueleto linhas={1} />
          <CartaoEsqueleto linhas={1} />
        </div>
      </ConteudoEsqueleto>
    </>
  );
}
