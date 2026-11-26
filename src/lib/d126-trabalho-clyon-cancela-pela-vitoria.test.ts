import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * d126, continuação (CEO e dono, 26-11-2026) — um Trabalho CLYON «valor fixo»
 * com cinco parceiros que ACEITARAM, a proposta enviada ao cliente e o
 * seguimento a correr. O cliente diz que não quer; a Vitória pergunta o
 * CANCELAR; o cliente responde CANCELAR. Antes, a guarda do agente («é um
 * Trabalho CLYON») passava a conversa à equipa e nada se cancelava.
 *
 * Agora: cancela pelo caminho de sempre (`cancelarEApagarNaHora` →
 * `cancelarPedido` → `fimDoPedido`), avisa os parceiros como no cancelamento
 * dos Trabalhos CLYON, pára o seguimento e manda a mensagem da d126. Só o
 * dinheiro ou o contratado passam à equipa — e então a mensagem diz porquê e
 * o cartão mostra o motivo. Base fingida; nada sai a ninguém. Números
 * INVENTADOS.
 */

const PEDIDO = 901;
const TELEFONE = "351910000009";

const e = vi.hoisted(() => ({
  ordem: [] as string[],
  enviados: [] as Array<{ para: string; texto: string }>,
  avisadosClyon: [] as Array<{ pedidoId: number; quem: unknown[] }>,
  contratado: false,
  pago: false,
}));

const ACEITARAM = vi.hoisted(() =>
  [41, 42, 43, 44, 45].map((providerId, i) => ({
    negociacaoId: 70 + i,
    providerId,
    profissional: `Parceiro ${i + 1}`,
    telefone: null,
    eraDele: false,
    avisaPorWhatsApp: false,
  })),
);

const pool = vi.hoisted(() => ({
  query: async (sql: string) => pool.execute(sql),
  execute: async (sql: string): Promise<[unknown, unknown]> => {
    if (/FROM simulatorOrders o WHERE o\.id = \?/.test(sql))
      return [
        [
          {
            id: 901,
            status: "propostas_enviadas",
            anonimizadoEm: null,
            contactPhone: "351910000009",
            contactEmail: null,
            valorFixoClyon: "450.00",
            serviceType: "esvaziamento",
            city: "Lisboa",
            scheduledDate: null,
            dataAgendada: null,
          },
        ],
        [],
      ];
    // O contratado: só uma negociação acordada (ou confirmada, entregue, paga) — o «aceitou» não é.
    if (/FROM negociacoes n/.test(sql)) return [e.contratado ? [{ x: 1 }] : [], []];
    if (/FROM pagamentos WHERE pedidoId = \? AND \(estado = 'pago'/.test(sql)) return [e.pago ? [{ x: 1 }] : [], []];
    if (/SELECT id, status, contactPhone FROM simulatorOrders/.test(sql)) return [[], []];
    if (/UPDATE vitoriaCancelamentos SET canceladoEm = UTC_TIMESTAMP\(\)/.test(sql)) return [{ affectedRows: 1 }, []];
    return [[], []];
  },
}));

vi.mock("./db", async (original) => ({
  ...(await original<typeof import("./db")>()),
  getPool: vi.fn(async () => pool),
  ensureSimulatorOrdersTable: vi.fn(async () => {}),
  ensureNegociacoesTable: vi.fn(async () => {}),
  getSimulatorOrderById: vi.fn(async () => ({ id: 901, status: "propostas_enviadas", serviceType: "esvaziamento", city: "Lisboa", dataAgendada: null })),
  // Os cinco aceitaram a oferta da CLYON (aguarda_contratacao), ninguém contratado.
  negociacoesDoPedido: vi.fn(async () =>
    [41, 42, 43, 44, 45].map((providerId, i) => ({ id: 70 + i, providerId, estado: "aguarda_contratacao", ofertaClyon: "distribuida" })),
  ),
  quemTemOTrabalhoClyon: vi.fn(async () => ({ eClyon: true, jaFeito: false, vivos: ACEITARAM })),
  cancelarPedido: vi.fn(async () => {
    e.ordem.push("cancelar");
    return { encerradas: 5 };
  }),
  gravarMotivoDoFecho: vi.fn(async () => {}),
  appendOrderHistory: vi.fn(async () => {}),
  registarSemFalhar: vi.fn(async () => {}),
  apagarConversaWhatsApp: vi.fn(async () => {
    e.ordem.push("apagar-conversa");
    return 1;
  }),
}));
vi.mock("./vitoria-agente/na-base", () => ({ garantirTabelas: vi.fn(async () => pool), registarAccao: vi.fn(async () => {}) }));
vi.mock("./whatsapp-negociacao", () => ({ pedidosDoTelefone: vi.fn(async () => [901]) }));
vi.mock("./avisar-trabalho-clyon", () => ({
  avisarCancelamentoDoTrabalhoClyon: vi.fn(async (a: { pedidoId: number; quem: unknown[] }) => {
    e.ordem.push("avisar-parceiros-clyon");
    e.avisadosClyon.push({ pedidoId: a.pedidoId, quem: a.quem });
    return a.quem.length;
  }),
}));
vi.mock("./avisar-cancelamento", () => ({
  avisarDoCancelamento: vi.fn(async () => {
    e.ordem.push("avisar-como-na-mesa");
  }),
}));
vi.mock("./validade-do-orcamento-na-base", () => ({ marcarCicloTerminado: vi.fn(async () => {}) }));
vi.mock("./seguimento-do-cliente-na-base", () => ({
  pararSeguimento: vi.fn(async () => {
    e.ordem.push("parar-seguimento");
    return true;
  }),
}));
vi.mock("./whatsapp-cloud", () => ({
  enviarTextoWhatsApp: vi.fn(async (para: string, texto: string) => {
    e.ordem.push("mensagem");
    e.enviados.push({ para, texto });
    return true;
  }),
}));
vi.mock("./porque-cancelou-na-base", () => ({ registarAPerguntaDoPorque: vi.fn(async () => {}) }));
vi.mock("./nao-contactar", () => ({
  marcarParaNaoContactar: vi.fn(async () => {
    e.ordem.push("nao-contactar");
    return true;
  }),
  marcarEmailParaNaoContactar: vi.fn(async () => true),
}));
vi.mock("./regras-novas-na-base", () => ({
  anonimizarPedido: vi.fn(async (id: number) => {
    e.ordem.push("anonimizar");
    return { pedidoId: id };
  }),
}));

import { cancelarPeloCancelarDoAgente } from "./vitoria-agente/accoes-na-base";
import { responderAoVivo, type DependenciasAoVivo } from "./vitoria-agente/ao-vivo";
import { mensagemDepoisDeCancelar } from "./porque-cancelou";
import { passoOCancelamentoAEquipa } from "./cancelar-pelo-cliente";
import { MENSAGEM_DE_PASSAR_A_UMA_PESSOA } from "./voz-da-vitoria";

beforeEach(() => {
  e.ordem = [];
  e.enviados = [];
  e.avisadosClyon = [];
  e.contratado = false;
  e.pago = false;
});

describe("d126 — o CANCELAR à Vitória num Trabalho CLYON com parceiros que só aceitaram", { timeout: 30_000 }, () => {
  it("cancela pelo caminho de sempre, avisa os cinco como nos Trabalhos CLYON, pára o seguimento e manda a mensagem da d126", async () => {
    const r = await cancelarPeloCancelarDoAgente(PEDIDO, TELEFONE);
    expect(r).toEqual({ ok: true });
    expect(e.ordem).toEqual(["cancelar", "avisar-parceiros-clyon", "parar-seguimento", "mensagem", "nao-contactar", "anonimizar", "apagar-conversa"]);
    expect(e.avisadosClyon).toEqual([{ pedidoId: PEDIDO, quem: ACEITARAM }]);
    expect(e.enviados).toEqual([{ para: TELEFONE, texto: mensagemDepoisDeCancelar([PEDIDO], { dados: "apagados" }) }]);
    expect(e.enviados[0].texto).not.toBe(MENSAGEM_DE_PASSAR_A_UMA_PESSOA);
  });

  it("com o trabalho contratado, ou com um pagamento, não cancela: fica com a equipa, com o porquê", async () => {
    for (const marca of ["contratado", "pago"] as const) {
      e.ordem = [];
      e.contratado = marca === "contratado";
      e.pago = marca === "pago";
      const r = await cancelarPeloCancelarDoAgente(PEDIDO, TELEFONE);
      expect(r.ok, marca).toBe(false);
      expect(!r.ok && r.daEquipa, marca).toBe(true);
      expect(!r.ok && r.porque, marca).toMatch(marca === "contratado" ? /contratado/ : /pagamento/);
      expect(e.ordem, marca).toEqual([]);
    }
  });
});

describe("d126 — a conversa: o que o cliente ouve e o que fica no cartão", { timeout: 30_000 }, () => {
  const conversa = (cancelar: DependenciasAoVivo["cancelarPeloCancelar"]) => {
    const passadas: Array<{ motivo: string; mensagem: string | null }> = [];
    const deps: DependenciasAoVivo = {
      agora: new Date("2026-11-25T20:49:00Z"),
      interruptores: async () => ({ conversa: true, aceitar: true }),
      situacao: async () => ({ interrompida: false, temPedidos: true, recolhaEmCurso: false }) as never,
      regras: async () => {},
      pendente: async () => ({ tipo: "cancelar", pedidoId: PEDIDO, propostoEm: "2026-11-25T20:46:30Z" }),
      acabarPendente: async () => {},
      gravarPendente: async () => {},
      propostasParaEscolher: async () => [],
      fecharPeloBotao: async () => {},
      cancelarPeloCancelar: cancelar,
      marcarPerguntaDoCancelar: async () => {},
      correrOAgente: async () => {
        throw new Error("o agente não devia correr: o CANCELAR é do código");
      },
      perguntarAoParceiro: async () => ({ ok: false, porque: "x" }),
      enviar: async () => true,
      passarAEquipa: async (motivo, mensagem) => {
        passadas.push({ motivo, mensagem });
      },
      registar: async () => {},
    };
    return { deps, passadas };
  };

  it("o CANCELAR cancela pelo código, sem passar a uma pessoa", async () => {
    const { deps, passadas } = conversa(async (id) => cancelarPeloCancelarDoAgente(id, TELEFONE));
    expect(await responderAoVivo({ tipo: "texto", texto: "CANCELAR" }, deps)).toBe("codigo");
    expect(passadas).toEqual([]);
    expect(e.ordem).toContain("cancelar");
  });

  it("com o contratado, a mensagem diz porquê e o cartão mostra o motivo", async () => {
    e.contratado = true;
    const { deps, passadas } = conversa(async (id) => cancelarPeloCancelarDoAgente(id, TELEFONE));
    await responderAoVivo({ tipo: "texto", texto: "CANCELAR" }, deps);
    expect(passadas).toHaveLength(1);
    expect(passadas[0].motivo).toBe(`Pedido #${PEDIDO}: respondeu CANCELAR à Vitória, mas o trabalho já está contratado — tratar à mão`);
    expect(passadas[0].mensagem).toBe(passoOCancelamentoAEquipa(PEDIDO, "o trabalho já está contratado"));
    expect(passadas[0].mensagem).toContain("já tem um trabalho combinado com um parceiro");
  });

  it("uma falha que não é das excepções passa com a frase de sempre", async () => {
    const { deps, passadas } = conversa(async () => ({ ok: false, porque: "não há pergunta do CANCELAR a valer para este pedido" }));
    await responderAoVivo({ tipo: "texto", texto: "CANCELAR" }, deps);
    expect(passadas[0].mensagem).toBe(MENSAGEM_DE_PASSAR_A_UMA_PESSOA);
    expect(passadas[0].motivo).toContain("cancelar à mão");
  });
});
