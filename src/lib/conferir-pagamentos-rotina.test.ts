import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A ROTINA DE RECURSO (/api/cron/conferir-pagamentos), A SÉRIO — sem rede nem
 * base. 27-10-2026 (d16).
 *
 * Guarda R2 (o MB WAY também se pergunta), R3 (as referências novas são
 * sempre vistas e as caducadas fecham-se), R4 (uma referência fora de vigor
 * não fecha o pedido) e R6 (sem valor dito, fica por confirmar à vista).
 */

type Linha = {
  id: number;
  negociacaoId: number;
  pedidoId: number;
  providerId: number;
  metodo: "mbway" | "multibanco";
  estado: string;
  valor: number;
  referencia: string | null;
  entidade: string | null;
  expiraEm: Date | null;
};

const base = {
  linhas: [] as Linha[],
  perguntas: [] as Array<{ metodo: string; minutos: number; limite: number; dias: number }>,
  respostas: new Map<string, { ok: true; pago: boolean; valor: number | null } | { ok: false; porque: string }>(),
  consultadas: [] as string[],
  pagos: [] as number[],
  fechados: [] as Array<{ id: number; estado: string }>,
  registo: [] as string[],
  carimbo: null as null | { ok: boolean; motivo?: string | null; detalhe?: unknown },
};

vi.mock("@/lib/db", () => ({
  registarSemFalhar: async (r: { acontecimento: string }) => {
    base.registo.push(r.acontecimento);
  },
}));

vi.mock("@/lib/licoes-da-vitoria-na-base", () => ({
  carimbarPassagem: async <T,>(_n: string, fazer: () => Promise<T>, resumo: (r: T) => typeof base.carimbo) => {
    const r = await fazer();
    base.carimbo = resumo(r);
    return r;
  },
}));

vi.mock("@/lib/pedir-ao-eupago", () => ({
  estadoDaReferencia: async (_c: unknown, referencia: string) => {
    base.consultadas.push(referencia);
    return base.respostas.get(referencia) ?? { ok: true, pago: false, valor: null, porque: "x", bruto: {} };
  },
}));

vi.mock("@/lib/pagamentos-na-base", () => ({
  pendentesParaSondar: async (minutos: number, limite: number, metodo: string, dias: number) => {
    base.perguntas.push({ metodo, minutos, limite, dias });
    return base.linhas.filter((l) => l.metodo === metodo && l.estado === "pendente");
  },
  pagamentosDaNegociacao: async (n: number) => base.linhas.filter((l) => l.negociacaoId === n),
  darPorPago: async (id: number) => {
    base.pagos.push(id);
    return { feito: true };
  },
  fecharSemPagar: async (id: number, estado: string) => {
    base.fechados.push({ id, estado });
    return { feito: true };
  },
}));

beforeAll(() => {
  vi.stubEnv("CRON_SECRET", "cron-de-teste");
  vi.stubEnv("EUPAGO_API_KEY", "chave-de-teste");
});
afterAll(() => {
  vi.unstubAllEnvs();
});
// O primeiro import da rota é lento com a suite inteira a correr ao lado.
beforeAll(async () => {
  await import("@/app/api/cron/conferir-pagamentos/route");
}, 60_000);

async function correr() {
  const { GET } = await import("@/app/api/cron/conferir-pagamentos/route");
  const req = new Request("https://clyon.pt/api/cron/conferir-pagamentos", {
    headers: { authorization: "Bearer cron-de-teste" },
  });
  const r = await GET(req as never);
  return (await r.json()) as Record<string, unknown>;
}

const DIA = 86_400_000;
let seq = 0;
function linha(o: Partial<Linha>): Linha {
  seq += 1;
  return {
    id: seq,
    negociacaoId: 100 + seq,
    pedidoId: 500 + seq,
    providerId: 1,
    metodo: "multibanco",
    estado: "pendente",
    valor: 120,
    referencia: `1042958${String(seq).padStart(2, "0")}`,
    entidade: "21921",
    expiraEm: new Date(Date.now() + DIA),
    ...o,
  };
}

beforeEach(() => {
  base.linhas = [];
  base.perguntas = [];
  base.respostas.clear();
  base.consultadas = [];
  base.pagos = [];
  base.fechados = [];
  base.registo = [];
  base.carimbo = null;
});

describe("R2 — o MB WAY também tem rotina de recurso", () => {
  it("pergunta pelos MB WAY pendentes recentes, pela referência, e apanha o pago", async () => {
    const mb = linha({ metodo: "mbway", entidade: null, valor: 60, expiraEm: new Date(Date.now() - 60_000) });
    base.linhas.push(mb);
    base.respostas.set(mb.referencia!, { ok: true, pago: true, valor: 60 });
    const s = await correr();
    expect(base.perguntas.map((p) => p.metodo).sort()).toEqual(["mbway", "multibanco"]);
    const doMbway = base.perguntas.find((p) => p.metodo === "mbway")!;
    expect(doMbway.dias).toBeLessThanOrEqual(2);
    expect(base.consultadas).toContain(mb.referencia);
    expect(base.pagos).toEqual([mb.id]);
    expect(s.apanhados).toBe(1);
    expect(base.registo).toContain("pagamento_recebido");
  });

  it("um MB WAY que o euPago não sabe consultar fica por confirmar — nada fecha", async () => {
    const mb = linha({ metodo: "mbway", entidade: null });
    base.linhas.push(mb);
    base.respostas.set(mb.referencia!, { ok: false, porque: "Referência inexistente." });
    const s = await correr();
    expect(base.pagos).toEqual([]);
    expect(base.fechados).toEqual([]);
    expect((s.porConfirmar as string[])[0]).toMatch(`#${mb.id}`);
    expect(base.carimbo!.ok).toBe(false);
  });
});

describe("R3 — a rotina vê sempre as novas e fecha as caducadas", () => {
  it("pede as Multibanco dos últimos dias (a rotina não se limita às mais antigas)", async () => {
    await correr();
    const mb = base.perguntas.find((p) => p.metodo === "multibanco")!;
    expect(mb.dias).toBeGreaterThanOrEqual(5);
    expect(mb.limite).toBeGreaterThan(0);
  });

  it("uma Multibanco que passou o prazo com folga e não está paga fecha-se como expirado", async () => {
    const velha = linha({ expiraEm: new Date(Date.now() - 3 * DIA) });
    const recente = linha({ expiraEm: new Date(Date.now() - 1 * DIA) });
    base.linhas.push(velha, recente);
    base.respostas.set(velha.referencia!, { ok: true, pago: false, valor: null });
    base.respostas.set(recente.referencia!, { ok: true, pago: false, valor: null });
    const s = await correr();
    expect(base.fechados).toEqual([{ id: velha.id, estado: "expirado" }]);
    expect(s.caducados).toBe(1);
  });

  it("se o euPago não responder, não se fecha nada por idade", async () => {
    const velha = linha({ expiraEm: new Date(Date.now() - 9 * DIA) });
    base.linhas.push(velha);
    base.respostas.set(velha.referencia!, { ok: false, porque: "não respondeu" });
    await correr();
    expect(base.fechados).toEqual([]);
  });
});

describe("R4 — na rotina, uma referência fora de vigor não fecha o pedido", () => {
  it("paga uma antiga de 100 € quando a em vigor é de 120 € → por confirmar, sem pagar", async () => {
    const antiga = linha({ valor: 100 });
    const nova = linha({ valor: 120, negociacaoId: antiga.negociacaoId });
    // As duas pendentes (a antiga gerada antes de a regra nova as anular); a em vigor é a mais recente.
    base.linhas.push(antiga, nova);
    base.respostas.set(antiga.referencia!, { ok: true, pago: true, valor: 100 });
    const s = await correr();
    expect(base.pagos).toEqual([]);
    expect((s.porConfirmar as string[]).join(" ")).toMatch(/devolver/);
  });
});

describe("R6 — só dá por pago com o valor dito e a bater", () => {
  it("«paga» sem valor → por confirmar, à vista no carimbo, nada creditado", async () => {
    const l = linha({});
    base.linhas.push(l);
    base.respostas.set(l.referencia!, { ok: true, pago: true, valor: null });
    const s = await correr();
    expect(base.pagos).toEqual([]);
    expect((s.porConfirmar as string[])[0]).toMatch(/não diz o valor/);
    expect(base.carimbo!.ok).toBe(false);
    expect(String(base.carimbo!.motivo)).toMatch(/por confirmar/);
  });

  it("«paga» com outro valor → não credita", async () => {
    const l = linha({ valor: 120 });
    base.linhas.push(l);
    base.respostas.set(l.referencia!, { ok: true, pago: true, valor: 12 });
    await correr();
    expect(base.pagos).toEqual([]);
  });

  it("«paga» com o valor certo → credita", async () => {
    const l = linha({ valor: 120 });
    base.linhas.push(l);
    base.respostas.set(l.referencia!, { ok: true, pago: true, valor: 120 });
    await correr();
    expect(base.pagos).toEqual([l.id]);
  });
});
