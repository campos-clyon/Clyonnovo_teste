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
 *  - a rotina (`/api/cron/propostas-ao-cliente`, de 15 em 15 min, das 9h às
 *    20h de Lisboa) põe na fila os que já podem sair; a passagem (às rondas da
 *    ponte) envia UM de cada vez, 20 a 45 s entre cada, e lê tudo outra vez
 *    antes de enviar;
 *  - a linha do cartão da Mesa e o ensaio das Configs.
 *
 * O envio é o do «Enviar pela CLYON» da Mesa: o texto de `textoDoOrcamentoDaMesa`
 * (a mesma função do painel), o número da plataforma (`enviarTextoManualWhatsApp`),
 * a conversa devolvida à Vitória (`retomarNumeroWhatsApp`) e o pedido em «A
 * aguardar cliente» (`marcarOrcamentoEnviado`) — e daí correm a validade (d62)
 * e o seguimento (d83). Nunca DELETE: a linha fica, e diz o que aconteceu.
 *
 * d114 (25-11-2026): o texto é a mensagem curta (`propostas-curtas.ts`), e a
 * linha do pedido pode voltar à fila — no máximo uma vez por dia
 * (`ultimoEnvioEm`), só com propostas que o cliente ainda não ouviu (as
 * chaves no registo dos avisos do assistente, as mesmas dos três caminhos).
 * Só sai com os dois interruptores ligados: este («Enviar as propostas ao
 * cliente») e o «Avisar de propostas» do assistente (`podeDizerAsPropostas`).
 *
 * d123 (25-11-2026): a «uma por dia» deu lugar a 2 h entre mensagens e 3 por
 * dia (`diaDosEnvios`, `enviosNoDia`); a proposta nova vai sozinha, só ela; a
 * maneira de dizer fica em `ultimaVariante`. Ver `envio-das-propostas-ao-cliente.ts`.
 */

import { appendOrderHistory, ensureRegistoTable, getPool, registarNaTransaccao } from "./db";
import { propostasPorEnviarDoPedido, type PedidoParaOLado } from "./do-nosso-lado";
import { diaEmLisboa, instanteDaBase } from "./hora-de-lisboa";
import { naJanelaDasMensagensAutomaticas } from "./janela-das-mensagens-automaticas";
import { propostasParaOCliente, trabalhoFechado } from "./mensagem-das-propostas";
import { nomeDoServicoDoOrcamento, type PedidoDoOrcamento } from "./texto-do-orcamento-da-mesa";
import { chavesDasPropostasVivas } from "./chaves-das-propostas";
import {
  escolherAVariante,
  ESPECIE_DAS_PROPOSTAS_DITAS,
  mensagemDasPropostasVariada,
  oTextoNomeia,
  tipoDaMensagem,
  type PropostaCurta,
} from "./propostas-curtas";
import { lerBase } from "./base-do-preco";
import { guiaVerificada, servicoExigeGuia } from "./guia-antes-de-contratar";
import { melhorProposta } from "./validade-do-orcamento";
import {
  aEntregaPrendeAsPropostas,
  aPropostaJaFoiDita,
  estadoDoEnvio,
  LINHA_DO_ENVIO_POR_LER,
  historicoDoEnvioAutomatico,
  linhaDoEnvioNaMesa,
  MOTIVOS_COM_UMA_PESSOA,
  NOME_DO_INTERRUPTOR_DAS_PROPOSTAS,
  NOTA_DO_ENVIO_PELA_VITORIA,
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
  // d114: a última mensagem das propostas (uma por dia) e quantas já foram.
  `ALTER TABLE envioDasPropostasAoCliente ADD COLUMN ultimoEnvioEm DATETIME NULL DEFAULT NULL`,
  `ALTER TABLE envioDasPropostasAoCliente ADD COLUMN envios TINYINT UNSIGNED NOT NULL DEFAULT 0`,
  // d123: quantas saíram hoje (no máximo 3 por dia) e a maneira de dizer da última.
  `ALTER TABLE envioDasPropostasAoCliente ADD COLUMN diaDosEnvios CHAR(10) NULL DEFAULT NULL`,
  `ALTER TABLE envioDasPropostasAoCliente ADD COLUMN enviosNoDia TINYINT UNSIGNED NOT NULL DEFAULT 0`,
  `ALTER TABLE envioDasPropostasAoCliente ADD COLUMN ultimaVariante VARCHAR(4) NULL DEFAULT NULL`,
  `CREATE TABLE IF NOT EXISTS envioDasPropostasVez (
      id        TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      proximoEm DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

async function garantirTabelas(): Promise<Pool> {
  const pool = await getPool();
  if (!pool) throw new Error("[envio-das-propostas] base de dados indisponível");
  if (!tabelasProntas) {
    for (const sql of SQL_DAS_TABELAS_DAS_PROPOSTAS) {
      // A coluna que já existe não é um erro (d114).
      if (sql.startsWith("ALTER TABLE")) await pool.execute(sql).catch(() => {});
      else await pool.execute(sql);
    }
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

/**
 * PODE DIZER AS PROPOSTAS AO CLIENTE? — d114: este interruptor E o «Avisar de
 * propostas» do assistente (`assistentePode("propostas")`), que governava a
 * proposta nova e o «aceitou» um a um, e agora governa a única mensagem que
 * os diz. Com a base a falhar, não.
 */
export async function podeDizerAsPropostas(): Promise<boolean> {
  if (!(await interruptorDasPropostas()).ligado) return false;
  try {
    const { assistentePode } = await import("./db");
    return await assistentePode("propostas");
  } catch {
    return false;
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
  linhaDoEnvio: LinhaDoEnvio | null;
  /** A mensagem curta, tal como sai (d114). */
  texto: string;
  /** As chaves das propostas vivas — as que ficam ditas quando a mensagem sai (d114). */
  chaves: Array<{ chave: string; negociacaoId: number }>;
  /** d123: quantas propostas vão nesta mensagem (as que o cliente ainda não ouviu). */
  porDizer: number;
  /** d123: é uma proposta nova (só as novas), não a 1.ª mensagem. */
  nova: boolean;
  /** d123: a maneira de dizer («u3», «n1»). */
  variante: string;
  /** d123: a conversa está entregue a uma pessoa (que já não prende as propostas): depois de sair, continua com a equipa. */
  comAEquipa: boolean;
};

const digitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

type LinhaDoEnvio = {
  estado: string;
  motivo: string | null;
  ultimoEnvioEm: Date | null;
  /** d123: quantas mensagens de propostas já saíram a este pedido, e a maneira da última. */
  envios?: number;
  ultimaVariante?: string | null;
  diaDosEnvios?: string | null;
  enviosNoDia?: number;
};

/** As linhas do envio dos pedidos pedidos — com a última mensagem que a Vitória mandou (d114) e as contas da d123. */
async function linhasDoEnvio(pool: Pool, ids: number[]): Promise<Map<number, LinhaDoEnvio>> {
  const m = new Map<number, LinhaDoEnvio>();
  const limpos = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))];
  if (limpos.length === 0) return m;
  const [rows] = (await pool.execute(
    `SELECT pedidoId, estado, motivo, COALESCE(ultimoEnvioEm, enviadoEm) AS ultimo, envios, ultimaVariante, diaDosEnvios, enviosNoDia
       FROM envioDasPropostasAoCliente WHERE pedidoId IN (${limpos.map(() => "?").join(",")})`,
    limpos,
  )) as [
    Array<{
      pedidoId: number;
      estado: string;
      motivo: string | null;
      ultimo: Date | string | null;
      envios?: number | null;
      ultimaVariante?: string | null;
      diaDosEnvios?: string | null;
      enviosNoDia?: number | null;
    }>,
    unknown,
  ];
  for (const r of rows) {
    m.set(Number(r.pedidoId), {
      estado: String(r.estado),
      motivo: r.motivo ?? null,
      ultimoEnvioEm: instanteDaBase(r.ultimo ?? null),
      envios: Number(r.envios ?? 0) || 0,
      ultimaVariante: r.ultimaVariante ?? null,
      diaDosEnvios: r.diaDosEnvios ?? null,
      enviosNoDia: Number(r.enviosNoDia ?? 0) || 0,
    });
  }
  return m;
}

/**
 * A MANEIRA DA ÚLTIMA MENSAGEM DE PROPOSTAS A ESTE CLIENTE — de qualquer
 * pedido dele (d123: nunca a mesma duas vezes seguidas ao mesmo cliente). Na
 * dúvida, null.
 */
async function ultimaVarianteDoCliente(pool: Pool, telefone: string): Promise<string | null> {
  const tel = digitos(telefone).slice(-9);
  if (tel.length < 9) return null;
  try {
    const [rows] = (await pool.execute(
      `SELECT e.ultimaVariante FROM envioDasPropostasAoCliente e JOIN simulatorOrders o ON o.id = e.pedidoId
        WHERE e.ultimaVariante IS NOT NULL AND RIGHT(REGEXP_REPLACE(COALESCE(o.contactPhone, ''), '[^0-9]', ''), 9) = ?
        ORDER BY e.ultimoEnvioEm DESC LIMIT 1`,
      [tel],
    )) as [Array<{ ultimaVariante: string | null }>, unknown];
    return (Array.isArray(rows) ? rows[0]?.ultimaVariante : null) ?? null;
  } catch {
    return null;
  }
}

/** Quando o cliente ficou com esta proposta viva à espera dele: a proposta pendente do parceiro, ou o «aceitou». */
function instanteDaViva(n: NegociacaoDaMesa | undefined): number | null {
  if (!n) return null;
  let lista: Array<{ por?: string; estado?: string; criadaEm?: string }> = [];
  try {
    const j = JSON.parse(String(n.propostasJson ?? "[]"));
    lista = Array.isArray(j) ? j : [];
  } catch {
    lista = [];
  }
  if (n.estado === "aguarda_contratacao") {
    const aceite = [...lista].reverse().find((x) => x.estado === "aceite");
    return instanteDaBase(aceite?.criadaEm ?? (n as { actualizadaEm?: string | Date | null }).actualizadaEm ?? null)?.getTime() ?? null;
  }
  const pendente = [...lista].reverse().find((x) => x.estado === "pendente" && x.por === "profissional");
  return instanteDaBase(pendente?.criadaEm ?? null)?.getTime() ?? null;
}

/**
 * AS CHAVES QUE JÁ FORAM DITAS AO CLIENTE — no registo dos avisos do
 * assistente (a proposta nova e o «aceitou» de antes, a rotina e a conversa
 * livre), com a hora a que ficaram ditas (d123, o #672: depois de um recomeço
 * do zero a chave repete-se, e só conta o registo de depois da proposta —
 * `aPropostaJaFoiDita`). Na dúvida (a base falhou), `porLer`: nada sai, e o
 * cartão diz porquê.
 */
async function chavesJaDitas(pool: Pool, chaves: string[]): Promise<{ ditas: Map<string, number | null>; porLer: boolean }> {
  const limpas = [...new Set(chaves)].slice(0, 200);
  const ditas = new Map<string, number | null>();
  if (limpas.length === 0) return { ditas, porLer: false };
  try {
    const [rows] = (await pool.execute(
      `SELECT chave, enviadoEm FROM assistenteAvisos WHERE chave IN (${limpas.map(() => "?").join(",")})`,
      limpas,
    )) as [Array<{ chave: string; enviadoEm?: Date | string | null }>, unknown];
    for (const r of Array.isArray(rows) ? rows : []) ditas.set(String(r.chave), instanteDaBase(r.enviadoEm ?? null)?.getTime() ?? null);
    return { ditas, porLer: false };
  } catch (e) {
    if ((e as { code?: string })?.code === "ER_NO_SUCH_TABLE") return { ditas, porLer: false };
    console.error("[envio-das-propostas] não li as propostas já ditas:", e instanceof Error ? e.message : e);
    return { ditas, porLer: true };
  }
}

/**
 * FICA ESCRITO QUE O CLIENTE OUVIU ESTAS PROPOSTAS — d114. A chave de cada uma
 * no registo dos avisos do assistente (fechada logo: é uma notícia, não leva
 * lembretes). É o que impede a rotina, a passagem e a conversa livre de a
 * dizerem outra vez. Nunca lança.
 */
export async function marcarPropostasDitas(
  telefone: string,
  pedidoId: number,
  chaves: ReadonlyArray<{ chave: string; negociacaoId: number }>,
): Promise<void> {
  try {
    const db = await import("./db");
    for (const c of chaves) {
      const { id, jaExistia } = await db.reservarAvisoDoAssistente({
        chave: c.chave,
        especie: ESPECIE_DAS_PROPOSTAS_DITAS,
        telefone,
        pedidoId,
        negociacaoId: c.negociacaoId,
      });
      if (id) await db.fecharAvisoDoAssistente(id, "informado").catch(() => {});
      // d123 (o #672): a chave já existia (de antes de um recomeço do zero) — fica dita AGORA, para a rotina não a repetir.
      else if (jaExistia) {
        const pool = await db.getPool();
        await pool
          ?.execute("UPDATE assistenteAvisos SET enviadoEm = UTC_TIMESTAMP(), pedidoId = ?, negociacaoId = ? WHERE chave = ?", [
            pedidoId,
            c.negociacaoId,
            c.chave.slice(0, 160),
          ])
          .catch(() => {});
      }
    }
  } catch (e) {
    console.error("[envio-das-propostas] não marquei as propostas ditas:", e instanceof Error ? e.message : e);
  }
}

/**
 * O QUE A CONVERSA DISSE TAMBÉM CONTA — d114. Uma mensagem da Vitória que
 * saiu ao cliente (a conversa livre, a lista da d111) e nomeia o parceiro de
 * uma proposta viva de um pedido dele: essa proposta fica dita, e a rotina
 * não a repete sozinha. Nunca lança.
 */
export async function marcarAsPropostasNomeadas(telefone: string, texto: string, agora: Date = new Date()): Promise<void> {
  try {
    const { pedidosDoTelefone } = await import("./whatsapp-negociacao");
    const db = await import("./db");
    for (const pedidoId of (await pedidosDoTelefone(telefone)).slice(0, 5)) {
      const negociacoes = await db.negociacoesDoPedido(pedidoId);
      const chaves = chavesDasPropostasVivas(
        negociacoes.map((n) => ({
          id: n.id,
          estado: n.estado,
          profissionalNome: n.profissionalNome,
          propostasJson: n.propostasJson ?? null,
          valorAcordado: n.valorAcordado ?? null,
        })),
        agora,
      ).filter((c) => oTextoNomeia(texto, c.parceiro));
      if (chaves.length > 0) {
        await marcarPropostasDitas(telefone, pedidoId, chaves);
        // d119: e, se o pedido estava à espera de nós, o orçamento conta como enviado («A aguardar cliente»).
        await marcarEnviadoPelaVitoriaSeEsperava(pedidoId, agora);
      }
    }
  } catch (e) {
    console.error("[envio-das-propostas] não li as propostas nomeadas:", e instanceof Error ? e.message : e);
  }
}

/**
 * O «JÁ ENVIEI» DA VITÓRIA — 25-11-2026 (d119). Quando as propostas saem ao
 * cliente por um caminho automático (a conversa livre que as lista, a lista da
 * d111), grava-se como enviado pela MESMA função do «Já enviei»
 * (`marcarOrcamentoEnviado`), com a nota no histórico — e a linha do envio
 * fica com a hora (a rotina conta-a na uma-por-dia e não a toma pela equipa).
 * Só se o pedido estava mesmo à espera de nós (`propostasPorEnviarDoPedido`):
 * o que já tinha ido não se marca outra vez (a validade conta do envio).
 * Devolve se marcou. Nunca lança.
 */
export async function marcarEnviadoPelaVitoriaSeEsperava(pedidoId: number, agora: Date = new Date()): Promise<boolean> {
  try {
    const db = await import("./db");
    const pedido = await db.getSimulatorOrderById(pedidoId);
    if (!pedido) return false;
    const negociacoes = await db.negociacoesDoPedido(pedidoId);
    const comoNaMesa = { ...(pedido as object), negociacoes } as unknown as PedidoParaOLado;
    if (!propostasPorEnviarDoPedido(comoNaMesa, agora)) return false;
    await marcarEnviadoPelaVitoria(pedidoId);
    return true;
  } catch (e) {
    console.error("[envio-das-propostas] não marquei o envio pela Vitória:", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Marca o envio (o «Já enviei»), a nota no histórico e a linha do envio. */
async function marcarEnviadoPelaVitoria(pedidoId: number): Promise<void> {
  const db = await import("./db");
  await db.marcarOrcamentoEnviado(pedidoId);
  const pool = await garantirTabelas();
  // d123: conta para as 2 h e para as 3 por dia, como uma mensagem da rotina.
  const hoje = diaEmLisboa(new Date());
  await pool.execute(
    `INSERT INTO envioDasPropostasAoCliente (pedidoId, estado, enviadoEm, ultimoEnvioEm, envios, diaDosEnvios, enviosNoDia) VALUES (?, 'enviado', UTC_TIMESTAMP(), UTC_TIMESTAMP(), 1, ?, 1)
     ON DUPLICATE KEY UPDATE ultimoEnvioEm = UTC_TIMESTAMP(), enviadoEm = COALESCE(enviadoEm, UTC_TIMESTAMP()),
       enviosNoDia = IF(diaDosEnvios = ?, LEAST(255, enviosNoDia + 1), 1), diaDosEnvios = ?,
       estado = IF(estado IN ('fila', 'a_enviar'), estado, 'enviado')`,
    [pedidoId, hoje, hoje, hoje],
  );
  await appendOrderHistory(pedidoId, { type: "note", by: null, message: `${NOTA_DO_ENVIO_PELA_VITORIA}.` }).catch(() => {});
}

/**
 * A PASSAGEM ÚNICA DA d119 (25-11-2026) — os pedidos abertos que estavam em
 * «Precisa de si» com propostas que a Vitória já tinha dito ao cliente (uma
 * mensagem dela no fio, depois da proposta mais recente, que nomeia um dos
 * parceiros): passam a «A aguardar cliente» pela mesma função. Pura, para o
 * teste: recebe os pedidos da Mesa e o fio de cada um.
 */
export function pedidosJaDitosPelaVitoria(
  pedidos: ReadonlyArray<PedidoDaMesa>,
  fioDe: (telefone: string) => ReadonlyArray<{ direccao: string; texto: string; haSegundos?: number | null }>,
  agora: Date,
): number[] {
  const out: number[] = [];
  for (const p of pedidos) {
    const por = propostasPorEnviarDoPedido(p, agora);
    if (!por || !p.contactPhone) continue;
    const maisRecente = Math.max(...por.instantes);
    const parceiros = p.negociacoes.map((n) => String(n.profissionalNome ?? "")).filter((n) => n.trim().length >= 3);
    const dita = fioDe(p.contactPhone).some(
      (m) =>
        m.direccao === "out" &&
        !m.texto.trim().startsWith("[à mão]") &&
        typeof m.haSegundos === "number" &&
        agora.getTime() - m.haSegundos * 1000 > maisRecente &&
        parceiros.some((nome) => oTextoNomeia(m.texto, nome)),
    );
    if (dita) out.push(Number(p.id));
  }
  return out;
}

export const CHAVE_DA_PASSAGEM_UNICA_D119 = "acerto_dos_enviados_d119";

/**
 * Corre UMA vez (a marca na tabela dos interruptores): lê os pedidos da Mesa,
 * marca os já ditos e escreve no registo quantos foram. Devolve quantos, ou
 * null se já tinha corrido.
 */
export async function passagemUnicaDosEnviados(agora: Date = new Date()): Promise<number | null> {
  const pool = await garantirTabelas();
  const [jaFoi] = (await pool.execute(
    "SELECT 1 FROM retencaoInterruptores WHERE chave = ? LIMIT 1",
    [CHAVE_DA_PASSAGEM_UNICA_D119],
  )) as [unknown[], unknown];
  if (Array.isArray(jaFoi) && jaFoi.length > 0) return null;
  // A marca ANTES do trabalho: duas passagens ao mesmo tempo não fazem duas vezes.
  const [marca] = (await pool.execute(
    "INSERT IGNORE INTO retencaoInterruptores (chave, ligado, mudadoEm, porQuem) VALUES (?, 1, UTC_TIMESTAMP(), 'd119')",
    [CHAVE_DA_PASSAGEM_UNICA_D119],
  )) as [{ affectedRows: number }, unknown];
  if (Number(marca?.affectedRows ?? 0) !== 1) return null;
  const db = await import("./db");
  const pedidos = JSON.parse(JSON.stringify(await db.pedidosComNegociacoes(200))) as PedidoDaMesa[];
  const fios = new Map<string, Array<{ direccao: string; texto: string; haSegundos?: number | null }>>();
  for (const p of pedidos) {
    if (!p.contactPhone || fios.has(p.contactPhone) || !propostasPorEnviarDoPedido(p, agora)) continue;
    fios.set(p.contactPhone, await db.mensagensDoNumeroWhatsApp(p.contactPhone, 40).catch(() => []));
  }
  const ids = pedidosJaDitosPelaVitoria(pedidos, (t) => fios.get(t) ?? [], agora);
  for (const id of ids) await marcarEnviadoPelaVitoria(id).catch(() => {});
  await db
    .registarSemFalhar({
      acontecimento: "assistente_alerta",
      autorTipo: "assistente",
      autorNome: "d119 — orçamentos já ditos pela Vitória",
      resumo: `d119: ${ids.length} pedido(s) com as propostas já ditas pela Vitória passaram a «A aguardar cliente»${ids.length ? ` (#${ids.join(", #")})` : ""}.`,
    })
    .catch(() => {});
  return ids.length;
}

type NotasDosParceiros = Map<number, { nota: { media: number; quantas: number } | null; verificado?: boolean }>;

/**
 * A GUIA DOS PARCEIROS DE UM PEDIDO DE ENTULHO — d118: quem tem a guia de
 * resíduos verificada (providerId → sim/não). Sem entulho, nada se lê. Na
 * dúvida (a base falhou), ninguém tem: o aviso vai — é o lado seguro.
 */
async function guiasDosParceiros(pool: Pool, p: PedidoDaMesa): Promise<Map<number, boolean> | null> {
  if (!servicoExigeGuia(p.serviceType)) return null;
  const ids = [...new Set(p.negociacoes.map((n) => Number(n.providerId)).filter((n) => Number.isInteger(n) && n > 0))];
  const m = new Map<number, boolean>(ids.map((id) => [id, false]));
  if (ids.length === 0) return m;
  try {
    const [rows] = (await pool.execute(
      `SELECT id, emiteGuiaTransporte, guiaVerificadaEm FROM providers WHERE id IN (${ids.map(() => "?").join(",")})`,
      ids,
    )) as [Array<{ id: number; emiteGuiaTransporte: unknown; guiaVerificadaEm: unknown }>, unknown];
    for (const r of Array.isArray(rows) ? rows : []) m.set(Number(r.id), guiaVerificada(r));
  } catch {
    /* ninguém tem: o aviso vai */
  }
  return m;
}

/**
 * AS PROPOSTAS DE UM PEDIDO COMO A MENSAGEM CURTA AS DIZ (d114): o total com
 * IVA e o sem IVA, o parceiro isento, o parceiro que aceitou o valor do
 * cliente, e a nota (só com avaliações).
 */
function propostasCurtasDoPedido(p: PedidoDaMesa, notas: NotasDosParceiros, guias: Map<number, boolean> | null = null): PropostaCurta[] {
  const daNegociacao = new Map(p.negociacoes.map((n) => [Number(n.id), n]));
  return propostasParaOCliente(p.negociacoes).map((x) => {
    const n = daNegociacao.get(Number(x.negociacaoId));
    const temGuia = guias && n ? guias.get(Number(n.providerId)) === true : null;
    return {
      // d118: no entulho, quem não tem a guia verificada leva a linha do Jurídico.
      ...(guias ? { semGuia: temGuia !== true, comGuia: temGuia === true } : {}),
      negociacaoId: x.negociacaoId ?? null,
      parceiro: x.profissional,
      semIva: x.semIva,
      total: x.total,
      isento: x.contaDoNovoModelo?.regime === "isento",
      aceitou: n?.estado === "aguarda_contratacao",
      nota: n ? (notas.get(Number(n.providerId))?.nota ?? null) : null,
      // d123: «verificado» só com as três confirmações.
      verificado: n ? notas.get(Number(n.providerId))?.verificado === true : false,
    };
  });
}

/**
 * A MENSAGEM DAS PROPOSTAS DESTE PEDIDO, tal como sai (d123): só as propostas
 * que o cliente ainda não ouviu (`soAs`, as negociações), a 1.ª ou a nova, na
 * maneira escolhida.
 */
export function textoDasPropostasDoPedido(
  p: PedidoDaMesa,
  agora: Date,
  notas: NotasDosParceiros,
  como: { nova: boolean; variante: string; soAs?: ReadonlySet<number> | null },
  guias: Map<number, boolean> | null = null,
): string {
  const base = lerBase(p.baseDoPreco);
  const todas = propostasCurtasDoPedido(p, notas, guias);
  const propostas = como.soAs ? todas.filter((x) => x.negociacaoId != null && como.soAs!.has(Number(x.negociacaoId))) : todas;
  return mensagemDasPropostasVariada({
    pedidoId: Number(p.id),
    nome: p.contactName,
    servico: nomeDoServicoDoOrcamento(p.serviceType),
    propostas,
    agora,
    unidade: base === "carga" || base === "hora" ? base : null,
    nova: como.nova,
    variante: como.variante,
  });
}

/**
 * O CLIENTE, COMO A REGRA O PRECISA: a conversa com uma pessoa (entregue, ou a
 * equipa a escrever à mão há pouco, d73), uma queixa, a língua sem tradução
 * fixa deste texto, o número bloqueado, e o «não contactar» (d93). Na dúvida,
 * o lado que não envia.
 *
 * d123: a entrega que a Vitória fez há mais de 2 h, sem resposta da equipa, já
 * não prende as propostas (`aEntregaPrendeAsPropostas`) — saem, e a conversa
 * continua com a equipa (`comAEquipa`). E as outras rotinas que já falaram
 * hoje não as atrasam: da pergunta comum (`jaSaiuHojeUmaMensagemAutomatica`)
 * fica só o «não contactar».
 */
async function oCliente(
  pool: Pool,
  telefone: string,
  texto: string,
): Promise<{
  comUmaPessoa: boolean;
  comAEquipa: boolean;
  queixa: boolean;
  linguaSemTraducao: string | null;
  bloqueado: boolean;
  naoContactar: boolean;
}> {
  const db = await import("./db");
  const bloqueado = await db.numeroBloqueadoWhatsApp(telefone).catch(() => true);
  const interrompido = await db.numeroInterrompidoWhatsApp(telefone).catch(() => true);
  const prende = interrompido
    ? await db
        .entregaEmVigorWhatsApp(telefone)
        .then((e) => (e ? aEntregaPrendeAsPropostas(e) : true))
        .catch(() => true)
    : false;
  const fio = await db.mensagensDoNumeroWhatsApp(telefone, 40).catch(() => null);
  const { aEquipaFalouHaPouco } = await import("./pedido-em-curso");
  const { haQueixaNaConversa } = await import("./queixa-na-conversa");
  // d116: a equipa a escrever já não cala a Vitória (só o «*», que é uma entrega).
  const comUmaPessoa = prende || fio == null || aEquipaFalouHaPouco(fio);
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
  const { eParaNaoContactar } = await import("./nao-contactar");
  const naoContactar = await eParaNaoContactar(telefone, { pool }).catch(() => true);
  return { comUmaPessoa, comAEquipa: interrompido, queixa, linguaSemTraducao, bloqueado, naoContactar };
}

/**
 * OS PEDIDOS COM PROPOSTAS POR ENVIAR — os da Mesa (`pedidosComNegociacoes`),
 * pela mesma conta do cartão («Propostas de parceiros por enviar ao cliente»),
 * com o texto tal como sai, a melhor proposta (d62) e o estado do envio de
 * cada um. Com `ids`, só esses.
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
  const hoje = diaEmLisboa(agora);

  const out: CandidatoAoEnvio[] = [];
  for (const p of alvo) {
    const por = propostasPorEnviarDoPedido(p, agora)!;
    const propostas = propostasParaOCliente(p.negociacoes);
    const providerDe = new Map(p.negociacoes.map((n) => [Number(n.id), Number(n.providerId)]));
    const daNegociacao = new Map(p.negociacoes.map((n) => [Number(n.id), n]));
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
    const linha = doEnvio.get(Number(p.id)) ?? null;
    // d123: a última mensagem de propostas a este cliente — a da Vitória, ou o orçamento que a equipa mandou à mão.
    const enviadoEm = instanteDaBase(p.propostaEnviadaEm ?? null);
    const daVitoria = linha?.ultimoEnvioEm ?? null;
    const ultimoEnvioEm =
      daVitoria && enviadoEm ? new Date(Math.max(daVitoria.getTime(), enviadoEm.getTime())) : (daVitoria ?? enviadoEm ?? null);
    // As propostas que o cliente ainda não ouviu: nem ditas (por qualquer caminho, d114), nem de antes do orçamento que já foi.
    const vivas = chavesDasPropostasVivas(p.negociacoes, agora);
    const { ditas, porLer } = await chavesJaDitas(pool, vivas.map((v) => v.chave));
    const porDizer = vivas.filter((v) => {
      const t = instanteDaViva(daNegociacao.get(v.negociacaoId));
      // d123 (o #672): a chave dita ANTES desta proposta (um recomeço do zero repete-a) não a cala.
      if (aPropostaJaFoiDita(ditas.has(v.chave) ? (ditas.get(v.chave) ?? null) : undefined, t)) return false;
      return enviadoEm == null || t == null || t > enviadoEm.getTime();
    });
    // A 1.ª mensagem diz todas; depois, só as novas — nunca a lista toda outra vez.
    const nova = porDizer.length > 0 && porDizer.length < vivas.length;
    const tipo = tipoDaMensagem(nova, porDizer.length);
    const anterior = temTelemovel ? await ultimaVarianteDoCliente(pool, telefone) : null;
    const variante = escolherAVariante(tipo, Number(p.id), (linha?.envios ?? 0) + 1, anterior ?? linha?.ultimaVariante ?? null);
    const texto = textoDasPropostasDoPedido(
      p,
      agora,
      notas,
      { nova, variante, soAs: new Set(porDizer.map((v) => v.negociacaoId)) },
      await guiasDosParceiros(pool, p),
    );
    const cliente = temTelemovel
      ? await oCliente(pool, telefone, texto)
      : { comUmaPessoa: false, comAEquipa: false, queixa: false, linguaSemTraducao: null, bloqueado: false, naoContactar: false };
    const instantes = [...por.instantes].sort((a, b) => a - b);
    // O parceiro que aceitou o valor do cliente (d114): a 1.ª mensagem não espera a hora.
    const aceites = p.negociacoes
      .filter((n) => n.estado === "aguarda_contratacao")
      .map((n) => instanteDaBase((n as { actualizadaEm?: string | Date | null }).actualizadaEm ?? null)?.getTime())
      .filter((t): t is number => t != null && (ultimoEnvioEm == null || t > ultimoEnvioEm.getTime()));
    const envio: PedidoParaOEnvio = {
      pedidoId: Number(p.id),
      parceiros: por.parceiros,
      primeiraEm: new Date(instantes[0]),
      segundaEm: por.parceiros >= 2 && instantes.length >= 2 ? new Date(instantes[1]) : null,
      aceitouEm: aceites.length > 0 ? new Date(Math.min(...aceites)) : null,
      ultimaMudancaEm: new Date(instantes[instantes.length - 1]),
      // d123: o orçamento à mão já não fecha a porta — conta em `ultimoEnvioEm`.
      jaEnviado: false,
      ultimoEnvioEm,
      enviosHoje: linha?.diaDosEnvios === hoje ? (linha?.enviosNoDia ?? 0) : 0,
      novas: porDizer.length,
      fechado: trabalhoFechado(p.negociacoes) != null,
      trabalhoClyon: p.valorFixoClyon != null,
      valorUnico: p.valorUnicoCliente != null,
      base: p.baseDoPreco ?? null,
      comUmaPessoa: cliente.comUmaPessoa,
      queixa: cliente.queixa,
      linguaSemTraducao: cliente.linguaSemTraducao,
      melhorComIva: melhor ? melhor.total : null,
      temTelemovel,
      bloqueado: cliente.bloqueado,
      naoContactar: cliente.naoContactar,
      ditasPorLer: porLer,
    };
    out.push({
      pedido: p,
      envio,
      propostas: propostas.length,
      estado: estadoDoEnvio(envio, agora),
      linhaDoEnvio: linha,
      texto,
      chaves: vivas.map(({ chave, negociacaoId }) => ({ chave, negociacaoId })),
      porDizer: porDizer.length,
      nova,
      variante,
      comAEquipa: cliente.comAEquipa,
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
    const ligado = await podeDizerAsPropostas();
    for (const c of await candidatosAoEnvio(agora, undefined, pedidos)) {
      const l = linhaDoCandidato(c, ligado);
      if (l) m.set(c.envio.pedidoId, l);
    }
  } catch (e) {
    console.error("[envio-das-propostas] a Mesa não leu o envio automático:", e instanceof Error ? e.message : e);
    // d123 (o #672): nunca calado — os que a Mesa conta por enviar dizem que o envio não os leu.
    try {
      for (const p of (pedidos ?? []) as PedidoDaMesa[]) {
        if (propostasPorEnviarDoPedido(p, agora) && !m.has(Number(p.id))) m.set(Number(p.id), LINHA_DO_ENVIO_POR_LER);
      }
    } catch {
      /* sem isto, a Mesa serve */
    }
  }
  return m;
}

export type EnsaioDasPropostas = {
  ligado: boolean;
  pedidos: Array<{ pedidoId: number; propostas: number; linha: string | null }>;
};

/** O ensaio das Configs: os pedidos com propostas por enviar, só o número, quantas e a linha. Só lê. */
export async function ensaioDasPropostas(agora: Date = new Date()): Promise<EnsaioDasPropostas> {
  const ligado = await podeDizerAsPropostas();
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
  if (!(await podeDizerAsPropostas())) return r;
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
    // Uma linha por pedido: volta à fila o que esperou e, desde a d114, o enviado com propostas novas (uma por dia); nunca o que falhou.
    const [u] = (await pool.execute(
      `INSERT INTO envioDasPropostasAoCliente (pedidoId, estado, naFilaEm) VALUES (?, 'fila', UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE naFilaEm = IF(estado IN ('espera', 'enviado'), UTC_TIMESTAMP(), naFilaEm), estado = IF(estado IN ('espera', 'enviado'), 'fila', estado)`,
      [c.envio.pedidoId],
    )) as [{ affectedRows: number }, unknown];
    if (Number(u.affectedRows) >= 1) r.naFila += 1;
  }
  return r;
}

export function resumoDaRotinaDasPropostas(r: ResultadoDaRotinaDasPropostas): string | null {
  if (!r.ligado) return `desligado (interruptor «${NOME_DO_INTERRUPTOR_DAS_PROPOSTAS}» nas Configs)`;
  if (r.foraDeHoras) return "fora das 9h–20h de Lisboa";
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
  if (!(await podeDizerAsPropostas())) return "desligado";
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
 * o cliente, as 2 h e as 3 por dia da d123), RESERVA a linha (só uma passagem ganha) e só então
 * envia — o texto e o caminho do «Enviar pela CLYON». O que já não é a vez volta
 * a «espera»; um envio que não sai fica «falhou» (a equipa envia à mão), e não
 * se tenta outra vez sozinho.
 */
export async function enviarAsPropostasAoCliente(pedidoId: number, agora: Date): Promise<ResultadoDoEnvio> {
  if (!(await podeDizerAsPropostas())) return { ok: false, porque: "desligado" };
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
  // UMA VEZ SÓ (d47): se o orçamento foi há pouco ao cliente, por qualquer caminho, não sai outra vez (d114: a do dia seguinte sai).
  const ha = await db.minutosDesdeAPropostaEnviada(pedidoId).catch(() => 0);
  if (ha != null && ha < db.MINUTOS_PARA_REENVIAR_A_PROPOSTA) return esperar("o orçamento foi há pouco ao cliente");

  // Reservar ANTES de sair: só uma passagem ganha.
  const [reserva] = (await pool.execute(
    "UPDATE envioDasPropostasAoCliente SET estado = 'a_enviar', reservadoEm = UTC_TIMESTAMP(), motivo = NULL WHERE pedidoId = ? AND estado = 'fila'",
    [pedidoId],
  )) as [{ affectedRows: number }, unknown];
  if (Number(reserva.affectedRows) !== 1) return { ok: false, porque: "outra passagem já o reservou" };

  const telefone = String(c.pedido.contactPhone ?? "");
  const texto = c.texto;
  // d123: a proposta nova diz-se como atualização; a 1.ª, como o orçamento.
  const actualizacao = c.nova;
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
  // d123: a conversa entregue a uma pessoa continua com ela — as propostas saíram, o resto é da equipa.
  if (!c.comAEquipa) await db.retomarNumeroWhatsApp(telefone).catch(() => {});
  await db.marcarOrcamentoEnviado(pedidoId);
  const hoje = diaEmLisboa(agora);
  await pool.execute(
    `UPDATE envioDasPropostasAoCliente
        SET estado = 'enviado', enviadoEm = COALESCE(enviadoEm, UTC_TIMESTAMP()), ultimoEnvioEm = UTC_TIMESTAMP(),
            envios = LEAST(255, envios + 1), propostas = ?, ultimaVariante = ?,
            enviosNoDia = IF(diaDosEnvios = ?, LEAST(255, enviosNoDia + 1), 1), diaDosEnvios = ?
      WHERE pedidoId = ?`,
    [Math.min(255, c.propostas), c.variante, hoje, hoje, pedidoId],
  );
  // d114: o cliente ouviu estas propostas — nenhum caminho as volta a dizer sozinho.
  await marcarPropostasDitas(telefone, pedidoId, c.chaves);
  const feito = `${historicoDoEnvioAutomatico(c.porDizer, actualizacao)}${c.comAEquipa ? " A conversa continua com a equipa." : ""}`;
  await appendOrderHistory(pedidoId, { type: "note", by: null, message: feito }).catch(() => {});
  return { ok: true, feito };
}
