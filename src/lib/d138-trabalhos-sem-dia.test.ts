import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  avisoAoParceiro,
  correrOSemDia,
  DIAS_PARA_A_EQUIPA,
  DIAS_PARA_O_LEMBRETE,
  diasDesde,
  doMaisAntigo,
  etiquetaSemDia,
  lembreteAoParceiro,
  motivoParaAEquipa,
  naoConsegueContactar,
  oQueFaltaMarcar,
  oQueFazerAoTrabalho,
  pedidosDoAvisoSemDia,
  perguntaAoCliente,
  semDiaDoTrabalho,
  type DependenciasDoSemDia,
  type EtapaDoSemDia,
  type EtapasDoSemDia,
  type TrabalhoParaOSemDia,
} from "./trabalho-sem-dia";

/*
 * d138 — O TRABALHO SEM DIA (27-11-2026, o dono): «Não podemos aceitar que os
 * trabalhos fiquem mais de 4 dias sem data nem horário.» Quem marca é o
 * parceiro. Os prazos (0/2/4 dias), a janela 9h–20h, sem mensagens repetidas,
 * o «não contactar». Base fingida, telemóvel de exemplo.
 */

const lisboa = (iso: string) => new Date(`${iso}Z`); // Novembro: Lisboa = UTC
const CONTRATO = "2026-11-20T10:00:00";

function trabalho(x: Partial<TrabalhoParaOSemDia> = {}): TrabalhoParaOSemDia {
  return {
    negociacaoId: 11,
    pedidoId: 558,
    providerId: 7,
    parceiro: "Rui Exemplo",
    telefoneParceiro: "912345678",
    emailParceiro: "parceiro@exemplo.pt",
    querWhatsApp: true,
    telefoneCliente: "910000002",
    dataCombinada: null,
    contratadaEm: lisboa(CONTRATO),
    ...x,
  };
}

/** O mundo fingido: as etapas em memória, as mensagens que saíram. */
function mundo(lista: TrabalhoParaOSemDia[], opcoes: { naoContactar?: string[]; canais?: string[] } = {}) {
  const etapas = new Map<string, EtapasDoSemDia & Record<string, unknown>>();
  const aoParceiro: Array<{ texto: string; pedidos: number[] }> = [];
  const aoCliente: string[] = [];
  const equipa: string[] = [];
  const historia: string[] = [];
  const col: Record<EtapaDoSemDia, keyof EtapasDoSemDia> = { aviso: "avisoEm", lembrete: "lembreteEm", equipa: "equipaEm", cliente: "clientePerguntadoEm" };
  const deps = (agora: Date): DependenciasDoSemDia => ({
    agora,
    trabalhos: async () => lista,
    etapas: async (chaves) => new Map(chaves.filter((c) => etapas.has(c)).map((c) => [c, { ...etapas.get(c)! }])),
    reservar: async (t, falta, etapa) => {
      const k = `${t.negociacaoId}:${falta}`;
      const e = etapas.get(k) ?? {};
      if (e[col[etapa]]) return false;
      etapas.set(k, { ...e, [col[etapa]]: agora });
      return true;
    },
    enviarAoParceiro: async (_t, texto, _titulo, pedidos) => {
      aoParceiro.push({ texto, pedidos });
      return opcoes.canais ?? ["whatsapp"];
    },
    passarAEquipa: async (_t, motivo) => {
      equipa.push(motivo);
    },
    naoContactar: async (tel) => (opcoes.naoContactar ?? []).includes(tel),
    enviarAoCliente: async (_tel, texto) => {
      aoCliente.push(texto);
      return true;
    },
    historico: async (id, l) => {
      historia.push(`#${id} ${l}`);
    },
  });
  return { deps, etapas, aoParceiro, aoCliente, equipa, historia };
}

describe("d138 — o que falta marcar e há quantos dias", () => {
  it("sem dataCombinada falta o dia; à meia-noite de Lisboa falta a hora; com hora, nada", () => {
    expect(oQueFaltaMarcar(null)).toBe("dia");
    expect(oQueFaltaMarcar("2026-12-02T00:00:00.000Z")).toBe("hora");
    expect(oQueFaltaMarcar("2026-12-02T15:00:00.000Z")).toBeNull();
    // No Verão, a meia-noite de Lisboa é às 23h UTC.
    expect(oQueFaltaMarcar("2026-07-01T23:00:00.000Z")).toBe("hora");
  });

  it("conta os dias de calendário de Lisboa desde a contratação (0 no dia)", () => {
    expect(diasDesde(lisboa("2026-11-20T23:30:00"), lisboa("2026-11-20T23:50:00"))).toBe(0);
    expect(diasDesde(lisboa("2026-11-20T23:30:00"), lisboa("2026-11-21T00:10:00"))).toBe(1);
    expect(diasDesde(lisboa(CONTRATO), lisboa("2026-11-24T09:00:00"))).toBe(4);
  });

  it("a contratação: contratadaEm, senão atribuidaEm, senão a abertura", () => {
    const agora = lisboa("2026-11-27T10:00:00");
    expect(semDiaDoTrabalho({ contratadaEm: null, atribuidaEm: lisboa("2026-11-25T10:00:00"), criadaEm: lisboa("2026-11-01T10:00:00") }, agora)?.dias).toBe(2);
    expect(semDiaDoTrabalho({ criadaEm: lisboa("2026-11-01T10:00:00") }, agora)?.dias).toBe(26);
    expect(semDiaDoTrabalho({ dataCombinada: "2026-12-02T15:00:00.000Z", criadaEm: lisboa("2026-11-01T10:00:00") }, agora)).toBeNull();
    expect(semDiaDoTrabalho({ feito: true, criadaEm: lisboa("2026-11-01T10:00:00") }, agora)).toBeNull();
  });

  it("os prazos são 2 e 4 dias; ao 4.º, «Sem data há N dias — combine já»", () => {
    expect(DIAS_PARA_O_LEMBRETE).toBe(2);
    expect(DIAS_PARA_A_EQUIPA).toBe(4);
    expect(etiquetaSemDia("dia", 3)).toBe("Sem data há 3 dias");
    expect(etiquetaSemDia("dia", 0)).toBe("Sem data desde hoje");
    expect(etiquetaSemDia("dia", 12)).toBe("Sem data há 12 dias — combine já");
    expect(etiquetaSemDia("hora", 5)).toBe("Sem hora há 5 dias — combine já");
    expect(motivoParaAEquipa({ pedidoId: 558, parceiro: "Rui Exemplo", falta: "dia", dias: 9 })).toBe(
      "Sem data há 9 dias — combine já — trabalho #558 com Rui Exemplo",
    );
    const s = semDiaDoTrabalho({ criadaEm: lisboa(CONTRATO) }, lisboa("2026-11-24T10:00:00"))!;
    expect(s.vermelho).toBe(true);
    expect(semDiaDoTrabalho({ criadaEm: lisboa(CONTRATO) }, lisboa("2026-11-23T10:00:00"))!.vermelho).toBe(false);
  });

  it("na Agenda, do que está sem dia há mais tempo para o mais recente", () => {
    const agora = lisboa("2026-11-27T10:00:00");
    const l = [
      { id: 690, semDia: semDiaDoTrabalho({ criadaEm: lisboa("2026-11-25T10:00:00") }, agora) },
      { id: 558, semDia: semDiaDoTrabalho({ criadaEm: lisboa("2026-11-01T10:00:00") }, agora) },
      { id: 651, semDia: semDiaDoTrabalho({ criadaEm: lisboa("2026-11-12T10:00:00") }, agora) },
    ];
    expect([...l].sort(doMaisAntigo).map((x) => x.id)).toEqual([558, 651, 690]);
  });
});

describe("d138 — os textos (quem marca é o parceiro)", () => {
  it("o aviso: «Combine o dia e a hora com o cliente e marque-os no pedido #N (app ou painel).»", () => {
    expect(avisoAoParceiro([558], "dia")).toBe("CLYON · Combine o dia e a hora com o cliente e marque-os no pedido #558 (app ou painel).");
    expect(avisoAoParceiro([558, 636, 651], "dia")).toBe(
      "CLYON · Combine o dia e a hora com os clientes e marque-os nos pedidos #558, #636 e #651 (app ou painel).",
    );
    expect(avisoAoParceiro([666], "hora")).toContain("falta a hora");
  });

  it("o lembrete: «O trabalho #N ainda não tem dia marcado. Marque-o hoje na app.»", () => {
    expect(lembreteAoParceiro([558], "dia")).toBe("CLYON · O trabalho #558 ainda não tem dia marcado. Marque-o hoje na app.");
    expect(lembreteAoParceiro([558], "hora")).toBe("CLYON · O trabalho #558 ainda não tem hora marcada. Marque-a hoje na app.");
  });

  it("a resposta ao aviso reconhece-se pelo texto; «não consigo contactar o cliente» lê-se", () => {
    expect(pedidosDoAvisoSemDia(avisoAoParceiro([558, 636], "dia"))).toEqual([558, 636]);
    expect(pedidosDoAvisoSemDia(lembreteAoParceiro([651], "hora"))).toEqual([651]);
    expect(pedidosDoAvisoSemDia("CLYON · O trabalho #N deixou de estar consigo. Obrigado.")).toEqual([]);
    for (const t of ["Não consigo contactar o cliente", "nao consigo falar com ele", "O cliente não atende", "não responde", "Não tenho o contacto"]) {
      expect(naoConsegueContactar(t), t).toBe(true);
    }
    for (const t of ["Sim, vou marcar", "Marco amanhã", "ok"]) expect(naoConsegueContactar(t), t).toBe(false);
    expect(perguntaAoCliente(558)).toContain("Que dia e hora lhe dão jeito?");
  });

  it("a Vitória é «assistente online» — nenhum texto diz IA nem virtual", () => {
    const src = readFileSync(new URL("./trabalho-sem-dia.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/\bIA\b|virtual|intelig[eê]ncia artificial/i);
  });
});

describe("d138 — a decisão de cada passagem", () => {
  const s0 = semDiaDoTrabalho({ criadaEm: lisboa(CONTRATO) }, lisboa("2026-11-20T11:00:00"))!;

  it("dia 0, na janela: o aviso; fora da janela (8h, 20h, 23h): nada", () => {
    expect(oQueFazerAoTrabalho(s0, null, lisboa("2026-11-20T11:00:00")).avisar).toBe(true);
    for (const h of ["08:59:00", "20:00:00", "23:00:00", "03:00:00"]) {
      const o = oQueFazerAoTrabalho(s0, null, lisboa(`2026-11-20T${h}`));
      expect(o.avisar || o.lembrar || o.perguntarAoCliente, h).toBe(false);
    }
  });

  it("o lembrete só ao 2.º dia, uma vez, e nunca no dia do aviso", () => {
    const d1 = lisboa("2026-11-21T10:00:00");
    const d2 = lisboa("2026-11-22T10:00:00");
    const s1 = semDiaDoTrabalho({ criadaEm: lisboa(CONTRATO) }, d1)!;
    const s2 = semDiaDoTrabalho({ criadaEm: lisboa(CONTRATO) }, d2)!;
    expect(oQueFazerAoTrabalho(s1, { avisoEm: lisboa(CONTRATO) }, d1).lembrar).toBe(false);
    expect(oQueFazerAoTrabalho(s2, { avisoEm: lisboa(CONTRATO) }, d2).lembrar).toBe(true);
    expect(oQueFazerAoTrabalho(s2, { avisoEm: d2 }, d2).lembrar).toBe(false);
    expect(oQueFazerAoTrabalho(s2, { avisoEm: lisboa(CONTRATO), lembreteEm: d2 }, d2).lembrar).toBe(false);
  });

  it("ao 4.º dia, a equipa — uma vez, mesmo fora da janela (é por dentro)", () => {
    const d4 = lisboa("2026-11-24T22:00:00");
    const s4 = semDiaDoTrabalho({ criadaEm: lisboa(CONTRATO) }, d4)!;
    expect(oQueFazerAoTrabalho(s4, { avisoEm: lisboa(CONTRATO) }, d4).equipa).toBe(true);
    expect(oQueFazerAoTrabalho(s4, { avisoEm: lisboa(CONTRATO), equipaEm: d4 }, d4).equipa).toBe(false);
    const d3 = semDiaDoTrabalho({ criadaEm: lisboa(CONTRATO) }, lisboa("2026-11-23T10:00:00"))!;
    expect(oQueFazerAoTrabalho(d3, null, lisboa("2026-11-23T10:00:00")).equipa).toBe(false);
  });
});

describe("d138 — a passagem, de ponta a ponta (base fingida)", () => {
  it("0/2/4 dias: aviso no dia, lembrete ao 2.º, equipa ao 4.º — e nada repetido entre passagens", async () => {
    const m = mundo([trabalho()]);
    const passar = (iso: string) => correrOSemDia(m.deps(lisboa(iso)));
    await passar("2026-11-20T10:10:00");
    await passar("2026-11-20T10:20:00");
    expect(m.aoParceiro.map((x) => x.texto)).toEqual(["CLYON · Combine o dia e a hora com o cliente e marque-os no pedido #558 (app ou painel)."]);
    await passar("2026-11-21T10:00:00");
    expect(m.aoParceiro).toHaveLength(1);
    await passar("2026-11-22T10:00:00");
    await passar("2026-11-22T15:00:00");
    expect(m.aoParceiro.map((x) => x.texto)[1]).toBe("CLYON · O trabalho #558 ainda não tem dia marcado. Marque-o hoje na app.");
    expect(m.aoParceiro).toHaveLength(2);
    await passar("2026-11-23T10:00:00");
    expect(m.equipa).toHaveLength(0);
    await passar("2026-11-24T10:00:00");
    await passar("2026-11-24T10:10:00");
    expect(m.equipa).toEqual(["Sem data há 4 dias — combine já — trabalho #558 com Rui Exemplo"]);
    expect(m.aoParceiro).toHaveLength(2);
    expect(m.aoCliente).toHaveLength(0);
  });

  it("nada sai fora das 9h–20h; o que ficou por sair vai às 9h", async () => {
    const m = mundo([trabalho()]);
    await correrOSemDia(m.deps(lisboa("2026-11-20T21:00:00")));
    await correrOSemDia(m.deps(lisboa("2026-11-21T07:00:00")));
    await correrOSemDia(m.deps(lisboa("2026-11-21T08:59:00")));
    expect(m.aoParceiro).toHaveLength(0);
    await correrOSemDia(m.deps(lisboa("2026-11-21T09:00:00")));
    expect(m.aoParceiro).toHaveLength(1);
  });

  it("os trabalhos atrasados de hoje (os 6 da Agenda): um aviso por parceiro, e todos à equipa", async () => {
    const velhos = [558, 636, 651, 666, 652, 690].map((id, i) =>
      trabalho({ negociacaoId: 100 + i, pedidoId: id, providerId: i < 3 ? 1 : 2, contratadaEm: lisboa("2026-11-10T10:00:00"), telefoneCliente: "912345678" }),
    );
    const m = mundo(velhos);
    await correrOSemDia(m.deps(lisboa("2026-11-27T12:20:00")));
    expect(m.aoParceiro.map((x) => x.pedidos)).toEqual([
      [558, 636, 651],
      [652, 666, 690],
    ]);
    expect(m.equipa).toHaveLength(6);
    // Na passagem seguinte, nada de novo.
    await correrOSemDia(m.deps(lisboa("2026-11-27T12:30:00")));
    expect(m.aoParceiro).toHaveLength(2);
    expect(m.equipa).toHaveLength(6);
  });

  it("com dia e sem hora, pede-se a hora", async () => {
    const m = mundo([trabalho({ dataCombinada: "2026-12-02T00:00:00.000Z" })]);
    await correrOSemDia(m.deps(lisboa("2026-11-20T10:10:00")));
    expect(m.aoParceiro[0].texto).toContain("já tem dia, falta a hora");
  });

  it("marcado o dia pelo parceiro, a passagem deixa de lhe tocar", async () => {
    const t = trabalho();
    const m = mundo([t]);
    await correrOSemDia(m.deps(lisboa("2026-11-20T10:10:00")));
    t.dataCombinada = "2026-11-25T14:00:00.000Z";
    await correrOSemDia(m.deps(lisboa("2026-11-22T10:00:00")));
    await correrOSemDia(m.deps(lisboa("2026-11-24T10:00:00")));
    expect(m.aoParceiro).toHaveLength(1);
    expect(m.equipa).toHaveLength(0);
  });

  it("o parceiro não consegue contactar o cliente: a Vitória pergunta-lhe UMA vez, só na janela", async () => {
    const m = mundo([trabalho()]);
    await correrOSemDia(m.deps(lisboa("2026-11-20T10:10:00")));
    m.etapas.set("11:dia", { ...m.etapas.get("11:dia"), clientePedidoEm: lisboa("2026-11-20T21:00:00") });
    await correrOSemDia(m.deps(lisboa("2026-11-20T21:05:00")));
    expect(m.aoCliente).toHaveLength(0);
    await correrOSemDia(m.deps(lisboa("2026-11-21T09:00:00")));
    await correrOSemDia(m.deps(lisboa("2026-11-21T09:10:00")));
    expect(m.aoCliente).toEqual(["Olá! O parceiro do seu pedido #558 ainda não conseguiu falar consigo para combinar o dia. Que dia e hora lhe dão jeito?"]);
  });

  it("«não contactar» (d93): a Vitória não escreve ao cliente", async () => {
    const m = mundo([trabalho()], { naoContactar: ["910000002"] });
    await correrOSemDia(m.deps(lisboa("2026-11-20T10:10:00")));
    m.etapas.set("11:dia", { ...m.etapas.get("11:dia"), clientePedidoEm: lisboa("2026-11-20T10:15:00") });
    await correrOSemDia(m.deps(lisboa("2026-11-20T10:20:00")));
    expect(m.aoCliente).toHaveLength(0);
    expect(m.historia.join(" ")).toContain("não contactar");
  });

  it("sem canal (sem WhatsApp dos avisos nem app), fica no histórico — e o 4.º dia apanha-o", async () => {
    const m = mundo([trabalho()], { canais: [] });
    await correrOSemDia(m.deps(lisboa("2026-11-20T10:10:00")));
    expect(m.historia.join(" ")).toContain("NÃO saiu");
  });
});

describe("d138 — as ligações", () => {
  const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  it("a passagem do assistente corre os trabalhos sem dia", () => {
    expect(ler("../app/api/cron/assistente/route.ts")).toContain("correrOsTrabalhosSemDia");
  });
  it("a resposta do parceiro no WhatsApp passa primeiro pelo aviso do dia", () => {
    expect(ler("./vitoria-agente/pergunta-ao-parceiro-na-base.ts")).toContain("respostaDoParceiroAoSemDia(telefone, texto, opcoes)");
  });
  it("a Agenda leva os dias sem data; a Mesa mostra os vermelhos no «Precisa de si»", () => {
    expect(ler("../app/api/admin/agenda/route.ts")).toContain("semDia: semDiaDoTrabalho(");
    expect(ler("../components/admin/AdminAgendaPanel.tsx")).toContain("doMaisAntigo(a, b)");
    const mesa = ler("../components/admin/AdminNegociacoesPanel.tsx");
    expect(mesa).toContain("/api/admin/trabalhos-sem-dia");
    expect(mesa).toContain("semDiaVermelhos");
  });
  it("as mensagens leem a janela de contacto (d7), não uma hora escrita à mão", () => {
    const src = ler("./trabalho-sem-dia.ts");
    expect(src).toContain("naJanelaDeContacto(agora)");
  });
});
