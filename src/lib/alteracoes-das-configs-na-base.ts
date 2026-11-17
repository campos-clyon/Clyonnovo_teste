import { getPool } from "./db";

/**
 * O HISTÓRICO DAS CONFIGS — d61, 16-11-2026.
 *
 * Cada mudança de um valor das Configs (o simulador e o motor de custos) grava
 * quem, quando, o valor antigo e o novo. Uma tabela nova, só de acrescentar:
 * nada do que existe muda. Gravar o histórico nunca impede a mudança — uma
 * falha aqui fica no registo do servidor.
 */

let pronta = false;

async function garantirTabela(): Promise<boolean> {
  if (pronta) return true;
  const pool = await getPool();
  if (!pool) return false;
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS alteracoesDasConfigs (
       id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
       chave VARCHAR(120) NOT NULL,
       valorAntigo VARCHAR(40) NULL DEFAULT NULL,
       valorNovo VARCHAR(40) NOT NULL,
       quemId INT NULL DEFAULT NULL,
       quemNome VARCHAR(160) NULL DEFAULT NULL,
       perfil VARCHAR(40) NULL DEFAULT NULL,
       em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
       KEY idx_chave (chave, id)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  pronta = true;
  return true;
}

export async function registarAlteracaoDaConfig(a: {
  chave: string;
  antes: string | number | null;
  depois: string | number;
  quemId?: number | null;
  quemNome?: string | null;
  perfil?: string | null;
}): Promise<void> {
  try {
    if (!(await garantirTabela())) return;
    const pool = await getPool();
    if (!pool) return;
    await pool.execute(
      "INSERT INTO alteracoesDasConfigs (chave, valorAntigo, valorNovo, quemId, quemNome, perfil) VALUES (?, ?, ?, ?, ?, ?)",
      [
        a.chave.slice(0, 120),
        a.antes == null ? null : String(a.antes).slice(0, 40),
        String(a.depois).slice(0, 40),
        a.quemId ?? null,
        a.quemNome ? a.quemNome.slice(0, 160) : null,
        a.perfil ? a.perfil.slice(0, 40) : null,
      ],
    );
  } catch (e) {
    console.error("[alteracoesDasConfigs] não gravei o histórico:", e instanceof Error ? e.message : e);
  }
}
