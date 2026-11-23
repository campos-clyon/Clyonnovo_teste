import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * TODO O PEDIDO COMPLETO, DE QUALQUER ORIGEM, SEGUE SOZINHO PARA OS PARCEIROS
 * — 23-11-2026 (decisão d88, passo 2, CEO e dono). Pedidos, nomes e números
 * INVENTADOS (o repositório é público).
 *
 * As regras puras correm como são; a base corre FINGIDA: a tabela da reserva em
 * memória (INSERT IGNORE e UPDATE condicional, contados pelas linhas mudadas),
 * os «Orçamentos novos» da Mesa (`pedidosPorPromover`) feitos dos pedidos daqui,
 * e a função da Mesa (`enviarAosProfissionais`) substituída por uma que conta.
 */

type Linha = {
  pedidoId: number;
  estado: string;
  motivo: string | null;
  origem: string | null;
  enviariaA: number | null;
  receberam: number | null;
  seguirApos: Date | null;
  vistoEm: Date | null;
  criadoEm: Date;
  mudadoEm: Date;
};

const base = vi.hoisted(() => ({
  tabela: new Map<number, Linha>(),
  interruptor: null as number | null,
  soVitoria: null as number | null,
  pedidos: new Map<number, Record<string, unknown>>(),
  faltas: new Map<number, string[]>(),
  negs: new Map<number, Array<{ estado: string }>>(),
  fio: [] as Array<{ direccao: string; texto: string; haSegundos: number | null }>,
  bloqueado: false,
  interrompido: false,
  coordenadas: { lat: 38.66, lng: -9.17 } as { lat: number | null; lng: number | null },
  elegiveis: 3,
  receberam: 3,
  enviados: [] as Array<{ id: number; opcoes: Record<string, unknown> }>,
  avisos: [] as Array<{ para: string; texto: string }>,
  jaSaiuHoje: false,
  historico: [] as Array<{ id: number; message: string }>,
}));

vi.mock("@/lib/db", async (original) => {
  const mudadas = (n: number) => [{ affectedRows: n }, undefined];
  const execute = async (sql: string, p: unknown[] = []) => {
    const t = base.tabela;
    const agora = new Date();
    if (/^\s*CREATE TABLE/.test(sql)) return mudadas(0);
    if (/^\s*ALTER TABLE envioAutomaticoAosParceiros ADD COLUMN/.test(sql)) return mudadas(0);
    if (/FROM retencaoInterruptores/.test(sql)) {
      const v = p[0] === "envio_automatico_so_vitoria_d88" ? base.soVitoria : base.interruptor;
      return [v == null ? [] : [{ ligado: v, mudadoEm: null, porQuem: "teste" }], undefined];
    }
    const nova = (l: Partial<Linha> & { pedidoId: number; estado: string }) => {
      if (t.has(l.pedidoId)) return mudadas(0);
      t.set(l.pedidoId, {
        motivo: null,
        origem: null,
        enviariaA: null,
        receberam: null,
        seguirApos: null,
        vistoEm: null,
        criadoEm: agora,
        mudadoEm: agora,
        ...l,
      });
      return mudadas(1);
    };
    if (/INSERT IGNORE INTO envioAutomaticoAosParceiros/.test(sql)) {
      if (/'a_enviar'/.test(sql)) return nova({ pedidoId: Number(p[0]), estado: "a_enviar", origem: String(p[1]) });
      if (/'na_fila'/.test(sql) && /seguirApos/.test(sql)) {
        return nova({ pedidoId: Number(p[0]), estado: "na_fila", origem: String(p[1]), enviariaA: p[2] as number, seguirApos: (p[3] as Date | null) ?? null });
      }
      if (/'na_fila'/.test(sql)) return nova({ pedidoId: Number(p[0]), estado: "na_fila", origem: String(p[1]), enviariaA: p[2] as number });
      if (/'ficou'/.test(sql)) {
        return nova({ pedidoId: Number(p[0]), estado: "ficou", motivo: String(p[1]), origem: String(p[2]), enviariaA: p[3] as number | null });
      }
    }
    if (/UPDATE envioAutomaticoAosParceiros SET estado = 'a_enviar'/.test(sql)) {
      const l = t.get(Number(p[0]));
      if (!l || !["na_fila", "ficou"].includes(l.estado)) return mudadas(0);
      Object.assign(l, { estado: "a_enviar", motivo: null, mudadoEm: agora });
      return mudadas(1);
    }
    if (/SET estado = 'na_fila', motivo = NULL, origem = \?/.test(sql)) {
      const l = t.get(Number(p[3]));
      if (!l || l.estado !== "ficou") return mudadas(0);
      Object.assign(l, { estado: "na_fila", motivo: null, origem: String(p[0]), enviariaA: p[1] as number, seguirApos: (p[2] as Date | null) ?? null, mudadoEm: agora });
      return mudadas(1);
    }
    if (/SET origem = \?, enviariaA = \?, seguirApos = \?/.test(sql)) {
      const l = t.get(Number(p[3]));
      if (!l || l.estado !== "na_fila") return mudadas(0);
      Object.assign(l, { origem: String(p[0]), enviariaA: p[1] as number, seguirApos: (p[2] as Date | null) ?? null });
      return mudadas(1);
    }
    if (/UPDATE envioAutomaticoAosParceiros SET estado = 'na_fila'/.test(sql)) {
      const l = t.get(Number(p[1]));
      if (!l || l.estado !== "ficou") return mudadas(0);
      Object.assign(l, { estado: "na_fila", motivo: null, enviariaA: p[0] as number, mudadoEm: agora });
      return mudadas(1);
    }
    if (/UPDATE envioAutomaticoAosParceiros SET estado = 'ficou', motivo = \?/.test(sql)) {
      const l = t.get(Number(p[2]));
      const daReserva = /estado = 'a_enviar'\s+AND/.test(sql);
      if (!l) return mudadas(0);
      if (daReserva ? l.estado !== "a_enviar" : !["na_fila", "ficou"].includes(l.estado)) return mudadas(0);
      if (l.estado === "ficou" && l.motivo === p[3]) return mudadas(0);
      Object.assign(l, { estado: "ficou", motivo: String(p[0]), enviariaA: p[1] as number | null, mudadoEm: agora });
      return mudadas(1);
    }
    if (/SET estado = 'enviado'/.test(sql)) {
      const l = t.get(Number(p[1]));
      if (!l) return mudadas(0);
      Object.assign(l, { estado: "enviado", motivo: null, receberam: p[0] as number, mudadoEm: agora });
      return mudadas(1);
    }
    if (/motivo = 'interrompido'/.test(sql)) return mudadas(0);
    // d2: a contagem da fila, a limpeza das linhas presas, o «tirar da fila» e o pedido repetido do mesmo contacto.
    if (/SELECT COUNT\(\*\) AS n FROM envioAutomaticoAosParceiros/.test(sql)) return [[{ n: [...t.values()].filter((l) => l.estado === "na_fila").length }], undefined];
    if (/e\.motivo = 'ja_enviado'/.test(sql)) return mudadas(0);
    if (/e\.motivo = 'fechado'/.test(sql)) return mudadas(0);
    if (/SET motivo = \?, estado = 'ficou'/.test(sql)) {
      const l = t.get(Number(p[1]));
      if (!l || l.estado !== "na_fila") return mudadas(0);
      Object.assign(l, { estado: "ficou", motivo: String(p[0]), mudadoEm: agora });
      return mudadas(1);
    }
    if (/FROM simulatorOrders o\s+WHERE o\.id < \?/.test(sql)) return [[], undefined];
    if (/SET vistoEm = \?/.test(sql)) {
      const l = t.get(Number(p[1]));
      if (!l) return mudadas(0);
      l.vistoEm = p[0] as Date;
      return mudadas(1);
    }
    if (/SELECT pedidoId, estado, motivo, vistoEm FROM envioAutomaticoAosParceiros/.test(sql)) {
      return [[...t.values()].filter((l) => p.includes(l.pedidoId)), undefined];
    }
    if (/SELECT pedidoId, origem FROM envioAutomaticoAosParceiros\s+WHERE estado = 'na_fila'/.test(sql)) {
      const ate = p[0] as Date;
      const soVitoria = /origem <> 'orcamentos_novos'/.test(sql);
      return [
        [...t.values()]
          .filter((l) => l.estado === "na_fila" && (l.seguirApos == null || l.seguirApos.getTime() <= ate.getTime()))
          .filter((l) => !soVitoria || l.origem !== "orcamentos_novos")
          .map((l) => ({ pedidoId: l.pedidoId, origem: l.origem })),
        undefined,
      ];
    }
    if (/SELECT pedidoId, estado, motivo, enviariaA, mudadoEm, seguirApos, origem FROM envioAutomaticoAosParceiros/.test(sql)) {
      return [[...t.values()].filter((l) => p.includes(l.pedidoId)), undefined];
    }
    throw new Error(`SQL por fingir: ${sql.slice(0, 80)}`);
  };
  return {
    ...(await original<typeof import("@/lib/db")>()),
    getPool: vi.fn(async () => ({ execute })),
    getSimulatorOrderById: vi.fn(async (id: number) => base.pedidos.get(id)),
    negociacoesDoPedido: vi.fn(async (id: number) => base.negs.get(id) ?? []),
    mensagensDoNumeroWhatsApp: vi.fn(async () => base.fio),
    numeroBloqueadoWhatsApp: vi.fn(async () => base.bloqueado),
    numeroInterrompidoWhatsApp: vi.fn(async () => base.interrompido),
    // Os «Orçamentos novos» da Mesa: os pedidos daqui sem negociações, do mais recente para trás.
    pedidosPorPromover: vi.fn(async () =>
      [...base.pedidos.values()]
        .filter((p) => (base.negs.get(Number(p.id)) ?? []).length === 0)
        .sort((a, b) => Number(b.id) - Number(a.id))
        .map((p) => ({ ...p, rawDoQueFalta: p.rawOrderJson })),
    ),
    appendOrderHistory: vi.fn(async (id: number, e: { message: string }) => {
      base.historico.push({ id, message: e.message });
    }),
  };
});
vi.mock("@/lib/o-que-falta-no-pedido", async (original) => ({
  ...(await original<typeof import("@/lib/o-que-falta-no-pedido")>()),
  oQueFaltaNoPedido: vi.fn((p: { id?: unknown }) => base.faltas.get(Number(p.id)) ?? []),
}));
vi.mock("@/lib/coordenadas-do-pedido", () => ({
  coordenadasDoPedido: vi.fn(async () => ({ ...base.coordenadas, descobertasAgora: false })),
}));
vi.mock("@/lib/distribuir-pedido", async (original) => ({
  ...(await original<typeof import("@/lib/distribuir-pedido")>()),
  avaliarAlcance: vi.fn(async () => ({
    elegiveis: Array.from({ length: base.elegiveis }, (_, i) => ({ id: i + 1, nome: `Parceiro ${i + 1}`, distanciaKm: 10 })),
    todos: [],
    candidatos: base.elegiveis,
    motivos: {},
  })),
}));
vi.mock("@/lib/enviar-aos-profissionais", () => ({
  enviarAosProfissionais: vi.fn(async (pedidoId: number, opcoes: Record<string, unknown>) => {
    base.enviados.push({ id: pedidoId, opcoes });
    return {
      ok: true,
      chegouAAlguem: base.receberam > 0,
      valor: 80,
      emailSaiu: true,
      link: null,
      avisados: base.receberam,
      receberam: base.receberam,
      falhados: 0,
      candidatos: base.elegiveis,
      jaTinham: 0,
      motivos: {},
    };
  }),
}));
vi.mock("@/lib/uma-mensagem-automatica-por-dia", () => ({
  jaSaiuHojeUmaMensagemAutomatica: vi.fn(async () => base.jaSaiuHoje),
}));
vi.mock("@/lib/whatsapp-cloud", () => ({
  enviarAvisoWhatsApp: vi.fn(async (para: string, texto: string) => {
    base.avisos.push({ para, texto });
    return true;
  }),
}));

import {
  canalDoAvisoAoCliente,
  estimativaComIva,
  horaDeSaida,
  linhaDoEnvioAutomaticoNaMesa,
  origemNoEnvioAutomatico,
  porqueFicaComUmaPessoa,
  quandoSai,
  seguirSoDepoisDe,
  NOME_DO_INTERRUPTOR_SO_DA_VITORIA,
} from "./envio-automatico-aos-parceiros";
import {
  linhasDoEnvioAutomaticoNaMesa,
  rotinaDoEnvioAutomatico,
  seguirSozinhoParaOsParceiros,
} from "./envio-automatico-aos-parceiros-na-base";
import { PEDIDO_JA_SEGUIU } from "./resposta-ao-que-falta";
import { MARCA_DE_MAO } from "./rajada-do-whatsapp";

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");
/* Só os comentários que começam a linha — ver a memória dos testes que lêem o código. */
const semNotas = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

// Segunda, 23-11-2026 (Inverno: Lisboa = UTC).
const AS_15H30 = new Date("2026-11-23T15:30:00Z");
const MEIA_HORA_ANTES = new Date("2026-11-23T15:00:00Z");
const DE_NOITE = new Date("2026-11-23T22:30:00Z");

let proximoId = 9200;
/** Um pedido completo do simulador, entrado há meia hora. */
function pedido(extra: Record<string, unknown> = {}, origem: string | null = "simulador"): number {
  const id = proximoId++;
  base.pedidos.set(id, {
    id,
    status: "sem_assistente",
    serviceType: "recolha_moveis",
    contactName: "Rui Teixo",
    contactEmail: "rui@exemplo.pt",
    contactPhone: "910000002",
    postalCode: "2840-100",
    city: "Seixal",
    address: "Rua dos Pinheiros 7",
    urgency: null,
    rawOrderJson: JSON.stringify(origem == null ? {} : { origemPedido: origem }),
    valorFixoClyon: null,
    propostaEnviadaEm: null,
    escolhaDosParceirosJson: null,
    notasInternas: null,
    assignedToId: null,
    estimateTotal: "98.40",
    estimateMax: "123.00",
    historyJson: "[]",
    createdAt: MEIA_HORA_ANTES,
    description: "Um sofá e uma cómoda.",
    filesJson: "[]",
    dataAgendada: null,
    ...extra,
  });
  return id;
}

beforeEach(() => {
  base.tabela.clear();
  base.interruptor = null;
  base.soVitoria = null;
  base.pedidos.clear();
  base.faltas.clear();
  base.negs.clear();
  base.fio = [];
  base.bloqueado = false;
  base.interrompido = false;
  base.coordenadas = { lat: 38.64, lng: -9.1 };
  base.elegiveis = 3;
  base.receberam = 3;
  base.enviados = [];
  base.avisos = [];
  base.jaSaiuHoje = false;
  base.historico = [];
});

/* ── As regras puras ─────────────────────────────────────────────────────── */

describe("as origens que seguem sozinhas", () => {
  it("simulador (também sem slug), formulário, WhatsApp e registado na Mesa", () => {
    expect(origemNoEnvioAutomatico(null)).toBe("simulador");
    expect(origemNoEnvioAutomatico("simulador")).toBe("simulador");
    for (const s of ["hero_quote_form", "formulario_site", "formulario_contactos", "quero_contratar", "quero_contratar_header"]) {
      expect(origemNoEnvioAutomatico(s), s).toBe("formulario");
    }
    expect(origemNoEnvioAutomatico("whatsapp")).toBe("whatsapp");
    expect(origemNoEnvioAutomatico("backoffice")).toBe("backoffice");
  });
  it("nunca o formulário a meio, a plataforma de teste ou o que não se conhece", () => {
    for (const s of ["hero_quote_parcial", "plataforma", "outra_coisa"]) expect(origemNoEnvioAutomatico(s), s).toBeNull();
  });
});

describe("os que ficam SEMPRE com uma pessoa", () => {
  const LIMPO = { origem: "simulador", estimativaComIva: 123 };
  it("um pedido limpo segue", () => {
    expect(porqueFicaComUmaPessoa(LIMPO)).toBeNull();
  });
  it("cada uma chega para ficar", () => {
    expect(porqueFicaComUmaPessoa({ ...LIMPO, origem: "hero_quote_parcial" })).toBe("origem_fora");
    expect(porqueFicaComUmaPessoa({ ...LIMPO, propostaEnviadaEm: "2026-11-23 10:00:00" })).toBe("proposta_enviada");
    expect(porqueFicaComUmaPessoa({ ...LIMPO, escolhaDosParceirosJson: '{"em":"2026-11-23"}' })).toBe("escolhidos_pelo_cliente");
    expect(porqueFicaComUmaPessoa({ ...LIMPO, assignedToId: 4 })).toBe("atribuido");
    expect(porqueFicaComUmaPessoa({ ...LIMPO, notasInternas: "Ligar antes das 18h." })).toBe("com_nota");
    expect(porqueFicaComUmaPessoa({ ...LIMPO, estimativaComIva: 500.01 })).toBe("acima_de_500");
  });
  it("vazios não contam: nota em branco, atribuído a 0, 500 € certos", () => {
    expect(porqueFicaComUmaPessoa({ ...LIMPO, notasInternas: "   ", assignedToId: 0, estimativaComIva: 500 })).toBeNull();
  });
  it("a estimativa com IVA é a maior das gravadas", () => {
    expect(estimativaComIva("98.40", "615.00")).toBe(615);
    expect(estimativaComIva(null, "")).toBeNull();
  });
});

describe("a espera dos 10 minutos e a hora a que sai", () => {
  it("10 minutos depois de entrar, e 10 minutos depois da última mensagem", () => {
    expect(seguirSoDepoisDe(new Date("2026-11-23T15:25:00Z"), null, AS_15H30)?.toISOString()).toBe("2026-11-23T15:35:00.000Z");
    expect(seguirSoDepoisDe(MEIA_HORA_ANTES, 120, AS_15H30)?.toISOString()).toBe("2026-11-23T15:38:00.000Z");
    expect(seguirSoDepoisDe(MEIA_HORA_ANTES, 601, AS_15H30)).toBeNull();
    expect(seguirSoDepoisDe(MEIA_HORA_ANTES, null, AS_15H30)).toBeNull();
  });
  it("na passagem seguinte da rotina; de noite, às 8h00 de Lisboa", () => {
    expect(horaDeSaida(new Date("2026-11-23T15:35:00Z")).toISOString()).toBe("2026-11-23T15:45:00.000Z");
    expect(horaDeSaida(new Date("2026-11-23T15:45:00Z")).toISOString()).toBe("2026-11-23T15:45:00.000Z");
    expect(horaDeSaida(DE_NOITE).toISOString()).toBe("2026-11-24T08:00:00.000Z");
    expect(horaDeSaida(new Date("2026-11-24T06:10:00Z")).toISOString()).toBe("2026-11-24T08:00:00.000Z");
    // No Verão (Lisboa = UTC+1): as 8h00 de Lisboa são as 7h00 UTC.
    expect(horaDeSaida(new Date("2026-07-10T21:00:00Z")).toISOString()).toBe("2026-07-11T07:00:00.000Z");
  });
  it("«às HH:MM» hoje, «a DD/MM às HH:MM» noutro dia — em Lisboa", () => {
    expect(quandoSai(new Date("2026-11-23T15:45:00Z"), AS_15H30)).toBe("às 15:45");
    expect(quandoSai(new Date("2026-11-24T08:00:00Z"), DE_NOITE)).toBe("a 24/11 às 08:00");
  });
});

describe("por onde se avisa o cliente", () => {
  it("quem falou pelo WhatsApp, por lá; o simulador e o formulário, pelo email que a Mesa já manda", () => {
    expect(canalDoAvisoAoCliente("whatsapp", true)).toBe("whatsapp");
    expect(canalDoAvisoAoCliente("backoffice", true)).toBe("whatsapp");
    expect(canalDoAvisoAoCliente("backoffice", false)).toBe("email_da_mesa");
    expect(canalDoAvisoAoCliente("simulador", true)).toBe("email_da_mesa");
    expect(canalDoAvisoAoCliente("formulario", false)).toBe("email_da_mesa");
  });
});

/* ── Com a base fingida ──────────────────────────────────────────────────── */

describe("simulador e formulário completos: a rotina envia uma vez", () => {
  it("o do simulador segue pela função da Mesa, com a conta da CLYON — e a passagem seguinte não reenvia", async () => {
    const id = pedido();
    const r = await rotinaDoEnvioAutomatico(AS_15H30);
    expect(r).toMatchObject({ vistos: 1, enviadosDosNovos: 1 });
    expect(base.enviados).toHaveLength(1);
    expect(base.enviados[0].id).toBe(id);
    // O botão «Negociação» com a caixa vazia: sem valor escrito, nem «pela Vitória».
    expect(base.enviados[0].opcoes).toMatchObject({ automaticamente: true });
    expect(base.enviados[0].opcoes).not.toHaveProperty("valor");
    expect(base.enviados[0].opcoes).not.toHaveProperty("pelaVitoria");
    expect(base.tabela.get(id)?.estado).toBe("enviado");
    // Sem conversa no WhatsApp: o cliente leva o email da ligação, que a Mesa já manda — nada a mais.
    expect(base.avisos).toEqual([]);

    await rotinaDoEnvioAutomatico(new Date("2026-11-23T15:45:00Z"));
    expect(base.enviados).toHaveLength(1);
  });

  it("o do formulário do site também segue", async () => {
    const id = pedido({}, "hero_quote_form");
    await rotinaDoEnvioAutomatico(AS_15H30);
    expect(base.enviados.map((e) => e.id)).toEqual([id]);
  });

  it("o registado na Mesa sem ninguém a tratar dele, a partir de uma conversa: segue, e o cliente é avisado pelo WhatsApp", async () => {
    base.fio = [{ direccao: "in", texto: "Boa tarde, queria uma recolha.", haSegundos: 3 * 3600 }];
    const id = pedido({}, "backoffice");
    await rotinaDoEnvioAutomatico(AS_15H30);
    expect(base.enviados.map((e) => e.id)).toEqual([id]);
    expect(base.avisos).toEqual([{ para: "910000002", texto: PEDIDO_JA_SEGUIU }]);
    expect(base.historico.some((h) => h.id === id && h.message.startsWith("Cliente avisado pelo WhatsApp"))).toBe(true);
  });

  it("já saiu hoje outra mensagem automática a este número (d85): segue, mas sem o WhatsApp", async () => {
    base.fio = [{ direccao: "in", texto: "Olá", haSegundos: 3 * 3600 }];
    base.jaSaiuHoje = true;
    const id = pedido({}, "whatsapp");
    await rotinaDoEnvioAutomatico(AS_15H30);
    expect(base.enviados.map((e) => e.id)).toEqual([id]);
    expect(base.avisos).toEqual([]);
    expect(base.historico.some((h) => h.message.includes("já saiu hoje outra mensagem automática"))).toBe(true);
  });

  it("os incompletos não se vêem: a Mesa já diz o que falta", async () => {
    const id = pedido();
    base.faltas.set(id, ["fotografias"]);
    const r = await rotinaDoEnvioAutomatico(AS_15H30);
    expect(r.vistos).toBe(0);
    expect(base.tabela.has(id)).toBe(false);
  });
});

describe("os que ficam com uma pessoa, com o motivo no cartão", () => {
  const ficou = async (id: number, motivo: string, texto: string) => {
    await rotinaDoEnvioAutomatico(AS_15H30);
    expect(base.enviados).toEqual([]);
    expect(base.tabela.get(id)?.motivo).toBe(motivo);
    const linha = (await linhasDoEnvioAutomaticoNaMesa([id], AS_15H30)).get(id) ?? "";
    expect(linha).toContain("Não seguiu sozinho para os parceiros:");
    expect(linha).toContain(texto);
  };

  it("registado na Mesa e atribuído a uma pessoa", async () => {
    await ficou(pedido({ assignedToId: 4 }, "backoffice"), "atribuido", "alguém da equipa está a tratar dele");
  });
  it("Trabalho CLYON / valor fixo", async () => {
    await ficou(pedido({ valorFixoClyon: "120.00" }), "trabalho_clyon", "Trabalho CLYON");
  });
  it("a equipa já enviou uma proposta ao cliente", async () => {
    await ficou(pedido({ propostaEnviadaEm: "2026-11-23 11:00:00" }), "proposta_enviada", "proposta");
  });
  it("mudança com parceiros escolhidos pelo cliente", async () => {
    await ficou(pedido({ serviceType: "mudanca", escolhaDosParceirosJson: '{"em":"x"}' }), "escolhidos_pelo_cliente", "escolhidos pelo cliente");
  });
  it("acima de 500 € com IVA", async () => {
    await ficou(pedido({ estimateTotal: "480.00", estimateMax: "615.00" }), "acima_de_500", "500 € com IVA");
  });
  it("com nota da equipa", async () => {
    await ficou(pedido({ notasInternas: "Cliente pediu para ligar." }), "com_nota", "nota da equipa");
  });
  it("outro serviço", async () => {
    await ficou(pedido({ serviceType: "outro" }), "servico_fora", "não é da lista");
  });
  it("o formulário a meio", async () => {
    await ficou(pedido({}, "hero_quote_parcial"), "origem_fora", "origem");
  });
  it("a conversa do WhatsApp está com a equipa", async () => {
    base.interrompido = true;
    await ficou(pedido({}, "whatsapp"), "com_a_equipa", "pessoa da equipa");
  });
  it("a equipa escreveu à mão na conversa (d73)", async () => {
    base.fio = [{ direccao: "out", texto: `${MARCA_DE_MAO} Já vi o seu pedido.`, haSegundos: 3600 }];
    await ficou(pedido({}, "whatsapp"), "equipa_escreveu", "escreveu à mão");
  });
  it("registado pela Vitória sem o SIM do cliente — e esse nunca se revê sozinho", async () => {
    const id = pedido({ historyJson: JSON.stringify([{ message: "Registado sozinho pela Vitória: o cliente não respondeu ao resumo em 30 minutos." }]) }, "whatsapp");
    await ficou(id, "registado_sozinho", "SIM do cliente");
    // Uma hora depois, a rotina não volta a olhar para ele.
    const r = await rotinaDoEnvioAutomatico(new Date("2026-11-23T17:00:00Z"));
    expect(r.vistos).toBe(0);
  });
  it("o histórico diz o motivo uma vez — e o pedido revê-se de hora a hora, não a cada passagem", async () => {
    const id = pedido({ assignedToId: 4 }, "backoffice");
    await rotinaDoEnvioAutomatico(AS_15H30);
    const r2 = await rotinaDoEnvioAutomatico(new Date("2026-11-23T15:45:00Z"));
    expect(r2.vistos).toBe(0);
    expect(base.historico.filter((h) => h.id === id && h.message.includes("alguém da equipa"))).toHaveLength(1);
    // Tiraram-lhe a pessoa: na revisão de hora a hora, segue.
    base.pedidos.set(id, { ...base.pedidos.get(id)!, assignedToId: null });
    base.tabela.get(id)!.vistoEm = new Date("2026-11-23T15:30:00Z");
    await rotinaDoEnvioAutomatico(new Date("2026-11-23T16:45:00Z"));
    expect(base.enviados.map((e) => e.id)).toEqual([id]);
  });
});

describe("a espera: nunca antes dos 10 minutos", () => {
  it("entrou há 5 minutos: na fila, «Segue sozinho às 15:45», e sai nessa passagem", async () => {
    const id = pedido({ createdAt: new Date("2026-11-23T15:25:00Z") });
    const r = await rotinaDoEnvioAutomatico(AS_15H30);
    expect(r.aEsperar).toBe(1);
    expect(base.enviados).toEqual([]);
    expect(base.tabela.get(id)).toMatchObject({ estado: "na_fila", origem: "orcamentos_novos" });
    expect((await linhasDoEnvioAutomaticoNaMesa([id], AS_15H30)).get(id)).toBe("Segue sozinho às 15:45, para 3 parceiros.");
    expect(base.historico.some((h) => h.id === id && h.message.includes("às 15:45"))).toBe(true);

    await rotinaDoEnvioAutomatico(new Date("2026-11-23T15:45:00Z"));
    expect(base.enviados.map((e) => e.id)).toEqual([id]);
    expect(base.tabela.get(id)?.estado).toBe("enviado");
  });

  it("o cliente escreveu há 2 minutos: espera — e se voltar a escrever, espera outra vez", async () => {
    base.fio = [{ direccao: "in", texto: "Mando já as fotografias.", haSegundos: 120 }];
    const id = pedido({}, "whatsapp");
    await rotinaDoEnvioAutomatico(AS_15H30);
    expect(base.enviados).toEqual([]);
    expect(base.tabela.get(id)?.estado).toBe("na_fila");

    // Às 15h45 já passou a hora — mas o cliente acabou de mandar outra mensagem.
    base.fio = [{ direccao: "in", texto: "Aqui vai mais uma.", haSegundos: 30 }];
    await rotinaDoEnvioAutomatico(new Date("2026-11-23T15:45:00Z"));
    expect(base.enviados).toEqual([]);
    expect(base.tabela.get(id)?.estado).toBe("na_fila");

    base.fio = [{ direccao: "in", texto: "Aqui vai mais uma.", haSegundos: 900 }];
    await rotinaDoEnvioAutomatico(new Date("2026-11-23T16:00:00Z"));
    expect(base.enviados.map((e) => e.id)).toEqual([id]);
  });

  it("de noite: na fila para as 8h00, e o cartão diz quando", async () => {
    const id = pedido({ createdAt: new Date("2026-11-23T21:40:00Z") });
    const r = await rotinaDoEnvioAutomatico(DE_NOITE);
    expect(r.foraDaJanela).toBe(true);
    expect(base.enviados).toEqual([]);
    expect((await linhasDoEnvioAutomaticoNaMesa([id], DE_NOITE)).get(id)).toBe("Segue sozinho a 24/11 às 08:00, para 3 parceiros.");
    await rotinaDoEnvioAutomatico(new Date("2026-11-24T08:00:00Z"));
    expect(base.enviados.map((e) => e.id)).toEqual([id]);
  });

  it("os da Vitória continuam como na d87: seguem logo, sem a espera", async () => {
    base.fio = [{ direccao: "in", texto: "Aqui está a fotografia.", haSegundos: 5 }];
    const id = pedido({ createdAt: new Date("2026-11-23T15:28:00Z") }, "whatsapp");
    const r = await seguirSozinhoParaOsParceiros(id, { origem: "pedir_o_que_falta", agora: AS_15H30 });
    expect(r).toEqual({ estado: "enviado", receberam: 3 });
    expect(base.enviados[0].opcoes).toMatchObject({ pelaVitoria: true });
    // A Vitória responde ela própria na conversa: a rotina não manda outra mensagem.
    expect(base.avisos).toEqual([]);
  });
});

describe("cinco envios por passagem, os mais recentes primeiro", () => {
  it("sete completos: cinco agora, dois na passagem seguinte", async () => {
    const ids = Array.from({ length: 7 }, () => pedido());
    const r1 = await rotinaDoEnvioAutomatico(AS_15H30);
    expect(r1.enviadosDosNovos).toBe(5);
    expect(base.enviados.map((e) => e.id)).toEqual([...ids].reverse().slice(0, 5));
    const r2 = await rotinaDoEnvioAutomatico(new Date("2026-11-23T15:45:00Z"));
    expect(r2.enviadosDosNovos).toBe(2);
    expect(new Set(base.enviados.map((e) => e.id))).toEqual(new Set(ids));
  });
});

describe("os interruptores", () => {
  it("«Só os da Vitória» ligada: a rotina não varre, e os que esperavam ficam à espera", async () => {
    const id = pedido({ createdAt: new Date("2026-11-23T15:25:00Z") });
    await rotinaDoEnvioAutomatico(AS_15H30);
    base.soVitoria = 1;
    const r = await rotinaDoEnvioAutomatico(new Date("2026-11-23T15:45:00Z"));
    expect(r.soDaVitoria).toBe(true);
    expect(r.vistos).toBe(0);
    expect(base.enviados).toEqual([]);
    expect((await linhasDoEnvioAutomaticoNaMesa([id], AS_15H30)).get(id)).toContain("só para os da Vitória");
    expect(NOME_DO_INTERRUPTOR_SO_DA_VITORIA).toBe("Só os da Vitória");
  });
  it("o de emergência desligado: nada sai, de origem nenhuma", async () => {
    pedido();
    base.interruptor = 0;
    const r = await rotinaDoEnvioAutomatico(AS_15H30);
    expect(r.desligado).toBe(true);
    expect(base.enviados).toEqual([]);
  });
  it("sem linha na base: todas as origens, LIGADO", async () => {
    pedido();
    await rotinaDoEnvioAutomatico(AS_15H30);
    expect(base.enviados).toHaveLength(1);
  });
  it("na fila com o de emergência desligado: o cartão diz «enviaria a …»", () => {
    expect(
      linhaDoEnvioAutomaticoNaMesa({ estado: "na_fila", motivo: null, enviariaA: 2, mudadoEm: null, doVarrimento: true }, false, { agora: AS_15H30 }),
    ).toBe("Envio automático desligado nas Configs — enviaria a 2 parceiros.");
  });
});

/* ── A mesma função da Mesa, a mesma rotina ──────────────────────────────── */

describe("a d88 usa a MESMA função do botão «Negociação» e a MESMA rotina da d87", () => {
  const NA_BASE = semNotas(ler("src/lib/envio-automatico-aos-parceiros-na-base.ts"));
  const ENVIAR = semNotas(ler("src/lib/enviar-aos-profissionais.ts"));
  const PAINEL = ler("src/components/admin/AdminNegociacoesPanel.tsx");

  it("o botão «Negociação» da Mesa manda a caixa vazia à rota que chama enviarAosProfissionais", () => {
    expect(PAINEL).toContain("onClick={() => onPromover(p.id, valorDe[p.id]?.trim() || undefined)}");
    expect(PAINEL).toContain('fetch("/api/admin/negociacoes/promover", {');
    expect(semNotas(ler("src/app/api/admin/negociacoes/promover/route.ts"))).toContain("await enviarAosProfissionais(pedidoId, {");
  });
  it("a rotina envia pela mesma função, sem valor escrito, e nenhuma distribuição nova", () => {
    expect(NA_BASE).toContain("await enviarAosProfissionais(pedidoId, { baseUrl: urlDeAccao(), automaticamente: true })");
    expect(NA_BASE).not.toContain("distribuirPedido(");
    expect(NA_BASE).not.toContain("criarNegociacao(");
    expect(NA_BASE.indexOf("await reservarOEnvio(pool, pedidoId, opcoes.origem)")).toBeLessThan(NA_BASE.indexOf("await enviarAosProfissionais(pedidoId,"));
    expect(ENVIAR.match(/distribuirPedido\(/g)).toHaveLength(1);
  });
  it("o histórico diz «Enviado aos parceiros automaticamente (N parceiros)»", () => {
    expect(ENVIAR).toContain("? `Enviado aos parceiros automaticamente (${r.receberam} ${r.receberam === 1 ? \"parceiro\" : \"parceiros\"}). `");
  });
  it("uma só rotina e uma só tabela: nenhum cron novo", () => {
    const vercel = JSON.parse(ler("vercel.json")) as { crons: Array<{ path: string }> };
    expect(vercel.crons.filter((c) => c.path.includes("envio-aos-parceiros"))).toHaveLength(1);
    expect(NA_BASE.match(/CREATE TABLE IF NOT EXISTS envioAutomaticoAosParceiros/g)).toHaveLength(1);
    expect(NA_BASE).toContain("seguirApos DATETIME NULL DEFAULT NULL");
  });
  it("o interruptor só o administrador; a segunda chave pela mesma rota", () => {
    const rota = ler("src/app/api/admin/interruptor-do-envio-automatico/route.ts");
    expect(rota.match(/await requireAdminGeral\(req\)/g)).toHaveLength(2);
    expect(rota).toContain("await mudarSoOsDaVitoria(corpo.soDaVitoria, quem);");
  });
});
