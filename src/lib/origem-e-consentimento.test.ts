import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canalDaOrigem, canalDoPedido } from "./canal-do-pedido";
import { CONSENTIMENTO_NEGADO, sinaisDoConsentimento } from "./cookie-consent";
import { cliqueJaMedido, trackPhoneCall } from "./analytics";
import { origemAindaValida, origemDaEntrada, VALIDADE_DA_ORIGEM_DIAS } from "./origem-da-visita";

/*
 * A ORIGEM DE CADA PEDIDO E O CONSENT MODE — 14-10-2026 (auditoria, 30 dias).
 */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const AGORA = new Date("2026-10-14T12:00:00Z");

describe("a origem de uma entrada", () => {
  it("a campanha e o gclid do endereço", () => {
    const o = origemDaEntrada("?utm_source=google&utm_medium=cpc&utm_campaign=recolha&gclid=abc", "", "/orcamento-recolha-lisboa", AGORA);
    expect(o).toMatchObject({ utm_source: "google", utm_medium: "cpc", utm_campaign: "recolha", gclid: "abc", entrada: "/orcamento-recolha-lisboa" });
  });

  it("um motor de busca sem campanha é orgânico; outro site é referência", () => {
    expect(origemDaEntrada("", "https://www.google.com/", "/", AGORA)).toMatchObject({ utm_source: "google.com", utm_medium: "organic" });
    expect(origemDaEntrada("", "https://m.facebook.com/x", "/", AGORA)).toMatchObject({ utm_source: "m.facebook.com", utm_medium: "referral" });
  });

  it("vir do próprio site, ou de lado nenhum, não é origem", () => {
    expect(origemDaEntrada("", "https://clyon.pt/precos", "/simulador", AGORA)).toBeNull();
    expect(origemDaEntrada("", "https://www.clyon.pt/precos", "/simulador", AGORA)).toBeNull();
    expect(origemDaEntrada("?servico=mudanca", "", "/simulador", AGORA)).toBeNull();
  });

  it("vale 90 dias — a validade do gclid", () => {
    const o = origemDaEntrada("?gclid=x", "", "/", AGORA)!;
    const depois = (dias: number) => new Date(AGORA.getTime() + dias * 86400000);
    expect(origemAindaValida(o, depois(VALIDADE_DA_ORIGEM_DIAS - 1))).not.toBeNull();
    expect(origemAindaValida(o, depois(VALIDADE_DA_ORIGEM_DIAS + 1))).toBeNull();
  });

  it("um site de fora não apaga uma campanha que ainda vale", () => {
    const fonte = ler("src/lib/origem-da-visita.ts");
    expect(fonte).toContain("if (!temCampanha && antiga) return;");
    // E o gclid só sai com o consentimento de marketing.
    expect(fonte).toContain("if (valida.gclid && !lerConsentimentoGuardado().marketing)");
  });
});

describe("o canal que o backoffice mostra", () => {
  it("diz-se em palavras", () => {
    expect(canalDaOrigem({ gclid: "x", utm_campaign: "recolha" })).toBe("Google Ads · recolha");
    expect(canalDaOrigem({ utm_source: "google", utm_medium: "cpc" })).toBe("Google Ads");
    expect(canalDaOrigem({ utm_source: "google.com", utm_medium: "organic" })).toBe("google.com (orgânico)");
    expect(canalDaOrigem({ utm_source: "facebook", utm_medium: "social", utm_campaign: "outono" })).toBe("facebook · social · outono");
    expect(canalDaOrigem(null)).toBeNull();
  });

  it("lê-se do rawOrderJson, e um pedido antigo não diz nada", () => {
    expect(canalDoPedido(JSON.stringify({ origemDaVisita: { utm_source: "bing.com", utm_medium: "organic" } }))).toBe("bing.com (orgânico)");
    expect(canalDoPedido(JSON.stringify({ serviceType: "recolha_moveis" }))).toBeNull();
    expect(canalDoPedido("não é json")).toBeNull();
  });

  it("os três formulários levam a origem, e o backoffice mostra-a", () => {
    expect(ler("src/app/simulador/SimulatorThreePhaseForm.tsx")).toContain("origemDaVisita: origemDaVisita() ?? undefined,");
    expect(ler("src/app/contactos/ContactosClient.tsx")).toContain("origemDaVisita: origemDaVisita() ?? undefined,");
    expect(ler("src/components/HeroQuoteForm.tsx")).toContain("const o = origemDaVisita();");
    const rota = ler("src/app/api/hero-quote/route.ts");
    expect(rota).toContain("gclid:               gclid ?? null,");
    expect(rota).toContain("...(origemDaVisita ? { origemDaVisita } : {}),");
    expect(ler("src/components/admin/PedidoDetailModal.tsx")).toContain("canalDoPedido(order.rawOrderJson)");
  });
});

describe("os cliques de contacto contam-se no site inteiro, uma vez", () => {
  it("o ouvinte está no layout", () => {
    const layout = ler("src/app/layout.tsx");
    expect(layout).toContain("<OrigemECliques />");
  });

  it("um botão que mede o seu clique marca-o, e o ouvinte salta-o", () => {
    expect(cliqueJaMedido()).toBe(false);
    trackPhoneCall("teste");
    expect(cliqueJaMedido()).toBe(true);
    expect(ler("src/components/OrigemECliques.tsx")).toContain("if (cliqueJaMedido()) return;");
  });
});

describe("Consent Mode v2, no modo básico", () => {
  it("os quatro sinais saem da escolha da pessoa", () => {
    expect(sinaisDoConsentimento({ necessary: true, analytics: true, marketing: false })).toEqual({
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "granted",
    });
    expect(Object.values(CONSENTIMENTO_NEGADO).every((v) => v === "denied")).toBe(true);
  });

  it("o «default» vai antes do «config», e quem muda de ideia manda o «update»", () => {
    const R = ler("src/components/RastreioConsentido.tsx");
    const padrao = R.indexOf("gtag('consent', 'default'");
    const config = R.indexOf("gtag('config'");
    expect(padrao).toBeGreaterThan(-1);
    expect(config).toBeGreaterThan(padrao);
    expect(R).toContain('window.gtag("consent", "update", sinaisDoConsentimento(consentimento));');
    // Modo avançado (20-10-2026): carregam antes da resposta à faixa, mas
    // sempre com o «default» negado à frente.
    expect(R).toContain("if (!consentimento) return null;");
  });
});
