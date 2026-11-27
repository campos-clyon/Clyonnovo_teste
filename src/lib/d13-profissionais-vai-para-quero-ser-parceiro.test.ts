import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * d13 (27-11-2026): /profissionais redireciona (308) para /quero-ser-parceiro. O
 * redirect vive no next.config, que corre antes do middleware — por isso o portão
 * de /profissionais (`exigeChave`) não o apanha, e as secções privadas por baixo
 * continuam fechadas.
 */
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("/profissionais → /quero-ser-parceiro", () => {
  it("o next.config tem o redirect permanente (308) só do endereço exacto", async () => {
    const { default: config } = await import("../../next.config");
    const regras = await config.redirects!();
    const r = regras.find((x) => x.source === "/profissionais");
    expect(r).toMatchObject({ destination: "/quero-ser-parceiro", permanent: true });
    expect(regras.some((x) => x.source.startsWith("/profissionais/"))).toBe(false);
  });

  it("o portão continua a fechar as secções privadas", () => {
    const m = ler("src/middleware.ts");
    expect(m).toContain('caminho === "/profissionais"');
    expect(m).toContain('caminho.startsWith("/profissionais/")');
  });

  it("o sitemap não lista /profissionais (só os perfis)", () => {
    expect(ler("src/app/sitemap.ts")).not.toMatch(/\$\{SITE_URL\}\/profissionais["`']/);
  });
});
