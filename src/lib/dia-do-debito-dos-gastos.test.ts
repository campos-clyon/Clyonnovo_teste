import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Categoria } from "./financas";
import {
  debitoNoMes,
  debitosEntre,
  diaEmNumeros,
  lerGasto,
  proximoDebito,
  proximosDebitos,
  type Gasto,
} from "./financas-gastos";

/**
 * O DIA DO DÉBITO DOS GASTOS RECORRENTES — 26-11-2026 (dono). Valores e nomes
 * inventados: os reais vivem só na base.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

function gasto(p: Partial<Gasto>): Gasto {
  return {
    id: 1,
    nome: "Assinatura inventada",
    valor: 10,
    categoriaId: null,
    tipo: "recorrente",
    inicio: "2026-01",
    dia: null,
    diaDoDebito: 15,
    pausas: [],
    notas: null,
    criadoPor: null,
    ...p,
  };
}

const CATEGORIAS: Categoria[] = [{ id: 1, nome: "Serviços", tipo: "despesa", cor: "azul", icone: "servicos", sistema: null }];

describe("o dia do débito num mês", () => {
  it("cai no dia escolhido quando o mês o tem", () => {
    expect(debitoNoMes(25, "2026-12")).toBe("2026-12-25");
    expect(debitoNoMes(31, "2026-12")).toBe("2026-12-31");
    expect(debitoNoMes(1, "2026-11")).toBe("2026-11-01");
  });
  it("31 num mês de 30 é o último dia", () => {
    expect(debitoNoMes(31, "2026-11")).toBe("2026-11-30");
    expect(debitoNoMes(31, "2026-04")).toBe("2026-04-30");
  });
  it("Fevereiro: 28 num ano normal, 29 num bissexto", () => {
    expect(debitoNoMes(30, "2027-02")).toBe("2027-02-28");
    expect(debitoNoMes(31, "2028-02")).toBe("2028-02-29");
    expect(debitoNoMes(29, "2027-02")).toBe("2027-02-28");
  });
  it("mostra-se em números", () => {
    expect(diaEmNumeros("2026-12-25")).toBe("25/12/2026");
  });
});

describe("o próximo débito", () => {
  it("ainda este mês, se o dia não passou; hoje conta", () => {
    expect(proximoDebito(gasto({ diaDoDebito: 28 }), "2026-11-26")).toBe("2026-11-28");
    expect(proximoDebito(gasto({ diaDoDebito: 26 }), "2026-11-26")).toBe("2026-11-26");
  });
  it("no mês seguinte, se o dia já passou", () => {
    expect(proximoDebito(gasto({ diaDoDebito: 25 }), "2026-11-26")).toBe("2026-12-25");
    expect(proximoDebito(gasto({ diaDoDebito: 2 }), "2026-11-26")).toBe("2026-12-02");
  });
  it("fim de mês e passagem de ano", () => {
    expect(proximoDebito(gasto({ diaDoDebito: 31 }), "2026-11-30")).toBe("2026-11-30");
    expect(proximoDebito(gasto({ diaDoDebito: 31 }), "2026-12-31")).toBe("2026-12-31");
    expect(proximoDebito(gasto({ diaDoDebito: 10 }), "2026-12-31")).toBe("2027-01-10");
  });
  it("31 em Fevereiro cai a 28", () => {
    expect(proximoDebito(gasto({ diaDoDebito: 31 }), "2027-02-01")).toBe("2027-02-28");
    expect(proximoDebito(gasto({ diaDoDebito: 31 }), "2027-01-31")).toBe("2027-01-31");
  });
  it("não antes do mês de início", () => {
    expect(proximoDebito(gasto({ diaDoDebito: 5, inicio: "2027-03" }), "2026-11-26")).toBe("2027-03-05");
  });
  it("em pausa não há débito; com a volta marcada, o primeiro depois dela", () => {
    expect(proximoDebito(gasto({ pausas: [{ de: "2026-11", ate: null }] }), "2026-11-26")).toBeNull();
    expect(proximoDebito(gasto({ diaDoDebito: 5, pausas: [{ de: "2026-11", ate: "2027-02" }] }), "2026-11-26")).toBe("2027-02-05");
  });
  it("sem dia do débito, ou ocasional, não há próximo", () => {
    expect(proximoDebito(gasto({ diaDoDebito: null }), "2026-11-26")).toBeNull();
    expect(proximoDebito(gasto({ tipo: "ocasional", inicio: null, dia: "2026-12-01" }), "2026-11-26")).toBeNull();
  });
});

describe("os próximos débitos (30 dias)", () => {
  const lista = [
    gasto({ id: 1, nome: "B", valor: 12.5, diaDoDebito: 2 }),
    gasto({ id: 2, nome: "A", valor: 7.25, diaDoDebito: 20 }),
    gasto({ id: 3, nome: "Parado", valor: 99, diaDoDebito: 1, pausas: [{ de: "2026-10", ate: null }] }),
    gasto({ id: 4, nome: "Sem dia", valor: 50, diaDoDebito: null }),
    gasto({ id: 5, nome: "Longe", valor: 3, diaDoDebito: 27 }),
  ];
  it("por data, com o total; os suspensos e os sem dia ficam de fora", () => {
    const r = proximosDebitos(lista, "2026-11-26", 30);
    expect(r.debitos.map((d) => [d.dia, d.gasto.nome])).toEqual([
      ["2026-11-27", "Longe"],
      ["2026-12-02", "B"],
      ["2026-12-20", "A"],
    ]);
    expect(r.total).toBe(22.75);
  });
  it("o mesmo gasto pode cair duas vezes em 30 dias (Fevereiro)", () => {
    const r = proximosDebitos([gasto({ diaDoDebito: 1 })], "2027-02-01", 30);
    expect(r.debitos.map((d) => d.dia)).toEqual(["2027-02-01", "2027-03-01"]);
    expect(r.total).toBe(20);
  });
  it("debitosEntre respeita o intervalo", () => {
    expect(debitosEntre(gasto({ diaDoDebito: 31 }), "2026-11-01", "2027-02-28")).toEqual([
      "2026-11-30",
      "2026-12-31",
      "2027-01-31",
      "2027-02-28",
    ]);
  });
});

describe("o formulário", () => {
  it("o dia do débito é opcional e vai de 1 a 31", () => {
    const base = { nome: "X", valor: "10,00", tipo: "recorrente", inicio: "2026-11" };
    expect(lerGasto(base, CATEGORIAS)).toMatchObject({ ok: true, dados: { diaDoDebito: null } });
    expect(lerGasto({ ...base, diaDoDebito: "" }, CATEGORIAS)).toMatchObject({ ok: true, dados: { diaDoDebito: null } });
    expect(lerGasto({ ...base, diaDoDebito: "25" }, CATEGORIAS)).toMatchObject({ ok: true, dados: { diaDoDebito: 25 } });
    expect(lerGasto({ ...base, diaDoDebito: 31 }, CATEGORIAS)).toMatchObject({ ok: true, dados: { diaDoDebito: 31 } });
    expect(lerGasto({ ...base, diaDoDebito: 0 }, CATEGORIAS)).toMatchObject({ ok: false });
    expect(lerGasto({ ...base, diaDoDebito: 32 }, CATEGORIAS)).toMatchObject({ ok: false });
    expect(lerGasto({ ...base, diaDoDebito: "2,5" }, CATEGORIAS)).toMatchObject({ ok: false });
  });
  it("num ocasional não se guarda dia do débito", () => {
    expect(
      lerGasto({ nome: "X", valor: "10,00", tipo: "ocasional", dia: "2026-11-20", diaDoDebito: 5 }, CATEGORIAS),
    ).toMatchObject({ ok: true, dados: { diaDoDebito: null } });
  });
});

describe("na base e no ecrã", () => {
  it("a coluna nasce por ALTER, em try/catch, e lê-se e grava-se", () => {
    const base = ler("src/lib/financas-gastos-na-base.ts");
    expect(base).toContain("ALTER TABLE financasGastos ADD COLUMN diaDoDebito TINYINT UNSIGNED NULL DEFAULT NULL");
    expect(base).toMatch(/SELECT id, nome, valor, categoriaId, tipo, inicio, dia, diaDoDebito,/);
    expect(base).toContain("dia = ?, diaDoDebito = ?, notas = ?");
    expect(base).toContain("(nome, valor, categoriaId, tipo, inicio, dia, diaDoDebito, notas, pausasJson, criadoPor)");
  });
  it("a lista diz o dia e o próximo débito; o painel tem os próximos 30 dias", () => {
    const lista = ler("src/components/admin/financas/GastosDaClyon.tsx");
    expect(lista).toContain("debita a {g.diaDoDebito} de cada mês");
    expect(lista).toContain("próximo: ");
    expect(lista).toContain("Dia do débito (opcional)");
    const painel = ler("src/components/admin/financas/ResumoDasFinancas.tsx");
    expect(painel).toContain("Próximos débitos (30 dias)");
    expect(painel).toContain("proximosDebitos(gastos, hoje, 30)");
  });
});
