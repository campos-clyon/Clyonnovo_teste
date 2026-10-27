import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { assistenteComSeccoesPodeChamar } from "./papel-do-painel";
import { MAXIMO_DE_REFERENCIAS_POR_ASSISTENTE, porqueNaoPodeGerarMais } from "./limite-de-referencias";
import { mensagemDeAdjudicacao } from "./mensagem-de-adjudicacao";
import { quantoSePedeNesteTrabalho } from "./eupago";

/**
 * A REFERÊNCIA NO «ENVIAR ADJUDICAÇÃO» — 27-10-2026 (d14, versão 2).
 *
 * Quem tem a Mesa (Trabalhos CLYON ou negociações), assistentes incluídos,
 * gera a referência Multibanco ou o MB WAY do euPago na hora, pela rota de
 * sempre, e a mensagem de adjudicação leva-a. O valor é sempre o do
 * servidor; registar à mão, pagar ao profissional e a fatura continuam do
 * administrador; há um limite diário por assistente.
 *
 * A rota corre a sério (sem rede nem base): o euPago e a base são de mentira.
 */

type Linha = {
  id: number;
  negociacaoId: number;
  metodo: "multibanco" | "mbway";
  estado: string;
  valor: number;
  comFactura: boolean;
  entidade: string | null;
  referencia: string | null;
  telemovel: string | null;
  expiraEm: Date | null;
  pagoEm: Date | null;
  valorPago: number | null;
  criadoEm: Date;
  geradoPor: number | null;
};

const TRABALHO = {
  pedidoId: 501,
  negociacaoId: 70,
  providerId: 3,
  profissionalNome: "Empresa Exemplo",
  acordado: 300,
  regime: "normal",
  taxas: { cliente: 0, profissional: 0.11 },
  formaDePagamento: "na_plataforma",
  modelo: "iva_incluido" as const,
  libertado: false,
  acrescimo: 0,
  telefoneDoCliente: "912345678",
  telefoneDoProfissional: null,
  nomeDoCliente: "Ana Exemplo",
  emailDoCliente: null,
};

const base = {
  colab: { id: 9, nome: "Assistente Exemplo", isAdmin: 0, papel: "assistente" as "assistente" | "admin" },
  linhas: [] as Linha[],
  geradas24h: 0,
  pedidosAoEupago: [] as Array<{ metodo: string; valor: number }>,
  registo: [] as Array<{ acontecimento: string; autorNome?: string | null; detalhe?: Record<string, unknown> }>,
  trabalho: { ...TRABALHO },
};

vi.mock("@/lib/admin-auth-helper", () => ({
  requireAdmin: async () => ({ err: null, colab: base.colab }),
}));
vi.mock("@/lib/acesso-ao-pagamento", () => ({
  trabalhoVistoPeloBackoffice: async () => ({ ok: true, trabalho: base.trabalho }),
}));
vi.mock("@/lib/db", () => ({
  registarSemFalhar: async (r: (typeof base.registo)[number]) => {
    base.registo.push(r);
  },
}));
vi.mock("@/lib/pedir-ao-eupago", () => ({
  pedirPagamento: async (_c: unknown, metodo: string, d: { valor: number }) => {
    base.pedidosAoEupago.push({ metodo, valor: d.valor });
    const n = base.pedidosAoEupago.length;
    return { ok: true, referencia: `10429583${n}`, entidade: metodo === "multibanco" ? "21921" : null, trid: null };
  },
}));
vi.mock("@/lib/pagamentos-na-base", () => ({
  pagamentosDaNegociacao: async () => [...base.linhas].sort((a, b) => b.id - a.id),
  geradasPorNasUltimas24h: async () => base.geradas24h,
  fecharSemPagar: async (id: number, estado: string) => {
    const l = base.linhas.find((x) => x.id === id)!;
    l.estado = estado;
    return { feito: true };
  },
  marcarFalhado: async () => {},
  abrirPagamento: async (d: Omit<Linha, "id" | "estado" | "entidade" | "referencia" | "pagoEm" | "valorPago" | "criadoEm">) => {
    const id = base.linhas.length + 1;
    base.linhas.push({
      ...d,
      id,
      estado: "pendente",
      entidade: null,
      referencia: null,
      telemovel: d.telemovel ?? null,
      expiraEm: d.expiraEm ?? null,
      pagoEm: null,
      valorPago: null,
      criadoEm: new Date(),
      geradoPor: d.geradoPor ?? null,
    });
    return id;
  },
  // A regra de `substituirAsAnteriores` (o SQL está em pagamentos-na-base-sql.test.ts).
  marcarPedido: async (id: number, d: { referencia: string; entidade: string | null }) => {
    const nova = base.linhas.find((x) => x.id === id)!;
    Object.assign(nova, { referencia: d.referencia, entidade: d.entidade });
    for (const l of base.linhas) {
      if (l.id === id || l.estado !== "pendente" || l.negociacaoId !== nova.negociacaoId) continue;
      if (l.metodo === nova.metodo || Math.abs(l.valor - nova.valor) > 0.011 || l.comFactura !== nova.comFactura) {
        l.estado = "substituido";
      }
    }
  },
}));

beforeAll(() => {
  vi.stubEnv("EUPAGO_API_KEY", "chave-de-teste");
});
afterAll(() => {
  vi.unstubAllEnvs();
});
// O primeiro import da rota é lento com a suite inteira a correr ao lado.
beforeAll(async () => {
  await import("@/app/api/admin/pagamentos/criar/route");
}, 60_000);

async function gerar(corpo: Record<string, unknown>) {
  const { POST } = await import("@/app/api/admin/pagamentos/criar/route");
  const req = new Request("https://clyon.pt/api/admin/pagamentos/criar", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ negociacaoId: 70, ...corpo }),
  });
  const r = await POST(req as never);
  return { estado: r.status, corpo: (await r.json()) as Record<string, any> };
}

const doServidor = () => quantoSePedeNesteTrabalho(base.trabalho as never, true).valor;

beforeEach(() => {
  base.colab = { id: 9, nome: "Assistente Exemplo", isAdmin: 0, papel: "assistente" };
  base.linhas = [];
  base.geradas24h = 0;
  base.pedidosAoEupago = [];
  base.registo = [];
  base.trabalho = { ...TRABALHO };
});

describe("um assistente com Trabalhos CLYON gera, e a mensagem leva a referência", () => {
  it("as portas: Trabalhos CLYON e negociações abrem gerar e conferir; sem a secção, não", () => {
    for (const rota of ["/api/admin/pagamentos/criar", "/api/admin/pagamentos/conferir"]) {
      expect(assistenteComSeccoesPodeChamar(["trabalhos_clyon"], rota, "POST"), rota).toBe(true);
      expect(assistenteComSeccoesPodeChamar(["negociacoes_clyon"], rota, "POST"), rota).toBe(true);
      expect(assistenteComSeccoesPodeChamar(["pagamentos"], rota, "POST"), rota).toBe(false);
      expect(assistenteComSeccoesPodeChamar(["agenda", "whatsapp"], rota, "POST"), rota).toBe(false);
      expect(assistenteComSeccoesPodeChamar([], rota, "POST"), rota).toBe(false);
    }
  });

  it("gera a Multibanco pelo servidor e a adjudicação leva entidade, referência e valor", async () => {
    const r = await gerar({ metodo: "multibanco" });
    expect(r.estado).toBe(200);
    const p = r.corpo.pagamento;
    expect(p.valor).toBe(doServidor());
    const m = mensagemDeAdjudicacao(
      {
        cliente: "Ana Exemplo",
        quando: null,
        empresa: "Empresa Exemplo",
        formas: { comDadosDoDono: false, referencias: [p] },
      },
      new Date("2026-10-27T12:00:00Z"),
    );
    expect(m).toContain(`Entidade: ${p.entidade}`);
    expect(m).toContain(`Referência: ${p.referencia}`);
    expect(m).toContain(`Valor: ${p.valor.toFixed(2).replace(".", ",")} €`);
    expect(m).toContain("euPago");
    // Quem gerou fica no registo permanente, com o nome e o id.
    const pedido = base.registo.find((x) => x.acontecimento === "pagamento_pedido")!;
    expect(pedido.autorNome).toBe("Assistente Exemplo");
    expect(pedido.detalhe).toMatchObject({ colaboradorId: 9, papel: "assistente" });
    expect(base.linhas[0].geradoPor).toBe(9);
  });

  it("o MB WAY vai para o telemóvel escrito, e a mensagem di-lo", async () => {
    const r = await gerar({ metodo: "mbway", telemovel: "912 345 678" });
    expect(r.estado).toBe(200);
    const m = mensagemDeAdjudicacao(
      { cliente: null, quando: null, formas: { comDadosDoDono: false, referencias: [r.corpo.pagamento] } },
      new Date(),
    );
    expect(m).toMatch(/MB WAY: enviámos um pedido de .* para o 912 345 678/);
  });

  it("os dados do dono juntam-se às referências; sem nenhuma forma, os dados seguem a seguir", () => {
    const m = mensagemDeAdjudicacao(
      {
        cliente: null,
        quando: null,
        metodosDePagamento: "Transferência: dados de exemplo",
        formas: {
          comDadosDoDono: true,
          referencias: [{ metodo: "multibanco", valor: 10, entidade: "21921", referencia: "104295830" }],
        },
      },
      new Date(),
    );
    expect(m).toContain("Para o pagamento, pode usar uma destas opções:");
    expect(m).toContain("Transferência: dados de exemplo");
    const sem = mensagemDeAdjudicacao(
      { cliente: null, quando: null, metodosDePagamento: "x", formas: { comDadosDoDono: false, referencias: [] } },
      new Date(),
    );
    expect(sem).toContain("Enviamos-lhe os dados para o pagamento a seguir.");
  });
});

describe("não consegue mandar outro valor", () => {
  it("o valor do corpo é ignorado — pede-se o do servidor", async () => {
    const r = await gerar({ metodo: "multibanco", valor: 1, value: 1, amount: 1 });
    expect(r.corpo.pagamento.valor).toBe(doServidor());
    expect(base.pedidosAoEupago).toEqual([{ metodo: "multibanco", valor: doServidor() }]);
  });
});

describe("uma segunda referência anula a primeira", () => {
  it("a Multibanco viva do mesmo valor reaproveita-se; com outro valor, a antiga fica substituída", async () => {
    await gerar({ metodo: "multibanco" });
    const outra = await gerar({ metodo: "multibanco" });
    expect(outra.corpo.reaproveitada).toBe(true);
    expect(base.pedidosAoEupago).toHaveLength(1);

    base.trabalho = { ...TRABALHO, acordado: 350 };
    await gerar({ metodo: "multibanco" });
    expect(base.linhas.map((l) => l.estado)).toEqual(["substituido", "pendente"]);
  });

  it("um MB WAY do mesmo valor ao lado de uma Multibanco não a anula (duas formas do mesmo pagamento)", async () => {
    await gerar({ metodo: "multibanco" });
    await gerar({ metodo: "mbway", telemovel: "912345678" });
    expect(base.linhas.map((l) => [l.metodo, l.estado])).toEqual([
      ["multibanco", "pendente"],
      ["mbway", "pendente"],
    ]);
  });
});

describe("o que continua só do administrador", () => {
  it("registar recebido, pagar ao profissional, a fatura e excluir são recusados ao assistente com a Mesa", () => {
    const seccoes = ["trabalhos_clyon", "negociacoes_clyon", "pagamentos"];
    for (const rota of [
      "/api/admin/pagamentos/recebido",
      "/api/admin/pagamentos/pago-ao-profissional",
      "/api/admin/pagamentos/fatura-emitida",
      "/api/admin/pagamentos/excluir",
      "/api/admin/pagamentos/factura",
    ]) {
      expect(assistenteComSeccoesPodeChamar(seccoes, rota, "POST"), rota).toBe(false);
    }
  });

  it("e as rotas repetem a tranca do lado delas", () => {
    for (const f of ["recebido", "pago-ao-profissional", "fatura-emitida"]) {
      const fonte = readFileSync(join(process.cwd(), `src/app/api/admin/pagamentos/${f}/route.ts`), "utf8");
      expect(fonte, f).toContain("requireAdminGeral(req)");
    }
  });
});

describe("o limite diário por assistente", () => {
  it("a regra: até ao máximo passa, no máximo recusa; o administrador não tem limite", () => {
    expect(porqueNaoPodeGerarMais("assistente", MAXIMO_DE_REFERENCIAS_POR_ASSISTENTE - 1)).toBeNull();
    expect(porqueNaoPodeGerarMais("assistente", MAXIMO_DE_REFERENCIAS_POR_ASSISTENTE)).toMatch(/limite/);
    expect(porqueNaoPodeGerarMais("admin", 500)).toBeNull();
  });

  it("na rota: o assistente no limite é recusado com a mensagem, sem pedir nada ao euPago", async () => {
    base.geradas24h = MAXIMO_DE_REFERENCIAS_POR_ASSISTENTE;
    const r = await gerar({ metodo: "multibanco" });
    expect(r.estado).toBe(429);
    expect(r.corpo.error).toMatch(/últimas 24 horas/);
    expect(base.pedidosAoEupago).toHaveLength(0);
  });

  it("o administrador no mesmo número gera", async () => {
    base.colab = { id: 1, nome: "Admin", isAdmin: 1, papel: "admin" };
    base.geradas24h = 500;
    const r = await gerar({ metodo: "multibanco" });
    expect(r.estado).toBe(200);
  });
});

describe("o botão no ecrã", () => {
  it("está nos Trabalhos CLYON e na Mesa, e não manda valor nenhum", () => {
    const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    expect(ler("src/components/admin/TrabalhoClyon.tsx")).toContain("<EnviarAdjudicacao");
    expect(ler("src/components/admin/AdminNegociacoesPanel.tsx")).toContain("<EnviarAdjudicacao");
    const botao = ler("src/components/admin/EnviarAdjudicacao.tsx");
    expect(botao).toContain('"/api/admin/pagamentos/criar"');
    const corpo = botao.slice(botao.indexOf("body: JSON.stringify("), botao.indexOf("}),", botao.indexOf("body: JSON.stringify(")));
    expect(corpo).not.toMatch(/valor/);
  });
});
