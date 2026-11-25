/**
 * O PEDIDO SEM PROPOSTAS, NA BASE — d102 (a) (CEO e dono, 24-11-2026). As
 * regras puras e os textos estão em `sem-propostas-ao-cliente.ts`.
 *
 *  - `semPropostasAoCliente` — UMA linha por pedido (a chave primária é o
 *    pedido): a enviar, enviado, falhou, ou «fica» (com a equipa, e porquê).
 *    É a reserva que impede o aviso de sair duas vezes;
 *  - a rotina (`/api/cron/pedidos-sem-propostas`, de 15 em 15 min): envia,
 *    das 9h às 20h de Lisboa, no máximo 3 por passagem, um por contacto, e
 *    lê tudo outra vez antes de enviar;
 *  - a lista do «Do nosso lado» da Mesa (`pedidosSemPropostasNaMesa`).
 *
 * Nunca DELETE: a linha fica, e diz o que aconteceu.
 */

import { appendOrderHistory, getPool } from "./db";
import { instanteDaBase } from "./hora-de-lisboa";
import { eDeTeste, emailValido, telemovelPortugues } from "./lembrete-do-que-falta";
import {
  assuntoSemPropostas,
  decidirOAvisoSemPropostas,
  linhaSemPropostas,
  MOTIVOS_SEM_PROPOSTAS,
  pedidoSemPropostas,
  textoSemPropostas,
  type MotivoSemPropostas,
  type NegociacaoSemPropostas,
} from "./sem-propostas-ao-cliente";

type Pool = NonNullable<Awaited<ReturnType<typeof getPool>>>;

export const SQL_DA_TABELA_SEM_PROPOSTAS = `CREATE TABLE IF NOT EXISTS semPropostasAoCliente (
    pedidoId    INT UNSIGNED NOT NULL PRIMARY KEY,
    estado      VARCHAR(12) NOT NULL,
    motivo      VARCHAR(16) NULL DEFAULT NULL,
    canal       VARCHAR(10) NULL DEFAULT NULL,
    reservadoEm DATETIME NULL DEFAULT NULL,
    enviadoEm   DATETIME NULL DEFAULT NULL,
    porque      VARCHAR(160) NULL DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

let pronta = false;

async function tabela(): Promise<Pool> {
  const pool = await getPool();
  if (!pool) throw new Error("[sem-propostas] base de dados indisponível");
  if (!pronta) {
    await pool.execute(SQL_DA_TABELA_SEM_PROPOSTAS);
    pronta = true;
  }
  return pool;
}

const naoHaTabela = (err: unknown) => {
  const code = (err as { code?: string })?.code;
  return code === "ER_NO_SUCH_TABLE" || code === "ER_BAD_FIELD_ERROR";
};

/* ── Os candidatos ───────────────────────────────────────────────────────── */

export type CandidatoSemPropostas = {
  pedidoId: number;
  motivo: MotivoSemPropostas;
  desde: Date;
  contactPhone: string | null;
  contactEmail: string | null;
  aviso: { estado: string | null; porque: string | null };
};

const emailsDeTeste = () =>
  new Set(
    (process.env.EUPAGO_EMAILS_DE_TESTE ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@")),
  );

/**
 * Os pedidos dos últimos 30 dias, abertos, que seguiram para os parceiros
 * (uma negociação aberta) ou ficaram «sem parceiros na zona», e que a regra
 * pura diz estarem sem propostas. Com o estado do aviso de cada um.
 */
export async function candidatosSemPropostas(agora: Date): Promise<CandidatoSemPropostas[]> {
  const pool = await tabela();
  const base = `SELECT o.id, o.status, o.anonimizadoEm, o.valorFixoClyon, o.contactName, o.contactEmail, o.contactPhone`;
  const onde = `o.anonimizadoEm IS NULL AND o.createdAt > UTC_TIMESTAMP() - INTERVAL 30 DAY
     AND COALESCE(o.status, '') NOT IN ('cancelado', 'arquivado', 'rejeitado', 'concluido')`;
  let rows: Array<Record<string, unknown>>;
  try {
    [rows] = (await pool.query(
      `${base}, e.mudadoEm AS semParceirosEm
         FROM simulatorOrders o
         LEFT JOIN envioAutomaticoAosParceiros e ON e.pedidoId = o.id AND e.estado = 'ficou' AND e.motivo = 'sem_parceiros'
        WHERE ${onde}
          AND (EXISTS (SELECT 1 FROM negociacoes n WHERE n.pedidoId = o.id AND n.estado = 'aberta') OR e.pedidoId IS NOT NULL)
        ORDER BY o.id DESC LIMIT 200`,
    )) as [Array<Record<string, unknown>>, unknown];
  } catch (err) {
    if (!naoHaTabela(err)) throw err;
    [rows] = (await pool.query(
      `${base}, NULL AS semParceirosEm FROM simulatorOrders o
        WHERE ${onde} AND EXISTS (SELECT 1 FROM negociacoes n WHERE n.pedidoId = o.id AND n.estado = 'aberta')
        ORDER BY o.id DESC LIMIT 200`,
    )) as [Array<Record<string, unknown>>, unknown];
  }
  if (rows.length === 0) return [];
  const ids = rows.map((r) => Number(r.id));
  const marcas = ids.map(() => "?").join(",");
  const [negs] = (await pool.execute(
    `SELECT pedidoId, estado, propostasJson, createdAt FROM negociacoes WHERE pedidoId IN (${marcas})`,
    ids,
  )) as [Array<Record<string, unknown>>, unknown];
  const porPedido = new Map<number, NegociacaoSemPropostas[]>();
  for (const n of negs) {
    const l = porPedido.get(Number(n.pedidoId)) ?? [];
    l.push({
      estado: String(n.estado ?? ""),
      propostasJson: (n.propostasJson as string | null) ?? null,
      criadaEm: instanteDaBase(n.createdAt as string | Date | null),
    });
    porPedido.set(Number(n.pedidoId), l);
  }
  const [avisos] = (await pool.execute(`SELECT pedidoId, estado, porque FROM semPropostasAoCliente WHERE pedidoId IN (${marcas})`, ids)) as [
    Array<{ pedidoId: number; estado: string; porque: string | null }>,
    unknown,
  ];
  const doAviso = new Map(avisos.map((a) => [Number(a.pedidoId), { estado: String(a.estado), porque: a.porque ?? null }]));
  const teste = emailsDeTeste();
  const out: CandidatoSemPropostas[] = [];
  for (const r of rows) {
    const id = Number(r.id);
    const s = pedidoSemPropostas(
      {
        pedidoId: id,
        status: (r.status as string | null) ?? null,
        anonimizado: r.anonimizadoEm != null,
        trabalhoClyon: r.valorFixoClyon != null,
        deTeste: eDeTeste(r.contactName as string | null, r.contactEmail as string | null, teste),
        negociacoes: porPedido.get(id) ?? [],
        semParceirosDesde: instanteDaBase(r.semParceirosEm as string | Date | null),
      },
      agora,
    );
    if (!s) continue;
    out.push({
      pedidoId: id,
      motivo: s.motivo,
      desde: s.desde,
      contactPhone: (r.contactPhone as string | null) ?? null,
      contactEmail: (r.contactEmail as string | null) ?? null,
      aviso: doAviso.get(id) ?? { estado: null, porque: null },
    });
  }
  return out;
}

/* ── O «Do nosso lado» ───────────────────────────────────────────────────── */

export type PedidoSemPropostasNaMesa = { pedidoId: number; motivo: MotivoSemPropostas; desde: string; linha: string };

/** Para o cartão da Mesa: o número do pedido, desde quando e a linha. Nunca lança. */
export async function pedidosSemPropostasNaMesa(agora: Date = new Date()): Promise<PedidoSemPropostasNaMesa[]> {
  try {
    return (await candidatosSemPropostas(agora)).map((c) => ({
      pedidoId: c.pedidoId,
      motivo: c.motivo,
      desde: c.desde.toISOString(),
      linha: linhaSemPropostas(c.motivo, c.aviso),
    }));
  } catch (e) {
    console.error("[sem-propostas] a Mesa não leu os pedidos sem propostas:", e instanceof Error ? e.message : e);
    return [];
  }
}

/* ── A rotina ────────────────────────────────────────────────────────────── */

export type ResultadoSemPropostas = { candidatos: number; enviados: number; falhados: number; ficam: number; esperam: number };

/** No máximo três avisos por passagem, 20 s entre cada: nunca uma rajada do mesmo número. */
export const AVISOS_SEM_PROPOSTAS_POR_PASSAGEM = 3;
const INTERVALO_MS = 20_000;
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function oCliente(pool: Pool, c: CandidatoSemPropostas, agora: Date) {
  const db = await import("./db");
  const telemovel = telemovelPortugues(c.contactPhone);
  let comUmaPessoa = false;
  let bloqueado = false;
  if (telemovel) {
    bloqueado = await db.numeroBloqueadoWhatsApp(telemovel).catch(() => true);
    const interrompido = await db.numeroInterrompidoWhatsApp(telemovel).catch(() => true);
    const fio = await db.mensagensDoNumeroWhatsApp(telemovel, 40).catch(() => null);
    const { aEquipaFalouHaPouco } = await import("./pedido-em-curso");
    comUmaPessoa = interrompido || (fio != null && aEquipaFalouHaPouco(fio));
  }
  const { jaSaiuHojeUmaMensagemAutomatica } = await import("./uma-mensagem-automatica-por-dia");
  const jaSaiuHoje = await jaSaiuHojeUmaMensagemAutomatica({ telefone: c.contactPhone, email: c.contactEmail }, agora, { pool }).catch(() => true);
  return { telemovel, email: emailValido(c.contactEmail), comUmaPessoa, bloqueado, jaSaiuHoje };
}

async function marcarQueFica(pool: Pool, c: CandidatoSemPropostas, porque: string): Promise<void> {
  await pool.execute(
    `INSERT INTO semPropostasAoCliente (pedidoId, estado, motivo, porque) VALUES (?, 'fica', ?, ?)
     ON DUPLICATE KEY UPDATE porque = IF(estado = 'fica', VALUES(porque), porque), motivo = IF(estado = 'fica', VALUES(motivo), motivo)`,
    [c.pedidoId, c.motivo, porque.slice(0, 160)],
  );
}

/** Reserva o aviso (só uma passagem ganha). Um «fica» de antes pode passar a sair. */
async function reservar(pool: Pool, c: CandidatoSemPropostas, canal: string): Promise<boolean> {
  const [novo] = (await pool.execute(
    "INSERT IGNORE INTO semPropostasAoCliente (pedidoId, estado, motivo, canal, reservadoEm) VALUES (?, 'a_enviar', ?, ?, UTC_TIMESTAMP())",
    [c.pedidoId, c.motivo, canal],
  )) as [{ affectedRows: number }, unknown];
  if (Number(novo.affectedRows) === 1) return true;
  const [deFica] = (await pool.execute(
    "UPDATE semPropostasAoCliente SET estado = 'a_enviar', motivo = ?, canal = ?, reservadoEm = UTC_TIMESTAMP(), porque = NULL WHERE pedidoId = ? AND estado = 'fica'",
    [c.motivo, canal, c.pedidoId],
  )) as [{ affectedRows: number }, unknown];
  return Number(deFica.affectedRows) === 1;
}

/**
 * Os pedidos sem propostas: os que podem receber o aviso agora recebem-no
 * (uma vez por pedido, um por contacto); os outros ficam marcados com o
 * porquê (o «Do nosso lado» mostra-o).
 */
export async function rotinaSemPropostas(agora: Date = new Date()): Promise<ResultadoSemPropostas> {
  const r: ResultadoSemPropostas = { candidatos: 0, enviados: 0, falhados: 0, ficam: 0, esperam: 0 };
  const pool = await tabela();
  const candidatos = await candidatosSemPropostas(agora);
  r.candidatos = candidatos.length;
  const vistos = new Set<string>();
  // d128: fora da zona, o aviso «sem propostas» não sai até a morada estar confirmada.
  const { idsForaDaZona } = await import("./fora-da-zona-na-base");
  const foraDaZona = await idsForaDaZona(candidatos.map((c) => c.pedidoId));
  for (const c of candidatos.sort((a, b) => a.pedidoId - b.pedidoId)) {
    if (foraDaZona.has(c.pedidoId)) {
      r.esperam += 1;
      continue;
    }
    const jaAvisado = c.aviso.estado != null && c.aviso.estado !== "fica";
    if (jaAvisado) continue;
    if (r.enviados + r.falhados >= AVISOS_SEM_PROPOSTAS_POR_PASSAGEM) break;
    const cliente = await oCliente(pool, c, agora);
    const contacto = cliente.telemovel ?? cliente.email ?? "";
    if (contacto && vistos.has(contacto)) {
      r.esperam += 1;
      continue;
    }
    const d = decidirOAvisoSemPropostas({ ...cliente, jaAvisado }, agora);
    if (d.tipo === "fica") {
      await marcarQueFica(pool, c, d.porque);
      r.ficam += 1;
      continue;
    }
    if (d.tipo !== "sai") {
      r.esperam += 1;
      continue;
    }
    if (!(await reservar(pool, c, d.canal))) continue;
    vistos.add(contacto);
    if (r.enviados + r.falhados > 0) await espera(INTERVALO_MS);
    const texto = textoSemPropostas(c.motivo, c.pedidoId, d.canal);
    let saiu = false;
    if (d.canal === "whatsapp") {
      const { enviarAvisoWhatsApp } = await import("./whatsapp-cloud");
      saiu = await enviarAvisoWhatsApp(cliente.telemovel!, texto, { semLinguaErrada: true }).catch(() => false);
    } else {
      const { enviarEmailDoSeguimento } = await import("./seguimento-da-app-envio");
      saiu = await enviarEmailDoSeguimento({ para: cliente.email!, assunto: assuntoSemPropostas(c.pedidoId), texto }).catch(() => false);
    }
    await pool.execute(
      saiu
        ? "UPDATE semPropostasAoCliente SET estado = 'enviado', enviadoEm = UTC_TIMESTAMP() WHERE pedidoId = ?"
        : "UPDATE semPropostasAoCliente SET estado = 'falhou', porque = 'o envio não saiu (bloqueado, desligado ou sem tradução)' WHERE pedidoId = ?",
      [c.pedidoId],
    );
    if (saiu) r.enviados += 1;
    else r.falhados += 1;
    await appendOrderHistory(c.pedidoId, {
      type: "note",
      by: null,
      message: saiu
        ? `Pedido ${MOTIVOS_SEM_PROPOSTAS[c.motivo]}: a Vitória avisou o cliente ${d.canal === "whatsapp" ? "pelo WhatsApp" : "por email"} (d102).`
        : `Pedido ${MOTIVOS_SEM_PROPOSTAS[c.motivo]}: o aviso automático ao cliente não saiu — avisar à mão (d102).`,
    }).catch(() => {});
  }
  return r;
}

export function resumoSemPropostas(r: ResultadoSemPropostas): string | null {
  if (r.candidatos === 0) return null;
  return `${r.candidatos} pedido(s) sem propostas · ${r.enviados} avisado(s) · ${r.ficam} com a equipa · ${r.esperam} à espera` + (r.falhados ? ` · ${r.falhados} falhado(s)` : "");
}
