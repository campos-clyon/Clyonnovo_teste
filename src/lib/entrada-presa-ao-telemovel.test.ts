import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A ENTRADA PELO LINK PRESA AO TELEMÓVEL — d8 fase 2, S1 (28-10-2026).
 *
 * O link pedido na app de cliente leva a prova do aparelho (o SHA-256 do
 * código que a app guardou no cofre) e só entra nesse telemóvel, depois de a
 * pessoa ver a conta (R1a) e tocar em «Entrar» (R1). Os testes correm as rotas
 * a sério, com a tabela dos links numa base de mentira que faz o que o SQL faz
 * (as condições do SQL verdadeiro estão guardadas no fim).
 */

type Ligacao = {
  email: string;
  expiraEm: Date;
  usadoEm: Date | null;
  provaDoAparelho: string | null;
  verificacoes: number;
};
const ligacoes = new Map<string, Ligacao>();
const emails: Array<{ para: string; link: string; paraApp?: boolean }> = [];

vi.mock("@/lib/db", () => ({
  criarLigacaoDeEntrada: vi.fn(async (email: string, hash: string, expiraEm: Date, prova: string | null = null) => {
    for (const l of ligacoes.values()) if (l.email === email && !l.usadoEm) l.usadoEm = new Date();
    ligacoes.set(hash, { email, expiraEm, usadoEm: null, provaDoAparelho: prova, verificacoes: 0 });
  }),
  ligacaoDeEntradaPorHash: vi.fn(async (hash: string) => {
    const l = ligacoes.get(hash);
    return l ? { ...l } : null;
  }),
  consumirLigacaoDeEntradaDaApp: vi.fn(async (hash: string, prova: string) => {
    const l = ligacoes.get(hash);
    if (!l || l.usadoEm || l.expiraEm.getTime() <= Date.now() || l.provaDoAparelho !== prova) return false;
    l.usadoEm = new Date();
    return true;
  }),
  contarVerificacaoDaLigacao: vi.fn(async (hash: string, maximo: number) => {
    const l = ligacoes.get(hash);
    if (!l || l.verificacoes >= maximo) return false;
    l.verificacoes += 1;
    return true;
  }),
  consumirLigacaoDeEntrada: vi.fn(async (hash: string) => {
    const l = ligacoes.get(hash);
    if (!l) return { ok: false, motivo: "desconhecido" };
    if (l.usadoEm) return { ok: false, motivo: "usado" };
    if (l.expiraEm.getTime() <= Date.now()) return { ok: false, motivo: "expirado" };
    if (l.provaDoAparelho) return { ok: false, motivo: "daApp" };
    l.usadoEm = new Date();
    return { ok: true, email: l.email };
  }),
}));
vi.mock("@/lib/conta-server", () => ({ registarCliente: vi.fn(async () => {}) }));
vi.mock("@/lib/email-entrada", () => ({
  enviarEmailDeEntrada: vi.fn(async (p: { para: string; link: string; paraApp?: boolean }) => {
    emails.push(p);
    return true;
  }),
}));
vi.mock("@/lib/limite-rota-publica", () => ({
  limitarRotaPublica: vi.fn(async () => ({ erro: null })),
  limitarPorConta: vi.fn(async () => ({ erro: null })),
}));

import { POST as pedirLink } from "@/app/api/entrada/link/route";
import { POST as entrar } from "@/app/api/cliente/entrar/route";
import { POST as verificar } from "@/app/api/cliente/entrar/verificar/route";
import { authOptions } from "@/auth";
import { verificarSessaoDoCliente } from "@/lib/cliente-auth";
import { hashDaLigacao } from "@/lib/entrada-por-link-segredo";
import { MENSAGEM } from "@/lib/entrada-por-link";
import { provaDoCodigo } from "@/lib/entrada-na-app";
import { mascararEmail } from "@/lib/mascarar-email";

const EMAIL = "joao@gmail.com";
const CODIGO = "C".repeat(43);
const OUTRO_CODIGO = "D".repeat(43);

function chamar(url: string, corpo: unknown) {
  return new NextRequest(`https://clyon.pt${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });
}

/** Pede um link (da app, com o código, ou do site) e devolve o `t` do email. */
async function linkPedido(o: { app?: boolean; codigo?: string } = {}): Promise<string> {
  const corpo = o.app ? { email: EMAIL, app: "cliente", prova: provaDoCodigo(o.codigo ?? CODIGO) } : { email: EMAIL };
  const r = await pedirLink(chamar("/api/entrada/link", corpo));
  expect(r.status).toBe(200);
  const ultimo = emails[emails.length - 1];
  const url = new URL(ultimo.link);
  expect(url.pathname).toBe(o.app ? "/entrar/app" : "/entrar/link");
  expect(ultimo.paraApp === true).toBe(o.app === true);
  return url.searchParams.get("t")!;
}

/** O provedor `link-de-entrada` do site (NextAuth v4 guarda o `authorize` em `options`). */
async function entrarNoSite(token: string) {
  const p = (authOptions.providers as Array<{ id?: string; options?: { id?: string; authorize?: Function } }>).find(
    (x) => x.options?.id === "link-de-entrada" || x.id === "link-de-entrada",
  )!;
  return (p.options!.authorize as (c: unknown, r: unknown) => Promise<unknown>)({ token }, {});
}

beforeAll(() => {
  process.env.JWT_SECRET = "segredo-so-dos-testes-da-entrada-presa";
});

beforeEach(() => {
  ligacoes.clear();
  emails.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("S1 — o link da app entra uma vez, e só no telemóvel que o pediu", () => {
  it("com o código certo entra uma vez; a segunda dá «já usado»", async () => {
    const t = await linkPedido({ app: true });
    const r = await entrar(chamar("/api/cliente/entrar", { linkToken: t, codigoDoAparelho: CODIGO }));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j).toMatchObject({ ok: true, email: EMAIL, entrada: "link" });
    expect((await verificarSessaoDoCliente(j.token))?.email).toBe(EMAIL);
    const outra = await entrar(chamar("/api/cliente/entrar", { linkToken: t, codigoDoAparelho: CODIGO }));
    expect(outra.status).toBe(401);
    expect(await outra.json()).toMatchObject({ error: MENSAGEM.usado, motivo: "usado" });
  });

  it("código errado → 401 outroAparelho, e o mesmo link continua a entrar com o código certo", async () => {
    const t = await linkPedido({ app: true });
    const errado = await entrar(chamar("/api/cliente/entrar", { linkToken: t, codigoDoAparelho: OUTRO_CODIGO }));
    expect(errado.status).toBe(401);
    expect(await errado.json()).toEqual({ ok: false, error: MENSAGEM.outroAparelho, motivo: "outroAparelho" });
    expect(ligacoes.get(hashDaLigacao(t))!.usadoEm).toBeNull();
    const certo = await entrar(chamar("/api/cliente/entrar", { linkToken: t, codigoDoAparelho: CODIGO }));
    expect(certo.status).toBe(200);
  });

  it("sem o código, ou com outra forma: 400 «Pedido inválido.»", async () => {
    const t = await linkPedido({ app: true });
    for (const corpo of [{ linkToken: t }, { linkToken: t, codigoDoAparelho: "curto" }]) {
      const r = await entrar(chamar("/api/cliente/entrar", corpo));
      expect(r.status).toBe(400);
      expect((await r.json()).error).toBe("Pedido inválido.");
    }
    expect(ligacoes.get(hashDaLigacao(t))!.usadoEm).toBeNull();
  });

  it("um link pedido no site → 401 doSite na R1, sem o gastar (continua a servir no site)", async () => {
    const t = await linkPedido();
    const r = await entrar(chamar("/api/cliente/entrar", { linkToken: t, codigoDoAparelho: CODIGO }));
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ ok: false, error: MENSAGEM.doSite, motivo: "doSite" });
    expect(ligacoes.get(hashDaLigacao(t))!.usadoEm).toBeNull();
    expect(await entrarNoSite(t)).toMatchObject({ email: EMAIL });
  });

  it("o link da app aberto no /entrar/link do site é recusado, com «daApp», e não se gasta", async () => {
    const t = await linkPedido({ app: true });
    await expect(entrarNoSite(t)).rejects.toThrow("daApp");
    expect(ligacoes.get(hashDaLigacao(t))!.usadoEm).toBeNull();
    expect(MENSAGEM.daApp).toBe("Este link é para a app CLYON. Abra-o no telemóvel onde o pediu.");
    // O ecrã do site mostra essa frase quando o provedor a manda.
    const ecra = readFileSync(join(process.cwd(), "src/app/entrar/link/EntrarPorLink.tsx"), "utf8");
    expect(ecra).toContain('if (r?.error === "daApp")');
  });
});

describe("S1 — R1a: de quem é o link, sem o gastar", () => {
  it("com o código certo diz o email (inteiro e mascarado) e não gasta o link", async () => {
    const t = await linkPedido({ app: true });
    const r = await verificar(chamar("/api/cliente/entrar/verificar", { linkToken: t, codigoDoAparelho: CODIGO }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, email: EMAIL, emailMascarado: "j•••@gmail.com" });
    expect(ligacoes.get(hashDaLigacao(t))!.usadoEm).toBeNull();
    // E depois entra.
    expect((await entrar(chamar("/api/cliente/entrar", { linkToken: t, codigoDoAparelho: CODIGO }))).status).toBe(200);
  });

  it("sem o código certo não devolve o email; com um link do site, doSite", async () => {
    const t = await linkPedido({ app: true });
    const r = await verificar(chamar("/api/cliente/entrar/verificar", { linkToken: t, codigoDoAparelho: OUTRO_CODIGO }));
    expect(r.status).toBe(401);
    const texto = await r.text();
    expect(texto).not.toContain(EMAIL);
    expect(JSON.parse(texto).motivo).toBe("outroAparelho");
    const doSite = await linkPedido();
    const s = await verificar(chamar("/api/cliente/entrar/verificar", { linkToken: doSite, codigoDoAparelho: CODIGO }));
    expect((await s.json()).motivo).toBe("doSite");
  });

  it("no máximo 10 verificações por link", async () => {
    const t = await linkPedido({ app: true });
    for (let i = 0; i < 10; i++) {
      expect((await verificar(chamar("/api/cliente/entrar/verificar", { linkToken: t, codigoDoAparelho: CODIGO }))).status).toBe(200);
    }
    expect((await verificar(chamar("/api/cliente/entrar/verificar", { linkToken: t, codigoDoAparelho: CODIGO }))).status).toBe(429);
  });
});

describe("S1 — pedir o link: a mesma resposta, com e sem app", () => {
  it("igual carácter a carácter, exista ou não a conta", async () => {
    const semApp = await (await pedirLink(chamar("/api/entrada/link", { email: EMAIL }))).text();
    const comApp = await (
      await pedirLink(chamar("/api/entrada/link", { email: EMAIL, app: "cliente", prova: provaDoCodigo(CODIGO) }))
    ).text();
    const emailInvalido = await (
      await pedirLink(chamar("/api/entrada/link", { email: "isto-nao-e-email", app: "cliente", prova: provaDoCodigo(CODIGO) }))
    ).text();
    expect(comApp).toBe(semApp);
    expect(emailInvalido).toBe(semApp);
  });

  it("com app e sem prova (ou com outra app): 400 «Pedido inválido.» — sem dizer nada do email", async () => {
    for (const corpo of [
      { email: EMAIL, app: "cliente" },
      { email: EMAIL, app: "cliente", prova: "x".repeat(64) },
      { email: EMAIL, app: "pro", prova: provaDoCodigo(CODIGO) },
    ]) {
      const r = await pedirLink(chamar("/api/entrada/link", corpo));
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({ error: "Pedido inválido." });
    }
    expect(emails).toHaveLength(0);
  });

  it("a prova fica com o link; o link do site fica sem ela", async () => {
    const app = await linkPedido({ app: true });
    expect(ligacoes.get(hashDaLigacao(app))!.provaDoAparelho).toBe(provaDoCodigo(CODIGO));
    const site = await linkPedido();
    expect(ligacoes.get(hashDaLigacao(site))!.provaDoAparelho).toBeNull();
  });
});

describe("S1 — as peças", () => {
  it("mascararEmail", () => {
    expect(mascararEmail("joao@gmail.com")).toBe("j•••@gmail.com");
    expect(mascararEmail("a@x.pt")).toBe("a•••@x.pt");
    expect(mascararEmail("")).toBe("•••");
  });

  it("a prova é o SHA-256 do código (texto, UTF-8), em hexadecimal", () => {
    expect(provaDoCodigo("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("o SQL: gastar o link da app tem a prova na mesma escrita; o site só gasta links sem prova", () => {
    const DB = readFileSync(join(process.cwd(), "src/lib/db.ts"), "utf8");
    expect(DB).toMatch(/WHERE tokenHash = \? AND usadoEm IS NULL AND expiraEm > NOW\(\) AND provaDoAparelho = \?/);
    expect(DB).toMatch(/WHERE tokenHash = \? AND usadoEm IS NULL AND expiraEm > NOW\(\) AND provaDoAparelho IS NULL/);
    expect(DB).toContain("ALTER TABLE ligacoesDeEntrada ADD COLUMN provaDoAparelho CHAR(64) NULL DEFAULT NULL");
  });

  it("a página /entrar/app não gasta o link: não chama o provedor nem a R1, e tira o token do endereço", () => {
    const P = readFileSync(join(process.cwd(), "src/app/entrar/app/AbrirNaApp.tsx"), "utf8");
    expect(P).not.toContain("signIn(");
    expect(P).not.toContain("/api/cliente/entrar");
    expect(P).toContain('window.history.replaceState(null, "", "/entrar/app")');
    const PAGINA = readFileSync(join(process.cwd(), "src/app/entrar/app/page.tsx"), "utf8");
    expect(PAGINA).toContain('referrer: "no-referrer"');
    expect(PAGINA).toContain("robots: { index: false, follow: false }");
  });
});
