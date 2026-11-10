import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

/**
 * UM PAGAMENTO CONFIRMADO PELA CONFERÊNCIA AVISA UMA VEZ, COMO O WEBHOOK —
 * 10-11-2026 (d26).
 *
 * A conferência de hora a hora (`/api/cron/conferir-pagamentos`) apanha os
 * pagamentos que o aviso do euPago não trouxe. Dava-os por pagos e não dizia
 * nada: o cliente tinha pago e o parceiro não sabia que podia avançar. Agora
 * chama o mesmo aviso do webhook (`avisarQueOPagamentoEntrou`), e só depois de
 * `darPorPago` dizer `feito` — que a base só diz uma vez por pagamento.
 *
 * Sem rede nem base, e sem mandar nada a ninguém: os avisos são fingidos e
 * contados.
 */

type Linha = {
  id: number;
  negociacaoId: number;
  pedidoId: number;
  providerId: number;
  metodo: "mbway" | "multibanco";
  parte: "trabalho" | "diferenca" | "divida";
  estado: string;
  valor: number;
  referencia: string | null;
  entidade: string | null;
  expiraEm: Date | null;
};

const base = vi.hoisted(() => ({
  linhas: [] as Array<Record<string, unknown>>,
  // Uma lista lida antes de o estado mudar (o webhook a chegar a meio da passagem).
  lidosAntes: null as null | Array<Record<string, unknown>>,
  aoCliente: [] as Array<{ pedidoId: number; tipo: string; negociacaoId: unknown }>,
  aoParceiro: [] as Array<{ providerId: number; pedidoId: number; negociacaoId: number }>,
  registo: [] as string[],
  // A forma de pagamento da negociação, lida pelo aviso ao parceiro.
  forma: "plataforma" as string,
  falhaOAvisoAoCliente: false,
}));

vi.mock("@/lib/db", () => ({
  registarSemFalhar: async (r: { acontecimento: string }) => {
    base.registo.push(r.acontecimento);
  },
  getPool: async () => ({
    execute: async () => [[{ formaDePagamento: base.forma, semFactura: 0, createdAt: new Date("2026-11-05T10:00:00Z") }], undefined],
  }),
}));
vi.mock("@/lib/licoes-da-vitoria-na-base", () => ({
  carimbarPassagem: async <T,>(_n: string, fazer: () => Promise<T>) => fazer(),
}));
vi.mock("@/lib/pedir-ao-eupago", () => ({
  estadoDaReferencia: async (_c: unknown, referencia: string) => {
    const l = base.linhas.find((x) => x.referencia === referencia)!;
    return { ok: true, pago: true, valor: l.valor, porque: "x", bruto: {} };
  },
}));
vi.mock("@/lib/pagamentos-na-base", () => ({
  pedidosFechadosComPagamentosAbertos: async () => [],
  fecharPagamentosDoPedido: async () => 0,
  pendentesParaSondar: async (_m: number, _l: number, metodo: string) =>
    (base.lidosAntes ?? base.linhas.filter((l) => l.estado === "pendente")).filter((l) => l.metodo === metodo).map((l) => ({ ...l })),
  pagamentosDaNegociacao: async (n: number) => base.linhas.filter((l) => l.negociacaoId === n),
  // Como na base: só a primeira vez encontra a linha por pagar.
  darPorPago: async (id: number) => {
    const l = base.linhas.find((x) => x.id === id)!;
    if (l.estado !== "pendente") return { feito: false, porque: "O pagamento já estava fechado de uma forma que não admite pagamento." };
    l.estado = "pago";
    return { feito: true };
  },
  fecharSemPagar: async () => ({ feito: false, porque: "x" }),
}));
vi.mock("@/lib/avisos-ao-cliente", () => ({
  avisarOClienteDoPedido: async (pedidoId: number, tipo: string, extra: { negociacaoId?: unknown } = {}) => {
    if (base.falhaOAvisoAoCliente) throw new Error("o envio falhou");
    base.aoCliente.push({ pedidoId, tipo, negociacaoId: extra.negociacaoId });
  },
}));
vi.mock("@/lib/avisar-por-push", () => ({
  avisarProfissionalClientePagouPorPush: async (d: { providerId: number; pedidoId: number; negociacaoId: number }) => {
    base.aoParceiro.push(d);
  },
}));

beforeAll(() => {
  vi.stubEnv("CRON_SECRET", "cron-de-teste");
  vi.stubEnv("EUPAGO_API_KEY", "chave-de-teste");
});
afterAll(() => {
  vi.unstubAllEnvs();
});
beforeAll(async () => {
  await import("@/app/api/cron/conferir-pagamentos/route");
}, 60_000);

async function conferencia() {
  const { GET } = await import("@/app/api/cron/conferir-pagamentos/route");
  const r = await GET(
    new Request("https://clyon.pt/api/cron/conferir-pagamentos", { headers: { authorization: "Bearer cron-de-teste" } }) as never,
  );
  return (await r.json()) as { apanhados: number };
}

let seq = 0;
function linha(o: Partial<Linha> = {}): Linha {
  seq += 1;
  const l: Linha = {
    id: seq,
    negociacaoId: 100 + seq,
    pedidoId: 600 + seq,
    providerId: 40 + seq,
    metodo: "multibanco",
    parte: "trabalho",
    estado: "pendente",
    valor: 120,
    referencia: `2042958${String(seq).padStart(2, "0")}`,
    entidade: "21921",
    expiraEm: new Date(Date.now() + 86_400_000),
    ...o,
  };
  base.linhas.push(l as unknown as Record<string, unknown>);
  return l;
}

beforeEach(() => {
  base.linhas = [];
  base.lidosAntes = null;
  base.aoCliente = [];
  base.aoParceiro = [];
  base.registo = [];
  base.forma = "plataforma";
  base.falhaOAvisoAoCliente = false;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("d26 — a conferência de hora a hora avisa como o webhook", () => {
  it("apanha um pagamento do trabalho: o cliente lê «pago» e o parceiro que o cliente pagou — uma vez cada", async () => {
    const l = linha();
    const s = await conferencia();
    expect(s.apanhados).toBe(1);
    expect(base.aoCliente).toEqual([{ pedidoId: l.pedidoId, tipo: "pago", negociacaoId: l.negociacaoId }]);
    expect(base.aoParceiro).toEqual([{ providerId: l.providerId, pedidoId: l.pedidoId, negociacaoId: l.negociacaoId }]);
    expect(base.registo).toEqual(["pagamento_recebido"]);
  });

  it("a passagem seguinte não repete o aviso", async () => {
    linha();
    await conferencia();
    await conferencia();
    expect(base.aoCliente).toHaveLength(1);
    expect(base.aoParceiro).toHaveLength(1);
  });

  it("se o pagamento já foi dado por pago (o webhook chegou primeiro), a conferência não avisa", async () => {
    const l = linha();
    // A conferência leu a lista com ele ainda pendente; o webhook pagou-o entretanto.
    base.lidosAntes = [{ ...l }];
    l.estado = "pago";
    const s = await conferencia();
    expect(s.apanhados).toBe(0);
    expect(base.aoCliente).toEqual([]);
    expect(base.aoParceiro).toEqual([]);
  });

  it("a dívida do parceiro num pago em mão não é aviso do cliente, nem «o cliente pagou»", async () => {
    linha({ parte: "divida" });
    await conferencia();
    expect(base.aoCliente).toEqual([]);
    expect(base.aoParceiro).toEqual([]);
  });

  it("a diferença das horas avisa o cliente, e não o parceiro (como no webhook)", async () => {
    const l = linha({ parte: "diferenca" });
    await conferencia();
    expect(base.aoCliente).toEqual([{ pedidoId: l.pedidoId, tipo: "pago", negociacaoId: l.negociacaoId }]);
    expect(base.aoParceiro).toEqual([]);
  });

  it("um aviso que falhe não pára a conferência nem desfaz o pagamento", async () => {
    const a = linha();
    const b = linha();
    base.falhaOAvisoAoCliente = true;
    const s = await conferencia();
    expect(s.apanhados).toBe(2);
    expect(base.linhas.map((l) => l.estado)).toEqual(["pago", "pago"]);
    expect(base.aoParceiro.map((p) => p.pedidoId)).toEqual([a.pedidoId, b.pedidoId]);
    expect(base.registo).toEqual(["pagamento_recebido", "pagamento_recebido"]);
  });
});

describe("d26 — o aviso é um só, e só depois de o pagamento ficar dado por pago", () => {
  const ler = (f: string) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
  /** Sem os comentários de bloco no início da linha — a regra ancorada. */
  const semComentarios = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "");

  for (const f of ["src/app/api/pagamentos/webhook/route.ts", "src/app/api/cron/conferir-pagamentos/route.ts"]) {
    it(`${f} chama-o uma vez, dentro do «feito» de darPorPago`, () => {
      const s = semComentarios(ler(f));
      expect(s.match(/await avisarQueOPagamentoEntrou\(p\);/g), f).toHaveLength(1);
      const paga = s.search(/= await darPorPago\(/);
      const feito = s.search(/if \((r|feito)\.feito\) \{/);
      const avisa = s.indexOf("await avisarQueOPagamentoEntrou(p);");
      expect(paga, f).toBeGreaterThan(-1);
      expect(feito, f).toBeGreaterThan(paga);
      expect(avisa, f).toBeGreaterThan(feito);
      // Dentro do bloco do «feito»: antes do ramo do duplicado.
      const duplicado = s.search(/if \((r|feito)\.duplicado\) \{/);
      expect(duplicado, f).toBeGreaterThan(-1);
      expect(avisa, f).toBeLessThan(duplicado);
      // Nenhuma das duas rotas manda os avisos por fora da função comum.
      expect(s, f).not.toContain("avisarOClienteDoPedido(");
      expect(s, f).not.toContain("avisarProfissionalClientePagouPorPush(");
    });
  }
});
