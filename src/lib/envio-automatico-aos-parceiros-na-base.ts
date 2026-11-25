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
 *    completo (whatsapp-negociacao.ts) e pela rotina das 9h00; envia pela MESMA
 *    função do «Enviar aos profissionais» da Mesa (`enviarAosProfissionais`);
 *  - a rotina (`/api/cron/envio-aos-parceiros`, de 15 em 15 minutos) que solta
 *    a fila das 9h00 e fecha os envios que ficaram a meio;
 *  - a linha de cada pedido no cartão dos «por enviar» da Mesa.
 *
 * d88 (23-11-2026, CEO e dono): a MESMA rotina varre também os «Orçamentos
 * novos» de todas as origens (simulador, formulário, WhatsApp, registado na
 * Mesa) e manda os completos pela mesma função, com as condições da d87 e as
 * que os deixam sempre com uma pessoa (`porqueFicaComUmaPessoa`), depois dos 10
 * minutos de espera. O mesmo interruptor (agora «todas as origens») e uma
 * segunda chave, «Só os da Vitória», desligada por omissão.
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
  numeroInterrompidoWhatsApp,
  pedidosPorPromover,
  registarNaTransaccao,
} from "@/lib/db";
import { instanteDaBase } from "@/lib/hora-de-lisboa";
import { ESTADOS_DE_PEDIDO_FECHADO_SQL } from "@/lib/pedido-arrumado";
import { oQueFaltaNoPedido, type PedidoParaOQueFalta } from "@/lib/o-que-falta-no-pedido";
import { codigoPostalGuardado } from "@/lib/morada-partida";
import { coordenadasDoPedido } from "@/lib/coordenadas-do-pedido";
import { avaliarAlcance } from "@/lib/distribuir-pedido";
import { enviarAosProfissionais } from "@/lib/enviar-aos-profissionais";
import { foraDaZonaDoPedido } from "@/lib/fora-da-zona-na-base";
import { urlDeAccao } from "@/lib/url-do-site";
import { arrumarAsFaltas } from "@/lib/mensagem-do-que-falta";
import {
  aEquipaEscreveuDepoisDoModelo,
  canalDoAvisoAoCliente,
  coordenadasValidas,
  estimativaComIva,
  historicoDaEspera,
  historicoDaFila,
  historicoDoQueFicou,
  horaDeSaida,
  lerMotivo,
  linhaDoEnvioAutomaticoNaMesa,
  naJanelaDoEnvioAutomatico,
  NOME_DO_INTERRUPTOR_DO_ENVIO_AUTOMATICO,
  NOME_DO_INTERRUPTOR_SO_DA_VITORIA,
  origemNoEnvioAutomatico,
  porqueFicaComUmaPessoa,
  porqueNaoSegueSozinho,
  registadoSozinhoNoHistorico,
  seguirSoDepoisDe,
  slugDaOrigem,
  type LinhaDoEnvioAutomatico,
  type MotivoDoEnvioAutomatico,
  type OrigemNoEnvioAutomatico,
} from "@/lib/envio-automatico-aos-parceiros";

/* ── As tabelas ──────────────────────────────────────────────────────────── */

export const CHAVE_DO_ENVIO_AUTOMATICO = "envio_automatico_parceiros_d87";
/** A segunda chave (d88): ligada, só os da Vitória seguem sozinhos (o comportamento da d87). */
export const CHAVE_SO_DA_VITORIA = "envio_automatico_so_vitoria_d88";

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
      seguirApos DATETIME NULL DEFAULT NULL,
      vistoEm    DATETIME NULL DEFAULT NULL,
      KEY idx_envio_automatico_estado (estado, criadoEm)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

/**
 * As colunas da d88 numa tabela que a d87 já criou: `seguirApos` (a espera dos
 * 10 minutos — não sai antes) e `vistoEm` (quando a rotina o viu pela última
 * vez, para rever os que ficaram uma vez por hora e não a cada passagem).
 */
export const SQL_DAS_COLUNAS_DA_D88 = [
  "ALTER TABLE envioAutomaticoAosParceiros ADD COLUMN seguirApos DATETIME NULL DEFAULT NULL",
  "ALTER TABLE envioAutomaticoAosParceiros ADD COLUMN vistoEm DATETIME NULL DEFAULT NULL",
];

async function garantirTabelas(): Promise<Pool> {
  const pool = await getPool();
  if (!pool) throw new Error("[envio-automatico] base de dados indisponível");
  if (!tabelasProntas) {
    for (const sql of SQL_DAS_TABELAS_DO_ENVIO_AUTOMATICO) await pool.execute(sql);
    for (const sql of SQL_DAS_COLUNAS_DA_D88) {
      try {
        await pool.execute(sql);
      } catch (e) {
        // Já existe (ER_DUP_FIELDNAME): é o caso de todas as vezes menos a primeira.
        if ((e as { code?: string })?.code !== "ER_DUP_FIELDNAME") {
          console.error("[envio-automatico] coluna da d88:", e instanceof Error ? e.message : e);
        }
      }
    }
    tabelasProntas = true;
  }
  return pool;
}

const linhasMudadas = (r: unknown) => Number((r as { affectedRows?: number } | undefined)?.affectedRows ?? 0);

/* ── Os interruptores (Configs) ──────────────────────────────────────────── */

async function lerChave(chave: string, semLinha: boolean, comErro: boolean): Promise<InterruptorDoEnvioAutomatico> {
  try {
    const pool = await garantirTabelas();
    const [rows] = (await pool.execute(
      "SELECT ligado, mudadoEm, porQuem FROM retencaoInterruptores WHERE chave = ? LIMIT 1",
      [chave],
    )) as [Array<{ ligado: number; mudadoEm: Date | string | null; porQuem: string | null }>, unknown];
    const l = rows[0];
    if (!l) return { ligado: semLinha, mudadoEm: null, porQuem: null };
    return {
      ligado: Number(l.ligado) === 1,
      mudadoEm: l.mudadoEm ? (instanteDaBase(l.mudadoEm)?.toISOString() ?? null) : null,
      porQuem: l.porQuem ?? null,
    };
  } catch (e) {
    console.error(`[envio-automatico] não li o interruptor ${chave}:`, e instanceof Error ? e.message : e);
    return { ligado: comErro, mudadoEm: null, porQuem: null };
  }
}

/** LIGADO SEM LINHA (o dono pediu). Com a base a falhar, DESLIGADO — sem saber, não se envia. */
export async function interruptorDoEnvioAutomatico(): Promise<InterruptorDoEnvioAutomatico> {
  return lerChave(CHAVE_DO_ENVIO_AUTOMATICO, true, false);
}

/**
 * «SÓ OS DA VITÓRIA» (d88): DESLIGADA sem linha — todas as origens seguem. Com
 * a base a falhar, LIGADA: sem saber, a rotina não varre os «Orçamentos novos».
 */
export async function soOsDaVitoria(): Promise<InterruptorDoEnvioAutomatico> {
  return lerChave(CHAVE_SO_DA_VITORIA, false, true);
}

async function mudarChave(chave: string, nome: string, ligar: boolean, porQuem: string, antes: boolean): Promise<void> {
  const pool = await garantirTabelas();
  await ensureRegistoTable();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO retencaoInterruptores (chave, ligado, mudadoEm, porQuem) VALUES (?, ?, UTC_TIMESTAMP(), ?)
       ON DUPLICATE KEY UPDATE ligado = VALUES(ligado), mudadoEm = VALUES(mudadoEm), porQuem = VALUES(porQuem)`,
      [chave, ligar ? 1 : 0, porQuem.slice(0, 120)],
    );
    await registarNaTransaccao(conn, {
      acontecimento: "envio_automatico_interruptor",
      autorTipo: "clyon",
      autorNome: porQuem,
      estadoAntes: antes ? "ligado" : "desligado",
      estadoDepois: ligar ? "ligado" : "desligado",
      resumo: `«${nome}» ${ligar ? "LIGADO" : "DESLIGADO"} por ${porQuem} (d87/d88).`,
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
}

/** Liga ou desliga; a mudança e quem a fez ficam no registo permanente, na mesma transacção. */
export async function mudarInterruptorDoEnvioAutomatico(ligar: boolean, porQuem: string): Promise<InterruptorDoEnvioAutomatico> {
  const antes = await interruptorDoEnvioAutomatico();
  await mudarChave(CHAVE_DO_ENVIO_AUTOMATICO, NOME_DO_INTERRUPTOR_DO_ENVIO_AUTOMATICO, ligar, porQuem, antes.ligado);
  return interruptorDoEnvioAutomatico();
}

/** A segunda chave (d88), com o mesmo registo permanente. */
export async function mudarSoOsDaVitoria(ligar: boolean, porQuem: string): Promise<InterruptorDoEnvioAutomatico> {
  const antes = await soOsDaVitoria();
  await mudarChave(CHAVE_SO_DA_VITORIA, NOME_DO_INTERRUPTOR_SO_DA_VITORIA, ligar, porQuem, antes.ligado);
  return soOsDaVitoria();
}

/* ── A reserva, a fila e o que ficou ─────────────────────────────────────── */

/** `orcamentos_novos` (d88): visto pela rotina que varre os «Orçamentos novos» de todas as origens. */
export type OrigemDoEnvioAutomatico = "pedir_o_que_falta" | "registado" | "fila" | "orcamentos_novos";

/** A origem que a d88 grava na linha: a fila sabe por ela que as condições das origens novas contam. */
export const ORIGEM_DOS_ORCAMENTOS_NOVOS = "orcamentos_novos" satisfies OrigemDoEnvioAutomatico;

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

/** Na fila para as 9h00. Devolve `true` só quando entrou agora (para o histórico dizer uma vez). */
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
 * NA FILA DA d88 — à espera dos 10 minutos (`seguirApos`) ou das 9h00 (null).
 * A linha fica com a origem dos «Orçamentos novos», para a fila voltar a ver as
 * condições das origens novas. Devolve `true` só quando entrou agora (o
 * histórico diz uma vez); quem já estava na fila só muda a hora.
 */
async function porNaFilaDosOrcamentosNovos(pool: Pool, pedidoId: number, enviariaA: number, seguirApos: Date | null): Promise<boolean> {
  const origem = ORIGEM_DOS_ORCAMENTOS_NOVOS;
  const [nova] = await pool.execute(
    `INSERT IGNORE INTO envioAutomaticoAosParceiros (pedidoId, estado, origem, enviariaA, seguirApos, criadoEm, mudadoEm)
     VALUES (?, 'na_fila', ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
    [pedidoId, origem, enviariaA, seguirApos],
  );
  if (linhasMudadas(nova) === 1) return true;
  const [deVolta] = await pool.execute(
    `UPDATE envioAutomaticoAosParceiros
        SET estado = 'na_fila', motivo = NULL, origem = ?, enviariaA = ?, seguirApos = ?, mudadoEm = UTC_TIMESTAMP()
      WHERE pedidoId = ? AND estado = 'ficou'`,
    [origem, enviariaA, seguirApos, pedidoId],
  );
  if (linhasMudadas(deVolta) === 1) return true;
  await pool.execute(
    `UPDATE envioAutomaticoAosParceiros SET origem = ?, enviariaA = ?, seguirApos = ?
      WHERE pedidoId = ? AND estado = 'na_fila'`,
    [origem, enviariaA, seguirApos, pedidoId],
  );
  return false;
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

/**
 * TIRAR DA FILA, COM O MOTIVO (d2, 23-11-2026). Uma linha «na fila» cujo pedido
 * já foi enviado à mão, foi apagado ou deixou de estar completo nunca mais
 * sairia — e, por ser das mais antigas, ocupava o lugar dos que esperam atrás
 * dela. Só mexe na linha da fila de envio (estado «na fila» → «ficou»); nunca
 * no pedido nem noutra tabela.
 */
async function tirarDaFila(pool: Pool, pedidoId: number, motivo: MotivoDoEnvioAutomatico): Promise<void> {
  await pool
    .execute(
      `UPDATE envioAutomaticoAosParceiros SET motivo = ?, estado = 'ficou', mudadoEm = UTC_TIMESTAMP()
        WHERE pedidoId = ? AND estado = 'na_fila'`,
      [motivo, pedidoId],
    )
    .catch(() => undefined);
}

/**
 * HÁ OUTRO PEDIDO ABERTO DO MESMO CONTACTO NOS ÚLTIMOS 7 DIAS? (d2) — pelo
 * telemóvel (os 9 últimos dígitos) ou pelo email. Só contam os criados ANTES
 * deste: o primeiro segue, o repetido fica com uma pessoa (se contassem os dois
 * lados, nenhum seguia nunca). Aberto = nem cancelado, nem arquivado, nem
 * rejeitado, nem concluído.
 */
async function haOutroPedidoAbertoDoMesmoContacto(
  pool: Pool,
  pedidoId: number,
  telefone: unknown,
  email: unknown,
): Promise<boolean> {
  const noves = String(telefone ?? "").replace(/\D/g, "").slice(-9);
  const nove = noves.length === 9 ? noves : "";
  const mail = String(email ?? "").trim().toLowerCase();
  const email1 = mail.includes("@") ? mail : "";
  if (!nove && !email1) return false;
  const [rows] = (await pool.execute(
    `SELECT o.id FROM simulatorOrders o
      WHERE o.id < ? AND o.createdAt > NOW() - INTERVAL 7 DAY
        AND (o.status IS NULL OR o.status NOT IN ${ESTADOS_DE_PEDIDO_FECHADO_SQL})
        AND ((? <> '' AND RIGHT(REGEXP_REPLACE(COALESCE(o.contactPhone, ''), '[^0-9]', ''), 9) = ?)
          OR (? <> '' AND LOWER(COALESCE(o.contactEmail, '')) = ?))
      LIMIT 1`,
    [pedidoId, nove, nove, email1, email1],
  )) as [Array<{ id: number }>, unknown];
  return rows.length > 0;
}

async function marcarEnviado(pool: Pool, pedidoId: number, receberam: number): Promise<void> {
  await pool.execute(
    `UPDATE envioAutomaticoAosParceiros
        SET estado = 'enviado', motivo = NULL, receberam = ?, enviadoEm = UTC_TIMESTAMP(), mudadoEm = UTC_TIMESTAMP()
      WHERE pedidoId = ?`,
    [receberam, pedidoId],
  );
}

/* ── O aviso ao cliente (d88) ────────────────────────────────────────────── */

type MensagemDoFio = { direccao: string; texto: string; haSegundos: number | null };

/**
 * O CLIENTE DOS «ORÇAMENTOS NOVOS» FICA A SABER QUE SEGUIU — pelo canal que
 * usou (`canalDoAvisoAoCliente`). Pelo WhatsApp, a mesma frase da d87 («O seu
 * pedido já seguiu para os parceiros da sua zona. As propostas chegam-lhe por
 * aqui.»), na língua dele ou nada (d63), e nunca no dia em que já saiu outra
 * mensagem automática a este número (d85). Pelo email, nada a mais: a função da
 * Mesa já mandou a ligação do pedido. Nunca lança.
 */
async function avisarOClienteQueSeguiu(
  pedidoId: number,
  contacto: { telefone: string; email: string | null },
  origem: OrigemNoEnvioAutomatico | null,
  fio: ReadonlyArray<MensagemDoFio>,
  agora: Date,
): Promise<void> {
  try {
    if (canalDoAvisoAoCliente(origem, fio.some((m) => m.direccao === "in")) !== "whatsapp") return;
    if (contacto.telefone.replace(/\D/g, "").length < 9) return;
    const { jaSaiuHojeUmaMensagemAutomatica } = await import("@/lib/uma-mensagem-automatica-por-dia");
    if (await jaSaiuHojeUmaMensagemAutomatica({ telefone: contacto.telefone, email: contacto.email }, agora).catch(() => true)) {
      await appendOrderHistory(pedidoId, {
        type: "created",
        by: null,
        message: "O cliente não foi avisado pelo WhatsApp de que seguiu: já saiu hoje outra mensagem automática a este número.",
      }).catch(() => {});
      return;
    }
    const { PEDIDO_JA_SEGUIU } = await import("@/lib/resposta-ao-que-falta");
    const { enviarAvisoWhatsApp } = await import("@/lib/whatsapp-cloud");
    const saiu = await enviarAvisoWhatsApp(contacto.telefone, PEDIDO_JA_SEGUIU, { semLinguaErrada: true }).catch(() => false);
    await appendOrderHistory(pedidoId, {
      type: "created",
      by: null,
      message: saiu
        ? `Cliente avisado pelo WhatsApp: «${PEDIDO_JA_SEGUIU}»`
        : "O aviso ao cliente pelo WhatsApp de que seguiu não saiu.",
    }).catch(() => {});
  } catch (e) {
    console.error(`[envio-automatico] o aviso ao cliente do #${pedidoId} falhou:`, e instanceof Error ? e.message : e);
  }
}

/* ── Seguir sozinho ──────────────────────────────────────────────────────── */

export type ResultadoDoEnvioAutomatico =
  | { estado: "enviado"; receberam: number }
  /** `ate` (d88): à espera dos 10 minutos — sai na primeira passagem depois disto. */
  | { estado: "na_fila"; enviariaA: number; ate?: string }
  | { estado: "ficou"; motivo: MotivoDoEnvioAutomatico; enviariaA?: number }
  /** Já tinha negociações vivas — enviado antes (pela Mesa ou por outra execução). */
  | { estado: "ja_enviado" }
  /** Outra execução tem a reserva: não se envia duas vezes. */
  | { estado: "reservado" };


function emailsDeTesteDoAmbiente(): Set<string> {
  return new Set(
    (process.env.EUPAGO_EMAILS_DE_TESTE ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@")),
  );
}

/**
 * O PEDIDO COMPLETO SEGUE SOZINHO PARA OS PARCEIROS? — e, se sim, segue: pela
 * MESMA função da Mesa (`enviarAosProfissionais`), com a reserva ganha antes.
 * Todas as condições de `envio-automatico-aos-parceiros.ts` se vêem aqui, por
 * esta ordem; a primeira que falha deixa-o nos «por enviar» com o motivo (no
 * cartão e no histórico). Fora das 9h–20h, fica na fila. Nunca lança: um erro
 * deixa-o nos «por enviar», como hoje.
 *
 * Com `todasAsOrigens` (d88 — a rotina dos «Orçamentos novos»): mais as
 * condições que o deixam sempre com uma pessoa, a espera dos 10 minutos e o
 * aviso ao cliente pelo canal dele. Sem ela, é a Vitória (d87), tal e qual.
 */
export async function seguirSozinhoParaOsParceiros(
  pedidoId: number,
  opcoes: {
    origem: OrigemDoEnvioAutomatico;
    /** A descrição ficou por traduzir (d46) — quem a escreveu sabe. */
    porTraduzir?: boolean;
    /** Registado sem o SIM do cliente ao resumo. */
    registadoSozinho?: boolean;
    /** d88: visto pela rotina dos «Orçamentos novos», e não pela Vitória. */
    todasAsOrigens?: boolean;
    /** d2: a rotina está a soltar a FILA — o que já não pode seguir sai da fila, com o motivo. */
    daFila?: boolean;
    agora?: Date;
  },
): Promise<ResultadoDoEnvioAutomatico> {
  const agora = opcoes.agora ?? new Date();
  const todas = opcoes.todasAsOrigens === true;
  let pool: Pool;
  try {
    pool = await garantirTabelas();
  } catch (e) {
    console.error("[envio-automatico] sem base — fica nos «por enviar»:", e instanceof Error ? e.message : e);
    return { estado: "ficou", motivo: "falhou" };
  }
  const daFila = opcoes.daFila === true || opcoes.origem === "fila";
  const ficar = async (motivo: MotivoDoEnvioAutomatico, enviariaA: number | null = null, daReserva = false) => {
    const novo = await ficaComOMotivo(pool, pedidoId, opcoes.origem, motivo, enviariaA, daReserva).catch(() => false);
    if (novo) {
      await appendOrderHistory(pedidoId, { type: "created", by: null, message: historicoDoQueFicou(motivo, enviariaA, !todas) }).catch(() => {});
    }
    return { estado: "ficou" as const, motivo, ...(enviariaA != null ? { enviariaA } : {}) };
  };

  try {
    const pedido = await getSimulatorOrderById(pedidoId);
    if (!pedido) {
      if (daFila) await tirarDaFila(pool, pedidoId, "fechado");
      return { estado: "ficou", motivo: "fechado" };
    }
    /*
     * Já foi enviado (pela Mesa, ou por outra execução que já acabou). Conta
     * QUALQUER negociação, viva ou morta (d2): um pedido enviado à mão, mesmo com
     * as negociações já mortas, nunca volta a sair sozinho. Da fila, sai com o motivo.
     */
    if ((await negociacoesDoPedido(pedidoId)).length > 0) {
      if (daFila) await tirarDaFila(pool, pedidoId, "ja_enviado");
      return { estado: "ja_enviado" };
    }

    const p = pedido as unknown as PedidoParaOQueFalta & {
      status?: string | null;
      contactEmail?: string | null;
      contactPhone?: string | null;
      valorFixoClyon?: unknown;
      precisaFatura?: unknown;
      precisaGuiaTransporte?: unknown;
      formaDePagamento?: unknown;
      createdAt?: Date | string | null;
      historyJson?: string | null;
      notasInternas?: string | null;
      assignedToId?: unknown;
      propostaEnviadaEm?: unknown;
      escolhaDosParceirosJson?: unknown;
      estimateTotal?: unknown;
      estimateMax?: unknown;
      dataAgendada?: Date | string | null;
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
        dataAgendada: p.dataAgendada ?? null,
        agora,
        porTraduzir: opcoes.porTraduzir === true,
        // d88: a rotina não ouviu a Vitória — o histórico diz se ela o registou sem o SIM do cliente.
        registadoSozinho: opcoes.registadoSozinho === true || (todas && registadoSozinhoNoHistorico(p.historyJson)),
        // d128: fora da zona fica com uma pessoa, que confirma a morada com o cliente.
        foraDaZona: (await foraDaZonaDoPedido(pedido)) != null,
      },
      emailsDeTesteDoAmbiente(),
    );
    /*
     * INCOMPLETO NÃO É CANDIDATO: a Mesa já mostra o que falta, e o pedido que
     * a Vitória regista sem tudo não leva uma linha a dizê-lo outra vez (nem no
     * histórico). Quando ficar completo pela resposta do cliente, vê-se de novo.
     */
    if (motivo === "incompleto") {
      if (daFila) await tirarDaFila(pool, pedidoId, "incompleto");
      return { estado: "ficou", motivo };
    }
    if (motivo) return await ficar(motivo);
    // d2: outro pedido aberto do mesmo contacto nos últimos 7 dias — fica com uma pessoa.
    if (await haOutroPedidoAbertoDoMesmoContacto(pool, pedidoId, p.contactPhone, p.contactEmail)) return await ficar("pedido_repetido");

    // d88: os que ficam SEMPRE com uma pessoa — Trabalho CLYON e valor fixo já acima, e estes.
    const origemDoPedido = origemNoEnvioAutomatico(slugDaOrigem(rawOrderJson));
    if (todas) {
      const comUmaPessoa = porqueFicaComUmaPessoa({
        origem: slugDaOrigem(rawOrderJson),
        propostaEnviadaEm: p.propostaEnviadaEm,
        escolhaDosParceirosJson: p.escolhaDosParceirosJson,
        estimativaComIva: estimativaComIva(p.estimateTotal, p.estimateMax),
        notasInternas: p.notasInternas,
        assignedToId: p.assignedToId,
      });
      if (comUmaPessoa) return await ficar(comUmaPessoa);
    }

    // A regra d73: a equipa escreveu à mão depois do último envio de modelo.
    const telefone = String(p.contactPhone ?? "");
    const comTelefone = telefone.replace(/\D/g, "").length >= 9;
    const fio = comTelefone ? await mensagensDoNumeroWhatsApp(telefone, 40).catch(() => []) : [];
    if (aEquipaEscreveuDepoisDoModelo(fio)) return await ficar("equipa_escreveu");
    if (telefone && (await numeroBloqueadoWhatsApp(telefone).catch(() => false))) return await ficar("bloqueado");
    // d88: a conversa passou a uma pessoa da equipa (também quando a descrição ficou por traduzir, d46).
    if (todas && comTelefone && (await numeroInterrompidoWhatsApp(telefone).catch(() => true))) return await ficar("com_a_equipa");

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

    if (todas) {
      // A segunda chave (d88): «Só os da Vitória» ligada — a rotina não manda os das outras origens.
      if ((await soOsDaVitoria()).ligado) return await ficar("so_da_vitoria", enviariaA);
      // A espera dos 10 minutos: depois de entrar, e depois da última mensagem da conversa.
      const ultima = fio.reduce<number | null>((m, x) => (x.haSegundos == null ? m : m == null ? x.haSegundos : Math.min(m, x.haSegundos)), null);
      const ate = seguirSoDepoisDe(instanteDaBase(p.createdAt ?? null), ultima, agora);
      if (ate || !naJanelaDoEnvioAutomatico(agora)) {
        const entrou = await porNaFilaDosOrcamentosNovos(pool, pedidoId, enviariaA, ate);
        if (entrou) {
          const message = ate ? historicoDaEspera(enviariaA, horaDeSaida(ate), agora) : historicoDaFila(enviariaA, false);
          await appendOrderHistory(pedidoId, { type: "created", by: null, message }).catch(() => {});
        }
        return { estado: "na_fila", enviariaA, ...(ate ? { ate: ate.toISOString() } : {}) };
      }
    }

    // Fora das 9h–20h de Lisboa: na fila, sai às 9h00.
    if (!naJanelaDoEnvioAutomatico(agora)) {
      const entrou = await porNaFila(pool, pedidoId, opcoes.origem, enviariaA);
      if (entrou) await appendOrderHistory(pedidoId, { type: "created", by: null, message: historicoDaFila(enviariaA) }).catch(() => {});
      return { estado: "na_fila", enviariaA };
    }

    // A reserva: só quem a ganha envia.
    if (!(await reservarOEnvio(pool, pedidoId, opcoes.origem))) return { estado: "reservado" };

    // A MESMA função do botão «Negociação» da Mesa, com a caixa vazia: a conta da CLYON.
    const r = todas
      ? await enviarAosProfissionais(pedidoId, { baseUrl: urlDeAccao(), automaticamente: true })
      : await enviarAosProfissionais(pedidoId, { baseUrl: urlDeAccao(), pelaVitoria: true });
    if (!r.ok) {
      console.error(`[envio-automatico] o pedido #${pedidoId} não seguiu: ${r.status} ${r.error}`);
      return await ficar("falhou", enviariaA, true);
    }
    if (r.receberam > 0) {
      await marcarEnviado(pool, pedidoId, r.receberam);
      console.info(`[envio-automatico] pedido #${pedidoId} enviado a ${r.receberam} parceiro(s) ${todas ? "pela rotina (d88)" : "pela Vitória (d87)"}`);
      if (todas) await avisarOClienteQueSeguiu(pedidoId, { telefone, email: p.contactEmail ?? null }, origemDoPedido, fio, agora);
      return { estado: "enviado", receberam: r.receberam };
    }
    return await ficar("nao_chegou", enviariaA, true);
  } catch (e) {
    console.error(`[envio-automatico] o pedido #${pedidoId} ficou nos «por enviar»:`, e instanceof Error ? e.message : e);
    return await ficar("falhou", null, true).catch(() => ({ estado: "ficou" as const, motivo: "falhou" as const }));
  }
}

/* ── A rotina (de 15 em 15 minutos) ──────────────────────────────────────── */

export type ResultadoDaRotinaDoEnvioAutomatico = {
  desligado: boolean;
  foraDaJanela: boolean;
  /** Quantos havia na fila (estado «na fila») quando a passagem começou — sempre contado, dentro ou fora do horário. */
  naFila: number;
  enviados: number;
  ficaram: number;
  /** d2: tirados da fila, com o motivo — já enviados à mão, apagados ou deixaram de estar completos. */
  tiradosDaFila: number;
  /** d2: as linhas já presas, limpas no início da passagem. */
  limpas: number;
  interrompidos: number;
  /** d88: os «Orçamentos novos» vistos nesta passagem, os enviados e os que ficaram à espera. */
  vistos: number;
  enviadosDosNovos: number;
  aEsperar: number;
  /** d88: a segunda chave «Só os da Vitória» está ligada — não se varreu. */
  soDaVitoria: boolean;
};

/** Quantos se ENVIAM por passagem (a fila e os «Orçamentos novos» juntos): cada envio fala com o Google e com o email, e a rotina tem 60 s. */
export const POR_PASSAGEM = 5;

/** Quantos «Orçamentos novos» se VÊEM por passagem (d88) — os mais recentes primeiro. */
export const VISTOS_POR_PASSAGEM = 10;

/** Quantas linhas da fila se LEEM por passagem (d2): bem mais do que as que se enviam, para as já fechadas não travarem as que esperam. */
export const VISTOS_DA_FILA_POR_PASSAGEM = 50;

/** Os que saem da fila sem custo de envio: não falam com o Google nem com o email. */
const MOTIVOS_QUE_SAEM_DA_FILA_SEM_CUSTO: ReadonlySet<string> = new Set(["fechado", "incompleto", "data_passada", "pedido_repetido"]);

/**
 * A LIMPEZA DAS LINHAS JÁ PRESAS (d2) — as «na fila» cujo pedido já tem
 * negociações (foi enviado à mão) ou já não existe. Só mexe na tabela do envio
 * automático (estado «na fila» → «ficou», com o motivo); nunca apaga nem muda
 * pedidos, clientes ou negociações. Idempotente: depois da primeira passagem
 * não há mais nada para limpar. Devolve quantas linhas limpou.
 */
async function limparAsLinhasPresasDaFila(pool: Pool): Promise<number> {
  try {
    const [jaEnviados] = await pool.execute(
      `UPDATE envioAutomaticoAosParceiros e SET e.motivo = 'ja_enviado', e.estado = 'ficou', e.mudadoEm = UTC_TIMESTAMP()
        WHERE e.estado = 'na_fila' AND EXISTS (SELECT 1 FROM negociacoes n WHERE n.pedidoId = e.pedidoId)`,
    );
    const [apagados] = await pool.execute(
      `UPDATE envioAutomaticoAosParceiros e SET e.motivo = 'fechado', e.estado = 'ficou', e.mudadoEm = UTC_TIMESTAMP()
        WHERE e.estado = 'na_fila' AND NOT EXISTS (SELECT 1 FROM simulatorOrders o WHERE o.id = e.pedidoId)`,
    );
    return linhasMudadas(jaEnviados) + linhasMudadas(apagados);
  } catch (e) {
    console.error("[envio-automatico] a limpeza da fila falhou:", e instanceof Error ? e.message : e);
    return 0;
  }
}

/** Um pedido que ficou volta a ser visto ao fim de uma hora (o motivo pode ter mudado), e não a cada passagem. */
const MINUTOS_PARA_REVER = 60;

/**
 * Os motivos que NUNCA se revêem sozinhos: um envio que ficou a meio, que não
 * chegou a ninguém ou que falhou passa à equipa (d87); o registado sem o SIM do
 * cliente e a descrição por traduzir só a Vitória os sabe (d46).
 */
const MOTIVOS_QUE_NAO_SE_REVEEM: ReadonlySet<string> = new Set(["falhou", "interrompido", "nao_chegou", "registado_sozinho", "por_traduzir", "ja_enviado"]);

/**
 * OS «ORÇAMENTOS NOVOS» DE TODAS AS ORIGENS (d88). Os abertos da Mesa
 * (`pedidosPorPromover`, a mesma lista do bloco); os incompletos ficam de fora
 * sem custo (a Mesa já diz o que falta); os que nunca foram vistos primeiro, do
 * mais recente para trás, e depois os que ficaram há mais de uma hora. Cada um
 * passa por `seguirSozinhoParaOsParceiros` com todas as condições; no máximo
 * `orcamento` envios.
 */
async function varrerOsOrcamentosNovos(
  pool: Pool,
  agora: Date,
  orcamento: number,
): Promise<{ vistos: number; enviados: number; aEsperar: number; ficaram: number }> {
  const r = { vistos: 0, enviados: 0, aEsperar: 0, ficaram: 0 };
  const abertos = await pedidosPorPromover(100);
  const ids = abertos.map((p) => Number(p.id)).filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) return r;
  const [linhas] = (await pool.execute(
    `SELECT pedidoId, estado, motivo, vistoEm FROM envioAutomaticoAosParceiros
      WHERE pedidoId IN (${ids.map(() => "?").join(",")})`,
    ids,
  )) as [Array<{ pedidoId: number; estado: string; motivo: string | null; vistoEm: Date | string | null }>, unknown];
  const porId = new Map(linhas.map((l) => [Number(l.pedidoId), l]));

  const nuncaVistos: number[] = [];
  const paraRever: Array<{ id: number; visto: number }> = [];
  for (const p of abertos) {
    const id = Number(p.id);
    const { description, filesJson, dataAgendada, rawDoQueFalta, ...resto } = p;
    const faltas = oQueFaltaNoPedido({ ...resto, description, filesJson, dataAgendada, rawOrderJson: rawDoQueFalta } as unknown as PedidoParaOQueFalta);
    if (arrumarAsFaltas(faltas).length > 0) continue;
    const l = porId.get(id);
    if (!l) {
      nuncaVistos.push(id);
      continue;
    }
    if (l.estado !== "ficou" || MOTIVOS_QUE_NAO_SE_REVEEM.has(String(l.motivo ?? ""))) continue;
    const visto = instanteDaBase(l.vistoEm)?.getTime() ?? 0;
    if (agora.getTime() - visto >= MINUTOS_PARA_REVER * 60_000) paraRever.push({ id, visto });
  }
  paraRever.sort((a, b) => a.visto - b.visto);
  const aVer = [...nuncaVistos, ...paraRever.map((x) => x.id)].slice(0, VISTOS_POR_PASSAGEM);

  for (const id of aVer) {
    if (r.enviados >= orcamento) break;
    const e = await seguirSozinhoParaOsParceiros(id, { origem: ORIGEM_DOS_ORCAMENTOS_NOVOS, todasAsOrigens: true, agora });
    r.vistos++;
    if (e.estado === "enviado") r.enviados++;
    else if (e.estado === "na_fila") r.aEsperar++;
    else if (e.estado === "ficou") r.ficaram++;
    await pool
      .execute("UPDATE envioAutomaticoAosParceiros SET vistoEm = ? WHERE pedidoId = ?", [agora, id])
      .catch(() => undefined);
  }
  return r;
}

export async function rotinaDoEnvioAutomatico(agora: Date = new Date()): Promise<ResultadoDaRotinaDoEnvioAutomatico> {
  const r: ResultadoDaRotinaDoEnvioAutomatico = {
    desligado: false,
    foraDaJanela: false,
    naFila: 0,
    enviados: 0,
    ficaram: 0,
    tiradosDaFila: 0,
    limpas: 0,
    interrompidos: 0,
    vistos: 0,
    enviadosDosNovos: 0,
    aEsperar: 0,
    soDaVitoria: false,
  };
  const pool = await garantirTabelas();
  // Um envio que ficou «a enviar» mais de 15 minutos morreu a meio: fica para a equipa (nunca se reenvia sozinho).
  const [presos] = await pool.execute(
    `UPDATE envioAutomaticoAosParceiros SET estado = 'ficou', motivo = 'interrompido', mudadoEm = UTC_TIMESTAMP()
      WHERE estado = 'a_enviar' AND mudadoEm < UTC_TIMESTAMP() - INTERVAL 15 MINUTE`,
  );
  r.interrompidos = linhasMudadas(presos);
  // d2: o resumo diz sempre quantos havia na fila.
  try {
    const [[contagem]] = (await pool.execute(
      "SELECT COUNT(*) AS n FROM envioAutomaticoAosParceiros WHERE estado = 'na_fila'",
    )) as [Array<{ n: number | string }>, unknown];
    r.naFila = Number(contagem?.n ?? 0) || 0;
  } catch (e) {
    console.error("[envio-automatico] não contei a fila:", e instanceof Error ? e.message : e);
  }
  if (!(await interruptorDoEnvioAutomatico()).ligado) {
    r.desligado = true;
    return r;
  }
  r.limpas = await limparAsLinhasPresasDaFila(pool);
  r.soDaVitoria = (await soOsDaVitoria()).ligado;
  const varrer = async () => {
    if (r.soDaVitoria) return;
    try {
      const v = await varrerOsOrcamentosNovos(pool, agora, Math.max(0, POR_PASSAGEM - r.enviados));
      r.vistos = v.vistos;
      r.enviadosDosNovos = v.enviados;
      r.aEsperar = v.aEsperar;
      r.ficaram += v.ficaram;
    } catch (e) {
      console.error("[envio-automatico] a rotina dos «Orçamentos novos» falhou:", e instanceof Error ? e.message : e);
    }
  };
  if (!naJanelaDoEnvioAutomatico(agora)) {
    r.foraDaJanela = true;
    // De noite não sai nada; os completos entram na fila das 9h00 (o cartão diz «Segue sozinho a … às 08:00»).
    await varrer();
    return r;
  }
  // A fila: os da Vitória de fora de horas, e os dos «Orçamentos novos» cuja espera já acabou.
  const [rows] = (await pool.execute(
    `SELECT pedidoId, origem FROM envioAutomaticoAosParceiros
      WHERE estado = 'na_fila' AND (seguirApos IS NULL OR seguirApos <= ?)
        ${r.soDaVitoria ? `AND (origem IS NULL OR origem <> '${ORIGEM_DOS_ORCAMENTOS_NOVOS}')` : ""}
      ORDER BY criadoEm ASC LIMIT ${VISTOS_DA_FILA_POR_PASSAGEM}`,
    [agora],
  )) as [Array<{ pedidoId: number; origem: string | null }>, unknown];
  /*
   * d2: os que se TIRAM da fila sem custo (já enviados à mão, apagados, sem
   * estar completos, a data passada, repetidos) não gastam a vez dos que ficam
   * atrás — senão cinco linhas presas à frente travavam a fila toda.
   */
  let tentados = 0;
  for (const l of rows) {
    if (tentados >= POR_PASSAGEM) break;
    const dosNovos = l.origem === ORIGEM_DOS_ORCAMENTOS_NOVOS;
    const e = await seguirSozinhoParaOsParceiros(Number(l.pedidoId), {
      origem: dosNovos ? ORIGEM_DOS_ORCAMENTOS_NOVOS : "fila",
      todasAsOrigens: dosNovos,
      daFila: true,
      agora,
    });
    if (e.estado === "ja_enviado" || (e.estado === "ficou" && MOTIVOS_QUE_SAEM_DA_FILA_SEM_CUSTO.has(e.motivo))) {
      if (e.estado === "ja_enviado" || e.motivo === "incompleto") r.tiradosDaFila++;
      else r.ficaram++;
      continue;
    }
    tentados++;
    if (e.estado === "enviado") r.enviados++;
    else if (e.estado === "ficou") r.ficaram++;
  }
  await varrer();
  return r;
}

export function resumoDaRotinaDoEnvioAutomatico(r: ResultadoDaRotinaDoEnvioAutomatico): string | null {
  const partes: string[] = [];
  if (r.interrompidos > 0) partes.push(`${r.interrompidos} interrompido(s), para a equipa`);
  if (r.desligado) partes.push(`desligado nas Configs (${r.naFila} na fila)`);
  else {
    if (r.limpas > 0) partes.push(`${r.limpas} linha(s) presa(s) limpa(s) da fila`);
    if (r.foraDaJanela) partes.push(`fora das 9h–20h (${r.naFila} na fila)`);
    else if (r.naFila > 0) {
      partes.push(
        `${r.naFila} na fila: ${r.enviados} enviado(s), ${r.ficaram} ficaram nos «por enviar», ${r.tiradosDaFila} tirado(s) da fila`,
      );
    } else partes.push("0 na fila");
    if (r.soDaVitoria) partes.push("só os da Vitória");
    else if (r.vistos > 0) partes.push(`orçamentos novos: ${r.vistos} visto(s), ${r.enviadosDosNovos} enviado(s), ${r.aEsperar} à espera`);
  }
  return partes.length > 0 ? partes.join("; ") : null;
}

/* ── O cartão dos «por enviar» na Mesa ───────────────────────────────────── */

/** A linha do envio automático de cada pedido (só os que a têm). Nunca rebenta a Mesa. */
export async function linhasDoEnvioAutomaticoNaMesa(ids: number[], agora: Date = new Date()): Promise<Map<number, string>> {
  const m = new Map<number, string>();
  const limpos = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))];
  if (limpos.length === 0) return m;
  try {
    const pool = await garantirTabelas();
    const [rows] = (await pool.execute(
      `SELECT pedidoId, estado, motivo, enviariaA, mudadoEm, seguirApos, origem FROM envioAutomaticoAosParceiros
        WHERE pedidoId IN (${limpos.map(() => "?").join(",")})`,
      limpos,
    )) as [Array<Record<string, unknown>>, unknown];
    const { ligado } = await interruptorDoEnvioAutomatico();
    const soDaVitoria = (await soOsDaVitoria()).ligado;
    for (const l of rows) {
      const estado = String(l.estado ?? "");
      if (!["a_enviar", "enviado", "na_fila", "ficou"].includes(estado)) continue;
      const linha: LinhaDoEnvioAutomatico = {
        estado: estado as LinhaDoEnvioAutomatico["estado"],
        motivo: lerMotivo(l.motivo),
        enviariaA: l.enviariaA == null ? null : Number(l.enviariaA),
        mudadoEm: instanteDaBase(l.mudadoEm as string | Date | null),
        seguirApos: instanteDaBase(l.seguirApos as string | Date | null),
        doVarrimento: l.origem === ORIGEM_DOS_ORCAMENTOS_NOVOS,
      };
      const texto = linhaDoEnvioAutomaticoNaMesa(linha, ligado, { soDaVitoria, agora });
      if (texto) m.set(Number(l.pedidoId), texto);
    }
  } catch (e) {
    console.error("[envio-automatico] a Mesa fica sem as linhas:", e instanceof Error ? e.message : e);
  }
  return m;
}
