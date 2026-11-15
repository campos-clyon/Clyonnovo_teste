import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { naAgenda } from "./agenda-dos-trabalhos";
import { dataDoTrabalho, fraseDoFeitoEm } from "./feito-em";
import { comissoesPorPeriodo, diaQueConta, type LinhaQueConta, type PagamentoDeComissao } from "./assistentes";

/**
 * d36 — 15-11-2026: «o trabalho feito fica com a data e a hora em que foi
 * feito». Cada regra tem aqui o teste que a guarda.
 */

const RAIZ = join(__dirname, "..", "..");
const ler = (f: string) => readFileSync(join(RAIZ, f), "utf8");

/** Os ficheiros de código do site (sem testes, sem as apps). */
const FONTES = execSync("git ls-files src", { cwd: RAIZ, encoding: "utf8" })
  .split(/\r?\n/)
  .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f));

/** Cada `UPDATE negociacoes …` de todo o src, como texto até ao fim da frase SQL (a crase). */
function updatesDasNegociacoes(): Array<{ ficheiro: string; sql: string }> {
  const r: Array<{ ficheiro: string; sql: string }> = [];
  for (const f of FONTES) {
    const s = ler(f);
    let i = s.indexOf("UPDATE negociacoes");
    while (i > -1) {
      const fim = s.indexOf("`", i);
      r.push({ ficheiro: f, sql: s.slice(i, fim > -1 ? fim : i + 2000) });
      i = s.indexOf("UPDATE negociacoes", i + 1);
    }
  }
  return r;
}

describe("d36 — o «feito em» grava-se em todas as rotas que dão o trabalho por feito", () => {
  const updates = updatesDasNegociacoes();

  it("há updates para olhar (o teste não passa às cegas)", () => {
    expect(updates.length).toBeGreaterThan(20);
  });

  it("todo o UPDATE que dá por feito (execucaoEnviadaEm = NOW()) grava o feitoEm no mesmo SET", () => {
    const daoPorFeito = updates.filter((u) => /execucaoEnviadaEm\s*=\s*NOW\(\)/.test(u.sql));
    // o profissional (registarExecucao), a equipa (darPorEntreguePelaClyon) e o cliente (fecho do modelo novo)
    expect(daoPorFeito.length).toBeGreaterThanOrEqual(3);
    for (const u of daoPorFeito) expect(u.sql, u.ficheiro).toContain("${FEITO_EM_AO_DAR_POR_FEITO}");
  });

  it("todo o UPDATE que confirma (confirmadoEm = NOW()) também o grava, se ainda faltar", () => {
    const confirmam = updates.filter((u) => /SET[\s\S]*confirmadoEm\s*=\s*NOW\(\)/.test(u.sql));
    // o cliente/equipa (2 em confirmarExecucao), o prazo e o fecho do modelo novo
    expect(confirmam.length).toBeGreaterThanOrEqual(4);
    for (const u of confirmam) expect(u.sql, u.ficheiro).toContain("${FEITO_EM_AO_CONFIRMAR}");
  });

  it("todo o UPDATE que desfaz o feito (execucaoEnviadaEm = NULL) apaga o feitoEm", () => {
    const desfazem = updates.filter((u) => /execucaoEnviadaEm\s*=\s*NULL/.test(u.sql));
    expect(desfazem.length).toBeGreaterThanOrEqual(2);
    for (const u of desfazem) expect(u.sql, u.ficheiro).toMatch(/feitoEm = NULL|\$\{FEITO_EM_APAGADO\}/);
    // e o reabrir do criarNegociacao (ON DUPLICATE KEY UPDATE, não é um UPDATE negociacoes)
    const db = ler("src/lib/db.ts");
    expect(db).toMatch(/execucaoEnviadaEm = NULL, provaJson = NULL, feitoEm = NULL,\s*\n\s*aCaminhoEm = NULL/);
  });

  it("todo o UPDATE que grava as horas ou a folha (horasFimEm = ?) acerta o feitoEm DEPOIS do fim", () => {
    const horas = updates.filter((u) => /horasFimEm\s*=\s*\?/.test(u.sql));
    expect(horas.length).toBeGreaterThanOrEqual(2);
    for (const u of horas) {
      expect(u.sql, u.ficheiro).toContain("${FEITO_EM_COM_AS_HORAS}");
      expect(u.sql.indexOf("${FEITO_EM_COM_AS_HORAS}")).toBeGreaterThan(u.sql.search(/horasFimEm\s*=\s*\?/));
    }
  });

  it("numa mudança à hora o feito é o fim da folha (horasFimEm), e só depois o agora", async () => {
    const m = await import("./feito-em");
    expect(m.FEITO_EM_AO_DAR_POR_FEITO).toBe("feitoEm = COALESCE(horasFimEm, NOW())");
    expect(m.FEITO_EM_AO_CONFIRMAR).toMatch(/COALESCE\(feitoEm, horasFimEm, execucaoEnviadaEm, NOW\(\)\)/);
  });

  it("a migração é aditiva — uma coluna, e nenhum UPDATE em massa a preenchê-la", () => {
    const db = ler("src/lib/db.ts");
    expect(db).toContain("`ALTER TABLE negociacoes ADD COLUMN feitoEm DATETIME NULL DEFAULT NULL`");
    expect(Number(/const VERSAO_DAS_NEGOCIACOES = (\d+);/.exec(db)?.[1])).toBeGreaterThanOrEqual(22);
    expect(db).not.toMatch(/UPDATE negociacoes SET feitoEm\s*=/);
  });

  it("o histórico do pedido diz quando ficou feito — nas rotas do profissional e da equipa", () => {
    for (const f of [
      "src/app/api/profissionais/trabalho/route.ts",
      "src/app/api/admin/negociacoes/agir/route.ts",
      "src/app/api/admin/trabalhos-clyon/confirmar/route.ts",
    ]) {
      const s = ler(f);
      expect(s, f).toContain("feitoEmDaNegociacao(negociacaoId)");
      expect(s, f).toContain("fraseDoFeitoEm(feitoEm)");
    }
    // em hora de Lisboa: 14/11 18:30 de Lisboa no Inverno = 18:30 UTC
    expect(fraseDoFeitoEm(new Date("2026-11-14T18:30:00Z"))).toBe("Feito a 14/11/2026 · 18:30.");
    // e no Verão (UTC+1)
    expect(fraseDoFeitoEm(new Date("2026-07-01T17:30:00Z"))).toBe("Feito a 01/07/2026 · 18:30.");
  });
});

describe("d36 — a data do trabalho passa a ser a do feito", () => {
  const agora = new Date("2026-11-15T12:00:00Z");

  it("na agenda, um feito com o «feito em» fica no dia e na hora em que foi feito", () => {
    const a = naAgenda(
      {
        dataCombinada: "2026-11-10T09:00:00Z",
        execucaoEnviadaEm: "2026-11-14T20:00:00Z",
        feitoEm: "2026-11-14T18:30:00Z",
      },
      agora,
    );
    expect(a).toMatchObject({ estado: "feito", origem: "feito" });
    expect(a.quando?.toISOString()).toBe("2026-11-14T18:30:00.000Z");
  });

  it("uma data vaga (sem dia) passa a ter o dia do feito", () => {
    const a = naAgenda({ execucaoEnviadaEm: "2026-11-14T20:00:00Z", feitoEm: "2026-11-14T18:30:00Z" }, agora);
    expect(a.quando?.toISOString()).toBe("2026-11-14T18:30:00.000Z");
  });

  it("sem «feito em» (os de antes), tudo como era", () => {
    const a = naAgenda({ dataCombinada: "2026-11-10T09:00:00Z", execucaoEnviadaEm: "2026-11-14T20:00:00Z" }, agora);
    expect(a).toMatchObject({ estado: "feito", origem: "combinada" });
    expect(a.quando?.toISOString()).toBe("2026-11-10T09:00:00.000Z");
  });

  it("o «feito em» de um trabalho por fazer não conta (só um feito tem dia de feito)", () => {
    const a = naAgenda({ dataCombinada: "2026-11-20T09:00:00Z", feitoEm: "2026-11-14T18:30:00Z" }, agora);
    expect(a.estado).toBe("por_vir");
  });

  it("dataDoTrabalho: feito → combinada → pedida", () => {
    expect(dataDoTrabalho({ feitoEm: "2026-11-14 18:30:00", dataCombinada: "2026-11-10 09:00:00" })?.toISOString()).toBe(
      "2026-11-14T18:30:00.000Z",
    );
    expect(dataDoTrabalho({ dataCombinada: "2026-11-10 09:00:00", dataAgendada: "2026-11-09 09:00:00" })?.toISOString()).toBe(
      "2026-11-10T09:00:00.000Z",
    );
    expect(dataDoTrabalho({ dataAgendada: "2026-11-09 09:00:00" })?.toISOString()).toBe("2026-11-09T09:00:00.000Z");
    expect(dataDoTrabalho({})).toBeNull();
  });

  it("as duas agendas, os Pagamentos e as Carteiras lêem o feitoEm", () => {
    expect(ler("src/app/api/admin/agenda/route.ts")).toMatch(/n\.feitoEm/);
    expect(ler("src/app/api/profissionais/meus-pedidos/route.ts")).toMatch(/feitoEm: l\.feitoEm/);
    expect(ler("src/app/profissionais/painel/Agenda.tsx")).toMatch(/if \(p\.feitoEm && ESTADO_DO_FEITO\[p\.fase\]\) return p\.feitoEm;/);
    expect(ler("src/lib/trabalhos-para-gerir.ts")).toMatch(/dataDoTrabalho: iso\(l\.feitoEm\) \?\?/);
    expect(ler("src/app/api/admin/carteiras/route.ts")).toMatch(/l\.feitoEm \?\? l\.execucaoEnviadaEm/);
  });
});

describe("d36 — as comissões contam pelo dia do feito, e o pago congela", () => {
  const linha = (id: number, concluidoEm: string, feitoEm: string | null, extra: Partial<LinhaQueConta> = {}): LinhaQueConta => ({
    id,
    status: "concluido",
    concluidoEm,
    feitoEm,
    valorAcordado: 100,
    ...extra,
  });
  const pagamento = (inicio: string, fim: string, pedidos: number[]): PagamentoDeComissao => ({
    periodoInicio: inicio,
    periodoFim: fim,
    valorTrabalhos: 100 * pedidos.length,
    comissaoPercent: 40,
    valorPago: 4.4 * pedidos.length,
    trabalhos: pedidos.map((pedidoId) => ({
      pedidoId,
      valor: 100,
      fonteDoValor: "acordado" as const,
      lucro: 11,
      comissaoAssistente: 4.4,
      concluidoEm: "2026-11-10T12:00:00.000Z",
      servico: null,
    })),
    pagoEm: "2026-11-16T09:00:00.000Z",
    pagoPor: "admin",
  });
  const periodoDe = (r: ReturnType<typeof comissoesPorPeriodo>, id: number) =>
    r.periodos.find((p) => p.detalhe.some((t) => t.pedidoId === id))?.inicio ?? null;

  it("feito a 14/11 e confirmado a 17/11 conta na quinzena de 1–15/11", () => {
    const r = comissoesPorPeriodo({
      linhas: [linha(1, "2026-11-17T10:00:00Z", "2026-11-14T18:30:00Z")],
      pagamentos: [],
      minhaPercent: 40,
      hoje: "2026-11-20",
    });
    expect(periodoDe(r, 1)).toBe("2026-11-01");
  });

  it("mas nunca para dentro de um período já pago: aí fica no da conclusão", () => {
    const r = comissoesPorPeriodo({
      linhas: [linha(9, "2026-11-10T12:00:00Z", null), linha(1, "2026-11-17T10:00:00Z", "2026-11-14T18:30:00Z")],
      pagamentos: [pagamento("2026-11-01", "2026-11-15", [9])],
      minhaPercent: 40,
      hoje: "2026-11-20",
    });
    expect(periodoDe(r, 1)).toBe("2026-11-16");
    const pago = r.periodos.find((p) => p.inicio === "2026-11-01")!;
    expect(pago.detalhe.map((t) => t.pedidoId)).toEqual([9]);
    expect(pago.diferenca).toBeNull();
  });

  it("um pedido já pago não sai do período em que foi pago, mesmo com o feitoEm noutro", () => {
    const r = comissoesPorPeriodo({
      linhas: [linha(9, "2026-11-10T12:00:00Z", "2026-10-20T12:00:00Z")],
      pagamentos: [pagamento("2026-11-01", "2026-11-15", [9])],
      minhaPercent: 40,
      hoje: "2026-11-20",
    });
    expect(periodoDe(r, 9)).toBe("2026-11-01");
  });

  it("o dia corrigido à mão pelo dono continua a mandar", () => {
    expect(
      diaQueConta({ concluidoEm: "2026-11-02T12:00:00Z", concluidoEmManual: 1, feitoEm: "2026-11-14T18:30:00Z" }),
    ).toBe("2026-11-02");
    expect(diaQueConta({ concluidoEm: "2026-11-17T12:00:00Z", feitoEm: "2026-11-14T23:30:00Z" })).toBe("2026-11-14");
    // sem feitoEm, o da conclusão — e em Lisboa (23:30 UTC de 31/10 no Inverno = 31/10)
    expect(diaQueConta({ concluidoEm: "2026-10-31T23:30:00Z" })).toBe("2026-10-31");
  });

  it("a consulta das comissões lê o feitoEm da negociação confirmada", () => {
    const s = ler("src/lib/assistentes.ts");
    expect(s).toMatch(/pn\.name AS profissional, n\.feitoEm,/);
  });
});
