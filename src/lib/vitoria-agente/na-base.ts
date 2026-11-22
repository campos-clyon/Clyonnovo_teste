/**
 * A VITÓRIA AGENTE NA BASE — d85, fase 0 (22-11-2026).
 *
 *  - `vitoriaAccoes` — o registo de cada passo do agente: a chamada ao modelo
 *    (modelo, tokens, custo), cada ferramenta (entrada e resultado) e a
 *    resposta. Nesta fase tudo é ENSAIO (`ensaio = 1`): nada foi enviado nem
 *    gravado no pedido;
 *  - `vitoriaEnsaios` — uma linha por mensagem do cliente ensaiada: a resposta
 *    real (das regras) ao lado da do agente, o custo, e a avaliação da equipa
 *    («melhor» / «pior»);
 *  - `vitoriaAgenteDefinicoes` — o tecto diário em dólares;
 *  - o interruptor «Vitória agente — ensaio» (`retencaoInterruptores`),
 *    DESLIGADO por omissão e na dúvida; só o administrador o liga, com LIGAR;
 *  - `ensaioEmSombra` — chamado DEPOIS de a Vitória de hoje responder: corre o
 *    agente com a conversa sem dados de pessoas e grava o que ele teria dito e
 *    feito. Nunca envia. Nunca lança.
 */

import type { Pool } from "mysql2/promise";
import { ensureRegistoTable, getPool, registarNaTransaccao } from "../db";
import { diaEmLisboa, instanteDaBase, primeiroDoMesEmLisboa } from "../hora-de-lisboa";
import { conversaAnonimizada, ultimosDigitos, type QuemEscreve } from "./anonimizar";
import { clienteDoClaude, chaveDoClaude, correrOAgente, type ClienteDoClaude, type LinhaDoRegistoDoAgente, type ResultadoDoAgente } from "./cliente";
import { MODELO_DA_VITORIA_AGENTE, TECTO_DIARIO_POR_OMISSAO_USD, tectoDasConfigs, tectoValido, type EsforcoDoAgente } from "./custo";
import type { DependenciasDasFerramentas, LinhaLida, PedidoParaOAgente } from "./ferramentas";

export const NOME_DO_INTERRUPTOR_DO_ENSAIO = "Vitória agente — ensaio";
export const CHAVE_DO_ENSAIO = "vitoria_agente_ensaio";
const CHAVE_DO_TECTO = "tecto_diario_usd";

export const SQL_DAS_TABELAS_DA_VITORIA_AGENTE = [
  `CREATE TABLE IF NOT EXISTS retencaoInterruptores (
      chave     VARCHAR(40) NOT NULL PRIMARY KEY,
      ligado    TINYINT(1) NOT NULL DEFAULT 0,
      mudadoEm  DATETIME NULL DEFAULT NULL,
      porQuem   VARCHAR(120) NULL DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS vitoriaAccoes (
      id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      ensaioId           BIGINT UNSIGNED NULL DEFAULT NULL,
      pedidoId           INT UNSIGNED NULL DEFAULT NULL,
      telefone           VARCHAR(20) NULL DEFAULT NULL,
      ferramenta         VARCHAR(40) NOT NULL,
      entradaJson        TEXT NULL,
      resultadoJson      MEDIUMTEXT NULL,
      texto              TEXT NULL,
      modelo             VARCHAR(60) NULL DEFAULT NULL,
      tokensEntrada      INT UNSIGNED NOT NULL DEFAULT 0,
      tokensSaida        INT UNSIGNED NOT NULL DEFAULT 0,
      tokensCacheLidos   INT UNSIGNED NOT NULL DEFAULT 0,
      tokensCacheEscritos INT UNSIGNED NOT NULL DEFAULT 0,
      custoUsd           DECIMAL(10,6) NOT NULL DEFAULT 0,
      ensaio             TINYINT(1) NOT NULL DEFAULT 1,
      erro               VARCHAR(255) NULL DEFAULT NULL,
      criadoEm           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_vitoria_accoes_telefone (telefone, criadoEm),
      KEY idx_vitoria_accoes_criado (criadoEm),
      KEY idx_vitoria_accoes_ensaio (ensaioId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS vitoriaEnsaios (
      id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      telefone           VARCHAR(20) NOT NULL,
      pedidoId           INT UNSIGNED NULL DEFAULT NULL,
      mensagemDoCliente  TEXT NULL,
      respostaReal       TEXT NULL,
      respostaDoAgente   TEXT NULL,
      teriaFeitoJson     TEXT NULL,
      estado             VARCHAR(20) NOT NULL,
      motivo             VARCHAR(255) NULL DEFAULT NULL,
      modelo             VARCHAR(60) NULL DEFAULT NULL,
      tokensEntrada      INT UNSIGNED NOT NULL DEFAULT 0,
      tokensSaida        INT UNSIGNED NOT NULL DEFAULT 0,
      tokensCacheLidos   INT UNSIGNED NOT NULL DEFAULT 0,
      tokensCacheEscritos INT UNSIGNED NOT NULL DEFAULT 0,
      custoUsd           DECIMAL(10,6) NOT NULL DEFAULT 0,
      avaliacao          VARCHAR(10) NULL DEFAULT NULL,
      avaliadoPor        VARCHAR(120) NULL DEFAULT NULL,
      avaliadoEm         DATETIME NULL DEFAULT NULL,
      criadoEm           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_vitoria_ensaios_criado (criadoEm),
      KEY idx_vitoria_ensaios_telefone (telefone, criadoEm)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS vitoriaAgenteDefinicoes (
      chave     VARCHAR(40) NOT NULL PRIMARY KEY,
      valor     VARCHAR(255) NOT NULL,
      mudadoEm  DATETIME NULL DEFAULT NULL,
      porQuem   VARCHAR(120) NULL DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

let tabelasProntas = false;

/** Cria as tabelas (uma vez por instância). */
export async function garantirTabelas(): Promise<Pool> {
  const pool = await getPool();
  if (!pool) throw new Error("[vitoria-agente] base de dados indisponível");
  if (!tabelasProntas) {
    for (const sql of SQL_DAS_TABELAS_DA_VITORIA_AGENTE) await pool.execute(sql);
    tabelasProntas = true;
  }
  return pool;
}

const digitos = (t: string | null | undefined) => String(t ?? "").replace(/\D/g, "").slice(-20);
const json = (v: unknown, max: number) => {
  if (v === undefined) return null;
  try {
    return JSON.stringify(v).slice(0, max);
  } catch {
    return null;
  }
};

/* ── O interruptor do ensaio ─────────────────────────────────────────────── */

export type InterruptorDoEnsaio = { ligado: boolean; mudadoEm: string | null; porQuem: string | null };

/** DESLIGADO NA DÚVIDA: sem linha, sem tabela, ou com a base a falhar. */
export async function interruptorDoEnsaio(): Promise<InterruptorDoEnsaio> {
  const desligado: InterruptorDoEnsaio = { ligado: false, mudadoEm: null, porQuem: null };
  try {
    const pool = await garantirTabelas();
    const [rows] = (await pool.execute("SELECT ligado, mudadoEm, porQuem FROM retencaoInterruptores WHERE chave = ? LIMIT 1", [
      CHAVE_DO_ENSAIO,
    ])) as [Array<{ ligado: number; mudadoEm: Date | string | null; porQuem: string | null }>, unknown];
    const l = rows[0];
    if (!l) return desligado;
    return { ligado: Number(l.ligado) === 1, mudadoEm: instanteDaBase(l.mudadoEm)?.toISOString() ?? null, porQuem: l.porQuem ?? null };
  } catch (e) {
    console.error("[vitoria-agente] não li o interruptor — fica desligado:", e instanceof Error ? e.message : e);
    return desligado;
  }
}

/** Liga ou desliga; a mudança e quem a fez ficam no registo permanente, na mesma transacção. */
export async function mudarInterruptorDoEnsaio(ligar: boolean, porQuem: string): Promise<InterruptorDoEnsaio> {
  const pool = await garantirTabelas();
  await ensureRegistoTable();
  const antes = await interruptorDoEnsaio();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO retencaoInterruptores (chave, ligado, mudadoEm, porQuem) VALUES (?, ?, UTC_TIMESTAMP(), ?)
       ON DUPLICATE KEY UPDATE ligado = VALUES(ligado), mudadoEm = VALUES(mudadoEm), porQuem = VALUES(porQuem)`,
      [CHAVE_DO_ENSAIO, ligar ? 1 : 0, porQuem.slice(0, 120)],
    );
    await registarNaTransaccao(conn, {
      acontecimento: "vitoria_agente_ensaio",
      autorTipo: "clyon",
      autorNome: porQuem,
      estadoAntes: antes.ligado ? "ligado" : "desligado",
      estadoDepois: ligar ? "ligado" : "desligado",
      resumo: `«${NOME_DO_INTERRUPTOR_DO_ENSAIO}» ${ligar ? "LIGADO" : "DESLIGADO"} por ${porQuem} (d85).`,
    });
    await conn.commit();
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
  return interruptorDoEnsaio();
}

/* ── O tecto e o gasto ───────────────────────────────────────────────────── */

/** O tecto diário em dólares; sem linha (ou inválido), o de omissão. */
export async function tectoDiarioUsd(): Promise<number> {
  try {
    const pool = await garantirTabelas();
    const [rows] = (await pool.execute("SELECT valor FROM vitoriaAgenteDefinicoes WHERE chave = ? LIMIT 1", [CHAVE_DO_TECTO])) as [
      Array<{ valor: string }>,
      unknown,
    ];
    return tectoDasConfigs(rows[0]?.valor);
  } catch {
    return TECTO_DIARIO_POR_OMISSAO_USD;
  }
}

export async function mudarTectoDiario(valor: unknown, porQuem: string): Promise<number> {
  const t = tectoValido(valor);
  if (t == null) throw new Error("tecto inválido");
  const pool = await garantirTabelas();
  await pool.execute(
    `INSERT INTO vitoriaAgenteDefinicoes (chave, valor, mudadoEm, porQuem) VALUES (?, ?, UTC_TIMESTAMP(), ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor), mudadoEm = VALUES(mudadoEm), porQuem = VALUES(porQuem)`,
    [CHAVE_DO_TECTO, String(t), porQuem.slice(0, 120)],
  );
  return t;
}

type LinhaDaChamada = {
  criadoEm: Date;
  custoUsd: number;
  tokensEntrada: number;
  tokensSaida: number;
  tokensCacheLidos: number;
  tokensCacheEscritos: number;
  modelo: string | null;
  erro: string | null;
};

/** As chamadas ao modelo dos últimos 32 dias (os totais fazem-se aqui, no dia de Lisboa). */
async function chamadasRecentes(pool: Pool): Promise<LinhaDaChamada[]> {
  const [rows] = (await pool.execute(
    `SELECT criadoEm, custoUsd, tokensEntrada, tokensSaida, tokensCacheLidos, tokensCacheEscritos, modelo, erro
       FROM vitoriaAccoes
      WHERE ferramenta = 'chamada' AND criadoEm >= UTC_TIMESTAMP() - INTERVAL 32 DAY
      ORDER BY id DESC
      LIMIT 20000`,
  )) as [Array<Record<string, unknown>>, unknown];
  return rows
    .map((r) => ({
      criadoEm: instanteDaBase(r.criadoEm as string | Date | null) ?? new Date(0),
      custoUsd: Number(r.custoUsd) || 0,
      tokensEntrada: Number(r.tokensEntrada) || 0,
      tokensSaida: Number(r.tokensSaida) || 0,
      tokensCacheLidos: Number(r.tokensCacheLidos) || 0,
      tokensCacheEscritos: Number(r.tokensCacheEscritos) || 0,
      modelo: (r.modelo as string | null) ?? null,
      erro: (r.erro as string | null) ?? null,
    }))
    .filter((r) => r.criadoEm.getTime() > 0);
}

/** Pura: os totais de hoje e do mês (Lisboa). */
export function totaisDasChamadas(linhas: readonly LinhaDaChamada[], agora: Date) {
  const hoje = diaEmLisboa(agora);
  const mes = primeiroDoMesEmLisboa(agora).slice(0, 7);
  const soma = (ls: readonly LinhaDaChamada[]) => ({
    chamadas: ls.length,
    erros: ls.filter((l) => l.erro).length,
    custoUsd: Math.round(ls.reduce((s, l) => s + l.custoUsd, 0) * 10000) / 10000,
    tokensEntrada: ls.reduce((s, l) => s + l.tokensEntrada, 0),
    tokensSaida: ls.reduce((s, l) => s + l.tokensSaida, 0),
    tokensCacheLidos: ls.reduce((s, l) => s + l.tokensCacheLidos, 0),
    tokensCacheEscritos: ls.reduce((s, l) => s + l.tokensCacheEscritos, 0),
  });
  return {
    hoje: soma(linhas.filter((l) => diaEmLisboa(l.criadoEm) === hoje)),
    mes: soma(linhas.filter((l) => diaEmLisboa(l.criadoEm).slice(0, 7) === mes)),
  };
}

export async function gastoDeHojeUsd(agora: Date = new Date()): Promise<number> {
  const pool = await garantirTabelas();
  return totaisDasChamadas(await chamadasRecentes(pool), agora).hoje.custoUsd;
}

/* ── O registo ───────────────────────────────────────────────────────────── */

/** Grava um passo do agente. Nunca lança (o registo não pode parar a conversa). */
export async function registarAccao(
  l: LinhaDoRegistoDoAgente & { ensaioId?: number | null; pedidoId?: number | null; telefone?: string | null; ensaio?: boolean },
): Promise<void> {
  try {
    const pool = await garantirTabelas();
    await pool.execute(
      `INSERT INTO vitoriaAccoes (ensaioId, pedidoId, telefone, ferramenta, entradaJson, resultadoJson, texto, modelo,
         tokensEntrada, tokensSaida, tokensCacheLidos, tokensCacheEscritos, custoUsd, ensaio, erro)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        l.ensaioId ?? null,
        l.pedidoId ?? null,
        l.telefone ? digitos(l.telefone) : null,
        l.ferramenta.slice(0, 40),
        json(l.entrada, 4000),
        json(l.resultado, 60000),
        l.texto ? l.texto.slice(0, 4000) : null,
        l.modelo ? l.modelo.slice(0, 60) : null,
        l.uso?.entrada ?? 0,
        l.uso?.saida ?? 0,
        l.uso?.cacheLidos ?? 0,
        l.uso?.cacheEscritos ?? 0,
        l.custoUsd ?? 0,
        l.ensaio === false ? 0 : 1,
        l.erro ? l.erro.slice(0, 255) : null,
      ],
    );
  } catch (e) {
    console.error("[vitoria-agente] não gravei a acção:", e instanceof Error ? e.message : e);
  }
}

/* ── O termómetro ────────────────────────────────────────────────────────── */

export type Termometro = {
  ensaio: InterruptorDoEnsaio;
  chave: { existe: boolean; porque: string | null };
  modelo: string;
  tectoUsd: number;
  hoje: ReturnType<typeof totaisDasChamadas>["hoje"];
  mes: ReturnType<typeof totaisDasChamadas>["mes"];
  passouOTecto: boolean;
  ultimas: Array<{ em: string; modelo: string | null; tokensEntrada: number; tokensSaida: number; tokensCacheLidos: number; custoUsd: number; erro: string | null }>;
};

/** O estado do agente para o painel. Sem a base, diz o que sabe (a chave e o interruptor). */
export async function termometro(agora: Date = new Date()): Promise<Termometro> {
  const ensaio = await interruptorDoEnsaio();
  const existe = chaveDoClaude() != null;
  const chave = { existe, porque: existe ? null : "Falta a variável ANTHROPIC_API_KEY na Vercel: o agente está inactivo." };
  const tectoUsd = await tectoDiarioUsd();
  let linhas: LinhaDaChamada[] = [];
  try {
    linhas = await chamadasRecentes(await garantirTabelas());
  } catch {
    /* sem base: zeros */
  }
  const t = totaisDasChamadas(linhas, agora);
  return {
    ensaio,
    chave,
    modelo: MODELO_DA_VITORIA_AGENTE,
    tectoUsd,
    hoje: t.hoje,
    mes: t.mes,
    passouOTecto: t.hoje.custoUsd >= tectoUsd,
    ultimas: linhas.slice(0, 20).map((l) => ({
      em: l.criadoEm.toISOString(),
      modelo: l.modelo,
      tokensEntrada: l.tokensEntrada,
      tokensSaida: l.tokensSaida,
      tokensCacheLidos: l.tokensCacheLidos,
      custoUsd: l.custoUsd,
      erro: l.erro,
    })),
  };
}

/* ── O ensaio em sombra ──────────────────────────────────────────────────── */

export type LinhaDoFio = { direccao: string; texto: string; criadoEm?: string | null };

/**
 * Pura: parte o fio na última mensagem do cliente. A conversa vai até ela
 * (inclusive); a resposta real são as mensagens que saíram depois.
 */
export function partirNaUltimaDoCliente<T extends LinhaDoFio>(fio: readonly T[]): { conversa: T[]; doCliente: string; respostaReal: string } | null {
  let i = fio.length - 1;
  while (i >= 0 && fio[i].direccao !== "in") i -= 1;
  if (i < 0) return null;
  let inicio = i;
  // As mensagens seguidas do cliente (uma rajada) contam como uma.
  while (inicio > 0 && fio[inicio - 1].direccao === "in") inicio -= 1;
  const doCliente = fio
    .slice(inicio, i + 1)
    .map((l) => l.texto)
    .join("\n");
  const respostaReal = fio
    .slice(i + 1)
    .filter((l) => l.direccao !== "in")
    .map((l) => l.texto)
    .join("\n");
  return { conversa: fio.slice(0, i + 1), doCliente, respostaReal };
}

/** As dependências de verdade das ferramentas, para um telefone. A conversa e as descrições já sem dados de pessoas. */
export async function ferramentasDeVerdade(telefone: string, agora: Date, quem: readonly QuemEscreve[]): Promise<DependenciasDasFerramentas> {
  const neg = await import("../whatsapp-negociacao");
  const db = await import("../db");
  const { oQueOSiteSabe } = await import("../o-que-o-site-sabe");
  let meus: number[] | null = null;
  return {
    telefone,
    agora,
    pedidosDoTelefone: async () => (meus ??= await neg.pedidosDoTelefone(telefone)),
    lerPedido: async (id) => ((await db.getSimulatorOrderById(id)) as unknown as PedidoParaOAgente | undefined) ?? null,
    lerConversa: async (n): Promise<LinhaLida[]> => conversaAnonimizada(await db.mensagensDoNumeroWhatsApp(telefone, n), quem),
    propostasDoPedido: (id) => neg.ecraDoPedido(id),
    oQueOSiteSabe: () => oQueOSiteSabe(agora),
  };
}

/** Quem escreve neste número (para lhe tirar o nome e a rua do que vai ao modelo). */
async function quemEscreveNoNumero(telefone: string): Promise<{ pedidos: number[]; quem: QuemEscreve[] }> {
  const neg = await import("../whatsapp-negociacao");
  const db = await import("../db");
  const pedidos = await neg.pedidosDoTelefone(telefone).catch(() => [] as number[]);
  const quem: QuemEscreve[] = [];
  for (const id of pedidos.slice(0, 5)) {
    const p = await db.getSimulatorOrderById(id).catch(() => undefined);
    if (p) quem.push({ contactName: p.contactName ?? null, address: p.address ?? null });
  }
  return { pedidos, quem };
}

export type ResultadoDoEnsaio = { feito: boolean; porque: string; ensaioId?: number; resultado?: ResultadoDoAgente };

/**
 * O ENSAIO EM SOMBRA DE UMA MENSAGEM. Corre DEPOIS da resposta real (que as
 * regras já deram): o agente lê a mesma conversa, sem dados de pessoas, e
 * grava-se o que teria dito e feito, ao lado do que se disse. NUNCA ENVIA.
 * Desligado, sem chave, ou com o tecto passado, não chama o modelo.
 * Nunca lança.
 */
export async function ensaioEmSombra(
  telefone: string,
  opcoes: { agora?: Date; cliente?: ClienteDoClaude | null; esforco?: EsforcoDoAgente } = {},
): Promise<ResultadoDoEnsaio> {
  try {
    if (!(await interruptorDoEnsaio()).ligado) return { feito: false, porque: "ensaio desligado" };
    const cliente = opcoes.cliente !== undefined ? opcoes.cliente : clienteDoClaude();
    if (!cliente) return { feito: false, porque: "falta a chave ANTHROPIC_API_KEY" };
    const agora = opcoes.agora ?? new Date();
    const db = await import("../db");
    const fio = await db.mensagensDoNumeroWhatsApp(telefone, 40);
    const partido = partirNaUltimaDoCliente(fio);
    if (!partido || !partido.doCliente.trim()) return { feito: false, porque: "sem mensagem do cliente" };
    const { pedidos, quem } = await quemEscreveNoNumero(telefone);
    const conversa = conversaAnonimizada(partido.conversa, quem);

    const pool = await garantirTabelas();
    const [novo] = (await pool.execute(
      "INSERT INTO vitoriaEnsaios (telefone, pedidoId, mensagemDoCliente, respostaReal, estado) VALUES (?, ?, ?, ?, 'a_correr')",
      [digitos(telefone), pedidos[0] ?? null, conversaAnonimizada([{ direccao: "in", texto: partido.doCliente }], quem)[0].texto.slice(0, 4000), partido.respostaReal.slice(0, 4000) || null],
    )) as [{ insertId: number }, unknown];
    const ensaioId = Number(novo.insertId);

    const resultado = await correrOAgente(
      { conversa, pedidos, agora, esforco: opcoes.esforco },
      {
        cliente,
        ferramentas: await ferramentasDeVerdade(telefone, agora, quem),
        gastoETecto: async () => ({ gastoUsd: await gastoDeHojeUsd(agora), tectoUsd: await tectoDiarioUsd() }),
        registar: (l) => registarAccao({ ...l, ensaioId, telefone, pedidoId: pedidos[0] ?? null, ensaio: true }),
      },
    );
    await pool.execute(
      `UPDATE vitoriaEnsaios SET respostaDoAgente = ?, teriaFeitoJson = ?, estado = ?, motivo = ?, modelo = ?,
         tokensEntrada = ?, tokensSaida = ?, tokensCacheLidos = ?, tokensCacheEscritos = ?, custoUsd = ?
       WHERE id = ?`,
      [
        resultado.texto ? resultado.texto.slice(0, 4000) : null,
        json(resultado.teriaFeito, 4000),
        resultado.estado,
        resultado.motivo ? resultado.motivo.slice(0, 255) : null,
        resultado.modelo,
        resultado.uso.entrada,
        resultado.uso.saida,
        resultado.uso.cacheLidos,
        resultado.uso.cacheEscritos,
        resultado.custoUsd,
        ensaioId,
      ],
    );
    return { feito: true, porque: resultado.estado, ensaioId, resultado };
  } catch (e) {
    console.error("[vitoria-agente] o ensaio falhou:", e instanceof Error ? e.message : e);
    return { feito: false, porque: "erro" };
  }
}

/* ── O painel «Ensaio da Vitória» ────────────────────────────────────────── */

export type EnsaioNoPainel = {
  id: number;
  em: string;
  telefone: string;
  pedidoId: number | null;
  mensagemDoCliente: string | null;
  respostaReal: string | null;
  respostaDoAgente: string | null;
  teriaFeito: string[];
  estado: string;
  motivo: string | null;
  custoUsd: number;
  tokensCacheLidos: number;
  avaliacao: "melhor" | "pior" | null;
  avaliadoPor: string | null;
};

/** Os últimos ensaios (só os últimos dígitos do telefone), e quantos melhor/pior. */
export async function ensaiosNoPainel(limite = 50): Promise<{ ensaios: EnsaioNoPainel[]; melhor: number; pior: number; porAvaliar: number }> {
  const pool = await garantirTabelas();
  const n = Math.max(1, Math.min(200, Math.floor(limite)));
  const [rows] = (await pool.execute(
    `SELECT id, criadoEm, telefone, pedidoId, mensagemDoCliente, respostaReal, respostaDoAgente, teriaFeitoJson, estado, motivo,
            custoUsd, tokensCacheLidos, avaliacao, avaliadoPor
       FROM vitoriaEnsaios ORDER BY id DESC LIMIT ${n}`,
  )) as [Array<Record<string, unknown>>, unknown];
  const ensaios = rows.map((r) => {
    let teriaFeito: string[] = [];
    try {
      const v = JSON.parse(String(r.teriaFeitoJson ?? "[]"));
      if (Array.isArray(v)) teriaFeito = v.map(String);
    } catch {
      /* fica vazio */
    }
    const av = String(r.avaliacao ?? "");
    return {
      id: Number(r.id),
      em: instanteDaBase(r.criadoEm as string | Date | null)?.toISOString() ?? "",
      telefone: ultimosDigitos(String(r.telefone ?? "")),
      pedidoId: r.pedidoId == null ? null : Number(r.pedidoId),
      mensagemDoCliente: (r.mensagemDoCliente as string | null) ?? null,
      respostaReal: (r.respostaReal as string | null) ?? null,
      respostaDoAgente: (r.respostaDoAgente as string | null) ?? null,
      teriaFeito,
      estado: String(r.estado ?? ""),
      motivo: (r.motivo as string | null) ?? null,
      custoUsd: Number(r.custoUsd) || 0,
      tokensCacheLidos: Number(r.tokensCacheLidos) || 0,
      avaliacao: av === "melhor" || av === "pior" ? av : null,
      avaliadoPor: (r.avaliadoPor as string | null) ?? null,
    } satisfies EnsaioNoPainel;
  });
  const [cont] = (await pool.execute(
    `SELECT SUM(avaliacao = 'melhor') AS melhor, SUM(avaliacao = 'pior') AS pior,
            SUM(avaliacao IS NULL AND estado = 'ok') AS porAvaliar
       FROM vitoriaEnsaios`,
  )) as [Array<Record<string, unknown>>, unknown];
  return {
    ensaios,
    melhor: Number(cont[0]?.melhor) || 0,
    pior: Number(cont[0]?.pior) || 0,
    porAvaliar: Number(cont[0]?.porAvaliar) || 0,
  };
}

/** «Esta estava melhor / pior» — a equipa avalia a resposta do agente contra a real. */
export async function avaliarEnsaio(id: number, avaliacao: unknown, porQuem: string): Promise<boolean> {
  if (!Number.isInteger(id) || id <= 0) return false;
  if (avaliacao !== "melhor" && avaliacao !== "pior" && avaliacao !== null) return false;
  const pool = await garantirTabelas();
  const [r] = (await pool.execute(
    "UPDATE vitoriaEnsaios SET avaliacao = ?, avaliadoPor = ?, avaliadoEm = UTC_TIMESTAMP() WHERE id = ?",
    [avaliacao, avaliacao ? porQuem.slice(0, 120) : null, id],
  )) as [{ affectedRows: number }, unknown];
  return Number(r.affectedRows) === 1;
}

/** As acções do agente num ensaio (só leitura), para ver o que ele teria feito passo a passo. */
export async function accoesDoEnsaio(ensaioId: number): Promise<
  Array<{ em: string; ferramenta: string; entrada: string | null; resultado: string | null; texto: string | null; custoUsd: number; erro: string | null }>
> {
  if (!Number.isInteger(ensaioId) || ensaioId <= 0) return [];
  const pool = await garantirTabelas();
  const [rows] = (await pool.execute(
    `SELECT criadoEm, ferramenta, entradaJson, resultadoJson, texto, custoUsd, erro
       FROM vitoriaAccoes WHERE ensaioId = ? ORDER BY id ASC LIMIT 60`,
    [ensaioId],
  )) as [Array<Record<string, unknown>>, unknown];
  return rows.map((r) => ({
    em: instanteDaBase(r.criadoEm as string | Date | null)?.toISOString() ?? "",
    ferramenta: String(r.ferramenta ?? ""),
    entrada: (r.entradaJson as string | null) ?? null,
    resultado: r.resultadoJson ? String(r.resultadoJson).slice(0, 2000) : null,
    texto: (r.texto as string | null) ?? null,
    custoUsd: Number(r.custoUsd) || 0,
    erro: (r.erro as string | null) ?? null,
  }));
}
