import {
  CabecalhoEsqueleto,
  CartaoEsqueleto,
  ConteudoEsqueleto,
  IndicadoresEsqueleto,
  TabelaEsqueleto,
} from "@/components/comum/esqueleto";

export default function Carregando() {
  return (
    <>
      <CabecalhoEsqueleto />
      <ConteudoEsqueleto>
        <CartaoEsqueleto linhas={4} />
        <div className="mt-6">
          <IndicadoresEsqueleto />
        </div>
        <div className="mt-8">
          <TabelaEsqueleto />
        </div>
      </ConteudoEsqueleto>
    </>
  );
}
