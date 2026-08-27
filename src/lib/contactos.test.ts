import { describe, expect, it } from "vitest";

import { BUSINESS_PHONE, BUSINESS_PHONE_E164, linkTelefone, linkWhatsApp } from "./seo-data";

describe("contactos da empresa", () => {
  it("o formato wa.me deriva do número oficial, sem duplicar o literal", () => {
    expect(BUSINESS_PHONE_E164).toBe(BUSINESS_PHONE.replace("+", ""));
    expect(BUSINESS_PHONE_E164).toMatch(/^\d+$/);
  });

  it("monta o link sem mensagem", () => {
    expect(linkWhatsApp()).toBe(`https://wa.me/${BUSINESS_PHONE_E164}`);
  });

  it("codifica a mensagem para URL", () => {
    expect(linkWhatsApp("Olá! Preciso de recolha de sofá.")).toBe(
      `https://wa.me/${BUSINESS_PHONE_E164}?text=Ol%C3%A1!%20Preciso%20de%20recolha%20de%20sof%C3%A1.`,
    );
  });

  it("o link de chamada mantém o indicativo internacional", () => {
    expect(linkTelefone()).toBe("tel:+351931632622");
  });
});
