import { desdobramentoDoIva, precoDoCliente, type PrecoDoCliente } from "./preco-do-cliente";
import { FRASES_DA_FATURA, perfilFiscalDoParceiro, type TipoDeFatura } from "./perfil-fiscal";
import {
  precoDoNovoModelo,
  totalAoClienteDaNegociacao,
  type LinhaParaOTotal,
  type TotalAoCliente,
} from "./total-ao-cliente";
import { unidadeDaBase, type BaseDoPreco } from "./base-do-preco";
import type { ModeloDoPreco } from "./iva-incluido";
import type { Taxas } from "./taxas-plataforma";

/**
 * O TOTAL QUE A VITÓRIA DIZ — d17 (CEO e dono, 13-11-2026).
 *
 * No modelo de 15-11 o total depende do regime do parceiro, e o cartão da
 * proposta, o bloco «Pagar a …», o email e a app já o tiram de
 * `totalAoClienteDaNegociacao`. A Vitória fazia a conta antiga (valor × 1,23)
 * e, com um parceiro isento, dizia 430,50 € onde o pedido mostrava 358,05 €.
 * Agora diz o número que sai DALI, e quem passa a fatura do trabalho com a
 * frase do email («Fatura com isenção de IVA (art. 53.º), passada pelo
 * parceiro.»). Fora do modelo novo, tudo como era.
 *
 * Quem decide SE a negociação segue o modelo novo é o servidor
 * (`negociacoesNoNovoModelo`: as contratadas por `segueONovoModelo`, as abertas
 * por `eDoNovoModelo`). Isto só faz a conta e as frases. Pura.
 */

/** A linha da negociação como vem de `negociacoesDoPedido` (com o perfil do parceiro). */
export type LinhaDaVitoria = LinhaParaOTotal;

/** O total do modelo novo, ou `null` (fora dele, ou um valor que não serve). */
export function totalDaVitoria(
  linha: LinhaDaVitoria | null | undefined,
  valor: number | null | undefined,
  noNovoModelo: boolean,
): TotalAoCliente | null {
  if (!noNovoModelo || !linha) return null;
  return totalAoClienteDaNegociacao(linha, valor);
}

/** O preço do cliente: o do modelo novo quando há total, senão a conta de sempre. */
export function precoDaVitoria(
  valor: number,
  taxas: Taxas,
  modelo: ModeloDoPreco,
  total: TotalAoCliente | null,
): PrecoDoCliente {
  return total ? precoDoNovoModelo(total) : precoDoCliente(valor, taxas, modelo);
}

/**
 * De que é feito o total — o sem IVA ao lado, nunca sozinho. Com o parceiro
 * isento o IVA é só o da taxa da plataforma, e os 23 % não se dizem (não são
 * 23 % do total).
 */
export function deQueEFeitoOTotal(t: TotalAoCliente): string {
  if (t.regime === "isento") {
    return `${euros(t.semIva)} sem IVA, e o IVA incluído, ${euros(t.iva)}, é só o da taxa da plataforma`;
  }
  return desdobramentoDoIva(t);
}

/** O tipo de fatura do parceiro: o regime congelado ao contratar, ou o do perfil. */
export function tipoDeFaturaDaLinha(linha: LinhaDaVitoria): TipoDeFatura {
  const c = linha.regimeDoProfissional;
  if (c === "normal") return "com_iva";
  if (c === "isento") return "isento";
  return perfilFiscalDoParceiro(linha).tipoDeFatura;
}

/** «Fatura com isenção de IVA (art. 53.º), passada pelo parceiro.» — a frase do email da proposta. */
export function quemPassaAFatura(linha: LinhaDaVitoria): string {
  const tipo = tipoDeFaturaDaLinha(linha);
  if (tipo === "a_confirmar") return "A fatura do trabalho é passada pelo parceiro (o tipo ainda está por confirmar).";
  return `${FRASES_DA_FATURA[tipo]}, passada pelo parceiro.`;
}

/**
 * A frase do total no modelo novo, no lugar de `totalEmPalavras`:
 * «Valor com IVA incluído — 315,00 € sem IVA + … . Fatura com …, passada pelo parceiro.»
 */
export function totalEmPalavrasDoNovoModelo(t: TotalAoCliente, linha: LinhaDaVitoria, base: BaseDoPreco = "total"): string {
  const valorDito = base === "total" ? "Valor com IVA incluído" : `Valor${unidadeDaBase(base)}, com IVA incluído`;
  return `${valorDito} — ${deQueEFeitoOTotal(t)}. ${quemPassaAFatura(linha)}`;
}

const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;
