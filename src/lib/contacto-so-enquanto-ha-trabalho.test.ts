import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O CONTACTO DO CLIENTE SAI DA API DO PROFISSIONAL — 28-10-2026 (decisão d3).
 *
 * Confirmado, pago, arquivado ou morto: o nome, o telefone e as moradas
 * (origem e destino) do cliente vão a `null` na resposta de
 * /api/profissionais/meus-pedidos. Até aí ficam — ele pode ter de ligar ao
 * cliente para fazer o trabalho. Lê-se a RESPOSTA da rota, e não só a função.
 */

vi.mock("@/lib/sessao-activa-do-profissional", () => ({
  sessaoActivaDoProfissional: vi.fn(async () => ({ providerId: 7, nome: "Profissional de exemplo" })),
}));
vi.mock("@/lib/db", () => ({
  negociacoesDoProfissional: vi.fn(async () => []),
  getPool: vi.fn(async () => null),
  custosEBaseDoProfissional: vi.fn(async () => null),
}));
vi.mock("@/lib/pricing-helper", () => ({
  getActivePricingMap: vi.fn(async () => {
    throw new Error("sem parâmetros no teste");
  }),
}));
vi.mock("@/lib/distancia-rodoviaria", () => ({ distanciasRodoviarias: vi.fn(async () => []) }));
vi.mock("@/lib/carteira-do-profissional", () => ({ pagamentosAVerificar: vi.fn(async () => new Map()) }));

import * as db from "@/lib/db";
import { GET } from "@/app/api/profissionais/meus-pedidos/route";
import {
  CAMPOS_DO_CONTACTO_DO_CLIENTE,
  contactoJaNaoServe,
  semContactoDepoisDoFim,
} from "./contacto-so-enquanto-ha-trabalho";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const ACORDO = new Date("2026-10-20T10:00:00Z");
const FEITO = new Date("2026-10-22T10:00:00Z");
const CONFIRMADO = new Date("2026-10-23T10:00:00Z");
const PAGO = new Date("2026-10-24T10:00:00Z");

/** Uma linha de `negociacoesDoProfissional`, com o contacto do cliente (inventado). */
function linha(n: Record<string, unknown> = {}) {
  return {
    id: 501,
    pedidoId: 9001,
    providerId: 7,
    estado: "acordada",
    valorAcordado: "350.00",
    propostasJson: null,
    createdAt: ACORDO,
    updatedAt: ACORDO,
    taxaCliente: "0",
    taxaProfissional: "0.11",
    formaDePagamento: "transferencia",
    ofertaClyon: null,
    valorFixoClyon: null,
    ajustesJson: null,
    execucaoEnviadaEm: null,
    confirmadoEm: null,
    pagoEm: null,
    avaliadoEm: null,
    arquivadoProfissionalEm: null,
    abertoProfissionalEm: ACORDO,
    estrelas: null,
    serviceType: "mudanca",
    city: "Amora",
    address: "Rua de Exemplo, 10, Amora",
    moradaDestino: "Rua de Exemplo, 2, Barreiro",
    localidadeDestino: "Barreiro",
    contactName: "Cliente de exemplo",
    contactPhone: "+351 912 345 678",
    contactEmail: "cliente@example.com",
    estadoDoPedido: "em_curso",
    concorrentes: 0,
    ...n,
  };
}

async function respostaCom(n: Record<string, unknown>) {
  vi.mocked(db.negociacoesDoProfissional).mockResolvedValueOnce([linha(n)] as never);
  const r = await GET(new NextRequest("https://clyon.pt/api/profissionais/meus-pedidos"));
  expect(r.status).toBe(200);
  const corpo = (await r.json()) as { pedidos: Array<Record<string, unknown>> };
  expect(corpo.pedidos).toHaveLength(1);
  return corpo.pedidos[0];
}

beforeEach(() => vi.clearAllMocks());

describe("a resposta de /api/profissionais/meus-pedidos", () => {
  it("num trabalho PAGO não traz o nome, o telefone nem as moradas do cliente", async () => {
    const t = await respostaCom({ execucaoEnviadaEm: FEITO, confirmadoEm: CONFIRMADO, pagoEm: PAGO });
    expect(t.fase).toBe("pago");
    for (const campo of CAMPOS_DO_CONTACTO_DO_CLIENTE) expect(t[campo], campo).toBeNull();
    // Nada do contacto escondido noutro campo da resposta.
    const tudo = JSON.stringify(t);
    expect(tudo).not.toContain("Cliente de exemplo");
    expect(tudo).not.toContain("912 345 678");
    expect(tudo).not.toContain("Rua de Exemplo");
    // O resto do trabalho continua lá: o que ele recebe, a terra, o serviço.
    expect(t.recebeSeFechado).toBe(311.5);
    expect(t.city).toBe("Amora");
    expect(t.serviceType).toBe("mudanca");
  });

  it("num trabalho CONFIRMADO, à espera do pagamento, também não", async () => {
    const t = await respostaCom({ execucaoEnviadaEm: FEITO, confirmadoEm: CONFIRMADO });
    expect(t.fase).toBe("confirmado");
    for (const campo of CAMPOS_DO_CONTACTO_DO_CLIENTE) expect(t[campo], campo).toBeNull();
  });

  it("num trabalho que ele ARQUIVOU, também não", async () => {
    const t = await respostaCom({ arquivadoProfissionalEm: new Date("2026-10-25T10:00:00Z") });
    for (const campo of CAMPOS_DO_CONTACTO_DO_CLIENTE) expect(t[campo], campo).toBeNull();
  });

  it("numa negociação MORTA, também não", async () => {
    const t = await respostaCom({ estado: "morta" });
    for (const campo of CAMPOS_DO_CONTACTO_DO_CLIENTE) expect(t[campo], campo).toBeNull();
  });

  it("por fazer, ele tem o contacto para fazer o trabalho", async () => {
    const t = await respostaCom({});
    expect(t.fase).toBe("a_executar");
    expect(t.contactoNome).toBe("Cliente de exemplo");
    expect(t.contactoTelefone).toBe("+351 912 345 678");
    expect(t.morada).toBe("Rua de Exemplo, 10, Amora");
    expect(t.moradaDestino).toBe("Rua de Exemplo, 2, Barreiro");
  });

  it("feito e à espera da confirmação, ainda o tem (o painel e a app mostram-no)", async () => {
    const t = await respostaCom({ execucaoEnviadaEm: FEITO });
    expect(t.fase).toBe("a_confirmar");
    expect(t.contactoNome).toBe("Cliente de exemplo");
    expect(t.morada).toBe("Rua de Exemplo, 10, Amora");
  });
});

describe("a regra, numa função só", () => {
  const base = {
    estado: "acordada",
    fase: "a_executar" as const,
    arquivadoEm: null,
    contactoNome: "Cliente de exemplo",
    contactoTelefone: "+351 912 345 678",
    morada: "Rua de Exemplo, 10",
    moradaDestino: "Rua de Exemplo, 2",
  };

  it("vazio é null, e não texto vazio: é como a API os mandava antes da contratação", () => {
    const t = semContactoDepoisDoFim({ ...base, fase: "pago" as const });
    expect(t.contactoNome).toBeNull();
    expect(t.contactoTelefone).toBeNull();
    expect(t.morada).toBeNull();
    expect(t.moradaDestino).toBeNull();
  });

  it("não mexe em mais nada", () => {
    const antes = { ...base, fase: "confirmado" as const, cidade: "Amora", valor: 350 };
    const depois = semContactoDepoisDoFim(antes);
    expect(depois.cidade).toBe("Amora");
    expect(depois.valor).toBe(350);
    expect(antes.contactoNome).toBe("Cliente de exemplo"); // a original fica como estava
  });

  it("decide pelo estado, pela fase e pelo arquivo", () => {
    expect(contactoJaNaoServe({ estado: "acordada", fase: "a_executar" })).toBe(false);
    expect(contactoJaNaoServe({ estado: "acordada", fase: "a_confirmar" })).toBe(false);
    expect(contactoJaNaoServe({ estado: "acordada", fase: "confirmado" })).toBe(true);
    expect(contactoJaNaoServe({ estado: "acordada", fase: "pago" })).toBe(true);
    expect(contactoJaNaoServe({ estado: "acordada", fase: "a_executar", arquivadoEm: "2026-10-25" })).toBe(true);
    expect(contactoJaNaoServe({ estado: "morta", fase: "a_negociar" })).toBe(true);
  });
});

describe("quem lê estes campos aguenta o null", () => {
  it("o painel e a app declaram-nos string | null", () => {
    const painel = ler("src/app/profissionais/painel/tipos.ts");
    for (const campo of ["morada", "contactoNome", "contactoTelefone"]) {
      expect(painel).toMatch(new RegExp(`\\b${campo}: string \\| null;`));
    }
    expect(painel).toMatch(/\bmoradaDestino\?: string \| null;/);
    const app = ler("app-pro/src/lib/trabalhos.ts");
    for (const campo of CAMPOS_DO_CONTACTO_DO_CLIENTE) {
      expect(app).toMatch(new RegExp(`\\b${campo}: string \\| null;`));
    }
  });

  it("e a rota aplica a regra depois de vistaParaOEstado", () => {
    const rota = ler("src/app/api/profissionais/meus-pedidos/route.ts");
    const vista = rota.indexOf("vistaParaOEstado(l as unknown as Record<string, unknown>, l.estado)");
    const regra = rota.indexOf("return semContactoDepoisDoFim({");
    expect(vista).toBeGreaterThan(-1);
    expect(regra).toBeGreaterThan(vista);
  });
});
