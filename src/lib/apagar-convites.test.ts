import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Apagar vários convites de uma vez.
 *
 * "Coloque a opção marcar vários aqui, quero poder apagar vários"
 * — 15-09-2026.
 *
 * Havia só «Anular», que marca a data e deixa o convite na lista: dos oito
 * que lá estavam, seis eram de gente inscrita havia semanas e não havia
 * maneira de os tirar da frente.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const DB = ler("src/lib/db.ts");
const ROTA = ler("src/app/api/admin/convites/route.ts");
const PAINEL = ler("src/components/admin/AdminConvitesPanel.tsx");

describe("a base apaga, e apaga só o convite", () => {
  it("é um DELETE, não mais uma marca por cima", () => {
    const i = DB.indexOf("export async function apagarConvites");
    expect(i).toBeGreaterThan(-1);
    const corpo = DB.slice(i, i + 1200);
    expect(corpo).toContain("DELETE FROM convitesProfissionais");
    expect(corpo).toContain("WHERE id IN (");
  });

  it("os ids entram por marcas, não colados à instrução", () => {
    const i = DB.indexOf("export async function apagarConvites");
    const corpo = DB.slice(i, i + 1200);
    expect(corpo).toContain('.map(() => "?")');
    expect(corpo).toMatch(/Number\.isInteger/);
  });

  it("não toca na tabela dos profissionais", () => {
    const i = DB.indexOf("export async function apagarConvites");
    const corpo = DB.slice(i, i + 1200);
    expect(corpo).not.toMatch(/DELETE FROM providers|DELETE FROM profissionais/i);
  });
});

describe("a rota responde ao conjunto, não a cada um", () => {
  it("aceita uma lista de ids", () => {
    expect(ROTA).toContain('corpo.accao === "apagar"');
    expect(ROTA).toContain("Array.isArray(corpo.ids)");
  });

  it("diz quantos saíram", () => {
    expect(ROTA).toContain("apagados");
  });

  it("tem tecto, para um «marcar todos» não virar uma consulta sem fim", () => {
    expect(ROTA).toContain("MAXIMO_A_APAGAR");
    expect(ROTA).toMatch(/const MAXIMO_A_APAGAR = \d+/);
  });
});

describe("o painel deixa marcar, e pergunta antes de apagar", () => {
  it("cada linha tem a sua caixa", () => {
    expect(PAINEL).toContain("checked={marcados.has(c.id)}");
    expect(PAINEL).toContain("onChange={() => alternar(c.id)}");
  });

  it("e há marcar todos", () => {
    expect(PAINEL).toContain("onChange={marcarTodos}");
    expect(PAINEL).toContain("Desmarcar todos");
  });

  it("a barra só existe com algo marcado", () => {
    expect(PAINEL).toContain("{marcados.size > 0 && (");
  });

  it("pergunta antes, e diz que o profissional fica", () => {
    expect(PAINEL).toContain("confirm(");
    expect(PAINEL).toContain("continua registado");
  });

  it("limpa a selecção depois de apagar, para não ficarem ids de linhas que já não existem", () => {
    const i = PAINEL.indexOf("async function apagarMarcados");
    const corpo = PAINEL.slice(i, i + 1600);
    expect(corpo).toContain("setMarcados(new Set())");
    expect(corpo).toContain("await carregar()");
  });
});
