import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * As propostas de 23-10-2026, aprovadas pelo CEO e pelo dono.
 */
const ler = (f: string) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");

describe("propostas de 23/10", () => {
  it("p1: o Next.js está na versão corrigida", () => {
    const pkg = JSON.parse(ler("package.json"));
    expect(pkg.dependencies.next).toBe("15.5.28");
    expect(pkg.pnpm.overrides["source-map-js@<1.2.2"]).toBe("^1.2.2");
  });

  it("p3: o convite para o teste da app só aparece em Android, a quem não a tem", () => {
    const convite = ler("src/app/profissionais/painel/ConviteDaAppPro.tsx");
    expect(convite).toContain('"https://play.google.com/apps/testing/pt.clyon.pro"');
    expect(convite).toContain("if (!/Android/i.test(navigator.userAgent)) return;");
    expect(convite).toContain("d.temApp === false");
    expect(convite).toContain("Agora não");
    expect(ler("src/app/profissionais/painel/PainelDoProfissional.tsx")).toContain("<ConviteDaAppPro />");
    const rota = ler("src/app/api/profissionais/dispositivo/route.ts");
    expect(rota).toContain("export async function GET(");
    expect(rota).toContain("temApp: subs.some((s) => eTokenDaApp(s.endpoint))");
  });

  it("p6: /privacidade e /cookies estão no sitemap", () => {
    const s = ler("src/app/sitemap.ts");
    expect(s).toContain("${SITE_URL}/privacidade`");
    expect(s).toContain("${SITE_URL}/cookies`");
  });
});
