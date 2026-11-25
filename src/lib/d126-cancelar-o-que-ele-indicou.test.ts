import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * d126 (CEO e dono, 25-11-2026) — um CANCELAR confirmado cancela os pedidos
 * que o cliente indicou (os dois, quando pede os dois), pelo caminho de
 * sempre, e sai UMA mensagem com o porquê. O caso: dois pedidos abertos no
 * mesmo número, «Pedido #N: há um problema. Quero cancelar», a pergunta, o
 * CANCELAR — e a conversa passou à equipa sem cancelar nada.
 *
 * Base fingida; nenhuma mensagem sai a ninguém. Números e pedidos INVENTADOS.
 */

const e = vi.hoisted(() => ({
  ordem: [] as string[],
  pedidos: {} as Record<number, { id: number; status: string; contactPhone: string; fica?: "contratado" | "pago" }>,
  apagadaComFila: [] as Array<boolean | undefined>,
  porque: [] as Array<{ pedidos: number[] }>,
}));

const pool = vi.hoisted(() => ({
  execute: async (sql: string, args: unknown[] = []) => {
    const id = Number(args[0]);
    const p = e.pedidos[id];
    if (/FROM simulatorOrders o WHERE o\.id = \?/.test(sql)) {
      return [
        p
          ? [{ id, status: p.status, anonimizadoEm: null, contactPhone: p.contactPhone, valorFixoClyon: null, serviceType: "recolha_monos", city: "Lisboa", scheduledDate: null, dataAgendada: null }]
          : [],
        [],
      ];
    }
    if (/FROM negociacoes n/.test(sql)) return [p?.fica === "contratado" ? [{ x: 1 }] : [], []];
    if (/FROM pagamentos WHERE pedidoId = \? AND \(estado = 'pago'/.test(sql)) return [p?.fica === "pago" ? [{ x: 1 }] : [], []];
    if (/SELECT id, status, contactPhone FROM simulatorOrders/.test(sql)) {
      return [Object.values(e.pedidos).map((x) => ({ id: x.id, status: x.status, contactPhone: x.contactPhone })), []];
    }
    return [[], []];
  },
}));

vi.mock("./db", async (original) => ({
  ...(await original<typeof import("./db")>()),
  getPool: vi.fn(async () => pool),
  ensureSimulatorOrdersTable: vi.fn(async () => {}),
  ensureNegociacoesTable: vi.fn(async () => {}),
  negociacoesDoPedido: vi.fn(async () => []),
  cancelarPedido: vi.fn(async (id: number) => {
    e.ordem.push(`cancelar #${id}`);
    e.pedidos[id].status = "cancelado";
    return { encerradas: 0 };
  }),
  gravarMotivoDoFecho: vi.fn(async () => {}),
  appendOrderHistory: vi.fn(async () => {}),
  registarSemFalhar: vi.fn(async () => {}),
  quemTemOTrabalhoClyon: vi.fn(async () => ({ vivos: [] })),
  apagarConversaWhatsApp: vi.fn(async (_t: string, o?: { deixarOQueEstaPorSair?: boolean }) => {
    e.ordem.push("apagar-conversa");
    e.apagadaComFila.push(o?.deixarOQueEstaPorSair);
    return 3;
  }),
}));
vi.mock("./avisar-cancelamento", () => ({ avisarDoCancelamento: vi.fn(async () => {}) }));
vi.mock("./validade-do-orcamento-na-base", () => ({ marcarCicloTerminado: vi.fn(async () => {}) }));
vi.mock("./seguimento-do-cliente-na-base", () => ({ pararSeguimento: vi.fn(async () => true) }));
vi.mock("./whatsapp-cloud", () => ({
  enviarTextoWhatsApp: vi.fn(async (_t: string, texto: string) => {
    e.ordem.push(`mensagem: ${texto}`);
    return true;
  }),
}));
vi.mock("./nao-contactar", () => ({
  marcarParaNaoContactar: vi.fn(async () => true),
  marcarEmailParaNaoContactar: vi.fn(async () => true),
  chaveDoNumero: () => "x".repeat(64),
}));
vi.mock("./porque-cancelou-na-base", () => ({
  registarAPerguntaDoPorque: vi.fn(async (_t: string, pedidos: number[]) => {
    e.porque.push({ pedidos: [...pedidos] });
    return true;
  }),
}));
vi.mock("./regras-novas-na-base", () => ({
  anonimizarPedido: vi.fn(async (id: number) => {
    e.ordem.push(`anonimizar #${id}`);
    return { pedidoId: id };
  }),
}));

import { cancelarOsPedidosPelaConversa } from "./cancelar-pelo-cliente-na-base";
import {
  passoOCancelamentoAEquipa,
  pedidoNaFrase,
  pedidosDaPerguntaDoCancelar,
  pedidosNaFrase,
  perguntaDoCancelamento,
  querCancelar,
} from "./cancelar-pelo-cliente";
import { lerOPorque, mensagemDepoisDeCancelar, motivoDoPorqueParaAEquipa, respostaAoPorque } from "./porque-cancelou";
import { aUltimaSaidaE, eConfirmacaoDoCancelamento, textoDaConfirmacaoDoCancelamento } from "./validade-do-orcamento";

const TEL = "351910000001";

beforeEach(() => {
  e.ordem = [];
  e.apagadaComFila = [];
  e.porque = [];
  e.pedidos = {
    901: { id: 901, status: "sem_assistente", contactPhone: TEL },
    902: { id: 902, status: "sem_assistente", contactPhone: TEL },
  };
});
afterEach(() => vi.clearAllMocks());

describe("d126 — o que ele indicou: um, dois, ou o da pergunta", () => {
  it("lê todos os pedidos da frase, e não um código postal", () => {
    expect(pedidosNaFrase("Cancelar pedido 902 e pedido 901")).toEqual([902, 901]);
    expect(pedidosNaFrase("cancelem os pedidos #901 e #902, por favor")).toEqual([901, 902]);
    expect(pedidosNaFrase("Pedido #901: há um problema.Quero cancelar")).toEqual([901]);
    expect(pedidosNaFrase("No pedido #902 não é aí, o código postal é 1675-155")).toEqual([902]);
    expect(pedidosNaFrase("Quero cancelar")).toEqual([]);
    // O de sempre continua igual.
    expect(pedidoNaFrase("Cancelar pedido 902 e pedido 901")).toBe(902);
  });

  it("«Cancelar pedido 902 e pedido 901» é claro (cancela já); «Quero cancelar» sozinho pergunta", () => {
    expect(querCancelar("Cancelar pedido 902 e pedido 901")).toBe("claro");
    expect(querCancelar("Pedido #901: há um problema.Quero cancelar")).toBe("ambiguo");
    expect(eConfirmacaoDoCancelamento("CANCELAR")).toBe(true);
  });

  it("a pergunta do CANCELAR — de um pedido ou de vários — diz quais o CANCELAR cancela", () => {
    const um = textoDaConfirmacaoDoCancelamento(901);
    expect(perguntaDoCancelamento(901)).toBe(um);
    expect(pedidosDaPerguntaDoCancelar({ texto: um, haSegundos: 30 }, [901, 902])).toEqual([901]);
    const dois = perguntaDoCancelamento([901, 902]);
    expect(dois).toMatch(/^Confirma que quer cancelar os pedidos #901 e #902\? Responda CANCELAR\./);
    expect(pedidosDaPerguntaDoCancelar({ texto: dois, haSegundos: 30 }, [901, 902])).toEqual([901, 902]);
    // Só os ainda abertos; e a pergunta caduca às 48 h.
    expect(pedidosDaPerguntaDoCancelar({ texto: dois, haSegundos: 30 }, [902])).toEqual([902]);
    expect(pedidosDaPerguntaDoCancelar({ texto: dois, haSegundos: 49 * 3600 }, [901, 902])).toEqual([]);
    // O plural não é a pergunta de um lembrete (nenhum ciclo a toma como sua).
    expect(aUltimaSaidaE(dois, 901)).toBeNull();
  });

  it("o lembrete do que falta só toma a pergunta do CANCELAR como sua quando foi ele a fazê-la (aEspera)", () => {
    const fonte = readFileSync(join(__dirname, "lembrete-do-que-falta-na-base.ts"), "utf8");
    expect(fonte).toMatch(/Number\(r\.aEspera\) === 1 && aUltimaSaidaE\(ultima, Number\(r\.pedidoId\)\) === "confirmacao"/);
    expect(fonte).toMatch(/cancelarPedidoEm > UTC_TIMESTAMP\(\) - INTERVAL \$\{HORAS_DA_PERGUNTA_DO_CANCELAR\} HOUR\) AS aEspera/);
  });
});

describe("d126 — cancelar os dois de uma vez, e uma só mensagem", () => {
  it("cancela os dois pelo caminho de sempre, uma mensagem no fim, o porquê à espera, e só depois apaga a conversa (com a fila por sair)", async () => {
    const r = await cancelarOsPedidosPelaConversa([902, 901], TEL);
    expect(r).toEqual({ cancelados: [902, 901], recusados: [], mensagemSaiu: true, conversaApagada: true });
    const mensagens = e.ordem.filter((x) => x.startsWith("mensagem: "));
    expect(mensagens).toEqual([`mensagem: ${mensagemDepoisDeCancelar([902, 901], { dados: "apagados" })}`]);
    expect(e.ordem.indexOf("cancelar #902")).toBeLessThan(e.ordem.indexOf(mensagens[0]));
    expect(e.ordem.indexOf("cancelar #901")).toBeLessThan(e.ordem.indexOf(mensagens[0]));
    expect(e.ordem.at(-1)).toBe("apagar-conversa");
    expect(e.apagadaComFila).toEqual([true]);
    expect(e.porque).toEqual([{ pedidos: [902, 901] }]);
  });

  it("um com dinheiro em jogo fica com a equipa (com o porquê); o outro cancela, e a conversa fica", async () => {
    e.pedidos[901].fica = "pago";
    const r = await cancelarOsPedidosPelaConversa([902, 901], TEL);
    expect(r.cancelados).toEqual([902]);
    expect(r.recusados).toEqual([{ pedidoId: 901, porque: "o pedido já tem um pagamento", daEquipa: true }]);
    expect(r.conversaApagada).toBe(false);
    expect(e.ordem).not.toContain("cancelar #901");
    expect(passoOCancelamentoAEquipa(901, "o pedido já tem um pagamento")).toMatch(/#901\. Como ele já tem um pagamento, não o consigo cancelar daqui/);
  });

  it("o pedido de outro número nunca se cancela", async () => {
    e.pedidos[902].contactPhone = "351910000999";
    const r = await cancelarOsPedidosPelaConversa([902], TEL);
    expect(r.cancelados).toEqual([]);
    expect(e.ordem).toEqual([]);
  });
});

describe("d126 — a mensagem depois de cancelar e a resposta ao porquê", () => {
  it("a mensagem: confirma, diz o que acontece aos dados, pergunta o porquê com 4 números e oferece ajuda", () => {
    const um = mensagemDepoisDeCancelar([901], { dados: "apagados" });
    expect(um).toMatch(/^Está feito: o seu pedido #901 foi cancelado\. Os seus dados deste pedido foram apagados e não voltamos a escrever-lhe\./);
    expect(mensagemDepoisDeCancelar([901], { dados: "apagados", semMaisContacto: false })).toMatch(/foram apagados\.\n/);
    expect(um).toMatch(/1\. o valor\n2\. a data\n3\. já resolvi de outra forma\n4\. outro motivo/);
    expect(um).toMatch(/um parceiro pode voltar a ver, sem compromisso\.$/);
    expect(mensagemDepoisDeCancelar([901, 902], { dados: "apagados" })).toMatch(/^Está feito: os seus pedidos #901 e #902 foram cancelados\./);
    // Sem palavras que a d85 e a orquestra não deixam dizer ao cliente.
    expect(um).not.toMatch(/\b(IA|virtual|profissional|no próprio dia)\b/i);
  });

  it("lê o porquê pelo número ou pelas palavras — e «bom dia» não é a data", () => {
    expect(lerOPorque("1")).toBe("valor");
    expect(lerOPorque("2.")).toBe("data");
    expect(lerOPorque("3 - já tratei")).toBe("resolvido");
    expect(lerOPorque("4")).toBe("outro");
    expect(lerOPorque("Estava muito caro")).toBe("valor");
    expect(lerOPorque("A data não me dava jeito")).toBe("data");
    expect(lerOPorque("Já resolvi com outra empresa")).toBe("resolvido");
    expect(lerOPorque("Bom dia")).toBeNull();
    expect(lerOPorque("1675-155")).toBeNull();
  });

  it("o valor e a data passam a uma pessoa (com o motivo à vista); o resto ouve um obrigado", () => {
    expect(respostaAoPorque("valor")).toMatch(/Passo a uma pessoa da equipa/);
    expect(motivoDoPorqueParaAEquipa([901, 902], "valor")).toBe(
      "Cancelou os pedidos #901 e #902 (motivo: o valor) — ver se um parceiro consegue outro valor",
    );
    expect(respostaAoPorque("resolvido")).toBe("Obrigada por nos dizer, fica registado. Se um dia precisar, estamos por aqui.");
  });
});
