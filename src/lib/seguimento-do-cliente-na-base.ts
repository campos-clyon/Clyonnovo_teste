/**
 * O SEGUIMENTO DO CLIENTE, NA BASE — d83 (CEO e dono, 21-11-2026).
 *
 * As regras puras estão em `seguimento-do-cliente.ts`. Aqui:
 *
 *  - o interruptor de emergência «Seguimento do cliente» (Configs), na tabela
 *    dos interruptores (`retencaoInterruptores`), LIGADO por omissão (sem
 *    linha); desligado — ou com a base a falhar a lê-lo — nada sai e nada fecha;
 *  - `seguimentoDoCliente` — UMA linha por pedido, com o ciclo em curso (o que
 *    a equipa marcou, quando, por onde, o que já saiu, se parou, fechou ou foi
 *    cancelado) e os «Falei com o cliente» guardados. Uma marcação nova
 *    substitui o ciclo; tudo fica no histórico do pedido. Nada de telefones
 *    nem emails: lêem-se do pedido no momento de enviar;
 *  - `seguimentoDoClienteVez` — o carimbo «o próximo pode sair a partir de…»,
 *    20 a 45 s entre WhatsApp, como as outras filas;
 *  - a rotina (`/api/cron/seguimento-do-cliente`, de 15 em 15 minutos) que
 *    decide o passo de cada pedido e o põe na fila (os emails saem logo); a
 *    passagem (às rondas da ponte) envia UM WhatsApp de cada vez, das 9h às 20h;
 *  - o «Falei com o cliente» e o «Parar o seguimento» da Mesa, o «Quer
 *    cancelar» (cancela já, pelo caminho de sempre) e o que a Vitória faz com o
 *    «1», o «2», o «3» e o CANCELAR (chamado por `whatsapp-negociacao.ts`).
 *
 * Nunca DELETE de pedidos: fechar é arquivar; cancelar é o `cancelarPedido` de
 * sempre, e os dados saem 7 dias depois, pela purga dos cancelados pelo
 * lembrete (`FONTES_DA_PURGA_DOS_CANCELADOS`, em validade-do-orcamento-na-base.ts).
 */

import {
  appendOrderHistory,
  ensureNegociacoesTable,
  ensureRegistoTable,
  ensureSimulatorOrdersTable,
  getPool,
  negociacoesDoPedido,
  registarNaTransaccao,
  registarSemFalhar,
} from "./db";
import { instanteDaBase } from "./hora-de-lisboa";
import { eDeTeste, emailValido, telemovelPortugues } from "./lembrete-do-que-falta";
import { pedidoFechado } from "./pedido-arrumado";
import { jaSaiuHojeUmaMensagemAutomatica } from "./uma-mensagem-automatica-por-dia";
import {
  assuntoDoSeguimento,
  clienteRespondeuAoSeguimento,
  CONTACTOS_GUARDADOS,
  contactosDeJson,
  eMensagemDoSeguimento,
  eRespostaDoContacto,
  linhaDoContacto,
  linhaDoSeguimentoNaMesa,
  naJanelaDoSeguimento,
  NOME_DO_INTERRUPTOR_DO_SEGUIMENTO,
  notaLimpa,
  paraEmail,
  porqueSaiuDoPrecisaDeSi,
  proximoPassoDoSeguimento,
  ROTULOS_DAS_RESPOSTAS,
  seguimentoEmCurso,
  textoDoPassoDoSeguimento,
  validarVoltarEm,
  type CanalDoSeguimento,
  type CicloDoSeguimento,
  type ContactoDoSeguimento,
  type PassoDoSeguimento,
  type PedidoEmSeguimento,
  type RespostaDoContacto,
} from "./seguimento-do-cliente";
import {
  aUltimaSaidaE,
  DIAS_ATE_ANONIMIZAR_O_CANCELADO,
  eConfirmacaoDoCancelamento,
  HORAS_PARA_CONFIRMAR_O_CANCELAMENTO,
  mesmoTelefoneEstrito,
} from "./validade-do-orcamento";

/* ── O interruptor de emergência (Configs) — LIGADO por omissão ──────────── */

export const CHAVE_DO_SEGUIMENTO_DO_CLIENTE = "seguimento_do_cliente_d83";

export type InterruptorDoSeguimento = { ligado: boolean; mudadoEm: string | null; porQuem: string | null };

type Pool = NonNullable<Awaited<ReturnType<typeof getPool>>>;

let tabelasProntas = false;

export const SQL_DAS_TABELAS_DO_SEGUIMENTO = [
  `CREATE TABLE IF NOT EXISTS retencaoInterruptores (
      chave     VARCHAR(40) NOT NULL PRIMARY KEY,
      ligado    TINYINT(1) NOT NULL DEFAULT 0,
      mudadoEm  DATETIME NULL DEFAULT NULL,
      porQuem   VARCHAR(120) NULL DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS seguimentoDoCliente (
      pedidoId            INT UNSIGNED NOT NULL PRIMARY KEY,
      criadoEm            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      marcadoEm           DATETIME NOT NULL,
      marcadoPor          VARCHAR(120) NULL DEFAULT NULL,
      resposta            VARCHAR(16) NOT NULL,
      voltarEm            DATETIME NULL DEFAULT NULL,
      canal               VARCHAR(10) NULL DEFAULT NULL,
      semEnvioPorque      VARCHAR(160) NULL DEFAULT NULL,
      mensagem1Em         DATETIME NULL DEFAULT NULL,
      mensagem2Em         DATETIME NULL DEFAULT NULL,
      mensagem3Em         DATETIME NULL DEFAULT NULL,
      arquivadoEm         DATETIME NULL DEFAULT NULL,
      canceladoEm         DATETIME NULL DEFAULT NULL,
      paradoEm            DATETIME NULL DEFAULT NULL,
      paradoPorque        VARCHAR(160) NULL DEFAULT NULL,
      respondeuEm         DATETIME NULL DEFAULT NULL,
      porEnviar           VARCHAR(12) NULL DEFAULT NULL,
      porEnviarDesde      DATETIME NULL DEFAULT NULL,
      ultimaFalha         VARCHAR(160) NULL DEFAULT NULL,
      cancelarPedidoEm    DATETIME NULL DEFAULT NULL,
      anonimizarAPartirDe DATETIME NULL DEFAULT NULL,
      contactosJson       TEXT NULL,
      KEY idx_seguimento_por_enviar (porEnviar, porEnviarDesde)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS seguimentoDoClienteVez (
      id        TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      proximoEm DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

async function garantirTabelas(): Promise<Pool> {
  const pool = await getPool();
  if (!pool) throw new Error("[seguimento-do-cliente] base de dados indisponível");
  if (!tabelasProntas) {
    for (const sql of SQL_DAS_TABELAS_DO_SEGUIMENTO) await pool.execute(sql);
    await pool.execute("INSERT IGNORE INTO seguimentoDoClienteVez (id, proximoEm) VALUES (1, '2000-01-01 00:00:00')");
    tabelasProntas = true;
  }
  return pool;
}

/**
 * LIGADO SEM LINHA (é o estado de origem: só entra o que a equipa marca à
 * mão). Com a base a falhar, DESLIGADO — sem saber, não se envia.
 */
export async function interruptorDoSeguimento(): Promise<InterruptorDoSeguimento> {
  try {
    const pool = await garantirTabelas();
    const [rows] = (await pool.execute(
      "SELECT ligado, mudadoEm, porQuem FROM retencaoInterruptores WHERE chave = ? LIMIT 1",
      [CHAVE_DO_SEGUIMENTO_DO_CLIENTE],
    )) as [Array<{ ligado: number; mudadoEm: Date | string | null; porQuem: string | null }>, unknown];
    const l = rows[0];
    if (!l) return { ligado: true, mudadoEm: null, porQuem: null };
    return {
      ligado: Number(l.ligado) === 1,
      mudadoEm: l.mudadoEm ? (instanteDaBase(l.mudadoEm)?.toISOString() ?? null) : null,
      porQuem: l.porQuem ?? null,
    };
  } catch (e) {
    console.error("[seguimento-do-cliente] não li o interruptor — fica desligado:", e instanceof Error ? e.message : e);
    return { ligado: false, mudadoEm: null, porQuem: null };
  }
}

/** Liga ou desliga; a mudança e quem a fez ficam no registo permanente, na mesma transacção. */
export async function mudarInterruptorDoSeguimento(ligar: boolean, porQuem: string): Promise<InterruptorDoSeguimento> {
  const pool = await garantirTabelas();
  await ensureRegistoTable();
  const antes = await interruptorDoSeguimento();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO retencaoInterruptores (chave, ligado, mudadoEm, porQuem) VALUES (?, ?, UTC_TIMESTAMP(), ?)
       ON DUPLICATE KEY UPDATE ligado = VALUES(ligado), mudadoEm = VALUES(mudadoEm), porQuem = VALUES(porQuem)`,
      [CHAVE_DO_SEGUIMENTO_DO_CLIENTE, ligar ? 1 : 0, porQuem.slice(0, 120)],
    );
    await registarNaTransaccao(conn, {
      acontecimento: "seguimento_do_cliente_interruptor",
      autorTipo: "clyon",
      autorNome: porQuem,
      estadoAntes: antes.ligado ? "ligado" : "desligado",
      estadoDepois: ligar ? "ligado" : "desligado",
      resumo: `«${NOME_DO_INTERRUPTOR_DO_SEGUIMENTO}» ${ligar ? "LIGADO" : "DESLIGADO"} por ${porQuem} (d83).`,
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
  return interruptorDoSeguimento();
}

/* ── O ciclo de cada pedido ──────────────────────────────────────────────── */

const PASSOS: readonly PassoDoSeguimento[] = ["mensagem1", "mensagem2", "mensagem3", "arquivar"];

type LinhaDoSeguimento = CicloDoSeguimento & {
  pedidoId: number;
  marcadoEm: Date;
  marcadoPor: string | null;
  resposta: RespostaDoContacto;
  semEnvioPorque: string | null;
  paradoPorque: string | null;
  respondeuEm: Date | null;
  porEnviar: PassoDoSeguimento | null;
  ultimaFalha: string | null;
  cancelarPedidoEm: Date | null;
  contactos: ContactoDoSeguimento[];
};

function lerLinha(l: Record<string, unknown>): LinhaDoSeguimento {
  const d = (v: unknown) => instanteDaBase(v as string | Date | null);
  const passo = String(l.porEnviar ?? "");
  const canal = l.canal === "whatsapp" || l.canal === "email" ? (l.canal as CanalDoSeguimento) : null;
  const resposta = eRespostaDoContacto(l.resposta) ? l.resposta : "vai_pensar";
  return {
    pedidoId: Number(l.pedidoId),
    marcadoEm: d(l.marcadoEm) ?? new Date(0),
    marcadoPor: (l.marcadoPor as string | null) ?? null,
    resposta,
    voltarEm: d(l.voltarEm) ?? d(l.marcadoEm) ?? new Date(0),
    canal,
    semEnvioPorque: (l.semEnvioPorque as string | null) ?? null,
    mensagem1Em: d(l.mensagem1Em),
    mensagem2Em: d(l.mensagem2Em),
    mensagem3Em: d(l.mensagem3Em),
    arquivadoEm: d(l.arquivadoEm),
    canceladoEm: d(l.canceladoEm),
    paradoEm: d(l.paradoEm),
    paradoPorque: (l.paradoPorque as string | null) ?? null,
    respondeuEm: d(l.respondeuEm),
    porEnviar: (PASSOS as readonly string[]).includes(passo) ? (passo as PassoDoSeguimento) : null,
    ultimaFalha: (l.ultimaFalha as string | null) ?? null,
    cancelarPedidoEm: d(l.cancelarPedidoEm),
    contactos: contactosDeJson((l.contactosJson as string | null) ?? null),
  };
}

async function cicloDoPedido(pool: Pool, pedidoId: number): Promise<LinhaDoSeguimento | null> {
  const [rows] = (await pool.execute("SELECT * FROM seguimentoDoCliente WHERE pedidoId = ? LIMIT 1", [pedidoId])) as [
    Array<Record<string, unknown>>,
    unknown,
  ];
  return rows[0] ? lerLinha(rows[0]) : null;
}

const A_CORRER_SQL = "arquivadoEm IS NULL AND canceladoEm IS NULL AND paradoEm IS NULL";

/** A contagem pára (o cliente respondeu, o pedido saiu do «Precisa de si», à mão, o envio falhou). */
export async function pararSeguimento(pedidoId: number, porque: string, respondeuEm: Date | null = null): Promise<boolean> {
  const pool = await garantirTabelas();
  const [u] = (await pool.execute(
    `UPDATE seguimentoDoCliente
        SET paradoEm = UTC_TIMESTAMP(), paradoPorque = ?, respondeuEm = ?, porEnviar = NULL, porEnviarDesde = NULL
      WHERE pedidoId = ? AND ${A_CORRER_SQL}`,
    [porque.slice(0, 160), respondeuEm, pedidoId],
  )) as [{ affectedRows: number }, unknown];
  return Number(u.affectedRows) === 1;
}

/**
 * UM «OBRIGADO» SOZINHO NÃO É UMA RESPOSTA — d90 (23-11-2026). O ciclo
 * continua: a marcação passa para agora (a rotina compara a última mensagem
 * dele com ela), e nada mais muda — nem o dia, nem a hora, nem o que já saiu.
 */
export async function seguimentoContinuaDepoisDoObrigado(pedidoId: number): Promise<boolean> {
  const pool = await garantirTabelas();
  const [u] = (await pool.execute(
    `UPDATE seguimentoDoCliente SET marcadoEm = UTC_TIMESTAMP() WHERE pedidoId = ? AND ${A_CORRER_SQL}`,
    [pedidoId],
  )) as [{ affectedRows: number }, unknown];
  return Number(u.affectedRows) === 1;
}

/* ── O pedido, como as regras o lêem ─────────────────────────────────────── */

type PedidoLido = {
  id: number;
  status: string | null;
  anonimizado: boolean;
  temAcordada: boolean;
  eClyon: boolean;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  serviceType: string | null;
  city: string | null;
};

async function lerPedidos(pool: Pool, ids: number[]): Promise<Map<number, PedidoLido>> {
  await ensureSimulatorOrdersTable();
  await ensureNegociacoesTable();
  const m = new Map<number, PedidoLido>();
  const limpos = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))];
  if (limpos.length === 0) return m;
  const [rows] = (await pool.execute(
    `SELECT o.id, o.status, o.anonimizadoEm, o.contactName, o.contactEmail, o.contactPhone, o.serviceType, o.city, o.valorFixoClyon,
            EXISTS (SELECT 1 FROM negociacoes n WHERE n.pedidoId = o.id AND n.estado = 'acordada') AS temAcordada
       FROM simulatorOrders o
      WHERE o.id IN (${limpos.map(() => "?").join(",")})`,
    limpos,
  )) as [Array<Record<string, unknown>>, unknown];
  for (const r of rows) {
    m.set(Number(r.id), {
      id: Number(r.id),
      status: (r.status as string | null) ?? null,
      anonimizado: r.anonimizadoEm != null,
      temAcordada: Number(r.temAcordada) === 1,
      eClyon: r.valorFixoClyon != null,
      contactName: (r.contactName as string | null) ?? null,
      contactEmail: (r.contactEmail as string | null) ?? null,
      contactPhone: (r.contactPhone as string | null) ?? null,
      serviceType: (r.serviceType as string | null) ?? null,
      city: (r.city as string | null) ?? null,
    });
  }
  return m;
}

const saiuDoPrecisaDeSi = (p: PedidoLido | undefined) =>
  porqueSaiuDoPrecisaDeSi({ existe: Boolean(p), status: p?.status ?? null, anonimizado: p?.anonimizado ?? false, temAcordada: p?.temAcordada ?? false });

const noveDigitos = (v: unknown) => {
  const d = String(v ?? "").replace(/\D/g, "");
  return d.length >= 9 ? d.slice(-9) : "";
};

/**
 * O NÚMERO PARA O WHATSAPP: um telemóvel português («3519…»), ou um número
 * estrangeiro com o indicativo (11 dígitos ou mais, que não comece por 351).
 * Um fixo português não tem WhatsApp: vai por email, se o houver.
 */
export function telefoneDoSeguimento(telefone: string | null | undefined): string | null {
  const pt = telemovelPortugues(telefone);
  if (pt) return pt;
  let d = String(telefone ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  return d.length >= 11 && !d.startsWith("351") ? d : null;
}

function emailsDeTesteDoAmbiente(): Set<string> {
  return new Set(
    (process.env.EUPAGO_EMAILS_DE_TESTE ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@")),
  );
}

/** Por onde vai o seguimento deste pedido — ou porque não vai. */
export function canalParaOPedido(
  p: { contactName: string | null; contactEmail: string | null; contactPhone: string | null },
  emailsDeTeste: ReadonlySet<string> = new Set(),
): { canal: CanalDoSeguimento | null; porque: string | null } {
  if (eDeTeste(p.contactName, p.contactEmail, emailsDeTeste)) return { canal: null, porque: "conta de teste, não se envia" };
  if (telefoneDoSeguimento(p.contactPhone)) return { canal: "whatsapp", porque: null };
  if (emailValido(p.contactEmail)) return { canal: "email", porque: null };
  return { canal: null, porque: "sem telemóvel nem email, não se envia" };
}

/* ── Uma por dia: todas as mensagens automáticas a este cliente ──────────── */

/*
 * d85 (fase 0): a contagem é a comum a todas as rotinas
 * (`uma-mensagem-automatica-por-dia.ts`) — a validade (d62), os lembretes do
 * que falta (d71), este seguimento e as que vierem.
 */

/* ── O «Falei com o cliente» (a Mesa) ────────────────────────────────────── */

export type ResultadoDaMarcacao = { ok: true; feito: string } | { ok: false; porque: string };

export type Marcacao = {
  pedidoId: number;
  resposta: unknown;
  nota?: unknown;
  /** O dia e a hora de Lisboa do «voltar a contactar» (não no «Quer cancelar»). */
  dia?: unknown;
  hora?: unknown;
  porQuem: string;
  /** Quem carregou, para o motivo do fecho no «Quer cancelar». */
  colab?: { id: number; nome: string; role: string } | null;
};

/**
 * A EQUIPA FALOU COM O CLIENTE. Guarda quando, quem, a resposta, a nota e a
 * data marcada (no ciclo e no histórico do pedido); começa um ciclo novo (o
 * que estava a correr é substituído); pára a validade do orçamento deste
 * pedido (d62), que já tinha parado com a resposta dele. «Quer cancelar»
 * cancela já, pelo caminho de sempre.
 */
export async function falarComOCliente(m: Marcacao, agora: Date = new Date()): Promise<ResultadoDaMarcacao> {
  if (!eRespostaDoContacto(m.resposta)) return { ok: false, porque: "Escolha o que o cliente respondeu." };
  const resposta = m.resposta;
  const nota = notaLimpa(m.nota);
  const pool = await garantirTabelas();
  const p = (await lerPedidos(pool, [m.pedidoId])).get(m.pedidoId);
  const saiu = saiuDoPrecisaDeSi(p);
  if (saiu || !p) return { ok: false, porque: `Este pedido já não está à espera de nós: ${saiu ?? "não existe"}.` };

  if (resposta === "quer_cancelar") return cancelarPelaEquipa(pool, p, { porQuem: m.porQuem, nota, colab: m.colab ?? null }, agora);

  const voltar = validarVoltarEm(m.dia, m.hora, agora);
  if (!voltar.ok) return { ok: false, porque: voltar.porque };
  const { canal, porque } = canalParaOPedido(p, emailsDeTesteDoAmbiente());
  const antes = await cicloDoPedido(pool, m.pedidoId);
  const contacto: ContactoDoSeguimento = { em: agora.toISOString(), por: m.porQuem, resposta, nota, voltarEm: voltar.instante.toISOString() };
  const contactos = [...(antes?.contactos ?? []), contacto].slice(-CONTACTOS_GUARDADOS);

  await pool.execute(
    `INSERT INTO seguimentoDoCliente (pedidoId, marcadoEm, marcadoPor, resposta, voltarEm, canal, semEnvioPorque, contactosJson)
     VALUES (?, UTC_TIMESTAMP(), ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE marcadoEm = VALUES(marcadoEm), marcadoPor = VALUES(marcadoPor), resposta = VALUES(resposta),
       voltarEm = VALUES(voltarEm), canal = VALUES(canal), semEnvioPorque = VALUES(semEnvioPorque), contactosJson = VALUES(contactosJson),
       mensagem1Em = NULL, mensagem2Em = NULL, mensagem3Em = NULL, arquivadoEm = NULL, canceladoEm = NULL,
       paradoEm = NULL, paradoPorque = NULL, respondeuEm = NULL, porEnviar = NULL, porEnviarDesde = NULL,
       ultimaFalha = NULL, cancelarPedidoEm = NULL`,
    [m.pedidoId, m.porQuem.slice(0, 120), resposta, voltar.instante, canal, porque, JSON.stringify(contactos)],
  );

  // A validade do orçamento (d62) deste pedido pára: daqui em diante é o seguimento que fala.
  try {
    const { marcarCicloTerminado } = await import("./validade-do-orcamento-na-base");
    await marcarCicloTerminado(m.pedidoId, "a equipa marcou o seguimento do cliente (d83)");
  } catch {
    /* sem ciclo da validade: nada a parar */
  }

  const linha = linhaDoContacto(contacto);
  const envio = canal ? `seguimento automático ${canal === "whatsapp" ? "pelo WhatsApp" : "por email"}` : `sem seguimento automático (${porque})`;
  const feito = `${linha} — ${envio}.`;
  await appendOrderHistory(m.pedidoId, { type: "note", by: null, message: `${feito} (d83)` }).catch(() => {});
  await registarSemFalhar({
    acontecimento: "seguimento_do_cliente",
    pedidoId: m.pedidoId,
    autorTipo: "clyon",
    autorNome: m.porQuem,
    resumo: `«Falei com o cliente» (${ROTULOS_DAS_RESPOSTAS[resposta]}), ${envio}.`,
  });
  return { ok: true, feito };
}

/* ── O seguimento que arranca sozinho — d90 (23-11-2026) ─────────────────── */

export type PorqueArrancaSozinho = "vai_pensar" | "depois_da_equipa";

export type ResultadoDoArranque = { ok: true; feito: string; voltarEm: Date } | { ok: false; porque: string };

/**
 * O SEGUIMENTO ARRANCA SOZINHO (d90). Como o «Falei com o cliente» da Mesa,
 * com a resposta «vai_pensar» e quem marca «a Vitória (automático)»:
 *
 *   · «vai_pensar» — o cliente disse que ia pensar: a 1.ª mensagem amanhã às
 *     10h (Lisboa); o pedido passa a «A aguardar cliente» (a proposta foi-lhe
 *     dada, e agora a espera é dele);
 *   · «depois_da_equipa» — a equipa respondeu à pergunta dele e ele não disse
 *     mais nada até hoje: a 1.ª mensagem hoje às 10h.
 *
 * Só uma vez por pedido (um segundo «vou pensar», depois do seguimento, vai à
 * equipa: nada de ciclos sem fim), nunca com um seguimento a correr, com o
 * interruptor desligado, num pedido que já saiu do «Precisa de si», num
 * Trabalho CLYON (o acordo é à mão) ou sem canal. A uma-por-dia, a janela e o
 * «não contactar» seguem pela rotina de sempre.
 */
export async function arrancarOSeguimentoSozinho(
  pedidoId: number,
  porque: PorqueArrancaSozinho,
  agora: Date = new Date(),
): Promise<ResultadoDoArranque> {
  if (!(await interruptorDoSeguimento()).ligado) return { ok: false, porque: "o seguimento do cliente está desligado" };
  const pool = await garantirTabelas();
  const p = (await lerPedidos(pool, [pedidoId])).get(pedidoId);
  const saiu = saiuDoPrecisaDeSi(p);
  if (saiu || !p) return { ok: false, porque: saiu ?? "o pedido não existe" };
  if (p.eClyon) return { ok: false, porque: "Trabalho CLYON — o acordo é à mão" };
  const { canal, porque: semCanal } = canalParaOPedido(p, emailsDeTesteDoAmbiente());
  if (!canal) return { ok: false, porque: semCanal ?? "sem contacto" };
  const antes = await cicloDoPedido(pool, pedidoId);
  if (antes && seguimentoEmCurso(antes)) return { ok: false, porque: "já há um seguimento a correr" };
  const { POR_A_VITORIA, NOTA_DO_VAI_PENSAR, NOTA_DEPOIS_DA_EQUIPA, voltarAmanhaAsDez, hojeAsDez } = await import("./o-cliente-vai-pensar");
  if (antes?.contactos.some((k) => k.por === POR_A_VITORIA)) return { ok: false, porque: "o seguimento automático já correu neste pedido" };

  const voltarEm = porque === "vai_pensar" ? voltarAmanhaAsDez(agora) : hojeAsDez(agora);
  const nota = porque === "vai_pensar" ? "o cliente disse que ia pensar" : "o cliente não voltou a escrever depois da resposta da equipa";
  const contacto: ContactoDoSeguimento = { em: agora.toISOString(), por: POR_A_VITORIA, resposta: "vai_pensar", nota, voltarEm: voltarEm.toISOString() };
  const contactos = [...(antes?.contactos ?? []), contacto].slice(-CONTACTOS_GUARDADOS);
  await pool.execute(
    `INSERT INTO seguimentoDoCliente (pedidoId, marcadoEm, marcadoPor, resposta, voltarEm, canal, semEnvioPorque, contactosJson)
     VALUES (?, UTC_TIMESTAMP(), ?, 'vai_pensar', ?, ?, NULL, ?)
     ON DUPLICATE KEY UPDATE marcadoEm = VALUES(marcadoEm), marcadoPor = VALUES(marcadoPor), resposta = VALUES(resposta),
       voltarEm = VALUES(voltarEm), canal = VALUES(canal), semEnvioPorque = NULL, contactosJson = VALUES(contactosJson),
       mensagem1Em = NULL, mensagem2Em = NULL, mensagem3Em = NULL, arquivadoEm = NULL, canceladoEm = NULL,
       paradoEm = NULL, paradoPorque = NULL, respondeuEm = NULL, porEnviar = NULL, porEnviarDesde = NULL,
       ultimaFalha = NULL, cancelarPedidoEm = NULL`,
    [pedidoId, POR_A_VITORIA.slice(0, 120), voltarEm, canal, JSON.stringify(contactos)],
  );
  // A validade do orçamento (d62) pára: daqui em diante é o seguimento que fala (como no «Falei com o cliente»).
  try {
    const { marcarCicloTerminado } = await import("./validade-do-orcamento-na-base");
    await marcarCicloTerminado(pedidoId, "o seguimento do cliente arrancou sozinho (d90)");
  } catch {
    /* sem ciclo da validade */
  }
  if (porque === "vai_pensar") {
    // «A aguardar cliente»: a proposta está com ele (num pedido que negoceia; num Trabalho CLYON não chega aqui).
    const { marcarOrcamentoEnviado } = await import("./db");
    await marcarOrcamentoEnviado(pedidoId).catch(() => {});
  }
  const { linhaDoContacto: linha } = await import("./seguimento-do-cliente");
  const titulo = porque === "vai_pensar" ? NOTA_DO_VAI_PENSAR : NOTA_DEPOIS_DA_EQUIPA;
  const feito = `${titulo} (${linha(contacto)}).`;
  await appendOrderHistory(pedidoId, { type: "note", by: null, message: `${feito} (d90)` }).catch(() => {});
  await registarSemFalhar({
    acontecimento: "seguimento_do_cliente",
    pedidoId,
    autorTipo: "sistema",
    autorNome: POR_A_VITORIA,
    resumo: `${titulo} — seguimento automático ${canal === "whatsapp" ? "pelo WhatsApp" : "por email"} (d90).`,
  });
  return { ok: true, feito, voltarEm };
}

/**
 * OS QUE A EQUIPA RESPONDEU ONTEM E O CLIENTE NÃO VOLTOU A ESCREVER (d90). Às
 * 10h do dia seguinte (a rotina corre de 15 em 15 minutos), cada pedido com a
 * proposta no cliente, sem seguimento, cujo fio acaba numa resposta à mão da
 * equipa a uma pergunta dele, de ontem: o seguimento arranca sozinho, hoje às
 * 10h. Devolve quantos arrancaram.
 */
export async function arrancarOsSeguimentosDepoisDaEquipa(agora: Date = new Date()): Promise<number> {
  const { pecasEmLisboa } = await import("./hora-de-lisboa");
  if (pecasEmLisboa(agora).hora < 10) return 0;
  const pool = await garantirTabelas();
  await ensureSimulatorOrdersTable();
  await ensureNegociacoesTable();
  const [rows] = (await pool.query(
    `SELECT o.id, o.contactPhone
       FROM simulatorOrders o
      WHERE o.propostaEnviadaEm IS NOT NULL
        AND o.propostaEnviadaEm > UTC_TIMESTAMP() - INTERVAL 30 DAY
        AND o.valorFixoClyon IS NULL
        AND o.anonimizadoEm IS NULL
        AND (o.status IS NULL OR o.status NOT IN ('cancelado','arquivado','rejeitado','concluido'))
        AND NOT EXISTS (SELECT 1 FROM negociacoes n WHERE n.pedidoId = o.id AND n.estado = 'acordada')
        AND NOT EXISTS (SELECT 1 FROM seguimentoDoCliente s WHERE s.pedidoId = o.id)
      ORDER BY o.id DESC
      LIMIT 60`,
  )) as [Array<{ id: number; contactPhone: string | null }>, unknown];
  if (rows.length === 0) return 0;
  const { mensagensDoNumeroWhatsApp } = await import("./db");
  const { eDaEquipa } = await import("./rajada-do-whatsapp");
  const { aEquipaRespondeuEOClienteCalou } = await import("./o-cliente-vai-pensar");
  let arrancaram = 0;
  const vistos = new Set<string>();
  for (const r of rows) {
    const tel = noveDigitos(r.contactPhone);
    if (!tel || vistos.has(tel)) continue;
    vistos.add(tel);
    try {
      const fio = await mensagensDoNumeroWhatsApp(String(r.contactPhone), 20);
      if (!aEquipaRespondeuEOClienteCalou(fio, agora, eDaEquipa)) continue;
      const feito = await arrancarOSeguimentoSozinho(Number(r.id), "depois_da_equipa", agora);
      if (feito.ok) arrancaram += 1;
    } catch (e) {
      console.error("[seguimento-do-cliente] arranque depois da equipa, pedido", r.id, e instanceof Error ? e.message : e);
    }
  }
  return arrancaram;
}

/** «Parar o seguimento»: desmarca o ciclo em curso. Fica no histórico. */
export async function pararSeguimentoAMao(pedidoId: number, porQuem: string, agora: Date = new Date()): Promise<ResultadoDaMarcacao> {
  const pool = await garantirTabelas();
  const antes = await cicloDoPedido(pool, pedidoId);
  if (!antes || !seguimentoEmCurso(antes)) return { ok: false, porque: "Este pedido não tem seguimento a correr." };
  const parou = await pararSeguimento(pedidoId, `parado à mão por ${porQuem}`);
  if (!parou) return { ok: false, porque: "Este pedido não tem seguimento a correr." };
  const contacto: ContactoDoSeguimento = { em: agora.toISOString(), por: porQuem, resposta: null };
  await pool.execute("UPDATE seguimentoDoCliente SET contactosJson = ? WHERE pedidoId = ?", [
    JSON.stringify([...antes.contactos, contacto].slice(-CONTACTOS_GUARDADOS)),
    pedidoId,
  ]);
  const feito = `${linhaDoContacto(contacto)}.`;
  await appendOrderHistory(pedidoId, { type: "note", by: null, message: `${feito} (d83)` }).catch(() => {});
  return { ok: true, feito };
}

/* ── Cancelar (a equipa no «Quer cancelar», ou o cliente com o CANCELAR) ──── */

const MOTIVO_DO_CANCELAMENTO = "O cliente já não precisa";

/**
 * O CANCELAMENTO DE SEMPRE, com histórico e nunca apagar: `cancelarPedido`
 * (encerra as negociações, guarda o estado de antes), o motivo «Já não
 * precisa», os parceiros avisados como no cancelamento da Mesa (num Trabalho
 * CLYON, como no dos Trabalhos CLYON), e os dados do cliente a sair 7 dias
 * depois, pela purga dos cancelados pelo lembrete (d2/d71 v2).
 */
async function cancelarOPedido(
  pool: Pool,
  p: PedidoLido,
  quem: { porQuem: "clyon" | "cliente"; autor: string; colab: { id: number; nome: string; role: string } | null },
): Promise<{ ok: true; encerradas: number } | { ok: false; porque: string }> {
  const { cancelarPedido, gravarMotivoDoFecho, quemTemOTrabalhoClyon } = await import("./db");
  const existentes = await negociacoesDoPedido(p.id);
  const doTrabalhoClyon = p.eClyon ? (await quemTemOTrabalhoClyon(p.id)).vivos : [];
  const r = await cancelarPedido(p.id, { motivo: MOTIVO_DO_CANCELAMENTO });
  if (!r) return { ok: false, porque: "pedido não encontrado" };
  await gravarMotivoDoFecho(p.id, "ja_nao_precisa", null, quem.colab).catch(() => {});
  await pool.execute(
    `UPDATE seguimentoDoCliente SET anonimizarAPartirDe = NOW() + INTERVAL ${DIAS_ATE_ANONIMIZAR_O_CANCELADO} DAY WHERE pedidoId = ?`,
    [p.id],
  );
  if (p.eClyon) {
    const { avisarCancelamentoDoTrabalhoClyon } = await import("./avisar-trabalho-clyon");
    await avisarCancelamentoDoTrabalhoClyon({
      pedidoId: p.id,
      servico: p.serviceType,
      localidade: p.city,
      motivo: MOTIVO_DO_CANCELAMENTO,
      quem: doTrabalhoClyon,
    }).catch(() => 0);
    if (quem.porQuem === "clyon") {
      const { avisarOClienteDoPedido } = await import("./avisos-ao-cliente");
      await avisarOClienteDoPedido(p.id, "cancelado", { motivo: MOTIVO_DO_CANCELAMENTO }).catch(() => {});
    }
  } else {
    const { avisarDoCancelamento } = await import("./avisar-cancelamento");
    await avisarDoCancelamento({ pedidoId: p.id, negociacoes: existentes, motivo: MOTIVO_DO_CANCELAMENTO, porQuem: quem.porQuem });
  }
  // A validade do orçamento (d62) também pára (e a pergunta do CANCELAR dela, se a havia).
  try {
    const { marcarCicloTerminado } = await import("./validade-do-orcamento-na-base");
    await marcarCicloTerminado(p.id, "pedido cancelado pelo seguimento do cliente (d83)");
  } catch {
    /* sem ciclo da validade */
  }
  return { ok: true, encerradas: r.encerradas };
}

async function cancelarPelaEquipa(
  pool: Pool,
  p: PedidoLido,
  q: { porQuem: string; nota: string | null; colab: { id: number; nome: string; role: string } | null },
  agora: Date,
): Promise<ResultadoDaMarcacao> {
  if (pedidoFechado(p.status)) return { ok: false, porque: "Este pedido já está fechado." };
  const antes = await cicloDoPedido(pool, p.id);
  const contacto: ContactoDoSeguimento = { em: agora.toISOString(), por: q.porQuem, resposta: "quer_cancelar", nota: q.nota };
  const contactos = [...(antes?.contactos ?? []), contacto].slice(-CONTACTOS_GUARDADOS);
  // Marca primeiro (um segundo clique não cancela outra vez); desfaz-se se o cancelamento não se fizer.
  await pool.execute(
    `INSERT INTO seguimentoDoCliente (pedidoId, marcadoEm, marcadoPor, resposta, voltarEm, canal, canceladoEm, contactosJson)
     VALUES (?, UTC_TIMESTAMP(), ?, 'quer_cancelar', NULL, NULL, UTC_TIMESTAMP(), ?)
     ON DUPLICATE KEY UPDATE marcadoEm = VALUES(marcadoEm), marcadoPor = VALUES(marcadoPor), resposta = VALUES(resposta),
       canceladoEm = VALUES(canceladoEm), contactosJson = VALUES(contactosJson), porEnviar = NULL, porEnviarDesde = NULL`,
    [p.id, q.porQuem.slice(0, 120), JSON.stringify(contactos)],
  );
  const r = await cancelarOPedido(pool, p, { porQuem: "clyon", autor: q.porQuem, colab: q.colab });
  if (!r.ok) {
    await pool.execute("UPDATE seguimentoDoCliente SET canceladoEm = NULL WHERE pedidoId = ?", [p.id]).catch(() => {});
    return { ok: false, porque: r.porque };
  }
  const resumo =
    `${linhaDoContacto(contacto)}: ${r.encerradas} negociação(ões) encerrada(s), parceiros avisados. ` +
    `Os dados do cliente saem do pedido daqui a ${DIAS_ATE_ANONIMIZAR_O_CANCELADO} dias, pela purga; reabrir o pedido até lá desfaz.`;
  await appendOrderHistory(p.id, { type: "created", by: null, message: `${resumo} (d83)` }).catch(() => {});
  await registarSemFalhar({ acontecimento: "pedido_cancelado", pedidoId: p.id, autorTipo: "clyon", autorNome: q.porQuem, resumo });
  return { ok: true, feito: resumo };
}

/* ── A rotina: de 15 em 15 minutos, decide e põe na fila ─────────────────── */

export type ResultadoDaRotinaDoSeguimento = {
  ligado: boolean;
  foraDaJanela?: boolean;
  aCorrer: number;
  naFila: number;
  porEmail: number;
  parados: number;
  falhados: number;
  /** d90: os que arrancaram sozinhos (a equipa respondeu ontem e o cliente calou-se). */
  arrancados?: number;
};

const INTERVALO_ENTRE_EMAILS_MS = 600;
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Cada ciclo a correr: parado se o pedido saiu do «Precisa de si» ou se o
 * cliente respondeu; o passo que toca (no máximo um por contacto e por dia,
 * contando as outras mensagens automáticas) na fila — ou, por email, já.
 * Desligado ou fora das 9h–20h, não faz nada. Falha fechada: sem saber se o
 * cliente respondeu, não põe nada na fila.
 */
export async function rotinaDoSeguimento(agora: Date = new Date()): Promise<ResultadoDaRotinaDoSeguimento> {
  const r: ResultadoDaRotinaDoSeguimento = { ligado: false, aCorrer: 0, naFila: 0, porEmail: 0, parados: 0, falhados: 0 };
  if (!(await interruptorDoSeguimento()).ligado) return r;
  r.ligado = true;
  if (!naJanelaDoSeguimento(agora)) {
    r.foraDaJanela = true;
    return r;
  }
  // d90: a equipa respondeu ontem à pergunta dele e ele calou-se — o seguimento arranca hoje às 10h.
  r.arrancados = await arrancarOsSeguimentosDepoisDaEquipa(agora).catch((e) => {
    console.error("[seguimento-do-cliente] o arranque depois da equipa falhou:", e instanceof Error ? e.message : e);
    return 0;
  });
  const pool = await garantirTabelas();
  const [linhas] = (await pool.query(
    `SELECT * FROM seguimentoDoCliente WHERE canal IS NOT NULL AND ${A_CORRER_SQL} ORDER BY pedidoId ASC LIMIT 300`,
  )) as [Array<Record<string, unknown>>, unknown];
  const ciclos = linhas.map(lerLinha);
  r.aCorrer = ciclos.length;
  if (ciclos.length === 0) return r;
  const pedidos = await lerPedidos(pool, ciclos.map((c) => c.pedidoId));
  const { respostasDoClienteNoWhatsApp } = await import("./db");
  const respostas = await respostasDoClienteNoWhatsApp([...pedidos.values()].map((p) => p.contactPhone));

  const vivos: Array<{ c: LinhaDoSeguimento; p: PedidoLido; contacto: string }> = [];
  // d128: fora da zona, o seguimento fica parado (sem mensagem) até a morada estar confirmada.
  const { idsForaDaZona } = await import("./fora-da-zona-na-base");
  const foraDaZona = await idsForaDaZona(ciclos.map((c) => c.pedidoId));
  for (const c of ciclos) {
    if (foraDaZona.has(c.pedidoId)) continue;
    try {
      const p = pedidos.get(c.pedidoId);
      const saiu = saiuDoPrecisaDeSi(p);
      if (saiu || !p) {
        if (await pararSeguimento(c.pedidoId, saiu ?? "o pedido já não existe")) r.parados += 1;
        continue;
      }
      const resp = respostas.get(noveDigitos(p.contactPhone))?.ultimaMensagemEm ?? null;
      if (c.canal === "whatsapp" && clienteRespondeuAoSeguimento(c.marcadoEm, resp)) {
        if (await pararSeguimento(c.pedidoId, "o cliente respondeu", resp)) r.parados += 1;
        continue;
      }
      const contacto = c.canal === "whatsapp" ? noveDigitos(p.contactPhone) : (emailValido(p.contactEmail) ?? "");
      if (!contacto) {
        await pararSeguimento(c.pedidoId, "o pedido ficou sem contacto");
        r.parados += 1;
        continue;
      }
      vivos.push({ c, p, contacto });
    } catch (e) {
      r.falhados += 1;
      console.error("[seguimento-do-cliente] pedido", c.pedidoId, e instanceof Error ? e.message : e);
    }
  }

  // Um passo por contacto: com dois pedidos dele em seguimento, sai um por dia.
  const porContacto = new Map<string, typeof vivos>();
  for (const v of vivos) porContacto.set(v.contacto, [...(porContacto.get(v.contacto) ?? []), v]);
  let emails = 0;
  for (const lista of porContacto.values()) {
    if (lista.some((v) => v.c.porEnviar)) continue;
    const v = lista.find((x) => proximoPassoDoSeguimento(x.c, agora) != null);
    if (!v) continue;
    const passo = proximoPassoDoSeguimento(v.c, agora)!;
    try {
      const contacto = { telefone: v.p.contactPhone, email: v.c.canal === "email" ? v.p.contactEmail : null };
      if (await jaSaiuHojeUmaMensagemAutomatica(contacto, agora, { pool })) continue;
    } catch (e) {
      r.falhados += 1;
      console.error("[seguimento-do-cliente] não li as mensagens de hoje — não envio:", e instanceof Error ? e.message : e);
      continue;
    }
    if (v.c.canal === "whatsapp") {
      const [u] = (await pool.execute(
        `UPDATE seguimentoDoCliente SET porEnviar = ?, porEnviarDesde = UTC_TIMESTAMP(), ultimaFalha = NULL
          WHERE pedidoId = ? AND porEnviar IS NULL AND ${A_CORRER_SQL}`,
        [passo, v.c.pedidoId],
      )) as [{ affectedRows: number }, unknown];
      if (Number(u.affectedRows) === 1) r.naFila += 1;
      continue;
    }
    if (emails > 0) await espera(INTERVALO_ENTRE_EMAILS_MS);
    emails += 1;
    const feito = await darOPasso(v.c.pedidoId, passo, agora).catch((e) => ({ ok: false as const, porque: e instanceof Error ? e.message : "erro" }));
    if (feito.ok) r.porEmail += 1;
    else r.falhados += 1;
  }
  return r;
}

export function resumoDaRotinaDoSeguimento(r: ResultadoDaRotinaDoSeguimento): string | null {
  if (!r.ligado) return `desligado (interruptor «${NOME_DO_INTERRUPTOR_DO_SEGUIMENTO}» nas Configs)`;
  if (r.foraDaJanela) return "fora das 9h–20h de Lisboa";
  if (r.naFila === 0 && r.porEmail === 0 && r.parados === 0 && r.falhados === 0 && !r.arrancados) return null;
  return (
    `${r.aCorrer} em seguimento · ${r.naFila} WhatsApp na fila · ${r.porEmail} email(s) · ${r.parados} parado(s)` +
    (r.arrancados ? ` · ${r.arrancados} arrancado(s) sozinho(s)` : "") +
    (r.falhados ? ` · ${r.falhados} falhado(s)` : "")
  );
}

/* ── A passagem: um WhatsApp por vez, às rondas da ponte ─────────────────── */

export type ResultadoDaPassagemDoSeguimento = "desligado" | "fora-da-janela" | "nada" | "nao-e-a-vez" | "feito" | "falhou";

export async function passagemDoSeguimento(agora: Date = new Date()): Promise<ResultadoDaPassagemDoSeguimento> {
  if (!naJanelaDoSeguimento(agora)) return "fora-da-janela";
  const pool = await garantirTabelas();
  const [proximos] = (await pool.query(
    "SELECT pedidoId, porEnviar FROM seguimentoDoCliente WHERE porEnviar IS NOT NULL ORDER BY porEnviarDesde ASC LIMIT 1",
  )) as [Array<{ pedidoId: number; porEnviar: string }>, unknown];
  const p = proximos[0];
  if (!p) return "nada";
  if (!(await interruptorDoSeguimento()).ligado) return "desligado";

  const { intervaloAoAcaso } = await import("./aviso-aos-profissionais");
  const [vez] = (await pool.execute(
    "UPDATE seguimentoDoClienteVez SET proximoEm = UTC_TIMESTAMP() + INTERVAL ? SECOND WHERE id = 1 AND proximoEm <= UTC_TIMESTAMP()",
    [intervaloAoAcaso()],
  )) as [{ affectedRows: number }, unknown];
  if (Number(vez.affectedRows) !== 1) return "nao-e-a-vez";

  // Tirar da fila ANTES de enviar: uma passagem ao mesmo tempo não manda outra vez.
  const [reserva] = (await pool.execute(
    "UPDATE seguimentoDoCliente SET porEnviar = NULL, porEnviarDesde = NULL WHERE pedidoId = ? AND porEnviar = ?",
    [p.pedidoId, p.porEnviar],
  )) as [{ affectedRows: number }, unknown];
  if (Number(reserva.affectedRows) !== 1) return "nada";
  if (!(PASSOS as readonly string[]).includes(p.porEnviar)) return "nada";

  const r = await darOPasso(Number(p.pedidoId), p.porEnviar as PassoDoSeguimento, agora).catch((e) => ({
    ok: false as const,
    porque: e instanceof Error ? e.message : "erro",
  }));
  if (!r.ok) {
    await pool.execute("UPDATE seguimentoDoCliente SET ultimaFalha = ? WHERE pedidoId = ?", [r.porque.slice(0, 160), p.pedidoId]).catch(() => {});
    return "falhou";
  }
  return "feito";
}

/* ── Dar um passo ────────────────────────────────────────────────────────── */

export type ResultadoDoPasso = { ok: true; feito: string } | { ok: false; porque: string };

const COLUNA_DO_PASSO: Record<Exclude<PassoDoSeguimento, "arquivar">, { coluna: string; antes: string | null; n: number }> = {
  mensagem1: { coluna: "mensagem1Em", antes: null, n: 1 },
  mensagem2: { coluna: "mensagem2Em", antes: "mensagem1Em", n: 2 },
  mensagem3: { coluna: "mensagem3Em", antes: "mensagem2Em", n: 3 },
};

async function enviarPeloCanal(canal: CanalDoSeguimento, p: PedidoLido, passo: PassoDoSeguimento, texto: string): Promise<boolean> {
  if (canal === "whatsapp") {
    const tel = telefoneDoSeguimento(p.contactPhone);
    if (!tel) return false;
    const { enviarAvisoWhatsApp } = await import("./whatsapp-cloud");
    /*
     * Como o «Enviar pela CLYON» e os lembretes da validade: nunca para um
     * número bloqueado nem com o WhatsApp desligado; na língua da conversa do
     * cliente (o tradutor, depois as traduções fixas) ou nada — sem tradução,
     * passa à equipa.
     */
    return enviarAvisoWhatsApp(tel, texto, { semLinguaErrada: true }).catch(() => false);
  }
  const email = emailValido(p.contactEmail);
  if (!email) return false;
  const { enviarEmailDoSeguimento } = await import("./seguimento-da-app-envio");
  // d102: o link do pedido (ou a conta), por onde se escolhe o parceiro e se cancela — o fecho já não o leva.
  let link: string | null = null;
  if (passo !== "arquivar") {
    const { linkParaQuemFechou } = await import("./link-de-quem-fecha-pelo-whatsapp");
    const db = await import("./db");
    link = await linkParaQuemFechou(p.id, {
      emailDoPedido: async () => email,
      existeContaComEmail: db.existeContaComEmail,
      substituirTokenDoPedido: db.substituirTokenDoPedido,
    }).catch(() => null);
  }
  return enviarEmailDoSeguimento({ para: email, assunto: assuntoDoSeguimento(passo, p.id), texto: paraEmail(texto, link) }).catch(() => false);
}

/**
 * Lê tudo outra vez — o interruptor, o pedido ainda à espera de nós, a
 * resposta do cliente, o ciclo, as mensagens de hoje — e só então envia.
 * Reserva o passo na base antes de sair (affectedRows = 1) e repõe-no se o
 * envio falhar; um envio que falha pára o ciclo (o pedido volta a contar no
 * «Precisa de si»: não se insiste com um número bloqueado).
 */
export async function darOPasso(pedidoId: number, passo: PassoDoSeguimento, agora: Date): Promise<ResultadoDoPasso> {
  if (!(await interruptorDoSeguimento()).ligado) return { ok: false, porque: "desligado" };
  const pool = await garantirTabelas();
  const c = await cicloDoPedido(pool, pedidoId);
  if (!c || !seguimentoEmCurso(c)) return { ok: false, porque: "sem seguimento a correr" };
  const p = (await lerPedidos(pool, [pedidoId])).get(pedidoId);
  const saiu = saiuDoPrecisaDeSi(p);
  if (saiu || !p) {
    await pararSeguimento(pedidoId, saiu ?? "o pedido já não existe");
    return { ok: false, porque: saiu ?? "o pedido já não existe" };
  }
  if (c.canal === "whatsapp") {
    const { respostasDoClienteNoWhatsApp } = await import("./db");
    const resp = (await respostasDoClienteNoWhatsApp([p.contactPhone])).get(noveDigitos(p.contactPhone))?.ultimaMensagemEm ?? null;
    if (clienteRespondeuAoSeguimento(c.marcadoEm, resp)) {
      await pararSeguimento(pedidoId, "o cliente respondeu", resp);
      return { ok: false, porque: "o cliente respondeu — o seguimento parou" };
    }
  }
  if (canalParaOPedido(p, emailsDeTesteDoAmbiente()).canal == null) {
    await pararSeguimento(pedidoId, "conta de teste ou sem contacto");
    return { ok: false, porque: "conta de teste ou sem contacto" };
  }
  if (proximoPassoDoSeguimento(c, agora) !== passo) return { ok: false, porque: "não é a vez deste passo" };
  if (await jaSaiuHojeUmaMensagemAutomatica({ telefone: p.contactPhone, email: c.canal === "email" ? p.contactEmail : null }, agora, { pool })) {
    return { ok: false, porque: "já saiu hoje uma mensagem automática a este cliente (deste ou de outro pedido)" };
  }

  const { servicoEmPalavras } = await import("./servico-em-palavras");
  const texto = textoDoPassoDoSeguimento(passo, {
    pedidoId,
    nome: p.contactName,
    servico: servicoEmPalavras(p.serviceType).toLowerCase(),
    resposta: c.resposta,
  });

  if (passo === "arquivar") return arquivarSemResposta(pool, p, c, texto);

  const { coluna, antes, n } = COLUNA_DO_PASSO[passo];
  const [reserva] = (await pool.execute(
    `UPDATE seguimentoDoCliente SET ${coluna} = UTC_TIMESTAMP(), ultimaFalha = NULL
      WHERE pedidoId = ? AND ${coluna} IS NULL ${antes ? `AND ${antes} IS NOT NULL` : ""} AND ${A_CORRER_SQL}`,
    [pedidoId],
  )) as [{ affectedRows: number }, unknown];
  if (Number(reserva.affectedRows) !== 1) return { ok: false, porque: "este passo já foi dado (ou está a ser dado) por outra passagem" };

  if (!(await enviarPeloCanal(c.canal!, p, passo, texto))) {
    await pool.execute(`UPDATE seguimentoDoCliente SET ${coluna} = NULL, ultimaFalha = ? WHERE pedidoId = ?`, ["o envio falhou", pedidoId]);
    await pararSeguimento(
      pedidoId,
      c.canal === "whatsapp" ? "o WhatsApp não saiu (bloqueado, desligado ou sem tradução)" : "o email não saiu",
    );
    return { ok: false, porque: "o envio falhou" };
  }
  if (c.canal === "whatsapp") {
    // A conversa volta à Vitória, para ela ler o «1», o «2» ou o «3».
    const { retomarNumeroWhatsApp } = await import("./db");
    await retomarNumeroWhatsApp(telefoneDoSeguimento(p.contactPhone)!).catch(() => {});
  }
  // d91 (5.3): a 1.ª do «Vai pensar» tem duas variantes — par A, ímpar B —, e a que saiu fica no histórico.
  const { varianteDaMensagem1 } = await import("./seguimento-do-cliente");
  const variante = passo === "mensagem1" && c.resposta === "vai_pensar" ? ` Variante ${varianteDaMensagem1(pedidoId)} (A/B da d91).` : "";
  const feito = `Seguimento do cliente ${n}/3 enviado ${c.canal === "whatsapp" ? "pelo WhatsApp" : "por email"} (automático, d83).${variante}`;
  await appendOrderHistory(pedidoId, { type: "note", by: null, message: feito }).catch(() => {});
  return { ok: true, feito };
}

/**
 * NO 4.º DIA: ARQUIVADO (nunca apagado), com o motivo «o cliente não
 * respondeu ao seguimento»; os parceiros com proposta avisados (o texto do
 * fecho da d62); o cliente recebe a mensagem do fecho. A guarda d27: um
 * pedido fechado, ou com parceiro escolhido, não se mexe.
 */
async function arquivarSemResposta(pool: Pool, p: PedidoLido, c: LinhaDoSeguimento, texto: string): Promise<ResultadoDoPasso> {
  const [m] = (await pool.execute(
    `UPDATE seguimentoDoCliente SET arquivadoEm = UTC_TIMESTAMP(), porEnviar = NULL
      WHERE pedidoId = ? AND mensagem3Em IS NOT NULL AND ${A_CORRER_SQL}`,
    [p.id],
  )) as [{ affectedRows: number }, unknown];
  if (Number(m.affectedRows) !== 1) return { ok: false, porque: "já arquivado, cancelado ou parado" };

  // Outra vez, já com a marca posta: entretanto pode ter sido escolhido o parceiro.
  const agora = (await lerPedidos(pool, [p.id])).get(p.id);
  const saiu = saiuDoPrecisaDeSi(agora);
  if (saiu || !agora) {
    await pool.execute("UPDATE seguimentoDoCliente SET arquivadoEm = NULL WHERE pedidoId = ?", [p.id]);
    await pararSeguimento(p.id, saiu ?? "o pedido já não existe");
    return { ok: false, porque: saiu ?? "o pedido já não existe" };
  }

  const { updateSimulatorOrder, gravarMotivoDoFecho, perfilDoProfissional, quemTemOTrabalhoClyon } = await import("./db");
  const { avisarProfissionalSemOTrabalhoPorPush } = await import("./avisar-por-push");
  const { textoDoFechoAoParceiro, FECHADO_SEM_RESPOSTA } = await import("./textos-dos-avisos-ao-profissional");

  // Quem tem proposta — lido ANTES de arquivar, que encerra as negociações.
  const negs = await negociacoesDoPedido(p.id);
  const propostaDoPro = (j: unknown) => {
    try {
      const l = JSON.parse(String(j ?? "[]"));
      return Array.isArray(l) && l.some((x: { por?: string }) => x?.por === "profissional");
    } catch {
      return false;
    }
  };
  const comProposta = negs.filter((n) =>
    n.estado === "aguarda_contratacao" ? true : !p.eClyon && n.estado === "aberta" && propostaDoPro(n.propostasJson),
  );
  const ids = new Set(comProposta.map((n) => Number(n.id)));
  const doTrabalhoClyon = p.eClyon ? (await quemTemOTrabalhoClyon(p.id)).vivos.filter((q) => ids.has(q.negociacaoId)) : [];

  await updateSimulatorOrder(p.id, { status: "arquivado" }, { motivo: FECHADO_SEM_RESPOSTA });
  await gravarMotivoDoFecho(p.id, "sem_resposta", null, null).catch(() => {});

  let avisados = 0;
  for (const n of comProposta) {
    try {
      const perfil = await perfilDoProfissional(Number(n.providerId));
      const email = typeof perfil?.email === "string" ? perfil.email : null;
      if (!email) continue;
      await avisarProfissionalSemOTrabalhoPorPush({ email, pedidoId: p.id, negociacaoId: Number(n.id), porque: "fechado_sem_resposta" });
      avisados += 1;
    } catch (e) {
      console.error("[seguimento-do-cliente] aviso ao parceiro:", e instanceof Error ? e.message : e);
    }
  }
  if (doTrabalhoClyon.length > 0) {
    const { avisarSemEfeitoDoTrabalhoClyon } = await import("./avisar-trabalho-clyon");
    await avisarSemEfeitoDoTrabalhoClyon({
      pedidoId: p.id,
      servico: p.serviceType,
      localidade: null,
      quem: doTrabalhoClyon.filter((q) => !q.eraDele),
      texto: textoDoFechoAoParceiro(p.id),
    }).catch(() => 0);
  }

  const saiuAoCliente = await enviarPeloCanal(c.canal!, p, "arquivar", texto);
  const resumo =
    "Arquivado sozinho: o cliente não respondeu ao seguimento (d83) — três mensagens, sem resposta. " +
    `${comProposta.length} parceiro(s) com proposta avisado(s) (${avisados} no telemóvel); ` +
    `${saiuAoCliente ? `o cliente foi avisado ${c.canal === "whatsapp" ? "pelo WhatsApp" : "por email"}` : "o aviso ao cliente não saiu"}; pode voltar a pedir quando quiser.`;
  await appendOrderHistory(p.id, { type: "archived", by: null, message: resumo }).catch(() => {});
  await registarSemFalhar({ acontecimento: "seguimento_do_cliente", pedidoId: p.id, autorTipo: "sistema", autorNome: "seguimento do cliente", resumo });
  return { ok: true, feito: resumo };
}

/* ── A Mesa ──────────────────────────────────────────────────────────────── */

export type SeguimentoNaMesa = {
  pedidoId: number;
  /** Quando a equipa marcou o «Falei com o cliente» (ISO) — uma mensagem do cliente depois disto pára o ciclo (d83 v2). */
  marcadoEm: string;
  /** A correr e a enviar (com o interruptor ligado): sai da conta do «Precisa de si». */
  emCurso: boolean;
  /** Há ciclo por parar (o botão «Parar o seguimento»). */
  podeParar: boolean;
  /** O passo, em palavras. */
  linha: string;
  /** Os «Falei com o cliente», do mais recente para trás (até 3). */
  contactos: string[];
  /** O que falhou da última vez, se falhou. */
  falha: string | null;
};

/**
 * O SEGUIMENTO DE CADA PEDIDO, para os cartões do «Precisa de si». Só leitura:
 * o cliente que respondeu mostra-se já como parado (a rotina grava-o na
 * passagem seguinte). Os ciclos acabados há mais de 30 dias ficam de fora.
 */
export async function seguimentoNaMesa(): Promise<{ ligado: boolean; pedidos: SeguimentoNaMesa[] }> {
  const { ligado } = await interruptorDoSeguimento();
  const pool = await garantirTabelas();
  const [linhas] = (await pool.query(
    `SELECT * FROM seguimentoDoCliente
      WHERE (${A_CORRER_SQL}) OR marcadoEm > UTC_TIMESTAMP() - INTERVAL 30 DAY
      ORDER BY pedidoId DESC LIMIT 300`,
  )) as [Array<Record<string, unknown>>, unknown];
  const ciclos = linhas.map(lerLinha);
  const pedidos = await lerPedidos(pool, ciclos.filter((c) => c.canal === "whatsapp" && seguimentoEmCurso(c)).map((c) => c.pedidoId));
  const { respostasDoClienteNoWhatsApp } = await import("./db");
  const respostas = await respostasDoClienteNoWhatsApp([...pedidos.values()].map((p) => p.contactPhone)).catch(
    () => new Map<string, { ultimaMensagemEm: Date | null }>(),
  );
  return {
    ligado,
    pedidos: ciclos.map((c) => {
      const p = pedidos.get(c.pedidoId);
      const resp = p ? (respostas.get(noveDigitos(p.contactPhone))?.ultimaMensagemEm ?? null) : null;
      const vista =
        seguimentoEmCurso(c) && c.canal === "whatsapp" && clienteRespondeuAoSeguimento(c.marcadoEm, resp)
          ? { ...c, paradoEm: resp, respondeuEm: resp, paradoPorque: "o cliente respondeu" }
          : c;
      return {
        pedidoId: c.pedidoId,
        marcadoEm: c.marcadoEm.toISOString(),
        emCurso: ligado && seguimentoEmCurso(vista),
        podeParar: seguimentoEmCurso(vista),
        linha: linhaDoSeguimentoNaMesa(vista, ligado),
        contactos: [...c.contactos].reverse().slice(0, 3).map(linhaDoContacto),
        falha: seguimentoEmCurso(vista) ? c.ultimaFalha : null,
      };
    }),
  };
}

/**
 * OS PEDIDOS EM SEGUIMENTO ACTIVO — d83 v2, 22-11-2026. A mesma conta do
 * `emCurso` da Mesa (`seguimentoNaMesa`: a correr, com canal, o interruptor
 * ligado e o cliente sem ter escrito depois da marcação), para quem conta o
 * que espera por nós fora do ecrã da Mesa: os avisos à equipa do «Do nosso
 * lado» e o «à espera de si» do Início. Uma falha deixa contar como antes —
 * quem chama apanha-a e passa uma lista vazia.
 */
export async function pedidosEmSeguimentoActivo(): Promise<PedidoEmSeguimento[]> {
  const { pedidos } = await seguimentoNaMesa();
  return pedidos.filter((p) => p.emCurso).map((p) => ({ pedidoId: p.pedidoId, marcadoEm: p.marcadoEm }));
}

/* ── As respostas do cliente (a Vitória, em whatsapp-negociacao.ts) ──────── */

export type SeguimentoQueResponde = {
  pedidoId: number;
  /** O «3» já chegou e a pergunta «Responda CANCELAR» saiu (vale 48 h). */
  aEsperaDeCancelar: boolean;
};

/**
 * OS SEGUIMENTOS DESTE TELEFONE (número inteiro): os que estão a correr — que
 * qualquer mensagem dele pára — e, se a última mensagem que lhe saiu é o
 * seguimento de um deles (ou a pergunta do CANCELAR dele), esse: é a ele que
 * o «1», o «2», o «3» e o CANCELAR respondem. Com o interruptor desligado,
 * nenhum responde (a conversa segue como sempre), mas param na mesma.
 */
export async function seguimentosDoTelefone(telefone: string): Promise<{ aCorrer: number[]; responde: SeguimentoQueResponde | null }> {
  const tel = noveDigitos(telefone);
  if (!tel) return { aCorrer: [], responde: null };
  const pool = await garantirTabelas();
  const [rows] = (await pool.execute(
    `SELECT v.pedidoId, v.canal, (${A_CORRER_SQL.replace(/(\w+Em)/g, "v.$1")}) AS aCorrer,
            (v.cancelarPedidoEm IS NOT NULL AND v.cancelarPedidoEm > UTC_TIMESTAMP() - INTERVAL ${HORAS_PARA_CONFIRMAR_O_CANCELAMENTO} HOUR
             AND v.canceladoEm IS NULL AND v.arquivadoEm IS NULL) AS aEsperaDeCancelar,
            o.contactPhone, o.status
       FROM seguimentoDoCliente v
       JOIN simulatorOrders o ON o.id = v.pedidoId
      WHERE RIGHT(REGEXP_REPLACE(COALESCE(o.contactPhone, ''), '[^0-9]', ''), 9) = ?
      ORDER BY v.pedidoId DESC
      LIMIT 10`,
    [tel],
  )) as [Array<Record<string, unknown>>, unknown];
  const doTelefone = rows.filter((r) => mesmoTelefoneEstrito(String(r.contactPhone ?? ""), telefone) && !pedidoFechado(r.status as string | null));
  const aCorrer = doTelefone.filter((r) => Number(r.aCorrer) === 1 && r.canal === "whatsapp").map((r) => Number(r.pedidoId));
  const candidatos = doTelefone.filter((r) => (Number(r.aCorrer) === 1 && r.canal === "whatsapp") || Number(r.aEsperaDeCancelar) === 1);
  if (candidatos.length === 0 || !(await interruptorDoSeguimento()).ligado) return { aCorrer, responde: null };
  const ultima = await ultimaSaidaParaOTelefone(pool, telefone).catch(() => null);
  for (const r of candidatos) {
    const id = Number(r.pedidoId);
    const aEspera = Number(r.aEsperaDeCancelar) === 1;
    if ((Number(r.aCorrer) === 1 && eMensagemDoSeguimento(ultima, id)) || (aEspera && aUltimaSaidaE(ultima, id) === "confirmacao")) {
      return { aCorrer, responde: { pedidoId: id, aEsperaDeCancelar: aEspera } };
    }
  }
  return { aCorrer, responde: null };
}

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
  const r = rows.find((x) => mesmoTelefoneEstrito(String(x.telefone ?? ""), telefone));
  return r ? String(r.texto ?? "") : null;
}

export type ResultadoDoCancelamentoPeloSeguimento =
  | { ok: true; estado: "pediu_confirmacao" | "a_espera_de_cancelar" | "cancelado" }
  | { ok: false; porque: string };

/**
 * O «3» AO SEGUIMENTO: NÃO cancela (d2). O ciclo pára (o cliente respondeu),
 * marca-se «à espera do CANCELAR» e pergunta-se «Confirma que quer cancelar o
 * pedido #N? Responda CANCELAR.» — pelo caminho comum (d85,
 * `cancelar-pelo-lembrete.ts`).
 */
export async function pedirConfirmacaoDoCancelamentoDoSeguimento(pedidoId: number, telefone: string): Promise<ResultadoDoCancelamentoPeloSeguimento> {
  const pool = await garantirTabelas();
  const { FONTES_DO_CANCELAMENTO, perguntarSeCancela } = await import("./cancelar-pelo-lembrete");
  const r = await perguntarSeCancela(FONTES_DO_CANCELAMENTO.seguimento, pool, pedidoId, telefone);
  return r.ok ? { ok: true, estado: r.estado } : r;
}

/**
 * O CANCELAR, com a pergunta feita e a valer (48 h): cancela pelo caminho
 * comum, manda ao cliente o texto de cancelamento aprovado e marca os dados
 * para a purga 7 dias depois. Um pedido já fechado não se cancela por aqui.
 */
export async function confirmarCancelamentoPeloSeguimento(
  pedidoId: number,
  telefone: string,
  texto: string,
): Promise<ResultadoDoCancelamentoPeloSeguimento> {
  if (!eConfirmacaoDoCancelamento(texto)) return { ok: false, porque: "a resposta não é o CANCELAR" };
  const pool = await garantirTabelas();
  const { FONTES_DO_CANCELAMENTO, cancelarPeloLembreteComum } = await import("./cancelar-pelo-lembrete");
  const r = await cancelarPeloLembreteComum(FONTES_DO_CANCELAMENTO.seguimento, pool, pedidoId, telefone, {
    verificar: async () => {
      const p = (await lerPedidos(pool, [pedidoId])).get(pedidoId);
      if (!p || pedidoFechado(p.status) || p.anonimizado) return { porque: "o pedido já estava fechado" };
      return { eClyon: p.eClyon, servico: p.serviceType, localidade: p.city };
    },
  });
  return r.ok ? { ok: true, estado: "cancelado" } : r;
}
