import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * OS ERROS DA APP DE CLIENTE — d8 fase 2, S3 (28-10-2026; regra 7 da
 * Segurança).
 *
 * A mesma limpeza da Pro (sem emails, telefones nem tokens), marcados
 * «cliente», com a versão e o id do EAS Update; o backoffice mostra as duas
 * apps com a coluna «App»; e somem ao fim de 30 dias, na purga da noite.
 */

const gravados: Array<Record<string, unknown>> = [];
vi.mock("@/lib/db", () => ({
  registarErroDaApp: vi.fn(async (e: Record<string, unknown>) => {
    gravados.push(e);
  }),
}));
vi.mock("@/lib/limite-rota-publica", () => ({ limitarRotaPublica: vi.fn(async () => ({ erro: null })) }));

import { limitarRotaPublica } from "@/lib/limite-rota-publica";
import { POST as erroDaAppDeCliente } from "@/app/api/cliente/erro-da-app/route";
import { NOME_DA_APP } from "@/lib/erros-da-app";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const pedido = (corpo: unknown) =>
  new NextRequest("http://localhost/api/cliente/erro-da-app", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });

beforeEach(() => {
  gravados.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("S3 — POST /api/cliente/erro-da-app", () => {
  it("um erro com um email e um telefone chega sem eles, marcado «cliente», com a versão e o update", async () => {
    const r = await erroDaAppDeCliente(
      pedido({
        versao: "1.0.0",
        idDoUpdate: "0b6c7e2a-1234-4cde-9f00-abcdef012345",
        ecra: "pedidos/[id]",
        mensagem: "Falhou para cliente.teste@exemplo.pt (912 345 678)",
        email: "cliente.teste@exemplo.pt",
      }),
    );
    expect(r.status).toBe(200);
    expect(gravados).toHaveLength(1);
    const e = gravados[0];
    expect(e).toMatchObject({
      app: "cliente",
      versao: "1.0.0",
      idDoUpdate: "0b6c7e2a-1234-4cde-9f00-abcdef012345",
      ecra: "pedidos/[id]",
    });
    expect(String(e.mensagem)).not.toContain("@");
    expect(String(e.mensagem)).not.toMatch(/912/);
    expect(JSON.stringify(e)).not.toContain("exemplo.pt");
    expect(NOME_DA_APP[String(e.app)]).toBe("Cliente");
  });

  it("aceita sem sessão, com travão por endereço próprio", async () => {
    await erroDaAppDeCliente(pedido({ mensagem: "x" }));
    expect(limitarRotaPublica).toHaveBeenCalledWith(expect.anything(), "app-cliente-erro", expect.any(Number), expect.any(Number));
    const rota = ler("src/app/api/cliente/erro-da-app/route.ts");
    expect(rota).not.toMatch(/Access-Control-Allow-Origin/i);
    expect(rota).not.toMatch(/emailDoCliente\(|clienteDaSessao\(/);
  });

  it("sem mensagem não grava", async () => {
    expect((await erroDaAppDeCliente(pedido({ versao: "1" }))).status).toBe(400);
    expect(gravados).toHaveLength(0);
  });
});

describe("S3 — o backoffice e o prazo", () => {
  it("o backoffice lê as duas apps e mostra a coluna «App»", () => {
    expect(ler("src/app/api/admin/profissionais/erros-da-app/route.ts")).toContain("resumoDosErrosDasApps(DIAS_DOS_ERROS)");
    const DB = ler("src/lib/db.ts");
    const i = DB.indexOf("export async function resumoDosErrosDasApps");
    expect(i).toBeGreaterThan(-1);
    expect(DB.slice(i, i + 1400)).toContain("GROUP BY app, versao, ecra, mensagem");
    expect(ler("src/components/admin/AdminErrosDaAppPanel.tsx")).toContain('App {NOME_DA_APP[g.app ?? "pro"] ?? g.app}');
  });

  it("somem ao fim de 30 dias — a purga apaga os das duas apps (sem filtro de app)", () => {
    const DB = ler("src/lib/db.ts");
    expect(DB).toContain("`DELETE FROM errosDaApp WHERE recebidoEm < NOW() - INTERVAL ${n} DAY LIMIT 2000`");
    const purga = ler("src/app/api/cron/purgar-pedidos/route.ts");
    expect(purga).toContain("purgarErrosDaApp(DIAS_DOS_ERROS_DA_APP");
    expect(ler("src/lib/retencao.ts")).toContain("export const DIAS_DOS_ERROS_DA_APP = 30;");
  });
});
