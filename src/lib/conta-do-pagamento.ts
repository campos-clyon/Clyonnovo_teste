import { contasDoTrabalhoClyon, EMPRESA_PARCEIRA } from "./contas-do-trabalho-clyon";
import {
  contaDoCliente,
  quantoOProfissionalRecebe,
  taxasDaNegociacao,
  TAXA_IVA,
  type Taxas,
} from "./taxas-plataforma";
import type { ModeloDoPreco } from "./iva-incluido";
import { dividaDoProfissional } from "./divida-do-profissional";
import { lerForma } from "./forma-de-pagamento";
import { eSemFactura, modeloDaLinha, paraQueDaLinha } from "./sem-factura";

/**
 * A CONTA DE UM PAGAMENTO, DEGRAU A DEGRAU — 15-10-2026.
 *
 * *«Seja didático: que ele mostre o valor que o cliente pagou, se ele pagou o
 * IVA e quanto foi do IVA, depois qual foi a taxa usada e qual é o valor da
 * taxa usada. Assim mostra quanto a gente recebeu no total, quanto foi de IVA,
 * quanto foi de taxa e quanto a gente tem que pagar ao profissional, de
 * maneira detalhada. Todos os pedidos têm que mostrar isso — nos Trabalhos
 * CLYON, nos trabalhos em geral, nos pagamentos e na carteira.»*
 *
 * Uma forma só para todos os ecrãs: o total do cliente, menos o IVA (se ele o
 * pagou), igual ao sem IVA, menos cada taxa com a sua percentagem, igual ao
 * que se paga ao profissional. Os números saem das MESMAS funções que já
 * decidem o dinheiro (`contaDoCliente`, `quantoOProfissionalRecebe`,
 * `dividaDoProfissional`, `contasDoTrabalhoClyon`): isto explica-os, não os
 * volta a inventar. Desenha-se com `ContaDoPagamento.tsx`.
 *
 * REGRA: os degraus fecham sempre ao cêntimo — o total menos tudo o que se
 * tira dá o que fica para o profissional, e IVA + CLYON + profissional dá o
 * total. Os testes verificam-no em todos os regimes (`contaFecha`).
 */

export type Degrau = {
  /** «inicio» é o total; «menos» tira-se; «igual» é o resultado até ali. */
  tipo: "inicio" | "menos" | "igual";
  rotulo: string;
  valor: number;
  /** 0,23 → «23 %». Só nos que são uma percentagem de alguma coisa. */
  percentagem?: number | null;
  /** Uma explicação curta por baixo do rótulo. */
  nota?: string | null;
  /** O último degrau: o que vai para o profissional. */
  final?: boolean;
};

export type TaxaDaConta = { rotulo: string; percentagem: number | null; valor: number };

export type ContaDoPagamento = {
  /** O que o cliente paga — com IVA, quando o paga. */
  total: number;
  /** O IVA que o cliente pagou; 0 quando não pagou IVA. */
  iva: number;
  /** O total sem o IVA. */
  semIva: number;
  /** As taxas da CLYON, pela ordem em que saem da conta. */
  taxas: TaxaDaConta[];
  /** O que fica para a CLYON: a soma das taxas, sem IVA. */
  clyon: number;
  /** O que fica para o profissional. */
  profissional: number;
  degraus: Degrau[];
  /** O que a conta não diz sozinha — num trabalho em dinheiro, quem deve o quê. */
  notas: string[];
};

export const aosCentimos = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** 130 → «130,00 €»; −10 → «−10,00 €» — como no resto do backoffice. */
export function emEuros(v: number): string {
  return `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(2).replace(".", ",")} €`;
}

/** 0,2 → «20 %»; 0,05 → «5 %»; 0,0655 → «6,55 %»; 0,0842… → «8,42 %». */
export function emPercentagem(p: number): string {
  const n = Math.round(p * 10000) / 100;
  return `${String(n).replace(".", ",")} %`;
}

/** A nota do IVA: quem o recebe, e porquê. */
export const NOTA_DO_IVA = `vai para a ${EMPRESA_PARCEIRA}, que emite a factura`;

/** O primeiro degrau diz se o dinheiro já entrou: sim, não, ou não se sabe. */
function rotuloDoTotal(pago: boolean | null, emMao: boolean): string {
  if (emMao) {
    return pago === true
      ? "Pago pelo cliente ao profissional, em mão"
      : pago === false
        ? "A pagar pelo cliente ao profissional, em mão"
        : "O cliente paga ao profissional, em mão";
  }
  return pago === true ? "Recebido do cliente" : pago === false ? "A receber do cliente" : "O cliente paga";
}

/**
 * UM TRABALHO CLYON — o valor é o preço ao cliente sem IVA, e a taxa (10, 15
 * ou 20 %) sai dele; nos antigos (sem taxa) o valor era o do profissional e o
 * preço ao cliente escreveu-se à parte, e a percentagem calcula-se. Sem o
 * preço ao cliente não há conta (`null`) — não se inventa.
 */
export function contaDoTrabalhoClyon(
  t: { valorFixo: number; taxa: number | null; precoAoCliente: number | null },
  pago: boolean | null,
): ContaDoPagamento | null {
  const c = contasDoTrabalhoClyon(t);
  if (!c) return null;
  const percentagem = t.taxa ?? (c.semIva > 0 ? c.clyon / c.semIva : null);
  return {
    total: c.cliente,
    iva: c.parceira,
    semIva: c.semIva,
    taxas: [{ rotulo: "Taxa da CLYON", percentagem, valor: c.clyon }],
    clyon: c.clyon,
    profissional: c.profissional,
    degraus: [
      { tipo: "inicio", rotulo: rotuloDoTotal(pago, false), valor: c.cliente, nota: "com IVA" },
      { tipo: "menos", rotulo: "IVA", percentagem: TAXA_IVA, valor: c.parceira, nota: NOTA_DO_IVA },
      { tipo: "igual", rotulo: "Valor sem IVA", valor: c.semIva },
      {
        tipo: "menos",
        rotulo: "Taxa da CLYON",
        percentagem,
        valor: c.clyon,
        nota:
          t.taxa == null
            ? "trabalho antigo: a diferença entre o preço ao cliente e o valor do profissional"
            : "Trabalho CLYON: sai do valor sem IVA",
      },
      { tipo: "igual", rotulo: "A pagar ao profissional", valor: c.profissional, final: true },
    ],
    notas: [],
  };
}

export type EntradaDaNegociacao = {
  /** O valor combinado com o profissional, sem taxas nem IVA. */
  acordado: number;
  /** As taxas desta negociação (`taxasDaNegociacao`). */
  taxas: Taxas;
  /** IVA incluído (desde 02-10-2026) ou sem IVA (antes). */
  modelo: ModeloDoPreco;
  /** Pago em dinheiro, ao profissional, no local. */
  emDinheiro: boolean;
  /**
   * Só conta nas negociações de antes do IVA incluído: aí o IVA só se pagava
   * com factura. Quem chama diz o que o seu ecrã já assume.
   */
  comFactura: boolean;
  /** O cliente já pagou? `null` quando o ecrã não sabe. */
  pago: boolean | null;
  /** Marcada sem factura (21-10-2026): as taxas já vêm juntas do lado do profissional. */
  semFactura?: boolean;
};

/**
 * UM TRABALHO DO SITE — o profissional propõe o valor do trabalho; a CLYON
 * soma a taxa do cliente e desconta a do profissional; o IVA vai por cima.
 *
 * Pela plataforma: o cliente paga à CLYON e a CLYON paga ao profissional.
 * Em dinheiro, com IVA incluído: o cliente paga tudo ao profissional, em mão,
 * e ele deve à CLYON o IVA e as taxas (`dividaDoProfissional`). Em dinheiro,
 * antes do IVA incluído: o profissional ficava com o trabalho todo em mão, e
 * o cliente pagava a taxa à CLYON por referência (as taxas guardaram-se como
 * {cliente: c + p, profissional: 0} — ver `taxasParaAForma`).
 */
export function contaDaNegociacao(n: EntradaDaNegociacao): ContaDoPagamento {
  const c = contaDoCliente(n.acordado, n.taxas);
  const recebe = quantoOProfissionalRecebe(n.acordado, n.taxas);
  const descontoDoPro = aosCentimos(c.servico - recebe);
  const ivaIncluido = n.modelo === "iva_incluido";
  const semIvaAntigo = n.semFactura
    ? "sem factura — o cliente paga o valor do trabalho"
    : "não pagou IVA — sem factura, numa negociação de antes de 2 de outubro";

  // Em dinheiro, antes do IVA incluído: só a taxa passa pela CLYON. (A do
  // profissional guardou-se a zero nestes; se não estiver, desconta-se.)
  if (n.emDinheiro && !ivaIncluido) {
    const iva = n.comFactura ? c.ivaDaTaxa : 0;
    const total = aosCentimos(c.semIva + iva);
    const taxas: TaxaDaConta[] = [{ rotulo: "Taxa da CLYON", percentagem: n.taxas.cliente, valor: c.taxa }];
    const degraus: Degrau[] = [
      {
        tipo: "inicio",
        rotulo: n.pago === true ? "Pago pelo cliente" : n.pago === false ? "A pagar pelo cliente" : "O cliente paga",
        valor: total,
        nota: `${emEuros(c.servico)} em mão ao profissional + ${emEuros(aosCentimos(c.taxa + iva))} à CLYON, por referência`,
      },
      n.comFactura
        ? { tipo: "menos", rotulo: "IVA", percentagem: TAXA_IVA, valor: iva, nota: "só sobre a taxa — o trabalho foi pago em mão" }
        : { tipo: "menos", rotulo: "IVA", valor: 0, nota: semIvaAntigo },
      { tipo: "igual", rotulo: "Valor sem IVA", valor: c.semIva },
      { tipo: "menos", rotulo: "Taxa da CLYON", percentagem: n.taxas.cliente, valor: c.taxa, nota: "paga pelo cliente, por referência" },
    ];
    if (descontoDoPro > 0) {
      taxas.push({ rotulo: "Taxa da CLYON (profissional)", percentagem: n.taxas.profissional, valor: descontoDoPro });
      degraus.push(
        { tipo: "igual", rotulo: "Valor do trabalho", valor: c.servico, nota: "o que se combinou com o profissional" },
        {
          tipo: "menos",
          rotulo: "Taxa da CLYON (profissional)",
          percentagem: n.taxas.profissional,
          valor: descontoDoPro,
          nota: "descontada ao valor do profissional",
        },
      );
    }
    degraus.push({ tipo: "igual", rotulo: "Fica com o profissional, em mão", valor: recebe, final: true });
    return {
      total,
      iva,
      semIva: c.semIva,
      taxas,
      clyon: aosCentimos(c.taxa + descontoDoPro),
      profissional: recebe,
      degraus,
      notas: [],
    };
  }

  const comIva = ivaIncluido || n.comFactura;
  const iva = comIva ? c.iva : 0;
  const total = comIva ? c.total : c.semIva;
  const taxas: TaxaDaConta[] = [];
  if (c.taxa > 0) taxas.push({ rotulo: "Taxa da CLYON (cliente)", percentagem: n.taxas.cliente, valor: c.taxa });
  if (descontoDoPro > 0) {
    taxas.push({
      rotulo: n.semFactura ? "Taxas da CLYON (sem factura)" : "Taxa da CLYON (profissional)",
      percentagem: n.taxas.profissional,
      valor: descontoDoPro,
    });
  }

  const degraus: Degrau[] = [
    { tipo: "inicio", rotulo: rotuloDoTotal(n.pago, n.emDinheiro), valor: total, nota: comIva ? "com IVA" : n.semFactura ? "sem factura, sem IVA" : "sem IVA" },
    comIva
      ? { tipo: "menos", rotulo: "IVA", percentagem: TAXA_IVA, valor: iva, nota: NOTA_DO_IVA }
      : { tipo: "menos", rotulo: "IVA", valor: 0, nota: semIvaAntigo },
    { tipo: "igual", rotulo: "Valor sem IVA", valor: c.semIva },
  ];
  if (c.taxa > 0) {
    degraus.push(
      { tipo: "menos", rotulo: "Taxa da CLYON (cliente)", percentagem: n.taxas.cliente, valor: c.taxa, nota: "somada ao preço do cliente" },
      { tipo: "igual", rotulo: "Valor do trabalho", valor: c.servico, nota: "o que se combinou com o profissional" },
    );
  }
  if (descontoDoPro > 0) {
    degraus.push({
      tipo: "menos",
      rotulo: n.semFactura ? "Taxas da CLYON" : "Taxa da CLYON (profissional)",
      percentagem: n.taxas.profissional,
      valor: descontoDoPro,
      nota: n.semFactura ? "a do cliente e a do profissional juntas, descontadas do que o cliente pagou" : "descontada ao valor do profissional",
    });
  }
  degraus.push({
    tipo: "igual",
    rotulo: n.emDinheiro ? "Fica com o profissional" : "A pagar ao profissional",
    valor: recebe,
    final: true,
  });

  const notas: string[] = [];
  if (n.emDinheiro) {
    const d = dividaDoProfissional(n.acordado, n.taxas);
    notas.push(
      `Em dinheiro: o cliente paga ${emEuros(d.recebidoDoCliente)} ao profissional, em mão. Ele fica com ${emEuros(d.liquido)} e deve à CLYON ${emEuros(d.total)} — ${emEuros(d.iva)} de IVA e ${emEuros(d.comissao)} de taxas.`,
    );
  }

  return {
    total,
    iva,
    semIva: c.semIva,
    taxas,
    clyon: aosCentimos(c.taxa + descontoDoPro),
    profissional: recebe,
    degraus,
    notas,
  };
}

/** Uma negociação acordada, como as rotas a lêem da base. */
export type LinhaDaNegociacao = {
  /** Marcada sem factura (21-10-2026) — ver `sem-factura.ts`. */
  semFactura?: unknown;
  valorAcordado?: unknown;
  taxaCliente?: unknown;
  taxaProfissional?: unknown;
  formaDePagamento?: unknown;
  /** `negociacoes.createdAt` — decide o IVA incluído. */
  negociacaoCriadaEm?: unknown;
  pagamentoParaQue?: unknown;
  /** Preenchido num Trabalho CLYON. */
  ofertaClyon?: unknown;
  valorFixoClyon?: unknown;
  taxaClyon?: unknown;
  precoClienteClyon?: unknown;
};

const numero = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function eTrabalhoClyon(l: { ofertaClyon?: unknown }): boolean {
  return typeof l.ofertaClyon === "string" && l.ofertaClyon !== "";
}

/**
 * A conta de uma negociação lida da base — um Trabalho CLYON ou um do site.
 *
 * `semFacturaPorOmissao`: nas negociações de antes do IVA incluído sem a
 * declaração «para que foi o pagamento», cada ecrã já assumia uma coisa — os
 * Pagamentos assumem com factura (`valorDoPagamento`), as Carteiras sem
 * (`aPagar`). Quem chama diz qual, para a conta dizer o mesmo número que o
 * resto do cartão.
 */
export function contaDaLinha(
  l: LinhaDaNegociacao,
  pago: boolean | null,
  semFacturaPorOmissao = false,
): ContaDoPagamento | null {
  const acordado = numero(l.valorAcordado);
  if (acordado == null) return null;
  if (eTrabalhoClyon(l)) {
    return contaDoTrabalhoClyon(
      {
        valorFixo: numero(l.valorFixoClyon) ?? acordado,
        taxa: numero(l.taxaClyon),
        precoAoCliente: numero(l.precoClienteClyon),
      },
      pago,
    );
  }
  // Marcada sem factura (21-10-2026): sem IVA, seja de quando for — ver `sem-factura.ts`.
  const paraQue = paraQueDaLinha(l);
  const entrada: EntradaDaNegociacao = {
    acordado,
    taxas: taxasDaNegociacao(l),
    modelo: modeloDaLinha(l, l.negociacaoCriadaEm as Date | string | null),
    emDinheiro: lerForma(l.formaDePagamento) === "dinheiro",
    comFactura: paraQue ? paraQue === "com_factura" : !semFacturaPorOmissao,
    pago,
    semFactura: eSemFactura(l),
  };
  const conta = contaDaNegociacao(entrada);
  // Antes de 2 de outubro, sem declaração, a factura é uma suposição: diz-se a outra hipótese.
  if (entrada.modelo === "sem_iva" && !paraQue) {
    const outra = contaDaNegociacao({ ...entrada, comFactura: !entrada.comFactura });
    conta.notas.push(
      entrada.comFactura
        ? `Negociação de antes de 2 de outubro: o IVA só se pagava com factura. Sem factura, o cliente paga ${emEuros(outra.total)}.`
        : `Negociação de antes de 2 de outubro: sem factura, sem IVA. Com factura, o cliente paga ${emEuros(outra.total)}.`,
    );
  }
  return conta;
}

/** A conta fecha: o total menos tudo o que se tira dá o último degrau, e as partes dão o total. */
export function contaFecha(conta: ContaDoPagamento): boolean {
  let corrente = 0;
  for (const d of conta.degraus) {
    if (d.tipo === "inicio") corrente = d.valor;
    else if (d.tipo === "menos") corrente = aosCentimos(corrente - d.valor);
    else if (Math.abs(corrente - d.valor) > 0.005) return false;
  }
  const ultimo = conta.degraus[conta.degraus.length - 1];
  if (!ultimo?.final || Math.abs(ultimo.valor - conta.profissional) > 0.005) return false;
  return Math.abs(aosCentimos(conta.iva + conta.clyon + conta.profissional) - conta.total) < 0.005;
}
