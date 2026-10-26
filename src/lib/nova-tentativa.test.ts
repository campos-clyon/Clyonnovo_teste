import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { comNovaTentativa, falhaDeRede } from "./nova-tentativa";

/**
 * A SEGUNDA TENTATIVA DO ARRANQUE — 26-10-2026 (d32, parte G).
 *
 * Nos registos da Vercel, o arranque do cron da purga dava «migração de schema
 * falhou: ETIMEDOUT» duas noites seguidas. Uma falha de rede tenta-se outra
 * vez; um erro de SQL diz-se logo.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

describe("G — o arranque do cron com uma segunda tentativa (ETIMEDOUT)", () => {
  it("uma falha de rede tenta outra vez, e passa", async () => {
    let vezes = 0;
    const r = await comNovaTentativa(
      async () => {
        vezes += 1;
        if (vezes === 1) throw Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" });
        return "ok";
      },
      { dormir: async () => {} },
    );
    expect(r).toBe("ok");
    expect(vezes).toBe(2);
  });

  it("um erro que não é de rede não se repete", async () => {
    const trabalho = vi.fn(async () => {
      throw Object.assign(new Error("Unknown column"), { code: "ER_BAD_FIELD_ERROR" });
    });
    await expect(comNovaTentativa(trabalho, { dormir: async () => {} })).rejects.toThrow("Unknown column");
    expect(trabalho).toHaveBeenCalledTimes(1);
  });

  it("e desiste ao fim das tentativas, com o erro de rede", async () => {
    const trabalho = vi.fn(async () => {
      throw Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" });
    });
    await expect(comNovaTentativa(trabalho, { tentativas: 3, dormir: async () => {} })).rejects.toThrow("ETIMEDOUT");
    expect(trabalho).toHaveBeenCalledTimes(3);
    expect(falhaDeRede({ code: "PROTOCOL_CONNECTION_LOST" })).toBe(true);
    expect(falhaDeRede(new Error("Duplicate column"))).toBe(false);
  });

  it("o instrumentation usa-a nas migrações do arranque", () => {
    const inst = ler("src/instrumentation.ts");
    expect(inst).toContain('await import("@/lib/nova-tentativa")');
    expect(inst).toMatch(/await comNovaTentativa\(async \(\) => \{\s*await ensureUsersSchema\(\);\s*await ensureProvidersSchema\(\);/);
  });
});
