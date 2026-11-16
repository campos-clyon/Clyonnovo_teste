import { contaDoValorAcordado, type RegimeDoProfissional } from "./pagamento-directo";
import type { Taxas } from "./taxas-plataforma";
import { EMPRESA_PARCEIRA } from "./contas-do-trabalho-clyon";
import { emEuros, type ContaDoPagamento } from "./conta-do-pagamento";
import { diaEmLisboa } from "./hora-de-lisboa";
import type { DeQuemEAFatura } from "./faturas-do-trabalho";

/**
 * AS DUAS FATURAS DO TRABALHO, COMO A EQUIPA AS LÊ — d49 (CEO e dono, 16-11-2026).
 *
 * *«Essa tela de juntar fatura está muito estranha, corrija.»* O quadro dizia só
 * «por juntar» e uma caixa vazia: não dizia que fatura era qual, de quanto, nem
 * quem a junta. Cada linha passa a ter o nome, o valor (com IVA, ou isento), o
 * estado e quem a pode juntar. Os valores saem da MESMA conta do modelo de 15-11
 * (`contaDoValorAcordado`) que a carteira, as referências e a «Conta do
 * pagamento» usam — não se inventa outro número.
 *
 * E UM MODELO SÓ NO CARTÃO: o quadro das faturas e a «Conta do pagamento» por
 * cima dele decidem-se pela mesma resposta do servidor (`blocoDoTrabalhoFechado`).
 * Até 16-11 a conta era sempre a do modelo antigo («A pagar ao profissional»)
 * e o quadro, por baixo, a do novo — o #618.
 *
 * Puro: o ecrã e a rota importam isto.
 */

export type LinhaDaFatura = {
  deQuem: DeQuemEAFatura;
  /** «Fatura do parceiro — o trabalho», «Fatura da CLYON — taxa da plataforma». */
  nome: string;
  /** O valor da fatura, em euros. */
  valor: number;
  /** «105,50 € com IVA», «105,50 € — isento de IVA». */
  valorPorExtenso: string;
  /** Quem emite e quem a junta aqui. */
  quemJunta: string;
};

export const NOME_DA_FATURA_DO_PARCEIRO = "Fatura do parceiro — o trabalho";
export const NOME_DA_FATURA_DA_CLYON = "Fatura da CLYON — taxa da plataforma";

export function linhasDasFaturas(
  acordado: number | null | undefined,
  taxas: Taxas,
  regime: RegimeDoProfissional,
  reservaCent = 0,
): LinhaDaFatura[] | null {
  const c = contaDoValorAcordado(acordado, taxas, regime, reservaCent);
  if (!c) return null;
  const doParceiro = c.faturaDoProfissionalCent / 100;
  const daClyon = c.faturaDaClyonCent / 100;
  return [
    {
      deQuem: "parceiro",
      nome: NOME_DA_FATURA_DO_PARCEIRO,
      valor: doParceiro,
      valorPorExtenso: regime === "isento" ? `${emEuros(doParceiro)} — isento de IVA` : `${emEuros(doParceiro)} com IVA`,
      quemJunta: "Emite-a o parceiro ao cliente e junta-a no painel ou na app CLYON Pro; a equipa também a pode juntar aqui.",
    },
    {
      deQuem: "clyon",
      nome: c.reservaCent !== 0 ? `${NOME_DA_FATURA_DA_CLYON} e reserva` : NOME_DA_FATURA_DA_CLYON,
      valor: daClyon,
      valorPorExtenso: `${emEuros(daClyon)} com IVA`,
      quemJunta: `Emite-a a ${EMPRESA_PARCEIRA}; junta-a a equipa, aqui.`,
    },
  ];
}

/** «Junta a 16/11», pela hora de Lisboa; `null` sem data. */
export function juntaA(carregadaEm: string | null | undefined): string | null {
  if (!carregadaEm) return null;
  const d = new Date(carregadaEm);
  if (Number.isNaN(d.getTime())) return null;
  const [, mes, dia] = diaEmLisboa(d).split("-");
  return `Junta a ${dia}/${mes}`;
}

/** O que a rota das faturas devolve ao cartão do trabalho fechado. */
export type RespostaDasFaturas = {
  novoModelo: boolean;
  /** A conta do modelo de 15-11 (`contaDoNovoModelo`); só com `novoModelo`. */
  conta?: ContaDoPagamento | null;
  linhas?: LinhaDaFatura[] | null;
};

/**
 * O QUE O CARTÃO DESENHA — uma decisão só para a conta e para as faturas.
 *
 * Com a resposta do servidor a dizer modelo novo: a conta do modelo novo e as
 * duas faturas. Com ela a dizer antigo: a conta antiga e nenhuma fatura. Sem
 * resposta ainda: a antiga só quando a Mesa não marcou o trabalho como do modelo
 * novo; marcado, espera (nunca a antiga por cima das faturas).
 */
export function blocoDoTrabalhoFechado(
  doServidor: RespostaDasFaturas | null,
  contaAntiga: ContaDoPagamento | null,
  marcadoNovoNaMesa: boolean,
): { conta: ContaDoPagamento | null; faturas: LinhaDaFatura[] | null; aLer: boolean } {
  if (doServidor == null) {
    return marcadoNovoNaMesa ? { conta: null, faturas: null, aLer: true } : { conta: contaAntiga, faturas: null, aLer: false };
  }
  if (doServidor.novoModelo) {
    return { conta: doServidor.conta ?? null, faturas: doServidor.linhas ?? null, aLer: false };
  }
  return { conta: contaAntiga, faturas: null, aLer: false };
}
