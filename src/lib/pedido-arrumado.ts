/**
 * UM PEDIDO ARRUMADO SAI DOS PROFISSIONAIS — 08-10-2026.
 *
 * *«Quero que garanta que se o pedido foi cancelado ou arquivado pelo admin ou
 * assistentes ele seja removido dos pros ou vá directamente para recusados.»*
 * Foi o #418: o cliente desistiu, e o trabalho continuava «Atribuído» ao
 * Revolution.
 *
 * Só o botão «Cancelar pedido» encerrava as negociações (`cancelarPedido`). O
 * «Arquivar» e o estado mudado à mão no pedido passavam por
 * `updateSimulatorOrder`, que mudava a palavra e mais nada: o profissional
 * continuava com o trabalho na lista, a propor ou à espera de o fazer.
 *
 * A regra fica aqui, num sítio só, e aplica-se de duas maneiras:
 *
 *   · AO ARRUMAR — `updateSimulatorOrder` encerra as negociações (passam a
 *     «morta», com memória do estado, como no cancelamento) e, se o pedido
 *     voltar a sair do arquivo, repõe-nas;
 *   · AO LER — o painel do profissional vê como «morta» uma negociação viva de
 *     um pedido arrumado. Cobre os que foram arquivados antes disto, sem tocar
 *     na base.
 *
 * O QUE JÁ ESTÁ FEITO FICA. Um trabalho que ele deu por executado, ou que foi
 * confirmado ou pago, é dinheiro dele: arquivar um pedido concluído para
 * arrumar a mesa não lho pode tirar da carteira nem pô-lo nos recusados.
 */

/** Os estados de pedido que o tiram dos profissionais. O «concluído» não: foi feito. */
export const ESTADOS_QUE_TIRAM_DOS_PROS = ["cancelado", "arquivado", "rejeitado"] as const;

export function pedidoArrumado(status: string | null | undefined): boolean {
  return (ESTADOS_QUE_TIRAM_DOS_PROS as readonly string[]).includes(String(status ?? ""));
}

type Marcos = {
  estado: string;
  execucaoEnviadaEm?: unknown;
  confirmadoEm?: unknown;
  pagoEm?: unknown;
};

/** Viva, e sem trabalho feito: é o que arrumar o pedido encerra. */
export function aindaPorFazer(n: Marcos): boolean {
  if (n.estado === "aberta" || n.estado === "aguarda_contratacao") return true;
  return n.estado === "acordada" && n.execucaoEnviadaEm == null && n.confirmadoEm == null && n.pagoEm == null;
}

/** O estado que o profissional vê, conforme o pedido. */
export function estadoParaOProfissional(n: Marcos, statusDoPedido: string | null | undefined): string {
  return pedidoArrumado(statusDoPedido) && aindaPorFazer(n) ? "morta" : n.estado;
}

/** A lista dos estados, para um `IN (…)` de SQL. */
export const ESTADOS_QUE_TIRAM_DOS_PROS_SQL = `(${ESTADOS_QUE_TIRAM_DOS_PROS.map((s) => `'${s}'`).join(", ")})`;

/**
 * `aindaPorFazer`, em SQL. `n` é o prefixo das colunas das negociações — `"n."`
 * numa consulta com alias, `""` num UPDATE sem ele.
 */
export function aindaPorFazerSql(n = ""): string {
  return (
    `(${n}estado IN ('aberta', 'aguarda_contratacao') OR ` +
    `(${n}estado = 'acordada' AND ${n}execucaoEnviadaEm IS NULL AND ${n}confirmadoEm IS NULL AND ${n}pagoEm IS NULL))`
  );
}

/** `estadoParaOProfissional`, em SQL: `n` e `o` são os prefixos da negociação e do pedido. */
export function estadoParaOProfissionalSql(n = "n.", o = "o."): string {
  return `CASE WHEN ${o}status IN ${ESTADOS_QUE_TIRAM_DOS_PROS_SQL} AND ${aindaPorFazerSql(n)} THEN 'morta' ELSE ${n}estado END`;
}
