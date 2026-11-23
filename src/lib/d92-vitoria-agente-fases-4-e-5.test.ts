import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * d92 — A VITÓRIA AGENTE, FASES 4 E 5 (23-11-2026).
 *
 * Conversas inventadas e o SDK simulado (nunca a API real num teste). Aqui:
 * identificar a proposta em linguagem livre; relê-la antes de propor; o SIM
 * lido pelo código fecha, o texto do modelo não; a condição vira pergunta ao
 * parceiro; acima de 500 € vai à equipa; o CANCELAR; o IVA do parceiro isento
 * explicado com os números do cálculo real; nada sai com os interruptores
 * desligados; a conversa em inglês; o código postal que chega tapado.
 */

import {
  identificarProposta,
  motivoParaNaoFecharNoSim,
  motivoParaNaoFecharPeloAgente,
  perguntaDoFecho,
  propostasParaOAgente,
  type NegociacaoParaOAgente,
} from "./vitoria-agente/propostas-do-agente";
import { eOSimDoCodigo, lerPendente, respostaAoPendente, type Pendente } from "./vitoria-agente/pendentes";
import { correrFerramenta, estadoNovo, FERRAMENTAS_DA_VITORIA } from "./vitoria-agente/ferramentas";
import { correrOAgente, type ClienteDoClaude, type ResultadoDoAgente } from "./vitoria-agente/cliente";
import { quemResponde, responderAoVivo, type DependenciasAoVivo } from "./vitoria-agente/ao-vivo";
import { AGORA_DOS_CASOS, CONVERSAS_DE_TESTE, ferramentasDoCaso, propostasDoCaso, type CasoDeTeste } from "./vitoria-agente/conversas-de-teste";
import { oQueTeriaFeito } from "./vitoria-agente/painel-do-ensaio";
import { motivoParaBloquearOAgente } from "./vitoria-agente/guarda";
import { textoAnonimizado } from "./vitoria-agente/anonimizar";
import { AVISO_AO_MODELO } from "./vitoria-agente/aviso-ao-modelo";
import { ESFORCO_POR_OMISSAO } from "./vitoria-agente/custo";
import { REGRAS_DO_PAGAMENTO_PARA_O_MODELO } from "./o-pagamento-da-vitoria";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const caso = (n: number) => CONVERSAS_DE_TESTE[n - 1];

/* ── O cálculo real das propostas e o IVA ────────────────────────────────── */

describe("as propostas como o agente as lê (o cálculo da mensagem das propostas)", () => {
  const [isento, comIva] = propostasDoCaso(caso(1));

  it("o caso que motivou a d92: 85,00 € + IVA = 86,96 € (isento) e 108,00 € + IVA = 132,84 €", () => {
    expect(isento.comoOClienteVe).toBe("85,00 € + IVA = 86,96 €");
    expect(comIva.comoOClienteVe).toBe("108,00 € + IVA = 132,84 €");
    expect(isento.regime).toBe("isento");
    expect(comIva.regime).toBe("com_iva");
  });

  it("o isento explica-se com os números da conta: o trabalho sem IVA, o IVA só da taxa", () => {
    expect(isento.conta).toEqual({ trabalhoSemIva: 76.5, ivaDoTrabalho: 0, taxaDaPlataformaSemIva: 8.5, ivaDaTaxa: 1.96, semIva: 85, iva: 1.96, total: 86.96 });
    for (const n of ["isento de IVA", "76,50 €", "1,96 €", "8,50 €", "86,96 €", "85,00 €"]) expect(isento.explicacaoDoIva).toContain(n);
    expect(comIva.explicacaoDoIva).toContain("fatura com IVA");
    expect(comIva.explicacaoDoIva).toContain("132,84 €");
    // E a explicação passa na guarda, com os euros das ferramentas.
    expect(motivoParaBloquearOAgente(isento.explicacaoDoIva, [76.5, 1.96, 8.5, 86.96, 85])).toBeNull();
  });

  it("o valor que o parceiro escreveu nunca vai ao modelo", async () => {
    const r = await correrFerramenta("propostas_vivas", { pedido: 663 }, ferramentasDoCaso(caso(1)), estadoNovo());
    expect(JSON.stringify(r.resultado)).not.toContain("valorDoParceiro");
  });

  it("só as que o cliente pode escolher: uma retirada ou só do cliente não entra", () => {
    const linhas: NegociacaoParaOAgente[] = [
      { ...caso(1).negociacoes[0], estado: "desistida" },
      { ...caso(1).negociacoes[1], propostasJson: JSON.stringify([{ por: "cliente", valor: 90, criadaEm: "2026-11-23T10:00:00Z", estado: "pendente" }]) },
    ];
    expect(propostasParaOAgente(663, linhas, new Set([6631, 6632]))).toEqual([]);
  });
});

describe("identificar a proposta em linguagem livre", () => {
  const lista = propostasDoCaso(caso(1));
  const qual = (t: string) => {
    const r = identificarProposta(t, lista);
    return r.ok ? r.proposta.parceiro : null;
  };

  it("pelo nome, pelo valor, pela ordem, a mais barata", () => {
    expect(qual("escolho a Recolhas Tejo")).toBe("Recolhas Tejo");
    expect(qual("fico com o tejo")).toBe("Recolhas Tejo");
    expect(qual("fico com a de 85")).toBe("Recolhas Tejo");
    expect(qual("a de 132,84 €")).toBe("Sado Serviços");
    expect(qual("a primeira")).toBe("Recolhas Tejo");
    expect(qual("a segunda")).toBe("Sado Serviços");
    expect(qual("the second one please")).toBe("Sado Serviços");
    expect(qual("a mais barata")).toBe("Recolhas Tejo");
  });

  it("não adivinha: sem nada que bata, pergunta", () => {
    const r = identificarProposta("quero a do meu primo", [lista[0], { ...lista[1], n: 5 }]);
    expect(r.ok).toBe(false);
    expect(identificarProposta("a primeira", []).ok).toBe(false);
  });
});

/* ── Os limites e a releitura ────────────────────────────────────────────── */

describe("relê antes de propor, e os limites passam à equipa", () => {
  const [isento] = propostasDoCaso(caso(1));

  it("acima de 500 € com IVA, Trabalho CLYON, valor único, à hora, já fechado: equipa", () => {
    const grande = propostasDoCaso(caso(9))[0];
    expect(grande.conta.total).toBe(738);
    expect(motivoParaNaoFecharPeloAgente(grande, {}, AGORA_DOS_CASOS)).toMatch(/acima de 500/);
    expect(motivoParaNaoFecharPeloAgente({ ...isento, trabalhoClyon: true }, {}, AGORA_DOS_CASOS)).toMatch(/Trabalho CLYON/);
    expect(motivoParaNaoFecharPeloAgente(isento, { temValorUnicoPorDecidir: true }, AGORA_DOS_CASOS)).toMatch(/valor único/);
    expect(motivoParaNaoFecharPeloAgente(isento, { baseDoPreco: "hora" }, AGORA_DOS_CASOS)).toMatch(/à hora/);
    expect(motivoParaNaoFecharPeloAgente(isento, { temAcordada: true }, AGORA_DOS_CASOS)).toMatch(/já está fechado/);
    expect(motivoParaNaoFecharPeloAgente(isento, {}, AGORA_DOS_CASOS)).toBeNull();
  });

  it("uma proposta que mudou há menos de 10 minutos não se propõe", () => {
    const agora = new Date(new Date(isento.mudouEm!).getTime() + 4 * 60_000);
    expect(motivoParaNaoFecharPeloAgente(isento, {}, agora)).toMatch(/mudou há 4 min/);
  });

  it("no SIM relê-se: a mesma, o mesmo total, dentro dos 30 minutos", () => {
    const f = { tipo: "fecho" as const, pedidoId: 663, negociacaoId: isento.negociacaoId, parceiro: isento.parceiro, total: 86.96, propostoEm: AGORA_DOS_CASOS.toISOString() };
    const daqui = (min: number) => new Date(AGORA_DOS_CASOS.getTime() + min * 60_000);
    expect(motivoParaNaoFecharNoSim(f, daqui(5), [isento])).toBeNull();
    expect(motivoParaNaoFecharNoSim(f, daqui(45), [isento])).toMatch(/pergunta-se outra vez/);
    expect(motivoParaNaoFecharNoSim(f, daqui(5), [])).toMatch(/já não está disponível/);
    expect(motivoParaNaoFecharNoSim(f, daqui(5), [{ ...isento, conta: { ...isento.conta, total: 90 } }])).toMatch(/mudou/);
  });

  it("a pergunta do fecho diz o parceiro, o total e o regime, e pede o SIM", () => {
    expect(perguntaDoFecho(isento)).toBe(
      "Reservo Recolhas Tejo por 86,96 € (parceiro isento de IVA — só a taxa da plataforma leva IVA) no pedido #663? Responda SIM.",
    );
  });
});

/* ── O SIM e o CANCELAR são do código ────────────────────────────────────── */

describe("o SIM e o CANCELAR lidos pelo código", () => {
  it("o SIM em português e nas línguas do tradutor; uma pergunta ou um não não são o SIM", () => {
    for (const s of ["SIM", "sim!", "1", "Sim, pode ser", "Yes", "yes please", "Oui", "Sí"]) expect(eOSimDoCodigo(s), s).toBe(true);
    for (const s of ["sim?", "não", "Sim mas não hoje", "talvez", "Já está fechado então", ""]) expect(eOSimDoCodigo(s), s).toBe(false);
  });

  it("o pendente: dentro do prazo confirma; depois expira; outra resposta acaba-o", () => {
    const f: Pendente = { tipo: "fecho", pedidoId: 663, negociacaoId: 6631, parceiro: "X", total: 86.96, propostoEm: AGORA_DOS_CASOS.toISOString() };
    const daqui = (min: number) => new Date(AGORA_DOS_CASOS.getTime() + min * 60_000);
    expect(respostaAoPendente(f, "SIM", daqui(10)).tipo).toBe("confirmou");
    expect(respostaAoPendente(f, "SIM", daqui(31)).tipo).toBe("expirou");
    expect(respostaAoPendente(f, "afinal quero a outra", daqui(2)).tipo).toBe("outra");
    const c: Pendente = { tipo: "cancelar", pedidoId: 669, propostoEm: AGORA_DOS_CASOS.toISOString() };
    expect(respostaAoPendente(c, "CANCELAR", daqui(60 * 24)).tipo).toBe("confirmou");
    expect(respostaAoPendente(c, "cancel", daqui(5)).tipo).toBe("confirmou");
    expect(respostaAoPendente(c, "sim", daqui(5)).tipo).toBe("outra");
    expect(lerPendente(JSON.stringify(f))).toEqual(f);
    expect(lerPendente("{lixo")).toBeNull();
  });
});

/* ── As ferramentas que propõem ──────────────────────────────────────────── */

describe("aceitar, perguntar ao parceiro e cancelar só propõem", () => {
  it("catorze ferramentas, strict, com as novas no fim (a cache)", () => {
    const nomes = FERRAMENTAS_DA_VITORIA.map((f) => f.name);
    expect(nomes.slice(-4)).toEqual(["aceitar_proposta", "cancelar_pedido", "perguntar_ao_parceiro", "perguntas_frequentes"]);
    expect(nomes.length).toBe(14);
    for (const f of FERRAMENTAS_DA_VITORIA) expect(f.strict, f.name).toBe(true);
  });

  it("aceitar: identifica, relê e devolve a frase do SIM; não fecha nada", async () => {
    const e = estadoNovo();
    const r = await correrFerramenta("aceitar_proposta", { pedido: 665, escolha: "a da Sado" }, ferramentasDoCaso(caso(3)), e);
    expect(r.resultado).toMatchObject({ proposto: true, fechado: false });
    expect(e.pendente).toMatchObject({ tipo: "fecho", pedidoId: 665, total: 132.84 });
    expect(e.fraseObrigatoria).toContain("Responda SIM.");
    // A resposta sem a frase não passa.
    const sem = await correrFerramenta("propor_resposta", { texto: "Está reservado!" }, ferramentasDoCaso(caso(3)), e);
    expect(sem.resultado.aceite).toBe(false);
    expect(String(sem.resultado.motivo)).toMatch(/tal e qual/);
  });

  it("perguntar ao parceiro: a mensagem ao parceiro fica no código, com o valor dele e a condição", async () => {
    const e = estadoNovo();
    const r = await correrFerramenta("perguntar_ao_parceiro", { pedido: 664, escolha: "Recolhas Tejo", condicao: "até quinta-feira" }, ferramentasDoCaso(caso(2)), e);
    expect(r.resultado).toMatchObject({ perguntaPreparada: true, parceiro: "Recolhas Tejo" });
    expect(JSON.stringify(r.resultado)).not.toContain("mensagem");
    expect(e.pendente).toMatchObject({ tipo: "parceiro", condicao: "até quinta-feira" });
    expect(e.pendente && e.pendente.tipo === "parceiro" ? e.pendente.mensagem : "").toBe(
      "Olá! O cliente do pedido #664 quer escolher a sua proposta (85,00 €), com uma condição: «até quinta-feira». Consegue? Responda SIM ou NÃO, por favor.",
    );
    expect(e.teriaFeito.at(-1)).toBe("teria perguntado a Recolhas Tejo se consegue: «até quinta-feira» (#664)");
  });

  it("cancelar: com contrato ou data passa à equipa; sem, a frase do CANCELAR", async () => {
    const e = estadoNovo();
    const r = await correrFerramenta("cancelar_pedido", { pedido: 669, motivo: "já não precisa" }, ferramentasDoCaso(caso(7)), e);
    expect(r.resultado.fraseQueTemDeIrNaResposta).toBe("Confirma que quer cancelar o pedido #669? Responda CANCELAR.");
    const comData = { ...caso(7), pedido: { ...caso(7).pedido, dataAgendada: "2026-11-26 10:00:00" } } as CasoDeTeste;
    const r2 = await correrFerramenta("cancelar_pedido", { pedido: 669, motivo: "x" }, ferramentasDoCaso(comData), estadoNovo());
    expect(r2.resultado).toMatchObject({ passarAEquipa: true });
  });

  it("a sério com o «aceitar» desligado, as três passam à equipa (as perguntas do SIM nunca saem)", async () => {
    for (const nome of ["aceitar_proposta", "perguntar_ao_parceiro", "cancelar_pedido"]) {
      const e = estadoNovo();
      const r = await correrFerramenta(nome, { pedido: 665, escolha: "Sado", condicao: "x", motivo: "x" }, ferramentasDoCaso(caso(3), { aoVivo: true, aceitarLigado: false }), e);
      expect(r.resultado, nome).toMatchObject({ passarAEquipa: true });
      expect(e.pendente, nome).toBeNull();
    }
  });

  it("o código das ferramentas nunca fecha, cancela, envia nem escreve na base", () => {
    const codigo = ler("src/lib/vitoria-agente/ferramentas.ts");
    expect(codigo).not.toMatch(/cancelarPedido\(|fecharPeloCliente|tratarMensagemDoCliente|enviarTextoWhatsApp|INSERT|UPDATE/);
  });
});

/* ── O conjunto de conversas, com o SDK simulado a seguir o roteiro ──────── */

type Pedido = Anthropic.Beta.MessageCreateParamsNonStreaming;
const uso = { input_tokens: 1500, output_tokens: 120, cache_read_input_tokens: 3000, cache_creation_input_tokens: 0 };
const msg = (content: unknown[], stop_reason: string) =>
  ({ id: "m", type: "message", role: "assistant", model: "claude-sonnet-5-5", content, stop_reason, usage: uso }) as unknown as Anthropic.Beta.BetaMessage;

/** Um «modelo» que segue o roteiro do caso: pede as ferramentas, depois responde a partir dos resultados. */
function modeloDoRoteiro(c: CasoDeTeste) {
  const pedidos: Pedido[] = [];
  let volta = 0;
  const cliente: ClienteDoClaude = {
    beta: {
      messages: {
        create: vi.fn(async (p: Pedido) => {
          pedidos.push(JSON.parse(JSON.stringify(p)) as Pedido);
          volta += 1;
          const f = c.roteiro.ferramentas;
          if (volta === 1 && f.length > 0) return msg(f.map((x, i) => ({ type: "tool_use", id: `t${i}`, name: x.nome, input: x.entrada })), "tool_use");
          if ((volta === 2 && f.length > 0) || (volta === 1 && f.length === 0)) {
            const resultados: Record<string, Record<string, unknown>> = {};
            const ultima = p.messages.at(-1);
            if (ultima && Array.isArray(ultima.content)) {
              for (const b of ultima.content as Array<{ type: string; tool_use_id?: string; content?: unknown }>) {
                if (b.type !== "tool_result") continue;
                const i = Number(String(b.tool_use_id).slice(1));
                resultados[f[i].nome] = JSON.parse(String(b.content));
              }
            }
            const r = c.roteiro.resposta(resultados);
            return msg([{ type: "tool_use", id: "fim", name: r.ferramenta, input: r.entrada }], "tool_use");
          }
          return msg([], "end_turn");
        }),
      },
    },
  };
  return { cliente, pedidos };
}

async function correrOCaso(c: CasoDeTeste, extra: Parameters<typeof ferramentasDoCaso>[1] = {}): Promise<ResultadoDoAgente> {
  const { cliente } = modeloDoRoteiro(c);
  return correrOAgente(
    { conversa: c.conversa, pedidos: [c.pedidoId], agora: AGORA_DOS_CASOS },
    { cliente, ferramentas: ferramentasDoCaso(c, extra), gastoETecto: async () => ({ gastoUsd: 0, tectoUsd: 10 }), registar: async () => {} },
  );
}

function accaoDe(r: ResultadoDoAgente): string {
  if (r.estado === "equipa") return "equipa";
  if (r.estado !== "ok") return r.estado;
  if (!r.pendente) return "responder";
  return r.pendente.tipo === "parceiro" ? "parceiro" : r.pendente.tipo;
}

describe("o conjunto de conversas de teste (SDK simulado)", () => {
  it("são onze, todas inventadas, com uma em inglês", () => {
    expect(CONVERSAS_DE_TESTE.length).toBe(11);
    expect(CONVERSAS_DE_TESTE.some((c) => /\b(Hi|Which|I'll)\b/.test(c.conversa.at(-1)!.texto))).toBe(true);
  });

  for (const c of CONVERSAS_DE_TESTE) {
    it(c.nome, async () => {
      const r = await correrOCaso(c);
      expect(accaoDe(r), `${c.nome}: ${r.motivo ?? ""} ${JSON.stringify(r.recusadas)}`).toBe(c.espera.accao);
      const texto = r.texto ?? r.mensagemDeEquipa ?? "";
      for (const s of c.espera.contem ?? []) expect(texto, s).toContain(s);
      for (const s of c.espera.naoContem ?? []) expect(texto, s).not.toContain(s);
      // A guarda deixou sair o que saiu: português de Portugal, «parceiro», os € das ferramentas.
      if (r.texto) expect(motivoParaBloquearOAgente(r.texto, [86.96, 85, 76.5, 8.5, 1.96, 132.84, 108, 24.84, 738, 600]), c.nome).toBeNull();
    });
  }

  it("o caso #663 com o modelo a dizer «fechado» em texto: nada fica pendente nem fecha", async () => {
    const c = caso(3);
    const { cliente } = modeloDoRoteiro({ ...c, roteiro: { ferramentas: [], resposta: () => ({ ferramenta: "propor_resposta", entrada: { texto: "Pronto, já está fechado com a Sado Serviços!" } }) } });
    const r = await correrOAgente(
      { conversa: c.conversa, pedidos: [c.pedidoId], agora: AGORA_DOS_CASOS },
      { cliente, ferramentas: ferramentasDoCaso(c), gastoETecto: async () => ({ gastoUsd: 0, tectoUsd: 10 }), registar: async () => {} },
    );
    expect(r.pendente).toBeNull();
  });
});

/* ── A sério: a orquestra, com tudo fingido ──────────────────────────────── */

function mundo(over: Partial<DependenciasAoVivo> = {}, estado: { pendente?: Pendente | null } = {}) {
  const chamadas: string[] = [];
  const enviados: string[] = [];
  const equipa: Array<{ motivo: string; mensagem: string | null }> = [];
  const registos: Array<{ estado: string; teriaFeito: string[] }> = [];
  let pendente: Pendente | null = estado.pendente ?? null;
  const deps: DependenciasAoVivo = {
    agora: AGORA_DOS_CASOS,
    interruptores: async () => ({ conversa: true, aceitar: true }),
    situacao: async () => ({ temPedidos: true, interrompida: false, recolhaEmCurso: false, perguntaDeDadosAEspera: false }),
    regras: async () => void chamadas.push("regras"),
    pendente: async () => pendente,
    acabarPendente: async (_p, como) => {
      chamadas.push(`acabou: ${como}`);
      pendente = null;
    },
    gravarPendente: async (p) => {
      chamadas.push(`pendente: ${p.tipo}`);
      pendente = p;
    },
    propostasParaEscolher: async (id) => propostasDoCaso(CONVERSAS_DE_TESTE.find((c) => c.pedidoId === id) ?? caso(1)),
    fecharPeloBotao: async (p, n) => void chamadas.push(`fechou ct:${p}:${n}`),
    cancelarPeloCancelar: async (p) => {
      chamadas.push(`cancelou #${p}`);
      return { ok: true };
    },
    marcarPerguntaDoCancelar: async (p) => void chamadas.push(`pergunta do cancelar #${p}`),
    correrOAgente: async () => {
      throw new Error("sem roteiro");
    },
    enviar: async (t) => {
      enviados.push(t);
      return true;
    },
    passarAEquipa: async (motivo, mensagem) => void equipa.push({ motivo, mensagem }),
    registar: async (l) => void registos.push({ estado: l.estado, teriaFeito: l.teriaFeito }),
    ...over,
  };
  return { deps, chamadas, enviados, equipa, registos, pendente: () => pendente };
}

const comOCaso = (c: CasoDeTeste, extra: Parameters<typeof ferramentasDoCaso>[1] = { aoVivo: true, aceitarLigado: true }) => () => correrOCaso(c, extra);

describe("a sério (a «conversa livre»)", () => {
  it("com a conversa livre desligada, só as regras — nada sai do agente", async () => {
    const m = mundo({ interruptores: async () => ({ conversa: false, aceitar: false }), correrOAgente: comOCaso(caso(1)) });
    expect(await responderAoVivo({ tipo: "texto", texto: "Olá, qual é o preço?" }, m.deps)).toBe("regras");
    expect(m.chamadas).toEqual(["regras"]);
    expect(m.enviados).toEqual([]);
  });

  it("quem responde: a recolha, as fotografias, as respostas curtas e quem não tem pedido ficam com as regras", () => {
    const base = { temPedidos: true, interrompida: false, recolhaEmCurso: false, imagens: 0, videos: 0, perguntaDeDadosAEspera: false };
    expect(quemResponde({ ...base, texto: "O IVA está certo?" }).quem).toBe("agente");
    for (const texto of ["SIM", "2", "não", "350", "27/11 14:30", "CANCELAR"]) expect(quemResponde({ ...base, texto }).quem, texto).toBe("regras");
    expect(quemResponde({ ...base, texto: "O IVA está certo?", temPedidos: false }).quem).toBe("regras");
    expect(quemResponde({ ...base, texto: "O IVA está certo?", recolhaEmCurso: true }).quem).toBe("regras");
    expect(quemResponde({ ...base, texto: "Rua das Flores 3", perguntaDeDadosAEspera: true }).quem).toBe("regras");
    expect(quemResponde({ ...base, texto: "olá", imagens: 2 }).quem).toBe("regras");
    expect(quemResponde({ ...base, texto: "olá", interrompida: true }).quem).toBe("regras");
  });

  it("a resposta do agente É a que sai, em português (a porta de sempre traduz)", async () => {
    const m = mundo({ correrOAgente: comOCaso(caso(1)) });
    expect(await responderAoVivo({ tipo: "texto", texto: caso(1).conversa.at(-1)!.texto }, m.deps)).toBe("agente");
    expect(m.chamadas).not.toContain("regras");
    expect(m.enviados.length).toBe(1);
    expect(m.enviados[0]).toContain("86,96 €");
    expect(m.registos[0].estado).toBe("vivo_ok");
  });

  it("o fecho: o agente pergunta; o SIM lido pelo código fecha pelo botão de sempre", async () => {
    const m = mundo({ correrOAgente: comOCaso(caso(3)) });
    await responderAoVivo({ tipo: "texto", texto: caso(3).conversa.at(-1)!.texto }, m.deps);
    expect(m.enviados[0]).toContain("Responda SIM.");
    expect(m.chamadas).toContain("pendente: fecho");
    const p = m.pendente();
    expect(p).toMatchObject({ tipo: "fecho", pedidoId: 665 });
    // A resposta seguinte: SIM.
    m.deps.agora = new Date(AGORA_DOS_CASOS.getTime() + 3 * 60_000);
    expect(await responderAoVivo({ tipo: "texto", texto: "Sim" }, m.deps)).toBe("codigo");
    expect(m.chamadas).toContain(`fechou ct:665:${(p as { negociacaoId: number }).negociacaoId}`);
    expect(m.chamadas).not.toContain("regras");
  });

  it("em inglês: «Yes» também é o SIM (o tradutor pôs a pergunta em inglês)", async () => {
    const m = mundo({ correrOAgente: comOCaso(caso(10)) });
    await responderAoVivo({ tipo: "texto", texto: caso(10).conversa.at(-1)!.texto }, m.deps);
    expect(m.enviados[0]).toContain("Responda SIM.");
    expect(m.enviados[0]).not.toMatch(/\b(Which|VAT|Lisbon)\b/);
    expect(await responderAoVivo({ tipo: "texto", texto: "Yes" }, m.deps)).toBe("codigo");
    expect(m.chamadas.some((c) => c.startsWith("fechou ct:672:"))).toBe(true);
  });

  it("o SIM com o «aceitar» desligado não fecha: vai ao agente", async () => {
    const f: Pendente = { tipo: "fecho", pedidoId: 665, negociacaoId: 6652, parceiro: "Sado Serviços", total: 132.84, propostoEm: AGORA_DOS_CASOS.toISOString() };
    const m = mundo({ interruptores: async () => ({ conversa: true, aceitar: false }), correrOAgente: comOCaso(caso(1)) }, { pendente: f });
    await responderAoVivo({ tipo: "texto", texto: "SIM" }, m.deps);
    expect(m.chamadas.some((c) => c.startsWith("fechou"))).toBe(false);
    expect(m.chamadas).toContain("acabou: confirmou com o «aceitar» desligado");
  });

  it("o SIM depois de a proposta mudar não fecha: passa à equipa e diz porquê", async () => {
    const f: Pendente = { tipo: "fecho", pedidoId: 665, negociacaoId: 6652, parceiro: "Sado Serviços", total: 120, propostoEm: AGORA_DOS_CASOS.toISOString() };
    const m = mundo({}, { pendente: f });
    expect(await responderAoVivo({ tipo: "texto", texto: "SIM" }, m.deps)).toBe("codigo");
    expect(m.chamadas.some((c) => c.startsWith("fechou"))).toBe(false);
    expect(m.equipa[0].motivo).toMatch(/mudou/);
    expect(m.equipa[0].mensagem).toMatch(/ainda não reservei/);
  });

  it("a condição: o cliente lê que se confirma com o parceiro; a equipa recebe a pergunta pronta", async () => {
    const m = mundo({ correrOAgente: comOCaso(caso(2)) });
    await responderAoVivo({ tipo: "texto", texto: caso(2).conversa.at(-1)!.texto }, m.deps);
    expect(m.enviados[0]).toMatch(/confirmar com a Recolhas Tejo/);
    expect(m.equipa[0].mensagem).toBeNull(); // a mensagem do agente já saiu
    expect(m.equipa[0].motivo).toContain("Mensagem pronta: Olá! O cliente do pedido #664");
  });

  it("acima de 500 €: a mensagem do agente ao cliente e a conversa para uma pessoa", async () => {
    const m = mundo({ correrOAgente: comOCaso(caso(9)) });
    await responderAoVivo({ tipo: "texto", texto: "Aceito a proposta." }, m.deps);
    expect(m.equipa[0].motivo).toMatch(/acima de 500/);
    expect(m.equipa[0].mensagem).toMatch(/uma pessoa da equipa/);
    expect(m.chamadas).not.toContain("regras");
  });

  it("o CANCELAR: a pergunta sai, o CANCELAR cancela pelo caminho único; outra palavra não", async () => {
    const m = mundo({ correrOAgente: comOCaso(caso(7)) });
    await responderAoVivo({ tipo: "texto", texto: caso(7).conversa.at(-1)!.texto }, m.deps);
    expect(m.enviados[0]).toContain("Responda CANCELAR.");
    expect(m.chamadas).toContain("pergunta do cancelar #669");
    expect(await responderAoVivo({ tipo: "texto", texto: "CANCELAR" }, m.deps)).toBe("codigo");
    expect(m.chamadas).toContain("cancelou #669");

    const outra = mundo({ correrOAgente: comOCaso(caso(1)) }, { pendente: { tipo: "cancelar", pedidoId: 669, propostoEm: AGORA_DOS_CASOS.toISOString() } });
    await responderAoVivo({ tipo: "texto", texto: "Sim, cancelem" }, outra.deps);
    expect(outra.chamadas).not.toContain("cancelou #669");
  });

  it("a sério, um dado do pedido gravam-no as regras: a volta acaba e respondem as regras", async () => {
    const c = caso(1);
    const comDado: CasoDeTeste = {
      ...c,
      roteiro: { ferramentas: [{ nome: "gravar_dado", entrada: { pedido: 663, passo: "andar", texto: "é no 3.º andar" } }], resposta: () => ({ ferramenta: "propor_resposta", entrada: { texto: "Anotado!" } }) },
    };
    const r = await correrOCaso(comDado, { aoVivo: true, aceitarLigado: true });
    expect(r.estado).toBe("bloqueado");
    expect(r.motivo).toMatch(/deixa às regras/);
    const m = mundo({ correrOAgente: comOCaso(comDado) });
    expect(await responderAoVivo({ tipo: "texto", texto: "Afinal é no 3.º andar, e o IVA está certo?" }, m.deps)).toBe("regras");
    expect(m.enviados).toEqual([]);
    // No ensaio, continua a dizer o que TERIA gravado.
    const ensaio = await correrOCaso(comDado);
    expect(ensaio.teriaFeito).toContain("teria gravado no #663: andar");
  });

  it("uma volta lenta de mais não deixa o cliente sem resposta: respondem as regras", async () => {
    vi.useFakeTimers();
    try {
      const m = mundo({ correrOAgente: () => new Promise<ResultadoDoAgente>(() => {}) });
      const quem = responderAoVivo({ tipo: "texto", texto: "Qual é o IVA?" }, m.deps);
      await vi.advanceTimersByTimeAsync(40_000);
      expect(await quem).toBe("regras");
      expect(m.registos.at(-1)?.estado).toBe("vivo_regras");
    } finally {
      vi.useRealTimers();
    }
  });

  it("a rede de segurança: o agente falha ou passa o tecto → respondem as regras", async () => {
    const m = mundo();
    expect(await responderAoVivo({ tipo: "texto", texto: "Qual é o IVA?" }, m.deps)).toBe("regras");
    const t = mundo({ correrOAgente: async () => ({ ...(await correrOCaso(caso(1))), estado: "tecto", texto: null, pendente: null }) });
    expect(await responderAoVivo({ tipo: "texto", texto: "Qual é o IVA?" }, t.deps)).toBe("regras");
    expect(t.enviados).toEqual([]);
    expect(t.registos[0].estado).toBe("vivo_regras");
  });
});

/* ── O resto: a guarda, a anonimização, o aviso, a ponte, o painel ───────── */

describe("a guarda, a anonimização, o aviso, a ponte e o painel", () => {
  it("o pagamento só pelas regras do modelo: nunca «só paga depois do trabalho feito»", () => {
    for (const r of REGRAS_DO_PAGAMENTO_PARA_O_MODELO) expect(AVISO_AO_MODELO).toContain(r);
    expect(AVISO_AO_MODELO).toMatch(/Nunca prometas que «só paga depois do trabalho feito»/);
    for (const t of [
      "Fique descansada: só paga depois do trabalho feito.",
      "Só paga no fim, quando estiver tudo levado.",
      "A CLYON guarda o dinheiro até ao fim.",
      "O dinheiro fica cativo até confirmar.",
    ]) {
      expect(motivoParaBloquearOAgente(t, []), t).toMatch(/modelo de pagamento/);
    }
    expect(motivoParaBloquearOAgente("Paga diretamente ao parceiro que contratou, e nada adiantado. Recebe duas faturas.", [])).toBeNull();
  });

  it("«85,00 € + IVA = 86,96 €» já leva o com IVA ao lado", () => {
    expect(motivoParaBloquearOAgente("A proposta é 85,00 € + IVA = 86,96 €.", [85, 86.96])).toBeNull();
    expect(motivoParaBloquearOAgente("A proposta é 85,00 € + IVA.", [85, 86.96])).toMatch(/sem IVA sozinho/);
  });

  it("o código postal chega marcado como recebido (o caso …366), também sem hífen; um valor não", () => {
    expect(textoAnonimizado("O meu é 1100-123 Lisboa")).toBe("O meu é [código postal recebido] Lisboa");
    expect(textoAnonimizado("é 2800 - 123")).toBe("é [código postal recebido]");
    expect(textoAnonimizado("Pago 1500 €")).toBe("Pago 1500 €");
    expect(AVISO_AO_MODELO).toContain("«[código postal recebido]»");
    expect(AVISO_AO_MODELO).toMatch(/nunca digas que chegaram incompletos nem os peças de novo/);
    expect(AVISO_AO_MODELO).toMatch(/respondes a todas antes de pedires/);
  });

  it("o aviso: tom humano e variado, a passagem escrita por ela, sempre em português (a saída traduz)", () => {
    expect(AVISO_AO_MODELO).toMatch(/Varia as frases/);
    expect(AVISO_AO_MODELO).toMatch(/nunca o mesmo molde/);
    expect(AVISO_AO_MODELO).toMatch(/sem frases feitas/);
    expect(AVISO_AO_MODELO).not.toContain("Percebi o que me disse. Vou passar isto a uma pessoa");
    expect(AVISO_AO_MODELO).toMatch(/Escreves sempre em português de Portugal, mesmo quando o cliente escreve noutra língua/);
    expect(AVISO_AO_MODELO).toMatch(/os nomes das localidades/);
    expect(ESFORCO_POR_OMISSAO).toBe("medium");
  });

  it("na ponte: a resposta a sério envolve as regras, e o ensaio só corre quando responderam as regras", () => {
    const ponte = ler("src/app/api/whatsapp/ponte/route.ts");
    const vivo = ponte.indexOf("responderAoClienteAoVivo(telefone,");
    const regras = ponte.indexOf('tratarMensagemDoCliente(telefone, { tipo: "texto", texto: junto', vivo);
    expect(vivo).toBeGreaterThan(0);
    expect(regras).toBeGreaterThan(vivo);
    expect(ponte).toContain('if (respondida && quemRespondeu === "regras") {');
    const fio = ler("src/lib/vitoria-agente/ao-vivo-na-base.ts");
    expect(fio).toContain('enviarTextoWhatsApp(telefone, texto)');
    expect(fio).toContain("{ tipo: \"botao\", id: `ct:${pedidoId}:${negociacaoId}` }");
    expect(fio).toContain('lerInterruptor("conversa"), lerInterruptor("aceitar")');
  });

  it("os interruptores novos: desligados na dúvida, só o administrador, com LIGAR", () => {
    const naBase = ler("src/lib/vitoria-agente/na-base.ts");
    expect(naBase).toContain('export const CHAVE_DA_CONVERSA_LIVRE = "vitoria_agente_conversa";');
    expect(naBase).toContain('export const CHAVE_DO_ACEITAR = "vitoria_agente_aceitar";');
    expect(naBase).toContain("if (!l) return desligado;");
    const rota = ler("src/app/api/admin/vitoria-agente/route.ts");
    expect(rota).toContain("requireAdminGeral");
    expect(rota).toContain('!== "LIGAR"');
    expect(rota).toContain("mudarInterruptor(qual, corpo.ligar, porQuem)");
  });

  it("o cancelar a sério é o caminho único, com a fonte d92 e a pergunta de 48 h", () => {
    const a = ler("src/lib/vitoria-agente/accoes-na-base.ts");
    expect(a).toContain("cancelarPeloLembreteComum(FONTE_DO_CANCELAR_DO_AGENTE, pool, pedidoId, telefone");
    expect(a).toContain('confirmacao: "pergunta"');
    expect(ler("src/lib/cancelar-pelo-lembrete.ts")).toContain('| "vitoriaCancelamentos"');
  });

  it("o painel: «o que teria feito» numa frase, e se agiria", () => {
    expect(oQueTeriaFeito("ok", null, ["teria proposto o fecho do #663 com X por 86,96 € (à espera do SIM)"])).toEqual({
      frase: "teria proposto o fecho do #663 com X por 86,96 € (à espera do SIM)",
      agiria: true,
    });
    expect(oQueTeriaFeito("equipa", "queixa", ["passaria à equipa: queixa"])).toEqual({ frase: "teria passado à equipa: queixa", agiria: true });
    expect(oQueTeriaFeito("ok", null, [])).toEqual({ frase: "só teria respondido", agiria: false });
    expect(oQueTeriaFeito("vivo_equipa", "queixa", [])).toEqual({ frase: "passou à equipa: queixa", agiria: true });
    expect(oQueTeriaFeito("tecto", "tecto diário", [])).toEqual({ frase: "não agiria (tecto diário)", agiria: false });
  });

  it("o script da API real: fora dos testes, com tecto de 5 USD, low e medium, relatório fora do repositório", () => {
    const s = ler("scripts/avaliar-vitoria-agente.ts");
    expect(s).toMatch(/Number\(valor\("tecto"\) \?\? 5\)/);
    expect(s).toContain("O relatório nunca fica no repositório");
    expect(s).toContain('"low,medium"');
    expect(s).toContain("CONVERSAS_DE_TESTE");
    expect(s).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b|enviarTextoWhatsApp|DATABASE_URL/);
  });
});
