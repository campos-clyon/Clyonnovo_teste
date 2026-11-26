import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * d136 — AS DATAS PERGUNTADAS A TODOS OS PARCEIROS, ANTES DE ESCOLHER
 * (26-11-2026). Conversas e parceiros inventados (o repositório é público).
 *
 * «E datas para executar o serviço?» / «esta semana termina amanhã, ainda
 * assim conseguem?» — a Vitória respondia «depende de cada parceiro, escolha
 * primeiro». Agora a pergunta da d97 sai para os parceiros com proposta aberta
 * (até 4); as respostas voltam juntas ao cliente («X: amanhã de manhã · Y:
 * sábado · Z: (sem resposta). Qual prefere?»), e o dia que ele escolher vai no
 * fecho (d131). E o «Enviar orçamento» da Mesa manda a mensagem curta da d123.
 */

import {
  diaDaEscolha,
  diaOferecido,
  JANELA_DA_RONDA,
  mensagemDeDisponibilidade,
  oQueOParceiroDisse,
  pedidoDaPerguntaDeDisponibilidade,
  respostaAoClienteDaRonda,
  VOU_PERGUNTAR_AOS_PARCEIROS,
} from "./vitoria-agente/disponibilidade";
import { pedidoDaPergunta, prazoDaPergunta, avisoDaPerguntaNaApp } from "./vitoria-agente/pergunta-ao-parceiro";
import { correrFerramenta, estadoNovo } from "./vitoria-agente/ferramentas";
import { responderAoVivo, type DependenciasAoVivo } from "./vitoria-agente/ao-vivo";
import { lerPendente, pendenteEmPalavras, type Pendente, type PerguntaAoParceiro } from "./vitoria-agente/pendentes";
import type { ResultadoDoAgente } from "./vitoria-agente/cliente";
import { AGORA_DOS_CASOS, CONVERSAS_DE_TESTE, ferramentasDoCaso, propostasDoCaso } from "./vitoria-agente/conversas-de-teste";
import { textoDoOrcamentoDaMesa, type PedidoDoOrcamento } from "./texto-do-orcamento-da-mesa";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const DOIS = CONVERSAS_DE_TESTE[1];

/** Quinta-feira, 26-11-2026, 15h00 em Lisboa (inverno: UTC+0). */
const QUINTA = new Date("2026-11-26T15:00:00Z");

/* ── 1. A pergunta que sai ─────────────────────────────────────────────── */

describe("a pergunta das datas sai para os parceiros", () => {
  it("o texto ao parceiro, e a resposta dele reconhece-se no WhatsApp (o mesmo caminho da d97)", () => {
    const m = mensagemDeDisponibilidade(664, "amanhã (sexta) ou sábado");
    expect(m).toBe("O cliente do pedido #664 pergunta se consegue amanhã (sexta) ou sábado. Consegue? Responda com o dia que pode.");
    expect(mensagemDeDisponibilidade(664, "")).toBe("O cliente do pedido #664 pergunta quando pode fazer o serviço. Responda com o dia que pode.");
    expect(pedidoDaPerguntaDeDisponibilidade(m)).toBe(664);
    expect(pedidoDaPergunta(m)).toBe(664);
    expect(pedidoDaPergunta("Olá, tudo bem? Pedido #664")).toBeNull();
    expect(avisoDaPerguntaNaApp({ pedidoId: 664, condicao: "sábado", rondaId: "664@x" }).corpo).toMatch(/Responda com o dia que pode/);
  });

  it("a ferramenta prepara a ronda (até 4 parceiros) e a frase vai tal e qual na resposta", async () => {
    const e = estadoNovo();
    const r = await correrFerramenta("perguntar_datas_aos_parceiros", { pedido: 664, quando: "amanhã (sexta) ou sábado" }, ferramentasDoCaso(DOIS), e);
    expect(r.resultado).toMatchObject({ perguntaPreparada: true, fraseQueTemDeIrNaResposta: VOU_PERGUNTAR_AOS_PARCEIROS });
    expect(JSON.stringify(r.resultado)).not.toMatch(/€/);
    expect(e.fraseObrigatoria).toBe(VOU_PERGUNTAR_AOS_PARCEIROS);
    const p = e.pendente as PerguntaAoParceiro;
    expect(p.tipo).toBe("parceiro");
    expect(p.ronda?.length).toBe(propostasDoCaso(DOIS).slice(0, 4).length);
    expect(p.ronda?.length).toBeGreaterThan(0);
    expect(p.ronda?.length).toBeLessThanOrEqual(4);
    expect(p.rondaId).toMatch(/^664@/);
    expect(p.ronda?.[0].mensagem).toBe(mensagemDeDisponibilidade(664, "amanhã (sexta) ou sábado"));
    // O pendente guardado guarda a ronda.
    expect(lerPendente(JSON.stringify(p))).toMatchObject({ ronda: p.ronda, rondaId: p.rondaId });
    expect(pendenteEmPalavras(p, false)).toMatch(/se conseguem: «amanhã \(sexta\) ou sábado» \(#664\)/);
  });

  it("o modelo é avisado: nunca «depende de cada parceiro, escolha primeiro»", () => {
    const aviso = ler("src/lib/vitoria-agente/aviso-ao-modelo.ts");
    expect(aviso).toContain("Chama perguntar_datas_aos_parceiros");
    expect(aviso).toContain("não digas que depende de cada parceiro nem que escolha primeiro");
    expect(aviso).toContain(VOU_PERGUNTAR_AOS_PARCEIROS);
  });

  it("as 2 h da ronda contam na janela de contacto (d7), a mesma da d97", () => {
    expect(JANELA_DA_RONDA).toEqual({ abre: 9, fecha: 20 });
    expect(prazoDaPergunta(new Date("2026-11-26T15:00:00Z"), undefined, JANELA_DA_RONDA).toISOString()).toBe("2026-11-26T17:00:00.000Z");
    expect(prazoDaPergunta(new Date("2026-11-26T20:30:00Z"), undefined, JANELA_DA_RONDA).toISOString()).toBe("2026-11-27T11:00:00.000Z");
  });
});

/* ── 2. Ao vivo: a ronda sai, e o fecho leva o dia ──────────────────────── */

function agente(pendente: Pendente | null, texto: string): ResultadoDoAgente {
  return {
    estado: "ok",
    texto,
    motivo: null,
    teriaFeito: [],
    recusadas: [],
    uso: { entrada: 0, saida: 0, cacheLidos: 0, cacheEscritos: 0 },
    custoUsd: 0,
    idas: 1,
    modelo: "x",
    pendente,
    mensagemDeEquipa: null,
  } as ResultadoDoAgente;
}

function vivo(resultado: ResultadoDoAgente, over: Partial<DependenciasAoVivo> = {}) {
  const enviados: string[] = [];
  const gravados: Pendente[] = [];
  const equipa: string[] = [];
  const rondas: PerguntaAoParceiro[] = [];
  const umaSo: PerguntaAoParceiro[] = [];
  const deps: DependenciasAoVivo = {
    agora: AGORA_DOS_CASOS,
    interruptores: async () => ({ conversa: true, aceitar: true }),
    situacao: async () => ({ temPedidos: true, interrompida: false, recolhaEmCurso: false, perguntaDeDadosAEspera: false }),
    regras: async () => {},
    pendente: async () => null,
    acabarPendente: async () => {},
    gravarPendente: async (p) => void gravados.push(p),
    propostasParaEscolher: async () => propostasDoCaso(DOIS),
    fecharPeloBotao: async () => {},
    cancelarPeloCancelar: async () => ({ ok: true }),
    marcarPerguntaDoCancelar: async () => {},
    correrOAgente: async () => resultado,
    perguntarAoParceiro: async (p) => {
      umaSo.push(p);
      return { ok: true };
    },
    perguntarARonda: async (p) => {
      rondas.push(p);
      return { ok: true, saiu: (p.ronda ?? []).map((x) => x.parceiro), naoSaiu: [] };
    },
    enviar: async (t) => {
      enviados.push(t);
      return true;
    },
    passarAEquipa: async (m) => void equipa.push(m),
    registar: async () => {},
    ...over,
  };
  return { deps, enviados, gravados, equipa, rondas, umaSo };
}

describe("ao vivo", () => {
  it("a ronda sai para todos (e não pela pergunta de um só); o cliente lê a frase", async () => {
    const e = estadoNovo();
    await correrFerramenta("perguntar_datas_aos_parceiros", { pedido: 664, quando: "esta semana" }, ferramentasDoCaso(DOIS), e);
    const m = vivo(agente(e.pendente, `Boa pergunta. ${VOU_PERGUNTAR_AOS_PARCEIROS}`));
    expect(await responderAoVivo({ tipo: "texto", texto: "Esta semana termina amanhã, ainda assim conseguem?" }, m.deps)).toBe("agente");
    expect(m.enviados[0]).toContain(VOU_PERGUNTAR_AOS_PARCEIROS);
    expect(m.rondas).toHaveLength(1);
    expect(m.umaSo).toHaveLength(0);
    expect(m.equipa).toEqual([]);
  });

  it("sem canal para nenhum parceiro, passa à equipa com o motivo", async () => {
    const e = estadoNovo();
    await correrFerramenta("perguntar_datas_aos_parceiros", { pedido: 664, quando: "sábado" }, ferramentasDoCaso(DOIS), e);
    const m = vivo(agente(e.pendente, VOU_PERGUNTAR_AOS_PARCEIROS), {
      perguntarARonda: async (p) => ({ ok: true, saiu: [], naoSaiu: (p.ronda ?? []).map((x) => x.parceiro) }),
    });
    await responderAoVivo({ tipo: "texto", texto: "Conseguem sábado?" }, m.deps);
    expect(m.equipa[0]).toMatch(/^Pedido #664: perguntar aos parceiros se conseguem «sábado» — a pergunta não saiu/);
  });

  it("depois da ronda, o fecho de quem escolhe leva o dia que o parceiro ofereceu (d131)", async () => {
    const prop = propostasDoCaso(DOIS)[0];
    const fecho: Pendente = { tipo: "fecho", pedidoId: 664, negociacaoId: prop.negociacaoId, parceiro: prop.parceiro, total: prop.conta.total, propostoEm: AGORA_DOS_CASOS.toISOString() };
    const vistos: string[] = [];
    const m = vivo(agente(fecho, "Fica com a proposta? Responda SIM."), {
      diaOferecido: async (pedidoId, negociacaoId, texto) => {
        vistos.push(`${pedidoId}:${negociacaoId}:${texto}`);
        return { em: "2026-11-28T09:00:00.000Z", dito: "sábado" };
      },
    });
    await responderAoVivo({ tipo: "texto", texto: "Fico com o primeiro, sábado" }, m.deps);
    expect(vistos).toEqual([`664:${prop.negociacaoId}:Fico com o primeiro, sábado`]);
    expect(m.gravados[0]).toMatchObject({ tipo: "fecho", diaCombinado: { em: "2026-11-28T09:00:00.000Z" } });
  });
});

/* ── 3. As respostas voltam juntas ao cliente ───────────────────────────── */

describe("as respostas dos parceiros, numa mensagem curta", () => {
  it("só o dia e a hora do que cada um disse — nunca o texto dele tal e qual", () => {
    expect(oQueOParceiroDisse("Sim, amanhã de manhã")).toBe("amanhã de manhã");
    expect(oQueOParceiroDisse("sábado")).toBe("sábado");
    expect(oQueOParceiroDisse("Não consigo")).toBe("não consegue");
    expect(oQueOParceiroDisse("sim")).toBe("consegue");
    expect(oQueOParceiroDisse(null)).toBe("(sem resposta)");
    const outra = oQueOParceiroDisse("ligue-me para o 910000000 que combinamos o preço");
    expect(outra).toBe("(resposta por confirmar)");
  });

  it("«X: amanhã de manhã · Y: sábado · Z: (sem resposta). Qual prefere?»", () => {
    expect(
      respostaAoClienteDaRonda(664, [
        { parceiro: "Recolhas Tejo", resposta: "Sim, amanhã de manhã" },
        { parceiro: "Transportes Exemplo", resposta: "sábado" },
        { parceiro: "Mudanças Fictícias", resposta: null },
      ]),
    ).toBe("Já perguntei aos parceiros do pedido #664: Recolhas Tejo: amanhã de manhã · Transportes Exemplo: sábado · Mudanças Fictícias: (sem resposta). Qual prefere?");
    expect(respostaAoClienteDaRonda(664, [{ parceiro: "Recolhas Tejo", resposta: "não consigo" }])).toMatch(/nenhum confirmou essa data/);
  });

  it("o dia oferecido lê-se no instante da resposta; o que o cliente disse ao escolher manda", () => {
    const sabado = diaOferecido("Sim, sábado", QUINTA);
    expect(sabado?.em).toBe("2026-11-28T09:00:00.000Z");
    expect(diaDaEscolha("Fico com a Recolhas Tejo, sábado à tarde", sabado, QUINTA)?.em).toBe("2026-11-28T14:00:00.000Z");
    expect(diaDaEscolha("Fico com a Recolhas Tejo", sabado, QUINTA)?.em).toBe("2026-11-28T09:00:00.000Z");
    // Um dia oferecido que já passou não vai no fecho.
    expect(diaDaEscolha("fico com essa", sabado, new Date("2026-11-29T10:00:00Z"))).toBeNull();
    expect(diaOferecido("não consigo", QUINTA)).toBeNull();
  });
});

/* ── 4. Na base: o mesmo registo, histórico e Mesa da d97 ──────────────── */

describe("na base (código)", () => {
  const base = ler("src/lib/vitoria-agente/pergunta-ao-parceiro-na-base.ts");

  it("a ronda fica no mesmo registo (vitoriaPerguntasAoParceiro, com a coluna ronda) e conta na janela de contacto", () => {
    expect(base).toContain("ALTER TABLE vitoriaPerguntasAoParceiro ADD COLUMN ronda VARCHAR(80) NULL DEFAULT NULL");
    expect(base).toContain("p.rondaId ? prazoDaPergunta(agora, undefined, JANELA_DA_RONDA) : prazoDaPergunta(agora)");
    expect(base).toContain("if (p.rondaId) return responderNaRonda(p, texto, origem, agora);");
  });

  it("a mensagem ao cliente sai uma vez por ronda, quando ninguém está à espera; ninguém respondeu → equipa", () => {
    const r = base.slice(base.indexOf("async function responderAoClienteDaRonda"));
    expect(r).toContain(`rows.some((r) => String(r.estado) === "aberta")`);
    expect(r).toContain("UPDATE vitoriaPerguntasAoParceiro SET ronda = ? WHERE ronda = ?");
    expect(r).toContain("respostas.every((r) => r.resposta == null)");
    expect(r).toContain("interromperNumeroWhatsApp(telefone, motivo");
    expect(r).toContain("respostaAoClienteDaRonda(pedidoId, respostas)");
  });

  it("o prazo da ronda não passa à equipa por cada parceiro: responde ao cliente com o que há", () => {
    const prazos = base.slice(base.indexOf("export async function correrOsPrazosDasPerguntas"));
    expect(prazos).toContain("rondas.add(p.rondaId);");
    expect(prazos).toContain("for (const ronda of rondas) await responderAoClienteDaRonda(ronda)");
  });

  it("pelas regras (sem o agente), um dia e uma hora sem parceiro contratado também pergunta a todos", () => {
    const neg = ler("src/lib/whatsapp-negociacao.ts");
    expect(neg).toContain("perguntarDatasATodosDeVerdade(telefone, pedidos[0]");
    expect(neg).toContain("await enviarTextoWhatsApp(telefone, VOU_PERGUNTAR_AOS_PARCEIROS);");
    const vivoNaBase = ler("src/lib/vitoria-agente/ao-vivo-na-base.ts");
    expect(vivoNaBase).toContain("perguntarARondaDeVerdade(telefone, p, agora)");
    expect(vivoNaBase).toContain("diaOferecidoNaRonda(pedidoId, negociacaoId, texto, agora)");
  });
});

/* ── 5. O «Enviar orçamento» da Mesa: o texto curto ─────────────────────── */

const negociacao = (id: number, nome: string, valor: number) => ({
  id,
  estado: "aberta",
  profissionalNome: nome,
  propostasJson: JSON.stringify([{ por: "profissional", valor, estado: "pendente", criadaEm: "2026-11-26T10:00:00Z" }]),
  taxaCliente: "0",
  taxaProfissional: "0.1000",
  criadaEm: "2026-11-26T09:00:00Z",
  noNovoModelo: true,
  regimeParaOTotal: "normal" as const,
});

const pedido = (o: Partial<PedidoDoOrcamento> = {}): PedidoDoOrcamento => ({
  id: 9136,
  contactName: "Ana Inventada",
  serviceType: "recolha_monos",
  city: "Almada",
  baseDoPreco: "total",
  horasPrevistas: null,
  valorUnicoCliente: null,
  negociacoes: [negociacao(1, "Recolhas Exemplo", 80), negociacao(2, "Transportes Exemplo", 100)],
  ...o,
});

describe("a Mesa manda a mensagem curta da d123", () => {
  it("sem a lista longa: o cumprimento, uma linha por proposta e o fecho, com a validade", () => {
    const t = textoDoOrcamentoDaMesa(pedido(), QUINTA);
    expect(t).not.toContain("O valor de cada uma é o total a pagar");
    expect(t).not.toContain("Inclui o que está nas fotografias");
    expect(t).toMatch(/^Boa tarde, Ana!/);
    expect(t).toContain("#9136 (recolha de monos)");
    expect(t).toContain("1) Recolhas Exemplo: 98,40 € (80 € + IVA)");
    expect(t).toContain("2) Transportes Exemplo: 123 € (100 € + IVA)");
    expect(t.split("\n").at(-1)).toMatch(/^Esta proposta é válida até [a-zç-]+, \d{2}\/\d{2}\.$/);
    expect(t.split("\n").length).toBeLessThanOrEqual(6);
  });

  it("uma proposta só, também curta", () => {
    const t = textoDoOrcamentoDaMesa(pedido({ negociacoes: [negociacao(1, "Recolhas Exemplo", 80)] }), QUINTA);
    expect(t).toContain("Recolhas Exemplo: 98,40 € (80 € + IVA)");
    expect(t).not.toContain("O valor é o total a pagar");
  });
});
