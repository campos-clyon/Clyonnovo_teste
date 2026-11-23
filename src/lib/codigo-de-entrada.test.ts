// relógio: datas explícitas — só se chama o ramo dos códigos da rota das assistentes, que não lê o dia do modelo.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

/**
 * O CÓDIGO PARA ENTRAR NO BACKOFFICE — d75, 20-11-2026.
 *
 * A regra (12 caracteres, quatro classes, Unicode), os códigos repetidos, o
 * índice HMAC seguido do bcrypt, a falha fechada sem o segredo, o limitador,
 * a palavra-passe que deixa de servir, só o administrador a criar e trocar,
 * a troca que fecha as sessões, e nenhum código em respostas nem registos.
 */

const estado = vi.hoisted(() => ({
  conta: undefined as
    | undefined
    | { id: number; nome: string; isAdmin: number | null; funcao: string | null; active: number | null; codigoHash: string | null },
  indicePedido: null as string | null,
  limite: { ip: true, total: true },
  contador: 0,
  chaves: [] as string[],
  temCodigo: false,
  colaborador: null as null | Record<string, unknown>,
  auth: "admin" as "admin" | "negado",
  definidos: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/rate-limit", () => ({
  getClientIp: () => "203.0.113.9",
  checkRateLimit: async (chave: string) => {
    estado.chaves.push(chave);
    const allowed = chave.includes("-total") ? estado.limite.total : estado.limite.ip;
    return { allowed, count: 1, limit: 10 };
  },
  lerContador: async () => estado.contador,
}));

vi.mock("@/lib/limite-rota-publica", () => ({
  limitarRotaPublica: async () => ({ erro: null }),
  limitarPorConta: async () => ({ erro: null }),
}));

vi.mock("@/lib/sessoes-do-backoffice-na-base", () => ({ registarEntrada: async () => {} }));

vi.mock("@/lib/codigo-de-entrada-na-base", () => ({
  CODIGO_REPETIDO: "Esse código já está em uso. Escolha ou gere outro.",
  contaPeloIndice: async (indice: string) => {
    estado.indicePedido = indice;
    return estado.conta;
  },
  haContasActivasSemCodigo: async () => true,
  contaTemCodigo: async () => estado.temCodigo,
  contasParaOsCodigos: async () => [],
  registoDosCodigos: async () => [],
  anularCodigoDaConta: async () => {},
  definirCodigoDaConta: async (args: Record<string, unknown>) => {
    estado.definidos.push(args);
    return { ok: true, nome: "ANA", accao: "criado" };
  },
}));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({}),
  getColaboradorByNome: async () => estado.colaborador ?? undefined,
  appendOrderHistory: async () => {},
  definirPrecoAoClienteClyon: async () => null,
}));

vi.mock("@/lib/admin-auth-helper", () => ({
  requireAdminGeral: async () =>
    estado.auth === "admin"
      ? { err: null, colab: { id: 1, nome: "DONO", isAdmin: 1, papel: "admin" } }
      : {
          err: new Response(JSON.stringify({ error: "Apenas administradores." }), { status: 403 }),
          colab: null,
        },
}));

import {
  CODIGO_INVALIDO,
  codigoConfere,
  erroDoCodigo,
  gerarCodigo,
  hashDoCodigo,
  indiceDoCodigo,
  normalizarCodigo,
  segredoDoIndice,
} from "./codigo-de-entrada";
import { motivoParaRecusarSessao, tokenAnteriorATrocaDeSenha } from "./conta-do-painel";

const SEGREDO = "a".repeat(64);
const CODIGO = "Casa Azul 2026 #ok";

const semComentarios = (f: string) =>
  f.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");
const lerNu = (p: string) => semComentarios(readFileSync(join(process.cwd(), p), "utf8"));

function pedido(url: string, corpo?: unknown) {
  return new NextRequest(new URL(url, "https://clyon.pt"), {
    method: corpo === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", "user-agent": "vitest" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
}

let registos: string[] = [];
beforeEach(() => {
  estado.conta = undefined;
  estado.indicePedido = null;
  estado.limite = { ip: true, total: true };
  estado.contador = 0;
  estado.chaves = [];
  estado.temCodigo = false;
  estado.colaborador = null;
  estado.auth = "admin";
  estado.definidos = [];
  process.env.CODIGO_DE_ENTRADA_PEPPER = SEGREDO;
  process.env.JWT_SECRET = "segredo-de-teste-com-tamanho-suficiente-para-hs256";
  registos = [];
  for (const nivel of ["log", "info", "warn", "error"] as const) {
    vi.spyOn(console, nivel).mockImplementation((...a: unknown[]) => {
      registos.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
    });
  }
});
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CODIGO_DE_ENTRADA_PEPPER;
});

describe("a regra: 12 caracteres, maiúscula, minúscula, número e símbolo", () => {
  it("aceita um código que cumpre, com espaços no meio e Unicode", () => {
    expect(erroDoCodigo("Abcdefghij1!")).toBeNull();
    expect(erroDoCodigo(CODIGO)).toBeNull();
    expect(erroDoCodigo("Água fria é 1 céu ☀")).toBeNull();
  });

  it("recusa o que falta, e diz o quê", () => {
    expect(erroDoCodigo("Abcdefgh1!")).toMatch(/12 caracteres/);
    expect(erroDoCodigo("abcdefghijk1!")).toMatch(/maiúscula/);
    expect(erroDoCodigo("ABCDEFGHIJK1!")).toMatch(/minúscula/);
    expect(erroDoCodigo("Abcdefghijkl!")).toMatch(/número/);
    expect(erroDoCodigo("Abcdefghijk12")).toMatch(/símbolo/);
    // Um espaço não é símbolo.
    expect(erroDoCodigo("Abcdef ghijk1")).toMatch(/símbolo/);
    expect(erroDoCodigo(12345678901234)).not.toBeNull();
    expect(erroDoCodigo("Ab1!" + "x".repeat(200))).toMatch(/no máximo/);
  });

  it("conta os caracteres como se vêem, e tira só os espaços das pontas", () => {
    // 11 caracteres visíveis + espaços nas pontas: não chega.
    expect(erroDoCodigo("  Abcdefgh1!  ")).toMatch(/12 caracteres/);
    expect(normalizarCodigo("  a b  ")).toBe("a b");
  });

  it("o gerado cumpre sempre a regra e não se repete", () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const c = gerarCodigo();
      expect(erroDoCodigo(c)).toBeNull();
      expect(c).toHaveLength(20);
      vistos.add(c);
    }
    expect(vistos.size).toBe(200);
  });
});

describe("o índice HMAC e a verificação lenta", () => {
  it("o índice é o HMAC-SHA256 do código com o segredo", () => {
    const esperado = createHmac("sha256", SEGREDO).update(CODIGO, "utf8").digest("hex");
    expect(indiceDoCodigo(CODIGO, SEGREDO)).toBe(esperado);
    expect(indiceDoCodigo(CODIGO, SEGREDO)).toHaveLength(64);
    // Outro segredo, outro índice: a base sozinha não serve para testar códigos.
    expect(indiceDoCodigo(CODIGO, "b".repeat(64))).not.toBe(esperado);
  });

  it("dois códigos iguais dão o mesmo índice — é assim que se apanham os repetidos", () => {
    // O mesmo «é» em duas formas Unicode é o mesmo código.
    const composto = "Café com Leite 1!";
    const decomposto = "Café com Leite 1!";
    expect(indiceDoCodigo(composto, SEGREDO)).toBe(indiceDoCodigo(decomposto, SEGREDO));
    expect(indiceDoCodigo("Outro Código 2!", SEGREDO)).not.toBe(indiceDoCodigo(composto, SEGREDO));
  });

  it("o hash é bcrypt e confere só com o código certo — até ao último carácter", async () => {
    const hash = await hashDoCodigo(CODIGO);
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    expect(hash).not.toContain(CODIGO);
    expect(await codigoConfere(CODIGO, hash)).toBe(true);
    expect(await codigoConfere("Casa Azul 2026 #oK", hash)).toBe(false);
    // Mais de 72 bytes: o bcrypt cru ignorava o fim; aqui conta.
    const longo = "Ç".repeat(40) + "Aa1!";
    const hashLongo = await hashDoCodigo(longo);
    expect(await codigoConfere("Ç".repeat(40) + "Aa1?", hashLongo)).toBe(false);
    expect(await codigoConfere(longo, hashLongo)).toBe(true);
  }, 20000);

  it("sem hash (o índice não encontrou ninguém) nunca confere", async () => {
    expect(await codigoConfere(CODIGO, null)).toBe(false);
    expect(await codigoConfere(CODIGO, "lixo")).toBe(false);
  }, 20000);
});

describe("sem o segredo, falha fechada", () => {
  it("o segredo tem de existir e ter tamanho", () => {
    expect(segredoDoIndice({})).toBeNull();
    expect(segredoDoIndice({ CODIGO_DE_ENTRADA_PEPPER: "curto" })).toBeNull();
    expect(segredoDoIndice({ CODIGO_DE_ENTRADA_PEPPER: SEGREDO })).toBe(SEGREDO);
  });

  it("a entrada por código recusa, sem sequer procurar a conta", async () => {
    delete process.env.CODIGO_DE_ENTRADA_PEPPER;
    const { POST } = await import("@/app/api/colaboradores/codigo/route");
    const r = await POST(pedido("/api/colaboradores/codigo", { codigo: CODIGO }));
    expect(r.status).toBe(503);
    expect(estado.indicePedido).toBeNull();
  }, 20000);

  it("e o administrador não consegue gravar códigos", async () => {
    delete process.env.CODIGO_DE_ENTRADA_PEPPER;
    const { POST } = await import("@/app/api/admin/assistentes/route");
    const r = await POST(pedido("/api/admin/assistentes", { codigoDeEntrada: { id: 2, gerar: true } }));
    expect(r.status).toBe(503);
    expect(estado.definidos).toHaveLength(0);
  });
});

describe("a entrada por código", () => {
  it("entra com o código certo, pelo índice e pelo bcrypt", async () => {
    estado.conta = { id: 7, nome: "ANA", isAdmin: 0, funcao: "assistente", active: 1, codigoHash: await hashDoCodigo(CODIGO) };
    const { POST } = await import("@/app/api/colaboradores/codigo/route");
    const r = await POST(pedido("/api/colaboradores/codigo", { codigo: `  ${CODIGO} ` }));
    expect(r.status).toBe(200);
    const corpo = await r.json();
    expect(corpo.colaborador).toMatchObject({ id: 7, nome: "ANA", papel: "assistente" });
    expect(typeof corpo.token).toBe("string");
    expect(estado.indicePedido).toBe(indiceDoCodigo(CODIGO, SEGREDO));
    expect(JSON.stringify(corpo)).not.toContain(CODIGO);
    expect(registos.join("\n")).not.toContain(CODIGO);
  }, 20000);

  it("o índice certo com o hash errado não entra — o bcrypt confirma sempre", async () => {
    estado.conta = { id: 7, nome: "ANA", isAdmin: 0, funcao: "assistente", active: 1, codigoHash: await hashDoCodigo("Outro Código 9!") };
    const { POST } = await import("@/app/api/colaboradores/codigo/route");
    const r = await POST(pedido("/api/colaboradores/codigo", { codigo: CODIGO }));
    expect(r.status).toBe(401);
    expect((await r.json()).error).toBe(CODIGO_INVALIDO);
  }, 20000);

  it("errado, desconhecido ou de conta desactivada: a mesma mensagem, no mesmo tempo", async () => {
    const { POST } = await import("@/app/api/colaboradores/codigo/route");
    const t0 = Date.now();
    const r1 = await POST(pedido("/api/colaboradores/codigo", { codigo: "Nao Existe 123!" }));
    const d1 = Date.now() - t0;
    estado.conta = { id: 7, nome: "ANA", isAdmin: 0, funcao: "assistente", active: 0, codigoHash: await hashDoCodigo(CODIGO) };
    const t1 = Date.now();
    const r2 = await POST(pedido("/api/colaboradores/codigo", { codigo: CODIGO }));
    const d2 = Date.now() - t1;
    expect(r1.status).toBe(401);
    expect(r2.status).toBe(401);
    expect((await r1.json()).error).toBe(CODIGO_INVALIDO);
    expect((await r2.json()).error).toBe(CODIGO_INVALIDO);
    // Ambos esperam o tempo mínimo da resposta.
    expect(d1).toBeGreaterThanOrEqual(1150);
    expect(d2).toBeGreaterThanOrEqual(1150);
    expect(registos.join("\n")).not.toContain(CODIGO);
  }, 30000);

  it("o limitador trava por IP e no total, com a mensagem neutra", async () => {
    const { POST } = await import("@/app/api/colaboradores/codigo/route");
    estado.limite = { ip: false, total: true };
    const r1 = await POST(pedido("/api/colaboradores/codigo", { codigo: CODIGO }));
    expect(r1.status).toBe(429);
    expect((await r1.json()).error).toContain(CODIGO_INVALIDO);
    expect(r1.headers.get("Retry-After")).toBe("900");
    // O total lê-se sem contar (d2, 23-11-2026): cheio, trava.
    estado.limite = { ip: true, total: true };
    estado.contador = 100;
    const r2 = await POST(pedido("/api/colaboradores/codigo", { codigo: CODIGO }));
    expect(r2.status).toBe(429);
    expect(estado.chaves).toContain("colaborador-codigo-ip:203.0.113.9");
    // Travado não chega a procurar a conta.
    expect(estado.indicePedido).toBeNull();
  });

  it("d2: o total só conta as erradas — uma entrada certa não o faz subir", async () => {
    const { POST } = await import("@/app/api/colaboradores/codigo/route");
    estado.conta = {
      id: 3,
      nome: "DONO",
      isAdmin: 1,
      funcao: "admin",
      active: 1,
      codigoHash: await hashDoCodigo(CODIGO),
    };
    const certa = await POST(pedido("/api/colaboradores/codigo", { codigo: CODIGO }));
    expect(certa.status).toBe(200);
    expect(estado.chaves).not.toContain("colaborador-codigo-total");
    estado.conta = undefined;
    const errada = await POST(pedido("/api/colaboradores/codigo", { codigo: "Outro codigo 1234 #x" }));
    expect(errada.status).toBe(401);
    expect(estado.chaves).toContain("colaborador-codigo-total");
  }, 30000);

  it("d2: a máquina que já entrou passa com o travão total cheio; uma nova não", async () => {
    const { POST } = await import("@/app/api/colaboradores/codigo/route");
    const { COOKIE_DA_MAQUINA, valorDaMaquina } = await import("./maquina-conhecida");
    estado.conta = {
      id: 3,
      nome: "DONO",
      isAdmin: 1,
      funcao: "admin",
      active: 1,
      codigoHash: await hashDoCodigo(CODIGO),
    };
    estado.contador = 100;
    const nova = await POST(pedido("/api/colaboradores/codigo", { codigo: CODIGO }));
    expect(nova.status).toBe(429);
    const conhecida = new NextRequest(new URL("/api/colaboradores/codigo", "https://clyon.pt"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "vitest",
        cookie: `${COOKIE_DA_MAQUINA}=${valorDaMaquina(process.env.JWT_SECRET!)}`,
      },
      body: JSON.stringify({ codigo: CODIGO }),
    });
    const r = await POST(conhecida);
    expect(r.status).toBe(200);
    // Um cookie forjado não vale.
    const forjada = new NextRequest(new URL("/api/colaboradores/codigo", "https://clyon.pt"), {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `${COOKIE_DA_MAQUINA}=9999999999.abc` },
      body: JSON.stringify({ codigo: CODIGO }),
    });
    expect((await POST(forjada)).status).toBe(429);
  }, 30000);
});

describe("a palavra-passe deixa de servir quando a conta tem código", () => {
  it("o utilizador e a palavra-passe certos são recusados como errados", async () => {
    estado.colaborador = {
      id: 7,
      nome: "ANA",
      senha: await bcrypt.hash("palavra1", 4),
      isAdmin: 0,
      funcao: "assistente",
      active: 1,
    };
    const { POST } = await import("@/app/api/colaboradores/login/route");
    estado.temCodigo = false;
    const antes = await POST(pedido("/api/colaboradores/login", { nome: "ana", senha: "palavra1" }));
    expect(antes.status).toBe(200);
    estado.temCodigo = true;
    const depois = await POST(pedido("/api/colaboradores/login", { nome: "ana", senha: "palavra1" }));
    expect(depois.status).toBe(401);
    expect((await depois.json()).token).toBeUndefined();
  }, 20000);
});

describe("só o administrador cria e troca códigos", () => {
  it("quem não é administrador recebe 403 e nada se grava", async () => {
    estado.auth = "negado";
    const { POST } = await import("@/app/api/admin/assistentes/route");
    const r = await POST(pedido("/api/admin/assistentes", { codigoDeEntrada: { id: 2, gerar: true } }));
    expect(r.status).toBe(403);
    expect(estado.definidos).toHaveLength(0);
  });

  it("a rota é requireAdminGeral, e o ramo do código vem depois da tranca", () => {
    const ROTA = lerNu("src/app/api/admin/assistentes/route.ts");
    const post = ROTA.slice(ROTA.indexOf("export async function POST"));
    expect(post.indexOf("requireAdminGeral(req)")).toBeGreaterThan(-1);
    expect(post.indexOf("requireAdminGeral(req)")).toBeLessThan(post.indexOf("corpo.codigoDeEntrada"));
  });

  it("a regra valida-se no servidor: um código fraco escrito à mão é recusado", async () => {
    const { POST } = await import("@/app/api/admin/assistentes/route");
    const r = await POST(pedido("/api/admin/assistentes", { codigoDeEntrada: { id: 2, codigo: "fraco" } }));
    expect(r.status).toBe(400);
    expect(estado.definidos).toHaveLength(0);
  });

  it("escrito à mão, a resposta não o devolve; gerado, aparece uma vez", async () => {
    const { POST } = await import("@/app/api/admin/assistentes/route");
    const r1 = await POST(pedido("/api/admin/assistentes", { codigoDeEntrada: { id: 2, codigo: CODIGO } }));
    expect(r1.status).toBe(200);
    expect(JSON.stringify(await r1.json())).not.toContain(CODIGO);
    expect(estado.definidos[0]).toMatchObject({ contaId: 2, codigo: CODIGO, segredo: SEGREDO, por: { id: 1, nome: "DONO" } });

    const r2 = await POST(pedido("/api/admin/assistentes", { codigoDeEntrada: { id: 2, gerar: true } }));
    const corpo2 = await r2.json();
    expect(erroDoCodigo(corpo2.codigoGerado)).toBeNull();
    expect(corpo2.codigoGerado).toBe(estado.definidos[1].codigo);
    // A conta de outra pessoa: sem sessão nova.
    expect(corpo2.sessaoNova).toBeUndefined();
    expect(registos.join("\n")).not.toContain(CODIGO);
    expect(registos.join("\n")).not.toContain(corpo2.codigoGerado);
  });

  it("o administrador que troca o próprio código fica com uma sessão nova", async () => {
    const { POST } = await import("@/app/api/admin/assistentes/route");
    const r = await POST(pedido("/api/admin/assistentes", { codigoDeEntrada: { id: 1, gerar: true } }));
    const corpo = await r.json();
    expect(typeof corpo.sessaoNova).toBe("string");
    expect(r.headers.get("set-cookie") ?? "").toContain("clyon_admin=");
  });
});

describe("trocar o código fecha as sessões, e nada guarda o código", () => {
  it("a gravação escreve senhaAlteradaEm — a mesma tranca da troca de palavra-passe", () => {
    const BASE = lerNu("src/lib/codigo-de-entrada-na-base.ts");
    expect(BASE).toMatch(/SET codigoIndice = \?, codigoHash = \?, codigoMudadoEm = \?, senhaAlteradaEm = \?/);
    expect(BASE).toContain("garantirColunaDaTrocaDeSenha()");
  });

  it("um token de antes da troca deixa de valer", () => {
    const troca = new Date("2026-11-20T12:00:00Z");
    const antes = Math.floor(troca.getTime() / 1000) - 60;
    expect(tokenAnteriorATrocaDeSenha(troca, antes)).toBe(true);
    expect(
      motivoParaRecusarSessao({ isAdmin: 0, funcao: "assistente", active: 1, senhaAlteradaEm: troca }, "assistente", antes),
    ).toMatch(/Inicie sessão novamente/);
  });

  it("os repetidos conferem-se antes de gravar, e o índice é único na tabela", () => {
    const BASE = lerNu("src/lib/codigo-de-entrada-na-base.ts");
    const conferir = BASE.indexOf("WHERE codigoIndice = ? AND id <> ?");
    const gravar = BASE.indexOf("SET codigoIndice = ?");
    expect(conferir).toBeGreaterThan(-1);
    expect(conferir).toBeLessThan(gravar);
    expect(BASE).toContain("ADD UNIQUE KEY uq_codigo_indice (codigoIndice)");
    expect(BASE).toContain('"ER_DUP_ENTRY"');
  });

  it("o registo e a lista não levam o código, nem o índice, nem o hash", () => {
    const BASE = lerNu("src/lib/codigo-de-entrada-na-base.ts");
    const insercao = BASE.slice(BASE.indexOf("INSERT INTO codigosDeEntradaRegisto"));
    expect(insercao.slice(0, insercao.indexOf("VALUES"))).not.toMatch(/codigo(Indice|Hash)?[,)]/);
    const lista = BASE.slice(BASE.indexOf("export async function contasParaOsCodigos"));
    const select = lista.slice(0, lista.indexOf("FROM colaboradores"));
    expect(select).not.toMatch(/codigoHash\s*,|codigoIndice/);
    expect(select).toContain("codigoHash IS NOT NULL AS temCodigo");
  });

  it("desactivar uma assistente anula o código dela", () => {
    const ROTA = lerNu("src/app/api/admin/assistentes/route.ts");
    expect(ROTA).toMatch(/if \(!corpo\.activo\) await anularCodigoDaConta\(id/);
  });
});

describe("o ecrã de entrada", () => {
  it("pede só o código, e a palavra «senha» não aparece", () => {
    const PAGINA = lerNu("src/app/admin/login/page.tsx");
    expect(PAGINA).toContain("Código para entrar");
    expect(PAGINA).toContain("Ainda não tem código? Entrar com utilizador");
    // Só o nome do campo que a API antiga espera; nada à vista.
    expect(PAGINA.replace("senha: palavra", "").toLowerCase()).not.toContain("senha");
  });

  it("a ligação para o utilizador depende do servidor dizer que ainda há contas sem código", () => {
    const PAGINA = lerNu("src/app/admin/login/page.tsx");
    expect(PAGINA).toContain('fetch("/api/colaboradores/codigo", { cache: "no-store" })');
    expect(PAGINA).toContain("d?.porUtilizador === true");
    expect(PAGINA).toContain("(ligacaoVisivel || porUtilizador) &&");
  });
});
