/**
 * NÃO SE ELIMINA A CONTA COM VALORES POR PAGAR À CLYON — d15 (CEO e dono,
 * 13-11-2026).
 *
 * A conta de um parceiro era apagada (suspensa e anonimizada) mesmo com a taxa
 * da plataforma ou o IVA de um trabalho por pagar: a dívida ficava sem ninguém
 * a quem a cobrar. Agora a rota em que o parceiro elimina a própria conta
 * recusa, com uma frase clara, enquanto `porPagar` de alguma dívida for maior
 * do que zero — a MESMA conta da carteira, das referências e do bloqueio
 * (`dividasDe` → `dividasDoProfissional`), nunca outra.
 *
 * No que o parceiro lê: «por pagar» / «em atraso», nunca «em dívida».
 */

export type DividaParaApagar = { paga: boolean; porPagar: number };

/** O que falta pagar à CLYON, somado das dívidas por pagar (em euros, a 2 casas). */
export function valorPorPagarAntesDeApagar(dividas: readonly DividaParaApagar[]): number {
  const cent = dividas
    .filter((d) => !d.paga && Number.isFinite(d.porPagar) && d.porPagar > 0)
    .reduce((s, d) => s + Math.round(d.porPagar * 100), 0);
  return cent / 100;
}

const emEuros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

/** A frase do 409, para o painel e para a app. */
export function fraseDaContaComValorPorPagar(valor: number): string {
  return (
    `Não pode eliminar a conta enquanto tiver a taxa da plataforma ou o IVA por pagar (${emEuros(valor)}). ` +
    "Pague-os na Carteira e volte a tentar."
  );
}

export const NAO_SE_CONFIRMOU_O_QUE_FALTA_PAGAR =
  "Não foi possível confirmar se tem a taxa da plataforma ou o IVA por pagar. Tente novamente daqui a pouco.";
