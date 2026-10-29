import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * R10 — O LINK DE UM PEDIDO NA APP DE CLIENTE (d8 fase 2, S6, 28-10-2026).
 *
 * Do email da sessão → `seu`; sem email (WhatsApp) → um resumo e, com
 * `juntar`, fica à espera da Mesa (29-10-2026, Segurança R13): o email do
 * pedido NÃO se grava e o contacto é avisado; de outro email → nada do
 * pedido; expirado → 410. O token nunca roda nem se guarda. Dados de teste.
 */

const pedidos = new Map<string, Record<string, unknown>>();
const historico: Array<{ id: number; message: string }> = [];
const codigos = new Map<number, { email: string; hash: string }>();
const convidados: Array<{ pedidoId: number; prova: string; sessaoHash: string }> = [];
const whatsapp = { sai: false, mensagens: [] as Array<{ para: string; texto: string }> };
const porId = (id: number) => [...pedidos.values()].find((x) => x.id === id);

vi.mock("@/lib/db", () => ({
  ensureUsersSchema: vi.fn(async () => {}),
  getPool: vi.fn(async () => ({
    execute: vi.fn(async (sql: string) =>
      /FROM users/.test(sql) ? [[{ sessoesClienteDesde: null, contaMaisNova: 0 }], undefined] : [[], undefined],
    ),
  })),
  getSimulatorOrderByAcessoTokenHash: vi.fn(async (hash: string) => pedidos.get(hash)),
  pedirJuncaoAConta: vi.fn(async (id: number, email: string) => {
    const p = [...pedidos.values()].find((x) => x.id === id)!;
    if (String(p.contactEmail ?? "").trim()) return false;
    if (p.juntarAContaPedidoPor && p.juntarAContaPedidoPor !== email) return false;
    p.juntarAContaPedidoPor = email;
    return true;
  }),
  appendOrderHistory: vi.fn(async (id: number, e: { message: string }) => {
    historico.push({ id, message: e.message });
  }),
  getSimulatorOrderById: vi.fn(async (id: number) => porId(id)),
  MINUTOS_DO_CODIGO: 10,
  guardarCodigoDeJuncao: vi.fn(async (id: number, email: string, hash: string) => {
    const p = porId(id)!;
    if (String(p.contactEmail ?? "").trim()) return false;
    if (p.juntarAContaPedidoPor && p.juntarAContaPedidoPor !== email) return false;
    codigos.set(id, { email, hash });
    p.juntarAContaPedidoPor = email;
    return true;
  }),
  conferirCodigoDeJuncao: vi.fn(async (id: number, email: string, hash: string) => {
    const c = codigos.get(id);
    if (!c || c.email !== email) return "semCodigo";
    if (c.hash !== hash) return "errado";
    porId(id)!.contactEmail = email;
    return "juntado";
  }),
  abrirSessaoDeConvidado: vi.fn(async (c: { pedidoId: number; prova: string; sessaoHash: string }) => {
    const provas = new Set(convidados.filter((x) => x.pedidoId === c.pedidoId).map((x) => x.prova));
    if (!provas.has(c.prova) && provas.size >= 3) return "muitosAparelhos";
    convidados.push(c);
    return "ok";
  }),
  sessaoDeConvidadoPorHash: vi.fn(async () => null),
  tocarSessaoDeConvidado: vi.fn(async () => {}),
}));
vi.mock("@/lib/whatsapp-cloud", () => ({
  enviarAvisoWhatsApp: vi.fn(async (para: string, texto: string) => {
    whatsapp.mensagens.push({ para, texto });
    return whatsapp.sai;
  }),
}));
vi.mock("@/lib/avisar-contacto-do-pedido", async (original) => ({
  ...(await original<typeof import("@/lib/avisar-contacto-do-pedido")>()),
  avisarContactoDoPedido: vi.fn(async () => true),
}));
vi.mock("@/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => null) }));
vi.mock("@/lib/limite-rota-publica", () => ({
  limitarRotaPublica: vi.fn(async () => ({ erro: null })),
  limitarPorConta: vi.fn(async () => ({ erro: null })),
}));

import * as db from "@/lib/db";
import { avisarContactoDoPedido } from "@/lib/avisar-contacto-do-pedido";
import { limitarPorConta } from "@/lib/limite-rota-publica";
import { POST as pedidoDoLink } from "@/app/api/cliente/pedido-do-link/route";
import { assinarSessaoDoCliente } from "@/lib/cliente-auth";
import { hashDeToken } from "@/lib/pedido-acesso";

const EMAIL = "cliente.teste@exemplo.pt";
const OUTRA = "outra.conta@exemplo.pt";
const DO_WHATSAPP = "w".repeat(43);
const MEU = "m".repeat(43);
const DE_OUTRO = "o".repeat(43);
const VELHO = "v".repeat(43);
let sessao = "";
let outraSessao = "";

function chamar(corpo: unknown, bearer = sessao) {
  return new NextRequest("https://clyon.pt/api/cliente/pedido-do-link", {
    method: "POST",
    headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify(corpo),
  });
}

function pedido(id: number, token: string, contactEmail: string | null, expira = Date.now() + 86_400_000) {
  pedidos.set(hashDeToken(token), {
    id,
    serviceType: "recolha_moveis",
    city: "Setúbal",
    address: "Rua de Teste 2",
    contactPhone: "912 345 678",
    contactEmail,
    createdAt: new Date("2026-10-26T09:00:00Z"),
    acessoTokenHash: hashDeToken(token),
    acessoTokenExpiraEm: new Date(expira),
  });
}

beforeAll(async () => {
  process.env.JWT_SECRET = "segredo-so-dos-testes-do-pedido-do-link";
  const antes = new Date(Date.now() - 3600_000);
  sessao = (await assinarSessaoDoCliente(EMAIL, "link", antes)).token;
  outraSessao = (await assinarSessaoDoCliente(OUTRA, "link", antes)).token;
});

beforeEach(() => {
  pedidos.clear();
  historico.length = 0;
  codigos.clear();
  convidados.length = 0;
  whatsapp.sai = false;
  whatsapp.mensagens.length = 0;
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  pedido(501, DO_WHATSAPP, null);
  pedido(502, MEU, EMAIL);
  pedido(503, DE_OUTRO, OUTRA);
  pedido(504, VELHO, EMAIL, Date.now() - 1000);
});

describe("S6 — R10 POST /api/cliente/pedido-do-link", () => {
  it("sem sessão, 401", async () => {
    expect((await pedidoDoLink(chamar({ token: MEU }, ""))).status).toBe(401);
  });

  it("do email da sessão → seu + id", async () => {
    expect(await (await pedidoDoLink(chamar({ token: MEU }))).json()).toEqual({ ok: true, estado: "seu", id: 502 });
  });

  it("sem email → um resumo de uma linha, e nada mais (nem morada, nem telefone)", async () => {
    const j = await (await pedidoDoLink(chamar({ token: DO_WHATSAPP }))).json();
    expect(j).toEqual({
      ok: true,
      estado: "semEmail",
      id: 501,
      servico: "Recolha de móveis",
      cidade: "Setúbal",
      criadoEmTexto: "26/10/2026",
    });
    expect(db.pedirJuncaoAConta).not.toHaveBeenCalled();
  });

  it("juntar NÃO grava o email do pedido: fica à espera da Mesa, a Mesa regista e o contacto é avisado (R13)", async () => {
    const r = await pedidoDoLink(chamar({ token: DO_WHATSAPP, juntar: true }));
    expect(r.status).toBe(409);
    const j = await r.json();
    expect(j).toMatchObject({ ok: false, estado: "aEsperaDaMesa", id: 501 });
    expect(j.error).toContain("Pedimos à CLYON que confirme");
    // Nada da morada nem do telefone na resposta.
    expect(JSON.stringify(j)).not.toMatch(/Rua de Teste|912 345 678/);
    const p = [...pedidos.values()].find((x) => x.id === 501)!;
    expect(p.contactEmail).toBeNull();
    expect(p.juntarAContaPedidoPor).toBe(EMAIL);
    expect(historico).toEqual([
      { id: 501, message: "Pedido para juntar à conta c•••@exemplo.pt pela app de cliente: confirme ou recuse na Mesa." },
    ]);
    expect(avisarContactoDoPedido).toHaveBeenCalledTimes(1);
    expect(vi.mocked(avisarContactoDoPedido).mock.calls[0][1]).toBe(
      "Pediram para ligar o pedido #501 à conta c•••@exemplo.pt, na app da CLYON. A CLYON confirma antes de o ligar. Não reconhece este pedido? Responda a esta mensagem.",
    );
    // Outra conta, com o mesmo link, não consegue pedir por cima: 409 «já ligado».
    const outra = await pedidoDoLink(chamar({ token: DO_WHATSAPP, juntar: true }, outraSessao));
    expect(outra.status).toBe(409);
    expect((await outra.json()).error).toBe("Este pedido já está ligado a uma conta.");
    expect(historico).toHaveLength(1);
  });

  it("pedir outra vez com a mesma conta não repete o aviso ao contacto", async () => {
    await pedidoDoLink(chamar({ token: DO_WHATSAPP, juntar: true }));
    await pedidoDoLink(chamar({ token: DO_WHATSAPP, juntar: true }));
    expect(avisarContactoDoPedido).toHaveBeenCalledTimes(1);
    expect(historico).toHaveLength(1);
  });

  it("a rota nunca grava o email do pedido (só a Mesa o faz, em aprovarJuncaoAConta)", () => {
    const R = readFileSync(join(process.cwd(), "src/app/api/cliente/pedido-do-link/route.ts"), "utf8");
    expect(R).not.toMatch(/juntarPedidoAConta|aprovarJuncaoAConta|contactEmail\s*=/);
  });

  it("se outra conta o juntou entretanto: 409", async () => {
    vi.mocked(db.pedirJuncaoAConta).mockResolvedValueOnce(false);
    const r = await pedidoDoLink(chamar({ token: DO_WHATSAPP, juntar: true }));
    expect(r.status).toBe(409);
    expect((await r.json()).error).toBe("Este pedido já está ligado a uma conta.");
  });

  it("de outro email → sem dados do pedido", async () => {
    const texto = await (await pedidoDoLink(chamar({ token: DE_OUTRO, juntar: true }))).text();
    expect(JSON.parse(texto)).toEqual({ ok: true, estado: "outroEmail" });
    expect(texto).not.toContain("503");
    expect(db.pedirJuncaoAConta).not.toHaveBeenCalled();
  });

  it("expirado → 410; desconhecido ou mal formado → 404", async () => {
    expect((await pedidoDoLink(chamar({ token: VELHO }))).status).toBe(410);
    expect((await pedidoDoLink(chamar({ token: "x".repeat(43) }))).status).toBe(404);
    expect((await pedidoDoLink(chamar({ token: "não é token" }))).status).toBe(404);
  });

  it("travão por conta; o token nunca roda nem se guarda", async () => {
    await pedidoDoLink(chamar({ token: MEU }));
    expect(limitarPorConta).toHaveBeenCalledWith("cliente-pedido-do-link-conta", EMAIL, 30, 300);
    const R = readFileSync(join(process.cwd(), "src/app/api/cliente/pedido-do-link/route.ts"), "utf8");
    expect(R).not.toMatch(/substituirTokenDoPedido|gerarTokenDeAcesso|acessoTokenHash\s*=/);
    // A Mesa grava o email numa só escrita, só se o pedido ainda estiver sem email e com o mesmo pedido de junção.
    expect(readFileSync(join(process.cwd(), "src/lib/db.ts"), "utf8")).toMatch(
      /SET contactEmail = juntarAContaPedidoPor[\s\S]{0,200}WHERE id = \? AND \(contactEmail IS NULL OR TRIM\(contactEmail\) = ''\) AND juntarAContaPedidoPor = \?/,
    );
  });
});

describe("R13 — juntar pelo código enviado ao telefone do pedido (29-10-2026)", () => {
  it("com WhatsApp: o código vai ao telefone DO PEDIDO, nada se grava no email; o código certo junta, o errado não", async () => {
    whatsapp.sai = true;
    const r = await pedidoDoLink(chamar({ token: DO_WHATSAPP, juntar: true }));
    expect(r.status).toBe(409);
    const j = await r.json();
    expect(j).toMatchObject({ ok: false, estado: "aConfirmar", id: 501 });
    expect(whatsapp.mensagens).toHaveLength(1);
    expect(whatsapp.mensagens[0].para).toBe("912 345 678");
    const codigo = whatsapp.mensagens[0].texto.match(/é (\d{6})\./)?.[1];
    expect(codigo).toMatch(/^\d{6}$/);
    expect(porId(501)!.contactEmail).toBeNull();
    // Na base, só o resumo do código.
    expect(codigos.get(501)!.hash).not.toContain(codigo!);

    const errado = await pedidoDoLink(chamar({ token: DO_WHATSAPP, juntar: true, codigo: codigo === "000000" ? "111111" : "000000" }));
    expect(errado.status).toBe(422);
    expect(porId(501)!.contactEmail).toBeNull();

    const certo = await pedidoDoLink(chamar({ token: DO_WHATSAPP, juntar: true, codigo }));
    expect(await certo.json()).toEqual({ ok: true, estado: "seu", id: 501, juntado: true });
    expect(porId(501)!.contactEmail).toBe(EMAIL);
  });

  it("a mensagem do código não traz a morada, e diz o que fazer se não foi a pessoa", async () => {
    whatsapp.sai = true;
    await pedidoDoLink(chamar({ token: DO_WHATSAPP, juntar: true }));
    const t = whatsapp.mensagens[0].texto;
    expect(t).not.toMatch(/Rua de Teste/);
    expect(t).toContain("Não partilhe o código");
  });
});

describe("S16 — a troca do link por uma sessão de convidado", () => {
  const CODIGO = "c".repeat(43);
  it("sem conta, num pedido sem email: uma sessão opaca, presa ao telemóvel, nunca um JWT", async () => {
    const r = await pedidoDoLink(chamar({ token: DO_WHATSAPP, codigoDoAparelho: CODIGO }, ""));
    const j = await r.json();
    expect(j).toMatchObject({ ok: true, estado: "convidado", id: 501 });
    expect(j.sessaoDoPedido).toMatch(/^cv_[A-Za-z0-9_-]{43}$/);
    expect(j.sessaoDoPedido.split(".")).toHaveLength(1);
    // Na base, só o resumo da chave e a prova do código.
    expect(convidados[0].sessaoHash).not.toContain(j.sessaoDoPedido);
    expect(convidados[0].prova).not.toContain(CODIGO);
  });

  it("um pedido de uma conta: temConta, com o email mascarado, e nenhuma sessão", async () => {
    const j = await (await pedidoDoLink(chamar({ token: MEU, codigoDoAparelho: CODIGO }, ""))).json();
    expect(j).toEqual({ ok: true, estado: "temConta", emailMascarado: "c•••@exemplo.pt" });
    expect(convidados).toHaveLength(0);
  });

  it("o 4.º telemóvel recebe muitosAparelhos, sem dados do pedido", async () => {
    for (const c of ["a", "b", "d"]) await pedidoDoLink(chamar({ token: DO_WHATSAPP, codigoDoAparelho: c.repeat(43) }, ""));
    const r = await pedidoDoLink(chamar({ token: DO_WHATSAPP, codigoDoAparelho: "e".repeat(43) }, ""));
    expect(r.status).toBe(409);
    const texto = await r.text();
    expect(JSON.parse(texto)).toMatchObject({ ok: false, estado: "muitosAparelhos" });
    expect(texto).not.toMatch(/501|Setúbal|Recolha/);
    // O mesmo telemóvel volta a entrar no seu lugar.
    expect((await pedidoDoLink(chamar({ token: DO_WHATSAPP, codigoDoAparelho: "a".repeat(43) }, ""))).status).toBe(200);
  });
});
