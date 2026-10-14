/*
 * POR ONDE CHEGOU UM PEDIDO — 14-10-2026.
 *
 * `origemDoPedido` (acesso.ts) diz que FORMULÁRIO o trouxe: simulador,
 * página inicial, contactos. Isto diz por onde a pessoa chegou ao site —
 * um anúncio do Google, a pesquisa do Google, o Facebook —, a partir da
 * `origemDaVisita` que o site junta ao pedido (origem-da-visita.ts).
 * Pedidos antigos não a têm, e então não se diz nada.
 */

type Origem = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  gclid?: string;
};

const PAGO = /^(cpc|ppc|paid|paidsearch|paid_search|ads|display)$/i;

/** «Google Ads · recolha-lisboa», «google (orgânico)», «facebook.com», ou null. */
export function canalDaOrigem(o: Origem | null | undefined): string | null {
  if (!o) return null;
  const fonte = o.utm_source?.trim();
  const meio = o.utm_medium?.trim();
  const campanha = o.utm_campaign?.trim();
  const comCampanha = (s: string) => (campanha ? `${s} · ${campanha}` : s);

  if (o.gclid || (fonte && /google/i.test(fonte) && meio && PAGO.test(meio))) return comCampanha("Google Ads");
  if (!fonte) return campanha ? `campanha ${campanha}` : null;
  if (meio === "organic") return `${fonte} (orgânico)`;
  if (meio === "referral" || !meio) return comCampanha(fonte);
  return comCampanha(`${fonte} · ${meio}`);
}

/** O mesmo, lido do rawOrderJson de um pedido. */
export function canalDoPedido(rawOrderJson: string | null | undefined): string | null {
  if (!rawOrderJson) return null;
  try {
    const raw = JSON.parse(rawOrderJson) as { origemDaVisita?: Origem | null };
    return canalDaOrigem(raw.origemDaVisita ?? null);
  } catch {
    return null;
  }
}
