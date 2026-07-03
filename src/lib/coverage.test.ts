import { describe, it, expect } from "vitest";
import { checkCoverage, normalize } from "./coverage";

describe("normalize", () => {
  it("remove acentos, baixa para minúsculas e retira espaços nas pontas", () => {
    expect(normalize("  Setúbal  ")).toBe("setubal");
    expect(normalize("Fernão Ferro")).toBe("fernao ferro");
  });
});

describe("checkCoverage", () => {
  it("marca como coberta uma cidade da lista", () => {
    const result = checkCoverage({ city: "Lisboa", countryCode: "PT" });
    expect(result.covered).toBe(true);
    expect(result.inPortugal).toBe(true);
  });

  it("ignora acentuação e maiúsculas na comparação", () => {
    const result = checkCoverage({ city: "setúbal" });
    expect(result.covered).toBe(true);
  });

  it("marca como não coberta uma cidade fora da lista", () => {
    const result = checkCoverage({ city: "Porto", countryCode: "PT" });
    expect(result.covered).toBe(false);
  });

  it("marca como fora de Portugal quando o countryCode não é PT", () => {
    const result = checkCoverage({ city: "Madrid", countryCode: "ES" });
    expect(result.inPortugal).toBe(false);
  });

  it("assume Portugal quando o countryCode está ausente", () => {
    const result = checkCoverage({ city: "Lisboa" });
    expect(result.inPortugal).toBe(true);
  });

  it("devolve não-coberta quando não há cidade", () => {
    const result = checkCoverage({});
    expect(result.covered).toBe(false);
  });
});
