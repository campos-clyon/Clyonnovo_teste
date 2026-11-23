import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * d85, FASE 0 — UMA MENSAGEM AUTOMÁTICA POR DIA, COMUM, E UM SÓ CAMINHO DE
 * CANCELAR PELO LEMBRETE (22-11-2026). Com uma base fingida e números
 * inventados. As rotinas de sempre (d62, d71, d83) continuam a ter os seus
 * testes; aqui prova-se a parte comum.
 */

const base = vi.hoisted(() => ({
  sqls: [] as Array<{ sql: string; params: unknown[] }>,
  enviados: [] as Array<{ para: string; texto: string }>,
  cancelados: [] as number[],
  avisos: [] as string[],
  linhas: {} as Record<string, Array<Record<string, unknown>>>,
  semTabela: new Set<string>(),
  reserva: 1,
  aEspera: null as number | null,
  enviarFalha: false,
}));

vi.mock("./db", async (original) => {
  const pool = {
    execute: async (sql: string, params: unknown[] = []) => {
      base.sqls.push({ sql, params });
      const tabela = /FROM (\w+) v\s+JOIN simulatorOrders/.exec(sql)?.[1];
      if (tabela) {
        if (base.semTabela.has(tabela)) throw Object.assign(new Error("no table"), { code: "ER_NO_SUCH_TABLE" });
        return [base.linhas[tabela] ?? [], []];
      }
      if (/SELECT \(cancelarPedidoEm IS NOT NULL/.test(sql)) return [base.aEspera == null ? [] : [{ aEspera: base.aEspera }], []];
      if (/SET canceladoEm = /.test(sql) && !/canceladoEm = NULL/.test(sql)) return [{ affectedRows: base.reserva }, []];
      if (/SET cancelarPedidoEm = (NOW|UTC_TIMESTAMP)\(\)/.test(sql)) return [{ affectedRows: base.reserva }, []];
      return [{ affectedRows: 1 }, []];
    },
  };
  return {
    ...(await original<typeof import("./db")>()),
    getPool: async () => pool,
    appendOrderHistory: async () => {},
    registarSemFalhar: async () => {},
    gravarMotivoDoFecho: async () => {},
    negociacoesDoPedido: async () => [],
    quemTemOTrabalhoClyon: async () => ({ vivos: [] }),
    cancelarPedido: vi.fn(async (id: number) => {
      base.cancelados.push(id);
      return { encerradas: 2 };
    }),
  };
});

vi.mock("./whatsapp-cloud", async (original) => ({
  ...(await original<typeof import("./whatsapp-cloud")>()),
  enviarTextoWhatsApp: vi.fn(async (para: string, texto: string) => {
    if (base.enviarFalha) return false;
    base.enviados.push({ para, texto });
    return true;
  }),
}));
vi.mock("./avisar-cancelamento", () => ({ avisarDoCancelamento: vi.fn(async () => void base.avisos.push("mesa")) }));
vi.mock("./avisar-trabalho-clyon", () => ({ avisarCancelamentoDoTrabalhoClyon: vi.fn(async () => (base.avisos.push("clyon"), 1)) }));
vi.mock("./validade-do-orcamento-na-base", () => ({ marcarCicloTerminado: vi.fn(async () => void base.avisos.push("validade parada")) }));

import { getPool } from "./db";
import {
  algumaDeHoje,
  datasDasMensagensAutomaticas,
  FONTES_DAS_MENSAGENS_AUTOMATICAS,
  jaSaiuHojeUmaMensagemAutomatica,
} from "./uma-mensagem-automatica-por-dia";
import {
  cancelarPeloLembreteComum,
  FONTES_DO_CANCELAMENTO,
  perguntarSeCancela,
  responderAoCancelamento,
} from "./cancelar-pelo-lembrete";
import { MENSAGEM_DE_CANCELAMENTO } from "./mensagens-das-fases";
import { jaSaiuHojeAoCliente } from "./seguimento-do-cliente";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const TEL = "351912345678";
const AGORA = new Date("2026-11-22T10:00:00Z");

beforeEach(() => {
  base.sqls = [];
  base.enviados = [];
  base.cancelados = [];
  base.avisos = [];
  base.linhas = {};
  base.semTabela = new Set();
  base.reserva = 1;
  base.aEspera = null;
  base.enviarFalha = false;
});

/* ── Uma por dia, comum ──────────────────────────────────────────────────── */

describe("uma mensagem automática por dia, por telefone, comum a todas as rotinas", () => {
  it("a lista tem as rotinas de hoje — e uma nova entra aqui (d88: as propostas ao cliente)", () => {
    expect(FONTES_DAS_MENSAGENS_AUTOMATICAS.map((f) => f.tabela)).toEqual([
      "validadeDosOrcamentos",
      "lembretesDoQueFalta",
      "seguimentoDoCliente",
      "envioDasPropostasAoCliente",
    ]);
  });

  it("o dia é o de Lisboa (a mesma regra que a d83 já tinha)", () => {
    expect(algumaDeHoje([new Date("2026-11-22T00:30:00Z")], AGORA)).toBe(true);
    expect(algumaDeHoje([new Date("2026-11-21T20:00:00Z"), null, undefined], AGORA)).toBe(false);
    expect(algumaDeHoje([new Date("2026-07-10T23:30:00Z")], new Date("2026-07-11T10:00:00Z"))).toBe(true);
    for (const d of [[new Date("2026-11-22T08:00:00Z")], [new Date("2026-11-20T08:00:00Z")]]) {
      expect(algumaDeHoje(d, AGORA)).toBe(jaSaiuHojeAoCliente(d, AGORA));
    }
  });

  it("um lembrete do que falta (d71) de hoje trava a validade (d62) e o seguimento (d83), e vice-versa", async () => {
    base.linhas.lembretesDoQueFalta = [{ lembrete1Em: "2026-11-22 09:00:00", lembrete2Em: null, lembrete3Em: null, arquivadoEm: null, contactPhone: "+351 912 345 678" }];
    expect(await jaSaiuHojeUmaMensagemAutomatica({ telefone: TEL }, AGORA)).toBe(true);
    base.linhas = { validadeDosOrcamentos: [{ lembrete1Em: "2026-11-22 09:00:00", ultimoAvisoEm: null, fechadoEm: null, contactPhone: TEL }] };
    expect(await jaSaiuHojeUmaMensagemAutomatica({ telefone: TEL }, AGORA)).toBe(true);
    base.linhas = { seguimentoDoCliente: [{ mensagem1Em: "2026-11-21 18:00:00", contactPhone: TEL }] };
    expect(await jaSaiuHojeUmaMensagemAutomatica({ telefone: TEL }, AGORA)).toBe(false);
  });

  it("o telefone compara-se inteiro (outro número com os mesmos 9 dígitos não conta), e o email só quando a rotina fala por email", async () => {
    base.linhas.seguimentoDoCliente = [{ mensagem1Em: "2026-11-22 09:00:00", contactPhone: "+33 912 345 678", contactEmail: "a@exemplo.pt" }];
    expect(await jaSaiuHojeUmaMensagemAutomatica({ telefone: TEL }, AGORA)).toBe(false);
    expect(await jaSaiuHojeUmaMensagemAutomatica({ telefone: TEL, email: "a@exemplo.pt" }, AGORA)).toBe(true);
  });

  it("uma tabela que ainda não existe não tem nada; sem contacto, nada se lê", async () => {
    base.semTabela = new Set(["validadeDosOrcamentos", "lembretesDoQueFalta"]);
    base.linhas.seguimentoDoCliente = [{ mensagem1Em: "2026-11-22 09:00:00", contactPhone: TEL }];
    expect((await datasDasMensagensAutomaticas({ telefone: TEL })).length).toBe(1);
    base.sqls = [];
    expect(await datasDasMensagensAutomaticas({ telefone: "12" })).toEqual([]);
    expect(base.sqls.length).toBe(0);
  });

  it("as três rotinas consultam a mesma função antes de reservar o passo do dia", () => {
    const d62 = ler("src/lib/validade-do-orcamento-na-base.ts");
    const d71 = ler("src/lib/lembrete-do-que-falta-na-base.ts");
    const d83 = ler("src/lib/seguimento-do-cliente-na-base.ts");
    for (const [nome, f] of [["d62", d62], ["d71", d71], ["d83", d83]] as const) {
      expect(f, nome).toContain("jaSaiuHojeUmaMensagemAutomatica(");
      expect(f, nome).not.toContain("datasDoSeguimentoDoTelefone");
      expect(f, nome).not.toContain("mensagensAutomaticasDoContacto");
    }
    // Antes de reservar: na d71, a verificação vem antes do UPDATE que reserva o passo.
    const passo = d71.slice(d71.indexOf("export async function darOPasso("));
    expect(passo.indexOf("jaSaiuHojeUmaMensagemAutomatica(")).toBeLessThan(passo.indexOf("// Reservar o passo ANTES de sair"));
    const passo83 = d83.slice(d83.indexOf("export async function darOPasso("));
    expect(passo83.indexOf("jaSaiuHojeUmaMensagemAutomatica(")).toBeLessThan(passo83.indexOf("affectedRows"));
  });
});

/* ── Um só caminho de cancelar ───────────────────────────────────────────── */

const verificarOk = async () => ({ eClyon: false, servico: "recolha_monos", localidade: "Almada" });

describe("um só caminho de cancelar pelo lembrete (d62, d71, d83)", () => {
  it("as três fontes: a d62 e a d83 com a pergunta do CANCELAR; a d71 com «logo» (o «2» cancela, dono 19-11)", () => {
    expect(FONTES_DO_CANCELAMENTO.validade.confirmacao).toBe("pergunta");
    expect(FONTES_DO_CANCELAMENTO.seguimento.confirmacao).toBe("pergunta");
    expect(FONTES_DO_CANCELAMENTO.queFalta.confirmacao).toBe("logo");
    const d62 = ler("src/lib/validade-do-orcamento-na-base.ts");
    const d71 = ler("src/lib/lembrete-do-que-falta-na-base.ts");
    const d83 = ler("src/lib/seguimento-do-cliente-na-base.ts");
    expect(d62).toContain("FONTES_DO_CANCELAMENTO.validade");
    expect(d71).toContain("FONTES_DO_CANCELAMENTO.queFalta");
    expect(d83).toContain("FONTES_DO_CANCELAMENTO.seguimento");
    // Nenhuma das três cancela por conta própria pelo lembrete: o cancelarPedido do lembrete é o comum.
    expect(d62).not.toContain("await cancelarPedido(");
    expect(d71).not.toContain("await cancelarPedido(");
    expect(ler("src/lib/cancelar-pelo-lembrete.ts").split("await cancelarPedido(").length - 1).toBe(1);
  });

  it("com «pergunta», sem a pergunta feita: pergunta «Confirma que quer cancelar o pedido #N? Responda CANCELAR.» e não cancela", async () => {
    const pool = (await getPool())!;
    base.aEspera = 0;
    const r = await responderAoCancelamento(FONTES_DO_CANCELAMENTO.validade, pool, 612, TEL, "3", { verificar: verificarOk });
    expect(r).toEqual({ ok: true, estado: "pediu_confirmacao" });
    expect(base.enviados).toEqual([{ para: TEL, texto: "Confirma que quer cancelar o pedido #612? Responda CANCELAR." }]);
    expect(base.cancelados).toEqual([]);
  });

  it("à espera, outro texto não cancela nem pergunta outra vez; sem o texto, passa à equipa", async () => {
    const pool = (await getPool())!;
    base.aEspera = 1;
    expect(await responderAoCancelamento(FONTES_DO_CANCELAMENTO.seguimento, pool, 612, TEL, "já não preciso", { verificar: verificarOk })).toMatchObject({
      ok: true,
      estado: "a_espera_de_cancelar",
    });
    expect(await responderAoCancelamento(FONTES_DO_CANCELAMENTO.seguimento, pool, 612, TEL, null, { verificar: verificarOk })).toMatchObject({ ok: false });
    expect(base.enviados).toEqual([]);
    expect(base.cancelados).toEqual([]);
  });

  it("à espera, o CANCELAR cancela pelo caminho de sempre: motivo, purga a 7 dias, parceiros, texto aprovado", async () => {
    const pool = (await getPool())!;
    base.aEspera = 1;
    const r = await responderAoCancelamento(FONTES_DO_CANCELAMENTO.seguimento, pool, 612, TEL, "CANCELAR", { verificar: verificarOk });
    expect(r).toEqual({ ok: true, estado: "cancelado" });
    expect(base.cancelados).toEqual([612]);
    expect(base.sqls.some((q) => /UPDATE seguimentoDoCliente SET anonimizarAPartirDe = NOW\(\) \+ INTERVAL 7 DAY/.test(q.sql))).toBe(true);
    expect(base.avisos).toEqual(["mesa", "validade parada"]);
    expect(base.enviados).toEqual([{ para: TEL, texto: MENSAGEM_DE_CANCELAMENTO }]);
    expect(base.sqls.some((q) => /DELETE/i.test(q.sql))).toBe(false);
  });

  it("com «logo» (d71), a resposta ao lembrete cancela sem a pergunta — o comportamento de hoje", async () => {
    const pool = (await getPool())!;
    const r = await responderAoCancelamento(FONTES_DO_CANCELAMENTO.queFalta, pool, 812, TEL, null, { verificar: verificarOk });
    expect(r).toEqual({ ok: true, estado: "cancelado" });
    expect(base.cancelados).toEqual([812]);
    expect(base.enviados.map((e) => e.texto)).toEqual([MENSAGEM_DE_CANCELAMENTO]);
    expect(base.sqls.some((q) => /SET canceladoEm = UTC_TIMESTAMP\(\)/.test(q.sql) && !/cancelarPedidoEm IS NOT NULL/.test(q.sql))).toBe(true);
  });

  it("um só cancela (a reserva), e um pedido que a rotina recusa desfaz a reserva", async () => {
    const pool = (await getPool())!;
    base.reserva = 0;
    expect(await cancelarPeloLembreteComum(FONTES_DO_CANCELAMENTO.validade, pool, 612, TEL, { verificar: verificarOk })).toEqual({
      ok: false,
      porque: "não há pergunta do CANCELAR a valer para este pedido",
    });
    base.reserva = 1;
    const parado: string[] = [];
    const r = await cancelarPeloLembreteComum(FONTES_DO_CANCELAMENTO.queFalta, pool, 812, TEL, {
      verificar: async () => ({ porque: "o pedido já foi aos parceiros" }),
      aoDesfazer: async (p) => void parado.push(p),
    });
    expect(r).toEqual({ ok: false, porque: "o pedido já foi aos parceiros" });
    expect(parado).toEqual(["o pedido já foi aos parceiros"]);
    expect(base.sqls.some((q) => /UPDATE lembretesDoQueFalta SET canceladoEm = NULL/.test(q.sql))).toBe(true);
    expect(base.cancelados).toEqual([]);
  });

  it("num Trabalho CLYON avisa como nos Trabalhos CLYON; a pergunta que não sai desfaz-se", async () => {
    const pool = (await getPool())!;
    base.aEspera = 1;
    await responderAoCancelamento(FONTES_DO_CANCELAMENTO.validade, pool, 612, TEL, "cancelar", {
      verificar: async () => ({ eClyon: true, servico: "recolha_monos", localidade: "Almada" }),
    });
    expect(base.avisos).toEqual(["clyon"]);
    base.enviarFalha = true;
    base.sqls = [];
    expect(await perguntarSeCancela(FONTES_DO_CANCELAMENTO.validade, pool, 612, TEL)).toEqual({ ok: false, porque: "a pergunta do CANCELAR não saiu" });
    expect(base.sqls.some((q) => /SET cancelarPedidoEm = NULL/.test(q.sql))).toBe(true);
  });

  it("a d71 já tem a coluna da pergunta (aditiva), para o dia em que se decidir pedir o CANCELAR também aí", () => {
    expect(ler("src/lib/lembrete-do-que-falta-na-base.ts")).toContain(
      "ALTER TABLE lembretesDoQueFalta ADD COLUMN cancelarPedidoEm DATETIME NULL DEFAULT NULL",
    );
  });
});
