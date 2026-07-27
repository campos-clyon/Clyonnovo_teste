import { describe, it, expect } from "vitest";
import { DEPENDENCIAS, gerarSqlVerificacao } from "./contrato-dependencias";

describe("DEPENDENCIAS — a lista é o contrato, não uma nota", () => {
  it("não tem entradas repetidas", () => {
    const nomes = DEPENDENCIAS.map((d) => d.nome);
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  it("cada dependência diz onde parte se desaparecer", () => {
    for (const d of DEPENDENCIAS) {
      expect(d.usadoEm.length, `${d.nome} sem explicação de uso`).toBeGreaterThan(10);
    }
  });

  it("só funções declaram argumentos", () => {
    for (const d of DEPENDENCIAS) {
      if (d.argumentos) expect(d.tipo, `${d.nome}`).toBe("funcao");
      if (d.colunas) expect(d.tipo, `${d.nome}`).not.toBe("funcao");
    }
  });

  // Os três enganos que custaram tempo real ficam fixados aqui: se alguém
  // voltar a escrever `name` ou a esquecer `user_id`, o teste cai.
  it("profiles pede full_name, não name", () => {
    const p = DEPENDENCIAS.find((d) => d.nome === "profiles");
    expect(p?.colunas).toContain("full_name");
    expect(p?.colunas).not.toContain("name");
  });

  it("partner_profiles distingue id de user_id", () => {
    const p = DEPENDENCIAS.find((d) => d.nome === "partner_profiles");
    expect(p?.colunas).toContain("id");
    expect(p?.colunas).toContain("user_id");
  });

  it("painel_confirmar_pagamento fixa os nomes dos argumentos", () => {
    const f = DEPENDENCIAS.find((d) => d.nome === "painel_confirmar_pagamento");
    expect(f?.argumentos).toEqual(["_reference", "_staff", "_amount", "_paid_at", "_notes"]);
  });
});

describe("gerarSqlVerificacao", () => {
  const sql = gerarSqlVerificacao();

  it("cobre todas as dependências declaradas", () => {
    for (const d of DEPENDENCIAS) expect(sql).toContain(`'${d.nome}'`);
  });

  it("é só de leitura — nada que altere a base", () => {
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT)\b/i);
  });

  it("separa relações de funções nos catálogos certos", () => {
    expect(sql).toContain("information_schema.columns");
    expect(sql).toContain("pg_proc");
    expect(sql).toContain("proargnames");
  });

  it("escapa plicas para não partir a consulta", () => {
    const s = gerarSqlVerificacao([
      { nome: "t", tipo: "tabela", colunas: ["c"], usadoEm: "onde o cliente n'aparece" },
    ]);
    expect(s).toContain("n''aparece");
  });

  it("aguenta uma dependência sem colunas nem argumentos", () => {
    const s = gerarSqlVerificacao([{ nome: "f", tipo: "funcao", usadoEm: "uma função qualquer" }]);
    expect(s).toContain("ARRAY[]::text[]");
  });
});
