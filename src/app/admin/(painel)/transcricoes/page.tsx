import { listarTranscricoes } from "@/lib/transcricao/avulsas";
import { PainelDeTranscricoes } from "@/components/admin/painel-transcricoes";

export const dynamic = "force-dynamic";

/** Importar e transcrever chamam provedor externo; ver a página do orçamento. */
export const maxDuration = 60;

export default async function Transcricoes() {
  return <PainelDeTranscricoes transcricoes={await listarTranscricoes()} />;
}
