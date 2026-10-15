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

/*
 * O CLIQUE NO WHATSAPP, À PARTE — 15-10-2026.
 *
 * É a acção «Clique WhatsApp» criada no Ads, e não a do pedido: muita gente
 * pede pelo WhatsApp em vez do simulador, e esses pedidos não chegavam ao
 * Google. Fica como acção sua para o dono decidir se é principal ou só se vê.
 * Mesmo travão do consentimento. `beacon` porque o clique tira a pessoa da
 * página e o envio não pode morrer com ela.
 */
export const CONVERSAO_DO_WHATSAPP = "AW-18221538324/80wpCJHW7J0dEJS42vBD";

export function contarCliqueDeWhatsAppNoGoogleAds(): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  if (!lerConsentimentoGuardado().marketing) return;
  window.gtag("event", "conversion", {
    send_to: CONVERSAO_DO_WHATSAPP,
    // Menos de metade do pedido (10 €): conta para o Google aprender, mas um
    // pedido registado continua a valer mais do que uma conversa começada.
    value: 4.0,
    currency: "EUR",
    transport_type: "beacon",
  });
}
