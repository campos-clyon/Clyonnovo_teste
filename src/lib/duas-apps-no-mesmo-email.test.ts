import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * AS DUAS APPS NO MESMO EMAIL — 25-10-2026.
 *
 * Um profissional que também pede trabalhos tem a CLYON Pro e a app do
 * cliente com o mesmo email. Os avisos guardavam-se e mandavam-se só pelo
 * email: a proposta para o cliente tocava na app do profissional, e um envio
 * com tokens das duas apps (dois projectos da Expo) era recusado inteiro.
 * Agora cada aparelho diz de que app é, cada aviso diz para que app vai, e
 * os envios saem num lote por projecto.
 */

vi.mock("@/lib/db", () => ({
  getPushSubscriptionsByEmail: vi.fn(async () => []),
  deletePushSubscription: vi.fn(async () => {}),
  savePushSubscription: vi.fn(async () => {}),
  perfilDoProfissional: vi.fn(async () => ({ email: "dois@exemplo.pt" })),
}));
vi.mock("@/lib/sessao-activa-do-profissional", () => ({
  sessaoActivaDoProfissional: vi.fn(async () => ({ providerId: 7, nome: "Teste" })),
}));
vi.mock("@/lib/limite-rota-publica", () => ({
  limitarRotaPublica: vi.fn(async () => ({ erro: null })),
}));

import * as db from "@/lib/db";
import { sendPushToUser } from "@/lib/webpush";
import {
  aparelhosDaApp,
  appDoAparelho,
  enviarAvisoNaApp,
  lotesPorProjecto,
  type AparelhoDaApp,
} from "@/lib/push-nativo";
import { GET as temApp, POST as registar } from "@/app/api/profissionais/dispositivo/route";

const DO_PRO = "ExponentPushToken[ProProProPro123]";
const DO_CLIENTE = "ExponentPushToken[ClienteCliente456]";
const NAVEGADOR = "https://fcm.googleapis.com/fcm/send/abcdef";

const AS_DUAS = [
  { endpoint: DO_PRO, p256dh: "", auth: "", app: "pro" as const },
  { endpoint: DO_CLIENTE, p256dh: "", auth: "", app: "cliente" as const },
  { endpoint: NAVEGADOR, p256dh: "k", auth: "a", app: "web" as const },
];

/** Os tokens de cada envio feito à Expo. */
function enviosAExpo(pedir: ReturnType<typeof vi.fn>): string[][] {
  return pedir.mock.calls.map((c) => {
    const corpo = JSON.parse((c as unknown as [string, RequestInit])[1].body as string) as Array<{ to: string }>;
    return corpo.map((m) => m.to);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  delete process.env.VAPID_PRIVATE_KEY;
});
afterEach(() => vi.unstubAllGlobals());

describe("o aviso só toca na app a que se destina", () => {
  it("o aviso do cliente vai só à app do cliente", async () => {
    vi.mocked(db.getPushSubscriptionsByEmail).mockResolvedValue(AS_DUAS);
    const pedir = vi.fn(async () => new Response(JSON.stringify({ data: [{ status: "ok", id: "r" }] })));
    vi.stubGlobal("fetch", pedir);
    await sendPushToUser("dois@exemplo.pt", { title: "Proposta", body: "Pedido #1" }, "cliente");
    expect(enviosAExpo(pedir)).toEqual([[DO_CLIENTE]]);
  });

  it("o aviso do profissional vai só à CLYON Pro", async () => {
    vi.mocked(db.getPushSubscriptionsByEmail).mockResolvedValue(AS_DUAS);
    const pedir = vi.fn(async () => new Response(JSON.stringify({ data: [{ status: "ok", id: "r" }] })));
    vi.stubGlobal("fetch", pedir);
    await sendPushToUser("dois@exemplo.pt", { title: "Pedido novo", body: "Almada" }, "pro");
    expect(enviosAExpo(pedir)).toEqual([[DO_PRO]]);
  });

  it("para as duas apps, sai um lote por projecto da Expo — nunca os dois tokens no mesmo envio", async () => {
    const pedir = vi.fn(async (_u: string, init: RequestInit) => {
      const n = (JSON.parse(init.body as string) as unknown[]).length;
      return new Response(JSON.stringify({ data: Array.from({ length: n }, () => ({ status: "ok", id: "r" })) }));
    });
    const aparelhos = aparelhosDaApp(AS_DUAS, ["pro", "cliente"]);
    await enviarAvisoNaApp(aparelhos, { title: "t", body: "b" }, { para: ["pro", "cliente"], pedir: pedir as never });
    expect(enviosAExpo(pedir)).toEqual([[DO_PRO], [DO_CLIENTE]]);
  });

  it("os lotes não passam de 100 e nunca misturam apps", () => {
    const muitos: AparelhoDaApp[] = [
      ...Array.from({ length: 150 }, (_, i) => ({ token: `ExponentPushToken[pro${String(i).padStart(8, "0")}]`, app: "pro" as const })),
      ...Array.from({ length: 30 }, (_, i) => ({ token: `ExponentPushToken[cli${String(i).padStart(8, "0")}]`, app: "cliente" as const })),
    ];
    const lotes = lotesPorProjecto(muitos);
    expect(lotes.map((l) => [l.app, l.tokens.length])).toEqual([
      ["pro", 100],
      ["pro", 50],
      ["cliente", 30],
    ]);
  });

  it("uma linha sem a coluna lê-se como antes: o token da Expo era da Pro", () => {
    expect(appDoAparelho({ endpoint: DO_PRO })).toBe("pro");
    expect(appDoAparelho({ endpoint: NAVEGADOR })).toBe("web");
    // Um endereço do navegador nunca é de uma app nativa.
    expect(appDoAparelho({ endpoint: NAVEGADOR, app: "cliente" })).toBe("web");
  });
});

describe("a CLYON Pro regista-se como «pro», e o «já tem a app?» só conta a Pro", () => {
  const pedido = (metodo: string, corpo?: unknown) =>
    new NextRequest("http://localhost/api/profissionais/dispositivo", {
      method: metodo,
      headers: { "content-type": "application/json", authorization: "Bearer x" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });

  it("o telemóvel guarda-se com a app «pro»", async () => {
    const r = await registar(pedido("POST", { token: DO_PRO }));
    expect(r.status).toBe(200);
    expect(db.savePushSubscription).toHaveBeenCalledWith(
      "dois@exemplo.pt",
      { endpoint: DO_PRO, p256dh: "", auth: "" },
      "pro",
    );
  });

  it("só a app do cliente no mesmo email não é «já tem a app»", async () => {
    vi.mocked(db.getPushSubscriptionsByEmail).mockResolvedValue([AS_DUAS[1], AS_DUAS[2]]);
    expect(await (await temApp(pedido("GET"))).json()).toEqual({ temApp: false });
    vi.mocked(db.getPushSubscriptionsByEmail).mockResolvedValue(AS_DUAS);
    expect(await (await temApp(pedido("GET"))).json()).toEqual({ temApp: true });
  });
});

describe("a coluna nasce sem apagar nada", () => {
  const DB = readFileSync(join(process.cwd(), "src/lib/db.ts"), "utf8").replace(/\r\n/g, "\n");
  const i = DB.indexOf("async function ensurePushSubscriptionsTable");
  const bloco = DB.slice(i, DB.indexOf("export interface StoredPushSubscription", i));

  it("ADD COLUMN com «web» por omissão, e os tokens da Expo antigos passam a «pro»", () => {
    expect(i).toBeGreaterThan(-1);
    expect(bloco).toMatch(/app\s+VARCHAR\(10\)\s+NOT NULL DEFAULT 'web'/);
    expect(bloco).toContain("ALTER TABLE pushSubscriptions ADD COLUMN app VARCHAR(10) NOT NULL DEFAULT 'web'");
    expect(bloco).toMatch(/UPDATE pushSubscriptions SET app = 'pro' WHERE app = 'web' AND \(endpoint LIKE 'ExponentPushToken\[%'/);
    expect(bloco).not.toMatch(/DELETE|DROP|TRUNCATE/i);
  });

  it("guardar e ler levam a app", () => {
    expect(DB).toContain("INSERT INTO pushSubscriptions (userEmail, endpoint, p256dh, auth, app)");
    expect(DB).toContain("app = VALUES(app)");
    expect(DB).toContain("SELECT endpoint, p256dh, auth, app FROM pushSubscriptions WHERE userEmail = ?");
  });

  it("cada aviso diz para que app vai", () => {
    const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    const avisos = ler("src/lib/avisar-por-push.ts");
    expect(avisos.match(/\}, "cliente"\);/g)).toHaveLength(2);
    expect(avisos.match(/\}, "pro"\);/g)).toHaveLength(2);
    const terreno = ler("src/lib/avisos-do-terreno.ts");
    expect(terreno).toMatch(/\}, "cliente"\);/);
    expect(terreno).toMatch(/\}, "pro"\);/);
    // O estado do pedido, no db.ts, é para o cliente.
    expect(DB).toMatch(/tag: `pedido-\$\{id\}`,\s*\}, "cliente"\);/);
  });
});
