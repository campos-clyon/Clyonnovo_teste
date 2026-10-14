import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  OPERADOR_SEM_RESPONSAVEL,
  comissoesPorPeriodo,
  dataDaConclusaoEAproximada,
  instanteDoMeioDiaEmLisboa,
  operadorDoTrabalho,
  resumoEntreDatas,
  type LinhaQueConta,
  type PagamentoDeComissao,
} from "./assistentes";
import { INICIO_DAS_COMISSOES, intervaloValido, periodoDoDia } from "./periodos-de-comissao";
import { diaEmLisboa } from "./hora-de-lisboa";

/**
 * AS COMISSÕES À ESCOLHA — 14-10-2026, o dono:
 *
 *   «Gostaria de poder manipular as datas em que quero o resumo, também
 *   alterar o início do dia 23 para o dia 22/09. Para ser sincero, acho que os
 *   valores e trabalhos contabilizados estão errados.»
 *   «Mostre também quem foi o operador: Miriam ou admin.»
 */

const concluido = (id: number, concluidoEm: string, valor: number, extra: Partial<LinhaQueConta> = {}): LinhaQueConta => ({
  id,
  status: "concluido",
  concluidoEm,
  valorAcordado: valor,
  assignedToName: "MIRIAM",
  ...extra,
});

/*
 * O INÍCIO FOI A 22/09 E VOLTOU A 23/09 NO MESMO DIA — o dono: «Vamos manter
 * apenas após o dia 23.» Fica aqui guardado para ninguém o voltar a mexer sem
 * ele dizer.
 */
describe("o início é 23/09", () => {
  it("o primeiro período começa a 23/09; 22/09 já não conta", () => {
    expect(INICIO_DAS_COMISSOES).toBe("2026-09-23");
    expect(periodoDoDia("2026-09-23")).toEqual({ inicio: "2026-09-23", fim: "2026-10-15" });
    expect(periodoDoDia("2026-09-22")).toBeNull();
  });

  it("um trabalho de 22/09 fica de fora; um de 23/09 conta", () => {
    const r = comissoesPorPeriodo({
      linhas: [concluido(1, "2026-09-22T15:00:00Z", 100), concluido(2, "2026-09-23T15:00:00Z", 100)],
      pagamentos: [],
      minhaPercent: 40,
      hoje: "2026-10-14",
    });
    const primeiro = r.periodos.at(-1)!;
    expect(primeiro).toMatchObject({ inicio: "2026-09-23", trabalhos: 1 });
    expect(primeiro.detalhe.map((t) => t.pedidoId)).toEqual([2]);
  });

  it("os ecrãs dizem o dia pela constante, e não escrito à mão", () => {
    for (const f of [
      "src/components/admin/TrabalhosDoAssistente.tsx",
      "src/components/admin/AdminAssistentesPanel.tsx",
      "src/components/admin/MinhaComissao.tsx",
    ]) {
      const codigo = readFileSync(join(process.cwd(), f), "utf8")
        .split("\n")
        .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
        .join("\n");
      expect(codigo, f).not.toContain("23/09");
      expect(codigo, f).toContain("INICIO_DAS_COMISSOES");
    }
  });
});

describe("o resumo entre duas datas", () => {
  const linhas: LinhaQueConta[] = [
    concluido(1, "2026-09-20T12:00:00Z", 100), // antes do início — mas pode olhar-se
    concluido(2, "2026-10-01T12:00:00Z", 200),
    concluido(3, "2026-10-10T12:00:00Z", 300, { assignedToName: null }),
    concluido(4, "2026-10-20T12:00:00Z", 400),
    concluido(5, "2026-10-05T12:00:00Z", 999, { status: "cancelado" }),
  ];

  it("conta os concluídos cujo dia de Lisboa cai entre as duas datas, as duas incluídas", () => {
    const r = resumoEntreDatas({ linhas, minhaPercent: 40, intervalo: { inicio: "2026-10-01", fim: "2026-10-10" } });
    expect(r.detalhe.map((t) => t.pedidoId)).toEqual([3, 2]);
    expect(r.trabalhos).toBe(2);
    expect(r.valorTrabalhos).toBe(500);
    // 11 % de lucro da CLYON (as taxas de origem), e 40 % disso.
    expect(r.lucro).toBe(55);
    expect(r.comissaoAssistente).toBe(22);
    expect(r.rotulo).toBe("01/10 – 10/10/2026");
  });

  it("antes do início também se pode ver — é uma consulta", () => {
    const r = resumoEntreDatas({ linhas, minhaPercent: 40, intervalo: { inicio: "2026-09-15", fim: "2026-09-30" } });
    expect(r.detalhe.map((t) => t.pedidoId)).toEqual([1]);
  });

  it("diz quantos já estão em períodos pagos", () => {
    const pago: PagamentoDeComissao = {
      periodoInicio: "2026-09-22",
      periodoFim: "2026-10-15",
      valorTrabalhos: 200,
      comissaoPercent: 40,
      valorPago: 8.8,
      trabalhos: [{ pedidoId: 2, valor: 200, fonteDoValor: "acordado", lucro: 22, comissaoAssistente: 8.8, concluidoEm: null, servico: null }],
      pagoEm: null,
      pagoPor: null,
    };
    const r = resumoEntreDatas({
      linhas,
      minhaPercent: 40,
      intervalo: { inicio: "2026-10-01", fim: "2026-10-31" },
      pagamentos: [pago],
    });
    expect(r.emPeriodosPagos).toBe(1);
  });

  it("e quem operou cada trabalho: a assistente, ou o administrador", () => {
    const r = resumoEntreDatas({ linhas, minhaPercent: 40, intervalo: { inicio: "2026-10-01", fim: "2026-10-31" } });
    expect(r.detalhe.find((t) => t.pedidoId === 3)!.operador).toBe(OPERADOR_SEM_RESPONSAVEL);
    expect(r.detalhe.find((t) => t.pedidoId === 2)!.operador).toBe("MIRIAM");
    expect(r.porOperador).toEqual([
      { operador: "MIRIAM", trabalhos: 2, lucro: 66 },
      { operador: "Admin", trabalhos: 1, lucro: 33 },
    ]);
    expect(operadorDoTrabalho({ assignedToName: "  " })).toBe("Admin");
  });
});

describe("as datas validam-se", () => {
  it("duas datas que existem, a primeira antes da segunda, no máximo um ano", () => {
    expect(intervaloValido("2026-09-22", "2026-10-14")).toEqual({ ok: true, intervalo: { inicio: "2026-09-22", fim: "2026-10-14" } });
    expect(intervaloValido("2026-10-14", "2026-10-14").ok).toBe(true);
    expect(intervaloValido("2026-10-14", "2026-09-22").ok).toBe(false);
    expect(intervaloValido("2026-02-30", "2026-03-01").ok).toBe(false);
    expect(intervaloValido("22/09/2026", "2026-10-14").ok).toBe(false);
    expect(intervaloValido(null, "2026-10-14").ok).toBe(false);
    expect(intervaloValido("2025-01-01", "2026-10-14").ok).toBe(false);
  });
});

describe("a data aproximada dos fechados à mão antes de 08/10", () => {
  it("sem negociação e até 08/10: aproximada", () => {
    expect(dataDaConclusaoEAproximada({ id: 1, status: "concluido", concluidoEm: "2026-09-25 10:00:00" })).toBe(true);
  });

  it("com negociação confirmada, a data é a da confirmação — certa", () => {
    expect(
      dataDaConclusaoEAproximada({ id: 1, status: "concluido", concluidoEm: "2026-09-25 10:00:00", valorAcordado: 100 }),
    ).toBe(false);
  });

  it("depois de 08/10 a data é a do fecho — certa", () => {
    expect(dataDaConclusaoEAproximada({ id: 1, status: "concluido", concluidoEm: "2026-10-12 10:00:00" })).toBe(false);
  });

  it("e corrigida à mão deixa de ser aproximada", () => {
    expect(
      dataDaConclusaoEAproximada({ id: 1, status: "concluido", concluidoEm: "2026-09-25 10:00:00", concluidoEmManual: 1 }),
    ).toBe(false);
  });

  it("a correcção fica ao meio-dia de Lisboa do dia escolhido — Verão e Inverno", () => {
    expect(instanteDoMeioDiaEmLisboa("2026-09-15")!.toISOString()).toBe("2026-09-15T11:00:00.000Z");
    expect(instanteDoMeioDiaEmLisboa("2026-12-15")!.toISOString()).toBe("2026-12-15T12:00:00.000Z");
    expect(diaEmLisboa(instanteDoMeioDiaEmLisboa("2026-10-25")!)).toBe("2026-10-25");
  });
});

describe("a rota e o ecrã", () => {
  const ROTA = readFileSync(join(process.cwd(), "src/app/api/admin/assistentes/route.ts"), "utf8");
  const ECRA = readFileSync(join(process.cwd(), "src/components/admin/TrabalhosDoAssistente.tsx"), "utf8");

  it("o intervalo valida-se antes de se ler a base, e a correcção fica no histórico", () => {
    expect(ROTA).toContain("intervaloValido(de, ate)");
    expect(ROTA).toContain("trabalhosDoAssistente(id, intervalo)");
    expect(ROTA).toContain("definirDataDeConclusao(pedidoId, v.intervalo.inicio)");
    expect(ROTA).toContain("Data da conclusão corrigida por");
  });

  it("o ecrã tem o resumo entre datas, o operador e a data aproximada", () => {
    expect(ECRA).toContain("Resumo entre datas");
    expect(ECRA).toContain("<th className=\"py-1 pr-2\">Operador</th>");
    expect(ECRA).toContain("(data aproximada)");
    expect(ECRA).toContain('"Operador",');
  });
});
