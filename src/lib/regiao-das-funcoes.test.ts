import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * AS FUNÇÕES CORREM AO PÉ DA BASE — TODAS — 07-10-2026.
 *
 * O MySQL está no Railway em Singapura e as funções corriam em Washington.
 * Medido nesse dia, sem login:
 *
 *   · cada consulta custava ~0,23 s (0,20 s sem base, 0,43 s com um SELECT);
 *     em Singapura, 0,27 s com e sem — a consulta deixou de se ver;
 *   · uma instância nova em Washington levou 21,6 s a responder ao primeiro
 *     pedido, mesmo numa rota que não toca na base: o `instrumentation.ts`
 *     corre as migrações em TODAS as instâncias, e são ~62 consultas seguidas.
 *     Em Singapura, o mesmo arranque leva 1 a 2 s.
 *
 * Por isso não há rotas noutra região, nem as que não usam a base. Tentou-se
 * deixar as de moradas e mapas em Washington, ao pé do Redis do limitador
 * (em Singapura ficam 0,22 s mais lentas), e cada instância nova delas
 * prendia o cliente 21 s a escrever uma morada.
 *
 * Para separar uma rota, primeiro o arranque tem de deixar de ir à base nas
 * instâncias que não a usam — ou o Redis tem de vir para Singapura.
 */

const VERCEL = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "..", "..", "vercel.json"), "utf8"),
) as { regions?: string[]; functions?: Record<string, { regions?: string[] }> };

describe("a região das funções", () => {
  it("o vercel.json põe as funções em Singapura, ao pé da base", () => {
    expect(VERCEL.regions).toEqual(["sin1"]);
  });

  it("nenhuma função fica noutra região", () => {
    const foraDeSingapura = Object.entries(VERCEL.functions ?? {})
      .filter(([, cfg]) => cfg.regions && JSON.stringify(cfg.regions) !== JSON.stringify(["sin1"]))
      .map(([glob, cfg]) => `${glob}: ${cfg.regions!.join(",")}`);
    expect(foraDeSingapura).toEqual([]);
  });
});
