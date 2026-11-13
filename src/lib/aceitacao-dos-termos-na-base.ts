import { getPool, toMySQLDateTime } from "./db";
import { VERSAO_DOS_TERMOS, type OrigemDaAceitacao } from "./aceitacao-dos-termos";

/**
 * A TABELA DAS ACEITAÇÕES DOS TERMOS — d20 (13-11-2026). Ver `aceitacao-dos-termos.ts`.
 *
 * Aditiva: uma tabela nova, que nasce sozinha na primeira escrita ou leitura, e
 * não mexe em mais nenhuma. Uma linha por profissional e por versão (índice
 * único): aceitar duas vezes a mesma versão guarda só a primeira — é essa a
 * prova do que foi acordado, e não se reescreve. `em` grava-se em UTC (a base é
 * lida em UTC); mostra-se em hora de Lisboa.
 */

let tabelaPronta = false;

export async function garantirTabelaDasAceitacoes(): Promise<void> {
  if (tabelaPronta) return;
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS aceitacoesDosTermos (
      id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      providerId  INT UNSIGNED NOT NULL,
      versao      VARCHAR(20) NOT NULL,
      em          DATETIME NOT NULL,
      origem      VARCHAR(20) NOT NULL,
      UNIQUE KEY uq_profissional_versao (providerId, versao),
      KEY idx_versao (versao)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tabelaPronta = true;
}

export type AceitacaoDosTermos = { versao: string; em: Date; origem: string };

/** A aceitação desta versão (por omissão, a em vigor) por este profissional, ou `null`. */
export async function aceitacaoDoProfissional(
  providerId: number,
  versao: string = VERSAO_DOS_TERMOS,
): Promise<AceitacaoDosTermos | null> {
  await garantirTabelaDasAceitacoes();
  const pool = await getPool();
  if (!pool) return null;
  const [linhas] = (await pool.execute(
    "SELECT versao, em, origem FROM aceitacoesDosTermos WHERE providerId = ? AND versao = ? LIMIT 1",
    [providerId, versao],
  )) as unknown as [Array<Record<string, unknown>>];
  const l = linhas[0];
  if (!l) return null;
  const em = l.em instanceof Date ? l.em : new Date(String(l.em).replace(" ", "T") + "Z");
  return { versao: String(l.versao), em, origem: String(l.origem) };
}

/**
 * Grava a aceitação. `INSERT IGNORE` sobre o índice único: a segunda vez não muda
 * a primeira. Devolve a aceitação que fica guardada.
 */
export async function gravarAceitacao(
  providerId: number,
  origem: OrigemDaAceitacao,
  agora: Date = new Date(),
  versao: string = VERSAO_DOS_TERMOS,
): Promise<AceitacaoDosTermos | null> {
  await garantirTabelaDasAceitacoes();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(
    "INSERT IGNORE INTO aceitacoesDosTermos (providerId, versao, em, origem) VALUES (?, ?, ?, ?)",
    [providerId, versao, toMySQLDateTime(agora), origem],
  );
  return aceitacaoDoProfissional(providerId, versao);
}
