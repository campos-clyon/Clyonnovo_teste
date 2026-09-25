import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * «Porque é que eu não consigo editar para corrigir o erro?» — 25-09-2026.
 *
 * O Jorge escreveu «Merce» e a base foi parar perto de Penafiel: com 200 km de
 * raio medidos de lá, nenhum pedido de Lisboa lhe chegava. O backoffice não
 * tinha onde mudar a morada, e o «re-geocodificar» voltava a procurar «Merce».
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("a morada da base corrige-se no backoffice", () => {
  const ROTA = semComentarios(ler("src/app/api/admin/profissionais/[id]/route.ts"));
  const PAINEL = semComentarios(ler("src/components/admin/AdminProfissionaisPanel.tsx"));

  it("a rota grava a morada e o ponto juntos", () => {
    expect(ROTA).toContain("corpo.cidade !== undefined");
    expect(ROTA).toContain("UPDATE providers SET city = ?, baseLat = ?, baseLng = ?");
  });

  it("o ponto escolhido da lista manda sobre o palpite do texto", () => {
    expect(ROTA).toContain("escolhidas ?? (await geocodificarLocalidade(cidade))");
  });

  it("o painel usa a mesma lista do Google que o profissional", () => {
    expect(PAINEL).toContain("<MoradaDaBase");
    expect(PAINEL).toContain("cidade: base.morada, baseLat: base.lat, baseLng: base.lng");
  });
});
