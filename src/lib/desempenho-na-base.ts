/**
 * O DESEMPENHO, LIDO DA BASE — d41, 15-11-2026. A conta está em `desempenho.ts`.
 *
 * DUAS FONTES, porque a purga apaga os pedidos terminados aos 60 dias (e os
 * abandonados aos 90): sem a segunda, os gráficos de 12 meses mostravam só os
 * dois últimos.
 *  1. `simulatorOrders` — os pedidos que ainda existem, com a negociação
 *     confirmada (o `feitoEm` da d36) e se o trabalho foi de uma conta de teste.
 *  2. `registoPermanente` — o retrato que a purga escreve de cada pedido que
 *     apaga (`pedido_expurgado`): o serviço, o dia em que nasceu
 *     (`detalhe.criadoEm`) e as negociações com a confirmação; mais os
 *     `pedido_cancelado`/`pedido_reaberto` para saber se acabou cancelado.
 *     Os apagados à mão no backoffice (`pedido_apagado`) não contam: são
 *     repetidos, enganos e testes.
 *
 * 3. `arquivoDePedidos` — o estado (concluído, cancelado, arquivado) da cópia
 *    de cada apagado, lido do JSON pela própria base (três campos, não o texto).
 *
 * LEVE PARA A BASE: quatro consultas numa ligação do pool partilhado, sem N+1,
 * e o resultado guardado 5 minutos no processo (a base tem 151 ligações e
 * 256 MB de buffer). O filtro por serviço e a conta fazem-se em memória, sobre
 * as mesmas linhas.
 */
import {
  ensureNegociacoesTable,
  ensureProvidersSchema,
  ensureArquivoDePedidosTable,
  ensureRegistoTable,
  ensureSimulatorOrdersTable,
  getPool,
} from "@/lib/db";
import { feitoEmDe } from "@/lib/feito-em";
import { instanteDaBase } from "@/lib/hora-de-lisboa";
import { eContaDeTeste } from "@/lib/perfil-publico-do-profissional";
import type { LinhaDoDesempenho } from "@/lib/desempenho";

type Linha = Record<string, unknown>;

/** Cinco minutos: o ecrã olha-se de passagem, e cada leitura varre duas tabelas. */
export const CACHE_DO_DESEMPENHO_MS = 5 * 60 * 1000;

/** Um pedido que ainda existe → a linha da conta. Pura, para os testes. */
export function linhaDoPedido(l: Linha): LinhaDoDesempenho {
  const status = String(l.status ?? "");
  const concluido = status === "concluido";
  // A regra de `diaQueConta` (comissões): o dia corrigido à mão manda; senão o
  // do feito (d36); senão a conclusão de sempre.
  const manual = Number(l.concluidoEmManual ?? 0) === 1;
  const conclusao =
    instanteDaBase((l.concluidoEm as string | Date | null) ?? null) ??
    instanteDaBase((l.confirmadoEm as string | Date | null) ?? null) ??
    instanteDaBase((l.updatedAt as string | Date | null) ?? null);
  const realizadoEm = concluido ? (manual ? conclusao : (feitoEmDe(l as { feitoEm?: Date | string | null }) ?? conclusao)) : null;
  const deTeste =
    Number(l.feitoPorTeste ?? 0) === 1 ||
    Number(l.soDeTeste ?? 0) === 1 ||
    eContaDeTeste(typeof l.contactName === "string" ? l.contactName : null);
  return {
    id: Number(l.id),
    criadoEm: instanteDaBase((l.createdAt as string | Date | null) ?? null),
    servico: (l.serviceType as string | null) ?? null,
    realizadoEm,
    cancelado: !concluido && (status === "cancelado" || status === "arquivado"),
    deTeste,
  };
}

type NegociacaoDoRetrato = { providerId?: number; confirmadoEm?: string | null };

/**
 * Um pedido apagado pela purga → a linha da conta. `eventos` são as linhas do
 * registo desse pedido (o retrato e uma por profissional); `deTeste`, os ids
 * dos profissionais de teste. Pura, para os testes.
 */
export function linhaDoApagado(
  pedidoId: number,
  eventos: readonly Linha[],
  profissionaisDeTeste: ReadonlySet<number>,
  arquivo?: Linha | null,
): LinhaDoDesempenho | null {
  const retrato = eventos.find((e) => e.acontecimento === "pedido_expurgado" && e.negociacaoId == null);
  if (!retrato) return null;
  let detalhe: { criadoEm?: string | null; negociacoes?: NegociacaoDoRetrato[] } = {};
  try {
    detalhe = typeof retrato.detalheJson === "string" ? JSON.parse(retrato.detalheJson) : {};
  } catch {
    detalhe = {};
  }
  const negs = Array.isArray(detalhe.negociacoes) ? detalhe.negociacoes : [];
  const confirmadas = negs.filter((n) => n && n.confirmadoEm);
  let realizadoEm: Date | null = null;
  for (const n of confirmadas) {
    const d = instanteDaBase(n.confirmadoEm ?? null);
    if (d && (!realizadoEm || d > realizadoEm)) realizadoEm = d;
  }
  const deTesteNum = (id: unknown) => profissionaisDeTeste.has(Number(id));
  const deTeste =
    confirmadas.some((n) => deTesteNum(n.providerId)) ||
    (negs.length > 0 && negs.every((n) => deTesteNum(n?.providerId))) ||
    eContaDeTeste(typeof retrato.clienteNome === "string" ? retrato.clienteNome : null);

  // Cancelado: o último cancelamento sem um «reaberto» depois dele, e não feito.
  let canceladoEm: Date | null = null;
  let reabertoEm: Date | null = null;
  for (const e of eventos) {
    const d = instanteDaBase((e.ocorridoEm as string | Date | null) ?? null);
    if (!d) continue;
    if (e.acontecimento === "pedido_cancelado" && (!canceladoEm || d > canceladoEm)) canceladoEm = d;
    if (e.acontecimento === "pedido_reaberto" && (!reabertoEm || d > reabertoEm)) reabertoEm = d;
  }
  let cancelado = !realizadoEm && canceladoEm != null && (!reabertoEm || reabertoEm < canceladoEm);

  /*
   * O ESTADO DO ARQUIVO MANDA, quando existe: a cópia do pedido guardada ao
   * apagar (`arquivoDePedidos`) diz se ficou concluído, cancelado ou
   * arquivado. Os pedidos antigos, fechados à mão sem negociação confirmada,
   * só se sabem feitos por aqui.
   */
  const estado = typeof arquivo?.status === "string" ? arquivo.status : null;
  if (estado === "concluido") {
    realizadoEm =
      realizadoEm ??
      instanteDaBase((arquivo?.concluidoEm as string | null) ?? null) ??
      instanteDaBase((arquivo?.updatedAt as string | null) ?? null) ??
      instanteDaBase((retrato.ocorridoEm as string | Date | null) ?? null);
    cancelado = false;
  } else if (estado === "cancelado" || estado === "arquivado") {
    if (!confirmadas.length) {
      realizadoEm = null;
      cancelado = true;
    }
  }

  return {
    id: pedidoId,
    criadoEm: instanteDaBase(detalhe.criadoEm ?? null),
    servico: (retrato.servicoTipo as string | null) ?? null,
    realizadoEm,
    cancelado,
    deTeste,
  };
}

async function lerDaBase(): Promise<LinhaDoDesempenho[]> {
  await Promise.all([ensureSimulatorOrdersTable(), ensureNegociacoesTable(), ensureProvidersSchema(), ensureRegistoTable(), ensureArquivoDePedidosTable()]);
  const pool = await getPool();
  if (!pool) throw new Error("DB not available");
  const conn = await pool.getConnection();
  try {
    // 1. Os pedidos que existem, com a negociação confirmada mais recente e o teste.
    const [pedidos] = (await conn.query(
      `SELECT o.id, o.createdAt, o.serviceType, o.status, o.contactName,
              o.concluidoEm, o.concluidoEmManual, o.updatedAt,
              c.confirmadoEm, n.feitoEm, c.feitoPorTeste, c.soDeTeste
         FROM simulatorOrders o
         LEFT JOIN (
           SELECT x.pedidoId,
                  MAX(CASE WHEN x.confirmadoEm IS NOT NULL THEN x.id END) AS negociacaoId,
                  MAX(x.confirmadoEm) AS confirmadoEm,
                  MAX(CASE WHEN x.estado = 'acordada' OR x.confirmadoEm IS NOT NULL
                           THEN COALESCE(p.contaDeTeste, 0) ELSE 0 END) AS feitoPorTeste,
                  MIN(COALESCE(p.contaDeTeste, 0)) AS soDeTeste
             FROM negociacoes x
             LEFT JOIN providers p ON p.id = x.providerId
            GROUP BY x.pedidoId
         ) c ON c.pedidoId = o.id
         LEFT JOIN negociacoes n ON n.id = c.negociacaoId
        LIMIT 50000`,
    )) as [Linha[], unknown];

    // 2. Os apagados pela purga: o retrato e as linhas de cada profissional;
    //    e os cancelamentos desses pedidos. O detalhe só vem no retrato.
    const [registo] = (await conn.query(
      `SELECT r.pedidoId, r.acontecimento, r.negociacaoId, r.ocorridoEm, r.servicoTipo, r.clienteNome,
              CASE WHEN r.acontecimento = 'pedido_expurgado' AND r.negociacaoId IS NULL
                   THEN r.detalheJson END AS detalheJson
         FROM registoPermanente r
        WHERE r.pedidoId IS NOT NULL
          AND r.acontecimento IN ('pedido_expurgado', 'pedido_cancelado', 'pedido_reaberto')
        LIMIT 100000`,
    )) as [Linha[], unknown];

    // 3. O estado de cada apagado, pela cópia do arquivo (só três campos do JSON).
    const [arquivo] = (await conn.query(
      `SELECT a.pedidoId,
              JSON_UNQUOTE(JSON_EXTRACT(a.dados, '$.pedido.status')) AS status,
              JSON_UNQUOTE(JSON_EXTRACT(a.dados, '$.pedido.concluidoEm')) AS concluidoEm,
              JSON_UNQUOTE(JSON_EXTRACT(a.dados, '$.pedido.updatedAt')) AS updatedAt
         FROM arquivoDePedidos a
         JOIN (SELECT pedidoId, MAX(id) AS id FROM arquivoDePedidos GROUP BY pedidoId) u ON u.id = a.id
        WHERE JSON_VALID(a.dados)`,
    )) as [Linha[], unknown];

    // 4. Os profissionais de teste (poucos).
    const [teste] = (await conn.query(
      `SELECT id FROM providers WHERE COALESCE(contaDeTeste, 0) = 1`,
    )) as [Linha[], unknown];

    const deTeste = new Set(teste.map((t) => Number(t.id)));
    const doArquivo = new Map(arquivo.map((a) => [Number(a.pedidoId), a]));
    const linhas = pedidos.map(linhaDoPedido);
    const existem = new Set(linhas.map((l) => l.id));

    const porPedido = new Map<number, Linha[]>();
    for (const e of registo) {
      const id = Number(e.pedidoId);
      if (!Number.isFinite(id) || existem.has(id)) continue;
      const lista = porPedido.get(id);
      if (lista) lista.push(e);
      else porPedido.set(id, [e]);
    }
    for (const [id, eventos] of porPedido) {
      const l = linhaDoApagado(id, eventos, deTeste, doArquivo.get(id));
      if (l) linhas.push(l);
    }
    return linhas;
  } finally {
    conn.release();
  }
}

let guardado: { em: number; linhas: LinhaDoDesempenho[] } | null = null;
let aLer: Promise<LinhaDoDesempenho[]> | null = null;

/** As linhas do desempenho, com 5 minutos de cache; duas visitas ao mesmo tempo partilham a leitura. */
export async function linhasDoDesempenho(agora: number = Date.now()): Promise<LinhaDoDesempenho[]> {
  if (guardado && agora - guardado.em < CACHE_DO_DESEMPENHO_MS) return guardado.linhas;
  if (!aLer) {
    aLer = lerDaBase()
      .then((linhas) => {
        guardado = { em: Date.now(), linhas };
        return linhas;
      })
      .finally(() => {
        aLer = null;
      });
  }
  return aLer;
}
