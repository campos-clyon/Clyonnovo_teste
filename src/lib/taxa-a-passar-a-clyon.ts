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

type PagamentoParaOCorte = { estado: string; pagoEm?: Date | string | null };

/**
 * Quando é que alguém pagou esta negociação à CLYON ANTES de 15-11 (a caução do
 * cliente, o total, ou o valor do dinheiro do regime anterior) — ou `null`.
 */
export function pagoAClyonAntesDoCorte(pagamentos: ReadonlyArray<PagamentoParaOCorte>): Date | null {
  for (const p of pagamentos) {
    if (p.estado !== "pago" || p.pagoEm == null) continue;
    const d = p.pagoEm instanceof Date ? p.pagoEm : new Date(String(p.pagoEm));
    if (!Number.isNaN(d.getTime()) && d.getTime() < NOVO_MODELO_DESDE.getTime()) return d;
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
