import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { avisoDeCancelamentoAoProfissional, avisoDeValorNovoAoProfissional } from "./aviso-de-oferta-clyon";

/**
 * MUDAR O VALOR DE UM TRABALHO CLYON, E CANCELÁ-LO — 08-10-2026.
 *
 * *«Nos Trabalhos CLYON deve ser possível mudar os valores e até cancelar o
 * pedido. Caso o valor seja alterado, mesmo que os pros já tenham aceitado,
 * ele deve aparecer novamente com o valor actualizado para aceitar.»*
 *
 * Decidido com o dono: o escolhido fica com o trabalho à espera de que aceite
 * o valor novo — se recusar, volta aos outros; cancelar avisa todos.
 *
 * A base finge-se aqui: o que se verifica é o que a transacção escreve.
 */

const base = vi.hoisted(() => ({
  pedido: null as null | Record<string, unknown>,
  negs: [] as Array<Record<string, unknown>>,
  propostasJson: "[]" as string,
  escritas: [] as Array<{ sql: string; params: unknown[] }>,
  commits: 0,
  rollbacks: 0,
}));

vi.mock("mysql2/promise", () => {
  const conn = {
    beginTransaction: vi.fn(async () => {}),
    commit: vi.fn(async () => {
      base.commits += 1;
    }),
    rollback: vi.fn(async () => {
      base.rollbacks += 1;
    }),
    release: vi.fn(),
    execute: vi.fn(async (sql: string, params: unknown[] = []) => {
      if (/FROM simulatorOrders WHERE id = \? FOR UPDATE/.test(sql)) return [base.pedido ? [base.pedido] : [], []];
      if (/FROM negociacoes n/.test(sql)) return [base.negs, []];
      if (/SELECT propostasJson FROM negociacoes WHERE id = \? FOR UPDATE/.test(sql)) {
        return [[{ propostasJson: base.propostasJson }], []];
      }
      if (/^\s*UPDATE/.test(sql)) {
        base.escritas.push({ sql, params });
        return [{ affectedRows: 1 }, []];
      }
      return [[], []];
    }),
  };
  const pool = {
    query: vi.fn(async () => [[], []]),
    execute: vi.fn(async () => [[], []]),
    getConnection: vi.fn(async () => conn),
  };
  return { default: { createPool: vi.fn(() => pool), createConnection: vi.fn() } };
});

vi.mock("drizzle-orm/mysql2", () => ({ drizzle: vi.fn(() => ({})) }));

let db: typeof import("./db");
beforeAll(async () => {
  process.env.DATABASE_URL = "mysql://quem:segredo@localhost:3306/clyon";
  db = await import("./db");
}, 120_000);

beforeEach(() => {
  base.pedido = { id: 420, status: "atribuido", valorFixoClyon: "260.00", taxaClyon: null };
  base.negs = [];
  base.propostasJson = "[]";
  base.escritas = [];
  base.commits = 0;
  base.rollbacks = 0;
});

const neg = (id: number, estado: string, extra: Record<string, unknown> = {}) => ({
  id,
  providerId: id * 10,
  estado,
  ofertaClyon: "distribuida",
  execucaoEnviadaEm: null,
  confirmadoEm: null,
  estadoAntesDeCancelar: null,
  profissional: `PRO${id}`,
  telefone: `91000000${id}`,
  whatsappAvisos: 1,
  ...extra,
});

/** As escritas nas negociações, por id. */
const escritasNas = () =>
  base.escritas
    .filter((e) => /UPDATE negociacoes/.test(e.sql))
    .map((e) => ({ id: e.params[e.params.length - 1], params: e.params }));

describe("mudar o valor ou a taxa", () => {
  it("quem o tinha por responder ou aceite volta a «aberta», com o valor e a taxa novos", async () => {
    base.negs = [neg(1, "aberta"), neg(2, "aguarda_contratacao"), neg(3, "desistida"), neg(4, "morta")];
    const r = await db.mudarValorDoTrabalhoClyon(420, 350, 0.2);

    expect(r).toMatchObject({ ok: true, antes: { valor: 260, taxa: null } });
    if (!r.ok) return;
    expect(r.avisar.map((q) => [q.negociacaoId, q.eraDele])).toEqual([
      [1, false],
      [2, false],
    ]);
    const pedido = base.escritas.find((e) => /UPDATE simulatorOrders/.test(e.sql))!;
    expect(pedido.params).toEqual([350, 0.2, 350, 350, 420]);
    const negs = escritasNas();
    expect(negs.map((n) => n.id)).toEqual([1, 2]);
    // [propostas, taxa, modo, id]
    expect(negs[0].params[1]).toBe(0.2);
    expect(JSON.parse(String(negs[0].params[0]))).toMatchObject([{ por: "cliente", valor: 350, estado: "pendente" }]);
    expect(base.commits).toBe(1);
  });

  it("o escolhido fica com ele à espera do «aceito» — a pergunta passa a ser só a ele", async () => {
    base.negs = [neg(1, "acordada"), neg(2, "morta"), neg(3, "desistida")];
    const r = await db.mudarValorDoTrabalhoClyon(420, 350, 0.15);
    if (!r.ok) throw new Error("devia ter mudado");
    expect(r.avisar).toEqual([expect.objectContaining({ negociacaoId: 1, eraDele: true })]);
    const [n] = escritasNas();
    expect(n.id).toBe(1);
    expect(n.params[2]).toBe("directa");
    expect(base.escritas.find((e) => /UPDATE negociacoes/.test(e.sql))!.sql).toMatch(/atribuidaEm = NULL/);
  });

  it("sem ninguém com a pergunta feita, o valor novo volta a quem recusou e a quem ficou de fora", async () => {
    base.negs = [
      neg(1, "desistida"),
      neg(2, "morta"),
      neg(3, "morta", { estadoAntesDeCancelar: "aberta" }), // morta por um cancelamento: não conta
    ];
    const r = await db.mudarValorDoTrabalhoClyon(420, 400, 0.2);
    if (!r.ok) throw new Error("devia ter mudado");
    expect(r.avisar.map((q) => q.negociacaoId)).toEqual([1, 2]);
  });

  it("um trabalho já feito não se muda", async () => {
    base.negs = [neg(1, "acordada", { execucaoEnviadaEm: new Date() })];
    expect(await db.mudarValorDoTrabalhoClyon(420, 350, 0.2)).toEqual({ ok: false, porque: "ja_feito" });
    expect(base.escritas).toEqual([]);
    expect(base.rollbacks).toBe(1);
  });

  it("nem um pedido cancelado, nem um que não seja Trabalho CLYON", async () => {
    base.pedido = { id: 420, status: "cancelado", valorFixoClyon: "260.00", taxaClyon: null };
    expect(await db.mudarValorDoTrabalhoClyon(420, 350, 0.2)).toEqual({ ok: false, porque: "arrumado" });
    base.pedido = { id: 420, status: "atribuido", valorFixoClyon: null, taxaClyon: null };
    expect(await db.mudarValorDoTrabalhoClyon(420, 350, 0.2)).toEqual({ ok: false, porque: "nao_e_clyon" });
    expect(base.escritas).toEqual([]);
  });
});

/*
 * O MESMO VALOR E A MESMA TAXA não são uma mudança: gravá-los outra vez
 * tirava o trabalho a quem o tem e mandava-lhe mensagens por nada.
 */
describe("gravar sem mudar nada", () => {
  it("não mexe em nenhuma negociação, nem avisa ninguém", async () => {
    base.pedido = { id: 420, status: "atribuido", valorFixoClyon: "350.00", taxaClyon: "0.2000" };
    base.negs = [neg(1, "acordada")];
    expect(await db.mudarValorDoTrabalhoClyon(420, 350, 0.2)).toEqual({ ok: false, porque: "igual" });
    expect(base.escritas).toEqual([]);
  });

  it("mudar só a taxa já é mudar", async () => {
    base.pedido = { id: 420, status: "atribuido", valorFixoClyon: "350.00", taxaClyon: "0.2000" };
    base.negs = [neg(1, "acordada")];
    const r = await db.mudarValorDoTrabalhoClyon(420, 350, 0.15);
    expect(r.ok).toBe(true);
  });
});

/*
 * ACEITAR UM VALOR QUE NUNCA VIU — um ecrã aberto há uma hora mostra 350 €,
 * e a CLYON já pôs 250 €. A resposta só se grava se o valor que ele viu
 * ainda for o que está pendente.
 */
describe("a resposta do profissional", () => {
  const pendente = (valor: number) =>
    JSON.stringify([{ por: "cliente", valor, criadaEm: "2026-10-08T10:00:00.000Z", estado: "pendente" }]);
  const dados = { estado: "aguarda_contratacao", valorAcordado: 350, propostasJson: "[]" };

  it("grava se o valor que ele viu é o da mesa", async () => {
    base.propostasJson = pendente(350);
    expect(await db.gravarRespostaAOfertaClyon(7, 350, dados)).toBe(true);
    expect(escritasNas().map((n) => n.id)).toEqual([7]);
  });

  it("recusa se o valor mudou entretanto", async () => {
    base.propostasJson = pendente(250);
    expect(await db.gravarRespostaAOfertaClyon(7, 350, dados)).toBe(false);
    expect(base.escritas).toEqual([]);
    expect(base.rollbacks).toBe(1);
  });
});

describe("quando o escolhido recusa o valor novo", () => {
  it("volta aos que tinham ficado de fora, no valor e na taxa de agora", async () => {
    base.pedido = { id: 420, status: "atribuido", valorFixoClyon: "350.00", taxaClyon: "0.2000" };
    base.negs = [neg(1, "desistida"), neg(2, "morta"), neg(3, "morta"), neg(4, "morta", { estadoAntesDeCancelar: "aberta" })];
    const r = await db.reabrirOsOutrosDoTrabalhoClyon(420);
    expect(r.valor).toBe(350);
    expect(r.taxa).toBe(0.2);
    expect(r.quem.map((q) => q.negociacaoId)).toEqual([2, 3]);
    expect(escritasNas().map((n) => n.id)).toEqual([2, 3]);
  });

  it("não faz nada enquanto alguém ainda tiver a pergunta feita", async () => {
    base.negs = [neg(1, "aberta"), neg(2, "morta")];
    expect((await db.reabrirOsOutrosDoTrabalhoClyon(420)).quem).toEqual([]);
    expect(base.escritas).toEqual([]);
  });

  it("nem num pedido cancelado", async () => {
    base.pedido = { id: 420, status: "cancelado", valorFixoClyon: "350.00", taxaClyon: "0.2" };
    base.negs = [neg(2, "morta")];
    expect((await db.reabrirOsOutrosDoTrabalhoClyon(420)).quem).toEqual([]);
  });
});

describe("o que o profissional lê", () => {
  const AGORA = new Date("2026-10-08T10:00:00Z");
  const o = { pedidoId: 420, servico: "recolha_moveis", localidade: "Moscavide", valor: 350, ganhos: 280, link: "https://clyon.pt/profissionais/painel" };

  it("o valor mudou: o valor e os ganhos, e a pergunta", () => {
    const t = avisoDeValorNovoAoProfissional("João", { ...o, motivo: "valor_novo", eraDele: false }, AGORA);
    expect(t).toContain("mudou: agora é no valor de 350,00 € — ganhos estimados de 280,00 €");
    expect(t).toContain("Deseja aceitar este trabalho?");
    expect(t).toContain(o.link);
  });

  it("a quem já o tinha: continua a ser seu se aceitar", () => {
    const t = avisoDeValorNovoAoProfissional("João", { ...o, motivo: "valor_novo", eraDele: true }, AGORA);
    expect(t).toContain("O trabalho continua a ser seu se aceitar o valor novo.");
  });

  it("voltou a estar disponível", () => {
    const t = avisoDeValorNovoAoProfissional("João", { ...o, motivo: "de_novo", eraDele: false }, AGORA);
    expect(t).toContain("voltou a estar disponível, no valor de 350,00 €");
  });

  it("cancelado pela CLYON", () => {
    const t = avisoDeCancelamentoAoProfissional("João", { pedidoId: 420, servico: "recolha_moveis", localidade: "Moscavide" }, AGORA);
    expect(t).toContain("(#420) foi cancelado pela CLYON");
  });
});

/** As peças ligadas — o que só se lê no código. */
describe("as peças ligadas", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  const ROTA = ler("src/app/api/admin/trabalhos-clyon/route.ts");
  const patch = ROTA.slice(ROTA.indexOf("export async function PATCH"));

  it("mudar e cancelar: porta do painel primeiro, e o assistente também pode", () => {
    expect(patch.indexOf("requireAdmin(req)")).toBeGreaterThan(-1);
    expect(patch.indexOf("requireAdmin(req)")).toBeLessThan(patch.indexOf("mudarValorDoTrabalhoClyon("));
    expect(patch.indexOf("requireAdmin(req)")).toBeLessThan(patch.indexOf("cancelarPedido("));
  });

  it("cancelar lê quem o tem ANTES de o matar, recusa um trabalho feito, e avisa-os", () => {
    const iQuem = patch.indexOf("quemTemOTrabalhoClyon(pedidoId)");
    const iCancela = patch.indexOf("cancelarPedido(pedidoId)");
    expect(iQuem).toBeGreaterThan(-1);
    expect(iQuem).toBeLessThan(iCancela);
    expect(patch.slice(iQuem, iCancela)).toContain("if (antes.jaFeito)");
    expect(patch.slice(iCancela)).toContain("quem: antes.vivos");
  });

  it("a recusa devolve o trabalho aos outros", () => {
    const R = ler("src/lib/responder-oferta-clyon.ts");
    expect(R).toContain("await reabrirOsOutrosDoTrabalhoClyon(a.pedidoId)");
    expect(R).toContain('motivo: "de_novo"');
  });

  it("o ecrã manda o valor que mostra; a resposta só grava com ele", () => {
    const UI = ler("src/app/profissionais/pedidos/[token]/NegociacaoProfissional.tsx");
    expect(UI).toContain("valorVisto: ofertaClyon ? (pendente?.valor ?? null) : undefined,");
    expect(UI).toContain("if (res.status === 409 && dados.valorMudou) {");
    const R = ler("src/lib/responder-oferta-clyon.ts");
    expect(R).toContain("await gravarRespostaAOfertaClyon(a.negociacaoId, valorQueViu, {");
    expect(R).not.toContain("await gravarNegociacao(");
    for (const rota of ["src/app/api/negociacao/[token]/route.ts", "src/app/api/profissionais/negociacao/route.ts"]) {
      expect(ler(rota)).toContain("valorVisto: (corpo as { valorVisto?: unknown }).valorVisto,");
    }
  });

  it("ao que o tinha, o aviso antigo da fila fecha-se; quem não quer avisos não conta", () => {
    const A = ler("src/lib/avisar-trabalho-clyon.ts");
    expect(A).toContain("if (q.eraDele) await substituirAvisoPorSairAoProfissional(a.pedidoId, q.providerId);");
    expect(A).toContain("if (!q.eraDele && !q.avisaPorWhatsApp) continue;");
  });

  it("repor um aviso volta a pô-lo por sair, com o texto novo", () => {
    const DB = ler("src/lib/db.ts");
    const repor = DB.slice(DB.indexOf("export async function reporAvisoAoProfissional("));
    expect(repor.slice(0, 1500)).toMatch(/ON DUPLICATE KEY UPDATE[\s\S]*texto = VALUES\(texto\)[\s\S]*enviadoEm = NULL, porqueNaoSaiu = NULL/);
  });

  it("o profissional lê os ganhos, e «cancelado» quando é cancelado", () => {
    const UI = ler("src/app/profissionais/pedidos/[token]/NegociacaoProfissional.tsx");
    const oferta = UI.slice(UI.indexOf("function OfertaDaClyon("));
    expect(oferta).toContain("quantoOProfissionalRecebe(valor, taxas ?? { cliente: 0, profissional: 0 })");
    expect(oferta).toContain("Ganhos estimados");
    expect(oferta).toContain("Este trabalho foi cancelado pela CLYON");
    expect(ler("src/app/profissionais/pedidos/[token]/page.tsx")).toContain('cancelada={linha.status === "cancelado"}');
  });
});
