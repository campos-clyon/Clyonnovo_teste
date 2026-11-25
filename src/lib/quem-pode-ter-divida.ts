import { lerForma } from "./forma-de-pagamento";
import { instanteDaBase } from "./hora-de-lisboa";
import { NOVO_MODELO_DESDE, novoModeloEmVigor } from "./novo-modelo";
import { DIAS_ATE_LIBERTAR_SOZINHO } from "./trabalho";

/**
 * QUEM PODE TER VALOR A PASSAR À CLYON — d125 (CEO e dono, 25-11-2026).
 *
 * O pré-filtro de `dividasDosProfissionais` sem ids (Pagamentos › «A receber
 * dos profissionais», Finanças › Início, o selo dos Pagamentos). Só escolhia
 * os trabalhos em dinheiro, os registados «pago ao profissional» e os pagos com
 * folha final depois — e os do modelo de 15-11 (o cliente paga ao parceiro, o
 * parceiro passa à CLYON a taxa e o IVA dela) ficavam de fora: o separador
 * dizia 0,00 € com o painel do parceiro a mostrar o valor a passar.
 *
 * Continua a ser só um pré-filtro: quem deve, e quanto, decide-o `dividasDe`
 * (a conta da carteira dele). Por isso, na dúvida, entra. As datas comparam-se
 * aqui, e não no MySQL (os fusos — `a base é lida em UTC`).
 */
export type NegociacaoCandidata = {
  formaDePagamento?: unknown;
  /** Há um pagamento «pago ao profissional» (`METODO_PAGO_AO_PROFISSIONAL`) nesta negociação. */
  pagoAoProfissional?: unknown;
  /** Paga ao profissional, e com folha final já paga depois (d38 v2). */
  folhaFinalDepoisDePago?: unknown;
  execucaoEnviadaEm?: Date | string | null;
  confirmadoEm?: Date | string | null;
  pagoEm?: Date | string | null;
};

/**
 * A folga do modelo novo: um trabalho com o «está feito» enviado antes de
 * 15-11 ainda pode fechar depois, pelo prazo (`DIAS_ATE_LIBERTAR_SOZINHO`), e
 * mais um dia por causa dos fusos. Mais cedo do que isto, fechou no antigo.
 */
export const FOLGA_DO_MODELO_NOVO_MS = (DIAS_ATE_LIBERTAR_SOZINHO + 1) * 86_400_000;

const verdade = (v: unknown) => v === true || v === 1 || v === "1";

/** Pode ter, no modelo de 15-11, um valor a passar à CLYON? Andou (feito, confirmado ou pago) perto ou depois do corte. */
export function podeEstarNoModeloNovo(n: NegociacaoCandidata, agora: Date = new Date()): boolean {
  if (!novoModeloEmVigor(agora)) return false;
  const desde = NOVO_MODELO_DESDE.getTime() - FOLGA_DO_MODELO_NOVO_MS;
  return [n.execucaoEnviadaEm, n.confirmadoEm, n.pagoEm].some((v) => {
    const d = instanteDaBase((v ?? null) as Date | string | null);
    return d != null && d.getTime() >= desde;
  });
}

/** Esta negociação (acordada, com profissional) pode deixar-lhe algo a passar à CLYON? */
export function podeTerDividaParaAClyon(n: NegociacaoCandidata, agora: Date = new Date()): boolean {
  return (
    lerForma(n.formaDePagamento) === "dinheiro" ||
    verdade(n.pagoAoProfissional) ||
    verdade(n.folhaFinalDepoisDePago) ||
    podeEstarNoModeloNovo(n, agora)
  );
}
