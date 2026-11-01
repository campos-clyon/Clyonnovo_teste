import { dividasDe, foiPagoEmMao, type DividaNaCarteira, type TrabalhoNaCarteira } from "./carteira";
import { faseDoTrabalho } from "./trabalho";
import { diaEmLisboa, inicioDoDiaEmLisboa, instanteDaBase } from "./hora-de-lisboa";

/**
 * O QUE O PROFISSIONAL DEVE À CLYON, E COMO SE FECHA — 01-11-2026.
 *
 * *«Na realidade está tudo acertado com a Revolution e com os outros: ninguém
 * deve nada a ninguém. Dar tudo como quitado até hoje, para todos os
 * profissionais. E daqui para a frente, tudo registado no histórico do pedido
 * e do profissional, com quem e quando.»* — dono, 01-11-2026.
 *
 * Uma dívida (o IVA e a taxa da plataforma de um trabalho pago em mão, ver
 * `dividasDe`) fecha-se por QUATRO caminhos, e só um tira dinheiro do saldo:
 *
 *   · por REFERÊNCIA Multibanco / MB WAY (o euPago avisa);
 *   · ABATIDA no saldo, quando a CLYON paga uma transferência
 *     (`abater-dividas-no-saldo.ts`) — a única que sai do «Pode pedir já»;
 *   · PAGA PELO PROFISSIONAL POR OUTRA VIA, registada à mão pela equipa
 *     (`METODOS_DO_PROFISSIONAL`): transferência, MB WAY ou numerário;
 *   · QUITADA no acerto de 01-11-2026 (`METODO_DA_QUITACAO`): não entrou
 *     dinheiro nenhum nem saiu do saldo — o dono deu-a por acertada.
 *
 * Cada uma é uma linha em `pagamentos` (é ela que dá a dívida por paga, pelo
 * mesmo índice único de sempre) e uma no registo permanente, com quem e
 * quando. Este ficheiro é puro: as frases, o plano e a escolha das dívidas.
 */

/** O acerto de 01-11-2026: a dívida dada por paga sem dinheiro a mexer. */
export const METODO_DA_QUITACAO = "quitacao";

/** O nome da migração que a faz, uma vez só (`migracoesFeitas`). */
export const NOME_DA_QUITACAO = "quitacao-das-dividas-2026-11-01";

/** O dia do acerto — tudo o que foi pago em mão ATÉ ao fim deste dia, em Lisboa. */
export const DIA_DA_QUITACAO = "2026-11-01";

/** O primeiro instante que já NÃO entra no acerto: a meia-noite de 02-11 em Lisboa. */
export function limiteDaQuitacao(): Date {
  return inicioDoDiaEmLisboa("2026-11-02");
}

/** A frase do acerto, a mesma no histórico do pedido, no registo e no ecrã. */
export function fraseDaQuitacao(valor: number): string {
  return `Acerto de 01/11/2026: tudo quitado até esta data (decisão da CLYON). Valor fechado: ${euros(valor)}.`;
}

/**
 * O PROFISSIONAL PAGOU À CLYON POR OUTRA VIA — registado à mão. Os ids levam
 * o prefixo `pro_` para nunca se confundirem com o cliente a pagar (a coluna
 * `metodo` é a mesma) e cabem nos 20 caracteres dela.
 */
export const METODOS_DO_PROFISSIONAL = [
  { id: "pro_transferencia", rotulo: "transferência" },
  { id: "pro_mbway", rotulo: "MB WAY" },
  { id: "pro_numerario", rotulo: "numerário" },
] as const;

export type MetodoDoProfissional = (typeof METODOS_DO_PROFISSIONAL)[number]["id"];

export function eMetodoDoProfissional(v: unknown): v is MetodoDoProfissional {
  return METODOS_DO_PROFISSIONAL.some((m) => m.id === v);
}

export function nomeDoMetodoDoProfissional(v: string): string {
  return METODOS_DO_PROFISSIONAL.find((m) => m.id === v)?.rotulo ?? v;
}

/**
 * Os métodos que fecham uma dívida do profissional e NÃO são o cliente a
 * pagar — para os ecrãs do cliente e para as contas do que entrou.
 */
export const METODOS_DA_DIVIDA: readonly string[] = [
  "abatimento",
  METODO_DA_QUITACAO,
  ...METODOS_DO_PROFISSIONAL.map((m) => m.id),
];

/** Os que não são dinheiro que entrou na conta da CLYON. */
export const METODOS_SEM_DINHEIRO: readonly string[] = ["abatimento", METODO_DA_QUITACAO];

function euros(v: number): string {
  return `${(Math.round((v + Number.EPSILON) * 100) / 100).toFixed(2).replace(".", ",")} €`;
}

function dataCurta(d: Date): string {
  const [a, m, dia] = diaEmLisboa(d).split("-");
  return `${dia}/${m}/${a}`;
}

/* ───────────────────────────── As frases ───────────────────────────── */

/**
 * «Cliente pagou X € ao profissional em dinheiro. O profissional deve à CLYON
 * Y € (IVA Z € + taxa W €).» — quando a equipa marca o pago em mão.
 * Sem factura não há IVA, e a conta diz só a taxa.
 */
export function fraseDoPagoEmDinheiro(d: {
  recebidoDoCliente: number;
  total: number;
  iva: number;
  comissao: number;
}): string {
  const partes = d.iva > 0 ? `IVA ${euros(d.iva)} + taxa ${euros(d.comissao)}` : `taxa ${euros(d.comissao)}`;
  return (
    `Cliente pagou ${euros(d.recebidoDoCliente)} ao profissional em dinheiro. ` +
    `O profissional deve à CLYON ${euros(d.total)} (${partes}).`
  );
}

/** «Abatidos Y € da dívida do #N na transferência de DD/MM/AAAA (pedido de transferência #L).» */
export function fraseDoAbatimento(d: {
  valor: number;
  pedidoId: number | null;
  levantamentoId: number;
  quando: Date;
}): string {
  const doPedido = d.pedidoId != null ? ` do #${d.pedidoId}` : "";
  return (
    `Abatidos ${euros(d.valor)} da dívida${doPedido} na transferência de ${dataCurta(d.quando)} ` +
    `(pedido de transferência #${d.levantamentoId}).`
  );
}

/** «O profissional pagou Y € à CLYON (transferência).» */
export function fraseDoPagamentoDoProfissional(d: { valor: number; metodo: string; pedidoId?: number | null }): string {
  const doPedido = d.pedidoId != null ? `, dívida do #${d.pedidoId}` : "";
  return `O profissional pagou ${euros(d.valor)} à CLYON (${nomeDoMetodoDoProfissional(d.metodo)}${doPedido}).`;
}

/** «A CLYON transferiu X € ao profissional (pedido de transferência #L).» — a outra direcção. */
export function fraseDaTransferenciaAoProfissional(d: { valor: number; levantamentoId?: number | null }): string {
  return (
    `A CLYON transferiu ${euros(d.valor)} ao profissional` +
    (d.levantamentoId != null ? ` (pedido de transferência #${d.levantamentoId}).` : ".")
  );
}

/* ───────────────────────── O pagamento à mão ───────────────────────── */

export type PlanoDoPagamento =
  | { ok: true; fecha: DividaNaCarteira[]; total: number }
  | { ok: false; porque: string };

const centimos = (n: number) => Math.round((n + Number.EPSILON) * 100);

/**
 * QUE DÍVIDAS FECHA UM PAGAMENTO DE `valor` € — das mais antigas para as mais
 * novas, e só inteiras. Uma dívida é uma linha com um índice único: não se
 * paga metade. Por isso o valor tem de bater certo com dívidas inteiras; se
 * não bater, diz-se o que daria.
 */
export function planoDoPagamentoDoProfissional(
  emAberto: DividaNaCarteira[],
  valor: number,
): PlanoDoPagamento {
  const abertas = emAberto
    .filter((d) => !d.paga && d.total > 0)
    .sort((a, b) => (a.nasceuEm?.getTime() ?? 0) - (b.nasceuEm?.getTime() ?? 0) || a.negociacaoId - b.negociacaoId);
  if (abertas.length === 0) return { ok: false, porque: "Este profissional não tem nada em dívida à CLYON." };
  if (!Number.isFinite(valor) || valor <= 0) return { ok: false, porque: "Escreva o valor que ele pagou." };

  const alvo = centimos(valor);
  const totalEmAberto = abertas.reduce((s, d) => s + centimos(d.total), 0);
  if (alvo > totalEmAberto) {
    return {
      ok: false,
      porque: `Ele só deve ${euros(totalEmAberto / 100)}. Um valor acima disso não fecha dívida nenhuma — confirme o valor.`,
    };
  }

  const fecha: DividaNaCarteira[] = [];
  let soma = 0;
  for (const d of abertas) {
    if (soma + centimos(d.total) > alvo) break;
    fecha.push(d);
    soma += centimos(d.total);
  }
  if (soma !== alvo) {
    const possiveis: string[] = [];
    let acumulado = 0;
    for (const d of abertas) {
      acumulado += centimos(d.total);
      possiveis.push(euros(acumulado / 100));
      if (possiveis.length >= 4) break;
    }
    return {
      ok: false,
      porque:
        `${euros(valor)} não fecha dívidas inteiras (fecham-se das mais antigas para as mais novas). ` +
        `Valores que fecham: ${possiveis.join(", ")}${abertas.length > 4 ? "…" : ""}.`,
    };
  }
  return { ok: true, fecha, total: soma / 100 };
}

/* ───────────────────────────── A quitação ───────────────────────────── */

/**
 * O DINHEIRO MUDOU DE MÃOS ATÉ AO LIMITE? Pago em mão quer dizer que o
 * cliente pagou ao profissional — no registo dos Pagamentos (`ao_profissional`,
 * a data do registo) ou em dinheiro combinado, com o trabalho já feito.
 */
function pagoEmMaoAte(t: TrabalhoNaCarteira, limite: Date): boolean {
  if (!foiPagoEmMao(t)) return false;
  if (faseDoTrabalho(t) === "a_negociar") return false;
  const antes = (v: Date | string | null | undefined) => {
    const d = instanteDaBase(v ?? null);
    return d != null && d.getTime() < limite.getTime();
  };
  return antes(t.clientePagouEm) || antes(t.confirmadoEm) || antes(t.execucaoEnviadaEm) || antes(t.pagoEm);
}

/**
 * AS DÍVIDAS QUE O ACERTO DE 01-11-2026 FECHA, de um profissional.
 *
 * Todas as dos trabalhos pagos em mão ou em dinheiro até ao limite e ainda
 * por pagar — mesmo as que ainda não nasceram (trabalho feito, à espera da
 * confirmação ou do prazo): o dinheiro já lhe chegou antes do acerto, e o
 * dono deu-o por acertado. Para essas, a dívida conta-se como se o trabalho
 * estivesse confirmado no limite.
 */
export function dividasAQuitar(trabalhos: TrabalhoNaCarteira[], limite: Date): DividaNaCarteira[] {
  const candidatos = trabalhos
    .filter((t) => pagoEmMaoAte(t, limite))
    .map((t) => (t.confirmadoEm || t.pagoEm ? t : { ...t, confirmadoEm: limite }));
  return dividasDe(candidatos, limite).filter((d) => !d.paga && d.total > 0);
}

/* ─────────────────── O histórico do dinheiro, nas duas direcções ─────────────────── */

export type DireccaoDoDinheiro =
  /** A CLYON pagou ao profissional (transferência). */
  | "clyon_para_profissional"
  /** O profissional pagou à CLYON (à mão, ou abatido numa transferência). */
  | "profissional_para_clyon"
  /** O cliente pagou ao profissional em mão — nasce a dívida. */
  | "cliente_para_profissional"
  /** O acerto de 01-11-2026. */
  | "acerto";

export type EntradaDoDinheiro = {
  quando: string | null;
  direccao: DireccaoDoDinheiro;
  texto: string;
  quem: string | null;
  pedidoId: number | null;
  valor: number | null;
};

type LinhaDoRegistoLida = {
  acontecimento?: unknown;
  ocorridoEm?: unknown;
  autorNome?: unknown;
  resumo?: unknown;
  pedidoId?: unknown;
  valor?: unknown;
  detalheJson?: unknown;
};

type LevantamentoLido = {
  id: unknown;
  valor: unknown;
  estado: unknown;
  processadoEm?: unknown;
  processadoPor?: unknown;
};

const txt = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
const num = (v: unknown): number | null => {
  const n = Number(v);
  return v == null || v === "" || !Number.isFinite(n) ? null : n;
};
const isoDe = (v: unknown): string | null => instanteDaBase(v as string | Date | null)?.toISOString() ?? null;

function metodoDoDetalhe(v: unknown): string | null {
  try {
    const d = typeof v === "string" ? (JSON.parse(v) as { metodo?: unknown }) : (v as { metodo?: unknown } | null);
    return typeof d?.metodo === "string" ? d.metodo : null;
  } catch {
    return null;
  }
}

/**
 * O HISTÓRICO DO DINHEIRO DE UM PROFISSIONAL, em linguagem clara e nas duas
 * direcções — 01-11-2026 (dono: «tudo registado, com quem e quando»).
 *
 *   · as transferências da CLYON para ele (os pedidos de transferência pagos e
 *     os trabalhos pagos um a um);
 *   · o que ele pagou à CLYON (à mão, ou abatido numa transferência);
 *   · o cliente a pagar-lhe em mão (é aí que nasce a dívida);
 *   · o acerto de 01-11-2026 — a linha do profissional, e não a de cada
 *     trabalho (essas vêem-se no histórico do pedido).
 *
 * Do mais recente para o mais antigo. Pura.
 */
export function historicoDoDinheiro(
  levantamentos: readonly LevantamentoLido[],
  registo: readonly LinhaDoRegistoLida[],
): EntradaDoDinheiro[] {
  const saida: EntradaDoDinheiro[] = [];
  for (const l of levantamentos) {
    if (txt(l.estado) !== "pago") continue;
    const valor = num(l.valor) ?? 0;
    saida.push({
      quando: isoDe(l.processadoEm),
      direccao: "clyon_para_profissional",
      texto: fraseDaTransferenciaAoProfissional({ valor, levantamentoId: num(l.id) }),
      quem: txt(l.processadoPor) || null,
      pedidoId: null,
      valor,
    });
  }
  for (const r of registo) {
    const a = txt(r.acontecimento);
    const pedidoId = num(r.pedidoId);
    const base = {
      quando: isoDe(r.ocorridoEm),
      quem: txt(r.autorNome) || null,
      pedidoId,
      valor: num(r.valor),
      texto: txt(r.resumo),
    };
    if (a === "levantamento_pago") {
      // O «pago ao profissional» um a um: a CLYON transferiu este trabalho.
      const v = num(r.valor);
      saida.push({
        ...base,
        direccao: "clyon_para_profissional",
        texto:
          v != null
            ? `A CLYON transferiu ${euros(v)} ao profissional${pedidoId != null ? ` pelo #${pedidoId}` : ""}.`
            : base.texto,
      });
    } else if (a === "divida_abatida" || a === "divida_paga_pelo_profissional") {
      saida.push({ ...base, direccao: "profissional_para_clyon" });
    } else if (a === "divida_quitada") {
      // A linha do acerto inteiro (sem pedido); as de cada trabalho ficam no pedido.
      if (pedidoId == null) saida.push({ ...base, direccao: "acerto" });
    } else if (a === "pagamento_recebido" && metodoDoDetalhe(r.detalheJson) === "ao_profissional") {
      saida.push({ ...base, direccao: "cliente_para_profissional" });
    }
  }
  return saida.sort((x, y) => (y.quando ? Date.parse(y.quando) : 0) - (x.quando ? Date.parse(x.quando) : 0));
}

/** Os acontecimentos que o histórico do dinheiro do profissional lê do registo. */
export const ACONTECIMENTOS_DO_HISTORICO_DO_PROFISSIONAL = [
  "levantamento_pago",
  "divida_abatida",
  "divida_paga_pelo_profissional",
  "divida_quitada",
  "pagamento_recebido",
] as const;
