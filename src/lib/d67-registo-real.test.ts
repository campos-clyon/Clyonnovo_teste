import { describe, expect, it } from "vitest";
import { horasDoDia, horasFeitas, lerDiaReal, lerRegistoReal, pausaEmMinutos, registoRealEmPalavras } from "./registo-real";
import { naAgenda } from "./agenda-dos-trabalhos";
import { lerCorpoDaFolhaFinal } from "./folha-final";
import { oQueMudouDaFolha } from "./valor-final-ao-cliente";

/**
 * d67 (CEO e dono, 18-11-2026): o plano e o que aconteceu. O #591 estava
 * marcado para 16/11 às 13:00 e foi feito a 17/11 das 13:00 às 19:00.
 */
const DO_591 = { dia: "2026-11-17", inicio: "13:00", fim: "19:00", pausa: "1 h" };

describe("d67 — horas = fim − início − pausa, em hora de Lisboa", () => {
  it("o #591: 13:00–19:00 com 1 h de pausa → 5 h", () => {
    const r = lerDiaReal(DO_591);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.dia.inicio).toBe("2026-11-17T13:00:00.000Z");
    expect(horasDoDia(r.dia)).toBe(5);
    expect(registoRealEmPalavras([r.dia])).toBe("feito a 17/11, das 13h às 19h, 1 h de pausa → 5 h");
  });

  it("a pausa é um só valor: duas de 30 min = 1 h; escrita de várias maneiras", () => {
    for (const p of ["1 h", "60", "1:00", "1h00", "60 min"]) expect(pausaEmMinutos(p), p).toBe(60);
    expect(pausaEmMinutos("")).toBe(0);
    expect(pausaEmMinutos("muito")).toBeNaN();
  });

  it("vários dias somam-se", () => {
    const r = lerRegistoReal([
      { dia: "2026-11-16", inicio: "09:00", fim: "17:00", pausa: "1 h" },
      { dia: "2026-11-17", inicio: "09:00", fim: "13:30", pausa: "" },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(horasFeitas(r.dias)).toBe(11.5);
    expect(registoRealEmPalavras(r.dias)).toContain("total 11,5 h");
  });

  it("Lisboa na mudança de hora: a noite de 25/10/2026 tem 25 horas", () => {
    const r = lerDiaReal({ dia: "2026-10-25", inicio: "00:30", fim: "03:30", pausa: "0" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(horasDoDia(r.dia)).toBe(4);
    // No Verão, 13:00 de Lisboa são 12:00 UTC.
    const v = lerDiaReal({ dia: "2026-07-01", inicio: "13:00", fim: "14:00" });
    expect(v.ok && v.dia.inicio).toBe("2026-07-01T12:00:00.000Z");
  });

  it("recusa o que não faz sentido", () => {
    expect(lerDiaReal({ dia: "2026-11-17", inicio: "13:00", fim: "13:00" }).ok).toBe(false);
    expect(lerDiaReal({ dia: "2026-11-17", inicio: "13:00", fim: "14:00", pausa: "2 h" }).ok).toBe(false);
    expect(lerDiaReal({ dia: "2026-11-17", inicio: "", fim: "14:00" }).ok).toBe(false);
  });
});

describe("d67 — a Agenda: plano ≠ realidade", () => {
  const registo = JSON.stringify([{ dia: "2026-11-17", inicio: "2026-11-17T13:00:00.000Z", fim: "2026-11-17T19:00:00.000Z", pausaMin: 60 }]);

  it("feito, o bloco é o real (17/11 às 13h), e não o plano (16/11)", () => {
    const a = naAgenda(
      { dataAgendada: "2026-11-16T13:00:00Z", execucaoEnviadaEm: "2026-11-17T19:30:00Z", registoRealJson: registo },
      new Date("2026-11-18T10:00:00Z"),
    );
    expect(a.estado).toBe("feito");
    expect(a.quando?.toISOString()).toBe("2026-11-17T13:00:00.000Z");
  });

  it("«atrasado» só enquanto não há início registado e o plano já passou", () => {
    const agora = new Date("2026-11-18T10:00:00Z");
    expect(naAgenda({ dataAgendada: "2026-11-16T13:00:00Z" }, agora).estado).toBe("atrasado");
    expect(naAgenda({ dataAgendada: "2026-11-16T13:00:00Z", registoRealJson: registo }, agora).estado).not.toBe("atrasado");
  });
});

describe("d67 — a folha final pede início, fim e pausa, e continua a ler as folhas antigas", () => {
  const base = { pessoas: 2, deslocacaoTipo: "euros", deslocacaoEuros: "0" };

  it("com o registo real, as horas calculam-se e o histórico guarda-o", () => {
    const r = lerCorpoDaFolhaFinal({ ...base, registoReal: [DO_591] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entrada.horas).toBe(5);
    expect(r.entrada.registoReal?.[0].pausaMin).toBe(60);
  });

  it("uma folha antiga (só horas) continua igual", () => {
    const r = lerCorpoDaFolhaFinal({ ...base, horas: "6,5" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.entrada.horas).toBe(6.5);
      expect(r.entrada.registoReal).toBeUndefined();
    }
  });

  it("a mensagem do valor final diz o que aconteceu", () => {
    const r = lerCorpoDaFolhaFinal({ ...base, registoReal: [DO_591] });
    if (!r.ok) throw new Error(r.erro);
    expect(oQueMudouDaFolha(r.entrada)).toContain("feito a 17/11, das 13h às 19h, 1 h de pausa → 5 h, com uma equipa de 2 pessoas");
  });
});
