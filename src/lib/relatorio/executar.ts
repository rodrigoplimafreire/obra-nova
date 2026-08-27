import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizarRelatorio, type ResultadoDoRelatorio } from "./tipos";

/**
 * O relatório da semana, escrito para quem paga a obra.
 *
 * O material é o que o mestre relatou: texto digitado e transcrição de áudio,
 * mais o status de cada serviço. A IA NÃO vê as fotos — elas entram na página
 * direto do banco, como evidência para o olho de quem lê. O prompt deixa isso
 * explícito para ela nunca escrever "conforme a foto mostra".
 */

// Ver o comentário em itens-da-fala.ts: a Groq removeu este modelo do
// catálogo (27/08/2026). openai/gpt-oss-120b é o substituto.
const MODELO = process.env.ANALYSIS_MODEL ?? "openai/gpt-oss-120b";

const INSTRUCOES = `Você escreve o relatório semanal de uma obra, endereçado ao cliente que está pagando por ela. Português do Brasil.

QUEM LÊ: o dono da obra ou o síndico. Ele não acompanha o canteiro no dia a dia e não é da construção civil. Escreva como quem presta contas a uma pessoa adulta e ocupada: direto, sem enrolação, sem vender.

DE ONDE VEM O MATERIAL: do relato diário do mestre de obras, digitado ou falado e transcrito. As transcrições têm erros, principalmente em nomes, números e termos técnicos.

O QUE VOCÊ NÃO TEM: você NÃO vê as fotos. Elas existem e aparecem no relatório, mas você não sabe o que está nelas. Nunca escreva "como mostra a foto", "a imagem comprova" ou qualquer coisa que dependa de ter visto uma imagem.

REGRAS:
- Não invente prazo, custo ou data que o material não traga.
- Não suavize problema. Se um serviço não foi feito, diga, e diga o motivo que o mestre deu.
- Explique o termo técnico na primeira vez que ele for indispensável. "Rufo (a peça de metal que veda o encontro do telhado com a parede)".
- Não use travessão. Prefira vírgula, dois-pontos ou ponto.
- Não elogie a própria equipe nem use adjetivo de marketing.

Responda SOMENTE com um objeto JSON válido, sem markdown, sem comentários:

{
  "resumo": "3 a 5 frases contando o que aconteceu na obra nesta semana, em linguagem corrente",
  "destaques": ["o que de fato avançou, uma frase cada"],
  "pendencias": [{ "titulo": "o serviço que não fechou", "porque": "o motivo que o mestre deu", "dia": "20/07" }],
  "atencao": [{ "titulo": "curto", "descricao": "o que o cliente precisa saber ou decidir", "precisaDecisao": true }],
  "proximosPassos": ["o que está previsto na sequência, segundo o material"],
  "lacunas": ["o que este relatório não permite afirmar"]
}

Em "atencao", use precisaDecisao: true só quando a obra realmente depender de uma resposta do cliente para seguir.`;

const DIA_BR = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

const ROTULO_STATUS = {
  pendente: "NÃO CONFIRMADO PELO MESTRE",
  feita: "CONCLUÍDO",
  parcial: "PARCIAL, COMEÇOU E NÃO TERMINOU",
  nao_feita: "NÃO FOI FEITO",
} as const;

type Material = { texto: string; servicos: number; concluidos: number };

async function montarMaterial(
  obraId: string,
  inicio: string,
  fim: string,
): Promise<Material | null> {
  const sb = supabaseAdmin();

  const { data: obra } = await sb
    .from("obras")
    .select("nome, cliente_nome, endereco")
    .eq("id", obraId)
    .maybeSingle();
  if (!obra) return null;

  const { data: atividades } = await sb
    .from("atividades")
    .select("id, dia, position, titulo, detalhe")
    .eq("obra_id", obraId)
    .gte("dia", inicio)
    .lte("dia", fim)
    .order("dia")
    .order("position");

  if (!atividades?.length) return null;

  const ids = atividades.map((a) => a.id);

  const { data: confirmacoes } = await sb
    .from("confirmacoes")
    .select("id, atividade_id, mestre_id, status")
    .in("atividade_id", ids);

  const confirmacaoIds = (confirmacoes ?? []).map((c) => c.id);

  const [{ data: blocos }, { data: mestres }] = await Promise.all([
    confirmacaoIds.length
      ? sb
          .from("confirmacao_blocos")
          .select("id, confirmacao_id, type, text_content")
          .in("confirmacao_id", confirmacaoIds)
          .order("position")
      : Promise.resolve({ data: [] as { id: string; confirmacao_id: string; type: string; text_content: string | null }[] }),
    sb.from("mestres").select("id, nome").eq("obra_id", obraId),
  ]);

  const blocosLista = blocos ?? [];

  const { data: transcricoes } = blocosLista.length
    ? await sb
        .from("transcripts")
        .select("confirmacao_bloco_id, text")
        .in(
          "confirmacao_bloco_id",
          blocosLista.map((b) => b.id),
        )
        .eq("status", "done")
    : { data: [] };

  const textoDoAudio = new Map(
    (transcricoes ?? []).map((t) => [t.confirmacao_bloco_id, t.text ?? ""]),
  );
  const nomeDoMestre = new Map((mestres ?? []).map((m) => [m.id, m.nome]));

  const linhas: string[] = [
    `OBRA: ${obra.nome}`,
    `CLIENTE: ${obra.cliente_nome}`,
  ];
  if (obra.endereco) linhas.push(`ENDEREÇO: ${obra.endereco}`);
  linhas.push(`PERÍODO: ${inicio} a ${fim}`, "");

  let concluidos = 0;
  let diaAtual = "";

  for (const atividade of atividades) {
    if (atividade.dia !== diaAtual) {
      diaAtual = atividade.dia;
      linhas.push(
        `## ${DIA_BR.format(new Date(`${atividade.dia}T12:00:00Z`)).toUpperCase()}`,
      );
    }

    const confirmacao = (confirmacoes ?? []).find(
      (c) => c.atividade_id === atividade.id,
    );
    const status = confirmacao?.status ?? "pendente";
    if (status === "feita") concluidos += 1;

    linhas.push(`- SERVIÇO: ${atividade.titulo}`);
    if (atividade.detalhe) linhas.push(`  Instrução dada: ${atividade.detalhe}`);
    linhas.push(`  SITUAÇÃO: ${ROTULO_STATUS[status]}`);

    if (confirmacao) {
      const quem = nomeDoMestre.get(confirmacao.mestre_id);
      if (quem) linhas.push(`  Quem confirmou: ${quem}`);

      const meus = blocosLista.filter(
        (b) => b.confirmacao_id === confirmacao.id,
      );
      let fotos = 0;

      for (const bloco of meus) {
        if (bloco.type === "text" && bloco.text_content) {
          linhas.push(`  Relato do mestre: ${bloco.text_content}`);
        } else if (bloco.type === "audio") {
          const t = textoDoAudio.get(bloco.id);
          linhas.push(
            t
              ? `  Relato do mestre (áudio transcrito): ${t}`
              : "  [áudio enviado, ainda sem transcrição]",
          );
        } else if (bloco.type === "image") {
          fotos += 1;
        }
      }

      if (fotos > 0) {
        linhas.push(
          `  [${fotos} foto(s) anexada(s) ao relatório, conteúdo não disponível para você]`,
        );
      }
    }

    linhas.push("");
  }

  return { texto: linhas.join("\n"), servicos: atividades.length, concluidos };
}

export type SaidaDoRelatorio =
  | { ok: true; relatorioId: string }
  | { ok: false; erro: string };

export async function gerarRelatorio(
  obraId: string,
  inicio: string,
  fim: string,
): Promise<SaidaDoRelatorio> {
  const chave = process.env.GROQ_API_KEY;
  if (!chave) return { ok: false, erro: "GROQ_API_KEY não está configurada." };

  const material = await montarMaterial(obraId, inicio, fim);
  if (!material) {
    return {
      ok: false,
      erro: "Não há serviço lançado nesta semana para relatar.",
    };
  }

  const sb = supabaseAdmin();

  // Um relatório por obra e período, atualizado a cada geração. Criar linha
  // nova trocaria o token, e o link que já foi para o cliente morreria.
  const { data: existente } = await sb
    .from("relatorios")
    .select("id")
    .eq("obra_id", obraId)
    .eq("inicio", inicio)
    .eq("fim", fim)
    .maybeSingle();

  let relatorioId = existente?.id;

  if (relatorioId) {
    await sb
      .from("relatorios")
      .update({
        status: "gerando",
        provider: "groq",
        model: MODELO,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", relatorioId);
  } else {
    const { data: criado, error } = await sb
      .from("relatorios")
      .insert({
        obra_id: obraId,
        inicio,
        fim,
        status: "gerando",
        provider: "groq",
        model: MODELO,
      })
      .select("id")
      .single();
    if (error || !criado) {
      return { ok: false, erro: error?.message ?? "Falha ao registrar." };
    }
    relatorioId = criado.id;
  }

  const encerrar = async (campos: {
    status: "pronto" | "falhou";
    resultado?: ResultadoDoRelatorio;
    error?: string;
  }) => {
    await sb
      .from("relatorios")
      .update({
        status: campos.status,
        resultado: campos.resultado ?? null,
        error: campos.error ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", relatorioId);
  };

  try {
    const resposta = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${chave}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODELO,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: INSTRUCOES },
            { role: "user", content: material.texto },
          ],
        }),
      },
    );

    if (!resposta.ok) {
      const detalhe = (await resposta.text()).slice(0, 300);
      await encerrar({
        status: "falhou",
        error: `HTTP ${resposta.status}: ${detalhe}`,
      });
      return { ok: false, erro: `A IA recusou: ${detalhe}` };
    }

    const dados = await resposta.json();
    const conteudo: string = dados?.choices?.[0]?.message?.content ?? "";

    let bruto: unknown;
    try {
      bruto = JSON.parse(conteudo);
    } catch {
      await encerrar({
        status: "falhou",
        error: "A IA devolveu algo que não é JSON válido.",
      });
      return { ok: false, erro: "A IA devolveu um formato inesperado." };
    }

    await encerrar({ status: "pronto", resultado: normalizarRelatorio(bruto) });
    return { ok: true, relatorioId };
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String(e);
    await encerrar({ status: "falhou", error: mensagem });
    return { ok: false, erro: mensagem };
  }
}
