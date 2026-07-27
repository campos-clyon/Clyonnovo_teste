import { describe, it, expect } from "vitest";
import { safeText, metaOf } from "./safe-text";

describe("safeText — nenhum objecto chega ao JSX", () => {
  it("deixa passar texto", () => {
    expect(safeText("Mudança de T2")).toBe("Mudança de T2");
  });

  it("trata vazio como ausente, para o fallback aparecer", () => {
    expect(safeText("")).toBeNull();
    expect(safeText(null)).toBeNull();
    expect(safeText(undefined)).toBeNull();
  });

  it("converte números e booleanos", () => {
    expect(safeText(3)).toBe("3");
    expect(safeText(0)).toBe("0");
    expect(safeText(false)).toBe("false");
  });

  it("junta arrays de texto", () => {
    expect(safeText(["sofá", "mesa"])).toBe("sofá, mesa");
  });

  it("array vazio é ausente, não string vazia", () => {
    expect(safeText([])).toBeNull();
  });

  // O caso que rebentou a agenda: details vinha do motor como objecto
  it("devolve null para o objecto de details — nunca o próprio objecto", () => {
    const details = { volume_m3: 12, itens: ["sofá"], piso: 3 };
    const t = safeText(details);
    expect(t).toBeNull();
    expect(typeof t === "object" && t !== null).toBe(false);
  });

  it("nunca devolve algo que o React recuse imprimir", () => {
    const amostras: unknown[] = [
      "texto", 1, true, null, undefined, [], ["a"], {}, { a: 1 },
      { nested: { deep: true } }, new Date("x"),
    ];
    for (const v of amostras) {
      const out = safeText(v);
      expect(out === null || typeof out === "string").toBe(true);
    }
  });
});

describe("metaOf — o objecto original viaja à parte", () => {
  it("devolve o objecto quando existe", () => {
    expect(metaOf({ volume_m3: 12 })).toEqual({ volume_m3: 12 });
  });

  it("ignora texto, arrays e vazios", () => {
    expect(metaOf("texto")).toBeNull();
    expect(metaOf(["a"])).toBeNull();
    expect(metaOf(null)).toBeNull();
  });
});
