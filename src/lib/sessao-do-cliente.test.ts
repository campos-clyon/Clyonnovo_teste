import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import * as jose from "jose";

/**
 * A SESSÃO DO CLIENTE NA APP — 27-10-2026 (decisão d8, R1–R3).
 *
 * Quatro sessões, três assinadas com o mesmo JWT_SECRET, separadas pelo
 * `type`. Estes testes são a «separação estrita» da especificação: um token de
 * cliente não abre o painel do profissional nem o backoffice, e o token de um
 * profissional ou da equipa não abre o lado do cliente. Chamam as rotas a
 * sério, com a base simulada.
 */

const execute = vi.fn();
vi.mock("@/lib/db", () => ({
  ensureUsersSchema: vi.fn(async () => {}),
  ensureProvidersSchema: vi.fn(async () => {}),
  ensureSimulatorOrdersTable: vi.fn(async () => {}),
  getPool: vi.fn(async () => ({ execute })),
  consumirLigacaoDeEntrada: vi.fn(),
  // O link da app de cliente, preso ao telemóvel (S1, 28-10-2026).
  ligacaoDeEntradaPorHash: vi.fn(),
  consumirLigacaoDeEntradaDaApp: vi.fn(),
}));
vi.mock("@/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => null) }));
vi.mock("@/lib/conta-server", () => ({ registarCliente: vi.fn(async () => {}) }));
vi.mock("@/lib/limite-rota-publica", () => ({
  limitarRotaPublica: vi.fn(async () => ({ erro: null })),
  limitarPorConta: vi.fn(async () => ({ erro: null })),
}));

/** As chaves «do Google» dos testes: um par RSA feito aqui. */
const google: { chaves?: ReturnType<typeof jose.createLocalJWKSet>; privada?: CryptoKey } = {};
vi.mock("@/lib/google-id-token", async (original) => {
  const m = await original<typeof import("@/lib/google-id-token")>();
  return {
    ...m,
    verificarIdTokenDoGoogle: (t: unknown) =>
      m.verificarIdTokenDoGoogle(t, { ids: m.idsDeClienteDoGoogle(), chaves: google.chaves }),
  };
});

import * as db from "@/lib/db";
import { getServerSession } from "next-auth";
import { registarCliente } from "@/lib/conta-server";
import {
  assinarSessaoDoCliente,
  emailDoCliente,
  verificarSessaoDoCliente,
  DURACAO_SESSAO_CLIENTE_SEGUNDOS,
} from "@/lib/cliente-auth";
import { assinarSessaoDoProfissional, verificarSessaoDoProfissional } from "@/lib/profissional-auth";
import { verifyColaboradorToken } from "@/lib/colaborador-auth";
import { requireAdmin } from "@/lib/admin-auth-helper";
import { verificarIdTokenDoGoogle } from "@/lib/google-id-token";
import { MENSAGEM } from "@/lib/entrada-por-link";
import { hashDaLigacao } from "@/lib/entrada-por-link-segredo";
import { provaDoCodigo } from "@/lib/entrada-na-app";
import { POST as entrar, GET as entrarComGoogle } from "@/app/api/cliente/entrar/route";
import { POST as renovarCliente } from "@/app/api/cliente/sessao/route";
import { POST as renovarProfissional } from "@/app/api/profissionais/sessao/route";
import { GET as pedidosDoCliente } from "@/app/api/users/me/orders/route";

const SEGREDO = "segredo-so-dos-testes-da-sessao-do-cliente";
const EMAIL = "cliente.teste@exemplo.pt";
const LINK = "a".repeat(43);
/** O código do aparelho que a app guardou ao pedir o link (S1). */
const CODIGO = "c".repeat(43);

/** Um link da app por gastar, deste email, preso ao telemóvel do CODIGO; gasta-se uma vez. */
function linkDaApp(email: string = EMAIL) {
  const linha = {
    email,
    expiraEm: new Date(Date.now() + 10 * 60_000),
    usadoEm: null as Date | null,
    provaDoAparelho: provaDoCodigo(CODIGO),
    verificacoes: 0,
  };
  vi.mocked(db.ligacaoDeEntradaPorHash).mockImplementation(async () => ({ ...linha }));
  vi.mocked(db.consumirLigacaoDeEntradaDaApp).mockImplementation(async () => {
    if (linha.usadoEm) return false;
    linha.usadoEm = new Date();
    return true;
  });
}

function pedido(url: string, o: { bearer?: string; corpo?: unknown; metodo?: string; cabecalhos?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", ...(o.cabecalhos ?? {}) };
  if (o.bearer !== undefined) headers.authorization = `Bearer ${o.bearer}`;
  return new NextRequest(`http://localhost${url}`, {
    method: o.metodo ?? "POST",
    headers,
    body: o.corpo === undefined ? undefined : JSON.stringify(o.corpo),
  });
}

/** A conta do cliente como a base a devolve. */
function contaDoCliente(o: { existe?: boolean; sessoesClienteDesde?: Date | null; contaMaisNova?: number } = {}) {
  execute.mockImplementation(async (sql: string) => {
    if (/FROM users/.test(sql)) {
      return o.existe === false
        ? [[], undefined]
        : [[{ sessoesClienteDesde: o.sessoesClienteDesde ?? null, contaMaisNova: o.contaMaisNova ?? 0 }], undefined];
    }
    return [[], undefined];
  });
}

async function tokenDeEquipa(): Promise<string> {
  return new jose.SignJWT({ id: 1, nome: "Equipa", isAdmin: 1 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(SEGREDO));
}

async function idTokenDoGoogle(o: { aud?: string; email_verified?: boolean; iss?: string } = {}): Promise<string> {
  return new jose.SignJWT({ email: EMAIL, email_verified: o.email_verified ?? true, name: "Cliente Teste" })
    .setProtectedHeader({ alg: "RS256", kid: "teste" })
    .setIssuer(o.iss ?? "https://accounts.google.com")
    .setAudience(o.aud ?? "web-id.apps.googleusercontent.com")
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(google.privada!);
}

beforeAll(async () => {
  process.env.JWT_SECRET = SEGREDO;
  const { publicKey, privateKey } = await jose.generateKeyPair("RS256");
  const jwk = { ...(await jose.exportJWK(publicKey)), kid: "teste", alg: "RS256", use: "sig" };
  google.chaves = jose.createLocalJWKSet({ keys: [jwk] });
  google.privada = privateKey as CryptoKey;
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.GOOGLE_CLIENT_ID = "web-id.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_ID_APP_CLIENTE = "android-id.apps.googleusercontent.com";
  contaDoCliente();
});

describe("separação estrita: um token não abre a porta de outro", () => {
  it("1. o token de cliente não abre o painel do profissional", async () => {
    const { token } = await assinarSessaoDoCliente(EMAIL, "link");
    expect(await verificarSessaoDoProfissional(token)).toBeNull();
    const r = await renovarProfissional(pedido("/api/profissionais/sessao", { bearer: token }));
    expect(r.status).toBe(401);
  });

  it("2. o token de cliente não abre o backoffice", async () => {
    const { token } = await assinarSessaoDoCliente(EMAIL, "google");
    expect(await verifyColaboradorToken(token)).toBeNull();
    const { err } = await requireAdmin(pedido("/api/admin/pedidos", { bearer: token, metodo: "GET" }));
    expect(err?.status).toBe(401);
  });

  it("3. o token de profissional não abre o lado do cliente", async () => {
    const pro = await assinarSessaoDoProfissional(7, "Profissional Teste", true);
    expect(await emailDoCliente(pedido("/api/users/me", { bearer: pro }))).toBeNull();
    expect((await renovarCliente(pedido("/api/cliente/sessao", { bearer: pro }))).status).toBe(401);
    // Nem com a sessão do site aberta no mesmo browser.
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: EMAIL }, expires: "" } as never);
    expect((await pedidosDoCliente(pedido("/api/users/me/orders", { bearer: pro, metodo: "GET" }))).status).toBe(401);
  });

  it("4. o token da equipa (sem type) não abre o lado do cliente", async () => {
    const equipa = await tokenDeEquipa();
    expect(await verifyColaboradorToken(equipa)).not.toBeNull(); // é um token de equipa a sério
    expect(await verificarSessaoDoCliente(equipa)).toBeNull();
    expect(await emailDoCliente(pedido("/api/users/me", { bearer: equipa }))).toBeNull();
    expect((await renovarCliente(pedido("/api/cliente/sessao", { bearer: equipa }))).status).toBe(401);
  });

  it("5. outro segredo, expirado, conta apagada, antes do corte ou de antes de a conta nascer: null", async () => {
    const outro = await new jose.SignJWT({ type: "cliente", email: EMAIL, entrada: "link" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("outro-segredo-qualquer"));
    expect(await emailDoCliente(pedido("/x", { bearer: outro }))).toBeNull();

    const velho = await assinarSessaoDoCliente(EMAIL, "link", new Date(Date.now() - (DURACAO_SESSAO_CLIENTE_SEGUNDOS + 60) * 1000));
    expect(await emailDoCliente(pedido("/x", { bearer: velho.token }))).toBeNull();

    const { token } = await assinarSessaoDoCliente(EMAIL, "link", new Date(Date.now() - 3600_000));
    contaDoCliente({ existe: false });
    expect(await emailDoCliente(pedido("/x", { bearer: token }))).toBeNull();
    contaDoCliente({ sessoesClienteDesde: new Date(Date.now() - 60_000) });
    expect(await emailDoCliente(pedido("/x", { bearer: token }))).toBeNull();
    contaDoCliente({ contaMaisNova: 1 });
    expect(await emailDoCliente(pedido("/x", { bearer: token }))).toBeNull();

    // E o mesmo token, numa conta viva e sem corte, entra.
    contaDoCliente({ sessoesClienteDesde: new Date(Date.now() - 2 * 3600_000) });
    expect(await emailDoCliente(pedido("/x", { bearer: token }))).toBe(EMAIL);
  });

  it("6. um Bearer de cliente inválido com o cookie do site válido: null, e o cookie nem é lido", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: EMAIL }, expires: "" } as never);
    expect(await emailDoCliente(pedido("/x", { bearer: "estragado" }))).toBeNull();
    expect(await emailDoCliente(pedido("/x", { bearer: "" }))).toBeNull();
    expect(getServerSession).not.toHaveBeenCalled();
    // Sem Bearer, a sessão do site continua a valer como sempre.
    expect(await emailDoCliente(pedido("/x"))).toBe(EMAIL);
  });

  it("7. o mesmo link duas vezes: a segunda dá 401 com a mensagem do «já usado»", async () => {
    linkDaApp();
    const r1 = await entrar(pedido("/api/cliente/entrar", { corpo: { linkToken: LINK, codigoDoAparelho: CODIGO } }));
    expect(r1.status).toBe(200);
    const r2 = await entrar(pedido("/api/cliente/entrar", { corpo: { linkToken: LINK, codigoDoAparelho: CODIGO } }));
    expect(r2.status).toBe(401);
    expect((await r2.json()).error).toBe(MENSAGEM.usado);
    // Consome-se o hash (com a prova, numa só escrita), nunca o token em claro.
    expect(db.consumirLigacaoDeEntradaDaApp).toHaveBeenCalledWith(hashDaLigacao(LINK), provaDoCodigo(CODIGO));
  });

  it("8. idToken do Google com o aud de outro projecto, ou com o email por confirmar: 401", async () => {
    const alheio = await entrar(pedido("/api/cliente/entrar", { corpo: { google: await idTokenDoGoogle({ aud: "outro-projecto" }) } }));
    expect(alheio.status).toBe(401);
    const porConfirmar = await entrar(pedido("/api/cliente/entrar", { corpo: { google: await idTokenDoGoogle({ email_verified: false }) } }));
    expect(porConfirmar.status).toBe(401);
    const outroEmissor = await entrar(pedido("/api/cliente/entrar", { corpo: { google: await idTokenDoGoogle({ iss: "https://falso.example" }) } }));
    expect(outroEmissor.status).toBe(401);
    expect(registarCliente).not.toHaveBeenCalled();
    // O certo entra.
    const certo = await entrar(pedido("/api/cliente/entrar", { corpo: { google: await idTokenDoGoogle() } }));
    expect(certo.status).toBe(200);
    expect((await certo.json()).entrada).toBe("google");
  });

  it("8b. S15 (29/10): o idToken da app, com o aud do site ou do cliente Android, cria ou entra na conta", async () => {
    // O Google do telemóvel, com o webClientId do site, emite o aud do site; um
    // idToken emitido para o cliente Android (GOOGLE_CLIENT_ID_APP_CLIENTE) também vale.
    for (const aud of ["web-id.apps.googleusercontent.com", "android-id.apps.googleusercontent.com"]) {
      vi.mocked(registarCliente).mockClear();
      const r = await entrar(pedido("/api/cliente/entrar", { corpo: { google: await idTokenDoGoogle({ aud }) } }));
      expect(r.status).toBe(200);
      const corpo = await r.json();
      expect(corpo).toMatchObject({ ok: true, entrada: "google", email: EMAIL });
      expect(typeof corpo.token).toBe("string");
      // Entrar cria a conta se não existir (a mesma função do site).
      expect(registarCliente).toHaveBeenCalledWith(EMAIL, "Cliente Teste");
    }
  });

  it("9. o token de cliente leva só type, email, entrada, iat e exp", async () => {
    const { token } = await assinarSessaoDoCliente(" Cliente.Teste@Exemplo.pt ", "google");
    const p = jose.decodeJwt(token);
    expect(Object.keys(p).sort()).toEqual(["email", "entrada", "exp", "iat", "type"]);
    expect(p).toMatchObject({ type: "cliente", email: EMAIL, entrada: "google" });
    expect((p.exp as number) - (p.iat as number)).toBe(30 * 24 * 60 * 60);
    // E um token com um campo a mais (um id, um papel) não é de cliente.
    const comMais = await new jose.SignJWT({ type: "cliente", email: EMAIL, entrada: "link", providerId: 7 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(SEGREDO));
    expect(await verificarSessaoDoCliente(comMais)).toBeNull();
  });
});

describe("R1 — entrar", () => {
  it("pelo link: cria a conta e devolve uma sessão de cliente de 30 dias", async () => {
    linkDaApp("Cliente.Teste@Exemplo.pt");
    const r = await entrar(pedido("/api/cliente/entrar", { corpo: { linkToken: LINK, codigoDoAparelho: CODIGO } }));
    const j = await r.json();
    expect(r.status).toBe(200);
    expect(j).toMatchObject({ ok: true, email: EMAIL, entrada: "link" });
    expect(registarCliente).toHaveBeenCalledWith(EMAIL, null);
    expect((await verificarSessaoDoCliente(j.token))?.email).toBe(EMAIL);
    expect(new Date(j.expiraEm).getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 3600_000);
  });

  it("as duas provas, ou nenhuma: 400; um link com outra forma: 401 sem ir à base", async () => {
    expect((await entrar(pedido("/api/cliente/entrar", { corpo: {} }))).status).toBe(400);
    expect((await entrar(pedido("/api/cliente/entrar", { corpo: { linkToken: LINK, google: "x" } }))).status).toBe(400);
    const r = await entrar(pedido("/api/cliente/entrar", { corpo: { linkToken: "curto", codigoDoAparelho: CODIGO } }));
    expect(r.status).toBe(401);
    expect(db.ligacaoDeEntradaPorHash).not.toHaveBeenCalled();
    expect(db.consumirLigacaoDeEntradaDaApp).not.toHaveBeenCalled();
  });

  it("sem o cliente OAuth Android, o Google diz que ainda não está disponível — e o link continua", async () => {
    delete process.env.GOOGLE_CLIENT_ID_APP_CLIENTE;
    expect(await (await entrarComGoogle()).json()).toMatchObject({ google: false, link: true });
    const r = await entrar(pedido("/api/cliente/entrar", { corpo: { google: await idTokenDoGoogle() } }));
    expect(r.status).toBe(503);
    expect((await r.json()).error).toMatch(/link por email/);
    linkDaApp();
    expect(
      (await entrar(pedido("/api/cliente/entrar", { corpo: { linkToken: LINK, codigoDoAparelho: CODIGO } }))).status,
    ).toBe(200);
  });

  it("a rota não lê sessão nenhuma: com o Bearer de um profissional, quem entra é o cliente do link", async () => {
    const pro = await assinarSessaoDoProfissional(7, "Profissional Teste", true);
    linkDaApp();
    const j = await (
      await entrar(pedido("/api/cliente/entrar", { bearer: pro, corpo: { linkToken: LINK, codigoDoAparelho: CODIGO } }))
    ).json();
    expect((await verificarSessaoDoCliente(j.token))?.type).toBe("cliente");
    expect(await verificarSessaoDoProfissional(j.token)).toBeNull();
    expect(getServerSession).not.toHaveBeenCalled();
  });

  it("o verificador do Google, sozinho: sem IDs configurados não aceita nada", async () => {
    expect(await verificarIdTokenDoGoogle(await idTokenDoGoogle())).not.toBeNull();
    const m = await vi.importActual<typeof import("@/lib/google-id-token")>("@/lib/google-id-token");
    expect(await m.verificarIdTokenDoGoogle(await idTokenDoGoogle(), { ids: [], chaves: google.chaves })).toBeNull();
    expect(await m.verificarIdTokenDoGoogle("lixo", { ids: ["web-id.apps.googleusercontent.com"], chaves: google.chaves })).toBeNull();
  });
});

describe("R2 — renovar a cada abertura", () => {
  it("só com Bearer; devolve um token novo e grava a abertura e a versão", async () => {
    expect((await renovarCliente(pedido("/api/cliente/sessao"))).status).toBe(400);
    const { token } = await assinarSessaoDoCliente(EMAIL, "link", new Date(Date.now() - 3600_000));
    const r = await renovarCliente(pedido("/api/cliente/sessao", { bearer: token, cabecalhos: { "x-app-versao": "1.0.0" } }));
    const j = await r.json();
    expect(r.status).toBe(200);
    const novo = await verificarSessaoDoCliente(j.token);
    expect(novo).toMatchObject({ email: EMAIL, entrada: "link" });
    const gravou = execute.mock.calls.find(([sql]) => /appClienteAbertaEm = NOW\(\)/.test(String(sql)));
    expect(gravou?.[1]).toEqual(["1.0.0", EMAIL]);
  });
});

describe("R3 — o token de cliente lê os pedidos do próprio cliente", () => {
  it("/api/users/me/orders com Bearer: só os pedidos do email da sessão", async () => {
    execute.mockImplementation(async (sql: string) => {
      if (/FROM users/.test(sql)) return [[{ sessoesClienteDesde: null, contaMaisNova: 0 }], undefined];
      if (/COUNT\(\*\) AS totalOrders/.test(sql)) return [[{ totalOrders: 1, activeOrders: 1, lastOrderDate: null }], undefined];
      if (/COUNT\(\*\) AS total FROM/.test(sql)) return [[{ total: 1 }], undefined];
      if (/FROM simulatorOrders o/.test(sql)) return [[{ id: 482, serviceType: "moveis", trabalhoClyon: 0, historyJson: null }], undefined];
      return [[], undefined];
    });
    const { token } = await assinarSessaoDoCliente(EMAIL, "google", new Date(Date.now() - 3600_000));
    const r = await pedidosDoCliente(pedido("/api/users/me/orders", { bearer: token, metodo: "GET" }));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.orders.map((o: { id: number }) => o.id)).toEqual([482]);
    const doPedido = execute.mock.calls.filter(([sql]) => /FROM simulatorOrders/.test(String(sql)));
    expect(doPedido.length).toBeGreaterThan(0);
    for (const [sql, params] of doPedido) {
      expect(String(sql)).toContain("LOWER(TRIM(contactEmail)) = ?");
      expect((params as unknown[])[0]).toBe(EMAIL);
    }
    expect(getServerSession).not.toHaveBeenCalled();
  });

  it("as rotas do cliente leem a sessão só por cliente-auth (nenhum getServerSession directo)", () => {
    const ROTAS_DO_CLIENTE = [
      "src/app/api/users/me/route.ts",
      "src/app/api/users/me/negociacao/route.ts",
      "src/app/api/users/me/orders/route.ts",
      "src/app/api/users/me/orders/[id]/reply/route.ts",
      "src/app/api/users/me/orders/[id]/rate/route.ts",
      "src/app/api/users/me/avatar/route.ts",
      "src/app/api/conta/pedidos/route.ts",
      "src/app/api/pagamentos/route.ts",
      "src/app/api/simulador/pedido/route.ts",
      "src/app/api/push/subscribe/route.ts",
      "src/app/api/push/unsubscribe/route.ts",
      // As rotas da app de cliente (d8, R4–R6, 28-10-2026).
      "src/app/api/cliente/pedidos/route.ts",
      "src/app/api/cliente/pedidos/[id]/route.ts",
      "src/app/api/cliente/dispositivo/route.ts",
    ];
    // Lista fechada de quem ainda pode ler o cookie do NextAuth à mão: rotas
    // que não são do cliente (o mapa da plataforma, a verificação de duplicados).
    const PODEM_LER_O_COOKIE = new Set(["src/app/api/mapa/route.ts", "src/app/api/users/check-unique/route.ts"]);

    const raiz = process.cwd();
    const ficheiros: string[] = [];
    const andar = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) andar(p);
        else if (/\.tsx?$/.test(n)) ficheiros.push(relative(raiz, p).replace(/\\/g, "/"));
      }
    };
    andar(join(raiz, "src/app/api"));

    const comCookieAMao = ficheiros.filter((f) => /getServerSession\s*\(/.test(readFileSync(join(raiz, f), "utf8")));
    expect(comCookieAMao.filter((f) => !PODEM_LER_O_COOKIE.has(f))).toEqual([]);
    for (const f of PODEM_LER_O_COOKIE) expect(comCookieAMao).toContain(f); // a lista só encolhe

    for (const f of ROTAS_DO_CLIENTE) {
      expect(readFileSync(join(raiz, f), "utf8"), f).toMatch(/from "@\/lib\/cliente-auth"/);
    }
  });
});
