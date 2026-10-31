/*
 * POR ONDE CHEGOU UM PEDIDO — 14-10-2026.
 *
 * `origemDoPedido` (acesso.ts) diz que FORMULÁRIO o trouxe: simulador,
 * página inicial, contactos. Isto diz por onde a pessoa chegou ao site —
 * um anúncio do Google, a pesquisa do Google, o Facebook —, a partir da
 * `origemDaVisita` que o site junta ao pedido (origem-da-visita.ts).
 * Pedidos antigos não a têm, e então não se diz nada.
 */

import { CANAIS, lerCodigoDeOrigem, type LetraDoCanal } from "./codigo-de-origem";

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

/**
 * O canal de um código de origem do WhatsApp — 31-10-2026 (d4). «A1» →
 * «Anúncio do Google»; a página lê-se por extenso em `lerCodigoDeOrigem`.
 */
export function canalDoCodigo(codigo: unknown): string | null {
  if (typeof codigo !== "string" || !lerCodigoDeOrigem(codigo)) return null;
  return CANAIS[codigo[0] as LetraDoCanal];
}

/**
 * O mesmo, lido do rawOrderJson de um pedido. Um pedido do WhatsApp não tem
 * `origemDaVisita` (a visita foi no site, a conversa noutro lado): desde
 * 31-10-2026 (d4) traz o código de origem da conversa, «(A1)», em
 * `codigoDeOrigem` — e diz-se o canal dele.
 */
export function canalDoPedido(rawOrderJson: string | null | undefined): string | null {
  if (!rawOrderJson) return null;
  try {
    const raw = JSON.parse(rawOrderJson) as { origemDaVisita?: Origem | null; codigoDeOrigem?: unknown };
    return canalDaOrigem(raw.origemDaVisita ?? null) ?? canalDoCodigo(raw.codigoDeOrigem);
  } catch {
    return null;
  }
}

/** O código de origem do WhatsApp gravado no pedido, lido por extenso — ou null. */
export function origemDoCodigoDoPedido(rawOrderJson: string | null | undefined): string | null {
  if (!rawOrderJson) return null;
  try {
    const raw = JSON.parse(rawOrderJson) as { codigoDeOrigem?: unknown };
    return typeof raw.codigoDeOrigem === "string" ? lerCodigoDeOrigem(raw.codigoDeOrigem) : null;
  } catch {
    return null;
  }
}
