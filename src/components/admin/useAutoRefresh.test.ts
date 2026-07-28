import { describe, it, expect } from "vitest";
import { textoDesde } from "./useAutoRefresh";

describe("textoDesde — quão fresco é o que está no ecrã", () => {
  const agora = 1_700_000_000_000;

  it("sem leitura nenhuma não afirma nada", () => {
    expect(textoDesde(0, agora)).toBe("");
  });

  it("o primeiro minuto é 'agora mesmo'", () => {
    expect(textoDesde(agora, agora)).toBe("agora mesmo");
    expect(textoDesde(agora - 59_000, agora)).toBe("agora mesmo");
  });

  it("conta minutos até à hora", () => {
    expect(textoDesde(agora - 60_000, agora)).toBe("há 1 min");
    expect(textoDesde(agora - 3 * 60_000, agora)).toBe("há 3 min");
    expect(textoDesde(agora - 59 * 60_000, agora)).toBe("há 59 min");
  });

  it("passa a horas aos 60 minutos", () => {
    expect(textoDesde(agora - 60 * 60_000, agora)).toBe("há 1 h");
    expect(textoDesde(agora - 150 * 60_000, agora)).toBe("há 2 h");
  });

  // Relógios locais adiantados davam tempos negativos — "há -2 min" no ecrã
  it("um relógio adiantado não produz tempo negativo", () => {
    expect(textoDesde(agora + 10_000, agora)).toBe("agora mesmo");
  });
});
