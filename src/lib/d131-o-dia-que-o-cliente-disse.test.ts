import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * d131 — O DIA QUE O CLIENTE DISSE FICA NO PEDIDO, E O DIA COMBINADO NA
 * NEGOCIAÇÃO (26-11-2026).
 *
 * O caso (sem dados reais; o repositório é público): numa recolha de duas
 * estantes, o cliente escreveu «tem que ser dia 2 de manhã até às 13 ou
 * 13h30». O resumo da Vitória mostrou-o, mas o pedido ficou «Sem pressa» e sem
 * data — só se liam datas com o mês. Depois, ao escolher a proposta, pôs a
 * condição «tem que ser dia 2/12 de manhã»; a Vitória perguntou ao parceiro
 * (d97), ele disse «Sim, conseguimos, pode agendar», o cliente disse SIM — e a
 * data do pedido e a da negociação continuaram vazias.
 */

import { guardarOQuando, interpretarQuando, quandoNoResumo, type DadosDaRecolha } from "./whatsapp-recolha";
import { camposDaRecolha } from "./pedido-da-recolha";
import { datasDitas } from "./datas-ditas";
import { horaLimiteNaFrase, semAHoraLimite } from "./hora-limite";
import { pareceQuando } from "./leitor-da-recolha";
import { diaCombinadoEmPalavras, diaCombinadoNaCondicao, fraseDoDiaCombinado } from "./vitoria-agente/dia-combinado";
import { tratarARespostaDoParceiro, type DependenciasDaResposta, type PerguntaRegistada } from "./vitoria-agente/pergunta-ao-parceiro";
import { lerPendente, type Pendente } from "./vitoria-agente/pendentes";
import { responderAoVivo, type DependenciasAoVivo } from "./vitoria-agente/ao-vivo";
import { mensagemAoParceiro, type FechoProposto } from "./vitoria-agente/propostas-do-agente";
import { AGORA_DOS_CASOS, CONVERSAS_DE_TESTE, propostasDoCaso } from "./vitoria-agente/conversas-de-teste";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

/** Quinta-feira, 26-11-2026, 15h00 em Lisboa (inverno: UTC+0). */
const HOJE = new Date("2026-11-26T15:00:00Z");
const FRASE_DO_CASO = "tem que ser dia 2 de manhã até às 13 ou 13h30";

function recolhaCom(frase: string, agora = HOJE): DadosDaRecolha {
  const d = { serviceType: "recolha_monos", description: "2 estantes" } as DadosDaRecolha;
  guardarOQuando(d, frase, agora);
  return d;
}

/* ── 1. Na recolha: o dia e a hora-limite ───────────────────────────────── */

describe("na recolha, «dia 2 de manhã até às 13 ou 13h30» marca o dia 2 às 9h, e a hora-limite vai para as notas", () => {
  it("o pedido fica com a data (2 de dezembro, 9h de Lisboa) e deixa de ser «sem pressa»", () => {
    const d = recolhaCom(FRASE_DO_CASO);
    expect(d.dataDesejada).toBe("2026-12-02T09:00:00.000Z");
    expect(d.urgency).not.toBe("flexible");
    expect(d.quandoTexto).toBe(FRASE_DO_CASO);
  });

  it("o resumo e o pedido dizem o mesmo: o dia, a manhã e o limite — sem uma hora que ele não disse", () => {
    const d = recolhaCom(FRASE_DO_CASO);
    const resumo = quandoNoResumo(d);
    expect(resumo).toBe("quarta-feira, 2 de dezembro, de manhã (até às 13h30)");
    expect(resumo).not.toMatch(/09:00|13:30/);
    const campos = camposDaRecolha("351900000000", d);
    expect(campos.dataDesejada).toBe("2026-12-02T09:00");
    // As notas para o parceiro levam a janela; o dia, que já está no campo, não se repete.
    expect(campos.description).toMatch(/até às 13 ou 13h30/);
    expect(campos.description).not.toMatch(/dia 2/);
  });

  it("«quinta à tarde» = 14h; «2/12 até às 13h» = 9h com o limite no resumo; a hora dita sem «até» manda", () => {
    expect(recolhaCom("quinta à tarde").dataDesejada).toBe("2026-12-03T14:00:00.000Z");
    const ate = recolhaCom("2/12 até às 13h");
    expect(ate.dataDesejada).toBe("2026-12-02T09:00:00.000Z");
    expect(quandoNoResumo(ate)).toBe("quarta-feira, 2 de dezembro, até às 13h");
    expect(recolhaCom("sexta às 10h").dataDesejada).toBe("2026-11-27T10:00:00.000Z");
    expect(recolhaCom("dia 2 às 15h").dataDesejada).toBe("2026-12-02T15:00:00.000Z");
  });

  it("«dia 2» é o próximo dia 2 a partir de hoje, em Lisboa; «dia 31» salta o mês que não o tem", () => {
    expect(datasDitas("dia 2", HOJE).map((x) => x.dia)).toEqual(["2026-12-02"]);
    expect(datasDitas("dia 26", HOJE).map((x) => x.dia)).toEqual(["2026-11-26"]);
    expect(datasDitas("dia 2", new Date("2026-12-03T10:00:00Z")).map((x) => x.dia)).toEqual(["2027-01-02"]);
    expect(datasDitas("dia 31", HOJE).map((x) => x.dia)).toEqual(["2026-12-31"]);
    // Às 23h30 de Lisboa do dia 1 de dezembro, «dia 2» é amanhã.
    expect(datasDitas("dia 2", new Date("2026-12-01T23:30:00Z")).map((x) => x.dia)).toEqual(["2026-12-02"]);
  });

  it("«bom dia 2 estantes» não é uma data; «dia 2 de dezembro» continua a ser o 2 de dezembro", () => {
    expect(datasDitas("bom dia 2 estantes para levar", HOJE)).toEqual([]);
    expect(pareceQuando("bom dia 2 estantes")).toBe(false);
    expect(pareceQuando("dia 2")).toBe(true);
    expect(interpretarQuando("dia 2 de dezembro de manhã", HOJE).data?.toISOString()).toBe("2026-12-02T09:00:00.000Z");
  });
});

describe("a hora-limite", () => {
  it("«até às 13 ou 13h30» → «até às 13h30»; «antes das 12h»; «até 13 sacos» e «até 2/12» não são horas", () => {
    expect(horaLimiteNaFrase("ate as 13 ou 13h30")?.texto).toBe("até às 13h30");
    expect(horaLimiteNaFrase("antes das 12h")?.texto).toBe("antes das 12h");
    expect(horaLimiteNaFrase("ate 13h")?.texto).toBe("até às 13h");
    expect(horaLimiteNaFrase("ate 13 sacos")).toBeNull();
    expect(horaLimiteNaFrase("ate 2/12")).toBeNull();
    expect(horaLimiteNaFrase("ate as 13 de dezembro")).toBeNull();
    const t = "dia 2 ate as 13h30";
    expect(semAHoraLimite(t)).toHaveLength(t.length);
    expect(semAHoraLimite(t)).not.toMatch(/13/);
  });
});

/* ── 2. A condição que o parceiro confirmou ─────────────────────────────── */

describe("o dia combinado lê-se da condição (e da hora do parceiro)", () => {
  it("«tem que ser dia 2/12 de manhã» + «Sim, conseguimos» → 2 de dezembro às 9h", () => {
    const d = diaCombinadoNaCondicao("tem que ser dia 2/12 de manhã", null, AGORA_DOS_CASOS);
    expect(d?.em).toBe("2026-12-02T09:00:00.000Z");
    expect(diaCombinadoEmPalavras(d!)).toBe("quarta-feira, 2 de dezembro, de manhã");
    expect(fraseDoDiaCombinado(d!)).toBe("Fica combinado para quarta-feira, 2 de dezembro, de manhã, como pediu — o parceiro já tem o dia na agenda dele.");
  });

  it("a hora do parceiro junta-se ao dia da condição; o dia dele manda; um limite ou nenhum dia não grava nada", () => {
    expect(diaCombinadoNaCondicao("dia 2/12 de manhã", "às 10h", AGORA_DOS_CASOS)?.em).toBe("2026-12-02T10:00:00.000Z");
    expect(diaCombinadoNaCondicao("dia 2/12 de manhã", "quinta às 15h", AGORA_DOS_CASOS)?.em).toBe("2026-11-26T15:00:00.000Z");
    expect(diaCombinadoNaCondicao("até quinta-feira", null, AGORA_DOS_CASOS)).toBeNull();
    expect(diaCombinadoNaCondicao("só de manhã", null, AGORA_DOS_CASOS)).toBeNull();
    expect(diaCombinadoNaCondicao("", null, AGORA_DOS_CASOS)).toBeNull();
  });
});

const DOIS = CONVERSAS_DE_TESTE[1];
const PARCEIRO = "Recolhas Tejo";

function pergunta(condicao: string): PerguntaRegistada {
  const prop = propostasDoCaso(DOIS).find((p) => p.parceiro === PARCEIRO)!;
  return {
    id: 1,
    tipo: "parceiro",
    pedidoId: 664,
    negociacaoId: prop.negociacaoId,
    parceiro: PARCEIRO,
    condicao,
    mensagem: mensagemAoParceiro(prop, condicao),
    propostoEm: AGORA_DOS_CASOS.toISOString(),
    telefoneCliente: "351900000000",
  };
}

function mundo() {
  const pendentes: FechoProposto[] = [];
  const desejados: string[] = [];
  const deps: DependenciasDaResposta = {
    agora: AGORA_DOS_CASOS,
    marcarRespondida: async () => true,
    historico: async () => {},
    clienteInterrompido: async () => false,
    propostas: async () => propostasDoCaso(DOIS),
    pedidoParaOFecho: async () => ({ status: "pendente" }),
    correrOAgente: async () => null,
    enviarAoCliente: async () => true,
    gravarPendente: async (f) => void pendentes.push(f),
    gravarODiaDesejado: async (d) => void desejados.push(d.em),
    passarAEquipa: async () => {},
    registar: async () => {},
  };
  return { deps, pendentes, desejados };
}

describe("o SIM do parceiro à condição de dia leva o dia ao fecho, e o SIM do cliente grava-o", () => {
  it("«Sim, conseguimos, pode agendar» → o fecho à espera do SIM leva o dia, e o pedido fica já com ele", async () => {
    const m = mundo();
    expect(await tratarARespostaDoParceiro(pergunta("tem que ser dia 2/12 de manhã"), "Sim, conseguimos, pode agendar", m.deps, "whatsapp")).toBe("sim");
    expect(m.pendentes[0]).toMatchObject({ tipo: "fecho", pedidoId: 664, diaCombinado: { em: "2026-12-02T09:00:00.000Z" } });
    expect(m.desejados).toEqual(["2026-12-02T09:00:00.000Z"]);
  });

  it("o fecho do Claude também leva o dia", async () => {
    const m = mundo();
    const p = pergunta("tem que ser dia 2/12 de manhã");
    m.deps.correrOAgente = async () =>
      ({
        estado: "ok",
        texto: "Boa notícia. Responda SIM.",
        motivo: null,
        teriaFeito: [],
        recusadas: [],
        uso: { entrada: 0, saida: 0, cacheLidos: 0, cacheEscritos: 0 },
        custoUsd: 0,
        idas: 1,
        modelo: "x",
        pendente: { tipo: "fecho", pedidoId: 664, negociacaoId: p.negociacaoId, parceiro: PARCEIRO, total: 86.96, propostoEm: AGORA_DOS_CASOS.toISOString() },
        mensagemDeEquipa: null,
      }) as never;
    expect(await tratarARespostaDoParceiro(p, "Sim", m.deps, "whatsapp")).toBe("sim");
    expect(m.pendentes[0].diaCombinado?.em).toBe("2026-12-02T09:00:00.000Z");
  });

  it("sem dia na condição («até quinta-feira»), o fecho sai como sempre, sem dia", async () => {
    const m = mundo();
    await tratarARespostaDoParceiro(pergunta("até quinta-feira"), "sim", m.deps, "whatsapp");
    expect(m.pendentes[0].diaCombinado).toBeUndefined();
    expect(m.desejados).toEqual([]);
  });

  it("o pendente guardado guarda o dia; o SIM do cliente fecha pelo botão com o dia", async () => {
    const m = mundo();
    await tratarARespostaDoParceiro(pergunta("tem que ser dia 2/12 de manhã"), "Sim, conseguimos, pode agendar", m.deps, "whatsapp");
    let pendente: Pendente | null = lerPendente(JSON.stringify(m.pendentes[0]));
    expect(pendente).toMatchObject({ tipo: "fecho", diaCombinado: { em: "2026-12-02T09:00:00.000Z" } });
    const fechos: Array<{ id: string; dia: string | null }> = [];
    const vivo: DependenciasAoVivo = {
      agora: AGORA_DOS_CASOS,
      interruptores: async () => ({ conversa: true, aceitar: true }),
      situacao: async () => ({ temPedidos: true, interrompida: false, recolhaEmCurso: false, perguntaDeDadosAEspera: false }),
      regras: async () => {},
      pendente: async () => pendente,
      acabarPendente: async () => {
        pendente = null;
      },
      gravarPendente: async () => {},
      propostasParaEscolher: async () => propostasDoCaso(DOIS),
      fecharPeloBotao: async (p, n, dia) => void fechos.push({ id: `ct:${p}:${n}`, dia: dia?.em ?? null }),
      cancelarPeloCancelar: async () => ({ ok: true }),
      marcarPerguntaDoCancelar: async () => {},
      correrOAgente: async () => {
        throw new Error("não vai ao agente");
      },
      perguntarAoParceiro: async () => ({ ok: true }),
      enviar: async () => true,
      passarAEquipa: async () => {},
      registar: async () => {},
    };
    expect(await responderAoVivo({ tipo: "texto", texto: "SIM" }, vivo)).toBe("codigo");
    expect(fechos).toEqual([{ id: `ct:664:${m.pendentes[0].negociacaoId}`, dia: "2026-12-02T09:00:00.000Z" }]);
  });
});

/* ── 3. O fecho grava-o no pedido e na negociação, e di-lo ──────────────── */

describe("o fecho com o dia combinado (código)", () => {
  const neg = ler("src/lib/whatsapp-negociacao.ts");

  it("o botão passa o dia ao fecho, que o grava na negociação (dataCombinada) e no pedido (dataAgendada)", () => {
    expect(neg).toContain('if (accao === "ct" && conteudo.diaCombinado) await fecharPeloCliente(telefone, alvo, undefined, conteudo.diaCombinado);');
    const grava = neg.slice(neg.indexOf("async function gravarODiaCombinadoNoFecho"), neg.indexOf("export async function avisarOContratadoDoFechoPeloWhatsApp"));
    expect(grava).toContain("UPDATE negociacoes SET dataCombinada = ? WHERE id = ? AND pedidoId = ? AND estado = 'acordada'");
    expect(grava).toContain("dataAgendada: em");
  });

  it("grava antes do aviso ao parceiro, que leva o dia; a mensagem ao cliente di-lo", () => {
    const fecho = neg.slice(neg.indexOf("async function fecharPeloCliente("));
    const grava = fecho.indexOf("gravarODiaCombinadoNoFecho(alvo");
    const aviso = fecho.indexOf("await avisarOContratadoDoFechoPeloWhatsApp(");
    expect(grava).toBeGreaterThan(0);
    expect(aviso).toBeGreaterThan(grava);
    expect(fecho).toContain("fraseDoDiaCombinado(combinado)");
    expect(ler("src/lib/agir-como-cliente.ts")).toContain("quando: c.quando ?? null");
    expect(ler("src/lib/email-trabalho.ts")).toContain("Dia combinado");
  });

  it("a Vitória agente passa o dia do pendente ao botão", () => {
    expect(ler("src/lib/vitoria-agente/ao-vivo.ts")).toContain("deps.fecharPeloBotao(p.pedidoId, p.negociacaoId, p.diaCombinado ?? null)");
    expect(ler("src/lib/vitoria-agente/ao-vivo-na-base.ts")).toContain("diaCombinado ? { ...botao, diaCombinado } : botao");
  });
});
