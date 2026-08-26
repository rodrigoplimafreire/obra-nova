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
        <div className="flex flex-col gap-3">
          <CartaoEsqueleto linhas={2} />
          <CartaoEsqueleto linhas={2} />
        </div>
      </ConteudoEsqueleto>
    </>
  );
}
