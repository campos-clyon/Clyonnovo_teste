import { lerConsentimentoGuardado } from "@/lib/cookie-consent";

/*
 * A CONVERSÃO DO GOOGLE ADS É UM PEDIDO QUE CHEGOU — 14-10-2026.
 *
 * Contava-se no clique em «Abrir simulador» da página dos anúncios. Um clique
 * não é um pedido: o Google julgava a campanha por gente que abria o
 * simulador e saía, e aprendia a trazer mais gente dessa. Passa a contar-se
 * quando o pedido fica registado — no simulador, no formulário da página
 * inicial e no dos contactos —, com o número do pedido como `transaction_id`
 * para o mesmo pedido não contar duas vezes.
 *
 * Só com o consentimento de marketing: é ele que carrega a tag do Ads
 * (RastreioConsentido). O Google só a atribui a quem veio de um anúncio.
 */
export const CONVERSAO_DO_PEDIDO = "AW-18221538324/UOx5CO2e87ocEJS42vBD";

export function contarPedidoNoGoogleAds(numeroDoPedido?: number | null): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  if (!lerConsentimentoGuardado().marketing) return;
  window.gtag("event", "conversion", {
    send_to: CONVERSAO_DO_PEDIDO,
    value: 10.0,
    currency: "EUR",
    ...(numeroDoPedido && numeroDoPedido > 0 ? { transaction_id: String(numeroDoPedido) } : {}),
  });
}
