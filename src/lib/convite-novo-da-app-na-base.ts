/**
 * O CONVITE NOVO DA APP DE CLIENTE, NA BASE — 17-11-2026 (d59, parte 2).
 *
 * Três tabelas NOVAS (nada do que existe muda):
 *  - `conviteNovoDaApp` — uma linha por EMAIL que recebeu o convite novo.
 *    A chave primária é o email: um segundo envio à mesma pessoa é recusado
 *    pela própria base, mesmo com dois cliques ao mesmo tempo. `enviadoEm`
 *    NULL = reservado e a sair agora; é desta data que o lembrete conta os 3 dias.
 *  - `whatsappDaAppPorEnviar` — os WhatsApp do convite e do lembrete por
 *    sair, um por email e por tipo (chave primária), lidos pela passagem.
 *  - `whatsappDaAppVez` — o carimbo «o próximo pode sair a partir de…»,
 *    mudado por um UPDATE condicional: só uma passagem ganha a vez.
 *
 * Quem põe o WhatsApp a andar: cada ronda da ponte (`/api/whatsapp/ponte`,
 * com `after`), como o aviso a todos os profissionais. O texto e o telemóvel
 * lêem-se NO MOMENTO de enviar (não ficam copiados aqui).
 *
 * APAGAR A CONTA APAGA ISTO: `apagarSeguimentoNaTransaccao` e
 * `apagarSeguimentoDaConta` (seguimento-da-app-na-base.ts).
 *
 * As datas escrevem-se com UTC_TIMESTAMP() — a base é lida em UTC.
 */

import { getPool } from "./db";
import { dentroDaJanelaDoWhatsApp, intervaloAoAcaso, telemovelDoAviso } from "./aviso-aos-profissionais";
import { LINK_DE_ADESAO_SUGERIDO, primeiroNome } from "./convite-app-cliente";
import {
  contagemDoConviteNovo,
  elegiveisParaOConviteNovo,
  type ElegivelDoConviteNovo,
  type TipoDeWhatsAppDaApp,
} from "./convite-novo-da-app";

let tabelasProntas = false;

export const SQL_DAS_TABELAS_DO_CONVITE_NOVO = [
  `CREATE TABLE IF NOT EXISTS conviteNovoDaApp (
      email       VARCHAR(255) NOT NULL PRIMARY KEY,
      userId      INT UNSIGNED NULL DEFAULT NULL,
      reservadoEm DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      enviadoEm   DATETIME NULL DEFAULT NULL,
      porQuem     VARCHAR(120) NULL DEFAULT NULL,
      KEY idx_convite_novo_user (userId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS whatsappDaAppPorEnviar (
      email     VARCHAR(255) NOT NULL,
      tipo      VARCHAR(12)  NOT NULL,
      estado    VARCHAR(12)  NOT NULL DEFAULT 'pendente',
      motivo    VARCHAR(120) NULL DEFAULT NULL,
      criadoEm  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      enviadoEm DATETIME NULL DEFAULT NULL,
      PRIMARY KEY (email, tipo),
      KEY idx_whatsapp_da_app_estado (estado, criadoEm)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS whatsappDaAppVez (
      id        TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      proximoEm DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

async function garantirTabelas() {
  const pool = await getPool();
  if (!pool) throw new Error("[convite-novo-da-app] base de dados indisponível");
  if (!tabelasProntas) {
    for (const sql of SQL_DAS_TABELAS_DO_CONVITE_NOVO) await pool.execute(sql);
    await pool.execute("INSERT IGNORE INTO whatsappDaAppVez (id, proximoEm) VALUES (1, '2000-01-01 00:00:00')");
    tabelasProntas = true;
  }
  return pool;
}

type Pool = NonNullable<Awaited<ReturnType<typeof getPool>>>;

async function lerSeExistir<T>(pool: Pool, sql: string): Promise<T[]> {
  try {
    const [linhas] = (await pool.query(sql)) as [T[], unknown];
    return linhas;
  } catch (err) {
    if ((err as { code?: string })?.code === "ER_NO_SUCH_TABLE") return [];
    throw err;
  }
}

/* ─── Quem recebe agora ─────────────────────────────────────────────────── */

export type ElegivelComRegisto = ElegivelDoConviteNovo & {
  /** Já tem linha em `convitesAppCliente` (o convite de 01-11). */
  registado: boolean;
};

/** Os elegíveis do convite novo, e quantos emails e WhatsApp vão sair. */
export async function estadoDoConviteNovo(): Promise<{
  elegiveis: ElegivelComRegisto[];
  emails: number;
  whatsapps: number;
  jaReceberam: number;
}> {
  const { estadoDosConvites } = await import("./convite-app-cliente-na-base");
  const estado = await estadoDosConvites();
  const pool = await garantirTabelas();
  const [telefones, avisos, instalou, convitesNovos] = await Promise.all([
    lerSeExistir<{ id: number; phone: string | null }>(pool, "SELECT id, phone FROM users WHERE deletedAt IS NULL"),
    lerSeExistir<{ e: string }>(pool, "SELECT DISTINCT LOWER(TRIM(userEmail)) AS e FROM pushSubscriptions WHERE app = 'cliente'"),
    lerSeExistir<{ e: string }>(pool, "SELECT LOWER(email) AS e FROM seguimentoDaApp WHERE instalouEm IS NOT NULL"),
    lerSeExistir<{ e: string; enviadoEm: unknown }>(pool, "SELECT LOWER(email) AS e, enviadoEm FROM conviteNovoDaApp"),
  ]);
  const aderiram = new Set([...avisos, ...instalou].map((l) => String(l.e)));
  const comConviteNovo = new Set(convitesNovos.map((l) => String(l.e)));
  const lista = elegiveisParaOConviteNovo(
    estado.destinatarios,
    new Map(telefones.map((t) => [Number(t.id), t.phone ?? null])),
    aderiram,
    comConviteNovo,
  );
  const registados = new Map(estado.destinatarios.map((d) => [d.email, d.registado]));
  return {
    elegiveis: lista.map((e) => ({ ...e, registado: registados.get(e.email) ?? false })),
    ...contagemDoConviteNovo(lista),
    jaReceberam: convitesNovos.filter((l) => l.enviadoEm != null).length,
  };
}

/* ─── Reservar, marcar, libertar ────────────────────────────────────────── */

/** Reserva o email ANTES de enviar. `true` = é nosso, pode sair; `false` = já recebeu (ou está a sair). */
export async function reservarConviteNovo(email: string, userId: number, porQuem: string): Promise<boolean> {
  const pool = await garantirTabelas();
  const [r] = (await pool.execute(
    "INSERT IGNORE INTO conviteNovoDaApp (email, userId, porQuem) VALUES (?, ?, ?)",
    [email.trim().toLowerCase(), userId, porQuem.slice(0, 120)],
  )) as [{ affectedRows: number }, unknown];
  return Number(r.affectedRows) === 1;
}

export async function marcarConviteNovoEnviado(email: string): Promise<void> {
  const pool = await garantirTabelas();
  await pool.execute("UPDATE conviteNovoDaApp SET enviadoEm = UTC_TIMESTAMP() WHERE email = ?", [email.trim().toLowerCase()]);
}

/** O email falhou: a reserva sai e a pessoa volta à lista. */
export async function libertarConviteNovo(email: string): Promise<void> {
  const pool = await garantirTabelas();
  await pool.execute("DELETE FROM conviteNovoDaApp WHERE email = ? AND enviadoEm IS NULL", [email.trim().toLowerCase()]);
}

/** Põe o WhatsApp na fila própria (uma vez por email e por tipo). */
export async function porWhatsAppDaAppNaFila(email: string, tipo: TipoDeWhatsAppDaApp): Promise<boolean> {
  const pool = await garantirTabelas();
  const [r] = (await pool.execute("INSERT IGNORE INTO whatsappDaAppPorEnviar (email, tipo) VALUES (?, ?)", [
    email.trim().toLowerCase(),
    tipo,
  ])) as [{ affectedRows: number }, unknown];
  return Number(r.affectedRows) === 1;
}

/** Quantos WhatsApp da app ainda esperam a vez (para o painel). */
export async function whatsappsDaAppPorSair(): Promise<number> {
  const pool = await garantirTabelas();
  const [l] = (await pool.query("SELECT COUNT(*) AS n FROM whatsappDaAppPorEnviar WHERE estado = 'pendente'")) as [
    Array<{ n: number }>,
    unknown,
  ];
  return Number(l[0]?.n ?? 0);
}

/* ─── A passagem: um WhatsApp por vez ───────────────────────────────────── */

export type ResultadoDaPassagemDaApp = "fora-da-janela" | "nada" | "nao-e-a-vez" | "enviado" | "falhou";

/**
 * Uma passagem: se for a vez (20 a 45 s depois da anterior, das 9h às 21h
 * de Lisboa), envia UM WhatsApp da fila. Seguro com passagens ao mesmo tempo:
 * a vez é um UPDATE condicional e cada linha é reservada (pendente → a_enviar)
 * antes de sair. Uma linha reservada que não chega a sair fica «a_enviar» e
 * NÃO volta a sair sozinha: mais vale um a menos do que dois iguais.
 */
export async function passagemDosWhatsAppDaApp(agora: Date = new Date()): Promise<ResultadoDaPassagemDaApp> {
  if (!dentroDaJanelaDoWhatsApp(agora)) return "fora-da-janela";
  const pool = await garantirTabelas();
  const [proximos] = (await pool.query(
    "SELECT email, tipo FROM whatsappDaAppPorEnviar WHERE estado = 'pendente' ORDER BY criadoEm ASC LIMIT 1",
  )) as [Array<{ email: string; tipo: TipoDeWhatsAppDaApp }>, unknown];
  const p = proximos[0];
  if (!p) return "nada";

  const [vez] = (await pool.execute(
    "UPDATE whatsappDaAppVez SET proximoEm = UTC_TIMESTAMP() + INTERVAL ? SECOND WHERE id = 1 AND proximoEm <= UTC_TIMESTAMP()",
    [intervaloAoAcaso()],
  )) as [{ affectedRows: number }, unknown];
  if (Number(vez.affectedRows) !== 1) return "nao-e-a-vez";

  const [reserva] = (await pool.execute(
    "UPDATE whatsappDaAppPorEnviar SET estado = 'a_enviar' WHERE email = ? AND tipo = ? AND estado = 'pendente'",
    [p.email, p.tipo],
  )) as [{ affectedRows: number }, unknown];
  if (Number(reserva.affectedRows) !== 1) return "nada";

  const marcar = async (estado: "enviado" | "falhou", motivo: string | null) => {
    await pool.execute(
      `UPDATE whatsappDaAppPorEnviar SET estado = ?, motivo = ?, enviadoEm = IF(? = 'enviado', UTC_TIMESTAMP(), NULL)
        WHERE email = ? AND tipo = ?`,
      [estado, motivo, estado, p.email, p.tipo],
    );
    return estado;
  };

  try {
    // O contacto e o «já aderiu» lêem-se agora: uma conta apagada ou que já aderiu não recebe.
    const [contas] = (await pool.query(
      `SELECT u.name, u.phone, u.email AS emailDaConta
         FROM conviteNovoDaApp c JOIN users u ON u.id = c.userId AND u.deletedAt IS NULL
        WHERE c.email = ? LIMIT 1`,
      [p.email],
    )) as [Array<{ name: string | null; phone: string | null; emailDaConta: string | null }>, unknown];
    const conta = contas[0];
    if (!conta) return marcar("falhou", "a conta já não existe");
    const telemovel = telemovelDoAviso(conta.phone);
    if (!telemovel) return marcar("falhou", "sem telemóvel português na conta");

    const [aderiu] = (await pool.query(
      `SELECT 1 AS sim FROM pushSubscriptions WHERE app = 'cliente' AND LOWER(TRIM(userEmail)) = ?
        UNION SELECT 1 FROM seguimentoDaApp WHERE email = ? AND instalouEm IS NOT NULL LIMIT 1`,
      [p.email, p.email],
    ).catch(() => [[]])) as [Array<{ sim: number }>, unknown];
    if (aderiu.length > 0) return marcar("falhou", "já aderiu");

    const textos = await import("./textos-do-seguimento-da-app");
    const modelo =
      p.tipo === "convite"
        ? textos.TEXTO_DO_CONVITE_POR_WHATSAPP
        : textos.LEMBRETE_DA_APP_LIGADO && textos.LEMBRETE_DA_APP_POR_WHATSAPP_LIGADO
          ? textos.TEXTO_DO_LEMBRETE_POR_WHATSAPP
          : null;
    if (!modelo) return marcar("falhou", "lembrete por WhatsApp desligado");

    const { linkDeAdesaoGuardado } = await import("./convite-app-cliente-na-base");
    const { preencherTexto } = await import("./seguimento-da-app");
    const link = (await linkDeAdesaoGuardado()) ?? LINK_DE_ADESAO_SUGERIDO;
    const texto = preencherTexto(modelo, { Nome: primeiroNome(conta.name) ?? "", linkDeAdesao: link });

    const { enviarAvisoWhatsApp } = await import("./whatsapp-cloud");
    return (await enviarAvisoWhatsApp(telemovel, texto))
      ? marcar("enviado", null)
      : marcar("falhou", "o WhatsApp não aceitou (número bloqueado ou WhatsApp desligado)");
  } catch (e) {
    console.error("[convite-novo-da-app] WhatsApp:", e instanceof Error ? e.message : e);
    return marcar("falhou", "erro ao enviar");
  }
}

/* ─── Apagar a conta ────────────────────────────────────────────────────── */

type Executor = Pick<import("mysql2/promise").PoolConnection, "execute">;

/** Apaga o convite novo e os WhatsApp por sair destes emails (sem rebentar se as tabelas ainda não existirem). */
export async function apagarConviteNovoDosEmails(conn: Executor, emails: string[]): Promise<void> {
  const limpos = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (limpos.length === 0) return;
  const marcas = limpos.map(() => "?").join(", ");
  for (const tabela of ["whatsappDaAppPorEnviar", "conviteNovoDaApp"]) {
    try {
      await conn.execute(`DELETE FROM ${tabela} WHERE email IN (${marcas})`, limpos);
    } catch (err) {
      if ((err as { code?: string })?.code !== "ER_NO_SUCH_TABLE") throw err;
    }
  }
}

/** O mesmo, pela conta (o DELETE das contas no backoffice). */
export async function apagarConviteNovoDaConta(conn: Executor, userId: number): Promise<void> {
  try {
    await conn.execute(
      "DELETE FROM whatsappDaAppPorEnviar WHERE email IN (SELECT email FROM conviteNovoDaApp WHERE userId = ?)",
      [userId],
    );
    await conn.execute("DELETE FROM conviteNovoDaApp WHERE userId = ?", [userId]);
  } catch (err) {
    if ((err as { code?: string })?.code !== "ER_NO_SUCH_TABLE") throw err;
  }
}
