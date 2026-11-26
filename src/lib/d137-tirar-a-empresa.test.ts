import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  avisoATirada,
  confirmacaoDeTirar,
  diaJaPassou,
  empresaTiradaSemOferta,
  motivoDeTirar,
  porQueNaoSeTira,
  quemVoltaAsPropostas,
  ROTULO_DE_TIRAR,
} from "./tirar-a-empresa";
import { resumoDaOferta, type NegociacaoDaOferta } from "./oferta-clyon";

/**
 * d137 (dono e CEO, 26-11-2026; o #595) — TIRAR A EMPRESA E PEDIR PROPOSTAS
 * DE NOVO. Um Trabalho CLYON atribuído a 11/11 para 12/11, nunca feito, e o
 * cliente ainda quer o serviço. A base finge-se aqui; o cartão, a Mesa e as
 * rotas lêem-se pelo código.
 */

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "");

const estado = vi.hoisted(() => ({
  pedido: { id: 595, status: "pendente", valorFixoClyon: "120.00", dataAgendada: new Date("2026-11-12T09:00:00Z") } as Record<string, unknown>,
  negs: [] as Array<Record<string, unknown>>,
  dinheiro: [] as string[],
  sqls: [] as Array<{ sql: string; p: unknown[] }>,
  historico: [] as string[],
  whatsapp: [] as Array<{ telefone: string; texto: string }>,
  push: [] as Array<{ providerId: number; tipo: string }>,
  registo: [] as Array<Record<string, unknown>>,
  reservaSaiu: false,
  commits: 0,
}));

vi.mock("./db", () => {
  const conn = {
    beginTransaction: vi.fn(async () => {}),
    commit: vi.fn(async () => {
      estado.commits += 1;
    }),
    rollback: vi.fn(async () => {}),
    release: vi.fn(() => {}),
    execute: vi.fn(async (sql: string, p: unknown[] = []) => {
      estado.sqls.push({ sql, p });
      if (/FROM simulatorOrders/.test(sql)) return [[estado.pedido], []];
      if (/FROM negociacoes n/.test(sql)) return [estado.negs.map((n) => ({ ...n })), []];
      if (/^UPDATE negociacoes/.test(sql.trim())) {
        const id = Number(p[p.length - 1]);
        const n = estado.negs.find((x) => Number(x.id) === id);
        if (!n) return [{ affectedRows: 0 }, []];
        if (/estado = 'morta', retiradaEm = NOW\(\)/.test(sql) && n.estado === "acordada") {
          n.estado = "morta";
          n.retiradaEm = new Date();
          return [{ affectedRows: 1 }, []];
        }
        if (/estado = 'aberta'/.test(sql) && n.estado === "morta") {
          n.estado = "aberta";
          return [{ affectedRows: 1 }, []];
        }
        return [{ affectedRows: 0 }, []];
      }
      return [[], []];
    }),
  };
  return {
    ensureSimulatorOrdersTable: vi.fn(async () => {}),
    ensureNegociacoesTable: vi.fn(async () => {}),
    ensureProvidersSchema: vi.fn(async () => {}),
    getPool: vi.fn(async () => ({ getConnection: async () => conn, execute: conn.execute })),
    appendOrderHistory: vi.fn(async (_id: number, h: { message: string }) => {
      estado.historico.push(h.message);
    }),
    registarSemFalhar: vi.fn(async (l: Record<string, unknown>) => {
      estado.registo.push(l);
    }),
    assistentePode: vi.fn(async () => true),
  };
});
vi.mock("./fim-do-pedido-na-base", () => ({ oQuePrendeOPedidoNaBase: vi.fn(async () => estado.dinheiro) }));
vi.mock("./sim-do-cliente-na-base", () => ({
  tirarReservaSemAvisar: vi.fn(async () => (estado.reservaSaiu ? { tipo: "falta_o_sim" } : null)),
}));
vi.mock("./whatsapp-cloud", () => ({
  telemovelParaWhatsApp: (t: string | null) => (t ? `351${t}` : null),
  enviarAvisoWhatsApp: vi.fn(async (telefone: string, texto: string) => {
    estado.whatsapp.push({ telefone, texto });
    return true;
  }),
}));
vi.mock("./avisos-do-backoffice", () => ({
  avisarProfissional: vi.fn(async (providerId: number, tipo: string) => {
    estado.push.push({ providerId, tipo });
  }),
}));

const { tirarAEmpresaDoTrabalho } = await import("./tirar-a-empresa-na-base");

const quem = { quem: "Ana", por: { id: 7, nome: "Ana", role: "admin" } };
const AGORA = new Date("2026-11-26T12:00:00Z");

function o595(extra: Record<string, unknown> = {}) {
  return [
    {
      id: 9001,
      providerId: 31,
      estado: "acordada",
      estadoAntesDeCancelar: null,
      retiradaEm: null,
      propostasJson: "[]",
      execucaoEnviadaEm: null,
      confirmadoEm: null,
      pagoEm: null,
      clienteDisseQuePagouEm: null,
      parceiroConfirmouEm: null,
      dataCombinada: new Date("2026-11-12T09:00:00Z"),
      profissional: "Nova Recolha",
      telefone: "912345678",
      ...extra,
    },
    // Os outros que tinham a oferta em aberto: ficaram de fora quando ela foi escolhida.
    { id: 9002, providerId: 32, estado: "morta", estadoAntesDeCancelar: null, retiradaEm: null, propostasJson: "[]", profissional: "Outro", telefone: null },
  ];
}

beforeEach(() => {
  estado.pedido = { id: 595, status: "pendente", valorFixoClyon: "120.00", dataAgendada: new Date("2026-11-12T09:00:00Z") };
  estado.negs = o595();
  estado.dinheiro = [];
  estado.sqls = [];
  estado.historico = [];
  estado.whatsapp = [];
  estado.push = [];
  estado.registo = [];
  estado.reservaSaiu = false;
  estado.commits = 0;
});

describe("d137 — as frases e as regras", () => {
  it("o botão, a confirmação e o aviso curto à empresa", () => {
    expect(ROTULO_DE_TIRAR.clyon).toBe("Tirar a empresa e pedir propostas de novo");
    expect(ROTULO_DE_TIRAR.mesa).toBe("Tirar o contratado e reabrir as propostas");
    expect(confirmacaoDeTirar("Nova Recolha", "clyon")).toBe("A Nova Recolha é avisada de que o trabalho saiu. O pedido volta a «à espera».");
    expect(confirmacaoDeTirar("Nova Recolha", "mesa")).toBe("A Nova Recolha é avisada de que o trabalho saiu. O pedido volta às propostas.");
    expect(avisoATirada(595).whatsapp).toBe("CLYON · O trabalho #595 deixou de estar consigo. Obrigado.");
    expect(avisoATirada(595).title).toBe("CLYON · Trabalho #595");
    expect(motivoDeTirar("  não   apareceu ")).toBe("não apareceu");
    expect(motivoDeTirar("")).toBeNull();
  });

  it("recusa com o porquê o que tem dinheiro, fatura, ou o trabalho feito", () => {
    expect(porQueNaoSeTira({}, [])).toBeNull();
    expect(porQueNaoSeTira({ confirmadoEm: new Date() }, [])).toMatch(/já foi confirmado/);
    expect(porQueNaoSeTira({ execucaoEnviadaEm: new Date() }, [])).toMatch(/deu por feito/);
    expect(porQueNaoSeTira({ pagoEm: new Date() }, [])).toMatch(/já foi pago/);
    expect(porQueNaoSeTira({}, ["tem faturas"])).toMatch(/^Não se tira a empresa: tem faturas\./);
  });

  it("o dia passado abre o Editar no dia; sem dia, não", () => {
    expect(diaJaPassou(new Date("2026-11-12T09:00:00Z"), AGORA)).toBe(true);
    expect(diaJaPassou("2026-12-01T09:00:00Z", AGORA)).toBe(false);
    expect(diaJaPassou(null, AGORA)).toBe(false);
  });

  it("na Mesa, só reabrem as propostas de quem ficou de fora (nem cancelados, nem tirados)", () => {
    const comProposta = JSON.stringify([{ por: "profissional", valor: 100 }]);
    const v = quemVoltaAsPropostas(
      [
        { id: 1, estado: "acordada", propostasJson: comProposta },
        { id: 2, estado: "morta", propostasJson: comProposta },
        { id: 3, estado: "morta", propostasJson: "[]" },
        { id: 4, estado: "morta", estadoAntesDeCancelar: "aberta", propostasJson: comProposta },
        { id: 5, estado: "morta", retiradaEm: new Date(), propostasJson: comProposta },
        { id: 6, estado: "desistida", propostasJson: comProposta },
      ],
      1,
    );
    expect(v.map((n) => n.id)).toEqual([2]);
  });
});

describe("d137 — a fase depois de tirar a empresa", () => {
  const neg = (x: Partial<NegociacaoDaOferta>): NegociacaoDaOferta => ({
    negociacaoId: 1,
    providerId: 1,
    profissional: "x",
    estado: "morta",
    modo: "distribuida",
    atribuidaEm: null,
    execucaoEnviadaEm: null,
    confirmadoEm: null,
    pagoEm: null,
    ...x,
  });

  it("atribuído → tirada → «à espera», com os dois caminhos à vista", () => {
    const antes = [neg({ negociacaoId: 1, estado: "acordada" }), neg({ negociacaoId: 2, estado: "morta" })];
    expect(resumoDaOferta(antes).fase).toBe("atribuida");
    const depois = [neg({ negociacaoId: 1, estado: "morta", retiradaEm: "2026-11-26T12:00:00Z" }), neg({ negociacaoId: 2, estado: "morta" })];
    const r = resumoDaOferta(depois);
    expect(r.fase).toBe("a_espera");
    expect(r.recusaram).toBe(0);
    expect(empresaTiradaSemOferta({ resumo: r, negociacoes: depois })).toBe(true);
  });

  it("só a empresa (oferta directa) — também «à espera»", () => {
    expect(resumoDaOferta([neg({ estado: "morta", retiradaEm: "2026-11-26T12:00:00Z" })]).fase).toBe("a_espera");
  });

  it("voltou a ser oferecido e todos recusaram — «Ninguém aceitou», como sempre", () => {
    const depois = [neg({ negociacaoId: 1, estado: "morta", retiradaEm: "2026-11-26T12:00:00Z" }), neg({ negociacaoId: 2, estado: "desistida" })];
    expect(resumoDaOferta(depois).fase).toBe("sem_ninguem");
  });

  it("voltou a ser oferecido — os caminhos saem do cartão", () => {
    const depois = [neg({ negociacaoId: 1, estado: "morta", retiradaEm: "2026-11-26T12:00:00Z" }), neg({ negociacaoId: 2, estado: "aberta" })];
    const r = resumoDaOferta(depois);
    expect(r.fase).toBe("a_espera");
    expect(empresaTiradaSemOferta({ resumo: r, negociacoes: depois })).toBe(false);
  });
});

describe("d137 — na base", () => {
  it("atribuído sem dinheiro: a empresa sai, é avisada, e o pedido volta a «à espera»", async () => {
    estado.reservaSaiu = true;
    const r = await tirarAEmpresaDoTrabalho(595, "não apareceu no dia", quem, AGORA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.onde).toBe("clyon");
    expect(r.empresa).toBe("Nova Recolha");
    expect(r.diaPassou).toBe(true);
    expect(estado.commits).toBe(1);
    expect(estado.negs[0].estado).toBe("morta");
    expect(estado.negs[0].retiradaEm).toBeInstanceOf(Date);
    // Os outros não são tocados nem avisados: o caminho escolhe-o a pessoa.
    expect(estado.negs[1].estado).toBe("morta");
    expect(estado.whatsapp).toEqual([{ telefone: "351912345678", texto: "CLYON · O trabalho #595 deixou de estar consigo. Obrigado." }]);
    expect(estado.push).toEqual([{ providerId: 31, tipo: "trabalho_retirado" }]);
    expect(estado.historico[0]).toMatch(/^Trabalho tirado a Nova Recolha por Ana — motivo: não apareceu no dia\./);
    expect(estado.historico[0]).toMatch(/«falta o sim» saiu/);
    expect(estado.historico[0]).toMatch(/«Voltar a oferecer a todos» \(o mesmo valor fixo\) ou «Passar a negociação»/);
    expect(estado.registo[0]).toMatchObject({ acontecimento: "profissional_retirado", pedidoId: 595, providerId: 31 });
  });

  it("com fatura (ou outro dinheiro do pedido): recusa com o porquê, e nada muda nem é avisado", async () => {
    estado.dinheiro = ["tem faturas"];
    const r = await tirarAEmpresaDoTrabalho(595, null, quem, AGORA);
    expect(r).toMatchObject({ ok: false, estado: 409 });
    if (r.ok) return;
    expect(r.erro).toMatch(/tem faturas/);
    expect(estado.negs[0].estado).toBe("acordada");
    expect(estado.commits).toBe(0);
    expect(estado.whatsapp).toEqual([]);
    expect(estado.push).toEqual([]);
  });

  it("confirmado, dado por feito ou com o «já paguei» do cliente: recusa", async () => {
    for (const extra of [{ confirmadoEm: new Date() }, { execucaoEnviadaEm: new Date() }, { clienteDisseQuePagouEm: new Date() }]) {
      estado.negs = o595(extra);
      const r = await tirarAEmpresaDoTrabalho(595, null, quem, AGORA);
      expect(r.ok).toBe(false);
      expect(estado.negs[0].estado).toBe("acordada");
    }
    expect(estado.whatsapp).toEqual([]);
  });

  it("sem ninguém atribuído, ou o pedido fechado: recusa", async () => {
    estado.negs = [o595()[1]];
    expect((await tirarAEmpresaDoTrabalho(595, null, quem, AGORA)).ok).toBe(false);
    estado.negs = o595();
    estado.pedido = { ...estado.pedido, status: "cancelado" };
    expect((await tirarAEmpresaDoTrabalho(595, null, quem, AGORA)).ok).toBe(false);
    expect(estado.negs[0].estado).toBe("acordada");
  });

  it("na Mesa: o contratado sai e as propostas dos outros reabrem, sem aviso a eles", async () => {
    estado.pedido = { ...estado.pedido, valorFixoClyon: null };
    estado.negs = [
      ...o595().slice(0, 1),
      { id: 9003, providerId: 33, estado: "morta", estadoAntesDeCancelar: null, retiradaEm: null, propostasJson: JSON.stringify([{ por: "profissional", valor: 90 }]), profissional: "Terceiro", telefone: "913" },
    ];
    const r = await tirarAEmpresaDoTrabalho(595, null, quem, AGORA);
    expect(r).toMatchObject({ ok: true, onde: "mesa", reabertas: 1 });
    expect(estado.negs[1].estado).toBe("aberta");
    expect(estado.whatsapp.map((w) => w.telefone)).toEqual(["351912345678"]);
    expect(estado.historico[0]).toMatch(/As propostas voltaram a estar abertas \(1\)/);
  });
});

describe("d137 — o cartão, a Mesa e as rotas", () => {
  const CARTAO = semComentarios(ler("src/components/admin/TrabalhoClyon.tsx"));
  const MESA = semComentarios(ler("src/components/admin/AdminNegociacoesPanel.tsx"));
  const ROTA = semComentarios(ler("src/app/api/admin/trabalhos-clyon/route.ts"));
  const DB = ler("src/lib/db.ts");

  it("no atribuído ainda por fazer, o botão; depois, «Voltar a oferecer a todos» e «Passar a negociação»", () => {
    expect(CARTAO).toMatch(/r\.fase === "atribuida" && !a\.execucaoEnviadaEm && !a\.confirmadoEm && !a\.pagoEm && !a\.clientePagouEm[\s\S]{0,80}<TirarAEmpresa[^>]*onde="clyon"/);
    const caixa = CARTAO.slice(CARTAO.indexOf("{aberto && empresaTiradaSemOferta(t)"));
    expect(caixa.length).toBeLessThan(CARTAO.length);
    const fim = caixa.indexOf("</div>\n        </div>");
    expect(fim).toBeGreaterThan(-1);
    const bloco = caixa.slice(0, fim);
    expect(bloco).toContain("onReoferecer(null)");
    expect(bloco).toContain("Voltar a oferecer a todos (o mesmo valor fixo)");
    expect(bloco).toContain("onPassarANegociacao");
    expect(bloco).toContain("Passar a negociação (cada parceiro propõe)");
    // O «Passar a negociação» de sempre também aparece na fase «à espera».
    expect(CARTAO).toMatch(/onPassarANegociacao && \(r\.fase === "a_espera" \|\| r\.fase === "sem_ninguem"\)/);
  });

  it("com o dia passado, o Editar abre no campo do dia (sem recomeçar do zero o Trabalho CLYON)", () => {
    expect(CARTAO).toMatch(/if \(r\.diaPassou\) \{\s*setEditarODia\(true\);\s*setAEditar\(t\.pedidoId\);/);
    expect(CARTAO).toContain("focarNoDia={editarODia}");
    expect(ler("src/components/admin/RegistarPedido.tsx")).toContain("ref={campoDoDia}");
  });

  it("na Mesa: «Tirar o contratado e reabrir as propostas» no contratado ainda por fazer", () => {
    expect(MESA).toMatch(/!concluido && !acordada\.confirmadoEm && !acordada\.execucaoEnviadaEm && !acordada\.pagoEm && \(\s*<TirarAEmpresa[\s\S]{0,160}onde="mesa"/);
  });

  it("a empresa tirada não volta no «a todos» nem na distribuição — só escolhida à mão", () => {
    expect(DB).toMatch(/negociacaoId == null \? recusou\(n\) && n\.retiradaEm == null/);
    expect(DB).toContain("ALTER TABLE negociacoes ADD COLUMN retiradaEm DATETIME NULL DEFAULT NULL");
    expect(Number(/const VERSAO_DAS_NEGOCIACOES = (\d+);/.exec(DB)?.[1])).toBeGreaterThanOrEqual(28);
    expect(ler("src/lib/distribuir-pedido.ts")).toMatch(/n\.estado === "desistida" \|\| \(n as \{ retiradaEm\?: unknown \}\)\.retiradaEm != null/);
    // Sem outros a quem tenha sido oferecido, «a todos» é a todos os que o podem fazer, com o mesmo valor.
    expect(ROTA).toMatch(/r\.porque === "ninguem" && alvo == null[\s\S]{0,200}temEmpresaTirada\(pedidoId\)[\s\S]{0,900}distribuirPedido\(/);
  });

  it("a rota nova está nas secções certas", () => {
    expect(ler("src/lib/papel-do-painel.ts")).toContain('{ prefixo: "/api/admin/negociacoes/tirar-empresa", seccoes: ["negociacoes_clyon", "trabalhos_clyon"] }');
    expect(ler("src/app/api/admin/negociacoes/tirar-empresa/route.ts")).toContain("requireAdmin(req)");
  });
});
