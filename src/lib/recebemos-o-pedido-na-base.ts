/**
 * «RECEBEMOS O SEU PEDIDO #N», NA BASE — d102 (d) (CEO e dono, 24-11-2026).
 * As regras e o texto estão em `recebemos-o-pedido.ts`.
 *
 *  - `pedidoRecebidoAoCliente` — UMA linha por pedido: à espera (fora das
 *    9h–20h), a enviar, enviado, falhou, ou «não» (e porquê). É a reserva que
 *    impede a mensagem de sair duas vezes;
 *  - `avisarQueRecebemosOPedido` — chamado pelo simulador e pelo formulário da
 *    página inicial logo depois de gravar o pedido (em `after()`);
 *  - `rotinaDoRecebido` — os que ficaram à espera saem às 9h, pela rotina do
 *    «Pedir o que falta» (que corre a seguir, e já encontra a 1.ª dada).
 *
 * Nunca lança para quem chama: o pedido já está gravado.
 */

import { appendOrderHistory, getPool } from "./db";
import { telemovelPortugues } from "./lembrete-do-que-falta";
import { pedidoFechado } from "./pedido-arrumado";
import { decidirORecebido, HORAS_ATE_O_RECEBIDO_PERDER_A_VEZ, naJanelaDoRecebido, textoDoRecebido } from "./recebemos-o-pedido";

type Pool = NonNullable<Awaited<ReturnType<typeof getPool>>>;

export const SQL_DA_TABELA_DO_RECEBIDO = `CREATE TABLE IF NOT EXISTS pedidoRecebidoAoCliente (
    pedidoId      INT UNSIGNED NOT NULL PRIMARY KEY,
    estado        VARCHAR(12) NOT NULL,
    criadoEm      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    enviadoEm     DATETIME NULL DEFAULT NULL,
    comOQueFalta  TINYINT(1) NOT NULL DEFAULT 0,
    porque        VARCHAR(160) NULL DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

let pronta = false;

async function tabela(): Promise<Pool> {
  const pool = await getPool();
  if (!pool) throw new Error("[recebemos-o-pedido] base de dados indisponível");
  if (!pronta) {
    await pool.execute(SQL_DA_TABELA_DO_RECEBIDO);
    pronta = true;
  }
  return pool;
}

type PedidoLido = { id: number; status: string | null; anonimizado: boolean; contactPhone: string | null };

async function lerOPedido(pool: Pool, pedidoId: number): Promise<PedidoLido | null> {
  const [rows] = (await pool.execute("SELECT id, status, anonimizadoEm, contactPhone FROM simulatorOrders WHERE id = ? LIMIT 1", [pedidoId])) as [
    Array<Record<string, unknown>>,
    unknown,
  ];
  const r = rows[0];
  if (!r) return null;
  return { id: Number(r.id), status: (r.status as string | null) ?? null, anonimizado: r.anonimizadoEm != null, contactPhone: (r.contactPhone as string | null) ?? null };
}

async function situacao(pool: Pool, p: PedidoLido) {
  const telemovel = telemovelPortugues(p.contactPhone);
  if (!telemovel) return { telemovel: null, naoContactar: false, bloqueado: false, comUmaPessoa: false };
  const db = await import("./db");
  const { eParaNaoContactar } = await import("./nao-contactar");
  const naoContactar = await eParaNaoContactar(telemovel, { pool }).catch(() => true);
  const bloqueado = await db.numeroBloqueadoWhatsApp(telemovel).catch(() => true);
  const interrompido = await db.numeroInterrompidoWhatsApp(telemovel).catch(() => true);
  const fio = await db.mensagensDoNumeroWhatsApp(telemovel, 40).catch(() => null);
  const { aEquipaFalouHaPouco } = await import("./pedido-em-curso");
  return { telemovel, naoContactar, bloqueado, comUmaPessoa: interrompido || (fio != null && aEquipaFalouHaPouco(fio)) };
}

async function marcar(pool: Pool, pedidoId: number, estado: string, porque: string | null): Promise<void> {
  await pool.execute("INSERT IGNORE INTO pedidoRecebidoAoCliente (pedidoId, estado, porque) VALUES (?, ?, ?)", [pedidoId, estado, porque?.slice(0, 160) ?? null]);
}

/** Reserva o envio (só um ganha): uma linha nova, ou a que estava à espera. */
async function reservar(pool: Pool, pedidoId: number): Promise<boolean> {
  const [novo] = (await pool.execute("INSERT IGNORE INTO pedidoRecebidoAoCliente (pedidoId, estado) VALUES (?, 'a_enviar')", [pedidoId])) as [
    { affectedRows: number },
    unknown,
  ];
  if (Number(novo.affectedRows) === 1) return true;
  const [deEspera] = (await pool.execute("UPDATE pedidoRecebidoAoCliente SET estado = 'a_enviar' WHERE pedidoId = ? AND estado = 'espera'", [pedidoId])) as [
    { affectedRows: number },
    unknown,
  ];
  return Number(deEspera.affectedRows) === 1;
}

async function enviar(pool: Pool, pedidoId: number, telemovel: string, agora: Date): Promise<boolean> {
  if (!(await reservar(pool, pedidoId))) return false;
  // O «Pedir o que falta» da 1.ª (d88), se o pedido entraria no ciclo dos lembretes.
  const ciclo = await import("./lembrete-do-que-falta-na-base");
  const oQueFalta = await ciclo.oQueFaltaParaORecebido(pedidoId, agora).catch(() => null);
  const texto = textoDoRecebido(pedidoId, oQueFalta);
  const { enviarAvisoWhatsApp } = await import("./whatsapp-cloud");
  const saiu = await enviarAvisoWhatsApp(telemovel, texto, { semLinguaErrada: true }).catch(() => false);
  if (saiu && oQueFalta) await ciclo.marcarOPrimeiroPeloRecebido(pedidoId).catch(() => {});
  await pool.execute(
    saiu
      ? "UPDATE pedidoRecebidoAoCliente SET estado = 'enviado', enviadoEm = UTC_TIMESTAMP(), comOQueFalta = ? WHERE pedidoId = ?"
      : "UPDATE pedidoRecebidoAoCliente SET estado = 'falhou', comOQueFalta = ?, porque = 'o WhatsApp não saiu (bloqueado, desligado ou sem tradução)' WHERE pedidoId = ?",
    [oQueFalta ? 1 : 0, pedidoId],
  );
  await appendOrderHistory(pedidoId, {
    type: "note",
    by: null,
    message: saiu
      ? `A Vitória disse ao cliente pelo WhatsApp que recebemos o pedido${oQueFalta ? ", com o que falta (conta como a 1.ª do «Pedir o que falta»)" : ""} (d102).`
      : "A mensagem «recebemos o seu pedido» não saiu pelo WhatsApp (d102).",
  }).catch(() => {});
  return saiu;
}

/**
 * LOGO DEPOIS DE GRAVAR O PEDIDO (simulador e formulário da página inicial):
 * sai já, fica à espera das 9h, ou não sai (sem telemóvel português, «não
 * contactar», bloqueado, conversa com uma pessoa). Nunca lança.
 */
export async function avisarQueRecebemosOPedido(pedidoId: number, agora: Date = new Date()): Promise<void> {
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) return;
  try {
    const pool = await tabela();
    const p = await lerOPedido(pool, pedidoId);
    if (!p || p.anonimizado || pedidoFechado(p.status)) return;
    // d128: fora da zona fica à espera (a 1.ª pergunta vai com ele) — sai se a morada for corrigida a tempo.
    const { idsForaDaZona } = await import("./fora-da-zona-na-base");
    if ((await idsForaDaZona([pedidoId])).has(pedidoId)) {
      await marcar(pool, pedidoId, "espera", null);
      return;
    }
    const s = await situacao(pool, p);
    const d = decidirORecebido({ ...s, jaTratado: false }, agora);
    if (d.tipo === "nao") {
      if (s.telemovel) await marcar(pool, pedidoId, "nao", d.porque);
      return;
    }
    if (d.tipo === "espera") {
      await marcar(pool, pedidoId, "espera", null);
      return;
    }
    await enviar(pool, pedidoId, s.telemovel!, agora);
  } catch (e) {
    console.error(`[recebemos-o-pedido] #${pedidoId}:`, e instanceof Error ? e.message : e);
  }
}

export type ResultadoDoRecebido = { enviados: number; caducados: number; naoSaem: number };

/** Os que ficaram à espera (fora das 9h–20h) saem na janela, um a um. Os que perderam a vez já não saem. */
export async function rotinaDoRecebido(agora: Date = new Date()): Promise<ResultadoDoRecebido> {
  const r: ResultadoDoRecebido = { enviados: 0, caducados: 0, naoSaem: 0 };
  if (!naJanelaDoRecebido(agora)) return r;
  const pool = await tabela();
  const [rows] = (await pool.query(
    "SELECT pedidoId, (criadoEm < UTC_TIMESTAMP() - INTERVAL " +
      HORAS_ATE_O_RECEBIDO_PERDER_A_VEZ +
      " HOUR) AS caducou FROM pedidoRecebidoAoCliente WHERE estado = 'espera' ORDER BY pedidoId ASC LIMIT 10",
  )) as [Array<{ pedidoId: number; caducou: number }>, unknown];
  // d128: fora da zona fica à espera (até perder a vez), sem mensagem.
  const { idsForaDaZona } = await import("./fora-da-zona-na-base");
  const foraDaZona = await idsForaDaZona(rows.map((l) => Number(l.pedidoId)));
  for (const l of rows) {
    if (Number(l.caducou) !== 1 && foraDaZona.has(Number(l.pedidoId))) continue;
    if (Number(l.caducou) === 1) {
      await pool.execute("UPDATE pedidoRecebidoAoCliente SET estado = 'nao', porque = 'perdeu a vez' WHERE pedidoId = ? AND estado = 'espera'", [l.pedidoId]);
      r.caducados += 1;
      continue;
    }
    const p = await lerOPedido(pool, Number(l.pedidoId));
    const s = p && !p.anonimizado && !pedidoFechado(p.status) ? await situacao(pool, p) : null;
    const d = s ? decidirORecebido({ ...s, jaTratado: false }, agora) : { tipo: "nao" as const, porque: "o pedido fechou" };
    if (d.tipo !== "sai" || !s?.telemovel) {
      await pool.execute("UPDATE pedidoRecebidoAoCliente SET estado = 'nao', porque = ? WHERE pedidoId = ? AND estado = 'espera'", [
        d.tipo === "nao" ? d.porque : "não saiu",
        l.pedidoId,
      ]);
      r.naoSaem += 1;
      continue;
    }
    if (await enviar(pool, Number(l.pedidoId), s.telemovel, agora)) r.enviados += 1;
  }
  return r;
}
