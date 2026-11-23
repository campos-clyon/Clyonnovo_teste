/**
 * AS PROPOSTAS VÃO AO CLIENTE SOZINHAS, NA BASE — d88 passo 3 (CEO e dono,
 * 23-11-2026). As regras puras estão em `envio-das-propostas-ao-cliente.ts`.
 *
 *  - o interruptor «Enviar as propostas ao cliente» (Configs, só o
 *    administrador), na tabela dos interruptores (`retencaoInterruptores`):
 *    LIGADO POR OMISSÃO (o dono pediu) — sem linha, ligado; com a base a
 *    falhar, nada sai;
 *  - `envioDasPropostasAoCliente` — UMA linha por pedido (a chave primária é o
 *    pedido): na fila, a enviar, enviado ou falhou. É a reserva que impede o
 *    mesmo orçamento de sair duas vezes;
 *  - a rotina (`/api/cron/propostas-ao-cliente`, de 15 em 15 min, das 8h às
 *    21h de Lisboa) põe na fila os que já podem sair; a passagem (às rondas da
 *    ponte) envia UM de cada vez, 20 a 45 s entre cada, e lê tudo outra vez
 *    antes de enviar;
 *  - a linha do cartão da Mesa e o ensaio das Configs.
 *
 * O envio é o do «Enviar pela CLYON» da Mesa: o texto de `textoDoOrcamentoDaMesa`
 * (a mesma função do painel), o número da plataforma (`enviarTextoManualWhatsApp`),
 * a conversa devolvida à Vitória (`retomarNumeroWhatsApp`) e o pedido em «A
 * aguardar cliente» (`marcarOrcamentoEnviado`) — e daí correm a validade (d62)
 * e o seguimento (d83). Nunca DELETE: a linha fica, e diz o que aconteceu.
 */

import { appendOrderHistory, ensureRegistoTable, getPool, registarNaTransaccao } from "./db";
import { propostasPorEnviarDoPedido, type PedidoParaOLado } from "./do-nosso-lado";
import { instanteDaBase } from "./hora-de-lisboa";
import { naJanelaDasMensagensAutomaticas } from "./janela-das-mensagens-automaticas";
import { propostasParaOCliente } from "./mensagem-das-propostas";
import { textoDoOrcamentoDaMesa, type PedidoDoOrcamento } from "./texto-do-orcamento-da-mesa";
import { melhorProposta } from "./validade-do-orcamento";
import {
  estadoDoEnvio,
  historicoDoEnvioAutomatico,
  linhaDoEnvioNaMesa,
  MOTIVOS_COM_UMA_PESSOA,
  NOME_DO_INTERRUPTOR_DAS_PROPOSTAS,
  type EstadoDoEnvio,
  type PedidoParaOEnvio,
} from "./envio-das-propostas-ao-cliente";

/* ── O interruptor (Configs) — LIGADO por omissão ───────────────────────── */

export const CHAVE_DO_ENVIO_DAS_PROPOSTAS = "enviar_as_propostas_d88";

export type InterruptorDasPropostas = { ligado: boolean; mudadoEm: string | null; porQuem: string | null };

type Pool = NonNullable<Awaited<ReturnType<typeof getPool>>>;

let tabelasProntas = false;

export const SQL_DAS_TABELAS_DAS_PROPOSTAS = [
  `CREATE TABLE IF NOT EXISTS retencaoInterruptores (
      chave     VARCHAR(40) NOT NULL PRIMARY KEY,
      ligado    TINYINT(1) NOT NULL DEFAULT 0,
      mudadoEm  DATETIME NULL DEFAULT NULL,
      porQuem   VARCHAR(120) NULL DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS envioDasPropostasAoCliente (
      pedidoId    INT UNSIGNED NOT NULL PRIMARY KEY,
      estado      VARCHAR(12) NOT NULL,
      naFilaEm    DATETIME NULL DEFAULT NULL,
      reservadoEm DATETIME NULL DEFAULT NULL,
      enviadoEm   DATETIME NULL DEFAULT NULL,
      propostas   TINYINT UNSIGNED NULL DEFAULT NULL,
      motivo      VARCHAR(160) NULL DEFAULT NULL,
      KEY idx_envio_das_propostas_estado (estado, naFilaEm)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS envioDasPropostasVez (
      id        TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      proximoEm DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

async function garantirTabelas(): Promise<Pool> {
  const pool = await getPool();
  if (!pool) throw new Error("[envio-das-propostas] base de dados indisponível");
  if (!tabelasProntas) {
    for (const sql of SQL_DAS_TABELAS_DAS_PROPOSTAS) await pool.execute(sql);
    await pool.execute("INSERT IGNORE INTO envioDasPropostasVez (id, proximoEm) VALUES (1, '2000-01-01 00:00:00')");
    tabelasProntas = true;
  }
  return pool;
}

/** LIGADO POR OMISSÃO (sem linha, ligado); com a base a falhar, desligado — nada sai sem base. */
export async function interruptorDasPropostas(): Promise<InterruptorDasPropostas> {
  try {
    const pool = await garantirTabelas();
    const [rows] = (await pool.execute(
      "SELECT ligado, mudadoEm, porQuem FROM retencaoInterruptores WHERE chave = ? LIMIT 1",
      [CHAVE_DO_ENVIO_DAS_PROPOSTAS],
    )) as [Array<{ ligado: number; mudadoEm: Date | string | null; porQuem: string | null }>, unknown];
    const l = rows[0];
    if (!l) return { ligado: true, mudadoEm: null, porQuem: null };
    return {
      ligado: Number(l.ligado) === 1,
      mudadoEm: l.mudadoEm ? (instanteDaBase(l.mudadoEm)?.toISOString() ?? null) : null,
      porQuem: l.porQuem ?? null,
    };
  } catch (e) {
    console.error("[envio-das-propostas] não li o interruptor — nada sai:", e instanceof Error ? e.message : e);
    return { ligado: false, mudadoEm: null, porQuem: null };
  }
}

/** Liga ou desliga; a mudança e quem a fez ficam no registo permanente, na mesma transacção. */
export async function mudarInterruptorDasPropostas(ligar: boolean, porQuem: string): Promise<InterruptorDasPropostas> {
  const pool = await garantirTabelas();
  await ensureRegistoTable();
  const antes = await interruptorDasPropostas();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO retencaoInterruptores (chave, ligado, mudadoEm, porQuem) VALUES (?, ?, UTC_TIMESTAMP(), ?)
       ON DUPLICATE KEY UPDATE ligado = VALUES(ligado), mudadoEm = VALUES(mudadoEm), porQuem = VALUES(porQuem)`,
      [CHAVE_DO_ENVIO_DAS_PROPOSTAS, ligar ? 1 : 0, porQuem.slice(0, 120)],
    );
    await registarNaTransaccao(conn, {
      acontecimento: "envio_das_propostas_interruptor",
      autorTipo: "clyon",
      autorNome: porQuem,
      estadoAntes: antes.ligado ? "ligado" : "desligado",
      estadoDepois: ligar ? "ligado" : "desligado",
      resumo: `«${NOME_DO_INTERRUPTOR_DAS_PROPOSTAS}» ${ligar ? "LIGADO" : "DESLIGADO"} por ${porQuem} (d88).`,
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
  return interruptorDasPropostas();
}

/* ── Os pedidos, como o envio os vê ──────────────────────────────────────── */

type NegociacaoDaMesa = PedidoParaOLado["negociacoes"][number] &
  PedidoDoOrcamento["negociacoes"][number] & { id: number; providerId: number };

type PedidoDaMesa = Omit<PedidoParaOLado, "negociacoes"> &
  Omit<PedidoDoOrcamento, "negociacoes"> & {
    id: number;
    contactPhone: string | null;
    valorFixoClyon?: unknown;
    negociacoes: NegociacaoDaMesa[];
  };

export type CandidatoAoEnvio = {
  pedido: PedidoDaMesa;
  envio: PedidoParaOEnvio;
  propostas: number;
  estado: EstadoDoEnvio;
  /** A linha da tabela do envio, se já há (fila, a enviar, enviado, falhou, espera). */
  linhaDoEnvio: { estado: string; motivo: string | null } | null;
};

const digitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

/** As linhas do envio dos pedidos pedidos. */
async function linhasDoEnvio(pool: Pool, ids: number[]): Promise<Map<number, { estado: string; motivo: string | null }>> {
  const m = new Map<number, { estado: string; motivo: string | null }>();
  const limpos = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))];
  if (limpos.length === 0) return m;
  const [rows] = (await pool.execute(
    `SELECT pedidoId, estado, motivo FROM envioDasPropostasAoCliente WHERE pedidoId IN (${limpos.map(() => "?").join(",")})`,
    limpos,
  )) as [Array<{ pedidoId: number; estado: string; motivo: string | null }>, unknown];
  for (const r of rows) m.set(Number(r.pedidoId), { estado: String(r.estado), motivo: r.motivo ?? null });
  return m;
}

/**
 * O CLIENTE, COMO A REGRA O PRECISA: a conversa com uma pessoa (entregue, ou a
 * equipa a escrever à mão há pouco, d73), uma queixa, a língua sem tradução
 * fixa deste texto, o número bloqueado, e se já saiu hoje outra mensagem
 * automática. Na dúvida, o lado que não envia.
 */
async function oCliente(
  pool: Pool,
  telefone: string,
  texto: string,
  agora: Date,
): Promise<{ comUmaPessoa: boolean; queixa: boolean; linguaSemTraducao: string | null; bloqueado: boolean; jaSaiuHoje: boolean }> {
  const db = await import("./db");
  const bloqueado = await db.numeroBloqueadoWhatsApp(telefone).catch(() => true);
  const interrompido = await db.numeroInterrompidoWhatsApp(telefone).catch(() => true);
  const fio = await db.mensagensDoNumeroWhatsApp(telefone, 40).catch(() => null);
  const { aEquipaFalouHaPouco } = await import("./pedido-em-curso");
  const { haQueixaNaConversa } = await import("./queixa-na-conversa");
  const comUmaPessoa = interrompido || fio == null || aEquipaFalouHaPouco(fio);
  const queixa = fio != null && haQueixaNaConversa(fio);
  // A língua da conversa (a guardada, ou a que a conversa mostra — o #659); sozinha, só com tradução fixa.
  let linguaSemTraducao: string | null = null;
  try {
    const { orcamentoNaLinguaDaConversa } = await import("./lingua-da-conversa");
    const naLingua = await orcamentoNaLinguaDaConversa(telefone, texto, { soFixa: true });
    if (!naLingua.ok) linguaSemTraducao = naLingua.lingua;
  } catch {
    linguaSemTraducao = "?";
  }
  const { jaSaiuHojeUmaMensagemAutomatica } = await import("./uma-mensagem-automatica-por-dia");
  const jaSaiuHoje = await jaSaiuHojeUmaMensagemAutomatica({ telefone }, agora, { pool }).catch(() => true);
  return { comUmaPessoa, queixa, linguaSemTraducao, bloqueado, jaSaiuHoje };
}

/**
 * OS PEDIDOS COM PROPOSTAS POR ENVIAR — os da Mesa (`pedidosComNegociacoes`),
 * pela mesma conta do cartão («Propostas de parceiros por enviar ao cliente»),
 * com o texto do orçamento tal como sai, a melhor proposta (d62) e o estado
 * do envio de cada um. Com `ids`, só esses.
 */
export async function candidatosAoEnvio(agora: Date, ids?: number[], jaLidos?: readonly unknown[]): Promise<CandidatoAoEnvio[]> {
  const pool = await garantirTabelas();
  const db = await import("./db");
  // Os da Mesa que a rota já leu servem (não se lê a base duas vezes); senão, os 200 mais recentes.
  const todos = JSON.parse(JSON.stringify(jaLidos ?? (await db.pedidosComNegociacoes(200)))) as PedidoDaMesa[];
  const alvo = todos.filter((p) => (!ids || ids.includes(Number(p.id))) && propostasPorEnviarDoPedido(p, agora));
  if (alvo.length === 0) return [];

  // O modelo de 15-11 e o regime de cada negociação, como a rota da Mesa (para o número da mensagem ser o do cartão).
  const { negociacoesNoNovoModelo, regimesDasNegociacoes } = await import("./novo-modelo-no-servidor");
  const { agoraDoModelo } = await import("./relogio-do-modelo");
  const negociacoes = alvo.flatMap((p) => p.negociacoes);
  const doNovoModelo = await negociacoesNoNovoModelo(negociacoes, agoraDoModelo()).catch(() => new Set<number>());
  const regimes = await regimesDasNegociacoes([...doNovoModelo]).catch(() => new Map());
  for (const p of alvo) {
    p.negociacoes = p.negociacoes.map((n) => ({
      ...n,
      ...(doNovoModelo.has(Number(n.id)) ? { noNovoModelo: true } : {}),
      ...(doNovoModelo.has(Number(n.id)) && regimes.has(Number(n.id)) ? { regimeParaOTotal: regimes.get(Number(n.id)) } : {}),
    }));
  }
  // A nota que conta de cada parceiro, para a melhor proposta (a mesma da validade, d62).
  const notas = await db
    .parceirosParaOValorUnico(negociacoes.map((n) => Number(n.providerId)))
    .catch(() => new Map<number, { nota: { media: number; quantas: number } | null; verificado: boolean }>());
  const doEnvio = await linhasDoEnvio(pool, alvo.map((p) => Number(p.id)));

  const out: CandidatoAoEnvio[] = [];
  for (const p of alvo) {
    const por = propostasPorEnviarDoPedido(p, agora)!;
    const propostas = propostasParaOCliente(p.negociacoes);
    const providerDe = new Map(p.negociacoes.map((n) => [Number(n.id), Number(n.providerId)]));
    const melhor = melhorProposta(
      propostas.map((x) => ({
        negociacaoId: x.negociacaoId ?? null,
        parceiro: x.profissional,
        semIva: x.semIva,
        total: x.total,
        nota: notas.get(providerDe.get(Number(x.negociacaoId)) ?? -1)?.nota ?? null,
      })),
    );
    const telefone = String(p.contactPhone ?? "");
    const temTelemovel = digitos(telefone).length >= 9;
    const texto = textoDoOrcamentoDaMesa(p, agora, propostas);
    const cliente = temTelemovel
      ? await oCliente(pool, telefone, texto, agora)
      : { comUmaPessoa: false, queixa: false, linguaSemTraducao: null, bloqueado: false, jaSaiuHoje: false };
    const instantes = [...por.instantes].sort((a, b) => a - b);
    const envio: PedidoParaOEnvio = {
      pedidoId: Number(p.id),
      parceiros: por.parceiros,
      primeiraEm: new Date(instantes[0]),
      ultimaMudancaEm: new Date(instantes[instantes.length - 1]),
      jaEnviado: p.propostaEnviadaEm != null || doEnvio.get(Number(p.id))?.estado === "enviado",
      trabalhoClyon: p.valorFixoClyon != null,
      valorUnico: p.valorUnicoCliente != null,
      base: p.baseDoPreco ?? null,
      comUmaPessoa: cliente.comUmaPessoa,
      queixa: cliente.queixa,
      linguaSemTraducao: cliente.linguaSemTraducao,
      melhorComIva: melhor ? melhor.total : null,
      temTelemovel,
      bloqueado: cliente.bloqueado,
    };
    out.push({
      pedido: p,
      envio,
      propostas: propostas.length,
      estado: estadoDoEnvio(envio, agora, { jaSaiuHoje: cliente.jaSaiuHoje }),
      linhaDoEnvio: doEnvio.get(Number(p.id)) ?? null,
    });
  }
  return out;
}

/* ── A linha da Mesa e o ensaio ──────────────────────────────────────────── */

/** A linha de um candidato, com o que a tabela do envio já diz (a enviar, falhou). */
function linhaDoCandidato(c: CandidatoAoEnvio, ligado: boolean): string | null {
  const l = c.linhaDoEnvio;
  if (l?.estado === "falhou") return `o envio automático falhou${l.motivo ? ` (${l.motivo})` : ""}: enviar à mão`;
  if (l?.estado === "a_enviar" || (ligado && l?.estado === "fila" && c.estado.tipo === "sai")) return "a Vitória está a enviar ao cliente";
  return linhaDoEnvioNaMesa(c.estado, ligado);
}

/** As linhas dos cartões da Mesa (pedido → linha). Nunca lança: sem isto, a Mesa serve. */
export async function linhasDoEnvioNaMesa(agora: Date = new Date(), pedidos?: readonly unknown[]): Promise<Map<number, string>> {
  const m = new Map<number, string>();
  try {
    const { ligado } = await interruptorDasPropostas();
    for (const c of await candidatosAoEnvio(agora, undefined, pedidos)) {
      const l = linhaDoCandidato(c, ligado);
      if (l) m.set(c.envio.pedidoId, l);
    }
  } catch (e) {
    console.error("[envio-das-propostas] a Mesa não leu o envio automático:", e instanceof Error ? e.message : e);
  }
  return m;
}

export type EnsaioDasPropostas = {
  ligado: boolean;
  pedidos: Array<{ pedidoId: number; propostas: number; linha: string | null }>;
};

/** O ensaio das Configs: os pedidos com propostas por enviar, só o número, quantas e a linha. Só lê. */
export async function ensaioDasPropostas(agora: Date = new Date()): Promise<EnsaioDasPropostas> {
  const { ligado } = await interruptorDasPropostas();
  const pedidos = (await candidatosAoEnvio(agora)).map((c) => ({
    pedidoId: c.envio.pedidoId,
    propostas: c.propostas,
    linha: linhaDoCandidato(c, ligado),
  }));
  return { ligado, pedidos };
}

export { MOTIVOS_COM_UMA_PESSOA };

/* ── A rotina: põe na fila os que já podem sair ──────────────────────────── */

export type ResultadoDaRotinaDasPropostas = { ligado: boolean; foraDeHoras?: boolean; naFila: number; ficam: number; esperam: number };

export async function rotinaDasPropostas(agora: Date = new Date()): Promise<ResultadoDaRotinaDasPropostas> {
  const r: ResultadoDaRotinaDasPropostas = { ligado: false, naFila: 0, ficam: 0, esperam: 0 };
  const { ligado } = await interruptorDasPropostas();
  if (!ligado) return r;
  r.ligado = true;
  if (!naJanelaDasMensagensAutomaticas(agora)) {
    r.foraDeHoras = true;
    return r;
  }
  const pool = await garantirTabelas();
  for (const c of await candidatosAoEnvio(agora)) {
    if (c.estado.tipo === "fica") r.ficam += 1;
    if (c.estado.tipo !== "sai") continue;
    if (!c.estado.agora) {
      r.esperam += 1;
      continue;
    }
    // Uma linha por pedido: entra na fila uma vez; só volta à fila o que esperou (nunca o enviado nem o que falhou).
    const [u] = (await pool.execute(
      `INSERT INTO envioDasPropostasAoCliente (pedidoId, estado, naFilaEm) VALUES (?, 'fila', UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE naFilaEm = IF(estado = 'espera', UTC_TIMESTAMP(), naFilaEm), estado = IF(estado = 'espera', 'fila', estado)`,
      [c.envio.pedidoId],
    )) as [{ affectedRows: number }, unknown];
    if (Number(u.affectedRows) >= 1) r.naFila += 1;
  }
  return r;
}

export function resumoDaRotinaDasPropostas(r: ResultadoDaRotinaDasPropostas): string | null {
  if (!r.ligado) return `desligado (interruptor «${NOME_DO_INTERRUPTOR_DAS_PROPOSTAS}» nas Configs)`;
  if (r.foraDeHoras) return "fora das 8h–21h de Lisboa";
  if (r.naFila === 0 && r.ficam === 0 && r.esperam === 0) return null;
  return `${r.naFila} na fila · ${r.esperam} à espera da hora · ${r.ficam} com uma pessoa`;
}

/* ── A passagem: um orçamento por vez, às rondas da ponte ────────────────── */

export type ResultadoDaPassagemDasPropostas = "desligado" | "fora-da-janela" | "nada" | "nao-e-a-vez" | "feito" | "espera" | "falhou";

export async function passagemDasPropostas(agora: Date = new Date()): Promise<ResultadoDaPassagemDasPropostas> {
  if (!naJanelaDasMensagensAutomaticas(agora)) return "fora-da-janela";
  const pool = await garantirTabelas();
  const [proximos] = (await pool.query(
    "SELECT pedidoId FROM envioDasPropostasAoCliente WHERE estado = 'fila' ORDER BY naFilaEm ASC LIMIT 1",
  )) as [Array<{ pedidoId: number }>, unknown];
  const p = proximos[0];
  if (!p) return "nada";
  if (!(await interruptorDasPropostas()).ligado) return "desligado";
  const { intervaloAoAcaso } = await import("./aviso-aos-profissionais");
  const [vez] = (await pool.execute(
    "UPDATE envioDasPropostasVez SET proximoEm = UTC_TIMESTAMP() + INTERVAL ? SECOND WHERE id = 1 AND proximoEm <= UTC_TIMESTAMP()",
    [intervaloAoAcaso()],
  )) as [{ affectedRows: number }, unknown];
  if (Number(vez.affectedRows) !== 1) return "nao-e-a-vez";
  const r = await enviarAsPropostasAoCliente(Number(p.pedidoId), agora).catch((e) => ({
    ok: false as const,
    porque: e instanceof Error ? e.message : "erro",
  }));
  return r.ok ? "feito" : r.porque === "espera" ? "espera" : "falhou";
}

/* ── Enviar: o caminho do «Enviar pela CLYON» ────────────────────────────── */

export type ResultadoDoEnvio = { ok: true; feito: string } | { ok: false; porque: string };

/**
 * ENVIA O ORÇAMENTO AO CLIENTE, se ainda for a vez dele: lê tudo outra vez (o
 * interruptor, o pedido ainda com propostas por enviar e sem orçamento enviado,
 * o cliente, a uma-por-dia), RESERVA a linha (só uma passagem ganha) e só então
 * envia — o texto e o caminho do «Enviar pela CLYON». O que já não é a vez volta
 * a «espera»; um envio que não sai fica «falhou» (a equipa envia à mão), e não
 * se tenta outra vez sozinho.
 */
export async function enviarAsPropostasAoCliente(pedidoId: number, agora: Date): Promise<ResultadoDoEnvio> {
  if (!(await interruptorDasPropostas()).ligado) return { ok: false, porque: "desligado" };
  const pool = await garantirTabelas();
  const esperar = async (porque: string): Promise<ResultadoDoEnvio> => {
    await pool.execute("UPDATE envioDasPropostasAoCliente SET estado = 'espera', motivo = ? WHERE pedidoId = ? AND estado = 'fila'", [
      porque.slice(0, 160),
      pedidoId,
    ]);
    return { ok: false, porque: "espera" };
  };
  const [c] = await candidatosAoEnvio(agora, [pedidoId]);
  if (!c) return esperar("já não tem propostas por enviar");
  if (c.estado.tipo === "ja_enviado") return esperar("o orçamento já foi ao cliente");
  if (c.estado.tipo === "fica") return esperar(MOTIVOS_COM_UMA_PESSOA[c.estado.motivo]);
  if (!c.estado.agora) return esperar("ainda não é a hora");

  const db = await import("./db");
  // UMA VEZ SÓ (d47): se o orçamento foi há pouco ao cliente, por qualquer caminho, não sai outra vez.
  const ha = await db.minutosDesdeAPropostaEnviada(pedidoId).catch(() => 0);
  if (ha != null) return esperar("o orçamento já foi ao cliente");

  // Reservar ANTES de sair: só uma passagem ganha.
  const [reserva] = (await pool.execute(
    "UPDATE envioDasPropostasAoCliente SET estado = 'a_enviar', reservadoEm = UTC_TIMESTAMP(), motivo = NULL WHERE pedidoId = ? AND estado = 'fila'",
    [pedidoId],
  )) as [{ affectedRows: number }, unknown];
  if (Number(reserva.affectedRows) !== 1) return { ok: false, porque: "outra passagem já o reservou" };

  const telefone = String(c.pedido.contactPhone ?? "");
  const texto = textoDoOrcamentoDaMesa(c.pedido, agora);
  // Na língua da conversa, ou não sai (d88, o #659): a língua lida fica guardada para o envio a traduzir.
  const { linguaDaConversa } = await import("./lingua-da-conversa");
  await linguaDaConversa(telefone, { guardar: true }).catch(() => null);
  const { enviarTextoManualWhatsApp } = await import("./whatsapp-cloud");
  const saiu = await enviarTextoManualWhatsApp(telefone, texto, { semLinguaErrada: true }).catch(() => false);
  if (!saiu) {
    await pool.execute("UPDATE envioDasPropostasAoCliente SET estado = 'falhou', motivo = ? WHERE pedidoId = ?", [
      "o WhatsApp não saiu",
      pedidoId,
    ]);
    return { ok: false, porque: "o WhatsApp não saiu" };
  }
  await db.retomarNumeroWhatsApp(telefone).catch(() => {});
  await db.marcarOrcamentoEnviado(pedidoId);
  await pool.execute(
    "UPDATE envioDasPropostasAoCliente SET estado = 'enviado', enviadoEm = UTC_TIMESTAMP(), propostas = ? WHERE pedidoId = ?",
    [Math.min(255, c.propostas), pedidoId],
  );
  const feito = historicoDoEnvioAutomatico(c.propostas);
  await appendOrderHistory(pedidoId, { type: "note", by: null, message: feito }).catch(() => {});
  return { ok: true, feito };
}
