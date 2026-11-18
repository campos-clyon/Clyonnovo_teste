import { ensurePlataformaConfiguracoes, getPool } from "./db";
import { CHAVE_DAS_CONTAS_DE_DESTINO, contasGuardadas, type ContaDeDestino } from "./contas-de-destino";

/** As contas de destino das Configs (ou as de origem, sem nada guardado). — d66 */
export async function contasDeDestino(): Promise<ContaDeDestino[]> {
  try {
    await ensurePlataformaConfiguracoes();
    const pool = await getPool();
    if (!pool) return contasGuardadas(null);
    const [l] = (await pool.execute(`SELECT valor FROM plataformaConfiguracoes WHERE chave = ? LIMIT 1`, [
      CHAVE_DAS_CONTAS_DE_DESTINO,
    ])) as [Array<{ valor: string }>, unknown];
    return contasGuardadas(l[0]?.valor ?? null);
  } catch (e) {
    console.error("[contas-de-destino]", e instanceof Error ? e.message : e);
    return contasGuardadas(null);
  }
}

export async function guardarContasDeDestino(contas: ContaDeDestino[], porQuem: string): Promise<void> {
  await ensurePlataformaConfiguracoes();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(
    `INSERT INTO plataformaConfiguracoes (chave, valor, porQuem) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor), porQuem = VALUES(porQuem)`,
    [CHAVE_DAS_CONTAS_DE_DESTINO, JSON.stringify(contas), porQuem.slice(0, 120)],
  );
}
