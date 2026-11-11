import { diaEmLisboa } from "./hora-de-lisboa";

/**
 * AS FRASES DA DÍVIDA DE UM TRABALHO PAGO EM MÃO, NA CARTEIRA DO PROFISSIONAL
 * — 11-11-2026.
 *
 * Desde que a dívida tem duas partes (o IVA e a taxa da plataforma, cada uma
 * com o seu estado), `iva` e `comissao` de uma dívida por pagar são o que
 * FALTA de cada parte. Quem escolhia a frase por `iva > 0` passava a dizer
 * «em mão, sem IVA» num trabalho com IVA, mal o IVA ficava marcado como pago.
 *
 * A frase lê a dívida INTEIRA (`ivaDaDivida`, `comissaoDaDivida`), e o estado
 * de cada parte vem em linhas à parte, de `partes`.
 *
 * Puro e sem dependências (só a hora de Lisboa): o painel do site e a app
 * CLYON Pro lêem daqui, para dizerem o mesmo à letra.
 */

/** Uma parte, como a rota da carteira a manda (`EstadoDaParte`). */
export type ParteNaFrase = {
  parte: "iva" | "taxa";
  valor: number;
  paga: boolean;
  /** ISO. */
  pagoEm?: string | null;
};

/** A dívida, como a rota da carteira a manda (`DividaNaCarteira`). */
export type DividaNaFrase = {
  recebidoDoCliente: number;
  /** Por pagar, o que FALTA do IVA e da taxa. */
  iva: number;
  comissao: number;
  /** A dívida inteira. Em falta numa resposta antiga: vale o que falta. */
  ivaDaDivida?: number;
  comissaoDaDivida?: number;
  partes?: ReadonlyArray<ParteNaFrase>;
  porPagar?: number;
};

/** «22,50 €» — o mesmo formato do painel e da app. */
export function eurosDaDivida(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(2).replace(".", ",") + " €";
}

const ivaInteiro = (d: DividaNaFrase) => d.ivaDaDivida ?? d.iva;
const taxaInteira = (d: DividaNaFrase) => d.comissaoDaDivida ?? d.comissao;

/** O trabalho tem IVA? Pela dívida inteira, nunca pelo que falta. */
export function aDividaTemIva(d: DividaNaFrase): boolean {
  return ivaInteiro(d) > 0;
}

/**
 * «O cliente pagou-lhe 123,00 € em mão, com IVA. São da CLYON 23,00 € de IVA e
 * 11,00 € de taxa da plataforma.» — ou, sem fatura: «…em mão, sem IVA. A taxa
 * da plataforma (11,00 €) é da CLYON.»
 */
export function fraseDaDividaEmMao(d: DividaNaFrase): string {
  const recebido = eurosDaDivida(d.recebidoDoCliente);
  return aDividaTemIva(d)
    ? `O cliente pagou-lhe ${recebido} em mão, com IVA. São da CLYON ${eurosDaDivida(ivaInteiro(d))} de IVA e ${eurosDaDivida(taxaInteira(d))} de taxa da plataforma.`
    : `O cliente pagou-lhe ${recebido} em mão, sem IVA. A taxa da plataforma (${eurosDaDivida(taxaInteira(d))}) é da CLYON.`;
}

/** A mesma, para a dívida que só se desconta no saldo (nenhuma nasce assim desde 04-11-2026). */
export function fraseDaDividaNoSaldo(d: DividaNaFrase): string {
  const recebido = eurosDaDivida(d.recebidoDoCliente);
  const deQuem = aDividaTemIva(d)
    ? `São da CLYON ${eurosDaDivida(ivaInteiro(d))} de IVA e ${eurosDaDivida(taxaInteira(d))} de taxa da plataforma`
    : `A taxa da plataforma (${eurosDaDivida(taxaInteira(d))}) é da CLYON`;
  return `O cliente pagou-lhe ${recebido} em mão. ${deQuem} — desconta-se do próximo valor que a CLYON lhe transferir.`;
}

/** «05/11», no dia de Lisboa — seja qual for o fuso de quem vê. */
function diaEMes(isoDoInstante: string | null | undefined): string | null {
  if (!isoDoInstante) return null;
  const d = new Date(isoDoInstante);
  if (Number.isNaN(d.getTime())) return null;
  const [, mes, dia] = diaEmLisboa(d).split("-");
  return `${dia}/${mes}`;
}

export type LinhaDaParte = { parte: "iva" | "taxa"; paga: boolean; texto: string };

/**
 * UMA LINHA POR PARTE, COM O ESTADO — «IVA: 23,00 € — pago a 05/11» e «Taxa da
 * plataforma: 11,00 € — por pagar». Só quando a dívida tem as duas partes: com
 * uma só (sem IVA), a frase de cima e o valor já dizem tudo.
 */
export function linhasDasPartesDaDivida(d: DividaNaFrase): LinhaDaParte[] {
  const partes = d.partes ?? [];
  if (partes.length < 2) return [];
  return partes.map((p) => {
    const nome = p.parte === "iva" ? "IVA" : "Taxa da plataforma";
    const dia = p.paga ? diaEMes(p.pagoEm) : null;
    const estado = p.paga ? (dia ? `pago a ${dia}` : "pago") : "por pagar";
    return { parte: p.parte, paga: p.paga, texto: `${nome}: ${eurosDaDivida(p.valor)} — ${estado}` };
  });
}

/**
 * O QUE FALTA, quando uma das partes já está paga: «Falta pagar 11,00 € (a taxa
 * da plataforma).» Com nada pago, o valor da dívida já o diz — e não se repete.
 */
export function faltaDaDivida(d: DividaNaFrase): string | null {
  const partes = d.partes ?? [];
  const pendentes = partes.filter((p) => !p.paga);
  if (pendentes.length === 0 || pendentes.length === partes.length) return null;
  const falta = Math.round(pendentes.reduce((s, p) => s + p.valor, 0) * 100) / 100;
  const qual = pendentes.map((p) => (p.parte === "iva" ? "o IVA" : "a taxa da plataforma")).join(" e ");
  return `Falta pagar ${eurosDaDivida(falta)} (${qual}).`;
}
