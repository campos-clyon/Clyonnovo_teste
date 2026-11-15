import { ensureRegistoTable, getPool, registarNaTransaccao } from "./db";

/**
 * O INTERRUPTOR DA MENSAGEM GENTIL A QUEM FICOU CALADO — d25 v2 (14-11-2026).
 *
 * A regra está em `recolhas-paradas.ts` (`podeSeguir`) e o texto em
 * `whatsapp-recolha.ts` (`textoDoSeguimento`); aqui só o interruptor das
 * Configs. Na mesma tabela dos interruptores da retenção, do email do fecho e
 * da Vitória aos profissionais (`retencaoInterruptores`), com outra chave.
 *
 * DESLIGADO POR OMISSÃO E NA DÚVIDA: sem linha, sem tabela, ou com a base a
 * falhar, não sai mensagem nenhuma. São mensagens a pessoas reais que não se
 * podem experimentar em produção sem lhas mandar — liga-o o administrador,
 * escrevendo LIGAR, quando o dono o decidir. A mudança fica no registo
 * permanente, na mesma transacção.
 */
export const CHAVE_DO_SEGUIMENTO_DA_VITORIA = "vitoria_seguimento_d25";
export const NOME_DO_INTERRUPTOR_DO_SEGUIMENTO = "Vitória: mensagem gentil a quem fica calado";

export type InterruptorDoSeguimento = { ligado: boolean; mudadoEm: string | null; porQuem: string | null };

async function tabelaDosInterruptores() {
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS retencaoInterruptores (
      chave     VARCHAR(40) NOT NULL PRIMARY KEY,
      ligado    TINYINT(1) NOT NULL DEFAULT 0,
      mudadoEm  DATETIME NULL DEFAULT NULL,
      porQuem   VARCHAR(120) NULL DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  return pool;
}

export async function interruptorDoSeguimento(): Promise<InterruptorDoSeguimento> {
  const desligado: InterruptorDoSeguimento = { ligado: false, mudadoEm: null, porQuem: null };
  try {
    const pool = await tabelaDosInterruptores();
    const [rows] = (await pool.execute(
      "SELECT ligado, mudadoEm, porQuem FROM retencaoInterruptores WHERE chave = ? LIMIT 1",
      [CHAVE_DO_SEGUIMENTO_DA_VITORIA],
    )) as [Array<{ ligado: number; mudadoEm: Date | string | null; porQuem: string | null }>, unknown];
    const l = rows[0];
    if (!l) return desligado;
    return {
      ligado: Number(l.ligado) === 1,
      mudadoEm: l.mudadoEm ? new Date(l.mudadoEm).toISOString() : null,
      porQuem: l.porQuem ?? null,
    };
  } catch (e) {
    console.error("[seguimento-da-vitoria] não li o interruptor — fica desligado:", e instanceof Error ? e.message : e);
    return desligado;
  }
}

/** Para a passagem de 10 em 10 minutos: só o sim ou o não. */
export async function seguimentoDaVitoriaLigado(): Promise<boolean> {
  return (await interruptorDoSeguimento()).ligado === true;
}

export async function mudarInterruptorDoSeguimento(ligar: boolean, porQuem: string): Promise<InterruptorDoSeguimento> {
  const pool = await tabelaDosInterruptores();
  await ensureRegistoTable();
  const antes = await interruptorDoSeguimento();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO retencaoInterruptores (chave, ligado, mudadoEm, porQuem) VALUES (?, ?, NOW(), ?)
       ON DUPLICATE KEY UPDATE ligado = VALUES(ligado), mudadoEm = VALUES(mudadoEm), porQuem = VALUES(porQuem)`,
      [CHAVE_DO_SEGUIMENTO_DA_VITORIA, ligar ? 1 : 0, porQuem.slice(0, 120)],
    );
    await registarNaTransaccao(conn, {
      acontecimento: "vitoria_seguimento_interruptor",
      autorTipo: "clyon",
      autorNome: porQuem,
      estadoAntes: antes.ligado ? "ligado" : "desligado",
      estadoDepois: ligar ? "ligado" : "desligado",
      resumo: `«${NOME_DO_INTERRUPTOR_DO_SEGUIMENTO}» ${ligar ? "LIGADO" : "DESLIGADO"} por ${porQuem} (d25).`,
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
  return interruptorDoSeguimento();
}
