import { getPool } from "./db";
import { pausasDoJson, type DadosDoGasto, type Gasto, type Pausa } from "./financas-gastos";

/**
 * OS GASTOS DA CLYON NA BASE — 07-11-2026 (d21). As regras vivem em
 * `financas-gastos.ts`; aqui fica o que fala com o MySQL.
 *
 * Uma tabela só, `financasGastos`, que nasce vazia: os valores são do negócio
 * e metem-se no ecrã — nunca por código, que o repositório é público. As
 * suspensões guardam-se como pausas em JSON, para reactivar não reescrever os
 * meses em que o gasto esteve parado. O mês e o dia em texto (`YYYY-MM`,
 * `YYYY-MM-DD`): são de Lisboa, e um DATE passava pelo fuso da ligação.
 */

let preparacao: Promise<void> | null = null;
function garantirTabela(): Promise<void> {
  preparacao ??= prepararTabela().catch((e) => {
    preparacao = null;
    throw e;
  });
  return preparacao;
}

async function prepararTabela(): Promise<void> {
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS financasGastos (
      id             INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      nome           VARCHAR(80) NOT NULL,
      valor          DECIMAL(12,2) NOT NULL,
      categoriaId    INT UNSIGNED NULL DEFAULT NULL,
      tipo           VARCHAR(12) NOT NULL,
      inicio         CHAR(7) NULL DEFAULT NULL,
      dia            CHAR(10) NULL DEFAULT NULL,
      pausasJson     TEXT NULL,
      notas          VARCHAR(300) NULL DEFAULT NULL,
      criadoPor      VARCHAR(120) NULL DEFAULT NULL,
      actualizadoPor VARCHAR(120) NULL DEFAULT NULL,
      criadoEm       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizadoEm  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_tipo (tipo)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function gastosDaClyon(): Promise<Gasto[]> {
  await garantirTabela();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [linhas] = (await pool.execute(
    `SELECT id, nome, valor, categoriaId, tipo, inicio, dia, pausasJson, notas, criadoPor
       FROM financasGastos
      ORDER BY tipo = 'ocasional', nome, id`,
  )) as [Array<Record<string, unknown>>, unknown];
  return linhas.map((l) => ({
    id: Number(l.id),
    nome: String(l.nome ?? ""),
    valor: Number(l.valor ?? 0),
    categoriaId: l.categoriaId != null ? Number(l.categoriaId) : null,
    tipo: l.tipo === "ocasional" ? "ocasional" : "recorrente",
    inicio: (l.inicio as string) ?? null,
    dia: (l.dia as string) ?? null,
    pausas: pausasDoJson(l.pausasJson),
    notas: (l.notas as string) ?? null,
    criadoPor: (l.criadoPor as string) ?? null,
  }));
}

export async function gastoPorId(id: number): Promise<Gasto | null> {
  return (await gastosDaClyon()).find((g) => g.id === id) ?? null;
}

const valores = (d: DadosDoGasto) => [d.nome, d.valor, d.categoriaId, d.tipo, d.inicio, d.dia, d.notas];

export async function criarGasto(d: DadosDoGasto, quem: string): Promise<number> {
  await garantirTabela();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [r] = (await pool.execute(
    `INSERT INTO financasGastos (nome, valor, categoriaId, tipo, inicio, dia, notas, pausasJson, criadoPor)
     VALUES (?, ?, ?, ?, ?, ?, ?, '[]', ?)`,
    [...valores(d), quem.slice(0, 120)],
  )) as [{ insertId?: number }, unknown];
  return Number(r.insertId ?? 0);
}

/** Muda o que o formulário mostra. As pausas ficam como estavam. */
export async function mudarGasto(id: number, d: DadosDoGasto, quem: string): Promise<boolean> {
  await garantirTabela();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [r] = (await pool.execute(
    `UPDATE financasGastos
        SET nome = ?, valor = ?, categoriaId = ?, tipo = ?, inicio = ?, dia = ?, notas = ?, actualizadoPor = ?
      WHERE id = ?`,
    [...valores(d), quem.slice(0, 120), id],
  )) as [{ affectedRows?: number }, unknown];
  return Number(r.affectedRows ?? 0) > 0;
}

export async function guardarPausas(id: number, pausas: Pausa[], quem: string): Promise<boolean> {
  await garantirTabela();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [r] = (await pool.execute("UPDATE financasGastos SET pausasJson = ?, actualizadoPor = ? WHERE id = ?", [
    JSON.stringify(pausas),
    quem.slice(0, 120),
    id,
  ])) as [{ affectedRows?: number }, unknown];
  return Number(r.affectedRows ?? 0) > 0;
}

export async function eliminarGasto(id: number): Promise<boolean> {
  await garantirTabela();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [r] = (await pool.execute("DELETE FROM financasGastos WHERE id = ?", [id])) as [{ affectedRows?: number }, unknown];
  return Number(r.affectedRows ?? 0) > 0;
}
