import { moeda, numero } from "@/lib/orcamento/formato";
import { lerMarca } from "@/lib/orcamento/marcas";
import { AceiteDoCliente } from "./aceite-do-cliente";
import { BotaoImprimir } from "./botao-imprimir";
import {
  contaPreenchida,
  contratoPreenchido,
  type Empreiteira,
} from "@/lib/admin/empreiteira";
import type { DocumentoPublicado } from "@/lib/orcamento/publicacao";

/**
 * O orçamento como o cliente vê, na marca de quem executa a obra.
 *
 * As classes aqui (`wrap`, `cost-table`, `total-bar`, `spec-card`) são do
 * `brand.css` original de orcamentos.rd.eng.br, carregado como folha externa —
 * não são Tailwind. Aquele sistema é canônico e a impressão A4 dele já passou
 * por três armadilhas resolvidas: a logo esticada pelo flex da capa, o `h1`
 * global vencendo o branco do título, e a margem "nenhuma" do Chrome
 * descartando o `@page`. Traduzir para utilitários seria reabrir as três.
 *
 * Não existe custo nesta árvore. O objeto que chega aqui vem de
 * `orc_publicacoes.dados`, e `montarDocumento` já o deixou de fora.
 */

const DATA_BR = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

function porExtenso(iso: string) {
  return DATA_BR.format(new Date(iso));
}

function validoAte(iso: string, dias: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + dias);
  return DATA_BR.format(d);
}

const NOMES = ["", "uma", "duas", "três", "quatro", "cinco", "seis"];
function porNome(n: number) {
  return NOMES[n] ?? String(n);
}

type Parcela = { valor: number; percentual: number; quando: React.ReactNode };

/**
 * As parcelas do pagamento, em dinheiro.
 *
 * Com duas, quem manda é o `entradaPercentual` — é o combinado de sempre, 50/50
 * ou 70/30. Acima disso são iguais, porque foi assim que o Rodrigo fechou com o
 * Bismarck: quatro partes iguais, uma no início e as outras a cada quinze dias.
 *
 * **A última parcela é o resto da subtração, não o seu próprio percentual.**
 * Calcular cada uma por fora deixa o total um ou dois centavos diferente da
 * tabela logo acima, e o cliente confere na calculadora.
 */
function montarParcelas(
  total: number,
  entradaPercentual: number | null,
  quantas: number,
): Parcela[] {
  const inicio = (
    <>
      No <b>início da obra</b>, na aprovação e mobilização da equipe.
    </>
  );
  const fim = (
    <>
      No <b>final da obra</b>, na entrega e vistoria com você.
    </>
  );

  if (quantas <= 2) {
    const pct = entradaPercentual ?? 50;
    const entrada = Math.round(total * pct) / 100;
    return [
      { valor: entrada, percentual: pct, quando: inicio },
      { valor: total - entrada, percentual: 100 - pct, quando: fim },
    ];
  }

  const cada = Math.round((total / quantas) * 100) / 100;
  const pct = Math.round((100 / quantas) * 100) / 100;
  return Array.from({ length: quantas }, (_, i) => {
    const ultima = i === quantas - 1;
    return {
      valor: ultima ? Math.round((total - cada * i) * 100) / 100 : cada,
      percentual: pct,
      quando:
        i === 0 ? inicio : ultima ? fim : (
          <>
            <b>Durante a obra</b>, conforme o combinado.
          </>
        ),
    };
  });
}

export function DocumentoDoCliente({
  documento,
  token,
  jaAprovado,
  empreiteira,
}: {
  documento: DocumentoPublicado;
  token: string;
  jaAprovado: boolean;
  /** Do Perfil. O logotipo dela vence o do tema, e é o que faz o white
   *  label existir para quem não é a RD. */
  empreiteira?: Empreiteira;
}) {
  const tema = lerMarca(documento.marca);

  // O tema continua mandando na folha de estilo e nas cores; só o logotipo e o
  // nome passam a poder vir da empreiteira. Sem isso, qualquer construtora que
  // não fosse a RD assinava o documento com a marca da RD.
  const marca = {
    ...tema,
    nome: empreiteira?.nome ?? tema.nome,
    logo: empreiteira?.logo ?? tema.logo,
  };
  const itemizado = documento.valorFechado === null;
  const mostraValores = documento.itens.some((i) => i.valorUnitario !== null);

  // As parcelas são calculadas e a **última leva o resto** — nunca cada uma
  // pelo seu percentual. Com 70% de R$ 17.323,25, ou com um total dividido em
  // quatro, as contas separadas somariam um centavo a mais ou a menos que o
  // total, e o cliente conferiria na calculadora.
  const parcelas = montarParcelas(
    documento.total,
    documento.entradaPercentual,
    documento.parcelas,
  );

  // Sem conta cadastrada não há como pagar, e uma seção "Forma de pagamento"
  // sem para onde mandar o dinheiro é pior que seção nenhuma.
  const banco =
    empreiteira && contaPreenchida(empreiteira) ? empreiteira.banco : null;

  // As cláusulas que fazem do orçamento uma proposta comercial. Nulas até a
  // empreiteira preencher o Perfil — seção de garantias em branco num contrato
  // é pior que seção nenhuma.
  const contrato =
    empreiteira && contratoPreenchido(empreiteira) ? empreiteira.contrato : null;

  const garantias = contrato
    ? [
        contrato.garantiaSolidezAnos
          ? `${porNome(contrato.garantiaSolidezAnos)} anos de garantia para solidez, estabilidade estrutural e alvenarias, conforme o Art. 618 do Código Civil Brasileiro.`
          : null,
        contrato.garantiaAcabamentoAnos
          ? `${contrato.garantiaAcabamentoAnos === 1 ? "Um ano" : `${porNome(contrato.garantiaAcabamentoAnos)} anos`} de garantia para acabamentos e instalações hidráulicas, elétricas e de impermeabilização.`
          : null,
        contrato.emiteArt
          ? "Emissão de ART (Anotação de Responsabilidade Técnica) junto ao conselho de classe."
          : null,
      ].filter((g): g is string => g !== null)
    : [];

  const projeto = documento.secoes.filter((s) => s.tipo === "projeto");
  const observacoes = documento.secoes.filter((s) => s.tipo === "observacao");
  const etapas = documento.secoes.filter((s) => s.tipo === "etapa");

  // A numeração das seções é calculada, não fixa: cada bloco de texto é
  // opcional, e um documento sem "O projeto" não pode abrir no número 02.
  let secao = 0;
  const proximoNumero = () => String(++secao).padStart(2, "0");

  // Grupos na ordem em que aparecem, para a tabela ganhar as linhas de
  // cabeçalho de grupo sem reordenar nada.
  const linhas: Array<
    { tipo: "grupo"; nome: string } | { tipo: "item"; item: DocumentoPublicado["itens"][number] }
  > = [];
  let grupoAtual: string | null = null;
  for (const item of documento.itens) {
    if (item.grupo && item.grupo !== grupoAtual) {
      grupoAtual = item.grupo;
      linhas.push({ tipo: "grupo", nome: item.grupo });
    }
    linhas.push({ tipo: "item", item });
  }

  return (
    <>
      {/* `precedence` no <link> faz o React 19 içar a folha para o head e
          deduplicar. Só no link: ver o aviso abaixo sobre <style>.
          A de impressão entra com media="print": nunca pinta a tela. */}
      <link rel="stylesheet" href={marca.estilo} precedence="marca" />
      <link rel="stylesheet" href={marca.impressao} media="print" />

      {/* ⚠️ NÃO ponha `href` + `precedence` nos <style> abaixo.
      
          Essa combinação — o hoisting de <style> do React 19 — **quebra a
          hidratação inteira desta página**, e só na build de produção. Em
          desenvolvimento tudo funciona, o console não acusa nada, o HTML sai
          correto e todos os scripts carregam com 200. O que morre é o React:
          nenhum `onClick` responde. Foi assim que os dois botões de imprimir e
          o **botão de aceite do cliente** ficaram mortos sem ninguém perceber —
          o documento parecia perfeito e não respondia a um clique.
      
          Reproduzido com `npm run build && npm start` e provado por bissecção:
          tirando `href`/`precedence` dos três <style>, a hidratação volta.
          Como são folhas únicas por documento, não havia nada a deduplicar; o
          hoisting não trazia benefício nenhum. <style> puro no corpo aplica
          igual, e ainda vence o brand.css por vir depois na ordem. */}

      {/* O `.proj-grid` da marca é fixo em três colunas, porque as propostas
          feitas à mão sempre tinham três cards. Aqui a quantidade varia com o
          que a IA escreveu: com dois sobra um buraco à direita, com quatro
          sobra um órfão na segunda fila. Ajustado por fora, num seletor mais
          específico — a folha da marca é canônica e não se edita. O mobile
          continua em coluna única porque a regra vive dentro do mesmo
          `min-width` da original. */}
      <style>{`
        @media (min-width: 760px) {
          .proj-grid[data-cards="1"] { grid-template-columns: 1fr }
          .proj-grid[data-cards="2"],
          .proj-grid[data-cards="4"] { grid-template-columns: repeat(2, 1fr) }
        }
      `}</style>

      {/* A seção de pagamento existia nas propostas feitas à mão mas nunca
          chegou à cópia da folha que o Obra Nova serve. Vai aqui, e não dentro
          do `brand.css`, por dois motivos: a folha da marca é canônica e não se
          edita, e assim a seção funciona para qualquer empreiteira — todas as
          variáveis usadas abaixo existem nas duas folhas.

          O `.pag-grid` original é de três colunas, porque as propostas antigas
          tinham três cards. Aqui a quantidade varia com o combinado: em duas
          parcelas, num grid de três, a segunda ficaria com um buraco à
          direita. Mesmo conserto do `.proj-grid`, pelo mesmo motivo, e o
          número de colunas acompanha o número de parcelas. */}
      <style>{`
        .pag-grid{display:grid;grid-template-columns:1fr;gap:14px;margin-top:8px}
        @media(min-width:720px){
          .pag-grid{grid-template-columns:repeat(2,1fr)}
          .pag-grid[data-parcelas="3"]{grid-template-columns:repeat(3,1fr)}
        }
        @media(min-width:980px){
          .pag-grid[data-parcelas="4"]{grid-template-columns:repeat(4,1fr)}
        }
        .pag{border:1px solid var(--line);border-radius:5px;background:var(--ink-2);padding:24px 22px;position:relative}
        .pag.first{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
        .pag .pn{font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin-bottom:12px}
        .pag .pv{font-family:var(--archivo);font-weight:800;font-size:clamp(22px,3.4vw,27px);letter-spacing:-.02em;line-height:1;color:#fff}
        .pag .pq{font-family:var(--mono);font-size:10.5px;color:var(--fog-2);margin-top:6px;letter-spacing:.04em;text-transform:uppercase}
        .pag .pw{font-size:14px;color:var(--fog);line-height:1.5;margin-top:14px;padding-top:14px;border-top:1px solid var(--line-soft)}
        .pag .pw b{color:#fff;font-weight:600}
        .bank-card{border:1px solid var(--accent);border-radius:5px;background:var(--ink-2);padding:26px 24px;margin-top:20px}
        .bank-card .bk-tag{font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin-bottom:16px}
        .bank-rows{display:grid;grid-template-columns:1fr 1fr;gap:14px 24px}
        @media(max-width:520px){.bank-rows{grid-template-columns:1fr}}
        .bank-rows .bk-row{border-bottom:1px solid var(--line-soft);padding-bottom:10px}
        .bank-rows .bk-k{font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--fog-2);margin-bottom:4px}
        .bank-rows .bk-v{font-size:14.5px;font-weight:600;color:#fff;letter-spacing:-.005em}
        .bank-rows .bk-row.bk-pix{grid-column:1 / -1;border-bottom:none;background:rgba(232,98,44,.08);border:1px dashed var(--accent);border-radius:4px;padding:14px 16px;margin-top:4px}
        .bank-rows .bk-pix .bk-v{font-family:var(--mono);font-size:15px;color:var(--accent)}
      `}</style>

      {/* As condições comerciais e o par de assinaturas não existiam nas
          propostas feitas à mão — a folha da marca não tem classe para eles.
          Vão aqui, e não dentro do `brand.css`, pelo mesmo motivo da seção de
          pagamento: a folha da marca é canônica e não se edita.

          A folha de impressão da RD já estiliza `.sign`, `.sl`, `.sname` e
          `.srole` — só faltava o documento escrever a marcação. Por isso o
          bloco de assinatura reusa exatamente esses nomes: o que se paga aqui
          é só a grade de duas colunas, que é nova. */}
      <style>{`
        .cond-grid{display:grid;grid-template-columns:1fr;gap:12px;margin-top:8px}
        @media(min-width:720px){.cond-grid{grid-template-columns:repeat(2,1fr)}}
        .cond{border:1px solid var(--line);border-radius:5px;background:var(--ink-2);padding:18px 20px}
        .cond .cn{font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin-bottom:8px}
        .cond .cv{font-size:14.5px;color:#fff;line-height:1.5}
        .cond-sub{font-family:var(--archivo);font-weight:700;font-size:16px;color:#fff;margin:34px 0 12px}
        .clausulas{list-style:none;padding:0;margin:0;display:grid;gap:12px}
        .clausulas li{position:relative;padding-left:22px;font-size:14.5px;line-height:1.6;color:var(--fog)}
        .clausulas li::before{content:"";position:absolute;left:0;top:9px;width:7px;height:7px;border:1px solid var(--accent);border-radius:1px}

        /* Duas assinaturas lado a lado. A \`.sign-solo\` da marca é uma coluna
           centrada de 360px — serve para a proposta que só a empreiteira
           assinava, não para um contrato com duas partes. */
        .sign-duo{display:grid;grid-template-columns:1fr;gap:20px;margin-top:48px}
        @media(min-width:720px){.sign-duo{grid-template-columns:repeat(2,1fr);gap:28px}}
        .sign-duo .sign{width:100%}
        .sign-duo .sdoc{font-family:var(--mono);font-size:10px;letter-spacing:.06em;color:var(--fog-2);margin-top:10px}
        .print-cta{margin-top:40px;padding-top:26px;border-top:1px solid var(--line);display:flex;justify-content:center}
      `}</style>

      {/* Na impressão o par de assinaturas continua lado a lado e não pode ser
          partido entre duas páginas: assinatura numa folha e nome na seguinte
          é o tipo de defeito que invalida o documento aos olhos de quem lê. */}
      <style media="print">{`
        @media print {
          .sign-duo{display:grid !important;grid-template-columns:repeat(2,1fr) !important;gap:14mm;break-inside:avoid;margin-top:16mm}
          .sign-duo .sign{border:none !important;padding:0 !important;background:none !important;text-align:left !important}
          .sign-duo .sl{height:18mm;border-bottom:1px solid #333}
          .sign-duo .sname{color:#111 !important;font-size:12pt}
          .sign-duo .srole, .sign-duo .sdoc{color:#444 !important}
          #condicoes .cond{background:#f6f4ef !important;border-color:#ddd8c8 !important}
          #condicoes .cond .cv{color:#111 !important}
          #condicoes .cond-sub{color:#0a0a0a !important}
          #condicoes .clausulas li{color:#333 !important;break-inside:avoid}
          #condicoes{break-inside:avoid-page}
        }
      `}</style>

      {/* ---------- Capa, só na impressão ---------- */}
      <div className="print-cover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pc-logo" src={marca.logo} alt={marca.nome} />
        <div>
          <div className="pc-eyebrow">Orçamento</div>
          <div className="pc-title">{documento.objeto ?? "Proposta de serviço"}</div>
        </div>
        <div className="pc-meta">
          <span>{documento.cliente}</span>
          {documento.numero && <span>{documento.numero}</span>}
          <span>{porExtenso(documento.publicadoEm)}</span>
        </div>
      </div>

      {/* ---------- Papel timbrado, da página 2 em diante ---------- */}
      <div className="print-letterhead">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pl-logo" src={marca.logo} alt={marca.nome} />
        <div className="pl-address">
          {marca.nome}
          <br />
          {documento.numero ?? "Orçamento"}
        </div>
      </div>

      <header id="topo">
        <div className="wrap">
          <div className="hero-grid">
            <div>
              <div className="hero-doc">
                <span>
                  Orçamento <b>{documento.numero ?? "—"}</b>
                </span>
                <span>
                  Emitido em <b>{porExtenso(documento.publicadoEm)}</b>
                </span>
                {documento.versao > 1 && (
                  <span>
                    Versão <b>{documento.versao}</b>
                  </span>
                )}
              </div>
              <h1>{documento.objeto ?? "Proposta de serviço"}</h1>
              {/* A apresentação escrita substitui o "Preparado para X", que é
                  informação que o cartão de resumo ao lado já dá. Quando não
                  há texto, a frase seca volta — nunca fica um vazio. */}
              <p className="lede">
                {documento.textos.apresentacao ?? (
                  <>
                    Preparado para {documento.cliente}
                    {documento.endereco ? `, ${documento.endereco}` : ""}.
                  </>
                )}
              </p>
              <div className="meta">
                {documento.prazo && <span className="tag">Prazo: {documento.prazo}</span>}
                {documento.pagamento && (
                  <span className="tag">{documento.pagamento}</span>
                )}
                <span className="tag">
                  Válido até {validoAte(documento.publicadoEm, documento.validadeDias)}
                </span>
              </div>
            </div>

            <div className="spec-card">
              <div className="sc-top">
                <span>Resumo</span>
                <b>{documento.numero ?? ""}</b>
              </div>
              <div className="sc-body">
                <div className="sc-row">
                  <span className="k">Cliente</span>
                  <span className="v">{documento.cliente}</span>
                </div>
                {documento.endereco && (
                  <div className="sc-row">
                    <span className="k">Local</span>
                    <span className="v">{documento.endereco}</span>
                  </div>
                )}
                <div className="sc-row">
                  <span className="k">Itens</span>
                  <span className="v">{documento.itens.length}</span>
                </div>
                <div className="sc-row">
                  <span className="k">Total</span>
                  <span className="v">{moeda(documento.total)}</span>
                </div>
              </div>
              <div className="sc-print">
                <BotaoImprimir />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ---------- O projeto, antes dos números ---------- */}
      {projeto.length > 0 && (
        <section id="projeto">
          <div className="wrap">
            <p className="kicker">
              <span className="s-num">{proximoNumero()}</span> O projeto
            </p>
            <h2>Como o serviço foi pensado</h2>
            <div className="proj-grid" data-cards={projeto.length}>
              {projeto.map((s, i) => (
                <div className="pcard" key={i}>
                  <div className="pn">{String(i + 1).padStart(2, "0")}</div>
                  <h3>{s.titulo}</h3>
                  <p>{s.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section id="custos">
        <div className="wrap">
          <p className="kicker">
            <span className="s-num">{proximoNumero()}</span> Detalhamento
          </p>
          <h2>O que está incluso</h2>
          <p className="intro">
            {documento.textos.introCustos ??
              "Cada linha é um serviço com sua medida. O valor de cada item já inclui material e mão de obra, salvo observação em contrário."}
          </p>

          <div className="cost-wrap">
            <table className="cost-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="ct-num">Qtd.</th>
                  <th>Unid.</th>
                  {mostraValores && <th className="ct-num">Vlr. unitário</th>}
                  {mostraValores && <th className="ct-num">Total</th>}
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha, i) =>
                  linha.tipo === "grupo" ? (
                    <tr className="ct-group" key={`g${i}`}>
                      <td colSpan={mostraValores ? 5 : 3}>{linha.nome}</td>
                    </tr>
                  ) : (
                    <tr key={`i${i}`}>
                      <td>
                        {linha.item.descricao}
                        {linha.item.observacao && (
                          <>
                            <br />
                            <small>{linha.item.observacao}</small>
                          </>
                        )}
                      </td>
                      <td className="num">{numero(linha.item.quantidade)}</td>
                      <td className="unit">{linha.item.unidade ?? "—"}</td>
                      {mostraValores && (
                        <td className="num">
                          {linha.item.valorUnitario === null
                            ? "—"
                            : moeda(linha.item.valorUnitario)}
                        </td>
                      )}
                      {mostraValores && (
                        <td className="num total">
                          {linha.item.total === null ? "—" : moeda(linha.item.total)}
                        </td>
                      )}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>

          <div className="total-bar">
            <span className="tb-label">
              {itemizado ? "Total geral" : "Valor fechado"}
            </span>
            <span className="tb-value">{moeda(documento.total)}</span>
          </div>

          {/* A nota escrita fica logo abaixo do total, que é onde a dúvida
              nasce: o que este número inclui, até quando vale, como se paga. */}
          {documento.textos.notaCustos ? (
            <p className="total-note">{documento.textos.notaCustos}</p>
          ) : (
            !itemizado && (
              <p className="total-note">
                <b>Valor único</b> para o escopo descrito acima.
              </p>
            )
          )}
        </div>
      </section>

      {/* ---------- Forma de pagamento ---------- */}
      {/* Depois do total e antes das observações: a pergunta "como eu pago"
          nasce no instante em que o número aparece. */}
      {documento.entradaPercentual !== null && banco && (
        <section id="pagamento">
          <div className="wrap">
            <p className="kicker">
              <span className="s-num">{proximoNumero()}</span> Forma de
              pagamento
            </p>
            <h2>
              {parcelas.length === 2
                ? `${documento.entradaPercentual}% no início, ${100 - documento.entradaPercentual}% no final`
                : `${parcelas.length} parcelas iguais`}
            </h2>
            <p className="intro">
              O valor é dividido em {porNome(parcelas.length)} parcelas, pagas
              via PIX
              {documento.pagamento ? ` — ${documento.pagamento}` : ""}.
            </p>

            <div className="pag-grid" data-parcelas={parcelas.length}>
              {parcelas.map((p, i) => (
                <div key={i} className={`pag${i === 0 ? " first" : ""}`}>
                  <div className="pn">{i + 1}ª parcela</div>
                  <div className="pv">{moeda(p.valor)}</div>
                  <div className="pq">{p.percentual}% do total</div>
                  <div className="pw">{p.quando}</div>
                </div>
              ))}
            </div>

            <div className="bank-card">
              <div className="bk-tag">Dados para pagamento</div>
              <div className="bank-rows">
                <LinhaDoBanco rotulo="Titular" valor={banco.titular} />
                <LinhaDoBanco rotulo="CPF/CNPJ" valor={banco.documento} />
                <LinhaDoBanco rotulo="Banco" valor={banco.nome} />
                <LinhaDoBanco rotulo="Agência" valor={banco.agencia} />
                <LinhaDoBanco rotulo="Conta" valor={banco.conta} />
                {banco.pix && (
                  <div className="bk-row bk-pix">
                    <div className="bk-k">Chave PIX</div>
                    <div className="bk-v">{banco.pix}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---------- Observações técnicas, depois dos números ---------- */}
      {(observacoes.length > 0 || documento.observacoes) && (
        <section id="observacoes">
          <div className="wrap">
            <p className="kicker">
              <span className="s-num">{proximoNumero()}</span> Observações
            </p>
            <h2>O que vale saber</h2>

            {observacoes.length > 0 && (
              <ul className="obs-list">
                {observacoes.map((s, i) => (
                  <li key={i}>
                    {/* O ícone não é enfeite: `.obs-list li` é um grid
                        `auto 1fr` e conta com dois filhos. Sem ele o texto cai
                        na coluna `auto` e quebra na metade da largura. */}
                    <span className="obs-ic" aria-hidden>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.7}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 8v5M12 16.5v.01" />
                      </svg>
                    </span>
                    <div>
                      <h3>{s.titulo}</h3>
                      <p>{s.texto}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {documento.observacoes && (
              <p className="intro">{documento.observacoes}</p>
            )}
          </div>
        </section>
      )}

      {/* ---------- Como a obra acontece ---------- */}
      {etapas.length > 0 && (
        <section id="etapas">
          <div className="wrap">
            <p className="kicker">
              <span className="s-num">{proximoNumero()}</span> Do aceite à
              entrega
            </p>
            <h2>Como o serviço acontece</h2>
            <ol className="timeline">
              {etapas.map((s, i) => (
                <li key={i}>
                  <span className="tl-n">{i + 1}</span>
                  <div>
                    <h3>{s.titulo}</h3>
                    <p>{s.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* ---------- Condições comerciais: o que faz disto um contrato ---------- */}
      {/* Vem depois do escopo e do preço, e antes do aceite: é a última coisa
          que se lê antes de assinar, que é exatamente onde ela pertence. */}
      {contrato && (
        <section id="condicoes">
          <div className="wrap">
            <p className="kicker">
              <span className="s-num">{proximoNumero()}</span> Condições
              comerciais
            </p>
            <h2>Prazos, garantias e normas</h2>

            <div className="cond-grid">
              {documento.prazo && (
                <div className="cond">
                  <div className="cn">Prazo de execução</div>
                  <div className="cv">{documento.prazo}</div>
                </div>
              )}
              {contrato.horarioTrabalho && (
                <div className="cond">
                  <div className="cn">Horário de trabalho</div>
                  <div className="cv">{contrato.horarioTrabalho}</div>
                </div>
              )}
              <div className="cond">
                <div className="cn">Validade da proposta</div>
                <div className="cv">
                  {documento.validadeDias} dias · até{" "}
                  {validoAte(documento.publicadoEm, documento.validadeDias)}
                </div>
              </div>
              {contrato.responsavelTecnico && (
                <div className="cond">
                  <div className="cn">Responsável técnico</div>
                  <div className="cv">{contrato.responsavelTecnico}</div>
                </div>
              )}
            </div>

            {garantias.length > 0 && (
              <>
                <h3 className="cond-sub">Garantias</h3>
                <ul className="clausulas">
                  {garantias.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </>
            )}

            {contrato.normasTecnicas.length > 0 && (
              <>
                <h3 className="cond-sub">Normas técnicas aplicáveis</h3>
                <p className="intro">
                  Os serviços são executados sob cumprimento das Normas
                  Técnicas Brasileiras (ABNT NBR).
                </p>
                <ul className="clausulas">
                  {contrato.normasTecnicas.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </>
            )}

            {contrato.clausulasExtras.length > 0 && (
              <>
                <h3 className="cond-sub">Demais condições</h3>
                <ul className="clausulas">
                  {contrato.clausulasExtras.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>
      )}

      <section id="aceite" className="accept">
        <div className="wrap">
          <p className="kicker">
            <span className="s-num">{proximoNumero()}</span> Aceite
          </p>
          <h2>Combinado?</h2>
          <p className="intro">
            {documento.textos.introAceite ??
              "Ao aceitar, você registra a concordância com o escopo e o valor acima. A data e o valor ficam guardados como estão hoje."}
          </p>

          <AceiteDoCliente
            token={token}
            jaAprovado={jaAprovado}
            total={documento.total}
          />

          <p className="validade">
            Este orçamento é válido até{" "}
            <b>{validoAte(documento.publicadoEm, documento.validadeDias)}</b>
          </p>

          {/* O segundo botão de imprimir, e o que importa é onde ele está.
              O outro fica lá em cima, no cartão de resumo — quem rolou o
              documento inteiro até as assinaturas é justamente quem quer o
              papel na mão, e mandar essa pessoa voltar ao topo é onde
              "imprimir não funciona" começa. */}
          <div className="print-cta">
            <BotaoImprimir rotulo="Imprimir para assinar" />
          </div>

          {/* Duas assinaturas, lado a lado — quem executa e quem contrata.
              A linha nasce vazia nos dois lados: é para assinar à mão no
              papel, não um nome em fonte cursiva fingindo assinatura. */}
          <div className="sign-duo">
            <div className="sign">
              <div className="sl" />
              <div className="sname">{marca.nome}</div>
              <div className="srole">
                {contrato?.responsavelTecnico
                  ? `${contrato.responsavelTecnico} · Responsável técnico`
                  : "Contratada"}
              </div>
              {empreiteira?.documento && (
                <div className="sdoc">CNPJ {empreiteira.documento}</div>
              )}
            </div>

            <div className="sign">
              <div className="sl" />
              <div className="sname">{documento.cliente}</div>
              <div className="srole">Contratante</div>
              <div className="sdoc">Data: ____ / ____ / ________</div>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="foot-top">
            <div className="foot-logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={marca.logo} alt={marca.nome} />
            </div>
            {/* Contato de QUEM EXECUTA, não do cliente. Aqui saía
                `clienteContato` — o telefone do próprio cliente, mostrado para
                ele como se fosse o de quem faz a obra. Ninguém liga para si
                mesmo, e o campo existe para ele saber a quem recorrer. */}
            <div className="foot-contact">
              <span>{marca.nome}</span>
              {empreiteira?.telefone && <span>{empreiteira.telefone}</span>}
              {empreiteira?.email && <span>{empreiteira.email}</span>}
              {empreiteira?.documento && (
                <span>CNPJ {empreiteira.documento}</span>
              )}
            </div>
          </div>
          <div className="foot-bottom">
            <span>
              {documento.numero ?? "Orçamento"} ·{" "}
              {porExtenso(documento.publicadoEm)}
            </span>
            <span>Documento gerado no Obra Nova</span>
          </div>
        </div>
      </footer>

      <div className="print-footer">
        {marca.nome} · {documento.numero ?? "Orçamento"} ·{" "}
        {porExtenso(documento.publicadoEm)}
      </div>
    </>
  );
}


/** Uma linha do cartão bancário. Some quando o campo não foi preenchido. */
function LinhaDoBanco({
  rotulo,
  valor,
}: {
  rotulo: string;
  valor: string | null;
}) {
  if (!valor) return null;
  return (
    <div className="bk-row">
      <div className="bk-k">{rotulo}</div>
      <div className="bk-v">{valor}</div>
    </div>
  );
}
