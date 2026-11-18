import type { BaseDoPreco } from "./base-do-preco";
import { AS_CARGAS_CONFIRMAM_SE_NO_LOCAL, AS_HORAS_CONTAM_SE_NO_DIA, eurosCurtos, extraNoLocal, INCLUI } from "./extra-no-local";

export { AS_CARGAS_CONFIRMAM_SE_NO_LOCAL, AS_HORAS_CONTAM_SE_NO_DIA };
import { MINIMO_DE_HORAS, horasEscritas } from "./tabela-das-mudancas";

/**
 * O QUE SE DIZ AO CLIENTE SEGUE A BASE DO PREÇO — d63 (CEO e dono, 18-11-2026).
 *
 * O #556 (Trabalho CLYON, modelo antigo, «por carga», 360 €/carga) levou na
 * adjudicação «Se no dia houver mais coisas, o volume a mais combina-se consigo
 * antes de carregar.» — uma frase do valor TOTAL. Por carga, o que se combina é
 * o número de cargas; à hora, as horas. Uma fonte única, para todas as
 * mensagens ao cliente (adjudicação, orçamento, propostas, valores para
 * pagamento, valor único, lembretes da validade, Vitória, emails, a página do
 * pedido e a app de cliente) e para o que o profissional lê:
 *
 *   · total — «Inclui o que está nas fotografias e na descrição.» e o extra no
 *     local, pela regra de cada serviço (`extra-no-local.ts`);
 *   · carga — «O valor é 360 € + IVA (442,80 €) por carga. O número de cargas é
 *     confirmado consigo no local, pela equipa, antes de começar. Por exemplo:
 *     1 carga = 442,80 €; 2 cargas = 885,60 €.»;
 *   · hora — «O valor é 50 €/h + IVA (61,50 €/h), com mínimo de 3 horas. As
 *     horas contam-se no dia e o total fica na folha que valida no fim.».
 *
 * Duas partes: o VALOR («O valor é …») e a REGRA (o resto). Onde a mensagem já
 * diz o valor com as palavras dela (o orçamento, o lembrete), leva só a regra;
 * onde não o diz, a frase inteira. A regra é sempre a mesma, letra a letra — o
 * teste `d63-frase-da-base.test.ts` guarda-o.
 *
 * Nunca o sem IVA sozinho: com IVA a acrescer, o valor com IVA vai ao lado.
 */

export type ValorDaBase = {
  /** O valor sem IVA (por carga, por hora, ou do trabalho todo). */
  semIva?: number | null;
  /** O mesmo, com IVA (igual ao sem IVA quando não há IVA a acrescer). */
  total?: number | null;
  /** O mínimo de horas (o do parceiro numa mudança da lista); sem ele, o da tabela. */
  minimoHoras?: number | null;
};

const temNumero = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

function minimoEmPalavras(m: number | null | undefined): string {
  const n = temNumero(m) ? m : MINIMO_DE_HORAS;
  return `${horasEscritas(n)} ${n === 1 ? "hora" : "horas"}`;
}

const semIvaAAcrescer = (semIva: number, total: number) => Math.abs(total - semIva) < 0.005;

/**
 * A PRIMEIRA PARTE — «O valor é 360 € + IVA (442,80 €) por carga.», «O valor é
 * 50 €/h + IVA (61,50 €/h), com mínimo de 3 horas.» — ou, sem número, «O valor
 * é por carga.» / «O valor é por hora, com mínimo de 3 horas.». No total, nada
 * (o total diz-se com as palavras de cada mensagem).
 */
export function valorDaBase(base: BaseDoPreco, v: ValorDaBase = {}): string {
  const comNumero = temNumero(v.semIva) || temNumero(v.total);
  const semIva = temNumero(v.semIva) ? v.semIva : (v.total as number);
  const total = temNumero(v.total) ? v.total : (v.semIva as number);
  if (base === "carga") {
    if (!comNumero) return "O valor é por carga.";
    return semIvaAAcrescer(semIva, total)
      ? `O valor é ${eurosCurtos(total)} por carga.`
      : `O valor é ${eurosCurtos(semIva)} + IVA (${eurosCurtos(total)}) por carga.`;
  }
  if (base === "hora") {
    const minimo = `com mínimo de ${minimoEmPalavras(v.minimoHoras)}`;
    if (!comNumero) return `O valor é por hora, ${minimo}.`;
    const h = (x: number) => eurosCurtos(x).replace(/ €$/, " €/h");
    return semIvaAAcrescer(semIva, total)
      ? `O valor é ${h(total)}, ${minimo}.`
      : `O valor é ${h(semIva)} + IVA (${h(total)}), ${minimo}.`;
  }
  return "";
}

/** «Mínimo de 3 horas.» — onde o valor por hora já foi dito com as palavras da mensagem. */
export function minimoDasHoras(minimoHoras?: number | null): string {
  return `Mínimo de ${minimoEmPalavras(minimoHoras)}.`;
}

/** «Por exemplo: 1 carga = 442,80 €; 2 cargas = 885,60 €.» — com o valor que o cliente paga. */
export function exemploDasCargas(total: number): string {
  return `Por exemplo: 1 carga = ${eurosCurtos(total)}; 2 cargas = ${eurosCurtos(Math.round(total * 200) / 100)}.`;
}

/**
 * A SEGUNDA PARTE — a regra da base. No total, o que cobre e o extra no local
 * pela regra do serviço; por carga, as cargas confirmadas no local (e o
 * exemplo, quando há o valor); à hora, as horas na folha.
 */
export function regraDaBase(base: BaseDoPreco, servico: string | null | undefined, v: ValorDaBase = {}): string {
  if (base === "carga") {
    const total = temNumero(v.total) ? v.total : temNumero(v.semIva) ? v.semIva : null;
    return total != null ? `${AS_CARGAS_CONFIRMAM_SE_NO_LOCAL} ${exemploDasCargas(total)}` : AS_CARGAS_CONFIRMAM_SE_NO_LOCAL;
  }
  if (base === "hora") return AS_HORAS_CONTAM_SE_NO_DIA;
  return `${INCLUI} ${extraNoLocal(servico ?? null, "total")}`;
}

/** A FRASE INTEIRA — o valor (por carga ou por hora) e a regra. No total, só a regra. */
export function fraseDaBase(base: BaseDoPreco, servico: string | null | undefined, v: ValorDaBase = {}): string {
  return [valorDaBase(base, v), regraDaBase(base, servico, v)].filter(Boolean).join(" ");
}

/**
 * AO PROFISSIONAL, DEPOIS DO ACEITE — «O cliente aceitou 360 €/carga. Confirme o
 * número de cargas com o cliente no local, antes de carregar.» No painel e no
 * texto que a API dá à app CLYON Pro (`fraseDaBaseAoProfissional` em
 * `GET /api/profissionais/meus-pedidos`). O valor é o que ele vê no cartão.
 * Null no valor total (o aviso dos itens a mais já o diz).
 */
export function fraseDaBaseAoProfissional(
  base: BaseDoPreco,
  valor: number | null | undefined,
  minimoHoras?: number | null,
): string | null {
  const v = temNumero(valor) ? eurosCurtos(valor) : null;
  if (base === "carga") {
    return `${v ? `O cliente aceitou ${v}/carga.` : "O valor aceite é por carga."} Confirme o número de cargas com o cliente no local, antes de carregar.`;
  }
  if (base === "hora") {
    const minimo = `com mínimo de ${minimoEmPalavras(minimoHoras)}`;
    return `${v ? `O cliente aceitou ${v}/h, ${minimo}.` : `O valor aceite é por hora, ${minimo}.`} Registe as horas no dia: o total fica na folha que o cliente valida no fim.`;
  }
  return null;
}
