import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  avisoDaReservaQueCaiu,
  faltaOSimDoCliente,
  FALTA_O_SIM_DO_CLIENTE,
  lerSimDoCliente,
  marcaDaReserva,
  RECUSA_SEM_O_SIM_DO_CLIENTE,
} from "./sim-do-cliente";

/**
 * d130 (dono, 26-11-2026; o #652) — O SIM DO CLIENTE ANTES DE ATRIBUIR.
 *
 * Num Trabalho CLYON de valor fixo, atribuir (ou escolher) sem o sim do
 * cliente avisa «O cliente ainda não aceitou este valor.», com duas escolhas:
 * reservar o parceiro até ao sim, ou atribuir já com o sim dado por telefone.
 * A base finge-se aqui; as rotas e o ecrã lêem-se pelo código.
 */

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\r\n/g, "\n");

const estado = vi.hoisted(() => ({
  reservas: new Map<number, Record<string, unknown>>(),
  historico: [] as Array<{ pedidoId: number; message: string }>,
  pedido: { id: 652, valorFixoClyon: "195.00", serviceType: "mudanca", city: "Lisboa", propostaEnviadaEm: new Date("2026-11-26T10:00:00Z"), precoAceiteEm: null } as Record<string, unknown>,
  atribuidos: [] as Array<Record<string, unknown>>,
  escolhidas: [] as number[],
  avisos: [] as Array<{ telefone: string; texto: string }>,
  ofertaOk: true,
}));

vi.mock("./db", () => {
  const pool = {
    execute: vi.fn(async (sql: string, p: unknown[] = []) => {
      if (/CREATE TABLE/.test(sql)) return [[], []];
      if (/^\s*REPLACE INTO reservasDoValorFixo/.test(sql)) {
        const [pedidoId, tipo, providerId, negociacaoId, , porNome, semGuia] = p as [number, string, number | null, number | null, number | null, string | null, number];
        estado.reservas.set(Number(pedidoId), { pedidoId, tipo, providerId, negociacaoId, porNome, semGuiaConfirmado: semGuia, criadaEm: new Date() });
        return [{ affectedRows: 1 }, []];
      }
      if (/FROM reservasDoValorFixo r/.test(sql)) {
        const ids = (p as number[]).map(Number);
        const linhas = ids
          .map((id) => estado.reservas.get(id))
          .filter(Boolean)
          .map((l) => ({ ...l, profissional: "Jorge Mudança", telefone: "912345678" }));
        return [linhas, []];
      }
      if (/^\s*DELETE FROM reservasDoValorFixo/.test(sql)) {
        const [pedidoId, tipo] = p as [number, string];
        const l = estado.reservas.get(Number(pedidoId));
        if (l && l.tipo === tipo) {
          estado.reservas.delete(Number(pedidoId));
          return [{ affectedRows: 1 }, []];
        }
        return [{ affectedRows: 0 }, []];
      }
      return [[], []];
    }),
  };
  return {
    getPool: vi.fn(async () => pool),
    getSimulatorOrderById: vi.fn(async () => estado.pedido),
    appendOrderHistory: vi.fn(async (pedidoId: number, h: { message: string }) => {
      estado.historico.push({ pedidoId, message: h.message });
    }),
    aceitarPrecoClyon: vi.fn(async () => true),
    marcarPropostaEnviada: vi.fn(async () => {}),
    assistentePode: vi.fn(async () => true),
    registarSemFalhar: vi.fn(async () => {}),
    atribuirOfertaClyon: vi.fn(async (negociacaoId: number) => {
      estado.escolhidas.push(negociacaoId);
      return estado.ofertaOk ? { ok: true, pedidoId: 652, providerId: 7, encerradas: 1 } : { ok: false, porque: "nao_aceitou" };
    }),
  };
});
vi.mock("./atribuir-directamente", () => ({
  atribuirDirectamente: vi.fn(async (a: Record<string, unknown>) => {
    estado.atribuidos.push(a);
    return { ok: true, feito: "Atribuído pela CLYON a Jorge Mudança.", negociacaoId: 99, profissional: "Jorge Mudança", avisado: true };
  }),
}));
vi.mock("./avisar-escolhido-da-oferta", () => ({
  avisarProfissionalEscolhido: vi.fn(async () => ({ saiu: true, profissional: "Jorge Mudança", valor: 160, valorDoTrabalho: 195 })),
}));
vi.mock("./avisos-ao-cliente", () => ({ avisarOClienteDoPedido: vi.fn(async () => {}) }));
vi.mock("./whatsapp-cloud", () => ({
  telemovelParaWhatsApp: (t: string | null) => (t ? `351${t}` : null),
  enviarAvisoWhatsApp: vi.fn(async (telefone: string, texto: string) => {
    estado.avisos.push({ telefone, texto });
    return true;
  }),
}));

const quem = { quem: "Wanderson", por: { id: 1, nome: "Wanderson", role: "admin" }, baseUrl: "https://exemplo.test" };

beforeEach(() => {
  estado.reservas.clear();
  estado.historico = [];
  estado.atribuidos = [];
  estado.escolhidas = [];
  estado.avisos = [];
  estado.ofertaOk = true;
});

describe("atribuir sem o sim do cliente avisa", () => {
  it("a regra e a frase", () => {
    expect(faltaOSimDoCliente({ valorFixoClyon: "195.00", precoAceiteEm: null })).toBe(true);
    expect(faltaOSimDoCliente({ valorFixoClyon: "195.00", precoAceiteEm: new Date() })).toBe(false);
    // Só o valor fixo: uma negociação não pede este sim.
    expect(faltaOSimDoCliente({ valorFixoClyon: null, precoAceiteEm: null })).toBe(false);
    expect(FALTA_O_SIM_DO_CLIENTE).toBe("O cliente ainda não aceitou este valor.");
    expect(RECUSA_SEM_O_SIM_DO_CLIENTE).toEqual({ error: FALTA_O_SIM_DO_CLIENTE, faltaOSimDoCliente: true });
    expect(lerSimDoCliente("reservar")).toBe("reservar");
    expect(lerSimDoCliente("telefone")).toBe("telefone");
    expect(lerSimDoCliente("sim")).toBeNull();
  });

  it("as três portas (atribuir, escolher, criar já atribuído) recusam sem escolha, antes de atribuir", () => {
    const R = ler("src/app/api/admin/trabalhos-clyon/route.ts");
    const bloco = R.slice(R.indexOf('if (accao === "atribuir") {'), R.indexOf("// ── O valor e a taxa"));
    expect(bloco.indexOf("faltaOSimDoCliente(doPedido)")).toBeGreaterThan(0);
    expect(bloco.indexOf("RECUSA_SEM_O_SIM_DO_CLIENTE")).toBeLessThan(bloco.indexOf("await atribuirDirectamente("));
    expect(bloco).toContain('simDoCliente === "reservar"');
    expect(bloco).toContain("registarOSimPorTelefone(pedidoId, { quem, por })");
    const criar = R.slice(R.indexOf("if (atribuirA != null) {"), R.indexOf("await marcarPedidoComoOfertaClyon(pedidoId, valor.valor, valor.valor, taxa.taxa, baseEscolhida, motivoDaTaxa.motivo);\n\n"));
    expect(criar).toContain("if (!simDoCliente) return NextResponse.json(RECUSA_SEM_O_SIM_DO_CLIENTE, { status: 409 });");
    const E = ler("src/app/api/admin/trabalhos-clyon/escolher/route.ts");
    expect(E.indexOf("RECUSA_SEM_O_SIM_DO_CLIENTE, { status: 409 }")).toBeLessThan(E.indexOf("const r = await atribuirOfertaClyon(negociacaoId);"));
  });

  it("o cartão abre a janela das duas escolhas em vez de atribuir", () => {
    const TC = ler("src/components/admin/TrabalhoClyon.tsx");
    expect(TC).toContain('setSemOSim({ tipo: "escolher", n });');
    expect(TC).toContain('setSemOSim({ tipo: "atribuir", providerId, nome: nome || `o parceiro #${providerId}` });');
    expect(TC).toContain("<JanelaDoSimDoCliente");
    const J = ler("src/components/admin/JanelaDoSimDoCliente.tsx");
    expect(J).toContain("{FALTA_O_SIM_DO_CLIENTE}");
    expect(J).toContain("{ESCOLHA_RESERVAR}");
    expect(J).toContain("{ESCOLHA_ATRIBUIR_JA}");
    expect(ler("src/lib/sim-do-cliente.ts")).toContain('"Enviar o valor ao cliente e atribuir quando aceitar"');
    expect(ler("src/lib/sim-do-cliente.ts")).toContain('"Atribuir já (o cliente aceitou por telefone)"');
    // Reservar abre a proposta de sempre e marca-a enviada.
    expect(TC).toContain('body: JSON.stringify({ pedidoId: t.pedidoId, accao: "proposta_aberta" })');
    // A oferta nova também pergunta.
    expect(ler("src/components/admin/FormularioDaOferta.tsx")).toContain('if (modo === "atribuir" && !sim) {');
  });
});

describe("a reserva vira atribuição com o sim", () => {
  it("reservado por «Atribuir directamente»: o sim atribui-lhe o trabalho, e a reserva sai", async () => {
    const b = await import("./sim-do-cliente-na-base");
    await b.gravarReserva({ pedidoId: 652, tipo: "reserva", providerId: 7, por: { id: 1, nome: "Wanderson" } });
    expect((await b.reservaDoPedido(652))?.tipo).toBe("reserva");
    expect(marcaDaReserva({ tipo: "reserva", profissional: "Jorge Mudança" })).toBe("Jorge Mudança reservado — à espera do sim do cliente");

    const d = await b.depoisDoSimDoCliente(652, quem);
    expect(d.atribuido).toBe(true);
    expect(estado.atribuidos).toHaveLength(1);
    expect(estado.atribuidos[0]).toMatchObject({ pedidoId: 652, providerId: 7, semGuiaConfirmado: true });
    expect(estado.reservas.has(652)).toBe(false);
    // Uma segunda resposta já não atribui outra vez.
    await b.depoisDoSimDoCliente(652, quem);
    expect(estado.atribuidos).toHaveLength(1);
  });

  it("reservado por «Escolher» (aceitou a oferta): a escolha de sempre, com o aviso ao escolhido", async () => {
    const b = await import("./sim-do-cliente-na-base");
    await b.gravarReserva({ pedidoId: 652, tipo: "reserva", providerId: 7, negociacaoId: 41, por: { id: 1, nome: "Wanderson" } });
    const d = await b.depoisDoSimDoCliente(652, quem);
    expect(d.atribuido).toBe(true);
    expect(estado.escolhidas).toEqual([41]);
    expect(estado.atribuidos).toHaveLength(0);
    expect(estado.historico.some((h) => h.message.includes("a reserva fez-se"))).toBe(true);
  });

  it("todos os caminhos do sim chamam a reserva: o «por telefone», a app e o «1» da Vitória", () => {
    const R = ler("src/app/api/admin/trabalhos-clyon/route.ts");
    const aceitou = R.slice(R.indexOf('if (accao === "cliente_aceitou") {'), R.indexOf('if (accao === "pedir_sim") {'));
    expect(aceitou).toContain("depoisDoSimDoCliente(pedidoId,");
    expect(ler("src/lib/agir-como-cliente.ts")).toContain("simDoCliente.depoisDoSimDoCliente(pedidoId,");
    expect(ler("src/lib/validade-do-orcamento-na-base.ts")).toContain("sim.depoisDoSimDoCliente(pedidoId,");
  });
});

describe("a recusa liberta a reserva e avisa o parceiro", () => {
  it("o cliente não aceitou: a reserva cai e ele recebe o WhatsApp, sem dados do cliente", async () => {
    const b = await import("./sim-do-cliente-na-base");
    await b.gravarReserva({ pedidoId: 652, tipo: "reserva", providerId: 7, por: { id: 1, nome: "Wanderson" } });
    const r = await b.largarAReserva(652, "recusou", { quem: "Wanderson", por: null });
    expect(r).toMatchObject({ caiu: true, avisado: true });
    expect(estado.reservas.has(652)).toBe(false);
    expect(estado.avisos).toHaveLength(1);
    expect(estado.avisos[0].telefone).toBe("351912345678");
    expect(estado.avisos[0].texto).toContain("(#652) que tínhamos reservado consigo não avança: o cliente não aceitou o valor.");
    expect(estado.historico.some((h) => h.message.includes("A reserva de Jorge Mudança caiu"))).toBe(true);
    // E o sim que chegue depois já não atribui.
    await b.depoisDoSimDoCliente(652, quem);
    expect(estado.atribuidos).toHaveLength(0);
  });

  it("cancelar o pedido (por qualquer porta) larga a reserva com o aviso", () => {
    const D = ler("src/lib/db.ts");
    const c = D.slice(D.indexOf("export async function cancelarPedido("), D.indexOf("export async function fecharPagamentosAbertosDoPedido("));
    expect(c).toContain('await largarAReserva(pedidoId, "cancelado", { quem: null, por: null });');
    const texto = avisoDaReservaQueCaiu("Jorge", { pedidoId: 652, servico: "mudanca", localidade: "Lisboa", porque: "cancelado" }, new Date("2026-11-26T10:00:00Z"));
    expect(texto).toContain("o pedido foi cancelado");
    expect(texto).not.toMatch(/\d{9}/);
  });

  it("o cartão tem «O cliente não aceitou», que vai à rota", () => {
    expect(ler("src/components/admin/TrabalhoClyon.tsx")).toContain('void mexer({ accao: "reserva_recusada" }');
    expect(ler("src/app/api/admin/trabalhos-clyon/route.ts")).toContain('largarAReserva(pedidoId, "recusou", { quem, por })');
  });
});

describe("o já atribuído sem o sim pede o sim", () => {
  it("«Pedir o sim do cliente» marca «falta o sim»; com o sim a marca sai, sem atribuir outra vez", async () => {
    const b = await import("./sim-do-cliente-na-base");
    await b.gravarReserva({ pedidoId: 652, tipo: "falta_o_sim", providerId: 7, por: { id: 1, nome: "Wanderson" } });
    expect(marcaDaReserva({ tipo: "falta_o_sim", profissional: null })).toBe("atribuído — falta o sim do cliente");
    const d = await b.depoisDoSimDoCliente(652, quem);
    expect(d.atribuido).toBe(false);
    expect(d.frase).toContain("o trabalho segue com Jorge Mudança");
    expect(estado.atribuidos).toHaveLength(0);
    expect(estado.reservas.has(652)).toBe(false);
  });

  it("um «falta o sim» que cai no cancelamento não manda o aviso da reserva (o cancelamento já avisa quem o tem)", async () => {
    const b = await import("./sim-do-cliente-na-base");
    await b.gravarReserva({ pedidoId: 652, tipo: "falta_o_sim", providerId: 7, por: null });
    const r = await b.largarAReserva(652, "cancelado", { quem: null, por: null });
    expect(r.caiu).toBe(true);
    expect(estado.avisos).toHaveLength(0);
  });

  it("o cartão, a rota e a app: o botão, a marca, o «Cancelar e avisar o parceiro» e o «Aceito este preço»", () => {
    const TC = ler("src/components/admin/TrabalhoClyon.tsx");
    expect(TC).toContain("Pedir o sim do cliente");
    expect(TC).toContain("{maiuscula(MARCA_FALTA_O_SIM)}");
    expect(TC).toContain("Cancelar e avisar o parceiro");
    expect(TC).toContain('mexer({ accao: "pedir_sim" }');
    const R = ler("src/app/api/admin/trabalhos-clyon/route.ts");
    expect(R).toContain('await gravarReserva({ pedidoId, tipo: "falta_o_sim", providerId: comEle.providerId, negociacaoId: comEle.negociacaoId, por });');
    // A app deixa aceitar o preço num já atribuído com o sim pedido.
    expect(ler("src/lib/pedidos-do-cliente.ts")).toContain("faltaOSimDoCliente && enviadoEm && !cancelado");
    expect(ler("src/lib/agir-como-cliente.ts")).toContain("(comProfissional && !faltaOSim)");
  });
});
