import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * «Acabei de notar este pedido porque entrei para ver, mas não havia
 * notificações.» — o dono, 17-10-2026, com uma candidatura de
 * /quero-ser-parceiro à espera em Profissionais → Candidaturas.
 */
const DB = readFileSync(join(process.cwd(), "src/lib/db.ts"), "utf8").replace(/\r\n/g, "\n");
const NOVIDADES = DB.slice(DB.indexOf("export async function contarNovidades("), DB.indexOf("/* ── A PAPELEIRA DO SUPORTE"));

describe("o selo dos Profissionais", () => {
  it("conta também as candidaturas do site que chegaram desde a última vez", () => {
    expect(NOVIDADES).toContain(
      "SELECT COUNT(*) AS n FROM candidaturasProfissionais WHERE estado IN ('nova','convidada') AND criadoEm > ?",
    );
    expect(NOVIDADES).toContain("saida.profissionais = (saida.profissionais ?? 0) + Number(");
  });

  it("e uma falha nas candidaturas não apaga o número dos inscritos", () => {
    const i = NOVIDADES.indexOf("candidaturasProfissionais WHERE estado");
    const bloco = NOVIDADES.slice(NOVIDADES.lastIndexOf("try {", i), NOVIDADES.indexOf("}\n", NOVIDADES.indexOf("catch (e)", i)));
    expect(bloco).toContain("catch (e)");
  });
});
