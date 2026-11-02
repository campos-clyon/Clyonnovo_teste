import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { estadoVistoPeloCliente, FOLGA_DO_MBWAY_MS } from "./pagamento-para-o-cliente";

/**
 * O MB WAY SEM RESPOSTA — 02-11-2026 (#551). Um MB WAY por confirmar passado
 * o prazo deixa de prender o cliente: mostra-se «expirado», e ele pode pedir
 * outro ou escolher o Multibanco. E a rota de pagar responde sempre
 * `{ ok: false, error }` quando não paga.
 */

const agora = Date.parse("2026-11-02T14:30:00Z");
const ha = (ms: number) => new Date(agora - ms);

describe("estadoVistoPeloCliente", () => {
  it("MB WAY pendente dentro do prazo continua pendente", () => {
    expect(estadoVistoPeloCliente({ metodo: "mbway", estado: "pendente", expiraEm: ha(-60_000) }, agora)).toBe("pendente");
  });
  it("MB WAY pendente dentro da folga continua pendente", () => {
    expect(estadoVistoPeloCliente({ metodo: "mbway", estado: "pendente", expiraEm: ha(FOLGA_DO_MBWAY_MS - 1000) }, agora)).toBe("pendente");
  });
  it("MB WAY pendente depois do prazo e da folga é expirado", () => {
    expect(estadoVistoPeloCliente({ metodo: "mbway", estado: "pendente", expiraEm: ha(FOLGA_DO_MBWAY_MS + 1000) }, agora)).toBe("expirado");
  });
  it("Multibanco e estados fechados não mudam", () => {
    expect(estadoVistoPeloCliente({ metodo: "multibanco", estado: "pendente", expiraEm: ha(86_400_000) }, agora)).toBe("pendente");
    expect(estadoVistoPeloCliente({ metodo: "mbway", estado: "pago", expiraEm: ha(86_400_000) }, agora)).toBe("pago");
    expect(estadoVistoPeloCliente({ metodo: "mbway", estado: "pendente", expiraEm: null }, agora)).toBe("pendente");
  });
});

describe("a rota de pagar responde { ok: false, error } quando não paga", () => {
  const rota = readFileSync(join(process.cwd(), "src/app/api/pagamentos/route.ts"), "utf8").replace(/\r\n/g, "\n");
  const post = rota.slice(rota.indexOf("export async function POST"));
  it("todos os erros do POST levam ok: false", () => {
    const erros = post.match(/\{\s*(ok: false,\s*)?error:/g) ?? [];
    expect(erros.length).toBeGreaterThan(8);
    for (const e of erros) expect(e).toMatch(/ok: false/);
  });
  it("o sucesso leva ok: true", () => {
    expect((post.match(/ok: true/g) ?? []).length).toBe(2);
  });
});
