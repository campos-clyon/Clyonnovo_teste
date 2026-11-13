import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * D17 — O CLIENTE VÊ O MESMO TOTAL EM TODO O LADO (CEO e dono, 13-11-2026).
 *
 * No modelo de 15-11 o total depende do regime do parceiro. Com um parceiro
 * isento, o cartão da proposta dizia 430,50 € (a conta antiga) e o bloco
 * «Pagar a …» 358,05 € pelo mesmo trabalho. Aqui corre-se o mesmo pedido de
 * teste pelas portas de verdade — o cartão (página do pedido e conta), o bloco
 * «Pagar a …» (/api/pagamentos/ao-parceiro), o email da proposta e a R5 da app
 * de cliente — com um parceiro isento e com um com IVA, e exige-se o mesmo
 * número. Os valores saem da conta do código (350 € a 0 % + 10 %): isento
 * 315,00 + 35,00 + 8,05 = 358,05 €; com IVA 387,45 + 43,05 = 430,50 €.
 * Dados de teste.
 */

const DIA_16 = new Date("2026-11-16T10:00:00Z");
const ANTES = new Date("2026-11-13T10:00:00Z");
const EMAIL = "cliente.teste@exemplo.pt";

type Perfil = { regimeIva: string; regimeIvaConfirmadoEm: string | null; iban: string | null; ibanTitular: string | null; mbway: string | null };
let perfil: Perfil;
let pagamentos: Array<Record<string, unknown>> = [];
const emails: Array<Record<string, unknown>> = [];

const proposta = (valor: number) => JSON.stringify([{ por: "profissional", valor, criadaEm: "2026-11-16T09:00:00Z", estado: "pendente" }]);

function negociacao(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 900,
    pedidoId: 800,
    providerId: 31,
    estado: "aberta",
    valorAcordado: null,
    propostasJson: proposta(350),
    taxaCliente: "0",
    taxaProfissional: "0.1000",
    createdAt: "2026-11-16T08:00:00Z",
    ofertaClyon: null,
    regimeDoProfissional: null,
    profissionalNome: "Parceiro de Teste",
    profissionalTelefone: "912345678",
    regimeIva: perfil.regimeIva,
    regimeIvaConfirmadoEm: perfil.regimeIvaConfirmadoEm,
    guiaVerificadaEm: null,
    emiteGuiaTransporte: 0,
    parceiroVerificado: 0,
    ...extra,
  };
}
let linhaNaBase: Record<string, unknown> = {};

vi.mock("@/lib/db", async (original) => ({
  ...(await original<typeof import("@/lib/db")>()),
  getPool: vi.fn(async () => ({
    execute: vi.fn(async (sql: string) => (String(sql).includes("FROM negociacoes x") ? [[linhaNaBase], []] : [[], []])),
  })),
  perfilDoProfissional: vi.fn(async () => ({ id: 31, name: "Parceiro de Teste", email: "parceiro.teste@exemplo.pt", ...perfil })),
  getSimulatorOrderById: vi.fn(async () => ({ id: 800, baseDoPreco: "total", contactEmail: EMAIL, contactName: "Cliente Teste" })),
  negociacoesDoPedido: vi.fn(async () => [linhaNaBase]),
  existeContaComEmail: vi.fn(async () => true),
  substituirTokenDoPedido: vi.fn(async () => {}),
  contaDaTransferencia: vi.fn(async () => null),
  registarSemFalhar: vi.fn(async () => {}),
}));
vi.mock("@/lib/pagamentos-na-base", async (original) => ({
  ...(await original<typeof import("@/lib/pagamentos-na-base")>()),
  pagamentosDaNegociacao: vi.fn(async () => pagamentos.map((p) => ({ ...p }))),
}));
vi.mock("@/lib/pagar-ao-parceiro-na-base", () => ({
  congelarRegimeDoProfissional: vi.fn(async (_id: number, r: string) => r),
  oQueONovoModeloGravou: vi.fn(async () => ({ regimeDoProfissional: null, pagarAoParceiroPor: null })),
  gravarComoPagarAoParceiro: vi.fn(async () => {}),
}));
vi.mock("@/lib/faturas-do-trabalho-na-base", () => ({ faturasDaNegociacao: vi.fn(async () => []) }));
vi.mock("@/lib/acesso-ao-pagamento", () => ({
  trabalhoQueSePodePagar: vi.fn(async (pedidoId: number, negociacaoId: number) => ({
    ok: true,
    trabalho: {
      pedidoId,
      negociacaoId,
      providerId: 31,
      profissionalNome: "Parceiro de Teste",
      acordado: 350,
      regime: "normal",
      taxas: { cliente: 0, profissional: 0.1 },
      formaDePagamento: "na_plataforma",
      acrescimo: 0,
      modelo: "iva_incluido",
      libertado: false,
      novoModelo: true,
      porHora: null,
      telefoneDoCliente: null,
      telefoneDoProfissional: "912345678",
      nomeDoCliente: null,
      emailDoCliente: EMAIL,
    },
  })),
}));
vi.mock("@/lib/email-proposta", async (original) => ({
  ...(await original<typeof import("@/lib/email-proposta")>()),
  avisarClienteDaProposta: vi.fn(async (p: Record<string, unknown>) => {
    emails.push(p);
    return true;
  }),
}));
vi.mock("@/lib/avisar-por-push", async (original) => ({
  ...(await original<typeof import("@/lib/avisar-por-push")>()),
  avisarClientePorPush: vi.fn(async () => {}),
}));
vi.mock("@/lib/cliente-auth", () => ({ sessaoDoCliente: vi.fn(async () => null) }));
vi.mock("@/lib/limite-rota-publica", () => ({
  limitarRotaPublica: vi.fn(async () => ({ erro: null })),
  limitarPorConta: vi.fn(async () => ({ erro: null })),
}));

import { totalAoCliente, totalAoClienteDaNegociacao } from "./total-ao-cliente";
import { negociacoesParaOCliente } from "./negociacoes-para-o-cliente";
import { negociacaoParaAVista, type LinhaParaAVista } from "./negociacao-na-vista";
import { negociacaoParaOEcra } from "./negociacao-no-ecra";
import { novoModeloParaOCliente } from "./novo-modelo-no-servidor";
import { negociacoesDaContaNoEcra } from "./pedidos-da-conta";
import { pagamentoParaAApp } from "./pedidos-do-cliente";
import { avisarDaProposta } from "./avisar-da-proposta";
import { GET as pagarAoParceiro } from "@/app/api/pagamentos/ao-parceiro/route";

const ISENTO: Perfil = { regimeIva: "isento", regimeIvaConfirmadoEm: "2026-11-13T09:00:00Z", iban: "PT50000201231234567890154", ibanTitular: "Parceiro de Teste", mbway: null };
const COM_IVA: Perfil = { ...ISENTO, regimeIva: "normal", mbway: "912345678" };

/** O número do cartão: a linha passa pela regra de todas as portas e pelo servidor, como na página do pedido. */
async function cartao(extra: Record<string, unknown> = {}, agora = DIA_16) {
  linhaNaBase = negociacao(extra);
  const [visivel] = negociacoesParaOCliente([linhaNaBase as never], 0);
  const doServidor = await novoModeloParaOCliente([visivel as never], agora);
  const vista = negociacaoParaAVista(visivel as unknown as LinhaParaAVista, {
    porCarga: false,
    agora,
    novoModeloDoServidor: doServidor.get(900) ?? null,
  });
  return { vista, ecra: negociacaoParaOEcra(vista, "total", agora, 800) };
}

async function blocoPagarA(): Promise<number | null> {
  const r = await pagarAoParceiro(new NextRequest("https://clyon.pt/api/pagamentos/ao-parceiro?pedidoId=800&negociacaoId=900&token=t"));
  const j = (await r.json()) as { conta?: { total: number | null } };
  return j.conta?.total ?? null;
}

async function emailDaProposta(): Promise<Record<string, unknown>> {
  emails.length = 0;
  linhaNaBase = negociacao();
  await avisarDaProposta({ pedidoId: 800, negociacaoId: 900, quemPropos: "profissional", valor: 350 });
  return emails[0] ?? {};
}

beforeEach(() => {
  pagamentos = [];
  process.env.NOVO_MODELO_DATA_SIMULADA = DIA_16.toISOString();
});
afterEach(() => {
  delete process.env.NOVO_MODELO_DATA_SIMULADA;
});

describe("a conta, pela regra do código", () => {
  it("350 € a 0 % + 10 %: isento 358,05 €, com IVA 430,50 € — e o sem IVA ao lado", () => {
    const taxas = { cliente: 0, profissional: 0.1 };
    expect(totalAoCliente(350, taxas, "isento")).toMatchObject({ total: 358.05, semIva: 350, iva: 8.05 });
    expect(totalAoCliente(350, taxas, "normal")).toMatchObject({ total: 430.5, semIva: 350, iva: 80.5 });
    // Sem o regime confirmado, como com IVA (perfil-fiscal.ts).
    expect(totalAoClienteDaNegociacao({ taxaCliente: 0, taxaProfissional: 0.1, regimeIva: "isento" }, 350)?.total).toBe(430.5);
    // O regime congelado ao contratar manda sobre o do perfil.
    expect(
      totalAoClienteDaNegociacao({ taxaCliente: 0, taxaProfissional: 0.1, regimeIva: "normal", regimeIvaConfirmadoEm: "x", regimeDoProfissional: "isento" }, 350)?.total,
    ).toBe(358.05);
  });
});

describe.each([
  ["isento", ISENTO, 358.05, "358,05 €"],
  ["com IVA", COM_IVA, 430.5, "430,50 €"],
] as const)("o mesmo número em todo o lado — parceiro %s", (_nome, p, total, texto) => {
  beforeEach(() => {
    perfil = { ...p };
  });

  it("o cartão da proposta (página do pedido e app) e a conta", async () => {
    const { vista, ecra } = await cartao();
    expect(vista.novoModelo?.total).toBe(total);
    expect(ecra.valores?.aPagar).toBe(total);
    expect(ecra.preco?.principal).toBe(`${texto} com IVA`);
    // E quem passa a fatura, ao lado do preço.
    expect(ecra.preco?.detalhe).toContain(vista.novoModelo!.perfilFiscal.fatura);
    // A conta do site (/conta) pela mesma porta.
    const [daConta] = negociacoesDaContaNoEcra({ id: 800, baseDoPreco: "total" }, [linhaNaBase as never], DIA_16, await novoModeloParaOCliente(negociacoesParaOCliente([linhaNaBase as never], 0), DIA_16));
    expect(daConta.valores?.aPagar).toBe(total);
  });

  it("o bloco «Pagar a …» depois de contratar", async () => {
    expect(await blocoPagarA()).toBe(total);
    const { ecra } = await cartao({ estado: "acordada", valorAcordado: "350.00" });
    expect(ecra.valores?.aPagar).toBe(total);
  });

  it("o email da proposta", async () => {
    const e = await emailDaProposta();
    expect(e.preco).toBe(total);
    expect(e.ivaIncluido).toBe(true);
    expect(e.fatura).toBeTruthy();
  });

  it("a R5 da app de cliente: pagaAoParceiro, os dados para pagar e o total", async () => {
    const r = await pagamentoParaAApp(800, { id: 900, estado: "acordada", fase: "a_executar" } as never, EMAIL);
    expect(r?.pagaAoParceiro).toBe(true);
    expect(r?.emDinheiroAoProfissional).toBe(false);
    expect(r?.aoParceiro?.conta?.total).toBe(total);
    expect(r?.valoresTexto.comFactura.startsWith(texto)).toBe(true);
    expect(r?.aoParceiro?.paraPagar?.iban).toBe(p.iban);
  });
});

describe("só as formas para as quais o parceiro tem dados", () => {
  it("sem MB WAY não há «MB WAY»; sem IBAN não há «Transferência»; sem os dois, a frase F", async () => {
    perfil = { ...ISENTO, mbway: null };
    let r = await pagamentoParaAApp(800, { id: 900, estado: "acordada", fase: "a_executar" } as never, EMAIL);
    expect(r?.aoParceiro?.opcoes.map((o) => o.id)).toEqual(["transferencia", "dinheiro"]);
    perfil = { ...ISENTO, iban: null, mbway: "912345678" };
    r = await pagamentoParaAApp(800, { id: 900, estado: "acordada", fase: "a_executar" } as never, EMAIL);
    expect(r?.aoParceiro?.opcoes.map((o) => o.id)).toEqual(["mbway", "dinheiro"]);
    perfil = { ...ISENTO, iban: null, mbway: null };
    r = await pagamentoParaAApp(800, { id: 900, estado: "acordada", fase: "a_executar" } as never, EMAIL);
    expect(r?.aoParceiro?.opcoes.map((o) => o.id)).toEqual(["dinheiro"]);
    expect(r?.aoParceiro?.semDados).toContain("ainda não pôs os dados");
  });
});

describe("o achado da d20: pago à CLYON antes do corte, fica no antigo", () => {
  it("um contratado com a caução paga a 14-11 não mostra o bloco do modelo novo", async () => {
    perfil = { ...ISENTO };
    pagamentos = [{ id: 1, estado: "pago", pagoEm: new Date("2026-11-14T12:00:00Z"), criadoEm: new Date("2026-11-14T11:00:00Z"), metodo: "mbway", parte: null }];
    const { vista } = await cartao({ estado: "acordada", valorAcordado: "350.00" });
    expect(vista.novoModelo).toBeNull();
    // Uma referência emitida a 14-11 e paga a 16-11, dentro do prazo, também (d20).
    pagamentos = [{ id: 2, estado: "pago", pagoEm: new Date("2026-11-16T09:00:00Z"), criadoEm: new Date("2026-11-14T11:00:00Z"), expiraEm: new Date("2026-11-17T11:00:00Z"), metodo: "multibanco", parte: null }];
    expect((await cartao({ estado: "acordada", valorAcordado: "350.00" })).vista.novoModelo).toBeNull();
    // Sem nada pago, o novo.
    pagamentos = [];
    expect((await cartao({ estado: "acordada", valorAcordado: "350.00" })).vista.novoModelo?.total).toBe(358.05);
  });

  it("antes de 15-11 nada muda, e o servidor nem vai à base", async () => {
    perfil = { ...ISENTO };
    expect((await novoModeloParaOCliente([negociacao() as never], ANTES)).size).toBe(0);
    const { vista, ecra } = await cartao({}, ANTES);
    expect(vista.novoModelo).toBeNull();
    expect(ecra.valores?.aPagar).toBe(430.5);
  });
});

describe("a adjudicação da Mesa e o MB WAY da taxa no modelo novo", () => {
  const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

  it("o texto D: sem «Paga à CLYON», sem referências, com o total e o link", async () => {
    const { mensagemDeAdjudicacao } = await import("./mensagem-de-adjudicacao");
    const m = mensagemDeAdjudicacao(
      {
        cliente: "Cliente Teste",
        quando: null,
        servico: "recolha",
        empresa: "Parceiro de Teste",
        formas: {
          comDadosDoDono: true,
          motivoDosDadosDoDono: "um motivo qualquer",
          referencias: [{ metodo: "multibanco", valor: 54.12, entidade: "12345", referencia: "123456789" }],
          link: "https://clyon.pt/pedido/abc?pagar=1",
          novoModelo: { total: 358.05, semIva: 350, formas: ["transferencia", "dinheiro"] },
        },
        metodosDePagamento: "IBAN do dono",
      },
      DIA_16,
    );
    expect(m).toContain("O total é 358,05 € com IVA (350,00 € sem IVA), já com a taxa da plataforma.");
    expect(m).toContain("Paga diretamente a Parceiro de Teste, no fim do trabalho (salvo se combinarem outra coisa): por transferência ou em dinheiro no local.");
    expect(m).toContain("https://clyon.pt/pedido/abc?pagar=1");
    expect(m).toContain("Guarde o comprovativo do pagamento.");
    expect(m).not.toContain("Paga à CLYON");
    expect(m).not.toContain("Referência");
    expect(m).not.toContain("IBAN do dono");
    expect(m).not.toContain("envie-nos o comprovativo");
  });

  it("a rota decide o modelo no servidor; o MB WAY da taxa só para o telefone do profissional", () => {
    const adj = ler("src/app/api/admin/negociacoes/adjudicacao/route.ts");
    expect(adj).toContain("const noNovoModelo = acesso.ok && acesso.trabalho.novoModelo;");
    expect(adj).toContain("oQueOClienteVeDoParceiro(acesso.trabalho)");
    const criar = ler("src/app/api/admin/pagamentos/criar/route.ts");
    expect(criar).toMatch(/t\.novoModelo && corpo\.origem === "adjudicacao"/);
    expect(criar).toMatch(/\? t\.novoModelo\s*\?\s*t\.telefoneDoProfissional/);
    const botao = ler("src/components/admin/EnviarAdjudicacao.tsx");
    expect(botao).toContain('origem: "adjudicacao"');
    expect(botao).toContain("novoModelo: p.novoModelo ?? null");
  });
});

describe("a app Pro e o painel deixam de dizer «O cliente ainda não pagou à CLYON» no modelo novo", () => {
  it("a rota dos trabalhos põe clientePagou a null e manda noNovoModelo", () => {
    const rota = readFileSync(join(process.cwd(), "src/app/api/profissionais/meus-pedidos/route.ts"), "utf8");
    expect(rota).toMatch(/clientePagou:[\s\S]{0,200}!doNovoModelo\.has\(Number\(l\.id\)\) &&/);
    expect(rota).toContain("noNovoModelo: doNovoModelo.has(Number(l.id)),");
  });

  it("o cartão do painel e o aviso de confirmação dizem o modelo novo", async () => {
    const { ondeEstaODinheiro, avisoDoConfirmado } = await import("./fim-do-trabalho");
    const onde = ondeEstaODinheiro({ fase: "confirmado", valorAcordado: 350, taxas: { cliente: 0, profissional: 0.1 }, clientePagou: null, noNovoModelo: true });
    expect(onde?.frase).toBe(
      "O cliente paga-lhe diretamente: 315,00 € do trabalho são seus. Passe à CLYON a taxa da plataforma e o IVA dela, 43,05 €, com a referência na carteira.",
    );
    for (const caso of ["disponivel", "por_cobrar", "em_mao_com_divida", "pago"] as const) {
      const a = avisoDoConfirmado({ pedidoId: 800, caso, liquido: 315, aPagarAClyon: 43.05, noNovoModelo: true });
      expect(a.body).toBe("O pedido #800 ficou confirmado. Passe à CLYON a taxa da plataforma e o IVA dela: 43,05 €, com a referência na carteira.");
    }
  });
});
