import { after } from "next/server";
import {
  appendOrderHistory,
  ensureNegociacoesTable,
  ensureRegistoTable,
  ensureSimulatorOrdersTable,
  getPool,
  getSimulatorOrderById,
  negociacoesDoPedido,
  registarNaTransaccao,
  registarSemFalhar,
} from "./db";
import {
  faseDoFecho,
  OBRIGADO_DO_NAO,
  OBRIGADO_DO_SIM,
  perguntaAoClienteAgora,
  perguntaDoFechoParaOCliente,
  type PerguntaDoFecho,
  type TrabalhoParaOFecho,
} from "./fecho-do-modelo-novo";
import { novoModeloEmVigor } from "./novo-modelo";
import { agoraDoModelo } from "./relogio-do-modelo";
import { pedidoFechado } from "./pedido-arrumado";
import { gerarTokenDeAcesso, hashDeToken, verificarTokenDeAcesso } from "./pedido-acesso";
import { emHorarioDaEquipa } from "./avisos-a-equipa";
import type { RespostaDaRota } from "./responder-ajuste";

/**
 * O FECHO DO MODELO NOVO, NA BASE — d15 (13-11-2026). As regras estão em
 * `fecho-do-modelo-novo.ts`; aqui vivem as leituras (todos os contratados, não
 * só os 60 da Mesa), o «Sim» do cliente numa transacção, o interruptor do email
 * (desligado por omissão) e a rotina que o envia.
 *
 * Antes de 15-11 (`novoModeloEmVigor`) nada daqui vai à base: devolve vazio.
 */

type Linha = Record<string, unknown>;

/* ── As leituras ─────────────────────────────────────────────────────────── */

/**
 * OS CONTRATADOS SEM «ESTÁ FEITO» COM A DATA PASSADA HÁ MAIS DE 24 H — e, de
 * cada um, se segue o modelo novo (os pagamentos lidos, como em
 * `segueONovoModelo`). Só os do modelo novo saem daqui.
 */
export async function trabalhosSemFechoNaBase(agora: Date = agoraDoModelo()): Promise<TrabalhoParaOFecho[]> {
  if (!novoModeloEmVigor(agora)) return [];
  await ensureNegociacoesTable();
  await ensureSimulatorOrdersTable();
  const pool = await getPool();
  if (!pool) return [];
  const limite = new Date(agora.getTime() - 24 * 3600 * 1000);
  const [linhas] = (await pool.execute(
    `SELECT n.id AS negociacaoId, n.pedidoId, n.estado, n.dataCombinada, o.dataAgendada,
            n.execucaoEnviadaEm, n.confirmadoEm, n.provaJson, n.pagoEm, n.ofertaClyon,
            n.fechoNaoEm, o.status AS estadoDoPedido
       FROM negociacoes n
       JOIN simulatorOrders o ON o.id = n.pedidoId
      WHERE n.estado = 'acordada'
        AND n.execucaoEnviadaEm IS NULL AND n.confirmadoEm IS NULL
        AND (o.status IS NULL OR o.status NOT IN ('cancelado', 'arquivado', 'concluido', 'rejeitado'))
        AND COALESCE(n.dataCombinada, o.dataAgendada) IS NOT NULL
        AND COALESCE(n.dataCombinada, o.dataAgendada) < ?
      ORDER BY n.pedidoId DESC
      LIMIT 300`,
    [limite],
  )) as [Linha[], unknown];
  const { segueONovoModelo } = await import("./novo-modelo-no-servidor");
  const saida: TrabalhoParaOFecho[] = [];
  for (const l of linhas) {
    const negociacaoId = Number(l.negociacaoId);
    let noNovoModelo = false;
    try {
      noNovoModelo = await segueONovoModelo(
        {
          id: negociacaoId,
          ofertaClyon: l.ofertaClyon,
          estado: l.estado,
          execucaoEnviadaEm: l.execucaoEnviadaEm,
          provaJson: l.provaJson,
          confirmadoEm: l.confirmadoEm,
          pagoEm: l.pagoEm,
        },
        agora,
      );
    } catch (e) {
      console.error("[fecho-do-modelo-novo] não li o modelo de", negociacaoId, e instanceof Error ? e.message : e);
      continue;
    }
    if (!noNovoModelo) continue;
    saida.push({
      pedidoId: Number(l.pedidoId),
      negociacaoId,
      estado: String(l.estado),
      dataCombinada: (l.dataCombinada as Date | null) ?? null,
      dataAgendada: (l.dataAgendada as Date | null) ?? null,
      execucaoEnviadaEm: (l.execucaoEnviadaEm as Date | null) ?? null,
      confirmadoEm: (l.confirmadoEm as Date | null) ?? null,
      estadoDoPedido: l.estadoDoPedido == null ? null : String(l.estadoDoPedido),
      respondeuNaoEm: (l.fechoNaoEm as Date | null) ?? null,
      noNovoModelo: true,
    });
  }
  return saida;
}

/** Os mesmos, por JSON, para o cartão da Mesa (as datas em ISO). */
export async function trabalhosSemFechoParaAMesa(agora: Date = agoraDoModelo()) {
  const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));
  return (await trabalhosSemFechoNaBase(agora)).map((t) => ({
    ...t,
    dataCombinada: iso(t.dataCombinada),
    dataAgendada: iso(t.dataAgendada),
    execucaoEnviadaEm: iso(t.execucaoEnviadaEm),
    confirmadoEm: iso(t.confirmadoEm),
    respondeuNaoEm: iso(t.respondeuNaoEm),
  }));
}

/**
 * O TRABALHO DE UMA NEGOCIAÇÃO, PARA O FECHO — relido da base na hora de
 * responder (nunca o que o ecrã diz), com o modelo pelos pagamentos.
 */
async function trabalhoParaOFecho(
  negociacaoId: number,
  pedidoId: number,
  agora: Date,
): Promise<{ t: TrabalhoParaOFecho; nome: string | null } | null> {
  const pedido = await getSimulatorOrderById(pedidoId);
  if (!pedido) return null;
  const n = (await negociacoesDoPedido(pedidoId)).find((x) => Number(x.id) === negociacaoId) as
    | (Linha & { id: number })
    | undefined;
  if (!n) return null;
  const { segueONovoModelo } = await import("./novo-modelo-no-servidor");
  const noNovoModelo = await segueONovoModelo(n as Parameters<typeof segueONovoModelo>[0], agora);
  return {
    t: {
      pedidoId,
      negociacaoId,
      estado: String(n.estado),
      dataCombinada: (n.dataCombinada as Date | string | null) ?? null,
      dataAgendada: ((pedido as { dataAgendada?: Date | string | null }).dataAgendada as Date | string | null) ?? null,
      execucaoEnviadaEm: (n.execucaoEnviadaEm as Date | string | null) ?? null,
      confirmadoEm: (n.confirmadoEm as Date | string | null) ?? null,
      estadoDoPedido: pedido.status ?? null,
      respondeuNaoEm: (n.fechoNaoEm as Date | string | null) ?? null,
      noNovoModelo,
    },
    nome: n.profissionalNome == null ? null : String(n.profissionalNome),
  };
}

/**
 * A PERGUNTA PARA OS ECRÃS DO CLIENTE — confere o modelo pelos pagamentos (o
 * que a vista sozinha não sabe) e só então a devolve. Antes de 15-11, `null`
 * sem ir à base.
 */
export async function perguntaDoFechoNaBase(
  candidata: { negociacaoId: number; pedidoId: number },
  agora: Date = agoraDoModelo(),
): Promise<PerguntaDoFecho | null> {
  if (!novoModeloEmVigor(agora)) return null;
  try {
    const lido = await trabalhoParaOFecho(candidata.negociacaoId, candidata.pedidoId, agora);
    if (!lido) return null;
    return perguntaDoFechoParaOCliente(lido.t, lido.nome, agora);
  } catch (e) {
    console.error("[fecho-do-modelo-novo] a pergunta não se leu:", e instanceof Error ? e.message : e);
    return null;
  }
}

/* ── O «Sim» — numa transacção ───────────────────────────────────────────── */

/**
 * O CLIENTE DIZ QUE ESTÁ FEITO, SEM O «ESTÁ FEITO» DO PARCEIRO — as duas
 * escritas do caminho da equipa (`darPorEntreguePelaClyon` + `confirmarExecucao`,
 * com as mesmas guardas de estado, d27), mas numa SÓ transacção, com o pedido
 * preso: ou fica entregue E confirmado, ou nada fica. Um pedido fechado
 * (cancelado, arquivado, concluído) não se mexe. O MySQL conta linhas MUDADAS:
 * cada UPDATE que não mudou nada desfaz tudo.
 */
export async function fecharPeloClienteSemEstaFeito(
  negociacaoId: number,
  pedidoId: number,
  onde: string,
): Promise<boolean> {
  await ensureNegociacoesTable();
  await ensureSimulatorOrdersTable();
  await ensureRegistoTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [p] = (await conn.execute("SELECT status FROM simulatorOrders WHERE id = ? LIMIT 1 FOR UPDATE", [
      pedidoId,
    ])) as [Array<{ status: string | null }>, unknown];
    if (!p[0] || pedidoFechado(p[0].status)) {
      await conn.rollback();
      return false;
    }
    const [entregue] = (await conn.execute(
      `UPDATE negociacoes SET execucaoEnviadaEm = NOW()
        WHERE id = ? AND pedidoId = ? AND estado = 'acordada'
          AND execucaoEnviadaEm IS NULL AND confirmadoEm IS NULL`,
      [negociacaoId, pedidoId],
    )) as [{ affectedRows?: number }, unknown];
    if (Number(entregue?.affectedRows ?? 0) === 0) {
      await conn.rollback();
      return false;
    }
    const [confirmado] = (await conn.execute(
      `UPDATE negociacoes SET confirmadoEm = NOW(), confirmadoPor = 'cliente', fechoNaoEm = NULL
        WHERE id = ? AND pedidoId = ? AND estado = 'acordada'
          AND execucaoEnviadaEm IS NOT NULL AND confirmadoEm IS NULL
          AND (horasMarcadasEm IS NULL OR horasConfirmadasEm IS NOT NULL)`,
      [negociacaoId, pedidoId],
    )) as [{ affectedRows?: number }, unknown];
    if (Number(confirmado?.affectedRows ?? 0) === 0) {
      await conn.rollback();
      return false;
    }
    await conn.execute(
      `UPDATE simulatorOrders SET concluidoEm = IF(status = 'concluido', concluidoEm, NOW()), status = 'concluido', updatedAt = NOW()
        WHERE id = ? AND status NOT IN ('cancelado', 'arquivado')`,
      [pedidoId],
    );
    await registarNaTransaccao(conn, {
      acontecimento: "execucao_confirmada",
      pedidoId,
      negociacaoId,
      autorTipo: "cliente",
      estadoAntes: "acordada",
      estadoDepois: "confirmado",
      resumo: `O cliente respondeu «Sim» a «O trabalho já foi feito?» (${onde}), sem o «Está feito» do parceiro (d15).`,
    });
    await conn.commit();
    return true;
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

/** «Ainda não»: fica escrito quando, e a pergunta volta passado o prazo. */
async function gravarONao(negociacaoId: number, pedidoId: number): Promise<boolean> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const [r] = (await pool.execute(
    `UPDATE negociacoes SET fechoNaoEm = NOW()
      WHERE id = ? AND pedidoId = ? AND estado = 'acordada' AND execucaoEnviadaEm IS NULL AND confirmadoEm IS NULL`,
    [negociacaoId, pedidoId],
  )) as [{ affectedRows?: number }, unknown];
  return Number(r?.affectedRows ?? 0) > 0;
}

export const A_PERGUNTA_JA_NAO_SE_POE = "Este trabalho já não está à espera desta resposta.";

/**
 * A RESPOSTA DO CLIENTE — pelas três portas do cliente (`agirComoCliente`) e
 * pelo link do email. Quem chama já provou que o pedido é dele. Relê tudo da
 * base; só na fase «pergunta» (48 h, modelo novo, sem «Está feito»).
 *
 * O «Sim» fecha pela transacção de cima, e a seguir corre o mesmo aviso de
 * qualquer confirmação (`avisarProfissionalTrabalhoConfirmado`), que é onde
 * nasce a cobrança da taxa (a referência do valor em atraso).
 */
export async function responderAoFecho(a: {
  negociacaoId: number;
  pedidoId: number;
  resposta: "sim" | "nao";
  onde: string;
  agora?: Date;
}): Promise<RespostaDaRota> {
  const agora = a.agora ?? agoraDoModelo();
  if (!novoModeloEmVigor(agora)) return { status: 409, corpo: { ok: false, error: A_PERGUNTA_JA_NAO_SE_POE } };
  const lido = await trabalhoParaOFecho(a.negociacaoId, a.pedidoId, agora);
  if (!lido || faseDoFecho(lido.t, agora) !== "pergunta") {
    return { status: 409, corpo: { ok: false, error: A_PERGUNTA_JA_NAO_SE_POE } };
  }

  if (a.resposta === "nao") {
    if (!perguntaAoClienteAgora(lido.t, agora)) return { status: 200, corpo: { ok: true, fecho: "nao", mensagem: OBRIGADO_DO_NAO } };
    const gravou = await gravarONao(a.negociacaoId, a.pedidoId);
    if (!gravou) return { status: 409, corpo: { ok: false, error: A_PERGUNTA_JA_NAO_SE_POE } };
    await appendOrderHistory(a.pedidoId, {
      type: "created",
      by: null,
      message: `Cliente respondeu «Ainda não» a «O trabalho já foi feito?» (${a.onde}) — negociação #${a.negociacaoId}.`,
    });
    await registarSemFalhar({
      acontecimento: "fecho_respondido",
      pedidoId: a.pedidoId,
      negociacaoId: a.negociacaoId,
      autorTipo: "cliente",
      resumo: `O cliente respondeu «Ainda não» a «O trabalho já foi feito?» (${a.onde}).`,
    });
    return { status: 200, corpo: { ok: true, fecho: "nao", mensagem: OBRIGADO_DO_NAO } };
  }

  const gravou = await fecharPeloClienteSemEstaFeito(a.negociacaoId, a.pedidoId, a.onde);
  if (!gravou) {
    return {
      status: 409,
      corpo: {
        ok: false,
        error: "Não foi possível fechar o trabalho agora. Se é um trabalho por hora, confirme primeiro as horas.",
      },
    };
  }
  await appendOrderHistory(a.pedidoId, {
    type: "created",
    by: null,
    message: `Cliente respondeu «Sim» a «O trabalho já foi feito?» (${a.onde}) — negociação #${a.negociacaoId} fechada sem o «Está feito» do parceiro.`,
  });
  // A consequência, não a condição: o aviso ao parceiro e a referência da taxa (como em qualquer confirmação).
  after(async () => {
    const { avisarProfissionalTrabalhoConfirmado } = await import("./avisar-confirmacao");
    await avisarProfissionalTrabalhoConfirmado({ pedidoId: a.pedidoId, negociacaoId: a.negociacaoId });
  });
  return { status: 200, corpo: { ok: true, confirmado: true, fecho: "sim", mensagem: OBRIGADO_DO_SIM } };
}

/* ── O link do email ─────────────────────────────────────────────────────── */

/** A negociação do link do email — só se o token bater e estiver na validade. */
export async function negociacaoDoLinkDoFecho(
  token: string,
): Promise<{ negociacaoId: number; pedidoId: number; profissionalNome: string | null } | null> {
  if (typeof token !== "string" || token.length === 0 || token.length > 200) return null;
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) return null;
  const [linhas] = (await pool.execute(
    `SELECT n.id, n.pedidoId, n.fechoTokenHash, n.fechoTokenExpiraEm, p.name AS profissionalNome
       FROM negociacoes n LEFT JOIN providers p ON p.id = n.providerId
      WHERE n.fechoTokenHash = ? LIMIT 1`,
    [hashDeToken(token)],
  )) as [Linha[], unknown];
  const l = linhas[0];
  if (!l) return null;
  const r = verificarTokenDeAcesso(
    token,
    (l.fechoTokenHash as string | null) ?? null,
    (l.fechoTokenExpiraEm as Date | string | null) ?? null,
  );
  if (!r.valido) return null;
  return {
    negociacaoId: Number(l.id),
    pedidoId: Number(l.pedidoId),
    profissionalNome: l.profissionalNome == null ? null : String(l.profissionalNome),
  };
}

/* ── O interruptor do email (Configs) — DESLIGADO por omissão ───────────── */

/*
 * Na mesma tabela dos interruptores da retenção (`retencaoInterruptores`), com
 * outra chave. DESLIGADO NA DÚVIDA: sem linha, sem tabela, ou com a base a
 * falhar, o email não sai. Liga-o o administrador, escrevendo LIGAR, e só
 * quando o dono o confirmar; a mudança fica no registo permanente na mesma
 * transacção. Mesmo ligado, nada sai antes de 15-11 (`novoModeloEmVigor`).
 */
export const CHAVE_DO_EMAIL_DO_FECHO = "fecho_email_d15";

export type InterruptorDoEmailDoFecho = { ligado: boolean; mudadoEm: string | null; porQuem: string | null };

async function tabelaDosInterruptores() {
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS retencaoInterruptores (
      chave     VARCHAR(40) NOT NULL PRIMARY KEY,
      ligado    TINYINT(1) NOT NULL DEFAULT 0,
      mudadoEm  DATETIME NULL DEFAULT NULL,
      porQuem   VARCHAR(120) NULL DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  return pool;
}

export async function interruptorDoEmailDoFecho(): Promise<InterruptorDoEmailDoFecho> {
  const desligado: InterruptorDoEmailDoFecho = { ligado: false, mudadoEm: null, porQuem: null };
  try {
    const pool = await tabelaDosInterruptores();
    const [rows] = (await pool.execute(
      "SELECT ligado, mudadoEm, porQuem FROM retencaoInterruptores WHERE chave = ? LIMIT 1",
      [CHAVE_DO_EMAIL_DO_FECHO],
    )) as [Array<{ ligado: number; mudadoEm: Date | string | null; porQuem: string | null }>, unknown];
    const l = rows[0];
    if (!l) return desligado;
    return {
      ligado: Number(l.ligado) === 1,
      mudadoEm: l.mudadoEm ? new Date(l.mudadoEm).toISOString() : null,
      porQuem: l.porQuem ?? null,
    };
  } catch (e) {
    console.error("[fecho-do-modelo-novo] não li o interruptor do email — fica desligado:", e instanceof Error ? e.message : e);
    return desligado;
  }
}

export async function mudarInterruptorDoEmailDoFecho(ligar: boolean, porQuem: string): Promise<InterruptorDoEmailDoFecho> {
  const pool = await tabelaDosInterruptores();
  await ensureRegistoTable();
  const antes = await interruptorDoEmailDoFecho();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO retencaoInterruptores (chave, ligado, mudadoEm, porQuem) VALUES (?, ?, NOW(), ?)
       ON DUPLICATE KEY UPDATE ligado = VALUES(ligado), mudadoEm = VALUES(mudadoEm), porQuem = VALUES(porQuem)`,
      [CHAVE_DO_EMAIL_DO_FECHO, ligar ? 1 : 0, porQuem.slice(0, 120)],
    );
    await registarNaTransaccao(conn, {
      acontecimento: "fecho_interruptor",
      autorTipo: "clyon",
      autorNome: porQuem,
      estadoAntes: antes.ligado ? "ligado" : "desligado",
      estadoDepois: ligar ? "ligado" : "desligado",
      resumo: ligar
        ? `Email «O trabalho já foi feito?» LIGADO por ${porQuem} (d15).`
        : `Email «O trabalho já foi feito?» DESLIGADO por ${porQuem} (d15).`,
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
  return interruptorDoEmailDoFecho();
}

/* ── A rotina do email ───────────────────────────────────────────────────── */

/** Quantos emails por passagem, no máximo. */
export const EMAILS_DO_FECHO_POR_PASSAGEM = 20;

export type ResultadoDoFecho = {
  antesDaData: boolean;
  emailLigado: boolean;
  emHorario: boolean;
  /** Na fase «pergunta» agora. */
  porPerguntar: number;
  enviados: number[];
  semEmail: number[];
  falhas: string[];
};

/**
 * DE HORA A HORA: os trabalhos na fase «pergunta» ainda sem email recebem UM
 * email com o link de um toque. Só com o interruptor ligado, só depois de
 * 15-11, só das 08h às 21h de Lisboa. Desligado, conta e não envia nada.
 */
export async function correrOFechoDoModeloNovo(agora: Date = agoraDoModelo()): Promise<ResultadoDoFecho> {
  const r: ResultadoDoFecho = {
    antesDaData: !novoModeloEmVigor(agora),
    emailLigado: false,
    emHorario: emHorarioDaEquipa(agora),
    porPerguntar: 0,
    enviados: [],
    semEmail: [],
    falhas: [],
  };
  if (r.antesDaData) return r;
  const trabalhos = (await trabalhosSemFechoNaBase(agora)).filter((t) => perguntaAoClienteAgora(t, agora));
  r.porPerguntar = trabalhos.length;
  r.emailLigado = (await interruptorDoEmailDoFecho()).ligado;
  if (!r.emailLigado || !r.emHorario || trabalhos.length === 0) return r;

  const pool = await getPool();
  if (!pool) return r;
  const { avisarDaPerguntaDoFecho } = await import("./email-trabalho");
  const { urlDeAccao } = await import("./url-do-site");
  let enviados = 0;
  for (const t of trabalhos) {
    if (enviados >= EMAILS_DO_FECHO_POR_PASSAGEM) break;
    try {
      const [ja] = (await pool.execute("SELECT fechoEmailEm FROM negociacoes WHERE id = ? LIMIT 1", [t.negociacaoId])) as [
        Array<{ fechoEmailEm: Date | null }>,
        unknown,
      ];
      if (ja[0]?.fechoEmailEm != null) continue;
      const pedido = await getSimulatorOrderById(t.pedidoId);
      const para = String(pedido?.contactEmail ?? "").trim();
      if (!pedido || !para.includes("@")) {
        r.semEmail.push(t.pedidoId);
        continue;
      }
      const lido = await trabalhoParaOFecho(t.negociacaoId, t.pedidoId, agora);
      if (!lido || !perguntaAoClienteAgora(lido.t, agora)) continue;
      const novo = gerarTokenDeAcesso(agora);
      const [guardou] = (await pool.execute(
        "UPDATE negociacoes SET fechoTokenHash = ?, fechoTokenExpiraEm = ? WHERE id = ? AND fechoEmailEm IS NULL",
        [novo.hash, novo.expiraEm, t.negociacaoId],
      )) as [{ affectedRows?: number }, unknown];
      if (Number(guardou?.affectedRows ?? 0) === 0) continue;
      const ok = await avisarDaPerguntaDoFecho({
        para,
        nomeDoCliente: (pedido.contactName as string | null) ?? null,
        nomeDoParceiro: lido.nome,
        pedidoId: t.pedidoId,
        link: `${urlDeAccao()}/pedido/fecho/${novo.token}`,
      });
      if (!ok) {
        r.falhas.push(`#${t.pedidoId}: o email não saiu`);
        continue;
      }
      await pool.execute("UPDATE negociacoes SET fechoEmailEm = NOW() WHERE id = ?", [t.negociacaoId]);
      enviados++;
      r.enviados.push(t.pedidoId);
      await appendOrderHistory(t.pedidoId, {
        type: "created",
        by: null,
        message: `Email «O trabalho já foi feito?» enviado ao cliente — negociação #${t.negociacaoId}.`,
      });
    } catch (e) {
      r.falhas.push(`#${t.pedidoId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return r;
}

export function resumoDoFecho(r: ResultadoDoFecho): string {
  if (r.antesDaData) return "Antes de 15-11: nada a fazer.";
  const base = `${r.porPerguntar} trabalho(s) à espera da pergunta ao cliente`;
  if (!r.emailLigado) return `${base}; o email está desligado nas Configs.`;
  if (!r.emHorario) return `${base}; fora de horas, nenhum email.`;
  return `${base}; ${r.enviados.length} email(s) enviado(s)${r.semEmail.length ? `, ${r.semEmail.length} sem email` : ""}${
    r.falhas.length ? `, ${r.falhas.length} falha(s)` : ""
  }.`;
}
