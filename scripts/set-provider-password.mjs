/**
 * Define/atualiza a palavra-passe de um parceiro na tabela `providers`.
 * ─────────────────────────────────────────────────────────────────────────────
 * Uso:
 *   PROVIDER_SLUG=clyon PROVIDER_PASSWORD=minhasenha \
 *   node --env-file-if-exists=/vercel/share/.env.project scripts/set-provider-password.mjs
 *
 * Se PROVIDER_PASSWORD não for definida, gera uma password aleatória e mostra-a
 * no fim (guarda-a já — não pode ser recuperada depois).
 */

import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import crypto from "crypto";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL não definido. Execute com --env-file-if-exists=/vercel/share/.env.project");
  process.exit(1);
}

const slug = process.env.PROVIDER_SLUG;
if (!slug) {
  console.error("PROVIDER_SLUG não definido. Ex: PROVIDER_SLUG=clyon node scripts/set-provider-password.mjs");
  process.exit(1);
}

const password = process.env.PROVIDER_PASSWORD || crypto.randomBytes(10).toString("base64url");

async function run() {
  const pool = mysql.createPool({ uri: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  const [rows] = await pool.execute("SELECT id, name FROM providers WHERE slug = ?", [slug]);
  if (rows.length === 0) {
    console.error(`Nenhum provider encontrado com slug="${slug}".`);
    await pool.end();
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  await pool.execute("UPDATE providers SET passwordHash = ? WHERE slug = ?", [hash, slug]);

  console.log(`[ok] Palavra-passe definida para "${rows[0].name}" (slug=${slug})`);
  if (!process.env.PROVIDER_PASSWORD) {
    console.log(`\nIMPORTANTE: password gerada automaticamente = ${password}`);
    console.log("Guarda-a agora — não pode ser recuperada depois.");
  }

  await pool.end();
}

run().catch((e) => { console.error(e); process.exit(1); });
