import { diaEmLisboa, instanteDaBase } from "./hora-de-lisboa";

/**
 * O QUE O PROFISSIONAL DEVE À CLYON, EM DUAS PARTES — 11-11-2026 (dono).
 *
 * *«Quando o profissional recebe em dinheiro e o cliente quer fatura, o
 * profissional, além de passar o IVA, tem de passar também a nossa taxa. Não
 * vejo onde marco se está pendente ou se ele já pagou, ou se pagou só o IVA e
 * não a taxa, ou só a taxa e não o IVA.»*
 *
 * A dívida de um trabalho pago em mão (`dividasDe` em carteira.ts) tem duas
 * partes, cada uma com o seu estado: o IVA e a taxa da plataforma. Os valores
 * são os da conta de sempre (`dividaDoProfissional` / `dividaDoRegistoEmMao`)
 * — aqui não se faz conta nenhuma nova, só se diz que parte está paga.
 *
 * DE ONDE VEM O ESTADO DE CADA PARTE:
 *   · uma MARCA activa em `cobrancasAoProfissional` (quem, quando, método,
 *     nota) — a equipa marcou-a, ou um pagamento em bloco / um abatimento
 *     cobriu-a;
 *   · senão, o FECHO da dívida inteira em `pagamentos` (referência paga,
 *     abatimento, pagamento em bloco antigo, acerto de 01-11-2026): fecha as
 *     duas partes de uma vez, como sempre fechou;
 *   · senão, PENDENTE.
 *
 * O DINHEIRO NUNCA CONTA DUAS VEZES. Uma marca com `pagamentoId` está coberta
 * por essa linha de `pagamentos` (é a linha que tem o dinheiro); uma marca sem
 * ele é dinheiro que só esta tabela conhece — e as Finanças lêem-na daqui.
 * Quando a última parte pendente se marca, nasce a linha que fecha a dívida,
 * com o valor só do que se marcou nesse momento.
 *
 * Puro, sem base: as rotas, as Carteiras, o bloqueio e o separador lêem daqui.
 */

export type ParteDaDivida = "iva" | "taxa";

export const PARTES_DA_DIVIDA: readonly ParteDaDivida[] = ["iva", "taxa"];

export const NOME_DA_PARTE: Record<ParteDaDivida, string> = {
  iva: "IVA",
  taxa: "Taxa da plataforma",
};

export function eParteDaDivida(v: unknown): v is ParteDaDivida {
  return v === "iva" || v === "taxa";
}

/** Quem pôs a marca: a equipa a marcar a parte, um pagamento em bloco, ou o abatimento no saldo. */
export type OrigemDaMarca = "marcacao" | "bloco" | "abatimento";

/** Uma linha activa de `cobrancasAoProfissional`. */
export type MarcaDaParte = {
  id?: number;
  negociacaoId: number;
  parte: ParteDaDivida;
  valor: number;
  pagoEm: Date | string | null;
  metodo: string | null;
  nota?: string | null;
  marcadoPor?: string | null;
  /** A linha de `pagamentos` que tem este dinheiro; nula = só esta tabela o conhece. */
  pagamentoId?: number | null;
  origem: OrigemDaMarca;
};

/** A dívida inteira fechada em `pagamentos` — o caminho de sempre. */
export type FechoDaDivida = { em: Date | string | null; metodo: string | null } | null;

export type EstadoDaParte = {
  parte: ParteDaDivida;
  rotulo: string;
  valor: number;
  paga: boolean;
  /** ISO. */
  pagoEm: string | null;
  metodo: string | null;
  nota: string | null;
  marcadoPor: string | null;
  pagamentoId: number | null;
  /** «fecho» = a dívida inteira fechou-se em `pagamentos`, sem marca desta parte. */
  origem: OrigemDaMarca | "fecho" | null;
  /** Pode desfazer-se aqui: uma marca da equipa (ou de um bloco que não fechou a dívida). */
  desfazivel: boolean;
};

export type EstadoDaCobranca = "pendente" | "parcial" | "pago";

const aosCentimos = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const iso = (v: Date | string | null | undefined): string | null => instanteDaBase(v ?? null)?.toISOString() ?? null;

/**
 * AS DUAS PARTES DE UMA DÍVIDA, COM O ESTADO DE CADA UMA.
 *
 * Sem IVA (sem factura, ou um trabalho sem IVA), só há a taxa. Uma parte de
 * zero euros não se mostra nem se cobra.
 */
export function partesDaDivida(
  d: { iva: number; comissao: number },
  marcas: ReadonlyArray<MarcaDaParte>,
  fecho: FechoDaDivida,
): EstadoDaParte[] {
  const valores: Record<ParteDaDivida, number> = { iva: aosCentimos(d.iva), taxa: aosCentimos(d.comissao) };
  const saida: EstadoDaParte[] = [];
  for (const parte of PARTES_DA_DIVIDA) {
    const valor = valores[parte];
    if (!(valor > 0)) continue;
    const m = marcas.find((x) => x.parte === parte) ?? null;
    if (m) {
      saida.push({
        parte,
        rotulo: NOME_DA_PARTE[parte],
        valor,
        paga: true,
        pagoEm: iso(m.pagoEm),
        metodo: m.metodo ?? null,
        nota: m.nota ?? null,
        marcadoPor: m.marcadoPor ?? null,
        pagamentoId: m.pagamentoId ?? null,
        origem: m.origem,
        desfazivel: m.pagamentoId == null || m.origem === "marcacao",
      });
      continue;
    }
    if (fecho) {
      saida.push({
        parte,
        rotulo: NOME_DA_PARTE[parte],
        valor,
        paga: true,
        pagoEm: iso(fecho.em),
        metodo: fecho.metodo,
        nota: null,
        marcadoPor: null,
        pagamentoId: null,
        origem: "fecho",
        desfazivel: false,
      });
      continue;
    }
    saida.push({
      parte,
      rotulo: NOME_DA_PARTE[parte],
      valor,
      paga: false,
      pagoEm: null,
      metodo: null,
      nota: null,
      marcadoPor: null,
      pagamentoId: null,
      origem: null,
      desfazivel: false,
    });
  }
  return saida;
}

/** O que falta pagar: a soma das partes pendentes. */
export function porPagarDasPartes(partes: ReadonlyArray<EstadoDaParte>): number {
  return aosCentimos(partes.filter((p) => !p.paga).reduce((s, p) => s + p.valor, 0));
}

/** O que já entrou: a soma das partes pagas. */
export function pagoDasPartes(partes: ReadonlyArray<EstadoDaParte>): number {
  return aosCentimos(partes.filter((p) => p.paga).reduce((s, p) => s + p.valor, 0));
}

export function estadoDaCobranca(partes: ReadonlyArray<EstadoDaParte>): EstadoDaCobranca {
  const pagas = partes.filter((p) => p.paga).length;
  if (partes.length === 0 || pagas === partes.length) return "pago";
  return pagas === 0 ? "pendente" : "parcial";
}

/* ───────────────────────── O pagamento em bloco ───────────────────────── */

/** Uma dívida, como o plano do bloco a lê. */
export type DividaEmPartes = {
  negociacaoId: number;
  nasceuEm: Date | null;
  partes: ReadonlyArray<EstadoDaParte>;
};

export type PassoDoBloco = {
  negociacaoId: number;
  /** As partes que este pagamento cobre nesta dívida (IVA antes da taxa). */
  partes: ParteDaDivida[];
  valor: number;
  /** Com estas, a dívida fica sem nada pendente: nasce a linha que a fecha. */
  fecha: boolean;
};

export type PlanoDoBloco = { ok: true; passos: PassoDoBloco[]; total: number } | { ok: false; porque: string };

const centimos = (n: number) => Math.round((n + Number.EPSILON) * 100);

function euros(v: number): string {
  return `${aosCentimos(v).toFixed(2).replace(".", ",")} €`;
}

/**
 * QUE PARTES FECHA UM PAGAMENTO DE `valor` € — 11-11-2026.
 *
 * A ORDEM, e porquê: das dívidas mais antigas para as mais novas (são as que
 * contam para o bloqueio dos 7 dias), e em cada uma o IVA antes da taxa. O
 * IVA não é da CLYON — é do Estado, e a factura já foi emitida: é o primeiro
 * dinheiro que tem de entrar. A taxa é o que a CLYON ganha, e pode esperar
 * pelo pagamento seguinte. Assim uma dívida antiga nunca fica com a taxa paga
 * e o IVA por pagar por causa de um bloco.
 *
 * Partes inteiras, nunca meia parte: o valor tem de bater certo com uma
 * sequência de partes nesta ordem; se não bater, diz-se o que daria.
 */
export function planoDoPagamentoEmPartes(dividas: ReadonlyArray<DividaEmPartes>, valor: number): PlanoDoBloco {
  const ordem = [...dividas]
    .filter((d) => d.partes.some((p) => !p.paga && p.valor > 0))
    .sort(
      (a, b) =>
        (a.nasceuEm?.getTime() ?? Number.POSITIVE_INFINITY) - (b.nasceuEm?.getTime() ?? Number.POSITIVE_INFINITY) ||
        a.negociacaoId - b.negociacaoId,
    );
  if (ordem.length === 0) return { ok: false, porque: "Este profissional não tem nada em dívida à CLYON." };
  if (!Number.isFinite(valor) || valor <= 0) return { ok: false, porque: "Escreva o valor que ele pagou." };

  // A fila das partes pendentes, pela ordem justa.
  const fila: Array<{ negociacaoId: number; parte: ParteDaDivida; valor: number }> = [];
  for (const d of ordem) {
    for (const parte of PARTES_DA_DIVIDA) {
      const p = d.partes.find((x) => x.parte === parte);
      if (p && !p.paga && p.valor > 0) fila.push({ negociacaoId: d.negociacaoId, parte, valor: p.valor });
    }
  }

  const alvo = centimos(valor);
  const emAberto = fila.reduce((s, p) => s + centimos(p.valor), 0);
  if (alvo > emAberto) {
    return {
      ok: false,
      porque: `Ele só deve ${euros(emAberto / 100)}. Um valor acima disso não fecha nada — confirme o valor.`,
    };
  }

  let soma = 0;
  let n = 0;
  while (n < fila.length && soma + centimos(fila[n].valor) <= alvo) {
    soma += centimos(fila[n].valor);
    n++;
  }
  if (soma !== alvo) {
    const possiveis: string[] = [];
    let acumulado = 0;
    for (const p of fila) {
      acumulado += centimos(p.valor);
      possiveis.push(euros(acumulado / 100));
      if (possiveis.length >= 5) break;
    }
    return {
      ok: false,
      porque:
        `${euros(valor)} não fecha partes inteiras (fecham-se das dívidas mais antigas para as mais novas, ` +
        `o IVA antes da taxa). Valores que fecham: ${possiveis.join(", ")}${fila.length > 5 ? "…" : ""}.`,
    };
  }

  const cobertas = fila.slice(0, n);
  const passos: PassoDoBloco[] = [];
  for (const d of ordem) {
    const desta = cobertas.filter((c) => c.negociacaoId === d.negociacaoId);
    if (desta.length === 0) continue;
    const pendentes = d.partes.filter((p) => !p.paga && p.valor > 0).length;
    passos.push({
      negociacaoId: d.negociacaoId,
      partes: desta.map((c) => c.parte),
      valor: aosCentimos(desta.reduce((s, c) => s + c.valor, 0)),
      fecha: desta.length === pendentes,
    });
  }
  return { ok: true, passos, total: soma / 100 };
}

/* ───────────────────────────── As frases ───────────────────────────── */

function dataCurta(v: string | Date | null): string {
  const d = instanteDaBase(v ?? null);
  if (!d) return "";
  const [a, m, dia] = diaEmLisboa(d).split("-");
  return `${dia}/${m}/${a}`;
}

/** «Pago 05/11 · MB WAY» ou «Pendente». */
export function estadoDaParteEmPalavras(p: EstadoDaParte): string {
  if (!p.paga) return "pendente";
  const dia = dataCurta(p.pagoEm);
  const como =
    p.origem === "fecho"
      ? p.metodo === "abatimento"
        ? "abatido no saldo"
        : p.metodo === "quitacao"
          ? "acerto de 01/11/2026"
          : p.metodo
            ? nomeDoMetodo(p.metodo)
            : ""
      : p.origem === "abatimento"
        ? "abatido no saldo"
        : p.metodo
          ? nomeDoMetodo(p.metodo)
          : "";
  return ["pago", dia, como].filter(Boolean).join(" · ");
}

function nomeDoMetodo(m: string): string {
  if (m === "multibanco") return "Multibanco";
  if (m === "mbway") return "MB WAY";
  if (m === "abatimento") return "abatido no saldo";
  // Os do profissional (`METODOS_DO_PROFISSIONAL` em pagamento-da-divida.ts), sem o importar:
  // a carteira lê este ficheiro, e aquele lê a carteira.
  if (m === "pro_transferencia") return "transferência";
  if (m === "pro_mbway") return "MB WAY";
  if (m === "pro_numerario") return "numerário";
  return m;
}

/**
 * «O profissional pagou à CLYON o IVA (22,50 €) do #480 — MB WAY, 05/11/2026.
 * Falta a taxa da plataforma (9,80 €).» — a frase do histórico do pedido e do
 * registo, a mesma nos dois.
 */
export function fraseDaMarcacao(d: {
  partes: ReadonlyArray<{ parte: ParteDaDivida; valor: number }>;
  pedidoId: number | null;
  metodo: string;
  quando: Date;
  faltam: ReadonlyArray<{ parte: ParteDaDivida; valor: number }>;
}): string {
  const oQue = d.partes
    .map((p) => `${p.parte === "iva" ? "o IVA" : "a taxa da plataforma"} (${euros(p.valor)})`)
    .join(" e ");
  const doPedido = d.pedidoId != null ? ` do #${d.pedidoId}` : "";
  const falta =
    d.faltam.length === 0
      ? " A dívida deste trabalho fica paga."
      : ` Falta ${d.faltam
          .map((p) => `${p.parte === "iva" ? "o IVA" : "a taxa da plataforma"} (${euros(p.valor)})`)
          .join(" e ")}.`;
  return `O profissional pagou à CLYON ${oQue}${doPedido} — ${nomeDoMetodo(d.metodo)}, ${dataCurta(d.quando)}.${falta}`;
}

/** «Desfeita a marca do IVA (22,50 €) do #480 — volta a pendente.» */
export function fraseDoDesfazer(d: { parte: ParteDaDivida; valor: number; pedidoId: number | null; motivo: string }): string {
  const doPedido = d.pedidoId != null ? ` do #${d.pedidoId}` : "";
  const qual = d.parte === "iva" ? "do IVA" : "da taxa da plataforma";
  return `Desfeita a marca ${qual} (${euros(d.valor)})${doPedido} — volta a pendente.${d.motivo ? ` Motivo: ${d.motivo}` : ""}`;
}

/**
 * A DÍVIDA DEPOIS DAS PARTES JÁ MARCADAS — o que se pede por referência
 * (Multibanco ou MB WAY): só o que falta. Com o IVA marcado, a referência é da
 * taxa; com nada marcado, é a dívida inteira, como sempre.
 */
export function oQueFaltaDaDivida<T extends { iva: number; comissao: number; total: number }>(
  d: T,
  marcas: ReadonlyArray<MarcaDaParte>,
): T {
  const partes = partesDaDivida(d, marcas, null);
  const falta = (p: ParteDaDivida) => partes.find((x) => x.parte === p && !x.paga)?.valor ?? 0;
  return { ...d, iva: falta("iva"), comissao: falta("taxa"), total: porPagarDasPartes(partes) };
}
