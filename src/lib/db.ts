import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq, desc, inArray } from "drizzle-orm";
import { users, colaboradores, simulatorSettings, galleryMedia, trabalhosRealizados } from "../../drizzle/schema";
import type { InsertUser, InsertSimulatorOrder, SimulatorOrder, TrabalhoRealizadoData } from "../../drizzle/schema";
export type { TrabalhoRealizadoData };
import { defaultSimulatorSettings } from "@/lib/simulator-settings";
import { carteiraDe } from "@/lib/carteira";

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
const VERSAO_DAS_NEGOCIACOES = 4;
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
    // v3 (20-08-2026) — a avaliação do profissional, pelo cliente.
    //
    // Vive na negociação e não numa tabela à parte: uma avaliação é sempre de
    // UM trabalho, e é o trabalho que prova que houve serviço. Sem essa
    // ligação, qualquer pessoa avalia qualquer profissional.
    `ALTER TABLE negociacoes ADD COLUMN estrelas TINYINT NULL DEFAULT NULL`,
    `ALTER TABLE negociacoes ADD COLUMN comentario VARCHAR(600) NULL DEFAULT NULL`,
    `ALTER TABLE negociacoes ADD COLUMN avaliadoEm DATETIME NULL DEFAULT NULL`,
    /*
     * v4 (22-08-2026) — arquivar, de cada lado.
     *
     * Duas colunas e não uma: arquivar é um gesto de arrumação de quem o faz,
     * e não um estado do trabalho. O profissional pode querer tirar da vista
     * um trabalho que perdeu há três meses sem que isso mude nada para o
     * cliente — e o contrário também.
     *
     * Uma coluna partilhada faria com que arrumar a minha lista arrumasse a
     * do outro, que é exactamente o tipo de efeito que ninguém espera de um
     * botão que diz "arquivar".
     *
     * É uma DATA e não um booleano: saber QUANDO alguém arquivou é a
     * diferença entre poder responder a "isto desapareceu-me da lista" e ter
     * de encolher os ombros.
     */
    /*
     * Quando o profissional ABRIU este trabalho pela primeira vez.
     *
     * Sem isto, "novo" queria dizer "está no separador dos novos" — e por isso
     * o distintivo ficava em todos os cartões para sempre, mesmo nos que ele já
     * tinha lido dez vezes. Um aviso que nunca se apaga deixa de ser um aviso.
     *
     * É por profissional, e vive na negociação porque é isso que a negociação
     * é: o par (pedido, profissional). O mesmo pedido pode estar por abrir para
     * um e lido há três dias para outro.
     */
    `ALTER TABLE negociacoes ADD COLUMN abertoProfissionalEm DATETIME NULL DEFAULT NULL`,
    `ALTER TABLE negociacoes ADD COLUMN arquivadoProfissionalEm DATETIME NULL DEFAULT NULL`,
    `ALTER TABLE negociacoes ADD COLUMN arquivadoClienteEm DATETIME NULL DEFAULT NULL`,
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

/**
 * Mata todas as negociações de um pedido, para ele poder recomeçar.
 *
 * "Morta" e não apagada: o histórico de quem propôs o quê continua a existir
 * para quem for ver o pedido, e o registo permanente não fica com buracos.
 * As que voltarem a ser elegíveis são REPOSTAS a seguir, pela distribuição;
 * as que já não servirem — mudou o serviço, o profissional deixou de estar
 * no raio — ficam mortas e desaparecem do painel dele, que é o que se quer.
 *
 * Devolve quantas matou.
 */
/**
 * Cancelar um pedido: o cliente desistiu e o trabalho não vai acontecer.
 *
 * O #225 foi isto. Duas propostas na mesa, 250 € e 350 €, e o Sr. Rui a
 * responder pelo WhatsApp: "obtivemos mais algumas ofertas, das quais pelo
 * menos uma é mais competitiva". Não havia forma de o dizer ao sistema. O
 * pedido ficava na mesa como se ainda houvesse alguém a decidir, e o
 * profissional que lá tinha uma proposta continuava à espera de uma resposta
 * que nunca ia chegar.
 *
 * Cancelar NÃO É APAGAR. O pedido fica, o histórico fica, o registo permanente
 * fica — no dia em que alguém perguntar o que aconteceu ao #225, a resposta
 * existe. O que muda é o estado e o fim das negociações vivas.
 *
 * Devolve quantas negociações encerrou, ou `null` se o pedido não existe.
 */
export async function cancelarPedido(
  pedidoId: number,
): Promise<{ encerradas: number } | null> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) return null;

  const [linhas] = (await pool.execute(
    "SELECT id FROM simulatorOrders WHERE id = ? LIMIT 1",
    [pedidoId],
  )) as [Array<{ id: number }>, unknown];
  if (!linhas[0]) return null;

  // Mortas, e não "desistidas": desistir é um acto de uma das partes, com
  // consequências entre elas. Aqui não desistiu ninguém — o trabalho deixou
  // de existir, e as negociações vão com ele.
  const encerradas = await matarNegociacoesDoPedido(pedidoId);

  await pool.execute(
    "UPDATE simulatorOrders SET status = 'cancelado', updatedAt = NOW() WHERE id = ?",
    [pedidoId],
  );
  return { encerradas };
}

/**
 * Marca um trabalho como aberto pelo profissional — a primeira vez, e só ela.
 *
 * `IS NULL` no WHERE de propósito: o que interessa é QUANDO ele o viu pela
 * primeira vez, não a última. Reescrever a data a cada abertura faria um
 * trabalho lido há uma semana parecer acabado de ler.
 *
 * O providerId no WHERE não é zelo a mais: sem ele, um id de negociação
 * adivinhado deixava marcar como visto o trabalho de outra pessoa.
 */
export async function marcarTrabalhoComoAberto(
  negociacaoId: number,
  providerId: number,
): Promise<boolean> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) return false;
  const [r] = (await pool.execute(
    `UPDATE negociacoes SET abertoProfissionalEm = NOW()
      WHERE id = ? AND providerId = ? AND abertoProfissionalEm IS NULL`,
    [negociacaoId, providerId],
  )) as [{ affectedRows?: number }, unknown];
  return Number(r?.affectedRows ?? 0) > 0;
}

export async function matarNegociacoesDoPedido(pedidoId: number): Promise<number> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) return 0;
  const [r] = (await pool.execute(
    "UPDATE negociacoes SET estado = 'morta' WHERE pedidoId = ? AND estado <> 'morta'",
    [pedidoId],
  )) as [{ affectedRows?: number }, unknown];
  return Number(r?.affectedRows ?? 0);
}

export async function criarNegociacao(
  dados: {
    pedidoId: number;
    providerId: number;
    acessoTokenHash: string;
    acessoTokenExpiraEm: Date;
    propostasJson: string;
  },
  /**
   * Recomeçar do zero: se já houver negociação com este profissional, ela é
   * REPOSTA em vez de mantida — estado, propostas, valor acordado e o token
   * de acesso, tudo de novo.
   *
   * Existe porque um pedido registado com o valor errado fica encalhado: o
   * profissional aceita os 121 € que saíram por engano, o cliente só tem 30,
   * e corrigir o valor não muda nada do que já foi proposto. Sem isto, a
   * única saída era desistir de cada negociação à mão e o pedido morria com
   * elas.
   */
  { reabrir = false }: { reabrir?: boolean } = {},
): Promise<number> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");

  // Se o pedido for redistribuído ao mesmo profissional, não se cria outra
  // negociação nem se apaga a que existe — o histórico de propostas dele é o
  // que dá sentido ao estado actual.
  const aoRepetir = reabrir
    ? `id = LAST_INSERT_ID(id),
       estado = 'aberta', valorAcordado = NULL,
       propostasJson = VALUES(propostasJson),
       acessoTokenHash = VALUES(acessoTokenHash),
       acessoTokenExpiraEm = VALUES(acessoTokenExpiraEm),
       execucaoEnviadaEm = NULL, provaJson = NULL,
       confirmadoEm = NULL, pagoEm = NULL,
       estrelas = NULL, comentario = NULL, avaliadoEm = NULL,
       arquivadoProfissionalEm = NULL`
    : `id = LAST_INSERT_ID(id)`;

  const [res] = await pool.execute(
    `INSERT INTO negociacoes
       (pedidoId, providerId, acessoTokenHash, acessoTokenExpiraEm, propostasJson)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE ${aoRepetir}`,
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

/**
 * Arruma ou desarruma um trabalho na lista de quem o pediu.
 *
 * Só mexe na coluna do LADO que pediu. Arquivar é arrumação de quem o faz, e
 * não um estado do trabalho: um profissional a tirar da vista uma negociação
 * que perdeu há três meses não pode mexer no que o cliente vê.
 *
 * Verifica que a negociação é mesmo dele antes de escrever. Sem essa condição
 * no WHERE, um id trocado no corpo do pedido arquivava o trabalho de outra
 * pessoa — e ela só daria por isso quando fosse procurá-lo e não o
 * encontrasse.
 */
export async function arquivarNegociacao(
  negociacaoId: number,
  quem: { providerId: number } | { clienteEmail: string },
  arquivar: boolean,
): Promise<boolean> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");

  const quando = arquivar ? toMySQLDateTime() : null;

  if ("providerId" in quem) {
    const [r] = (await pool.execute(
      `UPDATE negociacoes SET arquivadoProfissionalEm = ?
        WHERE id = ? AND providerId = ?`,
      [quando, negociacaoId, quem.providerId],
    )) as any[];
    return Number(r?.affectedRows ?? 0) > 0;
  }

  // Do lado do cliente a ligação é pelo pedido, que é onde o email vive.
  const [r] = (await pool.execute(
    `UPDATE negociacoes n
       JOIN simulatorOrders o ON o.id = n.pedidoId
        SET n.arquivadoClienteEm = ?
      WHERE n.id = ? AND o.contactEmail = ?`,
    [quando, negociacaoId, quem.clienteEmail.trim().toLowerCase()],
  )) as any[];
  return Number(r?.affectedRows ?? 0) > 0;
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
    valorDesejadoCliente: string | null;
    urgency: string | null;
    createdAt: Date;
  }>
> {
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) return [];
  await ensureNegociacoesTable();
  // O critério é NÃO TER NEGOCIAÇÕES, e não "não ter valor". Desde que o
  // simulador público passou a perguntar quanto a pessoa conta gastar, um
  // pedido pode ter valor e continuar sem ter ido a lado nenhum — e era
  // precisamente esse que desaparecia desta lista.
  const [rows] = await pool.execute(
    `SELECT o.id, o.serviceType, o.city, o.contactName, o.contactEmail,
            o.estimateTotal, o.valorDesejadoCliente, o.urgency, o.createdAt
       FROM simulatorOrders o
       LEFT JOIN negociacoes n ON n.pedidoId = o.id
      WHERE n.id IS NULL
        /*
         * Sem email TAMBÉM entra.
         *
         * A condicao era contactEmail IS NOT NULL, e fazia sentido enquanto
         * todos os pedidos vinham do site — sem email não havia como mandar o
         * link ao cliente. Deixou de fazer quando a equipa passou a registar
         * os que chegam por telefone: quem liga raramente dá o email, e nesses
         * é a CLYON que responde às propostas.
         *
         * O #205 foi criado, ficou sem email, e desapareceu desta lista.
         * Existia na base, não existia em ecrã nenhum onde se pudesse enviar.
         */
        AND (o.status IS NULL OR o.status NOT IN ('cancelado', 'concluido', 'arquivado'))
      ORDER BY o.createdAt DESC
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
  /*
   * O token é escrito, não preservado.
   *
   * Havia aqui um COALESCE, para não invalidar um link que o cliente já
   * pudesse ter recebido. A protecção estava no sítio errado: quem chama isto
   * já garantiu que o pedido não tem negociação nenhuma, e sem negociações não
   * há proposta a que responder — o link antigo não serve para nada.
   *
   * Com o COALESCE, uma segunda tentativa gravava o hash antigo e enviava ao
   * cliente o token novo. Os dois não correspondiam, e o link que ele abria
   * dizia-lhe que não existia.
   */
  const [res] = await pool.execute(
    `UPDATE simulatorOrders
        SET valorDesejadoCliente = ?,
            acessoTokenHash = ?,
            acessoTokenExpiraEm = ?
      WHERE id = ?`,
    [valorDesejado, hash, expiraEm, pedidoId],
  ) as any[];
  if (Number(res.affectedRows ?? 0) > 0) return true;

  /*
   * Zero linhas alteradas não quer dizer que o pedido não exista.
   *
   * O MySQL conta linhas MUDADAS, não encontradas. Uma segunda tentativa com
   * exactamente o mesmo valor e o mesmo token não muda nada — e a resposta
   * era "este pedido já tinha sido promovido", com o pedido a ficar preso
   * outra vez. Aqui pergunta-se o que interessa mesmo: existe?
   */
  const [linhas] = await pool.execute(
    "SELECT id FROM simulatorOrders WHERE id = ? LIMIT 1",
    [pedidoId],
  ) as any[];
  return (linhas as unknown[]).length > 0;
}

export async function pedidosComNegociacoes(limite = 30): Promise<
  Array<{
    id: number;
    serviceType: string | null;
    city: string | null;
    contactName: string | null;
    contactEmail: string | null;
    valorDesejadoCliente: string | null;
    /**
     * De onde veio o pedido: "backoffice", "hero_quote_form",
     * "formulario_contactos", "plataforma", ou null se for do simulador.
     *
     * Sai por JSON_EXTRACT e nao por trazer o `rawOrderJson` inteiro, que
     * carrega o formulario todo e os URLs das fotos — dezenas de kilobytes por
     * pedido, para ler uma palavra.
     */
    origem: string | null;
    status: string | null;
    /** Quando o admin abriu este pedido DEPOIS de concluído. Null = por ver. */
    concluidoVistoEm: Date | null;
    linkExpiraEm: Date | null;
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
      estrelas: number | null;
      avaliadoEm: Date | null;
      criadaEm: Date;
      actualizadaEm: Date;
    }>;
  }>
> {
  await ensureSimulatorOrdersTable();
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) return [];

  /*
   * O criterio e TER NEGOCIACOES, e nao "ter valor".
   *
   * Era `valorDesejadoCliente IS NOT NULL`, e isso partia a lista em dois
   * sitios ao mesmo tempo:
   *
   *   · pedidos COM negociacoes vivas e SEM valor nao apareciam em lado
   *     nenhum. Os #196, #199 e #200 tinham propostas de profissionais a
   *     espera de resposta e nao existiam em ecra nenhum do backoffice — nao
   *     havia como os abrir, nem como responder por eles;
   *   · pedidos COM valor e SEM negociacoes apareciam aqui E na lista de
   *     "fora da plataforma" logo acima, o mesmo pedido duas vezes, uma a
   *     dizer que ja tinha sido enviado e outra a oferecer envia-lo.
   *
   * Com este criterio as duas listas passam a ser exactamente complementares:
   * ou o pedido tem negociacoes e esta aqui, ou nao tem e esta na de promover.
   * Nunca nas duas, nunca em nenhuma.
   */
  await ensureConcluidosVistosTable();
  const [pedidos] = await pool.execute(
    `SELECT o.id, o.serviceType, o.city, o.contactName, o.contactEmail,
            o.valorDesejadoCliente, o.createdAt, o.status, v.vistoEm AS concluidoVistoEm,
            -- A validade do link do cliente serve de MARCA DE VERSAO.
            --
            -- Cada token novo poe uma data nova (agora + 30 dias), por isso
            -- duas datas diferentes sao dois tokens diferentes. E como o ecra
            -- guarda o texto do link que gerou, e o unico modo de ele saber
            -- que alguem o substituiu entretanto -- e foi isso que aconteceu
            -- ao link da D. Sonia: uma proposta da Sthefanny rodou o token
            -- tres horas antes de ele o copiar.
            o.acessoTokenExpiraEm,
            COALESCE(
              JSON_UNQUOTE(JSON_EXTRACT(o.rawOrderJson, '$.origemPedido')),
              JSON_UNQUOTE(JSON_EXTRACT(o.rawOrderJson, '$._source'))
            ) AS origem
       FROM simulatorOrders o
       LEFT JOIN concluidosVistos v ON v.pedidoId = o.id
      WHERE EXISTS (SELECT 1 FROM negociacoes n WHERE n.pedidoId = o.id)
      ORDER BY o.createdAt DESC
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
            -- A nota, para o painel saber se ja ha alguma e nao a pedir duas vezes.
            n.estrelas, n.avaliadoEm,
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
    origem: (p.origem as string) ?? null,
    status: (p.status as string) ?? null,
    concluidoVistoEm: (p.concluidoVistoEm as Date) ?? null,
    /* A marca de versão do link do cliente — ver o comentário na consulta. */
    linkExpiraEm: (p.acessoTokenExpiraEm as Date) ?? null,
    createdAt: p.createdAt as Date,
    negociacoes: porPedido.get(Number(p.id)) ?? [],
  }));
}

/*
 * Concluídos "por ver": o carimbo é do SITE, não do pedido.
 *
 * Vive numa tabela própria e não numa coluna de simulatorOrders porque o
 * contrato dessa tabela é governado pelo Bridge ([[contrato-bridge]]) — o
 * backoffice não lhe acrescenta colunas por conta própria. E sobrevive à
 * purga dos 60 dias sem drama: apagar um pedido deixa aqui uma linha órfã
 * inofensiva, que nunca mais faz JOIN com nada.
 */
let concluidosVistosReady = false;
async function ensureConcluidosVistosTable() {
  if (concluidosVistosReady) return;
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS concluidosVistos (
      pedidoId BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      vistoEm  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  concluidosVistosReady = true;
}

export async function marcarConcluidoComoVisto(pedidoId: number): Promise<void> {
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) return;
  await ensureConcluidosVistosTable();
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(
    "INSERT INTO concluidosVistos (pedidoId) VALUES (?) ON DUPLICATE KEY UPDATE pedidoId = pedidoId",
    [pedidoId],
  );
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
 * Constrói o UPDATE a partir do que foi pedido, e não a partir de um objeto
 * completo: com um objeto completo, mudar o raio reescrevia as categorias com
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

  /*
   * So contam as negociacoes cujo pedido ainda existe.
   *
   * Apagar um pedido deixava as negociacoes dele para tras — a limpeza
   * transaccional so chegou depois, e ficaram tres orfas na base. A carteira do
   * profissional e a lista de trabalhos dele ja faziam JOIN com os pedidos e
   * portanto ignoravam-nas; esta consulta contava tudo.
   *
   * O resultado era o pior tipo de numero errado: o backoffice dizia que o Fred
   * tinha 8 trabalhos e 2 fechados, o painel dele mostrava 5 e 0, e nenhum dos
   * dois estava avariado. Um numero que nao bate com o outro ecra nao se
   * discute — deixa-se de olhar para ele.
   */
  const [rows] = await pool.execute(
    `SELECT n.providerId,
            COUNT(*) AS recebidos,
            SUM(JSON_LENGTH(n.propostasJson) > 1) AS comProposta,
            SUM(n.estado = 'acordada') AS fechados
       FROM negociacoes n
       JOIN simulatorOrders o ON o.id = n.pedidoId
      GROUP BY n.providerId`,
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
    estrelas: number | null;
    comentario: string | null;
    avaliadoEm: Date | null;
    arquivadoProfissionalEm: Date | null;
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
    /*
     * O acesso ao local, que decide quanto tempo o trabalho leva — e que
     * chegava sempre vazio: a API declarava-os, a consulta nunca os trazia.
     */
    floor: string | null;
    hasElevator: string | null;
    abertoProfissionalEm: Date | null;
    moradaDestino: string | null;
    localidadeDestino: string | null;
    andarDestino: string | null;
    elevadorDestino: string | null;
    estacionamentoDestino: string | null;
    percursoKm: string | null;
    entulhoEstado: string | null;
    entulhoQuantidade: string | null;
    parkingDistance: string | null;
    /* Para a distancia ate ao trabalho. Saem em texto do JSON; ver a nota. */
    pedidoLat: string | null;
    pedidoLng: string | null;
    baseLat: string | number | null;
    baseLng: string | number | null;
  }>
> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) return [];
  const [rows] = await pool.execute(
    `SELECT n.id, n.pedidoId, n.estado, n.valorAcordado, n.propostasJson, n.updatedAt,
            n.execucaoEnviadaEm, n.provaJson, n.confirmadoEm, n.pagoEm,
            n.estrelas, n.comentario, n.avaliadoEm, n.arquivadoProfissionalEm,
            o.serviceType, o.city, o.urgency, o.description, o.valorDesejadoCliente,
            o.precisaFatura, o.precisaGuiaTransporte, o.filesJson, o.dataAgendada,
            -- O acesso ao local: andar, elevador e estacionamento. Sao o que
            -- separa "duas horas" de "uma tarde" e o profissional decidia sem
            -- eles -- a API ja os anunciava, esta consulta e que nunca os foi
            -- buscar.
            n.abertoProfissionalEm,
            o.floor, o.hasElevator, o.parkingDistance,
            -- O que so alguns servicos tem, e sem o qual eles propoem as
            -- cegas: para onde vai uma mudanca (e o acesso do outro lado), e
            -- quantos sacos tem um entulho. Sai em texto pela mesma razao que
            -- as coordenadas -- um pedido sem estes campos e o caso normal.
            CASE WHEN JSON_VALID(o.rawOrderJson)
                 THEN JSON_UNQUOTE(JSON_EXTRACT(o.rawOrderJson, '$.destinationAddress.formattedAddress'))
                 END AS moradaDestino,
            CASE WHEN JSON_VALID(o.rawOrderJson)
                 THEN JSON_UNQUOTE(JSON_EXTRACT(o.rawOrderJson, '$.destinationAddress.city'))
                 END AS localidadeDestino,
            CASE WHEN JSON_VALID(o.rawOrderJson)
                 THEN JSON_UNQUOTE(JSON_EXTRACT(o.rawOrderJson, '$.destinationAccess.floor'))
                 END AS andarDestino,
            CASE WHEN JSON_VALID(o.rawOrderJson)
                 THEN JSON_UNQUOTE(JSON_EXTRACT(o.rawOrderJson, '$.destinationAccess.hasElevator'))
                 END AS elevadorDestino,
            CASE WHEN JSON_VALID(o.rawOrderJson)
                 THEN JSON_UNQUOTE(JSON_EXTRACT(o.rawOrderJson, '$.destinationAccess.parkingDistance'))
                 END AS estacionamentoDestino,
            CASE WHEN JSON_VALID(o.rawOrderJson)
                 THEN JSON_UNQUOTE(JSON_EXTRACT(o.rawOrderJson, '$.movingDistance.distanceKm'))
                 END AS percursoKm,
            CASE WHEN JSON_VALID(o.rawOrderJson)
                 THEN JSON_UNQUOTE(JSON_EXTRACT(o.rawOrderJson, '$.entulhoState'))
                 END AS entulhoEstado,
            CASE WHEN JSON_VALID(o.rawOrderJson)
                 THEN JSON_UNQUOTE(JSON_EXTRACT(o.rawOrderJson, '$.entulhoQuantidade'))
                 END AS entulhoQuantidade,
            -- As coordenadas do trabalho, para lhe dizer a quantos km fica.
            -- Saem por JSON_UNQUOTE e nao por CAST: um CAST de um nulo de
            -- JSON rebenta a consulta inteira, e um pedido sem morada
            -- geocodificada e coisa normal. Chegam em texto e leem-se em JS.
            CASE WHEN JSON_VALID(o.rawOrderJson)
                 THEN JSON_UNQUOTE(JSON_EXTRACT(o.rawOrderJson, '$.address.lat'))
                 END AS pedidoLat,
            CASE WHEN JSON_VALID(o.rawOrderJson)
                 THEN JSON_UNQUOTE(JSON_EXTRACT(o.rawOrderJson, '$.address.lng'))
                 END AS pedidoLng,
            p.baseLat, p.baseLng,
            -- Saem da consulta, mas nao da API: quem decide se chegam ao ecra e
            -- vistaParaOEstado, e so quando o trabalho e mesmo dele.
            o.address, o.contactName, o.contactPhone, o.contactEmail
       FROM negociacoes n
       JOIN simulatorOrders o ON o.id = n.pedidoId
       JOIN providers p ON p.id = n.providerId
      WHERE n.providerId = ?
      ORDER BY
        FIELD(n.estado, 'aberta', 'aguarda_contratacao', 'acordada', 'desistida', 'morta'),
        n.updatedAt DESC
      LIMIT 200`,
    [providerId],
  ) as any[];
  return rows as any[];
}

/**
 * Existe uma conta com este email?
 *
 * Decide para onde apontar um aviso de proposta: quem tem conta vai para
 * /conta, e o link que ele guardou continua válido. Quem não tem precisa de um
 * token novo — e cada token novo mata o anterior, por isso só se emite quando
 * não há alternativa.
 */
export async function existeContaComEmail(email: string): Promise<boolean> {
  const pool = await getPool();
  if (!pool) return false;
  try {
    const [rows] = await pool.execute(
      "SELECT 1 FROM users WHERE LOWER(TRIM(email)) = ? AND deletedAt IS NULL LIMIT 1",
      [email.trim().toLowerCase()],
    ) as any[];
    return (rows as unknown[]).length > 0;
  } catch {
    // Sem resposta, assume-se que não tem: um token novo funciona sempre, e
    // um link para /conta que peça login a quem não a tem é um beco.
    return false;
  }
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
let ligacoesEnsured = false;

/**
 * A tabela dos links de entrada.
 *
 * Guarda o HASH e nunca o token. Quem leia esta tabela — ou uma cópia de
 * segurança que se perca — não consegue entrar na conta de ninguém.
 *
 * `usadoEm` é o que garante o uso único, e a chave única sobre o hash é o que
 * impede duas linhas para o mesmo token.
 */
export async function ensureLigacoesDeEntradaTable(): Promise<void> {
  if (ligacoesEnsured) return;
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ligacoesDeEntrada (
      id        INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      email     VARCHAR(200) NOT NULL,
      tokenHash CHAR(64) NOT NULL,
      expiraEm  DATETIME NOT NULL,
      usadoEm   DATETIME NULL DEFAULT NULL,
      criadoEm  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY ligacao_hash (tokenHash),
      KEY ligacao_email (email),
      KEY ligacao_expira (expiraEm)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  ligacoesEnsured = true;
}

/**
 * Cria uma ligação e mata as anteriores do mesmo email.
 *
 * Quem pede um link novo é porque o primeiro não serviu. Deixar o anterior a
 * valer era deixar duas chaves da mesma casa em circulação — e a mais antiga
 * é a que já pode ter sido reencaminhada.
 */
export async function criarLigacaoDeEntrada(
  email: string,
  tokenHash: string,
  expiraEm: Date,
): Promise<void> {
  await ensureLigacoesDeEntradaTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const norm = email.trim().toLowerCase();

  await pool.execute(
    "UPDATE ligacoesDeEntrada SET usadoEm = NOW() WHERE email = ? AND usadoEm IS NULL",
    [norm],
  );
  await pool.execute(
    "INSERT INTO ligacoesDeEntrada (email, tokenHash, expiraEm) VALUES (?, ?, ?)",
    [norm, tokenHash, expiraEm],
  );

  // Limpeza a passar: sem isto a tabela cresce para sempre com linhas que já
  // não abrem nada. Uma semana chega para investigar um abuso e não é
  // guardar endereços de correio sem razão.
  await pool.execute(
    "DELETE FROM ligacoesDeEntrada WHERE expiraEm < DATE_SUB(NOW(), INTERVAL 7 DAY)",
  );
}

/**
 * Consome uma ligação. Devolve o email se abriu, ou o motivo por que não.
 *
 * O consumo é UM ÚNICO UPDATE com a condição `usadoEm IS NULL` lá dentro. É
 * isso que torna o uso único verdadeiro: se dois pedidos chegarem ao mesmo
 * tempo com o mesmo token — o utilizador a carregar duas vezes, um
 * pré-carregador do cliente de email a seguir o link antes dele — o InnoDB
 * serializa-os na linha e só um vê `affectedRows = 1`. Ler primeiro e escrever
 * depois deixava a janela aberta entre as duas coisas, e nessa janela os dois
 * entravam.
 */
export async function consumirLigacaoDeEntrada(
  tokenHash: string,
): Promise<{ ok: true; email: string } | { ok: false; motivo: "desconhecido" | "expirado" | "usado" }> {
  await ensureLigacoesDeEntradaTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");

  const [res] = await pool.execute(
    `UPDATE ligacoesDeEntrada
        SET usadoEm = NOW()
      WHERE tokenHash = ? AND usadoEm IS NULL AND expiraEm > NOW()`,
    [tokenHash],
  ) as any[];

  if (Number(res.affectedRows ?? 0) === 1) {
    const [linhas] = await pool.execute(
      "SELECT email FROM ligacoesDeEntrada WHERE tokenHash = ? LIMIT 1",
      [tokenHash],
    ) as any[];
    const email = (linhas as Array<{ email: string }>)[0]?.email;
    if (email) return { ok: true, email };
  }

  // Não abriu. Saber PORQUÊ só é possível para quem já tem o token na mão, e
  // por isso não revela nada a quem anda a sondar — mas muda o que se diz à
  // pessoa, e "expirou, peça outro" leva-a a um sítio diferente de "já foi
  // usado".
  const [linhas] = await pool.execute(
    "SELECT expiraEm, usadoEm FROM ligacoesDeEntrada WHERE tokenHash = ? LIMIT 1",
    [tokenHash],
  ) as any[];
  const l = (linhas as Array<{ expiraEm: Date; usadoEm: Date | null }>)[0];
  if (!l) return { ok: false, motivo: "desconhecido" };
  if (l.usadoEm) return { ok: false, motivo: "usado" };
  return { ok: false, motivo: "expirado" };
}

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

/**
 * O cliente avalia o profissional.
 *
 * A condição está no UPDATE: só se avalia um trabalho fechado, confirmado, e
 * ainda não avaliado. Ler antes e decidir em JavaScript deixava a janela onde
 * dois toques no botão gravam duas vezes — e uma segunda avaliação por cima da
 * primeira apagava o que a pessoa tinha escrito.
 */
export async function avaliarProfissional(
  negociacaoId: number,
  pedidoId: number,
  estrelas: number,
  comentario: string | null,
): Promise<boolean> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [res] = await pool.execute(
    `UPDATE negociacoes
        SET estrelas = ?, comentario = ?, avaliadoEm = NOW()
      WHERE id = ? AND pedidoId = ? AND estado = 'acordada'
        AND confirmadoEm IS NOT NULL AND avaliadoEm IS NULL`,
    [estrelas, comentario, negociacaoId, pedidoId],
  ) as any[];
  return Number(res.affectedRows ?? 0) > 0;
}

/** As avaliações de um profissional, da mais recente para a mais antiga. */
export async function avaliacoesDoProfissional(providerId: number): Promise<
  Array<{ estrelas: number; comentario: string | null; avaliadoEm: Date }>
> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) return [];
  const [rows] = await pool.execute(
    `SELECT estrelas, comentario, avaliadoEm
       FROM negociacoes
      WHERE providerId = ? AND avaliadoEm IS NOT NULL
      ORDER BY avaliadoEm DESC
      LIMIT 100`,
    [providerId],
  ) as any[];
  return rows as any[];
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
  const gravou = Number(res.affectedRows ?? 0) > 0;

  /*
   * O pedido segue o trabalho: confirmado o trabalho, o pedido esta REALIZADO.
   *
   * Sem isto, um pedido cujo trabalho ja foi confirmado e pago continuava na
   * lista dos activos do backoffice, ao lado dos que ainda precisam de
   * alguem — e a lista dos activos e a lista do que ha para FAZER.
   *
   * So depois de a negociacao gravar (se nao gravou, nao ha o que fechar), e
   * sem tocar em cancelados nem arquivados: quem arquivou decidiu onde o
   * pedido vive, e uma confirmacao tardia nao desfaz essa arrumacao.
   */
  if (gravou) {
    await pool.execute(
      `UPDATE simulatorOrders SET status = 'concluido', updatedAt = NOW()
        WHERE id = ? AND status NOT IN ('cancelado', 'arquivado')`,
      [pedidoId],
    );
  }
  return gravou;
}

/**
 * Grava a libertação por prazo dos trabalhos a que o cliente nunca voltou.
 *
 * A carteira já os conta como libertados a partir da data — ver carteira.ts —
 * mas convém que a base concorde com o ecrã: quem for ler a tabela daqui a um
 * ano não tem de saber a regra de cor.
 */
export async function libertarTrabalhosPorPrazo(
  dias: number,
): Promise<Array<{ negociacaoId: number; pedidoId: number }>> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) return [];

  /*
   * Primeiro QUAIS, depois o UPDATE — e não um UPDATE cego com affectedRows.
   *
   * A libertação por prazo é dinheiro a ficar disponível, e o profissional
   * tem de ser avisado de cada um. Um contador não diz a quem: devolvem-se as
   * linhas, e o UPDATE vai por id para que o que se avisa seja EXACTAMENTE o
   * que se libertou — entre o SELECT e um UPDATE por condição podia entrar
   * mais um trabalho, avisado nunca.
   */
  const [linhas] = (await pool.execute(
    `SELECT id, pedidoId FROM negociacoes
      WHERE estado = 'acordada' AND confirmadoEm IS NULL
        AND execucaoEnviadaEm IS NOT NULL
        AND execucaoEnviadaEm <= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [dias],
  )) as any[];
  const alvos = (linhas as Array<{ id: number; pedidoId: number }>).map((l) => ({
    negociacaoId: Number(l.id),
    pedidoId: Number(l.pedidoId),
  }));
  if (alvos.length === 0) return [];

  await pool.execute(
    `UPDATE negociacoes SET confirmadoEm = NOW()
      WHERE id IN (${alvos.map(() => "?").join(",")}) AND confirmadoEm IS NULL`,
    alvos.map((a) => a.negociacaoId),
  );
  // Os pedidos seguem os trabalhos — mesma regra do confirmarExecucao.
  await pool.execute(
    `UPDATE simulatorOrders SET status = 'concluido', updatedAt = NOW()
      WHERE id IN (${alvos.map(() => "?").join(",")})
        AND status NOT IN ('cancelado', 'arquivado')`,
    alvos.map((a) => a.pedidoId),
  );
  return alvos;
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
  // Os tres da plataforma. Faltavam, e o editor mandava-os na mesma: a lista
  // ignora o que nao conhece EM SILENCIO, e o `as Parameters<...>` no editor
  // calava o TypeScript. Resultado: gravar o pedido #228 com 30 EUR deixava
  // 121,43 na base, a fotografia anexada evaporava-se e a caixa da fatura nao
  // guardava. O ecra dava o pedido por actualizado e nao era verdade.
  "valorDesejadoCliente", "precisaFatura", "filesJson",
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
    // Date TAMBEM: o editor manda um Date e o driver sabe grava-lo. O tipo e
    // que dizia so string, e o molde do editor engolia o erro.
    dataAgendada: Date | string | null;
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
    valorDesejadoCliente: string | null;
    precisaFatura: number;
    filesJson: string | null;
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

  // ⚠️ As chaves deste objeto vão para a LISTA DE COLUNAS do SQL, e uma
  // consulta preparada parametriza valores, não identificadores. Como o
  // PATCH de /api/admin/pedidos faz `const { id, ...fields } = body` e passa
  // isto diretamente, os nomes das colunas vinham do corpo do pedido: uma
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

/**
 * Uma tentativa de apagar que se recusou a apagar.
 *
 * Não é um erro genérico de propósito: quem carregou no botão tem de saber
 * qual dos trabalhos é que está no ar, para poder ir tratar dele em vez de
 * ficar a olhar para "não foi possível apagar".
 */
export class TrabalhoEmCurso extends Error {
  constructor(
    readonly pedidoId: number,
    readonly detalhes: Array<{ negociacaoId: number; profissional: string; valor: string | null }>,
  ) {
    const quem = detalhes
      .map((d) => `${d.profissional}${d.valor ? ` (${d.valor} €)` : ""}`)
      .join(", ");
    super(
      `O pedido #${pedidoId} tem trabalho fechado e por confirmar com ${quem}. ` +
        `Enquanto o trabalho não for confirmado, apagar o pedido tira-lhe a morada ` +
        `e o valor da carteira.`,
    );
    this.name = "TrabalhoEmCurso";
  }
}

/**
 * Apaga um pedido, e o que estava agarrado a ele.
 *
 * Apagava só a linha de simulatorOrders. Nao ha chaves estrangeiras nesta base
 * — verificado — por isso as negociacoes ficavam orfas: linhas a apontar para
 * um pedidoId que ja nao existe.
 *
 * A consulta do painel do profissional faz JOIN com simulatorOrders, portanto
 * essas negociacoes desapareciam do ecra dele em silencio. Se ele tinha um
 * trabalho fechado, o registo do que foi combinado sumia de um lado e ficava a
 * ocupar espaco do outro, sem forma de lhe chegar.
 *
 * Vai tudo junto, e numa transaccao: metade apagado e' pior do que nada
 * apagado.
 *
 * O QUE PASSOU A ACONTECER ANTES DE APAGAR
 *
 * Duas coisas, e as duas nasceram do mesmo estrago já consumado: os pedidos
 * #196, #199 e #200 foram apagados e deixaram três negociações órfãs, duas
 * delas com negócio fechado. Ninguém sabe hoje o que foi combinado nesses
 * trabalhos, porque o histórico vivia dentro da linha do pedido.
 *
 *   1. RECUSA-SE a apagar um pedido cujo trabalho está fechado e por
 *      confirmar. Nessa altura o profissional ainda precisa da morada para lá
 *      ir, e tem o valor cativo na carteira — que é calculada por JOIN com
 *      esta tabela e portanto desaparece com ela. Não é uma escolha de
 *      interface: quem apaga pode não ser quem sabe disto, e a única guarda
 *      que serve é a que está do lado da base.
 *
 *   2. ESCREVE no registo permanente, dentro da mesma transacção, um retrato
 *      do que se está a apagar: quem era o cliente, que serviço, que zona, e a
 *      linha de cada negociação com o valor. Fotografias não — o registo
 *      guarda que houve prova, não a prova.
 *
 * O `motivo` é obrigatório e não tem valor por omissão. Um registo que diz que
 * um pedido foi apagado sem dizer porquê responde a metade da pergunta que
 * alguém virá fazer.
 */
export async function deleteSimulatorOrder(
  id: number,
  contexto: {
    motivo: string;
    autorNome?: string | null;
    autorTipo?: "clyon" | "cliente" | "sistema";
    /**
     * Deixa passar um trabalho fechado e por confirmar.
     *
     * Só a purga automática e o apagamento de conta a pedido do titular o
     * usam, e esses correm depois de terem verificado por outra via. Um botão
     * de backoffice nunca o passa.
     */
    mesmoComTrabalhoEmCurso?: boolean;
  },
) {
  await ensureSimulatorOrdersTable();
  await ensureNegociacoesTable();
  await ensureRegistoTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");

  // Ler ANTES de apagar. Depois de o DELETE correr não há a quem perguntar.
  const [pedidos] = (await pool.execute(
    `SELECT id, serviceType, city, contactName, contactEmail, valorDesejadoCliente, createdAt
       FROM simulatorOrders WHERE id = ? LIMIT 1`,
    [id],
  )) as any[];
  const pedido = (pedidos as any[])[0] ?? null;

  const [negs] = (await pool.execute(
    `SELECT n.id, n.providerId, n.estado, n.valorAcordado, n.confirmadoEm,
            n.execucaoEnviadaEm, n.pagoEm, p.name AS profissionalNome
       FROM negociacoes n
       LEFT JOIN providers p ON p.id = n.providerId
      WHERE n.pedidoId = ?`,
    [id],
  )) as any[];
  const negociacoes = negs as Array<Record<string, any>>;

  const emCurso = negociacoes.filter(
    (n) => n.estado === "acordada" && n.confirmadoEm == null,
  );
  if (emCurso.length > 0 && !contexto.mesmoComTrabalhoEmCurso) {
    throw new TrabalhoEmCurso(
      id,
      emCurso.map((n) => ({
        negociacaoId: Number(n.id),
        profissional: (n.profissionalNome as string) ?? `#${n.providerId}`,
        valor: n.valorAcordado != null ? String(n.valorAcordado) : null,
      })),
    );
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    /*
     * O retrato, escrito dentro da transacção.
     *
     * Fora dela, uma falha a meio deixava história de um pedido que continuou
     * a existir, ou um pedido apagado sem história. As duas coisas ou
     * acontecem juntas ou não acontecem.
     */
    await registarNaTransaccao(conn, {
      acontecimento: "pedido_apagado",
      pedidoId: id,
      clienteEmail: (pedido?.contactEmail as string) ?? null,
      clienteNome: (pedido?.contactName as string) ?? null,
      autorTipo: contexto.autorTipo ?? "clyon",
      autorNome: contexto.autorNome ?? null,
      servicoTipo: (pedido?.serviceType as string) ?? null,
      zona: (pedido?.city as string) ?? null,
      valorCliente:
        pedido?.valorDesejadoCliente != null ? Number(pedido.valorDesejadoCliente) : null,
      resumo: `Pedido apagado — ${contexto.motivo}.`,
      detalhe: {
        motivo: contexto.motivo,
        criadoEm: pedido?.createdAt ?? null,
        negociacoes: negociacoes.map((n) => ({
          id: Number(n.id),
          providerId: Number(n.providerId),
          profissional: (n.profissionalNome as string) ?? null,
          estado: n.estado,
          valorAcordado: n.valorAcordado != null ? Number(n.valorAcordado) : null,
          execucaoEnviadaEm: n.execucaoEnviadaEm ?? null,
          confirmadoEm: n.confirmadoEm ?? null,
          pagoEm: n.pagoEm ?? null,
        })),
      },
    });

    /*
     * Uma linha por profissional, e não só o retrato de cima.
     *
     * O retrato serve ao backoffice, que procura por pedido. O profissional
     * procura por `providerId` — e sem uma linha dele, um trabalho que ele fez
     * desaparecia do histórico dele no dia em que o pedido fosse apagado. É
     * justamente o que já aconteceu e o que isto existe para impedir.
     */
    for (const n of negociacoes) {
      await registarNaTransaccao(conn, {
        acontecimento: "pedido_apagado",
        pedidoId: id,
        negociacaoId: Number(n.id),
        providerId: Number(n.providerId),
        providerNome: (n.profissionalNome as string) ?? null,
        clienteEmail: (pedido?.contactEmail as string) ?? null,
        autorTipo: contexto.autorTipo ?? "clyon",
        autorNome: contexto.autorNome ?? null,
        estadoAntes: n.estado as string,
        valor: n.valorAcordado != null ? Number(n.valorAcordado) : null,
        servicoTipo: (pedido?.serviceType as string) ?? null,
        zona: (pedido?.city as string) ?? null,
        resumo: `O pedido foi apagado — ${contexto.motivo}.`,
        // Ele vê que o pedido deixou de existir e com que valor ficou. O
        // motivo interno da CLYON não lhe diz respeito, mas o facto sim: sem
        // isto, um trabalho sumia-lhe do ecrã sem explicação nenhuma.
        visivelProfissional: true,
      });
    }

    // Primeiro as filhas. Ao contrario, uma falha a meio deixava o pedido
    // apagado e as negociacoes penduradas — exactamente o estado a evitar.
    await conn.execute("DELETE FROM negociacoes WHERE pedidoId = ?", [id]);
    await conn.execute("DELETE FROM simulatorOrders WHERE id = ?", [id]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
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

// ── A fila do WhatsApp: o que o site quer dizer, à espera da ponte ──────────
//
// O servidor não chega ao WhatsApp do Winapp — é o Winapp que vem cá. Cada
// mensagem que o site quer mandar fica aqui; a ponte vem buscá-las de poucos
// em poucos segundos, envia-as pelo WhatsApp emparelhado, e confirma. Uma
// linha só se apaga por confirmação: se o Winapp cair entre buscar e enviar,
// a mensagem volta a sair na ronda seguinte em vez de se perder.
let filaWhatsAppReady = false;
async function ensureFilaWhatsAppTable() {
  if (filaWhatsAppReady) return;
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS whatsappFila (
      id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      telefone  VARCHAR(32) NOT NULL,
      texto     TEXT NOT NULL,
      criadoEm  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      enviadoEm DATETIME NULL,
      KEY idx_por_enviar (enviadoEm, criadoEm)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  filaWhatsAppReady = true;
}

export async function guardarNaFilaWhatsApp(telefone: string, texto: string): Promise<void> {
  await ensureFilaWhatsAppTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute("INSERT INTO whatsappFila (telefone, texto) VALUES (?, ?)", [
    telefone,
    texto,
  ]);
}

export interface MensagemNaFilaWhatsApp {
  id: number;
  telefone: string;
  texto: string;
}

export async function filaWhatsAppPorEnviar(limite = 20): Promise<MensagemNaFilaWhatsApp[]> {
  await ensureFilaWhatsAppTable();
  const pool = await getPool();
  if (!pool) return [];
  // Mais velhas primeiro: numa conversa, a ordem é significado.
  const [rows] = (await pool.execute(
    `SELECT id, telefone, texto FROM whatsappFila
      WHERE enviadoEm IS NULL
      ORDER BY criadoEm ASC, id ASC
      LIMIT ${Math.max(1, Math.min(100, Math.floor(limite)))}`,
  )) as [Array<{ id: number; telefone: string; texto: string }>, unknown];
  return rows.map((r) => ({ id: Number(r.id), telefone: r.telefone, texto: r.texto }));
}

// ── Números bloqueados no WhatsApp da plataforma ────────────────────────────
//
// O mesmo gesto do ecrã "Bloqueados" do Winapp, mas para o cérebro DAQUI: um
// número bloqueado não recebe nada do site (nem propostas, nem respostas) e o
// que ele escrever é ignorado. Serve para os contactos pessoais e para quem
// o dono decidir que o assunto não é com o site. Compara-se pelos últimos 9
// dígitos, como no resto do WhatsApp da plataforma.
let bloqueadosWhatsAppReady = false;
async function ensureWhatsappBloqueadosTable() {
  if (bloqueadosWhatsAppReady) return;
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS whatsappBloqueados (
      id        INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      telefone  VARCHAR(32) NOT NULL,
      nota      VARCHAR(255) NULL,
      criadoEm  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_telefone (telefone)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  bloqueadosWhatsAppReady = true;
}

function soDigitos(telefone: string): string {
  return telefone.replace(/\D/g, "");
}

export async function bloquearNumeroWhatsApp(telefone: string, nota?: string): Promise<void> {
  const digitos = soDigitos(telefone);
  if (digitos.length < 9) throw new Error("Número demasiado curto");
  await ensureWhatsappBloqueadosTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(
    `INSERT INTO whatsappBloqueados (telefone, nota) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE nota = VALUES(nota)`,
    [digitos, nota?.trim() || null],
  );
}

export async function desbloquearNumeroWhatsApp(telefone: string): Promise<void> {
  await ensureWhatsappBloqueadosTable();
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(
    "DELETE FROM whatsappBloqueados WHERE RIGHT(telefone, 9) = RIGHT(?, 9)",
    [soDigitos(telefone)],
  );
}

export async function listarNumerosBloqueadosWhatsApp(): Promise<
  Array<{ telefone: string; nota: string | null; criadoEm: string }>
> {
  await ensureWhatsappBloqueadosTable();
  const pool = await getPool();
  if (!pool) return [];
  const [rows] = (await pool.execute(
    "SELECT telefone, nota, criadoEm FROM whatsappBloqueados ORDER BY criadoEm DESC",
  )) as [Array<{ telefone: string; nota: string | null; criadoEm: string }>, unknown];
  return rows;
}

export async function numeroBloqueadoWhatsApp(telefone: string): Promise<boolean> {
  const digitos = soDigitos(telefone);
  if (digitos.length < 9) return false;
  await ensureWhatsappBloqueadosTable();
  const pool = await getPool();
  if (!pool) return false;
  const [rows] = (await pool.execute(
    "SELECT 1 FROM whatsappBloqueados WHERE RIGHT(telefone, 9) = RIGHT(?, 9) LIMIT 1",
    [digitos],
  )) as [unknown[], unknown];
  return rows.length > 0;
}

// ── Conversas interrompidas e o interruptor geral ───────────────────────────
//
// Interromper é o gesto do meio: o número continua a ser cliente (nada de
// bloqueio), mas quem fala agora é uma PESSOA — o cérebro cala-se até alguém
// carregar em "Devolver ao site". É posto pelo backoffice, ou pelo próprio
// Winapp quando o dono responde à mão no WhatsApp: responder à mão é a forma
// mais natural de dizer "esta é minha".
//
// O interruptor geral corta tudo de uma vez. Sem linha na tabela está LIGADO:
// o cérebro nasceu a funcionar e desligar é a excepção — e quem o desliga vê
// no painel um interruptor vermelho, não uma ausência.
let whatsappEstadoReady = false;
async function ensureWhatsappEstadoTables() {
  if (whatsappEstadoReady) return;
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS whatsappInterrompidos (
      id        INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      telefone  VARCHAR(32) NOT NULL,
      motivo    VARCHAR(255) NULL,
      criadoEm  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_telefone (telefone)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS whatsappEstado (
      id            TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      ligado        TINYINT(1) NOT NULL DEFAULT 1,
      actualizadoEm DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  whatsappEstadoReady = true;
}

export async function interromperNumeroWhatsApp(telefone: string, motivo?: string): Promise<void> {
  const digitos = soDigitos(telefone);
  if (digitos.length < 9) throw new Error("Número demasiado curto");
  await ensureWhatsappEstadoTables();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(
    `INSERT INTO whatsappInterrompidos (telefone, motivo) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE motivo = VALUES(motivo)`,
    [digitos, motivo?.trim() || null],
  );
}

export async function retomarNumeroWhatsApp(telefone: string): Promise<void> {
  await ensureWhatsappEstadoTables();
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(
    "DELETE FROM whatsappInterrompidos WHERE RIGHT(telefone, 9) = RIGHT(?, 9)",
    [soDigitos(telefone)],
  );
}

export async function listarNumerosInterrompidosWhatsApp(): Promise<
  Array<{ telefone: string; motivo: string | null; criadoEm: string }>
> {
  await ensureWhatsappEstadoTables();
  const pool = await getPool();
  if (!pool) return [];
  const [rows] = (await pool.execute(
    "SELECT telefone, motivo, criadoEm FROM whatsappInterrompidos ORDER BY criadoEm DESC",
  )) as [Array<{ telefone: string; motivo: string | null; criadoEm: string }>, unknown];
  return rows;
}

export async function numeroInterrompidoWhatsApp(telefone: string): Promise<boolean> {
  const digitos = soDigitos(telefone);
  if (digitos.length < 9) return false;
  await ensureWhatsappEstadoTables();
  const pool = await getPool();
  if (!pool) return false;
  const [rows] = (await pool.execute(
    "SELECT 1 FROM whatsappInterrompidos WHERE RIGHT(telefone, 9) = RIGHT(?, 9) LIMIT 1",
    [digitos],
  )) as [unknown[], unknown];
  return rows.length > 0;
}

export async function whatsappLigado(): Promise<boolean> {
  await ensureWhatsappEstadoTables();
  const pool = await getPool();
  if (!pool) return false;
  const [rows] = (await pool.execute(
    "SELECT ligado FROM whatsappEstado WHERE id = 1",
  )) as [Array<{ ligado: number }>, unknown];
  return rows.length === 0 || Number(rows[0].ligado) === 1;
}

export async function definirWhatsappLigado(ligado: boolean): Promise<void> {
  await ensureWhatsappEstadoTables();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(
    `INSERT INTO whatsappEstado (id, ligado) VALUES (1, ?)
     ON DUPLICATE KEY UPDATE ligado = VALUES(ligado)`,
    [ligado ? 1 : 0],
  );
}

// ── O registo das conversas do WhatsApp ─────────────────────────────────────
//
// Cada mensagem que entra ou sai fica aqui — é o que faz do painel um sítio
// onde se VÊ a conversa em vez de se adivinhar. Sessenta dias e apaga-se,
// como os pedidos ([[retencao-registo]]): o registo é operacional, não é
// arquivo. As acções de negócio continuam no registoPermanente, que é doutro
// material.
let mensagensWhatsAppReady = false;
async function ensureWhatsappMensagensTable() {
  if (mensagensWhatsAppReady) return;
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS whatsappMensagens (
      id       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      telefone VARCHAR(32) NOT NULL,
      direccao VARCHAR(3) NOT NULL,
      texto    TEXT NOT NULL,
      criadoEm DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_tel (telefone, id),
      KEY idx_criado (criadoEm)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  mensagensWhatsAppReady = true;
}

export async function registarMensagemWhatsApp(
  telefone: string,
  direccao: "in" | "out",
  texto: string,
): Promise<void> {
  const digitos = telefone.replace(/\D/g, "");
  if (!digitos || !texto.trim()) return;
  await ensureWhatsappMensagensTable();
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(
    "INSERT INTO whatsappMensagens (telefone, direccao, texto) VALUES (?, ?, ?)",
    [digitos, direccao, texto.slice(0, 4096)],
  );
  // A limpeza anda à boleia da escrita: sem cron próprio, sem tabela a
  // crescer para sempre. O LIMIT trava o custo de cada passagem.
  await pool
    .execute("DELETE FROM whatsappMensagens WHERE criadoEm < NOW() - INTERVAL 60 DAY LIMIT 200")
    .catch(() => {});
}

export interface ConversaWhatsApp {
  telefone: string;
  ultimaMensagem: string;
  direccao: string;
  quando: string;
}

export async function conversasWhatsApp(limite = 30): Promise<ConversaWhatsApp[]> {
  await ensureWhatsappMensagensTable();
  const pool = await getPool();
  if (!pool) return [];
  const [rows] = (await pool.execute(
    `SELECT m.telefone, m.texto, m.direccao, m.criadoEm
       FROM whatsappMensagens m
       JOIN (SELECT telefone, MAX(id) AS mid FROM whatsappMensagens GROUP BY telefone) u
         ON u.mid = m.id
      ORDER BY m.id DESC
      LIMIT ${Math.max(1, Math.min(100, Math.floor(limite)))}`,
  )) as [Array<{ telefone: string; texto: string; direccao: string; criadoEm: string }>, unknown];
  return rows.map((r) => ({
    telefone: r.telefone,
    ultimaMensagem: r.texto,
    direccao: r.direccao,
    quando: String(r.criadoEm),
  }));
}

export async function mensagensDoNumeroWhatsApp(
  telefone: string,
  limite = 100,
): Promise<Array<{ direccao: string; texto: string; criadoEm: string }>> {
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length < 9) return [];
  await ensureWhatsappMensagensTable();
  const pool = await getPool();
  if (!pool) return [];
  const [rows] = (await pool.execute(
    `SELECT direccao, texto, criadoEm FROM whatsappMensagens
      WHERE RIGHT(telefone, 9) = RIGHT(?, 9)
      ORDER BY id DESC
      LIMIT ${Math.max(1, Math.min(300, Math.floor(limite)))}`,
    [digitos],
  )) as [Array<{ direccao: string; texto: string; criadoEm: string }>, unknown];
  return rows.reverse().map((r) => ({ ...r, criadoEm: String(r.criadoEm) }));
}

/**
 * A pergunta que TODO o envio e TODA a resposta fazem primeiro: o cérebro
 * pode falar com este número? Três nãos possíveis — o interruptor geral, o
 * bloqueio, a conversa entregue a uma pessoa. Qualquer um deles cala tudo.
 */
export async function podeOWhatsAppFalarCom(telefone: string): Promise<boolean> {
  if (!(await whatsappLigado())) return false;
  if (await numeroBloqueadoWhatsApp(telefone)) return false;
  if (await numeroInterrompidoWhatsApp(telefone)) return false;
  return true;
}

export async function marcarFilaWhatsAppEnviadas(ids: number[]): Promise<void> {
  const limpos = ids.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0);
  if (limpos.length === 0) return;
  await ensureFilaWhatsAppTable();
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(
    `UPDATE whatsappFila SET enviadoEm = NOW() WHERE id IN (${limpos.map(() => "?").join(",")})`,
    limpos,
  );
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
        SUM(CASE WHEN status = 'arquivado' THEN 1 ELSE 0 END) as arquivado,
        SUM(CASE WHEN status = 'concluido' THEN 1 ELSE 0 END) as concluido,
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
    // Sem estas duas, o chip "Arquivados" mostrava sempre zero e o "Total
    // activos" tinha de adivinhar o que subtrair.
    result["arquivado"] = Number(row?.arquivado ?? 0);
    result["concluido"] = Number(row?.concluido ?? 0);
    
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
  if ((order as any).confirmadoPeloCliente) return { ok: false, error: "O pedido já foi confirmado e não pode ser cancelado aqui. Por favor contacte a CLYON diretamente." };
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

// ── Registo permanente ──────────────────────────────────────────────────────

/**
 * A linha de história que sobrevive ao pedido.
 *
 * PORQUE É QUE ISTO PRECISA DE EXISTIR
 *
 * O único histórico que este site tinha vivia dentro da própria linha do
 * pedido, na coluna `historyJson`. Isso quer dizer que morria com ele: apagar
 * um pedido levava consigo quem propôs o quê, quem aceitou, por quanto, e em
 * que dia. Já aconteceu — os pedidos #196, #199 e #200 foram apagados e
 * deixaram três negociações órfãs, duas delas com negócio fechado, sem
 * nenhuma forma de saber o que se tinha passado.
 *
 * A partir do momento em que os pedidos passam a ser apagados aos 60 dias, o
 * que hoje é um acidente passa a ser a regra. Sem esta tabela, ao fim de dois
 * meses a CLYON não conseguiria responder a "quanto é que eu recebi por aquele
 * trabalho de Junho" — nem ao cliente, nem ao profissional, nem a um tribunal.
 *
 * DUAS METADES, DE PROPÓSITO
 *
 * As colunas estão separadas em duas famílias e a separação não é estética:
 *
 *   · A METADE QUE FICA — pedidoId, datas, estados, valores, taxa, tipo de
 *     serviço e zona. É contabilidade: quanto foi cobrado, quanto a CLYON
 *     reteve, quando. Conserva-se por obrigação legal e para defesa em caso de
 *     litígio (RGPD art. 17.º, n.º 3, als. b) e e)).
 *
 *   · A METADE QUE SAI — nome, email, resumo e detalhe. São os identificadores
 *     e o texto livre. Quando alguém exerce o direito ao apagamento, é isto que
 *     desaparece, e a linha de contabilidade fica de pé sem ninguém lá dentro.
 *
 * O `resumo` e o `detalheJson` saem com os identificadores porque são TEXTO
 * LIVRE. Limpar as colunas do nome e deixar o JSON é exactamente o erro que
 * este projecto já comete com o `rawOrderJson`: apaga-se o `contactName` e o
 * nome continua lá dentro, escrito por extenso.
 *
 * O QUE NUNCA ENTRA AQUI
 *
 * Fotografias. Nem os ficheiros, nem os URLs deles. Uma foto de dentro de uma
 * casa é o dado mais sensível que este site recolhe, e guardá-la para sempre
 * numa tabela que nunca se apaga seria transformar uma decisão de negócio
 * ("guardar a história") na decisão oposta ("guardar tudo"). O registo guarda
 * que houve prova de execução e em que dia; a prova em si vai-se com o pedido.
 */

let registoEnsured = false;
// Sobe sempre que a lista de colunas cresce. O guarda booleano sozinho só
// deixava as migrações novas passar em arranques frios, e um processo já
// quente nunca as via — a mesma razão que está escrita nas negociações.
const VERSAO_DO_REGISTO = 1;
let versaoDoRegisto = 0;

export async function ensureRegistoTable(): Promise<void> {
  if (registoEnsured && versaoDoRegisto >= VERSAO_DO_REGISTO) return;
  const pool = await getPool();
  if (!pool) return;

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS registoPermanente (
      id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      acontecimento       VARCHAR(40) NOT NULL,
      ocorridoEm          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

      pedidoId            INT NULL DEFAULT NULL,
      negociacaoId        INT UNSIGNED NULL DEFAULT NULL,
      levantamentoId      INT UNSIGNED NULL DEFAULT NULL,
      providerId          INT UNSIGNED NULL DEFAULT NULL,
      clienteEmail        VARCHAR(255) NULL DEFAULT NULL,

      clienteNome         VARCHAR(160) NULL DEFAULT NULL,
      providerNome        VARCHAR(160) NULL DEFAULT NULL,
      autorTipo           VARCHAR(20) NULL DEFAULT NULL,
      autorNome           VARCHAR(160) NULL DEFAULT NULL,
      resumo              VARCHAR(500) NULL DEFAULT NULL,
      detalheJson         LONGTEXT NULL DEFAULT NULL,

      estadoAntes         VARCHAR(30) NULL DEFAULT NULL,
      estadoDepois        VARCHAR(30) NULL DEFAULT NULL,
      valor               DECIMAL(10,2) NULL DEFAULT NULL,
      valorCliente        DECIMAL(10,2) NULL DEFAULT NULL,
      valorProfissional   DECIMAL(10,2) NULL DEFAULT NULL,
      taxaClyon           DECIMAL(10,2) NULL DEFAULT NULL,

      servicoTipo         VARCHAR(60) NULL DEFAULT NULL,
      zona                VARCHAR(120) NULL DEFAULT NULL,

      visivelCliente      TINYINT(1) NOT NULL DEFAULT 0,
      visivelProfissional TINYINT(1) NOT NULL DEFAULT 0,

      anonimizadoEm       DATETIME NULL DEFAULT NULL,
      anonimizadoMotivo   VARCHAR(40) NULL DEFAULT NULL,
      sujeitoAnonimo      VARCHAR(16) NULL DEFAULT NULL,

      KEY registo_pedido (pedidoId),
      KEY registo_negociacao (negociacaoId),
      KEY registo_cliente (clienteEmail, ocorridoEm),
      KEY registo_profissional (providerId, ocorridoEm),
      KEY registo_quando (ocorridoEm)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  registoEnsured = true;
  versaoDoRegisto = VERSAO_DO_REGISTO;
}

/**
 * O que aconteceu. Vocabulário fechado, e a razão é prática.
 *
 * Uma coluna de texto livre para o tipo de acontecimento enche-se ao fim de um
 * ano de variantes escritas à mão — "proposta", "proposta_feita", "propôs" —
 * e depois não há forma de contar quantas propostas houve. Com um tipo
 * fechado, acrescentar um acontecimento novo obriga a passar por aqui, e o
 * TypeScript apanha quem escrever ao lado.
 */
export type Acontecimento =
  // O pedido
  | "pedido_criado"
  | "pedido_editado"
  | "pedido_distribuido"
  | "pedido_cancelado"
  | "pedido_apagado"
  | "pedido_expurgado"
  // A negociação
  | "negociacao_criada"
  | "proposta_feita"
  | "proposta_aceite"
  | "negociacao_fechada"
  | "negociacao_desistida"
  | "negociacao_encerrada"
  // O trabalho
  | "execucao_enviada"
  | "execucao_confirmada"
  | "avaliacao_feita"
  // O dinheiro
  | "levantamento_pedido"
  | "levantamento_pago"
  // As contas
  | "conta_apagada";

export type LinhaDoRegisto = {
  acontecimento: Acontecimento;
  pedidoId?: number | null;
  negociacaoId?: number | null;
  levantamentoId?: number | null;
  providerId?: number | null;
  clienteEmail?: string | null;
  clienteNome?: string | null;
  providerNome?: string | null;
  autorTipo?: "cliente" | "profissional" | "clyon" | "sistema" | null;
  autorNome?: string | null;
  resumo?: string | null;
  detalhe?: unknown;
  estadoAntes?: string | null;
  estadoDepois?: string | null;
  valor?: number | null;
  valorCliente?: number | null;
  valorProfissional?: number | null;
  taxaClyon?: number | null;
  servicoTipo?: string | null;
  zona?: string | null;
  /**
   * Quem vê esta linha no histórico dele.
   *
   * Por omissão, ninguém além do backoffice. Uma linha só chega ao cliente ou
   * ao profissional se alguém disser explicitamente que sim — o contrário
   * levava notas internas e decisões da CLYON para dentro do painel de quem
   * não tem nada a ver com elas, e essa é a espécie de fuga que só se descobre
   * depois de acontecer.
   */
  visivelCliente?: boolean;
  visivelProfissional?: boolean;
};

/**
 * As colunas na ordem em que entram.
 *
 * Exportada, e a lista de valores logo a seguir também, por uma razão só: são
 * duas listas paralelas e a base não tem como saber que uma delas ficou uma
 * entrada mais curta. Um campo acrescentado num sítio e esquecido no outro não
 * dá erro nenhum — desloca todos os valores seguintes uma coluna para o lado,
 * e a partir daí os valores acordados vão parar à coluna da taxa. Há um teste
 * a comparar os comprimentos, e é por isso que estas duas são públicas.
 */
export const COLUNAS_DO_REGISTO = [
  "acontecimento",
  "pedidoId",
  "negociacaoId",
  "levantamentoId",
  "providerId",
  "clienteEmail",
  "clienteNome",
  "providerNome",
  "autorTipo",
  "autorNome",
  "resumo",
  "detalheJson",
  "estadoAntes",
  "estadoDepois",
  "valor",
  "valorCliente",
  "valorProfissional",
  "taxaClyon",
  "servicoTipo",
  "zona",
  "visivelCliente",
  "visivelProfissional",
] as const;

export function valoresDoRegisto(l: LinhaDoRegisto): unknown[] {
  const corta = (s: string | null | undefined, n: number) =>
    s == null ? null : String(s).slice(0, n);
  return [
    l.acontecimento,
    l.pedidoId ?? null,
    l.negociacaoId ?? null,
    l.levantamentoId ?? null,
    l.providerId ?? null,
    // O email vai normalizado porque é a chave por onde o histórico do cliente
    // é procurado. "Ana@Gmail.com " e "ana@gmail.com" são a mesma pessoa e
    // tinham de dar a mesma lista.
    l.clienteEmail ? l.clienteEmail.trim().toLowerCase().slice(0, 255) : null,
    corta(l.clienteNome, 160),
    corta(l.providerNome, 160),
    l.autorTipo ?? null,
    corta(l.autorNome, 160),
    corta(l.resumo, 500),
    l.detalhe === undefined ? null : JSON.stringify(l.detalhe),
    corta(l.estadoAntes, 30),
    corta(l.estadoDepois, 30),
    l.valor ?? null,
    l.valorCliente ?? null,
    l.valorProfissional ?? null,
    l.taxaClyon ?? null,
    corta(l.servicoTipo, 60),
    corta(l.zona, 120),
    l.visivelCliente ? 1 : 0,
    l.visivelProfissional ? 1 : 0,
  ];
}

function sqlDeInsercao(): string {
  return (
    `INSERT INTO registoPermanente (${COLUNAS_DO_REGISTO.join(", ")}) ` +
    `VALUES (${COLUNAS_DO_REGISTO.map(() => "?").join(", ")})`
  );
}

/**
 * Escreve uma linha no registo. Lança se falhar.
 *
 * Usar esta quando a linha É o trabalho — apagar um pedido, pagar um
 * levantamento. Se o registo não conseguir ser escrito, a operação não deve
 * seguir: um pedido apagado sem rasto é precisamente o que esta tabela existe
 * para impedir.
 */
export async function registar(linha: LinhaDoRegisto): Promise<void> {
  await ensureRegistoTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(sqlDeInsercao(), valoresDoRegisto(linha));
}

/**
 * Escreve uma linha e engole o erro.
 *
 * Usar esta quando a linha é o ACOMPANHAMENTO de outra coisa que já aconteceu
 * — o cliente propôs, o profissional aceitou. A proposta já está gravada na
 * negociação; falhar a escrever a nota sobre ela não pode desfazer-lhe o
 * trabalho nem devolver-lhe um erro.
 *
 * A diferença entre as duas não é de estilo. É a pergunta "se isto falhar,
 * perde-se alguma coisa que não exista em mais lado nenhum?".
 */
export async function registarSemFalhar(linha: LinhaDoRegisto): Promise<void> {
  try {
    await registar(linha);
  } catch (err) {
    console.error("[registo] não gravou:", linha.acontecimento, err);
  }
}

/**
 * Escreve dentro de uma transacção que já está aberta.
 *
 * Existe por causa do apagar. `deleteSimulatorOrder` apaga as negociações e o
 * pedido dentro de uma transacção; se o registo fosse escrito fora dela, uma
 * falha a meio deixava história de um pedido que continuou a existir, ou um
 * pedido apagado sem história. As duas coisas ou acontecem juntas ou não
 * acontecem.
 */
export async function registarNaTransaccao(
  conn: mysql.PoolConnection,
  linha: LinhaDoRegisto,
): Promise<void> {
  await conn.execute(sqlDeInsercao(), valoresDoRegisto(linha));
}

/**
 * Uma etiqueta curta e aleatória para agrupar as linhas de quem foi apagado.
 *
 * Sem isto, anonimizar transformava a história de uma pessoa num monte de
 * linhas soltas: a contabilidade continuava a bater no total, mas deixava de
 * haver forma de ver que aqueles seis movimentos foram do mesmo cliente. Com
 * a etiqueta, a sequência mantém-se legível e continua a não existir caminho
 * nenhum de volta ao nome — porque nenhum é guardado.
 */
function etiquetaAnonima(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 12; i++) {
    s += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  }
  return s;
}

/**
 * Tira a pessoa do registo e deixa a contabilidade de pé.
 *
 * É o ÚNICO UPDATE que esta tabela admite. Tudo o resto é inserir e ler — uma
 * tabela de história que se pode editar não é história nenhuma.
 *
 * Depois disto, a linha continua a dizer que no dia 12 de Junho houve um
 * trabalho de recolha de móveis em Lisboa, fechado por 340 €, dos quais a
 * CLYON reteve 34. Deixa de dizer de quem.
 */
export async function anonimizarRegisto(
  alvo: { clienteEmail?: string; providerId?: number },
  motivo: "conta_cliente" | "conta_profissional" | "pedido_do_titular",
): Promise<number> {
  await ensureRegistoTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");

  const onde: string[] = [];
  const args: unknown[] = [];
  if (alvo.clienteEmail) {
    onde.push("clienteEmail = ?");
    args.push(alvo.clienteEmail.trim().toLowerCase());
  }
  if (alvo.providerId != null) {
    onde.push("providerId = ?");
    args.push(alvo.providerId);
  }
  // Sem alvo não se anonimiza a tabela inteira. Um engano aqui não tem volta.
  if (onde.length === 0) return 0;

  const [r] = (await pool.execute(
    `UPDATE registoPermanente
        SET clienteEmail = NULL,
            clienteNome = NULL,
            providerNome = NULL,
            autorNome = NULL,
            resumo = NULL,
            detalheJson = NULL,
            anonimizadoEm = NOW(),
            anonimizadoMotivo = ?,
            sujeitoAnonimo = COALESCE(sujeitoAnonimo, ?)
      WHERE (${onde.join(" OR ")}) AND anonimizadoEm IS NULL`,
    [motivo, etiquetaAnonima(), ...args],
  )) as any[];

  return Number(r?.affectedRows ?? 0);
}

export type LinhaLidaDoRegisto = {
  id: number;
  acontecimento: string;
  ocorridoEm: Date;
  pedidoId: number | null;
  negociacaoId: number | null;
  providerId: number | null;
  clienteEmail: string | null;
  clienteNome: string | null;
  providerNome: string | null;
  autorTipo: string | null;
  autorNome: string | null;
  resumo: string | null;
  detalheJson: string | null;
  estadoAntes: string | null;
  estadoDepois: string | null;
  valor: string | null;
  valorCliente: string | null;
  valorProfissional: string | null;
  taxaClyon: string | null;
  servicoTipo: string | null;
  zona: string | null;
  anonimizadoEm: Date | null;
};

/** O histórico de um cliente, para o painel dele. */
export async function registoDoCliente(
  email: string,
  limite = 200,
): Promise<LinhaLidaDoRegisto[]> {
  await ensureRegistoTable();
  const pool = await getPool();
  if (!pool) return [];
  const [rows] = (await pool.execute(
    `SELECT * FROM registoPermanente
      WHERE clienteEmail = ? AND visivelCliente = 1 AND anonimizadoEm IS NULL
      ORDER BY ocorridoEm DESC
      LIMIT ?`,
    [email.trim().toLowerCase(), String(limite)],
  )) as any[];
  return rows as LinhaLidaDoRegisto[];
}

/** O histórico de um profissional, para o painel dele. */
export async function registoDoProfissional(
  providerId: number,
  limite = 200,
): Promise<LinhaLidaDoRegisto[]> {
  await ensureRegistoTable();
  const pool = await getPool();
  if (!pool) return [];
  const [rows] = (await pool.execute(
    `SELECT * FROM registoPermanente
      WHERE providerId = ? AND visivelProfissional = 1 AND anonimizadoEm IS NULL
      ORDER BY ocorridoEm DESC
      LIMIT ?`,
    [providerId, String(limite)],
  )) as any[];
  return rows as LinhaLidaDoRegisto[];
}

/**
 * O registo inteiro, para o backoffice.
 *
 * É o único sítio que vê tudo: as linhas invisíveis aos dois lados (notas
 * internas, quem editou o quê, quem apagou o quê) e as já anonimizadas.
 */
export async function registoParaOBackoffice(filtros: {
  pedidoId?: number;
  providerId?: number;
  clienteEmail?: string;
  acontecimento?: string;
  limite?: number;
} = {}): Promise<LinhaLidaDoRegisto[]> {
  await ensureRegistoTable();
  const pool = await getPool();
  if (!pool) return [];

  const onde: string[] = [];
  const args: unknown[] = [];
  if (filtros.pedidoId != null) {
    onde.push("pedidoId = ?");
    args.push(filtros.pedidoId);
  }
  if (filtros.providerId != null) {
    onde.push("providerId = ?");
    args.push(filtros.providerId);
  }
  if (filtros.clienteEmail) {
    onde.push("clienteEmail = ?");
    args.push(filtros.clienteEmail.trim().toLowerCase());
  }
  if (filtros.acontecimento) {
    onde.push("acontecimento = ?");
    args.push(filtros.acontecimento);
  }

  const [rows] = (await pool.execute(
    `SELECT * FROM registoPermanente
      ${onde.length ? `WHERE ${onde.join(" AND ")}` : ""}
      ORDER BY ocorridoEm DESC
      LIMIT ?`,
    [...args, String(filtros.limite ?? 300)],
  )) as any[];
  return rows as LinhaLidaDoRegisto[];
}

// ─── Registo permanente END ──────────────────────────────────────────────────

/**
 * Apagar a conta de um profissional.
 *
 * PORQUE É QUE SÓ DEPOIS DE SUSPENDER
 *
 * Suspender é o que trava a distribuição. Apagar directamente alguém activo
 * deixava a porta aberta a um pedido novo chegar-lhe a meio do apagar — uma
 * negociação criada para uma conta que está a desaparecer, e ninguém a
 * responder do outro lado.
 *
 * Suspender primeiro torna isso impossível, e dá o passo atrás que uma acção
 * sem volta merece ter.
 *
 * O QUE IMPEDE O APAGAR
 *
 * Dinheiro por pagar, transferências por processar e trabalhos a decorrer. Um
 * profissional a quem se deve não deixa de existir por lhe apagarmos a linha
 * na tabela — a dívida fica, sem nome nem IBAN para a pagar.
 *
 * A CARTEIRA É LIDA SEM PASSAR POR `negociacoesDoProfissional`
 *
 * Essa função faz `JOIN simulatorOrders`, e é INNER: uma negociação cujo
 * pedido já foi apagado desaparece dela — e da carteira que dela se calcula.
 * Como os pedidos são expurgados aos 60 dias, um profissional com dinheiro por
 * levantar de um trabalho antigo apareceria aqui a não dever nada, e a conta
 * dele seria apagada com o saldo lá dentro.
 *
 * As negociações são lidas cruas, direitas à tabela. O cálculo é o mesmo
 * `carteiraDe` que ele vê no ecrã dele — se fosse reescrito em SQL, mais cedo
 * ou mais tarde os dois números discordavam, e o que decide apagar uma conta
 * não pode ser o que está errado.
 *
 * DOIS MODOS, CONFORME HAJA PASSADO
 *
 *   · sem história nenhuma — a linha sai mesmo da tabela. Nada lhe aponta;
 *   · com história — a linha fica, vazia de tudo o que é pessoal.
 *
 * O segundo não é meia medida. Um trabalho feito em Julho continua a existir
 * para o CLIENTE que o pagou, e as negociações apontam a esta linha por número.
 * Removê-la fazia desaparecer o trabalho do histórico de quem não pediu nada —
 * e a aritmética da carteira dele passava a somar sobre linhas órfãs.
 *
 * O registo permanente nunca se apaga: fica anonimizado, pela mesma regra que
 * já vale para as contas de cliente.
 */
export class ContaComPendencias extends Error {
  constructor(readonly motivos: string[]) {
    super(`Não é possível apagar esta conta: ${motivos.join("; ")}.`);
    this.name = "ContaComPendencias";
  }
}

export type ApagarProfissionalResultado = {
  modo: "removido" | "anonimizado";
  nome: string;
  /** Quantas negociações ficaram a apontar à linha anonimizada. */
  negociacoes: number;
  /** Linhas do registo permanente que perderam o nome. */
  registosAnonimizados: number;
};

export async function apagarProfissional(
  providerId: number,
  quem: string,
): Promise<ApagarProfissionalResultado> {
  await ensureProvidersSchema();
  await ensureLevantamentosTable();
  await ensureRegistoTable();
  /*
   * A pushSubscriptions só nasce quando alguém activa notificações — em
   * produção nunca ninguém activou, a tabela não existia, e o DELETE dela
   * estoirava a transacção inteira: "Erro ao apagar a conta" por causa de
   * uma tabela de avisos vazia. Garante-se antes, como as outras.
   */
  await ensurePushSubscriptionsTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // `FOR UPDATE` para que nada mude entre a verificação e o apagar.
    const [pLinhas] = (await conn.execute(
      "SELECT id, name, email, estado FROM providers WHERE id = ? LIMIT 1 FOR UPDATE",
      [providerId],
    )) as any[];
    const p = (
      pLinhas as Array<{ id: number; name: string; email: string | null; estado: string | null }>
    )[0];
    if (!p) {
      await conn.rollback();
      throw new ContaComPendencias(["a conta já não existe"]);
    }
    if (p.estado !== "suspenso") {
      await conn.rollback();
      throw new ContaComPendencias(["a conta tem de estar suspensa primeiro"]);
    }

    // Negociações cruas — sem passar pelos pedidos, que podem já ter sido
    // expurgados sem que isso apague o dinheiro que geraram.
    const [nLinhas] = (await conn.execute(
      `SELECT id, estado, valorAcordado, execucaoEnviadaEm, confirmadoEm, pagoEm
         FROM negociacoes WHERE providerId = ?`,
      [providerId],
    )) as any[];
    const negociacoes = nLinhas as Array<{
      id: number;
      estado: string;
      valorAcordado: string | number | null;
      execucaoEnviadaEm: Date | null;
      confirmadoEm: Date | null;
      pagoEm: Date | null;
    }>;

    const [lLinhas] = (await conn.execute(
      "SELECT id, valor, estado FROM levantamentos WHERE providerId = ?",
      [providerId],
    )) as any[];
    const levantamentos = (
      lLinhas as Array<{ id: number; valor: string | number; estado: string }>
    ).map((l) => ({
      id: l.id,
      valor: Number(l.valor),
      estado: l.estado as "pedido" | "pago" | "recusado",
    }));

    const motivos: string[] = [];

    const aDecorrer = negociacoes.filter((n) => n.estado === "acordada" && n.confirmadoEm == null);
    if (aDecorrer.length > 0) {
      motivos.push(
        aDecorrer.length === 1
          ? "há um trabalho contratado por confirmar"
          : `há ${aDecorrer.length} trabalhos contratados por confirmar`,
      );
    }

    const carteira = carteiraDe(
      negociacoes.map((n) => ({
        negociacaoId: n.id,
        estado: n.estado,
        valorAcordado: n.valorAcordado != null ? Number(n.valorAcordado) : null,
        execucaoEnviadaEm: n.execucaoEnviadaEm,
        confirmadoEm: n.confirmadoEm,
        pagoEm: n.pagoEm,
      })) as never,
      levantamentos,
      new Date(),
    );

    const euros = (n: number) => n.toFixed(2).replace(".", ",");
    if (carteira.cativo > 0) motivos.push(`tem ${euros(carteira.cativo)} € cativos`);
    if (carteira.disponivel > 0) motivos.push(`tem ${euros(carteira.disponivel)} € por levantar`);
    if (carteira.aCaminho > 0)
      motivos.push(`tem ${euros(carteira.aCaminho)} € em transferência por processar`);

    if (motivos.length > 0) {
      await conn.rollback();
      throw new ContaComPendencias(motivos);
    }

    // Há passado? Então a linha fica — as negociações apontam-lhe por número, e
    // o cliente que o contratou continua a ter direito ao histórico dele.
    const [oLinhas] = (await conn.execute(
      "SELECT COUNT(*) AS n FROM simulatorOrders WHERE providerId = ?",
      [providerId],
    )) as any[];
    const pedidosAtribuidos = Number((oLinhas as Array<{ n: number }>)[0]?.n ?? 0);
    const temPassado = negociacoes.length > 0 || levantamentos.length > 0 || pedidosAtribuidos > 0;

    await registarNaTransaccao(conn, {
      acontecimento: "conta_apagada",
      providerId,
      providerNome: p.name,
      autorTipo: "clyon",
      autorNome: quem,
      estadoAntes: "suspenso",
      estadoDepois: temPassado ? "anonimizada" : "removida",
      resumo: `Conta de profissional apagada por ${quem}`,
    });

    if (temPassado) {
      /*
       * Tudo o que identifica a pessoa sai. O que fica é um número e uma
       * etiqueta, para as negociações antigas terem a que se agarrar.
       *
       * `slug` também é limpo — é único na tabela, e um slug com o nome dele lá
       * dentro sobreviveria a tudo o resto.
       */
      await conn.execute(
        `UPDATE providers
            SET name = 'Profissional removido',
                slug = CONCAT('removido-', id),
                email = NULL, phone = NULL, nif = NULL, city = NULL,
                passwordHash = NULL, iban = NULL, ibanTitular = NULL,
                moradaFiscal = NULL, numeroTransportador = NULL,
                categorias = NULL, zonas = NULL,
                baseLat = NULL, baseLng = NULL,
                isActive = 0, estado = 'apagado'
          WHERE id = ?`,
        [providerId],
      );
    } else {
      await conn.execute("DELETE FROM providers WHERE id = ?", [providerId]);
    }

    // Estas saem nos dois casos: cobertura, convites e avisos não são história
    // de ninguém, e um convite por usar seria uma porta de entrada deixada
    // aberta para uma conta que já não existe.
    await conn.execute("DELETE FROM provider_coverage WHERE providerId = ?", [providerId]);
    await conn.execute("DELETE FROM convitesProfissionais WHERE providerId = ?", [providerId]);
    if (p.email) {
      await conn.execute("DELETE FROM convitesProfissionais WHERE email = ?", [p.email]);
      await conn.execute("DELETE FROM pushSubscriptions WHERE userEmail = ?", [p.email]);
    }

    await conn.commit();

    const registosAnonimizados = await anonimizarRegisto({ providerId }, "conta_profissional");

    return {
      modo: temPassado ? "anonimizado" : "removido",
      nome: p.name,
      negociacoes: negociacoes.length,
      registosAnonimizados,
    };
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
      /* já houve rollback ou commit */
    }
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * Apagar a conta de um cliente.
 *
 * O QUE ESTAVA AQUI ANTES, E PORQUE É QUE NÃO CHEGAVA
 *
 * O ecrã dizia "Os pedidos existentes ficam anonimizados". Não ficavam. O
 * apagar limpava a linha em `users` e mais nada — o nome, o telefone, o email,
 * a morada completa e as fotografias da casa continuavam em `simulatorOrders`,
 * exactamente onde estavam. A promessa era do ecrã; o código não a cumpria.
 *
 * Não havia guarda nenhum: um cliente com um trabalho contratado por confirmar
 * podia apagar-se a meio, e o profissional ficava a trabalhar para ninguém,
 * com o dinheiro preso entre os dois.
 *
 * E o email ficava na linha. `getOrCreateUser` procura `WHERE email = ? AND
 * deletedAt IS NULL`: quem apagasse a conta e voltasse a entrar com o Google
 * apanhava um erro, porque a linha existia para o INSERT e não existia para o
 * SELECT. Baralhar o email resolve as duas coisas de uma vez.
 *
 * O QUE FICA, E PORQUÊ
 *
 * O tipo de serviço, a cidade, o valor e a data ficam. Não identificam
 * ninguém, e são o registo de trabalho do PROFISSIONAL que o executou — o
 * direito ao apagamento de um não apaga a vida profissional do outro.
 *
 * Sai tudo o resto: nome, telefone, email, morada exacta, a descrição escrita
 * à mão (que pode dizer qualquer coisa), as conversas, o histórico e as
 * fotografias. E o token de acesso, para o link do pedido deixar de abrir.
 *
 * As fotografias não se apagam aqui: os URLs saem para quem chamou, que as
 * remove do Blob depois da transacção fechar. Uma chamada de rede a meio de
 * uma transacção prende a linha na base de dados enquanto se espera pela
 * internet.
 */
export type ApagarContaDeClienteResultado = {
  pedidos: number;
  registosAnonimizados: number;
  /** URLs das fotografias, para quem chamou as remover do Blob. */
  fotos: string[];
};

export async function apagarContaDeCliente(
  email: string,
  quem: string,
): Promise<ApagarContaDeClienteResultado> {
  await ensureUsersSchema();
  await ensureRegistoTable();
  // O mesmo remedio do apagarProfissional: sem isto, o DELETE da
  // pushSubscriptions estoirava numa base onde ninguem activou avisos.
  await ensurePushSubscriptionsTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");

  const alvo = email.trim().toLowerCase();
  if (!alvo) throw new ContaComPendencias(["falta o email da conta"]);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [oLinhas] = (await conn.execute(
      "SELECT id, filesJson FROM simulatorOrders WHERE LOWER(contactEmail) = ? FOR UPDATE",
      [alvo],
    )) as any[];
    const pedidos = oLinhas as Array<{ id: number; filesJson: string | null }>;

    /*
     * Trabalhos por fechar.
     *
     * `acordada` sem `confirmadoEm` quer dizer que alguém está a trabalhar e
     * que há dinheiro cativo. Apagar o cliente aqui deixava o profissional sem
     * a quem entregar e sem a quem cobrar.
     */
    if (pedidos.length > 0) {
      const ids = pedidos.map((p) => p.id);
      const [nLinhas] = (await conn.execute(
        `SELECT COUNT(*) AS n FROM negociacoes
          WHERE pedidoId IN (${ids.map(() => "?").join(",")})
            AND estado = 'acordada' AND confirmadoEm IS NULL`,
        ids,
      )) as any[];
      const aDecorrer = Number((nLinhas as Array<{ n: number }>)[0]?.n ?? 0);
      if (aDecorrer > 0) {
        await conn.rollback();
        throw new ContaComPendencias([
          aDecorrer === 1
            ? "tem um trabalho contratado por confirmar"
            : `tem ${aDecorrer} trabalhos contratados por confirmar`,
        ]);
      }
    }

    // As fotografias, antes de a coluna ser limpa.
    const fotos: string[] = [];
    for (const p of pedidos) {
      if (!p.filesJson) continue;
      try {
        const lista = JSON.parse(p.filesJson);
        if (Array.isArray(lista)) {
          for (const f of lista) {
            if (f && typeof f.url === "string") fotos.push(f.url);
          }
        }
      } catch {
        /* JSON estragado — não há URLs a salvar dele */
      }
    }

    if (pedidos.length > 0) {
      await conn.execute(
        `UPDATE simulatorOrders
            SET contactName = NULL, contactPhone = NULL, contactEmail = NULL,
                address = NULL, floor = NULL,
                description = NULL, filesJson = NULL,
                rawOrderJson = NULL, chatJson = NULL, historyJson = NULL,
                acessoTokenHash = NULL, acessoTokenExpiraEm = NULL
          WHERE LOWER(contactEmail) = ?`,
        [alvo],
      );
    }

    await registarNaTransaccao(conn, {
      acontecimento: "conta_apagada",
      clienteEmail: alvo,
      autorTipo: "cliente",
      autorNome: quem,
      estadoDepois: "anonimizada",
      resumo: `Conta de cliente apagada a pedido do titular (${pedidos.length} pedido(s))`,
    });

    /*
     * O email é baralhado, e não só apagado.
     *
     * É a chave única da tabela. Deixá-lo lá com `deletedAt` preenchido fazia
     * com que voltar a entrar com o Google desse erro — o INSERT via a linha,
     * o SELECT seguinte não. Assim a pessoa pode voltar, e volta como conta
     * nova, que é o que apagar a conta quer dizer.
     */
    await conn.execute(
      `UPDATE users
          SET name = 'Utilizador eliminado',
              email = CONCAT('apagado-', id, '@removido.invalid'),
              phone = NULL, addressLine = NULL, addressNumber = NULL,
              postalCode = NULL, addressCity = NULL, nif = NULL,
              billingName = NULL, billingNif = NULL, billingAddress = NULL,
              billingPostalCode = NULL, billingCity = NULL,
              avatarUrl = NULL, openId = NULL,
              deletedAt = NOW(), updatedAt = NOW()
        WHERE email = ?`,
      [alvo],
    );

    await conn.execute("DELETE FROM pushSubscriptions WHERE userEmail = ?", [alvo]);

    await conn.commit();

    const registosAnonimizados = await anonimizarRegisto({ clienteEmail: alvo }, "conta_cliente");

    return { pedidos: pedidos.length, registosAnonimizados, fotos };
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
      /* já houve rollback ou commit */
    }
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * Apagar fotografias do Blob, uma a uma e sem estoirar.
 *
 * Uma que falhe não pode levar as outras atrás: o que falta apagar continua a
 * ser dados pessoais de alguém que pediu para os ver apagados, e desistir ao
 * primeiro erro deixava o resto lá.
 *
 * Devolve quantas saíram, para quem chamou poder registar a diferença.
 */
export async function apagarFotosDoBlob(urls: string[]): Promise<number> {
  if (urls.length === 0) return 0;
  let apagadas = 0;
  const { del } = await import("@vercel/blob");
  for (const url of urls) {
    try {
      await del(url);
      apagadas += 1;
    } catch (e) {
      console.error("[apagarFotosDoBlob] falhou", url, e);
    }
  }
  return apagadas;
}
