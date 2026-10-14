import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { COVERED_ZONES, checkCoverage, nomeEmPortugues, normalize } from "./coverage";
import { CITIES } from "./seo-data";

/*
 * O AVISO DE COBERTURA NÃO PODE CONTRADIZER A PÁGINA — 30-09-2026.
 *
 * A lista das zonas era escrita à mão e esquecia terras com página própria:
 * quem estava em Odivelas, a ler /recolha-moveis-odivelas, recebia «Ainda não
 * estamos na sua área». Estes testes prendem a regra nova — toda a cidade com
 * página, e as vizinhas que ela nomeia, contam como cobertas.
 */
describe("a lista das zonas nasce das páginas", () => {
  it("toda a cidade com página própria está coberta", () => {
    const esquecidas = CITIES.filter((c) => !checkCoverage({ city: c.name }).covered).map(
      (c) => c.name,
    );
    expect(esquecidas).toEqual([]);
  });

  it("e as vizinhas que as páginas nomeiam também", () => {
    const vizinhas = [...new Set(CITIES.flatMap((c) => c.nearby))];
    const esquecidas = vizinhas.filter((n) => !checkCoverage({ city: n }).covered);
    expect(esquecidas).toEqual([]);
  });

  it("as que o aviso esquecia deixaram de ficar de fora", () => {
    for (const terra of [
      "Odivelas",
      "Montijo",
      "Alcochete",
      "Queluz",
      "Monte Abraão",
      "Carnaxide",
      "Corroios",
      "Costa da Caparica",
      "Azeitão",
    ]) {
      expect(checkCoverage({ city: terra, countryCode: "PT" }).covered, terra).toBe(true);
    }
  });

  it("as escritas à mão sem página continuam lá", () => {
    // Belverde e Fernão Ferro não têm página, e são das mais perto da sede.
    expect(checkCoverage({ city: "Belverde" }).covered).toBe(true);
    expect(checkCoverage({ city: "Fernão Ferro" }).covered).toBe(true);
  });

  it("sem repetidas — cada terra entra uma vez", () => {
    expect(new Set(COVERED_ZONES).size).toBe(COVERED_ZONES.length);
  });
});

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

/*
 * O IP NÃO DECIDE QUE NÃO SERVIMOS ALGUÉM — 14-10-2026.
 *
 * A janela «Ainda não estamos na sua área» abria-se pela cidade do IP. A
 * Vercel dá-a em inglês («Lisbon»), e a lista só conhecia «Lisboa»: quem
 * estava em Lisboa lia que não o servíamos.
 */
describe("a cidade que o IP dá em inglês", () => {
  it("«Lisbon» é Lisboa, e está coberta", () => {
    expect(nomeEmPortugues("Lisbon")).toBe("Lisboa");
    expect(checkCoverage({ city: "Lisbon", countryCode: "PT" }).covered).toBe(true);
  });

  it("as outras ficam como vieram", () => {
    expect(nomeEmPortugues("Almada")).toBe("Almada");
    expect(nomeEmPortugues("Council Bluffs")).toBe("Council Bluffs");
  });

  it("e nenhuma janela se abre por cima do site a partir dela", () => {
    const chrome = readFileSync(join(process.cwd(), "src/components/SiteChrome.tsx"), "utf8")
      .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(chrome).toContain("DeferredCookieConsent");
    expect(chrome).not.toContain("CoverageNotice");
  });
});
