import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bearerConfere, segredoIgual } from "./segredo-igual";

/**
 * Os crons comparavam o CRON_SECRET com `!==`, que desiste no primeiro
 * carácter diferente — e a diferença de tempo diz quanto do segredo acertou.
 */

const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("segredoIgual", () => {
  it("só o mesmo segredo passa", () => {
    expect(segredoIgual("s3gr3d0-longo", "s3gr3d0-longo")).toBe(true);
    expect(segredoIgual("s3gr3d0-longX", "s3gr3d0-longo")).toBe(false);
    expect(segredoIgual("curto", "s3gr3d0-longo")).toBe(false);
  });

  it("sem segredo configurado, nada passa", () => {
    expect(segredoIgual("", "")).toBe(false);
    expect(segredoIgual("qualquer", undefined)).toBe(false);
    expect(segredoIgual(null, "s3gr3d0")).toBe(false);
  });
});

describe("bearerConfere", () => {
  it("lê o cabeçalho Authorization", () => {
    expect(bearerConfere("Bearer s3gr3d0", "s3gr3d0")).toBe(true);
    expect(bearerConfere("Bearer outro", "s3gr3d0")).toBe(false);
    expect(bearerConfere("bearer s3gr3d0", "s3gr3d0")).toBe(false);
    expect(bearerConfere("s3gr3d0", "s3gr3d0")).toBe(false);
    expect(bearerConfere(null, "s3gr3d0")).toBe(false);
    expect(bearerConfere("Bearer s3gr3d0", "")).toBe(false);
  });
});

describe("todos os crons comparam em tempo constante", () => {
  const PASTA = join(process.cwd(), "src", "app", "api", "cron");
  const CRONS = readdirSync(PASTA).map((d) => ({
    nome: d,
    codigo: semComentarios(readFileSync(join(PASTA, d, "route.ts"), "utf8")),
  }));

  it("há crons que chegue para o teste valer", () => {
    expect(CRONS.length).toBeGreaterThanOrEqual(6);
  });

  it.each(CRONS.map((c) => [c.nome, c.codigo]))("%s", (_nome, codigo) => {
    expect(codigo).toContain('bearerConfere(req.headers.get("authorization"), secret)');
    expect(codigo).not.toMatch(/!==\s*`Bearer/);
    // A falha continua fechada sem segredo.
    expect(codigo).toContain("if (!secret)");
  });
});
