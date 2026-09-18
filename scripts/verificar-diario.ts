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
import { sugestoesDeOntem } from "../src/lib/diario/dados";
import {
  enderecoDoDiario,
  HOST_DO_DIARIO,
  lerApelido,
} from "../src/lib/diario/apelido";
import { lerDia, montarDia } from "../src/lib/diario/publicacao";
import {
  linhas,
  SECOES,
  semDono,
  separarResponsavel,
} from "../src/lib/diario/tipos";
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

  console.log("\nO apelido do endereço");

  const ok = (bruto: string) => {
    const v = lerApelido(bruto);
    return v.ok ? v.apelido : `RECUSADO: ${v.erro}`;
  };

  conferir("`Rodrigo` vira `rodrigo`", ok("Rodrigo") === "rodrigo");
  conferir("acento sai e a letra fica", ok("João Pedro") === "joao-pedro", ok("João Pedro"));
  conferir("espaço vira hífen", ok("obra nova") === "obra-nova");
  conferir("hífen repetido colapsa", ok("a---b") === "a-b");
  conferir("hífen nas pontas some", ok("-rodrigo-") === "rodrigo");
  conferir("barra é descartada", ok("rd/rodrigo") === "rdrodrigo", ok("rd/rodrigo"));
  conferir("curto demais é recusado", !lerApelido("ab").ok);
  conferir("vazio é recusado", !lerApelido("   ").ok);
  conferir("só pontuação é recusado", !lerApelido("!!!").ok);
  conferir(
    "longo demais é recusado",
    !lerApelido("a".repeat(41)).ok,
    "41 caracteres",
  );
  conferir("`admin` é reservado", !lerApelido("admin").ok);
  conferir("`api` é reservado", !lerApelido("API").ok);
  conferir("`d` é reservado (e curto)", !lerApelido("d").ok);

  console.log("\nO endereço que a pessoa copia");

  conferir(
    "com apelido, sai o domínio da empreiteira",
    enderecoDoDiario("rodrigo", "TOKEN", "https://app.exemplo") ===
      `https://${HOST_DO_DIARIO}/rodrigo`,
  );
  conferir(
    "sem apelido, sai o endereço do token",
    enderecoDoDiario(null, "TOKEN", "https://app.exemplo") ===
      "https://app.exemplo/d/TOKEN",
  );

  console.log("\nA fotografia publicada");

  const doc = montarDia(
    "2026-09-17",
    [
      { id: "1", secao: "realizado", texto: "fez isto", responsavel: null, origem: "humano" },
      { id: "2", secao: "realizado", texto: "fez aquilo", responsavel: null, origem: "humano" },
      { id: "3", secao: "proximos_passos", texto: "o resto", responsavel: "Fulano", origem: "ia" },
    ],
    "Fulano",
    3,
  );
  conferir("os itens viram listas por seção", doc.realizado.length === 2);
  conferir("seção vazia vira lista vazia", doc.em_andamento.length === 0);
  conferir(
    "o responsável vai na fotografia",
    doc.proximos_passos[0]?.responsavel === "Fulano",
  );
  conferir(
    "a origem NÃO vai na fotografia",
    !("origem" in (doc.proximos_passos[0] as object)),
    "ia ou humano é assunto de dentro de casa",
  );
  conferir("a versão entra na fotografia", doc.versao === 3);

  const relido = lerDia(JSON.parse(JSON.stringify(doc)));
  conferir("ida e volta pelo JSON preserva o conteúdo", relido?.realizado.length === 2);
  conferir("lixo não vira documento", lerDia({ nada: true }) === null);
  conferir("`null` não vira documento", lerDia(null) === null);

  /**
   * A geração anterior gravava strings, com o dono dentro do texto e as duas
   * últimas seções em camelCase. Publicação antiga não pode virar 404 só
   * porque o formato evoluiu — ela é o que o link fixo promete continuar
   * servindo.
   */
  const antigo = lerDia({
    versao: 1,
    dia: "2026-09-15",
    autor: "Fulano",
    realizado: ["fez isto"],
    emAndamento: [],
    pendencias: ["Reginato: confirmar o rufo"],
    proximosPassos: ["A definir: decidir o acabamento"],
    publicadoEm: "2026-09-15T12:00:00.000Z",
  });
  conferir("publicação antiga (strings) continua legível", antigo !== null);
  conferir(
    "camelCase antigo cai na seção certa",
    antigo?.proximos_passos.length === 1,
  );
  conferir(
    "dono dentro do texto vira pastilha na leitura",
    separarResponsavel(antigo!.pendencias[0]).responsavel === "Reginato",
  );
  /**
   * Contar palavras não bastava: "Conferi tudo" tem duas e virava pastilha,
   * e o leitor via uma pessoa chamada Conferi Tudo. Nome próprio começa com
   * maiúscula em todas as palavras; verbo conjugado, não.
   */
  const dono = (texto: string) =>
    separarResponsavel({ texto, responsavel: null }).responsavel;

  conferir(
    "frase com dois-pontos NÃO vira pastilha",
    dono("Conferi tudo: a tabela, a proposta e o cronograma") === null,
  );
  conferir("nome simples vira pastilha", dono("Reginato: conferir") === "Reginato");
  conferir(
    "nome composto vira pastilha",
    dono("Marcos Vinicius: publicar") === "Marcos Vinicius",
  );
  conferir(
    "nome com partícula vira pastilha",
    dono("José da Silva: medir") === "José da Silva",
  );
  conferir('"A definir" vira pastilha', dono("A definir: decidir") === "A definir");
  conferir(
    "oração longa NÃO vira pastilha",
    dono("Resolvi o problema do rufo hoje: faltava vedação") === null,
  );
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
    status: "pronto" as const,
    // "Reginaldo" é o erro que a transcrição comete de verdade. Com o elenco
    // no prompt, a IA tem que devolver "Reginato".
    texto:
      "O Reginaldo ficou de mandar as fotos da obra de Caucaia ainda esta semana.",
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

  // O elenco entra no prompt: "Reginato" é a grafia certa, e o material de
  // teste traz "Reginaldo" de propósito, como uma transcrição erraria.
  const saida = await gerarResumo(relatorioId, AUTOR, [AUTOR, "Reginato"]);

  if (!saida.ok) {
    conferir("a IA respondeu", false, saida.erro);
    return;
  }

  conferir("a IA respondeu", true);
  conferir(
    "só os registros prontos entram no material",
    saida.registros === 5,
    `${saida.registros} de 6`,
  );

  const textosDe = (secao: string) =>
    saida.itens.filter((i) => i.secao === secao).map((i) => i.texto);

  const realizado = textosDe("realizado");
  const emAndamento = textosDe("em_andamento");
  const pendencias = saida.itens.filter((i) => i.secao === "pendencias");
  const proximosPassos = saida.itens.filter(
    (i) => i.secao === "proximos_passos",
  );

  const tudo = saida.itens.map((i) =>
    i.responsavel ? `${i.responsavel}: ${i.texto}` : i.texto,
  );
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

  const publicarAdiante = [
    ...emAndamento,
    ...pendencias.map((i) => i.texto),
    ...proximosPassos.map((i) => i.texto),
  ].some((t) => /public/i.test(t));
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
    'pendência sem dono sai com responsável "A definir"',
    pendencias.some((i) => i.responsavel && semDono(i.responsavel)),
    pendencias.map((i) => `${i.responsavel}: ${i.texto}`).join(" | ") ||
      "(sem pendências)",
  );

  /**
   * "Amanhã EU vou publicar" tem dono: quem escreve. Marcar isso como
   * "A definir" faz o cliente ler "ninguém assumiu" — foi o que o modelo
   * fazia antes de o nome do autor entrar no prompt.
   */
  const passoDoAutor = proximosPassos.find((i) => /public/i.test(i.texto));
  conferir(
    'o que o autor disse que vai fazer não sai como "A definir"',
    Boolean(passoDoAutor) && !semDono(passoDoAutor?.responsavel ?? ""),
    passoDoAutor
      ? `${passoDoAutor.responsavel}: ${passoDoAutor.texto}`
      : "(sem próximos passos)",
  );

  conferir(
    "sem travessão, como manda o estilo da casa",
    !tudo.some((i) => i.includes("—")),
  );

  /**
   * A IA **não** troca um nome por outro parecido.
   *
   * O material diz "Reginaldo" num registro e "Reginato" noutro. A primeira
   * versão deste teste exigia que a IA corrigisse o primeiro para o segundo,
   * e ela recusou — com razão. Trocar um nome que ela não pode conferir é
   * inventar responsável, que é justamente o que a §5 do PRD proíbe: e se
   * Reginaldo for outra pessoa?
   *
   * O elenco no prompt serve para a **grafia** de quem foi citado, não para
   * adivinhar quem é quem. Quem resolve a confusão é o dedo, no seletor de
   * responsável — que é para isso que a Entrega 4c existe.
   */
  const juntoTudo = tudo.join(" ");
  conferir(
    "nome fora do elenco é preservado, não trocado pelo parecido",
    /reginaldo/i.test(juntoTudo),
    juntoTudo.match(/regina\w+/gi)?.join(", ") ?? "(nenhum dos dois)",
  );
  conferir(
    "nome do elenco sai na grafia do elenco",
    /reginato/i.test(juntoTudo),
  );

  /**
   * O responsável vem **antes** dos dois-pontos.
   *
   * Não é capricho de redação: a página quebra a linha nesse ponto para
   * desenhar o nome como pastilha. Se o modelo voltar a escrever o dono no
   * fim da frase, a pastilha some sem nenhum erro aparecer — o texto continua
   * certo e a tela fica pior em silêncio.
   */
  const comDono = [...pendencias, ...proximosPassos];
  conferir(
    "responsável sai em coluna própria, e não embutido no texto",
    comDono.length > 0 && comDono.every((i) => Boolean(i.responsavel)),
    comDono.map((i) => `${i.responsavel ?? "—"}: ${i.texto}`).join(" | ") ||
      "(nada com responsável)",
  );

  console.log("\n  Saída da IA, para leitura humana:");
  for (const { chave, rotulo } of SECOES) {
    const daqui = saida.itens.filter((i) => i.secao === chave);
    console.log(`    ${rotulo}:`);
    for (const i of daqui) {
      console.log(`      · ${i.responsavel ? `[${i.responsavel}] ` : ""}${i.texto}`);
    }
    if (daqui.length === 0) console.log("      (vazio)");
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
/* 3 · O que veio de ontem                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A regra que sustenta a Entrega 4b: sugerir sem nunca entrar sozinho.
 *
 * Aqui se prova o recorte — o que é oferecido, o que não é, e o que para de
 * ser depois de resolvido. O toque em si é da tela; o que este script guarda
 * é a lista que a tela recebe.
 */
async function conferirSugestoes(diarioId: string) {
  console.log("\nO que veio de ontem");

  const ontem = "1999-02-01";
  const hoje = "1999-02-02";

  const { data: rOntem } = await sb
    .from("dia_relatorios")
    .insert({ diario_id: diarioId, dia: ontem })
    .select("id")
    .single();

  const { data: itens } = await sb
    .from("dia_itens")
    .insert([
      { relatorio_id: rOntem!.id, secao: "realizado", texto: "fechei o orçamento", posicao: 1 },
      { relatorio_id: rOntem!.id, secao: "em_andamento", texto: "ajuste do contraste", posicao: 1 },
      { relatorio_id: rOntem!.id, secao: "pendencias", texto: "confirmar o rufo", responsavel: "Reginato", posicao: 1 },
      { relatorio_id: rOntem!.id, secao: "proximos_passos", texto: "publicar a proposta", posicao: 1 },
    ])
    .select("id, secao, texto");

  const emAberto = await sugestoesDeOntem(diarioId, hoje, null);
  const textos = emAberto.map((s) => s.texto);

  conferir(
    "só o que ficou em aberto é oferecido",
    emAberto.length === 2,
    textos.join(" | "),
  );
  conferir("o que foi realizado não volta", !textos.includes("fechei o orçamento"));
  conferir(
    "próximo passo não volta — ele vira o assunto do dia sozinho",
    !textos.includes("publicar a proposta"),
  );
  conferir(
    "o responsável vem junto",
    emAberto.find((s) => s.texto === "confirmar o rufo")?.responsavel === "Reginato",
  );

  const { data: rHoje } = await sb
    .from("dia_relatorios")
    .insert({ diario_id: diarioId, dia: hoje })
    .select("id")
    .single();

  // Aceitar: o item passa a existir hoje, e a sugestão para de ser oferecida.
  await sb.from("dia_itens").insert({
    relatorio_id: rHoje!.id,
    secao: "realizado",
    texto: "Ajuste do contraste",
    posicao: 1,
  });

  const depoisDeAceitar = await sugestoesDeOntem(diarioId, hoje, rHoje!.id, [
    { id: "x", secao: "realizado", texto: "Ajuste do contraste", responsavel: null, origem: "humano" },
  ]);
  conferir(
    "o que já foi dito hoje não é oferecido de novo",
    !depoisDeAceitar.some((s) => s.texto === "ajuste do contraste"),
    "e a comparação ignora caixa e acento",
  );

  // Descartar: some, e continua sumido na recarga seguinte.
  const rufo = itens!.find((i) => i.texto === "confirmar o rufo")!;
  await sb
    .from("dia_descartes")
    .insert({ relatorio_id: rHoje!.id, item_origem_id: rufo.id });

  const depoisDeDescartar = await sugestoesDeOntem(diarioId, hoje, rHoje!.id);
  conferir(
    "o que foi descartado não volta na recarga",
    !depoisDeDescartar.some((s) => s.texto === "confirmar o rufo"),
  );

  const { error: duplicado } = await sb
    .from("dia_descartes")
    .insert({ relatorio_id: rHoje!.id, item_origem_id: rufo.id });
  conferir(
    "descartar duas vezes é o mesmo que descartar uma",
    duplicado?.code === "23505",
    "a chave primária barra, e a ação trata isso como sucesso",
  );

  // Limpa os dois dias para não poluir as checagens seguintes.
  await sb.from("dia_relatorios").delete().in("id", [rOntem!.id, rHoje!.id]);
}

/* -------------------------------------------------------------------------- */
/* 4 · As travas do banco                                                      */
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

  /**
   * O script cria a **própria org**, e não reusa a primeira do banco.
   *
   * `dia_diarios` tem chave única em `(org_id, autor_id)`: assim que o Rodrigo
   * usar o Diário de verdade, a vaga da org dele está ocupada e um script que
   * tentasse inserir ali quebraria — foi exatamente o que aconteceu na
   * primeira vez. Org descartável não disputa vaga com ninguém, e some
   * inteira no fim, levando o diário junto por cascata.
   */
  const { data: usuario } = await sb
    .from("org_members")
    .select("user_id")
    .limit(1)
    .single();

  const { data: org, error: erroOrg } = await sb
    .from("orgs")
    .insert({ name: `verificacao-diario-${crypto.randomUUID()}` })
    .select("id")
    .single();

  if (erroOrg || !org) {
    console.error("Não consegui criar a org de teste:", erroOrg?.message);
    process.exit(1);
  }

  const { data: diario, error } = await sb
    .from("dia_diarios")
    .insert({
      org_id: org.id,
      autor_id: usuario!.user_id,
      titulo: "VERIFICACAO AUTOMATICA — apagar",
    })
    .select("id")
    .single();

  if (error || !diario) {
    console.error("Não consegui criar o diário de teste:", error?.message);
    await sb.from("orgs").delete().eq("id", org.id);
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

    await conferirSugestoes(diario.id);
    await conferirBanco(diario.id, dia);
    await conferirDiaVazio(relatorioVazio!.id);
    await conferirIA(relatorio!.id);
  } finally {
    // Cascata: a org leva o diário, e o diário leva relatórios, registros e
    // publicações.
    await sb.from("orgs").delete().eq("id", org.id);
    console.log("\nOrg e diário de teste apagados.");
  }

  console.log(
    falhas === 0
      ? "\nTudo certo."
      : `\n${falhas} ${falhas === 1 ? "checagem falhou" : "checagens falharam"}.`,
  );
  process.exit(falhas === 0 ? 0 : 1);
}

void principal();
