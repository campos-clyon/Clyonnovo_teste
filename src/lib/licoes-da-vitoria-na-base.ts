/**
 * AS LIÇÕES DA VITÓRIA NA BASE — e as passagens das rotinas. 27-10-2026 (d11).
 *
 * Duas tabelas novas, aditivas, criadas à primeira chamada como as outras do
 * `db.ts` (`CREATE TABLE IF NOT EXISTS`): nada do que existe muda.
 *
 *   · `licoesDaVitoria` — uma linha por lição (ver `licoes-da-vitoria.ts`).
 *     Sem telefones nem nomes: a pergunta e as respostas já chegam sem dados
 *     de pessoas, e a chave contra repetidos é o número da MENSAGEM que lhe
 *     deu origem.
 *   · `passagensDasRotinas` — cada passagem de uma rotina (cron): quando
 *     começou e acabou, se correu bem, e o motivo quando não. Uma rotina que
 *     falha calada deixa aqui o rasto (a d7 vai reaproveitá-la para as outras).
 */
import { getPool } from "./db";
import { instanteDaBase } from "./hora-de-lisboa";
import {
  ESTADOS_DA_LICAO,
  ORIGENS_DA_LICAO,
  estaEmUso,
  motivoParaBloquear,
  quandoSeUsarUmaLicao,
  usarLicoes,
  type EstadoDaLicao,
  type Licao,
  type LicaoEmUso,
  type MensagemDoPainel,
  type MensagemDoFio,
  type OrigemDaLicao,
} from "./licoes-da-vitoria";

let tabelasProntas = false;

async function garantirTabelas() {
  if (tabelasProntas) return;
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS licoesDaVitoria (
      id               INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      criadaEm         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      origem           VARCHAR(20) NOT NULL,
      mensagemId       BIGINT UNSIGNED NULL,
      pergunta         TEXT NOT NULL,
      respostaDaEquipa TEXT NULL,
      respostaProposta TEXT NOT NULL,
      estado           VARCHAR(12) NOT NULL DEFAULT 'por_rever',
      bloqueadaPor     VARCHAR(300) NULL,
      revistaPor       VARCHAR(120) NULL,
      revistaEm        DATETIME NULL,
      usos             INT UNSIGNED NOT NULL DEFAULT 0,
      UNIQUE KEY uq_origem_mensagem (origem, mensagemId),
      KEY idx_estado (estado)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS passagensDasRotinas (
      id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      rotina    VARCHAR(60) NOT NULL,
      comecouEm DATETIME NOT NULL,
      acabouEm  DATETIME NULL,
      ok        TINYINT(1) NOT NULL DEFAULT 0,
      motivo    VARCHAR(500) NULL,
      detalhe   TEXT NULL,
      KEY idx_rotina (rotina, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tabelasProntas = true;
}

function data(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  return instanteDaBase(v == null ? null : String(v));
}

function linhaParaLicao(r: Record<string, unknown>): Licao {
  const estado = String(r.estado) as EstadoDaLicao;
  const origem = String(r.origem) as OrigemDaLicao;
  return {
    id: Number(r.id),
    criadaEm: data(r.criadaEm)?.toISOString() ?? "",
    origem: (ORIGENS_DA_LICAO as readonly string[]).includes(origem) ? origem : "anotada",
    pergunta: String(r.pergunta ?? ""),
    respostaDaEquipa: r.respostaDaEquipa == null ? null : String(r.respostaDaEquipa),
    respostaProposta: String(r.respostaProposta ?? ""),
    estado: (ESTADOS_DA_LICAO as readonly string[]).includes(estado) ? estado : "por_rever",
    revistaPor: r.revistaPor == null ? null : String(r.revistaPor),
    revistaEm: data(r.revistaEm)?.toISOString() ?? null,
    usos: Number(r.usos ?? 0),
    bloqueadaPor: r.bloqueadaPor == null ? null : String(r.bloqueadaPor),
  };
}

/** Todas as lições, as por rever primeiro e as mais novas em cima. */
export async function listarLicoes(limite = 300): Promise<Licao[]> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) return [];
  const [rows] = (await pool.execute(
    `SELECT * FROM licoesDaVitoria
      ORDER BY (estado = 'por_rever') DESC, id DESC
      LIMIT ${Math.max(1, Math.min(1000, Math.floor(limite)))}`,
  )) as [Array<Record<string, unknown>>, unknown];
  return rows.map(linhaParaLicao);
}

/** As por rever que se podem rever (as bloqueadas também contam: alguém tem de as ver). */
export async function contarLicoesPorRever(): Promise<number> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) return 0;
  const [rows] = (await pool.execute(
    "SELECT COUNT(*) AS n FROM licoesDaVitoria WHERE estado = 'por_rever'",
  )) as [Array<{ n: number }>, unknown];
  return Number(rows[0]?.n ?? 0);
}

/**
 * GUARDA UMA LIÇÃO NOVA, por rever — ou nada, se a mesma mensagem já deu uma
 * lição desta origem. A guarda corre aqui também: uma resposta com um preço
 * errado nasce bloqueada, com o motivo.
 */
export async function guardarLicao(l: {
  origem: OrigemDaLicao;
  mensagemId: number;
  pergunta: string;
  respostaDaEquipa: string | null;
  respostaProposta: string;
}): Promise<boolean> {
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) return false;
  const bloqueio = motivoParaBloquear(l.respostaProposta);
  const [r] = (await pool.execute(
    `INSERT IGNORE INTO licoesDaVitoria (origem, mensagemId, pergunta, respostaDaEquipa, respostaProposta, bloqueadaPor)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      l.origem,
      l.mensagemId,
      l.pergunta.slice(0, 2000),
      l.respostaDaEquipa ? l.respostaDaEquipa.slice(0, 2000) : null,
      l.respostaProposta.slice(0, 2000),
      bloqueio ? bloqueio.slice(0, 300) : null,
    ],
  )) as [{ affectedRows?: number }, unknown];
  return Number(r?.affectedRows ?? 0) > 0;
}

export type DecisaoSobreALicao =
  | { accao: "aprovar" }
  | { accao: "corrigir"; resposta: string; pergunta?: string }
  | { accao: "recusar" };

/**
 * APROVAR, CORRIGIR OU RECUSAR — por uma pessoa da CLYON. Devolve o motivo
 * quando não se pode: aprovar uma lição bloqueada não se faz, e uma correcção
 * com um preço errado também não.
 */
export async function decidirLicao(
  id: number,
  decisao: DecisaoSobreALicao,
  quem: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if (!Number.isInteger(id) || id <= 0) return { ok: false, motivo: "Lição desconhecida." };
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) return { ok: false, motivo: "Sem base de dados." };
  const [rows] = (await pool.execute("SELECT * FROM licoesDaVitoria WHERE id = ?", [id])) as [
    Array<Record<string, unknown>>,
    unknown,
  ];
  if (rows.length === 0) return { ok: false, motivo: "Lição desconhecida." };
  const actual = linhaParaLicao(rows[0]);
  const por = quem.slice(0, 120) || "backoffice";

  if (decisao.accao === "recusar") {
    await pool.execute(
      "UPDATE licoesDaVitoria SET estado = 'recusada', revistaPor = ?, revistaEm = UTC_TIMESTAMP() WHERE id = ?",
      [por, id],
    );
  } else if (decisao.accao === "aprovar") {
    const motivo = actual.bloqueadaPor ?? motivoParaBloquear(actual.respostaProposta);
    if (motivo) return { ok: false, motivo: `Não se pode aprovar: ${motivo} Corrija a resposta.` };
    if (!actual.respostaProposta.trim()) return { ok: false, motivo: "A resposta está vazia — escreva-a em «Corrigir»." };
    await pool.execute(
      "UPDATE licoesDaVitoria SET estado = 'aprovada', revistaPor = ?, revistaEm = UTC_TIMESTAMP() WHERE id = ?",
      [por, id],
    );
  } else {
    const resposta = decisao.resposta.trim();
    const pergunta = (decisao.pergunta ?? actual.pergunta).trim();
    if (resposta.length < 3) return { ok: false, motivo: "Escreva a resposta que a Vitória deve dar." };
    const motivo = motivoParaBloquear(resposta);
    if (motivo) return { ok: false, motivo };
    await pool.execute(
      `UPDATE licoesDaVitoria
          SET estado = 'corrigida', respostaProposta = ?, pergunta = ?, bloqueadaPor = NULL,
              revistaPor = ?, revistaEm = UTC_TIMESTAMP()
        WHERE id = ?`,
      [resposta.slice(0, 2000), pergunta.slice(0, 2000) || actual.pergunta, por, id],
    );
  }
  emCache = null;
  return { ok: true };
}

/** Mais um uso — quando a Vitória respondeu com ela. Nunca atira. */
export async function contarUsoDaLicao(id: number): Promise<void> {
  try {
    await garantirTabelas();
    const pool = await getPool();
    if (!pool) return;
    await pool.execute("UPDATE licoesDaVitoria SET usos = usos + 1 WHERE id = ?", [id]);
  } catch {
    /* um uso por contar não cala a Vitória */
  }
}

/* ── As lições em uso, com cache curta ─────────────────────────────────── */

/** Um minuto: aprovar uma lição chega à conversa seguinte depressa, sem ir à base a cada mensagem. */
export const CACHE_DAS_LICOES_MS = 60_000;

let emCache: { em: number; licoes: LicaoEmUso[] } | null = null;

/** As aprovadas e corrigidas, não bloqueadas — lidas da base no máximo uma vez por minuto. */
export async function licoesEmUsoNaBase(agora = Date.now()): Promise<LicaoEmUso[]> {
  if (emCache && agora - emCache.em < CACHE_DAS_LICOES_MS) return emCache.licoes;
  await garantirTabelas();
  const pool = await getPool();
  if (!pool) return [];
  const [rows] = (await pool.execute(
    `SELECT * FROM licoesDaVitoria
      WHERE estado IN ('aprovada','corrigida') AND bloqueadaPor IS NULL
      ORDER BY id DESC LIMIT 200`,
  )) as [Array<Record<string, unknown>>, unknown];
  const licoes = rows
    .map(linhaParaLicao)
    .filter(estaEmUso)
    .map((l) => ({ id: l.id, pergunta: l.pergunta, respostaProposta: l.respostaProposta }));
  emCache = { em: agora, licoes };
  return licoes;
}

/**
 * PÕE AS LIÇÕES NA CONVERSA — chamado no princípio de cada mensagem do
 * cliente. Nunca atira: sem base, a Vitória fala com as que já tinha.
 */
export async function refrescarLicoes(): Promise<void> {
  try {
    usarLicoes(await licoesEmUsoNaBase());
    quandoSeUsarUmaLicao((id) => void contarUsoDaLicao(id));
  } catch (e) {
    console.error("[licoes-da-vitoria] não li as lições:", e instanceof Error ? e.message : e);
  }
}

/* ── As mensagens para a rotina e para o painel ────────────────────────── */

/** As conversas com mensagens nas últimas `horas`, cada uma com as últimas `porConversa` mensagens. */
export async function conversasDasUltimasHoras(
  horas = 24,
  porConversa = 60,
): Promise<Array<{ telefone: string; mensagens: MensagemDoFio[] }>> {
  const pool = await getPool();
  if (!pool) return [];
  const [numeros] = (await pool.execute(
    `SELECT RIGHT(telefone, 9) AS chave, MAX(telefone) AS telefone FROM whatsappMensagens
      WHERE criadoEm >= UTC_TIMESTAMP() - INTERVAL ${Math.max(1, Math.min(72, Math.floor(horas)))} HOUR
      GROUP BY RIGHT(telefone, 9)
      LIMIT 300`,
  )) as [Array<{ chave: string; telefone: string }>, unknown];
  const out: Array<{ telefone: string; mensagens: MensagemDoFio[] }> = [];
  for (const n of numeros) {
    const [rows] = (await pool.execute(
      `SELECT id, direccao, texto, criadoEm FROM whatsappMensagens
        WHERE RIGHT(telefone, 9) = ?
        ORDER BY id DESC
        LIMIT ${Math.max(5, Math.min(200, Math.floor(porConversa)))}`,
      [String(n.chave)],
    )) as [Array<Record<string, unknown>>, unknown];
    out.push({
      telefone: String(n.telefone),
      mensagens: rows
        .reverse()
        .map((r) => ({
          id: Number(r.id),
          direccao: String(r.direccao),
          texto: String(r.texto ?? ""),
          criadoEm: data(r.criadoEm) ?? new Date(0),
        })),
    });
  }
  return out;
}

/** As mensagens dos últimos 15 dias, para o painel das duas semanas. */
export async function mensagensParaOPainel(): Promise<MensagemDoPainel[]> {
  const pool = await getPool();
  if (!pool) return [];
  const [rows] = (await pool.execute(
    `SELECT telefone, direccao, texto, criadoEm FROM whatsappMensagens
      WHERE criadoEm >= UTC_TIMESTAMP() - INTERVAL 15 DAY
      ORDER BY id DESC
      LIMIT 30000`,
  )) as [Array<Record<string, unknown>>, unknown];
  return rows.map((r) => ({
    telefone: String(r.telefone),
    direccao: String(r.direccao),
    texto: String(r.texto ?? ""),
    criadoEm: data(r.criadoEm) ?? new Date(0),
  }));
}

/** O nome do pedido de cada número — para o tirar da lição onde quer que apareça. */
export async function nomesDoNumero(telefone: string): Promise<string[]> {
  const pool = await getPool();
  if (!pool) return [];
  const nomes: string[] = [];
  try {
    const [rows] = (await pool.execute(
      `SELECT contactName FROM simulatorOrders
        WHERE RIGHT(REPLACE(REPLACE(contactPhone, ' ', ''), '+', ''), 9) = RIGHT(?, 9)
        ORDER BY id DESC LIMIT 5`,
      [telefone.replace(/\D/g, "")],
    )) as [Array<{ contactName: string | null }>, unknown];
    for (const r of rows) if (r.contactName) nomes.push(String(r.contactName));
  } catch {
    /* sem o nome do pedido, ficam os padrões («sou o …», «Obrigado …») */
  }
  try {
    const [rows] = (await pool.execute(
      "SELECT dadosJson FROM whatsappRecolhas WHERE RIGHT(telefone, 9) = RIGHT(?, 9) LIMIT 1",
      [telefone.replace(/\D/g, "")],
    )) as [Array<{ dadosJson: string | null }>, unknown];
    const d = rows[0]?.dadosJson ? (JSON.parse(String(rows[0].dadosJson)) as { contactName?: string }) : null;
    if (d?.contactName) nomes.push(String(d.contactName));
  } catch {
    /* idem */
  }
  return nomes;
}

/* ── As passagens das rotinas ──────────────────────────────────────────── */

/**
 * CARIMBA UMA PASSAGEM — corre `fazer`, e grava se correu bem, quanto demorou
 * e o motivo quando falhou. A falha volta a quem chamou, depois de gravada.
 */
export async function carimbarPassagem<T>(
  rotina: string,
  fazer: () => Promise<T>,
  resumo: (r: T) => { ok: boolean; motivo?: string | null; detalhe?: unknown },
): Promise<T> {
  const comecou = new Date();
  const gravar = async (ok: boolean, motivo: string | null, detalhe: unknown) => {
    try {
      await garantirTabelas();
      const pool = await getPool();
      if (!pool) return;
      await pool.execute(
        `INSERT INTO passagensDasRotinas (rotina, comecouEm, acabouEm, ok, motivo, detalhe)
         VALUES (?, ?, UTC_TIMESTAMP(), ?, ?, ?)`,
        [
          rotina.slice(0, 60),
          comecou.toISOString().slice(0, 19).replace("T", " "),
          ok ? 1 : 0,
          motivo ? motivo.slice(0, 500) : null,
          detalhe == null ? null : JSON.stringify(detalhe).slice(0, 20000),
        ],
      );
      await pool
        .execute("DELETE FROM passagensDasRotinas WHERE comecouEm < UTC_TIMESTAMP() - INTERVAL 90 DAY LIMIT 200")
        .catch(() => {});
    } catch (e) {
      console.error(`[passagens/${rotina}] não carimbei:`, e instanceof Error ? e.message : e);
    }
  };
  try {
    const r = await fazer();
    const s = resumo(r);
    await gravar(s.ok, s.motivo ?? null, s.detalhe ?? null);
    return r;
  } catch (e) {
    await gravar(false, e instanceof Error ? e.message : String(e), null);
    throw e;
  }
}

/** As últimas passagens de uma rotina — para o painel. */
export async function ultimasPassagens(
  rotina: string,
  limite = 5,
): Promise<Array<{ comecouEm: string; ok: boolean; motivo: string | null }>> {
  try {
    await garantirTabelas();
    const pool = await getPool();
    if (!pool) return [];
    const [rows] = (await pool.execute(
      `SELECT comecouEm, ok, motivo FROM passagensDasRotinas WHERE rotina = ? ORDER BY id DESC
        LIMIT ${Math.max(1, Math.min(50, Math.floor(limite)))}`,
      [rotina],
    )) as [Array<Record<string, unknown>>, unknown];
    return rows.map((r) => ({
      comecouEm: data(r.comecouEm)?.toISOString() ?? "",
      ok: Number(r.ok) === 1,
      motivo: r.motivo == null ? null : String(r.motivo),
    }));
  } catch {
    return [];
  }
}
