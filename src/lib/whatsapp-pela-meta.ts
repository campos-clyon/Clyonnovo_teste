import { instanteDaBase } from "./hora-de-lisboa";

/**
 * O INTERRUPTOR «WHATSAPP PELA META» — d5 (CEO e dono, 21-11-2026).
 *
 * Com as quatro variáveis da Cloud API na Vercel, bastava escrever o
 * PHONE_NUMBER_ID para TODAS as mensagens passarem para a Cloud API — que não
 * envia templates: os lembretes fora das 24 h falhariam calados (já havia um
 * erro #133010 nos registos). Agora, mesmo com as quatro variáveis, os envios
 * só passam para a Meta com este interruptor ligado nas Configs. DESLIGADO POR
 * OMISSÃO (e na dúvida: sem linha, sem tabela, base a falhar). Desligado, os
 * envios seguem pela ponte, como hoje. Só o administrador o muda, e cada
 * mudança e quem a fez ficam no registo permanente.
 *
 * Um erro da Meta fica marcado (`registarErroDaMeta`) e o painel mostra-o.
 */

export const CHAVE_DO_WHATSAPP_PELA_META = "whatsapp_pela_meta";
export const NOME_DO_INTERRUPTOR_DA_META = "WhatsApp pela Meta";
/** Quanto tempo se guarda a leitura (as funções são frias e enviar é frequente). */
export const SEGUNDOS_DA_LEITURA = 30;

export type InterruptorDaMeta = { ligado: boolean; mudadoEm: string | null; porQuem: string | null };

let lido: { em: number; ligado: boolean } | null = null;

/** O envio pode ir para a Cloud API? Desligado na dúvida. Com a leitura em memória (30 s). */
export async function enviarPelaMeta(): Promise<boolean> {
  const agora = Date.now();
  if (lido && agora - lido.em < SEGUNDOS_DA_LEITURA * 1000) return lido.ligado;
  const ligado = (await interruptorDaMeta()).ligado;
  lido = { em: agora, ligado };
  return ligado;
}

/** Só para os testes e para depois de mudar. */
export function esquecerALeituraDaMeta(): void {
  lido = null;
}

export async function interruptorDaMeta(): Promise<InterruptorDaMeta> {
  const desligado: InterruptorDaMeta = { ligado: false, mudadoEm: null, porQuem: null };
  try {
    const { getPool } = await import("./db");
    const pool = await getPool();
    if (!pool) return desligado;
    const [rows] = (await pool.execute("SELECT ligado, mudadoEm, porQuem FROM retencaoInterruptores WHERE chave = ? LIMIT 1", [
      CHAVE_DO_WHATSAPP_PELA_META,
    ])) as [Array<{ ligado: number; mudadoEm: Date | string | null; porQuem: string | null }>, unknown];
    const l = rows[0];
    if (!l) return desligado;
    return {
      ligado: Number(l.ligado) === 1,
      mudadoEm: l.mudadoEm ? (instanteDaBase(l.mudadoEm)?.toISOString() ?? null) : null,
      porQuem: l.porQuem ?? null,
    };
  } catch (e) {
    console.error("[whatsapp-pela-meta] não li o interruptor — fica desligado:", e instanceof Error ? e.message : e);
    return desligado;
  }
}

/** Liga ou desliga; a mudança e quem a fez ficam no registo permanente, na mesma transacção. */
export async function mudarInterruptorDaMeta(ligar: boolean, porQuem: string): Promise<InterruptorDaMeta> {
  const { ensureRegistoTable, getPool, registarNaTransaccao } = await import("./db");
  const pool = await getPool();
  if (!pool) throw new Error("[whatsapp-pela-meta] base de dados indisponível");
  await ensureRegistoTable();
  await pool.execute(`CREATE TABLE IF NOT EXISTS retencaoInterruptores (
    chave     VARCHAR(40) NOT NULL PRIMARY KEY,
    ligado    TINYINT(1) NOT NULL DEFAULT 0,
    mudadoEm  DATETIME NULL DEFAULT NULL,
    porQuem   VARCHAR(120) NULL DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  const antes = await interruptorDaMeta();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO retencaoInterruptores (chave, ligado, mudadoEm, porQuem) VALUES (?, ?, UTC_TIMESTAMP(), ?)
       ON DUPLICATE KEY UPDATE ligado = VALUES(ligado), mudadoEm = VALUES(mudadoEm), porQuem = VALUES(porQuem)`,
      [CHAVE_DO_WHATSAPP_PELA_META, ligar ? 1 : 0, porQuem.slice(0, 120)],
    );
    await registarNaTransaccao(conn, {
      acontecimento: "whatsapp_pela_meta_interruptor",
      autorTipo: "clyon",
      autorNome: porQuem,
      estadoAntes: antes.ligado ? "ligado" : "desligado",
      estadoDepois: ligar ? "ligado" : "desligado",
      resumo: `«${NOME_DO_INTERRUPTOR_DA_META}» ${ligar ? "LIGADO" : "DESLIGADO"} por ${porQuem} (d5).`,
    });
    await conn.commit();
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
      /* já houve rollback */
    }
    throw e;
  } finally {
    conn.release();
  }
  esquecerALeituraDaMeta();
  return interruptorDaMeta();
}

/**
 * O ÚLTIMO ERRO DA META — fica no registo (um acontecimento por erro, sem o
 * número nem o texto da mensagem: só o estado HTTP e o código/mensagem curta da
 * Meta) e o painel das conversas mostra-o. Nunca lança.
 */
export async function registarErroDaMeta(estado: number, detalhe: string): Promise<void> {
  try {
    const { ensureRegistoTable, registarSemFalhar } = await import("./db");
    await ensureRegistoTable();
    await registarSemFalhar({
      acontecimento: "whatsapp_meta_erro",
      autorTipo: "sistema",
      autorNome: "Cloud API da Meta",
      resumo: `A Cloud API da Meta recusou um envio (HTTP ${estado}): ${detalhe.slice(0, 200)}`,
    });
  } catch {
    /* o erro já está nos registos da Vercel */
  }
}
