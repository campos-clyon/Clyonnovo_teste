import {
  appendOrderHistory,
  assistentePode,
  ensureNegociacoesTable,
  ensureProvidersSchema,
  ensureSimulatorOrdersTable,
  getPool,
  registarSemFalhar,
} from "./db";
import { pedidoArrumado } from "./pedido-arrumado";
import {
  avisoATirada,
  diaJaPassou,
  historicoDeTirar,
  porQueNaoSeTira,
  quemVoltaAsPropostas,
  type OndeEsta,
} from "./tirar-a-empresa";

/**
 * TIRAR A EMPRESA, NA BASE — d137 (26-11-2026). As regras e as frases estão em
 * `tirar-a-empresa.ts`. Por esta ordem:
 *
 *   1. as guardas: o pedido vivo, uma negociação atribuída (acordada), nada
 *      feito nem pago por ela, e o dinheiro do pedido limpo (d94);
 *   2. numa transacção, com as trancas de sempre (o pedido, depois as
 *      negociações): a dela passa a «morta» com `retiradaEm`; na Mesa, as
 *      propostas de quem ficou de fora quando ela foi contratada reabrem;
 *   3. a marca «falta o sim» da d130, se houver, sai;
 *   4. ela é avisada (WhatsApp e app), e o histórico diz quem carregou e porquê.
 *
 * Não reenvia nada a ninguém: o caminho a seguir escolhe-o a pessoa.
 */

export type ResultadoDeTirar =
  | {
      ok: true;
      onde: OndeEsta;
      empresa: string;
      providerId: number;
      negociacaoId: number;
      avisado: boolean;
      reabertas: number;
      /** O dia do pedido (ou o combinado com ela) já passou — o ecrã abre o Editar no dia. */
      diaPassou: boolean;
      feito: string;
    }
  | { ok: false; erro: string; estado: number };

type Quem = { quem: string; por: { id: number; nome: string; role: string } | null };

export async function tirarAEmpresaDoTrabalho(
  pedidoId: number,
  motivo: string | null,
  q: Quem,
  agora: Date = new Date(),
): Promise<ResultadoDeTirar> {
  await ensureSimulatorOrdersTable();
  await ensureNegociacoesTable();
  await ensureProvidersSchema();
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");

  // O dinheiro do pedido (d94), lido antes da transacção: são várias tabelas.
  const { oQuePrendeOPedidoNaBase } = await import("./fim-do-pedido-na-base");
  const razoesDoDinheiro = await oQuePrendeOPedidoNaBase(pedidoId);

  type Linha = {
    id: number;
    providerId: number;
    estado: string;
    estadoAntesDeCancelar: string | null;
    retiradaEm: Date | null;
    propostasJson: string | null;
    execucaoEnviadaEm: Date | null;
    confirmadoEm: Date | null;
    pagoEm: Date | null;
    clienteDisseQuePagouEm: Date | null;
    parceiroConfirmouEm: Date | null;
    dataCombinada: Date | null;
    profissional: string | null;
    telefone: string | null;
  };

  let onde: OndeEsta = "clyon";
  let atribuida: Linha | null = null;
  let reabertas = 0;
  let dia: Date | null = null;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [pedidos] = (await conn.execute(
      "SELECT id, status, valorFixoClyon, dataAgendada FROM simulatorOrders WHERE id = ? LIMIT 1 FOR UPDATE",
      [pedidoId],
    )) as [Array<{ status: string | null; valorFixoClyon: string | null; dataAgendada: Date | null }>, unknown];
    const p = pedidos[0];
    const desistir = async (erro: string, estado: number): Promise<ResultadoDeTirar> => {
      await conn.rollback();
      return { ok: false, erro, estado };
    };
    if (!p) return await desistir("Pedido não encontrado.", 404);
    if (pedidoArrumado(p.status) || p.status === "concluido") {
      return await desistir("Este pedido está fechado (concluído, cancelado ou arquivado) — restaure-o primeiro.", 409);
    }
    onde = p.valorFixoClyon != null ? "clyon" : "mesa";
    const [negs] = (await conn.execute(
      `SELECT n.id, n.providerId, n.estado, n.estadoAntesDeCancelar, n.retiradaEm, n.propostasJson,
              n.execucaoEnviadaEm, n.confirmadoEm, n.pagoEm, n.clienteDisseQuePagouEm, n.parceiroConfirmouEm,
              n.dataCombinada, pr.name AS profissional, pr.phone AS telefone
         FROM negociacoes n
         JOIN providers pr ON pr.id = n.providerId
        WHERE n.pedidoId = ?
        FOR UPDATE`,
      [pedidoId],
    )) as [Linha[], unknown];
    const acordadas = negs.filter((n) => n.estado === "acordada");
    if (acordadas.length !== 1) {
      return await desistir(
        onde === "clyon"
          ? "Este trabalho não está atribuído a ninguém — use «Voltar a oferecer» ou «Passar a negociação»."
          : "Este pedido não tem contratado.",
        409,
      );
    }
    atribuida = acordadas[0];
    const recusa = porQueNaoSeTira(
      {
        execucaoEnviadaEm: atribuida.execucaoEnviadaEm,
        confirmadoEm: atribuida.confirmadoEm,
        pagoEm: atribuida.pagoEm,
        // No modelo de 15-11 o cliente paga ao parceiro: o «já paguei» e o «recebi» também são dinheiro.
        clientePagouEm: atribuida.clienteDisseQuePagouEm ?? atribuida.parceiroConfirmouEm,
      },
      razoesDoDinheiro,
    );
    if (recusa) return await desistir(recusa, 409);

    await conn.execute(
      "UPDATE negociacoes SET estado = 'morta', retiradaEm = NOW(), updatedAt = NOW() WHERE id = ? AND estado = 'acordada'",
      [atribuida.id],
    );
    if (onde === "mesa") {
      const voltam = quemVoltaAsPropostas(negs, Number(atribuida.id)).map((n) => Number(n.id));
      for (const id of voltam) {
        const [r] = (await conn.execute(
          "UPDATE negociacoes SET estado = 'aberta', valorAcordado = NULL, updatedAt = NOW() WHERE id = ? AND estado = 'morta'",
          [id],
        )) as [{ affectedRows?: number }, unknown];
        reabertas += Number(r?.affectedRows ?? 0);
      }
    }
    dia = atribuida.dataCombinada ?? p.dataAgendada ?? null;
    await conn.commit();
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    conn.release();
  }

  // A marca «falta o sim» (d130) era desta atribuição.
  let reservaSaiu = false;
  try {
    const { tirarReservaSemAvisar } = await import("./sim-do-cliente-na-base");
    reservaSaiu = (await tirarReservaSemAvisar(pedidoId)) != null;
  } catch (e) {
    console.error("[tirar a empresa] a reserva:", e instanceof Error ? e.message : e);
  }

  const empresa = String(atribuida.profissional ?? "").trim() || `o parceiro #${atribuida.providerId}`;
  const negociacaoId = Number(atribuida.id);
  const providerId = Number(atribuida.providerId);

  // Ela tinha o trabalho: é avisada, mesmo sem os avisos de pedidos novos ligados.
  const aviso = avisoATirada(pedidoId);
  let avisado = false;
  try {
    const { enviarAvisoWhatsApp, telemovelParaWhatsApp } = await import("./whatsapp-cloud");
    const telefone = telemovelParaWhatsApp(atribuida.telefone ?? null);
    if (telefone && (await assistentePode("avisar_profissional").catch(() => false))) {
      avisado = await enviarAvisoWhatsApp(telefone, aviso.whatsapp).catch(() => false);
    }
  } catch (e) {
    console.error("[tirar a empresa] o WhatsApp:", e instanceof Error ? e.message : e);
  }
  try {
    const { avisarProfissional } = await import("./avisos-do-backoffice");
    await avisarProfissional(providerId, "trabalho_retirado", { pedidoId, negociacaoId });
  } catch (e) {
    console.error("[tirar a empresa] a app:", e instanceof Error ? e.message : e);
  }

  const resumo = historicoDeTirar({ empresa, quem: q.quem, motivo, onde, avisado, reabertas, reservaSaiu });
  await appendOrderHistory(pedidoId, { type: "note", by: q.por, message: resumo }).catch(() => {});
  await registarSemFalhar({
    acontecimento: "profissional_retirado",
    pedidoId,
    negociacaoId,
    providerId,
    autorTipo: q.por?.role === "assistente" ? "assistente" : "clyon",
    autorNome: q.quem,
    resumo,
  });

  return {
    ok: true,
    onde,
    empresa,
    providerId,
    negociacaoId,
    avisado,
    reabertas,
    diaPassou: diaJaPassou(dia, agora),
    feito: `#${pedidoId}: ${resumo.replace(/ \(d137\)$/, "")}`,
  };
}

/** O pedido tem uma empresa tirada (d137) — para o «Voltar a oferecer a todos» distribuir quando não há outros. */
export async function temEmpresaTirada(pedidoId: number): Promise<boolean> {
  await ensureNegociacoesTable();
  const pool = await getPool();
  if (!pool) return false;
  const [l] = (await pool.execute(
    "SELECT 1 AS sim FROM negociacoes WHERE pedidoId = ? AND retiradaEm IS NOT NULL LIMIT 1",
    [pedidoId],
  )) as [Array<{ sim: number }>, unknown];
  return l.length > 0;
}
