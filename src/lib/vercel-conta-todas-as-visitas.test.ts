import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * «Sim, liga a Vercel para contar todas as visitas» — o dono, 22-10-2026.
 */
const ler = (f: string) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");

describe("o Vercel Analytics conta todas as visitas", () => {
  it("carrega sem esperar pelo «Aceitar», e deita fora as páginas com token", () => {
    const r = ler("src/components/RastreioConsentido.tsx");
    expect(r).not.toContain("consentimento.analytics && <Analytics />");
    expect(r).toContain("<Analytics beforeSend={(e) => (temSegredoNoEndereco(new URL(e.url).pathname) ? null : e)} />");
  });

  it("a política diz o mesmo", () => {
    expect(ler("src/app/privacidade/page.tsx")).toContain("conta as visitas sem cookies e sem identificar ninguém, aceite-se ou não.");
    expect(ler("src/app/cookies/page.tsx")).toContain("A contagem de visitas é anónima e corre sempre");
  });
});
