import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq, desc, inArray } from "drizzle-orm";
import { users, colaboradores, simulatorSettings, galleryMedia, trabalhosRealizados } from "../../drizzle/schema";
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
          // value NOT updated — admin edits via backoffice are preserved
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
// Sobe sempre que a lista de colunas cresce. O guarda booleano sozinho só
// deixava as migrações correr em arranques frios — um processo já quente
// continuava a servir pedidos contra uma tabela sem as colunas novas, e a
// falhar em consultas que as nomeiam.
const VERSAO_DOS_PROFISSIONAIS = 3;
let versaoDosProfissionais = 0;

/**
 * Garante que as tabelas `providers` e `provider_coverage` existem.
 * Base do marketplace (CLYON_Plano_Mestre_Definitivo v3.0, secção 6.2) —
 * ainda sem UI/API a consumir, só o schema. Segue o mesmo padrão idempotente
 * de ensureUsersSchema(): CREATE TABLE IF NOT EXISTS + ALTER TABLE ADD COLUMN
 * condicional, para instâncias que já tenham uma versão anterior da tabela.
 */
export async function ensureProvidersSchema(): Promise<void> {
  if (providersSchemaEnsured && versaoDosProfissionais >= VERSAO_DOS_PROFISSIONAIS) return;

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

      // ── Plataforma (16-08-2026) ──────────────────────────────────────────
      // Estes profissionais são os do SITE, em MySQL. Não confundir com os
      // partner_profiles do Supabase, que são os da app e cujo esquema é do
      // Bridge — ver partner-profile.ts. São sistemas separados de propósito:
      // o site testa o modelo novo antes de lhe tocar na app.
      {
        name: "categorias",
        sql: "ALTER TABLE providers ADD COLUMN categorias TEXT NULL",
      },
      {
        name: "raioKm",
        sql: "ALTER TABLE providers ADD COLUMN raioKm INT NULL",
      },
      {
        name: "zonas",
        sql: "ALTER TABLE providers ADD COLUMN zonas TEXT NULL",
      },
      {
        name: "emiteFatura",
        sql: "ALTER TABLE providers ADD COLUMN emiteFatura TINYINT(1) NOT NULL DEFAULT 0",
      },
      {
        name: "emiteGuiaTransporte",
        sql: "ALTER TABLE providers ADD COLUMN emiteGuiaTransporte TINYINT(1) NOT NULL DEFAULT 0",
      },
      {
        name: "numeroTransportador",
        sql: "ALTER TABLE providers ADD COLUMN numeroTransportador VARCHAR(60) NULL",
      },
      // A verificação vive numa coluna própria, e não num booleano junto da
      // declaração, porque são coisas diferentes: uma é o que ele diz, a outra
      // é o que nós confirmámos. Um distintivo que o próprio liga sozinho vale
      // menos do que nenhum — o cliente confia nele.
      {
        name: "guiaVerificadaEm",
        sql: "ALTER TABLE providers ADD COLUMN guiaVerificadaEm DATETIME NULL DEFAULT NULL",
      },
      {
        name: "guiaVerificadaPor",
        sql: "ALTER TABLE providers ADD COLUMN guiaVerificadaPor VARCHAR(120) NULL",
      },
      // Ninguém entra aprovado. 'pendente' → 'aprovado' | 'rejeitado' | 'suspenso'.
      {
        name: "estado",
        sql: "ALTER TABLE providers ADD COLUMN estado VARCHAR(20) NOT NULL DEFAULT 'pendente'",
      },
      // Onde fica a base dele. Sem coordenadas o raioKm não passa de um número
      // no formulário: não há como medir distância, e a elegibilidade fica
      // reduzida a comparar nomes de cidades.
      {
        name: "baseLat",
        sql: "ALTER TABLE providers ADD COLUMN baseLat DECIMAL(10,7) NULL DEFAULT NULL",
      },
      {
        name: "baseLng",
        sql: "ALTER TABLE providers ADD COLUMN baseLng DECIMAL(10,7) NULL DEFAULT NULL",
      },
      // Definir a palavra-passe por link, e nunca por palavra-passe enviada
      // por email: um email é copiado, reencaminhado e fica na caixa para
      // sempre. O que vai no email é um token de uso único, guardado com hash
      // como todos os outros deste projecto.
      {
        name: "senhaTokenHash",
        sql: "ALTER TABLE providers ADD COLUMN senhaTokenHash VARCHAR(64) NULL DEFAULT NULL",
      },
      {
        name: "senhaTokenExpiraEm",
        sql: "ALTER TABLE providers ADD COLUMN senhaTokenExpiraEm DATETIME NULL DEFAULT NULL",
      },
      {
        name: "ultimoAcesso",
        sql: "ALTER TABLE providers ADD COLUMN ultimoAcesso DATETIME NULL DEFAULT NULL",
      },
      // O regime de IVA é DELE, não nosso — ver inscricao-profissional.ts.
      // 'isento' por omissão: entre mostrar imposto a mais e a menos, o
      // primeiro é o que cria um problema a alguém.
      {
        name: "regimeIva",
        sql: "ALTER TABLE providers ADD COLUMN regimeIva VARCHAR(10) NOT NULL DEFAULT 'isento'",
      },

      // ── Carteira (18-08-2026) ────────────────────────────────────────────
      // Para onde vai o dinheiro dele. Guardado inteiro porque é preciso
      // inteiro para transferir; ao ecrã só volta encurtado — ver iban.ts.
      { name: "iban", sql: "ALTER TABLE providers ADD COLUMN iban VARCHAR(34) NULL DEFAULT NULL" },
      // O nome do titular pode não ser o do profissional (conta da empresa, do
      // cônjuge), e um nome que não bate com o IBAN é transferência devolvida.
      {
        name: "ibanTitular",
        sql: "ALTER TABLE providers ADD COLUMN ibanTitular VARCHAR(120) NULL DEFAULT NULL",
      },

      // ── Morada fiscal (19-08-2026) ───────────────────────────────────────
      // A da declaração de actividade, que pode não ser onde ele trabalha. Vai
      // na fatura ao cliente. Separada da cidade de base de propósito: essa
      // serve para calcular distâncias, esta para documentos.
      {
        name: "moradaFiscal",
        sql: "ALTER TABLE providers ADD COLUMN moradaFiscal VARCHAR(200) NULL DEFAULT NULL",
      },
      {
        name: "codigoPostalFiscal",
        sql: "ALTER TABLE providers ADD COLUMN codigoPostalFiscal VARCHAR(12) NULL DEFAULT NULL",
      },
      {
        name: "localidadeFiscal",
        sql: "ALTER TABLE providers ADD COLUMN localidadeFiscal VARCHAR(120) NULL DEFAULT NULL",
      },

      // Com que veículo trabalha. Não é ficha técnica: um sofá de três lugares
      // não entra numa carrinha pequena, e mandar-lhe esse pedido é fazer-lhe
      // perder a viagem — e ao cliente, o dia.
      {
        name: "tipoVeiculo",
        sql: "ALTER TABLE providers ADD COLUMN tipoVeiculo VARCHAR(60) NULL DEFAULT NULL",
      },
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
  versaoDosProfissionais = VERSAO_DOS_PROFISSIONAIS;
  console.log("[ensureProvidersSchema] schema verificado com sucesso");
}

// ── Profissionais do site (plataforma) ──────────────────────────────────────

export type InscricaoDeProfissional = {
  name: string;
  slug: string;
  email: string;
  phone: string | null;
  nif: string | null;
  city: string | null;
  moradaFiscal: string | null;
  codigoPostalFiscal: string | null;
  localidadeFiscal: string | null;
  tipoVeiculo: string | null;
  categorias: string[];
  zonas: string[];
  raioKm: number | null;
  emiteFatura: boolean;
  regimeIva: string;
  emiteGuiaTransporte: boolean;
  numeroTransportador: string | null;
  baseLat: number | null;
  baseLng: number | null;
};

/**
 * Grava uma inscrição.
 *
 * Entra sempre como `pendente` e com a guia **por verificar**, mesmo que ele
 * a tenha declarado e tenha escrito o número. Confirmar o registo de
 * transportador é trabalho de uma pessoa, e é o que separa um distintivo em
 * que o cliente pode confiar de um que qualquer um liga sozinho.
 */
export async function criarProfissional(dados: InscricaoDeProfissional): Promise<number> {
  await ensureProvidersSchema();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");

  const [res] = await pool.execute(
    `INSERT INTO providers
       (name, slug, email, phone, nif, city,
        moradaFiscal, codigoPostalFiscal, localidadeFiscal, tipoVeiculo,
        categorias, zonas, raioKm,
        emiteFatura, regimeIva, emiteGuiaTransporte, numeroTransportador,
        baseLat, baseLng, estado, isActive, isClyon)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', 1, 0)`,
    [
      dados.name,
      dados.slug,
      dados.email,
      dados.phone,
      dados.nif,
      dados.city,
      dados.moradaFiscal,
      dados.codigoPostalFiscal,
      dados.localidadeFiscal,
      dados.tipoVeiculo,
      JSON.stringify(dados.categorias),
      JSON.stringify(dados.zonas),
      dados.raioKm,
      dados.emiteFatura ? 1 : 0,
      dados.regimeIva,
      dados.emiteGuiaTransporte ? 1 : 0,
      dados.numeroTransportador,
      dados.baseLat,
      dados.baseLng,
    ],
  ) as any[];

  return Number(res.insertId);
}

/** Uma linha de `providers` na forma que a regra de elegibilidade entende. */
export type ProfissionalNaBase = {
  id: number;
  name: string;
  email: string | null;
  isActive: boolean;
  estado: string | null;
  categorias: string[];
  zonas: string[];
  raioKm: number | null;
  emiteFatura: boolean;
  emiteGuiaTransporte: boolean;
  guiaVerificadaEm: Date | string | null;
  baseLat: number | null;
  baseLng: number | null;
};

function listaDeJson(valor: unknown): string[] {
  if (typeof valor !== "string") return [];
  try {
    const lista = JSON.parse(valor);
    return Array.isArray(lista) ? lista.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Os profissionais candidatos a receber um pedido.
 *
 * Filtra no SQL só o que é barato e não muda por pedido — activos e aprovados.
 * O resto (categoria, distância, documentos) fica para a regra em
 * `profissional-elegivel.ts`, que é onde está escrita e testada. Duplicá-la
 * aqui em SQL era garantir que um dia as duas discordavam.
 */
export async function profissionaisActivos(): Promise<ProfissionalNaBase[]> {
  await ensureProvidersSchema();
  const pool = await getPool();
  if (!pool) return [];

  const [rows] = await pool.execute(
    `SELECT id, name, email, isActive, estado, categorias, zonas, raioKm,
            emiteFatura, emiteGuiaTransporte, guiaVerificadaEm, baseLat, baseLng
       FROM providers
      WHERE isActive = 1 AND estado = 'aprovado' AND isClyon = 0`,
  ) as any[];

  return (rows as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    name: String(r.name ?? ""),
    email: (r.email as string) ?? null,
    isActive: Number(r.isActive) === 1,
    estado: (r.estado as string) ?? null,
    categorias: listaDeJson(r.categorias),
    zonas: listaDeJson(r.zonas),
    raioKm: r.raioKm == null ? null : Number(r.raioKm),
    emiteFatura: Number(r.emiteFatura) === 1,
    emiteGuiaTransporte: Number(r.emiteGuiaTransporte) === 1,
    guiaVerificadaEm: (r.guiaVerificadaEm as Date | null) ?? null,
    baseLat: r.baseLat == null ? null : Number(r.baseLat),
    baseLng: r.baseLng == null ? null : Number(r.baseLng),
  }));
}

// ── Negociações ─────────────────────────────────────────────────────────────

let negociacoesEnsured = false;
// Sobe sempre que a lista de colunas cresce. Sem isto, um processo já quente
// nunca corria as migrações novas — o guarda booleano sozinho garantia que só
// arranques frios as viam.
const VERSAO_DAS_NEGOCIACOES = 2;
let versaoDasNegociacoes = 0;

/**
 * Uma negociação por par (pedido, profissional).
 *
 * As propostas ficam em JSON e não numa tabela própria de propósito: lêem-se e
 * escrevem-se sempre inteiras, o motor em `negociacao.ts` trabalha sobre o
 * array completo, e não há consulta nenhuma que precise de uma proposta
 * isolada. Uma tabela filha traria junções e uma ordem para garantir, a troco
 * de nada.
 *
 * O token é o acesso do profissional a este pedido — mesmo desenho do link do
 * cliente: 256 bits, só o hash guardado. Ele não tem conta, e obrigá-lo a
 * criar uma antes de responder era perder a resposta.
 */
export async function ensureNegociacoesTable(): Promise<void> {
  if (negociacoesEnsured && versaoDasNegociacoes >= VERSAO_DAS_NEGOCIACOES) return;
  const pool = await getPool();
  if (!pool) return;

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS negociacoes (
      id                  INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      pedidoId            INT NOT NULL,
      providerId          INT UNSIGNED NOT NULL,
      acessoTokenHash     VARCHAR(64) NOT NULL,
      acessoTokenExpiraEm DATETIME NULL DEFAULT NULL,
      estado              VARCHAR(30) NOT NULL DEFAULT 'aberta',
      valorAcordado       DECIMAL(10,2) NULL DEFAULT NULL,
      propostasJson       LONGTEXT NULL,
      createdAt           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY negociacoes_pedido_provider (pedidoId, providerId),
      KEY negociacoes_token (acessoTokenHash),
      KEY negociacoes_pedido (pedidoId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // v2 (18-08-2026) — o que acontece DEPOIS de fechado.
  //
  // A fase do trabalho lê-se destas datas e não de uma coluna de estado: duas
  // fontes para o mesmo facto acabam sempre por discordar. A regra está em
  // trabalho.ts, com testes.
  const colunas = [
    `ALTER TABLE negociacoes ADD COLUMN execucaoEnviadaEm DATETIME NULL DEFAULT NULL`,
    `ALTER TABLE negociacoes ADD COLUMN provaJson LONGTEXT NULL DEFAULT NULL`,
    `ALTER TABLE negociacoes ADD COLUMN confirmadoEm DATETIME NULL DEFAULT NULL`,
    `ALTER TABLE negociacoes ADD COLUMN pagoEm DATETIME NULL DEFAULT NULL`,
  ];
  for (const sql of colunas) {
    try {
      await pool.execute(sql);
    } catch (e: any) {
      if (!e?.message?.includes("Duplicate column")) {
        console.error("[negociacoes] migração ignorada:", e?.message);
      }
    }
  }

  negociacoesEnsured = true;
  versaoDasNegociacoes = VERSAO_DAS_NEGOCIACOES;
}

export type NegociacaoNaBase = {
  id: number;
  pedidoId: number;
  providerId: number;
  acessoTokenHash: string;
  acessoTokenExpiraEm: Date | string | null;
  estado: string;
  valorAcordado: string | null;
  propostasJson: string | null;
  execucaoEnviadaEm?: Date | string | null;
  provaJson?: string | null;
  confirmadoEm?: Date | string | null;
  pagoEm?: Date | string | null;
};

export async function criarNegociacao(dados: {
  pedidoId: number;
  providerId: number;
  acessoTokenHash: string;
  acessoTokenExpiraEm: Date;
  propostasJson: string;
}): Promise<number> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");

  // Se o pedido for redistribuído ao mesmo profissional, não se cria outra
  // negociação nem se apaga a que existe — o histórico de propostas dele é o
  // que dá sentido ao estado actual.
  const [res] = await pool.execute(
    `INSERT INTO negociacoes
       (pedidoId, providerId, acessoTokenHash, acessoTokenExpiraEm, propostasJson)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [
      dados.pedidoId,
      dados.providerId,
      dados.acessoTokenHash,
      dados.acessoTokenExpiraEm,
      dados.propostasJson,
    ],
  ) as any[];

  return Number(res.insertId);
}

export async function negociacaoPorTokenHash(
  hash: string,
): Promise<NegociacaoNaBase | undefined> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) return undefined;
  const [rows] = await pool.execute(
    "SELECT * FROM negociacoes WHERE acessoTokenHash = ? LIMIT 1",
    [hash],
  ) as any[];
  return (rows as NegociacaoNaBase[])[0];
}

export async function negociacoesDoPedido(pedidoId: number): Promise<
  Array<
    NegociacaoNaBase & {
      profissionalNome: string;
      profissionalTelefone: string | null;
      emiteFatura: number;
      regimeIva: string;
      guiaVerificadaEm: Date | null;
    }
  >
> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) return [];
  const [rows] = await pool.execute(
    // O telefone sai da consulta mas só chega ao ecrã depois de contratado —
    // quem decide isso é quem monta a resposta, não esta função.
    `SELECT n.*, p.name AS profissionalNome, p.phone AS profissionalTelefone,
            p.emiteFatura, p.regimeIva, p.guiaVerificadaEm
       FROM negociacoes n
       JOIN providers p ON p.id = n.providerId
      WHERE n.pedidoId = ?
      ORDER BY n.updatedAt DESC`,
    [pedidoId],
  ) as any[];
  return rows as any[];
}

export async function gravarNegociacao(
  id: number,
  dados: { estado: string; valorAcordado: number | null; propostasJson: string },
): Promise<void> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(
    "UPDATE negociacoes SET estado = ?, valorAcordado = ?, propostasJson = ? WHERE id = ?",
    [dados.estado, dados.valorAcordado, dados.propostasJson, id],
  );
}

/**
 * Substitui o token de acesso de um pedido.
 *
 * Existe porque só guardamos o hash: se o email não chegar — spam, endereço
 * errado, Resend em baixo — o token em claro perde-se e o cliente fica sem
 * forma de voltar ao próprio pedido. Não havia como reenviar, e isso era uma
 * falha do desenho, não um caso raro.
 *
 * Emitir um token novo invalida o antigo, o que também serve para revogar um
 * link que tenha sido reencaminhado por engano.
 */
export async function substituirTokenDoPedido(
  pedidoId: number,
  hash: string,
  expiraEm: Date,
): Promise<void> {
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(
    "UPDATE simulatorOrders SET acessoTokenHash = ?, acessoTokenExpiraEm = ? WHERE id = ?",
    [hash, expiraEm, pedidoId],
  );
}

/** O mesmo, para o link de um profissional a um pedido. */
export async function substituirTokenDaNegociacao(
  negociacaoId: number,
  hash: string,
  expiraEm: Date,
): Promise<void> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(
    "UPDATE negociacoes SET acessoTokenHash = ?, acessoTokenExpiraEm = ? WHERE id = ?",
    [hash, expiraEm, negociacaoId],
  );
}

/** Pedidos recentes com as negociações de cada um, para o painel. */
/**
 * Pedidos do simulador que ainda não são da plataforma.
 *
 * São os que entraram pelo formulário de orçamento do site: têm estimativa mas
 * não têm valor pedido pelo cliente, e por isso nunca foram distribuídos a
 * ninguém. Aparecem no backoffice para se poder decidir, um a um, quais valem
 * a pena mandar aos profissionais.
 *
 * Um a um de propósito. Quem preencheu o simulador pediu um orçamento à CLYON,
 * não pediu para entrar num mercado — promover o pedido faz-lhe chegar um email
 * com propostas de terceiros, e isso não pode acontecer por omissão.
 */
export async function pedidosPorPromover(limite = 20): Promise<
  Array<{
    id: number;
    serviceType: string | null;
    city: string | null;
    contactName: string | null;
    contactEmail: string | null;
    estimateTotal: string | null;
    urgency: string | null;
    createdAt: Date;
  }>
> {
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) return [];
  const [rows] = await pool.execute(
    `SELECT id, serviceType, city, contactName, contactEmail, estimateTotal, urgency, createdAt
       FROM simulatorOrders
      WHERE valorDesejadoCliente IS NULL
        AND contactEmail IS NOT NULL
        AND (status IS NULL OR status NOT IN ('cancelado', 'concluido', 'arquivado'))
      ORDER BY createdAt DESC
      LIMIT ?`,
    [String(limite)],
  ) as any[];
  return rows as any[];
}

/** Passa um pedido do simulador a pedido da plataforma. */
export async function promoverPedidoAPlataforma(
  pedidoId: number,
  valorDesejado: number,
  hash: string,
  expiraEm: Date,
): Promise<boolean> {
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  // A condição no UPDATE evita promover duas vezes o mesmo pedido — o duplo
  // toque no botão, que criaria um segundo token e invalidaria o primeiro.
  const [res] = await pool.execute(
    `UPDATE simulatorOrders
        SET valorDesejadoCliente = ?, acessoTokenHash = ?, acessoTokenExpiraEm = ?
      WHERE id = ? AND valorDesejadoCliente IS NULL`,
    [valorDesejado, hash, expiraEm, pedidoId],
  ) as any[];
  return Number(res.affectedRows ?? 0) > 0;
}

export async function pedidosComNegociacoes(limite = 30): Promise<
  Array<{
    id: number;
    serviceType: string | null;
    city: string | null;
    contactName: string | null;
    contactEmail: string | null;
    valorDesejadoCliente: string | null;
    createdAt: Date;
    negociacoes: Array<{
      id: number;
      providerId: number;
      profissionalNome: string;
      profissionalEmail: string | null;
      estado: string;
      valorAcordado: string | null;
      propostasJson: string | null;
      execucaoEnviadaEm: Date | null;
      provaJson: string | null;
      confirmadoEm: Date | null;
      pagoEm: Date | null;
      criadaEm: Date;
      actualizadaEm: Date;
    }>;
  }>
> {
  await ensureSimulatorOrdersTable();
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) return [];

  const [pedidos] = await pool.execute(
    `SELECT id, serviceType, city, contactName, contactEmail, valorDesejadoCliente, createdAt
       FROM simulatorOrders
      WHERE valorDesejadoCliente IS NOT NULL
      ORDER BY createdAt DESC
      LIMIT ?`,
    [String(limite)],
  ) as any[];

  const linhas = pedidos as Array<Record<string, unknown>>;
  if (linhas.length === 0) return [];

  const ids = linhas.map((p) => Number(p.id));
  const [negs] = await pool.execute(
    // As propostas vêm inteiras: sem elas o painel mostra o desfecho e esconde
    // como se lá chegou — que é justamente o que se quer ver quando uma
    // negociação corre mal.
    `SELECT n.id, n.pedidoId, n.providerId, n.estado, n.valorAcordado, n.propostasJson,
            n.execucaoEnviadaEm, n.provaJson, n.confirmadoEm, n.pagoEm,
            n.createdAt AS criadaEm, n.updatedAt AS actualizadaEm,
            p.name AS profissionalNome, p.email AS profissionalEmail
       FROM negociacoes n
       JOIN providers p ON p.id = n.providerId
      WHERE n.pedidoId IN (${ids.map(() => "?").join(",")})`,
    ids,
  ) as any[];

  const porPedido = new Map<number, any[]>();
  for (const n of negs as Array<Record<string, unknown>>) {
    const k = Number(n.pedidoId);
    if (!porPedido.has(k)) porPedido.set(k, []);
    porPedido.get(k)!.push(n);
  }

  return linhas.map((p) => ({
    id: Number(p.id),
    serviceType: (p.serviceType as string) ?? null,
    city: (p.city as string) ?? null,
    contactName: (p.contactName as string) ?? null,
    contactEmail: (p.contactEmail as string) ?? null,
    valorDesejadoCliente: (p.valorDesejadoCliente as string) ?? null,
    createdAt: p.createdAt as Date,
    negociacoes: porPedido.get(Number(p.id)) ?? [],
  }));
}

/**
 * Fecha as restantes negociações de um pedido quando uma é fechada.
 *
 * Sem isto, o cliente contratava alguém e os outros profissionais continuavam
 * a ver o pedido em aberto — a propor valores para um trabalho que já tinha
 * dono. É a promessa que o ecrã do cliente faz, e tem de ser verdade.
 */
export async function encerrarOutrasNegociacoes(
  pedidoId: number,
  excepto: number,
): Promise<number> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) return 0;
  const [res] = await pool.execute(
    `UPDATE negociacoes
        SET estado = 'morta'
      WHERE pedidoId = ? AND id <> ? AND estado IN ('aberta', 'aguarda_contratacao')`,
    [pedidoId, excepto],
  ) as any[];
  return Number(res.affectedRows ?? 0);
}

/** Marca a guia de transporte como verificada por alguém. */
export async function verificarGuiaDeTransporte(
  providerId: number,
  quem: string,
): Promise<void> {
  await ensureProvidersSchema();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(
    "UPDATE providers SET guiaVerificadaEm = NOW(), guiaVerificadaPor = ? WHERE id = ?",
    [quem.slice(0, 120), providerId],
  );
}

/**
 * Altera o perfil de um profissional — só os campos que vierem.
 *
 * Constrói o UPDATE a partir do que foi pedido, e não a partir de um objecto
 * completo: com um objecto completo, mudar o raio reescrevia as categorias com
 * o que estivesse em memória no painel, que pode estar desactualizado.
 */
export async function actualizarProfissional(
  providerId: number,
  alteracoes: {
    categorias?: string[];
    zonas?: string[];
    raioKm?: number;
    emiteFatura?: boolean;
    regimeIva?: string;
    emiteGuiaTransporte?: boolean;
    numeroTransportador?: string | null;
  },
): Promise<void> {
  await ensureProvidersSchema();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");

  const partes: string[] = [];
  const valores: unknown[] = [];

  if (alteracoes.categorias !== undefined) {
    partes.push("categorias = ?");
    valores.push(JSON.stringify(alteracoes.categorias));
  }
  if (alteracoes.zonas !== undefined) {
    partes.push("zonas = ?");
    valores.push(JSON.stringify(alteracoes.zonas));
  }
  if (alteracoes.raioKm !== undefined) {
    partes.push("raioKm = ?");
    valores.push(alteracoes.raioKm);
  }
  if (alteracoes.emiteFatura !== undefined) {
    partes.push("emiteFatura = ?");
    valores.push(alteracoes.emiteFatura ? 1 : 0);
  }
  if (alteracoes.regimeIva !== undefined) {
    partes.push("regimeIva = ?");
    valores.push(alteracoes.regimeIva);
  }
  if (alteracoes.emiteGuiaTransporte !== undefined) {
    partes.push("emiteGuiaTransporte = ?");
    valores.push(alteracoes.emiteGuiaTransporte ? 1 : 0);
    // Desligar a guia apaga também a verificação: o que foi confirmado foi um
    // número que ele já não declara ter. Manter o distintivo seria mentir.
    if (!alteracoes.emiteGuiaTransporte) {
      partes.push("guiaVerificadaEm = NULL", "guiaVerificadaPor = NULL");
    }
  }
  if (alteracoes.numeroTransportador !== undefined) {
    partes.push("numeroTransportador = ?");
    valores.push(alteracoes.numeroTransportador);
    // Um número novo não vem verificado. Se ficasse verificado, bastava trocar
    // o número depois da confirmação para ter um distintivo sobre um registo
    // que ninguém viu.
    if (alteracoes.numeroTransportador) {
      partes.push("guiaVerificadaEm = NULL", "guiaVerificadaPor = NULL");
    }
  }

  if (partes.length === 0) return;

  valores.push(providerId);
  await pool.execute(`UPDATE providers SET ${partes.join(", ")} WHERE id = ?`, valores);
}

/** Guarda as coordenadas da base, para quando a geocodificação corre mais tarde. */
export async function definirBaseDoProfissional(
  providerId: number,
  lat: number,
  lng: number,
): Promise<void> {
  await ensureProvidersSchema();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute("UPDATE providers SET baseLat = ?, baseLng = ? WHERE id = ?", [
    lat,
    lng,
    providerId,
  ]);
}

/**
 * Quanta actividade cada profissional teve.
 *
 * É o que separa um painel de gestão de uma lista de nomes: sem isto não se
 * sabe se um profissional está a trabalhar, se recebe pedidos e nunca responde,
 * ou se nunca recebeu nada — e cada um desses casos pede uma acção diferente.
 */
export async function actividadeDosProfissionais(): Promise<
  Map<number, { recebidos: number; comProposta: number; fechados: number }>
> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  const mapa = new Map<number, { recebidos: number; comProposta: number; fechados: number }>();
  if (!pool) return mapa;

  const [rows] = await pool.execute(
    `SELECT providerId,
            COUNT(*) AS recebidos,
            SUM(JSON_LENGTH(propostasJson) > 1) AS comProposta,
            SUM(estado = 'acordada') AS fechados
       FROM negociacoes
      GROUP BY providerId`,
  ) as any[];

  for (const r of rows as Array<Record<string, unknown>>) {
    mapa.set(Number(r.providerId), {
      recebidos: Number(r.recebidos ?? 0),
      comProposta: Number(r.comProposta ?? 0),
      fechados: Number(r.fechados ?? 0),
    });
  }
  return mapa;
}

/**
 * Guarda o token com que o profissional vai definir a palavra-passe.
 *
 * Só o hash, como em todos os tokens deste projecto. O valor em claro existe
 * apenas dentro do link que segue no email.
 */
export async function guardarTokenDePalavraPasse(
  providerId: number,
  hash: string,
  expiraEm: Date,
): Promise<void> {
  await ensureProvidersSchema();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(
    "UPDATE providers SET senhaTokenHash = ?, senhaTokenExpiraEm = ? WHERE id = ?",
    [hash, expiraEm, providerId],
  );
}

export type ProfissionalPorToken = {
  id: number;
  name: string;
  email: string | null;
  estado: string;
  senhaTokenHash: string | null;
  senhaTokenExpiraEm: Date | string | null;
};

export async function profissionalPorTokenDeSenha(
  hash: string,
): Promise<ProfissionalPorToken | undefined> {
  await ensureProvidersSchema();
  const pool = await getPool();
  if (!pool) return undefined;
  const [rows] = await pool.execute(
    `SELECT id, name, email, estado, senhaTokenHash, senhaTokenExpiraEm
       FROM providers WHERE senhaTokenHash = ? LIMIT 1`,
    [hash],
  ) as any[];
  return (rows as ProfissionalPorToken[])[0];
}

/**
 * Grava a palavra-passe e queima o token.
 *
 * Queimar é a parte que importa: um token de definição que continuasse válido
 * depois de usado deixava quem apanhasse o email antigo trocar a palavra-passe
 * outra vez, e ficar com a conta.
 */
export async function definirPalavraPasseDoProfissional(
  providerId: number,
  passwordHash: string,
): Promise<void> {
  await ensureProvidersSchema();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(
    `UPDATE providers
        SET passwordHash = ?, senhaTokenHash = NULL, senhaTokenExpiraEm = NULL
      WHERE id = ?`,
    [passwordHash, providerId],
  );
}

export type ProfissionalParaEntrar = {
  id: number;
  name: string;
  email: string | null;
  estado: string;
  isActive: number;
  passwordHash: string | null;
};

export async function profissionalParaEntrar(
  email: string,
): Promise<ProfissionalParaEntrar | undefined> {
  await ensureProvidersSchema();
  const pool = await getPool();
  if (!pool) return undefined;
  const [rows] = await pool.execute(
    `SELECT id, name, email, estado, isActive, passwordHash
       FROM providers WHERE email = ? AND isClyon = 0 LIMIT 1`,
    [email],
  ) as any[];
  return (rows as ProfissionalParaEntrar[])[0];
}

export async function registarAcessoDoProfissional(providerId: number): Promise<void> {
  const pool = await getPool();
  if (!pool) return;
  await pool.execute("UPDATE providers SET ultimoAcesso = NOW() WHERE id = ?", [providerId]);
}

/**
 * Os pedidos que este profissional tem em mão.
 *
 * É a lista que faltava: com um link por email e por pedido, quem tivesse cinco
 * pedidos em aberto tinha cinco emails e nenhuma vista de conjunto.
 */
export async function negociacoesDoProfissional(providerId: number): Promise<
  Array<{
    id: number;
    pedidoId: number;
    estado: string;
    valorAcordado: string | null;
    propostasJson: string | null;
    updatedAt: Date;
    execucaoEnviadaEm: Date | null;
    provaJson: string | null;
    confirmadoEm: Date | null;
    pagoEm: Date | null;
    serviceType: string | null;
    city: string | null;
    urgency: string | null;
    description: string | null;
    valorDesejadoCliente: string | null;
    precisaFatura: number | null;
    precisaGuiaTransporte: number | null;
    filesJson: string | null;
    address: string | null;
    contactName: string | null;
    contactPhone: string | null;
  }>
> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) return [];
  const [rows] = await pool.execute(
    `SELECT n.id, n.pedidoId, n.estado, n.valorAcordado, n.propostasJson, n.updatedAt,
            n.execucaoEnviadaEm, n.provaJson, n.confirmadoEm, n.pagoEm,
            o.serviceType, o.city, o.urgency, o.description, o.valorDesejadoCliente,
            o.precisaFatura, o.precisaGuiaTransporte, o.filesJson,
            -- Saem da consulta, mas nao da API: quem decide se chegam ao ecra e
            -- vistaParaOEstado, e so quando o trabalho e mesmo dele.
            o.address, o.contactName, o.contactPhone
       FROM negociacoes n
       JOIN simulatorOrders o ON o.id = n.pedidoId
      WHERE n.providerId = ?
      ORDER BY
        FIELD(n.estado, 'aberta', 'aguarda_contratacao', 'acordada', 'desistida', 'morta'),
        n.updatedAt DESC
      LIMIT 200`,
    [providerId],
  ) as any[];
  return rows as any[];
}

// ── Pedidos de ajuda da plataforma ──────────────────────────────────────────

let ajudaEnsured = false;

/**
 * Os pedidos de ajuda de quem usa a plataforma.
 *
 * Tabela nossa, em MySQL, e não os `support_tickets` do Supabase: esses são da
 * app, e a app é do Bridge. Escrever lá dentro obrigava-nos a inventar um
 * `user_id` para alguém que não existe naquela base — os profissionais da
 * plataforma vivem aqui, em `providers`.
 *
 * O backoffice mostra as duas origens na mesma lista. Quem atende não tem de
 * saber de que base veio o pedido; quem mantém o código tem.
 */
export async function ensureAjudaTable(): Promise<void> {
  if (ajudaEnsured) return;
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS pedidosDeAjuda (
      id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      origem      VARCHAR(20) NOT NULL DEFAULT 'profissional',
      providerId  INT UNSIGNED NULL DEFAULT NULL,
      nome        VARCHAR(120) NULL,
      email       VARCHAR(200) NULL,
      assunto     VARCHAR(40) NOT NULL,
      mensagem    TEXT NOT NULL,
      estado      VARCHAR(20) NOT NULL DEFAULT 'open',
      respostaJson LONGTEXT NULL,
      tratadoPor  VARCHAR(120) NULL,
      fechadoEm   DATETIME NULL DEFAULT NULL,
      createdAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY ajuda_estado (estado),
      KEY ajuda_provider (providerId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  ajudaEnsured = true;
}

export type PedidoDeAjudaNaBase = {
  id: number;
  origem: string;
  providerId: number | null;
  nome: string | null;
  email: string | null;
  assunto: string;
  mensagem: string;
  estado: string;
  respostaJson: string | null;
  tratadoPor: string | null;
  fechadoEm: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function criarPedidoDeAjuda(dados: {
  origem: string;
  providerId: number | null;
  nome: string | null;
  email: string | null;
  assunto: string;
  mensagem: string;
}): Promise<number> {
  await ensureAjudaTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [res] = await pool.execute(
    `INSERT INTO pedidosDeAjuda (origem, providerId, nome, email, assunto, mensagem)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [dados.origem, dados.providerId, dados.nome, dados.email, dados.assunto, dados.mensagem],
  ) as any[];
  return Number(res.insertId);
}

/** Os pedidos de ajuda de um profissional, para ele ver o que já escreveu. */
export async function ajudasDoProfissional(providerId: number): Promise<PedidoDeAjudaNaBase[]> {
  await ensureAjudaTable();
  const pool = await getPool();
  if (!pool) return [];
  const [rows] = await pool.execute(
    "SELECT * FROM pedidosDeAjuda WHERE providerId = ? ORDER BY createdAt DESC LIMIT 50",
    [providerId],
  ) as any[];
  return rows as PedidoDeAjudaNaBase[];
}

export async function ajudasParaAdmin(estado?: string): Promise<PedidoDeAjudaNaBase[]> {
  await ensureAjudaTable();
  const pool = await getPool();
  if (!pool) return [];
  // Mais antigo primeiro: numa lista de apoio, quem espera há mais tempo é
  // quem tem de aparecer em cima. É a mesma ordem da lista do Supabase.
  const [rows] = estado
    ? ((await pool.execute(
        "SELECT * FROM pedidosDeAjuda WHERE estado = ? ORDER BY createdAt ASC LIMIT 200",
        [estado],
      )) as any[])
    : ((await pool.execute(
        "SELECT * FROM pedidosDeAjuda ORDER BY createdAt ASC LIMIT 200",
      )) as any[]);
  return rows as PedidoDeAjudaNaBase[];
}

export async function responderPedidoDeAjuda(
  id: number,
  dados: { respostaJson: string; estado: string; tratadoPor: string },
): Promise<void> {
  await ensureAjudaTable();
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(
    `UPDATE pedidosDeAjuda
        SET respostaJson = ?, estado = ?, tratadoPor = ?,
            fechadoEm = CASE WHEN ? = 'closed' THEN NOW() ELSE NULL END
      WHERE id = ?`,
    [dados.respostaJson, dados.estado, dados.tratadoPor, dados.estado, id],
  );
}

// ── Convites a profissionais ────────────────────────────────────────────────

let convitesEnsured = false;

/**
 * O convite que abre a inscrição.
 *
 * Tabela própria e não uma linha em `providers` com estado "convidado": quem
 * foi convidado ainda não é profissional nenhum — não tem categorias, não tem
 * zonas, e não pode aparecer em consulta nenhuma de distribuição. Uma linha
 * meia-feita na tabela principal acaba sempre por escapar para um sítio onde
 * não devia estar.
 *
 * Do token guarda-se só o hash, como em todos os outros deste projecto. O que
 * seguiu no email não volta a existir de nosso lado.
 */
export async function ensureConvitesTable(): Promise<void> {
  if (convitesEnsured) return;
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS convitesProfissionais (
      id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      nome        VARCHAR(120) NOT NULL,
      email       VARCHAR(200) NOT NULL,
      telefone    VARCHAR(30) NULL,
      tipoVeiculo VARCHAR(60) NULL,
      nota        VARCHAR(500) NULL,
      tokenHash   VARCHAR(64) NOT NULL,
      expiraEm    DATETIME NOT NULL,
      usadoEm     DATETIME NULL DEFAULT NULL,
      providerId  INT UNSIGNED NULL DEFAULT NULL,
      revogadoEm  DATETIME NULL DEFAULT NULL,
      emailEnviado TINYINT(1) NOT NULL DEFAULT 0,
      criadoPor   VARCHAR(120) NULL,
      createdAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY convites_token (tokenHash),
      KEY convites_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  convitesEnsured = true;
}

export type ConviteNaBase = {
  id: number;
  nome: string;
  email: string;
  telefone: string | null;
  tipoVeiculo: string | null;
  nota: string | null;
  tokenHash: string;
  expiraEm: Date;
  usadoEm: Date | null;
  providerId: number | null;
  revogadoEm: Date | null;
  emailEnviado: number;
  criadoPor: string | null;
  createdAt: Date;
};

export async function criarConvite(dados: {
  nome: string;
  email: string;
  telefone: string | null;
  tipoVeiculo: string | null;
  nota: string | null;
  tokenHash: string;
  expiraEm: Date;
  criadoPor: string;
}): Promise<number> {
  await ensureConvitesTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [res] = await pool.execute(
    `INSERT INTO convitesProfissionais
       (nome, email, telefone, tipoVeiculo, nota, tokenHash, expiraEm, criadoPor)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      dados.nome,
      dados.email,
      dados.telefone,
      dados.tipoVeiculo,
      dados.nota,
      dados.tokenHash,
      dados.expiraEm,
      dados.criadoPor,
    ],
  ) as any[];
  return Number(res.insertId);
}

export async function convitePorTokenHash(hash: string): Promise<ConviteNaBase | undefined> {
  await ensureConvitesTable();
  const pool = await getPool();
  if (!pool) return undefined;
  const [rows] = await pool.execute(
    "SELECT * FROM convitesProfissionais WHERE tokenHash = ? LIMIT 1",
    [hash],
  ) as any[];
  return (rows as ConviteNaBase[])[0];
}

/** Um convite por usar para este email, se existir. */
export async function convitePorEmail(email: string): Promise<ConviteNaBase | undefined> {
  await ensureConvitesTable();
  const pool = await getPool();
  if (!pool) return undefined;
  const [rows] = await pool.execute(
    `SELECT * FROM convitesProfissionais
      WHERE email = ? AND usadoEm IS NULL AND revogadoEm IS NULL
      ORDER BY createdAt DESC LIMIT 1`,
    [email],
  ) as any[];
  return (rows as ConviteNaBase[])[0];
}

export async function listarConvites(): Promise<ConviteNaBase[]> {
  await ensureConvitesTable();
  const pool = await getPool();
  if (!pool) return [];
  const [rows] = await pool.execute(
    `SELECT * FROM convitesProfissionais
      ORDER BY (usadoEm IS NULL AND revogadoEm IS NULL) DESC, createdAt DESC
      LIMIT 200`,
  ) as any[];
  return rows as ConviteNaBase[];
}

/**
 * Marca o convite como usado, e a quem deu origem.
 *
 * A condição vai no UPDATE: dois envios do formulário ao mesmo tempo — o duplo
 * toque no botão, que acontece — só conseguem gravar o primeiro.
 */
export async function marcarConviteUsado(id: number, providerId: number): Promise<boolean> {
  await ensureConvitesTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [res] = await pool.execute(
    `UPDATE convitesProfissionais
        SET usadoEm = NOW(), providerId = ?
      WHERE id = ? AND usadoEm IS NULL AND revogadoEm IS NULL`,
    [providerId, id],
  ) as any[];
  return Number(res.affectedRows ?? 0) > 0;
}

export async function revogarConvite(id: number): Promise<void> {
  await ensureConvitesTable();
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(
    "UPDATE convitesProfissionais SET revogadoEm = NOW() WHERE id = ? AND usadoEm IS NULL",
    [id],
  );
}

/** Um token novo para o mesmo convite — o anterior deixa de servir. */
export async function renovarConvite(
  id: number,
  tokenHash: string,
  expiraEm: Date,
): Promise<void> {
  await ensureConvitesTable();
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(
    `UPDATE convitesProfissionais
        SET tokenHash = ?, expiraEm = ?, revogadoEm = NULL
      WHERE id = ? AND usadoEm IS NULL`,
    [tokenHash, expiraEm, id],
  );
}

export async function marcarConviteEnviado(id: number, enviado: boolean): Promise<void> {
  await ensureConvitesTable();
  const pool = await getPool();
  if (!pool) return;
  await pool.execute("UPDATE convitesProfissionais SET emailEnviado = ? WHERE id = ?", [
    enviado ? 1 : 0,
    id,
  ]);
}

// ── Testadores do MVP ───────────────────────────────────────────────────────

let testadoresEnsured = false;

/**
 * Quem pode entrar no ambiente de testes.
 *
 * Tabela própria, e não os `colaboradores`: um colaborador entra no backoffice,
 * e um testador não pode. Reaproveitar a tabela era dar as chaves da gestão a
 * quem só devia poder experimentar o fluxo do cliente.
 *
 * A palavra-passe é definida por quem cria a conta, no backoffice, e entregue
 * fora do sistema. Sem convite por email de propósito: durante o MVP os
 * testadores são pessoas conhecidas, e um email a menos é uma superfície a
 * menos.
 */
export async function ensureTestadoresTable(): Promise<void> {
  if (testadoresEnsured) return;
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS testadoresMvp (
      id           INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      nome         VARCHAR(120) NOT NULL,
      utilizador   VARCHAR(60) NOT NULL,
      passwordHash VARCHAR(255) NOT NULL,
      papel        VARCHAR(20) NOT NULL DEFAULT 'cliente',
      activo       TINYINT(1) NOT NULL DEFAULT 1,
      ultimoAcesso DATETIME NULL DEFAULT NULL,
      criadoPor    VARCHAR(120) NULL,
      createdAt    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY testadores_utilizador (utilizador)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  testadoresEnsured = true;
}

export type TestadorNaBase = {
  id: number;
  nome: string;
  utilizador: string;
  passwordHash: string;
  papel: string;
  activo: number;
  ultimoAcesso: Date | null;
  criadoPor: string | null;
  createdAt: Date;
};

export async function testadorPorUtilizador(
  utilizador: string,
): Promise<TestadorNaBase | undefined> {
  await ensureTestadoresTable();
  const pool = await getPool();
  if (!pool) return undefined;
  const [rows] = await pool.execute(
    "SELECT * FROM testadoresMvp WHERE utilizador = ? LIMIT 1",
    [utilizador],
  ) as any[];
  return (rows as TestadorNaBase[])[0];
}

export async function listarTestadores(): Promise<TestadorNaBase[]> {
  await ensureTestadoresTable();
  const pool = await getPool();
  if (!pool) return [];
  const [rows] = await pool.execute(
    `SELECT id, nome, utilizador, papel, activo, ultimoAcesso, criadoPor, createdAt,
            '' AS passwordHash
       FROM testadoresMvp ORDER BY createdAt DESC LIMIT 100`,
  ) as any[];
  return rows as TestadorNaBase[];
}

export async function criarTestador(dados: {
  nome: string;
  utilizador: string;
  passwordHash: string;
  papel: string;
  criadoPor: string;
}): Promise<number> {
  await ensureTestadoresTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [res] = await pool.execute(
    `INSERT INTO testadoresMvp (nome, utilizador, passwordHash, papel, criadoPor)
     VALUES (?, ?, ?, ?, ?)`,
    [dados.nome, dados.utilizador, dados.passwordHash, dados.papel, dados.criadoPor],
  ) as any[];
  return Number(res.insertId);
}

export async function definirEstadoDoTestador(id: number, activo: boolean): Promise<void> {
  await ensureTestadoresTable();
  const pool = await getPool();
  if (!pool) return;
  await pool.execute("UPDATE testadoresMvp SET activo = ? WHERE id = ?", [activo ? 1 : 0, id]);
}

export async function definirPalavraPasseDoTestador(
  id: number,
  passwordHash: string,
): Promise<void> {
  await ensureTestadoresTable();
  const pool = await getPool();
  if (!pool) return;
  await pool.execute("UPDATE testadoresMvp SET passwordHash = ? WHERE id = ?", [passwordHash, id]);
}

export async function registarAcessoDoTestador(id: number): Promise<void> {
  await ensureTestadoresTable();
  const pool = await getPool();
  if (!pool) return;
  try {
    await pool.execute("UPDATE testadoresMvp SET ultimoAcesso = NOW() WHERE id = ?", [id]);
  } catch {
    /* saber quando alguém entrou é útil, não é crítico */
  }
}

// ── Execução do trabalho e carteira ───────────────────────────────

/**
 * O profissional diz que está feito, e prova-o.
 *
 * A condição está no UPDATE e não em código antes dele. Ler o estado, decidir
 * em JavaScript e só depois gravar deixa uma janela entre a leitura e a escrita
 * — e é nessa janela que dois toques no mesmo botão gravam duas vezes. Aqui, a
 * segunda tentativa não encontra linha nenhuma para actualizar.
 *
 * O providerId vem da sessão. Sem ele na cláusula, um id no corpo do pedido
 * dava para marcar como feito o trabalho de outra pessoa.
 */
export async function registarExecucao(
  negociacaoId: number,
  providerId: number,
  provaJson: string,
): Promise<boolean> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [res] = await pool.execute(
    `UPDATE negociacoes
        SET execucaoEnviadaEm = NOW(), provaJson = ?
      WHERE id = ? AND providerId = ? AND estado = 'acordada'
        AND execucaoEnviadaEm IS NULL`,
    [provaJson, negociacaoId, providerId],
  ) as any[];
  return Number(res.affectedRows ?? 0) > 0;
}

/**
 * O cliente confirma que está feito, e o valor deixa de estar preso.
 *
 * O pedidoId é a prova de que quem confirma é o dono do pedido: quem chega aqui
 * veio pelo token do pedido, e o token não abre outro.
 */
export async function confirmarExecucao(
  negociacaoId: number,
  pedidoId: number,
): Promise<boolean> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [res] = await pool.execute(
    `UPDATE negociacoes
        SET confirmadoEm = NOW()
      WHERE id = ? AND pedidoId = ? AND estado = 'acordada'
        AND execucaoEnviadaEm IS NOT NULL AND confirmadoEm IS NULL`,
    [negociacaoId, pedidoId],
  ) as any[];
  return Number(res.affectedRows ?? 0) > 0;
}

/**
 * Grava a libertação por prazo dos trabalhos a que o cliente nunca voltou.
 *
 * A carteira já os conta como libertados a partir da data — ver carteira.ts —
 * mas convém que a base concorde com o ecrã: quem for ler a tabela daqui a um
 * ano não tem de saber a regra de cor.
 */
export async function libertarTrabalhosPorPrazo(dias: number): Promise<number> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) return 0;
  const [res] = await pool.execute(
    `UPDATE negociacoes
        SET confirmadoEm = NOW()
      WHERE estado = 'acordada' AND confirmadoEm IS NULL
        AND execucaoEnviadaEm IS NOT NULL
        AND execucaoEnviadaEm <= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [dias],
  ) as any[];
  return Number(res.affectedRows ?? 0);
}

let levantamentosEnsured = false;

/**
 * Os pedidos de transferência do saldo.
 *
 * Uma linha por pedido, e o estado nunca se apaga: um pedido recusado tem de
 * continuar a ver-se, com o motivo, senão o profissional só sabe que o dinheiro
 * voltou e não porquê.
 *
 * O IBAN fica copiado na linha. Guardar só o do perfil parecia mais limpo até
 * ao dia em que alguém o muda entre o pedido e a transferência — e depois não
 * há forma de saber para onde o dinheiro foi realmente enviado.
 */
export async function ensureLevantamentosTable(): Promise<void> {
  if (levantamentosEnsured) return;
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS levantamentos (
      id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      providerId    INT UNSIGNED NOT NULL,
      valor         DECIMAL(10,2) NOT NULL,
      iban          VARCHAR(34) NOT NULL,
      titular       VARCHAR(120) NULL,
      estado        VARCHAR(20) NOT NULL DEFAULT 'pedido',
      nota          VARCHAR(255) NULL,
      processadoPor VARCHAR(120) NULL,
      processadoEm  DATETIME NULL DEFAULT NULL,
      createdAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY levantamentos_provider (providerId),
      KEY levantamentos_estado (estado)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  levantamentosEnsured = true;
}

export type LevantamentoNaBase = {
  id: number;
  providerId: number;
  valor: string;
  iban: string;
  titular: string | null;
  estado: string;
  nota: string | null;
  processadoPor: string | null;
  processadoEm: Date | null;
  createdAt: Date;
};

export async function levantamentosDoProfissional(
  providerId: number,
): Promise<LevantamentoNaBase[]> {
  await ensureLevantamentosTable();
  const pool = await getPool();
  if (!pool) return [];
  const [rows] = await pool.execute(
    `SELECT * FROM levantamentos WHERE providerId = ? ORDER BY createdAt DESC LIMIT 200`,
    [providerId],
  ) as any[];
  return rows as LevantamentoNaBase[];
}

export async function criarLevantamento(dados: {
  providerId: number;
  valor: number;
  iban: string;
  titular: string | null;
}): Promise<number> {
  await ensureLevantamentosTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [res] = await pool.execute(
    `INSERT INTO levantamentos (providerId, valor, iban, titular) VALUES (?, ?, ?, ?)`,
    [dados.providerId, dados.valor, dados.iban, dados.titular],
  ) as any[];
  return Number(res.insertId);
}

/** Os pedidos de transferência, para o backoffice. */
export async function levantamentosParaAdmin(): Promise<
  Array<LevantamentoNaBase & { profissionalNome: string | null }>
> {
  await ensureLevantamentosTable();
  const pool = await getPool();
  if (!pool) return [];
  const [rows] = await pool.execute(
    `SELECT l.*, p.name AS profissionalNome
       FROM levantamentos l
       LEFT JOIN providers p ON p.id = l.providerId
      ORDER BY FIELD(l.estado, 'pedido', 'pago', 'recusado'), l.createdAt DESC
      LIMIT 200`,
  ) as any[];
  return rows as any[];
}

export async function marcarLevantamento(
  id: number,
  estado: "pago" | "recusado",
  quem: string,
  nota?: string,
): Promise<boolean> {
  await ensureLevantamentosTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [res] = await pool.execute(
    `UPDATE levantamentos
        SET estado = ?, processadoPor = ?, processadoEm = NOW(), nota = ?
      WHERE id = ? AND estado = 'pedido'`,
    [estado, quem, nota ?? null, id],
  ) as any[];
  return Number(res.affectedRows ?? 0) > 0;
}

/**
 * O hash da palavra-passe, para quem já tem sessão e quer mudá-la.
 *
 * Por id e não por email: a sessão guarda o id, e ir buscar o email primeiro
 * para depois procurar por ele era dar duas oportunidades de trocar de pessoa
 * pelo caminho.
 */
export async function palavraPasseGuardada(providerId: number): Promise<string | null> {
  await ensureProvidersSchema();
  const pool = await getPool();
  if (!pool) return null;
  const [rows] = await pool.execute(
    "SELECT passwordHash FROM providers WHERE id = ? LIMIT 1",
    [providerId],
  ) as any[];
  const linha = (rows as Array<{ passwordHash: string | null }>)[0];
  return linha?.passwordHash ?? null;
}

/** O perfil completo do profissional, para ele próprio ver e editar. */
export async function perfilDoProfissional(
  providerId: number,
): Promise<Record<string, unknown> | undefined> {
  await ensureProvidersSchema();
  const pool = await getPool();
  if (!pool) return undefined;
  const [rows] = await pool.execute(
    `SELECT id, name, email, phone, nif, city,
            moradaFiscal, codigoPostalFiscal, localidadeFiscal, tipoVeiculo,
            categorias, zonas, raioKm,
            emiteFatura, regimeIva, emiteGuiaTransporte, numeroTransportador,
            guiaVerificadaEm, estado, isActive, iban, ibanTitular, createdAt
       FROM providers WHERE id = ? LIMIT 1`,
    [providerId],
  ) as any[];
  return (rows as Array<Record<string, unknown>>)[0];
}

/**
 * O profissional muda os seus próprios dados.
 *
 * Só as colunas desta lista. O `estado` e o `guiaVerificadaEm` não estão cá —
 * um profissional que se pudesse aprovar a si próprio, ou dar-se a guia por
 * verificada, tornava a verificação um enfeite.
 */
export async function actualizarPerfilDoProfissional(
  providerId: number,
  dados: Record<string, unknown>,
): Promise<void> {
  await ensureProvidersSchema();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");

  const permitidas = [
    "name",
    "phone",
    "nif",
    "city",
    "categorias",
    "zonas",
    "raioKm",
    "emiteFatura",
    "regimeIva",
    "emiteGuiaTransporte",
    "numeroTransportador",
    "moradaFiscal",
    "codigoPostalFiscal",
    "localidadeFiscal",
    "tipoVeiculo",
    "iban",
    "ibanTitular",
    "baseLat",
    "baseLng",
  ];
  const colunas = permitidas.filter((c) => dados[c] !== undefined);
  if (colunas.length === 0) return;

  await pool.execute(
    `UPDATE providers SET ${colunas.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`,
    [...colunas.map((c) => dados[c]), providerId],
  );
}

/**
 * Mexer no número de transportador põe a guia outra vez por verificar.
 *
 * Sem isto, bastava inscrever-se com um número verdadeiro, ser verificado, e
 * trocá-lo depois — e o distintivo que o cliente vê passava a garantir um
 * número que ninguém confirmou.
 */
export async function invalidarVerificacaoDaGuia(providerId: number): Promise<void> {
  await ensureProvidersSchema();
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(
    "UPDATE providers SET guiaVerificadaEm = NULL, guiaVerificadaPor = NULL WHERE id = ?",
    [providerId],
  );
}

/** Aprova, rejeita ou suspende um profissional. */
export async function definirEstadoDoProfissional(
  providerId: number,
  estado: "pendente" | "aprovado" | "rejeitado" | "suspenso",
): Promise<void> {
  await ensureProvidersSchema();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute("UPDATE providers SET estado = ? WHERE id = ?", [estado, providerId]);
}

/** Já existe alguém inscrito com este email? */
export async function profissionalPorEmail(email: string): Promise<{ id: number } | undefined> {
  await ensureProvidersSchema();
  const pool = await getPool();
  if (!pool) return undefined;
  const [rows] = await pool.execute(
    "SELECT id FROM providers WHERE email = ? LIMIT 1",
    [email],
  ) as any[];
  return (rows as Array<{ id: number }>)[0];
}

/**
 * Constrói um slug livre a partir do nome.
 *
 * A coluna é UNIQUE: dois "Transportes Silva" a inscreverem-se rebentavam o
 * INSERT do segundo com um erro de chave duplicada que ele leria como "o site
 * está avariado".
 */
export async function slugLivreParaProfissional(nome: string): Promise<string> {
  await ensureProvidersSchema();
  const base =
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "profissional";

  const pool = await getPool();
  if (!pool) return base;

  for (let n = 0; n < 50; n++) {
    const tentativa = n === 0 ? base : `${base}-${n + 1}`;
    const [rows] = await pool.execute(
      "SELECT 1 FROM providers WHERE slug = ? LIMIT 1",
      [tentativa],
    ) as any[];
    if ((rows as unknown[]).length === 0) return tentativa;
  }
  return `${base}-${Date.now()}`;
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

  // Criar WANDERSON se não existir.
  //
  // ⚠️ Aqui estava uma palavra-passe de administrador escrita à mão no
  // código, passada ao bcrypt como valor por omissão. Um segredo no código
  // não é um segredo: fica no repositório, no histórico do git e em qualquer
  // cópia que alguém tenha. Se a conta de produção tivesse nascido por este
  // caminho e nunca tivesse sido mudada, quem lesse o código entrava no
  // backoffice como administrador.
  //
  // Passa a ser obrigatório dizer qual é. Sem hash, esta função recusa criar
  // a conta em vez de a criar com uma palavra-passe que toda a gente sabe.
  if (!senhaHash) {
    throw new Error(
      "upsertWandersonAdmin: a conta WANDERSON não existe e não foi indicada uma palavra-passe. " +
      "Criar uma conta de administrador com palavra-passe por omissão não é aceitável — " +
      "passe um hash bcrypt em senhaHash.",
    );
  }
  await pool.execute(
    "INSERT INTO colaboradores (nome, senha, funcao, valorHora, isAdmin) VALUES (?, ?, 'admin', '0', 1)",
    ["WANDERSON", senhaHash]
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


// ─── SimulatorOrders ────────────────────────────────���─────────────────────────

let _simulatorOrdersEnsured = false;
// Bump this version number any time new migrations are added so the guard re-runs.
// Esteve em 6 durante as migrações v7 a v11: como cada ALTER é idempotente e o
// guarda reinicia a cada arranque frio, elas acabaram por correr na mesma — mas
// num processo que ficasse quente nunca teriam corrido. Agora acompanha a
// última migração da lista.
const MIGRATION_VERSION = 13;
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
    // v12 — plataforma: o cliente passa a dizer quanto quer pagar, e o pedido
    // passa a abrir-se por link. O máximo é privado: ver pedido-valores.ts,
    // que é onde a regra está escrita e testada.
    `ALTER TABLE simulatorOrders ADD COLUMN valorMinimoCliente DECIMAL(10,2) NULL DEFAULT NULL`,
    `ALTER TABLE simulatorOrders ADD COLUMN valorMaximoCliente DECIMAL(10,2) NULL DEFAULT NULL`,
    `ALTER TABLE simulatorOrders ADD COLUMN precisaFatura TINYINT(1) NULL DEFAULT NULL`,
    `ALTER TABLE simulatorOrders ADD COLUMN precisaGuiaTransporte TINYINT(1) NULL DEFAULT NULL`,
    `ALTER TABLE simulatorOrders ADD COLUMN acessoTokenHash VARCHAR(64) NULL DEFAULT NULL`,
    `ALTER TABLE simulatorOrders ADD COLUMN acessoTokenExpiraEm DATETIME NULL DEFAULT NULL`,
    // Sem índice, abrir um link obrigava a varrer a tabela inteira a cada
    // visita — e o link é a porta normal de entrada do cliente, não um caso raro.
    `CREATE INDEX idx_simulatorOrders_acessoTokenHash ON simulatorOrders (acessoTokenHash)`,
    // v13 — o mínimo e o máximo dão lugar a UM valor desejado (18-08-2026).
    // As colunas antigas ficam: apagá-las perdia o histórico dos pedidos já
    // criados, e não custam nada onde estão.
    `ALTER TABLE simulatorOrders ADD COLUMN valorDesejadoCliente DECIMAL(10,2) NULL DEFAULT NULL`,
    // Os pedidos que já existem passam a ter o valor desejado igual ao que
    // pediram como mínimo — era esse o número que o profissional via.
    `UPDATE simulatorOrders SET valorDesejadoCliente = valorMinimoCliente
      WHERE valorDesejadoCliente IS NULL AND valorMinimoCliente IS NOT NULL`,
  ];
  for (const sql of migrations) {
    try { await pool.execute(sql); } catch (e: any) {
      // Log only non-"duplicate column" errors so we can see real problems.
      // "Duplicate key name" entra na mesma lista desde que há CREATE INDEX:
      // é o mesmo caso — a migração já correu — e enchia o log a cada arranque.
      const jaExistia =
        e?.message?.includes("Duplicate column") || e?.message?.includes("Duplicate key name");
      if (!jaExistia) {
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
  // Só os campos que a lista mostra — os JSON grandes (chatHistory, estimate)
  // ficam de fora de propósito, que é o que mantém o ecrã rápido.
  //
  // ⚠️ MAS FALTAVAM QUATRO QUE A LISTA USA, e o ecrã mentia sem dar erro:
  //
  //   rawOrderJson  → a coluna Origem dizia "Simulador" a TODOS os pedidos,
  //                   incluindo os que vieram do formulário de contactos
  //   city          → a coluna Localidade estava sempre a "—"
  //   urgency       → a coluna Urgência estava sempre a "—"
  //   viewedAt      → o filtro "Novos" é `!viewedAt` no cliente; sem o campo,
  //                   TODOS os pedidos passavam por novos
  //
  // O rawOrderJson não vem inteiro: só se extrai dele o slug da origem, em
  // SQL. Trazer o JSON completo de 100 pedidos para mostrar uma etiqueta era
  // desfazer a optimização para resolver o sintoma.
  const [rows] = await pool.execute(
    `SELECT id, contactName, contactPhone, address, serviceType, status, precoFinal, estimateTotal,
            createdAt, dataAgendada, assignedToId, assignedToName, priority,
            city, urgency, viewedAt,
            CASE WHEN JSON_VALID(rawOrderJson) THEN COALESCE(
              JSON_UNQUOTE(JSON_EXTRACT(rawOrderJson, '$.origemPedido')),
              JSON_UNQUOTE(JSON_EXTRACT(rawOrderJson, '$._source')),
              JSON_UNQUOTE(JSON_EXTRACT(rawOrderJson, '$.source'))
            ) ELSE NULL END AS origemSlug
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

/**
 * Procura o pedido a que um link de acesso corresponde.
 *
 * Procura-se pelo *hash* porque é isso que está gravado — o token em claro
 * existe só dentro do link que o cliente recebeu. Quem calcula o hash é o
 * chamador, com `hashDeToken`, e é ele que verifica a validade com
 * `verificarTokenDeAcesso`: aqui só se faz a leitura.
 */
export async function getSimulatorOrderByAcessoTokenHash(
  hash: string,
): Promise<SimulatorOrder | undefined> {
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) return undefined;
  const [rows] = await pool.execute(
    "SELECT * FROM simulatorOrders WHERE acessoTokenHash = ? LIMIT 1",
    [hash],
  ) as any[];
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

/**
 * Colunas de simulatorOrders que o backoffice pode escrever.
 *
 * Gerada a partir do tipo aceite por updateSimulatorOrder — se um campo for
 * acrescentado ao tipo tem de ser acrescentado aqui, de propósito: é esta
 * lista, e não o corpo do pedido, que decide o que entra no SQL.
 */
const COLUNAS_PEDIDO_EDITAVEIS = new Set<string>([
  "status", "priority", "notasInternas", "precoFinal", "precoFinalIva", "mensagemCliente",
  "colaboradorId", "dataAgendada", "assignedToId", "assignedToName", "assignedAt", "serviceType",
  "description", "contactName", "contactPhone", "contactEmail", "address", "city",
  "postalCode", "floor", "hasElevator", "parkingDistance", "urgency", "rawOrderJson",
  "acceptedAt", "scheduledDate", "scheduledStartTime", "scheduledEndTime", "calendarEventId", "calendarEventUrl",
  "calendarStatus", "calendarNotes", "analysisJsonExtended", "calendarTargetId", "calendarTargetName", "recurrenceFrequency",
  "recurringDiscountPercent", "clientRating", "clientRatingComment", "historyReadAt",
]);

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

  // ⚠️ As chaves deste objecto vão para a LISTA DE COLUNAS do SQL, e uma
  // consulta preparada parametriza valores, não identificadores. Como o
  // PATCH de /api/admin/pedidos faz `const { id, ...fields } = body` e passa
  // isto directamente, os nomes das colunas vinham do corpo do pedido: uma
  // chave como `status = 'x', outraColuna` acrescentava SQL à instrução.
  //
  // Só um administrador autenticado lá chegava — mas o updateColaborador,
  // logo acima neste ficheiro, já filtra por lista de permitidos, e não há
  // razão para este ser a excepção. Uma coluna que não esteja na lista é
  // ignorada em silêncio, como já acontecia com campos desconhecidos.
  const entries = Object.entries(data).filter(
    ([k, v]) => v !== undefined && COLUNAS_PEDIDO_EDITAVEIS.has(k),
  );
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
      `SELECT id, createdAt, serviceType, city, estimateTotal, precoFinal, precoFinalIva, providerId,
              contactName, contactEmail
       FROM simulatorOrders WHERE id = ? LIMIT 1`,
      [id],
    ) as [any[], unknown];
    const orderForExport = rows[0];
    if (orderForExport) {
      import("@/lib/google-sheets")
        .then(({ exportCompletedOrderToSheet }) => exportCompletedOrderToSheet(orderForExport))
        .catch((err) => console.error("[updateSimulatorOrder] falha ao carregar google-sheets:", err));

      // Pedido de avaliação ao cliente.
      //
      // Isto vivia no botão "concluir" do portal dos parceiros. Com o portal
      // fechado, quem marca um trabalho como concluído é a administração — e
      // sem mudar isto de sítio, o cliente deixava de ser convidado a avaliar
      // e o ecrã de avaliação da conta dele ficava sem ninguém a chegar lá.
      if (orderForExport.contactEmail) {
        import("@/lib/email-avaliacao")
          .then(({ sendReviewRequestEmail }) => sendReviewRequestEmail({
            to:          orderForExport.contactEmail,
            clienteName: orderForExport.contactName ?? "Cliente",
            serviceType: orderForExport.serviceType ?? null,
            orderId:     Number(id),
          }))
          .catch((err) => console.error("[updateSimulatorOrder] falha no email de avaliação:", err));
      }
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
       AND COALESCE(assignedAt, updatedAt, createdAt) >= ?
       AND COALESCE(assignedAt, updatedAt, createdAt) <= ?
       ${opts.assistenteId ? "AND assignedToId = ?" : ""}
     ORDER BY assignedToId, COALESCE(assignedAt, updatedAt) DESC`,
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
