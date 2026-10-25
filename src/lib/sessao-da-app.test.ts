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
  profissionalPorTokenDeSenha: vi.fn(),
  definirPalavraPasseDoProfissional: vi.fn(async () => {}),
  negociacaoPorTokenHash: vi.fn(),
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
import { POST as definirSenha } from "@/app/api/profissionais/definir-senha/route";
import { POST as pedidoDoLink } from "@/app/api/profissionais/pedido-do-link/route";
import { gerarTokenDeAcesso } from "@/lib/pedido-acesso";
import { POST as renovar } from "@/app/api/profissionais/sessao/route";
import {
  POST as registarTelemovel,
  DELETE as apagarTelemovel,
} from "@/app/api/profissionais/dispositivo/route";
import { PUT as avisosNoWhatsApp } from "@/app/api/profissionais/avisos-whatsapp/route";
import { POST as avisoDeTeste } from "@/app/api/profissionais/aviso-de-teste/route";
import { sendPushToUser } from "@/lib/webpush";
import {
  ENDERECO_DA_EXPO,
  enviarAvisoNaApp,
  eTokenDaApp,
  mensagensParaAExpo,
  tokensQueMorreram,
} from "@/lib/push-nativo";
import {
  abrirNaAppNoAndroid,
  assetLinks,
  associacaoDaApple,
  IMPRESSOES_DA_APP_PRO,
  impressoesDoAndroid,
} from "@/lib/links-da-app";

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

/*
 * O LINK DO EMAIL ABRE A APP — 20-10-2026. Ele escolhe a palavra-passe lá
 * dentro e fica logo com a sessão, sem a escrever outra vez na entrada.
 */
describe("escolher a palavra-passe pela app", () => {
  let link: string;

  beforeEach(() => {
    const acesso = gerarTokenDeAcesso();
    link = acesso.token;
    vi.mocked(db.profissionalPorTokenDeSenha).mockResolvedValue({
      id: 7,
      name: "Rui",
      email: "rui@exemplo.pt",
      estado: "pendente",
      senhaTokenHash: acesso.hash,
      senhaTokenExpiraEm: acesso.expiraEm,
    } as never);
  });

  it("a app recebe o token no corpo e nenhum cookie", async () => {
    const r = await definirSenha(
      pedido("/api/profissionais/definir-senha", {
        corpo: { token: link, palavraPasse: "uma-frase-comprida", paraApp: true },
      }),
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("set-cookie")).toBeNull();
    const corpo = await r.json();
    expect(corpo.nome).toBe("Rui");
    expect(await verificarSessaoDoProfissional(corpo.token)).toMatchObject({ providerId: 7, lembrar: true });
    expect(db.definirPalavraPasseDoProfissional).toHaveBeenCalledWith(7, expect.any(String));
  });

  it("no navegador continua o cookie, e nunca o token", async () => {
    const r = await definirSenha(
      pedido("/api/profissionais/definir-senha", {
        corpo: { token: link, palavraPasse: "uma-frase-comprida" },
      }),
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("set-cookie")).toContain(`${COOKIE_SESSAO_PROFISSIONAL}=`);
    expect((await r.json()).token).toBeUndefined();
  });

  it("um link que não é o dele não dá sessão à app", async () => {
    const r = await definirSenha(
      pedido("/api/profissionais/definir-senha", {
        corpo: { token: "outro-link-qualquer", palavraPasse: "uma-frase-comprida", paraApp: true },
      }),
    );
    expect(r.status).toBe(403);
    expect((await r.json()).token).toBeUndefined();
    expect(db.definirPalavraPasseDoProfissional).not.toHaveBeenCalled();
  });

  it("uma conta suspensa não entra, nem pela app", async () => {
    vi.mocked(db.profissionalPorTokenDeSenha).mockResolvedValue({
      ...(await db.profissionalPorTokenDeSenha("")),
      estado: "suspenso",
    } as never);
    const r = await definirSenha(
      pedido("/api/profissionais/definir-senha", {
        corpo: { token: link, palavraPasse: "uma-frase-comprida", paraApp: true },
      }),
    );
    expect(r.status).toBe(403);
    expect((await r.json()).token).toBeUndefined();
  });
});

/*
 * O LINK DE UM PEDIDO ABRE ESSE PEDIDO NA APP — 21-10-2026 (versão 12). O site
 * traduz o token no número do trabalho, com as regras da página do pedido.
 */
describe("o link de um pedido, aberto na app", () => {
  let link: string;

  beforeEach(() => {
    const acesso = gerarTokenDeAcesso();
    link = acesso.token;
    vi.mocked(db.negociacaoPorTokenHash).mockResolvedValue({
      id: 55,
      pedidoId: 4101,
      providerId: 7,
      acessoTokenHash: acesso.hash,
      acessoTokenExpiraEm: acesso.expiraEm,
      estado: "aberta",
    } as never);
  });

  it("devolve o número do trabalho a quem o recebeu", async () => {
    const sessao = await assinarSessaoDoProfissional(7, "Rui");
    const r = await pedidoDoLink(pedido("/api/profissionais/pedido-do-link", { bearer: sessao, corpo: { token: link } }));
    expect(r.status).toBe(200);
    expect((await r.json()).negociacaoId).toBe(55);
  });

  it("a outro profissional diz que o pedido não é dele, e não dá o número", async () => {
    const sessao = await assinarSessaoDoProfissional(8, "Ana");
    const r = await pedidoDoLink(pedido("/api/profissionais/pedido-do-link", { bearer: sessao, corpo: { token: link } }));
    expect(r.status).toBe(403);
    expect((await r.json()).negociacaoId).toBeUndefined();
  });

  it("um link que não é de nenhum pedido é 404, e sem sessão é 401", async () => {
    const sessao = await assinarSessaoDoProfissional(7, "Rui");
    const outro = await pedidoDoLink(
      pedido("/api/profissionais/pedido-do-link", { bearer: sessao, corpo: { token: "outro-link-qualquer" } }),
    );
    expect(outro.status).toBe(404);
    const semSessao = await pedidoDoLink(pedido("/api/profissionais/pedido-do-link", { corpo: { token: link } }));
    expect(semSessao.status).toBe(401);
  });

  it("um link expirado diz que expirou, como a página do pedido", async () => {
    const velho = gerarTokenDeAcesso(new Date(Date.now() - 400 * 86_400_000));
    vi.mocked(db.negociacaoPorTokenHash).mockResolvedValue({
      id: 55,
      providerId: 7,
      acessoTokenHash: velho.hash,
      acessoTokenExpiraEm: velho.expiraEm,
    } as never);
    const sessao = await assinarSessaoDoProfissional(7, "Rui");
    const r = await pedidoDoLink(pedido("/api/profissionais/pedido-do-link", { bearer: sessao, corpo: { token: velho.token } }));
    expect(r.status).toBe(410);
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
    expect(db.savePushSubscription).toHaveBeenCalledWith(
      "rui@exemplo.pt",
      { endpoint: TOKEN_EXPO, p256dh: "", auth: "" },
      "pro",
    );
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
    await enviarAvisoNaApp([{ token: TOKEN_EXPO, app: "pro" }], { title: "t", body: "b" }, { para: "pro", esquecer, pedir: pedir as never });
    expect(pedir).toHaveBeenCalledWith(ENDERECO_DA_EXPO, expect.objectContaining({ method: "POST" }));
    expect(esquecer).toHaveBeenCalledWith(TOKEN_EXPO);
  });

  it("uma falha da Expo não lança — devolve o motivo no bilhete", async () => {
    const pedir = vi.fn(async () => {
      throw new Error("sem rede");
    });
    await expect(
      enviarAvisoNaApp([{ token: TOKEN_EXPO, app: "pro" }], { title: "t", body: "b" }, { para: "pro", pedir: pedir as never }),
    ).resolves.toEqual([{ token: TOKEN_EXPO, erro: "SemLigacao" }]);
  });

  it("o sendPushToUser de sempre manda à app, mesmo sem chaves VAPID", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    vi.mocked(db.getPushSubscriptionsByEmail).mockResolvedValue([
      { endpoint: TOKEN_EXPO, p256dh: "", auth: "" },
    ]);
    const pedir = vi.fn(async () => new Response(JSON.stringify({ data: [{ status: "ok" }] })));
    vi.stubGlobal("fetch", pedir);
    await sendPushToUser("rui@exemplo.pt", { title: "Novo pedido", body: "Almada" }, "pro");
    expect(pedir).toHaveBeenCalledTimes(1);
    const corpo = JSON.parse((pedir.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(corpo[0]).toMatchObject({ to: TOKEN_EXPO, title: "Novo pedido" });
  });

  it("e não lança se a base falhar", async () => {
    vi.mocked(db.getPushSubscriptionsByEmail).mockRejectedValue(new Error("DB not available"));
    await expect(sendPushToUser("rui@exemplo.pt", { title: "t", body: "b" }, "pro")).resolves.toBeUndefined();
  });
});

describe("o aviso de teste prova que os avisos chegam", () => {
  it("sem telemóvel registado, diz-lhe o que fazer em vez de fingir que enviou", async () => {
    vi.mocked(db.getPushSubscriptionsByEmail).mockResolvedValue([]);
    const token = await assinarSessaoDoProfissional(7, "Rui");
    const r = await avisoDeTeste(pedido("/api/profissionais/aviso-de-teste", { bearer: token }));
    expect(r.status).toBe(409);
    expect((await r.json()).error).toContain("Ligar os avisos");
  });

  it("com o telemóvel registado, o aviso sai pela Expo e só se diz «entregue» com o recibo", async () => {
    vi.mocked(db.getPushSubscriptionsByEmail).mockResolvedValue([{ endpoint: TOKEN_EXPO, p256dh: "", auth: "" }]);
    const pedir = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ status: "ok", id: "recibo-1" }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { "recibo-1": { status: "ok" } } })));
    vi.stubGlobal("fetch", pedir);
    const token = await assinarSessaoDoProfissional(7, "Rui");
    const r = await avisoDeTeste(pedido("/api/profissionais/aviso-de-teste", { bearer: token }));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, entregue: true, telemoveis: 1 });
    const corpo = JSON.parse((pedir.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(corpo[0]).toMatchObject({ to: TOKEN_EXPO, title: "Avisos ligados" });
    expect(db.getPushSubscriptionsByEmail).toHaveBeenCalledWith("rui@exemplo.pt");
  });

  it("sem a chave do Firebase na Expo, diz isso mesmo em vez de «enviado»", async () => {
    vi.mocked(db.getPushSubscriptionsByEmail).mockResolvedValue([{ endpoint: TOKEN_EXPO, p256dh: "", auth: "" }]);
    const pedir = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ status: "ok", id: "recibo-2" }] })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { "recibo-2": { status: "error", details: { error: "InvalidCredentials" } } } }),
        ),
      );
    vi.stubGlobal("fetch", pedir);
    const token = await assinarSessaoDoProfissional(7, "Rui");
    const r = await avisoDeTeste(pedido("/api/profissionais/aviso-de-teste", { bearer: token }));
    expect(r.status).toBe(502);
    const corpo = await r.json();
    expect(corpo.codigo).toBe("InvalidCredentials");
    expect(corpo.error).toContain("chave do Firebase");
  });

  it("sem sessão, nada", async () => {
    expect((await avisoDeTeste(pedido("/api/profissionais/aviso-de-teste"))).status).toBe(401);
  });
});

describe("os links do site abrem a app", () => {
  it("sem variáveis, o Android já recebe as impressões da app; o iPhone sai vazio e válido", () => {
    expect(assetLinks({})[0].target.sha256_cert_fingerprints).toEqual([...IMPRESSOES_DA_APP_PRO]);
    expect(associacaoDaApple({}).applinks.details).toEqual([]);
  });

  it("as impressões da app estão bem escritas: são as da Google Play e da EAS", () => {
    expect(IMPRESSOES_DA_APP_PRO).toHaveLength(2);
    for (const i of IMPRESSOES_DA_APP_PRO) expect(i).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  });

  it("com as provas, aponta para pt.clyon.pro", () => {
    const android = assetLinks({ APP_PRO_ANDROID_SHA256: `${IMPRESSAO.toLowerCase()}, mal-escrita` });
    expect(android[0].target).toEqual({
      namespace: "android_app",
      package_name: "pt.clyon.pro",
      sha256_cert_fingerprints: [...IMPRESSOES_DA_APP_PRO, IMPRESSAO],
    });
    expect(impressoesDoAndroid({ APP_PRO_ANDROID_SHA256: "mal-escrita" })).toEqual([...IMPRESSOES_DA_APP_PRO]);
    // Uma da app repetida na variável não aparece duas vezes.
    expect(impressoesDoAndroid({ APP_PRO_ANDROID_SHA256: IMPRESSOES_DA_APP_PRO[0] })).toEqual([...IMPRESSOES_DA_APP_PRO]);

    const apple = associacaoDaApple({ APP_PRO_APPLE_TEAM_ID: "abcde12345" });
    expect(apple.applinks.details[0].appIDs).toEqual(["ABCDE12345.pt.clyon.pro"]);
    expect(apple.applinks.details[0].components).toEqual([
      { "/": "/profissionais/painel*" },
      { "/": "/profissionais/pedidos/*" },
      { "/": "/profissionais/definir-senha/*" },
    ]);
  });

  it("o link da palavra-passe abre a app no Android, e a página não fica sem saída", () => {
    const app = JSON.parse(readFileSync(join(process.cwd(), "app-pro/app.json"), "utf8"));
    const caminhos = app.expo.android.intentFilters[0].data.map((d: { pathPrefix: string }) => d.pathPrefix);
    expect(caminhos).toContain("/profissionais/definir-senha/");

    const pagina = "https://clyon.pt/profissionais/definir-senha/abc_-1?x=1";
    expect(abrirNaAppNoAndroid("/profissionais/definir-senha/abc_-1", pagina)).toBe(
      "intent://clyon.pt/profissionais/definir-senha/abc_-1#Intent;scheme=https;package=pt.clyon.pro;" +
        `S.browser_fallback_url=${encodeURIComponent(pagina)};end`,
    );

    const FORM = readFileSync(
      join(process.cwd(), "src/app/profissionais/definir-senha/[token]/DefinirSenhaForm.tsx"),
      "utf8",
    );
    expect(FORM).toContain("abrirNaAppNoAndroid(");
    expect(FORM).toContain("Abrir na app");
    // Só no Android: no iPhone e no computador o intent:// não abre nada.
    expect(FORM).toContain("/Android/i.test(navigator.userAgent)");
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
