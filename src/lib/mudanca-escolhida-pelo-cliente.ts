import { tarifaCongeladaDeJson, valorDaMudanca, type TarifaCongelada } from "./conta-da-mudanca";
import { diaEmLisboa, horaEmLisboa, pecasEmLisboa } from "./hora-de-lisboa";
import { formatarEuros } from "./formatar-euros";

/**
 * O PEDIDO DE MUDANÇA DIRIGIDO A ELE — 11-11-2026 (fase 2, lado do profissional).
 *
 * Numa mudança com a lista de parceiros, o cliente escolheu-o pelo preço que ele
 * pôs na conta: a tarifa ficou CONGELADA na negociação (`tarifaCongeladaJson`),
 * com a equipa escolhida (`pessoasEscolhidas`) e o prazo para responder
 * (`prazoRespostaEm`). Em vez do valor de partida da plataforma, o painel e a
 * app mostram-lhe isto: quem o escolheu, a equipa, a estimativa, a hora dele
 * (e quanto recebe à hora depois da taxa) e até quando deve responder.
 *
 * A proposta, nesta negociação, é À HORA e sem IVA (o pedido é por hora): pode
 * ficar na hora congelada ou descer, nunca subir acima dela — o cliente
 * escolheu-o por aquele preço. `problemaDaHoraProposta` é a guarda que a rota
 * da negociação usa.
 *
 * PURA (sem base, sem rede): a rota `meus-pedidos`, a rota da negociação e os
 * testes fazem a mesma conta, com `valorDaMudanca` (conta-da-mudanca.ts). A
 * app Pro não faz contas: lê os textos daqui, já escritos.
 */

export const TITULO_DA_MUDANCA_ESCOLHIDA = "O cliente escolheu-o";

/** A frase da proposta nesta negociação. */
export const REGRA_DA_PROPOSTA_ESCOLHIDA =
  "Responda com o valor da hora da equipa, sem IVA: pode ficar na sua hora ou descer, nunca subir acima dela.";

export type MudancaEscolhida = {
  titulo: string;
  pessoas: 2 | 3;
  equipaTexto: string;
  /** A hora dele, congelada, sem IVA (euros). É o que a proposta pode ser, no máximo. */
  hora: number;
  horaTexto: string;
  /** O que fica para ele por hora, depois da taxa da plataforma (euros, sem IVA). */
  recebeHora: number;
  recebeTexto: string;
  /** A estimativa: as horas habituais da casa e o percurso, com a tarifa dele (sem o material). */
  estimativa: { horas: number; km: number; texto: string; recebeTexto: string } | null;
  /** Até quando deve responder, em ISO — `null` quando já respondeu ou não há prazo. */
  prazoRespostaEm: string | null;
  prazoTexto: string | null;
  prazoPassou: boolean;
  regraDaProposta: string;
};

export type DadosDaMudancaEscolhida = {
  tarifaCongeladaJson: string | null | undefined;
  pessoasEscolhidas: number | string | null | undefined;
  prazoRespostaEm: Date | null;
  /** As horas habituais da casa (as que o cliente viu), antes do mínimo dele. */
  horas: number | string | null | undefined;
  /** O percurso, origem → destino. */
  km: number | string | null | undefined;
  /** Já pôs um número nesta negociação: o prazo deixa de contar. */
  jaRespondeu: boolean;
};

const eur = (cent: number) => formatarEuros(cent / 100);
const horasEmTexto = (h: number) => (Number.isInteger(h) ? String(h) : String(h).replace(".", ","));
const dois = (n: number) => String(n).padStart(2, "0");
const numeroOuNull = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** 2 ou 3 — a equipa que o cliente escolheu. Sem ela, a de 2. */
export function pessoasDaEscolha(v: unknown): 2 | 3 {
  return Number(v) === 3 ? 3 : 2;
}

/** A hora dele para esta equipa (cêntimos, sem IVA), ou null se não fizer com 3. */
export function horaCongeladaCent(t: TarifaCongelada, pessoas: 2 | 3): number | null {
  return pessoas === 3 ? t.precoHora3Cent : t.precoHora2Cent;
}

/** O que fica para ele de uma hora (cêntimos, sem IVA), pelas regras congeladas. */
export function recebePorHoraCent(t: TarifaCongelada, horaCent: number): number {
  return t.regras.modo === "de_dentro" ? horaCent - Math.round(horaCent * t.regras.taxa) : horaCent;
}

/** «Responda até 14:30» no mesmo dia em Lisboa; «Responda até 12/11 às 10:00» noutro. */
export function textoDoPrazo(prazo: Date, agora: Date = new Date()): { texto: string; passou: boolean } {
  const hora = horaEmLisboa(prazo);
  if (prazo.getTime() <= agora.getTime()) return { texto: `O prazo para responder terminou às ${hora}.`, passou: true };
  if (diaEmLisboa(prazo) === diaEmLisboa(agora)) return { texto: `Responda até ${hora}`, passou: false };
  const p = pecasEmLisboa(prazo);
  return { texto: `Responda até ${dois(p.dia)}/${dois(p.mes)} às ${hora}`, passou: false };
}

/**
 * O bloco «O cliente escolheu-o», ou null numa negociação que não é de uma
 * mudança escolhida (sem tarifa congelada, ou uma tarifa que não se lê).
 */
export function mudancaEscolhida(d: DadosDaMudancaEscolhida, agora: Date = new Date()): MudancaEscolhida | null {
  const t = tarifaCongeladaDeJson(d.tarifaCongeladaJson ?? null);
  if (!t) return null;
  const pessoas = pessoasDaEscolha(d.pessoasEscolhidas);
  const horaCent = horaCongeladaCent(t, pessoas) ?? t.precoHora2Cent;
  const recebeCent = recebePorHoraCent(t, horaCent);
  const horaComIva = horaCent + Math.round(horaCent * t.regras.iva);

  const horas = numeroOuNull(d.horas);
  const km = numeroOuNull(d.km);
  let estimativa: MudancaEscolhida["estimativa"] = null;
  if (horas != null && km != null) {
    const conta = valorDaMudanca(t, { pessoas, horas, km });
    if (conta.ok) {
      estimativa = {
        horas: conta.horas.cobradas,
        km: conta.km.cobrados,
        texto:
          `Cerca de ${horasEmTexto(conta.horas.cobradas)} h com ${pessoas} pessoas e ${horasEmTexto(Math.round(conta.km.cobrados))} km: ` +
          `${eur(conta.semIvaCent)} sem IVA (${eur(conta.totalCent)} com IVA), sem o material.`,
        recebeTexto: `Fica-lhe cerca de ${eur(conta.profissionalCent)}, depois da taxa da plataforma.`,
      };
    }
  }

  const prazo = !d.jaRespondeu && d.prazoRespostaEm ? textoDoPrazo(d.prazoRespostaEm, agora) : null;

  return {
    titulo: TITULO_DA_MUDANCA_ESCOLHIDA,
    pessoas,
    equipaTexto: `Equipa de ${pessoas} pessoas`,
    hora: horaCent / 100,
    horaTexto: `A sua hora: ${eur(horaCent)}/h sem IVA (${eur(horaComIva)}/h com IVA)`,
    recebeHora: recebeCent / 100,
    recebeTexto: `Recebe ${eur(recebeCent)}/h depois da taxa da plataforma`,
    estimativa,
    prazoRespostaEm: prazo && d.prazoRespostaEm ? d.prazoRespostaEm.toISOString() : null,
    prazoTexto: prazo?.texto ?? null,
    prazoPassou: prazo?.passou ?? false,
    regraDaProposta: REGRA_DA_PROPOSTA_ESCOLHIDA,
  };
}

/**
 * Uma leitura que NUNCA derruba quem a chama: o erro (também um que rebente
 * antes de haver promessa) fica no registo e devolve-se o que se dá.
 */
export async function semDerrubar<T>(ler: () => Promise<T>, seFalhar: T, onde: string): Promise<T> {
  try {
    return await ler();
  } catch (e) {
    console.error(`[${onde}] mudança escolhida não se leu:`, e instanceof Error ? e.message : e);
    return seFalhar;
  }
}

/**
 * A GUARDA DA PROPOSTA — o valor que ele propõe numa mudança escolhida é a hora
 * da equipa, sem IVA, e não pode passar da hora congelada (pode descer). Null
 * quando está bem, ou quando a negociação não tem tarifa congelada.
 */
export function problemaDaHoraProposta(
  tarifaCongeladaJson: string | null | undefined,
  pessoasEscolhidas: unknown,
  valor: number,
): string | null {
  const t = tarifaCongeladaDeJson(tarifaCongeladaJson ?? null);
  if (!t) return null;
  const horaCent = horaCongeladaCent(t, pessoasDaEscolha(pessoasEscolhidas)) ?? t.precoHora2Cent;
  if (!Number.isFinite(valor)) return null; // o motor da negociação diz o que está mal num número que não é número
  if (Math.round(valor * 100) > horaCent) {
    return (
      `O cliente escolheu-o pela sua hora de ${eur(horaCent)} sem IVA (${eur(horaCent + Math.round(horaCent * t.regras.iva))} com IVA), que ficou guardada neste pedido. ` +
      `Pode propor esse valor ou menos, à hora — nunca mais.`
    );
  }
  return null;
}
