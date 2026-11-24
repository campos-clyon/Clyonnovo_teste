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
  aEspera: 0,
  purga: { validadeDosOrcamentos: [] as Array<Record<string, unknown>>, lembretesDoQueFalta: [] as Array<Record<string, unknown>> },
  anonimizados: [] as Array<{ id: number; autorNome: string }>,
}));

vi.mock("./regras-novas-na-base", () => ({
  anonimizarPedido: vi.fn(async (id: number, o: { autorNome: string }) => {
    base.anonimizados.push({ id, autorNome: o.autorNome });
  }),
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
      const purga = /FROM (validadeDosOrcamentos|lembretesDoQueFalta) v\s+JOIN simulatorOrders/.exec(sql);
      if (purga) return [base.purga[purga[1] as "validadeDosOrcamentos" | "lembretesDoQueFalta"], []];
      if (/FROM whatsappMensagens/.test(sql)) return [[{ telefone: "351912345678", texto: base.ultimaSaida }], []];
      if (/AS aEspera\s+FROM lembretesDoQueFalta/.test(sql)) return [[{ aEspera: base.aEspera }], []];
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
  devidoDoPrimeiro,
  eLembreteDoQueFalta,
  linhaDoLembreteNaMesa,
  naJanelaDosLembretes,
  noDiaSeguinte,
  porqueFicaDeFora,
  porqueParaOCiclo,
  proximoPassoDoQueFalta,
  querCancelarPeloLembrete,
  querEnviarOQueFalta,
  temUmaDuvidaNoLembrete,
  eDasOpcoesAntigas,
  SE_JA_NAO_PRECISAR_ANTIGA,
  textoDoArquivo,
  textoDoLembrete1,
  textoDoLembrete2,
  textoDoLembrete3,
  ultimoPedirOQueFalta,
  SE_JA_NAO_PRECISAR,
  type CandidatoAoLembrete,
  type CicloDoQueFalta,
} from "./lembrete-do-que-falta";
import { mensagemAutomaticaDoQueFalta, mensagemDoQueFalta, registoDoQueFalta, VITORIA_NO_AUTOMATICO } from "./mensagem-do-que-falta";
import { pedidoDoEnvioDeModelo } from "./envio-de-modelo";
import { MENSAGEM_DE_CANCELAMENTO } from "./mensagens-das-fases";
import { textoDaConfirmacaoDoCancelamento } from "./validade-do-orcamento";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

// 19-11-2026 às 10h de Lisboa (Inverno: Lisboa = UTC).
const AGORA = new Date("2026-11-19T10:00:00Z");
const horas = (h: number) => new Date(AGORA.getTime() - h * 3_600_000);
const minutos = (m: number) => new Date(AGORA.getTime() - m * 60_000);
const dia = (d: string) => new Date(`${d}T10:00:00Z`);
/** Um instante em Lisboa (Inverno: Lisboa = UTC). */
const as = (d: string, hhmm: string) => new Date(`${d}T${hhmm}:00Z`);

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

describe("quem entra e quem fica de fora (d88: de qualquer origem, 30 min depois)", () => {
  it("um pedido dos «Orçamentos novos» com faltas entra", () => {
    expect(porqueFicaDeFora(candidato(), AGORA)).toBeNull();
  });

  it("fica de fora: arquivado, cancelado, concluído, rejeitado", () => {
    for (const status of ["arquivado", "cancelado", "concluido", "rejeitado"]) {
      expect(porqueFicaDeFora(candidato({ status }), AGORA)).toBe("fechado");
    }
  });

  it("fica de fora: já foi aos parceiros (ou é um Trabalho CLYON), completo, de há menos de 30 min", () => {
    expect(porqueFicaDeFora(candidato({ jaFoiEnviado: true }), AGORA)).toBe("ja_foi_enviado");
    expect(porqueFicaDeFora(candidato({ faltas: [] }), AGORA)).toBe("completo");
    expect(porqueFicaDeFora(candidato({ criadoEm: minutos(29) }), AGORA)).toBe("recente");
    expect(porqueFicaDeFora(candidato({ criadoEm: minutos(31) }), AGORA)).toBeNull();
  });

  it("fica de fora: atribuído a uma pessoa, o «Outro serviço» e os serviços fora da lista", () => {
    expect(porqueFicaDeFora(candidato({ atribuido: true }), AGORA)).toBe("atribuido");
    // Em «precisa info» por um «Pedir info» escrito à mão: a equipa já perguntou outra coisa.
    expect(porqueFicaDeFora(candidato({ pedirInfoDaEquipa: true }), AGORA)).toBe("pedir_info");
    for (const servico of ["outro", "montagem_moveis", "jardinagem"]) {
      expect(porqueFicaDeFora(candidato({ servico }), AGORA), servico).toBe("outro_servico");
    }
    expect(porqueFicaDeFora(candidato({ servico: "recolha_monos" }), AGORA)).toBeNull();
  });

  it("fica de fora: conta de teste (nome, email, ou a lista do ambiente)", () => {
    expect(porqueFicaDeFora(candidato({ contactName: "Fred Teste" }), AGORA)).toBe("de_teste");
    expect(porqueFicaDeFora(candidato({ contactEmail: "teste@exemplo.pt" }), AGORA)).toBe("de_teste");
    expect(porqueFicaDeFora(candidato(), AGORA, new Set(["joana@exemplo.pt"]))).toBe("de_teste");
    // «Testemunho» não é teste.
    expect(porqueFicaDeFora(candidato({ contactName: "Testemunhos" }), AGORA)).toBeNull();
  });

  it("sem telemóvel vai por email; sem nenhum dos dois, fica de fora", () => {
    expect(canalDoLembrete({ contactPhone: "912345678", contactEmail: null })).toBe("whatsapp");
    expect(canalDoLembrete({ contactPhone: null, contactEmail: "joana@exemplo.pt" })).toBe("email");
    expect(canalDoLembrete({ contactPhone: "211234567", contactEmail: "joana@exemplo.pt" })).toBe("email");
    expect(porqueFicaDeFora(candidato({ contactPhone: null, contactEmail: null }), AGORA)).toBe("sem_contacto");
  });

  it("fica de fora: bloqueado, o cliente a escrever há menos de 30 min, a conversa com uma pessoa, outra língua sem tradução", () => {
    expect(porqueFicaDeFora(candidato({ bloqueado: true }), AGORA)).toBe("bloqueado");
    expect(porqueFicaDeFora(candidato({ clienteEscreveuEm: minutos(10) }), AGORA)).toBe("cliente_escreveu");
    expect(porqueFicaDeFora(candidato({ clienteEscreveuEm: minutos(40) }), AGORA)).toBeNull();
    expect(porqueFicaDeFora(candidato({ comUmaPessoa: true }), AGORA)).toBe("com_uma_pessoa");
    expect(porqueFicaDeFora(candidato({ linguaSemTraducao: "en" }), AGORA)).toBe("noutra_lingua");
    // Por email, o WhatsApp não conta: o bloqueio e a conversa são do WhatsApp.
    expect(porqueFicaDeFora(candidato({ contactPhone: null, bloqueado: true, comUmaPessoa: true }), AGORA)).toBeNull();
  });

  it("o «Pedir o que falta» da equipa NÃO deixa de fora: conta como a 1.ª mensagem", () => {
    expect(porqueFicaDeFora(candidato({ equipaPediuEm: horas(5) }), AGORA)).toBeNull();
  });

  it("um ciclo por pedido: quem já teve o seu (o da d71 também) não volta a entrar", () => {
    expect(porqueFicaDeFora(candidato({ jaTeveCiclo: true }), AGORA)).toBe("ja_teve_ciclo");
  });

  it("o «Pedir o que falta» lê-se do histórico, e as mensagens automáticas não contam", () => {
    const hist = JSON.stringify([
      { type: "note", message: registoDoQueFalta("Rita", "whatsapp", ["fotografias"], "recolha_monos"), createdAt: "2026-11-18 14:00:00" },
      { type: "note", message: registoDoQueFalta("Rita", "copiar", ["andar"], "recolha_monos"), createdAt: "2026-11-18 16:30:00" },
      { type: "note", message: "«Pedir o que falta» enviado ao cliente pelo WhatsApp — automático, pela Vitória (1/3, d88).", createdAt: "2026-11-19 10:00:00" },
      { type: "note", message: "Lembrete do que falta 1/3 enviado ao cliente pelo WhatsApp (automático, d71).", createdAt: "2026-11-19 10:00:00" },
    ]);
    expect(ultimoPedirOQueFalta(hist)?.toISOString()).toBe("2026-11-18T16:30:00.000Z");
    expect(ultimoPedirOQueFalta(null)).toBeNull();
    expect(ultimoPedirOQueFalta("não é json")).toBeNull();
  });
});

describe("o ritmo: 30 min depois, o dia seguinte à mesma hora, 3 no máximo, das 9h às 20h", () => {
  it("a janela é das 9h às 20h de Lisboa (no Verão, Lisboa = UTC+1)", () => {
    expect(naJanelaDosLembretes(as("2026-11-19", "08:59"))).toBe(false);
    expect(naJanelaDosLembretes(as("2026-11-19", "09:00"))).toBe(true);
    expect(naJanelaDosLembretes(as("2026-11-19", "19:59"))).toBe(true);
    expect(naJanelaDosLembretes(as("2026-11-19", "20:00"))).toBe(false);
    expect(naJanelaDosLembretes(new Date("2026-07-01T08:30:00Z"))).toBe(true); // 9h30 em Lisboa
  });

  it("a 1.ª: 30 min depois de o pedido entrar, dentro da janela", () => {
    const entrou = as("2026-11-19", "14:00");
    const desde = devidoDoPrimeiro(entrou);
    expect(proximoPassoDoQueFalta({}, as("2026-11-19", "14:20"), desde)).toBeNull();
    expect(proximoPassoDoQueFalta({}, as("2026-11-19", "14:30"), desde)).toBe("lembrete1");
  });

  it("a 1.ª de um pedido que entra fora de horas sai às 9h (e não às 8h)", () => {
    const desde = devidoDoPrimeiro(as("2026-11-19", "22:10"));
    expect(proximoPassoDoQueFalta({}, as("2026-11-19", "22:45"), desde)).toBeNull();
    expect(proximoPassoDoQueFalta({}, as("2026-11-20", "08:15"), desde)).toBeNull();
    expect(proximoPassoDoQueFalta({}, as("2026-11-20", "09:00"), desde)).toBe("lembrete1");
    // E de madrugada, também às 9h.
    const cedo = devidoDoPrimeiro(as("2026-11-20", "06:00"));
    expect(proximoPassoDoQueFalta({}, as("2026-11-20", "08:00"), cedo)).toBeNull();
    expect(proximoPassoDoQueFalta({}, as("2026-11-20", "09:05"), cedo)).toBe("lembrete1");
  });

  it("a 2.ª no dia seguinte, à mesma hora; a 3.ª no outro; o arquivo no dia a seguir à 3.ª", () => {
    const c: CicloDoQueFalta = { lembrete1Em: as("2026-11-19", "14:35") };
    expect(proximoPassoDoQueFalta(c, as("2026-11-19", "20:00"))).toBeNull();
    expect(proximoPassoDoQueFalta(c, as("2026-11-20", "14:30"))).toBeNull();
    expect(proximoPassoDoQueFalta(c, as("2026-11-20", "14:35"))).toBe("lembrete2");
    c.lembrete2Em = as("2026-11-20", "14:40");
    expect(proximoPassoDoQueFalta(c, as("2026-11-21", "14:39"))).toBeNull();
    expect(proximoPassoDoQueFalta(c, as("2026-11-21", "14:40"))).toBe("lembrete3");
    c.lembrete3Em = as("2026-11-21", "14:45");
    expect(proximoPassoDoQueFalta(c, as("2026-11-22", "14:00"))).toBeNull();
    expect(proximoPassoDoQueFalta(c, as("2026-11-22", "14:45"))).toBe("arquivar");
    c.arquivadoEm = as("2026-11-22", "14:50");
    expect(proximoPassoDoQueFalta(c, as("2026-11-30", "10:00"))).toBeNull();
  });

  it("no máximo 3 mensagens: depois da 3.ª, só o arquivo", () => {
    const c: CicloDoQueFalta = { lembrete1Em: dia("2026-11-19"), lembrete2Em: dia("2026-11-20"), lembrete3Em: dia("2026-11-21") };
    expect(proximoPassoDoQueFalta(c, dia("2026-11-22"))).toBe("arquivar");
  });

  it("a 1.ª da equipa às 22h: a 2.ª no dia seguinte às 10h", () => {
    const equipa = as("2026-11-19", "22:00");
    expect(noDiaSeguinte(equipa).toISOString()).toBe(as("2026-11-20", "10:00").toISOString());
    const c: CicloDoQueFalta = { lembrete1Em: equipa, lembrete1PelaEquipa: true };
    expect(proximoPassoDoQueFalta(c, as("2026-11-20", "09:30"))).toBeNull();
    expect(proximoPassoDoQueFalta(c, as("2026-11-20", "10:00"))).toBe("lembrete2");
  });

  it("um passo atrasado (fora de horas, ou a uma-por-dia) sai no dia seguinte às 9h, e empurra os seguintes", () => {
    const c: CicloDoQueFalta = { lembrete1Em: as("2026-11-19", "20:30") };
    // A 2.ª devia sair a 20/11 às 20h30; às 21h já não; no dia 21, às 9h.
    expect(proximoPassoDoQueFalta(c, as("2026-11-20", "21:10"))).toBeNull();
    expect(proximoPassoDoQueFalta(c, as("2026-11-21", "08:30"))).toBeNull();
    expect(proximoPassoDoQueFalta(c, as("2026-11-21", "09:00"))).toBe("lembrete2");
    c.lembrete2Em = as("2026-11-21", "09:00");
    expect(proximoPassoDoQueFalta(c, as("2026-11-22", "08:59"))).toBeNull();
    expect(proximoPassoDoQueFalta(c, as("2026-11-22", "09:00"))).toBe("lembrete3");
  });

  it("parado, cancelado ou arquivado: nada mais sai", () => {
    expect(proximoPassoDoQueFalta({ lembrete1Em: dia("2026-11-19"), paradoEm: dia("2026-11-20") }, dia("2026-11-25"))).toBeNull();
    expect(proximoPassoDoQueFalta({ lembrete1Em: dia("2026-11-19"), canceladoEm: dia("2026-11-20") }, dia("2026-11-25"))).toBeNull();
  });

  it("o ciclo pára: o cliente respondeu, o pedido ficou completo, saiu dos «Orçamentos novos», foi atribuído, ou a equipa pediu à mão depois", () => {
    const c: CicloDoQueFalta = { lembrete1Em: dia("2026-11-19") };
    const p = { status: null, jaFoiEnviado: false, faltas: ["andar"] as const, clienteEscreveuEm: null, equipaPediuEm: null };
    expect(porqueParaOCiclo(c, { ...p, faltas: ["andar"] })).toBeNull();
    expect(porqueParaOCiclo(c, { ...p, faltas: ["andar"], clienteEscreveuEm: dia("2026-11-20") })).toBe("o cliente respondeu");
    expect(porqueParaOCiclo(c, { ...p, faltas: ["andar"], clienteEscreveuEm: dia("2026-11-18") })).toBeNull();
    expect(porqueParaOCiclo(c, { ...p, faltas: [] })).toBe("o pedido ficou completo");
    expect(porqueParaOCiclo(c, { ...p, faltas: ["andar"], jaFoiEnviado: true })).toBe("o pedido foi aos parceiros");
    expect(porqueParaOCiclo(c, { ...p, faltas: ["andar"], status: "arquivado" })).toBe("o pedido foi fechado");
    expect(porqueParaOCiclo(c, { ...p, faltas: ["andar"], atribuido: true })).toBe("o pedido foi atribuído a uma pessoa da equipa");
    expect(porqueParaOCiclo(c, { ...p, faltas: ["andar"], equipaPediuEm: dia("2026-11-20") })).toBe("a equipa pediu o que falta à mão");
    // A 1.ª que FOI a da equipa não pára o próprio ciclo.
    expect(porqueParaOCiclo({ lembrete1Em: dia("2026-11-19"), lembrete1PelaEquipa: true }, { ...p, faltas: ["andar"], equipaPediuEm: dia("2026-11-19") })).toBeNull();
  });
});

describe("os textos: a lista do modelo da Mesa, na voz da Vitória (d113; a d86 reconhece-os)", () => {
  const P = { id: 812, serviceType: "recolha_monos", city: "Almada" };
  const F = ["fotografias", "andar", "elevador"] as const;
  const l1 = textoDoLembrete1(P, [...F], AGORA);
  const l2 = textoDoLembrete2(P, [...F], AGORA);
  const l3 = textoDoLembrete3(P, [...F], AGORA);
  const arq = textoDoArquivo(P, AGORA);

  it("a 1.ª é a lista do «Pedir o que falta» da Mesa, dita pela Vitória — e a d86 reconhece-a", () => {
    // d113: é a máquina a escrever, e diz-o (d85); o envio à mão da equipa fica tal e qual.
    expect(l1).toBe(mensagemAutomaticaDoQueFalta(P, [...F]));
    expect(l1).toBe(
      [
        "Olá! Aqui é a Vitória, a assistente automática da CLYON.",
        "Falta pouco para o seu pedido #812 (recolha de monos em Almada) seguir para os parceiros da sua zona. Só preciso de:",
        mensagemDoQueFalta(P, [...F], AGORA).split("\n").filter((x) => x.startsWith("- ")).join("\n"),
        "Pode mandar só uma parte. Se preferir falar com uma pessoa, diga.",
      ].join("\n\n"),
    );
    expect(l1).not.toContain("Equipa CLYON");
    expect(l1).not.toContain("Aqui é a equipa da CLYON");
    expect(mensagemDoQueFalta(P, [...F], AGORA)).toContain("Aqui é a equipa da CLYON.");
    expect(pedidoDoEnvioDeModelo(l1)).toBe(812);
    expect(l1).not.toContain(SE_JA_NAO_PRECISAR);
  });

  it("a 2.ª e a 3.ª (d91, 3.19): «continua guardado» e o último aviso, com a lista e o «responda 2» da d71", () => {
    for (const t of [l2, l3]) {
      // d113: na voz da Vitória, sem a assinatura «Equipa CLYON».
      expect(t.startsWith(`Bom dia! ${VITORIA_NO_AUTOMATICO}`)).toBe(true);
      expect(t.endsWith(SE_JA_NAO_PRECISAR)).toBe(true);
      expect(t).not.toContain("Equipa CLYON");
      expect(pedidoDoEnvioDeModelo(t)).toBe(812);
      expect(t).toContain("#812 (recolha de monos em Almada)");
      // A mesma lista do modelo, linha a linha.
      for (const linha of l1.split("\n").filter((x) => x.startsWith("- "))) expect(t).toContain(linha);
    }
    expect(l2).toContain("continua guardado, à espera de:");
    // A 3.ª avisa que o pedido é arquivado no dia seguinte (o ritmo da d88).
    expect(l3).toContain("Último aviso sobre o seu pedido #812");
    expect(l3).toContain("o pedido fica arquivado amanhã");
  });

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

  it("o do arquivo é simpático, diz que pode voltar a pedir, e não tem o «responda 2»", () => {
    expect(arq).toMatch(/Como não tive notícias, arquivei o seu pedido #812/);
    // d91 (3.19): pode voltar a pedir — por aqui ou na plataforma, grátis e sem compromisso.
    expect(arq).toMatch(/é só responder por aqui ou pedir de novo na plataforma clyon\.pt: é grátis e sem compromisso/i);
    expect(arq).not.toContain("Equipa CLYON");
    expect(arq).not.toContain("responda 2");
  });

  it("sem faltas, nenhuma mensagem", () => {
    expect(textoDoLembrete1(P, [], AGORA)).toBe("");
    expect(textoDoLembrete2(P, [], AGORA)).toBe("");
    expect(textoDoLembrete3(P, [], AGORA)).toBe("");
  });
});

describe("o «3» e as outras respostas (d5: o «2» nunca cancela à primeira)", () => {
  it("quer cancelar: o «3», «opção 3», «cancelar», «já não preciso», «desisto»", () => {
    for (const t of ["3", " 3 ", "Opção 3", "cancelar", "Pode cancelar.", "Já não preciso, obrigada", "desisto", "already found someone"]) {
      expect(querCancelarPeloLembrete(t), t).toBe(true);
    }
  });

  it("nos lembretes de antes da d5 («responda 2 e cancelamos»), o «2» é que quer cancelar — e pergunta o CANCELAR na mesma", () => {
    expect(querCancelarPeloLembrete("2", true)).toBe(true);
    expect(querCancelarPeloLembrete("3", true)).toBe(false);
    expect(querEnviarOQueFalta("1", true)).toBe(false);
    expect(temUmaDuvidaNoLembrete("2", true)).toBe(false);
    expect(eDasOpcoesAntigas(SE_JA_NAO_PRECISAR_ANTIGA)).toBe(true);
    expect(eDasOpcoesAntigas(SE_JA_NAO_PRECISAR)).toBe(false);
  });

  it("o «1» envia o que falta e o «2» é uma dúvida (as mesmas três opções do lembrete do orçamento)", () => {
    expect(SE_JA_NAO_PRECISAR).toBe("Responda 1 se vai enviar o que falta, 2 se tiver uma dúvida, ou 3 se já não precisar.");
    for (const t of ["1", " 1 ", "Opção 1"]) expect(querEnviarOQueFalta(t), t).toBe(true);
    for (const t of ["2", "opção 2"]) expect(temUmaDuvidaNoLembrete(t), t).toBe(true);
    expect(querCancelarPeloLembrete("1")).toBe(false);
    expect(querCancelarPeloLembrete("2")).toBe(false);
  });

  it("não cancela: outro número, uma pergunta, um «mas», dados ou fotografias", () => {
    for (const t of ["1", "2", "22", "3?", "cancelar?", "não sei, talvez", "sim mas só para a semana", "é no 3.º andar sem elevador", "", "Rua Inventada 12"]) {
      expect(querCancelarPeloLembrete(t), t).toBe(false);
    }
  });

  it("só responde à 2.ª ou à 3.ª deste pedido (a 1.ª não pede o «2»), se for a última mensagem que lhe saiu", () => {
    const P = { id: 812, serviceType: "recolha_monos", city: "Almada" };
    const l2 = textoDoLembrete2(P, ["andar"], AGORA);
    expect(eLembreteDoQueFalta(l2, 812)).toBe(true);
    expect(eLembreteDoQueFalta(textoDoLembrete3(P, ["andar"], AGORA), 812)).toBe(true);
    expect(eLembreteDoQueFalta(textoDoLembrete1(P, ["andar"], AGORA), 812)).toBe(false);
    expect(eLembreteDoQueFalta(l2, 81)).toBe(false);
    expect(eLembreteDoQueFalta(l2, 8120)).toBe(false);
    expect(eLembreteDoQueFalta("Olá! Em que posso ajudar com o pedido #812?", 812)).toBe(false);
    expect(eLembreteDoQueFalta(null, 812)).toBe(false);
  });
});

describe("a linha da Mesa", () => {
  it("«Mensagem 1/3 enviada a …», a da equipa, «Cancelado pelo cliente (respondeu CANCELAR)», «Arquivado sem resposta»", () => {
    const um = { lembrete1Em: as("2026-11-19", "14:35") };
    expect(linhaDoLembreteNaMesa(um, true, as("2026-11-19", "15:00"))).toBe("Mensagem 1/3 enviada a 19/11 · a 2.ª a 20/11 às 14h35");
    expect(linhaDoLembreteNaMesa(um, false, as("2026-11-19", "15:00"))).toBe("Mensagem 1/3 enviada a 19/11 · a 2.ª sairia a 20/11 às 14h35");
    expect(linhaDoLembreteNaMesa({ lembrete1Em: as("2026-11-19", "22:00"), lembrete1PelaEquipa: true }, true, as("2026-11-19", "22:05"))).toBe(
      "«Pedir o que falta» da equipa a 19/11 (conta como a 1.ª) · a 2.ª a 20/11 às 10h",
    );
    expect(
      linhaDoLembreteNaMesa({ lembrete1Em: dia("2026-11-19"), lembrete2Em: dia("2026-11-20"), lembrete3Em: dia("2026-11-21") }, true, dia("2026-11-21")),
    ).toBe("Mensagem 3/3 enviada a 21/11 · arquiva a 22/11 às 10h sem resposta");
    expect(linhaDoLembreteNaMesa({ lembrete1Em: dia("2026-11-19"), canceladoEm: dia("2026-11-20") }, true)).toBe(
      "Cancelado pelo cliente (respondeu CANCELAR) a 20/11",
    );
    expect(linhaDoLembreteNaMesa({ lembrete1Em: dia("2026-11-19"), arquivadoEm: dia("2026-11-22") }, true)).toBe("Arquivado sem resposta a 22/11");
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
    base.ultimaSaida = textoDoLembrete2({ id: 812, serviceType: "recolha_monos", city: "Almada" }, ["andar"], AGORA);
  });

  it("a rotina não cria ciclos, não põe nada na fila e não envia", async () => {
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

describe("com o interruptor ligado: o «3» pergunta o CANCELAR, só com um lembrete em aberto", { timeout: 60_000 }, () => {
  beforeEach(() => {
    base.ligado = true;
    base.sqls = [];
    base.enviados = [];
    base.cancelados = [];
    base.reservaCancelamento = 1;
    base.ciclo = { ...CICLO };
    base.pedido = { ...PEDIDO };
    base.ultimaSaida = textoDoLembrete2({ id: 812, serviceType: "recolha_monos", city: "Almada" }, ["andar"], AGORA);
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

  it("«3» NÃO cancela: pergunta «Responda CANCELAR» e fica à espera (d5)", async () => {
    base.aEspera = 0;
    const { responderAoLembreteDoQueFalta } = await import("./lembrete-do-que-falta-na-base");
    const r = await responderAoLembreteDoQueFalta(812, "351912345678", "3", false);
    expect(r).toEqual({ tipo: "perguntou_o_cancelar", pedidoId: 812 });
    expect(base.cancelados).toEqual([]);
    expect(base.enviados).toHaveLength(1);
    expect(base.enviados[0]).toMatch(/^Confirma que quer cancelar o pedido #812\? Responda CANCELAR\./);
  });

  it("o «2» (lembrete novo) é uma dúvida: pára o ciclo, nada se cancela, passa a uma pessoa", async () => {
    const { responderAoLembreteDoQueFalta } = await import("./lembrete-do-que-falta-na-base");
    const r = await responderAoLembreteDoQueFalta(812, "351912345678", "2", false);
    expect(r).toEqual({ tipo: "duvida", pedidoId: 812 });
    expect(base.cancelados).toEqual([]);
    expect(base.enviados).toEqual([]);
    expect(base.sqls.some((q) => /SET paradoEm = UTC_TIMESTAMP\(\)/.test(q))).toBe(true);
  });

  it("o «1» (lembrete novo) pára o ciclo e a Vitória diz que pode enviar o que falta", async () => {
    const { responderAoLembreteDoQueFalta } = await import("./lembrete-do-que-falta-na-base");
    const r = await responderAoLembreteDoQueFalta(812, "351912345678", "1", false);
    expect(r).toEqual({ tipo: "vai_enviar", pedidoId: 812 });
    expect(base.cancelados).toEqual([]);
  });

  it("à espera do CANCELAR, o CANCELAR cancela (texto de cancelamento aprovado, d55); outro «3» ou outro texto não cancela", async () => {
    base.aEspera = 1;
    base.ultimaSaida = textoDaConfirmacaoDoCancelamento(812);
    const { responderAoLembreteDoQueFalta, lembreteEmAbertoDoTelefone } = await import("./lembrete-do-que-falta-na-base");
    expect(await lembreteEmAbertoDoTelefone("351912345678")).toBe(812);
    expect(await responderAoLembreteDoQueFalta(812, "351912345678", "3", false)).toEqual({ tipo: "segue_a_conversa", pedidoId: 812 });
    expect(await responderAoLembreteDoQueFalta(812, "351912345678", "2", false)).toEqual({ tipo: "segue_a_conversa", pedidoId: 812 });
    expect(base.cancelados).toEqual([]);
    const r = await responderAoLembreteDoQueFalta(812, "351912345678", "CANCELAR", false);
    expect(r).toEqual({ tipo: "cancelado", pedidoId: 812 });
    expect(base.cancelados).toEqual([812]);
    expect(base.enviados).toEqual([MENSAGEM_DE_CANCELAMENTO]);
    // d71 v2: marcado para a purga dos cancelados pelo lembrete, daqui a 7 dias (nada sai agora).
    expect(base.sqls.some((q) => /UPDATE lembretesDoQueFalta SET anonimizarAPartirDe = NOW\(\) \+ INTERVAL 7 DAY/.test(q))).toBe(true);
    expect(base.anonimizados).toEqual([]);
  });

  it("num lembrete de ANTES da d5 («responda 2 e cancelamos»), o «2» também só pergunta o CANCELAR", async () => {
    base.aEspera = 0;
    base.ultimaSaida = `Aqui é a equipa da CLYON. Pedido #812. ${SE_JA_NAO_PRECISAR_ANTIGA}`;
    const { responderAoLembreteDoQueFalta } = await import("./lembrete-do-que-falta-na-base");
    const r = await responderAoLembreteDoQueFalta(812, "351912345678", "2", false);
    expect(r).toEqual({ tipo: "perguntou_o_cancelar", pedidoId: 812 });
    expect(base.cancelados).toEqual([]);
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

  it("sem o lembrete em aberto (já cancelado ou arquivado), o CANCELAR não cancela", async () => {
    base.aEspera = 1;
    base.reservaCancelamento = 0;
    const { responderAoLembreteDoQueFalta } = await import("./lembrete-do-que-falta-na-base");
    const r = await responderAoLembreteDoQueFalta(812, "351912345678", "CANCELAR", false);
    expect(r.tipo).toBe("nao_cancelou");
    expect(base.cancelados).toEqual([]);
  });

  it("um pedido que já estava fechado não se cancela por aqui (d27): passa à equipa", async () => {
    base.pedido = { ...PEDIDO, status: "arquivado" };
    const { responderAoLembreteDoQueFalta } = await import("./lembrete-do-que-falta-na-base");
    // O pedido fechado recusa-se ao confirmar (d27).
    base.aEspera = 1;
    const r = await responderAoLembreteDoQueFalta(812, "351912345678", "CANCELAR", false);
    expect(r).toEqual({ tipo: "nao_cancelou", pedidoId: 812, porque: "o pedido já estava fechado" });
    expect(base.cancelados).toEqual([]);
  });

  it("fora das 9h–20h de Lisboa, a rotina não faz nada", async () => {
    const { rotinaDoQueFalta } = await import("./lembrete-do-que-falta-na-base");
    const r = await rotinaDoQueFalta(new Date("2026-11-19T21:30:00Z"));
    expect(r).toMatchObject({ ligado: true, foraDeHoras: true, novos: 0, naFila: 0 });
  });
});

describe("a rotina, a fila e a conversa estão ligadas", () => {
  it("vercel.json corre de 15 em 15 min (d88: 30 min depois de o pedido entrar)", () => {
    const crons = (JSON.parse(ler("vercel.json")) as { crons: Array<{ path: string; schedule: string }> }).crons;
    expect(crons).toContainEqual({ path: "/api/cron/lembretes-do-que-falta", schedule: "7,22,37,52 * * * *" });
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

describe("d71 v2: o cancelado pelo «2» é anonimizado ao fim de 7 dias, pela mesma purga da d62/d2", { timeout: 60_000 }, () => {
  beforeEach(() => {
    base.sqls = [];
    base.anonimizados = [];
    base.purga = { validadeDosOrcamentos: [], lembretesDoQueFalta: [] };
  });

  it("a mesma função anonimiza os das duas fontes, ainda cancelados; o reaberto sai da purga", async () => {
    base.purga.validadeDosOrcamentos = [{ pedidoId: 700, status: "cancelado", anonimizado: 0 }];
    base.purga.lembretesDoQueFalta = [
      { pedidoId: 812, status: "cancelado", anonimizado: 0 },
      { pedidoId: 813, status: "pendente", anonimizado: 0 },
    ];
    const { anonimizarOsCanceladosPeloLembrete } = await import("./validade-do-orcamento-na-base");
    expect(await anonimizarOsCanceladosPeloLembrete({ aSerio: false })).toBe(2);
    expect(base.anonimizados).toEqual([]);
    expect(await anonimizarOsCanceladosPeloLembrete({ aSerio: true })).toBe(2);
    expect(base.anonimizados).toEqual([
      { id: 700, autorNome: "validade do orçamento" },
      { id: 812, autorNome: "lembretes do que falta" },
    ]);
    expect(base.sqls.some((q) => /UPDATE lembretesDoQueFalta SET anonimizarAPartirDe = NULL/.test(q))).toBe(true);
  });

  it("o arquivado ao dia 7 sem resposta não entra na purga (segue a purga normal), e não há outra função", () => {
    const naBase = ler("src/lib/lembrete-do-que-falta-na-base.ts");
    const arquivar = naBase.slice(naBase.indexOf("async function arquivarSemResposta("), naBase.indexOf("/* ── O «2» na conversa"));
    expect(arquivar).not.toContain("anonimizarAPartirDe");
    expect(naBase).not.toContain("anonimizarPedido");
    expect(ler("src/app/api/cron/purgar-pedidos/route.ts")).toContain("anonimizarOsCanceladosPeloLembrete({ aSerio: armada })");
  });
});
