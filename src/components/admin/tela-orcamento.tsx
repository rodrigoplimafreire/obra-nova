"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Cabecalho,
  CartaoDeDados,
  Conteudo,
  Dado,
  Indicador,
} from "./cabecalho";
import { Dialogo } from "@/components/comum/dialogo";
import { PublicacaoDoOrcamento } from "./publicacao-do-orcamento";
import { TabelaDeCustos } from "./tabela-de-custos";
import { TextosDoDocumento } from "./textos-do-documento";
import {
  arquivarOrcamento,
  atualizarOrcamento,
  excluirOrcamento,
  numerarOrcamento,
} from "@/lib/orcamento/acoes";
import { data, moeda, numero } from "@/lib/orcamento/formato";
import {
  CampoDeMoeda,
  CampoDePercentual,
  CampoDeTelefone,
  formatarTelefone,
} from "@/components/comum/campos";
import { MARCAS } from "@/lib/orcamento/marcas";
import type { Resultado } from "@/lib/admin/tipos";
import type {
  ObraParaVincular,
  OrcamentoCompleto,
} from "@/lib/orcamento/dados";

export function TelaDoOrcamento({
  orcamento,
  obras,
  urlBase,
}: {
  orcamento: OrcamentoCompleto;
  obras: ObraParaVincular[];
  urlBase: string;
}) {
  return (
    <>
      <Cabecalho
        voltarPara="/admin/orcamentos"
        voltarRotulo="Orçamentos"
        titulo={orcamento.cliente}
        meta={[
          orcamento.numero ?? "sem número",
          orcamento.objeto,
          orcamento.endereco,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      <Conteudo>
        <DadosDoOrcamento orcamento={orcamento} obras={obras} />

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Indicador rotulo="Itens" valor={orcamento.itens.length} />
          <Indicador
            rotulo="Sem preço"
            valor={orcamento.semPreco}
            destaque={orcamento.semPreco > 0 ? "amarelo" : undefined}
          />
          <Indicador rotulo="Total" valor={moeda(orcamento.total)} />
          <Indicador
            rotulo="Enviado"
            valor={
              orcamento.versaoPublicada ? `v${orcamento.versaoPublicada}` : "não"
            }
            detalhe={
              orcamento.publicadoEm ? data(orcamento.publicadoEm) : undefined
            }
          />
        </div>

        <PublicacaoDoOrcamento orcamento={orcamento} urlBase={urlBase} />

        <TabelaDeCustos
          orcamentoId={orcamento.id}
          itens={orcamento.itens}
          removidos={orcamento.removidos}
          total={orcamento.total}
          valorFechado={orcamento.valorFechado}
          bdiPadrao={orcamento.bdiPadrao}
          custoTotal={orcamento.custoTotal}
          margemValor={orcamento.margemValor}
          margemPercentual={orcamento.margemPercentual}
          semCusto={orcamento.semCusto}
        />

        {/* Depois da tabela porque é dela que os textos saem: a IA lê os itens
            para escrever, e escrever antes de ter o que orçar é escrever no
            vazio. */}
        <TextosDoDocumento orcamento={orcamento} />

        <ZonaDeRisco orcamento={orcamento} />
      </Conteudo>
    </>
  );
}

/**
 * Os dados do orçamento, sempre à vista.
 *
 * Antes isto vivia atrás de um botão chamado "Dados do documento", e o
 * resultado foi o previsível: ninguém achou, e a tela passou a impressão de
 * que orçamento criado não se edita mais. Ver o que está preenchido e o que
 * está vazio é metade do trabalho — campo em branco aparece como travessão,
 * não some.
 */
function DadosDoOrcamento({
  orcamento,
  obras,
}: {
  orcamento: OrcamentoCompleto;
  obras: ObraParaVincular[];
}) {
  const [editando, setEditando] = useState(false);
  const marca = MARCAS[orcamento.marca]?.nome ?? orcamento.marca;

  return (
    <CartaoDeDados
      titulo="Dados do orçamento"
      aoEditar={() => setEditando(true)}
      rodape={
        orcamento.observacoes ? (
          <>
            <p className="rotulo">Observações</p>
            <p className="mt-1 text-sm leading-relaxed text-tinta">
              {orcamento.observacoes}
            </p>
          </>
        ) : undefined
      }
    >
      <>
        <Dado rotulo="Cliente" valor={orcamento.cliente} />
        <Dado
          rotulo="Telefone"
          valor={
            orcamento.clienteContato
              ? formatarTelefone(orcamento.clienteContato)
              : null
          }
          mono
        />
        <Dado rotulo="Objeto" valor={orcamento.objeto} />
        <Dado rotulo="Endereço" valor={orcamento.endereco} />
        <Dado rotulo="Prazo de execução" valor={orcamento.prazo} />
        <Dado rotulo="Condições de pagamento" valor={orcamento.pagamento} />
        <Dado
          rotulo="Validade"
          valor={`${orcamento.validadeDias} dias`}
          dica="Contados a partir da publicação. A data limite aparece no documento do cliente."
        />
        <Dado
          rotulo="BDI padrão"
          valor={`${numero(orcamento.bdiPadrao)}%`}
          dica="Benefícios e Despesas Indiretas: o quanto se acrescenta ao custo para chegar no preço de venda."
        />
        <Dado
          rotulo="Senha do link"
          valor={orcamento.senha}
          mono
          dica="O cliente digita para abrir. Sem senha, o orçamento não pode ser publicado."
        />
        <Dado
          rotulo="Marca do documento"
          valor={marca}
          dica="Quem assina a página do cliente. O painel é sempre Obra Nova."
        />
        <Dado
          rotulo="Obra vinculada"
          valor={orcamento.obraNome ?? null}
          vazio="ainda não virou obra"
          dica="Liga este orçamento ao canteiro que nasceu dele."
        />
        {/* Numerar é ação de um campo só, e o lugar dela é o campo. No
            cabeçalho, "Dar número" era um botão sem contexto — ninguém sabia
            o que numerava nem por que estava desligado do resto. */}
        <Dado
          rotulo="Número"
          valor={orcamento.numero}
          mono
          dica="Sequencial da empreiteira, tipo RD-2026-001. Rascunho não gasta número da sequência."
          acao={!orcamento.numero && <BotaoDeNumerar id={orcamento.id} />}
        />

        <Dialogo
          aberto={editando}
          aoFechar={() => setEditando(false)}
          titulo="Dados do orçamento"
          descricao="O que aparece no documento do cliente, mais os controles internos."
        >
          {editando && (
            <FormularioDeDados
              orcamento={orcamento}
              obras={obras}
              aoFechar={() => setEditando(false)}
            />
          )}
        </Dialogo>
      </>
    </CartaoDeDados>
  );
}

function BotaoDeNumerar({ id }: { id: string }) {
  const router = useRouter();
  const [estado, numerar, numerando] = useActionState<
    Resultado | null,
    FormData
  >(numerarOrcamento, null);

  useEffect(() => {
    if (estado?.ok) router.refresh();
  }, [estado, router]);

  return (
    <form action={numerar}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={numerando}
        className="btn-texto text-xs not-italic disabled:opacity-40"
      >
        {numerando ? "Numerando…" : "Numerar agora"}
      </button>
      {estado?.erro && (
        <span className="ml-2 text-xs not-italic text-atraso">
          {estado.erro}
        </span>
      )}
    </form>
  );
}

function FormularioDeDados({
  orcamento,
  obras,
  aoFechar,
}: {
  orcamento: OrcamentoCompleto;
  obras: ObraParaVincular[];
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [estado, acao, pendente] = useActionState<Resultado | null, FormData>(
    atualizarOrcamento,
    null,
  );

  useEffect(() => {
    if (estado?.ok) {
      router.refresh();
      aoFechar();
    }
  }, [estado, router, aoFechar]);

  return (
    <form action={acao} className="dialogo-forma">
      <div className="dialogo-corpo flex flex-col gap-4">
        <input type="hidden" name="id" value={orcamento.id} />

        <div className="grid gap-4 md:grid-cols-2">
          <Campo
            rotulo="Cliente"
            nome="cliente"
            valor={orcamento.cliente}
            obrigatorio
          />
          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Telefone</span>
            <CampoDeTelefone
              nome="contato"
              valorInicial={orcamento.clienteContato}
              placeholder="(85) 99999-0000"
            />
          </label>
          <Campo
            rotulo="Objeto"
            nome="objeto"
            valor={orcamento.objeto ?? ""}
            dica="o serviço, em uma linha"
          />
          <Campo
            rotulo="Endereço"
            nome="endereco"
            valor={orcamento.endereco ?? ""}
            dica="onde é a obra"
          />
          <Campo
            rotulo="Prazo de execução"
            nome="prazo"
            valor={orcamento.prazo ?? ""}
            dica="30 dias corridos após a assinatura"
          />
          <Campo
            rotulo="Condições de pagamento"
            nome="pagamento"
            valor={orcamento.pagamento ?? ""}
            dica="50% na assinatura, 50% na entrega"
          />
          <Campo
            rotulo="Validade (dias)"
            nome="validadeDias"
            valor={String(orcamento.validadeDias)}
          />
          <Campo
            rotulo="Senha do link"
            nome="senha"
            valor={orcamento.senha ?? ""}
            dica="o cliente digita para abrir"
          />
          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Valor fechado</span>
            <CampoDeMoeda
              nome="valorFechado"
              valorInicial={orcamento.valorFechado}
              placeholder="R$ 0,00"
            />
            <span className="ajuda-campo">
              Só quando o preço for único, sem valor por item.
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">BDI padrão</span>
            <CampoDePercentual
              nome="bdiPadrao"
              valorInicial={orcamento.bdiPadrao}
              placeholder="30%"
            />
            <span className="ajuda-campo">
              Pré-preenche o valor de venda ao escolher um custo da base. Cada
              item pode se afastar dele.
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Marca do documento</span>
            <select name="marca" defaultValue={orcamento.marca} className="campo">
              {Object.entries(MARCAS).map(([chave, marca]) => (
                <option key={chave} value={chave}>
                  {marca.nome}
                </option>
              ))}
            </select>
            <span className="ajuda-campo">
              O painel é sempre Obra Nova. Isto é quem assina a página que o
              cliente abre.
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="rotulo-campo">Obra vinculada</span>
            <select
              name="obraId"
              defaultValue={orcamento.obraId ?? ""}
              className="campo"
            >
              <option value="">Nenhuma — ainda não virou obra</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome} · {o.cliente}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="rotulo-campo">Observações</span>
          <textarea
            name="observacoes"
            defaultValue={orcamento.observacoes ?? ""}
            rows={3}
            className="campo"
          />
        </label>

        {estado?.erro && <p className="aviso aviso-erro text-sm">{estado.erro}</p>}
      </div>

      <div className="dialogo-rodape">
        <button type="button" onClick={aoFechar} className="btn btn-secundario">
          Cancelar
        </button>
        <button type="submit" disabled={pendente} className="btn btn-primario">
          {pendente ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}

function Campo({
  rotulo,
  nome,
  valor,
  dica,
  ajuda,
  obrigatorio,
}: {
  rotulo: string;
  nome: string;
  valor: string;
  dica?: string;
  ajuda?: string;
  obrigatorio?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="rotulo-campo">
        {rotulo}
        {obrigatorio && " *"}
      </span>
      <input
        name={nome}
        defaultValue={valor}
        placeholder={dica}
        required={obrigatorio}
        className="campo"
      />
      {ajuda && <span className="ajuda-campo">{ajuda}</span>}
    </label>
  );
}


/**
 * Arquivar e apagar moram no fim da página, longe do que se usa todo dia.
 *
 * Apagar exige digitar o nome do cliente: é a única ação daqui que não tem
 * volta, e um clique errado levaria junto os áudios da visita.
 */
function ZonaDeRisco({ orcamento }: { orcamento: OrcamentoCompleto }) {
  const router = useRouter();
  const [apagando, setApagando] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [estadoArquivo, arquivar, arquivando] = useActionState<
    Resultado | null,
    FormData
  >(arquivarOrcamento, null);
  const [estadoExclusao, excluir, excluindo] = useActionState<
    Resultado | null,
    FormData
  >(excluirOrcamento, null);

  useEffect(() => {
    if (estadoExclusao?.ok && estadoExclusao.link) {
      router.push(estadoExclusao.link);
    }
  }, [estadoExclusao, router]);

  useEffect(() => {
    if (estadoArquivo?.ok) router.refresh();
  }, [estadoArquivo, router]);

  const arquivado = orcamento.status === "arquivado";
  const podeApagar = confirmacao.trim() === orcamento.cliente.trim();

  return (
    <section className="mt-12 rounded-lg border border-dashed border-nevoa px-5 py-5">
      <p className="rotulo mb-4">Encerrar</p>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <form action={arquivar} className="flex items-center gap-3">
          <input type="hidden" name="id" value={orcamento.id} />
          {arquivado && <input type="hidden" name="voltar" value="1" />}
          <button
            type="submit"
            disabled={arquivando}
            className="btn btn-secundario"
          >
            {arquivado ? "Desarquivar" : "Arquivar"}
          </button>
          <span className="text-xs leading-snug text-cinza">
            {arquivado
              ? "Volta para a lista."
              : "Some da lista, continua guardado."}
          </span>
        </form>

        <div className="flex flex-col items-start gap-2">
          <button
            type="button"
            onClick={() => setApagando(true)}
            className="btn btn-perigo"
          >
            Apagar orçamento
          </button>
          <span className="text-xs leading-snug text-cinza">
            Apaga itens, perguntas e os áudios da visita. Não tem volta.
          </span>
        </div>
      </div>

      <Dialogo
        aberto={apagando}
        aoFechar={() => setApagando(false)}
        titulo={`Apagar o orçamento de ${orcamento.cliente}?`}
        descricao="Vão junto os itens, as perguntas e os áudios da visita, inclusive os arquivos no Storage. Não dá para desfazer."
        estreito
      >
        <form action={excluir} className="dialogo-forma">
          <div className="dialogo-corpo flex flex-col gap-4">
            <input type="hidden" name="id" value={orcamento.id} />
            <label className="flex flex-col gap-1.5">
              <span className="rotulo-campo">
                Para confirmar, digite o nome do cliente
              </span>
              <input
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                placeholder={orcamento.cliente}
                autoComplete="off"
                className="campo"
              />
            </label>
            {estadoExclusao?.erro && (
              <p className="aviso aviso-erro text-sm">{estadoExclusao.erro}</p>
            )}
          </div>

          <div className="dialogo-rodape">
            <button
              type="button"
              onClick={() => setApagando(false)}
              className="btn btn-secundario"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!podeApagar || excluindo}
              className="btn btn-perigo"
            >
              {excluindo ? "Apagando…" : "Apagar orçamento"}
            </button>
          </div>
        </form>
      </Dialogo>
    </section>
  );
}
