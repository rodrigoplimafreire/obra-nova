/**
 * O que a IA devolve para o relatório da semana.
 *
 * As fotos não estão aqui de propósito: elas vêm do banco direto para a
 * página, sem passar pela IA. Ela não vê imagem nenhuma, e o que ela escreve
 * nunca pode depender de uma.
 */

export type PendenciaDoRelatorio = {
  titulo: string;
  porque: string;
  dia: string;
};

export type PontoDeAtencao = {
  titulo: string;
  descricao: string;
  precisaDecisao: boolean;
};

export type ResultadoDoRelatorio = {
  resumo: string;
  destaques: string[];
  pendencias: PendenciaDoRelatorio[];
  atencao: PontoDeAtencao[];
  proximosPassos: string[];
  lacunas: string[];
};

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function lista(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(texto).filter(Boolean);
}

function objetos(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (i): i is Record<string, unknown> => typeof i === "object" && i !== null,
  );
}

/**
 * A IA erra o formato de vez em quando: manda string onde pedi lista, esquece
 * um campo, inventa outro. Normalizar aqui evita que a página do cliente
 * quebre por causa disso.
 */
export function normalizarRelatorio(bruto: unknown): ResultadoDoRelatorio {
  const o = (typeof bruto === "object" && bruto !== null ? bruto : {}) as Record<
    string,
    unknown
  >;

  return {
    resumo: texto(o.resumo),
    destaques: lista(o.destaques),
    pendencias: objetos(o.pendencias)
      .map((p) => ({
        titulo: texto(p.titulo),
        porque: texto(p.porque),
        dia: texto(p.dia),
      }))
      .filter((p) => p.titulo),
    atencao: objetos(o.atencao)
      .map((a) => ({
        titulo: texto(a.titulo),
        descricao: texto(a.descricao),
        precisaDecisao: a.precisaDecisao === true,
      }))
      .filter((a) => a.titulo),
    proximosPassos: lista(o.proximosPassos),
    lacunas: lista(o.lacunas),
  };
}
