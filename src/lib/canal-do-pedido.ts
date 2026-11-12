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

/* ──────────────────────────────────────────────────────────────────────────
 * OS TRABALHOS PAGOS POR CANAL — 12-11-2026 (d8). Uma linha nas Finanças:
 * de cada canal, quantos trabalhos foram pagos no mês e quanto entrou. Para
 * isto o canal tem de ser um só nome por canal: o anúncio que chegou pelo
 * site («Google Ads · campanha») e o que chegou pelo WhatsApp («(A1)») são o
 * mesmo anúncio.
 * ────────────────────────────────────────────────────────────────────────── */

export const SEM_ORIGEM = "Sem origem registada";

/** Os campos do rawOrderJson que dizem o canal (lidos à parte, na base). */
export type OrigemGuardadaDoPedido = {
  origemDaVisita?: unknown;
  codigoDeOrigem?: unknown;
  origemPedido?: unknown;
};

/** Um nome por canal: «Google Ads», «google (orgânico)», «Facebook», «WhatsApp sem código»… */
export function canalCurtoDoPedido(o: OrigemGuardadaDoPedido | null | undefined): string {
  if (!o) return SEM_ORIGEM;
  let visita: Origem | null = null;
  if (typeof o.origemDaVisita === "string") {
    try {
      visita = JSON.parse(o.origemDaVisita) as Origem;
    } catch {
      visita = null;
    }
  } else if (o.origemDaVisita && typeof o.origemDaVisita === "object") {
    visita = o.origemDaVisita as Origem;
  }
  const doSite = canalDaOrigem(visita);
  if (doSite) return doSite.split(" · ")[0];
  const codigo = typeof o.codigoDeOrigem === "string" ? o.codigoDeOrigem : null;
  if (codigo && lerCodigoDeOrigem(codigo)) {
    return codigo[0] === "A" ? "Google Ads" : CANAIS[codigo[0] as LetraDoCanal];
  }
  if (o.origemPedido === "whatsapp") return "WhatsApp sem código";
  if (o.origemPedido === "backoffice") return "Registado pela equipa";
  return SEM_ORIGEM;
}

export type TrabalhosDoCanal = { canal: string; trabalhos: number; valor: number };

/**
 * De cada canal, os trabalhos (pedidos distintos) com pagamento e quanto
 * pagou o cliente. Os acertos no saldo (sem dinheiro) não são pagamentos, e a
 * parte da CLYON que o profissional lhe passa depois de um pagamento em mão
 * já está no valor em mão — contá-la outra vez dobrava o trabalho. Os mais
 * pagos primeiro; «sem origem» no fim.
 */
export function trabalhosPagosPorCanal(
  entradas: Array<{ pedidoId: number; valor: number; natureza?: string; daParteDaClyon?: boolean }>,
  canais: Record<string, string>,
): TrabalhosDoCanal[] {
  const porCanal = new Map<string, { pedidos: Set<number>; valor: number }>();
  for (const e of entradas) {
    if (e.natureza === "acerto_no_saldo" || e.daParteDaClyon) continue;
    const canal = canais[String(e.pedidoId)] ?? SEM_ORIGEM;
    const g = porCanal.get(canal) ?? { pedidos: new Set<number>(), valor: 0 };
    g.pedidos.add(e.pedidoId);
    g.valor += e.valor;
    porCanal.set(canal, g);
  }
  return [...porCanal.entries()]
    .map(([canal, g]) => ({ canal, trabalhos: g.pedidos.size, valor: Math.round(g.valor * 100) / 100 }))
    .sort((a, b) =>
      a.canal === SEM_ORIGEM ? 1 : b.canal === SEM_ORIGEM ? -1 : b.trabalhos - a.trabalhos || b.valor - a.valor,
    );
}
