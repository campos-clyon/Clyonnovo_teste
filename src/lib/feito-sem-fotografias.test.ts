import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O «ESTÁ FEITO» SEM FOTOGRAFIAS — 26-10-2026 (d22).
 *
 * *«Remova o envio de imagens para confirmar, mas explique que será um colega
 * a confirmar se o trabalho realmente foi feito ou não com o cliente.»* — o
 * dono. Havia profissionais que não conseguiam pôr fotografias e, por isso,
 * não conseguiam dar o trabalho por feito.
 *
 * O que estes testes guardam:
 *   1. marcar como feito sem fotografias é aceite, e a rota diz o que a app e o
 *      painel mostram;
 *   2. sem fotografias não há confirmação automática — nem no cron, nem na
 *      carteira, nem no prazo que se anuncia —, e o trabalho aparece à equipa,
 *      que o pode confirmar com o cliente mesmo que ele tenha email;
 *   3. com fotografias, tudo como estava;
 *   4. os textos (Termos, ajuda, painel, email, e do lado do cliente a
 *      inicial, o «como funciona» e as perguntas) dizem o mesmo.
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
  FOTOGRAFIAS_SAO_OPCIONAIS,
  OBRIGADO_DEPOIS_DE_FEITO,
  QUEM_CONFIRMA_O_TRABALHO,
  diasAteLibertar,
  estaLibertado,
  fotografiasDaProva,
  libertaSozinho,
  porConfirmarComOCliente,
  prazoCorre,
  provaComFotografiasSql,
  provaSemFotografiasSql,
  quandoLiberta,
} from "./trabalho";
import { clyonPodeConfirmar, clyonPodeConfirmarOTrabalho } from "./quem-negoceia";
import { quaisPedidosComRespostaDoProfissional } from "./novidades-do-backoffice";
import { PASSOS_DO_PROFISSIONAL, COMO_RECEBE } from "./como-funciona-para-o-profissional";
import { PERGUNTAS_DO_PROFISSIONAL } from "./ajuda-plataforma";
import { PROMESSA, PROMESSA_POR_FORMA } from "./pagamento-na-plataforma";
import { novidadesDoPedido } from "./assistente-automatico";
import type { PedidoParaOAssistente } from "./db";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semNotas = (t: string) =>
  t.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const FOTO = "https://abc.public.blob.vercel-storage.com/trabalhos/31/f.jpg";
const DIA = 86_400_000;
const FEITO_EM = new Date("2026-10-20T10:00:00Z");
/** A prova como a rota a grava: `JSON.stringify({ fotos, nota, em })`. */
const prova = (fotos: string[], nota = "") => JSON.stringify({ fotos, nota, em: FEITO_EM.toISOString() });
const COM_FOTOS = prova([FOTO]);
const SEM_FOTOS = prova([], "Feito, o cliente viu.");

const feito = (provaJson: string | null | undefined) => ({
  estado: "acordada",
  execucaoEnviadaEm: FEITO_EM,
  confirmadoEm: null,
  pagoEm: null,
  ...(provaJson === undefined ? {} : { provaJson }),
});

/* ── 1. A rota ──────────────────────────────────────────────────────────── */

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

describe("a rota do «está feito»", () => {
  it("aceita sem fotografias, e diz o que a app e o painel mostram", async () => {
    const r = await estaFeito(pedido({ negociacaoId: 31, nota: "" }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      ok: true,
      mensagem: "Obrigado. Um colega da CLYON vai confirmar com o cliente se o trabalho foi feito.",
      fotografias: 0,
      confirmacaoAutomaticaEmDias: null,
    });
    expect(db.registarExecucao).toHaveBeenCalledTimes(1);
    const [, , gravada] = vi.mocked(db.registarExecucao).mock.calls[0];
    expect(fotografiasDaProva(gravada)).toEqual([]);
    expect(prazoCorre({ ...feito(gravada) })).toBe(false);
  });

  it("uma lista vazia é o mesmo que nenhuma", async () => {
    const r = await estaFeito(pedido({ negociacaoId: 31, fotos: [], nota: "" }));
    expect(r.status).toBe(200);
    expect((await r.json()).confirmacaoAutomaticaEmDias).toBeNull();
  });

  it("sem fotografias o cliente não recebe o pedido de confirmação com prazo", async () => {
    await estaFeito(pedido({ negociacaoId: 31 }));
    expect(pedirConfirmacaoAoCliente).not.toHaveBeenCalled();
    expect(avisarClienteDoTrabalhoFeitoPorPush).not.toHaveBeenCalled();
    expect(db.substituirTokenDoPedido).not.toHaveBeenCalled();
    const [, entrada] = vi.mocked(db.appendOrderHistory).mock.calls[0];
    expect((entrada as { message: string }).message).toContain("sem fotografias — por confirmar com o cliente");
  });

  it("com fotografias fica como estava: o email sai e o prazo corre", async () => {
    const r = await estaFeito(pedido({ negociacaoId: 31, fotos: [FOTO], nota: "" }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      ok: true,
      mensagem: OBRIGADO_DEPOIS_DE_FEITO,
      fotografias: 1,
      confirmacaoAutomaticaEmDias: DIAS_ATE_LIBERTAR_SOZINHO,
    });
    expect(pedirConfirmacaoAoCliente).toHaveBeenCalledTimes(1);
    expect(avisarClienteDoTrabalhoFeitoPorPush).toHaveBeenCalledTimes(1);
  });

  it("a frase que obrigava a fotografia saiu da rota e do painel", () => {
    for (const f of ["src/app/api/profissionais/trabalho/route.ts", "src/app/profissionais/painel/Trabalhos.tsx"]) {
      expect(ler(f), f).not.toContain("Envie pelo menos uma fotografia");
    }
  });
});

/* ── 2. Sem fotografias não há prazo ────────────────────────────────────── */

describe("a regra (trabalho.ts)", () => {
  it("as frases são as do dono", () => {
    expect(QUEM_CONFIRMA_O_TRABALHO).toBe("Um colega da CLYON vai confirmar com o cliente se o trabalho foi feito.");
    expect(OBRIGADO_DEPOIS_DE_FEITO).toBe(`Obrigado. ${QUEM_CONFIRMA_O_TRABALHO}`);
    expect(FOTOGRAFIAS_SAO_OPCIONAIS).toBe("Se puder, junte fotografias — ajudam, mas não são obrigatórias.");
  });

  it("com fotografias, o prazo de sempre", () => {
    const t = feito(COM_FOTOS);
    expect(prazoCorre(t)).toBe(true);
    expect(porConfirmarComOCliente(t)).toBe(false);
    expect(libertaSozinho(t, new Date(FEITO_EM.getTime() + 7 * DIA))).toBe(true);
    expect(diasAteLibertar(t, FEITO_EM)).toBe(7);
    expect(quandoLiberta(t)?.toISOString()).toBe(new Date(FEITO_EM.getTime() + 7 * DIA).toISOString());
  });

  it("sem fotografias, nunca se liberta sozinho — fica por confirmar com o cliente", () => {
    const t = feito(SEM_FOTOS);
    const muitoDepois = new Date(FEITO_EM.getTime() + 60 * DIA);
    expect(prazoCorre(t)).toBe(false);
    expect(porConfirmarComOCliente(t)).toBe(true);
    expect(libertaSozinho(t, muitoDepois)).toBe(false);
    expect(estaLibertado(t, muitoDepois)).toBe(false);
    expect(diasAteLibertar(t, FEITO_EM)).toBeNull();
    expect(quandoLiberta(t)).toBeNull();
  });

  it("e quando a CLYON confirma, liberta-se nessa hora — a primeira porta", () => {
    const confirmado = { ...feito(SEM_FOTOS), confirmadoEm: new Date("2026-10-21T09:00:00Z") };
    expect(porConfirmarComOCliente(confirmado)).toBe(false);
    expect(estaLibertado(confirmado, new Date("2026-10-21T10:00:00Z"))).toBe(true);
    expect(quandoLiberta(confirmado)?.toISOString()).toBe("2026-10-21T09:00:00.000Z");
  });

  it("uma prova vazia (dado por entregue pela CLYON) também não tem prazo", () => {
    expect(prazoCorre(feito(null))).toBe(false);
    expect(fotografiasDaProva("isto não é JSON")).toEqual([]);
  });

  it("sem a prova carregada vale a regra de antes", () => {
    const t = feito(undefined);
    expect(prazoCorre(t)).toBe(true);
    expect(libertaSozinho(t, new Date(FEITO_EM.getTime() + 7 * DIA))).toBe(true);
  });

  it("o SQL diz o mesmo que o JavaScript, sobre o texto que a rota grava", () => {
    const comoRegex = (sql: string) => {
      const padrao = sql.match(/LIKE '([^']*)'/)![1];
      const corpo = padrao.split("%").map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\\S]*");
      return new RegExp(`^${corpo}$`);
    };
    const like = comoRegex(provaComFotografiasSql("provaJson"));
    expect(like.test(COM_FOTOS)).toBe(true);
    expect(like.test(prova([FOTO, FOTO]))).toBe(true);
    expect(like.test(SEM_FOTOS)).toBe(false);
    expect(provaSemFotografiasSql("f.provaJson")).toBe(
      `(f.provaJson IS NULL OR f.provaJson NOT LIKE '%"fotos":["%')`,
    );
  });
});

describe("o cron, a carteira e o painel do profissional", () => {
  const DB = semNotas(ler("src/lib/db.ts"));

  it("o cron só confirma sozinho o que tem fotografias", () => {
    const i = DB.indexOf("export async function libertarTrabalhosPorPrazo(");
    const corpo = DB.slice(i, DB.indexOf("UPDATE negociacoes SET confirmadoEm = NOW()", i));
    expect(corpo).toContain('AND ${provaComFotografiasSql("provaJson")}');
  });

  it("as consultas que contam dinheiro trazem a prova", () => {
    expect(semNotas(ler("src/lib/carteira-do-profissional.ts"))).toContain("provaJson: l.provaJson,");
    // O livro, a conta a apagar e o bloqueio em dinheiro.
    expect(DB).toContain("execucaoEnviadaEm, provaJson, confirmadoEm, pagoEm, createdAt\n       FROM negociacoes`");
    expect(DB).toContain("provaJson: (n.provaJson as string | null) ?? null,");
    expect(DB).toContain(
      "taxaProfissional, provaJson,\n              execucaoEnviadaEm, confirmadoEm, pagoEm, createdAt\n         FROM negociacoes WHERE providerId = ?",
    );
    expect(ler("src/lib/bloqueio-do-profissional.ts")).toContain("execucaoEnviadaEm, provaJson, confirmadoEm");
    // E a dos trabalhos do profissional, de onde saem a carteira e o prazo do ecrã.
    const i = DB.indexOf("export async function negociacoesDoProfissional(");
    expect(DB.slice(i, i + 12000)).toContain("n.provaJson");
  });

  it("o ecrã do cliente na conta passa a prova ao prazo", () => {
    // A conta converte pela função da página e da app (28-10-2026, d8 R5).
    expect(ler("src/app/conta/components/OrderDetailModal.tsx")).toContain("negociacaoParaAVista(n, {");
    const CONVERSAO = ler("src/lib/negociacao-na-vista.ts");
    const i = CONVERSAO.indexOf("diasAteLibertar: diasAteLibertar(");
    expect(i).toBeGreaterThan(-1);
    expect(CONVERSAO.slice(i, i + 400)).toContain("provaJson: n.provaJson ?? null");
  });

  it("o painel do profissional não exige fotografia e espera pelas que estão a subir", () => {
    const P = semNotas(ler("src/app/profissionais/painel/Trabalhos.tsx"));
    expect(P).not.toContain("fotos.length === 0");
    expect(P).toContain("disabled={aEnviar || fotosAEnviar > 0}");
    expect(P).toContain("onAEnviar={setFotosAEnviar}");
    expect(P).toContain("{QUEM_CONFIRMA_O_TRABALHO}");
    expect(P).toContain("{FOTOGRAFIAS_SAO_OPCIONAIS}");
    // Fica no trabalho, com a frase da rota (a mesma que a app mostra).
    expect(P).toContain("setObrigado(");
    expect(P).toContain("dados.mensagem");
    expect(P).toContain("porConfirmarComOCliente(pedido)");
  });
});

/* ── 3. A equipa ────────────────────────────────────────────────────────── */

describe("aparece à equipa, que confirma com o cliente", () => {
  const comEmail = { origem: "simulador", contactEmail: "ana@exemplo.pt" };

  it("sem fotografias, a CLYON pode confirmar mesmo com o cliente com email", () => {
    expect(clyonPodeConfirmar(comEmail)).toBe(false);
    expect(clyonPodeConfirmarOTrabalho(comEmail, feito(SEM_FOTOS))).toBe(true);
  });

  it("com fotografias, ou antes de feito, continua a ser o cliente", () => {
    expect(clyonPodeConfirmarOTrabalho(comEmail, feito(COM_FOTOS))).toBe(false);
    expect(clyonPodeConfirmarOTrabalho(comEmail, { estado: "acordada", provaJson: null })).toBe(false);
    expect(clyonPodeConfirmarOTrabalho(comEmail, null)).toBe(false);
    expect(clyonPodeConfirmarOTrabalho({ origem: "backoffice", contactEmail: null }, null)).toBe(true);
  });

  it("a rota verifica a mesma regra, no servidor", () => {
    const ROTA = semNotas(ler("src/app/api/admin/negociacoes/agir/route.ts"));
    const i = ROTA.indexOf('if (accao === "confirmar") {');
    expect(ROTA.slice(i, i + 1500)).toContain("if (!clyonPodeConfirmarOTrabalho(alvo, linha)) {");
  });

  it("a Mesa chama-lhe «por confirmar com o cliente»", () => {
    const M = semNotas(ler("src/components/admin/AdminNegociacoesPanel.tsx"));
    expect(M).toContain('return "por confirmar com o cliente"');
    expect(M).toContain("sem fotografias — por confirmar com o cliente");
    expect(M).toContain('porConfirmarComOCliente(feito) ? " — por confirmar com o cliente" : ""');
    expect(M).toContain("clyonPodeConfirmarOTrabalho(p, feito) ?");
    expect(ler("src/components/admin/TrabalhoClyon.tsx")).toContain(
      "diz que está feito, sem fotografias — por confirmar com o cliente",
    );
  });

  it("com selo: nas Negociações conta qualquer «feito», e nos Trabalhos CLYON o sem fotografias", () => {
    const desde = new Date("2026-10-20T00:00:00Z");
    expect(
      quaisPedidosComRespostaDoProfissional(
        [
          {
            pedidoId: 400,
            estado: "acordada",
            propostasJson: null,
            updatedAt: FEITO_EM,
            execucaoEnviadaEm: FEITO_EM,
            confirmadoEm: null,
          },
        ],
        desde,
      ),
    ).toEqual([400]);
    const DB = semNotas(ler("src/lib/db.ts"));
    const i = DB.indexOf('"trabalhos_clyon",\n');
    const consulta = DB.slice(i, DB.indexOf("ORDER BY o.id DESC", i));
    expect(consulta).toContain("f.confirmadoEm IS NULL AND f.execucaoEnviadaEm > ?");
    expect(consulta).toContain('${provaSemFotografiasSql("f.provaJson")}');
  });
});

/* ── 4. Os textos ───────────────────────────────────────────────────────── */

describe("os textos dizem o mesmo", () => {
  it("os Termos: fotografias se as tiver; sem elas, a CLYON confirma antes de libertar", () => {
    const T = semNotas(ler("src/app/termos/page.tsx")).replace(/\s+/g, " ");
    expect(T).toContain("o profissional marca-o como feito, com fotografias do resultado se as tiver");
    expect(T).toContain("Sem fotografias, a CLYON confirma consigo antes de libertar o pagamento.");
    expect(T).not.toContain("e envia fotografias do resultado;");
  });

  it("a ajuda e o «como funciona» do profissional", () => {
    const passo = PASSOS_DO_PROFISSIONAL.find((p) => p.chave === "prova")!;
    expect(passo.titulo).toBe("Faz o trabalho e marca-o como feito");
    expect(passo.texto).toContain(FOTOGRAFIAS_SAO_OPCIONAIS);
    expect(passo.texto).toContain("um colega da CLYON confirma com o cliente antes de libertar o pagamento");
    expect(COMO_RECEBE[0].texto).toContain("sem fotografias, até a CLYON o confirmar com o cliente");
    const ajuda = PERGUNTAS_DO_PROFISSIONAL.find((p) => p.pergunta === "Quando é que recebo o dinheiro?")!;
    expect(ajuda.resposta).toContain("(com fotografias, se as tiver)");
    expect(ajuda.resposta).toContain("Sem fotografias, a CLYON confirma com o cliente antes de libertar o pagamento.");
  });

  it("o lado do cliente: a inicial, o «como funciona» e as perguntas não prometem fotografias sempre", () => {
    const INICIAL = semNotas(ler("src/app/page.tsx")).replace(/\s+/g, " ");
    expect(INICIAL).toContain("marca-o como feito, com fotografias se as tiver");
    expect(INICIAL).toContain("sem fotografias, a CLYON confirma consigo antes de libertar o pagamento");

    const COMO = semNotas(ler("src/app/como-funciona/page.tsx")).replace(/\s+/g, " ");
    expect(COMO).toContain("marca-o como feito, com fotografias se as tiver");
    expect(COMO).toContain("Sem fotografias, a CLYON confirma consigo antes de libertar o pagamento");
    // O prazo do silêncio só corre com fotografias — diz-se, e só para esse caso.
    expect(COMO).toContain(
      "com elas, se não disser nada, o trabalho dá-se por concluído ${DIAS_ATE_LIBERTAR_SOZINHO} dias depois",
    );

    for (const [nome, T] of [
      ["inicial", INICIAL],
      ["como funciona", COMO],
    ]) {
      expect(T, nome).not.toContain("envia fotografias do resultado");
      expect(T, nome).not.toContain("dias depois das fotografias");
    }

    expect(PROMESSA.faqQuemResponde).toContain("as fotografias do trabalho feito, quando as há,");
  });

  it("o email de quem foi contratado já não manda fotografar", () => {
    const EMAIL = ler("src/lib/email-trabalho.ts");
    expect(EMAIL).not.toContain("fotografe o resultado");
    expect(EMAIL).toContain("marque como feito na sua conta. ${FOTOGRAFIAS_SAO_OPCIONAIS}");
    for (const [forma, p] of Object.entries(PROMESSA_POR_FORMA)) {
      expect(p.emailProParaQueServeAProva, forma).toContain("sem fotografias, é um colega da CLYON que confirma com ele");
      expect(p.emailProParaQueServeAProva, forma).not.toContain("É com ela");
    }
  });

  it("o assistente do WhatsApp não anuncia fotografias nem prazo que não há", () => {
    const base = (provaJson: string): PedidoParaOAssistente => ({
      id: 501,
      contactName: "João Ribeiro",
      contactPhone: "912345678",
      serviceType: "recolha_moveis",
      status: "atribuido",
      createdAt: new Date("2026-10-19T09:00:00Z"),
      dataAgendada: null,
      negociacoes: [
        {
          id: 77,
          estado: "acordada",
          valorAcordado: "100.00",
          propostasJson: null,
          execucaoEnviadaEm: FEITO_EM,
          provaJson,
          confirmadoEm: null,
          pagoEm: null,
          dataCombinada: null,
          avaliadoEm: null,
          profissionalNome: "Fred",
          regimeIva: null,
          actualizadaEm: FEITO_EM,
        },
      ],
    });
    const agora = new Date("2026-10-20T14:00:00Z");
    const especies = (p: PedidoParaOAssistente) => novidadesDoPedido(p, agora).map((n) => n.especie);
    expect(especies(base(COM_FOTOS))).toContain("trabalho_feito");
    expect(especies(base(SEM_FOTOS))).not.toContain("trabalho_feito");
  });
});
