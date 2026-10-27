import crypto from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A ROTA DO WEBHOOK DO euPAGO, A SÉRIO — sem rede nem base. 27-10-2026 (d16).
 *
 * Até aqui só se testavam as funções puras (`webhook-do-eupago.test.ts`). Isto
 * chama o `POST` da rota com avisos assinados como o euPago assina, e uma base
 * em memória que imita o que a verdadeira garante: o índice único dos avisos
 * (trid, estado), o «só se paga o que ainda pode ser pago», um pago por
 * trabalho, e a transacção que dá por pago e marca o aviso aplicado de uma vez.
 *
 * Guarda R1 (aviso que falhou a meio volta a aplicar-se), R4 (referência
 * antiga de outro valor não fecha o pedido) e R5 (referência e ambiente têm de
 * bater), além do que já era verdade: aviso falso, adulterado, repetido e de
 * valor errado não pagam nada.
 */

type Linha = {
  id: number;
  negociacaoId: number;
  pedidoId: number;
  providerId: number;
  metodo: "mbway" | "multibanco";
  estado: string;
  ambiente: "producao" | "sandbox";
  valor: number;
  referencia: string | null;
  negociacaoPaga: number | null;
  trid: string | null;
  valorPago: number | null;
};
type Aviso = { aplicado: boolean; nota: string | null };

const base = {
  pagamentos: new Map<number, Linha>(),
  avisos: new Map<string, Aviso>(),
  registo: [] as Array<{ acontecimento: string; resumo?: string }>,
  falharDarPorPago: 0,
};

vi.mock("@/lib/db", () => ({
  registarSemFalhar: async (r: { acontecimento: string; resumo?: string }) => {
    base.registo.push(r);
  },
}));

vi.mock("@/lib/pagamentos-na-base", async (original) => {
  const real = await original<typeof import("@/lib/pagamentos-na-base")>();
  return {
    // A regra do «ficou a meio» é a verdadeira.
    avisoFicouAMeio: real.avisoFicouAMeio,
    anotarRecusa: async () => {},
    guardarAviso: async (a: { trid: string; estado: string }) => {
      const k = `${a.trid}|${a.estado}`;
      const ja = base.avisos.get(k);
      if (ja) return { novo: false, avisoId: 1, aplicado: ja.aplicado, nota: ja.nota };
      base.avisos.set(k, { aplicado: false, nota: null });
      return { novo: true, avisoId: 1, aplicado: false, nota: null };
    },
    // Como na base: nunca desfaz um aplicado.
    anotarAviso: async (trid: string, estado: string, d: { aplicado: boolean; nota?: string | null }) => {
      const k = `${trid}|${estado}`;
      if (base.avisos.get(k)?.aplicado) return;
      base.avisos.set(k, { aplicado: d.aplicado, nota: d.nota ?? null });
    },
    pagamentoPorId: async (id: number) => {
      const l = base.pagamentos.get(id);
      return l ? { ...l } : null;
    },
    pagamentosDaNegociacao: async (negociacaoId: number) =>
      [...base.pagamentos.values()].filter((l) => l.negociacaoId === negociacaoId).sort((a, b) => b.id - a.id),
    darPorPago: async (
      id: number,
      negociacaoId: number,
      d: { trid: string; valorPago: number | null },
      aviso?: { trid: string; estado: string },
    ) => {
      if (base.falharDarPorPago > 0) {
        base.falharDarPorPago -= 1;
        throw new Error("Lock wait timeout exceeded (simulado)");
      }
      const l = base.pagamentos.get(id)!;
      if (!real.AINDA_PODE_SER_PAGO.includes(l.estado as never)) {
        return { feito: false, porque: "fechado" };
      }
      for (const o of base.pagamentos.values()) {
        if (o.negociacaoPaga === negociacaoId) return { feito: false, duplicado: true, porque: "duplicado" };
      }
      // A transacção: o pagamento e o aviso, juntos.
      Object.assign(l, { estado: "pago", negociacaoPaga: negociacaoId, trid: d.trid, valorPago: d.valorPago });
      if (aviso) base.avisos.set(`${aviso.trid}|${aviso.estado}`, { aplicado: true, nota: null });
      return { feito: true };
    },
    darPorReembolsado: async () => ({ feito: true }),
    fecharSemPagar: async (id: number, estado: string) => {
      const l = base.pagamentos.get(id)!;
      if (l.estado !== "pendente") return { feito: false, porque: "já não pendente" };
      l.estado = estado;
      return { feito: true };
    },
  };
});

const SEGREDO = "segredo-de-teste-producao";
const SEGREDO_SANDBOX = "segredo-de-teste-sandbox";

beforeAll(() => {
  vi.stubEnv("EUPAGO_API_KEY", "chave-de-teste");
  vi.stubEnv("EUPAGO_AMBIENTE", "producao");
  vi.stubEnv("EUPAGO_WEBHOOK_SEGREDO", SEGREDO);
  vi.stubEnv("EUPAGO_WEBHOOK_SEGREDO_SANDBOX", SEGREDO_SANDBOX);
});
afterAll(() => {
  vi.unstubAllEnvs();
});
// O primeiro import da rota é lento com a suite inteira a correr ao lado.
beforeAll(async () => {
  await import("@/app/api/pagamentos/webhook/route");
}, 60_000);

function assinar(corpo: string, segredo = SEGREDO) {
  return crypto.createHmac("sha256", segredo).update(corpo, "utf8").digest("base64");
}

function aviso(o: { trid: string; id: number; valor: number; status?: string; referencia?: string }) {
  return JSON.stringify({
    transactions: {
      trid: o.trid,
      identifier: `clyon-site-${o.id}`,
      status: o.status ?? "Paid",
      method: "Mbway",
      amount: { value: o.valor, currency: "EUR" },
      date: "2026-10-27 10:00:00",
      ...(o.referencia ? { reference: o.referencia } : {}),
    },
  });
}

async function chamar(corpo: string, assinatura: string | null) {
  const { POST } = await import("@/app/api/pagamentos/webhook/route");
  const headers = new Headers({ "content-type": "application/json" });
  if (assinatura) headers.set("x-signature", assinatura);
  const req = new Request("https://clyon.pt/api/pagamentos/webhook", { method: "POST", headers, body: corpo });
  return POST(req as never);
}

function linha(o: Partial<Linha> & { id: number }): Linha {
  return {
    negociacaoId: 70,
    pedidoId: 501,
    providerId: 1,
    metodo: "mbway",
    estado: "pendente",
    ambiente: "producao",
    valor: 452.03,
    referencia: "104295830",
    negociacaoPaga: null,
    trid: null,
    valorPago: null,
    ...o,
  };
}

const recebidos = () => base.registo.filter((r) => r.acontecimento === "pagamento_recebido");

beforeEach(() => {
  base.pagamentos.clear();
  base.avisos.clear();
  base.registo.length = 0;
  base.falharDarPorPago = 0;
  base.pagamentos.set(7, linha({ id: 7 }));
});

describe("o que já era verdade, agora provado na rota", () => {
  it("aviso FALSO (sem assinatura, inventada, outro segredo) → 401, nada pago", async () => {
    const corpo = aviso({ trid: "T1", id: 7, valor: 452.03 });
    expect((await chamar(corpo, null)).status).toBe(401);
    expect((await chamar(corpo, "AAAA")).status).toBe(401);
    expect((await chamar(corpo, assinar(corpo, "outro-segredo"))).status).toBe(401);
    expect(base.pagamentos.get(7)!.estado).toBe("pendente");
    expect(base.avisos.size).toBe(0);
  });

  it("corpo mexido depois de assinado → 401", async () => {
    const corpo = aviso({ trid: "T1", id: 7, valor: 1 });
    const mexido = corpo.replace('"value":1', '"value":452.03');
    expect((await chamar(mexido, assinar(corpo))).status).toBe(401);
    expect(base.pagamentos.get(7)!.estado).toBe("pendente");
  });

  it("aviso verdadeiro → pago; REPETIDO → 200 sem segundo crédito", async () => {
    const corpo = aviso({ trid: "T1", id: 7, valor: 452.03 });
    expect((await chamar(corpo, assinar(corpo))).status).toBe(200);
    expect(base.pagamentos.get(7)!.estado).toBe("pago");
    expect(base.avisos.get("T1|pago")).toEqual({ aplicado: true, nota: null });
    expect((await chamar(corpo, assinar(corpo))).status).toBe(200);
    expect(recebidos()).toHaveLength(1);
  });

  it("VALOR ERRADO → não paga, fica por aplicar e à vista", async () => {
    const corpo = aviso({ trid: "T2", id: 7, valor: 5 });
    expect((await chamar(corpo, assinar(corpo))).status).toBe(200);
    expect(base.pagamentos.get(7)!.estado).toBe("pendente");
    expect(base.avisos.get("T2|pago")!.aplicado).toBe(false);
    expect(base.avisos.get("T2|pago")!.nota).toMatch(/5\.00/);
    expect(base.registo.some((r) => r.acontecimento === "pagamento_falhado")).toBe(true);
  });

  it("«expirado» depois do «pago» não desfaz", async () => {
    const pago = aviso({ trid: "T3", id: 7, valor: 452.03 });
    await chamar(pago, assinar(pago));
    const exp = aviso({ trid: "T3", id: 7, valor: 452.03, status: "Expired" });
    expect((await chamar(exp, assinar(exp))).status).toBe(200);
    expect(base.pagamentos.get(7)!.estado).toBe("pago");
  });
});

describe("R1 — o aviso que falhou a meio volta a aplicar-se quando o euPago repete", () => {
  it("base em baixo → 500; a repetição aplica, uma vez só", async () => {
    base.falharDarPorPago = 1;
    const corpo = aviso({ trid: "T4", id: 7, valor: 452.03 });
    expect((await chamar(corpo, assinar(corpo))).status).toBe(500);
    // Ficou guardado como recebido, por aplicar e sem nota: a meio.
    expect(base.avisos.get("T4|pago")).toEqual({ aplicado: false, nota: null });
    expect(base.pagamentos.get(7)!.estado).toBe("pendente");

    // O euPago repete — e desta vez aplica.
    expect((await chamar(corpo, assinar(corpo))).status).toBe(200);
    expect(base.pagamentos.get(7)!.estado).toBe("pago");
    expect(base.avisos.get("T4|pago")).toEqual({ aplicado: true, nota: null });
    expect(recebidos()).toHaveLength(1);

    // E a terceira não credita outra vez.
    expect((await chamar(corpo, assinar(corpo))).status).toBe(200);
    expect(recebidos()).toHaveLength(1);
  });

  it("um aviso tratado e recusado (com nota) não se reaplica na repetição", async () => {
    const corpo = aviso({ trid: "T5", id: 7, valor: 5 });
    await chamar(corpo, assinar(corpo));
    const falhados = base.registo.length;
    expect((await chamar(corpo, assinar(corpo))).status).toBe(200);
    expect(base.registo.length).toBe(falhados);
    expect(base.pagamentos.get(7)!.estado).toBe("pendente");
  });
});

describe("R4 — uma referência antiga de outro valor não fecha o pedido", () => {
  it("a antiga (substituída) paga pelo valor DELA fica para devolver; o pedido continua por pagar", async () => {
    base.pagamentos.set(7, linha({ id: 7, metodo: "multibanco", estado: "substituido", valor: 300, referencia: "104295830" }));
    base.pagamentos.set(8, linha({ id: 8, metodo: "multibanco", estado: "pendente", valor: 452.03, referencia: "104295847" }));
    const corpo = aviso({ trid: "T6", id: 7, valor: 300, referencia: "104295830" });
    expect((await chamar(corpo, assinar(corpo))).status).toBe(200);
    expect(base.pagamentos.get(7)!.estado).toBe("substituido");
    expect(base.pagamentos.get(8)!.estado).toBe("pendente");
    expect([...base.pagamentos.values()].some((l) => l.negociacaoPaga != null)).toBe(false);
    expect(base.avisos.get("T6|pago")!.aplicado).toBe(false);
    expect(base.avisos.get("T6|pago")!.nota).toMatch(/devolver/);
    expect(base.registo.some((r) => r.acontecimento === "pagamento_em_duplicado")).toBe(true);
    expect(recebidos()).toHaveLength(0);
  });

  it("a antiga com o MESMO valor que a nova continua a poder fechar o pedido", async () => {
    base.pagamentos.set(7, linha({ id: 7, metodo: "multibanco", estado: "substituido", valor: 452.03 }));
    base.pagamentos.set(8, linha({ id: 8, metodo: "mbway", estado: "cancelado", valor: 452.03, referencia: null }));
    const corpo = aviso({ trid: "T7", id: 7, valor: 452.03 });
    expect((await chamar(corpo, assinar(corpo))).status).toBe(200);
    expect(base.pagamentos.get(7)!.estado).toBe("pago");
  });
});

describe("R5 — o aviso só conta se a referência e o ambiente baterem", () => {
  it("referência diferente da que geramos → não paga, fica à vista", async () => {
    const corpo = aviso({ trid: "T8", id: 7, valor: 452.03, referencia: "100000017" });
    expect((await chamar(corpo, assinar(corpo))).status).toBe(200);
    expect(base.pagamentos.get(7)!.estado).toBe("pendente");
    expect(base.avisos.get("T8|pago")!.nota).toMatch(/referência/);
  });

  it("a mesma referência escrita com espaços bate", async () => {
    const corpo = aviso({ trid: "T9", id: 7, valor: 452.03, referencia: "104 295 830" });
    expect((await chamar(corpo, assinar(corpo))).status).toBe(200);
    expect(base.pagamentos.get(7)!.estado).toBe("pago");
  });

  it("assinado com o segredo da SANDBOX num pagamento de produção → não paga nem fecha", async () => {
    const corpo = aviso({ trid: "T10", id: 7, valor: 452.03 });
    expect((await chamar(corpo, assinar(corpo, SEGREDO_SANDBOX))).status).toBe(200);
    expect(base.pagamentos.get(7)!.estado).toBe("pendente");
    expect(base.avisos.get("T10|pago")!.nota).toMatch(/sandbox/);

    const exp = aviso({ trid: "T11", id: 7, valor: 452.03, status: "Expired" });
    await chamar(exp, assinar(exp, SEGREDO_SANDBOX));
    expect(base.pagamentos.get(7)!.estado).toBe("pendente");
  });

  it("assinado com o segredo da sandbox num pagamento da sandbox → aplica", async () => {
    base.pagamentos.set(7, linha({ id: 7, ambiente: "sandbox" }));
    const corpo = aviso({ trid: "T12", id: 7, valor: 452.03 });
    expect((await chamar(corpo, assinar(corpo, SEGREDO_SANDBOX))).status).toBe(200);
    expect(base.pagamentos.get(7)!.estado).toBe("pago");
  });
});
