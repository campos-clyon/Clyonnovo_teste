import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * «Antes a gente recebia muitos pedidos vindo do simulador e agora a gente
 * recebe muito pouco» — o dono, 22-10-2026. A chave do browser ficou bloqueada
 * para o Places e o getPlacePredictions nunca respondia: a lista de moradas
 * rodava para sempre e ninguém passava do passo 2.
 */
const HOOK = readFileSync("src/hooks/useGooglePlaces.ts", "utf8").replace(/\r\n/g, "\n");
const CSP = readFileSync("next.config.ts", "utf8");

describe("a morada não fica à espera de um Google que não responde", () => {
  it("o SDK tem prazo, e quem falha deixa o resto da visita ao proxy", () => {
    expect(HOOK).toMatch(/const SDK_ESPERA_MS = \d{4};/);
    expect(HOOK).toContain("await comEspera(autocomplete.getPlacePredictions({");
    expect(HOOK).toContain("return comEspera(getServices(key).then(");
    expect(HOOK).toContain("gm_authFailure = () => {");
    expect(HOOK.match(/if \(useSdk && !sdkMorto\)/g)).toHaveLength(2);
  });

  it("o SDK sem resultados também pergunta ao proxy", () => {
    expect(HOOK).toContain("if (achadas.length > 0) return achadas;\n            return proxySearch(query);");
  });

  it("os sinais sem cookies do Consent Mode passam a CSP", () => {
    expect(CSP.match(/https:\/\/pagead2\.googlesyndication\.com/g)).toHaveLength(2);
  });
});
