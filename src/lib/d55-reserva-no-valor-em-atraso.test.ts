import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * d55 (16-11-2026): o servidor manda `comReserva` em cada valor de
 * `novoModelo.valores` da carteira, como já manda nas dívidas, para a app Pro
 * dizer «parte da CLYON (taxa da plataforma e reserva)» como o painel.
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) => s.replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("d55 — comReserva nos valores em atraso", () => {
  it("a rota da carteira põe comReserva nos valores do novo modelo, pela reserva do trabalho", () => {
    const rota = semComentarios(ler("src/app/api/profissionais/carteira/route.ts"));
    const inicio = rota.indexOf("const valores = dividasDe(");
    expect(inicio).toBeGreaterThan(-1);
    const bloco = rota.slice(inicio, rota.indexOf("}));", inicio));
    expect(bloco).toMatch(/comReserva:\s*Boolean\(trabalhos\.find\(\(t\) => t\.negociacaoId === d\.negociacaoId\)\?\.reservaCent\)/);
  });

  it("o tipo da carteira declara comReserva em novoModelo.valores", () => {
    const tipos = ler("src/app/profissionais/painel/tipos.ts");
    const inicio = tipos.indexOf("novoModelo?: {");
    const bloco = tipos.slice(inicio, tipos.indexOf("standBy:", inicio));
    expect(bloco).toContain("comReserva: boolean;");
  });
});
