/**
 * ensure-wanderson-admin.mjs
 * Garante que:
 *  1. O enum funcao da tabela colaboradores inclui 'assistente'
 *  2. WANDERSON existe, tem isAdmin=1 e funcao='admin'
 *
 * Usar: node --env-file-if-exists=/vercel/share/.env.project ensure-wanderson-admin.mjs
 */
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

async function run() {
  const conn = await mysql.createConnection({
    uri: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectTimeout: 20000,
  });
  try {
    // 1. Expandir enum para incluir 'assistente'
    console.log("[migração] A expandir enum funcao para incluir 'assistente'...");
    await conn.execute(
      `ALTER TABLE colaboradores MODIFY COLUMN funcao ENUM('motorista','ajudante','admin','assistente') NOT NULL`
    );
    console.log("[migração] Enum actualizado.");

    // 2. Verificar se WANDERSON existe
    const [rows] = await conn.execute(
      "SELECT id, nome, funcao, isAdmin FROM colaboradores WHERE nome = 'WANDERSON' LIMIT 1"
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      // Criar WANDERSON
      const hash = await bcrypt.hash("WWclyon26", 10);
      await conn.execute(
        "INSERT INTO colaboradores (nome, senha, funcao, valorHora, isAdmin) VALUES (?, ?, 'admin', '0.00', 1)",
        ["WANDERSON", hash]
      );
      console.log("[migração] WANDERSON criado como admin geral.");
    } else {
      const w = rows[0];
      const updates = [];
      const vals = [];
      if (w.funcao !== "admin") { updates.push("funcao = 'admin'"); }
      if (!w.isAdmin) { updates.push("isAdmin = 1"); }
      if (updates.length) {
        await conn.execute(
          `UPDATE colaboradores SET ${updates.join(", ")}, updatedAt = NOW() WHERE id = ?`,
          [w.id]
        );
        console.log(`[migração] WANDERSON actualizado: ${updates.join(", ")}`);
      } else {
        console.log("[migração] WANDERSON já está correcto (isAdmin=1, funcao=admin).");
      }
    }

    console.log("[migração] Concluída com sucesso.");
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error("[migração] Erro:", err.message);
  process.exit(1);
});
