/**
 * O resumo do dia obedece às regras da §5 do PRD?
 *
 * Este script existe porque a regra mais cara do Diário não é verificável
 * lendo código: **a IA não pode transformar planejamento em atividade
 * concluída**. Quem lê do outro lado é o cliente da empreiteira, e um "vou
 * fazer" promovido a "feito" não é erro de estilo, é mentira na prestação de
 * contas. Só chamando o modelo de verdade dá para saber.
 *
 * O material de teste é armado para as armadilhas: tem uma frase claramente
 * no futuro, uma pendência sem dono, um nome próprio, um número e um áudio
 * que ainda não foi transcrito.
 *
 * **Auto-limpante:** cria um diário de teste, exercita e apaga no fim,
 * inclusive se falhar no meio.
 *
 *   npm run verificar:diario
 *
 * Precisa de `.env.local` com NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY e GROQ_API_KEY.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { gerarResumo } from "../src/lib/diario/resumo";
import { lerDia, montarDia } from "../src/lib/diario/publicacao";
import { linhas } from "../src/lib/diario/tipos";
import {
  diaValido,
  limitesDoMes,
  mesDoDia,
  mesVizinho,
} from "../src/lib/tempo";
import { semanasDoMes } from "../src/lib/diario/calendario";

config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !CHAVE) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const sb = createClient(URL, CHAVE, { auth: { persistSession: false } });

let falhas = 0;

function conferir(nome: string, ok: boolean, detalhe = "") {
  console.log(`${ok ? "  ok  " : "FALHOU"}  ${nome}${detalhe && `  — ${detalhe}`}`);
  if (!ok) falhas++;
}

/* -------------------------------------------------------------------------- */
/* 1 · As funções puras, que não dependem de rede                              */
/* -------------------------------------------------------------------------- */

function conferirFuncoesPuras() {
  console.log("\nDatas e calendário");

  conferir("`2026-09-17` é dia válido", diaValido("2026-09-17"));
  conferir("`2026-02-31` é recusado", !diaValido("2026-02-31"), "não existe");
  conferir("`17/09/2026` é recusado", !diaValido("17/09/2026"));
  conferir("`` é recusado", !diaValido(""));

  conferir("mês de 2026-09-17", mesDoDia("2026-09-17") === "2026-09");
  conferir("mês anterior a janeiro", mesVizinho("2026-01", -1) === "2025-12");
  conferir("mês seguinte a dezembro", mesVizinho("2026-12", 1) === "2027-01");

  const fev = limitesDoMes("2028-02");
  conferir(
    "fevereiro bissexto termina em 29",
    fev.fim === "2028-02-29",
    fev.fim,
  );

  const semanas = semanasDoMes("2026-09");
  const dias = semanas.flat().filter(Boolean);
  conferir("setembro de 2026 tem 30 dias na grade", dias.length === 30);
  conferir(
    "toda semana da grade tem 7 posições",
    semanas.every((s) => s.length === 7),
  );
  // 1º de setembro de 2026 é terça: duas células vazias antes dele.
  conferir(
    "o mês começa na coluna certa",
    semanas[0][0] === null && semanas[0][1] === null && semanas[0][2] === "2026-09-01",
  );

  console.log("\nTexto das seções");

  conferir(
    "linha em branco é descartada",
    linhas("um\n\n  \ndois").length === 2,
  );
  conferir(
    "o hífen digitado some, porque a página já desenha o marcador",
    linhas("- um\n* dois\n• três").join("|") === "um|dois|três",
  );
  conferir("`\\r\\n` e `\\n` tratados igual", linhas("um\r\ndois").length === 2);

  console.log("\nA fotografia publicada");

  const doc = montarDia(
    {
      dia: "2026-09-17",
      realizado: "fez isto\nfez aquilo",
      em_andamento: null,
      pendencias: null,
      proximos_passos: "amanhã o resto",
    },
    "Fulano",
    3,
  );
  conferir("as seções viram listas", doc.realizado.length === 2);
  conferir("seção vazia vira lista vazia", doc.emAndamento.length === 0);
  conferir("a versão entra na fotografia", doc.versao === 3);

  const relido = lerDia(JSON.parse(JSON.stringify(doc)));
  conferir("ida e volta pelo JSON preserva o conteúdo", relido?.realizado.length === 2);
  conferir("lixo não vira documento", lerDia({ nada: true }) === null);
  conferir("`null` não vira documento", lerDia(null) === null);
}

/* -------------------------------------------------------------------------- */
/* 2 · A IA, contra as regras da §5 do PRD                                     */
/* -------------------------------------------------------------------------- */

/** Quem assina o diário de teste. O nome entra no prompt. */
const AUTOR = "Marcos Vinicius";

const MATERIAL = [
  {
    tipo: "texto" as const,
    status: "pronto" as const,
    texto:
      "Fechei a revisão da tabela de custos do orçamento da Dona Fatima. Ficaram 19 itens.",
  },
  {
    tipo: "audio" as const,
    status: "pronto" as const,
    texto:
      "Comecei o ajuste do contraste das pastilhas, tá pela metade, devo terminar amanhã.",
  },
  {
    tipo: "texto" as const,
    status: "pronto" as const,
    // A armadilha principal: futuro explícito. Nunca pode virar "realizado".
    texto:
      "Amanhã eu vou publicar a proposta e mandar o link pro Reginato no WhatsApp.",
  },
  {
    tipo: "texto" as const,
    status: "pronto" as const,
    // Pendência sem dono: tem que sair com "A definir".
    texto: "Falta alguém confirmar o preco do rufo. Ninguem assumiu ainda.",
  },
  {
    tipo: "audio" as const,
    // Transcrição que não ficou pronta: não pode entrar no material.
    status: "falhou" as const,
    texto: "SEGREDO_QUE_NAO_PODE_VAZAR",
  },
];

async function conferirIA(relatorioId: string) {
  console.log("\nA IA (chamada de verdade, pode demorar)");

  if (!process.env.GROQ_API_KEY) {
    conferir("GROQ_API_KEY configurada", false, "sem ela não dá para verificar");
    return;
  }

  const saida = await gerarResumo(relatorioId, AUTOR);

  if (!saida.ok) {
    conferir("a IA respondeu", false, saida.erro);
    return;
  }

  conferir("a IA respondeu", true);
  conferir(
    "só os registros prontos entram no material",
    saida.registros === 4,
    `${saida.registros} de 5`,
  );

  const { realizado, emAndamento, pendencias, proximosPassos } = saida.secoes;
  const tudo = [...realizado, ...emAndamento, ...pendencias, ...proximosPassos];
  const juntoMinusculo = tudo.join(" \n ").toLowerCase();

  conferir("devolveu alguma coisa", tudo.length > 0, `${tudo.length} itens`);

  conferir(
    "o áudio que falhou não vazou para o resumo",
    !juntoMinusculo.includes("segredo_que_nao_pode_vazar"),
  );

  // A regra cara. "Publicar a proposta" foi dito no futuro; se aparecer em
  // `realizado`, a IA promoveu planejamento a entrega.
  const publicarEmRealizado = realizado.some((i) =>
    /public/i.test(i) && /proposta/i.test(i),
  );
  conferir(
    "planejamento não virou atividade concluída",
    !publicarEmRealizado,
    publicarEmRealizado ? `"${realizado.find((i) => /public/i.test(i))}"` : "",
  );

  const publicarAdiante = [...proximosPassos, ...emAndamento, ...pendencias].some(
    (i) => /public/i.test(i),
  );
  conferir(
    "o que é do futuro aparece como próximo passo",
    publicarAdiante,
  );

  conferir(
    "o que foi fechado aparece como realizado",
    realizado.some((i) => /tabela|custos|fatima/i.test(i)),
    realizado[0] ?? "(vazio)",
  );

  conferir(
    "o que está pela metade não vai para realizado",
    !realizado.some((i) => /contraste|pastilha/i.test(i)),
  );

  conferir(
    "nome próprio preservado",
    /fatima/i.test(juntoMinusculo),
  );
  conferir(
    "número informado preservado",
    /\b19\b/.test(tudo.join(" ")),
  );

  conferir(
    'pendência sem dono sai como "A definir"',
    /a definir/i.test(pendencias.join(" ")),
    pendencias.join(" | ") || "(sem pendências)",
  );

  /**
   * "Amanhã EU vou publicar" tem dono: quem escreve. Marcar isso como
   * "A definir" faz o cliente ler "ninguém assumiu" — foi o que o modelo
   * fazia antes de o nome do autor entrar no prompt.
   */
  const passoDoAutor = proximosPassos.find((i) => /public/i.test(i)) ?? "";
  conferir(
    'o que o autor disse que vai fazer não sai como "A definir"',
    !/a definir/i.test(passoDoAutor),
    passoDoAutor || "(sem próximos passos)",
  );

  conferir(
    "sem travessão, como manda o estilo da casa",
    !tudo.some((i) => i.includes("—")),
  );

  console.log("\n  Saída da IA, para leitura humana:");
  for (const [nome, itens] of [
    ["Realizado", realizado],
    ["Em andamento", emAndamento],
    ["Pendências", pendencias],
    ["Próximos passos", proximosPassos],
  ] as const) {
    console.log(`    ${nome}:`);
    for (const i of itens) console.log(`      · ${i}`);
    if (itens.length === 0) console.log("      (vazio)");
  }
}

/** Sem registro com texto, a IA nem é chamada. */
async function conferirDiaVazio(relatorioId: string) {
  console.log("\nDia sem material");
  const saida = await gerarResumo(relatorioId, AUTOR);
  conferir(
    "recusa antes de gastar chamada à IA",
    !saida.ok && /registro com texto/i.test(saida.erro),
    saida.ok ? "gerou mesmo assim" : saida.erro,
  );
}

/* -------------------------------------------------------------------------- */
/* 3 · As travas do banco                                                      */
/* -------------------------------------------------------------------------- */

async function conferirBanco(diarioId: string, dia: string) {
  console.log("\nTravas do banco");

  const { error: duplicado } = await sb
    .from("dia_relatorios")
    .insert({ diario_id: diarioId, dia });
  conferir(
    "um relatório por diário e data",
    duplicado !== null,
    duplicado?.code ?? "aceitou o segundo",
  );

  const { data: relatorio } = await sb
    .from("dia_relatorios")
    .select("id")
    .eq("diario_id", diarioId)
    .eq("dia", dia)
    .maybeSingle();

  const { error: audioSemArquivo } = await sb
    .from("dia_registros")
    .insert({ relatorio_id: relatorio!.id, tipo: "audio", texto: "sem arquivo" });
  conferir(
    "áudio sem arquivo é recusado",
    audioSemArquivo !== null,
    audioSemArquivo?.code ?? "aceitou",
  );

  // O cliente daqui é genérico (sem o `Database`), então quem tem que barrar
  // "video" é o `check` do banco — que é justamente o que se quer provar.
  const { error: tipoInvalido } = await sb
    .from("dia_registros")
    .insert({ relatorio_id: relatorio!.id, tipo: "video", texto: "x" });
  conferir(
    "tipo fora da lista é recusado",
    tipoInvalido !== null,
    tipoInvalido?.code ?? "aceitou",
  );
}

/* -------------------------------------------------------------------------- */

async function principal() {
  conferirFuncoesPuras();

  const { data: org } = await sb.from("orgs").select("id").limit(1).single();
  const { data: membro } = await sb
    .from("org_members")
    .select("user_id")
    .eq("org_id", org!.id)
    .limit(1)
    .single();

  const { data: diario, error } = await sb
    .from("dia_diarios")
    .insert({
      org_id: org!.id,
      autor_id: membro!.user_id,
      titulo: "VERIFICACAO AUTOMATICA — apagar",
    })
    .select("id")
    .single();

  if (error || !diario) {
    console.error("Não consegui criar o diário de teste:", error?.message);
    process.exit(1);
  }

  try {
    const dia = "1999-01-01";
    const vazio = "1999-01-02";

    const { data: relatorio } = await sb
      .from("dia_relatorios")
      .insert({ diario_id: diario.id, dia })
      .select("id")
      .single();

    const { data: relatorioVazio } = await sb
      .from("dia_relatorios")
      .insert({ diario_id: diario.id, dia: vazio })
      .select("id")
      .single();

    await sb.from("dia_registros").insert(
      MATERIAL.map((m) => ({
        relatorio_id: relatorio!.id,
        tipo: m.tipo,
        texto: m.texto,
        status: m.status,
        // A trava do banco exige arquivo para áudio.
        storage_path: m.tipo === "audio" ? `diario/teste/${crypto.randomUUID()}.webm` : null,
      })),
    );

    await conferirBanco(diario.id, dia);
    await conferirDiaVazio(relatorioVazio!.id);
    await conferirIA(relatorio!.id);
  } finally {
    // Cascata: relatórios, registros e publicações vão junto.
    await sb.from("dia_diarios").delete().eq("id", diario.id);
    console.log("\nDiário de teste apagado.");
  }

  console.log(
    falhas === 0
      ? "\nTudo certo."
      : `\n${falhas} ${falhas === 1 ? "checagem falhou" : "checagens falharam"}.`,
  );
  process.exit(falhas === 0 ? 0 : 1);
}

void principal();
