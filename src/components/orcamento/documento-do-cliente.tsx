import { moeda, numero } from "@/lib/orcamento/formato";
import { lerMarca } from "@/lib/orcamento/marcas";
import { AceiteDoCliente } from "./aceite-do-cliente";
import { BotaoImprimir } from "./botao-imprimir";
import type { Empreiteira } from "@/lib/admin/empreiteira";
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
      {/* `precedence` faz o React 19 içar a folha para o head e deduplicar.
          A de impressão entra com media="print": nunca pinta a tela. */}
      <link rel="stylesheet" href={marca.estilo} precedence="marca" />
      <link
        rel="stylesheet"
        href={marca.impressao}
        media="print"
        precedence="marca-print"
      />

      {/* O `.proj-grid` da marca é fixo em três colunas, porque as propostas
          feitas à mão sempre tinham três cards. Aqui a quantidade varia com o
          que a IA escreveu: com dois sobra um buraco à direita, com quatro
          sobra um órfão na segunda fila. Ajustado por fora, num seletor mais
          específico — a folha da marca é canônica e não se edita. O mobile
          continua em coluna única porque a regra vive dentro do mesmo
          `min-width` da original. */}
      <style href="grade-do-projeto" precedence="marca">{`
        @media (min-width: 760px) {
          .proj-grid[data-cards="1"] { grid-template-columns: 1fr }
          .proj-grid[data-cards="2"],
          .proj-grid[data-cards="4"] { grid-template-columns: repeat(2, 1fr) }
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

