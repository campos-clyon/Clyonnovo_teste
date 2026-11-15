import { getPool, toMySQLDateTime } from "./db";

/**
 * O HISTÓRICO DO «ENVIAR O VALOR FINAL AO CLIENTE» — d38 v2, commit d. Uma
 * linha por envio: quem enviou, quando, que valor, o canal escolhido e por onde
 * saiu de facto, e as referências geradas. Tabela nova, só a acrescentar; nada
 * se apaga.
 */

let pronta = false;

async function garantirTabela(): Promise<void> {
  if (pronta) return;
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS valoresFinaisEnviados (
      id             INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
      negociacaoId   INT UNSIGNED  NOT NULL,
      pedidoId       INT UNSIGNED  NOT NULL,
      modo           VARCHAR(20)   NOT NULL,
      total          DECIMAL(10,2) NOT NULL,
      semIva         DECIMAL(10,2) NOT NULL,
      aPedir         DECIMAL(10,2) NOT NULL,
      canalPedido    VARCHAR(20)   NOT NULL,
      canaisSairam   VARCHAR(40)   NOT NULL DEFAULT '',
      pagamentoIds   VARCHAR(120)  NOT NULL DEFAULT '',
      porQuem        VARCHAR(120)  NULL DEFAULT NULL,
      enviadoEm      DATETIME      NOT NULL,
      KEY valoresFinais_negociacao (negociacaoId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  pronta = true;
}

export type EnvioDoValorFinal = {
  id: number;
  modo: string;
  total: number;
  semIva: number;
  aPedir: number;
  canalPedido: string;
  canaisQueSairam: string[];
  porQuem: string | null;
  enviadoEm: string | null;
};

export async function registarEnvioDoValorFinal(d: {
  negociacaoId: number;
  pedidoId: number;
  modo: string;
  total: number;
  semIva: number;
  aPedir: number;
  canalPedido: string;
  canaisQueSairam: string[];
  pagamentoIds: number[];
  porQuem: string;
  enviadoEm: Date;
}): Promise<void> {
  await garantirTabela();
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(
    `INSERT INTO valoresFinaisEnviados
       (negociacaoId, pedidoId, modo, total, semIva, aPedir, canalPedido, canaisSairam, pagamentoIds, porQuem, enviadoEm)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      d.negociacaoId,
      d.pedidoId,
      d.modo.slice(0, 20),
      d.total,
      d.semIva,
      d.aPedir,
      d.canalPedido.slice(0, 20),
      d.canaisQueSairam.join(",").slice(0, 40),
      d.pagamentoIds.join(",").slice(0, 120),
      d.porQuem.slice(0, 120),
      toMySQLDateTime(d.enviadoEm),
    ],
  );
}

/** Os envios deste trabalho, do mais recente para o mais antigo. */
export async function enviosDoValorFinal(negociacaoId: number): Promise<EnvioDoValorFinal[]> {
  await garantirTabela();
  const pool = await getPool();
  if (!pool) return [];
  const [linhas] = (await pool.execute(
    `SELECT id, modo, total, semIva, aPedir, canalPedido, canaisSairam, porQuem, enviadoEm
       FROM valoresFinaisEnviados WHERE negociacaoId = ? ORDER BY id DESC LIMIT 20`,
    [negociacaoId],
  )) as unknown as [Array<Record<string, unknown>>, unknown];
  return linhas.map((l) => ({
    id: Number(l.id),
    modo: String(l.modo ?? ""),
    total: Number(l.total ?? 0),
    semIva: Number(l.semIva ?? 0),
    aPedir: Number(l.aPedir ?? 0),
    canalPedido: String(l.canalPedido ?? ""),
    canaisQueSairam: String(l.canaisSairam ?? "").split(",").filter(Boolean),
    porQuem: (l.porQuem as string | null) ?? null,
    // A base é lida em UTC: a data vem como Date (como em folha-final-na-base.ts).
    enviadoEm: l.enviadoEm instanceof Date ? l.enviadoEm.toISOString() : l.enviadoEm == null ? null : String(l.enviadoEm),
  }));
}
