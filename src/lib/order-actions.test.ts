import { describe, it, expect } from "vitest";
import { normalizePhoneForWhatsapp, buildWhatsappLink, deleteReasonError } from "./order-actions";

describe("normalizePhoneForWhatsapp", () => {
  it("prefixa 351 a número nacional de 9 dígitos", () => {
    expect(normalizePhoneForWhatsapp("931632622")).toBe("351931632622");
  });

  it("remove espaços e mantém indicativo existente", () => {
    expect(normalizePhoneForWhatsapp("931 632 622")).toBe("351931632622");
    expect(normalizePhoneForWhatsapp("+351 931 632 622")).toBe("351931632622");
    expect(normalizePhoneForWhatsapp("351931632622")).toBe("351931632622");
  });

  it("não duplica o indicativo 351", () => {
    expect(normalizePhoneForWhatsapp("351931632622")).toBe("351931632622");
    expect(normalizePhoneForWhatsapp("+351931632622")).toBe("351931632622");
  });
});

describe("buildWhatsappLink", () => {
  it("gera link wa.me com mensagem contextual e id curto", () => {
    const url = buildWhatsappLink("931632622", "a2f153f8-eb9b-4891-a2ed-bf1b102e3b42", "Recolha de Móveis");
    expect(url).toContain("https://wa.me/351931632622?text=");
    const text = decodeURIComponent(url.split("text=")[1]);
    expect(text).toContain("#a2f153f8");
    expect(text).toContain("Recolha de Móveis");
    expect(text).not.toContain("a2f153f8-eb9b"); // só o id curto
  });
});

describe("deleteReasonError", () => {
  it("exige motivo não vazio", () => {
    expect(deleteReasonError("")).not.toBeNull();
    expect(deleteReasonError("   ")).not.toBeNull();
  });

  it("aceita motivo preenchido", () => {
    expect(deleteReasonError("Pedido duplicado")).toBeNull();
  });
});
