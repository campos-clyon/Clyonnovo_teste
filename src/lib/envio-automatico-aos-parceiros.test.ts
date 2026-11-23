import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * OS PEDIDOS COMPLETOS PELA VITÓRIA SEGUEM SOZINHOS PARA OS PARCEIROS —
 * 22-11-2026 (decisão d87, CEO e dono). Pedidos, nomes e números INVENTADOS
 * (o repositório é público).
 *
 * As regras puras correm como são; a base corre FINGIDA: uma tabela em memória
 * que faz o que o MySQL faz com a reserva (INSERT IGNORE e UPDATE condicional,
 * contados pelas linhas mudadas), e a função da Mesa (`enviarAosProfissionais`)
 * substituída por uma que conta quantas vezes foi chamada.
 */

type Linha = {
  pedidoId: number;
  estado: string;
  motivo: string | null;
  origem: string | null;
  enviariaA: number | null;
  receberam: number | null;
  criadoEm: Date;
  mudadoEm: Date;
};

const base = vi.hoisted(() => ({
  tabela: new Map<number, Linha>(),
  interruptor: null as number | null,
  pedido: null as Record<string, unknown> | null,
  negs: [] as Array<{ estado: string }>,
  faltas: [] as string[],
  fio: [] as Array<{ direccao: string; texto: string; haSegundos: number | null }>,
  bloqueado: false,
  coordenadas: { lat: 38.66, lng: -9.17 } as { lat: number | null; lng: number | null },
  elegiveis: 3,
  receberam: 3,
  enviados: [] as number[],
  historico: [] as string[],
  /** d2: a limpeza das linhas presas falha (ou a negociação só aparece depois): a fila tem de se defender sozinha. */
  limpezaFalha: false,
  /** d2: o mesmo contacto tem outro pedido aberto nos últimos 7 dias. */
  outroAberto: false,
  /** d2: os pedidos da fila (por id) — a rotina da fila de várias linhas. */
  pedidos: new Map<number, Record<string, unknown>>(),
  negsPorPedido: new Map<number, Array<{ estado: string }>>(),
  sqlDoRepetido: [] as string[],
}));

vi.mock("@/lib/db", async (original) => {
  const mudadas = (n: number) => [{ affectedRows: n }, undefined];
  const execute = async (sql: string, p: unknown[] = []) => {
    const t = base.tabela;
    const agora = new Date();
    if (/^\s*CREATE TABLE/.test(sql)) return mudadas(0);
    // As colunas da d88 (23-11-2026) e a segunda chave «Só os da Vitória» (sem linha: desligada).
    if (/^\s*ALTER TABLE envioAutomaticoAosParceiros ADD COLUMN/.test(sql)) return mudadas(0);
    if (/FROM retencaoInterruptores/.test(sql) && p[0] === "envio_automatico_so_vitoria_d88") return [[], undefined];
    if (/FROM retencaoInterruptores/.test(sql)) {
      return [base.interruptor == null ? [] : [{ ligado: base.interruptor, mudadoEm: null, porQuem: "teste" }], undefined];
    }
    const nova = (l: Partial<Linha> & { pedidoId: number; estado: string }) => {
      if (t.has(l.pedidoId)) return mudadas(0);
      t.set(l.pedidoId, { motivo: null, origem: null, enviariaA: null, receberam: null, criadoEm: agora, mudadoEm: agora, ...l });
      return mudadas(1);
    };
    if (/INSERT IGNORE INTO envioAutomaticoAosParceiros/.test(sql)) {
      if (/'a_enviar'/.test(sql)) return nova({ pedidoId: Number(p[0]), estado: "a_enviar", origem: String(p[1]) });
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
    if (/SELECT COUNT\(\*\) AS n FROM envioAutomaticoAosParceiros/.test(sql)) {
      return [[{ n: [...t.values()].filter((l) => l.estado === "na_fila").length }], undefined];
    }
    if (/e\.motivo = 'ja_enviado'/.test(sql)) {
      if (base.limpezaFalha) throw new Error("a limpeza não correu");
      let n = 0;
      for (const l of t.values()) {
        const negs = base.negsPorPedido.get(l.pedidoId) ?? (base.pedidos.size === 0 ? base.negs : []);
        if (l.estado === "na_fila" && negs.length > 0) {
          Object.assign(l, { estado: "ficou", motivo: "ja_enviado", mudadoEm: agora });
          n++;
        }
      }
      return mudadas(n);
    }
    if (/e\.motivo = 'fechado'/.test(sql)) return mudadas(0);
    if (/SET motivo = \?, estado = 'ficou'/.test(sql)) {
      const l = t.get(Number(p[1]));
      if (!l || l.estado !== "na_fila") return mudadas(0);
      Object.assign(l, { estado: "ficou", motivo: String(p[0]), mudadoEm: agora });
      return mudadas(1);
    }
    if (/FROM simulatorOrders o\s+WHERE o\.id < \?/.test(sql)) {
      base.sqlDoRepetido.push(sql);
      return [base.outroAberto ? [{ id: 1 }] : [], undefined];
    }
    if (/SELECT pedidoId, origem FROM envioAutomaticoAosParceiros\s+WHERE estado = 'na_fila'/.test(sql)) {
      return [[...t.values()].filter((l) => l.estado === "na_fila").map((l) => ({ pedidoId: l.pedidoId, origem: l.origem })), undefined];
    }
    if (/SELECT pedidoId, estado, motivo, enviariaA, mudadoEm/.test(sql)) {
      return [[...t.values()].filter((l) => p.includes(l.pedidoId)), undefined];
    }
    throw new Error(`SQL por fingir: ${sql.slice(0, 80)}`);
  };
  return {
    ...(await original<typeof import("@/lib/db")>()),
    getPool: vi.fn(async () => ({ execute })),
    getSimulatorOrderById: vi.fn(async (id?: number) => (base.pedidos.size > 0 ? base.pedidos.get(Number(id)) : base.pedido)),
    negociacoesDoPedido: vi.fn(async (id?: number) => base.negsPorPedido.get(Number(id)) ?? base.negs),
    mensagensDoNumeroWhatsApp: vi.fn(async () => base.fio),
    numeroBloqueadoWhatsApp: vi.fn(async () => base.bloqueado),
    // A rotina da d88 varre os «Orçamentos novos»: aqui não há nenhum (os testes da d88 estão noutro ficheiro).
    pedidosPorPromover: vi.fn(async () => []),
    appendOrderHistory: vi.fn(async (_id: number, e: { message: string }) => {
      base.historico.push(e.message);
    }),
  };
});
vi.mock("@/lib/o-que-falta-no-pedido", async (original) => ({
  ...(await original<typeof import("@/lib/o-que-falta-no-pedido")>()),
  oQueFaltaNoPedido: vi.fn(() => base.faltas),
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
  enviarAosProfissionais: vi.fn(async (pedidoId: number, o: { pelaVitoria?: boolean }) => {
    expect(o.pelaVitoria).toBe(true);
    base.enviados.push(pedidoId);
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

import {
  aEquipaEscreveuDepoisDoModelo,
  codigoPostalValido,
  coordenadasValidas,
  historicoDaFila,
  linhaDoEnvioAutomaticoNaMesa,
  MOTIVOS_DO_ENVIO_AUTOMATICO,
  naJanelaDoEnvioAutomatico,
  NOME_DO_INTERRUPTOR_DO_ENVIO_AUTOMATICO,
  porqueNaoSegueSozinho,
  servicoDaListaDaClyon,
  dataPedidaJaPassou,
  type CandidatoAoEnvioAutomatico,
} from "./envio-automatico-aos-parceiros";
import {
  linhasDoEnvioAutomaticoNaMesa,
  resumoDaRotinaDoEnvioAutomatico,
  rotinaDoEnvioAutomatico,
  seguirSozinhoParaOsParceiros,
} from "./envio-automatico-aos-parceiros-na-base";
import { PEDIDO_FICA_COMPLETO, PEDIDO_JA_SEGUIU, respostaAoQueFalta } from "./resposta-ao-que-falta";
import { mensagemDePedidoRegistado } from "./whatsapp-recolha";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";
import { mensagemDoQueFalta } from "./mensagem-do-que-falta";
import { MARCA_DE_MAO } from "./rajada-do-whatsapp";

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");
/* Só os comentários que começam a linha — ver a memória dos testes que lêem o código. */
const semNotas = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

// Domingo, 22-11-2026 (Inverno: Lisboa = UTC).
const DE_TARDE = new Date("2026-11-22T15:30:00Z");
const DE_NOITE = new Date("2026-11-22T22:30:00Z");
const AS_8H = new Date("2026-11-23T08:00:00Z");

const COMPLETO: CandidatoAoEnvioAutomatico = {
  status: "sem_assistente",
  serviceType: "recolha_moveis",
  contactName: "Leonor Teixo",
  contactEmail: "leonor@exemplo.pt",
  faltas: [],
  codigoPostal: "2800-123",
  valorFixoClyon: null,
};

const PEDIDO_COMPLETO = {
  id: 9101,
  status: "sem_assistente",
  serviceType: "recolha_moveis",
  contactName: "Leonor Teixo",
  contactEmail: "leonor@exemplo.pt",
  contactPhone: "910000001",
  postalCode: "2800-123",
  city: "Almada",
  address: "Rua das Flores 3",
  urgency: null,
  rawOrderJson: "{}",
  valorFixoClyon: null,
};

beforeEach(() => {
  base.tabela.clear();
  base.interruptor = null;
  base.pedido = { ...PEDIDO_COMPLETO };
  base.negs = [];
  base.faltas = [];
  base.fio = [{ direccao: "in", texto: "Boa tarde, aqui vão os dados.", haSegundos: 30 }];
  base.bloqueado = false;
  base.coordenadas = { lat: 38.66, lng: -9.17 };
  base.elegiveis = 3;
  base.receberam = 3;
  base.enviados = [];
  base.historico = [];
  base.limpezaFalha = false;
  base.outroAberto = false;
  base.pedidos.clear();
  base.negsPorPedido.clear();
  base.sqlDoRepetido = [];
});

/* ── As regras puras ─────────────────────────────────────────────────────── */

describe("os avisos aos parceiros só saem das 8h00 às 21h00 de Lisboa", () => {
  it("no Inverno (Lisboa = UTC)", () => {
    expect(naJanelaDoEnvioAutomatico(new Date("2026-11-22T07:59:00Z"))).toBe(false);
    expect(naJanelaDoEnvioAutomatico(new Date("2026-11-22T08:00:00Z"))).toBe(true);
    expect(naJanelaDoEnvioAutomatico(new Date("2026-11-22T20:59:00Z"))).toBe(true);
    expect(naJanelaDoEnvioAutomatico(new Date("2026-11-22T21:00:00Z"))).toBe(false);
  });
  it("no Verão (Lisboa = UTC+1): pelo relógio de Lisboa, nunca pelo do servidor", () => {
    expect(naJanelaDoEnvioAutomatico(new Date("2026-07-10T07:30:00Z"))).toBe(true); // 8h30 em Lisboa
    expect(naJanelaDoEnvioAutomatico(new Date("2026-07-10T20:30:00Z"))).toBe(false); // 21h30 em Lisboa
  });
});

describe("as condições puras — todas obrigatórias", () => {
  it("completo, da lista, com código postal: segue", () => {
    expect(porqueNaoSegueSozinho(COMPLETO)).toBeNull();
  });
  it("cada condição que falha deixa-o nos «por enviar», com o motivo", () => {
    expect(porqueNaoSegueSozinho({ ...COMPLETO, faltas: ["fotografias"] })).toBe("incompleto");
    expect(porqueNaoSegueSozinho({ ...COMPLETO, codigoPostal: "2800" })).toBe("sem_codigo_postal");
    expect(porqueNaoSegueSozinho({ ...COMPLETO, codigoPostal: null })).toBe("sem_codigo_postal");
    expect(porqueNaoSegueSozinho({ ...COMPLETO, serviceType: "montagem_moveis" })).toBe("servico_fora");
    expect(porqueNaoSegueSozinho({ ...COMPLETO, serviceType: "jardinagem" })).toBe("servico_fora");
    expect(porqueNaoSegueSozinho({ ...COMPLETO, serviceType: "outro" })).toBe("servico_fora");
    expect(porqueNaoSegueSozinho({ ...COMPLETO, contactName: "Fred Teste" })).toBe("de_teste");
    expect(porqueNaoSegueSozinho({ ...COMPLETO }, new Set(["leonor@exemplo.pt"]))).toBe("de_teste");
    for (const s of ["cancelado", "arquivado", "rejeitado", "concluido"]) {
      expect(porqueNaoSegueSozinho({ ...COMPLETO, status: s })).toBe("fechado");
    }
    expect(porqueNaoSegueSozinho({ ...COMPLETO, status: "precisa_info" })).toBe("precisa_info");
    expect(porqueNaoSegueSozinho({ ...COMPLETO, valorFixoClyon: 120 })).toBe("trabalho_clyon");
    expect(porqueNaoSegueSozinho({ ...COMPLETO, porTraduzir: true })).toBe("por_traduzir");
    expect(porqueNaoSegueSozinho({ ...COMPLETO, registadoSozinho: true })).toBe("registado_sozinho");
  });
  it("os serviços da lista da CLYON: recolhas, esvaziamentos, mudanças e manutenção", () => {
    for (const s of ["recolha_moveis", "recolha_monos", "recolha_entulho", "esvaziamento_casa", "esvaziamento_empresa", "mudanca", "manutencao_casa"]) {
      expect(servicoDaListaDaClyon(s), s).toBe(true);
    }
    for (const s of ["montagem_moveis", "jardinagem", "outro", "limpeza_pos_obra", "", null]) {
      expect(servicoDaListaDaClyon(s as string | null), String(s)).toBe(false);
    }
  });
  it("o código postal e as coordenadas", () => {
    expect(codigoPostalValido("1950-123")).toBe(true);
    expect(codigoPostalValido(" 2900-001 ")).toBe(true);
    expect(codigoPostalValido("0950-123")).toBe(false);
    expect(codigoPostalValido("1950123")).toBe(false);
    expect(coordenadasValidas(38.72, -9.14)).toBe(true);
    expect(coordenadasValidas(0, 0)).toBe(false);
    expect(coordenadasValidas(null, -9.14)).toBe(false);
    expect(coordenadasValidas(48.85, 2.35)).toBe(false); // Paris
    expect(coordenadasValidas(Number.NaN, -9.14)).toBe(false);
  });
});

describe("a regra d73: a equipa escreveu à mão depois do último envio de modelo", () => {
  const DO_MODELO = { id: 9101, serviceType: "recolha_moveis", contactName: "Leonor Teixo" };
  const MODELO = mensagemDoQueFalta(DO_MODELO, ["fotografias"], DE_TARDE);
  it("o modelo e a resposta do cliente: não", () => {
    const fio = [
      { direccao: "out", texto: `${MARCA_DE_MAO} ${MODELO}`, haSegundos: 600 },
      { direccao: "in", texto: "Aqui vai a fotografia.", haSegundos: 10 },
    ];
    expect(aEquipaEscreveuDepoisDoModelo(fio)).toBe(false);
  });
  it("uma mensagem à mão depois do modelo: sim, fica para a equipa", () => {
    const fio = [
      { direccao: "out", texto: `${MARCA_DE_MAO} ${MODELO}`, haSegundos: 600 },
      { direccao: "out", texto: `${MARCA_DE_MAO} Já agora, tem elevador?`, haSegundos: 300 },
      { direccao: "in", texto: "Tem.", haSegundos: 10 },
    ];
    expect(aEquipaEscreveuDepoisDoModelo(fio)).toBe(true);
  });
  it("sem modelo, vale a regra das 12 horas", () => {
    expect(aEquipaEscreveuDepoisDoModelo([{ direccao: "out", texto: `${MARCA_DE_MAO} Olá!`, haSegundos: 3600 }])).toBe(true);
    expect(aEquipaEscreveuDepoisDoModelo([{ direccao: "out", texto: `${MARCA_DE_MAO} Olá!`, haSegundos: 13 * 3600 }])).toBe(false);
    expect(aEquipaEscreveuDepoisDoModelo([{ direccao: "out", texto: "Olá! Sou a Vitória.", haSegundos: 60 }])).toBe(false);
  });
});

describe("o cartão dos «por enviar» diz o que aconteceu", () => {
  const quando = new Date("2026-11-22T22:30:00Z");
  it("na fila, desligado, e o motivo", () => {
    // d88: «Segue sozinho às HH:MM» — às 22h30 é a passagem das 8h00 do dia seguinte.
    expect(linhaDoEnvioAutomaticoNaMesa({ estado: "na_fila", motivo: null, enviariaA: 3, mudadoEm: quando }, true, { agora: quando })).toBe(
      "Segue sozinho a 23/11 às 08:00, para 3 parceiros.",
    );
    expect(linhaDoEnvioAutomaticoNaMesa({ estado: "ficou", motivo: "desligado", enviariaA: 1, mudadoEm: null }, false)).toBe(
      "Envio automático desligado nas Configs — enviaria a 1 parceiro.",
    );
    expect(linhaDoEnvioAutomaticoNaMesa({ estado: "na_fila", motivo: null, enviariaA: 2, mudadoEm: null }, false)).toBe(
      "Envio automático desligado nas Configs — enviaria a 2 parceiros.",
    );
    expect(linhaDoEnvioAutomaticoNaMesa({ estado: "ficou", motivo: "sem_parceiros", enviariaA: null, mudadoEm: null }, true)).toBe(
      "Não seguiu sozinho para os parceiros: sem parceiros na zona.",
    );
    expect(linhaDoEnvioAutomaticoNaMesa({ estado: "enviado", motivo: null, enviariaA: 3, mudadoEm: null }, true)).toBeNull();
  });
  it("o nome do interruptor e o histórico da fila", () => {
    expect(NOME_DO_INTERRUPTOR_DO_ENVIO_AUTOMATICO).toBe("Envio automático aos parceiros (todas as origens)");
    expect(historicoDaFila(2)).toContain("sai às 8h00");
    expect(MOTIVOS_DO_ENVIO_AUTOMATICO.sem_parceiros).toBe("sem parceiros na zona");
  });
});

/* ── Com a base fingida ──────────────────────────────────────────────────── */

describe("completo e elegível: envia uma vez — e repetir não reenvia", () => {
  it("envia pela função da Mesa, marca «enviado» e não volta a enviar", async () => {
    const r = await seguirSozinhoParaOsParceiros(9101, { origem: "pedir_o_que_falta", agora: DE_TARDE });
    expect(r).toEqual({ estado: "enviado", receberam: 3 });
    expect(base.enviados).toEqual([9101]);
    expect(base.tabela.get(9101)?.estado).toBe("enviado");

    // Outra mensagem do cliente logo a seguir, antes de as negociações se verem: a reserva trava.
    const outra = await seguirSozinhoParaOsParceiros(9101, { origem: "pedir_o_que_falta", agora: DE_TARDE });
    expect(outra).toEqual({ estado: "reservado" });
    // E com as negociações já na base: «já enviado», sem escrever nada.
    base.negs = [{ estado: "aberta" }];
    const terceira = await seguirSozinhoParaOsParceiros(9101, { origem: "registado", agora: DE_TARDE });
    expect(terceira).toEqual({ estado: "ja_enviado" });
    expect(base.enviados).toEqual([9101]);
  });

  it("duas execuções ao mesmo tempo: só uma ganha a reserva", async () => {
    const [a, b] = await Promise.all([
      seguirSozinhoParaOsParceiros(9101, { origem: "pedir_o_que_falta", agora: DE_TARDE }),
      seguirSozinhoParaOsParceiros(9101, { origem: "registado", agora: DE_TARDE }),
    ]);
    expect([a.estado, b.estado].sort()).toEqual(["enviado", "reservado"]);
    expect(base.enviados).toEqual([9101]);
  });
});

describe("o que fica nos «por enviar», com o motivo", () => {
  const ficou = async (motivo: string) => {
    const r = await seguirSozinhoParaOsParceiros(9101, { origem: "registado", agora: DE_TARDE });
    expect(r.estado).toBe("ficou");
    expect((r as { motivo: string }).motivo).toBe(motivo);
    expect(base.enviados).toEqual([]);
    expect(base.tabela.get(9101)?.motivo).toBe(motivo);
    const linha = (await linhasDoEnvioAutomaticoNaMesa([9101])).get(9101) ?? "";
    expect(linha).toContain("Não seguiu sozinho para os parceiros:");
    return linha;
  };

  it("falta a coordenada", async () => {
    base.coordenadas = { lat: null, lng: null };
    expect(await ficou("sem_coordenadas")).toContain("coordenadas válidas");
  });
  it("falta o código postal", async () => {
    base.pedido = { ...PEDIDO_COMPLETO, postalCode: null, rawOrderJson: "{}" };
    expect(await ficou("sem_codigo_postal")).toContain("código postal");
  });
  it("o código postal guardado no formulário conta", async () => {
    base.pedido = { ...PEDIDO_COMPLETO, postalCode: null, rawOrderJson: JSON.stringify({ address: { postalCode: "2800-123" } }) };
    expect((await seguirSozinhoParaOsParceiros(9101, { origem: "registado", agora: DE_TARDE })).estado).toBe("enviado");
  });
  it("ainda falta informação: não é candidato — não sai, e o cartão não repete o que a Mesa já mostra", async () => {
    base.faltas = ["fotografias"];
    const r = await seguirSozinhoParaOsParceiros(9101, { origem: "registado", agora: DE_TARDE });
    expect(r).toEqual({ estado: "ficou", motivo: "incompleto" });
    expect(base.enviados).toEqual([]);
    expect(base.tabela.has(9101)).toBe(false);
    expect(base.historico).toEqual([]);
  });
  it("conta de teste", async () => {
    base.pedido = { ...PEDIDO_COMPLETO, contactName: "Cliente Teste" };
    await ficou("de_teste");
  });
  it("número bloqueado", async () => {
    base.bloqueado = true;
    await ficou("bloqueado");
  });
  it("serviço fora da lista", async () => {
    base.pedido = { ...PEDIDO_COMPLETO, serviceType: "montagem_moveis" };
    await ficou("servico_fora");
  });
  it("cancelado ou arquivado", async () => {
    base.pedido = { ...PEDIDO_COMPLETO, status: "arquivado" };
    await ficou("fechado");
  });
  it("a equipa escreveu à mão", async () => {
    base.fio = [{ direccao: "out", texto: `${MARCA_DE_MAO} Boa tarde, já vi o seu pedido.`, haSegundos: 120 }];
    await ficou("equipa_escreveu");
  });
  it("0 parceiros elegíveis: «sem parceiros na zona»", async () => {
    base.elegiveis = 0;
    expect(await ficou("sem_parceiros")).toContain("sem parceiros na zona");
  });
  it("a distribuição não chegou a ninguém: fica, e não se reenvia sozinho", async () => {
    base.receberam = 0;
    const r = await seguirSozinhoParaOsParceiros(9101, { origem: "registado", agora: DE_TARDE });
    expect(r).toEqual({ estado: "ficou", motivo: "nao_chegou", enviariaA: 3 });
    expect(base.enviados).toEqual([9101]);
  });
  it("o histórico diz o motivo uma vez, e não a cada mensagem", async () => {
    base.elegiveis = 0;
    await seguirSozinhoParaOsParceiros(9101, { origem: "registado", agora: DE_TARDE });
    await seguirSozinhoParaOsParceiros(9101, { origem: "pedir_o_que_falta", agora: DE_TARDE });
    expect(base.historico.filter((h) => h.includes("sem parceiros na zona"))).toHaveLength(1);
  });
  it("ficou por um motivo e depois ficou completo: segue", async () => {
    base.faltas = ["fotografias"];
    await seguirSozinhoParaOsParceiros(9101, { origem: "registado", agora: DE_TARDE });
    base.faltas = [];
    expect((await seguirSozinhoParaOsParceiros(9101, { origem: "pedir_o_que_falta", agora: DE_TARDE })).estado).toBe("enviado");
    expect(base.enviados).toEqual([9101]);
  });
});

describe("fora de horas: fica na fila e sai às 8h00", () => {
  it("às 22h30 não sai nada; às 8h00 a rotina envia, uma vez", async () => {
    const r = await seguirSozinhoParaOsParceiros(9101, { origem: "pedir_o_que_falta", agora: DE_NOITE });
    expect(r).toEqual({ estado: "na_fila", enviariaA: 3 });
    expect(base.enviados).toEqual([]);
    expect(base.historico.some((h) => h.includes("sai às 8h00"))).toBe(true);
    expect((await linhasDoEnvioAutomaticoNaMesa([9101], DE_NOITE)).get(9101)).toBe("Segue sozinho a 23/11 às 08:00, para 3 parceiros.");

    // A rotina das 7h45 ainda não solta.
    const cedo = await rotinaDoEnvioAutomatico(new Date("2026-11-23T07:45:00Z"));
    expect(cedo.foraDaJanela).toBe(true);
    expect(base.enviados).toEqual([]);

    const r8 = await rotinaDoEnvioAutomatico(AS_8H);
    expect(r8).toMatchObject({ naFila: 1, enviados: 1, ficaram: 0 });
    expect(base.enviados).toEqual([9101]);
    expect(base.tabela.get(9101)?.estado).toBe("enviado");

    // A passagem seguinte não reenvia.
    await rotinaDoEnvioAutomatico(new Date("2026-11-23T08:15:00Z"));
    expect(base.enviados).toEqual([9101]);
  });

  it("às 8h00 volta a ver as condições: cancelado de noite, não sai", async () => {
    await seguirSozinhoParaOsParceiros(9101, { origem: "registado", agora: DE_NOITE });
    base.pedido = { ...PEDIDO_COMPLETO, status: "cancelado" };
    const r8 = await rotinaDoEnvioAutomatico(AS_8H);
    expect(r8).toMatchObject({ naFila: 1, enviados: 0, ficaram: 1 });
    expect(base.enviados).toEqual([]);
  });

  it("enviado à mão pela equipa de noite: às 8h00 não sai outra vez", async () => {
    await seguirSozinhoParaOsParceiros(9101, { origem: "registado", agora: DE_NOITE });
    base.negs = [{ estado: "aberta" }];
    await rotinaDoEnvioAutomatico(AS_8H);
    expect(base.enviados).toEqual([]);
  });
});

describe("o interruptor de emergência desligado: nada sai", () => {
  it("fica nos «por enviar» e o cartão diz «enviaria a …»", async () => {
    base.interruptor = 0;
    const r = await seguirSozinhoParaOsParceiros(9101, { origem: "pedir_o_que_falta", agora: DE_TARDE });
    expect(r).toEqual({ estado: "ficou", motivo: "desligado", enviariaA: 3 });
    expect(base.enviados).toEqual([]);
    expect((await linhasDoEnvioAutomaticoNaMesa([9101])).get(9101)).toContain("enviaria a 3 parceiros");
  });
  it("a fila também espera", async () => {
    await seguirSozinhoParaOsParceiros(9101, { origem: "pedir_o_que_falta", agora: DE_NOITE });
    base.interruptor = 0;
    const r8 = await rotinaDoEnvioAutomatico(AS_8H);
    expect(r8.desligado).toBe(true);
    expect(base.enviados).toEqual([]);
    expect((await linhasDoEnvioAutomaticoNaMesa([9101])).get(9101)).toContain("enviaria a 3 parceiros");
  });
  it("sem linha na base está LIGADO (o dono pediu); com a linha a 1 também", async () => {
    base.interruptor = null;
    expect((await seguirSozinhoParaOsParceiros(9101, { origem: "registado", agora: DE_TARDE })).estado).toBe("enviado");
    base.tabela.clear();
    base.enviados = [];
    base.interruptor = 1;
    expect((await seguirSozinhoParaOsParceiros(9101, { origem: "registado", agora: DE_TARDE })).estado).toBe("enviado");
  });
});

/* ── A mensagem ao cliente ───────────────────────────────────────────────── */

describe("a mensagem da Vitória ao cliente diz a verdade", () => {
  const PARA = {
    pedidoId: 9101,
    nome: "Leonor",
    servico: "recolha_moveis",
    anotado: ["estacionamento"] as const,
    quando: null,
    faltam: [],
    apresentar: false,
  };
  it("com o envio feito: «O seu pedido já seguiu…»", () => {
    const m = respostaAoQueFalta({ ...PARA, anotado: [...PARA.anotado], jaSeguiu: true });
    expect(m).toContain("O seu pedido já seguiu para os parceiros da sua zona. As propostas chegam-lhe por aqui.");
    expect(m).not.toContain(PEDIDO_FICA_COMPLETO);
  });
  it("se ficou nos «por enviar» (ou na fila): «a equipa confere-o e segue…»", () => {
    const m = respostaAoQueFalta({ ...PARA, anotado: [...PARA.anotado], jaSeguiu: false });
    expect(m).toContain(PEDIDO_FICA_COMPLETO);
    expect(m).not.toContain(PEDIDO_JA_SEGUIU);
    expect(PEDIDO_FICA_COMPLETO).toContain("a equipa confere-o e segue para os parceiros");
  });
  it("o pedido registado já completo também diz que seguiu", () => {
    expect(mensagemDePedidoRegistado(9101, true, "Leonor", false, true)).toContain("O seu pedido já seguiu para os parceiros da sua zona");
    expect(mensagemDePedidoRegistado(9101, true, "Leonor")).toContain("A CLYON vai conferi-lo e enviá-lo aos parceiros");
  });
  it("traduções fixas em inglês, francês e espanhol", () => {
    for (const lingua of ["en", "fr", "es"] as const) {
      for (const texto of [
        respostaAoQueFalta({ ...PARA, anotado: [...PARA.anotado], jaSeguiu: true }),
        respostaAoQueFalta({ ...PARA, anotado: [...PARA.anotado], jaSeguiu: false }),
        mensagemDePedidoRegistado(9101, true, "Leonor", false, true),
      ]) {
        const t = traducaoFixa(texto, lingua);
        expect(t, `${lingua}: ${texto}`).not.toBeNull();
        expect(t).not.toContain("já seguiu");
      }
    }
    expect(traducaoFixa(PEDIDO_JA_SEGUIU, "en")).toBe("Your request has already gone to the partners in your area. The quotes will reach you here.");
  });
});

/* ── A mesma função da Mesa ──────────────────────────────────────────────── */

describe("o envio automático usa a MESMA função do «Enviar aos profissionais» da Mesa", () => {
  const ROTA = semNotas(ler("src/app/api/admin/negociacoes/promover/route.ts"));
  const ENVIAR = semNotas(ler("src/lib/enviar-aos-profissionais.ts"));
  const NA_BASE = semNotas(ler("src/lib/envio-automatico-aos-parceiros-na-base.ts"));
  const NEG = semNotas(ler("src/lib/whatsapp-negociacao.ts"));
  const SIMULADOR = semNotas(ler("src/app/api/simulador/pedido/route.ts"));

  it("a rota da Mesa chama enviarAosProfissionais e já não distribui por si", () => {
    expect(ROTA).toContain("await enviarAosProfissionais(pedidoId, {");
    expect(ROTA).not.toContain("distribuirPedido(");
  });
  it("enviarAosProfissionais é quem distribui — uma vez", () => {
    expect(ENVIAR.match(/distribuirPedido\(/g)).toHaveLength(1);
    expect(ENVIAR).toContain("export async function enviarAosProfissionais(");
  });
  it("o envio automático chama a mesma função, e nenhuma distribuição nova", () => {
    expect(NA_BASE).toContain('import { enviarAosProfissionais } from "@/lib/enviar-aos-profissionais";');
    expect(NA_BASE).toContain("await enviarAosProfissionais(pedidoId, { baseUrl: urlDeAccao(), pelaVitoria: true });");
    expect(NA_BASE).not.toContain("distribuirPedido(");
    expect(NA_BASE).not.toContain("criarNegociacao(");
    // A reserva vem antes do envio.
    expect(NA_BASE.indexOf("await reservarOEnvio(pool, pedidoId, opcoes.origem)")).toBeLessThan(
      NA_BASE.indexOf("await enviarAosProfissionais(pedidoId,"),
    );
  });
  it("a Vitória chama o envio automático nos três sítios, antes de responder", () => {
    expect(NEG).not.toContain("distribuirPedido(");
    expect(NEG).not.toContain("enviarAosProfissionais(");
    expect(NEG.match(/seguirSozinhoParaOsParceiros\(id, \{/g)?.length).toBe(3);
    expect(NEG).toContain('origem: "registado",');
    expect(NEG).toContain("registadoSozinho: opcoes.sozinho === true,");
    expect(NEG).toContain("mensagemDePedidoRegistado(id, comFotos, dados.contactName, opcoes.sozinho === true, jaSeguiu)");
    expect(NEG).toContain('jaSeguiu = envio?.estado === "enviado";');
    expect(NEG).toContain("    jaSeguiu,\n  });");
    expect(NEG).toContain('envio?.estado === "enviado" ? PEDIDO_JA_SEGUIU : PEDIDO_FICA_COMPLETO');
  });
  it("o simulador continua sem distribuir (só a mudança com escolhidos vai logo)", () => {
    expect(SIMULADOR).not.toContain("distribuirPedido");
    expect(SIMULADOR).not.toContain("envio-automatico-aos-parceiros");
  });
  it("o interruptor só o administrador; a rotina de 15 em 15 minutos carimba", () => {
    expect(ler("src/app/api/admin/interruptor-do-envio-automatico/route.ts")).toContain("await requireAdminGeral(req)");
    const cron = ler("src/app/api/cron/envio-aos-parceiros/route.ts");
    expect(cron).toContain('carimbarPassagem("envio-aos-parceiros"');
    const vercel = JSON.parse(ler("vercel.json")) as { crons: Array<{ path: string; schedule: string }> };
    expect(vercel.crons).toContainEqual({ path: "/api/cron/envio-aos-parceiros", schedule: "*/15 * * * *" });
  });
});

/* ── d2 (23-11-2026): a fila que não prende, a data que passou, o pedido repetido ── */

describe("d2 — o dia pedido não pode ter passado (em Lisboa)", () => {
  it("antes de hoje: passou; hoje e depois: não; sem data: não", () => {
    expect(dataPedidaJaPassou(new Date("2026-11-21T00:00:00Z"), DE_TARDE)).toBe(true);
    expect(dataPedidaJaPassou(new Date("2026-11-22T00:00:00Z"), DE_TARDE)).toBe(false);
    expect(dataPedidaJaPassou(new Date("2026-11-22T08:00:00Z"), DE_TARDE)).toBe(false);
    expect(dataPedidaJaPassou(new Date("2026-11-23T00:00:00Z"), DE_TARDE)).toBe(false);
    expect(dataPedidaJaPassou(null, DE_TARDE)).toBe(false);
    expect(dataPedidaJaPassou("lixo", DE_TARDE)).toBe(false);
  });
  it("conta-se no relógio de Lisboa, não no do servidor (Verão: 00h30 de Lisboa já é dia 11)", () => {
    const a1h30 = new Date("2026-07-10T23:30:00Z"); // 00h30 de 11/07 em Lisboa
    expect(dataPedidaJaPassou(new Date("2026-07-10T12:00:00Z"), a1h30)).toBe(true);
    expect(dataPedidaJaPassou(new Date("2026-07-10T23:15:00Z"), a1h30)).toBe(false); // 00h15 de 11/07: o mesmo dia
  });
  it("a condição pura e o motivo", () => {
    expect(porqueNaoSegueSozinho({ ...COMPLETO, dataAgendada: new Date("2026-11-20T00:00:00Z"), agora: DE_TARDE })).toBe("data_passada");
    expect(porqueNaoSegueSozinho({ ...COMPLETO, dataAgendada: new Date("2026-11-22T00:00:00Z"), agora: DE_TARDE })).toBeNull();
    expect(MOTIVOS_DO_ENVIO_AUTOMATICO.data_passada).toContain("já passou");
  });
  it("com a data passada o pedido não segue: fica nos «por enviar» com o motivo", async () => {
    base.pedido = { ...PEDIDO_COMPLETO, dataAgendada: new Date("2026-11-20T00:00:00Z") };
    const r = await seguirSozinhoParaOsParceiros(9101, { origem: "registado", agora: DE_TARDE });
    expect(r).toEqual({ estado: "ficou", motivo: "data_passada" });
    expect(base.enviados).toEqual([]);
    expect(base.tabela.get(9101)?.motivo).toBe("data_passada");
    expect((await linhasDoEnvioAutomaticoNaMesa([9101])).get(9101)).toContain("o dia pedido pelo cliente já passou");
  });
  it("com o dia de hoje segue", async () => {
    base.pedido = { ...PEDIDO_COMPLETO, dataAgendada: new Date("2026-11-22T00:00:00Z") };
    expect((await seguirSozinhoParaOsParceiros(9101, { origem: "registado", agora: DE_TARDE })).estado).toBe("enviado");
  });
});

describe("d2 — outro pedido aberto do mesmo contacto nos últimos 7 dias", () => {
  it("há outro: fica nos «por enviar» com o motivo, e nada sai", async () => {
    base.outroAberto = true;
    const r = await seguirSozinhoParaOsParceiros(9101, { origem: "registado", agora: DE_TARDE });
    expect(r).toEqual({ estado: "ficou", motivo: "pedido_repetido" });
    expect(base.enviados).toEqual([]);
    expect((await linhasDoEnvioAutomaticoNaMesa([9101])).get(9101)).toContain("outro pedido aberto nos últimos 7 dias");
  });
  it("não há: segue — e a pergunta é pelos 7 dias, só os de antes, só os abertos, pelo telefone ou pelo email", async () => {
    expect((await seguirSozinhoParaOsParceiros(9101, { origem: "registado", agora: DE_TARDE })).estado).toBe("enviado");
    const sql = base.sqlDoRepetido[0];
    expect(sql).toContain("o.id < ?");
    expect(sql).toContain("INTERVAL 7 DAY");
    for (const e of ["cancelado", "rejeitado", "arquivado", "concluido"]) expect(sql).toContain(`'${e}'`);
    expect(sql).toContain("contactPhone");
    expect(sql).toContain("contactEmail");
  });
  it("o repetido que entretanto deixou de o ser (o outro fechou) segue na passagem seguinte", async () => {
    base.outroAberto = true;
    await seguirSozinhoParaOsParceiros(9101, { origem: "registado", agora: DE_TARDE });
    base.outroAberto = false;
    expect((await seguirSozinhoParaOsParceiros(9101, { origem: "registado", agora: DE_TARDE })).estado).toBe("enviado");
  });
});

describe("d2 — a fila não prende: o que já não pode seguir sai dela, com o motivo", () => {
  /** Uma fila de `n` pedidos, todos completos e distintos, postos na fila de noite. */
  async function filaDe(n: number): Promise<number[]> {
    const ids = Array.from({ length: n }, (_, i) => 9300 + i);
    for (const id of ids) {
      base.pedidos.set(id, { ...PEDIDO_COMPLETO, id, contactPhone: `91000${String(id).slice(-4).padStart(4, "0")}`, contactEmail: null });
      await seguirSozinhoParaOsParceiros(id, { origem: "pedir_o_que_falta", agora: DE_NOITE });
      const l = base.tabela.get(id);
      if (l) l.criadoEm = new Date(DE_NOITE.getTime() + (id - 9300) * 1000);
    }
    return ids;
  }

  it("fila com 6 linhas e 5 já enviadas à mão: a 6.ª sai (a limpeza falhou — a rotina defende-se sozinha)", async () => {
    const ids = await filaDe(6);
    expect(ids.every((id) => base.tabela.get(id)?.estado === "na_fila")).toBe(true);
    for (const id of ids.slice(0, 5)) base.negsPorPedido.set(id, [{ estado: "aberta" }]);
    base.limpezaFalha = true;
    const r = await rotinaDoEnvioAutomatico(AS_8H);
    expect(base.enviados).toEqual([ids[5]]);
    expect(r).toMatchObject({ naFila: 6, enviados: 1, tiradosDaFila: 5, limpas: 0 });
    for (const id of ids.slice(0, 5)) expect(base.tabela.get(id)).toMatchObject({ estado: "ficou", motivo: "ja_enviado" });
    expect(base.tabela.get(ids[5])?.estado).toBe("enviado");
    // Na passagem seguinte a fila está vazia.
    const r2 = await rotinaDoEnvioAutomatico(new Date("2026-11-23T08:15:00Z"));
    expect(r2.naFila).toBe(0);
    expect(base.enviados).toEqual([ids[5]]);
  });

  it("a limpeza das linhas presas: tira-as da fila com o motivo, sem enviar nada a quem já foi enviado", async () => {
    const ids = await filaDe(6);
    for (const id of ids.slice(0, 5)) base.negsPorPedido.set(id, [{ estado: "aberta" }]);
    const r = await rotinaDoEnvioAutomatico(AS_8H);
    expect(r).toMatchObject({ naFila: 6, limpas: 5, enviados: 1 });
    expect(base.enviados).toEqual([ids[5]]);
    expect(resumoDaRotinaDoEnvioAutomatico(r)).toContain("5 linha(s) presa(s) limpa(s) da fila");
  });

  it("enviado à mão com as negociações já mortas: nunca volta a sair sozinho", async () => {
    const ids = await filaDe(1);
    base.negsPorPedido.set(ids[0], [{ estado: "morta" }, { estado: "recusada" }]);
    base.limpezaFalha = true;
    await rotinaDoEnvioAutomatico(AS_8H);
    expect(base.enviados).toEqual([]);
    expect(base.tabela.get(ids[0])).toMatchObject({ estado: "ficou", motivo: "ja_enviado" });
    // E por outra origem também: já tem negociações, mesmo mortas.
    expect(await seguirSozinhoParaOsParceiros(ids[0], { origem: "registado", agora: AS_8H })).toEqual({ estado: "ja_enviado" });
    expect(base.enviados).toEqual([]);
  });

  it("apagado: sai da fila, com o motivo", async () => {
    const ids = await filaDe(1);
    base.pedidos.delete(ids[0]);
    base.pedidos.set(1, {}); // a lista continua a existir (e a servir de «base»), mas este id já não está nela
    base.limpezaFalha = true;
    const r = await rotinaDoEnvioAutomatico(AS_8H);
    expect(base.enviados).toEqual([]);
    expect(base.tabela.get(ids[0])).toMatchObject({ estado: "ficou", motivo: "fechado" });
    expect(r.naFila).toBe(1);
  });

  it("deixou de estar completo: sai da fila, com o motivo", async () => {
    const ids = await filaDe(1);
    base.faltas = ["fotografias"];
    await rotinaDoEnvioAutomatico(AS_8H);
    expect(base.enviados).toEqual([]);
    expect(base.tabela.get(ids[0])).toMatchObject({ estado: "ficou", motivo: "incompleto" });
  });

  it("a data passou entretanto: fica nos «por enviar» com o motivo, sai da fila, e o seguinte sai", async () => {
    const [a, b] = await filaDe(2);
    base.pedidos.set(a, { ...base.pedidos.get(a), dataAgendada: new Date("2026-11-20T00:00:00Z") });
    await rotinaDoEnvioAutomatico(AS_8H);
    expect(base.enviados).toEqual([b]);
    expect(base.tabela.get(a)).toMatchObject({ estado: "ficou", motivo: "data_passada" });
  });

  it("há outro pedido aberto do mesmo contacto: fica nos «por enviar» com o motivo e sai da fila", async () => {
    const [a] = await filaDe(1);
    base.outroAberto = true;
    await rotinaDoEnvioAutomatico(AS_8H);
    expect(base.enviados).toEqual([]);
    expect(base.tabela.get(a)).toMatchObject({ estado: "ficou", motivo: "pedido_repetido" });
  });
});

describe("d2 — o resumo da rotina diz sempre quantos havia na fila", () => {
  it("fila vazia: «0 na fila»", async () => {
    const r = await rotinaDoEnvioAutomatico(AS_8H);
    expect(r.naFila).toBe(0);
    expect(resumoDaRotinaDoEnvioAutomatico(r)).toBe("0 na fila");
  });
  it("com fila: quantos havia, enviados, ficaram e tirados", async () => {
    await seguirSozinhoParaOsParceiros(9101, { origem: "pedir_o_que_falta", agora: DE_NOITE });
    const r = await rotinaDoEnvioAutomatico(AS_8H);
    expect(resumoDaRotinaDoEnvioAutomatico(r)).toBe("1 na fila: 1 enviado(s), 0 ficaram nos «por enviar», 0 tirado(s) da fila");
  });
  it("fora das 8h–21h também conta (e desligado)", async () => {
    await seguirSozinhoParaOsParceiros(9101, { origem: "pedir_o_que_falta", agora: DE_NOITE });
    const cedo = await rotinaDoEnvioAutomatico(new Date("2026-11-23T07:45:00Z"));
    expect(resumoDaRotinaDoEnvioAutomatico(cedo)).toBe("fora das 8h–21h (1 na fila)");
    base.interruptor = 0;
    const off = await rotinaDoEnvioAutomatico(AS_8H);
    expect(resumoDaRotinaDoEnvioAutomatico(off)).toBe("desligado nas Configs (1 na fila)");
  });
});
