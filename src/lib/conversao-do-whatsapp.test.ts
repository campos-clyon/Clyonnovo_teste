import { afterEach, describe, expect, it, vi } from "vitest";

const consentimento = { marketing: true };
vi.mock("@/lib/cookie-consent", () => ({
  lerConsentimentoGuardado: () => consentimento,
}));
vi.mock("@/lib/track-contact", () => ({ trackLeadEvent: () => {} }));

import { trackSimulatorWhatsApp, trackWhatsAppClick } from "./analytics";

function comGtag() {
  const gtag = vi.fn();
  vi.stubGlobal("window", { gtag });
  return gtag;
}

const conversoes = (gtag: ReturnType<typeof vi.fn>) =>
  gtag.mock.calls.filter((c) => c[0] === "event" && c[1] === "conversion");

afterEach(() => {
  vi.unstubAllGlobals();
  consentimento.marketing = true;
});

describe("conversão do clique no WhatsApp", () => {
  it("o clique num link de WhatsApp conta na acção «Clique WhatsApp»", () => {
    const gtag = comGtag();
    trackWhatsAppClick("pagina:/");
    expect(conversoes(gtag)).toEqual([
      [
        "event",
        "conversion",
        { send_to: "AW-18221538324/80wpCJHW7J0dEJS42vBD", transport_type: "beacon" },
      ],
    ]);
  });

  it("o WhatsApp do simulador também conta", () => {
    const gtag = comGtag();
    trackSimulatorWhatsApp("recolha", 120, true);
    expect(conversoes(gtag)).toHaveLength(1);
  });

  it("sem consentimento de marketing não sai nada para o Ads", () => {
    consentimento.marketing = false;
    const gtag = comGtag();
    trackWhatsAppClick("pagina:/");
    expect(conversoes(gtag)).toHaveLength(0);
    // O GA4 continua a receber o seu evento.
    expect(gtag.mock.calls.some((c) => c[1] === "whatsapp_click")).toBe(true);
  });
});
