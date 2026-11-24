/**
 * d99 (23-11-2026), FASE 1 — A RECOLHA PELO AGENTE, EM ENSAIO.
 *
 * Sem dados de pessoas (nomes, ruas e números inventados) e com a base
 * simulada: o SDK é um cliente fingido (nunca se chama a API num teste).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import type { ClienteDoClaude } from "./vitoria-agente/cliente";
import type { DependenciasDasFerramentas } from "./vitoria-agente/ferramentas";
import { estadoNovo } from "./vitoria-agente/ferramentas";
import { TECTO_DA_RECOLHA_POR_OMISSAO_USD, tectoQueValeNaRecolha } from "./vitoria-agente/custo";
import {
  AVISO_DA_RECOLHA,
  comOResumo,
  compararOsResumos,
  conhecidosDoRascunho,
  correrFerramentaDaRecolha,
  CRITERIOS_DA_RECOLHA,
  FERRAMENTAS_DA_RECOLHA,
  fugasNoTexto,
  gravarNoRascunho,
  juntarConhecidos,
  lerDadosPessoais,
  MARCA_DO_NIF,
  MARCA_DO_NOME,
  MARCA_DO_RESUMO,
  marcarDadosPessoais,
  metricasDaRecolha,
  respostaAoResumo,
  vistaDoRascunho,
  type ContextoDaRecolha,
  type LinhaDaRecolhaEmEnsaio,
} from "./vitoria-agente/recolha-pelo-agente";
import {
  recolhaEmEnsaio,
  type ComparacaoDaRecolha,
  type DependenciasDaRecolhaEmEnsaio,
  type EnsaioDaRecolhaFechado,
  type SombraDaRecolha,
} from "./vitoria-agente/recolha-em-ensaio";
import { fundirCampos, passosEmFalta, resumo, type DadosDaRecolha } from "./whatsapp-recolha";
import { IDS_DA_LISTA } from "./servicos-da-vitoria";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
/** Sem os comentários (os que começam a linha, e os blocos JS/JSX). */
const semComentarios = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "")
    .replace(/^\s*\/\/.*$/gm, "");

const AGORA = new Date("2026-11-24T10:00:00Z");

/* Dados inventados — nomes, ruas e NIF de exemplo, que nunca podem chegar ao modelo. */
const NOME = "Graciete Moreirinha";
const RUA = "Rua das Camélias Brancas";
const NIF = "123456789";
const PRIMEIRA = `Bom dia, chamo-me ${NOME}. Queria levar um sofá e duas cadeiras. A morada é ${RUA} 14, 2800-123 Almada. O NIF para a fatura é ${NIF}.`;

const RECOLHA = IDS_DA_LISTA.includes("recolha_moveis") ? "recolha_moveis" : IDS_DA_LISTA[0];

type Pedido = Anthropic.Beta.MessageCreateParamsNonStreaming;

function respostaDoModelo(content: unknown[], stop_reason: string) {
  return {
    id: "msg_x",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5-5",
    content,
    stop_reason,
    usage: { input_tokens: 1000, output_tokens: 80, cache_read_input_tokens: 2000, cache_creation_input_tokens: 0 },
  } as unknown as Anthropic.Beta.BetaMessage;
}

function clienteFingido(respostas: Anthropic.Beta.BetaMessage[]) {
  const pedidos: Pedido[] = [];
  const cliente: ClienteDoClaude = {
    beta: {
      messages: {
        create: vi.fn(async (p: Pedido) => {
          pedidos.push(JSON.parse(JSON.stringify(p)) as Pedido);
          const r = respostas.shift();
          if (!r) throw new Error("sem mais respostas");
          return r;
        }),
      },
    },
  };
  return { cliente, pedidos };
}

function ferramentas(): DependenciasDasFerramentas {
  return {
    telefone: "351210000000",
    agora: AGORA,
    pedidosDoTelefone: async () => [],
    lerPedido: async () => null,
    lerConversa: async () => [],
    propostasDoPedido: async () => "",
    oQueOSiteSabe: () => "Os serviços do site e como funciona.",
  };
}

/** A base simulada: o que a orquestra leu e escreveu. */
function baseFingida(over: Partial<DependenciasDaRecolhaEmEnsaio> = {}, fio = [{ direccao: "in", texto: PRIMEIRA }]) {
  const escrito = {
    sombras: [] as SombraDaRecolha[],
    ensaios: [] as Array<{ id: number; novo: unknown; fechado?: EnsaioDaRecolhaFechado }>,
    comparacoes: [] as ComparacaoDaRecolha[],
    lidoORascunhoReal: 0,
  };
  const deps: DependenciasDaRecolhaEmEnsaio = {
    agora: AGORA,
    interruptor: async () => true,
    cliente: null,
    pedidosDoTelefone: async () => [],
    interrompida: async () => false,
    rascunhoReal: async () => {
      escrito.lidoORascunhoReal += 1;
      return { passo: "nome", dados: { serviceType: RECOLHA }, pedidoId: null };
    },
    fio: async () => fio,
    quem: async () => [],
    lerSombra: async () => null,
    gravarSombra: async (s) => void escrito.sombras.push(JSON.parse(JSON.stringify(s)) as SombraDaRecolha),
    gastos: async () => ({ gastoUsd: 0, tectoUsd: 10, gastoDaRecolhaUsd: 0, tectoDaRecolhaUsd: 3 }),
    ferramentas: async () => ferramentas(),
    novoEnsaio: async (e) => {
      const id = escrito.ensaios.length + 1;
      escrito.ensaios.push({ id, novo: e });
      return id;
    },
    fecharEnsaio: async (id, e) => {
      const l = escrito.ensaios.find((x) => x.id === id);
      if (l) l.fechado = e;
    },
    guardarComparacao: async (c) => void escrito.comparacoes.push(c),
    registarAccao: async () => {},
    ...over,
  };
  return { deps, escrito };
}

/* ── 1. Os dados pessoais lêem-se pelo código e vão ao modelo com marcas ── */

describe("o nome, a morada e o NIF: lidos pelo código, trocados por marcas", () => {
  it("lê-os da primeira mensagem com os leitores da recolha", () => {
    const l = lerDadosPessoais(PRIMEIRA, {});
    expect(l.campos.nome).toBe(NOME);
    expect(l.campos.morada).toContain(RUA);
    expect(l.campos.nif).toBe(NIF);
    expect(l.lidos).toEqual(expect.arrayContaining(["nome", "morada", "nif"]));
    const d = fundirCampos({}, l.campos, AGORA);
    expect(d.contactName).toBe(NOME);
    expect(d.postalCode).toBe("2800-123");
    expect(d.nifFactura).toBe(NIF);
  });

  it("a resposta curta à pergunta que falta («como se chama?») também é do código", () => {
    const l = lerDadosPessoais("Graciete Moreirinha", { serviceType: RECOLHA });
    expect(l.campos.nome).toBe(NOME);
  });

  it("um número de nove algarismos solto não é um NIF (só à pergunta, ou com «NIF» e o controlo certo)", () => {
    expect(lerDadosPessoais("o código é 123456780", { serviceType: RECOLHA }).campos.nif).toBeUndefined();
  });

  it("o texto que vai ao modelo não tem o nome, a rua nem o NIF — tem as marcas", () => {
    const k = lerDadosPessoais(PRIMEIRA, {}).conhecidos;
    const t = marcarDadosPessoais(PRIMEIRA, k);
    expect(t).not.toMatch(/Graciete|Moreirinha|Camélias|Camelias|123456789|2800-123/i);
    expect(t).toContain(MARCA_DO_NOME);
    expect(t).toContain("[morada recebida: Almada]");
    expect(t).toContain(MARCA_DO_NIF);
    expect(fugasNoTexto(t, k)).toBe(0);
    // E o que fica dá para trabalhar: o que é para levar.
    expect(t).toContain("um sofá e duas cadeiras");
  });

  it("o resumo da Vitória de sempre (com o nome e a morada) também vai tapado", () => {
    const dados = fundirCampos({}, lerDadosPessoais(PRIMEIRA, {}).campos, AGORA);
    const k = conhecidosDoRascunho(dados);
    const t = marcarDadosPessoais(resumo({ ...dados, serviceType: RECOLHA }), k);
    expect(fugasNoTexto(t, k)).toBe(0);
    expect(t).not.toMatch(/Graciete|Moreirinha|Camélias/i);
  });

  it("uma fuga conta-se (e então o modelo não se chama)", () => {
    const k = juntarConhecidos(conhecidosDoRascunho({ contactName: NOME, address: `${RUA} 14` }));
    expect(fugasNoTexto("Obrigada, Graciete!", k)).toBeGreaterThan(0);
    expect(fugasNoTexto("Fica na rua das camelias brancas, junto ao café", k)).toBeGreaterThan(0);
  });
});

/* ── 2. Os validadores de sempre ────────────────────────────────────────── */

describe("o modelo grava pelos validadores da recolha; o que falha volta com a razão", () => {
  it("um valor bom entra; um mau não entra e diz porquê", () => {
    const bom = gravarNoRascunho({}, "andar", "3", AGORA);
    expect(bom.ok).toBe(true);
    expect(bom.ok && bom.dados.floor).toBe("3");
    const mau = gravarNoRascunho({}, "servico", "jardinagem de luxo", AGORA);
    expect(mau.ok).toBe(false);
    expect(!mau.ok && mau.porque).toMatch(/validador da recolha não aceitou/);
    const elevador = gravarNoRascunho({}, "elevador", "talvez amanhã", AGORA);
    expect(elevador.ok).toBe(false);
  });

  it("o nome, a morada e o NIF não se gravam por aqui, nem um valor com uma marca", () => {
    for (const passo of ["nome", "morada", "nif"]) {
      const r = gravarNoRascunho({}, passo, "qualquer coisa", AGORA);
      expect(r.ok, passo).toBe(false);
    }
    const marcado = gravarNoRascunho({}, "codigoPostal", "[código postal recebido] Almada", AGORA);
    expect(marcado.ok).toBe(false);
  });

  it("pela ferramenta: a recusa vai ao modelo como erro, e o rascunho fica como estava", async () => {
    const ctx: ContextoDaRecolha = {
      dados: { serviceType: RECOLHA },
      agora: AGORA,
      ferramentas: ferramentas(),
      conhecidos: juntarConhecidos(),
      quem: [],
      gravados: [],
      resumoProposto: false,
    };
    const r = await correrFerramentaDaRecolha("gravar_no_rascunho", { passo: "elevador", valor: "talvez amanhã" }, ctx, estadoNovo());
    expect(r.erro).toBe(true);
    expect(JSON.stringify(r.resultado)).toMatch(/sim|não/);
    expect(ctx.dados).toEqual({ serviceType: RECOLHA });
    expect(ctx.gravados).toEqual([]);
  });

  it("o rascunho que o modelo lê vem com marcas, os passos que faltam e a lista do site", () => {
    const dados = fundirCampos({ serviceType: RECOLHA }, lerDadosPessoais(PRIMEIRA, {}).campos, AGORA);
    const v = vistaDoRascunho(dados);
    expect(JSON.stringify(v)).not.toMatch(/Graciete|Moreirinha|Camélias|123456789/);
    expect(v.jaSeSabe.nome).toBe(MARCA_DO_NOME);
    expect(v.passosEmFalta).toEqual(passosEmFalta(dados));
    expect(v.servicosDoSite.map((s) => s.id)).toEqual([...IDS_DA_LISTA]);
  });
});

/* ── 3. O resumo e o SIM continuam pelo código ──────────────────────────── */

describe("o resumo é o do código, e o SIM lê-o o código", () => {
  const completo = (): DadosDaRecolha => {
    let d: DadosDaRecolha = fundirCampos({ serviceType: RECOLHA }, lerDadosPessoais(PRIMEIRA, {}).campos, AGORA);
    for (const [passo, valor] of [
      ["andar", "2"],
      ["elevador", "sim"],
      ["estacionamento", "sim"],
      ["quando", "sexta de manhã"],
      ["descricao", "Um sofá de três lugares e duas cadeiras"],
    ] as const) {
      const g = gravarNoRascunho(d, passo, valor, AGORA);
      if (g.ok) d = g.dados;
    }
    return d;
  };

  it("propor_registo só com o rascunho completo; a resposta tem de levar a marca, e o resumo é o de sempre", async () => {
    const ctx: ContextoDaRecolha = {
      dados: { serviceType: RECOLHA },
      agora: AGORA,
      ferramentas: ferramentas(),
      conhecidos: juntarConhecidos(),
      quem: [],
      gravados: [],
      resumoProposto: false,
    };
    const estado = estadoNovo();
    expect((await correrFerramentaDaRecolha("propor_registo", {}, ctx, estado)).erro).toBe(true);
    ctx.dados = completo();
    expect(passosEmFalta(ctx.dados)).toEqual([]);
    const r = await correrFerramentaDaRecolha("propor_registo", {}, ctx, estado);
    expect(r.erro).toBeUndefined();
    expect(ctx.resumoProposto).toBe(true);
    expect(estado.fraseObrigatoria).toBe(MARCA_DO_RESUMO);
    // Sem a marca, a revisão recusa; com ela, aceita.
    expect((await correrFerramentaDaRecolha("propor_resposta", { texto: "Já tenho tudo, obrigada!" }, ctx, estado)).erro).toBe(true);
    expect((await correrFerramentaDaRecolha("propor_resposta", { texto: MARCA_DO_RESUMO }, ctx, estado)).erro).toBeUndefined();
    const final = comOResumo(MARCA_DO_RESUMO, ctx.dados);
    expect(final).toBe(resumo(ctx.dados));
    expect(final).toMatch(/responda SIM/);
  });

  it("uma resposta com a marca de um dado tapado não sai para o cliente", async () => {
    const ctx: ContextoDaRecolha = {
      dados: {},
      agora: AGORA,
      ferramentas: ferramentas(),
      conhecidos: juntarConhecidos(),
      quem: [],
      gravados: [],
      resumoProposto: false,
    };
    const r = await correrFerramentaDaRecolha("propor_resposta", { texto: `Obrigada, ${MARCA_DO_NOME}! Que serviço precisa?` }, ctx, estadoNovo());
    expect(r.erro).toBe(true);
  });

  it("o SIM: curto, sem «não», dentro dos 30 minutos", () => {
    const proposto = new Date(AGORA.getTime() - 5 * 60_000).toISOString();
    expect(respostaAoResumo(proposto, "Sim", AGORA)).toEqual({ tipo: "confirmou" });
    expect(respostaAoResumo(proposto, "sim, mas a morada está mal", AGORA)).toEqual({ tipo: "outra" });
    expect(respostaAoResumo(new Date(AGORA.getTime() - 45 * 60_000).toISOString(), "sim", AGORA)).toEqual({ tipo: "expirou" });
  });

  it("o modelo não tem ferramenta para criar o pedido, e a recolha não chama o registo", () => {
    expect(FERRAMENTAS_DA_RECOLHA.map((f) => f.name)).toEqual([
      "ler_rascunho",
      "gravar_no_rascunho",
      "propor_registo",
      "o_que_o_site_sabe",
      "perguntas_frequentes",
      "passar_a_equipa",
      "propor_resposta",
    ]);
    expect(FERRAMENTAS_DA_RECOLHA.every((f) => (f as { strict?: boolean }).strict === true)).toBe(true);
    for (const f of ["recolha-pelo-agente.ts", "recolha-em-ensaio.ts", "recolha-em-ensaio-na-base.ts"]) {
      const s = semComentarios(ler(`src/lib/vitoria-agente/${f}`));
      expect(s, f).not.toMatch(/registarARecolha|registarPedidoDaRecolha|guardarRecolhaWhatsApp|apagarRecolhaWhatsApp|recomecarRecolhaWhatsApp/);
      expect(s, f).not.toMatch(/enviarTextoWhatsApp|enviarAvisoWhatsApp|enviarEmail/);
      expect(s, f).not.toMatch(/INSERT INTO whatsappRecolhas|UPDATE whatsappRecolhas|simulatorOrders/);
      // A fase 2 é que mexe no passoDaPergunta.
      expect(s, f).not.toMatch(/passoDaPergunta/);
    }
    // O rascunho real só se lê.
    expect(ler("src/lib/vitoria-agente/recolha-em-ensaio-na-base.ts")).toContain("db.recolhaWhatsApp(telefone)");
  });
});

/* ── 4. O ensaio, ponta a ponta, com a base simulada ────────────────────── */

describe("a recolha em ensaio (orquestra)", () => {
  it("desligada: nada muda — não lê nada nem chama o modelo", async () => {
    const { cliente, pedidos } = clienteFingido([]);
    const lerSombra = vi.fn(async () => null);
    const { deps, escrito } = baseFingida({ interruptor: async () => false, cliente, lerSombra });
    const r = await recolhaEmEnsaio(deps);
    expect(r).toEqual({ feito: false, porque: "recolha em ensaio desligada" });
    expect(pedidos.length).toBe(0);
    expect(lerSombra).not.toHaveBeenCalled();
    expect(escrito.sombras.length + escrito.ensaios.length + escrito.comparacoes.length).toBe(0);
  });

  it("um número com pedido fica de fora", async () => {
    const { cliente, pedidos } = clienteFingido([]);
    const { deps, escrito } = baseFingida({ cliente, pedidosDoTelefone: async () => [812] });
    expect((await recolhaEmEnsaio(deps)).feito).toBe(false);
    expect(pedidos.length).toBe(0);
    expect(escrito.ensaios.length).toBe(0);
  });

  it("sem pedido e ligada: corre, grava na sombra, não envia nem toca no rascunho real — e o modelo não vê o nome nem a rua", async () => {
    const { cliente, pedidos } = clienteFingido([
      respostaDoModelo(
        [
          { type: "tool_use", id: "t1", name: "ler_rascunho", input: {} },
          { type: "tool_use", id: "t2", name: "gravar_no_rascunho", input: { passo: "servico", valor: RECOLHA } },
          { type: "tool_use", id: "t3", name: "gravar_no_rascunho", input: { passo: "descricao", valor: "Um sofá e duas cadeiras" } },
        ],
        "tool_use",
      ),
      respostaDoModelo(
        [{ type: "tool_use", id: "t4", name: "propor_resposta", input: { texto: "Obrigada! Em que andar fica, e há elevador?" } }],
        "tool_use",
      ),
    ]);
    const { deps, escrito } = baseFingida({ cliente });
    const r = await recolhaEmEnsaio(deps);
    expect(r.feito).toBe(true);
    expect(r.porque).toBe("ok");
    // O que foi ao modelo: nem o nome, nem a rua, nem o NIF, nem o código postal.
    const foi = JSON.stringify(pedidos);
    expect(foi).not.toMatch(/Graciete|Moreirinha|Camélias|Camelias|123456789|2800-123/i);
    expect(foi).toContain("[nome recebido]");
    expect((pedidos[0].system as Array<{ text: string }>)[0].text).toBe(AVISO_DA_RECOLHA);
    // A sombra tem o que o código leu e o que o modelo gravou.
    const sombra = escrito.sombras.at(-1)!;
    expect(sombra.dados.contactName).toBe(NOME);
    expect(sombra.dados.serviceType).toBe(RECOLHA);
    expect(sombra.dados.nifFactura).toBe(NIF);
    // A linha do ensaio: sem dados de pessoas.
    const linha = escrito.ensaios[0];
    expect(JSON.stringify(linha)).not.toMatch(/Graciete|Moreirinha|Camélias|123456789/);
    expect(linha.fechado?.estado).toBe("recolha_ok");
    expect(linha.fechado?.teriaFeito.join(" ")).toMatch(/teria gravado no rascunho: servico, descricao/);
    // A comparação, sem fugas no que foi ao modelo.
    expect(escrito.comparacoes[0].fugasNoModelo).toBe(0);
    expect(escrito.comparacoes[0].chamouOModelo).toBe(true);
    expect(JSON.stringify(escrito.comparacoes)).not.toMatch(/Graciete|Moreirinha|Camélias|123456789/);
    // O rascunho real só foi lido; a orquestra nem tem como enviar ou gravar nele.
    expect(escrito.lidoORascunhoReal).toBeGreaterThan(0);
    expect(Object.keys(deps).some((k) => /enviar|guardarRecolha|registar(?!Accao)/i.test(k))).toBe(false);
  });

  it("o tecto de 3 USD da recolha pára o ensaio (e o geral também)", async () => {
    const { cliente, pedidos } = clienteFingido([]);
    const a = baseFingida({ cliente, gastos: async () => ({ gastoUsd: 3.2, tectoUsd: 10, gastoDaRecolhaUsd: 3.01, tectoDaRecolhaUsd: 3 }) });
    const r = await recolhaEmEnsaio(a.deps);
    expect(r.feito).toBe(false);
    expect(r.porque).toMatch(/tecto da recolha/);
    const b = baseFingida({ cliente, gastos: async () => ({ gastoUsd: 10, tectoUsd: 10, gastoDaRecolhaUsd: 0.5, tectoDaRecolhaUsd: 3 }) });
    expect((await recolhaEmEnsaio(b.deps)).porque).toMatch(/tecto/);
    expect(pedidos.length).toBe(0);
    expect(a.escrito.ensaios.length + b.escrito.ensaios.length).toBe(0);
    expect(TECTO_DA_RECOLHA_POR_OMISSAO_USD).toBe(3);
    expect(tectoQueValeNaRecolha(3, 10)).toBe(3);
    expect(tectoQueValeNaRecolha(3, 2)).toBe(2);
  });

  it("o SIM ao resumo do agente: o código diz que teria registado, sem chamar o modelo e sem criar nada", async () => {
    const { cliente, pedidos } = clienteFingido([]);
    const sombra: SombraDaRecolha = {
      dados: { serviceType: RECOLHA },
      resumoPropostoEm: new Date(AGORA.getTime() - 3 * 60_000).toISOString(),
      registadoEm: null,
    };
    const { deps, escrito } = baseFingida({ cliente, lerSombra: async () => sombra }, [
      { direccao: "out", texto: "Confirme, por favor: …" },
      { direccao: "in", texto: "Sim" },
    ]);
    const r = await recolhaEmEnsaio(deps);
    expect(r.porque).toBe("codigo");
    expect(pedidos.length).toBe(0);
    expect(escrito.ensaios[0].fechado?.estado).toBe("recolha_codigo");
    expect(escrito.ensaios[0].fechado?.teriaFeito.join(" ")).toMatch(/teria registado o pedido pelo SIM/);
    expect(escrito.sombras.at(-1)?.registadoEm).toBe(AGORA.toISOString());
  });

  it("só fotografias (sem texto) ficam com o Gemini", async () => {
    const { cliente, pedidos } = clienteFingido([]);
    const { deps } = baseFingida({ cliente }, [{ direccao: "in", texto: "[fotografia] um sofá castanho" }]);
    expect((await recolhaEmEnsaio(deps)).feito).toBe(false);
    expect(pedidos.length).toBe(0);
  });
});

/* ── 5. A comparação e os números dos critérios ─────────────────────────── */

describe("a comparação com a Vitória de sempre e os critérios da d99", () => {
  it("campo a campo, com os dados de pessoas tapados", () => {
    const d: DadosDaRecolha = { serviceType: RECOLHA, contactName: NOME, address: `${RUA} 14`, postalCode: "2800-123", city: "Almada", floor: "2", hasElevator: "yes" };
    const igual = compararOsResumos(d, d);
    expect(igual.comparados).toBeGreaterThan(3);
    expect(igual.iguais).toBe(igual.comparados);
    const outro = compararOsResumos(d, { ...d, floor: "3" });
    expect(outro.iguais).toBe(outro.comparados - 1);
    expect(JSON.stringify(igual)).not.toMatch(/Graciete|Moreirinha|Camélias|2800-123/);
    expect(igual.campos.find((c) => c.campo === "Nome")?.agente).toBe("[dado tapado]");
  });

  it("os cinco números, e se cumprem", () => {
    const l = (o: Partial<LinhaDaRecolhaEmEnsaio>): LinhaDaRecolhaEmEnsaio => ({
      telefone: "1",
      criadoEm: AGORA,
      camposIguais: 0,
      camposComparados: 0,
      ambosNoResumo: false,
      fugasEvitadas: 0,
      fugasNoModelo: 0,
      chamouOModelo: true,
      duracaoMs: 9000,
      custoUsd: 0.05,
      avaliacao: null,
      ...o,
    });
    const m = metricasDaRecolha([
      l({ telefone: "1", camposIguais: 9, camposComparados: 10, ambosNoResumo: true, avaliacao: "melhor" }),
      l({ telefone: "1", avaliacao: "igual" }),
      l({ telefone: "2", camposIguais: 10, camposComparados: 10, ambosNoResumo: true, avaliacao: "pior", duracaoMs: 25_000 }),
      l({ telefone: "2", chamouOModelo: false, custoUsd: 0, fugasEvitadas: 1 }),
    ]);
    expect(m.camposIguais.valor).toBe(0.95);
    expect(m.camposIguais.cumpre).toBe(true);
    expect(m.fugasNoModelo.valor).toBe(0);
    expect(m.fugasEvitadas).toBe(1);
    expect(m.avaliadasMelhorOuIgual.valor).toBeCloseTo(0.667, 3);
    expect(m.avaliadasMelhorOuIgual.cumpre).toBe(false);
    expect(m.custoPorPedidoUsd.valor).toBe(0.075);
    expect(m.custoPorPedidoUsd.cumpre).toBe(true);
    expect(m.passaramOPrazo.valor).toBeCloseTo(0.333, 3);
    expect(m.passaramOPrazo.cumpre).toBe(false);
    expect(m.prontaParaAFase2).toBe(false);
    expect(CRITERIOS_DA_RECOLHA).toEqual({ camposIguais: 0.9, fugasNoModelo: 0, avaliadasMelhorOuIgual: 0.7, custoPorPedidoUsd: 0.35, passaramOPrazo: 0.05 });
    expect(metricasDaRecolha([]).prontaParaAFase2).toBeNull();
  });
});

/* ── 6. O interruptor, a ponte, o painel, a purga e a Política ──────────── */

describe("o interruptor, a ponte, o painel, a purga e a Política de Privacidade", () => {
  it("o interruptor novo: desligado na dúvida, só o administrador, com LIGAR, e no painel", () => {
    const naBase = ler("src/lib/vitoria-agente/na-base.ts");
    expect(naBase).toContain('export const CHAVE_DA_RECOLHA_EM_ENSAIO = "vitoria_agente_recolha";');
    expect(naBase).toContain('recolha: { chave: CHAVE_DA_RECOLHA_EM_ENSAIO, nome: NOME_DO_INTERRUPTOR_DA_RECOLHA, decisao: "d99" }');
    expect(naBase).toContain("if (!l) return desligado;");
    expect(ler("src/lib/vitoria-agente/recolha-em-ensaio-na-base.ts")).toContain('if (!(await lerInterruptor("recolha")).ligado) return { feito: false, porque: "recolha em ensaio desligada" };');
    const rota = ler("src/app/api/admin/vitoria-agente/route.ts");
    expect(rota).toContain("requireAdminGeral");
    expect(rota).toContain('!== "LIGAR"');
    expect(rota).toContain("mudarTectoDaRecolha(corpo.tectoRecolha, porQuem)");
    expect(ler("src/components/admin/InterruptorDaVitoriaAgente.tsx")).toContain('qual: "recolha"');
    const painel = ler("src/components/admin/EnsaioDaVitoria.tsx");
    expect(painel).toContain("Recolha em ensaio");
    expect(painel).toContain('"igual"');
    expect(ler("src/app/api/admin/whatsapp/ensaio-da-vitoria/route.ts")).toContain("resumoDaRecolhaEmEnsaio(30)");
  });

  it("na ponte: depois da resposta real, antes do ensaio geral, dentro do after()", () => {
    const ponte = ler("src/app/api/whatsapp/ponte/route.ts");
    const regras = ponte.indexOf('tratarMensagemDoCliente(telefone, { tipo: "texto", texto: junto');
    const recolha = ponte.indexOf("await recolhaEmEnsaioNaBase(telefone)");
    const geral = ponte.indexOf("await ensaioEmSombra(telefone)");
    expect(regras).toBeGreaterThan(0);
    expect(recolha).toBeGreaterThan(regras);
    expect(geral).toBeGreaterThan(recolha);
    expect(ponte.slice(regras, recolha)).toContain("after(async () => {");
  });

  it("a sombra sai aos 7 dias na purga da noite, com o PURGA_ARMADA", () => {
    const rota = semComentarios(ler("src/app/api/cron/purgar-pedidos/route.ts"));
    expect(rota).toContain("purgarARecolhaEmEnsaio(DIAS_DE_RETENCAO_DOS_PEDIDOS, { aSerio: armada })");
    const s = ler("src/lib/vitoria-agente/recolha-em-ensaio-na-base.ts");
    expect(s).toContain("vitoriaRascunhoSombra WHERE actualizadoEm < NOW() - INTERVAL ${Math.round(HORAS_DO_RASCUNHO / 24)} DAY");
  });

  it("a Política (secção 3) diz que a Vitória recolhe os dados desde a primeira mensagem", () => {
    const p = ler("src/app/privacidade/page.tsx").replace(/\s+/g, " ");
    expect(p).toContain(
      "recolher, desde a primeira mensagem, os dados necessários para criar o seu pedido e anotar nele o que nos diz",
    );
    expect(p).not.toContain("anotar no pedido o que nos diz");
  });
});
