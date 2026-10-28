import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O TRABALHO NO TERRENO, PELA APP — fase 3 da CLYON Pro, 18-10-2026.
 *
 * «A caminho», «Cheguei» e o ajuste no local, chamados como a app os chama:
 * só o profissional do trabalho, só antes de o dar por feito, e o cliente
 * avisado por WhatsApp — menos nos trabalhos CLYON de valor fixo.
 */

const depois: Array<() => Promise<void>> = [];
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (fn: () => Promise<void>) => {
    depois.push(fn);
  },
}));
vi.mock("@/lib/sessao-activa-do-profissional", () => ({
  sessaoActivaDoProfissional: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  negociacaoNoTerreno: vi.fn(),
  registarEtapaNoTerreno: vi.fn(),
  gravarAjustes: vi.fn(),
  appendOrderHistory: vi.fn(async () => {}),
  registarSemFalhar: vi.fn(async () => {}),
  substituirTokenDoPedido: vi.fn(async () => {}),
  negociacoesDoProfissional: vi.fn(async () => []),
  registarExecucao: vi.fn(async () => true),
  getSimulatorOrderById: vi.fn(async () => null),
}));
vi.mock("@/lib/email-trabalho", () => ({ pedirConfirmacaoAoCliente: vi.fn(async () => {}) }));
vi.mock("@/lib/avisar-por-push", () => ({ avisarClienteDoTrabalhoFeitoPorPush: vi.fn(async () => {}) }));
vi.mock("@/lib/whatsapp-cloud", () => ({
  enviarAvisoWhatsApp: vi.fn(async () => true),
  telemovelParaWhatsApp: (t: string | null) => (t ? `351${t.replace(/\D/g, "").slice(-9)}` : null),
}));
vi.mock("@/lib/webpush", () => ({ sendPushToUser: vi.fn(async () => {}) }));
// O prazo de 8 s, encurtado para o teste do WhatsApp lento não esperar 8 s a sério.
vi.mock("@/lib/avisos-do-terreno", async (original) => ({
  ...(await original<typeof import("./avisos-do-terreno")>()),
  PRAZO_DO_WHATSAPP_DA_ETAPA_MS: 40,
}));

import * as db from "@/lib/db";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { enviarAvisoWhatsApp } from "@/lib/whatsapp-cloud";
import { sendPushToUser } from "@/lib/webpush";
import { POST as etapa } from "@/app/api/profissionais/trabalho/etapa/route";
import { POST as pedir, DELETE as retirar } from "@/app/api/profissionais/trabalho/ajuste/route";
import { POST as estaFeito } from "@/app/api/profissionais/trabalho/route";
import { avisarClienteDaEtapa, avisarClienteDoAjuste, textoDoPedidoDeAjuste } from "./avisos-do-terreno";
import type { NegociacaoNoTerreno } from "./db";
import type { Ajuste } from "./ajuste-no-local";

const FOTO = "https://abc.public.blob.vercel-storage.com/trabalhos/31/f.jpg";

const N = (o: Partial<NegociacaoNoTerreno> = {}): NegociacaoNoTerreno => ({
  id: 31,
  pedidoId: 400,
  providerId: 7,
  estado: "acordada",
  valorAcordado: "100.00",
  ajustesJson: null,
  execucaoEnviadaEm: null,
  confirmadoEm: null,
  pagoEm: null,
  formaDePagamento: "transferencia",
  taxaCliente: "0.05",
  taxaProfissional: "0.06",
  createdAt: new Date("2026-10-15T10:00:00.000Z"),
  ofertaClyon: null,
  profissionalNome: "Rui Silva",
  profissionalEmail: "rui@exemplo.pt",
  profissionalTelefone: "912345678",
  contactName: "Ana Costa",
  contactEmail: "ana@exemplo.pt",
  contactPhone: "960000567",
  serviceType: "entulho",
  baseDoPreco: null,
  valorFixoClyon: null,
  ...o,
});

const pedido = (url: string, corpo: unknown, method = "POST") =>
  new NextRequest(`https://clyon.pt${url}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: "Bearer x" },
    body: JSON.stringify(corpo),
  });

async function correrDepois() {
  while (depois.length) await depois.shift()!();
}

beforeEach(() => {
  vi.clearAllMocks();
  depois.length = 0;
  vi.mocked(sessaoActivaDoProfissional).mockResolvedValue({ providerId: 7, nome: "Rui Silva" } as never);
  vi.mocked(db.negociacaoNoTerreno).mockResolvedValue(N());
  vi.mocked(db.registarEtapaNoTerreno).mockResolvedValue(true);
  vi.mocked(db.gravarAjustes).mockResolvedValue(true);
});

describe("«a caminho» e «cheguei»", () => {
  it("sem sessão, 401", async () => {
    vi.mocked(sessaoActivaDoProfissional).mockResolvedValue(null);
    expect((await etapa(pedido("/api/profissionais/trabalho/etapa", { negociacaoId: 31, etapa: "a_caminho" }))).status).toBe(401);
  });

  it("o trabalho de outro profissional não existe para ele", async () => {
    vi.mocked(db.negociacaoNoTerreno).mockResolvedValue(N({ providerId: 8 }));
    const r = await etapa(pedido("/api/profissionais/trabalho/etapa", { negociacaoId: 31, etapa: "a_caminho" }));
    expect(r.status).toBe(404);
    expect(db.registarEtapaNoTerreno).not.toHaveBeenCalled();
  });

  it("depois de dar o trabalho por feito, já não", async () => {
    vi.mocked(db.negociacaoNoTerreno).mockResolvedValue(N({ execucaoEnviadaEm: new Date() }));
    expect((await etapa(pedido("/api/profissionais/trabalho/etapa", { negociacaoId: 31, etapa: "chegou" }))).status).toBe(409);
  });

  it("da primeira vez avisa o cliente por WhatsApp — e só responde depois de ele sair (d11)", async () => {
    const r = await etapa(pedido("/api/profissionais/trabalho/etapa", { negociacaoId: 31, etapa: "a_caminho" }));
    // O envio já aconteceu antes da resposta, e a resposta diz que saiu.
    expect(enviarAvisoWhatsApp).toHaveBeenCalledTimes(1);
    expect(await r.json()).toEqual({ ok: true, primeiraVez: true, whatsapp: true });
    await correrDepois();
    expect(vi.mocked(enviarAvisoWhatsApp).mock.calls[0][1]).toMatch(/Rui já vai a caminho/);
    expect(db.appendOrderHistory).toHaveBeenCalledWith(400, {
      type: "created",
      message: "Rui Silva saiu a caminho do cliente. O cliente foi avisado por WhatsApp.",
    });
    expect(db.registarSemFalhar).toHaveBeenCalledWith(
      expect.objectContaining({ acontecimento: "a_caminho", detalhe: { whatsapp: true, dentroDoPrazo: true } }),
    );
  });

  it("se o WhatsApp não sai, a resposta diz false e o registo do pedido guarda-o", async () => {
    vi.mocked(enviarAvisoWhatsApp).mockResolvedValueOnce(false);
    const r = await etapa(pedido("/api/profissionais/trabalho/etapa", { negociacaoId: 31, etapa: "chegou" }));
    expect(await r.json()).toEqual({ ok: true, primeiraVez: true, whatsapp: false });
    await correrDepois();
    expect(db.appendOrderHistory).toHaveBeenCalledWith(400, {
      type: "created",
      message: "Rui Silva chegou à morada do cliente. O WhatsApp ao cliente não saiu.",
    });
    expect(db.registarSemFalhar).toHaveBeenCalledWith(
      expect.objectContaining({ acontecimento: "chegou_ao_local", detalhe: { whatsapp: false, dentroDoPrazo: true } }),
    );
  });

  it("um envio que rebenta conta como «não saiu», e a etapa fica registada", async () => {
    vi.mocked(enviarAvisoWhatsApp).mockRejectedValueOnce(new Error("Meta em baixo"));
    const r = await etapa(pedido("/api/profissionais/trabalho/etapa", { negociacaoId: 31, etapa: "chegou" }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, primeiraVez: true, whatsapp: false });
  });

  it("se o WhatsApp demora mais do que o prazo, responde false — e o registo guarda o que acabou por acontecer", async () => {
    let soltar!: (v: boolean) => void;
    const lento = new Promise<boolean>((r) => {
      soltar = r;
    });
    vi.mocked(enviarAvisoWhatsApp).mockReturnValueOnce(lento);
    const r = await etapa(pedido("/api/profissionais/trabalho/etapa", { negociacaoId: 31, etapa: "a_caminho" }));
    expect(await r.json()).toEqual({ ok: true, primeiraVez: true, whatsapp: false });
    soltar(true);
    await correrDepois();
    expect(db.appendOrderHistory).toHaveBeenCalledWith(400, {
      type: "created",
      message: "Rui Silva saiu a caminho do cliente. O cliente foi avisado por WhatsApp, com atraso.",
    });
    expect(db.registarSemFalhar).toHaveBeenCalledWith(
      expect.objectContaining({ detalhe: { whatsapp: true, dentroDoPrazo: false } }),
    );
  });

  it("num trabalho CLYON não há WhatsApp ao cliente: false, e o histórico não fala dele", async () => {
    vi.mocked(db.negociacaoNoTerreno).mockResolvedValue(N({ ofertaClyon: "{}" }));
    const r = await etapa(pedido("/api/profissionais/trabalho/etapa", { negociacaoId: 31, etapa: "a_caminho" }));
    expect(await r.json()).toEqual({ ok: true, primeiraVez: true, whatsapp: false });
    await correrDepois();
    expect(enviarAvisoWhatsApp).not.toHaveBeenCalled();
    expect(db.appendOrderHistory).toHaveBeenCalledWith(400, { type: "created", message: "Rui Silva saiu a caminho do cliente." });
    expect(db.registarSemFalhar).toHaveBeenCalledWith(expect.objectContaining({ detalhe: { whatsapp: null, dentroDoPrazo: true } }));
  });

  it("um segundo toque não volta a avisar", async () => {
    vi.mocked(db.registarEtapaNoTerreno).mockResolvedValue(false);
    const r = await etapa(pedido("/api/profissionais/trabalho/etapa", { negociacaoId: 31, etapa: "chegou" }));
    expect(await r.json()).toEqual({ ok: true, primeiraVez: false, whatsapp: false });
    await correrDepois();
    expect(enviarAvisoWhatsApp).not.toHaveBeenCalled();
  });

  it("o prazo da rota é de 8 s, e a função espera por ele", () => {
    const R = readFileSync(join(process.cwd(), "src/app/api/profissionais/trabalho/etapa/route.ts"), "utf8");
    expect(R).toContain("await dentroDoPrazo(envio, PRAZO_DO_WHATSAPP_DA_ETAPA_MS)");
    expect(R).toMatch(/export const maxDuration = (\d+);/);
    expect(Number(R.match(/export const maxDuration = (\d+);/)![1]) * 1000).toBeGreaterThan(8_000);
  });

  it("etapa desconhecida, 400", async () => {
    expect((await etapa(pedido("/api/profissionais/trabalho/etapa", { negociacaoId: 31, etapa: "feito" }))).status).toBe(400);
  });
});

describe("o ajuste pedido pela app", () => {
  it("subir fica à espera, não mexe no valor, e o cliente recebe o link", async () => {
    const r = await pedir(
      pedido("/api/profissionais/trabalho/ajuste", { negociacaoId: 31, valorNovo: "180,50", motivo: "eram 50 sacos, não 20", fotos: [FOTO] }),
    );
    expect(r.status).toBe(200);
    const corpo = await r.json();
    expect(corpo).toMatchObject({ ok: true, efeito: "pendente", valorAcordado: 100 });
    expect(corpo.ajuste.pendente).toMatchObject({ valorNovo: 180.5, fotos: [FOTO] });

    const [, dados] = vi.mocked(db.gravarAjustes).mock.calls[0];
    expect(dados).toMatchObject({ antes: null, valorAcordado: null, providerId: 7 });

    await correrDepois();
    expect(db.substituirTokenDoPedido).toHaveBeenCalledWith(400, expect.any(String), expect.anything());
    // Fora de produção o link é o do sítio onde corre; em produção é sempre clyon.pt.
    expect(vi.mocked(enviarAvisoWhatsApp).mock.calls[0][1]).toMatch(/https?:\/\/\S+\/pedido\/[\w-]{20,}/);
    expect(sendPushToUser).toHaveBeenCalledWith("ana@exemplo.pt", expect.objectContaining({ title: "Pedido de ajuste do valor" }), "cliente");
  });

  it("fotografias de fora do armazenamento da CLYON não contam", async () => {
    const r = await pedir(
      pedido("/api/profissionais/trabalho/ajuste", {
        negociacaoId: 31,
        valorNovo: 180,
        motivo: "eram 50 sacos, não 20",
        fotos: ["https://evil.example/f.jpg"],
      }),
    );
    expect(r.status).toBe(409);
    expect((await r.json()).error).toMatch(/fotografe/);
    expect(db.gravarAjustes).not.toHaveBeenCalled();
  });

  it("baixar grava o valor novo logo", async () => {
    const r = await pedir(pedido("/api/profissionais/trabalho/ajuste", { negociacaoId: 31, valorNovo: 80, motivo: "eram só 15 sacos", fotos: [] }));
    expect(await r.json()).toMatchObject({ ok: true, efeito: "descida", valorAcordado: 80 });
    expect(vi.mocked(db.gravarAjustes).mock.calls[0][1]).toMatchObject({ valorAcordado: 80 });
    await correrDepois();
    expect(vi.mocked(enviarAvisoWhatsApp).mock.calls[0][1]).toMatch(/baixou/);
    expect(db.substituirTokenDoPedido).not.toHaveBeenCalled();
  });

  it("depois de dar o trabalho por feito, não", async () => {
    vi.mocked(db.negociacaoNoTerreno).mockResolvedValue(N({ execucaoEnviadaEm: new Date() }));
    const r = await pedir(pedido("/api/profissionais/trabalho/ajuste", { negociacaoId: 31, valorNovo: 180, motivo: "eram 50 sacos", fotos: [FOTO] }));
    expect(r.status).toBe(409);
    expect(db.gravarAjustes).not.toHaveBeenCalled();
  });

  it("em dinheiro, não passa do tecto do numerário", async () => {
    vi.mocked(db.negociacaoNoTerreno).mockResolvedValue(N({ formaDePagamento: "dinheiro", valorAcordado: "2500" }));
    const r = await pedir(pedido("/api/profissionais/trabalho/ajuste", { negociacaoId: 31, valorNovo: 3500, motivo: "eram 50 sacos", fotos: [FOTO] }));
    expect(r.status).toBe(409);
    expect((await r.json()).error).toMatch(/numerário/);
  });

  it("se o cliente respondeu entretanto, não grava por cima", async () => {
    vi.mocked(db.gravarAjustes).mockResolvedValue(false);
    const r = await pedir(pedido("/api/profissionais/trabalho/ajuste", { negociacaoId: 31, valorNovo: 80, motivo: "eram só 15 sacos", fotos: [] }));
    expect(r.status).toBe(409);
    await correrDepois();
    expect(enviarAvisoWhatsApp).not.toHaveBeenCalled();
  });

  it("o de outro profissional, 404", async () => {
    vi.mocked(db.negociacaoNoTerreno).mockResolvedValue(N({ providerId: 8 }));
    expect((await pedir(pedido("/api/profissionais/trabalho/ajuste", { negociacaoId: 31, valorNovo: 80, motivo: "eram só 15", fotos: [] }))).status).toBe(404);
    expect((await retirar(pedido("/api/profissionais/trabalho/ajuste", { negociacaoId: 31 }, "DELETE"))).status).toBe(404);
  });

  it("retirar só um pedido à espera, e sem mexer no valor", async () => {
    expect((await retirar(pedido("/api/profissionais/trabalho/ajuste", { negociacaoId: 31 }, "DELETE"))).status).toBe(409);

    const pendente: Ajuste = {
      pedidoEm: new Date().toISOString(),
      valorAntigo: 100,
      valorNovo: 180,
      motivo: "eram 50 sacos",
      fotos: [FOTO],
      estado: "pendente",
    };
    vi.mocked(db.negociacaoNoTerreno).mockResolvedValue(N({ ajustesJson: JSON.stringify([pendente]) }));
    const r = await retirar(pedido("/api/profissionais/trabalho/ajuste", { negociacaoId: 31 }, "DELETE"));
    expect(r.status).toBe(200);
    const [, dados] = vi.mocked(db.gravarAjustes).mock.calls[0];
    expect(dados.valorAcordado).toBeNull();
    expect(JSON.parse(dados.depois)[0].estado).toBe("cancelado");
  });
});

describe("dar o trabalho por feito com um ajuste à espera", () => {
  const linha = (ajustes: Ajuste[]) => ({
    id: 31,
    pedidoId: 400,
    estado: "acordada",
    execucaoEnviadaEm: null,
    confirmadoEm: null,
    pagoEm: null,
    ajustesJson: JSON.stringify(ajustes),
  });
  const ajuste = (pedidoEm: string): Ajuste => ({
    pedidoEm,
    valorAntigo: 100,
    valorNovo: 180,
    motivo: "eram 50 sacos",
    fotos: [FOTO],
    estado: "pendente",
  });
  const prova = () => pedido("/api/profissionais/trabalho", { negociacaoId: 31, fotos: [FOTO], nota: "" });

  it("não deixa: o cliente ainda está a decidir o valor", async () => {
    vi.mocked(db.negociacoesDoProfissional).mockResolvedValue([linha([ajuste(new Date().toISOString())])] as never);
    const r = await estaFeito(prova());
    expect(r.status).toBe(409);
    expect((await r.json()).error).toMatch(/ajuste do valor à espera/);
    expect(db.registarExecucao).not.toHaveBeenCalled();
  });

  it("um pedido que já expirou não prende o trabalho", async () => {
    vi.mocked(db.negociacoesDoProfissional).mockResolvedValue([linha([ajuste("2026-01-05T10:00:00.000Z")])] as never);
    await estaFeito(prova());
    expect(db.registarExecucao).toHaveBeenCalledTimes(1);
  });
});

describe("nos trabalhos CLYON de valor fixo o cliente não recebe nada", () => {
  const ajuste: Ajuste = {
    pedidoEm: "2026-10-18T09:00:00.000Z",
    valorAntigo: 100,
    valorNovo: 180,
    motivo: "eram 50 sacos",
    fotos: [FOTO],
    estado: "pendente",
  };

  it("nem «a caminho», nem o pedido de ajuste", async () => {
    for (const n of [N({ valorFixoClyon: "150" }), N({ ofertaClyon: "{}" })]) {
      expect(await avisarClienteDaEtapa(n, "a_caminho")).toBe(false);
      expect(await avisarClienteDoAjuste(n, ajuste, "https://clyon.pt")).toEqual({ link: null, whatsapp: false });
    }
    expect(enviarAvisoWhatsApp).not.toHaveBeenCalled();
    expect(sendPushToUser).not.toHaveBeenCalled();
    expect(db.substituirTokenDoPedido).not.toHaveBeenCalled();
  });

  it("um aviso que falha não lança", async () => {
    vi.mocked(enviarAvisoWhatsApp).mockRejectedValueOnce(new Error("Meta em baixo"));
    await expect(avisarClienteDaEtapa(N(), "chegou")).resolves.toBe(false);
  });
});

describe("o que o cliente lê", () => {
  it("o total com taxas, o link, e que só muda se disser que sim", () => {
    const t = textoDoPedidoDeAjuste(
      N(),
      { pedidoEm: "", valorAntigo: 100, valorNovo: 180, motivo: "eram 50 sacos", fotos: [], estado: "pendente" },
      "https://clyon.pt/pedido/abc",
      new Date("2026-10-18T09:00:00.000Z"),
    );
    expect(t).toMatch(/Aqui é a CLYON/);
    expect(t).toMatch(/«eram 50 sacos»/);
    expect(t).toMatch(/ajustar o valor do seu pedido #400/);
    expect(textoDoPedidoDeAjuste(N({ serviceType: "mudanca" }), { pedidoEm: "", valorAntigo: 1, valorNovo: 2, motivo: "x", fotos: [], estado: "pendente" }, "l", new Date())).toMatch(
      /ajustar o valor da sua mudança \(pedido #400\)/,
    );
    expect(t).toMatch(/https:\/\/clyon\.pt\/pedido\/abc/);
    expect(t).toMatch(/Só muda se disser que sim/);
    expect(t).toMatch(/23:59/);
    // O total não é a base: leva a taxa do cliente (e o IVA, quando há).
    expect(t).not.toMatch(/de 100,00 € para 180,00 €/);
  });
});

describe("a base", () => {
  const fonte = readFileSync(join(process.cwd(), "src", "lib", "db.ts"), "utf8");

  it("as colunas do terreno existem", () => {
    for (const c of ["aCaminhoEm", "chegouEm", "ajustesJson"]) {
      expect(fonte).toMatch(new RegExp(`ALTER TABLE negociacoes ADD COLUMN ${c} `));
    }
  });

  /*
   * Reabrir um pedido ou passá-lo a outro profissional começa um trabalho
   * novo: a hora a que o anterior saiu e os ajustes dele não passam para o
   * seguinte. Os dois sítios que fazem isso limpam as três colunas.
   */
  it("reabrir ou passar a outro profissional limpa o terreno", () => {
    const limpezas = fonte.match(/aCaminhoEm = NULL,\s*chegouEm = NULL,\s*ajustesJson = NULL/g) ?? [];
    expect(limpezas.length).toBeGreaterThanOrEqual(2);
  });

  it("gravar os ajustes não passa por cima de uma resposta que chegou primeiro", () => {
    const i = fonte.indexOf("export async function gravarAjustes");
    expect(i).toBeGreaterThan(-1);
    const corpo = fonte.slice(i, fonte.indexOf("\n}", i));
    expect(corpo).toMatch(/ajustesJson <=> \?/);
    expect(corpo).toMatch(/execucaoEnviadaEm IS NULL/);
    expect(corpo).toMatch(/valorAcordado = COALESCE\(\?, valorAcordado\)/);
  });
});
