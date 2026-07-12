import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq, desc, inArray } from "drizzle-orm";
import { users, colaboradores, registrosHoras, simulatorSettings, galleryMedia, trabalhosRealizados } from "../../drizzle/schema";
import type { InsertUser, InsertSimulatorOrder, SimulatorOrder, TrabalhoRealizadoData } from "../../drizzle/schema";
export type { TrabalhoRealizadoData };
import { defaultSimulatorSettings } from "@/lib/simulator-settings";

let dbInstance: ReturnType<typeof drizzle<typeof import('../../drizzle/schema')>> | null = null;
let poolInstance: mysql.Pool | null = null;

/** Converte uma Date para string no formato MySQL DATETIME: 'YYYY-MM-DD HH:mm:ss' */
export function toMySQLDateTime(date: Date = new Date()): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export async function getPool() {
  if (!process.env.DATABASE_URL) {
    console.warn("[Database] DATABASE_URL not set");
    return null;
  }
  if (!poolInstance) {
    poolInstance = mysql.createPool({
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      connectTimeout: 20000,
      // SSL necessário para Railway — sem isto o pool falha silenciosamente
      ssl: { rejectUnauthorized: false },
    });
  }
  return poolInstance;
}

export async function getDb() {
  const pool = await getPool();
  if (!pool) return null;
  if (!dbInstance) {
    dbInstance = drizzle(pool) as any;
  }
  return dbInstance;
}

/**
 * Cria uma conexão MySQL2 fresca (não reutiliza singleton) para cada request.
 * Usar nos endpoints API admin para evitar erros de "Connection lost" com Railway.
 */
export async function withConnection<T>(
  fn: (conn: mysql.Connection) => Promise<T>,
): Promise<T> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  const conn = await mysql.createConnection({
    uri: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectTimeout: 20000,
  });
  try {
    return await fn(conn);
  } finally {
    await conn.end().catch(() => {});
  }
}

let simulatorTableEnsured = false;
let galleryMediaTableEnsured = false;

/** Permite ao setup forçar um re-seed dos defaults mesmo que a tabela já tenha sido inicializada. */
export function resetSimulatorTableEnsuredFlag() {
  simulatorTableEnsured = false;
}

export async function ensureSimulatorSettingsTable() {
  const pool = await getPool();
  if (!pool) throw new Error("Database not available");

  // CREATE TABLE apenas se não existir (idempotente, rápido após a primeira vez)
  if (!simulatorTableEnsured) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS simulatorSettings (
        \`key\` varchar(120) NOT NULL PRIMARY KEY,
        label varchar(160) NOT NULL,
        category varchar(40) NOT NULL,
        unit varchar(24) NOT NULL,
        value decimal(10,2) NOT NULL,
        description text NULL,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    simulatorTableEnsured = true;
  }

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Upsert de defaults: corre SEMPRE para que alterações de código (ex: custo_km,
  // overhead_por_servico) se propaguem à DB sem necessidade de intervenção manual.
  // O admin pode sempre sobrescrever via UI — upsertSimulatorSetting usa a mesma lógica.
  for (const setting of defaultSimulatorSettings) {
    await db
      .insert(simulatorSettings)
      .values({
        key: setting.key,
        label: setting.label,
        category: setting.category,
        unit: setting.unit,
        value: setting.value.toFixed(2),
        description: setting.description,
      })
      .onDuplicateKeyUpdate({
        set: {
          label: setting.label,
          category: setting.category,
          unit: setting.unit,
          description: setting.description,
          value: setting.value.toFixed(2),
        },
      });
  }
}

export async function getSimulatorSettings(): Promise<typeof simulatorSettings.$inferSelect[]> {
  await ensureSimulatorSettingsTable();
  const db = await getDb();
  if (!db) return [];
  try {
    const result = await db.select().from(simulatorSettings);
    return result || [];
  } catch (error) {
    console.error("[Database] Error fetching simulator settings:", error);
    return [];
  }
}

export async function upsertSimulatorSetting(data: {
  key: string;
  label: string;
  category: string;
  unit: string;
  value: string;
  description?: string | null;
}) {
  await ensureSimulatorSettingsTable();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(simulatorSettings)
    .values(data)
    .onDuplicateKeyUpdate({
      set: {
        label: data.label,
        category: data.category,
        unit: data.unit,
        value: data.value,
        description: data.description ?? null,
      },
    });
}

export async function ensureGalleryMediaTable() {
  if (galleryMediaTableEnsured) return;

  const pool = await getPool();
  if (!pool) throw new Error("Database not available");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS galleryMedia (
      id varchar(120) NOT NULL PRIMARY KEY,
      section varchar(32) NOT NULL,
      title varchar(180) NOT NULL,
      subtitle text NULL,
      description text NULL,
      alt varchar(220) NOT NULL,
      imageUrl longtext NOT NULL,
      \`order\` int NOT NULL DEFAULT 1,
      isActive int NOT NULL DEFAULT 1,
      projectKey varchar(160) NULL,
      phase varchar(24) NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    ALTER TABLE galleryMedia
    MODIFY COLUMN imageUrl longtext NOT NULL
  `);

  galleryMediaTableEnsured = true;
}

export async function getGalleryMediaItems() {
  await ensureGalleryMediaTable();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(galleryMedia);
}

export async function replaceGalleryMediaItems(
  items: Array<{
    id: string;
    section: string;
    title: string;
    subtitle?: string | null;
    description?: string | null;
    alt: string;
    imageUrl: string;
    order: number;
    isActive: boolean;
    projectKey?: string | null;
    phase?: string | null;
  }>,
) {
  await ensureGalleryMediaTable();
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  for (const item of items) {
    await db
      .insert(galleryMedia)
      .values({
        id: item.id,
        section: item.section,
        title: item.title,
        subtitle: item.subtitle ?? null,
        description: item.description ?? null,
        alt: item.alt,
        imageUrl: item.imageUrl,
        order: item.order,
        isActive: item.isActive ? 1 : 0,
        projectKey: item.projectKey ?? null,
        phase: item.phase ?? null,
      })
      .onDuplicateKeyUpdate({
        set: {
          section: item.section,
          title: item.title,
          subtitle: item.subtitle ?? null,
          description: item.description ?? null,
          alt: item.alt,
          imageUrl: item.imageUrl,
          order: item.order,
          isActive: item.isActive ? 1 : 0,
          projectKey: item.projectKey ?? null,
          phase: item.phase ?? null,
        },
      });
  }

  if (items.length === 0) {
    await db.delete(galleryMedia);
    return;
  }

  const idsToDelete = (await db.select({ id: galleryMedia.id }).from(galleryMedia))
    .map((row) => row.id)
    .filter((id) => !items.some((item) => item.id === id));

  if (idsToDelete.length > 0) {
    await db.delete(galleryMedia).where(inArray(galleryMedia.id, idsToDelete));
  }
}

// ─── User helpers ─────────────────────────────────────����─────────────────────

let usersSchemaEnsured = false;

/**
 * Garante que a tabela `users` tem todas as colunas necessárias para a área
 * de conta do cliente (phone, morada, faturação, avatar, notificações).
 * Seguro para correr múltiplas vezes — usa cache de flag e hasColumn().
 * Também cria índices UNIQUE em `email` e `phone` se não existirem.
 */
export async function ensureUsersSchema(): Promise<void> {
  if (usersSchemaEnsured) return;

  // Usa withConnection (ssl + connectTimeout) em vez de getPool — necessário para Railway
  await withConnection(async (conn) => {
    // 1. Garantir que a tabela existe com schema completo (cobre instalações novas)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        name          VARCHAR(255) NULL,
        email         VARCHAR(255) NOT NULL,
        openId        VARCHAR(255) NULL,
        loginMethod   VARCHAR(40)  NOT NULL DEFAULT 'google',
        role          VARCHAR(40)  NOT NULL DEFAULT 'user',
        phone         VARCHAR(30)  NULL,
        addressLine   VARCHAR(255) NULL,
        addressNumber VARCHAR(20)  NULL,
        postalCode    VARCHAR(20)  NULL,
        addressCity   VARCHAR(120) NULL,
        nif           VARCHAR(20)  NULL,
        billingName   VARCHAR(160) NULL,
        billingNif    VARCHAR(20)  NULL,
        billingAddress    VARCHAR(255) NULL,
        billingPostalCode VARCHAR(20)  NULL,
        billingCity   VARCHAR(120) NULL,
        avatarUrl     TEXT         NULL,
        notifOrderStatus  TINYINT(1) NOT NULL DEFAULT 1,
        notifWeeklyDigest TINYINT(1) NOT NULL DEFAULT 0,
        notifWhatsapp     TINYINT(1) NOT NULL DEFAULT 0,
        lastSignedIn  DATETIME NULL,
        deletedAt     TIMESTAMP NULL,
        createdAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("[ensureUsersSchema] tabela users verificada/criada");

    // 1b. Corrigir colunas NOT NULL que bloqueiam INSERT (caso a tabela já existisse com schema antigo)
    try {
      // openId pode ser NOT NULL sem default — impede criação de utilizadores Google OAuth
      await conn.execute(
        "ALTER TABLE users MODIFY COLUMN openId VARCHAR(64) NULL DEFAULT NULL"
      );
    } catch { /* coluna pode não existir ainda — ignorar */ }

    // 2. Adicionar colunas em falta para instâncias com schema antigo (idempotente)
    const columnsToAdd: Array<{ name: string; sql: string }> = [
      { name: "phone",             sql: "ALTER TABLE users ADD COLUMN phone VARCHAR(30) NULL" },
      { name: "addressLine",       sql: "ALTER TABLE users ADD COLUMN addressLine VARCHAR(255) NULL" },
      { name: "addressNumber",     sql: "ALTER TABLE users ADD COLUMN addressNumber VARCHAR(20) NULL" },
      { name: "postalCode",        sql: "ALTER TABLE users ADD COLUMN postalCode VARCHAR(20) NULL" },
      { name: "addressCity",       sql: "ALTER TABLE users ADD COLUMN addressCity VARCHAR(120) NULL" },
      { name: "nif",               sql: "ALTER TABLE users ADD COLUMN nif VARCHAR(20) NULL" },
      { name: "billingName",       sql: "ALTER TABLE users ADD COLUMN billingName VARCHAR(160) NULL" },
      { name: "billingNif",        sql: "ALTER TABLE users ADD COLUMN billingNif VARCHAR(20) NULL" },
      { name: "billingAddress",    sql: "ALTER TABLE users ADD COLUMN billingAddress VARCHAR(255) NULL" },
      { name: "billingPostalCode", sql: "ALTER TABLE users ADD COLUMN billingPostalCode VARCHAR(20) NULL" },
      { name: "billingCity",       sql: "ALTER TABLE users ADD COLUMN billingCity VARCHAR(120) NULL" },
      { name: "avatarUrl",         sql: "ALTER TABLE users ADD COLUMN avatarUrl TEXT NULL" },
      { name: "notifOrderStatus",  sql: "ALTER TABLE users ADD COLUMN notifOrderStatus TINYINT(1) NOT NULL DEFAULT 1" },
      { name: "notifWeeklyDigest", sql: "ALTER TABLE users ADD COLUMN notifWeeklyDigest TINYINT(1) NOT NULL DEFAULT 0" },
      { name: "notifWhatsapp",     sql: "ALTER TABLE users ADD COLUMN notifWhatsapp TINYINT(1) NOT NULL DEFAULT 0" },
      { name: "deletedAt",         sql: "ALTER TABLE users ADD COLUMN deletedAt TIMESTAMP NULL" },
    ];

    for (const col of columnsToAdd) {
      try {
        const [existRows] = await conn.execute(
          `SELECT COUNT(*) AS cnt FROM information_schema.columns
           WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = ?`,
          [col.name],
        ) as [Array<{ cnt: number }>, unknown];
        if (Number(existRows[0]?.cnt ?? 0) === 0) {
          await conn.execute(col.sql);
          console.log(`[ensureUsersSchema] coluna adicionada: ${col.name}`);
        }
      } catch (err) {
        console.error(`[ensureUsersSchema] erro coluna ${col.name}:`, String(err).slice(0, 120));
      }
    }

    // Índice UNIQUE em email
    try {
      const [emailIdx] = await conn.execute(
        `SELECT COUNT(*) AS cnt FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'users_email_unique'`,
      ) as [Array<{ cnt: number }>, unknown];
      if (Number(emailIdx[0]?.cnt ?? 0) === 0) {
        await conn.execute("ALTER TABLE users ADD UNIQUE INDEX users_email_unique (email)");
        console.log("[ensureUsersSchema] índice users_email_unique criado");
      }
    } catch (err) {
      console.error("[ensureUsersSchema] índice email:", String(err).slice(0, 120));
    }

    // Índice UNIQUE em phone (NULLs múltiplos permitidos em MySQL)
    try {
      const [phoneIdx] = await conn.execute(
        `SELECT COUNT(*) AS cnt FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'users_phone_unique'`,
      ) as [Array<{ cnt: number }>, unknown];
      if (Number(phoneIdx[0]?.cnt ?? 0) === 0) {
        await conn.execute("ALTER TABLE users ADD UNIQUE INDEX users_phone_unique (phone)");
        console.log("[ensureUsersSchema] índice users_phone_unique criado");
      }
    } catch (err) {
      console.error("[ensureUsersSchema] índice phone:", String(err).slice(0, 120));
    }
  });

  usersSchemaEnsured = true;
  console.log("[ensureUsersSchema] schema verificado com sucesso");
}

// ─── Providers (empresas parceiras) ──────────────────────────────────────────

let providersSchemaEnsured = false;

/**
 * Garante que as tabelas `providers` e `provider_coverage` existem.
 * Base do marketplace (CLYON_Plano_Mestre_Definitivo v3.0, secção 6.2) —
 * ainda sem UI/API a consumir, só o schema. Segue o mesmo padrão idempotente
 * de ensureUsersSchema(): CREATE TABLE IF NOT EXISTS + ALTER TABLE ADD COLUMN
 * condicional, para instâncias que já tenham uma versão anterior da tabela.
 */
export async function ensureProvidersSchema(): Promise<void> {
  if (providersSchemaEnsured) return;

  await withConnection(async (conn) => {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS providers (
        id             INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        name           VARCHAR(255) NOT NULL,
        slug           VARCHAR(100) NOT NULL,
        phone          VARCHAR(30)  NULL,
        email          VARCHAR(255) NULL,
        nif            VARCHAR(20)  NULL,
        city           VARCHAR(120) NULL,
        isClyon        TINYINT(1)   NOT NULL DEFAULT 0,
        isActive       TINYINT(1)   NOT NULL DEFAULT 1,
        commissionRate DECIMAL(5,2) NOT NULL DEFAULT 15.00,
        createdAt      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("[ensureProvidersSchema] tabela providers verificada/criada");

    // Colunas adicionadas depois da criação inicial (idempotente)
    const providerColumnsToAdd: Array<{ name: string; sql: string }> = [
      { name: "passwordHash", sql: "ALTER TABLE providers ADD COLUMN passwordHash VARCHAR(255) NULL" },
    ];
    for (const col of providerColumnsToAdd) {
      try {
        const [existRows] = await conn.execute(
          `SELECT COUNT(*) AS cnt FROM information_schema.columns
           WHERE table_schema = DATABASE() AND table_name = 'providers' AND column_name = ?`,
          [col.name],
        ) as [Array<{ cnt: number }>, unknown];
        if (Number(existRows[0]?.cnt ?? 0) === 0) {
          await conn.execute(col.sql);
          console.log(`[ensureProvidersSchema] coluna adicionada: ${col.name}`);
        }
      } catch (err) {
        console.error(`[ensureProvidersSchema] erro coluna ${col.name}:`, String(err).slice(0, 120));
      }
    }

    try {
      const [slugIdx] = await conn.execute(
        `SELECT COUNT(*) AS cnt FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND table_name = 'providers' AND index_name = 'providers_slug_unique'`,
      ) as [Array<{ cnt: number }>, unknown];
      if (Number(slugIdx[0]?.cnt ?? 0) === 0) {
        await conn.execute("ALTER TABLE providers ADD UNIQUE INDEX providers_slug_unique (slug)");
        console.log("[ensureProvidersSchema] índice providers_slug_unique criado");
      }
    } catch (err) {
      console.error("[ensureProvidersSchema] índice slug:", String(err).slice(0, 120));
    }

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS provider_coverage (
        id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        providerId INT UNSIGNED NOT NULL,
        zone       VARCHAR(100) NOT NULL,
        isActive   TINYINT(1)   NOT NULL DEFAULT 1,
        createdAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("[ensureProvidersSchema] tabela provider_coverage verificada/criada");

    try {
      const [providerIdx] = await conn.execute(
        `SELECT COUNT(*) AS cnt FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND table_name = 'provider_coverage' AND index_name = 'provider_coverage_providerId_idx'`,
      ) as [Array<{ cnt: number }>, unknown];
      if (Number(providerIdx[0]?.cnt ?? 0) === 0) {
        await conn.execute("ALTER TABLE provider_coverage ADD INDEX provider_coverage_providerId_idx (providerId)");
        console.log("[ensureProvidersSchema] índice provider_coverage_providerId_idx criado");
      }
    } catch (err) {
      console.error("[ensureProvidersSchema] índice providerId:", String(err).slice(0, 120));
    }
  });

  providersSchemaEnsured = true;
  console.log("[ensureProvidersSchema] schema verificado com sucesso");
}

export async function upsertUser(values: InsertUser) {
  const db = await getDb();
  if (!db) return;
  try {
    const updateSet: Partial<InsertUser> = {
      name: values.name,
      email: values.email,
      loginMethod: values.loginMethod,
      lastSignedIn: new Date(),
    };
    if (values.openId === process.env.OWNER_OPEN_ID) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0] ?? undefined;
}

// ─── Colaboradores helpers ───────────────────────────────────────────────────

export async function getColaboradorByNome(nome: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(colaboradores).where(eq(colaboradores.nome, nome)).limit(1);
  return result[0] ?? undefined;
}

export async function getColaboradorById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(colaboradores).where(eq(colaboradores.id, id)).limit(1);
  return result[0] ?? undefined;
}

/**
 * Garante que a coluna funcao da tabela colaboradores aceita o valor 'assistente'.
 * Seguro para correr múltiplas vezes — falha silenciosamente se o enum já existir.
 */
/**
 * Garante que a tabela colaboradores tem todos os campos necessários.
 * Usa ALTER TABLE … ADD COLUMN IF NOT EXISTS (seguro para correr múltiplas vezes).
 */
/**
 * Verifica se coluna existe em tabela (compatível com MySQL/MariaDB antigos)
 */
async function hasColumn(tableName: string, columnName: string): Promise<boolean> {
  const pool = await getPool();
  if (!pool) return false;

  try {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS count
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = ?
         AND column_name = ?`,
      [tableName, columnName]
    );
    const count = Number((rows as any[])[0]?.count ?? 0);
    return count > 0;
  } catch (error) {
    console.error(`[v0] hasColumn erro: ${error}`);
    return false;
  }
}

export async function ensureColaboradoresSchema(): Promise<void> {
  const pool = await getPool();
  if (!pool) return;


  try {
    // Garantir enum actualizado (MODIFY sempre funciona)
    await pool.execute(
      `ALTER TABLE colaboradores MODIFY COLUMN funcao ENUM('motorista','ajudante','admin','assistente') NOT NULL`
    );
  } catch (error) {
  }

  try {
    // valorHora passa a ser opcional
    await pool.execute(
      `ALTER TABLE colaboradores MODIFY COLUMN valorHora DECIMAL(6,2) DEFAULT '0.00'`
    );
  } catch (error) {
  }

  // Lista de colunas a adicionar com verificação
  const columnsToAdd = [
    {
      name: "valorDiaria",
      sql: `ALTER TABLE colaboradores ADD COLUMN valorDiaria DECIMAL(6,2) DEFAULT NULL`,
    },
    {
      name: "paymentModel",
      sql: `ALTER TABLE colaboradores ADD COLUMN paymentModel ENUM('hourly','daily','commission','none') DEFAULT 'hourly'`,
    },
    {
      name: "commissionType",
      sql: `ALTER TABLE colaboradores ADD COLUMN commissionType ENUM('profit_percent','gross_percent','fixed_per_closed_request','none') DEFAULT NULL`,
    },
    {
      name: "commissionPercent",
      sql: `ALTER TABLE colaboradores ADD COLUMN commissionPercent DECIMAL(5,2) DEFAULT NULL`,
    },
    {
      name: "commissionFixedAmount",
      sql: `ALTER TABLE colaboradores ADD COLUMN commissionFixedAmount DECIMAL(8,2) DEFAULT NULL`,
    },
    {
      name: "commissionNotes",
      sql: `ALTER TABLE colaboradores ADD COLUMN commissionNotes TEXT DEFAULT NULL`,
    },
    {
      name: "canReceiveSimulatorRequests",
      sql: `ALTER TABLE colaboradores ADD COLUMN canReceiveSimulatorRequests TINYINT(1) NOT NULL DEFAULT 0`,
    },
    {
      name: "participatesInTimeTracking",
      sql: `ALTER TABLE colaboradores ADD COLUMN participatesInTimeTracking TINYINT(1) NOT NULL DEFAULT 1`,
    },
    {
      name: "active",
      sql: `ALTER TABLE colaboradores ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1`,
    },
    {
      name: "createdAt",
      sql: `ALTER TABLE colaboradores ADD COLUMN createdAt DATETIME DEFAULT CURRENT_TIMESTAMP`,
    },
    {
      name: "updatedAt",
      sql: `ALTER TABLE colaboradores ADD COLUMN updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
    },
    {
      name: "costPerAcceptedOrder",
      sql: `ALTER TABLE colaboradores ADD COLUMN costPerAcceptedOrder DECIMAL(8,2) DEFAULT '6.00'`,
    },
    {
      name: "totalPaid",
      sql: `ALTER TABLE colaboradores ADD COLUMN totalPaid DECIMAL(10,2) DEFAULT '0.00'`,
    },
  ];

  // Verificar e adicionar cada coluna individualmente
  for (const col of columnsToAdd) {
    try {
      const exists = await hasColumn("colaboradores", col.name);
      if (!exists) {
        await pool.execute(col.sql);
      } else {
      }
    } catch (error) {
      console.error(`[v0] ensureColaboradoresSchema erro ao adicionar ${col.name}:`, String(error).slice(0, 100));
    }
  }

  // Assistentes existentes: garantir canReceiveSimulatorRequests=1 e participatesInTimeTracking=0
  try {
    await pool.execute(
      `UPDATE colaboradores SET canReceiveSimulatorRequests=1, participatesInTimeTracking=0 WHERE funcao='assistente' AND canReceiveSimulatorRequests=0`
    );
  } catch (error) {
  }

}

/** @deprecated Use ensureColaboradoresSchema */
export async function ensureColaboradoresEnum(): Promise<void> {
  return ensureColaboradoresSchema();
}

/**
 * Garante que WANDERSON existe e tem isAdmin=1 e funcao='admin'.
 * Retorna o registo actualizado.
 */
export async function upsertWandersonAdmin(senhaHash?: string): Promise<{ id: number; nome: string; isAdmin: number; funcao: string }> {
  const pool = await getPool();
  if (!pool) throw new Error("Database not available");
  await ensureColaboradoresEnum();

  const [[existing]] = await pool.execute(
    "SELECT id, nome, funcao, isAdmin FROM colaboradores WHERE nome = ? LIMIT 1",
    ["WANDERSON"]
  ) as any[];

  if (existing) {
    // Garantir isAdmin=1 e funcao='admin'
    await pool.execute(
      "UPDATE colaboradores SET isAdmin = 1, funcao = 'admin', updatedAt = NOW() WHERE id = ?",
      [existing.id]
    );
    return { id: existing.id, nome: "WANDERSON", isAdmin: 1, funcao: "admin" };
  }

  // Criar WANDERSON se não existir
  const bcrypt = await import("bcryptjs");
  const senha = senhaHash ?? await bcrypt.hash("wanderson2026", 10);
  await pool.execute(
    "INSERT INTO colaboradores (nome, senha, funcao, valorHora, isAdmin) VALUES (?, ?, 'admin', '0', 1)",
    ["WANDERSON", senha]
  );
  const [[created]] = await pool.execute(
    "SELECT id, nome, funcao, isAdmin FROM colaboradores WHERE nome = ? LIMIT 1",
    ["WANDERSON"]
  ) as any[];
  return created as { id: number; nome: string; isAdmin: number; funcao: string };
}

export async function getAllColaboradores() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(colaboradores);
}

export type ColaboradorFuncao = "motorista" | "ajudante" | "admin" | "assistente";
export type PaymentModel = "hourly" | "daily" | "commission" | "none";
export type CommissionType = "profit_percent" | "gross_percent" | "fixed_per_closed_request" | "none";

export interface CreateColaboradorData {
  nome: string;
  senha: string;
  funcao: ColaboradorFuncao;
  isAdmin?: number;
  // Modelo de pagamento
  paymentModel?: PaymentModel;
  valorHora?: string | null;
  valorDiaria?: string | null;
  // Comissão (para assistentes)
  commissionType?: CommissionType | null;
  commissionPercent?: string | null;
  commissionFixedAmount?: string | null;
  commissionNotes?: string | null;
  // Flags
  canReceiveSimulatorRequests?: number;
  participatesInTimeTracking?: number;
  active?: number;
}

export async function createColaborador(data: CreateColaboradorData) {
  const pool = await getPool();
  if (!pool) throw new Error("Database not available");

  // Garantir schema actualizado (incluindo novos campos)
  await ensureColaboradoresSchema();

  // Derivar defaults por funcao
  const isAssistente = data.funcao === "assistente";
  const isAdmin = data.funcao === "admin";
  const paymentModel = data.paymentModel ?? (isAssistente ? "commission" : isAdmin ? "none" : "hourly");
  const valorHora = isAssistente || isAdmin ? "0.00" : (data.valorHora ? String(parseFloat(data.valorHora)) : "0.00");
  const canReceive = data.canReceiveSimulatorRequests ?? (isAssistente ? 1 : 0);
  const participates = data.participatesInTimeTracking ?? (isAssistente ? 0 : 1);

  await pool.execute(
    `INSERT INTO colaboradores
      (nome, senha, funcao, valorHora, valorDiaria, isAdmin, paymentModel,
       commissionType, commissionPercent, commissionFixedAmount, commissionNotes,
       canReceiveSimulatorRequests, participatesInTimeTracking, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      data.nome,
      data.senha,
      data.funcao,
      valorHora,
      data.valorDiaria ?? null,
      data.isAdmin ?? 0,
      paymentModel,
      data.commissionType ?? null,
      data.commissionPercent ?? null,
      data.commissionFixedAmount ?? null,
      data.commissionNotes ?? null,
      canReceive,
      participates,
    ]
  );
}

export interface UpdateColaboradorData {
  nome?: string;
  senha?: string;
  funcao?: ColaboradorFuncao;
  isAdmin?: number;
  paymentModel?: PaymentModel;
  valorHora?: string | null;
  valorDiaria?: string | null;
  commissionType?: CommissionType | null;
  commissionPercent?: string | null;
  commissionFixedAmount?: string | null;
  commissionNotes?: string | null;
  canReceiveSimulatorRequests?: number;
  participatesInTimeTracking?: number;
  active?: number;
}

export async function updateColaborador(id: number, data: UpdateColaboradorData) {
  const pool = await getPool();
  if (!pool) throw new Error("Database not available");
  await ensureColaboradoresSchema();

  const allowed = [
    "nome", "senha", "funcao", "isAdmin", "paymentModel",
    "valorHora", "valorDiaria", "commissionType", "commissionPercent",
    "commissionFixedAmount", "commissionNotes",
    "canReceiveSimulatorRequests", "participatesInTimeTracking", "active",
  ] as const;

  const entries = Object.entries(data).filter(
    ([k, v]) => allowed.includes(k as typeof allowed[number]) && v !== undefined
  );
  if (!entries.length) return;

  const setParts = entries.map(([k]) => `${k} = ?`).join(", ");
  const values = entries.map(([, v]) => v ?? null);
  await pool.execute(`UPDATE colaboradores SET ${setParts}, updatedAt = NOW() WHERE id = ?`, [...values, id]);
}

export async function deleteColaborador(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(colaboradores).where(eq(colaboradores.id, id));
}

// ─── Registros de Horas helpers ───────────────────────────��──────────────────

function calcularHoras(entrada: string, saida: string, pausa?: string | null): number {
  try {
    const [entH, entM] = entrada.split(":").map(Number);
    const [saiH, saiM] = saida.split(":").map(Number);
    let totalMinutos = saiH * 60 + saiM - (entH * 60 + entM);
    if (pausa) {
      const [pausaH, pausaM] = pausa.split(":").map(Number);
      totalMinutos -= pausaH * 60 + pausaM;
    }
    return Math.max(0, parseFloat((totalMinutos / 60).toFixed(2)));
  } catch {
    return 0;
  }
}

export async function getRegistrosHorasByColaborador(
  colaboradorId: number,
  limit = 50,
  offset = 0
) {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select()
    .from(registrosHoras)
    .where(eq(registrosHoras.colaboradorId, colaboradorId))
    .orderBy(desc(registrosHoras.data))
    .limit(limit)
    .offset(offset);

  const colab = await db
    .select()
    .from(colaboradores)
    .where(eq(colaboradores.id, colaboradorId))
    .limit(1);
  const valorHora = colab[0] ? parseFloat(colab[0].valorHora ?? "0") : 0;

  return result.map((reg) => {
    const horas = reg.horaSaida ? calcularHoras(reg.horaEntrada, reg.horaSaida, reg.horaPausa) : 0;
    const valor = parseFloat((horas * valorHora).toFixed(2));
    return { ...reg, horasTrabalhadas: horas.toFixed(2), valorTotal: valor.toFixed(2) };
  });
}

export async function createRegistroHoras(data: {
  colaboradorId: number;
  data: Date;
  horaEntrada: string;
  horaPausa?: string;
  horaSaida?: string;
  numeroTrabalhos: number;
  horasTrabalhadas: string;
  valorTotal: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(registrosHoras).values({ ...data, sincronizadoSheets: 0 });
}

export async function updateRegistroHoras(
  id: number,
  data: Partial<{
    horaPausa: string;
    horaSaida: string;
    numeroTrabalhos: number;
    horasTrabalhadas: string;
    valorTotal: string;
    sincronizadoSheets: number;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(registrosHoras).set(data).where(eq(registrosHoras.id, id));
}

// ─── Leads helpers ───────────────────────────────────────────────────────────

let _leadsExtended = false;
export async function ensureLeadsExtended(): Promise<void> {
  if (_leadsExtended) return;
  const pool = await getPool();
  if (!pool) return;

  // Garantir que a tabela existe antes de qualquer ALTER TABLE ou SELECT
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS leads (
      id                  INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      nome                VARCHAR(120) NOT NULL DEFAULT '',
      telefone            VARCHAR(40)  NOT NULL DEFAULT '',
      email               VARCHAR(120) NOT NULL DEFAULT '',
      localidade          VARCHAR(120) NOT NULL DEFAULT '',
      tipoServico         VARCHAR(80)  NOT NULL DEFAULT '',
      preferenciaContacto VARCHAR(40)  NOT NULL DEFAULT '',
      mensagem            TEXT         NULL,
      pagePath            VARCHAR(255) NULL,
      pageUrl             VARCHAR(512) NULL,
      utmSource           VARCHAR(120) NULL,
      utmMedium           VARCHAR(120) NULL,
      utmCampaign         VARCHAR(120) NULL,
      gclid               VARCHAR(200) NULL,
      origem              VARCHAR(120) NULL,
      canal               VARCHAR(60)  NULL,
      status              VARCHAR(40)  NOT NULL DEFAULT 'novo',
      notasInternas       TEXT         NULL,
      createdAt           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Adicionar colunas opcionais que podem não existir em instâncias antigas.
  // Verificamos se a coluna existe antes de tentar adicionar, evitando depender
  // de "IF NOT EXISTS" que nem sempre está disponível em versões mais antigas.
  const [existingCols] = await pool.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leads'`
  ) as [Array<{ COLUMN_NAME: string }>, unknown];
  const colSet = new Set(existingCols.map(r => r.COLUMN_NAME));

  const migrations: Array<[string, string]> = [
    ["origem",        "VARCHAR(120) NULL DEFAULT NULL"],
    ["canal",         "VARCHAR(60)  NULL DEFAULT NULL"],
    ["status",        "VARCHAR(40)  NOT NULL DEFAULT 'novo'"],
    ["notasInternas", "TEXT         NULL"],
    ["updatedAt",     "DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"],
  ];
  for (const [col, def] of migrations) {
    if (!colSet.has(col)) {
      try {
        await pool.execute(`ALTER TABLE leads ADD COLUMN ${col} ${def}`);
      } catch (err) {
        console.error(`[ensureLeadsExtended] Erro ao adicionar coluna ${col}:`, err);
      }
    }
  }

  _leadsExtended = true;
}

export async function createLead(data: {
  nome: string; telefone: string; email: string; localidade: string;
  tipoServico: string; preferenciaContacto: string; mensagem?: string | null;
  pagePath?: string | null; pageUrl?: string | null;
  utmSource?: string | null; utmMedium?: string | null; utmCampaign?: string | null;
  gclid?: string | null;
  /** Formulário/ponto de entrada, ex: "formulario_contactos", "quero_contratar_header" */
  origem?: string | null;
  /** Canal de envio: "whatsapp" | "email" | "simulador" | "quero_contratar" */
  canal?: string | null;
}) {
  try {
    await ensureLeadsExtended();
    await withConnection(async (conn) => {
      await conn.execute(
        `INSERT INTO leads (nome, telefone, email, localidade, tipoServico, preferenciaContacto,
                            mensagem, pagePath, pageUrl, utmSource, utmMedium, utmCampaign, gclid,
                            origem, canal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.nome, data.telefone, data.email, data.localidade, data.tipoServico,
         data.preferenciaContacto, data.mensagem ?? null, data.pagePath ?? null,
         data.pageUrl ?? null, data.utmSource ?? null, data.utmMedium ?? null,
         data.utmCampaign ?? null, data.gclid ?? null,
         data.origem ?? null, data.canal ?? null],
      );
    });
  } catch (err) {
    console.error("[db/createLead] Erro ao inserir lead:", err);
    throw err;
  }
}

export async function getAllLeads() {
  const rows = await withConnection(async (conn) => {
    const [r] = await conn.execute(
      `SELECT id, nome, telefone, email, localidade, tipoServico, preferenciaContacto,
              mensagem, pagePath, pageUrl, utmSource, utmMedium, utmCampaign, gclid,
              status, notasInternas, createdAt
       FROM leads ORDER BY createdAt DESC LIMIT 500`,
    );
    return r;
  });
  return rows as Record<string, unknown>[];
}

export async function updateLeadStatus(id: number, status: string, notasInternas?: string) {
  await withConnection(async (conn) => {
    if (notasInternas !== undefined) {
      await conn.execute(`UPDATE leads SET status = ?, notasInternas = ? WHERE id = ?`, [status, notasInternas, id]);
    } else {
      await conn.execute(`UPDATE leads SET status = ? WHERE id = ?`, [status, id]);
    }
  });
}

let _leadEventsExtended = false;

/**
 * Garante que leadEvents tem as colunas alargadas.
 * Seguro para correr múltiplas vezes — usa IF NOT EXISTS via information_schema.
 */
async function ensureLeadEventsExtended(): Promise<void> {
  if (_leadEventsExtended) return;
  const pool = await getPool();
  if (!pool) return;
  const newCols: Array<{ name: string; sql: string }> = [
    { name: "action",            sql: "ALTER TABLE leadEvents ADD COLUMN action VARCHAR(160) DEFAULT NULL" },
    { name: "label",             sql: "ALTER TABLE leadEvents ADD COLUMN label VARCHAR(160) DEFAULT NULL" },
    { name: "phone",             sql: "ALTER TABLE leadEvents ADD COLUMN phone VARCHAR(30) DEFAULT NULL" },
    { name: "email",             sql: "ALTER TABLE leadEvents ADD COLUMN email VARCHAR(320) DEFAULT NULL" },
    { name: "name",              sql: "ALTER TABLE leadEvents ADD COLUMN name VARCHAR(160) DEFAULT NULL" },
    { name: "message",           sql: "ALTER TABLE leadEvents ADD COLUMN message TEXT DEFAULT NULL" },
    { name: "simulatorData",     sql: "ALTER TABLE leadEvents ADD COLUMN simulatorData JSON DEFAULT NULL" },
    // colunas usadas pelo /api/admin/lead-events SELECT
    { name: "serviceType",       sql: "ALTER TABLE leadEvents ADD COLUMN serviceType VARCHAR(120) DEFAULT NULL" },
    { name: "location",          sql: "ALTER TABLE leadEvents ADD COLUMN location VARCHAR(160) DEFAULT NULL" },
    { name: "contactPreference", sql: "ALTER TABLE leadEvents ADD COLUMN contactPreference VARCHAR(60) DEFAULT NULL" },
  ];
  for (const col of newCols) {
    const exists = await hasColumn("leadEvents", col.name);
    if (!exists) {
      try { await pool.execute(col.sql); } catch {}
    }
  }
  _leadEventsExtended = true;
}

export async function createLeadEvent(data: {
  eventType: string;
  action?: string | null;
  pagePath?: string | null;
  pageUrl?: string | null;
  label?: string | null;
  phone?: string | null;
  email?: string | null;
  name?: string | null;
  serviceType?: string | null;
  location?: string | null;
  message?: string | null;
  simulatorData?: string | null;
  contactPreference?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  gclid?: string | null;
}) {
  await ensureLeadEventsExtended();
  try {
    await withConnection(async (conn) => {
      await conn.execute(
        `INSERT INTO leadEvents
           (eventType, action, pagePath, pageUrl, label, phone, email, name,
            serviceType, location, message, simulatorData,
            contactPreference, utmSource, utmMedium, utmCampaign, gclid)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          String(data.eventType).slice(0, 80),
          data.action ? String(data.action).slice(0, 160) : null,
          data.pagePath ?? null,
          data.pageUrl ?? null,
          data.label ? String(data.label).slice(0, 160) : null,
          data.phone ? String(data.phone).slice(0, 30) : null,
          data.email ? String(data.email).slice(0, 320) : null,
          data.name ? String(data.name).slice(0, 160) : null,
          data.serviceType ?? null,
          data.location ?? null,
          data.message ?? null,
          data.simulatorData ?? null,
          data.contactPreference ?? null,
          data.utmSource ?? null,
          data.utmMedium ?? null,
          data.utmCampaign ?? null,
          data.gclid ?? null,
        ],
      );
    });
    console.log("[db/createLeadEvent] Evento gravado:", data.eventType);
  } catch (err) {
    console.warn("[db/createLeadEvent] Erro ao gravar evento:", data.eventType, err);
  }
}

// ─── Leads helpers END ───────────────────────────────────────────────────────

export async function getTodayRegistroByColaborador(colaboradorId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const result = await db
    .select()
    .from(registrosHoras)
    .where(eq(registrosHoras.colaboradorId, colaboradorId))
    .orderBy(desc(registrosHoras.data))
    .limit(1);

  if (!result[0]) return undefined;
  const regDate = new Date(result[0].data);
  if (regDate >= today && regDate < tomorrow) return result[0];
  return undefined;
}

// ─── SimulatorOrders ────────────────────────────────���─────────────────────────

let _simulatorOrdersEnsured = false;
// Bump this version number any time new migrations are added so the guard re-runs
const MIGRATION_VERSION = 6;
let _migrationVersion = 0;

export async function ensureSimulatorOrdersTable() {
  if (_simulatorOrdersEnsured && _migrationVersion >= MIGRATION_VERSION) return;
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS simulatorOrders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      serviceType VARCHAR(80),
      description TEXT,
      filesJson TEXT,
      address TEXT,
      city VARCHAR(120),
      floor VARCHAR(40),
      hasElevator VARCHAR(20),
      parkingDistance VARCHAR(30),
      contactName VARCHAR(120),
      contactPhone VARCHAR(30),
      contactEmail VARCHAR(200),
      urgency VARCHAR(30),
      estimateMin DECIMAL(10,2),
      estimateMax DECIMAL(10,2),
      estimateTotal DECIMAL(10,2),
      estimateJson TEXT,
      distanceKm DECIMAL(8,2),
      distanceText VARCHAR(60),
      status VARCHAR(40) NOT NULL DEFAULT 'pendente',
      priority VARCHAR(20) DEFAULT 'normal',
      notasInternas TEXT,
      precoFinal DECIMAL(10,2),
      precoFinalIva DECIMAL(10,2),
      mensagemCliente TEXT,
      assignedToId INT,
      assignedToName VARCHAR(120),
      assignedAt TIMESTAMP NULL DEFAULT NULL,
      chatJson LONGTEXT,
      historyJson LONGTEXT,
      reviewJson TEXT,
      colaboradorId INT,
      dataAgendada TIMESTAMP NULL DEFAULT NULL,
      viewedAt TIMESTAMP NULL DEFAULT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  // Migração: adicionar colunas novas se a tabela já existia (sem falhar se já existem)
  const migrations = [
    `ALTER TABLE simulatorOrders MODIFY COLUMN status VARCHAR(40) NOT NULL DEFAULT 'pendente'`,
    // Each ALTER is wrapped in try/catch above — safe to run on every cold start
    `ALTER TABLE simulatorOrders ADD COLUMN priority VARCHAR(20) DEFAULT 'normal'`,
    `ALTER TABLE simulatorOrders ADD COLUMN precoFinalIva DECIMAL(10,2)`,
    `ALTER TABLE simulatorOrders ADD COLUMN mensagemCliente TEXT`,
    `ALTER TABLE simulatorOrders ADD COLUMN assignedToId INT`,
    `ALTER TABLE simulatorOrders ADD COLUMN assignedToName VARCHAR(120)`,
    `ALTER TABLE simulatorOrders ADD COLUMN assignedAt TIMESTAMP NULL DEFAULT NULL`,
    `ALTER TABLE simulatorOrders ADD COLUMN chatJson LONGTEXT`,
    `ALTER TABLE simulatorOrders ADD COLUMN historyJson LONGTEXT`,
    `ALTER TABLE simulatorOrders ADD COLUMN reviewJson TEXT`,
    `ALTER TABLE simulatorOrders ADD COLUMN viewedAt TIMESTAMP NULL DEFAULT NULL`,
    `ALTER TABLE simulatorOrders ADD COLUMN postalCode VARCHAR(20)`,
    `ALTER TABLE simulatorOrders ADD COLUMN parkingDistance VARCHAR(60)`,
    `ALTER TABLE simulatorOrders ADD COLUMN city VARCHAR(120)`,
    // v3 migrations — rawOrderJson stores full form data (origin/dest for mudanca), acceptedAt tracks when assistant accepted
    `ALTER TABLE simulatorOrders ADD COLUMN rawOrderJson LONGTEXT`,
    `ALTER TABLE simulatorOrders ADD COLUMN acceptedAt TIMESTAMP NULL DEFAULT NULL`,
    // v4 migrations — calendar scheduling fields
    `ALTER TABLE simulatorOrders ADD COLUMN scheduledDate DATE NULL DEFAULT NULL`,
    `ALTER TABLE simulatorOrders ADD COLUMN scheduledStartTime VARCHAR(10) NULL DEFAULT NULL`,
    `ALTER TABLE simulatorOrders ADD COLUMN scheduledEndTime VARCHAR(10) NULL DEFAULT NULL`,
    `ALTER TABLE simulatorOrders ADD COLUMN calendarEventId VARCHAR(255) NULL DEFAULT NULL`,
    `ALTER TABLE simulatorOrders ADD COLUMN calendarEventUrl TEXT NULL DEFAULT NULL`,
    `ALTER TABLE simulatorOrders ADD COLUMN calendarStatus VARCHAR(30) NULL DEFAULT 'not_scheduled'`,
    `ALTER TABLE simulatorOrders ADD COLUMN calendarNotes TEXT NULL DEFAULT NULL`,
    // v5 migrations — extended analysis JSON (includes externalMarketEstimate, analysisSource, confidence)
    `ALTER TABLE simulatorOrders ADD COLUMN analysisJsonExtended LONGTEXT NULL DEFAULT NULL`,
    // v6 migrations — target Google Calendar identity (which calendar the event was sent to)
    `ALTER TABLE simulatorOrders ADD COLUMN calendarTargetId VARCHAR(255) NULL DEFAULT NULL`,
    `ALTER TABLE simulatorOrders ADD COLUMN calendarTargetName VARCHAR(255) NULL DEFAULT NULL`,
    // v7 migrations — token de orçamento para página pública de confirmação pelo cliente
    `ALTER TABLE simulatorOrders ADD COLUMN orcamentoToken VARCHAR(64) NULL DEFAULT NULL`,
    `ALTER TABLE simulatorOrders ADD COLUMN confirmadoPeloCliente TINYINT(1) NULL DEFAULT 0`,
    `ALTER TABLE simulatorOrders ADD COLUMN confirmadoEm TIMESTAMP NULL DEFAULT NULL`,
    `ALTER TABLE simulatorOrders ADD COLUMN canceladoPeloCliente TINYINT(1) NULL DEFAULT 0`,
    `ALTER TABLE simulatorOrders ADD COLUMN canceladoPeloClienteEm TIMESTAMP NULL DEFAULT NULL`,
    // v8 migrations — pagamento fixo por trabalho (snapshot do valor em vigor no momento da atribuição)
    `ALTER TABLE simulatorOrders ADD COLUMN valorPagoAssistente DECIMAL(8,2) NULL DEFAULT NULL`,
    // v9 migrations — atribuição a empresa parceira do marketplace (portal do parceiro)
    `ALTER TABLE simulatorOrders ADD COLUMN providerId INT UNSIGNED NULL DEFAULT NULL`,
    `ALTER TABLE simulatorOrders ADD COLUMN providerAcceptedAt TIMESTAMP NULL DEFAULT NULL`,
    // v10 migrations — marcações recorrentes (desconto) e avaliação do cliente pós-conclusão
    `ALTER TABLE simulatorOrders ADD COLUMN recurrenceFrequency VARCHAR(20) NULL DEFAULT NULL`,
    `ALTER TABLE simulatorOrders ADD COLUMN recurringDiscountPercent DECIMAL(5,2) NULL DEFAULT NULL`,
    `ALTER TABLE simulatorOrders ADD COLUMN clientRating TINYINT NULL DEFAULT NULL`,
    `ALTER TABLE simulatorOrders ADD COLUMN clientRatingComment TEXT NULL DEFAULT NULL`,
    // v11 migrations — quando o assistente abriu pela última vez a aba Histórico
    // (usado para contar respostas de cliente por ler e mostrar badge)
    `ALTER TABLE simulatorOrders ADD COLUMN historyReadAt DATETIME NULL DEFAULT NULL`,
  ];
  for (const sql of migrations) {
    try { await pool.execute(sql); } catch (e: any) {
      // Log only non-"duplicate column" errors so we can see real problems
      if (!e?.message?.includes("Duplicate column")) {
        console.error("[v0] migration skipped:", e?.message);
      }
    }
  }
  _simulatorOrdersEnsured = true;
  _migrationVersion = MIGRATION_VERSION;
}

export async function createSimulatorOrder(data: InsertSimulatorOrder): Promise<number> {
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const cols = Object.keys(data).filter((k) => (data as Record<string, unknown>)[k] !== undefined);
  const vals = cols.map((k) => (data as Record<string, unknown>)[k]);
  const placeholders = cols.map(() => "?").join(", ");
  const sql = `INSERT INTO simulatorOrders (${cols.join(", ")}) VALUES (${placeholders})`;
  const [result] = await pool.execute(sql, vals) as any[];
  const insertId = result.insertId ?? 0;
  return insertId;
}

export async function getAllSimulatorOrders(filters?: {
  status?: string;
  search?: string;
}): Promise<SimulatorOrder[]> {
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) {
    console.error("[v0] getAllSimulatorOrders: ❌ Pool indisponível!");
    return [];
  }
  const conditions: string[] = [];
  const params: unknown[] = [];
  
  // Handle special filters
  if (filters?.status === "sem_assistente") {
    conditions.push("(assignedToId IS NULL OR assignedToId = 0) AND status NOT IN ('cancelado','confirmado','concluido','arquivado')");
  } else if (filters?.status === "pendente") {
    // "Novos" = any status but NOT viewed yet (viewedAt IS NULL)
    conditions.push("viewedAt IS NULL AND status != 'arquivado'");
  } else if (filters?.status) {
    conditions.push("status = ?");
    params.push(filters.status);
  } else {
    // Vista por defeito ("todos os status activos"): exclui pedidos arquivados
    conditions.push("status != 'arquivado'");
  }
  
  if (filters?.search) {
    conditions.push("(contactName LIKE ? OR contactPhone LIKE ? OR address LIKE ? OR description LIKE ?)");
    const s = `%${filters.search}%`;
    params.push(s, s, s, s);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  // OPTIMIZATION: Select only essential fields (exclude large JSON fields like chatHistory, estimate)
  // This dramatically reduces payload size and improves dashboard load time
  const [rows] = await pool.execute(
    `SELECT id, contactName, contactPhone, address, serviceType, status, precoFinal, estimateTotal, 
            createdAt, dataAgendada, assignedToId, assignedToName, priority 
     FROM simulatorOrders ${where} ORDER BY createdAt DESC LIMIT 100`,
    params,
  ) as any[];
  const result = rows as SimulatorOrder[];
  return result;
}

export async function getSimulatorOrderById(id: number): Promise<SimulatorOrder | undefined> {
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) return undefined;
  const [rows] = await pool.execute("SELECT * FROM simulatorOrders WHERE id = ? LIMIT 1", [id]) as any[];
  return (rows as SimulatorOrder[])[0];
}

export async function markOrderAsViewed(id: number): Promise<void> {
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(
    "UPDATE simulatorOrders SET viewedAt = CURRENT_TIMESTAMP WHERE id = ? AND viewedAt IS NULL",
    [id]
  );
}

export async function updateSimulatorOrder(
  id: number,
  data: Partial<{
    status: string;
    priority: string;
    notasInternas: string | null;
    precoFinal: string | null;
    precoFinalIva: string | null;
    mensagemCliente: string | null;
    colaboradorId: number;
    dataAgendada: string | null;
    assignedToId: number | null;
    assignedToName: string | null;
    assignedAt: string | null;
    serviceType: string | null;
    description: string | null;
    contactName: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    address: string | null;
    city: string | null;
    postalCode: string | null;
    floor: string | null;
    hasElevator: string | null;
    parkingDistance: string | null;
    urgency: string | null;
    rawOrderJson: string | null;
    acceptedAt: Date | string | null;
    scheduledDate: string | null;
    scheduledStartTime: string | null;
    scheduledEndTime: string | null;
    calendarEventId: string | null;
    calendarEventUrl: string | null;
    calendarStatus: string | null;
    calendarNotes: string | null;
    analysisJsonExtended: string | null;
    calendarTargetId: string | null;
    calendarTargetName: string | null;
    recurrenceFrequency: string | null;
    recurringDiscountPercent: number | null;
    clientRating: number | null;
    clientRatingComment: string | null;
    historyReadAt: string | null;
  }>
) {
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");

  // Capturar estado + contacto ANTES da atualização, para saber se o estado
  // mudou e a quem notificar.
  let prevForNotify:
    | { status: string; contactEmail: string | null; contactName: string | null; serviceType: string | null }
    | null = null;
  if (data.status !== undefined) {
    const [prevRows] = (await pool.execute(
      "SELECT status, contactEmail, contactName, serviceType FROM simulatorOrders WHERE id = ? LIMIT 1",
      [id],
    )) as [Array<{ status: string; contactEmail: string | null; contactName: string | null; serviceType: string | null }>, unknown];
    prevForNotify = prevRows[0] ?? null;
  }

  const entries = Object.entries(data).filter(([, v]) => v !== undefined);
  if (!entries.length) return;
  const sets = entries.map(([k]) => `${k} = ?`).join(", ");
  const vals = [...entries.map(([, v]) => v), id];
  await pool.execute(`UPDATE simulatorOrders SET ${sets} WHERE id = ?`, vals);

  // Notificar o cliente por email quando o estado muda de facto — assíncrono,
  // respeita a preferência notifOrderStatus e nunca bloqueia a atualização.
  if (data.status !== undefined && prevForNotify && data.status !== prevForNotify.status) {
    const to = prevForNotify.contactEmail;
    const newStatus = data.status;
    if (to) {
      (async () => {
        const { statusTriggersEmail, sendOrderStatusEmail } = await import("@/lib/email-status");
        if (!statusTriggersEmail(newStatus)) return;
        // Opt-out explícito: só não envia se existir um utilizador com a preferência desligada.
        const [uRows] = (await pool.execute(
          "SELECT notifOrderStatus FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) LIMIT 1",
          [to],
        )) as [Array<{ notifOrderStatus: number }>, unknown];
        if (uRows[0] && Number(uRows[0].notifOrderStatus) === 0) return;

        // Email
        await sendOrderStatusEmail({
          to,
          clienteName: prevForNotify!.contactName,
          serviceType: prevForNotify!.serviceType,
          orderId: id,
          status: newStatus,
        });

        // Web Push (navegador) — para os mesmos estados relevantes ao cliente.
        const { sendPushToUser } = await import("@/lib/webpush");
        const { STATUS_PUSH } = await import("@/lib/email-status");
        const push = STATUS_PUSH[newStatus];
        if (push) {
          await sendPushToUser(to, {
            title: push.title,
            body: push.body,
            url: "/conta",
            tag: `pedido-${id}`,
          });
        }
      })().catch((err) => console.error("[updateSimulatorOrder] falha na notificação de estado:", err));
    }
  }

  // Exportação para Google Sheets quando o pedido passa a concluído — assíncrona,
  // nunca bloqueia nem falha a atualização do pedido em si (ver google-sheets.ts).
  // Import dinâmico para evitar dependência circular no módulo (db.ts <-> google-sheets.ts).
  if (data.status === "concluido") {
    const [rows] = await pool.execute(
      `SELECT id, createdAt, serviceType, city, estimateTotal, precoFinal, precoFinalIva, providerId
       FROM simulatorOrders WHERE id = ? LIMIT 1`,
      [id],
    ) as [any[], unknown];
    const orderForExport = rows[0];
    if (orderForExport) {
      import("@/lib/google-sheets")
        .then(({ exportCompletedOrderToSheet }) => exportCompletedOrderToSheet(orderForExport))
        .catch((err) => console.error("[updateSimulatorOrder] falha ao carregar google-sheets:", err));
    }
  }
}

export async function deleteSimulatorOrder(id: number) {
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute("DELETE FROM simulatorOrders WHERE id = ?", [id]);
}

// ── Web Push: subscrições do navegador ───────────────────────────────────────
let pushTableReady = false;
async function ensurePushSubscriptionsTable() {
  if (pushTableReady) return;
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS pushSubscriptions (
      id        INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      userEmail VARCHAR(255) NOT NULL,
      endpoint  VARCHAR(600) NOT NULL,
      p256dh    VARCHAR(255) NOT NULL,
      auth      VARCHAR(255) NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_endpoint (endpoint),
      KEY idx_email (userEmail)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  pushTableReady = true;
}

export interface StoredPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function savePushSubscription(email: string, sub: StoredPushSubscription) {
  await ensurePushSubscriptionsTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(
    `INSERT INTO pushSubscriptions (userEmail, endpoint, p256dh, auth)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE userEmail = VALUES(userEmail), p256dh = VALUES(p256dh), auth = VALUES(auth)`,
    [email.trim().toLowerCase(), sub.endpoint, sub.p256dh, sub.auth],
  );
}

export async function deletePushSubscription(endpoint: string) {
  await ensurePushSubscriptionsTable();
  const pool = await getPool();
  if (!pool) return;
  await pool.execute("DELETE FROM pushSubscriptions WHERE endpoint = ?", [endpoint]);
}

export async function getPushSubscriptionsByEmail(email: string): Promise<StoredPushSubscription[]> {
  await ensurePushSubscriptionsTable();
  const pool = await getPool();
  if (!pool) return [];
  const [rows] = (await pool.execute(
    "SELECT endpoint, p256dh, auth FROM pushSubscriptions WHERE userEmail = ?",
    [email.trim().toLowerCase()],
  )) as [StoredPushSubscription[], unknown];
  return rows;
}

export async function countSimulatorOrdersByStatus(): Promise<Record<string, number>> {
  try {
    await ensureSimulatorOrdersTable();
    const pool = await getPool();
    if (!pool) {
      console.error("[v0] countSimulatorOrdersByStatus: ❌ Pool indisponível");
      return { total: 0 };
    }
    
    
    // Usar uma única query otimizada para contar tudo
    const [countRows] = await pool.execute(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END) as pendente_status,
        SUM(CASE WHEN viewedAt IS NULL THEN 1 ELSE 0 END) as pendente_viewed,
        SUM(CASE WHEN status = 'atribuido' THEN 1 ELSE 0 END) as atribuido,
        SUM(CASE WHEN status = 'em_analise' THEN 1 ELSE 0 END) as em_analise,
        SUM(CASE WHEN status = 'aprovado' THEN 1 ELSE 0 END) as aprovado,
        SUM(CASE WHEN status = 'confirmado' THEN 1 ELSE 0 END) as confirmado,
        SUM(CASE WHEN status = 'presencial_recomendado' THEN 1 ELSE 0 END) as presencial,
        SUM(CASE WHEN (assignedToId IS NULL OR assignedToId = 0) AND status NOT IN ('cancelado','confirmado','concluido','arquivado') THEN 1 ELSE 0 END) as sem_assistente
       FROM simulatorOrders`
    ) as any[];
    
    const row = (countRows as any[])[0];
    const result: Record<string, number> = {};
    
    // Mapear resultados
    result["total"] = Number(row?.total ?? 0);
    result["pendente"] = Number(row?.pendente_viewed ?? 0); // Novos = viewedAt IS NULL
    result["atribuido"] = Number(row?.atribuido ?? 0);
    result["em_analise"] = Number(row?.em_analise ?? 0);
    result["aprovado"] = Number(row?.aprovado ?? 0);
    result["confirmado"] = Number(row?.confirmado ?? 0);
    result["presencial_recomendado"] = Number(row?.presencial ?? 0);
    result["sem_assistente"] = Number(row?.sem_assistente ?? 0);
    
    return result;
  } catch (err: any) {
    console.error("[v0] countSimulatorOrdersByStatus: ❌ Erro =", err.message);
    return { total: 0 };
  }
}

// ─── Assistentes (colaboradores que gerem pedidos) ───────────────────────────

export async function getActiveAssistants(): Promise<Array<{ id: number; nome: string; funcao: string; isAdmin: number }>> {
  const pool = await getPool();
  if (!pool) {
    console.error("[v0] getActiveAssistants: ❌ Pool indisponível!");
    return [];
  }
  // Apenas assistentes activos que podem receber pedidos do simulador
  const [rows] = await pool.execute(
    `SELECT id, nome, funcao, isAdmin FROM colaboradores
     WHERE funcao = 'assistente'
       AND isAdmin = 0
       AND (active IS NULL OR active = 1)
       AND (canReceiveSimulatorRequests IS NULL OR canReceiveSimulatorRequests = 1)
     ORDER BY nome ASC`
  ) as any[];
  const result = rows as any[];
  return result;
}

export async function countActiveOrdersByAssistant(): Promise<Record<number, number>> {
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) {
    console.error("[v0] countActiveOrdersByAssistant: ❌ Pool indisponível!");
    return {};
  }
  const [rows] = await pool.execute(
    `SELECT assignedToId, COUNT(*) AS total FROM simulatorOrders
     WHERE assignedToId IS NOT NULL
       AND status NOT IN ('confirmado','concluido','cancelado','rejeitado')
     GROUP BY assignedToId`
  ) as any[];
  const result: Record<number, number> = {};
  for (const row of rows as any[]) result[Number(row.assignedToId)] = Number(row.total);
  return result;
}

export async function pickLeastLoadedAssistant(): Promise<{ id: number; nome: string } | null> {
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  const [assistants, counts] = await Promise.all([
    getActiveAssistants(),
    countActiveOrdersByAssistant(),
  ]);
  
  if (!assistants.length) {
    return null;
  }

  // Desempate: assistente que recebeu pedido há mais tempo tem prioridade
  const lastAssigned: Record<number, string> = {};
  if (pool) {
    try {
      const [rows] = await pool.execute(
        `SELECT assignedToId, MAX(assignedAt) AS lastAt FROM simulatorOrders
         WHERE assignedToId IS NOT NULL GROUP BY assignedToId`
      ) as any[];
      for (const row of rows as any[]) lastAssigned[Number(row.assignedToId)] = String(row.lastAt ?? "");
    } catch (e) {
      console.error("[v0] pickLeastLoadedAssistant: Erro ao buscar lastAssigned:", e);
    }
  }

  let best: { id: number; nome: string } | null = null;
  let bestCount = Infinity;
  let bestLastAt = "9999-12-31";

  for (const a of assistants) {
    const c = counts[a.id] ?? 0;
    const lastAt = lastAssigned[a.id] ?? "0000-01-01";
    if (c < bestCount || (c === bestCount && lastAt < bestLastAt)) {
      bestCount = c;
      bestLastAt = lastAt;
      best = { id: a.id, nome: a.nome };
    }
  }
  
  return best;
}

export async function appendOrderHistory(
  orderId: number,
  entry: { type: string; by?: { id: number; nome: string; role: string } | null; message: string }
): Promise<void> {
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) return;
  const now = toMySQLDateTime();
  const [rows] = await pool.execute("SELECT historyJson FROM simulatorOrders WHERE id = ? LIMIT 1", [orderId]) as any[];
  const existing: any[] = [];
  try { if ((rows as any[])[0]?.historyJson) existing.push(...JSON.parse((rows as any[])[0].historyJson)); } catch {}
  existing.push({ ...entry, createdAt: now });
  await pool.execute("UPDATE simulatorOrders SET historyJson=?, updatedAt=NOW() WHERE id=?", [JSON.stringify(existing), orderId]);
}

export async function assignSimulatorOrder(
  orderId: number,
  assignee: { id: number; nome: string } | null,
  actor: { id: number; nome: string; role: string } | null
): Promise<void> {
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) return;

  const newStatus = assignee ? "atribuido" : "pendente";
  const isAuto = actor === null;
  const message = assignee
    ? isAuto
      ? `Pedido atribuído automaticamente a ${assignee.nome}.`
      : `Pedido reatribuído a ${assignee.nome} por ${actor?.nome ?? "—"}.`
    : actor
      ? `Atribuição removida por ${actor.nome}.`
      : "Pedido sem assistente atribuído.";

  // Obter snapshot do valor de pagamento actual para este trabalho.
  // Guardado no pedido no momento da atribuição para evitar recalcular retroativamente
  // se o valor global for alterado mais tarde.
  let valorPagoAssistente: number | null = null;
  if (assignee) {
    try {
      const settings = await getSimulatorSettings();
      const entry = settings.find((s) => s.key === "pagamento_assistente_por_trabalho");
      valorPagoAssistente = entry ? parseFloat(String(entry.value)) : 7.00;
    } catch {
      valorPagoAssistente = 7.00; // fallback
    }
  }

  const [rows] = await pool.execute("SELECT historyJson FROM simulatorOrders WHERE id = ? LIMIT 1", [orderId]) as any[];
  const existing: any[] = [];
  try { if ((rows as any[])[0]?.historyJson) existing.push(...JSON.parse((rows as any[])[0].historyJson)); } catch {}
  existing.push({ type: "assigned", by: actor ?? null, message, createdAt: toMySQLDateTime() });

  await pool.execute(
    `UPDATE simulatorOrders SET assignedToId=?, assignedToName=?, assignedAt=?, status=?, historyJson=?, valorPagoAssistente=?, updatedAt=NOW() WHERE id=?`,
    [assignee?.id ?? null, assignee?.nome ?? null, assignee ? new Date() : null, newStatus, JSON.stringify(existing), valorPagoAssistente, orderId]
  );
}

export async function approveSimulatorOrder(
  orderId: number,
  data: { precoFinal: number; precoFinalIva: number; mensagemCliente: string; notasInternas?: string; reviewedBy: { id: number; nome: string; role: string } }
): Promise<void> {
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) return;
  const reviewJson = JSON.stringify({ ...data, reviewedAt: toMySQLDateTime() });
  await pool.execute(
    `UPDATE simulatorOrders SET status='aprovado', precoFinal=?, precoFinalIva=?, mensagemCliente=?, notasInternas=COALESCE(?,notasInternas), reviewJson=?, updatedAt=NOW() WHERE id=?`,
    [data.precoFinal, data.precoFinalIva, data.mensagemCliente, data.notasInternas ?? null, reviewJson, orderId]
  );
  await appendOrderHistory(orderId, {
    type: "approved",
    by: data.reviewedBy,
    message: `Pedido aprovado por ${data.reviewedBy.nome}. Valor: ${data.precoFinal}€ + IVA.`,
  });
}

export async function getSimulatorOrdersByAssistant(assignedToId: number): Promise<SimulatorOrder[]> {
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) {
    console.error("[v0] getSimulatorOrdersByAssistant: ❌ Pool indisponível!");
    return [];
  }
  // Assistente vê:
  //  1. pedidos explicitamente atribuídos a si (assignedToId = ?)
  //  2. pedidos na fila geral: assignedToId IS NULL — inclui status 'pendente' e 'sem_assistente'
  // Nunca vê pedidos atribuídos a outro assistente.
  const [rows] = await pool.execute(
    `SELECT id, contactName, contactPhone, address, serviceType, status, precoFinal, estimateTotal,
            createdAt, updatedAt, dataAgendada, assignedToId, assignedToName, priority, viewedAt,
            description, urgency, distanceKm
     FROM simulatorOrders
     WHERE assignedToId = ?
        OR (assignedToId IS NULL AND status IN ('pendente', 'sem_assistente', 'novo'))
     ORDER BY createdAt DESC
     LIMIT 200`,
    [assignedToId]
  ) as any[];
  const result = rows as SimulatorOrder[];
  return result;
}

export function calculateOrderPriority(order: {
  urgency?: string | null;
  description?: string | null;
  estimateTotal?: string | null;
}): "baixa" | "normal" | "alta" | "urgente" {
  const desc = (order.description ?? "").toLowerCase();
  const urgency = (order.urgency ?? "").toLowerCase();
  if (urgency.includes("hoje") || urgency.includes("urgente")) return "urgente";
  if (urgency.includes("amanh")) return "alta";
  if (desc.includes("casa cheia") || desc.includes("esvaziamento") || desc.includes("obra pesada")) return "alta";
  const total = parseFloat(order.estimateTotal ?? "0");
  if (total > 400) return "alta";
  if (!order.description && !order.urgency) return "baixa";
  return "normal";
}

// ─── Helpers de permissão e roles ───────────────────────────────────────────

export type EffectiveRole = "admin_geral" | "assistente" | "motorista" | "ajudante" | "colaborador";

/**
 * Fonte única de verdade para o role efectivo de um utilizador.
 * Admin geral é determinado por isAdmin=1, independentemente de funcao.
 */
export function getEffectiveRole(user: { isAdmin: number; funcao: string }): EffectiveRole {
  if (user.isAdmin) return "admin_geral";
  if (user.funcao === "assistente") return "assistente";
  if (user.funcao === "motorista") return "motorista";
  if (user.funcao === "ajudante") return "ajudante";
  return "colaborador";
}

export function canViewRequest(
  user: { isAdmin: number; id: number },
  request: { assignedToId?: number | null }
): boolean {
  if (user.isAdmin) return true;
  return request.assignedToId === user.id;
}

export function canEditRequest(
  user: { isAdmin: number; id: number },
  request: { assignedToId?: number | null }
): boolean {
  if (user.isAdmin) return true;
  return request.assignedToId === user.id;
}

export function canManageUsers(user: { isAdmin: number }): boolean {
  return !!user.isAdmin;
}

// ─── Orçamento token ─────────────────────────────────────────────────────────

/**
 * Gera (ou reutiliza) um token único para a página de orçamento do cliente.
 * Retorna o token criado/existente.
 */
export async function setOrcamentoToken(orderId: number): Promise<string> {
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) throw new Error("Database not available");
  // Reutilizar token existente se já houver
  const [[existing]] = await pool.execute(
    "SELECT orcamentoToken FROM simulatorOrders WHERE id = ? LIMIT 1",
    [orderId]
  ) as any[];
  if (existing?.orcamentoToken) return existing.orcamentoToken as string;
  const { randomBytes } = await import("crypto");
  const token = randomBytes(32).toString("hex");
  await pool.execute(
    "UPDATE simulatorOrders SET orcamentoToken = ? WHERE id = ?",
    [token, orderId]
  );
  return token;
}

export async function getOrderByToken(token: string): Promise<SimulatorOrder | null> {
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) return null;
  const [rows] = await pool.execute(
    "SELECT * FROM simulatorOrders WHERE orcamentoToken = ? LIMIT 1",
    [token]
  ) as any[];
  return (rows as SimulatorOrder[])[0] ?? null;
}

export async function confirmarOrcamento(token: string): Promise<{ ok: boolean; error?: string }> {
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) return { ok: false, error: "Database not available" };
  const order = await getOrderByToken(token);
  if (!order) return { ok: false, error: "Pedido não encontrado." };
  if ((order as any).canceladoPeloCliente) return { ok: false, error: "Este pedido já foi cancelado." };
  if ((order as any).confirmadoPeloCliente) return { ok: true }; // idempotente
  await pool.execute(
    "UPDATE simulatorOrders SET confirmadoPeloCliente = 1, confirmadoEm = NOW(), status = 'confirmado', updatedAt = NOW() WHERE orcamentoToken = ?",
    [token]
  );
  await appendOrderHistory(order.id, {
    type: "client_confirmed",
    by: null,
    message: "Cliente confirmou o orçamento através da página de confirmação.",
  });
  return { ok: true };
}

export async function cancelarOrcamentoPeloCliente(token: string): Promise<{ ok: boolean; error?: string }> {
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) return { ok: false, error: "Database not available" };
  const order = await getOrderByToken(token);
  if (!order) return { ok: false, error: "Pedido não encontrado." };
  if ((order as any).canceladoPeloCliente) return { ok: true }; // idempotente
  if ((order as any).confirmadoPeloCliente) return { ok: false, error: "O pedido já foi confirmado e não pode ser cancelado aqui. Por favor contacte a CLYON directamente." };
  await pool.execute(
    "UPDATE simulatorOrders SET canceladoPeloCliente = 1, canceladoPeloClienteEm = NOW(), status = 'cancelado', updatedAt = NOW() WHERE orcamentoToken = ?",
    [token]
  );
  await appendOrderHistory(order.id, {
    type: "client_cancelled",
    by: null,
    message: "Cliente cancelou o pedido através da página de confirmação.",
  });
  return { ok: true };
}

// ─── SimulatorOrders END ──────────────────────────────────────────────────────

// ─── Pagamentos de Assistentes ────────────────────────────────────────────────

export interface PagamentoAssistente {
  assistenteId: number;
  assistenteNome: string;
  totalTrabalhos: number;
  totalEuros: number;
  /** Detalhe por trabalho atribuído no período */
  trabalhos: Array<{
    pedidoId: number;
    assignedAt: string;
    valorPago: number;
    serviceType: string | null;
    city: string | null;
  }>;
}

export async function getPagamentosAssistente(opts: {
  from: Date;
  to: Date;
  assistenteId?: number;
}): Promise<PagamentoAssistente[]> {
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) return [];

  // Query única: todos os pedidos atribuídos no período com assistente e valor snapshot
  const [rows] = await pool.execute(
    `SELECT
       assignedToId,
       assignedToName,
       id            AS pedidoId,
       assignedAt,
       COALESCE(valorPagoAssistente, 7.00) AS valorPago,
       serviceType,
       city
     FROM simulatorOrders
     WHERE assignedToId IS NOT NULL
       AND assignedAt >= ?
       AND assignedAt <= ?
       ${opts.assistenteId ? "AND assignedToId = ?" : ""}
     ORDER BY assignedToId, assignedAt DESC`,
    opts.assistenteId
      ? [opts.from, opts.to, opts.assistenteId]
      : [opts.from, opts.to]
  ) as any[];

  const rowList = rows as any[];

  // Agrupar por assistente
  const map = new Map<number, PagamentoAssistente>();
  for (const r of rowList) {
    const id = Number(r.assignedToId);
    if (!map.has(id)) {
      map.set(id, {
        assistenteId:   id,
        assistenteNome: r.assignedToName ?? `Assistente ${id}`,
        totalTrabalhos: 0,
        totalEuros:     0,
        trabalhos:      [],
      });
    }
    const entry = map.get(id)!;
    const valor = parseFloat(String(r.valorPago ?? 7));
    entry.totalTrabalhos += 1;
    entry.totalEuros     += valor;
    entry.trabalhos.push({
      pedidoId:    Number(r.pedidoId),
      assignedAt:  r.assignedAt instanceof Date ? r.assignedAt.toISOString() : String(r.assignedAt),
      valorPago:   valor,
      serviceType: r.serviceType ?? null,
      city:        r.city ?? null,
    });
  }

  return Array.from(map.values()).sort((a, b) => b.totalEuros - a.totalEuros);
}

// ─── Trabalhos Realizados ──────────────────────��──────────────────────────────

let trabalhosTableEnsured = false;

export async function ensureTrabalhosTable(): Promise<void> {
  if (trabalhosTableEnsured) return;
  const pool = await getPool();
  if (!pool) throw new Error("Database not available");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS trabalhos_realizados (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      fotosJson    TEXT NOT NULL,
      tipoServico  VARCHAR(64) NOT NULL,
      localidade   VARCHAR(120) NOT NULL,
      descricao    TEXT NULL,
      publicado    TINYINT(1) NOT NULL DEFAULT 0,
      createdAt    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  trabalhosTableEnsured = true;
}

function rowToTrabalho(row: typeof trabalhosRealizados.$inferSelect): TrabalhoRealizadoData {
  let fotos: string[] = [];
  try { fotos = JSON.parse(row.fotosJson || "[]"); } catch {}
  return {
    id:          row.id,
    fotos,
    tipoServico: row.tipoServico,
    localidade:  row.localidade,
    descricao:   row.descricao ?? null,
    publicado:   Boolean(row.publicado),
    createdAt:   row.createdAt,
    updatedAt:   row.updatedAt,
  };
}

export async function listTrabalhos(opts?: { publicadoOnly?: boolean }): Promise<TrabalhoRealizadoData[]> {
  await ensureTrabalhosTable();
  const db = await getDb();
  if (!db) return [];
  const rows = opts?.publicadoOnly
    ? await db.select().from(trabalhosRealizados).where(eq(trabalhosRealizados.publicado, 1)).orderBy(desc(trabalhosRealizados.createdAt))
    : await db.select().from(trabalhosRealizados).orderBy(desc(trabalhosRealizados.createdAt));
  return rows.map(rowToTrabalho);
}

export async function getTrabalho(id: number): Promise<TrabalhoRealizadoData | null> {
  await ensureTrabalhosTable();
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(trabalhosRealizados).where(eq(trabalhosRealizados.id, id));
  return rows[0] ? rowToTrabalho(rows[0]) : null;
}

export async function createTrabalho(data: {
  fotos: string[];
  tipoServico: string;
  localidade: string;
  descricao?: string | null;
  publicado?: boolean;
}): Promise<number> {
  await ensureTrabalhosTable();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(trabalhosRealizados).values({
    fotosJson:   JSON.stringify(data.fotos),
    tipoServico: data.tipoServico,
    localidade:  data.localidade,
    descricao:   data.descricao ?? null,
    publicado:   data.publicado ? 1 : 0,
  });
  return (result as any)[0]?.insertId ?? 0;
}

export async function updateTrabalho(id: number, data: {
  fotos?: string[];
  tipoServico?: string;
  localidade?: string;
  descricao?: string | null;
  publicado?: boolean;
}): Promise<void> {
  await ensureTrabalhosTable();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const patch: Record<string, unknown> = {};
  if (data.fotos !== undefined)       patch.fotosJson   = JSON.stringify(data.fotos);
  if (data.tipoServico !== undefined)  patch.tipoServico = data.tipoServico;
  if (data.localidade !== undefined)   patch.localidade  = data.localidade;
  if ("descricao" in data)             patch.descricao   = data.descricao ?? null;
  if (data.publicado !== undefined)    patch.publicado   = data.publicado ? 1 : 0;
  if (Object.keys(patch).length === 0) return;
  await db.update(trabalhosRealizados).set(patch as any).where(eq(trabalhosRealizados.id, id));
}

export async function deleteTrabalho(id: number): Promise<void> {
  await ensureTrabalhosTable();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(trabalhosRealizados).where(eq(trabalhosRealizados.id, id));
}

// ─── Trabalhos END ────────────────────────────────────────────────────────────
