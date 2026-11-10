import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";

/**
 * CADA ACÇÃO CONFERE O ESTADO, NA BASE — 10-11-2026 (d27).
 *
 * Quatro escritas que liam, decidiam em código e gravavam sem olhar outra vez:
 *
 *   1. o pedido de transferência — dois toques davam dois pedidos do mesmo saldo;
 *   2. o «está feito» sem prova — recusada a confirmação, o trabalho ficava
 *      «entregue» sem ninguém o ter entregue;
 *   3. o link antigo do orçamento — reabria um pedido cancelado pela equipa;
 *   5. aprovar o orçamento — punha «aprovado» por cima de um pedido cancelado.
 *
 * A base finge-se aqui com o que interessa: as linhas, as condições de cada
 * UPDATE (lidas do próprio SQL — o que a instrução não pede, a base não
 * confere) e a tranca do `FOR UPDATE`, com cada instrução a demorar um
 * instante para dois toques se cruzarem de facto.
 */

type Neg = {
  id: number;
  pedidoId: number;
  providerId: number;
  estado: string;
  ofertaClyon: string | null;
  valorAcordado: string | null;
  execucaoEnviadaEm: Date | null;
  provaJson: string | null;
  confirmadoEm: Date | null;
  horasMarcadasEm: Date | null;
  horasConfirmadasEm: Date | null;
};
type Pedido = {
  id: number;
  status: string | null;
  orcamentoToken: string | null;
  canceladoPeloCliente: number;
  confirmadoPeloCliente: number;
  precoFinal: number | null;
};

const base = vi.hoisted(() => ({
  levantamentos: [] as Array<{ id: number; providerId: number; valor: number; estado: string }>,
  negs: [] as Neg[],
  pedidos: [] as Pedido[],
  trancas: new Map<string, Promise<void>>(),
  // Para fingir uma falha a meio: a confirmação estoira.
  confirmarEstoira: false,
}));

vi.mock("mysql2/promise", () => {
  const instante = () => new Promise<void>((r) => setTimeout(r, 2));
  const afectadas = (n: number) => [{ affectedRows: n }, []];
  /** Os estados que o próprio SQL exclui com `status NOT IN (…)` — nenhum, se não os pede. */
  const excluidos = (sql: string) =>
    (/status NOT IN \(([^)]*)\)/.exec(sql)?.[1] ?? "")
      .split(",")
      .map((s) => s.trim().replace(/'/g, ""))
      .filter(Boolean);

  async function instrucao(sql: string, params: unknown[], prender?: (chave: string) => Promise<void>) {
    await instante();

    // ── 1: levantamentos ───────────────────────────────────────────────────
    if (/SELECT id FROM providers WHERE id = \? FOR UPDATE/.test(sql)) {
      if (prender) await prender(`parceiro-${Number(params[0])}`);
      return [[{ id: params[0] }], []];
    }
    if (/SELECT id FROM levantamentos WHERE providerId = \? AND estado = 'pedido'/.test(sql)) {
      return [base.levantamentos.filter((l) => l.providerId === Number(params[0]) && l.estado === "pedido"), []];
    }
    if (/INSERT INTO levantamentos/.test(sql)) {
      const id = base.levantamentos.length + 1;
      base.levantamentos.push({ id, providerId: Number(params[0]), valor: Number(params[1]), estado: "pedido" });
      return [{ insertId: id, affectedRows: 1 }, []];
    }

    // ── 2: entregue e confirmado ───────────────────────────────────────────
    if (/UPDATE negociacoes SET execucaoEnviadaEm = NOW\(\)/.test(sql)) {
      const n = base.negs.find(
        (x) => x.id === Number(params[0]) && x.pedidoId === Number(params[1]) && x.estado === "acordada" && !x.execucaoEnviadaEm,
      );
      if (n) n.execucaoEnviadaEm = new Date();
      return afectadas(n ? 1 : 0);
    }
    if (/UPDATE negociacoes SET execucaoEnviadaEm = NULL/.test(sql)) {
      const n = base.negs.find(
        (x) =>
          x.id === Number(params[0]) &&
          x.pedidoId === Number(params[1]) &&
          x.estado === "acordada" &&
          x.execucaoEnviadaEm &&
          !x.confirmadoEm &&
          x.provaJson == null,
      );
      if (n) n.execucaoEnviadaEm = null;
      return afectadas(n ? 1 : 0);
    }
    if (/UPDATE negociacoes\s+SET confirmadoEm = NOW\(\)/.test(sql)) {
      if (base.confirmarEstoira) throw new Error("a ligação caiu a meio");
      // Os dois últimos parâmetros são sempre a negociação e o pedido.
      const [negId, pedidoId] = params.slice(-2).map(Number);
      const n = base.negs.find(
        (x) =>
          x.id === negId &&
          x.pedidoId === pedidoId &&
          x.estado === "acordada" &&
          x.execucaoEnviadaEm &&
          !x.confirmadoEm &&
          (!x.horasMarcadasEm || x.horasConfirmadasEm),
      );
      if (n) n.confirmadoEm = new Date();
      return afectadas(n ? 1 : 0);
    }
    if (/FROM negociacoes n JOIN providers p ON p\.id = n\.providerId\s+WHERE n\.id = \? LIMIT 1/.test(sql)) {
      return [base.negs.filter((x) => x.id === Number(params[0])).map((x) => ({ ...x, profissional: "o parceiro do teste" })), []];
    }

    // ── 3 e 5: o pedido ────────────────────────────────────────────────────
    if (/SELECT \* FROM simulatorOrders WHERE orcamentoToken = \?/.test(sql)) {
      return [base.pedidos.filter((p) => p.orcamentoToken === params[0]).map((p) => ({ ...p })), []];
    }
    if (/UPDATE simulatorOrders SET confirmadoPeloCliente = 1/.test(sql)) {
      const fora = excluidos(sql);
      const p = base.pedidos.find(
        (x) =>
          x.orcamentoToken === params[0] &&
          !fora.includes(String(x.status)) &&
          (!/canceladoPeloCliente, 0\) = 0/.test(sql) || !x.canceladoPeloCliente),
      );
      if (p) Object.assign(p, { confirmadoPeloCliente: 1, status: "confirmado" });
      return afectadas(p ? 1 : 0);
    }
    if (/UPDATE simulatorOrders SET status='aprovado'/.test(sql)) {
      const fora = excluidos(sql);
      const p = base.pedidos.find((x) => x.id === Number(params[5]) && !fora.includes(String(x.status)));
      if (p) Object.assign(p, { status: "aprovado", precoFinal: Number(params[0]) });
      return afectadas(p ? 1 : 0);
    }
    if (/UPDATE simulatorOrders SET concluidoEm/.test(sql)) return afectadas(0);
    return [[], []];
  }

  function ligacao() {
    let soltar: (() => void) | null = null;
    const largar = () => {
      soltar?.();
      soltar = null;
    };
    return {
      beginTransaction: async () => {},
      commit: async () => largar(),
      rollback: async () => largar(),
      release: () => largar(),
      execute: (sql: string, params: unknown[] = []) =>
        instrucao(sql, params, async (chave) => {
          const antes = base.trancas.get(chave) ?? Promise.resolve();
          let abrir!: () => void;
          const minha = new Promise<void>((r) => (abrir = r));
          base.trancas.set(chave, antes.then(() => minha));
          await antes;
          soltar = abrir;
        }),
    };
  }

  const pool = {
    query: async () => [[], []],
    execute: (sql: string, params: unknown[] = []) => instrucao(sql, params),
    getConnection: async () => ligacao(),
  };
  return { default: { createPool: () => pool, createConnection: () => undefined } };
});

vi.mock("drizzle-orm/mysql2", () => ({ drizzle: vi.fn(() => ({})) }));
vi.mock("@/lib/admin-auth-helper", () => ({
  requireAdmin: vi.fn(async () => ({ err: null, colab: { id: 1, nome: "a equipa", isAdmin: true, papel: "admin" } })),
}));
vi.mock("@/lib/avisar-confirmacao", () => ({ avisarProfissionalTrabalhoConfirmado: vi.fn(async () => {}) }));

let db: typeof import("./db");
let confirmarOTrabalhoClyon: typeof import("@/app/api/admin/trabalhos-clyon/confirmar/route").POST;
beforeAll(async () => {
  process.env.DATABASE_URL = "mysql://quem:segredo@localhost:3306/clyon";
  db = await import("./db");
  ({ POST: confirmarOTrabalhoClyon } = await import("@/app/api/admin/trabalhos-clyon/confirmar/route"));
}, 120_000);

beforeEach(() => {
  base.levantamentos = [];
  base.negs = [];
  base.pedidos = [];
  base.trancas.clear();
  base.confirmarEstoira = false;
});

const fonte = (caminho: string) => readFileSync(caminho, "utf8");

// ── 1 ────────────────────────────────────────────────────────────────────────
describe("d27.1 — o pedido de transferência com dois toques dá um só pedido", () => {
  const pedido = (providerId: number) => ({ providerId, valor: 120, iban: "PT50000000000000000000000", titular: null });

  it("dois toques ao mesmo tempo: um fica pedido, o outro lê que já há um", async () => {
    for (let i = 0; i < 10; i++) {
      base.levantamentos = [];
      base.trancas.clear();
      const [a, b] = await Promise.all([db.criarLevantamento(pedido(7)), db.criarLevantamento(pedido(7))]);
      expect([a, b].filter((x) => x != null)).toHaveLength(1);
      expect([a, b].filter((x) => x == null)).toHaveLength(1);
      expect(base.levantamentos).toHaveLength(1);
    }
  });

  it("um pedido em espera recusa o seguinte; pago ou recusado, já deixa pedir outro", async () => {
    expect(await db.criarLevantamento(pedido(7))).toBe(1);
    expect(await db.criarLevantamento(pedido(7))).toBeNull();
    base.levantamentos[0].estado = "pago";
    expect(await db.criarLevantamento(pedido(7))).toBe(2);
  });

  it("cada parceiro tem a sua fila: dois parceiros ao mesmo tempo ficam os dois com o pedido", async () => {
    const [a, b] = await Promise.all([db.criarLevantamento(pedido(7)), db.criarLevantamento(pedido(8))]);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(base.levantamentos.map((l) => l.providerId).sort()).toEqual([7, 8]);
  });

  it("a rota responde «já tem um pedido» a quem chega em segundo", () => {
    const rota = fonte("src/app/api/profissionais/levantamento/route.ts");
    expect(rota).toMatch(/if \(id == null\) \{\s*return NextResponse\.json\(\{ error: EXPLICACAO_DA_RECUSA\.ja_tem_pedido \}, \{ status: 400 \}\)/);
  });
});

// ── 2 ────────────────────────────────────────────────────────────────────────
describe("d27.2 — «está feito» sem prova: ou fica confirmado, ou não fica entregue", () => {
  const PEDIDO = 810;
  const trabalho = (mais: Partial<Neg> = {}): Neg => ({
    id: 31,
    pedidoId: PEDIDO,
    providerId: 7,
    estado: "acordada",
    ofertaClyon: "distribuida",
    valorAcordado: "200.00",
    execucaoEnviadaEm: null,
    provaJson: null,
    confirmadoEm: null,
    horasMarcadasEm: null,
    horasConfirmadasEm: null,
    ...mais,
  });
  const pedir = (corpo: Record<string, unknown>) =>
    confirmarOTrabalhoClyon(
      new NextRequest("https://clyon.pt/api/admin/trabalhos-clyon/confirmar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
      }),
    );

  it("a confirmação falha a meio: o trabalho não fica «entregue» por nós", async () => {
    base.negs = [trabalho()];
    base.confirmarEstoira = true;
    const r = await pedir({ negociacaoId: 31, semProva: true });
    expect(r.status).toBe(500);
    expect(base.negs[0].execucaoEnviadaEm).toBeNull();
    expect(base.negs[0].confirmadoEm).toBeNull();
  });

  it("a confirmação é recusada (horas por confirmar): a entrega que demos é retirada", async () => {
    const { confirmarDandoPorEntregue } = await import("./confirmar-sem-prova");
    base.negs = [trabalho({ horasMarcadasEm: new Date("2026-11-09T10:00:00Z") })];
    const gravou = await confirmarDandoPorEntregue(31, PEDIDO, true, () => db.confirmarExecucao(31, PEDIDO, undefined, "clyon"));
    expect(gravou).toBe(false);
    expect(base.negs[0].execucaoEnviadaEm).toBeNull();
  });

  it("a entrega que o parceiro enviou, com a prova dele, nunca é retirada", async () => {
    const { confirmarDandoPorEntregue } = await import("./confirmar-sem-prova");
    const enviada = new Date("2026-11-09T12:00:00Z");
    base.negs = [trabalho({ execucaoEnviadaEm: enviada, provaJson: "[]", horasMarcadasEm: new Date("2026-11-09T10:00:00Z") })];
    const gravou = await confirmarDandoPorEntregue(31, PEDIDO, true, () => db.confirmarExecucao(31, PEDIDO, undefined, "clyon"));
    expect(gravou).toBe(false);
    expect(base.negs[0].execucaoEnviadaEm).toBe(enviada);
  });

  it("quando corre bem, fica entregue e confirmado, como sempre", async () => {
    base.negs = [trabalho()];
    const r = await pedir({ negociacaoId: 31, semProva: true });
    expect(r.status).toBe(200);
    expect(base.negs[0].execucaoEnviadaEm).not.toBeNull();
    expect(base.negs[0].confirmadoEm).not.toBeNull();
  });

  it("as duas portas da equipa passam pelo mesmo sítio, e nenhuma dá por entregue à parte", () => {
    for (const rota of ["src/app/api/admin/negociacoes/agir/route.ts", "src/app/api/admin/trabalhos-clyon/confirmar/route.ts"]) {
      const texto = fonte(rota);
      expect(texto, rota).toMatch(/await confirmarDandoPorEntregue\(negociacaoId, pedidoId, /);
      expect(texto, rota).not.toMatch(/await darPorEntreguePelaClyon\(/);
    }
  });
});

// ── 3 ────────────────────────────────────────────────────────────────────────
describe("d27.3 — o link antigo do orçamento não reabre um pedido fechado", () => {
  const TOKEN = "a".repeat(64);
  const pedido = (status: string | null, mais: Partial<Pedido> = {}): Pedido => ({
    id: 820,
    status,
    orcamentoToken: TOKEN,
    canceladoPeloCliente: 0,
    confirmadoPeloCliente: 0,
    precoFinal: 150,
    ...mais,
  });

  for (const status of ["cancelado", "arquivado", "rejeitado", "concluido"]) {
    it(`pedido «${status}» pela equipa: confirmar pelo link é recusado e o estado fica`, async () => {
      base.pedidos = [pedido(status)];
      const r = await db.confirmarOrcamento(TOKEN);
      expect(r.ok).toBe(false);
      expect(base.pedidos[0].status).toBe(status);
      expect(base.pedidos[0].confirmadoPeloCliente).toBe(0);
    });
  }

  it("um pedido aprovado confirma-se como sempre", async () => {
    base.pedidos = [pedido("aprovado")];
    expect(await db.confirmarOrcamento(TOKEN)).toEqual({ ok: true });
    expect(base.pedidos[0].status).toBe("confirmado");
  });

  it("a condição vai também na escrita, para o que mudar entre ler e gravar", () => {
    const texto = fonte("src/lib/db.ts");
    const inicio = texto.indexOf("export async function confirmarOrcamento(");
    expect(inicio).toBeGreaterThan(-1);
    const corpo = texto.slice(inicio, texto.indexOf("export async function cancelarOrcamentoPeloCliente("));
    expect(corpo).toMatch(/WHERE orcamentoToken = \? AND COALESCE\(canceladoPeloCliente, 0\) = 0\s+AND \(status IS NULL OR status NOT IN \$\{ESTADOS_DE_PEDIDO_FECHADO_SQL\}\)/);
  });
});

// ── 5 (a escrita) ────────────────────────────────────────────────────────────
describe("d27.5 — aprovar o orçamento não escreve por cima de um pedido fechado", () => {
  const aprovacao = {
    precoFinal: 200,
    precoFinalIva: 246,
    mensagemCliente: "",
    reviewedBy: { id: 1, nome: "a equipa", role: "admin" },
  };
  const pedido = (status: string | null): Pedido => ({
    id: 830,
    status,
    orcamentoToken: null,
    canceladoPeloCliente: 0,
    confirmadoPeloCliente: 0,
    precoFinal: null,
  });

  for (const status of ["cancelado", "arquivado", "rejeitado", "concluido"]) {
    it(`pedido «${status}»: não grava, e diz que não gravou`, async () => {
      base.pedidos = [pedido(status)];
      expect(await db.approveSimulatorOrder(830, aprovacao)).toBe(false);
      expect(base.pedidos[0].status).toBe(status);
      expect(base.pedidos[0].precoFinal).toBeNull();
    });
  }

  it("um pedido por tratar aprova-se como sempre", async () => {
    base.pedidos = [pedido("pendente")];
    expect(await db.approveSimulatorOrder(830, aprovacao)).toBe(true);
    expect(base.pedidos[0]).toMatchObject({ status: "aprovado", precoFinal: 200 });
  });
});
