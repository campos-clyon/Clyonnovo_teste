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
import { contaDoValorAcordado, type RegimeDoProfissional } from "./pagamento-directo";

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
  /**
   * O MODELO DE 15-11-2026 (d31): o cliente pagou ao profissional, e o último
   * degrau é a taxa por receber dele (a taxa e o IVA dela), não o que se paga
   * ao profissional. Ausente no modelo antigo.
   */
  novoModelo?: true;
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
export const NOTA_DO_IVA = `vai para a ${EMPRESA_PARCEIRA}, que emite a fatura`;

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
  t: { valorFixo: number; taxa: number | null; precoAoCliente: number | null; taxaDoProfissional?: number | null },
  pago: boolean | null,
  /** Sem factura (21-10-2026): o cliente paga o valor sem IVA; o profissional recebe o mesmo. */
  semFactura = false,
): ContaDoPagamento | null {
  const contas = contasDoTrabalhoClyon(t);
  if (!contas) return null;
  const c = semFactura ? { ...contas, cliente: contas.semIva, parceira: 0 } : contas;
  const percentagem = t.taxa ?? (c.semIva > 0 ? c.clyon / c.semIva : null);
  return {
    total: c.cliente,
    iva: c.parceira,
    semIva: c.semIva,
    taxas: [{ rotulo: "Taxa da plataforma", percentagem, valor: c.clyon }],
    clyon: c.clyon,
    profissional: c.profissional,
    degraus: [
      { tipo: "inicio", rotulo: rotuloDoTotal(pago, false), valor: c.cliente, nota: semFactura ? "sem fatura, sem IVA" : "com IVA" },
      semFactura
        ? { tipo: "menos", rotulo: "IVA", valor: 0, nota: "sem fatura — o cliente paga o valor sem IVA" }
        : { tipo: "menos", rotulo: "IVA", percentagem: TAXA_IVA, valor: c.parceira, nota: NOTA_DO_IVA },
      { tipo: "igual", rotulo: "Valor sem IVA", valor: c.semIva },
      {
        tipo: "menos",
        rotulo: "Taxa da plataforma",
        percentagem,
        valor: c.clyon,
        nota:
          t.taxa == null
            ? "trabalho antigo: a diferença entre o preço ao cliente e o valor do profissional"
            : comFolhaFinal(t)
              ? "folha final: só sobre as horas e a deslocação — o material não leva taxa"
              : "Trabalho CLYON: sai do valor sem IVA",
      },
      { tipo: "igual", rotulo: "A pagar ao profissional", valor: c.profissional, final: true },
    ],
    notas: [],
  };
}

/** A negociação tem outra taxa do profissional que a do pedido — a efectiva de uma folha final (d38 v2). */
function comFolhaFinal(t: { taxa: number | null; taxaDoProfissional?: number | null }): boolean {
  return t.taxa != null && t.taxaDoProfissional != null && Math.abs(t.taxaDoProfissional - t.taxa) > 1e-6;
}

/**
 * A taxa do profissional da negociação de um Trabalho CLYON, só quando difere
 * da do pedido (a efectiva de uma folha final, d38 v2) — senão null, e a
 * conta segue a do pedido como sempre.
 */
export function taxaDoProfissionalSeDifere(taxaDoPedido: number | null, taxaDaNegociacao: unknown): number | null {
  const n = taxaDaNegociacao == null || taxaDaNegociacao === "" ? null : Number(taxaDaNegociacao);
  if (taxaDoPedido == null || n == null || !Number.isFinite(n) || n < 0 || n >= 1) return null;
  return Math.abs(n - taxaDoPedido) > 1e-6 ? n : null;
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
  /**
   * Marcada sem factura (21-10-2026): sem IVA, e as duas taxas juntas do lado
   * do profissional — que ficam juntas se voltar a ter factura (22-10-2026).
   */
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
    ? "sem fatura — o IVA não se paga; o profissional recebe o mesmo"
    : "não pagou IVA — sem fatura, numa negociação de antes de 2 de outubro";
  // Sem taxa do cliente: uma taxa só, descontada do valor — a regra geral de 22-10-2026, e as
  // marcadas sem factura (as duas juntas do lado do profissional).
  const taxasJuntas = c.taxa === 0;

  // Em dinheiro, antes do IVA incluído: só a taxa passa pela CLYON. (A do
  // profissional guardou-se a zero nestes; se não estiver, desconta-se.)
  if (n.emDinheiro && !ivaIncluido) {
    const iva = n.comFactura ? c.ivaDaTaxa : 0;
    const total = aosCentimos(c.semIva + iva);
    const taxas: TaxaDaConta[] = [{ rotulo: "Taxa da plataforma", percentagem: n.taxas.cliente, valor: c.taxa }];
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
      { tipo: "menos", rotulo: "Taxa da plataforma", percentagem: n.taxas.cliente, valor: c.taxa, nota: "paga pelo cliente, por referência" },
    ];
    if (descontoDoPro > 0) {
      taxas.push({ rotulo: "Taxa da plataforma (profissional)", percentagem: n.taxas.profissional, valor: descontoDoPro });
      degraus.push(
        { tipo: "igual", rotulo: "Valor do trabalho", valor: c.servico, nota: "o que se combinou com o profissional" },
        {
          tipo: "menos",
          rotulo: "Taxa da plataforma (profissional)",
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
  if (c.taxa > 0) taxas.push({ rotulo: "Taxa da plataforma (cliente)", percentagem: n.taxas.cliente, valor: c.taxa });
  if (descontoDoPro > 0) {
    taxas.push({
      rotulo: taxasJuntas ? "Taxa da plataforma" : "Taxa da plataforma (profissional)",
      percentagem: n.taxas.profissional,
      valor: descontoDoPro,
    });
  }

  const degraus: Degrau[] = [
    { tipo: "inicio", rotulo: rotuloDoTotal(n.pago, n.emDinheiro), valor: total, nota: comIva ? "com IVA" : n.semFactura ? "sem fatura, sem IVA" : "sem IVA" },
    comIva
      ? { tipo: "menos", rotulo: "IVA", percentagem: TAXA_IVA, valor: iva, nota: NOTA_DO_IVA }
      : { tipo: "menos", rotulo: "IVA", valor: 0, nota: semIvaAntigo },
    { tipo: "igual", rotulo: "Valor sem IVA", valor: c.semIva },
  ];
  if (c.taxa > 0) {
    degraus.push(
      { tipo: "menos", rotulo: "Taxa da plataforma (cliente)", percentagem: n.taxas.cliente, valor: c.taxa, nota: "somada ao preço do cliente" },
      { tipo: "igual", rotulo: "Valor do trabalho", valor: c.servico, nota: "o que se combinou com o profissional" },
    );
  }
  if (descontoDoPro > 0) {
    degraus.push({
      tipo: "menos",
      rotulo: taxasJuntas ? "Taxa da plataforma" : "Taxa da plataforma (profissional)",
      percentagem: n.taxas.profissional,
      valor: descontoDoPro,
      nota: taxasJuntas ? "descontada do valor do trabalho, sem IVA — o IVA não é da CLYON" : "descontada ao valor do profissional",
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
        taxaDoProfissional: taxaDoProfissionalSeDifere(numero(l.taxaClyon), l.taxaProfissional),
      },
      pago,
      eSemFactura(l),
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
        ? `Negociação de antes de 2 de outubro: o IVA só se pagava com fatura. Sem fatura, o cliente paga ${emEuros(outra.total)}.`
        : `Negociação de antes de 2 de outubro: sem fatura, sem IVA. Com fatura, o cliente paga ${emEuros(outra.total)}.`,
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
  // No modelo de 15-11 o último degrau é a taxa por receber do profissional (a taxa e o IVA dela).
  const doUltimo = conta.novoModelo ? aosCentimos(conta.iva + conta.clyon) : conta.profissional;
  if (!ultimo?.final || Math.abs(ultimo.valor - doUltimo) > 0.005) return false;
  return Math.abs(aosCentimos(conta.iva + conta.clyon + conta.profissional) - conta.total) < 0.005;
}

/**
 * UM TRABALHO DO MODELO DE 15-11 REGISTADO «PAGO AO PROFISSIONAL» — d31 (o
 * #588). A equipa anotou quanto o cliente lhe pagou; a parte da CLYON é a da
 * regra de sempre do pago em mão (`dividaDoRegistoEmMao`: a taxa, e o IVA que o
 * cliente lhe tiver pago), a mesma que a carteira dele cobra. Os degraus dizem
 * isso: o que o cliente pagou, o que fica com o profissional, e a taxa por
 * receber dele — nunca «A receber do cliente» nem «A pagar ao profissional».
 */
export function contaDoRegistoNoNovoModelo(
  d: { recebidoDoCliente: number; liquido: number; iva: number; comissao: number; total: number },
  percentagem: number | null,
  taxaPaga: boolean,
): ContaDoPagamento {
  const fica = aosCentimos(d.recebidoDoCliente - d.total);
  return {
    total: d.recebidoDoCliente,
    iva: d.iva,
    semIva: aosCentimos(d.recebidoDoCliente - d.iva),
    taxas: [{ rotulo: "Taxa da plataforma", percentagem, valor: d.comissao }],
    clyon: d.comissao,
    profissional: fica,
    novoModelo: true,
    degraus: [
      {
        tipo: "inicio",
        rotulo: "O cliente pagou ao profissional",
        valor: d.recebidoDoCliente,
        nota: "diretamente ao profissional, como ficou registado — não passou pela CLYON",
      },
      { tipo: "menos", rotulo: "Fica com o profissional", valor: fica },
      {
        tipo: "igual",
        rotulo: taxaPaga ? "Taxa recebida do parceiro" : "Taxa por receber do parceiro",
        valor: d.total,
        nota:
          d.iva > 0
            ? `${emEuros(d.comissao)} de taxa da plataforma + ${emEuros(d.iva)} de IVA`
            : `${emEuros(d.comissao)} de taxa da plataforma`,
        final: true,
      },
    ],
    notas: [],
  };
}

/** Os rótulos do modelo de 15-11 — um teste confere que o antigo não aparece. */
export const TAXA_POR_RECEBER_DO_PARCEIRO = "Taxa por receber do parceiro";
export const TAXA_RECEBIDA_DO_PARCEIRO = "Taxa recebida do parceiro";

/**
 * UM TRABALHO DO MODELO DE 15-11-2026 — d31 (CEO e dono, 15-11-2026).
 *
 * O cliente paga o trabalho DIRETAMENTE ao profissional (`novo-modelo.ts`): a
 * CLYON não recebe nada do cliente nem paga nada ao profissional. O que há a
 * receber é a fatura da taxa — a taxa da plataforma e o IVA dela — que o
 * profissional passa à CLYON. Por isso a conta nunca diz «A receber do
 * cliente» nem «A pagar ao profissional»: diz o que o cliente lhe pagou, o que
 * fica com ele (a fatura dele) e a taxa por receber.
 *
 * Os números saem de `contaDoValorAcordado` (`pagamento-directo.ts`), a mesma
 * conta da carteira e das referências. `iva` = o IVA da taxa; `profissional` =
 * a fatura do profissional (o IVA dele, se tiver, é do Estado). Nula sem valor.
 */
export function contaDoNovoModelo(
  acordado: number | null | undefined,
  taxas: Taxas,
  regime: RegimeDoProfissional,
  /** A taxa já entrou (a referência paga, ou registada à mão)? */
  taxaPaga: boolean,
  /** A reserva do valor único (d39), em cêntimos: entra na parte da CLYON. */
  reservaCent = 0,
): ContaDoPagamento | null {
  const c = contaDoValorAcordado(acordado, taxas, regime, reservaCent);
  if (!c) return null;
  const e = (v: number) => v / 100;
  const total = e(c.totalAoClienteCent);
  const doProfissional = e(c.faturaDoProfissionalCent);
  const taxa = e(c.taxaCent);
  const reserva = e(c.reservaCent);
  const parte = e(c.baseDaFaturaDaClyonCent);
  const ivaDaTaxa = e(c.ivaDaTaxaCent);
  const aPassar = e(c.aPassarAClyonCent);
  const credito = e(c.creditoAoProfissionalCent);
  const percentagem = aosCentimos((taxas.cliente + taxas.profissional) * 10000) / 10000;
  const comReserva = c.reservaCent !== 0;
  return {
    total,
    iva: ivaDaTaxa,
    semIva: aosCentimos(e(c.baseDoProfissionalCent) + parte),
    taxas: comReserva
      ? [
          { rotulo: "Taxa da plataforma", percentagem, valor: taxa },
          { rotulo: "Reserva para imprevistos", percentagem: null, valor: reserva },
        ]
      : [{ rotulo: "Taxa da plataforma", percentagem, valor: taxa }],
    clyon: parte,
    profissional: doProfissional,
    novoModelo: true,
    degraus: [
      {
        tipo: "inicio",
        rotulo: "O cliente paga ao profissional",
        valor: total,
        nota: "diretamente ao profissional — não passa pela CLYON",
      },
      {
        tipo: "menos",
        rotulo: "Fatura do profissional",
        valor: doProfissional,
        nota: regime === "isento" ? "fica com ele — isento de IVA" : "fica com ele — com o IVA dele",
      },
      {
        tipo: "igual",
        rotulo: taxaPaga ? TAXA_RECEBIDA_DO_PARCEIRO : TAXA_POR_RECEBER_DO_PARCEIRO,
        valor: aPassar,
        nota: comReserva
          ? `${emEuros(taxa)} de taxa da plataforma ${reserva >= 0 ? "+" : "−"} ${emEuros(Math.abs(reserva))} de reserva para imprevistos (valor único) + ${emEuros(ivaDaTaxa)} de IVA (${NOTA_DO_IVA}) — paga pelo profissional, por referência`
          : `${emEuros(taxa)} de taxa da plataforma + ${emEuros(ivaDaTaxa)} de IVA (${NOTA_DO_IVA}) — paga pelo profissional, por referência`,
        final: true,
      },
    ],
    notas: credito > 0
      ? [`Valor único abaixo do que o parceiro pediu: a fatura da CLYON fica a zero e a CLYON paga-lhe ${emEuros(credito)} por crédito na carteira.`]
      : [],
  };
}

/**
 * UM TRABALHO CLYON NO MODELO DE 15-11 — d54 (17-11-2026). O valor fixo é o
 * preço ao cliente sem IVA e a taxa (10, 15 ou 20 %) sai dele (`taxasDoTrabalhoClyon`):
 * o cliente paga ao profissional o valor com IVA, e o profissional passa à CLYON
 * a taxa e o IVA dela — a mesma `contaDoNovoModelo` das negociações, nunca a
 * conta antiga («IVA vai para a empresa parceira», «A pagar ao profissional»).
 *
 * Para o cartão antes de haver quem o faça (o regime ainda não se sabe: com
 * IVA). Com um profissional contratado, a conta vem do servidor
 * (`/api/admin/negociacoes/fatura`), pelo regime e pelos pagamentos dele.
 * Os antigos sem taxa não passam por aqui (nasceram antes de 15-11): nulo.
 */
export function contaDoTrabalhoClyonNoNovoModelo(
  t: { valorFixo: number; taxa: number | null; taxaDoProfissional?: number | null },
  regime: RegimeDoProfissional = "normal",
  taxaPaga = false,
): ContaDoPagamento | null {
  if (t.taxa == null || !Number.isFinite(t.valorFixo) || t.valorFixo <= 0) return null;
  return contaDoNovoModelo(t.valorFixo, { cliente: 0, profissional: t.taxaDoProfissional ?? t.taxa }, regime, taxaPaga);
}

/**
 * O QUE O PROFISSIONAL PASSA À CLYON, LIDO DA CONTA DO MODELO NOVO — d53
 * (16-11-2026). É o degrau final de `contaDoNovoModelo` (a taxa da plataforma
 * e o IVA dela, com a reserva quando a há): o mesmo número que a «Conta do
 * pagamento» mostra. Fora do modelo novo, nulo.
 */
export function aPassarAClyonDaConta(conta: ContaDoPagamento | null | undefined): number | null {
  if (!conta?.novoModelo) return null;
  const final = conta.degraus.find((d) => d.final);
  return final ? final.valor : null;
}
