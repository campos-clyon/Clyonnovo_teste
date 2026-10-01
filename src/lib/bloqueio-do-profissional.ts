import { getPool, ensureNegociacoesTable, negociacoesDoProfissional } from "./db";
import { trabalhosDaCarteira } from "./carteira-do-profissional";
import { pagamentosDaNegociacao } from "./pagamentos-na-base";
import {
  bloqueioEmDinheiro,
  explicacaoDoBloqueio,
  type BloqueioEmDinheiro,
  type DividaParaDizer,
} from "./bloqueio-por-divida";

/**
 * O BLOQUEIO DOS TRABALHOS EM DINHEIRO, LIDO DA BASE — 01-10-2026.
 *
 * A regra está em `bloqueio-por-divida.ts` (pura, testada); aqui só se vão
 * buscar os trabalhos como a carteira os lê (`trabalhosDaCarteira`) — a mesma
 * conversão, para o bloqueio e a carteira nunca discordarem sobre se uma
 * dívida está paga.
 */

export type BloqueioDoProfissional = BloqueioEmDinheiro & {
  /** A frase a mostrar-lhe — vazia quando não está bloqueado. */
  explicacao: string;
  /** Cada dívida em atraso, com o pedido e a Multibanco viva. */
  paraDizer: Array<DividaParaDizer & { negociacaoId: number }>;
};

/** O bloqueio de UM profissional, com a explicação pronta. */
export async function bloqueioDoProfissional(
  providerId: number,
  agora: Date = new Date(),
): Promise<BloqueioDoProfissional> {
  const linhas = await negociacoesDoProfissional(providerId);
  const b = bloqueioEmDinheiro(await trabalhosDaCarteira(linhas), agora);
  if (!b.bloqueado) return { ...b, explicacao: "", paraDizer: [] };

  const paraDizer = await Promise.all(
    b.dividas.map(async (d) => {
      const pedidoId = linhas.find((l) => l.id === d.negociacaoId)?.pedidoId ?? null;
      // A referência que ele ainda pode pagar — a mesma escolha da carteira.
      const viva = (await pagamentosDaNegociacao(d.negociacaoId).catch(() => [])).find(
        (p) =>
          p.estado === "pendente" &&
          p.metodo === "multibanco" &&
          p.valor === d.total &&
          p.referencia != null &&
          (!p.expiraEm || new Date(p.expiraEm).getTime() > agora.getTime()),
      );
      return {
        negociacaoId: d.negociacaoId,
        total: d.total,
        pedidoId: pedidoId != null ? Number(pedidoId) : null,
        multibanco: viva ? { entidade: viva.entidade, referencia: viva.referencia } : null,
      };
    }),
  );
  return { ...b, explicacao: explicacaoDoBloqueio(paraDizer), paraDizer };
}

/**
 * QUEM ESTÁ BLOQUEADO NOS TRABALHOS EM DINHEIRO — para a distribuição. Uma
 * consulta para todos, e não uma por profissional: a distribuição avalia
 * dezenas de cada vez.
 *
 * O SQL só pré-filtra (acordadas, em dinheiro); a data de corte do IVA
 * incluído, o prazo e o «já está pago» decidem-se em TypeScript, pelas mesmas
 * funções da carteira — comparar datas no MySQL era abrir a porta aos fusos.
 *
 * Nunca lança: uma distribuição não pode cair porque esta pergunta falhou. Sem
 * resposta, ninguém fica de fora por isto (e a rota da proposta continua a
 * recusar quem estiver bloqueado — é lá que a regra se cumpre).
 */
export async function profissionaisBloqueadosEmDinheiro(agora: Date = new Date()): Promise<Set<number>> {
  try {
    await ensureNegociacoesTable();
    const pool = await getPool();
    if (!pool) return new Set();
    const [linhas] = (await pool.execute(
      `SELECT id, providerId, estado, valorAcordado, taxaCliente, taxaProfissional,
              formaDePagamento, execucaoEnviadaEm, confirmadoEm, pagoEm, createdAt
         FROM negociacoes
        WHERE estado = 'acordada' AND formaDePagamento = 'dinheiro'`,
    )) as any[];
    const todas = linhas as Array<{
      id: number;
      providerId: number;
      estado: string;
      valorAcordado: string | null;
      taxaCliente: string | null;
      taxaProfissional: string | null;
      formaDePagamento: string | null;
      execucaoEnviadaEm: Date | null;
      confirmadoEm: Date | null;
      pagoEm: Date | null;
      createdAt: Date | null;
    }>;
    if (todas.length === 0) return new Set();

    const trabalhos = await trabalhosDaCarteira(todas.map((l) => ({ ...l, id: Number(l.id) })));
    const porProfissional = new Map<number, typeof trabalhos>();
    trabalhos.forEach((t, i) => {
      const p = Number(todas[i].providerId);
      if (!porProfissional.has(p)) porProfissional.set(p, []);
      porProfissional.get(p)!.push(t);
    });

    const bloqueados = new Set<number>();
    for (const [p, ts] of porProfissional) {
      if (bloqueioEmDinheiro(ts, agora).bloqueado) bloqueados.add(p);
    }
    return bloqueados;
  } catch (e) {
    console.error("[bloqueio-do-profissional] não li as dívidas em atraso:", e);
    return new Set();
  }
}
