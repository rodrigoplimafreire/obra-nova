"use server";

import { listarProntas } from "./avulsas";
import type { ResumoDeTranscricao } from "./tipos";

/**
 * A lista de transcrições prontas, chamável do navegador.
 *
 * `avulsas.ts` é `server-only` e não pode ser importado por componente
 * cliente. O diálogo que escolhe a transcrição carrega a lista ao abrir — não
 * junto da página do orçamento — porque é uma consulta por visita para uma
 * função que a maioria das visitas não usa. Daí precisar de uma Server Action.
 */
export async function listarProntasParaUso(): Promise<ResumoDeTranscricao[]> {
  return listarProntas();
}
