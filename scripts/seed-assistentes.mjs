/**
 * Seed de assistentes CLYON
 * ─────────────────────────────────────────────────────────────────────────────
 * Cria dois assistentes na tabela `colaboradores` se ainda não existirem.
 * As passwords são pedidas por argumento ou geradas aleatoriamente.
 *
 * Uso:
 *   node --env-file-if-exists=/vercel/share/.env.project scripts/seed-assistentes.mjs
 *
 * Para definir passwords personalizadas:
 *   ASSISTENTE1_SENHA=minhasenha1 ASSISTENTE2_SENHA=minhasenha2 \
 *   node --env-file-if-exists=/vercel/share/.env.project scripts/seed-assistentes.mjs
 */

import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import crypto from "crypto";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL não definido. Execute com --env-file-if-exists=/vercel/share/.env.project");
  process.exit(1);
}

function randomPassword() {
  return crypto.randomBytes(10).toString("base64url");
}

const assistentes = [
  {
    nome: "ASSISTENTE1",
    funcao: "Assistente de pedidos",
    senha: process.env.ASSISTENTE1_SENHA || randomPassword(),
    isAdmin: 0,
  },
  {
    nome: "ASSISTENTE2",
    funcao: "Assistente de pedidos",
    senha: process.env.ASSISTENTE2_SENHA || randomPassword(),
    isAdmin: 0,
  },
];

async function run() {
  const pool = mysql.createPool(DATABASE_URL);

  for (const a of assistentes) {
    const hash = await bcrypt.hash(a.senha, 10);
    const [rows] = await pool.execute("SELECT id FROM colaboradores WHERE nome = ?", [a.nome]);
    if ((rows).length > 0) {
      console.log(`  [skip] ${a.nome} já existe`);
      continue;
    }
    await pool.execute(
      "INSERT INTO colaboradores (nome, funcao, senha, isAdmin, ativo, valorHora) VALUES (?, ?, ?, ?, 1, 15.00)",
      [a.nome, a.funcao, hash, a.isAdmin],
    );
    console.log(`  [ok]   ${a.nome} criado  password=${a.senha}`);
  }

  await pool.end();
  console.log("\nSeed concluído.");
  console.log("IMPORTANTE: guarda as passwords mostradas — não podem ser recuperadas depois.");
}

run().catch((e) => { console.error(e); process.exit(1); });
