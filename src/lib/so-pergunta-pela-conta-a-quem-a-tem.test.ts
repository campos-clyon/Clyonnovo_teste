import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A localização do cabeçalho perguntava pela conta a toda a gente.
 *
 * O LocationProvider chamava GET /api/users/me a cada visitante, com ou sem
 * sessão — e a quem não tem sessão a rota responde 401, que o browser escreve
 * a vermelho na consola em todas as páginas do site.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("a localização não pergunta pela conta a quem não a tem", () => {
  it("só chama /api/users/me com sessão iniciada", () => {
    const LOCALIZACAO = ler("src/contexts/LocationContext.tsx");
    expect(LOCALIZACAO).toContain("const { status: estadoDaSessao } = useSession();");
    // Enquanto a sessão se lê, não se decide nada.
    expect(LOCALIZACAO).toContain("if (estadoDaSessao === 'loading') return;");
    expect(LOCALIZACAO).toMatch(/estadoDaSessao === 'authenticated'\s*\?\s*await fetch\('\/api\/users\/me'/);
  });

  it("e o SessionProvider está por fora dela — sem ele, o useSession rebenta", () => {
    const LAYOUT = ler("src/app/layout.tsx");
    const sessao = LAYOUT.indexOf("<AuthClientProvider>");
    const localizacao = LAYOUT.indexOf("<LocationProvider>");
    expect(sessao).toBeGreaterThan(-1);
    expect(localizacao).toBeGreaterThan(sessao);
    expect(LAYOUT.indexOf("</LocationProvider>")).toBeLessThan(LAYOUT.indexOf("</AuthClientProvider>"));
  });
});
