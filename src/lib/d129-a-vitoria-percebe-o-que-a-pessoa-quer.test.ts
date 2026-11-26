import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import {
  AQUI_SO_A_CLYON,
  avisoDaIntencao,
  decidirPelaIntencao,
  lerAIntencao,
  lerALeitura,
  MARCA_DA_LIGACAO,
  motivoParaBloquearAResposta,
  precisaDeLerAIntencao,
  type LeituraDaIntencao,
} from "./vitoria-agente/intencao";
import { decidirAIntencaoComPortas, type PortasDaIntencao } from "./vitoria-agente/intencao-na-base";
import type { ClienteDoClaude } from "./vitoria-agente/cliente";
import { conhecimentoDoSite, promptDaVitoria } from "./vitoria-agente/prompt-da-vitoria";
import { querSerParceiro, respostaAoCandidato } from "./candidato-a-parceiro";
import { eDeProfissional, eCandidatoPeloMotivo, contarNaMesa, naMesa, type FactosDaConversa } from "./mesa-das-conversas";
import { eOTresDoMenu } from "./a-escolha-e-a-desistencia";
import { textoDoRecebido } from "./recebemos-o-pedido";
import { mensagemAutomaticaDoQueFalta } from "./mensagem-do-que-falta";
import { A_FATURA_SAI_SEMPRE, estimativaPelaTabela, perguntaPelaFaturaNoPreco, responderAoOrcamentoAMeio } from "./orcamento-a-meio";
import { comOAvisoParaOParceiro, eAvisoParaOParceiro } from "./turno-da-recolha";
import { fotografiasNaConversa, MARCA_DE_FOTOGRAFIA } from "./rajada-do-whatsapp";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";
import { ATUALIZADO_CONFIRMA, type EstadoDaRecolha } from "./whatsapp-recolha";

/*
 * d129 (pedida e aprovada pelo dono, 26-11-2026) — A VITÓRIA PERCEBE O QUE A
 * PESSOA QUER, antes de cada passo do fluxo fixo.
 *
 * O caso: um número desconhecido. A Vitória abriu com a saudação da recolha e
 * a pessoa escreveu «Quero fazer meu cadastro para ser parceiro de vocês»; o
 * fluxo pediu-lhe a morada, o código postal e o andar. E o #688 (2 estantes):
 * o preço repetido sem ajudar, as fotografias pedidas a quem já as mandou, o
 * SIM pedido duas vezes, a nota para o parceiro perdida. O modelo é fingido
 * (nunca se chama a API num teste) e nada sai a ninguém. Nomes, números e
 * moradas INVENTADOS (o repositório é público); as localidades ficam.
 */

const AGORA = new Date("2026-11-26T15:00:00Z");
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

/** O cliente do Claude fingido: devolve a leitura dada e guarda o pedido. */
function claudeFingido(leitura: Partial<LeituraDaIntencao> | null, pedidos: Anthropic.Beta.MessageCreateParamsNonStreaming[] = []): ClienteDoClaude {
  return {
    beta: {
      messages: {
        create: async (p) => {
          pedidos.push(p);
          const corpo = leitura
            ? JSON.stringify({ respondeAPergunta: false, resposta: "", retomarAPergunta: false, porque: "", ...leitura })
            : "isto não é JSON";
          return {
            id: "msg_fingida",
            type: "message",
            role: "assistant",
            model: "claude-sonnet-5-5",
            content: [{ type: "text", text: corpo, citations: null }],
            stop_reason: "end_turn",
            stop_sequence: null,
            usage: { input_tokens: 900, output_tokens: 120, cache_read_input_tokens: 8000, cache_creation_input_tokens: 0 },
          } as unknown as Anthropic.Beta.BetaMessage;
        },
      },
    },
  };
}

/* A conversa do caso, como chegou (a 1.ª mensagem veio do site, com o serviço). */
const SAUDACAO = "Boa tarde! Fica anotado: recolha de móveis. Com quem tenho o gosto de falar?";
const M1 = "Quero fazer meu cadastro para ser parceiro de vocês";
const M2 = "Que trabalhar com vocês";
const M4 = "Olá, sou o Gervásio, estou no Seixal com camião e quero ser parceiro para recolha de móveis/monos e fretes.";

function portas(cliente: ClienteDoClaude | null, extra: Partial<PortasDaIntencao> = {}): PortasDaIntencao & { registos: unknown[] } {
  const registos: unknown[] = [];
  return {
    cliente,
    ligada: true,
    recolha: async () => ({ passo: "nome", dados: { serviceType: "recolha_moveis" }, pedidoId: null }),
    fio: async () => [
      { direccao: "out", texto: SAUDACAO },
      { direccao: "in", texto: M1 },
    ],
    perguntaPendente: () => "Com quem tenho o gosto de falar?",
    gastoETecto: async () => ({ gastoUsd: 0.4, tectoUsd: 10 }),
    registar: async (l) => {
      registos.push(l);
    },
    registos,
    ...extra,
  };
}

describe("o caso: um candidato a parceiro no meio da recolha", () => {
  it("as frases dele vão ao modelo (nenhuma é um dado curto); o código postal sozinho, não", () => {
    for (const t of [M1, M2, M4]) expect(precisaDeLerAIntencao(t), t).toBe(true);
    for (const t of ["2840-123", "sim", "3", "3º andar", "rés-do-chão", "12/12"]) expect(precisaDeLerAIntencao(t), t).toBe(false);
  });

  it("o modelo diz «candidato»: a candidatura, com a ligação do site — e nunca a morada", async () => {
    const pedidos: Anthropic.Beta.MessageCreateParamsNonStreaming[] = [];
    const p = portas(
      claudeFingido(
        {
          intencao: "candidato_a_parceiro",
          resposta: `Que bom querer trabalhar connosco! A inscrição é grátis e faz-se aqui: ${MARCA_DA_LIGACAO}\nJunte 1 a 4 fotografias da carrinha, que são obrigatórias. A equipa vê a candidatura, confirma a identidade e fala consigo.`,
        },
        pedidos,
      ),
    );
    const d = await decidirAIntencaoComPortas(M1, AGORA, p);
    expect(d.tipo).toBe("candidato");
    if (d.tipo !== "candidato") return;
    expect(d.doModelo).toBe(true);
    expect(d.texto).toContain("https://clyon.pt/quero-ser-parceiro");
    expect(d.texto).not.toContain(MARCA_DA_LIGACAO);
    expect(d.texto).not.toMatch(/morada|código postal|andar/i);
    // A pergunta que o código fez vai ao modelo, e a conversa também.
    const msg = JSON.stringify(pedidos[0].messages);
    expect(msg).toContain("Com quem tenho o gosto de falar?");
    expect(msg).toContain("ser parceiro");
    expect(p.registos).toHaveLength(1);
  });

  it("com a terra dita (Seixal), a ligação leva a zona", async () => {
    const p = portas(claudeFingido({ intencao: "candidato_a_parceiro", resposta: `Obrigada pelo interesse! Inscreva-se aqui: ${MARCA_DA_LIGACAO}` }), {
      fio: async () => [
        { direccao: "out", texto: SAUDACAO },
        { direccao: "in", texto: M4 },
      ],
    });
    const d = await decidirAIntencaoComPortas(M4, AGORA, p);
    expect(d.tipo === "candidato" && d.texto).toContain("quero-ser-parceiro?zona=seixal");
  });

  it("sem o modelo, a regra do candidato apanha as frases do caso (o «recolha de» já não a cala)", () => {
    expect(querSerParceiro(M1)).toBe(true);
    expect(querSerParceiro(M4)).toBe(true);
    // O cliente que precisa de um ajudante continua a ser cliente.
    expect(querSerParceiro("Preciso de um ajudante para a recolha de um sofá")).toBe(false);
  });

  it("a guarda do recrutamento: com entulho ou a prometer trabalho, sai o texto fixo da candidatura", () => {
    const comEntulho: LeituraDaIntencao = {
      intencao: "candidato_a_parceiro",
      respondeAPergunta: false,
      resposta: `Ótimo! Fazemos recolhas de entulho e móveis. Inscreva-se: ${MARCA_DA_LIGACAO}`,
      retomarAPergunta: false,
      porque: "",
    };
    const d1 = decidirPelaIntencao(comEntulho, { perguntaPendente: null, zona: null });
    expect(d1).toEqual({ tipo: "candidato", texto: respostaAoCandidato(null), doModelo: false });
    const comPromessa = { ...comEntulho, resposta: `Vai ter muito trabalho! Inscreva-se: ${MARCA_DA_LIGACAO}` };
    expect(decidirPelaIntencao(comPromessa, { perguntaPendente: null, zona: null })).toMatchObject({ doModelo: false });
    expect(motivoParaBloquearAResposta("Há muita procura, garantimos pedidos.", true)).not.toBeNull();
  });

  it("o cliente fica com o fluxo de sempre; a queixa vai a uma pessoa", () => {
    const base = { respondeAPergunta: true, resposta: "", retomarAPergunta: false, porque: "" };
    expect(decidirPelaIntencao({ ...base, intencao: "cliente_com_pedido" }, { perguntaPendente: null, zona: null }).tipo).toBe("regras");
    expect(decidirPelaIntencao({ ...base, intencao: "queixa" }, { perguntaPendente: null, zona: null }).tipo).toBe("queixa");
  });

  it("a dúvida responde-se e a pergunta do fluxo volta; um preço inventado não sai (as regras)", () => {
    const l: LeituraDaIntencao = {
      intencao: "pergunta_geral",
      respondeAPergunta: false,
      resposta: "Sim, os parceiros também trabalham ao sábado.",
      retomarAPergunta: true,
      porque: "",
    };
    expect(decidirPelaIntencao(l, { perguntaPendente: "Qual é a morada, por favor?", zona: null })).toEqual({
      tipo: "responder",
      texto: "Sim, os parceiros também trabalham ao sábado.\n\nQual é a morada, por favor?",
    });
    expect(decidirPelaIntencao({ ...l, resposta: "Fica em 999 € no total." }, { perguntaPendente: null, zona: null }).tipo).toBe("regras");
  });

  it("fora do tema: a recusa delicada e volta ao pedido", () => {
    const l: LeituraDaIntencao = { intencao: "fora_do_tema", respondeAPergunta: false, resposta: "", retomarAPergunta: true, porque: "" };
    expect(decidirPelaIntencao(l, { perguntaPendente: "Qual é a morada, por favor?", zona: null })).toEqual({
      tipo: "responder",
      texto: `${AQUI_SO_A_CLYON}\n\nQual é a morada, por favor?`,
    });
  });

  it("sem chave, passado o tecto, com o modelo a falhar ou um JSON partido — as regras, como antes", async () => {
    expect((await decidirAIntencaoComPortas(M1, AGORA, portas(null))).tipo).toBe("regras");
    expect((await decidirAIntencaoComPortas(M1, AGORA, portas(claudeFingido({ intencao: "candidato_a_parceiro" }), { gastoETecto: async () => ({ gastoUsd: 11, tectoUsd: 10 }) }))).tipo).toBe("regras");
    expect((await decidirAIntencaoComPortas(M1, AGORA, portas(claudeFingido(null)))).tipo).toBe("regras");
    expect((await decidirAIntencaoComPortas(M1, AGORA, portas(claudeFingido({ intencao: "candidato_a_parceiro" }), { ligada: false }))).tipo).toBe("regras");
    expect(lerALeitura('{"intencao":"nada"}')).toBeNull();
  });

  it("a chamada: Claude Sonnet 5.5, esforço baixo, JSON pelo esquema, o prompt na cache e sem a hora", async () => {
    const pedidos: Anthropic.Beta.MessageCreateParamsNonStreaming[] = [];
    const r = await lerAIntencao({ agora: AGORA, conversa: [], ultima: M1, perguntaFeita: null }, claudeFingido({ intencao: "candidato_a_parceiro" }, pedidos));
    expect(r.leitura?.intencao).toBe("candidato_a_parceiro");
    const p = pedidos[0] as Anthropic.Beta.MessageCreateParamsNonStreaming & Record<string, unknown>;
    expect(p.model).toBe("claude-sonnet-5-5");
    expect(p.output_config).toMatchObject({ effort: "low", format: { type: "json_schema" } });
    expect(p.fallbacks).toBe("default");
    expect(p).not.toHaveProperty("temperature");
    const system = p.system as Array<{ text: string; cache_control?: unknown }>;
    expect(system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(system[0].text).toBe(avisoDaIntencao(AGORA));
    // A hora e a conversa vão na mensagem, nunca no prompt (a cache é um prefixo).
    expect(system[0].text).not.toContain("Hoje é");
    expect(JSON.stringify(p.messages)).toContain("Hoje é");
  });
});

describe("o prompt único da Vitória (d129, A e B)", () => {
  const p = promptDaVitoria(AGORA);
  it("diz quem é, os limites e o que o site sabe — lido das fontes", () => {
    expect(p).toContain("assistente automática da CLYON");
    expect(p).toContain("OS LIMITES");
    expect(p).toMatch(/Só tratas do que é da CLYON/);
    expect(p).toContain("200 km de Lisboa");
    expect(p).toContain("montagem");
    expect(p).toMatch(/limpezas/);
    expect(p).toContain("931 632 622");
    expect(p).toContain("de segunda a sábado");
    expect(conhecimentoDoSite(AGORA)).toContain("O QUE O SITE DA CLYON DIZ");
  });
  it("vai também à Vitória agente, num segundo bloco na cache", () => {
    const c = ler("src/lib/vitoria-agente/cliente.ts");
    expect(c).toContain("blocoDosLimitesEDoSite(pedido.agora), cache_control: { type: \"ephemeral\" }");
  });
});

describe("a Mesa: o candidato vai para os «Profissionais»", () => {
  const factos = (motivo: string | null): FactosDaConversa =>
    ({
      telefone: "351910000129",
      ultimaEntrada: { id: 2, texto: M1, quando: AGORA.toISOString(), haSegundos: 60, direccao: "in" },
      ultimaSaida: { id: 3, texto: "Obrigada! https://clyon.pt/quero-ser-parceiro", quando: AGORA.toISOString(), haSegundos: 30, direccao: "out" },
      noTelemovel: null,
      respondida: null,
      bloqueada: false,
      entregue: false,
      motivoDaEntrega: null,
      fecho: motivo ? { haSegundos: 20, quando: AGORA.toISOString(), motivo, porQuem: "vitoria" } : null,
      recolha: null,
      pedidoVivo: null,
      ultimoPedido: null,
      guardada: null,
      profissional: null,
      candidato: eCandidatoPeloMotivo(motivo),
    }) as unknown as FactosDaConversa;

  it("o porquê do fecho diz que é candidato, e a linha vai para os «Profissionais»", () => {
    expect(eCandidatoPeloMotivo("Candidato a parceiro — a Vitória mandou a ligação da candidatura")).toBe(true);
    expect(eCandidatoPeloMotivo("Candidato a parceiro voltou a escrever — responder")).toBe(true);
    expect(eCandidatoPeloMotivo("Cliente insatisfeito")).toBe(false);
    const l = naMesa(factos("Candidato a parceiro — a Vitória mandou a ligação da candidatura"));
    expect(l.candidato).toBe(true);
    expect(eDeProfissional(l)).toBe(true);
    expect(eDeProfissional(naMesa(factos(null)))).toBe(false);
    expect(contarNaMesa([l]).profissionais).toBe(0); // resolvida: está lá, mas não por responder
  });

  it("o caminho na conversa: a leitura antes do fluxo, a candidatura, o rascunho apagado e o fecho como candidato", () => {
    const neg = ler("src/lib/whatsapp-negociacao.ts");
    const i = neg.indexOf("if (await aIntencaoAntesDaRecolha(telefone, conteudo.texto)) return;");
    expect(i).toBeGreaterThan(0);
    expect(i).toBeLessThan(neg.indexOf("if (await aoCandidato(telefone, conteudo.texto)) return;"));
    const corpo = neg.slice(neg.indexOf("async function aIntencaoAntesDaRecolha"), neg.indexOf("O VALOR ÚNICO, DECIDIDO"));
    expect(corpo).toContain("apagarRecolhaWhatsApp(telefone)");
    expect(corpo).toContain("MOTIVO_DO_CANDIDATO");
    expect(corpo).not.toContain("registarARecolha");
  });
});

describe("o «3» ao seguimento cancela logo (d129, 4a)", () => {
  it("só o número do menu; o texto livre ambíguo continua a pedir o CANCELAR", () => {
    for (const t of ["3", "3.", "opção 3", " 3 "]) expect(eOTresDoMenu(t), t).toBe(true);
    for (const t of ["CANCELAR", "13", "3 sofás", "talvez cancelar"]) expect(eOTresDoMenu(t), t).toBe(false);
    const neg = ler("src/lib/whatsapp-negociacao.ts");
    expect(neg).toContain('await d111.desistirDoPedido(telefone, c.pedidoId, "«3» ao seguimento", { comOPorque: true });');
  });
});

describe("a primeira mensagem do pedido do simulador: uma só saudação (d129, 4b)", () => {
  it("o olá curto, o número uma vez, e o que falta", () => {
    const falta = mensagemAutomaticaDoQueFalta({ id: 901, serviceType: "recolha_moveis", city: "Almada" }, ["fotografias"]);
    const t = textoDoRecebido(901, falta);
    expect(t.match(/#901/g)).toHaveLength(1);
    expect(t.match(/Olá/g)).toHaveLength(1);
    expect(t.startsWith("Olá! Aqui é a Vitória")).toBe(true);
    expect(t).toContain("Recebemos o seu pedido #901");
    expect(t).not.toMatch(/^Recebemos[\s\S]*Olá!/);
    expect(t).toContain("fotografias");
  });
});

describe("o #688 — 2 estantes nos Olivais", () => {
  const estado: EstadoDaRecolha = {
    passo: "morada",
    dados: { serviceType: "recolha_moveis", description: "2 estantes", city: "Lisboa", postalCode: "1800-000" },
  };

  it("o preço: a estimativa pela tabela, com e sem IVA — e nunca «Como lhe disse» outra vez", () => {
    const e = estimativaPelaTabela(estado.dados);
    expect(e).toContain("€ + IVA (");
    expect(e).toContain("com IVA)");
    expect(e).toMatch(/proposta do parceiro/);
    const r1 = responderAoOrcamentoAMeio(estado, "Qual é o preço?", AGORA, { fotos: 1, jaExplicouOPreco: false });
    const r2 = responderAoOrcamentoAMeio(estado, "Qual é o preço?", AGORA, { fotos: 1, jaExplicouOPreco: true });
    for (const r of [r1, r2]) {
      expect(r?.resposta).toContain(e!);
      expect(r?.resposta).not.toMatch(/Como lhe disse/);
    }
  });

  it("«com e sem fatura?»: há sempre fatura, com o IVA incluído", () => {
    expect(perguntaPelaFaturaNoPreco("E com e sem fatura?")).toBe(true);
    const r = responderAoOrcamentoAMeio(estado, "E com e sem fatura?", AGORA, { fotos: 1, jaExplicouOPreco: true });
    expect(r?.resposta).toContain(A_FATURA_SAI_SEMPRE);
    expect(A_FATURA_SAI_SEMPRE).toMatch(/IVA incluído/);
  });

  it("a fotografia mandada antes da 1.ª mensagem conta: não se pedem «2 ou 3 fotografias»", () => {
    const fio = [
      { direccao: "in", texto: MARCA_DE_FOTOGRAFIA },
      { direccao: "in", texto: "Boa tarde, queria a recolha de 2 estantes" },
    ];
    expect(fotografiasNaConversa(fio)).toBe(1);
    const r = responderAoOrcamentoAMeio(estado, "Qual é o preço?", AGORA, { fotos: fotografiasNaConversa(fio) });
    expect(r?.resposta).not.toMatch(/2 ou 3 fotografias/);
    // E o «Pedir o que falta» lê a conversa antes de pedir as fotografias.
    expect(ler("src/lib/lembrete-do-que-falta-na-base.ts")).toContain("fotografiasNaConversaDe(telefone!)");
  });

  it("«Sim é isso» é o SIM; as medidas depois actualizam e pedem só «Confirma?»", () => {
    expect(ATUALIZADO_CONFIRMA).toBe("Obrigada, fica atualizado no pedido. Confirma?");
    const rec = ler("src/lib/whatsapp-recolha.ts");
    const bloco = rec.slice(rec.indexOf("O SIM QUE JÁ FOI DADO — d129"), rec.indexOf("// O SIM só vale com tudo preenchido."));
    expect(bloco).toContain('if (simOuNao(cru) === "sim") return { estado: { passo, dados: d }, resposta: "", registar: true };');
    expect(bloco).toContain("resposta: ATUALIZADO_CONFIRMA");
    for (const l of ["en", "fr", "es"] as const) expect(traducaoFixa(ATUALIZADO_CONFIRMA, l)).not.toBeNull();
  });

  it("«cuidado: na rua também há o lote 32» vai para as notas do pedido (o parceiro lê-as)", () => {
    const t = "Cuidado: na rua também há o lote 32";
    expect(eAvisoParaOParceiro(t)).toBe(true);
    expect(eAvisoParaOParceiro("Rua das Amoras Bravas 12")).toBe(false);
    const r = comOAvisoParaOParceiro({ estado, resposta: "Qual é o andar?" }, t);
    expect(r.estado.dados.notas).toEqual([t]);
    // Uma vez só.
    expect(comOAvisoParaOParceiro(r, t).estado.dados.notas).toEqual([t]);
  });
});
