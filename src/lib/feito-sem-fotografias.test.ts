import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O «ESTÁ FEITO» SEM FOTOGRAFIAS DE TODO — 30-10-2026 (dono).
 *
 * *«Basta um botão para ele confirmar que o trabalho foi realizado, e o
 * cliente também tem de dizer que sim, e com isso o pedido fica como feito.»*
 *
 * Substitui a regra de 26-10-2026 (d22), em que sem fotografias não havia
 * prazo e confirmava sempre um colega da CLYON. Agora:
 *   1. o profissional carrega em «Está feito» — sem fotografias, nota opcional;
 *   2. o cliente confirma «Sim, ficou feito» (link, conta, app de cliente);
 *   3. sem a resposta dele, fica confirmado 7 dias depois do «Está feito»
 *      (o mecanismo de fecho por tempo que já existia, agora para todos);
 *   4. a CLYON pode confirmar antes pelo backoffice; num Trabalho CLYON é ela
 *      quem confirma, como antes;
 *   5. nenhum ecrã do profissional pede fotografias, nem nenhum texto as põe
 *      como condição.
 */

vi.mock("@/lib/sessao-activa-do-profissional", () => ({
  sessaoActivaDoProfissional: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  appendOrderHistory: vi.fn(async () => {}),
  substituirTokenDoPedido: vi.fn(async () => {}),
  negociacoesDoProfissional: vi.fn(async () => []),
  registarExecucao: vi.fn(async () => true),
  getSimulatorOrderById: vi.fn(async () => undefined),
}));
vi.mock("@/lib/email-trabalho", () => ({ pedirConfirmacaoAoCliente: vi.fn(async () => {}) }));
vi.mock("@/lib/avisar-por-push", () => ({ avisarClienteDoTrabalhoFeitoPorPush: vi.fn(async () => {}) }));

import * as db from "@/lib/db";
import { sessaoActivaDoProfissional } from "@/lib/sessao-activa-do-profissional";
import { pedirConfirmacaoAoCliente } from "@/lib/email-trabalho";
import { avisarClienteDoTrabalhoFeitoPorPush } from "@/lib/avisar-por-push";
import { POST as estaFeito } from "@/app/api/profissionais/trabalho/route";
import {
  DIAS_ATE_LIBERTAR_SOZINHO,
  diasAteLibertar,
  estaLibertado,
  libertaSozinho,
  mensagemDepoisDeFeito,
  porConfirmarComOCliente,
  prazoCorre,
  quandoLiberta,
  quemConfirmaOTrabalho,
} from "./trabalho";
import { clyonPodeConfirmarOTrabalho } from "./quem-negoceia";
import { PASSOS_DO_PROFISSIONAL, COMO_RECEBE } from "./como-funciona-para-o-profissional";
import { PERGUNTAS_DO_PROFISSIONAL } from "./ajuda-plataforma";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semNotas = (t: string) =>
  t.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const FOTO = "https://abc.public.blob.vercel-storage.com/trabalhos/31/f.jpg";
const DIA = 86_400_000;
const FEITO_EM = new Date("2026-10-20T10:00:00Z");
const prova = (fotos: string[], nota = "") => JSON.stringify({ fotos, nota, em: FEITO_EM.toISOString() });
const SEM_FOTOS = prova([], "Feito, o cliente viu.");

const feito = (provaJson: string | null | undefined) => ({
  estado: "acordada",
  execucaoEnviadaEm: FEITO_EM,
  confirmadoEm: null,
  pagoEm: null,
  ...(provaJson === undefined ? {} : { provaJson }),
});

const linha = {
  id: 31,
  pedidoId: 400,
  estado: "acordada",
  execucaoEnviadaEm: null,
  confirmadoEm: null,
  pagoEm: null,
  ajustesJson: null,
  formaDePagamento: null,
  createdAt: new Date("2026-10-15T10:00:00Z"),
};

const pedido = (corpo: unknown) =>
  new NextRequest("https://clyon.pt/api/profissionais/trabalho", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer x" },
    body: JSON.stringify(corpo),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sessaoActivaDoProfissional).mockResolvedValue({ providerId: 7, nome: "Rui Silva" } as never);
  vi.mocked(db.negociacoesDoProfissional).mockResolvedValue([linha] as never);
  vi.mocked(db.registarExecucao).mockResolvedValue(true);
  vi.mocked(db.getSimulatorOrderById).mockResolvedValue({
    id: 400,
    contactEmail: "ana@exemplo.pt",
    contactName: "Ana",
    valorFixoClyon: null,
  } as never);
});

describe("a rota do «Está feito»", () => {
  it("aceita sem fotografias, pede ao cliente que confirme e anuncia o prazo", async () => {
    const r = await estaFeito(pedido({ negociacaoId: 31, nota: "" }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      ok: true,
      mensagem: mensagemDepoisDeFeito({ ofertaClyon: false }),
      fotografias: 0,
      confirmacaoAutomaticaEmDias: DIAS_ATE_LIBERTAR_SOZINHO,
    });
    expect(pedirConfirmacaoAoCliente).toHaveBeenCalledTimes(1);
    expect(avisarClienteDoTrabalhoFeitoPorPush).toHaveBeenCalledTimes(1);
    const [, entrada] = vi.mocked(db.appendOrderHistory).mock.calls[0];
    expect((entrada as { message: string }).message).toContain("por confirmar pelo cliente");
  });

  it("num Trabalho CLYON o cliente não é chamado: confirma a CLYON", async () => {
    vi.mocked(db.getSimulatorOrderById).mockResolvedValue({
      id: 400,
      contactEmail: "ana@exemplo.pt",
      valorFixoClyon: "300.00",
    } as never);
    vi.mocked(db.negociacoesDoProfissional).mockResolvedValue([{ ...linha, valorFixoClyon: "300.00" }] as never);
    const r = await estaFeito(pedido({ negociacaoId: 31 }));
    expect(r.status).toBe(200);
    expect(pedirConfirmacaoAoCliente).not.toHaveBeenCalled();
    expect((await r.json()).mensagem).toBe(mensagemDepoisDeFeito({ ofertaClyon: true }));
  });

  it("as fotografias de uma app antiga ainda se aceitam, mas não mudam nada", async () => {
    const r = await estaFeito(pedido({ negociacaoId: 31, fotos: [FOTO] }));
    expect((await r.json()).confirmacaoAutomaticaEmDias).toBe(DIAS_ATE_LIBERTAR_SOZINHO);
  });
});

describe("a regra (trabalho.ts)", () => {
  it("sem fotografias, o prazo corre a partir do «Está feito»", () => {
    const t = feito(SEM_FOTOS);
    expect(prazoCorre(t)).toBe(true);
    expect(libertaSozinho(t, new Date(FEITO_EM.getTime() + 7 * DIA - 60_000))).toBe(false);
    expect(libertaSozinho(t, new Date(FEITO_EM.getTime() + 7 * DIA))).toBe(true);
    expect(estaLibertado(t, new Date(FEITO_EM.getTime() + 7 * DIA))).toBe(true);
    expect(diasAteLibertar(t, FEITO_EM)).toBe(7);
    expect(quandoLiberta(t)?.toISOString()).toBe(new Date(FEITO_EM.getTime() + 7 * DIA).toISOString());
  });

  it("quem confirma é o cliente; num Trabalho CLYON, a CLYON", () => {
    expect(quemConfirmaOTrabalho({})).toBe("cliente");
    expect(quemConfirmaOTrabalho({ comFotografias: false })).toBe("cliente");
    expect(quemConfirmaOTrabalho({ ofertaClyon: true })).toBe("clyon");
  });

  it("a CLYON pode confirmar qualquer trabalho dado por feito, pelo backoffice", () => {
    const comEmail = { origem: "simulador", contactEmail: "ana@exemplo.pt" };
    expect(porConfirmarComOCliente(feito(SEM_FOTOS))).toBe(true);
    expect(clyonPodeConfirmarOTrabalho(comEmail, feito(SEM_FOTOS))).toBe(true);
    expect(clyonPodeConfirmarOTrabalho(comEmail, { estado: "acordada", provaJson: null })).toBe(false);
  });

  it("o cron já não olha para as fotografias", () => {
    const DB = semNotas(ler("src/lib/db.ts"));
    const i = DB.indexOf("SELECT id, pedidoId FROM negociacoes");
    const consulta = DB.slice(i, i + 400);
    expect(consulta).toContain("execucaoEnviadaEm <= DATE_SUB(NOW(), INTERVAL ? DAY)");
    expect(consulta).not.toContain("fotos");
  });
});

describe("os ecrãs do profissional não pedem fotografias", () => {
  const PAINEL = semNotas(ler("src/app/profissionais/painel/Trabalhos.tsx"));
  const APP = semNotas(ler("app-pro/src/componentes/TrabalhoContratado.tsx"));

  it("o painel: sem «Fotografar» nem galeria, o botão «Está feito» e a nota", () => {
    expect(PAINEL).not.toContain("EnviarFotos");
    expect(PAINEL).not.toContain('rotulo="Fotografar"');
    expect(PAINEL).toContain("Carregue em «Está feito» quando acabar.");
    expect(PAINEL).toContain("Alguma coisa a dizer ao cliente? (opcional)");
    expect(PAINEL).not.toMatch(/Com fotografias, o trabalho fecha sozinho/);
  });

  it("a app Pro: a caixa «Quando estiver feito» sem fotografias", () => {
    const i = APP.indexOf("function EstaFeito(");
    const caixa = APP.slice(i, APP.indexOf("\nfunction ", i + 10));
    expect(caixa).not.toContain("<Fotografias");
    expect(caixa).toContain("Carregue em «Está feito» quando acabar.");
    expect(caixa).toContain("corpo: { negociacaoId: t.negociacaoId, nota: nota.trim() }");
  });
});

describe("os textos já não põem as fotografias como condição", () => {
  it("a ajuda e o «como funciona» do profissional", () => {
    const tudo = [
      ...PASSOS_DO_PROFISSIONAL.map((p) => p.texto),
      ...COMO_RECEBE.map((p) => p.texto),
      ...PERGUNTAS_DO_PROFISSIONAL.map((p) => p.resposta),
    ].join(" ");
    expect(tudo).not.toMatch(/sem fotografias, (a|um colega da) CLYON/i);
    expect(tudo).not.toMatch(/se juntou fotografias/);
  });

  it("os textos para o cliente e os Termos", () => {
    for (const f of ["src/app/page.tsx", "src/lib/como-funciona.ts", "src/app/termos/page.tsx", "src/app/pedido/[token]/PropostasRecebidas.tsx"]) {
      expect(semNotas(ler(f)), f).not.toMatch(/Sem fotografias, a CLYON confirma consigo/);
    }
  });

  it("o email ao profissional e o aviso ao cliente", () => {
    expect(ler("src/lib/email-trabalho.ts")).not.toContain("FOTOGRAFIAS_SAO_OPCIONAIS");
    expect(ler("src/lib/avisar-por-push.ts")).not.toContain("Veja as fotografias e confirme");
    expect(ler("src/lib/assistente-automatico.ts")).not.toContain("mandou as fotografias");
  });
});
