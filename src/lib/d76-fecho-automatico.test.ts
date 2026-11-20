import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * d76 (CEO e dono, 20-11-2026): o pedido pago dos dois lados passa a
 * «concluido» sozinho, pelo fecho do «Realizado»; uma só definição de
 * concluído para a Mesa, os Trabalhos CLYON e o servidor.
 */

const estado = vi.hoisted(() => ({
  pedido: { id: 505, status: "pendente" } as { id: number; status: string },
  trabalho: {} as Record<string, unknown>,
  updates: [] as Array<{ id: number; data: Record<string, unknown> }>,
  historico: [] as Array<{ id: number; message: string }>,
  registos: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/db", () => ({
  ensureNegociacoesTable: async () => {},
  ensureSimulatorOrdersTable: async () => {},
  getPool: async () => ({
    execute: async (sql: string) => {
      if (/SELECT pedidoId FROM negociacoes/.test(sql)) return [[{ pedidoId: estado.pedido.id }], []];
      if (/SELECT id FROM negociacoes/.test(sql)) return [[{ id: 900 }], []];
      if (/SELECT DISTINCT o.id/.test(sql)) return [[{ id: estado.pedido.id }], []];
      return [[], []];
    },
  }),
  getSimulatorOrderById: async () => ({ ...estado.pedido }),
  updateSimulatorOrder: async (id: number, data: Record<string, unknown>) => {
    estado.updates.push({ id, data });
    if (typeof data.status === "string") estado.pedido.status = data.status;
  },
  appendOrderHistory: async (id: number, e: { message: string }) => {
    estado.historico.push({ id, message: e.message });
  },
  registarSemFalhar: async (l: Record<string, unknown>) => {
    estado.registos.push(l);
  },
}));

vi.mock("@/lib/trabalhos-para-gerir", () => ({
  trabalhosParaGerir: async () => [{ pedidoId: estado.pedido.id, negociacaoId: 900, ...estado.trabalho }],
}));

import { fecharSePagoDosDoisLados, pagosDosDoisLadosPorRealizar } from "./fecho-automatico";
import {
  HISTORICO_DO_FECHO_AUTOMATICO,
  pagoDosDoisLados,
  porqueNaoFecha,
  trabalhoConcluido,
} from "./pedido-concluido";
import { blocoDoTrabalho } from "@/components/admin/TrabalhoClyon";

const AGORA = new Date("2026-11-20T20:00:00Z");
const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

beforeEach(() => {
  estado.pedido = { id: 505, status: "pendente" };
  estado.trabalho = {};
  estado.updates = [];
  estado.historico = [];
  estado.registos = [];
});

describe("o sinal em cada modelo", () => {
  it("modelo antigo: o cliente pago e o profissional pago — sem precisar da confirmação", () => {
    expect(pagoDosDoisLados({ clientePagouEm: "2026-11-20", pagoEm: "2026-11-19" })).toBe(true);
    expect(pagoDosDoisLados({ clientePagouEm: "2026-11-20", pagoEm: null })).toBe(false);
    expect(pagoDosDoisLados({ clientePagouEm: null, pagoEm: "2026-11-19" })).toBe(false);
  });

  it("modelo de 15-11: o trabalho fechado e a taxa passada à CLYON", () => {
    const base = { novoModelo: true, confirmadoEm: "2026-11-18", dividaDoProfissional: 54.12 };
    expect(pagoDosDoisLados({ ...base, clientePagouEm: null })).toBe(false);
    expect(pagoDosDoisLados({ ...base, clientePagouEm: "2026-11-19" })).toBe(true);
    expect(pagoDosDoisLados({ ...base, confirmadoEm: null, clientePagouEm: "2026-11-19" })).toBe(false);
  });

  it("pago em mão registado: a parte da CLYON por cobrar não fecha", () => {
    const t = { formaDePagamento: "plataforma", comoEntrou: "ao_profissional", confirmadoEm: "2026-11-18" };
    expect(pagoDosDoisLados({ ...t, taxaEmMao: { valor: 30, cobrada: false } })).toBe(false);
    expect(pagoDosDoisLados({ ...t, taxaEmMao: { valor: 30, cobrada: true } })).toBe(true);
  });
});

describe("as guardas", () => {
  const pago = { clientePagouEm: "2026-11-20", pagoEm: "2026-11-19" };
  it("um cancelado, arquivado ou rejeitado fica como está (d27)", () => {
    for (const s of ["cancelado", "arquivado", "rejeitado"]) {
      expect(porqueNaoFecha({ status: s, trabalhos: [pago] }, AGORA)).toBe("arrumado");
    }
  });
  it("um profissional de teste não fecha", () => {
    expect(porqueNaoFecha({ status: "pendente", trabalhos: [{ ...pago, contaDeTeste: true }] }, AGORA)).toBe("de_teste");
  });
  it("uma data futura não fecha, e fecha depois do dia", () => {
    const t = { ...pago, agendadoPara: "2026-11-25T09:00:00Z" };
    expect(porqueNaoFecha({ status: "pendente", trabalhos: [t] }, AGORA)).toBe("data_futura");
    expect(porqueNaoFecha({ status: "pendente", trabalhos: [t] }, new Date("2026-11-26T08:00:00Z"))).toBeNull();
  });
  it("já concluído não volta a fechar", () => {
    expect(porqueNaoFecha({ status: "concluido", trabalhos: [pago] }, AGORA)).toBe("ja_concluido");
  });
});

describe("o fecho automático", () => {
  it("fecha quando o segundo lado fica pago — o cliente primeiro", async () => {
    estado.trabalho = { clientePagouEm: "2026-11-20T10:00:00Z", pagoEm: null };
    expect((await fecharSePagoDosDoisLados({ negociacaoId: 900 }, AGORA)).fechou).toBe(false);
    expect(estado.updates).toHaveLength(0);
    estado.trabalho = { clientePagouEm: "2026-11-20T10:00:00Z", pagoEm: "2026-11-20T11:00:00Z" };
    expect((await fecharSePagoDosDoisLados({ negociacaoId: 900 }, AGORA)).fechou).toBe(true);
    expect(estado.pedido.status).toBe("concluido");
  });

  it("fecha quando o segundo lado fica pago — o profissional primeiro", async () => {
    estado.trabalho = { clientePagouEm: null, pagoEm: "2026-11-19T10:00:00Z" };
    expect((await fecharSePagoDosDoisLados({ negociacaoId: 900 }, AGORA)).fechou).toBe(false);
    estado.trabalho = { clientePagouEm: "2026-11-20T10:00:00Z", pagoEm: "2026-11-19T10:00:00Z" };
    expect((await fecharSePagoDosDoisLados({ negociacaoId: 900 }, AGORA)).fechou).toBe(true);
  });

  it("não fecha só com um lado", async () => {
    estado.trabalho = { clientePagouEm: "2026-11-20T10:00:00Z" };
    const r = await fecharSePagoDosDoisLados({ negociacaoId: 900 }, AGORA);
    expect(r).toEqual({ fechou: false, porque: "falta_um_lado" });
    expect(estado.updates).toHaveLength(0);
  });

  it("não fecha um cancelado, um de teste nem um com data futura", async () => {
    estado.trabalho = { clientePagouEm: "2026-11-20", pagoEm: "2026-11-19" };
    estado.pedido.status = "cancelado";
    expect((await fecharSePagoDosDoisLados({ pedidoId: 505 }, AGORA)).porque).toBe("arrumado");
    estado.pedido.status = "pendente";
    estado.trabalho = { clientePagouEm: "2026-11-20", pagoEm: "2026-11-19", contaDeTeste: true };
    expect((await fecharSePagoDosDoisLados({ pedidoId: 505 }, AGORA)).porque).toBe("de_teste");
    estado.trabalho = { clientePagouEm: "2026-11-20", pagoEm: "2026-11-19", agendadoPara: "2026-12-01T09:00:00Z" };
    expect((await fecharSePagoDosDoisLados({ pedidoId: 505 }, AGORA)).porque).toBe("data_futura");
    expect(estado.updates).toHaveLength(0);
  });

  it("usa o fecho do «Realizado» UMA vez (a folha do Google sai de lá), com o histórico e o registo automático", async () => {
    estado.trabalho = { clientePagouEm: "2026-11-20", pagoEm: "2026-11-19" };
    await fecharSePagoDosDoisLados({ negociacaoId: 900 }, AGORA);
    await fecharSePagoDosDoisLados({ negociacaoId: 900 }, AGORA);
    expect(estado.updates).toEqual([{ id: 505, data: { status: "concluido" } }]);
    expect(estado.historico.map((h) => h.message)).toEqual([HISTORICO_DO_FECHO_AUTOMATICO]);
    expect(HISTORICO_DO_FECHO_AUTOMATICO).toBe("Realizado automaticamente: cliente e profissional pagos");
    expect(estado.registos).toHaveLength(1);
    expect(estado.registos[0]).toMatchObject({
      acontecimento: "pedido_concluido",
      autorTipo: "sistema",
      autorNome: "automático",
      detalhe: { origem: "automático" },
    });
    // A exportação vive em updateSimulatorOrder, na passagem a «concluido».
    const db = ler("src/lib/db.ts");
    expect(db).toMatch(/if \(data\.status === "concluido"\) \{[\s\S]{0,600}exportCompletedOrderToSheet/);
  });

  it("um pagamento desfeito não reabre: o módulo nunca escreve outro estado", () => {
    const f = ler("src/lib/fecho-automatico.ts");
    expect(f.match(/updateSimulatorOrder\(/g)).toHaveLength(1);
    expect(f).toContain('updateSimulatorOrder(pedidoId, { status: "concluido" })');
  });

  it("a lista mostra os pagos dos dois lados por realizar", async () => {
    estado.trabalho = { clientePagouEm: "2026-11-20", pagoEm: "2026-11-19" };
    const l = await pagosDosDoisLadosPorRealizar(AGORA);
    expect(l.map((x) => x.pedidoId)).toEqual([505]);
    estado.trabalho = { clientePagouEm: "2026-11-20" };
    expect(await pagosDosDoisLadosPorRealizar(AGORA)).toEqual([]);
  });
});

describe("corre em cada sítio que regista o segundo pagamento", () => {
  const SITIOS = [
    "src/app/api/pagamentos/webhook/route.ts",
    "src/app/api/cron/conferir-pagamentos/route.ts",
    "src/app/api/admin/pagamentos/conferir/route.ts",
    "src/app/api/admin/pagamentos/recebido/route.ts",
    "src/app/api/admin/pagamentos/pago-ao-profissional/route.ts",
    "src/app/api/admin/pagamentos/a-receber-dos-profissionais/route.ts",
    "src/app/api/admin/carteiras/route.ts",
    "src/app/api/admin/carteiras/pagamento-do-profissional/route.ts",
    "src/app/api/admin/levantamentos/route.ts",
  ];
  it.each(SITIOS)("%s", (f) => {
    expect(ler(f)).toContain("await fecharSePagoDosDoisLados(");
  });
  it("a conferência de hora a hora fecha os de data futura depois do dia (sem cron novo)", () => {
    expect(ler("src/app/api/cron/conferir-pagamentos/route.ts")).toContain("await fecharOsQueChegaramADia()");
    expect(ler("vercel.json")).not.toContain("fecho-automatico");
  });
});

describe("a lista e o botão só do admin", () => {
  const ROTA = ler("src/app/api/admin/pagamentos/pagos-dos-dois-lados/route.ts");
  it("GET e POST pedem o administrador", () => {
    const get = ROTA.slice(ROTA.indexOf("export async function GET"), ROTA.indexOf("export async function POST"));
    const post = ROTA.slice(ROTA.indexOf("export async function POST"));
    expect(get).toContain("await requireAdminGeral(req)");
    expect(post).toContain("await requireAdminGeral(req)");
    expect(ROTA).not.toMatch(/requireAdmin\(/);
  });
  it("o painel só a mostra ao administrador, e o botão usa um diálogo da página", () => {
    expect(ler("src/components/admin/AdminPagamentosPanel.tsx")).toContain(
      "{eAdministrador && <PagosDosDoisLados token={token} />}",
    );
    const comp = ler("src/components/admin/PagosDosDoisLados.tsx");
    expect(comp).toContain('role="dialog"');
    expect(comp).toContain("Marcar como realizado");
    expect(comp).toContain("Pagos dos dois lados, ainda não realizados");
    expect(comp).not.toMatch(/(^|[^.\w])confirm\(/m);
  });
});

describe("uma só definição de concluído (a Mesa e os Trabalhos CLYON)", () => {
  it("o #505: pago dos dois lados, sem confirmação, é concluído", () => {
    expect(trabalhoConcluido({ status: "pendente", negociacoes: [{ clientePagouEm: "x", pagoEm: "y" }] })).toBe(true);
    const t = { estadoDoPedido: "pendente", resumo: { fase: "paga" as const, atribuida: { clientePagouEm: "x", pagoEm: "y" } } };
    expect(blocoDoTrabalho(t)).toBe("concluidos");
  });
  it("pago ao profissional adiantado (o cliente por pagar) já não é concluído", () => {
    const t = { estadoDoPedido: "pendente", resumo: { fase: "paga" as const, atribuida: { pagoEm: "y", execucaoEnviadaEm: "z" } } };
    expect(blocoDoTrabalho(t)).toBe("feito");
    expect(blocoDoTrabalho({ ...t, resumo: { ...t.resumo, atribuida: { pagoEm: "y" } } })).toBe("atribuidos");
  });
  it("a Mesa lê a regra partilhada", () => {
    const m = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(m).toContain("return trabalhoConcluido(p);");
    expect(ler("src/components/admin/TrabalhoClyon.tsx")).toContain("trabalhoConcluido({ status: t.estadoDoPedido, negociacoes: [a] })");
  });
});
