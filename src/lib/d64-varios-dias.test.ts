import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  arrumarDias,
  cargasFeitasNoTotal,
  diasDeJson,
  diasDoTrabalho,
  diasParaGravar,
  diasPorExtenso,
  podeDarPorFeitoNoDia,
  ultimoDia,
} from "./varios-dias";
import { naAgenda } from "./agenda-dos-trabalhos";
import { mensagemDeAdjudicacao } from "./mensagem-de-adjudicacao";
import { deveLembrar } from "./lembrete-do-trabalho-de-hoje";

/**
 * d64 (CEO e dono, 18-11-2026): um trabalho em vários dias. O caso real: 6
 * cargas em 3 dias (16, 17 e 18/11, 2 por dia) aparecia só no dia 16 e
 * «atrasado» no dia 17.
 */

// 16/11/2026 às 09:00 de Lisboa (Inverno: UTC+0).
const DIA1 = "2026-11-16T09:00:00.000Z";
const TRES_DIAS = JSON.stringify([
  { inicio: "2026-11-16T09:00", cargasPrevistas: 2 },
  { inicio: "2026-11-17T09:00", cargasPrevistas: 2 },
  { inicio: "2026-11-18T09:00", cargasPrevistas: 2 },
]);
const comDias = arrumarDias(JSON.parse(TRES_DIAS));
const gravado = diasParaGravar(comDias);

describe("d64 — os dias, em hora de Lisboa", () => {
  it("lê «AAAA-MM-DDTHH:MM» como hora de Lisboa (também no Verão)", () => {
    expect(comDias.map((d) => d.dia)).toEqual(["2026-11-16", "2026-11-17", "2026-11-18"]);
    expect(comDias[0].inicio).toBe(DIA1);
    const verao = arrumarDias([{ inicio: "2026-07-01T09:00" }]);
    expect(verao[0].inicio).toBe("2026-07-01T08:00:00.000Z");
  });

  it("um registo por dia, por ordem, e um dia só não se grava (é o dataAgendada de sempre)", () => {
    expect(arrumarDias([{ inicio: "2026-11-18T09:00" }, { inicio: "2026-11-16T10:00" }, { inicio: "2026-11-16T08:00" }]).map((d) => d.dia)).toEqual([
      "2026-11-16",
      "2026-11-18",
    ]);
    expect(diasParaGravar(arrumarDias([{ inicio: "2026-11-16T09:00" }]))).toBeNull();
    expect(diasDeJson("não é json")).toEqual([]);
  });

  it("o primeiro dia é o da data que manda (a combinada, ou a do cliente)", () => {
    const d = diasDoTrabalho({ dataAgendada: DIA1, diasDoTrabalhoJson: gravado });
    expect(d).toHaveLength(3);
    expect(ultimoDia(d)?.dia).toBe("2026-11-18");
    // Compatível com um dia só: sem lista, o dia de sempre.
    expect(diasDoTrabalho({ dataAgendada: DIA1 })).toHaveLength(1);
    expect(diasDoTrabalho({})).toEqual([]);
  });
});

describe("d64 — «atrasado» só depois do ÚLTIMO dia", () => {
  const t = { dataAgendada: DIA1, diasDoTrabalhoJson: gravado };

  it("no dia 17 é «hoje» (dia 2 de 3), e não atrasado", () => {
    const a = naAgenda(t, new Date("2026-11-17T15:00:00Z"));
    expect(a.estado).toBe("hoje");
    expect(a.diaDoTrabalho).toBe(2);
    expect(a.deDias).toBe(3);
  });

  it("no dia 18 às 13h ainda não, às 23h do dia 18 sim (3 h depois da hora)", () => {
    expect(naAgenda(t, new Date("2026-11-18T10:00:00Z")).estado).toBe("hoje");
    expect(naAgenda(t, new Date("2026-11-18T23:00:00Z")).estado).toBe("atrasado");
  });

  it("no dia 19, atrasado há 1 dia — contado do último", () => {
    const a = naAgenda(t, new Date("2026-11-19T10:00:00Z"));
    expect(a.estado).toBe("atrasado");
    expect(a.diasDeAtraso).toBe(1);
  });

  it("antes de começar, por vir; e um dia só como sempre", () => {
    expect(naAgenda(t, new Date("2026-11-15T10:00:00Z")).estado).toBe("por_vir");
    expect(naAgenda({ dataAgendada: DIA1 }, new Date("2026-11-17T10:00:00Z")).estado).toBe("atrasado");
  });

  it("dado por feito, feito — em qualquer dia", () => {
    expect(naAgenda({ ...t, execucaoEnviadaEm: "2026-11-18T18:00:00Z" }, new Date("2026-11-19T10:00:00Z")).estado).toBe("feito");
  });

  it("o lembrete do dia chega ao profissional em cada um dos dias", () => {
    expect(deveLembrar(t, new Date("2026-11-17T08:00:00Z")).lembrar).toBe(true);
  });
});

describe("d64 — o profissional dá por feito só no fim, e regista as cargas por dia", () => {
  it("antes do último dia, não; no último, sim; num dia só, como sempre", () => {
    const d = diasDoTrabalho({ dataAgendada: DIA1, diasDoTrabalhoJson: gravado });
    expect(podeDarPorFeitoNoDia(d, new Date("2026-11-17T18:00:00Z"))).toBe(false);
    expect(podeDarPorFeitoNoDia(d, new Date("2026-11-18T18:00:00Z"))).toBe(true);
    expect(podeDarPorFeitoNoDia(diasDoTrabalho({ dataAgendada: DIA1 }), new Date("2026-11-10T10:00:00Z"))).toBe(true);
  });

  it("o total das cargas é a soma das de cada dia", () => {
    const d = arrumarDias([
      { inicio: "2026-11-16T09:00", cargasFeitas: 2 },
      { inicio: "2026-11-17T09:00", cargasFeitas: 2 },
      { inicio: "2026-11-18T09:00", cargasFeitas: 1.5 },
    ]);
    expect(cargasFeitasNoTotal(d)).toBe(5.5);
    expect(cargasFeitasNoTotal(comDias)).toBeNull();
  });

  it("a rota do «está feito» recusa antes do último dia", () => {
    const rota = readFileSync(join(process.cwd(), "src/app/api/profissionais/trabalho/route.ts"), "utf8");
    expect(rota).toContain("podeDarPorFeitoNoDia(");
  });
});

describe("d64 — ao cliente, os dias por extenso", () => {
  it("seguidos no mesmo mês, seguidos entre meses, soltos, e um dia só", () => {
    expect(diasPorExtenso(["2026-11-16", "2026-11-17", "2026-11-18"])).toBe("de segunda, 16, a quarta, 18 de novembro");
    expect(diasPorExtenso(["2026-11-30", "2026-12-01"])).toBe("de segunda, 30 de novembro, a terça, 1 de dezembro");
    expect(diasPorExtenso(["2026-11-16", "2026-11-18", "2026-11-20"])).toBe("segunda, 16, quarta, 18 e sexta, 20 de novembro");
    expect(diasPorExtenso(["2026-11-16"])).toBe("segunda, 16 de novembro");
  });

  it("a adjudicação diz os dias todos", () => {
    const m = mensagemDeAdjudicacao(
      { cliente: "Ana", quando: DIA1, servico: "esvaziamento_casa", dias: diasDoTrabalho({ dataAgendada: DIA1, diasDoTrabalhoJson: gravado }) },
      new Date("2026-11-10T10:00:00Z"),
    );
    expect(m).toContain("fica marcado de segunda, 16, a quarta, 18 de novembro.");
  });
});
