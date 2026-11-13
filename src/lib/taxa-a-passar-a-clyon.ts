import type { Taxas } from "./taxas-plataforma";
import type { DividaDoProfissional } from "./divida-do-profissional";
import { contaDoValorAcordado } from "./pagamento-directo";
import { NOVO_MODELO_DESDE, eDoNovoModelo } from "./novo-modelo";

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
): DividaDoProfissional | null {
  const c = contaDoValorAcordado(acordado, taxas, regime);
  if (!c) return null;
  return {
    recebidoDoCliente: c.totalAoClienteCent / 100,
    liquido: c.ficaAoProfissionalCent / 100,
    iva: c.ivaDaTaxaCent / 100,
    comissao: c.taxaCent / 100,
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

/**
 * Esta negociação, já com os pagamentos lidos, segue o modelo novo? A regra é a
 * de `eDoNovoModelo`; aqui só se lêem os pagamentos: um pagamento feito à CLYON
 * antes de 15-11 deixa-a no modelo antigo. Os de depois são do parceiro (a taxa).
 */
export function negociacaoNoNovoModelo(
  l: { ofertaClyon?: unknown; fechadoEm?: Date | string | null; contratadaEm?: Date | string | null },
  pagamentos: ReadonlyArray<PagamentoParaOCorte>,
  agora: Date,
): boolean {
  return eDoNovoModelo(
    {
      ofertaClyon: l.ofertaClyon,
      clientePagouEm: pagoAClyonAntesDoCorte(pagamentos),
      fechadoEm: l.fechadoEm ?? null,
      contratadaEm: l.contratadaEm ?? null,
    },
    agora,
  );
}
