import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";

/**
 * UMA MUDANÇA DE VALOR RECUSADA NÃO AVISA NINGUÉM — 10-11-2026 (d26).
 *
 * Nos Trabalhos CLYON, a rota apagava a proposta enviada ao cliente (e o
 * «Aceito este preço» dele) e mandava-lhe «O preço mudou» ANTES de ver se a
 * mudança tinha sido aceite. Um valor igual ao que lá estava, um trabalho já
 * feito ou um pedido arrumado respondiam com erro à equipa — e o cliente já
 * tinha recebido o aviso, com o preço dele por aceitar outra vez.
 *
 * A rota corre aqui a sério; da base só se fingem as funções que ela chama.
 */

const base = vi.hoisted(() => ({
  mudanca: { ok: false, porque: "igual" } as Record<string, unknown>,
  preco: undefined as undefined | { antes: number | null },
  propostaEnviadaEm: new Date("2026-11-09T10:00:00Z") as Date | null,
  limpas: [] as number[],
  avisos: [] as Array<[number, string]>,
  historico: [] as string[],
}));

vi.mock("@/lib/db", async (original) => ({
  ...(await original<typeof import("@/lib/db")>()),
  mudarValorDoTrabalhoClyon: vi.fn(async () => base.mudanca),
  definirPrecoAoClienteClyon: vi.fn(async () => base.preco),
  getSimulatorOrderById: vi.fn(async (id: number) => ({ id, valorFixoClyon: "260.00", propostaEnviadaEm: base.propostaEnviadaEm })),
  limparPropostaEnviada: vi.fn(async (id: number) => {
    base.limpas.push(id);
  }),
  appendOrderHistory: vi.fn(async (_id: number, e: { message: string }) => {
    base.historico.push(e.message);
  }),
  registarSemFalhar: vi.fn(async () => {}),
}));
vi.mock("@/lib/admin-auth-helper", () => ({
  requireAdmin: vi.fn(async () => ({ err: null, colab: { id: 1, nome: "a equipa", isAdmin: true, papel: "admin" } })),
}));
vi.mock("@/lib/avisos-do-backoffice", () => ({
  avisarCliente: vi.fn((pedidoId: number, tipo: string) => {
    base.avisos.push([pedidoId, tipo]);
  }),
}));
vi.mock("@/lib/avisar-trabalho-clyon", () => ({
  avisarValorNovoDoTrabalhoClyon: vi.fn(async () => 0),
  avisarCancelamentoDoTrabalhoClyon: vi.fn(async () => 0),
}));

import { taxaPeloValor } from "@/lib/oferta-clyon";

let PATCH: typeof import("@/app/api/admin/trabalhos-clyon/route").PATCH;
beforeAll(async () => {
  ({ PATCH } = await import("@/app/api/admin/trabalhos-clyon/route"));
}, 120_000);

beforeEach(() => {
  base.mudanca = { ok: false, porque: "igual" };
  base.preco = undefined;
  base.propostaEnviadaEm = new Date("2026-11-09T10:00:00Z");
  base.limpas = [];
  base.avisos = [];
  base.historico = [];
});

const pedir = (corpo: Record<string, unknown>) =>
  PATCH(
    new NextRequest("https://clyon.pt/api/admin/trabalhos-clyon", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
    }),
  );

const mudarValor = () => pedir({ pedidoId: 700, accao: "valor", valor: 300, taxa: taxaPeloValor(300) });

describe("d26 — mudar o valor de um Trabalho CLYON", () => {
  for (const [porque, estado] of [
    ["igual", 400],
    ["ja_feito", 409],
    ["arrumado", 409],
    ["nao_e_clyon", 404],
  ] as const) {
    it(`recusada («${porque}»): o cliente não é avisado e a proposta enviada fica como estava`, async () => {
      base.mudanca = { ok: false, porque };
      const r = await mudarValor();
      expect(r.status).toBe(estado);
      expect(base.avisos).toEqual([]);
      expect(base.limpas).toEqual([]);
      expect(base.historico).toEqual([]);
    });
  }

  it("aceite, com o preço já enviado: a proposta volta a ter de ser enviada e o cliente lê «o preço mudou», uma vez", async () => {
    base.mudanca = { ok: true, antes: { valor: 260, taxa: null, base: "total" }, avisar: [] };
    const r = await mudarValor();
    expect(r.status).toBe(200);
    expect(base.limpas).toEqual([700]);
    expect(base.avisos).toEqual([[700, "preco_mudou"]]);
  });

  it("aceite, sem preço enviado: limpa-se na mesma e não há aviso a dar", async () => {
    base.mudanca = { ok: true, antes: { valor: 260, taxa: null, base: "total" }, avisar: [] };
    base.propostaEnviadaEm = null;
    const r = await mudarValor();
    expect(r.status).toBe(200);
    expect(base.limpas).toEqual([700]);
    expect(base.avisos).toEqual([]);
  });

  it("só o motivo da taxa mudou: ninguém é incomodado", async () => {
    base.mudanca = { ok: true, soOMotivo: true, antes: { valor: 300, taxa: null, base: "total" }, avisar: [] };
    const r = await mudarValor();
    expect(r.status).toBe(200);
    expect(base.limpas).toEqual([]);
    expect(base.avisos).toEqual([]);
  });
});

describe("d26 — mudar o preço ao cliente (o segundo sítio com o mesmo padrão)", () => {
  it("recusado (não é um Trabalho CLYON): nem limpa a proposta enviada nem avisa", async () => {
    base.preco = undefined;
    const r = await pedir({ pedidoId: 701, accao: "preco", precoAoCliente: 320 });
    expect(r.status).toBe(404);
    expect(base.limpas).toEqual([]);
    expect(base.avisos).toEqual([]);
  });

  it("gravado, com o preço já enviado: limpa e avisa, uma vez", async () => {
    base.preco = { antes: 300 };
    const r = await pedir({ pedidoId: 701, accao: "preco", precoAoCliente: 320 });
    expect(r.status).toBe(200);
    expect(base.limpas).toEqual([701]);
    expect(base.avisos).toEqual([[701, "preco_mudou"]]);
  });
});

describe("d26 — a ordem, no código da rota", () => {
  const ROTA = readFileSync("src/app/api/admin/trabalhos-clyon/route.ts", "utf8").replace(/\r\n/g, "\n");
  /** Sem os comentários de bloco no início da linha — a regra ancorada. */
  const semComentarios = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "");

  it("no valor, a recusa sai antes de se limpar a proposta e de se avisar o cliente", () => {
    const i = ROTA.indexOf("await mudarValorDoTrabalhoClyon(");
    expect(i).toBeGreaterThan(-1);
    const bloco = semComentarios(ROTA.slice(i, ROTA.indexOf('if (accao === "cancelar")', i)));
    const recusa = bloco.indexOf("if (!r.ok) {");
    const limpa = bloco.indexOf("await limparPropostaEnviada(pedidoId);");
    const avisa = bloco.indexOf('await avisarCliente(pedidoId, "preco_mudou")');
    for (const p of [recusa, limpa, avisa]) expect(p).toBeGreaterThan(-1);
    expect(recusa).toBeLessThan(limpa);
    expect(limpa).toBeLessThan(avisa);
  });

  it("no preço, o 404 sai antes de se limpar a proposta e de se avisar o cliente", () => {
    const i = ROTA.indexOf("await definirPrecoAoClienteClyon(");
    expect(i).toBeGreaterThan(-1);
    const bloco = ROTA.slice(i, i + 900);
    const recusa = bloco.indexOf("if (!r) return NextResponse.json(");
    const limpa = bloco.indexOf("await limparPropostaEnviada(pedidoId);");
    const avisa = bloco.indexOf('await avisarCliente(pedidoId, "preco_mudou")');
    for (const p of [recusa, limpa, avisa]) expect(p).toBeGreaterThan(-1);
    expect(recusa).toBeLessThan(limpa);
    expect(limpa).toBeLessThan(avisa);
  });
});
