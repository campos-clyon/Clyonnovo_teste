/**
 * Analytics utilities for GA4 tracking via gtag + BD interna via /api/leads/events
 */

import { trackLeadEvent } from "@/lib/track-contact";

declare global {
  interface Window {
    gtag?: (
      command: "event" | "config" | "js",
      action: string,
      params?: Record<string, unknown>
    ) => void;
  }
}

/** Track a custom event to Google Analytics 4 */
export function trackEvent(
  eventName: string,
  params?: Record<string, unknown>
): void {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", eventName, params);
  }
}

// Lead form events
export function trackLeadFormStart(formLocation: string): void {
  trackEvent("lead_form_start", { form_location: formLocation });
}

export function trackLeadFormSubmit(formLocation: string, serviceType?: string): void {
  trackEvent("lead_form_submit", { form_location: formLocation, service_type: serviceType });
  trackLeadEvent({ type: "form_submit_contacto", action: "Formulário enviado", label: formLocation, service: serviceType });
}

// WhatsApp events
export function trackWhatsAppClick(location: string, context?: string): void {
  trackEvent("whatsapp_click", { click_location: location, context });
  trackLeadEvent({ type: "click_whatsapp", action: "Clique WhatsApp", label: location, service: context });
}

// Phone call events
export function trackPhoneCall(location: string, phone?: string): void {
  trackEvent("phone_call_click", { click_location: location });
  trackLeadEvent({ type: "click_call", action: "Clique para ligar", label: location, phone });
}

// Email click events
export function trackEmailClick(location: string, emailAddress?: string): void {
  trackEvent("email_click", { click_location: location });
  trackLeadEvent({ type: "click_email", action: "Clique email", label: location, email: emailAddress });
}

// CTA events
export function trackCTAClick(ctaName: string, ctaLocation: string): void {
  trackEvent("cta_click", { cta_name: ctaName, cta_location: ctaLocation });
  trackLeadEvent({ type: "click_cta", action: ctaName, label: ctaLocation });
}

// Simulator events
export function trackSimulatorStart(category?: string): void {
  trackEvent("simulator_start", { category });
  trackLeadEvent({ type: "simulator_start", action: "Simulador iniciado", service: category });
}

export function trackSimulatorContact(data: { name?: string; phone?: string; email?: string; service?: string }): void {
  trackEvent("simulator_contact_filled", { service: data.service });
  trackLeadEvent({
    type: "simulator_contact",
    action: "Contacto preenchido",
    name: data.name,
    phone: data.phone,
    email: data.email,
    service: data.service,
  });
}

export function trackSimulatorStepComplete(step: number, stepName: string): void {
  trackEvent("simulator_step_complete", { step_number: step, step_name: stepName });
}

export function trackSimulatorEstimate(
  category: string,
  estimatedValue: number,
  city?: string,
  simulatorData?: Record<string, unknown>
): void {
  trackEvent("simulator_complete", { category, estimated_value: estimatedValue, city });
  trackLeadEvent({
    type: "simulator_estimate",
    action: "Estimativa gerada",
    service: category,
    location: city,
    simulatorData: simulatorData ?? { estimatedValue },
  });
}

/** @deprecated Use trackSimulatorEstimate */
export function trackSimulatorComplete(
  category: string,
  estimatedValue: number,
  city?: string
): void {
  trackSimulatorEstimate(category, estimatedValue, city);
}

export function trackSimulatorOrderConfirmed(data: {
  service?: string;
  name?: string;
  phone?: string;
  email?: string;
  estimatedValue?: number;
  city?: string;
  simulatorData?: Record<string, unknown>;
}): void {
  trackEvent("simulator_order_confirmed", { service: data.service, estimated_value: data.estimatedValue });
  trackLeadEvent({
    type: "simulator_order_confirmed",
    action: "Pedido confirmado",
    name: data.name,
    phone: data.phone,
    email: data.email,
    service: data.service,
    location: data.city,
    simulatorData: data.simulatorData,
  });
}

export function trackSimulatorOrderSaved(data: {
  service?: string;
  name?: string;
  phone?: string;
  email?: string;
  estimatedValue?: number;
  city?: string;
}): void {
  trackEvent("simulator_order_saved", { service: data.service });
  trackLeadEvent({
    type: "simulator_order_saved",
    action: "Pedido guardado",
    name: data.name,
    phone: data.phone,
    email: data.email,
    service: data.service,
    location: data.city,
  });
}

export function trackSimulatorWhatsApp(
  category: string,
  estimatedValue: number,
  hasPhone: boolean
): void {
  trackEvent("simulator_whatsapp", { category, estimated_value: estimatedValue, has_phone: hasPhone });
  trackLeadEvent({ type: "click_whatsapp", action: "WhatsApp após simulador", service: category, label: "simulator" });
}

// Page-specific events
export function trackServicePageView(serviceName: string, cityName?: string): void {
  trackEvent("service_page_view", { service_name: serviceName, city_name: cityName });
}
