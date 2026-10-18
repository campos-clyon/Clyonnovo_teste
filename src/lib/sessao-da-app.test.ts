import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A APP DO PROFISSIONAL FALA COM O SITE — fase 1 da CLYON Pro, 18-10-2026.
 *
 * O que tem de ser verdade antes de a app existir: as rotas do profissional
 * aceitam a sessão no cabeçalho, a entrada devolve o token à app, a app renova
 * a sessão, o telemóvel regista-se para avisos e os avisos que o site já manda
 * chegam lá. Estes testes chamam as rotas a sério, com a base simulada.
 */

vi.mock("@/lib/db", () => ({
  ensureProvidersSchema: vi.fn(async () => {}),
  getPool: vi.fn(),
  perfilDoProfissional: vi.fn(),
  savePushSubscription: vi.fn(async () => {}),
  deletePushSubscription: vi.fn(async () => {}),
  getPushSubscriptionsByEmail: vi.fn(async () => []),
  profissionalParaEntrar: vi.fn(),
  registarAcessoDoProfissional: vi.fn(async () => {}),
  definirAvisosNoWhatsApp: vi.fn(async () => {}),
}));
vi.mock("@/lib/limite-rota-publica", () => ({
  limitarRotaPublica: vi.fn(async () => ({ erro: null })),
  limitarPorConta: vi.fn(async () => ({ erro: null })),
}));

import * as db from "@/lib/db";
import {
  assinarSessaoDoProfissional,
  hashDaPalavraPasse,
  sessaoVemDaApp,
  tokenDoProfissional,
  verificarSessaoDoProfissional,
  COOKIE_SESSAO_PROFISSIONAL,
} from "@/lib/profissional-auth";
import { POST as entrar } from "@/app/api/profissionais/entrar/route";
import { POST as renovar } from "@/app/api/profissionais/sessao/route";
import {
  POST as registarTelemovel,
  DELETE as apagarTelemovel,
} from "@/app/api/profissionais/dispositivo/route";
import { PUT as avisosNoWhatsApp } from "@/app/api/profissionais/avisos-whatsapp/route";
import { sendPushToUser } from "@/lib/webpush";
import {
  ENDERECO_DA_EXPO,
  enviarAvisoNaApp,
  eTokenDaApp,
  mensagensParaAExpo,
  tokensQueMorreram,
} from "@/lib/push-nativo";
import { assetLinks, associacaoDaApple, impressoesDoAndroid } from "@/lib/links-da-app";

const TOKEN_EXPO = "ExponentPushToken[AbCdEf123456_-xyz]";
const IMPRESSAO = Array.from({ length: 32 }, () => "AB").join(":");

/** A conta como a base a devolve à `sessaoActivaDoProfissional`. */
function contaNaBase(estado: string, isActive = 1) {
  vi.mocked(db.getPool).mockResolvedValue({
    execute: vi.fn(async () => [[{ estado, isActive }], undefined]),
  } as never);
}

function pedido(
  url: string,
  o: { metodo?: string; bearer?: string; cookie?: string; corpo?: unknown } = {},
) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (o.bearer !== undefined) headers.authorization = `Bearer ${o.bearer}`;
  if (o.cookie) headers.cookie = `${COOKIE_SESSAO_PROFISSIONAL}=${o.cookie}`;
  return new NextRequest(`http://localhost${url}`, {
    method: o.metodo ?? "POST",
    headers,
    body: o.corpo === undefined ? undefined : JSON.stringify(o.corpo),
  });
}

beforeAll(() => {
  process.env.JWT_SECRET = "segredo-so-dos-testes-da-app-do-profissional";
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  contaNaBase("aprovado");
  vi.mocked(db.perfilDoProfissional).mockResolvedValue({ email: "rui@exemplo.pt" } as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("de onde vem o token", () => {
  const req = (h: Record<string, string>, cookie?: string) => ({
    headers: { get: (n: string) => h[n.toLowerCase()] ?? null },
    cookies: { get: () => (cookie ? { value: cookie } : undefined) },
  });

  it("a app manda-o no cabeçalho, o painel no cookie", () => {
    expect(tokenDoProfissional(req({ authorization: "Bearer abc.def.ghi" }))).toBe("abc.def.ghi");
    expect(tokenDoProfissional(req({}, "do-cookie"))).toBe("do-cookie");
    expect(sessaoVemDaApp(req({ authorization: "bearer x" }))).toBe(true);
    expect(sessaoVemDaApp(req({}, "do-cookie"))).toBe(false);
  });

  it("vindo os dois, ganha o cabeçalho", () => {
    expect(tokenDoProfissional(req({ authorization: "Bearer da-app" }, "do-cookie"))).toBe("da-app");
  });

  it("um Bearer vazio é uma recusa, e não cai para o cookie", () => {
    expect(tokenDoProfissional(req({ authorization: "Bearer " }, "do-cookie"))).toBeNull();
    expect(tokenDoProfissional(req({ authorization: "Bearer a b" }, "do-cookie"))).toBeNull();
  });

  it("um Authorization que não é Bearer não é nosso", () => {
    expect(tokenDoProfissional(req({ authorization: "Basic dXNlcjpwYXNz" }, "do-cookie"))).toBe(
      "do-cookie",
    );
  });
});

describe("entrar pela app", () => {
  beforeEach(async () => {
    vi.mocked(db.profissionalParaEntrar).mockResolvedValue({
      id: 7,
      name: "Rui",
      estado: "aprovado",
      isActive: 1,
      passwordHash: await hashDaPalavraPasse("uma-frase-comprida"),
    } as never);
  });

  it("a app recebe o token no corpo e nenhum cookie", async () => {
    const r = await entrar(
      pedido("/api/profissionais/entrar", {
        corpo: { email: "rui@exemplo.pt", palavraPasse: "uma-frase-comprida", paraApp: true },
      }),
    );
    expect(r.status).toBe(200);
    const corpo = await r.json();
    expect(r.headers.get("set-cookie")).toBeNull();
    const sessao = await verificarSessaoDoProfissional(corpo.token);
    expect(sessao).toMatchObject({ providerId: 7, nome: "Rui", lembrar: true });
  });

  it("o painel no navegador continua a receber o cookie, e nunca o token", async () => {
    const r = await entrar(
      pedido("/api/profissionais/entrar", {
        corpo: { email: "rui@exemplo.pt", palavraPasse: "uma-frase-comprida" },
      }),
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("set-cookie")).toContain(`${COOKIE_SESSAO_PROFISSIONAL}=`);
    expect((await r.json()).token).toBeUndefined();
  });

  it("a palavra-passe errada recusa a app como recusa o painel", async () => {
    const r = await entrar(
      pedido("/api/profissionais/entrar", {
        corpo: { email: "rui@exemplo.pt", palavraPasse: "outra-frase-qualquer", paraApp: true },
      }),
    );
    expect(r.status).toBe(401);
  });
});

describe("as rotas do profissional aceitam a sessão da app", () => {
  it("uma rota que já existia responde com o token no cabeçalho", async () => {
    const token = await assinarSessaoDoProfissional(7, "Rui");
    const r = await avisosNoWhatsApp(
      pedido("/api/profissionais/avisos-whatsapp", { metodo: "PUT", bearer: token, corpo: { quer: true } }),
    );
    expect(r.status).toBe(200);
    expect(db.definirAvisosNoWhatsApp).toHaveBeenCalledWith(7, true);
  });

  it("e recusa uma conta suspensa, mesmo com o token válido", async () => {
    contaNaBase("suspenso");
    const token = await assinarSessaoDoProfissional(7, "Rui");
    const r = await avisosNoWhatsApp(
      pedido("/api/profissionais/avisos-whatsapp", { metodo: "PUT", bearer: token, corpo: { quer: true } }),
    );
    expect(r.status).toBe(401);
    expect(db.definirAvisosNoWhatsApp).not.toHaveBeenCalled();
  });

  it("um token estragado é 401", async () => {
    const r = await avisosNoWhatsApp(
      pedido("/api/profissionais/avisos-whatsapp", { metodo: "PUT", bearer: "nao-e-um-jwt", corpo: { quer: true } }),
    );
    expect(r.status).toBe(401);
  });
});

describe("a app renova a sessão ao abrir", () => {
  it("devolve um token novo, lembrado, da mesma conta", async () => {
    const token = await assinarSessaoDoProfissional(7, "Rui", false);
    const r = await renovar(pedido("/api/profissionais/sessao", { bearer: token }));
    expect(r.status).toBe(200);
    const novo = await verificarSessaoDoProfissional((await r.json()).token);
    expect(novo).toMatchObject({ providerId: 7, lembrar: true });
  });

  it("não troca o cookie do painel por um token que o JavaScript da página leia", async () => {
    const token = await assinarSessaoDoProfissional(7, "Rui");
    const r = await renovar(pedido("/api/profissionais/sessao", { cookie: token }));
    expect(r.status).toBe(400);
    expect((await r.json()).token).toBeUndefined();
  });

  it("uma conta suspensa não renova", async () => {
    contaNaBase("suspenso");
    const token = await assinarSessaoDoProfissional(7, "Rui");
    const r = await renovar(pedido("/api/profissionais/sessao", { bearer: token }));
    expect(r.status).toBe(401);
  });
});

describe("o telemóvel regista-se para avisos", () => {
  it("guarda o token da app pelo email da conta, e não pelo do corpo", async () => {
    const token = await assinarSessaoDoProfissional(7, "Rui");
    const r = await registarTelemovel(
      pedido("/api/profissionais/dispositivo", {
        bearer: token,
        corpo: { token: TOKEN_EXPO, email: "outro@exemplo.pt" },
      }),
    );
    expect(r.status).toBe(200);
    expect(db.savePushSubscription).toHaveBeenCalledWith("rui@exemplo.pt", {
      endpoint: TOKEN_EXPO,
      p256dh: "",
      auth: "",
    });
  });

  it("sem sessão, ou com um token que não é da app, não guarda nada", async () => {
    expect(
      (await registarTelemovel(pedido("/api/profissionais/dispositivo", { corpo: { token: TOKEN_EXPO } })))
        .status,
    ).toBe(401);
    const token = await assinarSessaoDoProfissional(7, "Rui");
    const r = await registarTelemovel(
      pedido("/api/profissionais/dispositivo", {
        bearer: token,
        corpo: { token: "https://fcm.googleapis.com/fcm/send/xyz" },
      }),
    );
    expect(r.status).toBe(400);
    expect(db.savePushSubscription).not.toHaveBeenCalled();
  });

  it("sair da app apaga o telemóvel, mesmo sem sessão válida", async () => {
    const r = await apagarTelemovel(
      pedido("/api/profissionais/dispositivo", { metodo: "DELETE", corpo: { token: TOKEN_EXPO } }),
    );
    expect(r.status).toBe(200);
    expect(db.deletePushSubscription).toHaveBeenCalledWith(TOKEN_EXPO);
  });
});

describe("os avisos que o site já manda chegam à app", () => {
  it("reconhece o token da app e não o confunde com o navegador", () => {
    expect(eTokenDaApp(TOKEN_EXPO)).toBe(true);
    expect(eTokenDaApp("ExpoPushToken[AbCdEf123456]")).toBe(true);
    expect(eTokenDaApp("https://fcm.googleapis.com/fcm/send/abc")).toBe(false);
    expect(eTokenDaApp("ExponentPushToken[]")).toBe(false);
  });

  it("os avisos saem com prioridade alta e o link do painel", () => {
    const [m] = mensagensParaAExpo([TOKEN_EXPO], {
      title: "Novo pedido",
      body: "Recolha em Almada",
      url: "/profissionais/painel?ecra=trabalhos",
      tag: "pedido-novo",
    });
    expect(m).toMatchObject({
      to: TOKEN_EXPO,
      priority: "high",
      data: { url: "/profissionais/painel?ecra=trabalhos", tag: "pedido-novo" },
    });
  });

  it("esquece os telemóveis onde a app já não existe", async () => {
    const outro = "ExponentPushToken[ZZZZZZZZZZZZ]";
    expect(
      tokensQueMorreram([TOKEN_EXPO, outro], {
        data: [{ status: "ok" }, { status: "error", details: { error: "DeviceNotRegistered" } }],
      }),
    ).toEqual([outro]);

    const esquecer = vi.fn(async () => {});
    const pedir = vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ status: "error", details: { error: "DeviceNotRegistered" } }] })),
    );
    await enviarAvisoNaApp([TOKEN_EXPO], { title: "t", body: "b" }, { esquecer, pedir: pedir as never });
    expect(pedir).toHaveBeenCalledWith(ENDERECO_DA_EXPO, expect.objectContaining({ method: "POST" }));
    expect(esquecer).toHaveBeenCalledWith(TOKEN_EXPO);
  });

  it("uma falha da Expo não lança", async () => {
    const pedir = vi.fn(async () => {
      throw new Error("sem rede");
    });
    await expect(
      enviarAvisoNaApp([TOKEN_EXPO], { title: "t", body: "b" }, { pedir: pedir as never }),
    ).resolves.toBeUndefined();
  });

  it("o sendPushToUser de sempre manda à app, mesmo sem chaves VAPID", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    vi.mocked(db.getPushSubscriptionsByEmail).mockResolvedValue([
      { endpoint: TOKEN_EXPO, p256dh: "", auth: "" },
    ]);
    const pedir = vi.fn(async () => new Response(JSON.stringify({ data: [{ status: "ok" }] })));
    vi.stubGlobal("fetch", pedir);
    await sendPushToUser("rui@exemplo.pt", { title: "Novo pedido", body: "Almada" });
    expect(pedir).toHaveBeenCalledTimes(1);
    const corpo = JSON.parse((pedir.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(corpo[0]).toMatchObject({ to: TOKEN_EXPO, title: "Novo pedido" });
  });

  it("e não lança se a base falhar", async () => {
    vi.mocked(db.getPushSubscriptionsByEmail).mockRejectedValue(new Error("DB not available"));
    await expect(sendPushToUser("rui@exemplo.pt", { title: "t", body: "b" })).resolves.toBeUndefined();
  });
});

describe("os links do site abrem a app", () => {
  it("sem as provas configuradas, os ficheiros saem vazios e válidos", () => {
    expect(assetLinks({})).toEqual([]);
    expect(associacaoDaApple({}).applinks.details).toEqual([]);
  });

  it("com as provas, aponta para pt.clyon.pro", () => {
    const android = assetLinks({ APP_PRO_ANDROID_SHA256: `${IMPRESSAO.toLowerCase()}, mal-escrita` });
    expect(android[0].target).toEqual({
      namespace: "android_app",
      package_name: "pt.clyon.pro",
      sha256_cert_fingerprints: [IMPRESSAO],
    });
    expect(impressoesDoAndroid({ APP_PRO_ANDROID_SHA256: "mal-escrita" })).toEqual([]);

    const apple = associacaoDaApple({ APP_PRO_APPLE_TEAM_ID: "abcde12345" });
    expect(apple.applinks.details[0].appIDs).toEqual(["ABCDE12345.pt.clyon.pro"]);
    expect(apple.applinks.details[0].components).toEqual([
      { "/": "/profissionais/painel*" },
      { "/": "/profissionais/pedidos/*" },
    ]);
  });

  it("os dois ficheiros estão nos endereços que o Android e o iPhone procuram", () => {
    const CONFIG = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    expect(CONFIG).toContain('source: "/.well-known/assetlinks.json", destination: "/api/app/assetlinks"');
    expect(CONFIG).toMatch(
      /source: "\/\.well-known\/apple-app-site-association",\s*destination: "\/api\/app\/apple-app-site-association"/,
    );
  });
});

describe("nenhuma rota do profissional lê o cookie à mão", () => {
  /*
   * Uma rota nova que lesse só o cookie funcionava no painel e dava 401 na
   * app — e quem testa no navegador nunca dava por isso. A sessão lê-se pela
   * `tokenDoProfissional`, que conhece as duas.
   */
  function rotas(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) return rotas(p);
      return n === "route.ts" ? [p] : [];
    });
  }

  it("as rotas que confirmam a sessão usam a tokenDoProfissional", () => {
    const todas = [
      ...rotas(join(process.cwd(), "src", "app", "api", "profissionais")),
      join(process.cwd(), "src", "app", "api", "mapa", "route.ts"),
      join(process.cwd(), "src", "app", "api", "negociacao", "[token]", "route.ts"),
      join(process.cwd(), "src", "app", "api", "push", "subscribe", "route.ts"),
      join(process.cwd(), "src", "app", "api", "push", "unsubscribe", "route.ts"),
    ];
    const comSessao = todas.filter((f) =>
      /(sessaoActivaDoProfissional|verificarSessaoDoProfissional)\(/.test(readFileSync(f, "utf8")),
    );
    expect(comSessao.length).toBeGreaterThanOrEqual(20);
    for (const f of comSessao) {
      const codigo = readFileSync(f, "utf8");
      expect(codigo, f).toContain("tokenDoProfissional(req)");
      expect(codigo, f).not.toContain("cookies.get(COOKIE_SESSAO_PROFISSIONAL)");
    }
  });
});
