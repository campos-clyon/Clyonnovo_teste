import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * d112 — UMA CONVERSA RESPONDIDA À MÃO VOLTA À VITÓRIA (25-11-2026). Desde a
 * d116 (no mesmo dia) volta logo: o prazo das 24 h e a excepção «com quem ela
 * nunca falou» caíram; ficam as razões e os profissionais. Números e textos
 * inventados; a base é fingida.
 */

const base = vi.hoisted(() => ({
  entregas: [] as Array<Record<string, unknown>>,
  fio: [] as Array<Record<string, unknown>>,
  jaSaiuHoje: false,
  tratadas: [] as Array<{ telefone: string; texto: string }>,
  marcadas: [] as Array<{ telefone: string; ateId: number }>,
  chamadasABase: 0,
}));

vi.mock("./db", () => ({
  getPool: async () => {
    base.chamadasABase++;
    return { execute: async () => [base.fio.slice().reverse(), []] };
  },
  whatsappLigado: async () => {
    base.chamadasABase++;
    return true;
  },
  listarNumerosInterrompidosWhatsApp: async () => {
    base.chamadasABase++;
    return base.entregas;
  },
  numeroBloqueadoWhatsApp: async () => false,
  podeOWhatsAppFalarCom: async () => true,
  marcarRetomadaWhatsApp: async (telefone: string, ateId: number) => void base.marcadas.push({ telefone, ateId }),
  comTrancaDoNumeroWhatsApp: async <T>(_t: string, fazer: () => Promise<T>) => fazer(),
}));
vi.mock("./uma-mensagem-automatica-por-dia", () => ({
  jaSaiuHojeUmaMensagemAutomatica: async () => base.jaSaiuHoje,
}));
vi.mock("./whatsapp-negociacao", () => ({
  tratarMensagemDoCliente: async (telefone: string, c: { texto: string }) => void base.tratadas.push({ telefone, texto: c.texto }),
}));

import {
  DIAS_PARA_RESPONDER_AO_QUE_FICOU,
  entregaPorResposta,
  guardaOMotivoDeAntes,
  MOTIVO_DA_RESPOSTA_A_MAO,
  oQueFicouPorResponder,
  voltouAVitoria,
  VOLTOU_A_VITORIA,
} from "./volta-a-vitoria";
import { responderAsQueVoltaramAVitoria } from "./volta-a-vitoria-na-base";
import { naMesa, type FactosDaConversa } from "./mesa-das-conversas";
import { MARCA_DE_MAO } from "./rajada-do-whatsapp";
import { mensagemDoQueFalta } from "./mensagem-do-que-falta";
import { MOTIVOS_DO_SEGUIMENTO } from "./a-escolha-e-a-desistencia";
import { motivoDoValorUnicoAceite } from "./valor-unico-no-whatsapp";
import { MOTIVO_DE_NAO_REPETIR } from "./pedido-em-curso";
import { MOTIVO_DA_PAUSA } from "./pausa-da-vitoria";

const H = 3600;
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const voltou = (extra: Partial<Parameters<typeof voltouAVitoria>[0]> = {}) =>
  voltouAVitoria({ motivo: MOTIVO_DA_RESPOSTA_A_MAO, quem: "pessoa", profissional: false, ...extra });

describe("sem prazo desde a d116 — a resposta à mão já não cala a Vitória", () => {
  it("a Mesa diz que a conversa é da Vitória", () => {
    expect(VOLTOU_A_VITORIA).toBe("Com a Vitória (a resposta à mão já não a cala)");
  });

  it("a entrega por uma resposta à mão volta logo — também as que já existem (sem `quem`)", () => {
    expect(voltou()).toBe(true);
    expect(voltou({ quem: null })).toBe(true);
  });

  it("a excepção «com quem ela nunca falou» caiu: o cliente antigo que só falou com pessoas volta", () => {
    // O parâmetro já nem existe: não há maneira de a conversa ficar calada por isso.
    expect(voltou()).toBe(true);
  });
});

describe("as excepções — ficam sempre com a equipa", () => {
  it("só a entrega porque uma pessoa respondeu volta", () => {
    expect(entregaPorResposta({ motivo: MOTIVO_DA_RESPOSTA_A_MAO, quem: "pessoa" })).toBe(true);
    expect(entregaPorResposta({ motivo: "  respondeu à mão no whatsapp ", quem: null })).toBe(true);
  });

  it("as entregas feitas por uma razão nunca voltam", () => {
    const razoes = [
      "Pediu para falar com uma pessoa",
      "Cliente a perder a paciência — responder já",
      "Pelo backoffice", // o «Assumir»
      "Fecho desfeito - fale com o cliente",
      "Pedido #700: o cliente cancelou (trabalho pago) — tratar do resto com ele e com o parceiro",
      motivoDoValorUnicoAceite(700),
      MOTIVOS_DO_SEGUIMENTO.outraData(700),
      MOTIVOS_DO_SEGUIMENTO.respondeu(700),
      MOTIVO_DE_NAO_REPETIR,
      "O tradutor falhou e a mensagem da Vitória não tem tradução fixa — responder à mão, em inglês",
      "Valor acima de 500 € com IVA — confirmar com o cliente",
      "Mudança à hora — combinar com o cliente",
      MOTIVO_DA_PAUSA, // d116: a pausa da equipa com «*»
      null,
    ];
    for (const motivo of razoes) {
      for (const quem of ["vitoria", "pessoa", null] as const) {
        expect(voltouAVitoria({ motivo, quem, profissional: false })).toBe(false);
      }
    }
  });

  it("o motivo da resposta à mão dito pela Vitória não conta como resposta", () => {
    expect(entregaPorResposta({ motivo: MOTIVO_DA_RESPOSTA_A_MAO, quem: "vitoria" })).toBe(false);
  });

  it("a conversa de um profissional registado fica com a equipa", () => {
    expect(voltou({ profissional: true })).toBe(false);
  });

  it("a resposta à mão não apaga uma razão que já lá estava", () => {
    const agora = { motivo: MOTIVO_DA_RESPOSTA_A_MAO, quem: "pessoa" as const };
    expect(guardaOMotivoDeAntes({ motivo: "Pediu para falar com uma pessoa", quem: "vitoria", emVigor: true }, agora)).toBe(true);
    expect(guardaOMotivoDeAntes({ motivo: "Pelo backoffice", quem: "pessoa", emVigor: true }, agora)).toBe(true);
    // Uma entrega por resposta escreve-se por cima (o relógio recomeça), e uma que já não vale também.
    expect(guardaOMotivoDeAntes({ motivo: MOTIVO_DA_RESPOSTA_A_MAO, quem: "pessoa", emVigor: true }, agora)).toBe(false);
    expect(guardaOMotivoDeAntes({ motivo: MOTIVO_DA_RESPOSTA_A_MAO, quem: "pessoa", emVigor: false }, agora)).toBe(false);
    expect(guardaOMotivoDeAntes(null, agora)).toBe(false);
    // Uma razão nova (a Vitória, o «Assumir») escreve sempre por cima.
    expect(guardaOMotivoDeAntes({ motivo: MOTIVO_DA_RESPOSTA_A_MAO, quem: "pessoa", emVigor: false }, { motivo: "Pediu para falar com uma pessoa", quem: "vitoria" })).toBe(false);
  });
});

describe("o que ficou por responder quando a conversa volta", () => {
  const m = (id: number, direccao: string, texto: string, haSegundos: number) => ({ id, direccao, texto, haSegundos });

  it("a mensagem do cliente depois da última nossa responde-se; uma vez", () => {
    const fio = [m(1, "out", `${MARCA_DE_MAO} já vejo`, 30 * H), m(2, "in", "Então?", 26 * H), m(3, "in", "Ainda dá?", 25 * H)];
    expect(oQueFicouPorResponder(fio, null)).toEqual({ ateId: 3, antiga: false });
    expect(oQueFicouPorResponder(fio, 3)).toBeNull();
  });

  it("com a última palavra nossa não há nada para responder", () => {
    expect(oQueFicouPorResponder([m(1, "in", "Olá", 30 * H), m(2, "out", `${MARCA_DE_MAO} olá`, 29 * H)], null)).toBeNull();
  });

  it("a que passou de 7 dias fica para quem a vir", () => {
    expect(DIAS_PARA_RESPONDER_AO_QUE_FICOU).toBe(7);
    expect(oQueFicouPorResponder([m(1, "out", "x", 9 * 24 * H), m(2, "in", "Olá", 8 * 24 * H)], null)).toEqual({ ateId: 2, antiga: true });
  });
});

describe("a janela — das 9h às 20h, uma mensagem automática por dia, sem dizer que voltou", () => {
  const entregaQueVoltou = {
    telefone: "351910000112",
    motivo: MOTIVO_DA_RESPOSTA_A_MAO,
    criadoEm: "2026-11-20 10:00:00",
    quem: "pessoa",
    retomadaAteId: null,
    voltouAVitoria: true,
  };
  beforeEach(() => {
    base.entregas = [entregaQueVoltou, { ...entregaQueVoltou, telefone: "351910000113", voltouAVitoria: false }];
    base.fio = [
      { id: 10, direccao: "out", texto: `${MARCA_DE_MAO} vou ver`, haSegundos: 30 * H },
      { id: 11, direccao: "in", texto: "Então, como fica?", haSegundos: 26 * H },
    ];
    base.jaSaiuHoje = false;
    base.tratadas = [];
    base.marcadas = [];
    base.chamadasABase = 0;
  });

  it("fora das 9h–20h de Lisboa não faz nada — nem lê a base", async () => {
    for (const hora of ["2026-11-25T22:00:00Z", "2026-11-25T07:30:00Z", "2026-11-25T20:00:00Z"]) {
      const r = await responderAsQueVoltaramAVitoria(new Date(hora));
      expect(r.respondidas).toBe(0);
    }
    expect(base.chamadasABase).toBe(0);
    expect(base.tratadas).toEqual([]);
  });

  it("dentro da janela, a Vitória lê a mensagem que ficou — só nas que voltaram, e uma vez", async () => {
    const r = await responderAsQueVoltaramAVitoria(new Date("2026-11-25T10:00:00Z"));
    expect(r.respondidas).toBe(1);
    expect(base.tratadas).toEqual([{ telefone: "351910000112", texto: "Então, como fica?" }]);
    expect(base.marcadas).toEqual([{ telefone: "351910000112", ateId: 11 }]);
    // Responde ao que ele escreveu: não há nenhuma mensagem «voltei».
    expect(ler("src/lib/volta-a-vitoria-na-base.ts")).not.toMatch(/enviarTextoWhatsApp|enviarAvisoWhatsApp/);
  });

  it("quem já recebeu hoje uma mensagem automática fica para amanhã", async () => {
    base.jaSaiuHoje = true;
    const r = await responderAsQueVoltaramAVitoria(new Date("2026-11-25T10:00:00Z"));
    expect(r.respondidas).toBe(0);
    expect(base.tratadas).toEqual([]);
    expect(base.marcadas).toEqual([]);
  });

  it("a mensagem antiga (mais de 7 dias) marca-se e não se responde", async () => {
    base.fio = [{ id: 11, direccao: "in", texto: "Olá", haSegundos: 8 * 24 * H }];
    const r = await responderAsQueVoltaramAVitoria(new Date("2026-11-25T10:00:00Z"));
    expect(r.antigas).toBe(1);
    expect(base.tratadas).toEqual([]);
    expect(base.marcadas).toEqual([{ telefone: "351910000112", ateId: 11 }]);
  });
});

describe("a Mesa mostra «Com a Vitória» em vez de «Entregue»", () => {
  const factos: FactosDaConversa = {
    telefone: "351910000112",
    ultimaEntrada: { id: 11, direccao: "in", texto: "Então, como fica?", haSegundos: 26 * H, quando: "2026-11-24 08:00:00" } as never,
    ultimaSaida: { id: 10, direccao: "out", texto: `${MARCA_DE_MAO} vou ver`, haSegundos: 30 * H, quando: "2026-11-24 04:00:00" } as never,
    bloqueada: false,
    entregue: false,
    voltouAVitoria: true,
    motivoDaEntrega: MOTIVO_DA_RESPOSTA_A_MAO,
    fecho: null,
    recolha: null,
    pedidoVivo: null,
    ultimoPedido: null,
    guardada: null,
  };

  it("a linha é da Vitória, sem o «Entregue»", () => {
    const l = naMesa(factos);
    expect(l.dono).toBe("assistente");
    expect(l.motivoDaEntrega).toBeNull();
    expect(l.voltouAVitoria).toBe(VOLTOU_A_VITORIA);
  });

  it("ainda entregue, continua «Entregue» e da equipa", () => {
    const l = naMesa({ ...factos, entregue: true, voltouAVitoria: false });
    expect(l.dono).toBe("equipa");
    expect(l.motivoDaEntrega).toBe(MOTIVO_DA_RESPOSTA_A_MAO);
    expect(l.voltouAVitoria).toBeNull();
  });

  it("o painel mostra a frase da linha, e a base junta-a à entrega", () => {
    expect(ler("src/components/admin/AdminWhatsAppPanel.tsx")).toContain("{l.voltouAVitoria}");
    const naBase = ler("src/lib/mesa-das-conversas-na-base.ts");
    expect(naBase).toContain("entregue: entregueDe.has(chave) && !entregueDe.get(chave)?.voltouAVitoria");
  });
});

describe("na base — a mesma porta para todas as rotinas", () => {
  const DB = ler("src/lib/db.ts");
  const corpo = (nome: string) => {
    const i = DB.indexOf(`export async function ${nome}(`);
    return DB.slice(i, DB.indexOf("\n}\n", i));
  };

  it("a ponte grava o motivo da resposta à mão (só a um profissional, d116) pela constante", () => {
    expect(ler("src/app/api/whatsapp/ponte/route.ts")).toContain("interromperNumeroWhatsApp(telefone, MOTIVO_DA_RESPOSTA_A_MAO, \"pessoa\")");
    expect(ler("src/lib/prazo-da-volta-a-vitoria.ts")).toContain(`"${MOTIVO_DA_RESPOSTA_A_MAO}"`);
  });

  it("«a conversa está entregue?» já sabe do prazo — e na dúvida fica entregue", () => {
    const f = corpo("numeroInterrompidoWhatsApp");
    expect(f).toContain("entregasQueVoltaramAVitoria([entrega])");
    expect(f).toContain(".catch(() => new Set<string>())");
  });

  it("o registo não se apaga: as que voltaram continuam na tabela", () => {
    expect(corpo("listarNumerosInterrompidosWhatsApp")).not.toContain("DELETE");
    expect(corpo("numeroInterrompidoWhatsApp")).not.toContain("DELETE");
    expect(DB).toContain("ALTER TABLE whatsappInterrompidos ADD COLUMN quem VARCHAR(16)");
  });

  it("quem entrega fica escrito, e a resposta à mão não troca uma razão", () => {
    const f = corpo("interromperNumeroWhatsApp");
    expect(f).toContain("guardaOMotivoDeAntes(");
    expect(f).toContain("quem = VALUES(quem)");
  });

  it("a passagem do assistente trata as que voltaram", () => {
    expect(ler("src/app/api/cron/assistente/route.ts")).toContain("responderAsQueVoltaramAVitoria()");
  });
});
