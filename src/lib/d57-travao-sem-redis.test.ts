import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * d57 (16-11-2026): se o Redis do travão de pedidos falhar, o travão passa ao
 * limite em memória — não deixa passar tudo.
 */
vi.mock("@upstash/redis", () => {
  class Redis {
    pipeline() {
      const p = {
        incr: () => p,
        expire: () => p,
        exec: async () => {
          throw new Error("Redis em baixo");
        },
      };
      return p;
    }
  }
  return { Redis };
});

describe("d57 — o travão com o Redis a falhar", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("KV_REST_API_URL", "https://exemplo.invalid");
    vi.stubEnv("KV_REST_API_TOKEN", "teste");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("passa ao limite em memória: deixa até ao limite e trava o seguinte", async () => {
    const { checkRateLimit } = await import("./rate-limit");
    const chave = `teste-d57:${Math.random()}`;
    const r1 = await checkRateLimit(chave, 2, 60);
    const r2 = await checkRateLimit(chave, 2, 60);
    const r3 = await checkRateLimit(chave, 2, 60);
    expect(r1).toMatchObject({ allowed: true, count: 1, limit: 2 });
    expect(r2).toMatchObject({ allowed: true, count: 2 });
    expect(r3).toMatchObject({ allowed: false, count: 3 });
  });

  it("chaves diferentes contam à parte", async () => {
    const { checkRateLimit } = await import("./rate-limit");
    const a = `teste-d57-a:${Math.random()}`;
    const b = `teste-d57-b:${Math.random()}`;
    expect((await checkRateLimit(a, 1, 60)).allowed).toBe(true);
    expect((await checkRateLimit(a, 1, 60)).allowed).toBe(false);
    expect((await checkRateLimit(b, 1, 60)).allowed).toBe(true);
  });
});
