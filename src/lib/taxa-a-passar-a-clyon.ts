import type { Taxas } from "./taxas-plataforma";
import type { DividaDoProfissional } from "./divida-do-profissional";
import { contaDoValorAcordado } from "./pagamento-directo";
import { NOVO_MODELO_DESDE, eDoNovoModelo } from "./novo-modelo";
import { DIAS_ATE_LIBERTAR_SOZINHO } from "./trabalho";

/**
 * O QUE O PARCEIRO PASSA À CLYON NUM TRABALHO DO MODELO NOVO — d10, desde
 * 15-11-2026.
 *
 * É a fatura da taxa da plataforma: a taxa e o IVA dela (`faturaDaClyonCent` de
 * `pagamento-directo.ts`). Não depende do regime do parceiro. Devolve-se na forma
 * de sempre do valor do profissional (`DividaDoProfissional`), para a carteira,
 * as referências do euPago, as partes de `cobrancasAoProfissional` (IVA = o IVA
 * da taxa; taxa = a taxa) e o webhook o tratarem como já tratam o do dinheiro —
 * a mesma casa, um número diferente.
 *
 * O regime só entra no que o cliente paga (`recebidoDoCliente`); quando não se
 * sabe, conta como com IVA (`perfil-fiscal.ts`).
 */
export function taxaAPassarAClyon(
  acordado: number,
  taxas: Taxas,
  regime: "normal" | "isento" = "normal",
  /** A reserva do valor único (d39), em cêntimos: entra na parte da CLYON. */
  reservaCent = 0,
): DividaDoProfissional | null {
  const c = contaDoValorAcordado(acordado, taxas, regime, reservaCent);
  if (!c) return null;
  return {
    recebidoDoCliente: c.totalAoClienteCent / 100,
    liquido: c.ficaAoProfissionalCent / 100,
    iva: c.ivaDaTaxaCent / 100,
    // A parte da CLYON: a taxa e, com valor único, a reserva (d39).
    comissao: c.baseDaFaturaDaClyonCent / 100,
    total: c.aPassarAClyonCent / 100,
  };
}

type PagamentoParaOCorte = {
  estado: string;
  pagoEm?: Date | string | null;
  /** Quando a referência foi emitida (a linha de `pagamentos` nasceu). */
  criadoEm?: Date | string | null;
  metodo?: string | null;
  /** «divida» é a referência do profissional, nunca a do cliente (`parte-do-pagamento.ts`). */
  parte?: string | null;
  /** O prazo da referência, quando o euPago o deu. */
  expiraEm?: Date | string | null;
};

function comoData(v: unknown): Date | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * A REFERÊNCIA MULTIBANCO EMITIDA AO CLIENTE ANTES DE 15-11 — d20 (CEO e dono,
 * 13-11-2026). Paga dentro do prazo dela, mesmo depois da data, conta como paga
 * à CLYON antes do corte: o cliente recebeu-a no modelo antigo e pagou-a como
 * lhe foi pedida. Uma que caducou sem ser paga não conta (não está «pago»). Só a
 * do cliente: a «divida» é do profissional. Um MB WAY dura minutos e não entra
 * aqui (ver o relatório do Jurídico, §4 n.º 5).
 */
export function referenciaEmitidaAntesDoCorte(p: PagamentoParaOCorte): boolean {
  if (p.estado !== "pago") return false;
  if (p.metodo !== "multibanco") return false;
  if (p.parte === "divida") return false;
  const criada = comoData(p.criadoEm);
  if (!criada || criada.getTime() >= NOVO_MODELO_DESDE.getTime()) return false;
  const pago = comoData(p.pagoEm);
  const expira = comoData(p.expiraEm);
  // Paga depois do prazo que a referência dizia não é «dentro do prazo».
  if (pago && expira && pago.getTime() > expira.getTime()) return false;
  return true;
}

/**
 * Quando é que alguém pagou esta negociação à CLYON ANTES de 15-11 (a caução do
 * cliente, o total, ou o valor do dinheiro do regime anterior) — ou `null`.
 * Conta também a referência Multibanco emitida antes da data e paga depois,
 * dentro do prazo (`referenciaEmitidaAntesDoCorte`, d20). É a ÚNICA regra do
 * corte com os pagamentos lidos: a carteira, o acesso ao pagamento e os textos
 * de um trabalho perguntam todos aqui.
 */
export function pagoAClyonAntesDoCorte(pagamentos: ReadonlyArray<PagamentoParaOCorte>): Date | null {
  for (const p of pagamentos) {
    if (p.estado !== "pago" || p.pagoEm == null) continue;
    const d = comoData(p.pagoEm);
    if (!d) continue;
    if (d.getTime() < NOVO_MODELO_DESDE.getTime()) return d;
    if (referenciaEmitidaAntesDoCorte(p)) return d;
  }
  return null;
}

/** O que o fecho de um trabalho precisa para dizer quando, no mais cedo, se libertou. */
export type TrabalhoParaOPagamentoDoCliente = {
  confirmadoEm?: unknown;
  pagoEm?: unknown;
  execucaoEnviadaEm?: unknown;
};

/**
 * O MAIS CEDO QUE ESTE TRABALHO SE PODIA TER LIBERTADO — d58. A referência com
 * que o profissional passa à CLYON a taxa (modelo de 15-11) só nasce DEPOIS de o
 * trabalho se libertar (`gerarReferenciaDaDivida` recusa antes: «O trabalho ainda
 * não foi confirmado.»), e a libertação é a confirmação, o pagamento ao
 * profissional, ou o prazo depois de dado por feito (`quandoLiberta`). O mínimo
 * dos três é um limite que essa referência nunca fura. `null` = ainda por libertar.
 */
export function libertacaoMaisCedo(t: TrabalhoParaOPagamentoDoCliente): Date | null {
  const datas = [comoData(t.confirmadoEm), comoData(t.pagoEm)];
  const enviada = comoData(t.execucaoEnviadaEm);
  if (enviada) datas.push(new Date(enviada.getTime() + DIAS_ATE_LIBERTAR_SOZINHO * 86_400_000));
  const validas = datas.filter((d): d is Date => d != null);
  if (validas.length === 0) return null;
  return new Date(Math.min(...validas.map((d) => d.getTime())));
}

/** Registos à mão do cliente à CLYON (`dinheiro-do-trabalho.ts`). Os «pro_*» são do profissional. */
const DO_CLIENTE_A_MAO = new Set(["transferencia", "numerario"]);
/** O euPago: do cliente, ou a referência da taxa do profissional — decide a data (em baixo). */
const DO_EUPAGO = new Set(["mbway", "multibanco"]);

/**
 * O CLIENTE PAGOU ESTE TRABALHO CLYON À CLYON? — d58 (CEO e dono, 17-11-2026).
 * Quando, ou `null`. SEJA QUAL FOR A DATA: com o dinheiro do cliente na CLYON, a
 * CLYON paga ao profissional (o modelo antigo), mesmo num criado depois de 15-11.
 *
 * Conta: uma linha paga (com data) do cliente — por transferência ou numerário
 * anotados à mão, ou pelo euPago (MB WAY, Multibanco) com a referência criada
 * ANTES de o trabalho se poder libertar (`libertacaoMaisCedo`). Não conta: a
 * parte «divida», os pagamentos do profissional à CLYON («pro_*», abatimento,
 * quitação), o «pago ao profissional», e uma referência do euPago criada depois
 * da libertação — essa é a da taxa do profissional no modelo de 15-11 (é sempre
 * depois), e contá-la passava ao antigo um trabalho que o parceiro já recebeu.
 */
export function clientePagouOTrabalhoClyon(
  pagamentos: ReadonlyArray<PagamentoParaOCorte>,
  t: TrabalhoParaOPagamentoDoCliente,
): Date | null {
  const limite = libertacaoMaisCedo(t);
  let primeiro: Date | null = null;
  for (const p of pagamentos) {
    if (p.estado !== "pago" || p.parte === "divida") continue;
    const pago = comoData(p.pagoEm);
    if (!pago) continue;
    const metodo = String(p.metodo ?? "").trim();
    let doCliente = DO_CLIENTE_A_MAO.has(metodo);
    if (!doCliente && DO_EUPAGO.has(metodo)) {
      const criada = comoData(p.criadoEm) ?? pago;
      doCliente = limite == null || criada.getTime() < limite.getTime();
    }
    if (doCliente && (primeiro == null || pago.getTime() < primeiro.getTime())) primeiro = pago;
  }
  return primeiro;
}

/**
 * Esta negociação, já com os pagamentos lidos, segue o modelo novo? A regra é a
 * de `eDoNovoModelo`; aqui só se lêem os pagamentos: um pagamento feito à CLYON
 * antes de 15-11 deixa-a no modelo antigo. Os de depois são do parceiro (a taxa)
 * — menos num Trabalho CLYON, onde o pagamento do CLIENTE à CLYON o deixa no
 * antigo seja qual for a data (d58): pelo `trabalho` dado (as datas do fecho,
 * `clientePagouOTrabalhoClyon`) ou pela data já lida da base (`clientePagouAClyonEm`).
 */
export function negociacaoNoNovoModelo(
  l: {
    ofertaClyon?: unknown;
    fechadoEm?: Date | string | null;
    contratadaEm?: Date | string | null;
    /** d33: a criação do pedido de um Trabalho CLYON (`trabalhoClyonDoModeloAntigo`). */
    pedidoCriadoEm?: Date | string | null;
    /** d58: o pagamento do cliente à CLYON de um Trabalho CLYON, já lido (`trabalhosClyonDasNegociacoes`). */
    clientePagouAClyonEm?: Date | string | null;
    /** d58: as datas do fecho, para o ler dos `pagamentos` daqui. */
    trabalho?: TrabalhoParaOPagamentoDoCliente;
  },
  pagamentos: ReadonlyArray<PagamentoParaOCorte>,
  agora: Date,
): boolean {
  return eDoNovoModelo(
    {
      ofertaClyon: l.ofertaClyon,
      pedidoCriadoEm: l.pedidoCriadoEm ?? null,
      clientePagouAClyonEm:
        l.clientePagouAClyonEm ?? (l.trabalho ? clientePagouOTrabalhoClyon(pagamentos, l.trabalho) : null),
      clientePagouEm: pagoAClyonAntesDoCorte(pagamentos),
      fechadoEm: l.fechadoEm ?? null,
      contratadaEm: l.contratadaEm ?? null,
    },
    agora,
  );
}
