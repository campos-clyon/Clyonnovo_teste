import { getPool } from "./db";
import { mesmoTelefoneEstrito } from "./validade-do-orcamento";
import { DIAS_DE_UM_PEDIDO_FECHADO, contaComoEmCurso, type PedidoEmCurso } from "./pedido-em-curso";

/**
 * O PEDIDO EM CURSO, LIDO DA BASE — 21-11-2026 (decisão d73). As regras estão
 * em `pedido-em-curso.ts`; aqui lêem-se os pedidos do número (os abertos, e os
 * fechados nos últimos 30 dias), as negociações, o valor final e o pagamento;
 * o «Já respondi» do número; e o «Devolver ao site» dado por uma pessoa.
 *
 * Tudo falha calado para o lado de sempre: sem base, não há pedidos em curso
 * nem equipa a responder, e a conversa segue como seguia.
 */

const ultimos9 = (telefone: string) => telefone.replace(/\D/g, "").slice(-9);

type Linha = Record<string, unknown>;

function propostaPendenteDoPro(json: unknown): boolean {
  if (typeof json !== "string" || !json.trim()) return false;
  try {
    const lista = JSON.parse(json) as Array<{ estado?: string; por?: string }>;
    return Array.isArray(lista) && lista.some((p) => p?.estado === "pendente" && p?.por === "profissional");
  } catch {
    return false;
  }
}

function contarFotos(json: unknown): number {
  if (typeof json !== "string" || !json.trim()) return 0;
  try {
    const lista = JSON.parse(json);
    return Array.isArray(lista) ? lista.length : 0;
  } catch {
    return 0;
  }
}

/** Os pedidos deste número que ainda contam — o mais novo primeiro. */
export async function pedidosEmCursoDoTelefone(telefone: string): Promise<PedidoEmCurso[]> {
  const digitos = ultimos9(telefone);
  if (digitos.length < 9) return [];
  const pool = await getPool();
  if (!pool) return [];
  const [rows] = (await pool.execute(
    `SELECT id, status, serviceType, filesJson, valorFixoClyon, contactPhone,
            TIMESTAMPDIFF(SECOND, COALESCE(updatedAt, createdAt), CURRENT_TIMESTAMP) AS haSegundos
       FROM simulatorOrders
      WHERE RIGHT(REGEXP_REPLACE(COALESCE(contactPhone, ''), '[^0-9]', ''), 9) = ?
        AND (status IS NULL
             OR status NOT IN ('cancelado', 'concluido', 'arquivado', 'rejeitado')
             OR COALESCE(updatedAt, createdAt) >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ${DIAS_DE_UM_PEDIDO_FECHADO} DAY))
      ORDER BY createdAt DESC
      LIMIT 10`,
    [digitos],
  )) as [Linha[], unknown];
  const pedidos: PedidoEmCurso[] = [];
  for (const r of rows) {
    // d3 (22-11): os 9 dígitos finais só pré-selecionam; o número tem de ser o mesmo, inteiro (um número de outro país com o mesmo fim não ouve o pedido de outra pessoa).
    if (!mesmoTelefoneEstrito(String(r.contactPhone ?? ""), telefone)) continue;
    const id = Number(r.id);
    const negs = await negociacoesDe(id).catch(() => [] as Linha[]);
    const negIds = negs.map((n) => Number(n.id)).filter((n) => Number.isFinite(n));
    const valorFinal = await valorFinalEnviado(id).catch(() => false);
    const pago = await clientePagou(negIds).catch(() => false);
    const ha = Number(r.haSegundos);
    pedidos.push({
      id,
      status: r.status == null ? null : String(r.status),
      servico: r.serviceType == null ? null : String(r.serviceType),
      fotos: contarFotos(r.filesJson),
      haDias: Number.isFinite(ha) ? ha / 86400 : null,
      negociacoes: negs.map((n) => ({ estado: String(n.estado ?? ""), propostaPendente: propostaPendenteDoPro(n.propostasJson) })),
      valorFinalPorPagar: valorFinal && !pago,
      pago,
      clyon: r.valorFixoClyon != null && String(r.valorFixoClyon) !== "",
    });
  }
  return pedidos.filter(contaComoEmCurso);
}

async function negociacoesDe(pedidoId: number): Promise<Linha[]> {
  const pool = await getPool();
  if (!pool) return [];
  const [rows] = (await pool.execute(
    `SELECT id, estado, propostasJson FROM negociacoes
      WHERE pedidoId = ? AND estado NOT IN ('morta', 'desistida')`,
    [pedidoId],
  )) as [Linha[], unknown];
  return rows;
}

async function valorFinalEnviado(pedidoId: number): Promise<boolean> {
  const pool = await getPool();
  if (!pool) return false;
  const [rows] = (await pool.execute("SELECT COUNT(*) AS n FROM valoresFinaisEnviados WHERE pedidoId = ?", [pedidoId])) as [
    Linha[],
    unknown,
  ];
  return Number(rows[0]?.n ?? 0) > 0;
}

async function clientePagou(negociacaoIds: number[]): Promise<boolean> {
  if (negociacaoIds.length === 0) return false;
  const pool = await getPool();
  if (!pool) return false;
  const [rows] = (await pool.execute(
    `SELECT COUNT(*) AS n FROM pagamentos
      WHERE negociacaoPaga IN (${negociacaoIds.map(() => "?").join(",")}) AND pagoEm IS NOT NULL`,
    negociacaoIds,
  )) as [Linha[], unknown];
  return Number(rows[0]?.n ?? 0) > 0;
}

/* ── A equipa na conversa ────────────────────────────────────────────────── */

let devolvidasProntas = false;

async function garantirDevolvidas(): Promise<void> {
  if (devolvidasProntas) return;
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS whatsappDevolvidas (
      id       INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      telefone VARCHAR(32) NOT NULL,
      criadoEm DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_telefone (telefone)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  devolvidasProntas = true;
}

/**
 * «DEVOLVER AO SITE», DADO POR UMA PESSOA — guarda-se quando. É a decisão de
 * quem tinha a conversa: daí para a frente a Vitória responde, mesmo que a
 * equipa tenha escrito há menos de 12 horas. As devoluções automáticas (o
 * valor final, o comprovativo, o lembrete do orçamento) não passam por aqui.
 */
export async function marcarDevolvidaWhatsApp(telefone: string): Promise<void> {
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length < 9) return;
  await garantirDevolvidas();
  const pool = await getPool();
  if (!pool) return;
  await pool.execute(
    `INSERT INTO whatsappDevolvidas (telefone) VALUES (?)
     ON DUPLICATE KEY UPDATE criadoEm = CURRENT_TIMESTAMP`,
    [digitos],
  );
}

/** Há quantos segundos foi o «Já respondi» e o «Devolver ao site» deste número (null se nunca). */
export async function aEquipaNaConversa(
  telefone: string,
): Promise<{ respondidaHaSegundos: number | null; devolvidaHaSegundos: number | null }> {
  const digitos = ultimos9(telefone);
  const vazio = { respondidaHaSegundos: null, devolvidaHaSegundos: null };
  if (digitos.length < 9) return vazio;
  const pool = await getPool();
  if (!pool) return vazio;
  const idade = async (tabela: string): Promise<number | null> => {
    try {
      const [rows] = (await pool.execute(
        `SELECT telefone, TIMESTAMPDIFF(SECOND, criadoEm, CURRENT_TIMESTAMP) AS ha FROM ${tabela} WHERE RIGHT(telefone, 9) = ?`,
        [digitos],
      )) as [Linha[], unknown];
      // d3 (22-11): o mesmo número, inteiro — não só os 9 dígitos finais.
      const has = rows
        .filter((r) => mesmoTelefoneEstrito(String(r.telefone ?? ""), telefone))
        .map((r) => Number(r.ha))
        .filter((n) => Number.isFinite(n));
      return has.length === 0 ? null : Math.max(0, Math.min(...has));
    } catch {
      return null; // a tabela ainda não existe
    }
  };
  await garantirDevolvidas().catch(() => {});
  return { respondidaHaSegundos: await idade("whatsappRespondidas"), devolvidaHaSegundos: await idade("whatsappDevolvidas") };
}
