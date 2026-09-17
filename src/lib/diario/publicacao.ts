import "server-only";
import { linhas, type DiaPublicado } from "./tipos";

/**
 * O que vira `dia_publicacoes.dados`.
 *
 * Mesma disciplina do orçamento: publicar é **congelar**. O rascunho continua
 * editável depois, e o que o leitor vê só muda quando alguém publica de novo.
 * Sem isto, "novos registros não alteram o conteúdo publicado" seria promessa
 * de tela, não garantia de dado.
 *
 * O que **não** entra na fotografia é a identidade da empreiteira: logotipo,
 * nome e telefone são papel timbrado, lidos ao vivo da org. Trocar o logotipo
 * no Perfil atualiza o cabeçalho de todos os dias, inclusive os já
 * publicados — que é o certo, porque isso não é conteúdo.
 */

export function montarDia(
  origem: {
    dia: string;
    realizado: string | null;
    em_andamento: string | null;
    pendencias: string | null;
    proximos_passos: string | null;
  },
  autor: string | null,
  versao: number,
): DiaPublicado {
  return {
    versao,
    dia: origem.dia,
    autor,
    realizado: linhas(origem.realizado),
    emAndamento: linhas(origem.em_andamento),
    pendencias: linhas(origem.pendencias),
    proximosPassos: linhas(origem.proximos_passos),
    publicadoEm: new Date().toISOString(),
  };
}

/**
 * Rede de segurança para leitura: o JSON gravado é `unknown` para o
 * TypeScript, e uma publicação antiga pode ter formato diferente. Em vez de
 * confiar num cast, normaliza o que veio e descarta o que não está no
 * contrato. Mesmo desenho de `lerDocumento` no orçamento.
 */
export function lerDia(bruto: unknown): DiaPublicado | null {
  if (!bruto || typeof bruto !== "object") return null;
  const d = bruto as Record<string, unknown>;
  if (typeof d.dia !== "string") return null;

  const lista = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((i): i is string => typeof i === "string") : [];

  return {
    versao: typeof d.versao === "number" ? d.versao : 1,
    dia: d.dia,
    autor: typeof d.autor === "string" && d.autor ? d.autor : null,
    realizado: lista(d.realizado),
    emAndamento: lista(d.emAndamento),
    pendencias: lista(d.pendencias),
    proximosPassos: lista(d.proximosPassos),
    publicadoEm:
      typeof d.publicadoEm === "string"
        ? d.publicadoEm
        : new Date().toISOString(),
  };
}
