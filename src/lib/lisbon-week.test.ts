/**
 * Testes de fronteira para o cálculo da semana em Europe/Lisbon.
 * Cobre:
 *  - Semana começa a Segunda e termina a Domingo
 *  - Dia em Lisboa vs UTC (Verão/Inverno)
 *  - DST (transição Março → BST +1h, Outubro → volta a 0h)
 *  - Fronteira meia-noite Lisboa vs UTC
 */

import { describe, it, expect } from "vitest";

const TZ = "Europe/Lisbon";

function lisbonParts(d: Date): { y: number; m: number; d: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wdMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    weekday: wdMap[get("weekday")] ?? 1,
  };
}

function lisbonDateStr(d: Date): string {
  const { y, m, d: dd } = lisbonParts(d);
  return `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function getMonday(d: Date): Date {
  const { y, m, d: dd, weekday } = lisbonParts(d);
  const base = new Date(Date.UTC(y, m - 1, dd, 12, 0, 0));
  base.setUTCDate(base.getUTCDate() - (weekday - 1));
  return base;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

describe("lisbon-week — cálculo de semana em Europe/Lisbon", () => {
  it("segunda-feira de 22 Julho 2026 (quarta-feira) devolve 20 Julho", () => {
    const d = new Date("2026-07-22T10:00:00Z");
    const monday = getMonday(d);
    expect(lisbonDateStr(monday)).toBe("2026-07-20");
  });

  it("Domingo 23:30 Lisboa (Julho, DST) permanece na semana anterior (segunda 20)", () => {
    // 23:30 Lisboa Julho = 22:30 UTC (Lisboa está em BST/UTC+1)
    const sundayLate = new Date("2026-07-26T22:30:00Z"); // Domingo 23:30 Lisboa
    const parts = lisbonParts(sundayLate);
    expect(parts.weekday).toBe(7); // domingo
    const monday = getMonday(sundayLate);
    expect(lisbonDateStr(monday)).toBe("2026-07-20");
  });

  it("Segunda-feira 00:30 Lisboa (Julho) é o próprio dia — segunda 27", () => {
    // 00:30 Lisboa 27 Julho = 23:30 UTC 26 Julho (Lisboa está em BST/UTC+1)
    const mondayEarly = new Date("2026-07-26T23:30:00Z");
    const parts = lisbonParts(mondayEarly);
    expect(parts.weekday).toBe(1); // segunda
    expect(parts.d).toBe(27);
    const monday = getMonday(mondayEarly);
    expect(lisbonDateStr(monday)).toBe("2026-07-27");
  });

  it("Fronteira UTC: 23:30 UTC de Domingo — em Lisboa Inverno é ainda domingo, mas em BST é já segunda", () => {
    // Domingo 15 Fev 2026 23:30 UTC → em Lisboa (WET, UTC+0) = 15 Fev 23:30 domingo
    const winterSunday = new Date("2026-02-15T23:30:00Z");
    expect(lisbonParts(winterSunday).weekday).toBe(7);
    expect(lisbonDateStr(winterSunday)).toBe("2026-02-15");

    // Domingo 26 Jul 2026 23:30 UTC → em Lisboa (WEST, UTC+1) = 27 Jul 00:30 segunda
    const summerSunday = new Date("2026-07-26T23:30:00Z");
    expect(lisbonParts(summerSunday).weekday).toBe(1);
    expect(lisbonDateStr(summerSunday)).toBe("2026-07-27");
  });

  it("DST spring-forward: 29 Março 2026 01:30 UTC = 02:30 Lisboa BST (após salto)", () => {
    // Portugal muda para BST no último domingo de Março às 01:00 UTC → 02:00 Lisboa
    const dstStart = new Date("2026-03-29T01:30:00Z");
    const parts = lisbonParts(dstStart);
    expect(parts.d).toBe(29);
    expect(lisbonDateStr(dstStart)).toBe("2026-03-29");
  });

  it("DST fall-back: 25 Outubro 2026 01:30 UTC = 02:30 Lisboa BST (antes do retorno)", () => {
    // Fim BST no último domingo de Outubro às 01:00 UTC → 01:00 Lisboa
    const dstEnd = new Date("2026-10-25T01:30:00Z");
    const parts = lisbonParts(dstEnd);
    expect(parts.d).toBe(25);
    expect(lisbonDateStr(dstEnd)).toBe("2026-10-25");
  });

  it("Semana completa segunda→domingo: 7 dias sem lacunas nem duplicados", () => {
    const someTuesday = new Date("2026-08-04T09:00:00Z");
    const monday = getMonday(someTuesday);
    const days: string[] = [];
    for (let i = 0; i < 7; i++) days.push(lisbonDateStr(addDays(monday, i)));
    expect(days).toEqual([
      "2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06",
      "2026-08-07", "2026-08-08", "2026-08-09",
    ]);
  });

  it("Semana anterior sem sobreposição: dia 7 da semana anterior ≠ dia 1 da semana actual", () => {
    const someWednesday = new Date("2026-09-16T09:00:00Z");
    const monday = getMonday(someWednesday);
    const prevMonday = addDays(monday, -7);
    const prevSunday = addDays(prevMonday, 6);
    expect(lisbonDateStr(prevSunday)).toBe("2026-09-13");
    expect(lisbonDateStr(monday)).toBe("2026-09-14");
  });

  it("getMonday é idempotente: getMonday(segunda) = mesma segunda", () => {
    const wed = new Date("2026-11-11T14:00:00Z");
    const mon1 = getMonday(wed);
    const mon2 = getMonday(mon1);
    expect(lisbonDateStr(mon1)).toBe(lisbonDateStr(mon2));
    expect(lisbonDateStr(mon1)).toBe("2026-11-09");
  });
});
