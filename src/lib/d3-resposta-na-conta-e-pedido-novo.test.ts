import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * d3 (23-11-2026): a resposta ao «Pedir o que falta» dada na conta do site ou
 * na app faz o mesmo que no WhatsApp (d86); o pedido novo e completo segue
 * sozinho; o passo 3 do simulador diz o que falta.
 */

const pedidos = new Map<number, Record<string, unknown>>();
const historico: Array<{ id: number; type: string; message: string; by: unknown }> = [];
const actualizacoes: Array<{ id: number; data: Record<string, unknown> }> = [];
const seguir = vi.fn(async (_id: number, _o: unknown) => ({ estado: "na_fila" }));
const pool = { execute: vi.fn(async (_sql: string, _p?: unknown) => [{ affectedRows: 1 }, undefined]) };

vi.mock("@/lib/db", () => ({
  getPool: vi.fn(async () => pool),
  getSimulatorOrderById: vi.fn(async (id: number) => pedidos.get(id)),
  negociacoesDoPedido: vi.fn(async () => []),
  updateSimulatorOrder: vi.fn(async (id: number, data: Record<string, unknown>) => {
    actualizacoes.push({ id, data });
    Object.assign(pedidos.get(id)!, data);
  }),
  appendOrderHistory: vi.fn(async (id: number, e: { type: string; message: string; by: unknown }) => {
    historico.push({ id, ...e });
  }),
}));
vi.mock("@/lib/descricao-do-pedido-na-base", () => ({
  juntarAConversaNaDescricao: vi.fn(async () => ({ fontesMudaram: false, porTraduzir: false, mudou: false })),
  depoisDaResposta: vi.fn(async (t: () => Promise<unknown>) => void (await t())),
  reescreverADescricao: vi.fn(async () => {}),
}));
vi.mock("@/lib/envio-automatico-aos-parceiros-na-base", () => ({
  seguirSozinhoParaOsParceiros: (id: number, o: unknown) => seguir(id, o),
  ORIGEM_DOS_ORCAMENTOS_NOVOS: "orcamentos_novos",
}));
vi.mock("@/lib/avisos-ao-cliente", () => ({ avisarOClienteDoPedido: vi.fn(async () => {}) }));
vi.mock("@/lib/avisar-contacto-do-pedido", () => ({ avisarContactoDoPedido: vi.fn(async () => true) }));

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

function pedidoComOQueFalta(extra: Record<string, unknown> = {}) {
  return {
    id: 901,
    status: "precisa_info",
    serviceType: "recolha_moveis",
    contactName: "Cliente de Teste",
    address: "Rua de Teste 12, 1000-001 Lisboa",
    city: "Lisboa",
    postalCode: "1000-001",
    description: "Um sofá de três lugares e uma estante.",
    filesJson: JSON.stringify([{ url: "https://exemplo.test/a.jpg" }]),
    mensagemCliente:
      "Para enviar o seu pedido aos parceiros da sua zona, falta:\n- o andar\n- se há elevador\n- o estacionamento\n- quando precisa",
    rawOrderJson: "{}",
    ...extra,
  };
}

describe("d3 — a resposta na conta e na app", () => {
  beforeEach(() => {
    pedidos.clear();
    historico.length = 0;
    actualizacoes.length = 0;
    seguir.mockClear();
    pool.execute.mockClear();
  });

  it("grava o que ficou vazio e diz ao cliente o que ficou anotado", { timeout: 30_000 }, async () => {
    pedidos.set(901, pedidoComOQueFalta());
    const { aplicarARespostaAoQueFalta } = await import("./resposta-ao-que-falta-na-conta");
    const r = await aplicarARespostaAoQueFalta(
      901,
      "Estacionamento fácil, mesmo à porta.\n2.º andar, com elevador.",
      0,
      new Date("2026-11-23T10:00:00Z"),
    );
    expect(r.aplicada).toBe(true);
    const gravado = actualizacoes.reduce((a, x) => ({ ...a, ...x.data }), {} as Record<string, unknown>);
    expect(gravado.floor).toBeTruthy();
    expect(gravado.hasElevator).toBeTruthy();
    const msg = historico.find((h) => h.type === "message_to_client");
    expect(msg).toBeTruthy();
    expect(msg!.message).toMatch(/Ficou anotado no seu pedido #901/);
    expect(msg!.message).toMatch(/Estacionamento/);
    // A CLYON, nunca o nome de uma pessoa.
    expect((msg!.by as { nome: string }).nome).toBe("CLYON");
  });

  it("completo, sai de «precisa info» e segue pela mesma função do envio automático", { timeout: 30_000 }, async () => {
    pedidos.set(901, pedidoComOQueFalta());
    const { aplicarARespostaAoQueFalta } = await import("./resposta-ao-que-falta-na-conta");
    await aplicarARespostaAoQueFalta(
      901,
      "Estacionamento fácil, mesmo à porta.\n2.º andar, com elevador.\nPode ser na sexta-feira, dia 27, às 14h.",
      0,
      new Date("2026-11-23T10:00:00Z"),
    );
    const msg = historico.find((h) => h.type === "message_to_client")!;
    const saiu = pool.execute.mock.calls.some((c) => /UPDATE simulatorOrders SET status/.test(String(c[0])));
    if (saiu) {
      expect(seguir).toHaveBeenCalledWith(901, expect.objectContaining({ origem: "pedir_o_que_falta" }));
      expect(msg.message).toMatch(/segu|confere/i);
    } else {
      // Nunca calado: diz o que ainda falta.
      expect(msg.message).toMatch(/Ainda falta/);
    }
  });

  it("um pedido que não está à espera do «Pedir o que falta» fica como estava", async () => {
    pedidos.set(901, pedidoComOQueFalta({ mensagemCliente: "Pedido de informação enviado ao cliente: escrito à mão" }));
    const { aplicarARespostaAoQueFalta } = await import("./resposta-ao-que-falta-na-conta");
    expect((await aplicarARespostaAoQueFalta(901, "2.º andar", 0)).aplicada).toBe(false);
    pedidos.set(902, pedidoComOQueFalta({ id: 902, status: "sem_assistente" }));
    expect((await aplicarARespostaAoQueFalta(902, "2.º andar", 0)).aplicada).toBe(false);
    expect(historico.filter((h) => h.type === "message_to_client")).toHaveLength(0);
  });

  it("a conta e a app (responderAClyon) chamam-no; o WhatsApp usa a mesma função comum", () => {
    expect(ler("src/lib/conversa-com-a-clyon.ts")).toMatch(/aplicarARespostaAoQueFalta\(pedidoId, mensagem, fotografias\.length\)/);
    expect(ler("src/lib/whatsapp-negociacao.ts")).toMatch(/gravarARespostaAoQueFalta\(\{\s*canal: "whatsapp"/);
    expect(ler("src/lib/gravar-a-resposta-ao-que-falta.ts")).toMatch(/seguirSozinhoParaOsParceiros\(id, \{ origem: "pedir_o_que_falta"/);
  });
});

describe("d3 — o pedido novo segue sozinho", () => {
  it("o simulador (e a app) e o formulário da inicial chamam-no depois da resposta ao cliente", () => {
    expect(ler("src/app/api/simulador/pedido/route.ts")).toMatch(/after\(\(\) => seguirOPedidoNovo\(id\)\)/);
    expect(ler("src/app/api/hero-quote/route.ts")).toMatch(/after\(\(\) => seguirOPedidoNovo\(novoId\)\)/);
  });

  it("pela função das outras origens, com todas as condições (9h–20h, fila das 9h)", async () => {
    seguir.mockClear();
    const { seguirOPedidoNovo } = await import("./seguir-o-pedido-novo");
    await seguirOPedidoNovo(555);
    expect(seguir).toHaveBeenCalledWith(555, { origem: "orcamentos_novos", todasAsOrigens: true });
  });

  it("nunca lança: um erro deixa o pedido nos «por enviar»", async () => {
    seguir.mockRejectedValueOnce(new Error("sem base"));
    const { seguirOPedidoNovo } = await import("./seguir-o-pedido-novo");
    await expect(seguirOPedidoNovo(556)).resolves.toBeUndefined();
  });
});

describe("d3 — o passo 3 do simulador", () => {
  it("conta o que falta com a régua da Mesa, sem bloquear", async () => {
    const { oQueFaltaParaSeguirJa } = await import("./falta-para-seguir-no-simulador");
    const incompleto = oQueFaltaParaSeguirJa(
      {
        serviceType: "recolha_moveis",
        description: "Um sofá",
        receiver: { name: "Cliente" },
        address: { street: "Rua de Teste", streetNumber: "12", city: "Lisboa", postalCode: "1000-001" },
      },
      0,
    );
    expect(incompleto).toContain("fotografias");
    expect(incompleto.length).toBeGreaterThan(1);
    const completo = oQueFaltaParaSeguirJa(
      {
        serviceType: "recolha_moveis",
        description: "Um sofá de três lugares",
        receiver: { name: "Cliente" },
        address: { street: "Rua de Teste", streetNumber: "12", city: "Lisboa", postalCode: "1000-001" },
        floor: "2",
        hasElevator: "yes",
        parkingDistance: "door",
        urgency: "this_week",
      },
      2,
    );
    expect(completo).toEqual([]);
  });

  it("o ecrã mostra a frase, só informa, e vai ao servidor sem as fotografias", () => {
    const f = ler("src/app/simulador/SimulatorThreePhaseForm.tsx");
    expect(f).toMatch(/Para seguir já para os parceiros, falta: \{faltaParaSeguirJa\.join/);
    expect(f).toMatch(/\/api\/simulador\/o-que-falta/);
    // Não entra na lista que bloqueia o botão.
    expect(f).not.toMatch(/faltaNaFase3\.push\([^)]*faltaParaSeguirJa/);
    const rota = ler("src/app/api/simulador/o-que-falta/route.ts");
    expect(rota).toMatch(/limitarRotaPublica/);
    expect(rota).not.toMatch(/createSimulatorOrder|updateSimulatorOrder|appendOrderHistory/);
  });

  it("o ecrã final diz a verdade sobre quando segue", async () => {
    const { TRES_PASSOS_DEPOIS_DE_ENVIAR } = await import("./textos-do-pedido");
    const t = TRES_PASSOS_DEPOIS_DE_ENVIAR[0].texto;
    expect(t).toMatch(/segue sozinho/);
    expect(t).toMatch(/9h/);
    expect(t).not.toMatch(/pr[óo]prio dia|profissionais|contentor|big bag/i);
  });
});
