import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * As chaves passadas a updateSimulatorOrder vão para a lista de COLUNAS do
 * SQL, e uma consulta preparada parametriza valores, não identificadores.
 * O PATCH de /api/admin/pedidos passa o corpo do pedido praticamente
 * intacto — a lista de permitidos é o que impede que um nome de coluna
 * inventado acrescente SQL à instrução.
 *
 * Este teste falha se a lista deixar de cobrir o tipo. Sem isso, um campo
 * novo no tipo passava a ser ignorado em silêncio e alguém iria "arranjar"
 * o problema tirando o filtro.
 */
const db = readFileSync(join(process.cwd(), "src/lib/db.ts"), "utf8");

function listaDePermitidos(): string[] {
  const bloco = db.slice(
    db.indexOf("const COLUNAS_PEDIDO_EDITAVEIS = new Set<string>(["),
    db.indexOf("export async function updateSimulatorOrder("),
  );
  return [...bloco.matchAll(/"(\w+)"/g)].map((m) => m[1]);
}

function camposDoTipo(): string[] {
  const inicio = db.indexOf("export async function updateSimulatorOrder(");
  const bloco = db.slice(inicio, db.indexOf("await ensureSimulatorOrdersTable();", inicio));
  return [...bloco.matchAll(/^ {4}(\w+)\??:/gm)].map((m) => m[1]);
}

describe("COLUNAS_PEDIDO_EDITAVEIS", () => {
  it("existe e não está vazia", () => {
    expect(listaDePermitidos().length).toBeGreaterThan(20);
  });

  it("cobre todos os campos que o tipo aceita", () => {
    const permitidos = new Set(listaDePermitidos());
    const emFalta = camposDoTipo().filter((c) => !permitidos.has(c));
    expect(emFalta, `campos no tipo mas fora da lista: ${emFalta.join(", ")}`).toEqual([]);
  });

  it("não tem nomes a mais que o tipo não conheça", () => {
    const doTipo = new Set(camposDoTipo());
    const aMais = listaDePermitidos().filter((c) => !doTipo.has(c));
    expect(aMais, `na lista mas fora do tipo: ${aMais.join(", ")}`).toEqual([]);
  });

  it("o UPDATE filtra mesmo pela lista antes de construir o SQL", () => {
    expect(db).toContain("COLUNAS_PEDIDO_EDITAVEIS.has(k)");
  });

  it("nenhuma palavra-passe por omissão ficou no código", () => {
    expect(db).not.toContain("wanderson2026");
    expect(db).not.toMatch(/bcrypt\.hash\("[^"]+"/);
  });
});
