import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * OS AVISOS AO CLIENTE COM O PEDIDO — d8 fase 2, S10 (28-10-2026; R6).
 *
 * Critério 15: tocar no aviso abre ESSE pedido — o `pedidoId` vai nos dados
 * de cada aviso ao cliente. E cada aviso da lista da R6 tem quem o mande. Os
 * avisos do cliente vão só para a app de cliente (nunca para a CLYON Pro).
 */

const enviados: Array<{ email: string; payload: Record<string, unknown>; para: string }> = [];
let pedido: Record<string, unknown> | undefined;
let negociacoes: Array<Record<string, unknown>> = [];

vi.mock("@/lib/webpush", () => ({
  sendPushToUser: vi.fn(async (email: string, payload: Record<string, unknown>, para: string) => {
    enviados.push({ email, payload, para });
  }),
}));
vi.mock("@/lib/db", () => ({
  getSimulatorOrderById: vi.fn(async () => pedido),
  negociacoesDoPedido: vi.fn(async () => negociacoes),
}));

import { avisarOClienteDoPedido, avisoAoCliente, type TipoDeAvisoAoCliente } from "@/lib/avisos-ao-cliente";
import { mensagensParaAExpo } from "@/lib/push-nativo";
import { avisarClientePorPush, avisarClienteDoTrabalhoFeitoPorPush } from "@/lib/avisar-por-push";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

beforeEach(() => {
  enviados.length = 0;
  pedido = { id: 812, contactEmail: "Cliente.Teste@Exemplo.pt", valorFixoClyon: null };
  negociacoes = [{ id: 5, formaDePagamento: null, createdAt: new Date("2026-10-20T10:00:00Z"), semFactura: 0 }];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("S10 — o pedido vai nos dados do aviso", () => {
  it("a mensagem da Expo leva o pedidoId e o tipo", () => {
    const [m] = mensagensParaAExpo(["ExponentPushToken[abc]"], { title: "t", body: "b", pedidoId: 812, tipo: "chegou" });
    expect(m.data).toMatchObject({ pedidoId: 812, tipo: "chegou" });
  });

  it("cada aviso ao cliente sai para a app «cliente», com o pedido", async () => {
    const tipos: TipoDeAvisoAoCliente[] = ["aceitou", "dia", "a_caminho", "chegou", "ajuste", "feito_sem_fotografias", "confirmado", "referencia", "pago"];
    for (const t of tipos) await avisarOClienteDoPedido(812, t, { nome: "Ana Teste", negociacaoId: 5, dia: new Date("2026-10-30T09:00:00Z") });
    expect(enviados).toHaveLength(tipos.length);
    for (const e of enviados) {
      expect(e.para).toBe("cliente");
      expect(e.email).toBe("cliente.teste@exemplo.pt");
      expect(e.payload).toMatchObject({ pedidoId: 812, negociacaoId: 5 });
    }
  });

  it("os dois que já existiam (proposta nova, trabalho feito) também levam o pedido", async () => {
    await avisarClientePorPush({ email: "c@exemplo.pt", profissionalNome: "Ana", valor: 452.03, pedidoId: 812, negociacaoId: 5 });
    await avisarClienteDoTrabalhoFeitoPorPush({ email: "c@exemplo.pt", profissionalNome: "Ana", pedidoId: 812 });
    expect(enviados.map((e) => e.payload.pedidoId)).toEqual([812, 812]);
    expect(enviados.map((e) => e.payload.tipo)).toEqual(["proposta", "feito"]);
    expect(enviados[1].payload.body).toBe("Ana marcou o trabalho do pedido #812 como feito. Veja as fotografias e confirme.");
  });

  it("num Trabalho CLYON só o preço enviado e quem faz; sem email, nada", async () => {
    pedido = { id: 813, contactEmail: "c@exemplo.pt", valorFixoClyon: "300.00" };
    await avisarOClienteDoPedido(813, "chegou", { nome: "Ana" });
    await avisarOClienteDoPedido(813, "preco_clyon");
    await avisarOClienteDoPedido(813, "escolhido", { nome: "Empresa Teste" });
    expect(enviados.map((e) => e.payload.tipo)).toEqual(["preco_clyon", "escolhido"]);
    pedido = { id: 814, contactEmail: null, valorFixoClyon: null };
    await avisarOClienteDoPedido(814, "chegou", { nome: "Ana" });
    expect(enviados).toHaveLength(2);
  });

  it("a dívida do profissional (em dinheiro com IVA incluído) não é aviso do cliente", async () => {
    negociacoes = [{ id: 5, formaDePagamento: "dinheiro", createdAt: new Date("2026-10-20T10:00:00Z"), semFactura: 0 }];
    await avisarOClienteDoPedido(812, "referencia", { negociacaoId: 5 });
    await avisarOClienteDoPedido(812, "pago", { negociacaoId: 5 });
    expect(enviados).toHaveLength(0);
  });
});

describe("S10 — as frases (voz de plataforma; o nome de quem age)", () => {
  it("as da especificação", () => {
    expect(avisoAoCliente("feito_sem_fotografias", { pedidoId: 9, nome: "Ana Teste" }).body).toBe(
      "Ana marcou o trabalho do pedido #9 como feito. A CLYON vai confirmar consigo.",
    );
    expect(avisoAoCliente("preco_clyon", { pedidoId: 9 }).body).toBe("A CLYON enviou o preço do pedido #9. Toque para ver e responder.");
    expect(avisoAoCliente("escolhido", { pedidoId: 9, nome: "Empresa Teste" }).body).toBe("Empresa Teste vai fazer o trabalho do pedido #9.");
    expect(avisoAoCliente("chegou", { pedidoId: 9, nome: "Ana" }).title).toBe("Ana chegou");
    expect(avisoAoCliente("dia", { pedidoId: 9, nome: "Ana", dia: new Date("2026-10-30T09:00:00Z") }).body).toBe(
      "Ana marcou o trabalho do pedido #9 para sexta-feira, 30 de outubro, às 09:00.",
    );
  });

  it("nunca «a CLYON vai / leva / faz»", () => {
    const tipos: TipoDeAvisoAoCliente[] = ["proposta", "aceitou", "dia", "a_caminho", "chegou", "ajuste", "feito", "feito_sem_fotografias", "confirmado", "referencia", "pago", "preco_clyon", "escolhido"];
    for (const t of tipos) {
      const a = avisoAoCliente(t, { pedidoId: 1, nome: "Ana" });
      expect(`${a.title} ${a.body}`).not.toMatch(/a CLYON (vai buscar|leva|faz|executa)/i);
    }
  });
});

describe("S10 — cada aviso da R6 tem quem o mande", () => {
  const ONDE: Array<[string, string]> = [
    ["src/app/api/profissionais/negociacao/route.ts", '"aceitou"'],
    ["src/app/api/profissionais/agenda/route.ts", '"dia"'],
    ["src/app/api/profissionais/trabalho/etapa/route.ts", "avisarOClienteDoPedido(n.pedidoId, etapa, {"],
    ["src/app/api/profissionais/trabalho/ajuste/route.ts", '"ajuste"'],
    ["src/app/api/profissionais/trabalho/route.ts", '"feito_sem_fotografias"'],
    ["src/app/api/admin/negociacoes/agir/route.ts", '"confirmado"'],
    ["src/app/api/admin/pagamentos/criar/route.ts", '"referencia"'],
    ["src/app/api/pagamentos/webhook/route.ts", '"pago"'],
    ["src/app/api/admin/trabalhos-clyon/route.ts", '"preco_clyon"'],
    ["src/app/api/admin/trabalhos-clyon/escolher/route.ts", '"escolhido"'],
  ];
  it.each(ONDE)("%s", (f, tipo) => {
    const s = ler(f);
    expect(s).toContain("avisarOClienteDoPedido(");
    expect(s).toContain(tipo);
  });
});
