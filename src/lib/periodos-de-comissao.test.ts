import { describe, it, expect } from "vitest";
import {
  estadoDoPeriodo,
  periodoDoDia,
  periodosAte,
  rotuloDoPeriodo,
} from "./periodos-de-comissao";

/**
 * *«Do dia 23/09 ao 15/10, depois a próxima contagem vai até ao final do mês,
 * 31/10, depois 15/11, até 30/11, a 15/12, a 31/12, etc.»* — 08-10-2026.
 */

describe("o período de cada dia", () => {
  it("antes de 23/09/2026 não há período: esses já estão acertados", () => {
    expect(periodoDoDia("2026-09-22")).toBeNull();
    expect(periodoDoDia("2025-12-31")).toBeNull();
  });

  it("o primeiro vai de 23/09 a 15/10, com as duas pontas", () => {
    const primeiro = { inicio: "2026-09-23", fim: "2026-10-15" };
    expect(periodoDoDia("2026-09-23")).toEqual(primeiro);
    expect(periodoDoDia("2026-09-30")).toEqual(primeiro);
    expect(periodoDoDia("2026-10-01")).toEqual(primeiro);
    expect(periodoDoDia("2026-10-15")).toEqual(primeiro);
  });

  it("depois, quinzenas: de 16 ao fim do mês, e de 1 a 15", () => {
    expect(periodoDoDia("2026-10-16")).toEqual({ inicio: "2026-10-16", fim: "2026-10-31" });
    expect(periodoDoDia("2026-10-31")).toEqual({ inicio: "2026-10-16", fim: "2026-10-31" });
    expect(periodoDoDia("2026-11-01")).toEqual({ inicio: "2026-11-01", fim: "2026-11-15" });
    expect(periodoDoDia("2026-11-15")).toEqual({ inicio: "2026-11-01", fim: "2026-11-15" });
    expect(periodoDoDia("2026-11-16")).toEqual({ inicio: "2026-11-16", fim: "2026-11-30" });
    expect(periodoDoDia("2026-12-31")).toEqual({ inicio: "2026-12-16", fim: "2026-12-31" });
  });

  it("o fim do mês é o verdadeiro — Fevereiro incluído, e o bissexto", () => {
    expect(periodoDoDia("2027-02-20")).toEqual({ inicio: "2027-02-16", fim: "2027-02-28" });
    expect(periodoDoDia("2028-02-29")).toEqual({ inicio: "2028-02-16", fim: "2028-02-29" });
  });

  it("um dia mal escrito não cai em período nenhum", () => {
    expect(periodoDoDia("16/10/2026")).toBeNull();
    expect(periodoDoDia("")).toBeNull();
  });
});

describe("a lista dos períodos", () => {
  it("do mais recente para o primeiro, sem buracos nem sobreposições", () => {
    const lista = periodosAte("2026-11-02");
    expect(lista).toEqual([
      { inicio: "2026-11-01", fim: "2026-11-15" },
      { inicio: "2026-10-16", fim: "2026-10-31" },
      { inicio: "2026-09-23", fim: "2026-10-15" },
    ]);
  });

  it("um ano de quinzenas encadeia-se dia a dia", () => {
    const lista = periodosAte("2027-12-31").reverse();
    for (let i = 1; i < lista.length; i++) {
      const fimAnterior = new Date(`${lista[i - 1].fim}T00:00:00Z`);
      fimAnterior.setUTCDate(fimAnterior.getUTCDate() + 1);
      expect(lista[i].inicio).toBe(fimAnterior.toISOString().slice(0, 10));
    }
    expect(lista.at(-1)).toEqual({ inicio: "2027-12-16", fim: "2027-12-31" });
  });

  it("antes de começar, não há nada", () => {
    expect(periodosAte("2026-09-22")).toEqual([]);
  });
});

describe("o estado de um período", () => {
  const p = { inicio: "2026-10-16", fim: "2026-10-31" };
  it("em curso até ao último dia, inclusive", () => {
    expect(estadoDoPeriodo(p, "2026-10-31", false)).toBe("em_curso");
  });
  it("por pagar a partir do dia seguinte", () => {
    expect(estadoDoPeriodo(p, "2026-11-01", false)).toBe("por_pagar");
  });
  it("pago é pago, esteja em que dia estiver", () => {
    expect(estadoDoPeriodo(p, "2026-11-20", true)).toBe("pago");
  });
});

describe("o rótulo", () => {
  it("lê-se como se diz", () => {
    expect(rotuloDoPeriodo({ inicio: "2026-09-23", fim: "2026-10-15" })).toBe("23/09 – 15/10/2026");
    expect(rotuloDoPeriodo({ inicio: "2026-12-16", fim: "2026-12-31" })).toBe("16/12 – 31/12/2026");
  });
});
