/**
 * PREÇOS COM IVA INCLUÍDO — a data a partir da qual, e a pergunta «este
 * trabalho é de antes ou de depois?». 01-10-2026.
 *
 * "Preços com IVA incluído: o cliente vê um número só por proposta, já com a
 *  taxa da CLYON e com 23 % de IVA." — decisão do dono, 01-10-2026.
 *
 * O profissional propõe 350 € (sem IVA, como sempre); o cliente vê 452,03 €
 * (350 × 1,05 = 367,50; × 1,23 = 452,03); o profissional recebe 327,08 €; a
 * CLYON fica com a quota dela sobre a base sem IVA; os 23 % são imposto. Há
 * factura em TODAS as vendas — emitida pela Miragem Dourada, regime normal —,
 * e a pergunta «precisa de factura?» deixa de mudar o preço.
 *
 * ⚠️ NINGUÉM PODE VER UM PREÇO MUDAR A MEIO. Uma negociação aberta antes da
 * data de corte fica no modelo antigo até ao fim — preço sem IVA, e o IVA só a
 * quem pedir factura. É o mesmo padrão de `VERIFICAR_PAGAMENTO_DESDE` em
 * `carteira.ts`: o marco é a abertura da negociação (`negociacoes.createdAt`),
 * que é fixa desde o primeiro dia — um trabalho nunca muda de regime a meio.
 * (Reabrir uma negociação — `criarNegociacao` com `reabrir` — renova-lhe a data,
 * porque reabrir é nascer outra vez: propostas, taxas e forma de pagamento.)
 *
 * Sem dependências de servidor: os ecrãs do cliente importam isto.
 */

/**
 * A ENTRADA EM VIGOR. É AQUI QUE SE MUDA A DATA, e só aqui.
 *
 * Meia-noite de Lisboa de 2 de outubro de 2026 (UTC+1 no Verão). O
 * `createdAt` é escrito pelo relógio do MySQL, em UTC no Railway, e lido como
 * UTC pela Vercel — a mesma conta de `VERIFICAR_PAGAMENTO_DESDE`.
 *
 * Os Termos dizem esta data por extenso (`IVA_INCLUIDO_DESDE_POR_EXTENSO`), e
 * um teste garante que as duas não se desencontram.
 */
export const IVA_INCLUIDO_DESDE = new Date("2026-10-02T00:00:00+01:00");

/** Como os Termos e a ajuda a dizem. Muda com a data de cima. */
export const IVA_INCLUIDO_DESDE_POR_EXTENSO = "2 de outubro de 2026";

/**
 * Os dois modelos.
 *
 *   · `iva_incluido` — o de agora: o preço dito ao cliente já leva os 23 %.
 *   · `sem_iva` — o de antes do corte: o preço dito é sem IVA, e o imposto
 *     acresce a quem pedir factura.
 *
 * Um texto e não um booleano: `precoParaOCliente(v, t, true)` não diz nada a
 * quem o lê; `precoParaOCliente(v, t, "iva_incluido")` diz.
 */
export type ModeloDoPreco = "iva_incluido" | "sem_iva";

function comoData(v: Date | string | null | undefined): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * O MODELO DE UMA NEGOCIAÇÃO QUE EXISTE — pela data em que ela abriu.
 *
 * Recebe o `createdAt` de propósito, e não a linha: quem chama tem de o
 * escrever, e uma consulta que não o traga vê-se na chamada.
 *
 * SEM DATA, O MODELO ANTIGO. Uma linha de `negociacoes` tem sempre `createdAt`
 * (é NOT NULL); faltar é um SELECT que não o pediu. Do lado antigo ninguém
 * paga mais do que lhe foi dito — o erro, se houver, é a CLYON a não cobrar o
 * IVA, e não um cliente a ver um preço subir.
 */
export function modeloDaNegociacao(criadaEm: Date | string | null | undefined): ModeloDoPreco {
  const d = comoData(criadaEm);
  return d != null && d.getTime() >= IVA_INCLUIDO_DESDE.getTime() ? "iva_incluido" : "sem_iva";
}

/**
 * O MODELO DE UMA CONVERSA QUE AINDA NÃO TEM NEGOCIAÇÃO — um pedido a ser
 * preenchido, um orçamento, uma simulação. Vale o de hoje: a negociação que
 * dali nascer nasce agora.
 */
export function modeloDeHoje(agora: Date = new Date()): ModeloDoPreco {
  return modeloDaNegociacao(agora);
}

export function temIvaIncluido(m: ModeloDoPreco): boolean {
  return m === "iva_incluido";
}

/** A etiqueta que vai ao lado do número, num ecrã. */
export function etiquetaDoPreco(m: ModeloDoPreco): string {
  return m === "iva_incluido" ? "IVA incluído" : "sem IVA";
}
