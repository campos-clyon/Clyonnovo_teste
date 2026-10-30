/**
 * A CARTEIRA TRABALHO A TRABALHO — 30-10-2026 (ordem do CEO e do dono).
 *
 * *«O certo era aparecer os valores separados: o valor que falta receber, o
 * valor que já recebeu, quais foram os trabalhos, tudo detalhado.»* — dono.
 *
 * A carteira (`carteiraDe`) dava cestos — cativo, disponível, levantado — e
 * nenhum dizia QUE trabalhos estavam em cada um. Os levantamentos não dizem
 * que trabalhos pagaram, por isso a ligação faz-se aqui, pela ordem: os
 * trabalhos libertados mais antigos são os primeiros a ser pagos pelas
 * transferências mais antigas (e pelo saldo abatido em dívidas). O que sobra
 * de cada trabalho é o que falta receber.
 *
 * A REGRA QUE O TESTE GUARDA: a soma do que falta nos trabalhos «por receber»
 * é o disponível + o que vai a caminho de `carteiraDe`. Uma só conta, dois
 * desenhos dela — painel, app Pro e backoffice lêem ESTA.
 *
 * Pura: sem base, sem relógio próprio (o `agora` vem de fora).
 */
import {
  carteiraDe,
  foiPagoEmMao,
  oClientePagou,
  type Levantamento,
  type TrabalhoNaCarteira,
} from "./carteira";
import { estaLibertado, faseDoTrabalho, quandoLiberta } from "./trabalho";
import { quantoOProfissionalRecebe, taxasDaNegociacao } from "./taxas-plataforma";
import { pecasEmLisboa } from "./hora-de-lisboa";

export type TrabalhoParaALista = TrabalhoNaCarteira & {
  pedidoId?: number | null;
  servico?: string | null;
  /** Só o primeiro nome: é o que a retenção guarda (d32 v2). */
  cliente?: string | null;
};

export type LevantamentoComData = Levantamento & {
  processadoEm?: Date | string | null;
  criadoEm?: Date | string | null;
};

export type GrupoDaLinha = "por_receber" | "retido" | "recebido";

export type LinhaDaCarteira = {
  negociacaoId: number;
  pedidoId: number | null;
  servico: string | null;
  cliente: string | null;
  /** O dia em que o trabalho foi feito (ou confirmado), em ISO. */
  diaDoTrabalho: string | null;
  /** O valor do trabalho sem IVA, o que ele combinou. */
  valor: number;
  /** A taxa da plataforma descontada. */
  taxa: number;
  /** O que ele recebe por este trabalho. */
  recebe: number;
  grupo: GrupoDaLinha;
  /** Em palavras, para o profissional. */
  razao: string;
  /** Os dois dias já escritos em Lisboa (dd/mm/aaaa). */
  diaDoTrabalhoTexto: string | null;
  recebidoEmTexto: string | null;
  /** O que ainda falta receber deste trabalho (0 nos recebidos). */
  falta: number;
  /** Quando lhe foi pago (ISO), nos recebidos. */
  recebidoEm: string | null;
  /** Como lhe foi pago, nos recebidos. */
  como: string | null;
};

export type ResumoDaCarteira = {
  /** Trabalho feito e confirmado que a CLYON ainda lhe vai pagar (inclui o que vai a caminho). */
  porReceber: number;
  /** Desse, já pedido e a ser transferido. */
  aCaminho: number;
  /** Desse, o que pode pedir já. */
  podePedir: number;
  /** Pago pelo cliente à CLYON, à espera da confirmação (ou de o trabalho ser feito). */
  aEsperaDaConfirmacao: number;
  /** Trabalho feito que o cliente ainda não pagou. */
  clienteAindaNaoPagou: number;
  /** Já transferido pela CLYON. */
  recebidoEsteMes: number;
  recebidoUltimos12Meses: number;
  recebidoTotal: number;
  /** Pago em dinheiro, no local — está com ele. */
  recebidoEmMao: number;
};

const c = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function iso(v: Date | string | null | undefined): string | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function mesDeLisboa(d: Date): string {
  const p = pecasEmLisboa(d);
  return `${p.ano}-${p.mes}`;
}

export const COMO_FOI_PAGO = {
  transferencia: "transferência",
  umAUm: "transferência (paga pela CLYON)",
  emMao: "em dinheiro, no local",
  abatido: "abatido no que devia à CLYON",
} as const;

export const RAZOES = {
  podePedir: "confirmado — pode pedir a transferência",
  aCaminho: "transferência pedida, a ser feita",
  confirmacao: "à espera da confirmação do cliente",
  porFazer: "o cliente já pagou; o trabalho está por fazer",
  clienteNaoPagou: "o cliente ainda não pagou",
} as const;

export function contaDaCarteira(
  trabalhos: TrabalhoParaALista[],
  levantamentos: LevantamentoComData[],
  agora: Date,
): { linhas: LinhaDaCarteira[]; resumo: ResumoDaCarteira } {
  const cart = carteiraDe(trabalhos, levantamentos, agora);
  const linhas: Array<Omit<LinhaDaCarteira, "diaDoTrabalhoTexto" | "recebidoEmTexto">> = [];
  const recebidos: Array<{ valor: number; em: string | null }> = [];

  const base = (t: TrabalhoParaALista) => {
    const valor = t.valorAcordado != null && Number.isFinite(t.valorAcordado) ? t.valorAcordado : 0;
    const recebe = quantoOProfissionalRecebe(valor, taxasDaNegociacao(t));
    return {
      negociacaoId: t.negociacaoId,
      pedidoId: t.pedidoId ?? null,
      servico: t.servico ?? null,
      cliente: t.cliente ?? null,
      diaDoTrabalho: iso(t.execucaoEnviadaEm) ?? iso(t.confirmadoEm) ?? iso(t.pagoEm),
      valor: c(valor),
      taxa: c(valor - recebe),
      recebe,
    };
  };

  // Os libertados que esperam por uma transferência, do mais antigo ao mais novo.
  const aPagar: Array<{ t: TrabalhoParaALista; b: ReturnType<typeof base>; quando: number }> = [];

  for (const t of trabalhos) {
    if (faseDoTrabalho(t) === "a_negociar") continue;
    const b = base(t);
    if (foiPagoEmMao(t)) {
      if (estaLibertado(t, agora)) {
        linhas.push({ ...b, grupo: "recebido", razao: "pago pelo cliente no local", falta: 0, recebidoEm: b.diaDoTrabalho, como: COMO_FOI_PAGO.emMao });
      }
      continue;
    }
    if (!oClientePagou(t)) {
      linhas.push({ ...b, grupo: "retido", razao: RAZOES.clienteNaoPagou, falta: b.recebe, recebidoEm: null, como: null });
      continue;
    }
    if (!estaLibertado(t, agora)) {
      const feito = t.execucaoEnviadaEm != null;
      linhas.push({ ...b, grupo: "retido", razao: feito ? RAZOES.confirmacao : RAZOES.porFazer, falta: b.recebe, recebidoEm: null, como: null });
      continue;
    }
    if (faseDoTrabalho(t) === "pago") {
      const em = iso(t.pagoEm);
      linhas.push({ ...b, grupo: "recebido", razao: "pago", falta: 0, recebidoEm: em, como: COMO_FOI_PAGO.umAUm });
      recebidos.push({ valor: b.recebe, em });
      continue;
    }
    aPagar.push({ t, b, quando: quandoLiberta(t)?.getTime() ?? 0 });
  }
  aPagar.sort((x, y) => x.quando - y.quando || x.t.negociacaoId - y.t.negociacaoId);

  // O que já saiu (transferências pagas e saldo abatido), pela ordem em que saiu.
  const saidas: Array<{ valor: number; em: string | null; como: string; conta: boolean }> = [
    ...levantamentos
      .filter((l) => l.estado === "pago")
      .map((l) => ({ valor: l.valor, em: iso(l.processadoEm) ?? iso(l.criadoEm), como: `${COMO_FOI_PAGO.transferencia} #${l.id}`, conta: true })),
    ...trabalhos
      .filter((t) => (t.dividaAbatida?.valor ?? 0) > 0)
      .map((t) => ({ valor: t.dividaAbatida!.valor, em: iso(t.dividaAbatida!.em), como: COMO_FOI_PAGO.abatido, conta: false })),
  ].sort((a, b) => (a.em ?? "").localeCompare(b.em ?? ""));
  for (const s of saidas) if (s.conta) recebidos.push({ valor: s.valor, em: s.em });
  const aCaminho = levantamentos.filter((l) => l.estado === "pedido").reduce((s, l) => s + l.valor, 0);

  let i = 0;
  let resto = saidas[0]?.valor ?? 0;
  let caminho = aCaminho;
  for (const { b } of aPagar) {
    let falta = b.recebe;
    let ultima: (typeof saidas)[number] | null = null;
    while (falta > 0.004 && i < saidas.length) {
      const tira = Math.min(falta, resto);
      falta = c(falta - tira);
      resto = c(resto - tira);
      ultima = saidas[i];
      if (resto <= 0.004) {
        i += 1;
        resto = saidas[i]?.valor ?? 0;
      }
    }
    if (falta <= 0.004) {
      linhas.push({ ...b, grupo: "recebido", razao: "pago", falta: 0, recebidoEm: ultima?.em ?? null, como: ultima?.como ?? COMO_FOI_PAGO.transferencia });
      continue;
    }
    const parte = falta < b.recebe ? " (parte já transferida)" : "";
    const emCaminho = Math.min(falta, caminho);
    caminho = c(caminho - emCaminho);
    linhas.push({
      ...b,
      grupo: "por_receber",
      razao: (emCaminho >= falta - 0.004 ? RAZOES.aCaminho : RAZOES.podePedir) + parte,
      falta,
      recebidoEm: null,
      como: null,
    });
  }

  linhas.sort((a, b) => (b.pedidoId ?? 0) - (a.pedidoId ?? 0) || b.negociacaoId - a.negociacaoId);

  const esteMes = mesDeLisboa(agora);
  const haUmAno = agora.getTime() - 365 * 86_400_000;
  let mes = 0;
  let ano = 0;
  let total = 0;
  for (const r of recebidos) {
    total += r.valor;
    const d = r.em ? new Date(r.em) : null;
    if (d && d.getTime() >= haUmAno) ano += r.valor;
    if (d && mesDeLisboa(d) === esteMes) mes += r.valor;
  }

  const porCobrar = cart.porCobrar;
  return {
    linhas: linhas.map((l) => ({ ...l, diaDoTrabalhoTexto: diaDe(l.diaDoTrabalho), recebidoEmTexto: diaDe(l.recebidoEm) })),
    resumo: {
      porReceber: c(cart.disponivel + cart.aCaminho),
      aCaminho: cart.aCaminho,
      podePedir: cart.disponivel,
      aEsperaDaConfirmacao: cart.cativo,
      clienteAindaNaoPagou: porCobrar,
      recebidoEsteMes: c(mes),
      recebidoUltimos12Meses: c(ano),
      recebidoTotal: c(total),
      recebidoEmMao: cart.recebidoEmMao,
    },
  };
}

function diaDe(v: string | null): string | null {
  if (!v) return null;
  const p = pecasEmLisboa(new Date(v));
  const d = (n: number) => String(n).padStart(2, "0");
  return `${d(p.dia)}/${d(p.mes)}/${p.ano}`;
}
