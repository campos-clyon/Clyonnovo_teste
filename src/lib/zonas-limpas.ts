/**
 * AS ZONAS ANTIGAS SAEM DA BASE — 01-11-2026 (Jurídico; decisão do dono).
 *
 * As zonas escritas à mão deixaram de se pedir e de se usar a 29-10-2026
 * (o envio dos pedidos só lê as categorias, a base e o raio). A coluna
 * `providers.zonas` ficou com o que lá estava, sem finalidade nenhuma — e um
 * dado sem finalidade não deve ficar (RGPD, art. 5.º, n.º 1, al. c)).
 *
 * A CÓPIA VEM ANTES, como nas categorias (`categorias-em-grupos.ts`): o que lá
 * estava fica em `providers_zonas_antes_de_limpar`, uma linha por
 * profissional, e a primeira cópia nunca é reescrita (INSERT IGNORE). Para
 * desfazer basta repor `zonas` a partir dela.
 *
 * Corre sozinha ao arrancar (`ensureProvidersSchema`) e é idempotente: depois
 * da primeira vez já não há zonas para limpar. O «[]» que a inscrição grava
 * não é dado de ninguém e fica. O `updatedAt` não mexe.
 */

export const TABELA_DA_COPIA_DAS_ZONAS = "providers_zonas_antes_de_limpar";

/** O que conta como zona gravada: tudo menos vazio e a lista vazia. */
export const ONDE_HA_ZONAS = "zonas IS NOT NULL AND TRIM(zonas) <> '' AND TRIM(zonas) <> '[]'";

type Ligacao = {
  execute: (sql: string, valores?: unknown[]) => Promise<unknown>;
};

export async function limparZonasAntigas(conn: Ligacao): Promise<{ limpos: number }> {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS ${TABELA_DA_COPIA_DAS_ZONAS} (
      providerId  INT UNSIGNED NOT NULL PRIMARY KEY,
      zonas       TEXT NULL,
      copiadoEm   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  const [linhas] = (await conn.execute(`SELECT id, zonas FROM providers WHERE ${ONDE_HA_ZONAS}`)) as [
    Array<{ id: number; zonas: unknown }>,
    unknown,
  ];
  for (const l of linhas) {
    // A cópia primeiro; só depois a linha perde as zonas.
    await conn.execute(`INSERT IGNORE INTO ${TABELA_DA_COPIA_DAS_ZONAS} (providerId, zonas) VALUES (?, ?)`, [
      Number(l.id),
      typeof l.zonas === "string" ? l.zonas : l.zonas == null ? null : JSON.stringify(l.zonas),
    ]);
    await conn.execute(`UPDATE providers SET zonas = NULL, updatedAt = updatedAt WHERE id = ? AND ${ONDE_HA_ZONAS}`, [
      Number(l.id),
    ]);
  }
  if (linhas.length > 0) console.log(`[zonas] ${linhas.length} profissionais ficaram sem as zonas antigas (cópia antes)`);
  return { limpos: linhas.length };
}
