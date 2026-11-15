import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * d38 v2, commit d — «ENVIAR O VALOR FINAL AO CLIENTE» NO SERVIDOR, em
 * simulação: nada sai na pré-visualização; ao enviar, no modelo antigo, uma
 * Multibanco e um MB WAY novos pela via do «Gerar referência» e as antigas
 * canceladas; no modelo de 15-11 nenhuma referência; o histórico fica sempre.
 * Sem euPago, sem WhatsApp e sem base a sério.
 */

const estado = {
  trabalho: null as Record<string, unknown> | null,
  linhas: [] as Array<Record<string, unknown>>,
  abertos: [] as Array<Record<string, unknown>>,
  pedidos: [] as Array<{ metodo: string; valor: number }>,
  fechados: [] as number[],
  historico: [] as string[],
  envios: [] as Array<Record<string, unknown>>,
};

vi.mock("./db", () => ({
  appendOrderHistory: async (_id: number, h: { message: string }) => void estado.historico.push(h.message),
  numeroBloqueadoWhatsApp: async () => false,
  retomarNumeroWhatsApp: async () => undefined,
  registarSemFalhar: async () => undefined,
  getPool: async () => null,
  toMySQLDateTime: (d: Date) => d.toISOString(),
}));
vi.mock("./acesso-ao-pagamento", () => ({
  trabalhoVistoPeloBackoffice: async () => ({ ok: true, trabalho: estado.trabalho }),
}));
vi.mock("./pagamentos-na-base", () => ({
  pagamentosDaNegociacao: async () => estado.linhas,
  abrirPagamento: async (d: Record<string, unknown>) => {
    estado.abertos.push(d);
    return 100 + estado.abertos.length;
  },
  fecharSemPagar: async (id: number) => {
    estado.fechados.push(id);
    return { feito: true };
  },
  marcarFalhado: async () => undefined,
  marcarPedido: async () => undefined,
}));
vi.mock("./pedir-ao-eupago", () => ({
  pedirPagamento: async (_c: unknown, metodo: string, d: { valor: number }) => {
    estado.pedidos.push({ metodo, valor: d.valor });
    return { ok: true, referencia: metodo === "multibanco" ? "123 456 789" : null, entidade: metodo === "multibanco" ? "12345" : null, trid: `T-${metodo}` };
  },
}));
vi.mock("./eupago", async (original) => ({
  ...(await original<typeof import("./eupago")>()),
  configuracaoDoEupago: () => ({ ok: true, config: { ambiente: "sandbox" } }),
  podeCobrarPeloBackoffice: () => ({ pode: true }),
}));
vi.mock("./avisos-ao-cliente", () => ({ avisarOClienteDoPedido: async () => undefined }));
vi.mock("./folha-final-na-base", () => ({ folhasFinaisDe: async () => [] }));
vi.mock("./valor-final-na-base", () => ({
  registarEnvioDoValorFinal: async (d: Record<string, unknown>) => void estado.envios.push(d),
  enviosDoValorFinal: async () => [],
}));
vi.mock("./pagar-ao-parceiro-para-o-cliente", () => ({
  oQueOClienteVeDoParceiro: async () => ({
    parceiro: "Mudanças Exemplo",
    paraPagar: { iban: "PT50 0000 0000 0000 0000 0000 0", titular: null, mbway: null },
    perfilFiscal: { regimeParaAConta: "normal" },
    faturas: { doTrabalho: null, daTaxa: null },
  }),
}));

const { valorFinalAoCliente } = await import("./valor-final-no-servidor");

const enviados: Array<{ canal: string; texto: string }> = [];
const portas = {
  enviarWhatsApp: async (_t: string, texto: string) => {
    enviados.push({ canal: "whatsapp", texto });
    return true;
  },
  enviarEmail: async (_p: string, _a: string, texto: string) => {
    enviados.push({ canal: "email", texto });
    return true;
  },
  agora: () => new Date("2026-11-15T15:00:00Z"),
};

const base = {
  pedidoId: 524,
  negociacaoId: 70,
  providerId: 3,
  profissionalNome: "Mudanças Exemplo",
  acordado: 400,
  regime: "normal",
  taxas: { cliente: 0, profissional: 0.1 },
  formaDePagamento: "na_plataforma",
  acrescimo: 0,
  modelo: "iva_incluido",
  libertado: false,
  novoModelo: false,
  porHora: null,
  reservaCent: 0,
  telefoneDoCliente: "910000000",
  telefoneDoProfissional: null,
  nomeDoCliente: "Cliente Teste",
  emailDoCliente: "cliente@exemplo.test",
};

beforeEach(() => {
  estado.trabalho = { ...base };
  estado.linhas = [{ id: 9, estado: "pendente", parte: "trabalho", metodo: "multibanco", valor: 300, comFactura: true }];
  estado.abertos = [];
  estado.pedidos = [];
  estado.fechados = [];
  estado.historico = [];
  estado.envios = [];
  enviados.length = 0;
});

const pedir = (p: Record<string, unknown>) =>
  valorFinalAoCliente({ pedidoId: 524, negociacaoId: 70, previsualizar: false, porQuem: "Equipa", ...p } as never, portas);

describe("pré-visualizar não mexe em nada", () => {
  it("devolve a conta e a mensagem, sem referências nem envios", async () => {
    const r = await pedir({ previsualizar: true });
    expect(r.status).toBe(200);
    expect(r.corpo.mensagem).toEqual(expect.stringContaining("sem IVA"));
    expect(estado.abertos).toHaveLength(0);
    expect(estado.fechados).toHaveLength(0);
    expect(enviados).toHaveLength(0);
    expect(estado.envios).toHaveLength(0);
  });
});

describe("enviar, no modelo antigo", () => {
  it("Multibanco e MB WAY novos, a antiga cancelada, o WhatsApp e o histórico", async () => {
    const r = await pedir({ canal: "whatsapp" });
    expect(r.status).toBe(200);
    expect(estado.fechados).toEqual([9]);
    expect(estado.pedidos.map((p) => p.metodo)).toEqual(["multibanco", "mbway"]);
    expect(estado.abertos.every((a) => a.parte === "trabalho")).toBe(true);
    expect(enviados).toHaveLength(1);
    expect(enviados[0].texto).toContain("Entidade 12345, Referência 123 456 789");
    expect(estado.envios[0]).toMatchObject({ canalPedido: "whatsapp", canaisQueSairam: ["whatsapp"], porQuem: "Equipa", pagamentoIds: [101, 102] });
    expect(estado.historico[0]).toMatch(/Valor final enviado ao cliente por WhatsApp/);
  });

  it("os dois canais", async () => {
    await pedir({ canal: "ambos" });
    expect(enviados.map((e) => e.canal)).toEqual(["whatsapp", "email"]);
  });

  it("sem canal escolhido, ou já pago: nada se gera", async () => {
    expect((await pedir({})).status).toBe(400);
    estado.linhas = [{ id: 9, estado: "pago", parte: "trabalho", metodo: "multibanco", valor: 492, comFactura: true }];
    expect((await pedir({ canal: "whatsapp" })).status).toBe(409);
    expect(estado.abertos).toHaveLength(0);
  });
});

describe("enviar, no modelo de 15-11", () => {
  it("sem referências: os dados do parceiro e as duas faturas", async () => {
    estado.trabalho = { ...base, novoModelo: true };
    estado.linhas = [];
    const r = await pedir({ canal: "email" });
    expect(r.status).toBe(200);
    expect(estado.abertos).toHaveLength(0);
    expect(enviados[0].texto).toContain("Paga diretamente ao parceiro Mudanças Exemplo");
    expect(enviados[0].texto).toContain("IBAN PT50");
    expect(estado.envios[0]).toMatchObject({ modo: "parceiro", canaisQueSairam: ["email"] });
  });
});
