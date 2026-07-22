import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, tinyint } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Tabela de colaboradores
export const colaboradores = mysqlTable('colaboradores', {
  id: int('id').autoincrement().primaryKey(),
  nome: varchar('nome', { length: 100 }).notNull().unique(),
  senha: text('senha').notNull(),
  funcao: mysqlEnum('funcao', ['motorista', 'ajudante', 'admin', 'assistente']).notNull(),
  valorHora: decimal('valorHora', { precision: 6, scale: 2 }).default('0.00'), // null para assistentes
  valorDiaria: decimal('valorDiaria', { precision: 6, scale: 2 }), // opcional para motoristas/ajudantes
  isAdmin: int('isAdmin').notNull().default(0),
  // Modelo de pagamento
  paymentModel: mysqlEnum('paymentModel', ['hourly', 'daily', 'commission', 'none']).default('hourly'),
  // Campos de comissão (para assistentes)
  commissionType: mysqlEnum('commissionType', ['profit_percent', 'gross_percent', 'fixed_per_closed_request', 'none']),
  commissionPercent: decimal('commissionPercent', { precision: 5, scale: 2 }),
  commissionFixedAmount: decimal('commissionFixedAmount', { precision: 8, scale: 2 }),
  commissionNotes: text('commissionNotes'),
  // Flags operacionais
  canReceiveSimulatorRequests: tinyint('canReceiveSimulatorRequests').default(1),
  participatesInTimeTracking: tinyint('participatesInTimeTracking').default(1),
  active: tinyint('active').notNull().default(1),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export const simulatorSettings = mysqlTable("simulatorSettings", {
  key: varchar("key", { length: 120 }).primaryKey(),
  label: varchar("label", { length: 160 }).notNull(),
  category: varchar("category", { length: 40 }).notNull(),
  unit: varchar("unit", { length: 24 }).notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const galleryMedia = mysqlTable("galleryMedia", {
  id: varchar("id", { length: 120 }).primaryKey(),
  section: varchar("section", { length: 32 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  subtitle: text("subtitle"),
  description: text("description"),
  alt: varchar("alt", { length: 220 }).notNull(),
  imageUrl: text("imageUrl").notNull(),
  order: int("order").notNull().default(1),
  isActive: int("isActive").notNull().default(1),
  projectKey: varchar("projectKey", { length: 160 }),
  phase: varchar("phase", { length: 24 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Colaborador = typeof colaboradores.$inferSelect;
export type InsertColaborador = typeof colaboradores.$inferInsert;
export type SimulatorSetting = typeof simulatorSettings.$inferSelect;
export type InsertSimulatorSetting = typeof simulatorSettings.$inferInsert;
export type GalleryMedia = typeof galleryMedia.$inferSelect;
export type InsertGalleryMedia = typeof galleryMedia.$inferInsert;

// ─── Trabalhos Realizados ─────────────────────────────────────────────────────

export const trabalhosRealizados = mysqlTable("trabalhos_realizados", {
  id:           int("id").autoincrement().primaryKey(),
  fotosJson:    text("fotosJson").notNull(),          // JSON array de URLs
  tipoServico:  varchar("tipoServico", { length: 64 }).notNull(),
  localidade:   varchar("localidade", { length: 120 }).notNull(),
  descricao:    text("descricao"),
  publicado:    tinyint("publicado").notNull().default(0),
  createdAt:    timestamp("createdAt").defaultNow().notNull(),
  updatedAt:    timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TrabalhoRealizado    = typeof trabalhosRealizados.$inferSelect;
export type InsertTrabalhoRealizado = typeof trabalhosRealizados.$inferInsert;

export interface TrabalhoRealizadoData {
  id:          number;
  fotos:       string[];
  tipoServico: string;
  localidade:  string;
  descricao:   string | null;
  publicado:   boolean;
  createdAt:   Date;
  updatedAt:   Date;
}

// ─── SimulatorOrders (gerido com raw SQL — só os tipos aqui) ─────────────────

export type OrderStatus =
  | "pendente"
  | "sem_assistente"
  | "atribuido"
  | "em_analise"
  | "precisa_info"
  | "estimativa_pronta"
  | "presencial_recomendado"
  | "aprovado"
  | "enviado_cliente"
  | "confirmado"
  | "em_execucao"
  | "concluido"
  | "cancelado"
  | "rejeitado";

export type OrderPriority = "baixa" | "normal" | "alta" | "urgente";

export interface OrderHistoryEntry {
  type: string;
  by?: { id: number; nome: string; role: string } | null;
  message: string;
  createdAt: string;
}

export interface SimulatorOrder {
  id: number;
  serviceType?: string | null;
  description?: string | null;
  filesJson?: string | null;
  address?: string | null;
  city?: string | null;
  floor?: string | null;
  hasElevator?: string | null;
  parkingDistance?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  urgency?: string | null;
  estimateMin?: string | null;
  estimateMax?: string | null;
  estimateTotal?: string | null;
  estimateJson?: string | null;
  distanceKm?: string | null;
  distanceText?: string | null;
  status: OrderStatus;
  priority?: OrderPriority | null;
  notasInternas?: string | null;
  precoFinal?: string | null;
  precoFinalIva?: string | null;
  mensagemCliente?: string | null;
  assignedToId?: number | null;
  assignedToName?: string | null;
  assignedAt?: Date | null;
  chatJson?: string | null;
  historyJson?: string | null;
  reviewJson?: string | null;
  colaboradorId?: number | null;
  dataAgendada?: Date | null;
  viewedAt?: Date | null;
  /** Full raw form data JSON — stores originAddress, destinationAddress, originAccess, destinationAccess, movingDistance, etc. */
  rawOrderJson?: string | null;
  /** Timestamp when an assistant accepted this order from the general queue */
  acceptedAt?: Date | null;
  /** Empresa parceira que aceitou este pedido no portal do parceiro (null = ainda disponível) */
  providerId?: number | null;
  /** Momento em que o parceiro aceitou o pedido */
  providerAcceptedAt?: Date | null;
  /** Frequência de marcação recorrente escolhida pelo cliente ('semanal' | 'quinzenal' | null = pontual) */
  recurrenceFrequency?: string | null;
  /** Percentagem de desconto aplicada por ser recorrente (ex: 15.00) */
  recurringDiscountPercent?: string | null;
  /** Avaliação do cliente (1-5) após o pedido concluído */
  clientRating?: number | null;
  /** Comentário opcional da avaliação do cliente */
  clientRatingComment?: string | null;
  /** Scheduled service date (YYYY-MM-DD) */
  scheduledDate?: string | null;
  /** Scheduled start time (HH:MM) */
  scheduledStartTime?: string | null;
  /** Scheduled end time (HH:MM) */
  scheduledEndTime?: string | null;
  /** Google Calendar event ID once created */
  calendarEventId?: string | null;
  /** Google Calendar event URL */
  calendarEventUrl?: string | null;
  /** Calendar scheduling status */
  calendarStatus?: "not_scheduled" | "scheduled" | "updated" | null;
  /** Notes included in the calendar event */
  calendarNotes?: string | null;
  /**
   * Extended analysis JSON — stores clyonEstimate, externalMarketEstimate,
   * analysisSource, confidence, and pricingRulesSnapshot.
   * Serialised as JSON string in the DB column analysisJsonExtended.
   * ONLY for backoffice use — never sent to the client.
   */
  analysisJsonExtended?: string | null;
  /** Google Calendar ID of the target calendar (e.g. CLYON org calendar). Stored from CLYON_GOOGLE_CALENDAR_ID env var at scheduling time. */
  calendarTargetId?: string | null;
  /** Human-readable name of the target calendar (e.g. "CLYON — Agenda da Empresa"). From CLYON_GOOGLE_CALENDAR_NAME env var. */
  calendarTargetName?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Providers (gerido com raw SQL — só os tipos aqui) ───────────────────────
// Empresas parceiras do marketplace. Ver ensureProvidersSchema() em src/lib/db.ts.

export interface Provider {
  id: number;
  name: string;
  slug: string;
  phone: string | null;
  email: string | null;
  nif: string | null;
  city: string | null;
  isClyon: boolean;
  isActive: boolean;
  commissionRate: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InsertProvider {
  name: string;
  slug: string;
  phone?: string | null;
  email?: string | null;
  nif?: string | null;
  city?: string | null;
  isClyon?: boolean;
  isActive?: boolean;
  commissionRate?: string;
}

export interface ProviderCoverage {
  id: number;
  providerId: number;
  zone: string;
  isActive: boolean;
  createdAt: Date;
}

export interface InsertProviderCoverage {
  providerId: number;
  zone: string;
  isActive?: boolean;
}

export interface InsertSimulatorOrder {
  serviceType?: string | null;
  description?: string | null;
  filesJson?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  floor?: string | null;
  hasElevator?: string | null;
  parkingDistance?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  urgency?: string | null;
  estimateMin?: string | null;
  estimateMax?: string | null;
  estimateTotal?: string | null;
  estimateJson?: string | null;
  distanceKm?: string | null;
  distanceText?: string | null;
  status?: OrderStatus;
  priority?: OrderPriority | null;
  notasInternas?: string | null;
  precoFinal?: string | null;
  precoFinalIva?: string | null;
  mensagemCliente?: string | null;
  assignedToId?: number | null;
  assignedToName?: string | null;
  assignedAt?: Date | null;
  chatJson?: string | null;
  historyJson?: string | null;
  reviewJson?: string | null;
  colaboradorId?: number | null;
  dataAgendada?: Date | null;
  rawOrderJson?: string | null;
  acceptedAt?: Date | null;
  providerId?: number | null;
  providerAcceptedAt?: Date | null;
  recurrenceFrequency?: string | null;
  recurringDiscountPercent?: string | null;
  clientRating?: number | null;
  clientRatingComment?: string | null;
  scheduledDate?: string | null;
  scheduledStartTime?: string | null;
  scheduledEndTime?: string | null;
  calendarEventId?: string | null;
  calendarEventUrl?: string | null;
  calendarStatus?: string | null;
  calendarNotes?: string | null;
  analysisJsonExtended?: string | null;
  calendarTargetId?: string | null;
  calendarTargetName?: string | null;
}
