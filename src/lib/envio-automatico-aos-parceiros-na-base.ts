/**
 * O ENVIO AUTOMÁTICO AOS PARCEIROS, NA BASE — 22-11-2026 (decisão d87, CEO e
 * dono). As regras puras estão em `envio-automatico-aos-parceiros.ts`. Aqui:
 *
 *  - o interruptor de emergência «Envio automático aos parceiros» (Configs),
 *    na tabela dos interruptores (`retencaoInterruptores`), LIGADO por omissão
 *    (sem linha); desligado — ou com a base a falhar a lê-lo — nada sai;
 *  - `envioAutomaticoAosParceiros` — UMA linha por pedido: o estado do envio
 *    automático (a enviar, enviado, na fila, ficou), o motivo, a quantos
 *    parceiros chegaria e a quantos chegou. É a RESERVA: antes de enviar,
 *    ganha-a quem a escrever (affectedRows = 1) — duas mensagens do cliente ao
 *    mesmo tempo, ou a rotina e uma mensagem, nunca enviam duas vezes;
 *  - `seguirSozinhoParaOsParceiros`, chamado pela Vitória quando o pedido fica
 *    completo (whatsapp-negociacao.ts) e pela rotina das 8h00; envia pela MESMA
 *    função do «Enviar aos profissionais» da Mesa (`enviarAosProfissionais`);
 *  - a rotina (`/api/cron/envio-aos-parceiros`, de 15 em 15 minutos) que solta
 *    a fila das 8h00 e fecha os envios que ficaram a meio;
 *  - a linha de cada pedido no cartão dos «por enviar» da Mesa.
 *
 * Nunca DELETE: a linha fica, com o que aconteceu.
 */

import {
  appendOrderHistory,
  ensureRegistoTable,
  getPool,
  getSimulatorOrderById,
  mensagensDoNumeroWhatsApp,
  negociacoesDoPedido,
  numeroBloqueadoWhatsApp,
  registarNaTransaccao,
} from "@/lib/db";
import { instanteDaBase } from "@/lib/hora-de-lisboa";
import { oQueFaltaNoPedido, type PedidoParaOQueFalta } from "@/lib/o-que-falta-no-pedido";
import { codigoPostalGuardado } from "@/lib/morada-partida";
import { coordenadasDoPedido } from "@/lib/coordenadas-do-pedido";
import { avaliarAlcance } from "@/lib/distribuir-pedido";
import { enviarAosProfissionais } from "@/lib/enviar-aos-profissionais";
import { urlDeAccao } from "@/lib/url-do-site";
import {
  aEquipaEscreveuDepoisDoModelo,
  coordenadasValidas,
  historicoDaFila,
  historicoDoQueFicou,
  lerMotivo,
  linhaDoEnvioAutomaticoNaMesa,
  naJanelaDoEnvioAutomatico,
  NOME_DO_INTERRUPTOR_DO_ENVIO_AUTOMATICO,
  porqueNaoSegueSozinho,
  type LinhaDoEnvioAutomatico,
  type MotivoDoEnvioAutomatico,
} from "@/lib/envio-automatico-aos-parceiros";

/* ── As tabelas ──────────────────────────────────────────────────────────── */

export const CHAVE_DO_ENVIO_AUTOMATICO = "envio_automatico_parceiros_d87";

export type InterruptorDoEnvioAutomatico = { ligado: boolean; mudadoEm: string | null; porQuem: string | null };

type Pool = NonNullable<Awaited<ReturnType<typeof getPool>>>;

let tabelasProntas = false;

export const SQL_DAS_TABELAS_DO_ENVIO_AUTOMATICO = [
  `CREATE TABLE IF NOT EXISTS retencaoInterruptores (
      chave     VARCHAR(40) NOT NULL PRIMARY KEY,
      ligado    TINYINT(1) NOT NULL DEFAULT 0,
      mudadoEm  DATETIME NULL DEFAULT NULL,
      porQuem   VARCHAR(120) NULL DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS envioAutomaticoAosParceiros (
      pedidoId   INT UNSIGNED NOT NULL PRIMARY KEY,
      estado     VARCHAR(12) NOT NULL,
      motivo     VARCHAR(24) NULL DEFAULT NULL,
      origem     VARCHAR(20) NULL DEFAULT NULL,
      enviariaA  INT NULL DEFAULT NULL,
      receberam  INT NULL DEFAULT NULL,
      criadoEm   DATETIME NOT NULL,
      mudadoEm   DATETIME NOT NULL,
      enviadoEm  DATETIME NULL DEFAULT NULL,
      KEY idx_envio_automatico_estado (estado, criadoEm)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

async function garantirTabelas(): Promise<Pool> {
  const pool = await getPool();
  if (!pool) throw new Error("[envio-automatico] base de dados indisponível");
  if (!tabelasProntas) {
    for (const sql of SQL_DAS_TABELAS_DO_ENVIO_AUTOMATICO) await pool.execute(sql);
    tabelasProntas = true;
  }
  return pool;
}

const linhasMudadas = (r: unknown) => Number((r as { affectedRows?: number } | undefined)?.affectedRows ?? 0);

/* ── O interruptor de emergência (Configs) — LIGADO por omissão ──────────── */

/** LIGADO SEM LINHA (o dono pediu). Com a base a falhar, DESLIGADO — sem saber, não se envia. */
export async function interruptorDoEnvioAutomatico(): Promise<InterruptorDoEnvioAutomatico> {
  try {
    const pool = await garantirTabelas();
    const [rows] = (await pool.execute(
      "SELECT ligado, mudadoEm, porQuem FROM retencaoInterruptores WHERE chave = ? LIMIT 1",
      [CHAVE_DO_ENVIO_AUTOMATICO],
    )) as [Array<{ ligado: number; mudadoEm: Date | string | null; porQuem: string | null }>, unknown];
    const l = rows[0];
    if (!l) return { ligado: true, mudadoEm: null, porQuem: null };
    return {
      ligado: Number(l.ligado) === 1,
      mudadoEm: l.mudadoEm ? (instanteDaBase(l.mudadoEm)?.toISOString() ?? null) : null,
      porQuem: l.porQuem ?? null,
    };
  } catch (e) {
    console.error("[envio-automatico] não li o interruptor — fica desligado:", e instanceof Error ? e.message : e);
    return { ligado: false, mudadoEm: null, porQuem: null };
  }
}

/** Liga ou desliga; a mudança e quem a fez ficam no registo permanente, na mesma transacção. */
export async function mudarInterruptorDoEnvioAutomatico(ligar: boolean, porQuem: string): Promise<InterruptorDoEnvioAutomatico> {
  const pool = await garantirTabelas();
  await ensureRegistoTable();
  const antes = await interruptorDoEnvioAutomatico();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO retencaoInterruptores (chave, ligado, mudadoEm, porQuem) VALUES (?, ?, UTC_TIMESTAMP(), ?)
       ON DUPLICATE KEY UPDATE ligado = VALUES(ligado), mudadoEm = VALUES(mudadoEm), porQuem = VALUES(porQuem)`,
      [CHAVE_DO_ENVIO_AUTOMATICO, ligar ? 1 : 0, porQuem.slice(0, 120)],
    );
    await registarNaTransaccao(conn, {
      acontecimento: "envio_automatico_interruptor",
      autorTipo: "clyon",
      autorNome: porQuem,
      estadoAntes: antes.ligado ? "ligado" : "desligado",
      estadoDepois: ligar ? "ligado" : "desligado",
      resumo: `«${NOME_DO_INTERRUPTOR_DO_ENVIO_AUTOMATICO}» ${ligar ? "LIGADO" : "DESLIGADO"} por ${porQuem} (d87).`,
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
  return interruptorDoEnvioAutomatico();
}

/* ── A reserva, a fila e o que ficou ─────────────────────────────────────── */

export type OrigemDoEnvioAutomatico = "pedir_o_que_falta" | "registado" | "fila";

/**
 * A RESERVA — só quem a ganha envia. Uma linha nova («a enviar»), ou uma que
 * estava na fila ou tinha ficado; nunca uma «a enviar» nem uma «enviado».
 */
export async function reservarOEnvio(pool: Pool, pedidoId: number, origem: OrigemDoEnvioAutomatico): Promise<boolean> {
  const [nova] = await pool.execute(
    `INSERT IGNORE INTO envioAutomaticoAosParceiros (pedidoId, estado, origem, criadoEm, mudadoEm)
     VALUES (?, 'a_enviar', ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
    [pedidoId, origem],
  );
  if (linhasMudadas(nova) === 1) return true;
  const [deVolta] = await pool.execute(
    `UPDATE envioAutomaticoAosParceiros SET estado = 'a_enviar', motivo = NULL, mudadoEm = UTC_TIMESTAMP()
      WHERE pedidoId = ? AND estado IN ('na_fila', 'ficou')`,
    [pedidoId],
  );
  return linhasMudadas(deVolta) === 1;
}

/** Na fila para as 8h00. Devolve `true` só quando entrou agora (para o histórico dizer uma vez). */
async function porNaFila(pool: Pool, pedidoId: number, origem: OrigemDoEnvioAutomatico, enviariaA: number): Promise<boolean> {
  const [nova] = await pool.execute(
    `INSERT IGNORE INTO envioAutomaticoAosParceiros (pedidoId, estado, origem, enviariaA, criadoEm, mudadoEm)
     VALUES (?, 'na_fila', ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
    [pedidoId, origem, enviariaA],
  );
  if (linhasMudadas(nova) === 1) return true;
  const [deVolta] = await pool.execute(
    `UPDATE envioAutomaticoAosParceiros SET estado = 'na_fila', motivo = NULL, enviariaA = ?, mudadoEm = UTC_TIMESTAMP()
      WHERE pedidoId = ? AND estado = 'ficou'`,
    [enviariaA, pedidoId],
  );
  return linhasMudadas(deVolta) === 1;
}

/**
 * FICA NOS «POR ENVIAR», com o motivo. Nunca por cima de um «enviado» nem de
 * um «a enviar» de outra execução. Devolve `true` quando o motivo é novo (o
 * histórico diz-se uma vez por motivo).
 */
async function ficaComOMotivo(
  pool: Pool,
  pedidoId: number,
  origem: OrigemDoEnvioAutomatico,
  motivo: MotivoDoEnvioAutomatico,
  enviariaA: number | null,
  daReserva = false,
): Promise<boolean> {
  const [nova] = await pool.execute(
    `INSERT IGNORE INTO envioAutomaticoAosParceiros (pedidoId, estado, motivo, origem, enviariaA, criadoEm, mudadoEm)
     VALUES (?, 'ficou', ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
    [pedidoId, motivo, origem, enviariaA],
  );
  if (linhasMudadas(nova) === 1) return true;
  // A execução que tem a reserva fecha a dela («a enviar» → «ficou»); as outras só mexem no que não está a correr.
  const [mudou] = await pool.execute(
    `UPDATE envioAutomaticoAosParceiros SET estado = 'ficou', motivo = ?, enviariaA = ?, mudadoEm = UTC_TIMESTAMP()
      WHERE pedidoId = ? AND ${daReserva ? "estado = 'a_enviar'" : "estado IN ('na_fila', 'ficou')"}
        AND (estado <> 'ficou' OR motivo IS NULL OR motivo <> ?)`,
    [motivo, enviariaA, pedidoId, motivo],
  );
  return linhasMudadas(mudou) === 1;
}

async function marcarEnviado(pool: Pool, pedidoId: number, receberam: number): Promise<void> {
  await pool.execute(
    `UPDATE envioAutomaticoAosParceiros
        SET estado = 'enviado', motivo = NULL, receberam = ?, enviadoEm = UTC_TIMESTAMP(), mudadoEm = UTC_TIMESTAMP()
      WHERE pedidoId = ?`,
    [receberam, pedidoId],
  );
}

/* ── Seguir sozinho ──────────────────────────────────────────────────────── */

export type ResultadoDoEnvioAutomatico =
  | { estado: "enviado"; receberam: number }
  | { estado: "na_fila"; enviariaA: number }
  | { estado: "ficou"; motivo: MotivoDoEnvioAutomatico; enviariaA?: number }
  /** Já tinha negociações vivas — enviado antes (pela Mesa ou por outra execução). */
  | { estado: "ja_enviado" }
  /** Outra execução tem a reserva: não se envia duas vezes. */
  | { estado: "reservado" };

const VIVAS = ["aberta", "aguarda_contratacao", "acordada"];

function emailsDeTesteDoAmbiente(): Set<string> {
  return new Set(
    (process.env.EUPAGO_EMAILS_DE_TESTE ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@")),
  );
}

/**
 * O PEDIDO COMPLETO PELA VITÓRIA SEGUE SOZINHO PARA OS PARCEIROS? — e, se
 * sim, segue: pela MESMA função da Mesa (`enviarAosProfissionais`), com a
 * reserva ganha antes. Todas as condições de `envio-automatico-aos-parceiros.ts`
 * se vêem aqui, por esta ordem; a primeira que falha deixa-o nos «por enviar»
 * com o motivo (no cartão e no histórico). Fora das 8h–21h, fica na fila.
 * Nunca lança: um erro deixa-o nos «por enviar», como hoje.
 */
export async function seguirSozinhoParaOsParceiros(
  pedidoId: number,
  opcoes: {
    origem: OrigemDoEnvioAutomatico;
    /** A descrição ficou por traduzir (d46) — quem a escreveu sabe. */
    porTraduzir?: boolean;
    /** Registado sem o SIM do cliente ao resumo. */
    registadoSozinho?: boolean;
    agora?: Date;
  },
): Promise<ResultadoDoEnvioAutomatico> {
  const agora = opcoes.agora ?? new Date();
  let pool: Pool;
  try {
    pool = await garantirTabelas();
  } catch (e) {
    console.error("[envio-automatico] sem base — fica nos «por enviar»:", e instanceof Error ? e.message : e);
    return { estado: "ficou", motivo: "falhou" };
  }
  const ficar = async (motivo: MotivoDoEnvioAutomatico, enviariaA: number | null = null, daReserva = false) => {
    const novo = await ficaComOMotivo(pool, pedidoId, opcoes.origem, motivo, enviariaA, daReserva).catch(() => false);
    if (novo) {
      await appendOrderHistory(pedidoId, { type: "created", by: null, message: historicoDoQueFicou(motivo, enviariaA) }).catch(() => {});
    }
    return { estado: "ficou" as const, motivo, ...(enviariaA != null ? { enviariaA } : {}) };
  };

  try {
    const pedido = await getSimulatorOrderById(pedidoId);
    if (!pedido) return { estado: "ficou", motivo: "fechado" };
    // Já foi enviado (pela Mesa, ou por outra execução que já acabou): nada a fazer, e nada a escrever.
    if ((await negociacoesDoPedido(pedidoId)).some((n) => VIVAS.includes(n.estado))) return { estado: "ja_enviado" };

    const p = pedido as unknown as PedidoParaOQueFalta & {
      status?: string | null;
      contactEmail?: string | null;
      contactPhone?: string | null;
      valorFixoClyon?: unknown;
      precisaFatura?: unknown;
      precisaGuiaTransporte?: unknown;
      formaDePagamento?: unknown;
    };
    const rawOrderJson = typeof p.rawOrderJson === "string" ? p.rawOrderJson : JSON.stringify(p.rawOrderJson ?? {});
    const motivo = porqueNaoSegueSozinho(
      {
        status: p.status,
        serviceType: p.serviceType,
        contactName: p.contactName,
        contactEmail: p.contactEmail,
        faltas: oQueFaltaNoPedido(p),
        codigoPostal: (typeof p.postalCode === "string" && p.postalCode.trim()) || codigoPostalGuardado(rawOrderJson),
        valorFixoClyon: p.valorFixoClyon,
        porTraduzir: opcoes.porTraduzir === true,
        registadoSozinho: opcoes.registadoSozinho === true,
      },
      emailsDeTesteDoAmbiente(),
    );
    /*
     * INCOMPLETO NÃO É CANDIDATO: a Mesa já mostra o que falta, e o pedido que
     * a Vitória regista sem tudo não leva uma linha a dizê-lo outra vez (nem no
     * histórico). Quando ficar completo pela resposta do cliente, vê-se de novo.
     */
    if (motivo === "incompleto") return { estado: "ficou", motivo };
    if (motivo) return await ficar(motivo);

    // A regra d73: a equipa escreveu à mão depois do último envio de modelo.
    const telefone = String(p.contactPhone ?? "");
    const fio = telefone.replace(/\D/g, "").length >= 9 ? await mensagensDoNumeroWhatsApp(telefone, 40).catch(() => []) : [];
    if (aEquipaEscreveuDepoisDoModelo(fio)) return await ficar("equipa_escreveu");
    if (telefone && (await numeroBloqueadoWhatsApp(telefone).catch(() => false))) return await ficar("bloqueado");

    // As coordenadas (a distribuição precisa delas), indo buscá-las como a Mesa faz.
    const geo = await coordenadasDoPedido(pedido);
    if (!coordenadasValidas(geo.lat, geo.lng)) return await ficar("sem_coordenadas");

    // Os parceiros elegíveis — a MESMA avaliação da distribuição (`avaliarAlcance`).
    const alcance = await avaliarAlcance({
      pedidoId,
      urgency: p.urgency ?? null,
      serviceType: p.serviceType ?? null,
      precisaFatura: Boolean(p.precisaFatura),
      precisaGuiaTransporte: Boolean(p.precisaGuiaTransporte),
      city: p.city ?? null,
      lat: geo.lat,
      lng: geo.lng,
      formaDePagamento: p.formaDePagamento,
    });
    const enviariaA = alcance.elegiveis.length;
    if (enviariaA === 0) return await ficar("sem_parceiros");

    // O interruptor de emergência: desligado, fica como hoje, e o cartão diz a quantos iria.
    if (!(await interruptorDoEnvioAutomatico()).ligado) return await ficar("desligado", enviariaA);

    // Fora das 8h–21h de Lisboa: na fila, sai às 8h00.
    if (!naJanelaDoEnvioAutomatico(agora)) {
      const entrou = await porNaFila(pool, pedidoId, opcoes.origem, enviariaA);
      if (entrou) await appendOrderHistory(pedidoId, { type: "created", by: null, message: historicoDaFila(enviariaA) }).catch(() => {});
      return { estado: "na_fila", enviariaA };
    }

    // A reserva: só quem a ganha envia.
    if (!(await reservarOEnvio(pool, pedidoId, opcoes.origem))) return { estado: "reservado" };

    const r = await enviarAosProfissionais(pedidoId, { baseUrl: urlDeAccao(), pelaVitoria: true });
    if (!r.ok) {
      console.error(`[envio-automatico] o pedido #${pedidoId} não seguiu: ${r.status} ${r.error}`);
      return await ficar("falhou", enviariaA, true);
    }
    if (r.receberam > 0) {
      await marcarEnviado(pool, pedidoId, r.receberam);
      console.info(`[envio-automatico] pedido #${pedidoId} enviado a ${r.receberam} parceiro(s) pela Vitória (d87)`);
      return { estado: "enviado", receberam: r.receberam };
    }
    return await ficar("nao_chegou", enviariaA, true);
  } catch (e) {
    console.error(`[envio-automatico] o pedido #${pedidoId} ficou nos «por enviar»:`, e instanceof Error ? e.message : e);
    return await ficar("falhou", null, true).catch(() => ({ estado: "ficou" as const, motivo: "falhou" as const }));
  }
}

/* ── A rotina das 8h00 (de 15 em 15 minutos) ─────────────────────────────── */

export type ResultadoDaRotinaDoEnvioAutomatico = {
  desligado: boolean;
  foraDaJanela: boolean;
  naFila: number;
  enviados: number;
  ficaram: number;
  interrompidos: number;
};

/** Quantos se soltam por passagem: cada envio fala com o Google e com o email, e a rotina tem 60 s. */
export const POR_PASSAGEM = 5;

export async function rotinaDoEnvioAutomatico(agora: Date = new Date()): Promise<ResultadoDaRotinaDoEnvioAutomatico> {
  const r: ResultadoDaRotinaDoEnvioAutomatico = { desligado: false, foraDaJanela: false, naFila: 0, enviados: 0, ficaram: 0, interrompidos: 0 };
  const pool = await garantirTabelas();
  // Um envio que ficou «a enviar» mais de 15 minutos morreu a meio: fica para a equipa (nunca se reenvia sozinho).
  const [presos] = await pool.execute(
    `UPDATE envioAutomaticoAosParceiros SET estado = 'ficou', motivo = 'interrompido', mudadoEm = UTC_TIMESTAMP()
      WHERE estado = 'a_enviar' AND mudadoEm < UTC_TIMESTAMP() - INTERVAL 15 MINUTE`,
  );
  r.interrompidos = linhasMudadas(presos);
  if (!(await interruptorDoEnvioAutomatico()).ligado) {
    r.desligado = true;
    return r;
  }
  if (!naJanelaDoEnvioAutomatico(agora)) {
    r.foraDaJanela = true;
    return r;
  }
  const [rows] = (await pool.execute(
    `SELECT pedidoId FROM envioAutomaticoAosParceiros WHERE estado = 'na_fila' ORDER BY criadoEm ASC LIMIT ${POR_PASSAGEM}`,
  )) as [Array<{ pedidoId: number }>, unknown];
  r.naFila = rows.length;
  for (const l of rows) {
    const e = await seguirSozinhoParaOsParceiros(Number(l.pedidoId), { origem: "fila", agora });
    if (e.estado === "enviado") r.enviados++;
    else if (e.estado === "ficou") r.ficaram++;
  }
  return r;
}

export function resumoDaRotinaDoEnvioAutomatico(r: ResultadoDaRotinaDoEnvioAutomatico): string | null {
  const partes: string[] = [];
  if (r.interrompidos > 0) partes.push(`${r.interrompidos} interrompido(s), para a equipa`);
  if (r.desligado) partes.push("desligado nas Configs");
  else if (r.foraDaJanela) partes.push("fora das 8h–21h");
  else if (r.naFila > 0) partes.push(`${r.enviados} enviado(s), ${r.ficaram} ficaram nos «por enviar»`);
  return partes.length > 0 ? partes.join("; ") : null;
}

/* ── O cartão dos «por enviar» na Mesa ───────────────────────────────────── */

/** A linha do envio automático de cada pedido (só os que a têm). Nunca rebenta a Mesa. */
export async function linhasDoEnvioAutomaticoNaMesa(ids: number[]): Promise<Map<number, string>> {
  const m = new Map<number, string>();
  const limpos = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))];
  if (limpos.length === 0) return m;
  try {
    const pool = await garantirTabelas();
    const [rows] = (await pool.execute(
      `SELECT pedidoId, estado, motivo, enviariaA, mudadoEm FROM envioAutomaticoAosParceiros
        WHERE pedidoId IN (${limpos.map(() => "?").join(",")})`,
      limpos,
    )) as [Array<Record<string, unknown>>, unknown];
    const { ligado } = await interruptorDoEnvioAutomatico();
    for (const l of rows) {
      const estado = String(l.estado ?? "");
      if (!["a_enviar", "enviado", "na_fila", "ficou"].includes(estado)) continue;
      const linha: LinhaDoEnvioAutomatico = {
        estado: estado as LinhaDoEnvioAutomatico["estado"],
        motivo: lerMotivo(l.motivo),
        enviariaA: l.enviariaA == null ? null : Number(l.enviariaA),
        mudadoEm: instanteDaBase(l.mudadoEm as string | Date | null),
      };
      const texto = linhaDoEnvioAutomaticoNaMesa(linha, ligado);
      if (texto) m.set(Number(l.pedidoId), texto);
    }
  } catch (e) {
    console.error("[envio-automatico] a Mesa fica sem as linhas:", e instanceof Error ? e.message : e);
  }
  return m;
}
