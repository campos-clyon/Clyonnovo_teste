import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { DEPOIS_DO_MODELO, comORelogioEm } from "./relogio-dos-testes";

/**
 * AS FOTOGRAFIAS DO WHATSAPP ENTRAM SEMPRE NO PEDIDO CERTO — d98 (23-11-2026).
 *
 * A base finge-se aqui com o que interessa: os pedidos (com o `filesJson`
 * juntado pela própria instrução, como o `JSON_MERGE_PRESERVE` faz), as
 * fotografias à espera e a tranca do `FOR UPDATE`. Cada instrução demora um
 * instante, para quatro fotografias da mesma rajada se cruzarem de facto.
 * Sem dados de pessoas: o telefone é o de exemplo do repositório.
 */

const TELEFONE = "351912345678";

type Pedido = {
  id: number;
  contactPhone: string;
  status: string | null;
  createdAt: Date;
  filesJson: string | null;
};
type Pendente = { id: number; telefone: string; url: string; nome: string; tamanho: number; tipo: string; criadoEm: Date };

const base = vi.hoisted(() => ({
  pedidos: [] as Pedido[],
  pendentes: [] as Pendente[],
  trancas: new Map<string, Promise<void>>(),
  conversa: null as null | {
    passo: string;
    dados: Record<string, unknown>;
    pedidoId: number | null;
    actualizadoEm: Date;
  },
  interrompido: false,
  bloqueado: false,
  naoContactar: false,
  enviadas: [] as Array<{ telefone: string; texto: string }>,
  blobs: 0,
}));

vi.mock("mysql2/promise", () => {
  const instante = () => new Promise<void>((r) => setTimeout(r, 1 + Math.floor(Math.random() * 3)));
  const ultimos9 = (s: unknown) => String(s ?? "").replace(/\D/g, "").slice(-9);
  const fechados = ["cancelado", "concluido", "arquivado"];

  async function instrucao(sql: string, params: unknown[], prender?: (chave: string) => Promise<void>) {
    await instante();
    // Os pedidos abertos de um número (pedidosDoTelefone e a recuperação).
    if (/SELECT id FROM simulatorOrders\s+WHERE RIGHT\(REGEXP_REPLACE/.test(sql)) {
      const dias = /INTERVAL (\d+) DAY/.exec(sql)?.[1];
      const desde = dias ? Date.now() - Number(dias) * 24 * 3600_000 : -Infinity;
      const linhas = base.pedidos
        .filter((p) => ultimos9(p.contactPhone) === String(params[0]))
        .filter((p) => p.status == null || !fechados.includes(p.status))
        .filter((p) => p.createdAt.getTime() > desde)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((p) => ({ id: p.id }));
      return [/LIMIT 1\b/.test(sql) ? linhas.slice(0, 1) : linhas, []];
    }
    if (/INSERT INTO whatsappFotosPendentes/.test(sql)) {
      const id = base.pendentes.reduce((m, p) => Math.max(m, p.id), 0) + 1;
      const [telefone, url, nome, tamanho, tipo] = params as [string, string, string, number, string];
      base.pendentes.push({ id, telefone, url, nome, tamanho, tipo, criadoEm: new Date() });
      return [{ insertId: id, affectedRows: 1 }, []];
    }
    const janela = (s: string) => {
      const h = /INTERVAL (\d+) HOUR/.exec(s)?.[1];
      return h ? Date.now() - Number(h) * 3600_000 : -Infinity;
    };
    if (/SELECT COUNT\(\*\) AS n FROM whatsappFotosPendentes/.test(sql)) {
      const n = base.pendentes.filter((p) => ultimos9(p.telefone) === ultimos9(params[0]) && p.criadoEm.getTime() > janela(sql)).length;
      return [[{ n }], []];
    }
    if (/SELECT RIGHT\(telefone, 9\) AS tel, COUNT\(\*\) AS n FROM whatsappFotosPendentes/.test(sql)) {
      const grupos = new Map<string, number>();
      for (const p of base.pendentes.filter((x) => x.criadoEm.getTime() > janela(sql))) {
        grupos.set(ultimos9(p.telefone), (grupos.get(ultimos9(p.telefone)) ?? 0) + 1);
      }
      return [[...grupos].map(([tel, n]) => ({ tel, n })), []];
    }
    if (/SELECT id, url, nome, tamanho, tipo FROM whatsappFotosPendentes/.test(sql)) {
      if (/FOR UPDATE/.test(sql) && prender) await prender(`pendentes-${ultimos9(params[0])}`);
      return [
        base.pendentes
          .filter((p) => ultimos9(p.telefone) === ultimos9(params[0]) && p.criadoEm.getTime() > janela(sql))
          .map((p) => ({ ...p })),
        [],
      ];
    }
    if (/DELETE FROM whatsappFotosPendentes WHERE id IN/.test(sql)) {
      const ids = new Set(params.map(Number));
      base.pendentes = base.pendentes.filter((p) => !ids.has(p.id));
      return [{ affectedRows: ids.size }, []];
    }
    // A junção na própria base: a lista de lá seguida das novas, numa só instrução.
    if (/UPDATE simulatorOrders\s+SET filesJson = JSON_MERGE_PRESERVE\(/.test(sql)) {
      const p = base.pedidos.find((x) => x.id === Number(params[1]));
      if (!p) return [{ affectedRows: 0 }, []];
      let lista: unknown[] = [];
      try {
        const lido = JSON.parse(p.filesJson ?? "null");
        if (Array.isArray(lido)) lista = lido;
      } catch {
        /* ilegível: recomeça */
      }
      p.filesJson = JSON.stringify([...lista, ...(JSON.parse(String(params[0])) as unknown[])]);
      return [{ affectedRows: 1 }, []];
    }
    // O ler-alterar-gravar antigo (se voltasse) gravava a lista inteira por cima.
    if (/UPDATE simulatorOrders SET .*filesJson = \?/.test(sql)) {
      const p = base.pedidos.find((x) => x.id === Number(params.at(-1)));
      if (p) p.filesJson = String(params[0]);
      return [{ affectedRows: p ? 1 : 0 }, []];
    }
    if (/^\s*UPDATE|^\s*INSERT|^\s*DELETE|^\s*ALTER|^\s*CREATE/i.test(sql)) return [{ affectedRows: 0 }, []];
    return [[], []];
  }

  function ligacao() {
    let soltar: (() => void) | null = null;
    const largar = () => {
      soltar?.();
      soltar = null;
    };
    return {
      beginTransaction: async () => {},
      commit: async () => largar(),
      rollback: async () => largar(),
      release: () => largar(),
      execute: (sql: string, params: unknown[] = []) =>
        instrucao(sql, params, async (chave) => {
          const antes = base.trancas.get(chave) ?? Promise.resolve();
          let abrir!: () => void;
          const minha = new Promise<void>((r) => (abrir = r));
          base.trancas.set(chave, antes.then(() => minha));
          await antes;
          soltar = abrir;
        }),
    };
  }

  const pool = {
    query: async () => [[], []],
    execute: (sql: string, params: unknown[] = []) => instrucao(sql, params),
    getConnection: async () => ligacao(),
    on: () => {},
  };
  return { default: { createPool: () => pool, createConnection: () => undefined } };
});

vi.mock("drizzle-orm/mysql2", () => ({ drizzle: vi.fn(() => ({})) }));

// O que a decisão lê da conversa e do número (o resto é a base fingida acima).
vi.mock("@/lib/db", async (original) => {
  const real = await original<typeof import("./db")>();
  const doPedido = (id: number) => {
    const p = base.pedidos.find((x) => x.id === id);
    return p ? { ...p, createdAt: p.createdAt.toISOString() } : undefined;
  };
  return {
    ...real,
    whatsappLigado: vi.fn(async () => true),
    numeroBloqueadoWhatsApp: vi.fn(async () => base.bloqueado),
    podeOWhatsAppFalarCom: vi.fn(async () => !base.bloqueado && !base.interrompido),
    recolhaWhatsApp: vi.fn(async () => base.conversa),
    mensagensDoNumeroWhatsApp: vi.fn(async () => []),
    getSimulatorOrderById: vi.fn(async (id: number) => doPedido(id)),
    appendOrderHistory: vi.fn(async () => {}),
  };
});
vi.mock("@/lib/nao-contactar", () => ({ eParaNaoContactar: vi.fn(async () => base.naoContactar) }));
vi.mock("@vercel/blob", () => ({
  put: vi.fn(async (caminho: string) => ({ url: `https://exemplo.test/${caminho}-${++base.blobs}` })),
}));
vi.mock("@/lib/blob-token", () => ({ obterTokenDoBlob: () => ({ ok: true, modo: "token", token: "t" }) }));
vi.mock("@/lib/whatsapp-cloud", async (original) => ({
  ...(await original<typeof import("./whatsapp-cloud")>()),
  enviarTextoWhatsApp: vi.fn(async (telefone: string, texto: string) => {
    base.enviadas.push({ telefone, texto });
    return true;
  }),
}));
vi.mock("@/lib/admin-auth-helper", async () => {
  const { NextResponse } = await import("next/server");
  return {
    requireAdmin: vi.fn(async (req: Request) =>
      req.headers.get("authorization")
        ? { err: null, colab: { id: 1, nome: "a equipa", isAdmin: true, papel: "admin" } }
        : { err: NextResponse.json({ error: "Não autorizado" }, { status: 401 }), colab: null },
    ),
  };
});

let neg: typeof import("./whatsapp-negociacao");
let db: typeof import("./db");
let rota: typeof import("@/app/api/admin/fotografias-do-whatsapp/route");
beforeAll(async () => {
  process.env.DATABASE_URL = "mysql://quem:segredo@localhost:3306/clyon";
  db = await import("./db");
  neg = await import("./whatsapp-negociacao");
  rota = await import("@/app/api/admin/fotografias-do-whatsapp/route");
  // Aquece os imports dinâmicos e as tabelas (a suite inteira corre em paralelo e o primeiro teste passava dos 5 s).
  await neg.guardarFotoDoClienteNoPedido("351910000000", Buffer.from("aquecer"), "image/jpeg");
  await db.anexarFotosPendentesAoPedido("351910000000", 1);
}, 120_000);
vi.setConfig({ testTimeout: 60_000 });
// O dia do modelo de 15-11 (a rota de recuperação lê a base que lê o modelo — guarda d29).
comORelogioEm(DEPOIS_DO_MODELO);

const HORA = 3600_000;
beforeEach(() => {
  base.pedidos = [];
  base.pendentes = [];
  base.trancas.clear();
  base.conversa = null;
  base.interrompido = false;
  base.bloqueado = false;
  base.naoContactar = false;
  base.enviadas = [];
});

const foto = () => Buffer.from("uma fotografia de exemplo");
const fotosDe = (id: number) => JSON.parse(base.pedidos.find((p) => p.id === id)!.filesJson ?? "[]") as unknown[];
const pedido = (id: number, mais: Partial<Pedido> = {}): Pedido => ({
  id,
  contactPhone: "912 345 678",
  status: "pendente",
  createdAt: new Date(Date.now() - 2 * HORA),
  filesJson: null,
  ...mais,
});
const aMeioDaRecolha = (dados: Record<string, unknown> = {}) => ({
  passo: "morada",
  dados: { serviceType: "recolha_moveis", ...dados },
  pedidoId: null,
  actualizadoEm: new Date(Date.now() - 10 * 60_000),
});

describe("d98 (a) — a fotografia vai para o pedido que existe", () => {
  it("recolha a meio + pedido aberto sem propostas: a fotografia entra no pedido, não fica à espera", async () => {
    base.pedidos = [pedido(701)];
    base.conversa = aMeioDaRecolha();
    await neg.guardarFotoDoClienteNoPedido(TELEFONE, foto(), "image/jpeg");
    expect(fotosDe(701)).toHaveLength(1);
    expect(base.pendentes).toHaveLength(0);
  });

  it("recolha a meio sem nenhum pedido aberto: fica à espera (e o pedido fechado não a recebe)", async () => {
    base.pedidos = [pedido(690, { status: "concluido" })];
    base.conversa = aMeioDaRecolha();
    await neg.guardarFotoDoClienteNoPedido(TELEFONE, foto(), "image/jpeg");
    expect(base.pendentes).toHaveLength(1);
    expect(fotosDe(690)).toHaveLength(0);
  });

  it("um pedido «aberto» de há meses não conta como o pedido desta recolha: fica à espera", async () => {
    base.pedidos = [pedido(600, { createdAt: new Date(Date.now() - 90 * 24 * HORA) })];
    base.conversa = aMeioDaRecolha();
    await neg.guardarFotoDoClienteNoPedido(TELEFONE, foto(), "image/jpeg");
    expect(base.pendentes).toHaveLength(1);
    expect(fotosDe(600)).toHaveLength(0);
  });

  it("quem trocou de sítio (d51) ou está a escolher o pedido: espera pelo pedido certo", async () => {
    base.pedidos = [pedido(701)];
    base.conversa = aMeioDaRecolha({ trocouDoPedido: 701 });
    await neg.guardarFotoDoClienteNoPedido(TELEFONE, foto(), "image/jpeg");
    base.conversa = aMeioDaRecolha({ pedidosAEscolher: [701, 702] });
    await neg.guardarFotoDoClienteNoPedido(TELEFONE, foto(), "image/jpeg");
    expect(fotosDe(701)).toHaveLength(0);
    expect(base.pendentes).toHaveLength(2);
  });
});

describe("d98 (d) — número entregue à equipa: guarda, e não diz nada", () => {
  it("interrompido: a fotografia entra no pedido, sem mensagem ao cliente", async () => {
    base.pedidos = [pedido(701)];
    base.interrompido = true;
    await neg.guardarFotoDoClienteNoPedido(TELEFONE, foto(), "image/jpeg", { semResposta: true });
    expect(fotosDe(701)).toHaveLength(1);
    expect(base.enviadas).toHaveLength(0);
  });

  it("e o mesmo pelo portão, sem a opção: interrompido não fala", async () => {
    base.pedidos = [pedido(701)];
    base.interrompido = true;
    await neg.guardarFotoDoClienteNoPedido(TELEFONE, foto(), "image/jpeg");
    expect(fotosDe(701)).toHaveLength(1);
    expect(base.enviadas).toHaveLength(0);
  });

  it("bloqueado ou «não contactar» (d93): não se guarda nada", async () => {
    base.pedidos = [pedido(701)];
    base.bloqueado = true;
    await neg.guardarFotoDoClienteNoPedido(TELEFONE, foto(), "image/jpeg");
    base.bloqueado = false;
    base.naoContactar = true;
    await neg.guardarFotoDoClienteNoPedido(TELEFONE, foto(), "image/jpeg");
    expect(fotosDe(701)).toHaveLength(0);
    expect(base.pendentes).toHaveLength(0);
    expect(base.blobs).toBeGreaterThanOrEqual(0);
  });

  it("a ponte guarda a fotografia do número interrompido, sem resposta", () => {
    const ponte = readFileSync("src/app/api/whatsapp/ponte/route.ts", "utf8").replace(/\r\n/g, "\n");
    const i = ponte.indexOf("if (await numeroInterrompidoWhatsApp(telefone)) {");
    expect(i).toBeGreaterThan(-1);
    const ramo = ponte.slice(i, ponte.indexOf("return NextResponse.json({ meu: true, paraEnviar: [] });", i));
    expect(ramo).toMatch(/guardarFotoDoClienteNoPedido\(telefone, Buffer\.from\(fotoBase64, "base64"\), fotoMime, \{\s*semResposta: true,?\s*\}\)/);
  });
});

describe("d98 (e) — o filesJson cresce na própria base", () => {
  it("quatro fotografias da mesma rajada, em paralelo: as quatro ficam no pedido", async () => {
    for (let vez = 0; vez < 5; vez++) {
      base.pedidos = [pedido(701, { filesJson: JSON.stringify([{ url: "https://exemplo.test/ja-la.jpg" }]) })];
      await Promise.all([1, 2, 3, 4].map(() => neg.guardarFotoDoClienteNoPedido(TELEFONE, foto(), "image/jpeg")));
      expect(fotosDe(701)).toHaveLength(5);
    }
  });

  it("duas junções das pendentes ao mesmo tempo: cada fotografia entra uma vez", async () => {
    base.pedidos = [pedido(701, { filesJson: "ilegível" })];
    for (let i = 0; i < 3; i++) await db.guardarFotoPendenteWhatsApp(TELEFONE, { url: `https://exemplo.test/${i}.jpg`, name: `${i}.jpg`, size: 1, type: "image/jpeg" });
    const [a, b] = await Promise.all([db.anexarFotosPendentesAoPedido(TELEFONE, 701), db.anexarFotosPendentesAoPedido(TELEFONE, 701)]);
    expect(a + b).toBe(3);
    expect(fotosDe(701)).toHaveLength(3);
    expect(base.pendentes).toHaveLength(0);
  });

  it("o SQL junta com JSON_MERGE_PRESERVE e recomeça a lista ilegível", () => {
    expect(db.SQL_DE_JUNTAR_FICHEIROS_AO_PEDIDO).toContain("JSON_MERGE_PRESERVE(");
    expect(db.SQL_DE_JUNTAR_FICHEIROS_AO_PEDIDO).toContain("CASE WHEN JSON_VALID(filesJson)");
    expect(db.SQL_DE_JUNTAR_FICHEIROS_AO_PEDIDO).toContain("ELSE JSON_ARRAY() END");
  });
});

describe("d98 (b) — o pedido feito no site e na página inicial vai buscar as fotografias", () => {
  const codigo = (caminho: string) =>
    readFileSync(caminho, "utf8").replace(/\r\n/g, "\n").replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "");

  it("o simulador junta-as depois de criar o pedido e antes do envio aos parceiros", () => {
    const s = codigo("src/app/api/simulador/pedido/route.ts");
    const criar = s.indexOf("await createSimulatorOrder(row)");
    const juntar = s.indexOf("anexarFotosPendentesAoPedido(row.contactPhone, id)");
    const envio = s.indexOf("enviarAosEscolhidos(");
    expect(criar).toBeGreaterThan(-1);
    expect(juntar).toBeGreaterThan(criar);
    expect(envio === -1 || juntar < envio).toBe(true);
  });

  it("o formulário da página inicial também, antes de o pedido seguir", () => {
    const s = codigo("src/app/api/hero-quote/route.ts");
    const criar = s.indexOf("await createSimulatorOrder(row)");
    const juntar = s.indexOf("anexarFotosPendentesAoPedido(telefoneFull, orderId)");
    const seguir = s.indexOf("seguirOPedidoNovo(");
    expect(criar).toBeGreaterThan(-1);
    expect(juntar).toBeGreaterThan(criar);
    expect(seguir).toBeGreaterThan(juntar);
  });
});

describe("d98 (c) — a janela das pendentes é a do rascunho", () => {
  it("a janela de junção vale pelo menos o rascunho (7 dias), da mesma constante", async () => {
    const { HORAS_DO_RASCUNHO } = await import("./conversa-parada-a-meio");
    expect(db.HORAS_DAS_FOTOS_PENDENTES).toBeGreaterThanOrEqual(HORAS_DO_RASCUNHO);
    expect(db.HORAS_DAS_FOTOS_PENDENTES).toBe(168);
  });

  it("uma fotografia de há 3 dias ainda entra no pedido que nasce agora", async () => {
    base.pedidos = [pedido(701)];
    await db.guardarFotoPendenteWhatsApp(TELEFONE, { url: "https://exemplo.test/a.jpg", name: "a.jpg", size: 1, type: "image/jpeg" });
    base.pendentes[0].criadoEm = new Date(Date.now() - 72 * HORA);
    expect(await db.anexarFotosPendentesAoPedido(TELEFONE, 701)).toBe(1);
    expect(fotosDe(701)).toHaveLength(1);
  });
});

describe("d98 (g) — a recuperação pelo backoffice", () => {
  const pedir = (metodo: "GET" | "POST", corpo?: unknown, comToken = true) =>
    new NextRequest("https://clyon.pt/api/admin/fotografias-do-whatsapp", {
      method: metodo,
      headers: { "content-type": "application/json", ...(comToken ? { authorization: "Bearer x" } : {}) },
      ...(corpo ? { body: JSON.stringify(corpo) } : {}),
    });

  it("sem token, 401", async () => {
    expect((await rota.GET(pedir("GET", undefined, false))).status).toBe(401);
    expect((await rota.POST(pedir("POST", { confirmacao: "JUNTAR" }, false))).status).toBe(401);
  });

  it("GET conta só números; POST sem «JUNTAR» recusa; com ele junta ao pedido aberto recente", async () => {
    base.pedidos = [pedido(701), pedido(650, { contactPhone: "910 000 123", createdAt: new Date(Date.now() - 20 * 24 * HORA) })];
    for (const t of [TELEFONE, TELEFONE, "351910000123"]) {
      await db.guardarFotoPendenteWhatsApp(t, { url: "https://exemplo.test/x.jpg", name: "x.jpg", size: 1, type: "image/jpeg" });
    }
    const contado = await (await rota.GET(pedir("GET"))).json();
    expect(contado).toEqual({ pedidos: 1, fotografias: 2, porPedido: [{ pedido: 701, fotografias: 2 }] });
    expect(JSON.stringify(contado)).not.toMatch(/912|910|345|678/);

    expect((await rota.POST(pedir("POST", { confirmacao: "sim" }))).status).toBe(400);
    const feito = await (await rota.POST(pedir("POST", { confirmacao: "JUNTAR" }))).json();
    expect(feito).toMatchObject({ ok: true, juntas: 2, pedidos: 1 });
    expect(fotosDe(701)).toHaveLength(2);
    // O pedido de há 20 dias fica de fora (fora dos 7 dias): as dele continuam à espera.
    expect(base.pendentes).toHaveLength(1);
  });
});
