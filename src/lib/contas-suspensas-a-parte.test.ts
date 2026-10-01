import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * AS CONTAS SUSPENSAS À PARTE — 01-10-2026.
 *
 * *«Separe contas suspensas das demais e coloque dentro de um botão.»*
 *
 * Na lista dos profissionais do backoffice, as suspensas vinham misturadas
 * com as activas. Ficam no fim, fechadas atrás de um botão que diz quantas
 * são. ⚠️ Este ficheiro lê o código: o painel abre atrás de uma sessão.
 */

const semNotas = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");
const PAINEL = semNotas(
  readFileSync(join(process.cwd(), "src/components/admin/AdminProfissionaisPanel.tsx"), "utf8"),
);

describe("as suspensas não se misturam com as outras", () => {
  it("a lista principal é só a das activas", () => {
    expect(PAINEL).toContain('const activos = visiveis.filter((p) => p.estado !== "suspenso");');
    expect(PAINEL).toContain("{activos.map(cartao)}");
    expect(PAINEL).not.toContain("{visiveis.map(");
  });

  it("as suspensas ficam atrás de um botão, fechado por omissão", () => {
    expect(PAINEL).toContain("const [verSuspensos, setVerSuspensos] = useState(false);");
    expect(PAINEL).toContain("Contas suspensas · {suspensos.length}");
    expect(PAINEL).toContain("{verSuspensos && <div");
    const botao = PAINEL.indexOf("Contas suspensas ·");
    const activas = PAINEL.indexOf("{activos.map(cartao)}");
    expect(botao).toBeGreaterThan(activas);
  });

  it("e o filtro «Suspensos» sai — o botão é o sítio delas", () => {
    expect(PAINEL).not.toContain('nome: "Suspensos"');
  });
});
