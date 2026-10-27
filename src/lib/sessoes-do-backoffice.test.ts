import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ACTIVA_AGORA_MS,
  JANELA_ABERTA_MS,
  arrumarSessoes,
  haQuantoTempo,
  localDosCabecalhos,
  marcaGuardada,
  marcaNova,
  marcaValida,
  navegadorESistema,
  resumoDoToken,
  tokenDoCabecalho,
  type SeparadorNaBase,
} from "./sessoes-do-backoffice";
import { motivoParaRecusarSessao } from "./conta-do-painel";
import { assistenteComSeccoesPodeChamar, papelPodeChamar } from "./papel-do-painel";

/*
 * SESSÕES ABERTAS NO BACKOFFICE — 27-10-2026 (decisão d15).
 * O que a ordem pede: duas janelas no mesmo navegador = 2 janelas / 1
 * computador; fechar uma sai da lista em ~2 min; terminar obriga a entrar de
 * novo; só o administrador vê e termina.
 */

const NAV_A = "a".repeat(32);
const NAV_B = "b".repeat(32);
const T0 = new Date("2026-10-27T14:00:00Z");
const depois = (ms: number) => new Date(T0.getTime() + ms);

function separador(p: Partial<SeparadorNaBase> = {}): SeparadorNaBase {
  return {
    colaboradorId: 1,
    nome: "ADMIN",
    papel: "admin",
    navegadorId: NAV_A,
    separadorId: "s".repeat(32),
    tokenHash: "h".repeat(64),
    sessaoDesde: new Date("2026-10-27T09:00:00Z"),
    expiraEm: new Date("2026-10-27T17:00:00Z"),
    navegador: "Chrome",
    sistema: "Windows",
    cidade: "Lisboa",
    pais: "PT",
    inicioEm: T0,
    ultimaEm: T0,
    fechadaEm: null,
    ...p,
  };
}

function lerNu(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8").split("\r\n").join("\n");
}

describe("contar computadores e janelas", () => {
  it("duas janelas no mesmo navegador são 2 janelas e 1 computador", () => {
    const linhas = [separador({ separadorId: "1".repeat(32) }), separador({ separadorId: "2".repeat(32) })];
    const [pessoa] = arrumarSessoes(linhas, depois(10_000));
    expect(pessoa.computadores).toBe(1);
    expect(pessoa.janelas).toBe(2);
    expect(pessoa.navegadores).toHaveLength(1);
    expect(pessoa.navegadores[0].janelas).toBe(2);
    expect(pessoa.navegadores[0].activaAgora).toBe(true);
  });

  it("dois navegadores da mesma pessoa são 2 computadores", () => {
    const linhas = [separador(), separador({ navegadorId: NAV_B, navegador: "Safari", sistema: "iPhone" })];
    const [pessoa] = arrumarSessoes(linhas, depois(5_000));
    expect(pessoa.computadores).toBe(2);
    expect(pessoa.janelas).toBe(2);
  });

  it("cada pessoa à parte, o administrador primeiro", () => {
    const linhas = [
      separador({ colaboradorId: 7, nome: "BEATRIZ", papel: "assistente", navegadorId: NAV_B }),
      separador(),
    ];
    const pessoas = arrumarSessoes(linhas, depois(5_000));
    expect(pessoas.map((p) => p.nome)).toEqual(["ADMIN", "BEATRIZ"]);
  });

  it("uma janela que deixa de bater sai da contagem ~2 min depois (tempo simulado)", () => {
    // A janela 1 continua a bater; a 2 bateu pela última vez em T0 e fechou-se sem avisar.
    const aBater = (agora: Date) => separador({ separadorId: "1".repeat(32), ultimaEm: agora });
    const calada = separador({ separadorId: "2".repeat(32), ultimaEm: T0 });

    const aos90s = depois(90_000);
    expect(arrumarSessoes([aBater(aos90s), calada], aos90s)[0].janelas).toBe(2);

    const aos2min = depois(JANELA_ABERTA_MS);
    expect(arrumarSessoes([aBater(aos2min), calada], aos2min)[0].janelas).toBe(2);

    const aos2min1s = depois(JANELA_ABERTA_MS + 1_000);
    const [pessoa] = arrumarSessoes([aBater(aos2min1s), calada], aos2min1s);
    expect(pessoa.janelas).toBe(1);
    expect(pessoa.computadores).toBe(1);
  });

  it("a janela que avisou que fechou sai logo", () => {
    const linhas = [separador({ separadorId: "1".repeat(32) }), separador({ separadorId: "2".repeat(32), fechadaEm: T0 })];
    expect(arrumarSessoes(linhas, depois(1_000))[0].janelas).toBe(1);
  });

  it("um navegador sem janelas mas com a sessão de pé continua na lista, com «há N min»", () => {
    const agora = depois(2 * 60 * 60 * 1000);
    const [pessoa] = arrumarSessoes([separador()], agora);
    expect(pessoa.computadores).toBe(1);
    expect(pessoa.janelas).toBe(0);
    const n = pessoa.navegadores[0];
    expect(n.activaAgora).toBe(false);
    expect(n.minutosDesde).toBe(120);
    expect(haQuantoTempo(n.minutosDesde, n.activaAgora)).toBe("há 2 h");
    // A entrada é a do token (iat), não a do primeiro batimento.
    expect(n.inicioEm).toBe("2026-10-27T09:00:00.000Z");
  });

  it("a sessão terminada ou caducada sai da lista", () => {
    const terminada = separador({ tokenHash: "t".repeat(64) });
    expect(arrumarSessoes([terminada], depois(1_000), new Set(["t".repeat(64)]))).toEqual([]);
    const caducada = separador({ expiraEm: depois(-1) });
    expect(arrumarSessoes([caducada], depois(1_000))).toEqual([]);
  });

  it("«activa agora» só até um batimento e meio", () => {
    expect(arrumarSessoes([separador()], depois(ACTIVA_AGORA_MS))[0].navegadores[0].activaAgora).toBe(true);
    expect(arrumarSessoes([separador()], depois(ACTIVA_AGORA_MS + 1_000))[0].navegadores[0].activaAgora).toBe(false);
  });

  it("marca o navegador de quem está a ver", () => {
    const [p] = arrumarSessoes([separador(), separador({ navegadorId: NAV_B })], depois(1_000), new Set(), NAV_B);
    expect(p.navegadores.find((n) => n.navegadorId === NAV_B)?.esteNavegador).toBe(true);
    expect(p.navegadores.find((n) => n.navegadorId === NAV_A)?.esteNavegador).toBe(false);
  });
});

describe("terminar uma sessão obriga a entrar de novo", () => {
  const conta = { isAdmin: 1, funcao: "admin", active: 1, senhaAlteradaEm: null };

  it("uma sessão terminada é recusada, a do lado continua", () => {
    expect(motivoParaRecusarSessao({ ...conta, sessaoTerminada: false }, "admin", 1)).toBeNull();
    expect(motivoParaRecusarSessao({ ...conta, sessaoTerminada: true }, "admin", 1)).toMatch(/terminada/);
    expect(motivoParaRecusarSessao({ ...conta, sessaoTerminada: true }, "assistente", 1)).toMatch(/terminada/);
  });

  it("o requireAdmin e o requireAdminGeral perguntam pelo token desta sessão", () => {
    const HELPER = lerNu("src/lib/admin-auth-helper.ts");
    expect(HELPER).toContain("contaDoPainelPorId(colab.id, tokenHash)");
    expect(HELPER.match(/await contaAindaVale\(colab, [^)]*, token\)/g)?.length).toBe(2);
  });

  it("a conta é lida com a sessão terminada na mesma consulta", () => {
    const CONTA = lerNu("src/lib/conta-do-painel.ts");
    expect(CONTA).toContain("SELECT 1 FROM sessoesTerminadas WHERE tokenHash = ?");
  });

  it("o batimento que recebe 401 tira o navegador do backoffice", () => {
    const B = lerNu("src/components/admin/BatimentoDoBackoffice.tsx");
    expect(B).toContain("r.status === 401");
    expect(B).toContain("clearColaboradorStorage()");
    expect(B).toContain('"/admin/login"');
    expect(lerNu("src/app/admin/layout.tsx")).toContain("<BatimentoDoBackoffice />");
  });

  it("o resumo do token é sha-256 e não o token", async () => {
    const r = await resumoDoToken("abc");
    expect(r).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(tokenDoCabecalho("Bearer xyz")).toBe("xyz");
    expect(tokenDoCabecalho(null)).toBeNull();
  });
});

describe("só o administrador vê e termina", () => {
  it("o batimento é de todos; listar e terminar só do administrador", () => {
    expect(assistenteComSeccoesPodeChamar([], "/api/admin/sessao/batimento", "POST")).toBe(true);
    expect(assistenteComSeccoesPodeChamar(["configs"], "/api/admin/sessoes", "GET")).toBe(false);
    expect(assistenteComSeccoesPodeChamar(["configs"], "/api/admin/sessoes/terminar", "POST")).toBe(false);
    expect(papelPodeChamar("assistente", "/api/admin/sessoes", "GET")).toBe(false);
    expect(papelPodeChamar("admin", "/api/admin/sessoes/terminar", "POST")).toBe(true);
  });

  it("as rotas de listar e terminar usam requireAdminGeral; o batimento exige sessão", () => {
    for (const rota of ["src/app/api/admin/sessoes/route.ts", "src/app/api/admin/sessoes/terminar/route.ts"]) {
      const c = lerNu(rota);
      expect(c).toContain("await requireAdminGeral(req)");
      expect(c).not.toMatch(/await requireAdmin\(req\)/);
    }
    expect(lerNu("src/app/api/admin/sessao/batimento/route.ts")).toContain("await requireAdmin(req)");
  });

  it("o cartão só aparece ao administrador, nas Configs", () => {
    const L = lerNu("src/components/admin/LegacyAdminClient.tsx");
    const i = L.indexOf("<AdminSessoesPanel />");
    expect(i).toBeGreaterThan(0);
    const antes = L.slice(Math.max(0, i - 900), i);
    expect(antes).toContain('{papel === "admin" && (');
  });

  it("o IP não se lê nem se guarda", () => {
    for (const f of [
      "src/lib/sessoes-do-backoffice.ts",
      "src/lib/sessoes-do-backoffice-na-base.ts",
      "src/app/api/admin/sessao/batimento/route.ts",
    ]) {
      const c = lerNu(f);
      expect(c).not.toMatch(/x-forwarded-for|x-real-ip|getClientIp/);
    }
  });
});

describe("o que se lê do browser", () => {
  it("navegador e sistema", () => {
    const chromeWin =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
    const safariIphone =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
    const edge =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0";
    const chromeAndroid =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
    const firefoxMac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:131.0) Gecko/20100101 Firefox/131.0";
    expect(navegadorESistema(chromeWin)).toEqual({ navegador: "Chrome", sistema: "Windows" });
    expect(navegadorESistema(safariIphone)).toEqual({ navegador: "Safari", sistema: "iPhone" });
    expect(navegadorESistema(edge)).toEqual({ navegador: "Edge", sistema: "Windows" });
    expect(navegadorESistema(chromeAndroid)).toEqual({ navegador: "Chrome", sistema: "Android" });
    expect(navegadorESistema(firefoxMac)).toEqual({ navegador: "Firefox", sistema: "Mac" });
    expect(navegadorESistema(null)).toEqual({ navegador: "Outro navegador", sistema: "Outro sistema" });
  });

  it("a cidade e o país dos cabeçalhos da Vercel", () => {
    const h = new Headers({ "x-vercel-ip-city": "S%C3%A3o%20Domingos%20de%20Rana", "x-vercel-ip-country": "pt" });
    expect(localDosCabecalhos(h)).toEqual({ cidade: "São Domingos de Rana", pais: "PT" });
    expect(localDosCabecalhos(new Headers())).toEqual({ cidade: null, pais: null });
  });

  it("as marcas são aleatórias e o browser que recusa guardar não parte nada", () => {
    const a = marcaNova();
    const b = marcaNova();
    expect(marcaValida(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(marcaValida("curta")).toBe(false);
    expect(marcaValida("x".repeat(20) + "'; DROP")).toBe(false);

    const guardadas = new Map<string, string>();
    const gaveta = { getItem: (k: string) => guardadas.get(k) ?? null, setItem: (k: string, v: string) => void guardadas.set(k, v) };
    const primeira = marcaGuardada(() => gaveta, "k", "r".repeat(32));
    expect(marcaGuardada(() => gaveta, "k", "r".repeat(32))).toBe(primeira);

    const partida = () => {
      throw new Error("SecurityError");
    };
    expect(marcaGuardada(partida, "k", "r".repeat(32))).toBe("r".repeat(32));
  });
});
