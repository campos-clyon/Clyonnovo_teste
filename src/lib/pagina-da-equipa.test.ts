import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FORA_DAS_PAGINAS_DA_EQUIPA_SQL, paginaDaEquipa } from "./pagina-da-equipa";

/** Os cliques da equipa e dos parceiros não contam como lead (11-11-2026). */
describe("as páginas da equipa não contam nas métricas", () => {
  it("o backoffice, o painel e os profissionais são da equipa", () => {
    for (const p of ["/admin", "/admin?section=whatsapp", "/painel", "/profissionais", "/profissionais/painel", "https://clyon.pt/admin/x"]) {
      expect(paginaDaEquipa(p), p).toBe(true);
    }
  });

  it("as páginas dos clientes contam", () => {
    for (const p of ["/", "/simulador", "/orcamento-recolha-lisboa", "/mudancas-almada", "/administracao-de-condominios", null]) {
      expect(paginaDaEquipa(p), String(p)).toBe(false);
    }
  });

  it("o browser não mede, a rota não grava e o quadro não conta", () => {
    const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    expect(ler("src/lib/track-contact.ts")).toContain("if (paginaDaEquipa(payload.sourcePage ?? window.location?.pathname)) return;");
    expect(ler("src/lib/analytics.ts")).toContain("paginaDaEquipa(window.location?.pathname)) return;");
    expect(ler("src/app/api/leads/events/route.ts")).toContain("paginaDaEquipa(");
    const quadro = ler("src/app/api/admin/lead-events/route.ts");
    expect(quadro.split("FORA_DAS_PAGINAS_DA_EQUIPA_SQL").length - 1).toBeGreaterThanOrEqual(4);
    expect(FORA_DAS_PAGINAS_DA_EQUIPA_SQL).toContain("pagePath LIKE '/admin/%'");
  });
});
