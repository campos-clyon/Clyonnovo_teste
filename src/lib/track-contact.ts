/**
 * trackLeadEvent — envia evento de contacto para /api/leads/events
 *
 * Usa navigator.sendBeacon quando disponível (não bloqueia navegação).
 * Fallback para fetch com keepalive: true.
 * Em caso de falha, apenas regista no console em desenvolvimento.
 */

export interface TrackLeadEventPayload {
  /** Tipo de evento: "whatsapp" | "call" | "email" | "form" | "simulator" | "cta" | string */
  type: string;
  /** Sub-acção descritiva: "Clique botão header", "Estimativa gerada", etc. */
  action?: string;
  /** Página de origem — se omitido, usa window.location.pathname */
  sourcePage?: string;
  /** Texto do botão / label do CTA */
  label?: string;
  /** Telefone associado ao clique (ex: para cliques tel:) */
  phone?: string;
  /** Email associado (ex: para cliques mailto:) */
  email?: string;
  /** Nome do cliente (se disponível) */
  name?: string;
  /** Tipo de serviço (ex: "Mudança", "Recolha de móveis") */
  service?: string;
  /** Localidade */
  location?: string;
  /** Mensagem de texto livre */
  message?: string;
  /** Dados do simulador (JSON serializável) */
  simulatorData?: Record<string, unknown>;
}

/** @deprecated Use trackLeadEvent */
export interface TrackEventPayload {
  eventType: string;
  serviceType?: string;
  location?: string;
  contactPreference?: string;
}

/** @deprecated Use trackLeadEvent */
export function trackContactEvent(payload: TrackEventPayload): void {
  trackLeadEvent({
    type: payload.eventType,
    service: payload.serviceType,
    location: payload.location,
  });
}

/**
 * Função global de tracking — envia evento para /api/leads/events.
 * Nunca lança excepção; falha silenciosamente em produção.
 */
export function trackLeadEvent(payload: TrackLeadEventPayload): void {
  if (typeof window === "undefined") return;

  const utmParams = Object.fromEntries(new URLSearchParams(window.location.search));

  const body = JSON.stringify({
    eventType: payload.type,
    action: payload.action ?? null,
    pagePath: payload.sourcePage ?? window.location.pathname,
    pageUrl: window.location.href,
    label: payload.label ?? null,
    phone: payload.phone ?? null,
    email: payload.email ?? null,
    name: payload.name ?? null,
    serviceType: payload.service ?? null,
    location: payload.location ?? null,
    message: payload.message ?? null,
    simulatorData: payload.simulatorData ? JSON.stringify(payload.simulatorData) : null,
    utmSource: utmParams.utm_source ?? null,
    utmMedium: utmParams.utm_medium ?? null,
    utmCampaign: utmParams.utm_campaign ?? null,
    gclid: utmParams.gclid ?? null,
  });

  const url = "/api/leads/events";

  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    const sent = navigator.sendBeacon(url, blob);
    if (sent) return;
  }

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch((err) => {
    if (process.env.NODE_ENV === "development") {
      console.warn("[trackLeadEvent] Falha ao enviar evento:", payload.type, err);
    }
  });
}
