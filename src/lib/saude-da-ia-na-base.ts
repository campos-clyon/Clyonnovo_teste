/**
 * A ESCRITA DO TERMÓMETRO DA IA — ver `saude-da-ia.ts`. 27-10-2026 (d7).
 *
 * Uma tabela nova e aditiva, `saudeDaIa`, uma linha por uso. NUNCA ATIRA: um
 * termómetro avariado não pode calar o tradutor nem a Vitória.
 */
import { getPool } from "./db";
import { eUsoDaIa, USOS_DA_IA, type FalhaDaIa, type UsoDaIa } from "./saude-da-ia";

let tabelaPronta = false;

async function garantirTabela(): Promise<boolean> {
  const pool = await getPool();
  if (!pool) return false;
  if (tabelaPronta) return true;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS saudeDaIa (
      uso           VARCHAR(30) NOT NULL PRIMARY KEY,
      falhouEm      DATETIME NULL,
      motivo        VARCHAR(400) NULL,
      falhasDesdeOk INT UNSIGNED NOT NULL DEFAULT 0,
      okEm          DATETIME NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tabelaPronta = true;
  return true;
}

/**
 * Quando cada uso correu bem pela última vez NESTE processo — para não
 * escrever na base a cada tradução que corre bem. Uma falha apaga a memória,
 * e a primeira que corra bem a seguir limpa a linha.
 */
const okNesteProcesso = new Map<UsoDaIa, number>();
const MS_ENTRE_OKS = 10 * 60 * 1000;

/**
 * Anota a última passagem de um uso: `motivo = null` correu bem; um texto
 * falhou (e soma `quantas` às falhas desde a última que correu bem).
 */
export async function anotarSaudeDaIa(uso: UsoDaIa, motivo: string | null, quantas = 1): Promise<void> {
  try {
    if (!eUsoDaIa(uso)) return;
    if (motivo == null) {
      const ultimo = okNesteProcesso.get(uso);
      if (ultimo != null && Date.now() - ultimo < MS_ENTRE_OKS) return;
    } else {
      okNesteProcesso.delete(uso);
    }
    if (!(await garantirTabela())) return;
    const pool = await getPool();
    if (!pool) return;
    if (motivo == null) {
      await pool.execute(
        `INSERT INTO saudeDaIa (uso, okEm) VALUES (?, NOW())
         ON DUPLICATE KEY UPDATE okEm = NOW(), falhouEm = NULL, motivo = NULL, falhasDesdeOk = 0`,
        [uso],
      );
      okNesteProcesso.set(uso, Date.now());
      return;
    }
    const n = Math.max(1, Math.floor(quantas));
    await pool.execute(
      `INSERT INTO saudeDaIa (uso, falhouEm, motivo, falhasDesdeOk) VALUES (?, NOW(), ?, ?)
       ON DUPLICATE KEY UPDATE falhouEm = NOW(), motivo = VALUES(motivo),
                               falhasDesdeOk = falhasDesdeOk + VALUES(falhasDesdeOk)`,
      [uso, motivo.replace(/\s+/g, " ").slice(0, 400), n],
    );
  } catch {
    /* um termómetro não trava o doente */
  }
}

/**
 * Os usos em baixo, para o painel do WhatsApp. A idade conta-se na base, com
 * o relógio da base dos dois lados (como `quandoAPonteVeio`).
 */
export async function falhasDaIa(): Promise<FalhaDaIa[]> {
  try {
    if (!(await garantirTabela())) return [];
    const pool = await getPool();
    if (!pool) return [];
    const [rows] = (await pool.execute(
      `SELECT uso, motivo, falhasDesdeOk, TIMESTAMPDIFF(SECOND, falhouEm, NOW()) AS haSegundos
         FROM saudeDaIa WHERE falhouEm IS NOT NULL`,
    )) as [Array<{ uso: string; motivo: string | null; falhasDesdeOk: number; haSegundos: number | string | null }>, unknown];
    const agora = Date.now();
    return rows
      .filter((r) => eUsoDaIa(r.uso))
      .map((r) => ({
        uso: r.uso as UsoDaIa,
        motivo: r.motivo ?? "sem motivo registado",
        falhas: Number(r.falhasDesdeOk ?? 0),
        quando: new Date(agora - Math.max(0, Number(r.haSegundos ?? 0)) * 1000).toISOString(),
      }))
      .sort((a, b) => USOS_DA_IA.indexOf(a.uso) - USOS_DA_IA.indexOf(b.uso));
  } catch {
    return [];
  }
}
