import {
  ensureNegociacoesTable,
  fecharNegociacoesDeUmPedidoArrumado,
  getPool,
  matarNegociacoesDoPedido,
  perfilDoProfissional,
} from "./db";
import {
  avisoDoFimNoTelemovel,
  motivoLimpo,
  oQuePrendeOPedido,
  quemSabeDoFim,
  SEM_DINHEIRO,
  textoDoFim,
  type AvisoDoFimNoServidor,
  type DinheiroDoPedido,
  type FimDoPedido,
  type NegociacaoDoFim,
  type QuemSabeDoFim,
} from "./fim-do-pedido";

/**
 * O FIM DE UM PEDIDO, NA BASE — d94 (dono, 23-11-2026).
 *
 * UMA SÓ FUNÇÃO, `fimDoPedido`, por onde passam todos os caminhos que
 * cancelam, arquivam ou apagam um pedido:
 *
 *   · `cancelarPedido` (o «Cancelar» da Mesa e dos Trabalhos CLYON, o CANCELAR
 *     do cliente na app e pelos lembretes, o seguimento da d83);
 *   · `updateSimulatorOrder` quando o estado passa a cancelado, arquivado ou
 *     rejeitado (o «Arquivar», o «Rejeitar», o estado mudado na ficha, as
 *     rotinas da validade d62, do seguimento d83 e dos Trabalhos CLYON sem
 *     resposta);
 *   · `cancelarOrcamentoPeloCliente` (o link do orçamento);
 *   · `deleteSimulatorOrder` (o «Apagar» e a purga).
 *
 * O que faz, por esta ordem:
 *
 *   1. lê as negociações ANTES de fechar (depois estão todas «morta» e já não
 *      se sabe quem tinha o pedido);
 *   2. fecha as vivas — o cancelamento da Mesa mata-as todas, com memória do
 *      estado para o «Desfazer»; o arquivo e o estado mudado na ficha só as
 *      que ainda estavam por fazer (o que já foi feito é dinheiro dele);
 *   3. deixa a cada profissional envolvido UMA notificação («Pedido #N
 *      cancelado — motivo»), que o sino da app e do painel mostram, e manda-a
 *      ao telemóvel uma vez só.
 *
 * Fechar pode lançar (como lançava antes: quem chama trata). As notificações
 * nunca lançam — o fim do pedido já está gravado quando correm.
 */

let tabelaPronta = false;

export async function garantirTabelaDosAvisosDoFim(): Promise<void> {
  if (tabelaPronta) return;
  const pool = await getPool();
  if (!pool) return;
  /*
   * Sem dados de pessoas: o número do pedido, o do profissional, o motivo que
   * a equipa escreveu e a frase. Um apagado fica aqui depois de o pedido sair
   * — é a única coisa que lhe resta na conta dele.
   */
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS avisosDoFimDoPedido (
      id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      providerId    INT UNSIGNED NOT NULL,
      pedidoId      INT NOT NULL,
      negociacaoId  INT UNSIGNED NULL DEFAULT NULL,
      fim           VARCHAR(12) NOT NULL,
      motivo        VARCHAR(200) NULL DEFAULT NULL,
      texto         VARCHAR(255) NOT NULL,
      criadoEm      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      pushEm        DATETIME NULL DEFAULT NULL,
      UNIQUE KEY uq_um_por_fim (providerId, pedidoId, fim),
      KEY idx_profissional (providerId, criadoEm),
      KEY idx_pedido (pedidoId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tabelaPronta = true;
}

/** As negociações do pedido, com o que decide quem é avisado. */
async function negociacoesParaOFim(pedidoId: number): Promise<NegociacaoDoFim[]> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) return [];
  const [linhas] = (await pool.execute(
    `SELECT id, providerId, estado, propostasJson, execucaoEnviadaEm, confirmadoEm, pagoEm
       FROM negociacoes WHERE pedidoId = ?`,
    [pedidoId],
  )) as [NegociacaoDoFim[], unknown];
  return Array.isArray(linhas) ? linhas : [];
}

export type OpcoesDoFim = {
  fim: FimDoPedido;
  /** O que a equipa (ou a rotina) escreveu. Vai na notificação. */
  motivo?: string | null;
  /**
   * Como se fecham as negociações num cancelamento: «tudo» (o «Cancelar» da
   * Mesa, `cancelarPedido` — absoluto, com memória para o «Desfazer») ou
   * «por_fazer» (o estado mudado na ficha: o que já foi feito fica). O arquivo
   * é sempre «por_fazer»; o apagado não fecha nada (as negociações vão com o
   * pedido).
   */
  como?: "tudo" | "por_fazer";
  /** Lidas antes por quem chama — obrigatórias num apagado (depois do DELETE já não existem). */
  negociacoesAntes?: readonly NegociacaoDoFim[];
  /** Falso só na purga: um pedido terminado há 60 dias não é notícia para ninguém. */
  avisar?: boolean;
  /**
   * O que quem chama grava entre fechar e avisar — o estado do pedido. Assim a
   * notificação só sai com o pedido já «cancelado» na base: quem toca nela vê-o
   * logo nos Cancelados.
   */
  depoisDeFechar?: () => Promise<void>;
};

export async function fimDoPedido(
  pedidoId: number,
  o: OpcoesDoFim,
): Promise<{ encerradas: number; avisados: number }> {
  const antes = o.negociacoesAntes ?? (o.fim === "apagado" ? [] : await negociacoesParaOFim(pedidoId));

  let encerradas = 0;
  if (o.fim === "cancelado" && (o.como ?? "tudo") === "tudo") {
    encerradas = await matarNegociacoesDoPedido(pedidoId, { lembrarOEstado: true });
  } else if (o.fim !== "apagado") {
    encerradas = await fecharNegociacoesDeUmPedidoArrumado(pedidoId);
  }

  if (o.depoisDeFechar) await o.depoisDeFechar();
  // d146b: cancelado, arquivado ou apagado — as perguntas da Vitória aos parceiros fecham logo.
  await import("./vitoria-agente/perguntas-fecham-com-o-pedido").then((m) => m.fecharAsPerguntasDoPedido(pedidoId, "fechado")).catch(() => 0);

  const avisados = o.avisar === false ? 0 : await avisarDoFim(pedidoId, o.fim, o.motivo ?? null, quemSabeDoFim(o.fim, antes));
  return { encerradas, avisados };
}

/**
 * Uma notificação por profissional e por fim — a chave única impede a segunda
 * (dois caminhos a passar pelo mesmo cancelamento, uma rotina repetida). Só a
 * que nasceu agora vai ao telemóvel. Devolve quantas nasceram. Nunca lança.
 */
export async function avisarDoFim(
  pedidoId: number,
  fim: FimDoPedido,
  motivo: string | null,
  quem: readonly QuemSabeDoFim[],
): Promise<number> {
  if (!quem.length) return 0;
  let nasceram = 0;
  try {
    await garantirTabelaDosAvisosDoFim();
    const pool = await getPool();
    if (!pool) return 0;
    const m = motivoLimpo(motivo);
    const texto = textoDoFim(fim, pedidoId, m);
    for (const q of quem) {
      try {
        const [r] = (await pool.execute(
          `INSERT IGNORE INTO avisosDoFimDoPedido (providerId, pedidoId, negociacaoId, fim, motivo, texto)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [q.providerId, pedidoId, fim === "apagado" ? null : q.negociacaoId, fim, m, texto],
        )) as [{ affectedRows?: number; insertId?: number }, unknown];
        if (Number(r?.affectedRows ?? 0) !== 1) continue;
        nasceram += 1;
        if (await mandarAoTelemovel(q, pedidoId, fim, m)) {
          await pool
            .execute("UPDATE avisosDoFimDoPedido SET pushEm = NOW() WHERE id = ?", [Number(r.insertId)])
            .catch(() => {});
        }
      } catch (e) {
        console.error("[fim-do-pedido] notificação não ficou:", pedidoId, q.providerId, e instanceof Error ? e.message : e);
      }
    }
  } catch (e) {
    console.error("[fim-do-pedido] sem notificações:", pedidoId, e instanceof Error ? e.message : e);
  }
  return nasceram;
}

async function mandarAoTelemovel(q: QuemSabeDoFim, pedidoId: number, fim: FimDoPedido, motivo: string | null): Promise<boolean> {
  try {
    const perfil = await perfilDoProfissional(q.providerId);
    const email = typeof perfil?.email === "string" ? perfil.email : null;
    if (!email) return false;
    const [{ sendPushToUser }, { urlDeAccao }] = await Promise.all([import("./webpush"), import("./url-do-site")]);
    const aviso = avisoDoFimNoTelemovel(fim, pedidoId, motivo);
    const chegou = await sendPushToUser(
      email,
      {
        title: aviso.title,
        body: aviso.body,
        url: new URL("/profissionais/painel", urlDeAccao()).toString(),
        tag: `fim-${pedidoId}`,
        // Um apagado não abre nada: o pedido já não existe.
        negociacaoId: fim === "apagado" ? undefined : q.negociacaoId,
      },
      "pro",
    );
    return chegou > 0;
  } catch (e) {
    console.error("[fim-do-pedido] telemóvel:", e instanceof Error ? e.message : e);
    return false;
  }
}

/**
 * JÁ FOI AO TELEMÓVEL? Os avisos antigos das rotinas («Pedido #N fechado»,
 * «Pedido #N cancelado») perguntam isto antes de saírem: o mesmo fim não toca
 * duas vezes. Na dúvida (sem tabela, base em baixo), deixa sair.
 */
export async function fimJaAvisado(pedidoId: number, negociacaoId: number): Promise<boolean> {
  try {
    await garantirTabelaDosAvisosDoFim();
    const pool = await getPool();
    if (!pool) return false;
    const [l] = (await pool.execute(
      `SELECT 1 AS sim FROM avisosDoFimDoPedido
        WHERE pedidoId = ? AND negociacaoId = ? AND criadoEm >= NOW() - INTERVAL 1 DAY LIMIT 1`,
      [pedidoId, negociacaoId],
    )) as [Array<{ sim: number }>, unknown];
    return Array.isArray(l) && l.length > 0;
  } catch {
    return false;
  }
}

/**
 * O PEDIDO VOLTOU (restaurar, desfazer o cancelamento, sair do arquivo): as
 * notificações do fim apagam-se da base, para um fim a seguir voltar a avisar.
 * As de um apagado ficam — esse não volta. Nunca lança.
 */
export async function esquecerFimDoPedido(pedidoId: number): Promise<void> {
  try {
    await garantirTabelaDosAvisosDoFim();
    const pool = await getPool();
    if (!pool) return;
    await pool.execute("DELETE FROM avisosDoFimDoPedido WHERE pedidoId = ? AND fim <> 'apagado'", [pedidoId]);
  } catch (e) {
    console.error("[fim-do-pedido] esquecer:", e instanceof Error ? e.message : e);
  }
}

/** As notificações dele dos últimos 60 dias, a mais recente primeiro (no máximo 30) — para o sino. */
export async function avisosDoFimDoProfissional(providerId: number): Promise<AvisoDoFimNoServidor[]> {
  try {
    await garantirTabelaDosAvisosDoFim();
    const pool = await getPool();
    if (!pool) return [];
    const [linhas] = (await pool.execute(
      `SELECT id, pedidoId, negociacaoId, fim, texto, criadoEm
         FROM avisosDoFimDoPedido
        WHERE providerId = ? AND criadoEm >= NOW() - INTERVAL 60 DAY
        ORDER BY criadoEm DESC, id DESC
        LIMIT 30`,
      [providerId],
    )) as [Array<{ id: number; pedidoId: number; negociacaoId: number | null; fim: string; texto: string; criadoEm: Date | string }>, unknown];
    return (linhas ?? []).map((l) => ({
      id: Number(l.id),
      pedidoId: Number(l.pedidoId),
      negociacaoId: l.negociacaoId != null ? Number(l.negociacaoId) : null,
      fim: (["cancelado", "arquivado", "apagado"].includes(l.fim) ? l.fim : "cancelado") as FimDoPedido,
      texto: String(l.texto),
      em: new Date(l.criadoEm).toISOString(),
    }));
  } catch (e) {
    console.error("[fim-do-pedido] avisos do profissional:", e instanceof Error ? e.message : e);
    return [];
  }
}

/** O motivo do fim de cada pedido dele, para o cartão dos Cancelados e dos Arquivados. */
export async function motivosDoFimDoProfissional(providerId: number, pedidoIds: readonly number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (!pedidoIds.length) return out;
  try {
    await garantirTabelaDosAvisosDoFim();
    const pool = await getPool();
    if (!pool) return out;
    const ids = [...new Set(pedidoIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500);
    if (!ids.length) return out;
    const [linhas] = (await pool.execute(
      `SELECT pedidoId, motivo FROM avisosDoFimDoPedido
        WHERE providerId = ? AND motivo IS NOT NULL AND pedidoId IN (${ids.map(() => "?").join(", ")})
        ORDER BY criadoEm ASC`,
      [providerId, ...ids],
    )) as [Array<{ pedidoId: number; motivo: string }>, unknown];
    for (const l of linhas ?? []) out.set(Number(l.pedidoId), String(l.motivo));
  } catch (e) {
    console.error("[fim-do-pedido] motivos:", e instanceof Error ? e.message : e);
  }
  return out;
}

/**
 * O DINHEIRO DO PEDIDO — o que impede o «Apagar» (d94). Cada leitura à parte:
 * uma tabela que ainda não existe é «nada lá». A base em baixo lança — e então
 * não se apaga (na dúvida, fica).
 */
export async function dinheiroDoPedido(pedidoId: number): Promise<DinheiroDoPedido> {
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const d: DinheiroDoPedido = { ...SEM_DINHEIRO };

  const [negs] = (await pool.execute(
    `SELECT pagoEm, confirmadoEm, clientePagaAClyonEm FROM negociacoes WHERE pedidoId = ?`,
    [pedidoId],
  ).catch(async () =>
    // Sem a coluna do «cliente pagou à CLYON» (base antiga): lê-se o resto.
    pool.execute(`SELECT pagoEm, confirmadoEm, NULL AS clientePagaAClyonEm FROM negociacoes WHERE pedidoId = ?`, [pedidoId]),
  )) as [Array<{ pagoEm: unknown; confirmadoEm: unknown; clientePagaAClyonEm: unknown }>, unknown];
  for (const n of negs ?? []) {
    if (n.pagoEm != null) d.pagoAoProfissional = true;
    if (n.confirmadoEm != null) d.confirmado = true;
    if (n.clientePagaAClyonEm != null) d.clientePagou = true;
  }

  const contar = async (sql: string, args: Array<string | number>): Promise<number> => {
    try {
      const [l] = (await pool.execute(sql, args)) as [Array<{ n: number }>, unknown];
      return Number(l?.[0]?.n ?? 0);
    } catch (e) {
      // Tabela que não existe: não há lá nada. Outro erro: na dúvida, prende.
      const msg = e instanceof Error ? e.message : String(e);
      return /doesn't exist|ER_NO_SUCH_TABLE/i.test(msg) ? 0 : 1;
    }
  };
  d.pagamentos = await contar(
    "SELECT COUNT(*) AS n FROM pagamentos WHERE pedidoId = ? AND estado IN ('pago', 'pendente')",
    [pedidoId],
  );
  d.faturas = await contar("SELECT COUNT(*) AS n FROM faturasDoTrabalho WHERE pedidoId = ?", [pedidoId]);
  d.dividas = await contar("SELECT COUNT(*) AS n FROM cobrancasAoProfissional WHERE pedidoId = ? AND activa = 1", [pedidoId]);
  d.movimentosDaCarteira = await contar("SELECT COUNT(*) AS n FROM movimentosDaCarteira WHERE pedidoId = ?", [pedidoId]);
  d.comprovativos = await contar("SELECT COUNT(*) AS n FROM comprovativosDosPagamentos WHERE pedidoId = ? AND activo = 1", [
    pedidoId,
  ]);
  d.comissoes = await contar(
    `SELECT COUNT(*) AS n FROM comissoesPagas WHERE trabalhosJson REGEXP CONCAT('"pedidoId":', ?, '[,}]')`,
    [String(pedidoId)],
  );
  return d;
}

/** O que prende o pedido, em palavras (vazio = pode apagar-se). */
export async function oQuePrendeOPedidoNaBase(pedidoId: number): Promise<string[]> {
  return oQuePrendeOPedido(await dinheiroDoPedido(pedidoId));
}
