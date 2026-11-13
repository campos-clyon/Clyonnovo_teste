import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * A BASE DE MENTIRA — nada sai daqui: nem mensagens, nem leituras à base
 * verdadeira. O interruptor, a carteira e as saídas da conversa são os que o
 * teste põe (`base`).
 */
const base = vi.hoisted(() => ({
  ligado: false as boolean,
  lidas: 0,
  dividas: [] as Array<Record<string, unknown>>,
  saidas: [] as Array<{ direccao: string; texto: string; criadoEm: string; haSegundos: number | null }>,
}));
vi.mock("./db", () => ({
  ensureRegistoTable: async () => {},
  registarNaTransaccao: async () => {},
  getPool: async () => ({
    execute: async (sql: string) => {
      if (/SELECT ligado/.test(sql)) {
        base.lidas++;
        return [base.ligado ? [{ ligado: 1, mudadoEm: null, porQuem: "teste" }] : []];
      }
      return [[]];
    },
  }),
  saidasDoNumeroWhatsApp: async () => base.saidas,
}));
vi.mock("./cobrancas-na-base", () => ({
  dividasDoProfissional: async () => base.dividas,
}));

import {
  COMECO_DA_RESPOSTA_FORA_DE_HORAS,
  decidirARespostaAoProfissional,
  jaRespondeuForaDeHorasEstaNoite,
  MARCA_DA_RESPOSTA_FORA_DE_HORAS,
  NOME_DO_INTERRUPTOR,
  PERGUNTAS_DE_DINHEIRO,
  qualPerguntaDeDinheiro,
  respostaAoProfissional,
  respostaForaDeHoras,
  type PerguntaDeDinheiro,
} from "./vitoria-aos-profissionais";
import { oQueDizerAoProfissional, CHAVE_DA_VITORIA_AOS_PROFISSIONAIS } from "./vitoria-aos-profissionais-na-base";
import {
  ATENDIMENTO_ABRE_AS,
  ATENDIMENTO_FECHA_AS,
  emHorarioDeAtendimento,
  inicioDoFecho,
  quandoSeResponde,
} from "./horario-de-atendimento";
import { ATENDIMENTO } from "./promessas-publicas";
import { MENSAGEM_DE_PASSAR_A_UMA_PESSOA } from "./voz-da-vitoria";
import { falaDoModeloAntigo } from "./palavras-do-modelo-antigo";
import { NOVO_MODELO_DESDE } from "./novo-modelo";

/**
 * A VITÓRIA RESPONDE AOS PROFISSIONAIS — d21 (CEO e dono, 13-11-2026).
 *
 * O caderno das frases (como um profissional pergunta cada uma das 9), o
 * teste da conversa (a mensagem entra, sai a resposta certa, com os números
 * da carteira) e as duas chaves: a data de 15-11 e o interruptor das Configs,
 * desligado por omissão. Nomes e números INVENTADOS (o repositório é público).
 */

const ANTES = new Date("2026-11-14T15:00:00Z"); // sábado, 15h em Lisboa — antes da data
const DEPOIS_EM_HORARIO = new Date("2026-11-16T15:00:00Z"); // segunda, 15h em Lisboa
const DEPOIS_AS_22H = new Date("2026-11-16T22:00:00Z"); // segunda, 22h em Lisboa (Inverno: UTC)
const PRO = { id: 7, nome: "Telmo Exemplo" };
const TELEFONE = "351910000007";

beforeEach(() => {
  base.ligado = false;
  base.lidas = 0;
  base.dividas = [];
  base.saidas = [];
});
afterEach(() => {
  vi.unstubAllEnvs();
});

/* ── O caderno das frases ─────────────────────────────────────────────────── */

const CADERNO: Record<PerguntaDeDinheiro, string[]> = {
  quem_me_paga: [
    "A partir de 15/11, quem me paga?",
    "Agora quem é que me paga o trabalho?",
    "como vou receber agora?",
    "O cliente paga-me diretamente?",
    "recebo do cliente ou da clyon?",
  ],
  pagar_a_taxa: [
    "Como pago a taxa?",
    "onde pago a taxa da plataforma",
    "Quanto tenho de pagar à CLYON?",
    "qual é a minha taxa deste trabalho?",
    "Como se paga o IVA da taxa?",
  ],
  referencia_nao_da: [
    "A referência não dá.",
    "a referencia multibanco nao funciona",
    "Tentei pagar e deu erro na referência",
    "a referência expirou",
  ],
  stand_by: [
    "O que é o stand-by?",
    "porque é que a minha conta está bloqueada?",
    "Não consigo aceitar o pedido, diz valor em atraso",
    "já não consigo enviar a proposta",
    "a conta está em standby",
  ],
  iban_e_mbway: [
    "Porque tenho de pôr IBAN e MB WAY?",
    "Para que querem o meu iban?",
    "tenho de pôr o titular da conta?",
    "O meu IBAN é PT50 0000 0000 0000 0000 0000 0",
  ],
  regime_de_iva: [
    "Porque me pedem o regime de IVA?",
    "eu sou isento, o que ponho?",
    "estou no artigo 53, como faço?",
  ],
  pagou_em_dinheiro: [
    "O cliente pagou-me em dinheiro e sem IVA. Está certo?",
    "ele pagou em dinheiro sem iva",
    "o cliente pagou-me menos do que estava no pedido",
  ],
  cliente_nao_pagou: [
    "O cliente ainda não me pagou.",
    "o cliente não quer pagar",
    "ainda não recebi o pagamento do cliente",
    "não me pagaram o trabalho de ontem",
  ],
  como_sao_escolhidos: [
    "Como são escolhidos os profissionais para um pedido?",
    "quem escolhe a proposta?",
    "porque é que não fico com os trabalhos?",
    "como ganho mais trabalhos?",
  ],
};

/** O que um profissional escreve e NÃO é uma das 9 — passa à equipa, como hoje. */
const NAO_SAO: string[] = [
  "ok obrigado",
  "Bom dia",
  "Ainda está disponível?",
  "chego às 9h amanhã",
  "Tenho a carrinha avariada, não vou conseguir ir",
  "Pode ligar-me?",
];

describe("o caderno das frases — as 9 perguntas de dinheiro", () => {
  for (const id of PERGUNTAS_DE_DINHEIRO) {
    it(`lê «${id}» em todas as formas do caderno`, () => {
      for (const f of CADERNO[id]) expect(qualPerguntaDeDinheiro(f), f).toBe(id);
    });
  }
  it("o caderno tem as 9, e cada uma com mais de uma forma", () => {
    expect(PERGUNTAS_DE_DINHEIRO).toHaveLength(9);
    for (const id of PERGUNTAS_DE_DINHEIRO) expect(CADERNO[id].length).toBeGreaterThan(2);
  });
  it.each(NAO_SAO)("«%s» não é uma das 9", (f) => {
    expect(qualPerguntaDeDinheiro(f)).toBeNull();
  });
});

describe("as respostas — o texto do CEO, na voz da equipa", () => {
  it("as 9 dizem o que o CEO reviu (as frases-chave)", () => {
    expect(respostaAoProfissional("quem_me_paga")).toContain("o cliente paga-lhe directamente, por transferência, MB WAY ou em dinheiro");
    expect(respostaAoProfissional("quem_me_paga")).toContain("antes de 15/11, seguem como estavam");
    expect(respostaAoProfissional("pagar_a_taxa")).toContain("Pode pagar por Multibanco (entidade e referência) ou por MB WAY");
    expect(respostaAoProfissional("referencia_nao_da")).toContain("diga-nos o n.º do trabalho e geramos outra");
    expect(respostaAoProfissional("stand_by")).toContain("mais de 4 dias");
    expect(respostaAoProfissional("stand_by")).toContain("«Pagar o valor em atraso»");
    expect(respostaAoProfissional("iban_e_mbway")).toContain("São 4: IBAN, nome do titular da conta, MB WAY e o regime de IVA confirmado");
    expect(respostaAoProfissional("iban_e_mbway")).toContain("até 22/11; a partir de 23/11");
    expect(respostaAoProfissional("regime_de_iva")).toContain("A minha conta › Faturação");
    expect(respostaAoProfissional("pagou_em_dinheiro")).toContain("A taxa da plataforma é sempre a do pedido");
    expect(respostaAoProfissional("cliente_nao_pagou")).toContain("o acordo está guardado na plataforma");
    expect(respostaAoProfissional("como_sao_escolhidos")).toContain("Nos Trabalhos CLYON o valor é fixo");
  });

  it("sem «dívida», sem as palavras do modelo antigo, sem «IA» nem «virtual»", () => {
    for (const id of PERGUNTAS_DE_DINHEIRO) {
      const r = respostaAoProfissional(id, { porPagar: [{ pedidoId: 812, taxa: 25, ivaDaTaxa: 5.75, total: 30.75 }], emAtraso: 30.75 }, true);
      expect(r, id).not.toMatch(/d[íi]vida/i);
      expect(falaDoModeloAntigo(r, "todos"), id).toBeNull();
      expect(r, id).not.toMatch(/\b(IA|virtual|intelig[êe]ncia artificial|garantia)\b/i);
      expect(r, id).not.toMatch(/no próprio dia|paga no fim|no dia do trabalho/i);
    }
  });

  it("nunca dá nem repete dados bancários — um IBAN na mensagem não volta na resposta", () => {
    const d = decidirARespostaAoProfissional({
      texto: "O meu IBAN é PT50 0000 0000 0000 0000 0000 0",
      agora: DEPOIS_EM_HORARIO,
      interruptorLigado: true,
    });
    expect(d.tipo).toBe("resposta");
    if (d.tipo !== "resposta") return;
    expect(d.texto).toContain("não registo nem mudo dados bancários por mensagem");
    expect(d.texto).not.toMatch(/PT50|\d{4} \d{4}/);
  });

  it("a taxa com os números da carteira: {taxa} + IVA da taxa {ivaDaTaxa} = {total}", () => {
    const um = respostaAoProfissional("pagar_a_taxa", { porPagar: [{ pedidoId: 812, taxa: 25, ivaDaTaxa: 5.75, total: 30.75 }], emAtraso: 0 });
    expect(um).toContain("no trabalho #812, 25,00 € + IVA da taxa 5,75 € = 30,75 €");
    const dois = respostaAoProfissional("pagar_a_taxa", {
      porPagar: [
        { pedidoId: 812, taxa: 25, ivaDaTaxa: 5.75, total: 30.75 },
        { pedidoId: 815, taxa: 10, ivaDaTaxa: 2.3, total: 12.3 },
      ],
      emAtraso: 0,
    });
    expect(dois).toContain("#812, 25,00 € + IVA da taxa 5,75 € = 30,75 €; no trabalho #815, 10,00 € + IVA da taxa 2,30 € = 12,30 €");
    expect(respostaAoProfissional("pagar_a_taxa")).toContain("Neste momento não tem nenhum valor por pagar");
  });

  it("o stand-by diz o valor em atraso, quando há", () => {
    expect(respostaAoProfissional("stand_by", { porPagar: [], emAtraso: 30.75 })).toContain("Neste momento tem 30,75 € em atraso.");
    expect(respostaAoProfissional("stand_by", { porPagar: [{ pedidoId: 812, taxa: 25, ivaDaTaxa: 5.75, total: 30.75 }], emAtraso: 0 })).toContain(
      "Neste momento não tem nenhum valor em atraso.",
    );
  });
});

describe("o horário de atendimento — hora de Lisboa", () => {
  it("é o que se promete: de segunda a sábado, das 8h às 20h", () => {
    expect(ATENDIMENTO).toBe(`de segunda a sábado, das 0${ATENDIMENTO_ABRE_AS}:00 às ${ATENDIMENTO_FECHA_AS}:00`);
    expect(MENSAGEM_DE_PASSAR_A_UMA_PESSOA).toContain(`de segunda a sábado, das ${ATENDIMENTO_ABRE_AS}h às ${ATENDIMENTO_FECHA_AS}h`);
  });
  it("lê a hora de Lisboa, não a da máquina", () => {
    expect(emHorarioDeAtendimento(DEPOIS_EM_HORARIO)).toBe(true);
    expect(emHorarioDeAtendimento(DEPOIS_AS_22H)).toBe(false);
    expect(emHorarioDeAtendimento(new Date("2026-11-16T07:59:00Z"))).toBe(false);
    expect(emHorarioDeAtendimento(new Date("2026-11-16T08:00:00Z"))).toBe(true);
    expect(emHorarioDeAtendimento(new Date("2026-11-16T19:59:00Z"))).toBe(true);
    expect(emHorarioDeAtendimento(new Date("2026-11-16T20:00:00Z"))).toBe(false);
    // No Verão Lisboa é UTC+1: 07:30Z são 08:30 em Lisboa.
    expect(emHorarioDeAtendimento(new Date("2026-07-06T07:30:00Z"))).toBe(true);
    // Domingo, fechado.
    expect(emHorarioDeAtendimento(new Date("2026-11-15T12:00:00Z"))).toBe(false);
  });
  it("a noite começa quando fechou — e de sábado às 20h a segunda às 8h é uma só", () => {
    expect(inicioDoFecho(DEPOIS_EM_HORARIO)).toBeNull();
    expect(inicioDoFecho(DEPOIS_AS_22H)?.toISOString()).toBe("2026-11-16T20:00:00.000Z");
    expect(inicioDoFecho(new Date("2026-11-17T03:10:00Z"))?.toISOString()).toBe("2026-11-16T20:00:00.000Z");
    expect(inicioDoFecho(new Date("2026-11-15T12:00:00Z"))?.toISOString()).toBe("2026-11-14T20:00:00.000Z");
  });
  it("diz quando se responde", () => {
    expect(quandoSeResponde(DEPOIS_AS_22H)).toBe("amanhã, a partir das 8h");
    expect(quandoSeResponde(new Date("2026-11-17T03:10:00Z"))).toBe("hoje, a partir das 8h");
    expect(quandoSeResponde(new Date("2026-11-21T21:00:00Z"))).toBe("na segunda-feira, a partir das 8h");
    expect(quandoSeResponde(new Date("2026-11-22T12:00:00Z"))).toBe("amanhã, a partir das 8h");
  });
});

describe("as duas chaves: a data de 15-11 e o interruptor", () => {
  it("o interruptor tem nome e chave, e nasce desligado", async () => {
    expect(NOME_DO_INTERRUPTOR).toBe("Vitória: respostas automáticas aos profissionais");
    expect(CHAVE_DA_VITORIA_AOS_PROFISSIONAIS).toBe("vitoria_profissionais_d21");
    const d = await oQueDizerAoProfissional(TELEFONE, PRO, "Como pago a taxa?", DEPOIS_EM_HORARIO);
    expect(d).toEqual({ tipo: "como_antes" });
  });

  it("antes de 15-11 nada muda — nem se pergunta à base pelo interruptor", async () => {
    base.ligado = true;
    for (const f of [...Object.values(CADERNO).flat(), "olá"]) {
      expect(await oQueDizerAoProfissional(TELEFONE, PRO, f, ANTES)).toEqual({ tipo: "como_antes" });
    }
    expect(base.lidas).toBe(0);
    expect(decidirARespostaAoProfissional({ texto: "Como pago a taxa?", agora: new Date(NOVO_MODELO_DESDE.getTime() - 1), interruptorLigado: true }).tipo).toBe(
      "como_antes",
    );
  });

  it("com a data e o interruptor desligado, também nada muda", () => {
    expect(decidirARespostaAoProfissional({ texto: "Como pago a taxa?", agora: DEPOIS_EM_HORARIO, interruptorLigado: false })).toEqual({
      tipo: "como_antes",
    });
    expect(decidirARespostaAoProfissional({ texto: "olá", agora: DEPOIS_AS_22H, interruptorLigado: false })).toEqual({ tipo: "como_antes" });
  });
});

describe("o teste da conversa — com a data e o interruptor ligado (só no teste)", () => {
  it("as 9 perguntas levam a resposta delas", async () => {
    base.ligado = true;
    for (const id of PERGUNTAS_DE_DINHEIRO) {
      const d = await oQueDizerAoProfissional(TELEFONE, PRO, CADERNO[id][0], DEPOIS_EM_HORARIO);
      expect(d.tipo, id).toBe("resposta");
      if (d.tipo === "resposta") {
        expect(d.pergunta).toBe(id);
        expect(d.texto).toBe(respostaAoProfissional(id));
      }
    }
  });

  it("«Como pago a taxa?» lê os valores da carteira dele", async () => {
    base.ligado = true;
    base.dividas = [
      { negociacaoId: 1, pedidoId: 812, novoModelo: true, paga: false, total: 30.75, iva: 5.75, comissao: 25, nasceuEm: new Date("2026-11-16T10:00:00Z") },
      // Paga, ou do modelo antigo: não entra.
      { negociacaoId: 2, pedidoId: 700, novoModelo: true, paga: true, total: 12.3, iva: 2.3, comissao: 10, nasceuEm: new Date("2026-11-15T10:00:00Z") },
      { negociacaoId: 3, pedidoId: 650, novoModelo: false, paga: false, total: 40, iva: 7.48, comissao: 32.52, nasceuEm: new Date("2026-11-01T10:00:00Z") },
    ];
    const d = await oQueDizerAoProfissional(TELEFONE, PRO, "Como pago a taxa?", DEPOIS_EM_HORARIO);
    expect(d.tipo).toBe("resposta");
    if (d.tipo === "resposta") {
      expect(d.texto).toContain("no trabalho #812, 25,00 € + IVA da taxa 5,75 € = 30,75 €.");
      expect(d.texto).not.toContain("#700");
      expect(d.texto).not.toContain("#650");
    }
  });

  it("o stand-by diz o valor em atraso (mais de 4 dias) lido da carteira", async () => {
    base.ligado = true;
    base.dividas = [
      { negociacaoId: 1, pedidoId: 812, novoModelo: true, paga: false, total: 30.75, iva: 5.75, comissao: 25, nasceuEm: new Date("2026-11-15T09:00:00Z") },
    ];
    const cedo = await oQueDizerAoProfissional(TELEFONE, PRO, "O que é o stand-by?", DEPOIS_EM_HORARIO);
    expect(cedo.tipo === "resposta" && cedo.texto).toContain("Neste momento não tem nenhum valor em atraso.");
    const tarde = await oQueDizerAoProfissional(TELEFONE, PRO, "O que é o stand-by?", new Date("2026-11-20T15:00:00Z"));
    expect(tarde.tipo === "resposta" && tarde.texto).toContain("Neste momento tem 30,75 € em atraso.");
  });

  it("às 22h, uma mensagem que não é das 9 leva a resposta fora de horas — e só uma por noite", async () => {
    base.ligado = true;
    const d = await oQueDizerAoProfissional(TELEFONE, PRO, "Boa noite, preciso de falar convosco", DEPOIS_AS_22H);
    expect(d.tipo).toBe("fora_de_horas");
    if (d.tipo !== "fora_de_horas") return;
    expect(d.texto).toBe(respostaForaDeHoras(PRO.nome, DEPOIS_AS_22H));
    expect(d.texto).toBe(
      "Obrigada pela sua mensagem, Telmo. Neste momento estamos fora do horário de atendimento (de segunda a sábado, das 8h às 20h). " +
        "Uma pessoa da equipa responde-lhe amanhã, a partir das 8h, por aqui.",
    );
    expect(d.texto?.startsWith(COMECO_DA_RESPOSTA_FORA_DE_HORAS)).toBe(true);

    // Já saiu às 21h30 desta noite: não sai outra (passa só à equipa).
    base.saidas = [{ direccao: "out", texto: d.texto ?? "", criadoEm: "", haSegundos: 30 * 60 }];
    const outra = await oQueDizerAoProfissional(TELEFONE, PRO, "Está aí alguém?", DEPOIS_AS_22H);
    expect(outra).toEqual({ tipo: "fora_de_horas", texto: null });

    // A de ontem à noite não conta: a desta noite sai.
    base.saidas = [{ direccao: "out", texto: d.texto ?? "", criadoEm: "", haSegundos: 26 * 3600 }];
    const noiteNova = await oQueDizerAoProfissional(TELEFONE, PRO, "Está aí alguém?", DEPOIS_AS_22H);
    expect(noiteNova.tipo === "fora_de_horas" && noiteNova.texto).toContain(MARCA_DA_RESPOSTA_FORA_DE_HORAS);
  });

  it("às 22h, uma das 9 leva a resposta dela (não precisa de esperar pela equipa)", async () => {
    base.ligado = true;
    const d = await oQueDizerAoProfissional(TELEFONE, PRO, "O cliente ainda não me pagou.", DEPOIS_AS_22H);
    expect(d.tipo).toBe("resposta");
  });

  it("em horário, o que não é das 9 passa à equipa, como hoje", async () => {
    base.ligado = true;
    expect(await oQueDizerAoProfissional(TELEFONE, PRO, "Pode ligar-me?", DEPOIS_EM_HORARIO)).toEqual({ tipo: "equipa" });
  });

  it("a guarda da noite: só conta a marca, e só desde que fechou", () => {
    const fecho = new Date("2026-11-16T20:00:00Z");
    expect(jaRespondeuForaDeHorasEstaNoite([{ texto: "Olá", haSegundos: 60 }], DEPOIS_AS_22H, fecho)).toBe(false);
    expect(jaRespondeuForaDeHorasEstaNoite([{ texto: MARCA_DA_RESPOSTA_FORA_DE_HORAS, haSegundos: 60 }], DEPOIS_AS_22H, fecho)).toBe(true);
    expect(jaRespondeuForaDeHorasEstaNoite([{ texto: MARCA_DA_RESPOSTA_FORA_DE_HORAS, haSegundos: 3 * 3600 }], DEPOIS_AS_22H, fecho)).toBe(false);
    expect(jaRespondeuForaDeHorasEstaNoite([{ texto: MARCA_DA_RESPOSTA_FORA_DE_HORAS, haSegundos: 60 }], DEPOIS_EM_HORARIO, null)).toBe(false);
  });
});

describe("no caminho da conversa", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
  const semNotas = (s: string) => s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");
  const NEG = semNotas(ler("src/lib/whatsapp-negociacao.ts"));

  it("a decisão corre no ramo do profissional, antes da passagem de sempre — e «como_antes» segue para ela", () => {
    const pro = NEG.indexOf("profissionalDoTelefone(telefone)");
    const decide = NEG.indexOf("oQueDizerAoProfissional(telefone, pro, conteudo.texto)");
    const sempre = NEG.indexOf('"Profissional escreveu — responder"');
    expect(pro).toBeGreaterThan(-1);
    expect(decide).toBeGreaterThan(pro);
    expect(sempre).toBeGreaterThan(decide);
    const meio = NEG.slice(decide, sempre);
    // Uma falha na decisão nunca cala a passagem de sempre.
    expect(meio).toContain('.catch(\n          () => ({ tipo: "como_antes" }) as const,');
    // A resposta sai pelo portão de sempre (que não fala com bloqueados nem com entregues a uma pessoa).
    expect(meio).toContain("await enviarTextoWhatsApp(telefone, decisao.texto);");
    expect(meio).toContain('"Profissional escreveu fora de horas — responder"');
  });

  it("o interruptor só o administrador o liga, escrevendo LIGAR, e fica nas Configs", () => {
    const rota = semNotas(ler("src/app/api/admin/vitoria-aos-profissionais/interruptor/route.ts"));
    expect(rota).toContain("requireAdminGeral");
    expect(rota).toContain('!== "LIGAR"');
    const configs = ler("src/components/admin/LegacyAdminClient.tsx");
    expect(configs).toContain("<InterruptorDaVitoriaAosProfissionais />");
    const base = semNotas(ler("src/lib/vitoria-aos-profissionais-na-base.ts"));
    // Desligado na dúvida: sem linha ou com a base a falhar.
    expect(base).toContain("if (!l) return desligado;");
    expect(base).toContain("return desligado;\n  }");
  });
});
