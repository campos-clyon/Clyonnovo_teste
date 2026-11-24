import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { reservaDaLinha, reservaDoValorUnico, semAReserva } from "./reserva";
import { taxaAPassarAClyon } from "./taxa-a-passar-a-clyon";
import { avisoAcimaDoValorUnico, diferencaEmTexto } from "./valor-unico";
import { confirmacaoDoRefazer, estadoDaParteDaClyon, fraseDoRefazer, refazSe } from "./refazer-sem-reserva";

/**
 * d101 (dono, 24-11-2026) — «por enquanto deixa sem a reserva».
 *
 * O interruptor «Reserva do valor único», DESLIGADO por omissão: a reserva
 * não se grava, as gravadas não contam, e a conta volta à de antes da d39.
 * O caso de teste: valor único 155 €, proposta aceite 80 €, parceiro isento,
 * taxa 10 % — a parte da CLYON é 8 € + 1,84 € de IVA = 9,84 €; com a reserva
 * (75 €) eram 102,09 €.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const T10 = { cliente: 0, profissional: 0.1 };

/* ── Uma base a fingir: o interruptor e as negociações ─────────────────────── */

const base = vi.hoisted(() => ({
  interruptor: null as null | number,
  chamadas: [] as string[],
  reservaNaLinha: 7500 as number | null,
}));

vi.mock("./db", () => {
  const execute = vi.fn(async (sql: string) => {
    base.chamadas.push(sql);
    if (/FROM retencaoInterruptores/.test(sql)) {
      return [base.interruptor == null ? [] : [{ ligado: base.interruptor, mudadoEm: null, porQuem: null }], []];
    }
    if (/^ALTER TABLE/.test(sql)) return [{}, []];
    if (/FROM negociacoes n JOIN simulatorOrders/.test(sql)) {
      return [[{ estado: "acordada", valorAcordado: "80.00", taxaCliente: "0", taxaProfissional: "0.1", reservaCent: null, valorUnicoCliente: "155.00" }], []];
    }
    if (/^UPDATE negociacoes SET reservaCent/.test(sql)) return [{ affectedRows: 1 }, []];
    if (/SELECT id, reservaCent FROM negociacoes/.test(sql)) {
      return [base.reservaNaLinha == null ? [] : [{ id: 648, reservaCent: base.reservaNaLinha }], []];
    }
    return [[], []];
  });
  return {
    getPool: vi.fn(async () => ({ execute })),
    appendOrderHistory: vi.fn(async () => {}),
    ensureRegistoTable: vi.fn(async () => {}),
    registarNaTransaccao: vi.fn(async () => {}),
    registarSemFalhar: vi.fn(async () => {}),
  };
});

async function reservaNaBase() {
  vi.resetModules();
  return import("./reserva-na-base");
}

beforeEach(() => {
  base.interruptor = null;
  base.chamadas = [];
  base.reservaNaLinha = 7500;
});

describe("o interruptor desligado", () => {
  it("sem linha na base, está desligado — e gravarReservaAoFechar não grava nada", async () => {
    const m = await reservaNaBase();
    expect(await m.reservaLigada()).toBe(false);
    expect(await m.gravarReservaAoFechar(648, 1, "teste")).toBeNull();
    expect(base.chamadas.some((s) => /UPDATE negociacoes SET reservaCent/.test(s))).toBe(false);
  });

  it("desligado (0), também não grava; ligado (1), grava a reserva de 75 €", async () => {
    base.interruptor = 0;
    let m = await reservaNaBase();
    expect(await m.gravarReservaAoFechar(648, 1, "teste")).toBeNull();
    base.interruptor = 1;
    base.chamadas = [];
    m = await reservaNaBase();
    expect(await m.gravarReservaAoFechar(648, 1, "teste")).toBe(7500);
    expect(base.chamadas.some((s) => /UPDATE negociacoes SET reservaCent/.test(s))).toBe(true);
  });

  it("as reservas gravadas não contam: reservasDe vazio e as linhas a nulo", async () => {
    let m = await reservaNaBase();
    expect((await m.reservasDe([648])).size).toBe(0);
    const [linha] = await m.semAReservaSeDesligada([{ id: 648, reservaCent: 7500 }]);
    expect(reservaDaLinha(linha)).toBe(0);
    base.interruptor = 1;
    m = await reservaNaBase();
    expect((await m.reservasDe([648])).get(648)).toBe(7500);
    const [ligada] = await m.semAReservaSeDesligada([{ id: 648, reservaCent: 7500 }]);
    expect(reservaDaLinha(ligada)).toBe(7500);
  });

  it("sem reserva em nenhuma linha, nem vai ler o interruptor", async () => {
    const m = await reservaNaBase();
    const linhas = [{ id: 1, reservaCent: null }, { id: 2 }];
    expect(await m.semAReservaSeDesligada(linhas)).toBe(linhas);
    expect(base.chamadas).toEqual([]);
  });

  it("tira-se em memória: a linha original fica como estava", () => {
    const original = [{ id: 648, reservaCent: 7500 }];
    expect(semAReserva(original)[0].reservaCent).toBeNull();
    expect(original[0].reservaCent).toBe(7500);
  });
});

describe("a conta de um caso como o #648", () => {
  it("a reserva gravada era 75 € (155 − 80)", () => {
    expect(reservaDoValorUnico(155, 80, T10)).toBe(7500);
  });

  it("desligado: o parceiro passa 9,84 € (8 € de taxa + 1,84 € de IVA); ligado: 102,09 €", async () => {
    const linha = { id: 648, reservaCent: 7500 };
    let m = await reservaNaBase();
    const [semReserva] = await m.semAReservaSeDesligada([linha]);
    for (const regime of ["normal", "isento"] as const) {
      expect(taxaAPassarAClyon(80, T10, regime, reservaDaLinha(semReserva))).toMatchObject({ comissao: 8, iva: 1.84, total: 9.84 });
    }
    base.interruptor = 1;
    m = await reservaNaBase();
    const [comReserva] = await m.semAReservaSeDesligada([linha]);
    expect(taxaAPassarAClyon(80, T10, "normal", reservaDaLinha(comReserva))?.total).toBe(102.09);
  });
});

describe("os textos só falam da reserva com ela ligada", () => {
  it("a Mesa", () => {
    expect(diferencaEmTexto(155, 80)).not.toMatch(/reserva/i);
    expect(diferencaEmTexto(155, 80)).toBe("75,00 € abaixo do valor único (conta a proposta do parceiro)");
    expect(diferencaEmTexto(155, 80, true)).toContain("reserva para imprevistos");
    expect(avisoAcimaDoValorUnico("X", 160, 155)).not.toMatch(/reserva/i);
    expect(avisoAcimaDoValorUnico("X", 160, 155, true)).toContain("reserva fica negativa");
  });

  it("a Mesa e o painel lêem o interruptor", () => {
    expect(ler("src/components/admin/ValorUnicoNaMesa.tsx")).toContain("diferencaEmTexto(valorUnico, p.semIva, comReserva)");
    const painel = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(painel).toContain("avisoAcimaDoValorUnico(n.profissionalNome, desta.semIva, vu, comReserva)");
    expect(painel).not.toMatch(/avisoDoValorUnico\(pedido, negociacao\)/);
  });

  it("quem lê as negociações da base passa pelo interruptor", () => {
    const db = ler("src/lib/db.ts");
    const doPedido = db.slice(db.indexOf("export async function negociacoesDoPedido("), db.indexOf("export async function arquivarNegociacao("));
    expect(doPedido).toContain("semAReservaSeDesligada(rows");
    const porToken = db.slice(db.indexOf("export async function negociacaoPorTokenHash("), db.indexOf("export async function negociacoesDoPedido("));
    expect(porToken).toContain("semAReservaSeDesligada(rows");
  });
});

describe("refazer as referências", () => {
  it("o estado da parte da CLYON, e só se refaz o que não está pago", () => {
    expect(estadoDaParteDaClyon([{ estado: "pendente" }, { estado: "pago" }])).toBe("pago");
    expect(estadoDaParteDaClyon([{ estado: "pendente" }], [{ parte: "iva" }])).toBe("pago");
    expect(estadoDaParteDaClyon([{ estado: "pendente" }, { estado: "cancelado" }])).toBe("referencia_pendente");
    expect(estadoDaParteDaClyon([{ estado: "expirado" }])).toBe("sem_referencia");
    expect(refazSe("pago")).toBe(false);
    expect(refazSe("referencia_pendente")).toBe(true);
    expect(refazSe("sem_referencia")).toBe(true);
  });

  it("só com REFAZER escrito", () => {
    expect(confirmacaoDoRefazer({})).toBe(false);
    expect(confirmacaoDoRefazer({ confirmacao: "sim" })).toBe(false);
    expect(confirmacaoDoRefazer({ confirmacao: " refazer " })).toBe(true);
  });

  it("a linha do histórico diz o que se anulou e o novo valor, com o motivo", () => {
    const f = fraseDoRefazer({ negociacaoId: 1, anuladas: [{ valor: 102.09 }], nova: { valor: 9.84, referencia: null }, quem: "teste" });
    expect(f).toContain("Reserva do valor único retirada (dono, 24/11/2026)");
    expect(f).toContain("102,09 €");
    expect(f).toContain("9,84 €");
  });
});

/* ── A rota ──────────────────────────────────────────────────────────────── */

const rota = vi.hoisted(() => ({ refazer: vi.fn() }));
vi.mock("@/lib/admin-auth-helper", () => ({
  requireAdminGeral: vi.fn(async () => ({ err: null, colab: { id: 1, nome: "Equipa", papel: "admin", isAdmin: true } })),
  requireAdmin: vi.fn(async () => ({ err: null, colab: { id: 1, nome: "Equipa", papel: "admin", isAdmin: true } })),
}));
vi.mock("@/lib/refazer-sem-reserva-na-base", () => ({
  refazerSemReserva: rota.refazer,
  trabalhosComReserva: vi.fn(async () => []),
}));

describe("a rota /api/admin/reserva-do-valor-unico/refazer", () => {
  const pedir = (corpo: unknown) =>
    new NextRequest("https://clyon.pt/api/admin/reserva-do-valor-unico/refazer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });

  it("recusa sem a confirmação, e não mexe em nada", async () => {
    rota.refazer.mockClear();
    const { POST } = await import("@/app/api/admin/reserva-do-valor-unico/refazer/route");
    const r = await POST(pedir({}));
    expect(r.status).toBe(400);
    expect(rota.refazer).not.toHaveBeenCalled();
  });

  it("com REFAZER, refaz", async () => {
    rota.refazer.mockClear();
    rota.refazer.mockResolvedValueOnce({ ok: true, resultado: { refeitas: [], pagas: [], porVer: [] } });
    const { POST } = await import("@/app/api/admin/reserva-do-valor-unico/refazer/route");
    const r = await POST(pedir({ confirmacao: "REFAZER" }));
    expect(r.status).toBe(200);
    expect(rota.refazer).toHaveBeenCalledTimes(1);
  });
});
