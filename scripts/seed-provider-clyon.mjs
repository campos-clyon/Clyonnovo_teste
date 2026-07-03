/**
 * Seed do primeiro parceiro do marketplace: a própria CLYON (isClyon=1).
 * ─────────────────────────────────────────────────────────────────────────────
 * Cria o registo em `providers` e a cobertura geográfica em `provider_coverage`
 * a partir das zonas já cobertas em src/lib/coverage.ts, se ainda não existirem.
 * Idempotente — seguro para correr múltiplas vezes.
 *
 * Uso:
 *   node --env-file-if-exists=/vercel/share/.env.project scripts/seed-provider-clyon.mjs
 */

import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL não definido. Execute com --env-file-if-exists=/vercel/share/.env.project");
  process.exit(1);
}

// Mesma lista de src/lib/coverage.ts — mantidas em sincronia manualmente
// (import direto do .ts não é trivial num script .mjs solto).
const COVERED_ZONES = [
  "Lisboa", "Almada", "Seixal", "Amora", "Belverde", "Fernão Ferro",
  "Barreiro", "Moita", "Setúbal", "Sesimbra", "Palmela", "Oeiras",
  "Cascais", "Sintra", "Loures", "Amadora",
];

async function run() {
  const pool = mysql.createPool({ uri: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  const [existing] = await pool.execute("SELECT id FROM providers WHERE slug = ?", ["clyon"]);
  let providerId;

  if (existing.length > 0) {
    providerId = existing[0].id;
    console.log(`[skip] provider "clyon" já existe (id=${providerId})`);
  } else {
    const [result] = await pool.execute(
      `INSERT INTO providers (name, slug, phone, email, city, isClyon, isActive, commissionRate)
       VALUES (?, ?, ?, ?, ?, 1, 1, 0.00)`,
      ["CLYON", "clyon", "965785395", "geral@clyon.pt", "Amora"],
    );
    providerId = result.insertId;
    console.log(`[ok]   provider "clyon" criado (id=${providerId})`);
  }

  for (const zone of COVERED_ZONES) {
    const [existingZone] = await pool.execute(
      "SELECT id FROM provider_coverage WHERE providerId = ? AND zone = ?",
      [providerId, zone],
    );
    if (existingZone.length > 0) {
      console.log(`  [skip] cobertura "${zone}" já existe`);
      continue;
    }
    await pool.execute(
      "INSERT INTO provider_coverage (providerId, zone, isActive) VALUES (?, ?, 1)",
      [providerId, zone],
    );
    console.log(`  [ok]   cobertura "${zone}" criada`);
  }

  await pool.end();
  console.log("\nSeed concluído.");
}

run().catch((e) => { console.error(e); process.exit(1); });
