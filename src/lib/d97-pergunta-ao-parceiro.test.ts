import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * d97 — A PERGUNTA AO PARCEIRO, DE IDA E VOLTA (23-11-2026).
 *
 * Conversas e parceiros inventados (o repositório é público). O caso que
 * motivou a d97 (#664): «validar que o serviço inclui o transporte» depois do
 * fecho proposto respondeu-se «vou confirmar com o parceiro» e o pedido parou.
 * Aqui: o que o serviço inclui responde-se logo e repete-se a pergunta do SIM;
 * a condição que só o parceiro pode dizer SAI para ele; a resposta (SIM, NÃO,
 * uma data-hora) volta ao cliente; ambígua ou 2 h sem resposta → equipa; a
 * mesma pergunta nunca sai duas vezes.
 */

import { condicaoJaIncluida, oQueOServicoInclui } from "./vitoria-agente/o-que-o-servico-inclui";
import {
  aoClienteComONao,
  chaveDaPergunta,
  lerARespostaDoParceiro,
  motivoDoPrazo,
  pedidoDaPergunta,
  prazoDaPergunta,
  quandoNaResposta,
  tratarARespostaDoParceiro,
  type DependenciasDaResposta,
  type PerguntaRegistada,
} from "./vitoria-agente/pergunta-ao-parceiro";
import { correrFerramenta, estadoNovo } from "./vitoria-agente/ferramentas";
import { responderAoVivo, notaDoFechoAEspera, type DependenciasAoVivo } from "./vitoria-agente/ao-vivo";
import { mensagemAoParceiro, perguntaDoFecho, type FechoProposto } from "./vitoria-agente/propostas-do-agente";
import type { Pendente } from "./vitoria-agente/pendentes";
import type { ResultadoDoAgente } from "./vitoria-agente/cliente";
import { AGORA_DOS_CASOS, CONVERSAS_DE_TESTE, ferramentasDoCaso, propostasDoCaso, type CasoDeTeste } from "./vitoria-agente/conversas-de-teste";
import { oQueTeriaFeito } from "./vitoria-agente/painel-do-ensaio";
import { mensagemDoTurno, AVISO_AO_MODELO } from "./vitoria-agente/aviso-ao-modelo";
import { horaEmLisboa, diaEmLisboa } from "./hora-de-lisboa";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const caso = (n: number) => CONVERSAS_DE_TESTE[n - 1];
const doze = caso(12);
const RECOLHAS_TEJO = "Recolhas Tejo";

/* ── 1. O que o serviço inclui responde-se logo ─────────────────────────── */

describe("o que o serviço inclui responde-se pelas regras (o caso #664)", () => {
  it("numa recolha: a descida, a carga, o transporte e o destino legal", () => {
    const r = oQueOServicoInclui("recolha_monos");
    expect(r.inclui.join(" ")).toMatch(/descer/);
    expect(r.inclui).toContain("o transporte");
    expect(r.inclui.join(" ")).toMatch(/destino legal/);
    expect(r.dependeDoParceiro.join(" ")).toMatch(/data e a hora/);
    expect(r.oQueOParceiroFaz).toMatch(/carrega e leva/);
  });

  it("transporte, descida, lixo, reciclagem: já incluído; só a descida, um dia, um frigorífico a mais: depende do parceiro", () => {
    for (const t of [
      "validar que o serviço inclui o transporte",
      "inclui a descida?",
      "levam para o lixo?",
      "vai para a reciclagem?",
      "o transporte está incluído",
    ]) {
      expect(condicaoJaIncluida(t, "recolha_monos"), t).toMatch(/^Sim, já está incluído/);
    }
    for (const t of ["só a descida", "até quinta-feira", "só de manhã", "se levar também o frigorífico", "dia 26 às 10h"]) {
      expect(condicaoJaIncluida(t, "recolha_monos"), t).toBeNull();
    }
    expect(condicaoJaIncluida("inclui o transporte", "mudanca")).toMatch(/carga, o transporte e a descarga/);
    expect(condicaoJaIncluida("inclui o transporte", "manutencao_casa")).toBeNull();
  });

  it("perguntar_ao_parceiro recusa o que o serviço já inclui: não fica pergunta pendente", async () => {
    const e = estadoNovo();
    const r = await correrFerramenta(
      "perguntar_ao_parceiro",
      { pedido: 674, escolha: RECOLHAS_TEJO, condicao: "validar que o serviço inclui o transporte" },
      ferramentasDoCaso(doze, { aoVivo: true, aceitarLigado: true }),
      e,
    );
    expect(r.resultado).toMatchObject({ perguntaPreparada: false, jaIncluido: true });
    expect(String(r.resultado.resposta)).toMatch(/transporte/);
    expect(e.pendente).toBeNull();
  });

  it("a ferramenta o_que_o_servico_inclui lê o pedido deste cliente e diz para repetir o SIM", async () => {
    const e = estadoNovo();
    const r = await correrFerramenta("o_que_o_servico_inclui", { pedido: 674 }, ferramentasDoCaso(doze), e);
    expect(r.resultado).toMatchObject({ pedido: 674, servico: "recolha_monos" });
    expect(String(r.resultado.nota)).toMatch(/aceitar_proposta/);
    const outro = await correrFerramenta("o_que_o_servico_inclui", { pedido: 999 }, ferramentasDoCaso(doze), estadoNovo());
    expect(outro.erro).toBe(true);
  });

  it("a sério: a pergunta a meio do fecho vai ao agente com a nota do fecho, e a pergunta do SIM sai outra vez", async () => {
    const f: Pendente = { tipo: "fecho", pedidoId: 674, negociacaoId: 6741, parceiro: RECOLHAS_TEJO, total: 86.96, propostoEm: AGORA_DOS_CASOS.toISOString() };
    let notaVista: string | undefined;
    const enviados: string[] = [];
    const perguntas: string[] = [];
    const equipa: string[] = [];
    let pendente: Pendente | null = f;
    const prop = propostasDoCaso(doze).find((p) => p.negociacaoId === 6741)!;
    const deps: DependenciasAoVivo = {
      agora: AGORA_DOS_CASOS,
      interruptores: async () => ({ conversa: true, aceitar: true }),
      situacao: async () => ({ temPedidos: true, interrompida: false, recolhaEmCurso: false, perguntaDeDadosAEspera: false }),
      regras: async () => {
        throw new Error("não são as regras");
      },
      pendente: async () => pendente,
      acabarPendente: async () => {
        pendente = null;
      },
      gravarPendente: async (p) => {
        pendente = p;
      },
      propostasParaEscolher: async () => propostasDoCaso(doze),
      fecharPeloBotao: async () => {},
      cancelarPeloCancelar: async () => ({ ok: true }),
      marcarPerguntaDoCancelar: async () => {},
      correrOAgente: async (_prazo, nota) => {
        notaVista = nota;
        const fecho: FechoProposto = { ...f, propostoEm: AGORA_DOS_CASOS.toISOString() };
        return {
          estado: "ok",
          texto: `Inclui, sim: a descida, a carga e o transporte. ${perguntaDoFecho(prop)}`,
          motivo: null,
          teriaFeito: [],
          recusadas: [],
          uso: { entrada: 0, saida: 0, cacheLidos: 0, cacheEscritos: 0 },
          custoUsd: 0,
          idas: 2,
          modelo: "x",
          pendente: fecho,
          mensagemDeEquipa: null,
        } as ResultadoDoAgente;
      },
      perguntarAoParceiro: async (p) => {
        perguntas.push(p.condicao);
        return { ok: true };
      },
      enviar: async (t) => {
        enviados.push(t);
        return true;
      },
      passarAEquipa: async (m) => void equipa.push(m),
      registar: async () => {},
    };
    expect(await responderAoVivo({ tipo: "texto", texto: "Antes queria validar que o serviço inclui o transporte" }, deps)).toBe("agente");
    expect(notaVista).toBe(notaDoFechoAEspera(f));
    expect(notaVista).toMatch(/o_que_o_servico_inclui/);
    expect(enviados[0]).toMatch(/transporte/);
    expect(enviados[0]).toContain("Responda SIM.");
    expect(perguntas).toEqual([]);
    expect(equipa).toEqual([]);
    expect(pendente).toMatchObject({ tipo: "fecho", pedidoId: 674 });
  });

  it("a nota do turno vai à parte, marcada como não sendo do cliente; o aviso diz para não perguntar o que já se sabe", () => {
    const t = mensagemDoTurno(AGORA_DOS_CASOS, [{ direccao: "in", texto: "Olá" }], [674], "O parceiro respondeu SIM.");
    expect(t).toMatch(/Nota do sistema \(não é do cliente\): O parceiro respondeu SIM\.$/);
    expect(mensagemDoTurno(AGORA_DOS_CASOS, [{ direccao: "in", texto: "Olá" }], [674])).not.toMatch(/Nota do sistema/);
    expect(AVISO_AO_MODELO).toMatch(/inclui o transporte\?/);
    expect(AVISO_AO_MODELO).toMatch(/o_que_o_servico_inclui/);
    expect(AVISO_AO_MODELO).toMatch(/nota do sistema com a resposta do parceiro/);
  });
});

/* ── 2. A leitura da resposta do parceiro ───────────────────────────────── */

describe("a resposta do parceiro, lida pelo código", () => {
  it("SIM, NÃO e uma data-hora; o resto é ambíguo", () => {
    expect(lerARespostaDoParceiro("Sim, quinta às 15h")).toEqual({ tipo: "sim", quando: "quinta às 15h" });
    expect(lerARespostaDoParceiro("sim")).toEqual({ tipo: "sim", quando: null });
    expect(lerARespostaDoParceiro("Consigo 👍")).toEqual({ tipo: "sim", quando: null });
    expect(lerARespostaDoParceiro("quinta às 15h")).toEqual({ tipo: "sim", quando: "quinta às 15h" });
    expect(lerARespostaDoParceiro("Não")).toEqual({ tipo: "nao" });
    expect(lerARespostaDoParceiro("não consigo, desculpe")).toEqual({ tipo: "nao" });
    for (const t of ["sim mas só sexta", "não consigo quinta, só sexta", "quanto é?", "vou ver e digo", "", "ok depende do trânsito"]) {
      expect(lerARespostaDoParceiro(t).tipo, t).toBe("ambigua");
    }
    expect(quandoNaResposta("Pode ser dia 26 de manhã")).toBe("dia 26 de manhã");
  });

  it("a pergunta reconhece-se pelo texto que lhe saiu (o da d92), e só esse", () => {
    const prop = propostasDoCaso(caso(2))[0];
    expect(pedidoDaPergunta(mensagemAoParceiro(prop, "até quinta-feira"))).toBe(664);
    expect(pedidoDaPergunta("Olá! Novo pedido #664 em Almada.")).toBeNull();
    expect(pedidoDaPergunta(null)).toBeNull();
  });

  it("a mesma pergunta tem a mesma chave (idempotente); outra condição ou outra proposta, outra chave", () => {
    const a = chaveDaPergunta({ pedidoId: 664, negociacaoId: 6641, condicao: "Até  quinta-feira" });
    expect(chaveDaPergunta({ pedidoId: 664, negociacaoId: 6641, condicao: "até quinta-feira" })).toBe(a);
    expect(chaveDaPergunta({ pedidoId: 664, negociacaoId: 6641, condicao: "só de manhã" })).not.toBe(a);
    expect(chaveDaPergunta({ pedidoId: 664, negociacaoId: 6642, condicao: "até quinta-feira" })).not.toBe(a);
    expect(a.length).toBeLessThanOrEqual(80);
  });
});

/* ── 3. O prazo das 2 h, das 8h às 21h ───────────────────────────────────── */

describe("o prazo: 2 h dentro das 8h–21h de Lisboa", () => {
  // Novembro: Lisboa = UTC.
  const em = (iso: string) => prazoDaPergunta(new Date(iso));
  it("de dia, 2 h; ao fim do dia, continua às 8h; de noite ou de madrugada, conta a partir das 8h", () => {
    expect(em("2026-11-23T15:00:00Z").toISOString()).toBe("2026-11-23T17:00:00.000Z");
    expect(em("2026-11-23T20:30:00Z").toISOString()).toBe("2026-11-24T09:30:00.000Z");
    expect(em("2026-11-23T23:00:00Z").toISOString()).toBe("2026-11-24T10:00:00.000Z");
    expect(em("2026-11-24T06:00:00Z").toISOString()).toBe("2026-11-24T10:00:00.000Z");
    const p = em("2026-11-23T19:00:00Z");
    expect(`${diaEmLisboa(p)} ${horaEmLisboa(p)}`).toBe("2026-11-23 21:00");
  });

  it("o motivo do cartão «Precisa de si» diz que está à espera do parceiro há 2 h", () => {
    expect(motivoDoPrazo({ pedidoId: 664, parceiro: RECOLHAS_TEJO, condicao: "até quinta-feira" })).toBe(
      "À espera do parceiro há 2 h — pedido #664: Recolhas Tejo não respondeu se consegue «até quinta-feira». Responder ao cliente",
    );
  });
});

/* ── 4. A volta: a resposta chega ao cliente ────────────────────────────── */

const DOIS: CasoDeTeste = caso(2);

function pergunta(): PerguntaRegistada {
  const prop = propostasDoCaso(DOIS).find((p) => p.parceiro === RECOLHAS_TEJO)!;
  return {
    id: 1,
    tipo: "parceiro",
    pedidoId: 664,
    negociacaoId: prop.negociacaoId,
    parceiro: RECOLHAS_TEJO,
    condicao: "até quinta-feira",
    mensagem: mensagemAoParceiro(prop, "até quinta-feira"),
    propostoEm: AGORA_DOS_CASOS.toISOString(),
    telefoneCliente: "351900000000",
  };
}

function mundoDaResposta(over: Partial<DependenciasDaResposta> = {}) {
  const enviados: string[] = [];
  const pendentes: FechoProposto[] = [];
  const equipa: Array<{ motivo: string; mensagem: string | null }> = [];
  const historico: string[] = [];
  const registos: Array<{ teriaFeito: string[]; motivo: string | null }> = [];
  let respondida = false;
  const deps: DependenciasDaResposta = {
    agora: AGORA_DOS_CASOS,
    marcarRespondida: async () => {
      if (respondida) return false;
      respondida = true;
      return true;
    },
    historico: async (l) => void historico.push(l),
    clienteInterrompido: async () => false,
    propostas: async () => propostasDoCaso(DOIS),
    pedidoParaOFecho: async () => ({ status: "pendente" }),
    correrOAgente: async () => null,
    enviarAoCliente: async (t) => {
      enviados.push(t);
      return true;
    },
    gravarPendente: async (f) => void pendentes.push(f),
    passarAEquipa: async (motivo, mensagem) => void equipa.push({ motivo, mensagem }),
    registar: async (l) => void registos.push({ teriaFeito: l.teriaFeito, motivo: l.motivo }),
    ...over,
  };
  return { deps, enviados, pendentes, equipa, historico, registos };
}

describe("a resposta do parceiro volta ao cliente", () => {
  it("«sim, quinta às 15h» → o cliente lê a confirmação e a pergunta do SIM; o SIM dele fecha pelo botão de sempre", async () => {
    const m = mundoDaResposta();
    expect(await tratarARespostaDoParceiro(pergunta(), "sim, quinta às 15h", m.deps, "whatsapp")).toBe("sim");
    expect(m.enviados[0]).toMatch(/Recolhas Tejo confirma que consegue «até quinta-feira» \(quinta às 15h\)/);
    expect(m.enviados[0]).toContain("86,96 €");
    expect(m.enviados[0]).toMatch(/Responda SIM\.$/);
    expect(m.pendentes[0]).toMatchObject({ tipo: "fecho", pedidoId: 664, total: 86.96 });
    expect(m.historico[0]).toMatch(/respondeu SIM \(quinta às 15h\)/);
    expect(m.registos[0].teriaFeito[0]).toMatch(/o parceiro respondeu: sim/);

    // O cliente responde SIM: o código fecha pelo botão de sempre.
    const fechos: string[] = [];
    let pendente: Pendente | null = m.pendentes[0];
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
      fecharPeloBotao: async (p, n) => void fechos.push(`ct:${p}:${n}`),
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
    expect(fechos).toEqual([`ct:664:${pergunta().negociacaoId}`]);
  });

  it("com o Claude: a resposta dele sai quando traz a pergunta do SIM desta proposta", async () => {
    const p = pergunta();
    let nota = "";
    const m = mundoDaResposta({
      correrOAgente: async (n) => {
        nota = n;
        const prop = propostasDoCaso(DOIS).find((x) => x.negociacaoId === p.negociacaoId)!;
        return {
          estado: "ok",
          texto: `A Recolhas Tejo confirma: pode ir na quinta às 15h. ${perguntaDoFecho(prop)}`,
          motivo: null,
          teriaFeito: ["proposto o fecho"],
          recusadas: [],
          uso: { entrada: 0, saida: 0, cacheLidos: 0, cacheEscritos: 0 },
          custoUsd: 0,
          idas: 2,
          modelo: "x",
          pendente: { tipo: "fecho", pedidoId: 664, negociacaoId: p.negociacaoId, parceiro: RECOLHAS_TEJO, total: 86.96, propostoEm: AGORA_DOS_CASOS.toISOString() },
          mensagemDeEquipa: null,
        } as ResultadoDoAgente;
      },
    });
    expect(await tratarARespostaDoParceiro(p, "Sim, quinta às 15h", m.deps, "whatsapp")).toBe("sim");
    expect(nota).toMatch(/respondeu à pergunta do pedido #664 \(«até quinta-feira»\): SIM, quinta às 15h/);
    expect(nota).toMatch(/aceitar_proposta/);
    expect(m.enviados).toEqual([expect.stringMatching(/^A Recolhas Tejo confirma/)]);
    expect(m.pendentes).toHaveLength(1);
  });

  it("«não» → a alternativa (as outras propostas), sem fecho proposto", async () => {
    const m = mundoDaResposta();
    expect(await tratarARespostaDoParceiro(pergunta(), "Não consigo", m.deps, "painel")).toBe("nao");
    expect(m.enviados[0]).toBe(aoClienteComONao(pergunta(), 1));
    expect(m.enviados[0]).toMatch(/não consegue «até quinta-feira»/);
    expect(m.enviados[0]).toMatch(/outra proposta/);
    expect(m.pendentes).toEqual([]);
    expect(m.historico[0]).toMatch(/no painel/);
  });

  it("ambígua → equipa, com as palavras dele no motivo; ao cliente não sai nada", async () => {
    const m = mundoDaResposta();
    expect(await tratarARespostaDoParceiro(pergunta(), "sim mas só sexta", m.deps, "whatsapp")).toBe("equipa");
    expect(m.enviados).toEqual([]);
    expect(m.equipa[0].motivo).toMatch(/respondeu «sim mas só sexta» à pergunta «até quinta-feira»/);
  });

  it("idempotente: a segunda resposta à mesma pergunta não faz nada", async () => {
    const m = mundoDaResposta();
    await tratarARespostaDoParceiro(pergunta(), "sim", m.deps, "whatsapp");
    expect(await tratarARespostaDoParceiro(pergunta(), "sim", m.deps, "painel")).toBe("ja_respondida");
    expect(m.enviados).toHaveLength(1);
    expect(m.pendentes).toHaveLength(1);
  });

  it("uma pessoa já tem a conversa do cliente, ou a proposta mudou: não se escreve ao cliente, vai à equipa", async () => {
    const a = mundoDaResposta({ clienteInterrompido: async () => true });
    expect(await tratarARespostaDoParceiro(pergunta(), "sim", a.deps, "whatsapp")).toBe("equipa");
    expect(a.enviados).toEqual([]);
    const b = mundoDaResposta({ propostas: async () => [] });
    expect(await tratarARespostaDoParceiro(pergunta(), "sim", b.deps, "whatsapp")).toBe("equipa");
    expect(b.equipa[0].motivo).toMatch(/já não está disponível/);
  });
});

/* ── 5. As portas de verdade ───────────────────────────────────────────── */

describe("a ida e a volta nas portas de verdade", () => {
  const base = ler("src/lib/vitoria-agente/pergunta-ao-parceiro-na-base.ts");

  it("a pergunta sai pelo canal dos avisos: o interruptor, a vontade dele (o «parar») e a app; uma vez só", () => {
    expect(base).toContain("INSERT IGNORE INTO vitoriaPerguntasAoParceiro");
    expect(base).toContain("UNIQUE KEY uq_pergunta (chave)");
    expect(base).toContain('db.assistentePode("avisar_profissional")');
    expect(base).toContain("Number(perfil?.whatsappAvisos ?? 0) === 1");
    expect(base).toContain("enviarAvisoWhatsApp(telemovel, p.mensagem)");
    expect(base).toMatch(/sendPushToUser\([\s\S]*?"pro",/);
    expect(base).toContain("estado = 'sem_canal'");
  });

  it("a resposta: só com a pergunta desse pedido como a última que lhe saiu, e só aberta", () => {
    expect(base).toContain("saidasDoNumeroWhatsApp(telefone, 1)");
    expect(base).toContain("pedidoDaPergunta(ultima?.texto)");
    expect(base).toContain("WHERE id = ? AND estado = 'aberta'");
    expect(base).toContain("vivo_parceiro");
  });

  it("a ponte e o webhook passam a resposta do parceiro antes da conversa de sempre; a passagem do assistente corre os prazos", () => {
    const ponte = ler("src/app/api/whatsapp/ponte/route.ts");
    expect(ponte).toContain("respostaDoParceiroPeloWhatsApp(telefone, texto, { interrompido: true })");
    expect(ponte).toContain("if (!(await respostaDoParceiroPeloWhatsApp(telefone, texto).catch(() => false))) await responderARajada(telefone, id, texto);");
    expect(ler("src/app/api/whatsapp/webhook/route.ts")).toContain("respostaDoParceiroPeloWhatsApp(msg.from, msg.text.body)");
    expect(ler("src/app/api/cron/assistente/route.ts")).toContain("correrOsPrazosDasPerguntas()");
    expect(ler("src/lib/vitoria-agente/ao-vivo-na-base.ts")).toContain("perguntarAoParceiroDeVerdade(telefone, p, agora)");
  });

  it("o painel do parceiro: a rota lê o parceiro da sessão, nunca do corpo", () => {
    const rota = ler("src/app/api/profissionais/pergunta-do-cliente/route.ts");
    expect(rota).toContain("sessaoActivaDoProfissional(tokenDoProfissional(req))");
    expect(rota).toContain("respostaDoParceiroPeloPainel(sessao.providerId, perguntaId, resposta, quando)");
    expect(rota).not.toMatch(/corpo\.providerId/);
    expect(ler("src/app/profissionais/painel/PainelDoProfissional.tsx")).toContain("<PerguntaDoCliente />");
  });

  it("o painel «Ensaio da Vitória»: perguntou ao parceiro, e o parceiro respondeu", () => {
    expect(oQueTeriaFeito("vivo_ok", null, ["perguntou ao parceiro X: «até quinta» (#664) — à espera da resposta"]).agiria).toBe(true);
    expect(oQueTeriaFeito("vivo_parceiro", null, ["o parceiro respondeu: sim — #664, X"])).toEqual({ frase: "o parceiro respondeu: sim — #664, X", agiria: true });
    expect(ler("src/components/admin/EnsaioDaVitoria.tsx")).toContain("vivo_parceiro:");
  });
});
