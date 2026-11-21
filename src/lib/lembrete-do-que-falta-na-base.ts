/**
 * OS LEMBRETES DO QUE FALTA, NA BASE — d71 (CEO e dono, 19-11-2026).
 *
 * As regras puras estão em `lembrete-do-que-falta.ts`. Aqui:
 *
 *  - o interruptor «Lembretes do que falta» (Configs), na tabela dos
 *    interruptores (`retencaoInterruptores`), DESLIGADO por omissão e na dúvida;
 *  - `lembretesDoQueFalta` — UMA linha por pedido (a chave primária é o pedido:
 *    um ciclo por pedido, nunca outro), com o canal, o que já saiu, se parou,
 *    foi cancelado ou arquivado, e o passo por enviar. Nada de dados de
 *    pessoas: o telefone, o email e o nome lêem-se do pedido no momento;
 *  - `lembretesDoQueFaltaVez` — o carimbo «o próximo pode sair a partir de…»,
 *    20 a 45 s entre WhatsApp, como as outras filas;
 *  - a rotina (`/api/cron/lembretes-do-que-falta`, às 10h de Lisboa) que decide
 *    o passo de cada pedido: os emails saem logo, os WhatsApp vão para a fila;
 *    a passagem (às rondas da ponte) envia UM de cada vez, das 9h às 21h;
 *  - o «2» (chamado por `whatsapp-negociacao.ts`) e a linha da Mesa.
 *
 * Com o interruptor desligado, nada sai, nada se cancela e nada se arquiva.
 * Nunca DELETE de pedidos: arquivar é mudar o estado; cancelar é o mesmo
 * `cancelarPedido` do backoffice, com as guardas da d27 (um fechado fica fechado).
 */

import { appendOrderHistory, ensureNegociacoesTable, ensureRegistoTable, ensureSimulatorOrdersTable, getPool, registarNaTransaccao, registarSemFalhar } from "./db";
import { instanteDaBase } from "./hora-de-lisboa";
import {
  canalDoLembrete,
  eAHoraDosLembretes,
  eLembreteDoQueFalta,
  emailValido,
  linhaDoLembreteNaMesa,
  MOTIVOS_DE_FORA,
  NOME_DO_INTERRUPTOR_DO_QUE_FALTA,
  porqueFicaDeFora,
  porqueParaOCiclo,
  proximoPassoDoQueFalta,
  querCancelarPeloLembrete,
  telemovelPortugues,
  textoDoPasso,
  assuntoDoLembrete,
  ultimoPedirOQueFalta,
  type CandidatoAoLembrete,
  type CanalDoLembrete,
  type CicloDoQueFalta,
  type MotivoDeFora,
  type PassoDoQueFalta,
} from "./lembrete-do-que-falta";
import { ESTADOS_DE_PEDIDO_FECHADO_SQL, pedidoFechado } from "./pedido-arrumado";
import type { ChaveDaFalta } from "./mensagem-do-que-falta";

/* ── O interruptor (Configs) — DESLIGADO por omissão ─────────────────────── */

export const CHAVE_DOS_LEMBRETES_DO_QUE_FALTA = "lembretes_do_que_falta_d71";

export type InterruptorDoQueFalta = { ligado: boolean; mudadoEm: string | null; porQuem: string | null };

type Pool = NonNullable<Awaited<ReturnType<typeof getPool>>>;

let tabelasProntas = false;

export const SQL_DAS_TABELAS_DO_QUE_FALTA = [
  `CREATE TABLE IF NOT EXISTS retencaoInterruptores (
      chave     VARCHAR(40) NOT NULL PRIMARY KEY,
      ligado    TINYINT(1) NOT NULL DEFAULT 0,
      mudadoEm  DATETIME NULL DEFAULT NULL,
      porQuem   VARCHAR(120) NULL DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS lembretesDoQueFalta (
      pedidoId        INT UNSIGNED NOT NULL PRIMARY KEY,
      canal           VARCHAR(10) NOT NULL,
      criadoEm        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      lembrete1Em     DATETIME NULL DEFAULT NULL,
      lembrete2Em     DATETIME NULL DEFAULT NULL,
      lembrete3Em     DATETIME NULL DEFAULT NULL,
      arquivadoEm     DATETIME NULL DEFAULT NULL,
      canceladoEm     DATETIME NULL DEFAULT NULL,
      paradoEm        DATETIME NULL DEFAULT NULL,
      paradoPorque    VARCHAR(160) NULL DEFAULT NULL,
      porEnviar       VARCHAR(12) NULL DEFAULT NULL,
      porEnviarDesde  DATETIME NULL DEFAULT NULL,
      ultimaFalha     VARCHAR(160) NULL DEFAULT NULL,
      KEY idx_lembretes_do_que_falta_por_enviar (porEnviar, porEnviarDesde)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS lembretesDoQueFaltaVez (
      id        TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      proximoEm DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

/**
 * d71 v2 (19-11-2026) — aditiva, nula nas linhas de antes: a purga anonimiza o
 * pedido cancelado pelo «2» a partir daqui (7 dias depois), pela mesma função
 * dos cancelados da validade (`anonimizarOsCanceladosPeloLembrete`). Os
 * arquivados ao dia 7 não a têm: seguem a purga normal.
 */
export const COLUNA_DA_PURGA_DO_QUE_FALTA = `ALTER TABLE lembretesDoQueFalta ADD COLUMN anonimizarAPartirDe DATETIME NULL DEFAULT NULL`;

async function garantirTabelas(): Promise<Pool> {
  const pool = await getPool();
  if (!pool) throw new Error("[lembrete-do-que-falta] base de dados indisponível");
  if (!tabelasProntas) {
    for (const sql of SQL_DAS_TABELAS_DO_QUE_FALTA) await pool.execute(sql);
    try {
      await pool.execute(COLUNA_DA_PURGA_DO_QUE_FALTA);
    } catch (err) {
      if ((err as { code?: string })?.code !== "ER_DUP_FIELDNAME") throw err;
    }
    await pool.execute("INSERT IGNORE INTO lembretesDoQueFaltaVez (id, proximoEm) VALUES (1, '2000-01-01 00:00:00')");
    tabelasProntas = true;
  }
  return pool;
}

/** DESLIGADO NA DÚVIDA: sem linha, sem tabela, ou com a base a falhar. */
export async function interruptorDoQueFalta(): Promise<InterruptorDoQueFalta> {
  const desligado: InterruptorDoQueFalta = { ligado: false, mudadoEm: null, porQuem: null };
  try {
    const pool = await garantirTabelas();
    const [rows] = (await pool.execute(
      "SELECT ligado, mudadoEm, porQuem FROM retencaoInterruptores WHERE chave = ? LIMIT 1",
      [CHAVE_DOS_LEMBRETES_DO_QUE_FALTA],
    )) as [Array<{ ligado: number; mudadoEm: Date | string | null; porQuem: string | null }>, unknown];
    const l = rows[0];
    if (!l) return desligado;
    return {
      ligado: Number(l.ligado) === 1,
      mudadoEm: l.mudadoEm ? (instanteDaBase(l.mudadoEm)?.toISOString() ?? null) : null,
      porQuem: l.porQuem ?? null,
    };
  } catch (e) {
    console.error("[lembrete-do-que-falta] não li o interruptor — fica desligado:", e instanceof Error ? e.message : e);
    return desligado;
  }
}

/** Liga ou desliga; a mudança e quem a fez ficam no registo permanente, na mesma transacção. */
export async function mudarInterruptorDoQueFalta(ligar: boolean, porQuem: string): Promise<InterruptorDoQueFalta> {
  const pool = await garantirTabelas();
  await ensureRegistoTable();
  const antes = await interruptorDoQueFalta();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO retencaoInterruptores (chave, ligado, mudadoEm, porQuem) VALUES (?, ?, UTC_TIMESTAMP(), ?)
       ON DUPLICATE KEY UPDATE ligado = VALUES(ligado), mudadoEm = VALUES(mudadoEm), porQuem = VALUES(porQuem)`,
      [CHAVE_DOS_LEMBRETES_DO_QUE_FALTA, ligar ? 1 : 0, porQuem.slice(0, 120)],
    );
    await registarNaTransaccao(conn, {
      acontecimento: "lembretes_do_que_falta_interruptor",
      autorTipo: "clyon",
      autorNome: porQuem,
      estadoAntes: antes.ligado ? "ligado" : "desligado",
      estadoDepois: ligar ? "ligado" : "desligado",
      resumo: `«${NOME_DO_INTERRUPTOR_DO_QUE_FALTA}» ${ligar ? "LIGADO" : "DESLIGADO"} por ${porQuem} (d71).`,
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
  return interruptorDoQueFalta();
}

/* ── Os ciclos ───────────────────────────────────────────────────────────── */

type LinhaDoCiclo = CicloDoQueFalta & {
  pedidoId: number;
  canal: CanalDoLembrete;
  porEnviar: PassoDoQueFalta | null;
  ultimaFalha: string | null;
};

const PASSOS: readonly PassoDoQueFalta[] = ["lembrete1", "lembrete2", "lembrete3", "arquivar"];

function lerLinha(l: Record<string, unknown>): LinhaDoCiclo {
  const passo = String(l.porEnviar ?? "");
  const d = (v: unknown) => instanteDaBase(v as string | Date | null);
  return {
    pedidoId: Number(l.pedidoId),
    canal: l.canal === "email" ? "email" : "whatsapp",
    lembrete1Em: d(l.lembrete1Em),
    lembrete2Em: d(l.lembrete2Em),
    lembrete3Em: d(l.lembrete3Em),
    arquivadoEm: d(l.arquivadoEm),
    canceladoEm: d(l.canceladoEm),
    paradoEm: d(l.paradoEm),
    paradoPorque: (l.paradoPorque as string | null) ?? null,
    porEnviar: (PASSOS as readonly string[]).includes(passo) ? (passo as PassoDoQueFalta) : null,
    ultimaFalha: (l.ultimaFalha as string | null) ?? null,
  };
}

async function ciclosDosPedidos(pool: Pool, ids: number[]): Promise<Map<number, LinhaDoCiclo>> {
  const m = new Map<number, LinhaDoCiclo>();
  const limpos = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))];
  if (limpos.length === 0) return m;
  const [rows] = (await pool.execute(
    `SELECT * FROM lembretesDoQueFalta WHERE pedidoId IN (${limpos.map(() => "?").join(",")})`,
    limpos,
  )) as [Array<Record<string, unknown>>, unknown];
  for (const r of rows) m.set(Number(r.pedidoId), lerLinha(r));
  return m;
}

async function ciclosACorrer(pool: Pool): Promise<LinhaDoCiclo[]> {
  const [rows] = (await pool.query(
    `SELECT * FROM lembretesDoQueFalta
      WHERE arquivadoEm IS NULL AND canceladoEm IS NULL AND paradoEm IS NULL
      ORDER BY pedidoId ASC LIMIT 300`,
  )) as [Array<Record<string, unknown>>, unknown];
  return rows.map(lerLinha);
}

async function pararOCiclo(pool: Pool, pedidoId: number, porque: string): Promise<void> {
  await pool.execute(
    `UPDATE lembretesDoQueFalta SET paradoEm = UTC_TIMESTAMP(), paradoPorque = ?, porEnviar = NULL, porEnviarDesde = NULL
      WHERE pedidoId = ? AND paradoEm IS NULL AND arquivadoEm IS NULL AND canceladoEm IS NULL`,
    [porque.slice(0, 160), pedidoId],
  );
}

/* ── O pedido, como as regras o lêem ─────────────────────────────────────── */

type PedidoLido = CandidatoAoLembrete & {
  serviceType: string | null;
  city: string | null;
};

const noveDigitos = (v: unknown) => {
  const d = String(v ?? "").replace(/\D/g, "");
  return d.length >= 9 ? d.slice(-9) : "";
};

function emailsDeTesteDoAmbiente(): Set<string> {
  return new Set(
    (process.env.EUPAGO_EMAILS_DE_TESTE ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@")),
  );
}

/**
 * Os pedidos pedidos, com tudo o que as regras precisam: o estado, se já foi
 * a alguém, o que falta (`oQueFaltaNoPedido`, a mesma conta da Mesa), o último
 * «Pedir o que falta», a última mensagem do cliente e se a conversa está com
 * uma pessoa. Sem ids, os «Orçamentos novos» da Mesa (`pedidosPorPromover`).
 */
async function lerPedidos(pool: Pool, ids?: number[]): Promise<PedidoLido[]> {
  await ensureSimulatorOrdersTable();
  await ensureNegociacoesTable();
  let alvo = ids;
  if (!alvo) {
    const { pedidosPorPromover } = await import("./db");
    alvo = (await pedidosPorPromover(100)).map((p) => Number(p.id));
  }
  const limpos = [...new Set(alvo.filter((n) => Number.isInteger(n) && n > 0))];
  if (limpos.length === 0) return [];
  const [rows] = (await pool.execute(
    `SELECT o.id, o.status, o.createdAt, o.contactName, o.contactEmail, o.contactPhone, o.serviceType, o.city,
            o.address, o.postalCode, o.floor, o.hasElevator, o.parkingDistance, o.description, o.filesJson,
            o.urgency, o.dataAgendada, o.rawOrderJson, o.historyJson, o.anonimizadoEm,
            (o.valorFixoClyon IS NOT NULL OR o.propostaEnviadaEm IS NOT NULL
              OR EXISTS (SELECT 1 FROM negociacoes n WHERE n.pedidoId = o.id)) AS jaFoiEnviado
       FROM simulatorOrders o
      WHERE o.id IN (${limpos.map(() => "?").join(",")})`,
    limpos,
  )) as [Array<Record<string, unknown>>, unknown];

  const { oQueFaltaNoPedido } = await import("./o-que-falta-no-pedido");
  const { respostasDoClienteNoWhatsApp, numeroInterrompidoWhatsApp } = await import("./db");
  const respostas = await respostasDoClienteNoWhatsApp(rows.map((r) => (r.contactPhone as string | null) ?? null));
  const jaTem = await ciclosDosPedidos(pool, limpos);

  const lidos: PedidoLido[] = [];
  for (const r of rows) {
    const id = Number(r.id);
    const telefone = (r.contactPhone as string | null) ?? null;
    const tel = noveDigitos(telefone);
    const comUmaPessoa = tel ? await numeroInterrompidoWhatsApp(tel).catch(() => true) : false;
    const faltas = oQueFaltaNoPedido(r as unknown as Parameters<typeof oQueFaltaNoPedido>[0]);
    lidos.push({
      id,
      status: (r.status as string | null) ?? null,
      jaFoiEnviado: Number(r.jaFoiEnviado) === 1 || r.anonimizadoEm != null,
      criadoEm: instanteDaBase(r.createdAt as string | Date | null),
      contactName: (r.contactName as string | null) ?? null,
      contactEmail: (r.contactEmail as string | null) ?? null,
      contactPhone: telefone,
      faltas,
      equipaPediuEm: ultimoPedirOQueFalta(r.historyJson as string | null),
      clienteEscreveuEm: (tel ? respostas.get(tel)?.ultimaMensagemEm : null) ?? null,
      comUmaPessoa,
      jaTeveCiclo: jaTem.has(id),
      serviceType: (r.serviceType as string | null) ?? null,
      city: (r.city as string | null) ?? null,
    });
  }
  return lidos;
}

/* ── O ensaio (Configs): quem entraria agora, e por onde ─────────────────── */

export type EnsaioDoQueFalta = {
  ligado: boolean;
  /** Os que entrariam agora num ciclo novo: só números de pedido, canal e quantas faltas. */
  entrariam: Array<{ pedidoId: number; canal: CanalDoLembrete; faltas: number }>;
  /** Os ciclos a correr, com o passo que tocaria hoje. */
  aCorrer: Array<{ pedidoId: number; canal: CanalDoLembrete; linha: string | null; passoDeHoje: PassoDoQueFalta | null }>;
  /** Quantos ficam de fora, por motivo. */
  deFora: Partial<Record<MotivoDeFora, number>>;
};

export async function ensaioDoQueFalta(agora: Date = new Date()): Promise<EnsaioDoQueFalta> {
  const { ligado } = await interruptorDoQueFalta();
  const pool = await garantirTabelas();
  const pedidos = await lerPedidos(pool);
  const teste = emailsDeTesteDoAmbiente();
  const entrariam: EnsaioDoQueFalta["entrariam"] = [];
  const deFora: EnsaioDoQueFalta["deFora"] = {};
  for (const p of pedidos) {
    const motivo = porqueFicaDeFora(p, agora, teste);
    if (motivo) {
      deFora[motivo] = (deFora[motivo] ?? 0) + 1;
      continue;
    }
    entrariam.push({ pedidoId: p.id, canal: canalDoLembrete(p)!, faltas: p.faltas.length });
  }
  const aCorrer = (await ciclosACorrer(pool)).map((c) => ({
    pedidoId: c.pedidoId,
    canal: c.canal,
    linha: linhaDoLembreteNaMesa(c, ligado),
    passoDeHoje: proximoPassoDoQueFalta(c, agora),
  }));
  return { ligado, entrariam, aCorrer, deFora };
}

export { MOTIVOS_DE_FORA };

/* ── A rotina: às 10h de Lisboa ──────────────────────────────────────────── */

export type ResultadoDaRotinaDoQueFalta = {
  ligado: boolean;
  foraDeHoras?: boolean;
  novos: number;
  naFila: number;
  porEmail: number;
  parados: number;
  falhados: number;
};

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const INTERVALO_ENTRE_EMAILS_MS = 600;

/**
 * Os ciclos a correr em dia (parados se o pedido saiu, ficou completo ou o
 * cliente respondeu); os pedidos novos que entram; e o passo de hoje de cada
 * um — um por telefone. Os emails saem logo, espaçados; os WhatsApp vão para a
 * fila da ponte. Desligado, ou fora das 10h de Lisboa, não faz nada.
 */
export async function rotinaDoQueFalta(agora: Date = new Date()): Promise<ResultadoDaRotinaDoQueFalta> {
  const r: ResultadoDaRotinaDoQueFalta = { ligado: false, novos: 0, naFila: 0, porEmail: 0, parados: 0, falhados: 0 };
  const { ligado } = await interruptorDoQueFalta();
  if (!ligado) return r;
  r.ligado = true;
  if (!eAHoraDosLembretes(agora)) {
    r.foraDeHoras = true;
    return r;
  }
  const pool = await garantirTabelas();

  // 1. Os ciclos a correr: o pedido ainda está nos «Orçamentos novos», com faltas e sem resposta?
  const aCorrer = await ciclosACorrer(pool);
  const dosCiclos = new Map((await lerPedidos(pool, aCorrer.map((c) => c.pedidoId))).map((p) => [p.id, p]));
  const vivos: Array<{ c: LinhaDoCiclo; p: PedidoLido }> = [];
  for (const c of aCorrer) {
    const p = dosCiclos.get(c.pedidoId);
    const porque = p ? porqueParaOCiclo(c, p) : "o pedido já não existe";
    if (porque) {
      await pararOCiclo(pool, c.pedidoId, porque);
      r.parados += 1;
      continue;
    }
    vivos.push({ c, p: p! });
  }

  // 2. Os novos: os «Orçamentos novos» que entram agora (um ciclo por pedido, para sempre).
  const teste = emailsDeTesteDoAmbiente();
  for (const p of await lerPedidos(pool)) {
    if (porqueFicaDeFora(p, agora, teste)) continue;
    const canal = canalDoLembrete(p)!;
    const [novo] = (await pool.execute("INSERT IGNORE INTO lembretesDoQueFalta (pedidoId, canal) VALUES (?, ?)", [p.id, canal])) as [
      { affectedRows: number },
      unknown,
    ];
    if (Number(novo.affectedRows) !== 1) continue;
    r.novos += 1;
    vivos.push({ c: { pedidoId: p.id, canal, porEnviar: null, ultimaFalha: null }, p });
  }

  // 3. O passo de hoje, um por telefone (ou email): com dois pedidos, sai um por dia.
  const vistos = new Set<string>();
  let emails = 0;
  for (const { c, p } of vivos.sort((a, b) => a.c.pedidoId - b.c.pedidoId)) {
    const passo = proximoPassoDoQueFalta(c, agora);
    if (!passo || c.porEnviar) continue;
    const contacto = c.canal === "whatsapp" ? noveDigitos(p.contactPhone) : (emailValido(p.contactEmail) ?? "");
    if (!contacto || vistos.has(contacto)) continue;
    vistos.add(contacto);
    if (c.canal === "whatsapp") {
      const [u] = (await pool.execute(
        `UPDATE lembretesDoQueFalta SET porEnviar = ?, porEnviarDesde = UTC_TIMESTAMP(), ultimaFalha = NULL
          WHERE pedidoId = ? AND porEnviar IS NULL AND paradoEm IS NULL AND arquivadoEm IS NULL AND canceladoEm IS NULL`,
        [passo, c.pedidoId],
      )) as [{ affectedRows: number }, unknown];
      if (Number(u.affectedRows) === 1) r.naFila += 1;
      continue;
    }
    if (emails > 0) await espera(INTERVALO_ENTRE_EMAILS_MS);
    emails += 1;
    const feito = await darOPasso(c.pedidoId, passo, agora).catch((e) => ({ ok: false as const, porque: e instanceof Error ? e.message : "erro" }));
    if (feito.ok) r.porEmail += 1;
    else r.falhados += 1;
  }
  return r;
}

export function resumoDaRotinaDoQueFalta(r: ResultadoDaRotinaDoQueFalta): string | null {
  if (!r.ligado) return `desligado (interruptor «${NOME_DO_INTERRUPTOR_DO_QUE_FALTA}» nas Configs)`;
  if (r.foraDeHoras) return "fora das 10h de Lisboa (o cron corre às 9h e às 10h UTC)";
  if (r.novos === 0 && r.naFila === 0 && r.porEmail === 0 && r.parados === 0 && r.falhados === 0) return null;
  return `${r.novos} ciclo(s) novo(s) · ${r.naFila} WhatsApp na fila · ${r.porEmail} email(s) · ${r.parados} parado(s)` + (r.falhados ? ` · ${r.falhados} falhado(s)` : "");
}

/* ── A passagem: um WhatsApp por vez, às rondas da ponte ─────────────────── */

export type ResultadoDaPassagemDoQueFalta = "desligado" | "fora-da-janela" | "nada" | "nao-e-a-vez" | "feito" | "falhou";

export async function passagemDoQueFalta(agora: Date = new Date()): Promise<ResultadoDaPassagemDoQueFalta> {
  const { dentroDaJanelaDoWhatsApp, intervaloAoAcaso } = await import("./aviso-aos-profissionais");
  if (!dentroDaJanelaDoWhatsApp(agora)) return "fora-da-janela";
  const pool = await garantirTabelas();
  const [proximos] = (await pool.query(
    "SELECT pedidoId, porEnviar FROM lembretesDoQueFalta WHERE porEnviar IS NOT NULL ORDER BY porEnviarDesde ASC LIMIT 1",
  )) as [Array<{ pedidoId: number; porEnviar: string }>, unknown];
  const p = proximos[0];
  if (!p) return "nada";
  if (!(await interruptorDoQueFalta()).ligado) return "desligado";

  const [vez] = (await pool.execute(
    "UPDATE lembretesDoQueFaltaVez SET proximoEm = UTC_TIMESTAMP() + INTERVAL ? SECOND WHERE id = 1 AND proximoEm <= UTC_TIMESTAMP()",
    [intervaloAoAcaso()],
  )) as [{ affectedRows: number }, unknown];
  if (Number(vez.affectedRows) !== 1) return "nao-e-a-vez";

  // Tirar da fila ANTES de enviar: uma passagem ao mesmo tempo não manda outra vez.
  const [reserva] = (await pool.execute(
    "UPDATE lembretesDoQueFalta SET porEnviar = NULL, porEnviarDesde = NULL WHERE pedidoId = ? AND porEnviar = ?",
    [p.pedidoId, p.porEnviar],
  )) as [{ affectedRows: number }, unknown];
  if (Number(reserva.affectedRows) !== 1) return "nada";
  if (!(PASSOS as readonly string[]).includes(p.porEnviar)) return "nada";

  const r = await darOPasso(Number(p.pedidoId), p.porEnviar as PassoDoQueFalta, agora).catch((e) => ({
    ok: false as const,
    porque: e instanceof Error ? e.message : "erro",
  }));
  return r.ok ? "feito" : "falhou";
}

/* ── Dar um passo ────────────────────────────────────────────────────────── */

export type ResultadoDoPasso = { ok: true; feito: string } | { ok: false; porque: string };

const COLUNA_DO_PASSO: Record<Exclude<PassoDoQueFalta, "arquivar">, { coluna: string; antes: string | null; n: number }> = {
  lembrete1: { coluna: "lembrete1Em", antes: null, n: 1 },
  lembrete2: { coluna: "lembrete2Em", antes: "lembrete1Em", n: 2 },
  lembrete3: { coluna: "lembrete3Em", antes: "lembrete2Em", n: 3 },
};

async function enviarPeloCanal(canal: CanalDoLembrete, p: PedidoLido, passo: PassoDoQueFalta, texto: string): Promise<boolean> {
  if (canal === "whatsapp") {
    const tel = telemovelPortugues(p.contactPhone);
    if (!tel) return false;
    const { enviarAvisoWhatsApp } = await import("./whatsapp-cloud");
    // Na língua da conversa do cliente, ou nada (d63): sem tradução, passa à equipa.
    return enviarAvisoWhatsApp(tel, texto, { semLinguaErrada: true }).catch(() => false);
  }
  const email = emailValido(p.contactEmail);
  if (!email) return false;
  const { enviarEmailDoSeguimento } = await import("./seguimento-da-app-envio");
  return enviarEmailDoSeguimento({ para: email, assunto: assuntoDoLembrete(passo, p.id), texto }).catch(() => false);
}

/**
 * Lê tudo outra vez — o interruptor, o pedido ainda nos «Orçamentos novos», as
 * faltas, a resposta do cliente, o ciclo — e só então envia. Um envio que
 * falha pára o ciclo (não se insiste todos os dias com um número bloqueado).
 */
export async function darOPasso(pedidoId: number, passo: PassoDoQueFalta, agora: Date): Promise<ResultadoDoPasso> {
  if (!(await interruptorDoQueFalta()).ligado) return { ok: false, porque: "desligado" };
  const pool = await garantirTabelas();
  const c = (await ciclosDosPedidos(pool, [pedidoId])).get(pedidoId);
  if (!c) return { ok: false, porque: "sem ciclo" };
  const [p] = await lerPedidos(pool, [pedidoId]);
  const parar = !p
    ? "o pedido já não existe"
    : (porqueParaOCiclo(c, p) ?? (c.canal === "whatsapp" && p.comUmaPessoa ? "a conversa passou a uma pessoa da equipa" : null));
  if (parar) {
    await pararOCiclo(pool, pedidoId, parar);
    return { ok: false, porque: parar };
  }
  if (proximoPassoDoQueFalta(c, agora) !== passo) return { ok: false, porque: "não é a vez deste passo" };
  // d83 (21-11-2026): nunca no dia em que já saiu o seguimento do cliente a este número.
  if (c.canal === "whatsapp" && p?.contactPhone) {
    const { jaSaiuHojeAoCliente } = await import("./seguimento-do-cliente");
    const { datasDoSeguimentoDoTelefone } = await import("./seguimento-do-cliente-na-base");
    const doSeguimento = await datasDoSeguimentoDoTelefone(p.contactPhone).catch(() => [] as Date[]);
    if (jaSaiuHojeAoCliente(doSeguimento, agora)) return { ok: false, porque: "já saiu hoje o seguimento do cliente a este número (d83)" };
  }
  const pedido = { id: p!.id, serviceType: p!.serviceType, city: p!.city };
  const texto = textoDoPasso(passo, pedido, p!.faltas as ChaveDaFalta[], agora);
  if (!texto) return { ok: false, porque: "sem texto (o pedido ficou completo)" };

  if (passo === "arquivar") return arquivarSemResposta(pool, p!, c.canal, texto);

  const { coluna, antes, n } = COLUNA_DO_PASSO[passo];
  // Reservar o passo ANTES de sair: só uma passagem ganha.
  const [reserva] = (await pool.execute(
    `UPDATE lembretesDoQueFalta SET ${coluna} = UTC_TIMESTAMP(), ultimaFalha = NULL
      WHERE pedidoId = ? AND ${coluna} IS NULL ${antes ? `AND ${antes} IS NOT NULL` : ""}
        AND paradoEm IS NULL AND arquivadoEm IS NULL AND canceladoEm IS NULL`,
    [pedidoId],
  )) as [{ affectedRows: number }, unknown];
  if (Number(reserva.affectedRows) !== 1) return { ok: false, porque: "este passo já foi dado por outra passagem" };

  if (!(await enviarPeloCanal(c.canal, p!, passo, texto))) {
    await pool.execute(`UPDATE lembretesDoQueFalta SET ${coluna} = NULL, ultimaFalha = ? WHERE pedidoId = ?`, [
      "o envio falhou",
      pedidoId,
    ]);
    await pararOCiclo(
      pool,
      pedidoId,
      c.canal === "whatsapp" ? "o WhatsApp não saiu (bloqueado, desligado ou sem tradução)" : "o email não saiu",
    );
    return { ok: false, porque: "o envio falhou" };
  }
  const feito = `Lembrete do que falta ${n}/3 enviado ao cliente ${c.canal === "whatsapp" ? "pelo WhatsApp" : "por email"} (automático, d71).`;
  await appendOrderHistory(pedidoId, { type: "note", by: null, message: feito }).catch(() => {});
  return { ok: true, feito };
}

/** Dia 7: arquivado (nunca apagado), com a mensagem final. A guarda d27: um pedido fechado não se mexe. */
async function arquivarSemResposta(pool: Pool, p: PedidoLido, canal: CanalDoLembrete, texto: string): Promise<ResultadoDoPasso> {
  const [m] = (await pool.execute(
    `UPDATE lembretesDoQueFalta SET arquivadoEm = UTC_TIMESTAMP(), porEnviar = NULL
      WHERE pedidoId = ? AND lembrete3Em IS NOT NULL AND arquivadoEm IS NULL AND canceladoEm IS NULL AND paradoEm IS NULL`,
    [p.id],
  )) as [{ affectedRows: number }, unknown];
  if (Number(m.affectedRows) !== 1) return { ok: false, porque: "já arquivado, cancelado ou parado" };

  const [a] = (await pool.execute(
    `UPDATE simulatorOrders
        SET status = 'arquivado', assignedToId = NULL, assignedToName = NULL, assignedAt = NULL, updatedAt = NOW()
      WHERE id = ? AND (status IS NULL OR status NOT IN ${ESTADOS_DE_PEDIDO_FECHADO_SQL})
        AND NOT EXISTS (SELECT 1 FROM negociacoes n WHERE n.pedidoId = simulatorOrders.id)`,
    [p.id],
  )) as [{ affectedRows: number }, unknown];
  if (Number(a.affectedRows) !== 1) {
    await pool.execute("UPDATE lembretesDoQueFalta SET arquivadoEm = NULL WHERE pedidoId = ?", [p.id]);
    await pararOCiclo(pool, p.id, "o pedido já tinha saído dos «Orçamentos novos»");
    return { ok: false, porque: "o pedido já tinha saído dos «Orçamentos novos»" };
  }
  const { gravarMotivoDoFecho, fecharPagamentosAbertosDoPedido } = await import("./db");
  await gravarMotivoDoFecho(p.id, "sem_resposta", null, null).catch(() => {});
  await fecharPagamentosAbertosDoPedido(p.id, "arquivado").catch(() => {});
  const saiu = await enviarPeloCanal(canal, p, "arquivar", texto);
  const resumo =
    "Arquivado sozinho sem resposta (lembretes do que falta, d71): três lembretes ao cliente, sem resposta. " +
    `${saiu ? `O cliente foi avisado ${canal === "whatsapp" ? "pelo WhatsApp" : "por email"}` : "O aviso ao cliente não saiu"}; pode voltar a pedir quando quiser.`;
  await appendOrderHistory(p.id, { type: "archived", by: null, message: resumo }).catch(() => {});
  await registarSemFalhar({ acontecimento: "lembrete_do_que_falta", pedidoId: p.id, autorTipo: "sistema", autorNome: "lembretes do que falta", resumo });
  return { ok: true, feito: resumo };
}

/* ── O «2» na conversa ───────────────────────────────────────────────────── */

/** O texto da última mensagem que saiu para este telefone (número inteiro), como ficou no registo — ou null. */
async function ultimaSaidaParaOTelefone(pool: Pool, telefone: string): Promise<string | null> {
  const tel = noveDigitos(telefone);
  if (!tel) return null;
  const [rows] = (await pool.execute(
    `SELECT telefone, texto FROM whatsappMensagens
      WHERE RIGHT(telefone, 9) = ? AND direccao = 'out'
      ORDER BY id DESC
      LIMIT 10`,
    [tel],
  )) as [Array<{ telefone: string; texto: string }>, unknown];
  const { mesmoTelefoneEstrito } = await import("./validade-do-orcamento");
  const r = rows.find((x) => mesmoTelefoneEstrito(String(x.telefone ?? ""), telefone));
  return r ? String(r.texto ?? "") : null;
}

/**
 * O PEDIDO DESTE TELEFONE COM UM LEMBRETE DO QUE FALTA EM ABERTO, a que esta
 * mensagem responde — ou null. Com o interruptor desligado, nenhum. ESTRITO: o
 * número inteiro, o ciclo a correr, e a última mensagem que lhe saiu tem de
 * ser um lembrete DESTE pedido (`eLembreteDoQueFalta`).
 */
export async function lembreteEmAbertoDoTelefone(telefone: string): Promise<number | null> {
  const tel = noveDigitos(telefone);
  if (!tel) return null;
  if (!(await interruptorDoQueFalta()).ligado) return null;
  const pool = await garantirTabelas();
  const [rows] = (await pool.execute(
    `SELECT l.pedidoId, o.contactPhone
       FROM lembretesDoQueFalta l
       JOIN simulatorOrders o ON o.id = l.pedidoId
      WHERE l.canal = 'whatsapp' AND l.lembrete1Em IS NOT NULL
        AND l.arquivadoEm IS NULL AND l.canceladoEm IS NULL AND l.paradoEm IS NULL
        AND RIGHT(REGEXP_REPLACE(COALESCE(o.contactPhone, ''), '[^0-9]', ''), 9) = ?
      ORDER BY l.pedidoId DESC
      LIMIT 5`,
    [tel],
  )) as [Array<{ pedidoId: number; contactPhone: string | null }>, unknown];
  const { mesmoTelefoneEstrito } = await import("./validade-do-orcamento");
  const doTelefone = rows.filter((r) => mesmoTelefoneEstrito(String(r.contactPhone ?? ""), telefone));
  if (doTelefone.length === 0) return null;
  const ultima = await ultimaSaidaParaOTelefone(pool, telefone).catch(() => null);
  return doTelefone.find((r) => eLembreteDoQueFalta(ultima, Number(r.pedidoId)))?.pedidoId ?? null;
}

export type RespostaAoLembreteDoQueFalta =
  | { tipo: "cancelado"; pedidoId: number }
  | { tipo: "nao_cancelou"; pedidoId: number; porque: string }
  | { tipo: "segue_a_conversa"; pedidoId: number };

/**
 * O CLIENTE RESPONDEU A UM LEMBRETE DO QUE FALTA (chamado por
 * `whatsapp-negociacao.ts`, com o lembrete em aberto deste número):
 *
 *   · «2», «cancelar», «já não preciso»: cancela (`cancelarPeloLembreteDoQueFalta`);
 *   · fotografias, dados, uma resposta ambígua: o ciclo pára e a conversa segue
 *     pela Vitória, que já recolhe o que falta.
 */
export async function responderAoLembreteDoQueFalta(
  pedidoId: number,
  telefone: string,
  texto: string,
  temImagens: boolean,
): Promise<RespostaAoLembreteDoQueFalta> {
  if (temImagens || !querCancelarPeloLembrete(texto)) {
    const pool = await garantirTabelas();
    await pararOCiclo(pool, pedidoId, "o cliente respondeu");
    return { tipo: "segue_a_conversa", pedidoId };
  }
  const r = await cancelarPeloLembreteDoQueFalta(pedidoId, telefone);
  return r.ok ? { tipo: "cancelado", pedidoId } : { tipo: "nao_cancelou", pedidoId, porque: r.porque };
}

/**
 * O «2»: o pedido cancela pelo mesmo `cancelarPedido` do backoffice, com o
 * motivo «Já não precisa», e o cliente recebe o texto de cancelamento aprovado
 * (d55, `mensagens-das-fases.ts`). Guardas: o ciclo reserva-se antes (um só
 * «2» cancela); um pedido já fechado, ou que entretanto foi aos parceiros,
 * não se cancela por aqui (d27) — passa à equipa.
 */
export async function cancelarPeloLembreteDoQueFalta(
  pedidoId: number,
  telefone: string,
): Promise<{ ok: true } | { ok: false; porque: string }> {
  const pool = await garantirTabelas();
  const [reserva] = (await pool.execute(
    `UPDATE lembretesDoQueFalta SET canceladoEm = UTC_TIMESTAMP(), porEnviar = NULL, porEnviarDesde = NULL
      WHERE pedidoId = ? AND lembrete1Em IS NOT NULL AND canceladoEm IS NULL AND arquivadoEm IS NULL AND paradoEm IS NULL`,
    [pedidoId],
  )) as [{ affectedRows: number }, unknown];
  if (Number(reserva.affectedRows) !== 1) return { ok: false, porque: "não há lembrete em aberto para este pedido" };
  const desfazer = async (porque: string) => {
    await pool.execute("UPDATE lembretesDoQueFalta SET canceladoEm = NULL WHERE pedidoId = ?", [pedidoId]).catch(() => {});
    await pararOCiclo(pool, pedidoId, porque).catch(() => {});
  };

  const [p] = await lerPedidos(pool, [pedidoId]);
  if (!p) {
    await desfazer("o pedido já não existe");
    return { ok: false, porque: "o pedido já não existe" };
  }
  if (pedidoFechado(p.status)) {
    await desfazer("o pedido já estava fechado");
    return { ok: false, porque: "o pedido já estava fechado" };
  }
  if (p.jaFoiEnviado) {
    await desfazer("o pedido já foi aos parceiros");
    return { ok: false, porque: "o pedido já foi aos parceiros" };
  }

  const { cancelarPedido, gravarMotivoDoFecho, negociacoesDoPedido } = await import("./db");
  const existentes = await negociacoesDoPedido(pedidoId).catch(() => []);
  const r = await cancelarPedido(pedidoId);
  if (!r) {
    await desfazer("o pedido já não existe");
    return { ok: false, porque: "o pedido já não existe" };
  }
  await gravarMotivoDoFecho(pedidoId, "ja_nao_precisa", null, null).catch(() => {});
  // d71 v2: os dados saem daqui a 7 dias, pela purga dos cancelados pelo lembrete (a mesma da d62/d2) — nada sai agora.
  const { DIAS_ATE_ANONIMIZAR_O_CANCELADO } = await import("./validade-do-orcamento");
  await pool.execute(
    `UPDATE lembretesDoQueFalta SET anonimizarAPartirDe = NOW() + INTERVAL ${DIAS_ATE_ANONIMIZAR_O_CANCELADO} DAY WHERE pedidoId = ?`,
    [pedidoId],
  );
  const { avisarDoCancelamento } = await import("./avisar-cancelamento");
  await avisarDoCancelamento({ pedidoId, negociacoes: existentes, motivo: "O cliente já não precisa", porQuem: "cliente" }).catch(() => {});
  const { enviarTextoWhatsApp } = await import("./whatsapp-cloud");
  const { mensagemDeCancelamento } = await import("./mensagens-das-fases");
  await enviarTextoWhatsApp(telefone, mensagemDeCancelamento()).catch(() => false);

  const resumo =
    "O cliente respondeu «2» ao lembrete do que falta (d71): pedido cancelado, com o texto de cancelamento ao cliente. " +
    `Os dados dele saem do pedido daqui a ${DIAS_ATE_ANONIMIZAR_O_CANCELADO} dias, pela purga; reabrir o pedido até lá desfaz.`;
  await appendOrderHistory(pedidoId, { type: "created", by: null, message: resumo }).catch(() => {});
  await registarSemFalhar({ acontecimento: "pedido_cancelado", pedidoId, autorTipo: "cliente", autorNome: "WhatsApp (lembrete do que falta)", resumo });
  return { ok: true };
}

/* ── A Mesa ──────────────────────────────────────────────────────────────── */

/**
 * As linhas dos cartões dos «Orçamentos novos» (pedido → linha) e os ciclos
 * acabados nos últimos 7 dias (cancelados pelo cliente, arquivados sem
 * resposta), que já saíram do bloco. Nunca lança: sem isto, a Mesa serve.
 */
export async function lembretesNaMesa(ids: number[]): Promise<{
  ligado: boolean;
  linhas: Map<number, string>;
  acabados: Array<{ pedidoId: number; linha: string }>;
}> {
  const vazio = { ligado: false, linhas: new Map<number, string>(), acabados: [] as Array<{ pedidoId: number; linha: string }> };
  try {
    const { ligado } = await interruptorDoQueFalta();
    const pool = await garantirTabelas();
    const linhas = new Map<number, string>();
    for (const [id, c] of await ciclosDosPedidos(pool, ids)) {
      const l = linhaDoLembreteNaMesa(c, ligado);
      if (l) linhas.set(id, l);
    }
    const [rows] = (await pool.query(
      `SELECT * FROM lembretesDoQueFalta
        WHERE (canceladoEm IS NOT NULL AND canceladoEm > UTC_TIMESTAMP() - INTERVAL 7 DAY)
           OR (arquivadoEm IS NOT NULL AND arquivadoEm > UTC_TIMESTAMP() - INTERVAL 7 DAY)
        ORDER BY pedidoId DESC LIMIT 30`,
    )) as [Array<Record<string, unknown>>, unknown];
    const acabados = rows
      .map(lerLinha)
      .map((c) => ({ pedidoId: c.pedidoId, linha: linhaDoLembreteNaMesa(c, ligado) ?? "" }))
      .filter((a) => a.linha);
    return { ligado, linhas, acabados };
  } catch (e) {
    console.error("[lembrete-do-que-falta] a Mesa não leu os lembretes:", e instanceof Error ? e.message : e);
    return vazio;
  }
}
