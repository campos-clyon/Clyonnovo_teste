import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * OS LEMBRETES DO QUE FALTA — d71 (CEO e dono, 19-11-2026).
 *
 * As regras puras (quem entra, o calendário 1/3/5 e o arquivo ao dia 7, os
 * textos, o «2») e a conversa com a base FINGIDA: o interruptor desligado não
 * faz nada, o «2» cancela só com um lembrete em aberto, uma resposta ambígua
 * não cancela. Nenhuma mensagem sai a ninguém: o WhatsApp e o email estão
 * fingidos. Números e nomes INVENTADOS (o repositório é público).
 */

const base = vi.hoisted(() => ({
  ligado: false,
  sqls: [] as string[],
  enviados: [] as string[],
  cancelados: [] as number[],
  ciclo: null as Record<string, unknown> | null,
  pedido: null as Record<string, unknown> | null,
  ultimaSaida: "" as string,
  reservaCancelamento: 1,
}));

vi.mock("./db", async (original) => {
  const pool = {
    execute: async (sql: string, params: unknown[] = []) => {
      base.sqls.push(sql);
      if (/FROM retencaoInterruptores/.test(sql)) return [base.ligado ? [{ ligado: 1, mudadoEm: null, porQuem: null }] : [], []];
      if (/SELECT \* FROM lembretesDoQueFalta WHERE pedidoId IN/.test(sql)) return [base.ciclo ? [base.ciclo] : [], []];
      if (/FROM simulatorOrders o\s+WHERE o\.id IN/.test(sql)) return [base.pedido ? [base.pedido] : [], []];
      if (/FROM lembretesDoQueFalta l\s+JOIN simulatorOrders/.test(sql)) {
        return [base.ciclo && base.pedido ? [{ pedidoId: base.ciclo.pedidoId, contactPhone: base.pedido.contactPhone }] : [], []];
      }
      if (/FROM whatsappMensagens/.test(sql)) return [[{ telefone: "351912345678", texto: base.ultimaSaida }], []];
      if (/SET canceladoEm = UTC_TIMESTAMP\(\)/.test(sql)) return [{ affectedRows: base.reservaCancelamento }, []];
      if (/^\s*(UPDATE|INSERT)/.test(sql)) return [{ affectedRows: 1 }, []];
      void params;
      return [[], []];
    },
    query: async (sql: string) => {
      base.sqls.push(sql);
      return [[], []];
    },
  };
  return {
    ...(await original<typeof import("./db")>()),
    getPool: async () => pool,
    ensureSimulatorOrdersTable: async () => {},
    ensureNegociacoesTable: async () => {},
    ensureRegistoTable: async () => {},
    appendOrderHistory: async () => {},
    registarSemFalhar: async () => {},
    gravarMotivoDoFecho: async () => {},
    negociacoesDoPedido: async () => [],
    respostasDoClienteNoWhatsApp: async () => new Map(),
    numeroInterrompidoWhatsApp: async () => false,
    pedidosPorPromover: async () => (base.pedido ? [{ id: base.pedido.id }] : []),
    cancelarPedido: vi.fn(async (id: number) => {
      base.cancelados.push(id);
      return { encerradas: 0 };
    }),
  };
});

vi.mock("./whatsapp-cloud", async (original) => ({
  ...(await original<typeof import("./whatsapp-cloud")>()),
  enviarTextoWhatsApp: vi.fn(async (_t: string, texto: string) => {
    base.enviados.push(texto);
    return true;
  }),
  enviarAvisoWhatsApp: vi.fn(async (_t: string, texto: string) => {
    base.enviados.push(texto);
    return true;
  }),
}));

vi.mock("./seguimento-da-app-envio", () => ({
  enviarEmailDoSeguimento: vi.fn(async (p: { texto: string }) => {
    base.enviados.push(p.texto);
    return true;
  }),
}));

vi.mock("./avisar-cancelamento", () => ({ avisarDoCancelamento: vi.fn(async () => {}) }));

import {
  canalDoLembrete,
  eAHoraDosLembretes,
  eLembreteDoQueFalta,
  linhaDoLembreteNaMesa,
  porqueFicaDeFora,
  porqueParaOCiclo,
  proximoPassoDoQueFalta,
  querCancelarPeloLembrete,
  textoDoArquivo,
  textoDoLembrete1,
  textoDoLembrete2,
  textoDoLembrete3,
  ultimoPedirOQueFalta,
  SE_JA_NAO_PRECISAR,
  type CandidatoAoLembrete,
  type CicloDoQueFalta,
} from "./lembrete-do-que-falta";
import { registoDoQueFalta } from "./mensagem-do-que-falta";
import { MENSAGEM_DE_CANCELAMENTO } from "./mensagens-das-fases";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

// 19-11-2026 às 10h de Lisboa (Inverno: Lisboa = UTC).
const AGORA = new Date("2026-11-19T10:00:00Z");
const horas = (h: number) => new Date(AGORA.getTime() - h * 3_600_000);
const dia = (d: string) => new Date(`${d}T10:00:00Z`);

const candidato = (o: Partial<CandidatoAoLembrete> = {}): CandidatoAoLembrete => ({
  id: 812,
  status: null,
  jaFoiEnviado: false,
  criadoEm: horas(20),
  contactName: "Joana Inventada",
  contactEmail: "joana@exemplo.pt",
  contactPhone: "912345678",
  faltas: ["fotografias", "andar"],
  equipaPediuEm: null,
  clienteEscreveuEm: null,
  comUmaPessoa: false,
  jaTeveCiclo: false,
  ...o,
});

describe("quem entra e quem fica de fora", () => {
  it("um pedido dos «Orçamentos novos» com faltas, de há 20 h, entra", () => {
    expect(porqueFicaDeFora(candidato(), AGORA)).toBeNull();
  });

  it("fica de fora: arquivado, cancelado, concluído, rejeitado", () => {
    for (const status of ["arquivado", "cancelado", "concluido", "rejeitado"]) {
      expect(porqueFicaDeFora(candidato({ status }), AGORA)).toBe("fechado");
    }
  });

  it("fica de fora: já foi aos parceiros, completo, de há menos de 12 h", () => {
    expect(porqueFicaDeFora(candidato({ jaFoiEnviado: true }), AGORA)).toBe("ja_foi_enviado");
    expect(porqueFicaDeFora(candidato({ faltas: [] }), AGORA)).toBe("completo");
    expect(porqueFicaDeFora(candidato({ criadoEm: horas(11) }), AGORA)).toBe("recente");
    expect(porqueFicaDeFora(candidato({ criadoEm: horas(13) }), AGORA)).toBeNull();
  });

  it("fica de fora: conta de teste (nome, email, ou a lista do ambiente)", () => {
    expect(porqueFicaDeFora(candidato({ contactName: "Fred Teste" }), AGORA)).toBe("de_teste");
    expect(porqueFicaDeFora(candidato({ contactEmail: "teste@exemplo.pt" }), AGORA)).toBe("de_teste");
    expect(porqueFicaDeFora(candidato(), AGORA, new Set(["joana@exemplo.pt"]))).toBe("de_teste");
    // «Testemunho» não é teste.
    expect(porqueFicaDeFora(candidato({ contactName: "Ana Testemunho" }), AGORA)).toBeNull();
  });

  it("sem telemóvel vai por email; sem nenhum dos dois, fica de fora", () => {
    expect(canalDoLembrete({ contactPhone: "912345678", contactEmail: null })).toBe("whatsapp");
    expect(canalDoLembrete({ contactPhone: null, contactEmail: "joana@exemplo.pt" })).toBe("email");
    expect(canalDoLembrete({ contactPhone: "211234567", contactEmail: "joana@exemplo.pt" })).toBe("email");
    expect(porqueFicaDeFora(candidato({ contactPhone: null, contactEmail: null }), AGORA)).toBe("sem_contacto");
  });

  it("fica de fora: «Pedir o que falta» ou mensagem do cliente nas últimas 24 h, ou a conversa com uma pessoa", () => {
    expect(porqueFicaDeFora(candidato({ equipaPediuEm: horas(5) }), AGORA)).toBe("equipa_pediu");
    expect(porqueFicaDeFora(candidato({ equipaPediuEm: horas(30) }), AGORA)).toBeNull();
    expect(porqueFicaDeFora(candidato({ clienteEscreveuEm: horas(2) }), AGORA)).toBe("cliente_escreveu");
    expect(porqueFicaDeFora(candidato({ clienteEscreveuEm: horas(26) }), AGORA)).toBeNull();
    expect(porqueFicaDeFora(candidato({ comUmaPessoa: true }), AGORA)).toBe("com_uma_pessoa");
  });

  it("um ciclo por pedido: quem já teve o seu não volta a entrar", () => {
    expect(porqueFicaDeFora(candidato({ jaTeveCiclo: true }), AGORA)).toBe("ja_teve_ciclo");
  });

  it("o «Pedir o que falta» lê-se do histórico, e os lembretes automáticos não contam", () => {
    const hist = JSON.stringify([
      { type: "note", message: registoDoQueFalta("Rita", "whatsapp", ["fotografias"], "recolha_monos"), createdAt: "2026-11-18 14:00:00" },
      { type: "note", message: registoDoQueFalta("Rita", "copiar", ["andar"], "recolha_monos"), createdAt: "2026-11-18 16:30:00" },
      { type: "note", message: "Lembrete do que falta 1/3 enviado ao cliente pelo WhatsApp (automático, d71).", createdAt: "2026-11-19 10:00:00" },
    ]);
    expect(ultimoPedirOQueFalta(hist)?.toISOString()).toBe("2026-11-18T16:30:00.000Z");
    expect(ultimoPedirOQueFalta(null)).toBeNull();
    expect(ultimoPedirOQueFalta("não é json")).toBeNull();
  });
});

describe("o calendário: dia 1, dia 3, dia 5 e o arquivo ao dia 7, às 10h de Lisboa", () => {
  it("só às 10h de Lisboa: no Inverno a das 10h UTC, no Verão a das 9h UTC", () => {
    expect(eAHoraDosLembretes(new Date("2026-11-19T10:00:00Z"))).toBe(true);
    expect(eAHoraDosLembretes(new Date("2026-11-19T09:00:00Z"))).toBe(false);
    expect(eAHoraDosLembretes(new Date("2026-07-01T09:00:00Z"))).toBe(true);
    expect(eAHoraDosLembretes(new Date("2026-07-01T10:00:00Z"))).toBe(false);
  });

  it("os passos, contados do primeiro envio", () => {
    const c: CicloDoQueFalta = {};
    expect(proximoPassoDoQueFalta(c, dia("2026-11-19"))).toBe("lembrete1");
    c.lembrete1Em = dia("2026-11-19");
    expect(proximoPassoDoQueFalta(c, dia("2026-11-19"))).toBeNull();
    expect(proximoPassoDoQueFalta(c, dia("2026-11-20"))).toBeNull();
    expect(proximoPassoDoQueFalta(c, dia("2026-11-21"))).toBe("lembrete2");
    c.lembrete2Em = dia("2026-11-21");
    expect(proximoPassoDoQueFalta(c, dia("2026-11-22"))).toBeNull();
    expect(proximoPassoDoQueFalta(c, dia("2026-11-23"))).toBe("lembrete3");
    c.lembrete3Em = dia("2026-11-23");
    expect(proximoPassoDoQueFalta(c, dia("2026-11-24"))).toBeNull();
    expect(proximoPassoDoQueFalta(c, dia("2026-11-25"))).toBe("arquivar");
    c.arquivadoEm = dia("2026-11-25");
    expect(proximoPassoDoQueFalta(c, dia("2026-11-30"))).toBeNull();
  });

  it("um passo atrasado empurra os seguintes (nunca dois no mesmo dia), e no máximo 3 lembretes", () => {
    const c: CicloDoQueFalta = { lembrete1Em: dia("2026-11-19"), lembrete2Em: dia("2026-11-24") };
    expect(proximoPassoDoQueFalta(c, dia("2026-11-25"))).toBeNull();
    expect(proximoPassoDoQueFalta(c, dia("2026-11-26"))).toBe("lembrete3");
  });

  it("parado, cancelado ou arquivado: nada mais sai", () => {
    expect(proximoPassoDoQueFalta({ lembrete1Em: dia("2026-11-19"), paradoEm: dia("2026-11-20") }, dia("2026-11-25"))).toBeNull();
    expect(proximoPassoDoQueFalta({ lembrete1Em: dia("2026-11-19"), canceladoEm: dia("2026-11-20") }, dia("2026-11-25"))).toBeNull();
  });

  it("o ciclo pára: o cliente respondeu, o pedido ficou completo, saiu dos «Orçamentos novos» ou a equipa pediu à mão", () => {
    const c: CicloDoQueFalta = { lembrete1Em: dia("2026-11-19") };
    const p = { status: null, jaFoiEnviado: false, faltas: ["andar"] as const, clienteEscreveuEm: null, equipaPediuEm: null };
    expect(porqueParaOCiclo(c, { ...p, faltas: ["andar"] })).toBeNull();
    expect(porqueParaOCiclo(c, { ...p, faltas: ["andar"], clienteEscreveuEm: dia("2026-11-20") })).toBe("o cliente respondeu");
    expect(porqueParaOCiclo(c, { ...p, faltas: ["andar"], clienteEscreveuEm: dia("2026-11-18") })).toBeNull();
    expect(porqueParaOCiclo(c, { ...p, faltas: [] })).toBe("o pedido ficou completo");
    expect(porqueParaOCiclo(c, { ...p, faltas: ["andar"], jaFoiEnviado: true })).toBe("o pedido foi aos parceiros");
    expect(porqueParaOCiclo(c, { ...p, faltas: ["andar"], status: "arquivado" })).toBe("o pedido foi fechado");
    expect(porqueParaOCiclo(c, { ...p, faltas: ["andar"], equipaPediuEm: dia("2026-11-20") })).toBe("a equipa pediu o que falta à mão");
  });
});

describe("os textos", () => {
  const P = { id: 812, serviceType: "recolha_monos", city: "Almada" };
  const F = ["fotografias", "andar", "elevador"] as const;
  const l1 = textoDoLembrete1(P, [...F], AGORA);
  const l2 = textoDoLembrete2(P, [...F], AGORA);
  const l3 = textoDoLembrete3(P, [...F], AGORA);
  const arq = textoDoArquivo(P, AGORA);

  it("uma pessoa a escrever: sem emojis, reticências, travessões, aspas tipográficas nem preços", () => {
    for (const t of [l1, l2, l3, arq]) {
      expect(t).not.toMatch(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/u);
      expect(t).not.toMatch(/[…—–“”«»‘’]/);
      expect(t).not.toMatch(/€|\bIVA\b/);
      // Ao cliente, «parceiros» — nunca «profissional» (regra n da orquestra).
      expect(t).not.toMatch(/profissiona/i);
      expect(t).not.toMatch(/\bIA\b|virtual/i);
    }
  });

  it("os três lembretes acabam com o «responda 2», dizem «parceiros» e o número do pedido", () => {
    for (const t of [l1, l2, l3]) {
      expect(t).toContain(SE_JA_NAO_PRECISAR);
      expect(t).toContain("#812 (recolha de monos em Almada)");
      expect(t).toMatch(/parceiros/);
    }
    expect(l1.startsWith("Bom dia!")).toBe(true);
  });

  it("o 1.º traz a lista inteira; o 2.º e o 3.º são mais curtos; o 3.º diz que é o último aviso", () => {
    expect(l1).toContain("- Fotografias do que é para levar");
    expect(l2.length).toBeLessThan(l1.length);
    expect(l3.length).toBeLessThan(l1.length);
    expect(l2).toContain("Ainda falta: fotografias, andar e elevador.");
    expect(l3).toMatch(/último aviso/);
    expect(l2).not.toMatch(/último aviso/);
  });

  it("o do arquivo é simpático, diz que pode voltar a pedir, e não tem o «responda 2»", () => {
    expect(arq).toMatch(/arquivámos o seu pedido #812/);
    expect(arq).toMatch(/pode voltar a pedir quando quiser/i);
    expect(arq).not.toContain("responda 2");
  });

  it("sem faltas, nenhum lembrete", () => {
    expect(textoDoLembrete1(P, [], AGORA)).toBe("");
    expect(textoDoLembrete2(P, [], AGORA)).toBe("");
    expect(textoDoLembrete3(P, [], AGORA)).toBe("");
  });
});

describe("o «2» e as outras respostas", () => {
  it("cancela: o «2», «opção 2», «cancelar», «já não preciso», «desisto»", () => {
    for (const t of ["2", " 2 ", "Opção 2", "cancelar", "Pode cancelar.", "Já não preciso, obrigada", "desisto", "already found someone"]) {
      expect(querCancelarPeloLembrete(t), t).toBe(true);
    }
  });

  it("não cancela: outro número, uma pergunta, um «mas», dados ou fotografias", () => {
    for (const t of ["1", "3", "22", "2?", "cancelar?", "não sei, talvez", "sim mas só para a semana", "é no 3.º andar sem elevador", "", "Rua Inventada 12"]) {
      expect(querCancelarPeloLembrete(t), t).toBe(false);
    }
  });

  it("só responde ao lembrete deste pedido, se for a última mensagem que lhe saiu", () => {
    const l1 = textoDoLembrete1({ id: 812, serviceType: "recolha_monos", city: "Almada" }, ["andar"], AGORA);
    expect(eLembreteDoQueFalta(l1, 812)).toBe(true);
    expect(eLembreteDoQueFalta(l1, 81)).toBe(false);
    expect(eLembreteDoQueFalta(l1, 8120)).toBe(false);
    expect(eLembreteDoQueFalta("Olá! Em que posso ajudar com o pedido #812?", 812)).toBe(false);
    expect(eLembreteDoQueFalta(null, 812)).toBe(false);
  });
});

describe("a linha da Mesa", () => {
  it("«Lembrete 1/3 enviado a …», «Cancelado pelo cliente (respondeu 2)», «Arquivado sem resposta»", () => {
    expect(linhaDoLembreteNaMesa({ lembrete1Em: dia("2026-11-19") }, true)).toBe("Lembrete 1/3 enviado a 19/11 · o 2.º a 21/11 às 10h");
    expect(linhaDoLembreteNaMesa({ lembrete1Em: dia("2026-11-19") }, false)).toBe("Lembrete 1/3 enviado a 19/11 · o 2.º sairia a 21/11 às 10h");
    expect(
      linhaDoLembreteNaMesa({ lembrete1Em: dia("2026-11-19"), lembrete2Em: dia("2026-11-21"), lembrete3Em: dia("2026-11-23") }, true),
    ).toBe("Lembrete 3/3 enviado a 23/11 · arquiva a 25/11 às 10h sem resposta");
    expect(linhaDoLembreteNaMesa({ lembrete1Em: dia("2026-11-19"), canceladoEm: dia("2026-11-20") }, true)).toBe(
      "Cancelado pelo cliente (respondeu 2) a 20/11",
    );
    expect(linhaDoLembreteNaMesa({ lembrete1Em: dia("2026-11-19"), arquivadoEm: dia("2026-11-25") }, true)).toBe("Arquivado sem resposta a 25/11");
    expect(linhaDoLembreteNaMesa(null, true)).toBeNull();
  });
});

/* ── A conversa com a base fingida ───────────────────────────────────────── */

const CICLO = { pedidoId: 812, canal: "whatsapp", lembrete1Em: "2026-11-19 10:00:00" };
const PEDIDO = {
  id: 812,
  status: null,
  createdAt: "2026-11-18 12:00:00",
  contactName: "Joana Inventada",
  contactEmail: null,
  contactPhone: "912345678",
  serviceType: "recolha_monos",
  city: "Almada",
  address: "Rua Inventada",
  postalCode: null,
  floor: null,
  hasElevator: null,
  parkingDistance: null,
  description: "um sofá",
  filesJson: null,
  urgency: null,
  dataAgendada: null,
  rawOrderJson: null,
  historyJson: null,
  anonimizadoEm: null,
  jaFoiEnviado: 0,
};

/*
 * Sob carga (a suite inteira), a primeira importação do módulo da base pode
 * passar dos 5 s; uma conversa que acaba depois do fim do teste mexia no
 * estado do seguinte. Importa-se uma vez antes, com tempo.
 */
beforeAll(async () => {
  await import("./lembrete-do-que-falta-na-base");
  await import("./whatsapp-cloud");
  await import("./mensagens-das-fases");
  await import("./o-que-falta-no-pedido");
  await import("./validade-do-orcamento");
  await import("./avisar-cancelamento");
  await import("./seguimento-da-app-envio");
  await import("./aviso-aos-profissionais");
  await import("./db");
}, 120_000);

describe("o interruptor desligado não faz nada", { timeout: 60_000 }, () => {
  beforeEach(() => {
    base.ligado = false;
    base.sqls = [];
    base.enviados = [];
    base.cancelados = [];
    base.ciclo = { ...CICLO };
    base.pedido = { ...PEDIDO };
    base.ultimaSaida = textoDoLembrete1({ id: 812, serviceType: "recolha_monos", city: "Almada" }, ["andar"], AGORA);
  });

  it("a rotina das 10h não cria ciclos, não põe nada na fila e não envia", async () => {
    const { rotinaDoQueFalta } = await import("./lembrete-do-que-falta-na-base");
    const r = await rotinaDoQueFalta(AGORA);
    expect(r.ligado).toBe(false);
    expect(base.sqls.some((s) => /INSERT IGNORE INTO lembretesDoQueFalta \(|UPDATE lembretesDoQueFalta|UPDATE simulatorOrders/.test(s))).toBe(false);
    expect(base.enviados).toEqual([]);
  });

  it("a passagem da ponte não envia, e um «2» na conversa não encontra lembrete em aberto", async () => {
    const { passagemDoQueFalta, lembreteEmAbertoDoTelefone, darOPasso } = await import("./lembrete-do-que-falta-na-base");
    expect(["desligado", "nada", "fora-da-janela"]).toContain(await passagemDoQueFalta(AGORA));
    expect(await lembreteEmAbertoDoTelefone("351912345678")).toBeNull();
    expect(await darOPasso(812, "lembrete2", dia("2026-11-21"))).toEqual({ ok: false, porque: "desligado" });
    expect(base.enviados).toEqual([]);
    expect(base.cancelados).toEqual([]);
  });
});

describe("com o interruptor ligado: o «2» cancela só com um lembrete em aberto", { timeout: 60_000 }, () => {
  beforeEach(() => {
    base.ligado = true;
    base.sqls = [];
    base.enviados = [];
    base.cancelados = [];
    base.reservaCancelamento = 1;
    base.ciclo = { ...CICLO };
    base.pedido = { ...PEDIDO };
    base.ultimaSaida = textoDoLembrete1({ id: 812, serviceType: "recolha_monos", city: "Almada" }, ["andar"], AGORA);
  });

  it("com o lembrete do #812 como última saída, o telefone tem o lembrete em aberto", async () => {
    const { lembreteEmAbertoDoTelefone } = await import("./lembrete-do-que-falta-na-base");
    expect(await lembreteEmAbertoDoTelefone("351912345678")).toBe(812);
  });

  it("com outra mensagem pelo meio, não há lembrete em aberto (o «2» segue a conversa de sempre)", async () => {
    base.ultimaSaida = "Obrigada! Já anotei. Há elevador no prédio?";
    const { lembreteEmAbertoDoTelefone } = await import("./lembrete-do-que-falta-na-base");
    expect(await lembreteEmAbertoDoTelefone("351912345678")).toBeNull();
  });

  it("«2» cancela o pedido e manda o texto de cancelamento aprovado (d55)", async () => {
    const { responderAoLembreteDoQueFalta } = await import("./lembrete-do-que-falta-na-base");
    const r = await responderAoLembreteDoQueFalta(812, "351912345678", "2", false);
    expect(r).toEqual({ tipo: "cancelado", pedidoId: 812 });
    expect(base.cancelados).toEqual([812]);
    expect(base.enviados).toEqual([MENSAGEM_DE_CANCELAMENTO]);
  });

  it("uma resposta ambígua, com dados ou com fotografias não cancela: pára os lembretes e segue a conversa", async () => {
    const { responderAoLembreteDoQueFalta } = await import("./lembrete-do-que-falta-na-base");
    for (const [texto, imagens] of [["não sei, talvez", false], ["é no 2.º andar", false], ["2", true]] as const) {
      base.sqls = [];
      const r = await responderAoLembreteDoQueFalta(812, "351912345678", texto, imagens);
      expect(r.tipo).toBe("segue_a_conversa");
      expect(base.sqls.some((s) => /SET paradoEm = UTC_TIMESTAMP\(\)/.test(s))).toBe(true);
    }
    expect(base.cancelados).toEqual([]);
    expect(base.enviados).toEqual([]);
  });

  it("sem o lembrete em aberto (já cancelado, arquivado ou parado), o «2» não cancela", async () => {
    base.reservaCancelamento = 0;
    const { responderAoLembreteDoQueFalta } = await import("./lembrete-do-que-falta-na-base");
    const r = await responderAoLembreteDoQueFalta(812, "351912345678", "2", false);
    expect(r.tipo).toBe("nao_cancelou");
    expect(base.cancelados).toEqual([]);
  });

  it("um pedido que já estava fechado não se cancela por aqui (d27): passa à equipa", async () => {
    base.pedido = { ...PEDIDO, status: "arquivado" };
    const { responderAoLembreteDoQueFalta } = await import("./lembrete-do-que-falta-na-base");
    const r = await responderAoLembreteDoQueFalta(812, "351912345678", "cancelar", false);
    expect(r).toEqual({ tipo: "nao_cancelou", pedidoId: 812, porque: "o pedido já estava fechado" });
    expect(base.cancelados).toEqual([]);
  });

  it("fora das 10h de Lisboa, a rotina não faz nada", async () => {
    const { rotinaDoQueFalta } = await import("./lembrete-do-que-falta-na-base");
    const r = await rotinaDoQueFalta(new Date("2026-11-19T09:00:00Z"));
    expect(r).toMatchObject({ ligado: true, foraDeHoras: true, novos: 0, naFila: 0 });
  });
});

describe("a rotina, a fila e a conversa estão ligadas", () => {
  it("vercel.json corre às 9h e às 10h UTC (uma é a das 10h de Lisboa)", () => {
    const crons = (JSON.parse(ler("vercel.json")) as { crons: Array<{ path: string; schedule: string }> }).crons;
    expect(crons).toContainEqual({ path: "/api/cron/lembretes-do-que-falta", schedule: "0 9,10 * * *" });
  });

  it("a rota falha fechada sem CRON_SECRET", () => {
    const rota = ler("src/app/api/cron/lembretes-do-que-falta/route.ts");
    expect(rota).toMatch(/if \(!secret\)[\s\S]*status: 503/);
    expect(rota).toContain('carimbarPassagem("lembretes-do-que-falta"');
  });

  it("a ponte dá a passagem, e a Vitória lê o «2» antes da conversa de sempre", () => {
    expect(ler("src/app/api/whatsapp/ponte/route.ts")).toContain("passagemDoQueFalta()");
    const conversa = ler("src/lib/whatsapp-negociacao.ts");
    expect(conversa).toContain("lembreteEmAbertoDoTelefone(telefone)");
    expect(conversa).toContain("responderAoLembreteDoQueFalta(");
  });

  it("o interruptor nasce desligado, e ligar pede a palavra LIGAR ao administrador", () => {
    const rota = ler("src/app/api/admin/lembretes-do-que-falta/route.ts");
    expect(rota).toContain("requireAdminGeral");
    expect(rota).toContain('!== "LIGAR"');
    const naBase = ler("src/lib/lembrete-do-que-falta-na-base.ts");
    expect(naBase).toContain("DESLIGADO NA DÚVIDA");
    expect(naBase).not.toMatch(/DELETE FROM simulatorOrders/);
  });
});
