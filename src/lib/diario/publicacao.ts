import "server-only";
import {
  SECOES,
  type DiaPublicado,
  type ItemDoDia,
  type ItemPublicado,
} from "./tipos";

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
 *
 * Também não entra `origem`: se a linha saiu da IA ou do teclado é assunto de
 * dentro de casa. O leitor recebe o texto revisado por gente, e essa é a
 * única garantia que importa para ele.
 */

export function montarDia(
  dia: string,
  itens: ItemDoDia[],
  autor: string | null,
  versao: number,
): DiaPublicado {
  const da = (secao: string): ItemPublicado[] =>
    itens
      .filter((i) => i.secao === secao)
      .map((i) => ({ texto: i.texto, responsavel: i.responsavel }));

  return {
    versao,
    dia,
    autor,
    realizado: da("realizado"),
    em_andamento: da("em_andamento"),
    pendencias: da("pendencias"),
    proximos_passos: da("proximos_passos"),
    publicadoEm: new Date().toISOString(),
  };
}

/**
 * Rede de segurança para leitura: o JSON gravado é `unknown` para o
 * TypeScript, e uma publicação antiga tem formato diferente. Em vez de
 * confiar num cast, normaliza o que veio e descarta o que não está no
 * contrato. Mesmo desenho de `lerDocumento` no orçamento.
 *
 * **Duas gerações convivem aqui.** Até a Entrega 4a a seção era uma lista de
 * strings, com o responsável embutido no texto ("Reginato: conferir"); daí em
 * diante é uma lista de objetos com `responsavel` próprio. Publicação antiga
 * não pode virar 404 só porque o formato evoluiu — ela é justamente o que o
 * link fixo promete continuar servindo.
 */
export function lerDia(bruto: unknown): DiaPublicado | null {
  if (!bruto || typeof bruto !== "object") return null;
  const d = bruto as Record<string, unknown>;
  if (typeof d.dia !== "string") return null;

  const lista = (v: unknown): ItemPublicado[] => {
    if (!Array.isArray(v)) return [];
    return v.flatMap((entrada): ItemPublicado[] => {
      // Geração antiga: a seção era uma lista de strings.
      if (typeof entrada === "string") {
        const texto = entrada.trim();
        return texto ? [{ texto, responsavel: null }] : [];
      }
      if (!entrada || typeof entrada !== "object") return [];
      const i = entrada as Record<string, unknown>;
      if (typeof i.texto !== "string" || !i.texto.trim()) return [];
      return [
        {
          texto: i.texto.trim(),
          responsavel:
            typeof i.responsavel === "string" && i.responsavel.trim()
              ? i.responsavel.trim()
              : null,
        },
      ];
    });
  };

  return {
    versao: typeof d.versao === "number" ? d.versao : 1,
    dia: d.dia,
    autor: typeof d.autor === "string" && d.autor ? d.autor : null,
    realizado: lista(d.realizado),
    // A geração antiga gravava as duas últimas em camelCase.
    em_andamento: lista(d.em_andamento ?? d.emAndamento),
    pendencias: lista(d.pendencias),
    proximos_passos: lista(d.proximos_passos ?? d.proximosPassos),
    publicadoEm:
      typeof d.publicadoEm === "string"
        ? d.publicadoEm
        : new Date().toISOString(),
  };
}

/** Quantos itens a fotografia carrega, somando as quatro seções. */
export function totalDeItens(d: DiaPublicado): number {
  return SECOES.reduce((soma, { chave }) => soma + d[chave].length, 0);
}
