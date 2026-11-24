/**
 * O INTERRUPTOR «A APP NO AVISO DE PROPOSTAS» — 24-11-2026 (d106, secção 0
 * da v3 da d107, aprovada pelo dono).
 *
 * Ligado, o email «Tem uma proposta» leva, UMA vez por pessoa, a linha da app
 * (com a ligação NOSSA dela e a recusa em letra pequena) — a quem não recebeu
 * o convite ou o lembrete de 17/11, não abriu a app e não está no «não
 * contactar» nem recusou as mensagens sobre a app.
 *
 * DESLIGADO POR OMISSÃO (CEO e dono): sem linha, sem tabela, ou com a base a
 * falhar. Só o administrador o muda, nas Configs; para ligar escreve LIGAR.
 * Guarda-se em `plataformaConfiguracoes` (o mesmo sítio do link de adesão).
 */

import type { Pool } from "mysql2/promise";
import { getPool } from "./db";
import { CHAVE_DA_LINHA_DA_APP } from "./linha-da-app-nas-propostas";

export type InterruptorDaLinhaDaApp = { ligado: boolean; mudadoEm: string | null; porQuem: string | null };

let pronta = false;

async function base(): Promise<Pool> {
  const p = (await getPool()) as Pool | null;
  if (!p) throw new Error("[linha-da-app] base de dados indisponível");
  if (!pronta) {
    // A mesma definição de `db.ts` — CREATE IF NOT EXISTS não mexe na que já existe.
    await p.execute(`
      CREATE TABLE IF NOT EXISTS plataformaConfiguracoes (
        chave         VARCHAR(60) NOT NULL PRIMARY KEY,
        valor         TEXT NOT NULL,
        actualizadoEm DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        porQuem       VARCHAR(120) NULL DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    pronta = true;
  }
  return p;
}

/** DESLIGADO NA DÚVIDA. */
export async function interruptorDaLinhaDaApp(): Promise<InterruptorDaLinhaDaApp> {
  const desligado: InterruptorDaLinhaDaApp = { ligado: false, mudadoEm: null, porQuem: null };
  try {
    const p = await base();
    const [rows] = (await p.execute(
      "SELECT valor, actualizadoEm, porQuem FROM plataformaConfiguracoes WHERE chave = ? LIMIT 1",
      [CHAVE_DA_LINHA_DA_APP],
    )) as [Array<{ valor: string; actualizadoEm: Date | string | null; porQuem: string | null }>, unknown];
    const l = rows[0];
    if (!l) return desligado;
    return {
      ligado: String(l.valor).trim() === "1",
      mudadoEm: l.actualizadoEm ? new Date(l.actualizadoEm).toISOString() : null,
      porQuem: l.porQuem ?? null,
    };
  } catch (e) {
    console.error("[linha-da-app] não li o interruptor — fica desligado:", e instanceof Error ? e.message : e);
    return desligado;
  }
}

export async function mudarInterruptorDaLinhaDaApp(ligar: boolean, porQuem: string): Promise<InterruptorDaLinhaDaApp> {
  const p = await base();
  await p.execute(
    `INSERT INTO plataformaConfiguracoes (chave, valor, porQuem) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor), porQuem = VALUES(porQuem)`,
    [CHAVE_DA_LINHA_DA_APP, ligar ? "1" : "0", porQuem.slice(0, 120)],
  );
  return interruptorDaLinhaDaApp();
}

/**
 * A linha para ESTE aviso de propostas, ou `null`: o interruptor desligado,
 * quem já teve o convite de 17/11 ou a app, quem não se contacta, ou quem já
 * recebeu a linha. Reserva antes de devolver (uma vez por pessoa). Nunca lança.
 */
export async function linhaDaAppParaEsteAviso(email: string): Promise<{ link: string } | null> {
  try {
    if (!(await interruptorDaLinhaDaApp()).ligado) return null;
    const { jaTeveOConviteOuAApp, linkNossoDoConvite, reservarLinhaDasPropostas } = await import(
      "./percurso-da-app-cliente-na-base"
    );
    const { naoContactarNaApp } = await import("./nao-contactar-na-app");
    if (await naoContactarNaApp({ email })) return null;
    if (await jaTeveOConviteOuAApp(email)) return null;
    const link = await linkNossoDoConvite(email);
    if (!link.includes("?c=")) return null;
    if (!(await reservarLinhaDasPropostas(email))) return null;
    return { link };
  } catch (e) {
    console.error("[linha-da-app] sem a linha neste aviso:", e instanceof Error ? e.message : e);
    return null;
  }
}
