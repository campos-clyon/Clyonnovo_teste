import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as jose from "jose";

/**
 * SAIR OU MUDAR A PALAVRA-PASSE FECHA AS OUTRAS SESSÕES — 25-10-2026.
 *
 * O token do profissional vale trinta dias e renova-se. Mudar a palavra-passe
 * não fechava nada: o telemóvel perdido continuava dentro. Agora a conta tem
 * um corte (`sessoesDesde`) e os tokens emitidos antes dele não entram; quem
 * fez a mudança recebe um token novo na mesma resposta.
 */

const execute = vi.fn();
vi.mock("@/lib/db", () => ({
  ensureProvidersSchema: vi.fn(async () => {}),
  getPool: vi.fn(async () => ({ execute })),
  fecharSessoesDoProfissional: vi.fn(async () => {}),
  palavraPasseGuardada: vi.fn(async () => "guardada"),
  definirPalavraPasseDoProfissional: vi.fn(async () => {}),
}));
vi.mock("@/lib/limite-rota-publica", () => ({ limitarRotaPublica: vi.fn(async () => ({ erro: null })) }));

import * as db from "@/lib/db";
import * as auth from "@/lib/profissional-auth";
import { assinarSessaoDoProfissional, verificarSessaoDoProfissional, COOKIE_SESSAO_PROFISSIONAL } from "@/lib/profissional-auth";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { emitidoAntesDoCorte, inicioDoSegundo } from "@/lib/corte-das-sessoes";
import { POST as sairDeTodos } from "@/app/api/profissionais/sair-de-todos/route";
import { POST as mudarPalavraPasse } from "@/app/api/profissionais/palavra-passe/route";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

/** A conta como a base a devolve, com o corte que se quiser. */
function contaComCorte(sessoesDesde: Date | null) {
  execute.mockResolvedValue([[{ estado: "aprovado", isActive: 1, sessoesDesde }], undefined]);
}

function pedido(url: string, o: { bearer?: string; cookie?: string; corpo?: unknown } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (o.bearer) headers.authorization = `Bearer ${o.bearer}`;
  if (o.cookie) headers.cookie = `${COOKIE_SESSAO_PROFISSIONAL}=${o.cookie}`;
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers,
    body: o.corpo === undefined ? undefined : JSON.stringify(o.corpo),
  });
}

beforeAll(() => {
  process.env.JWT_SECRET = "segredo-so-dos-testes-do-corte-das-sessoes";
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  contaComCorte(null);
});

describe("o corte", () => {
  it("um token de antes do corte não entra; um de depois, ou do mesmo segundo, entra", () => {
    const corte = new Date("2026-10-25T12:00:00Z");
    const s = corte.getTime() / 1000;
    expect(emitidoAntesDoCorte(s - 1, corte)).toBe(true);
    expect(emitidoAntesDoCorte(s, corte)).toBe(false);
    expect(emitidoAntesDoCorte(s + 60, corte)).toBe(false);
    // Como a base o devolve em texto, sem fuso (é UTC).
    expect(emitidoAntesDoCorte(s - 1, "2026-10-25 12:00:00")).toBe(true);
  });

  it("sem corte tudo entra; um token sem data (dos de antes) não passa um corte", () => {
    expect(emitidoAntesDoCorte(123, null)).toBe(false);
    expect(emitidoAntesDoCorte(null, null)).toBe(false);
    expect(emitidoAntesDoCorte(null, new Date())).toBe(true);
  });

  it("o corte grava-se sem as fracções do segundo (o DATETIME arredondava para cima)", () => {
    expect(inicioDoSegundo(new Date("2026-10-25T12:00:00.900Z")).toISOString()).toBe("2026-10-25T12:00:00.000Z");
  });

  it("o token novo diz quando foi emitido", async () => {
    const s = await verificarSessaoDoProfissional(await assinarSessaoDoProfissional(7, "Teste"));
    expect(typeof s?.emitidoEm).toBe("number");
  });
});

describe("a sessão confirmada na base respeita o corte", () => {
  it("o token emitido antes do corte é recusado, o de depois passa", async () => {
    const antigo = await new jose.SignJWT({ providerId: 7, nome: "Teste", type: auth.TIPO_PROFISSIONAL, lembrar: true })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime("1d")
      .sign(new TextEncoder().encode(process.env.JWT_SECRET as string));
    contaComCorte(inicioDoSegundo(new Date(Date.now() - 60_000)));
    expect(await sessaoActivaDoProfissional(antigo)).toBeNull();
    const novo = await assinarSessaoDoProfissional(7, "Teste");
    expect(await sessaoActivaDoProfissional(novo)).toMatchObject({ providerId: 7 });
  });

  it("sem a coluna na base (migração por correr), entra como antes", async () => {
    execute
      .mockRejectedValueOnce(Object.assign(new Error("Unknown column 'sessoesDesde'"), { code: "ER_BAD_FIELD_ERROR" }))
      .mockResolvedValueOnce([[{ estado: "aprovado", isActive: 1 }], undefined]);
    expect(await sessaoActivaDoProfissional(await assinarSessaoDoProfissional(7, "Teste"))).toMatchObject({ providerId: 7 });
  });
});

describe("«Sair de todos os aparelhos»", () => {
  it("fecha as sessões da conta e dá à app um token novo, no corpo", async () => {
    const token = await assinarSessaoDoProfissional(7, "Teste");
    const r = await sairDeTodos(pedido("/api/profissionais/sair-de-todos", { bearer: token }));
    expect(r.status).toBe(200);
    expect(db.fecharSessoesDoProfissional).toHaveBeenCalledWith(7);
    const corpo = await r.json();
    expect(corpo.ok).toBe(true);
    expect(await verificarSessaoDoProfissional(corpo.token)).toMatchObject({ providerId: 7 });
  });

  it("no painel, o token novo vai no cookie e nunca no corpo", async () => {
    const token = await assinarSessaoDoProfissional(7, "Teste");
    const r = await sairDeTodos(pedido("/api/profissionais/sair-de-todos", { cookie: token }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    expect(r.headers.get("set-cookie")).toContain(`${COOKIE_SESSAO_PROFISSIONAL}=`);
  });

  it("sem sessão, nada", async () => {
    expect((await sairDeTodos(pedido("/api/profissionais/sair-de-todos"))).status).toBe(401);
    expect(db.fecharSessoesDoProfissional).not.toHaveBeenCalled();
  });
});

describe("mudar ou repor a palavra-passe põe o corte", () => {
  it("a base grava o corte com a palavra-passe nova", () => {
    const DB = ler("src/lib/db.ts");
    const i = DB.indexOf("export async function definirPalavraPasseDoProfissional");
    expect(i).toBeGreaterThan(-1);
    const corpo = DB.slice(i, DB.indexOf("\n}\n", i));
    expect(corpo).toMatch(/SET passwordHash = \?, senhaTokenHash = NULL, senhaTokenExpiraEm = NULL, sessoesDesde = \?/);
    expect(corpo).toContain("inicioDoSegundo()");
    expect(DB).toContain("ALTER TABLE providers ADD COLUMN sessoesDesde DATETIME NULL DEFAULT NULL");
  });

  it("quem a mudou na app fica dentro, com um token novo", async () => {
    vi.mocked(db.palavraPasseGuardada).mockResolvedValue(await auth.hashDaPalavraPasse("antiga-123") as never);
    const token = await assinarSessaoDoProfissional(7, "Teste");
    const r = await mudarPalavraPasse(
      pedido("/api/profissionais/palavra-passe", { bearer: token, corpo: { actual: "antiga-123", nova: "uma-palavra-passe-nova-1" } }),
    );
    expect(r.status).toBe(200);
    expect(db.definirPalavraPasseDoProfissional).toHaveBeenCalledWith(7, expect.any(String));
    const corpo = await r.json();
    expect(await verificarSessaoDoProfissional(corpo.token)).toMatchObject({ providerId: 7 });
  });

  it("repor pelo link do email também passa pela mesma função", () => {
    expect(ler("src/app/api/profissionais/definir-senha/route.ts")).toContain("definirPalavraPasseDoProfissional(");
  });
});
