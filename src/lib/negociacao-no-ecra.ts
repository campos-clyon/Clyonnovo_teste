import { negociacaoParaAApp, esperaPeloCliente } from "./pedido-para-a-app";
import { precoDoCliente, precoParaOCliente } from "./preco-do-cliente";
import { taxasDaNegociacao } from "./taxas-plataforma";
import { modeloDaLinha } from "./sem-factura";
import { historicoDaNegociacao, type EventoDaNegociacao } from "./historico-negociacao";
import { lerForma } from "./forma-de-pagamento";
import { propostaPendente, type Negociacao } from "./negociacao";
import type { BaseDoPreco } from "./base-do-preco";
import type { NegociacaoDoCliente } from "./negociacao-na-vista";

/**
 * A NEGOCIAÇÃO PARA O ECRÃ DO SITE — 28-10-2026 (d10).
 *
 * A página do link (`/pedido/<token>`) e a conta (`/conta`) recebiam a linha
 * convertida (`NegociacaoDoCliente`) e faziam as contas no browser: o valor do
 * profissional (`valorAcordado`), as propostas em bruto e a taxa do cliente
 * viajavam no HTML da página e no JSON da conta. Com os três, qualquer pessoa
 * via quanto recebe o profissional e quanto fica a plataforma.
 *
 * Agora o servidor manda o que se mostra, e só isso: os textos da app de
 * cliente (`negociacaoParaAApp` — o mesmo pedido diz o mesmo nas duas), e o
 * pouco que o ecrã do site ainda precisa em número — sempre o que o CLIENTE
 * paga, nunca o do profissional:
 *
 *   · `valores` — o preço dele (com e sem IVA), para a lista da conta, a
 *     carteira e o ponto de partida da contraproposta;
 *   · `historico` — a linha do tempo, já no preço dele;
 *   · `emDuasEntregas` — só nos trabalhos em dinheiro de antes do IVA
 *     incluído (01-10-2026), em que o cliente pagava duas partes e tinha de
 *     saber o que dava a cada lado.
 *
 * O ecrã não faz contas: mostra.
 */

const emEuros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

/** O que o cliente paga pelo que está em cima da mesa — em número, para a lista e a carteira. */
export type ValoresDoCliente = {
  /** O número grande: o que se paga (com IVA, salvo nas negociações sem ele). */
  aPagar: number;
  /** O mesmo sem IVA — nunca se mostra sozinho. */
  semIva: number;
  /** Com IVA, para quem quer fatura nas negociações de antes do IVA incluído. */
  total: number;
  ivaIncluido: boolean;
};

/** Uma linha da linha do tempo da negociação, com o valor já no preço do cliente. */
export type EventoNoEcra = EventoDaNegociacao;

export function negociacaoParaOEcra(
  n: NegociacaoDoCliente,
  base: BaseDoPreco,
  agora: Date,
  pedidoId: number | null = null,
) {
  const app = negociacaoParaAApp(n, base, agora);
  const taxas = taxasDaNegociacao(n);
  const modelo = modeloDaLinha(n, n.criadaEm);
  const contratado = n.estado === "acordada";
  const motor: Negociacao = {
    estado: n.estado as Negociacao["estado"],
    valorAcordado: n.valorAcordado,
    propostas: n.propostas,
  };
  const pendente = contratado ? null : propostaPendente(motor, agora);
  const emCima = pendente?.valor ?? n.valorAcordado;
  const conta = emCima != null ? precoDoCliente(emCima, taxas, modelo) : null;
  const emDinheiro = lerForma(n.formaDePagamento) === "dinheiro";

  const historico: EventoNoEcra[] = historicoDaNegociacao(
    n.propostas,
    {
      execucaoEnviadaEm: n.execucaoEnviadaEm ?? null,
      confirmadoEm: n.confirmadoEm ?? null,
      // Sem `pagoEm`: a transferência ao profissional não diz respeito ao cliente.
      avaliadoEm: n.avaliadoEm ?? null,
      provaJson: n.provaJson ?? null,
      estrelas: n.estrelas ?? null,
      valorAcordado: n.valorAcordado,
    },
    "cliente",
  ).map((e) => ({ ...e, valor: e.valor != null ? precoParaOCliente(e.valor, taxas, modelo) : null }));

  return {
    ...app,
    pedidoId,
    /** O perfil público veio com a negociação (a página do link carrega-o; a conta não). */
    temPerfil: n.perfil != null,
    /** Como paga — decide as frases do pagamento (`PagarTrabalho`). Não é dinheiro. */
    formaDePagamento: n.formaDePagamento ?? null,
    emDinheiro,
    porCarga: n.porCarga === true,
    /** Uma proposta (ou o «aceito» por contratar) à espera da resposta dele. */
    esperaPorSi: esperaPeloCliente(n, agora),
    valores:
      conta != null
        ? ({
            aPagar: conta.aPagar,
            semIva: conta.semIva,
            total: conta.total,
            ivaIncluido: conta.ivaIncluido,
          } satisfies ValoresDoCliente)
        : null,
    /*
     * EM DINHEIRO ANTES DO IVA INCLUÍDO SÃO DUAS ENTREGAS — 21-09-2026. O
     * cliente dava o serviço ao profissional e pagava a parte da CLYON por
     * referência: tinha de saber quanto ia a cada lado. Desde 01-10-2026 paga
     * tudo ao profissional, e isto é nulo.
     */
    emDuasEntregas:
      contratado && conta != null && !conta.ivaIncluido && emDinheiro
        ? { aoProfissional: emEuros(conta.servico), aCLYON: emEuros(conta.taxa) }
        : null,
    historico,
  };
}

export type NegociacaoNoEcra = ReturnType<typeof negociacaoParaOEcra>;
