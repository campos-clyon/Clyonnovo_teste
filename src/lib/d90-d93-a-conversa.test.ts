import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * O TESTE DA CONVERSA DA d90 E DA d93 (CEO e dono, 23-11-2026). Corre-se a
 * conversa a sério (as funções de whatsapp-negociacao.ts e o cancelamento em
 * cancelar-pelo-cliente-na-base.ts), com a base fingida e o WhatsApp fingido:
 * nenhuma mensagem sai a ninguém. Números e nomes INVENTADOS (o repositório é
 * público).
 */

const estado = vi.hoisted(() => ({
  enviados: [] as string[],
  passadas: [] as Array<{ porque: string }>,
  arranques: [] as Array<{ pedidoId: number; porque: string }>,
  arrancaOk: true,
  abertos: [812] as number[],
  pedido: {
    existe: true,
    status: "enviado",
    anonimizado: false,
    contratado: false,
    dataMarcada: false,
    pago: false,
    referenciaViva: false,
    faturado: false,
    contactPhone: "351910000001",
    eClyon: false,
    servico: "recolha_monos",
    localidade: "Almada",
  },
  cancelados: [] as number[],
  historico: [] as string[],
  ordem: [] as string[],
  naoContactar: [] as string[],
  anonimizados: [] as number[],
  apagadas: [] as string[],
}));

vi.mock("@/lib/whatsapp-cloud", async (original) => ({
  ...(await original<typeof import("@/lib/whatsapp-cloud")>()),
  enviarTextoWhatsApp: vi.fn(async (_t: string, texto: string) => {
    estado.enviados.push(texto);
    estado.ordem.push("mensagem");
    return true;
  }),
}));
vi.mock("./whatsapp-cloud", async (original) => ({
  ...(await original<typeof import("./whatsapp-cloud")>()),
  enviarTextoWhatsApp: vi.fn(async (_t: string, texto: string) => {
    estado.enviados.push(texto);
    estado.ordem.push("mensagem");
    return true;
  }),
}));

vi.mock("@/lib/db", async (original) => ({
  ...(await original<typeof import("@/lib/db")>()),
  interromperNumeroWhatsApp: vi.fn(async (_t: string, porque: string) => {
    estado.passadas.push({ porque });
  }),
  appendOrderHistory: vi.fn(async (_id: number, h: { message: string }) => {
    estado.historico.push(h.message);
  }),
  recolhaWhatsApp: vi.fn(async () => null),
  mensagensDoNumeroWhatsApp: vi.fn(async () =>
    estado.enviados.map((texto) => ({ direccao: "out", texto, criadoEm: "", haSegundos: 60 })),
  ),
}));

vi.mock("@/lib/seguimento-do-cliente-na-base", () => ({
  arrancarOSeguimentoSozinho: vi.fn(async (pedidoId: number, porque: string) => {
    estado.arranques.push({ pedidoId, porque });
    return estado.arrancaOk ? { ok: true, feito: "ok", voltarEm: new Date() } : { ok: false, porque: "o seguimento automático já correu neste pedido" };
  }),
}));

vi.mock("@/lib/validade-do-orcamento-na-base", () => ({
  pararOCiclo: vi.fn(async () => {}),
  marcarCicloTerminado: vi.fn(async () => {}),
  aceitarTrabalhoClyonPeloLembrete: vi.fn(async () => ({ ok: false, porque: "não usado" })),
  confirmarCancelamentoPeloLembrete: vi.fn(async () => ({ ok: false, porque: "não usado" })),
  cancelarPeloLembrete: vi.fn(async () => ({ ok: false, porque: "não usado" })),
}));

vi.mock("@/lib/cancelar-pelo-cliente-na-base", () => ({
  pedidosAbertosDoTelefone: vi.fn(async () => estado.abertos),
  lerOPedidoParaCancelar: vi.fn(async () => estado.pedido),
  cancelarPeloCliente: vi.fn(async (pedidoId: number) => {
    const { porqueFicaComAEquipa } = await import("./cancelar-pelo-cliente");
    const fica = porqueFicaComAEquipa(estado.pedido);
    if (fica) return { ok: false, porque: fica, daEquipa: true };
    estado.cancelados.push(pedidoId);
    return { ok: true, encerradas: 2, conversaApagada: true };
  }),
}));

import { responderAoLembreteDoOrcamento, tentarOVaiPensar, tratarOCancelamentoPeloCliente } from "./whatsapp-negociacao";
import { respostaAoVaiPensar } from "./o-cliente-vai-pensar";
import { PASSO_O_CANCELAMENTO_A_EQUIPA } from "./cancelar-pelo-cliente";
import { textoDaConfirmacaoDoCancelamento } from "./validade-do-orcamento";

const TEL = "351910000001";

beforeEach(() => {
  estado.enviados = [];
  estado.passadas = [];
  estado.arranques = [];
  estado.arrancaOk = true;
  estado.abertos = [812];
  estado.pedido = { ...estado.pedido, status: "enviado", contratado: false, dataMarcada: false, pago: false, referenciaViva: false, faturado: false };
  estado.cancelados = [];
  estado.historico = [];
  estado.ordem = [];
});
afterEach(() => vi.clearAllMocks());

describe("d90 — «vou pensar» à proposta: a Vitória responde e o seguimento arranca sozinho", () => {
  it("«Vou pensar» → a resposta delicada, o seguimento («vai_pensar») e nada passa à equipa", async () => {
    expect(await tentarOVaiPensar(TEL, "Vou pensar, obrigada", 812)).toBe(true);
    expect(estado.arranques).toEqual([{ pedidoId: 812, porque: "vai_pensar" }]);
    expect(estado.enviados).toEqual([respostaAoVaiPensar("depois")]);
    expect(estado.passadas).toEqual([]);
  });

  it("«Estou a aguardar orçamentos de outras empresas» → «Faz bem em comparar.»", async () => {
    expect(await tentarOVaiPensar(TEL, "Estou a aguardar orçamentos de outras empresas", 812)).toBe(true);
    expect(estado.enviados[0]).toMatch(/^Faz bem em comparar\./);
  });

  it("o seguimento não arranca (já correu neste pedido) → a mesma resposta, e a conversa passa à equipa", async () => {
    estado.arrancaOk = false;
    expect(await tentarOVaiPensar(TEL, "Depois digo", 812)).toBe(true);
    expect(estado.enviados).toEqual([respostaAoVaiPensar("depois")]);
    expect(estado.passadas[0].porque).toMatch(/#812: o cliente disse que ia pensar — sem seguimento automático/);
  });

  it("contraproposta, queixa e «quero falar com alguém» não são «vou pensar»: nada se faz aqui", async () => {
    for (const t of ["Vou pensar, mas por 80 € fechava", "Vou pensar, está muito caro", "Vou pensar, quero falar com alguém"]) {
      expect(await tentarOVaiPensar(TEL, t, 812), t).toBe(false);
    }
    expect(estado.arranques).toEqual([]);
    expect(estado.enviados).toEqual([]);
  });

  it("ao lembrete do orçamento (d62): «vou pensar» arranca o seguimento em vez de passar à equipa", async () => {
    await responderAoLembreteDoOrcamento(TEL, "Ainda não decidi, depois digo", [
      { pedidoId: 812, negociacaoId: 5, eClyon: false, valorUnico: false, parceiro: null, aEsperaDeCancelar: false },
    ]);
    expect(estado.arranques).toEqual([{ pedidoId: 812, porque: "vai_pensar" }]);
    expect(estado.passadas).toEqual([]);
  });
});

describe("d93 — o cliente cancela pela conversa", () => {
  it("frase clara → cancela logo (anonimizado + não contactar, no caminho da base), sem passar à equipa", async () => {
    expect(await tratarOCancelamentoPeloCliente(TEL, "Já não preciso, cancelem")).toBe(true);
    expect(estado.cancelados).toEqual([812]);
    expect(estado.passadas).toEqual([]);
  });

  it("frase ambígua → pergunta o CANCELAR; o CANCELAR a seguir cancela", async () => {
    expect(await tratarOCancelamentoPeloCliente(TEL, "Se calhar já não")).toBe(true);
    expect(estado.enviados).toEqual([textoDaConfirmacaoDoCancelamento(812)]);
    expect(estado.cancelados).toEqual([]);
    expect(estado.historico.some((h) => h.includes("perguntámos se confirma"))).toBe(true);
    expect(await tratarOCancelamentoPeloCliente(TEL, "CANCELAR")).toBe(true);
    expect(estado.cancelados).toEqual([812]);
  });

  it("o CANCELAR sem a pergunta feita não cancela: pergunta", async () => {
    expect(await tratarOCancelamentoPeloCliente(TEL, "Cancelar")).toBe(true);
    expect(estado.cancelados).toEqual([]);
    expect(estado.enviados.at(-1)).toBe(textoDaConfirmacaoDoCancelamento(812));
  });

  it("trabalho contratado (ou pago, ou com data) → a equipa, com a frase de quem quer cancelar", async () => {
    estado.pedido = { ...estado.pedido, contratado: true };
    expect(await tratarOCancelamentoPeloCliente(TEL, "Quero cancelar o pedido")).toBe(true);
    expect(estado.cancelados).toEqual([]);
    expect(estado.enviados).toEqual([PASSO_O_CANCELAMENTO_A_EQUIPA]);
    expect(estado.passadas[0].porque).toMatch(/#812: o cliente quer cancelar, mas o trabalho já está contratado/);
  });

  it("dois pedidos abertos sem dizer qual → a equipa confirma; com o «#N», cancela esse", async () => {
    estado.abertos = [812, 790];
    expect(await tratarOCancelamentoPeloCliente(TEL, "Quero cancelar o pedido")).toBe(true);
    expect(estado.cancelados).toEqual([]);
    expect(estado.passadas[0].porque).toMatch(/2 pedidos abertos/);
    expect(await tratarOCancelamentoPeloCliente(TEL, "Quero cancelar o pedido #790")).toBe(true);
    expect(estado.cancelados).toEqual([790]);
  });

  it("sem pedido aberto, ou sem falar em cancelar: não é daqui", async () => {
    expect(await tratarOCancelamentoPeloCliente(TEL, "Quando vem o parceiro?")).toBe(false);
    estado.abertos = [];
    expect(await tratarOCancelamentoPeloCliente(TEL, "Quero cancelar o pedido")).toBe(false);
  });
});
