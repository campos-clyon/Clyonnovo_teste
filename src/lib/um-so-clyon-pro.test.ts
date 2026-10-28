import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * UM SÓ «CLYON PRO» NO TELEMÓVEL, E CADA AVISO UMA VEZ — 28-10-2026 (d9).
 *
 * O painel instalado como app web chamava-se «CLYON Pro», como a app nativa,
 * e quem tinha as duas recebia cada aviso duas vezes: o `sendPushToUser`
 * mandava à app e ao navegador do mesmo email.
 */

vi.mock("@/lib/db", () => ({
  getPushSubscriptionsByEmail: vi.fn(async () => []),
  deletePushSubscription: vi.fn(async () => {}),
}));
const enviar = vi.fn(async () => ({}));
vi.mock("web-push", () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: (...a: unknown[]) => enviar(...(a as [])) },
}));

import * as db from "@/lib/db";
import { sendPushToUser, soAAppRecebe } from "@/lib/webpush";

const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8")
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "");

const DO_PRO = "ExponentPushToken[ProProProPro123]";
const NAVEGADOR = "https://fcm.googleapis.com/fcm/send/abcdef";
const OS_DOIS = [
  { endpoint: DO_PRO, p256dh: "", auth: "", app: "pro" as const },
  { endpoint: NAVEGADOR, p256dh: "k", auth: "a", app: "web" as const },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "publica-de-teste";
  process.env.VAPID_PRIVATE_KEY = "privada-de-teste";
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
});

describe("com a app, só a app", () => {
  it("a regra: só para o profissional, e só se a app recebeu", () => {
    expect(soAAppRecebe("pro", [{ token: DO_PRO, id: "r" }])).toBe(true);
    expect(soAAppRecebe("pro", [{ token: DO_PRO, erro: "SemLigacao" }])).toBe(false);
    expect(soAAppRecebe("pro", [])).toBe(false);
    expect(soAAppRecebe("cliente", [{ token: "x", id: "r" }])).toBe(false);
  });

  it("um aviso do profissional que chega à app não vai também ao navegador", async () => {
    vi.mocked(db.getPushSubscriptionsByEmail).mockResolvedValue(OS_DOIS);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [{ status: "ok", id: "r" }] }))));
    await sendPushToUser("pro@exemplo.pt", { title: "Pedido novo", body: "Almada" }, "pro");
    expect(enviar).not.toHaveBeenCalled();
  });

  it("se a app falhar, o navegador continua a receber", async () => {
    vi.mocked(db.getPushSubscriptionsByEmail).mockResolvedValue(OS_DOIS);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    await sendPushToUser("pro@exemplo.pt", { title: "Pedido novo", body: "Almada" }, "pro");
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it("sem a app, o navegador recebe como sempre", async () => {
    vi.mocked(db.getPushSubscriptionsByEmail).mockResolvedValue([OS_DOIS[1]]);
    await sendPushToUser("pro@exemplo.pt", { title: "Pedido novo", body: "Almada" }, "pro");
    expect(enviar).toHaveBeenCalledTimes(1);
  });
});

describe("o painel não se chama como a app", () => {
  it("o nome curto do painel instalado é «CLYON painel»", () => {
    const m = JSON.parse(readFileSync(join(process.cwd(), "public/app-profissionais.webmanifest"), "utf8")) as {
      short_name: string;
    };
    expect(m.short_name).toBe("CLYON painel");
    expect(m.short_name).not.toBe("CLYON Pro");
  });

  it("o cartão dos avisos no navegador não se mostra a quem tem a app", () => {
    const C = ler("src/app/profissionais/painel/AvisosNoTelemovel.tsx");
    expect(C).toContain('fetch("/api/profissionais/dispositivo")');
    expect(C).toContain("if (temApp) return null;");
    // O mesmo «já tem a app?» do convite para o teste da app.
    expect(ler("src/app/profissionais/painel/ConviteDaAppPro.tsx")).toContain('fetch("/api/profissionais/dispositivo")');
  });
});
