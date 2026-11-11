import { tarifaCongeladaDeJson, valorDaMudanca, type TarifaCongelada } from "./conta-da-mudanca";
import { diaEmLisboa, horaEmLisboa, pecasEmLisboa } from "./hora-de-lisboa";
import { formatarEuros } from "./formatar-euros";
import {
  ACCAO_DE_CONFIRMAR_A_HORA,
  botaoConfirmo,
  regraDoValorMaisBaixo,
  textoDaPropostaMaisBaixa,
  textoDepoisDeConfirmar,
  textoDoPrazoTerminado,
  TEXTOS_DO_ESCOLHIDO,
} from "./escolhidos-sem-resposta";

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
  /**
   * A PRIMEIRA RESPOSTA, NUM TOQUE (d6, 11-11-2026): «Confirmo: faço por X/h +
   * IVA» em vez do formulário, com «Propor um valor mais baixo» ao lado. Null
   * quando já respondeu — aí o ecrã é o da negociação de sempre. Os mesmos
   * textos no painel e na app Pro (`escolhidos-sem-resposta.ts`).
   */
  primeiraResposta: {
    /** A acção a enviar à rota da negociação, sem valor: o servidor lê a hora congelada. */
    accao: string;
    confirmar: string;
    proporMaisBaixo: string;
    naoEstouInteressado: string;
    rotuloDoValor: string;
    regraDoValorMaisBaixo: string;
    enviarProposta: string;
    voltar: string;
  } | null;
  /** Depois de confirmar ou de propor mais baixo, enquanto o cliente não responde: a frase no lugar dos botões. */
  respostaTexto: string | null;
  /** O rótulo do cartão na lista de pedidos: «Responda até 14:30» ou «Prazo terminado». */
  rotuloDoPrazo: string | null;
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
  /** O estado e as propostas da negociação, para a frase de depois de responder (d6). */
  estado?: string | null;
  propostasJson?: string | null;
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

/**
 * A hora dele nesta negociação, em euros sem IVA — a da tarifa congelada, para
 * a equipa que o cliente escolheu. É o valor do primeiro aviso e do «Reenviar
 * ao profissional» (d7, 11-11-2026). Null sem tarifa congelada.
 */
export function horaCongeladaEmEuros(tarifaCongeladaJson: string | null | undefined, pessoasEscolhidas: unknown): number | null {
  const t = tarifaCongeladaDeJson(tarifaCongeladaJson ?? null);
  if (!t) return null;
  return (horaCongeladaCent(t, pessoasDaEscolha(pessoasEscolhidas)) ?? t.precoHora2Cent) / 100;
}

/** O que fica para ele de uma hora (cêntimos, sem IVA), pelas regras congeladas. */
export function recebePorHoraCent(t: TarifaCongelada, horaCent: number): number {
  return t.regras.modo === "de_dentro" ? horaCent - Math.round(horaCent * t.regras.taxa) : horaCent;
}

/** «Responda até 14:30» no mesmo dia em Lisboa; «Responda até 12/11 às 10:00» noutro. */
export function textoDoPrazo(prazo: Date, agora: Date = new Date()): { texto: string; passou: boolean } {
  const hora = horaEmLisboa(prazo);
  // Depois do prazo ainda pode responder, mas o cliente já foi avisado (d6).
  if (prazo.getTime() <= agora.getTime()) return { texto: textoDoPrazoTerminado(prazo, agora), passou: true };
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
  const aberta = (d.estado ?? "aberta") === "aberta";
  const respostaTexto = aberta ? textoDaResposta(d.propostasJson, horaCent, t.regras.iva, d.prazoRespostaEm) : null;

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
    primeiraResposta:
      !d.jaRespondeu && aberta
        ? {
            accao: ACCAO_DE_CONFIRMAR_A_HORA,
            confirmar: botaoConfirmo(horaCent),
            proporMaisBaixo: TEXTOS_DO_ESCOLHIDO.proporMaisBaixo,
            naoEstouInteressado: TEXTOS_DO_ESCOLHIDO.naoEstouInteressado,
            rotuloDoValor: TEXTOS_DO_ESCOLHIDO.rotuloDoValor,
            regraDoValorMaisBaixo: regraDoValorMaisBaixo(horaCent),
            enviarProposta: TEXTOS_DO_ESCOLHIDO.enviarProposta,
            voltar: TEXTOS_DO_ESCOLHIDO.voltar,
          }
        : null,
    respostaTexto,
    rotuloDoPrazo: prazo ? (prazo.passou ? TEXTOS_DO_ESCOLHIDO.prazoTerminado : prazo.texto) : null,
  };
}

/**
 * A frase de depois da PRIMEIRA resposta dele, enquanto está com o cliente:
 * confirmou a hora congelada (com a variante de depois do prazo) ou propôs
 * um valor mais baixo. Null a partir da segunda proposta, ou quando a última
 * palavra já é do cliente — aí vale o ecrã da negociação.
 */
function textoDaResposta(propostasJson: string | null | undefined, horaCent: number, iva: number, prazo: Date | null): string | null {
  if (!propostasJson) return null;
  let lista: Array<{ por?: string; valor?: number; estado?: string; criadaEm?: string }>;
  try {
    const l = JSON.parse(propostasJson);
    lista = Array.isArray(l) ? l : [];
  } catch {
    return null;
  }
  const dele = lista.filter((x) => x?.por === "profissional");
  const ultima = lista[lista.length - 1];
  if (dele.length !== 1 || ultima !== dele[0] || ultima.estado !== "pendente" || !Number.isFinite(Number(ultima.valor))) return null;
  const valorCent = Math.round(Number(ultima.valor) * 100);
  if (valorCent !== horaCent) return textoDaPropostaMaisBaixa(valorCent, iva);
  const quando = ultima.criadaEm ? new Date(ultima.criadaEm).getTime() : NaN;
  return textoDepoisDeConfirmar(horaCent, iva, !!prazo && Number.isFinite(quando) && quando > prazo.getTime());
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

/**
 * A GUARDA, COM A LEITURA — 11-11-2026. As duas portas da proposta (a app e o
 * painel, e o link) lêem a tarifa congelada da negociação e conferem o valor
 * antes do motor. SE A LEITURA FALHAR, RECUSA: sem saber qual é a hora
 * congelada não se aceita valor nenhum (antes, uma leitura falhada deixava
 * passar). Uma tarifa gravada que não se consegue ler recusa da mesma maneira.
 *
 * Null quando a proposta pode seguir (não é uma mudança escolhida, ou o valor
 * cabe na hora congelada).
 */
export const SEM_CONFERIR_A_HORA = "Não foi possível conferir o valor agora. Tente outra vez daqui a pouco.";

export type RecusaDaHoraProposta = { status: 409 | 503; erro: string; acimaDaHora: boolean };

export async function guardaDaHoraCongelada(
  ler: () => Promise<{ tarifaCongeladaJson: string | null | undefined; pessoasEscolhidas: unknown } | null>,
  valor: number,
  onde: string,
): Promise<RecusaDaHoraProposta | null> {
  let escolhida: { tarifaCongeladaJson: string | null | undefined; pessoasEscolhidas: unknown } | null;
  try {
    escolhida = await ler();
  } catch (e) {
    console.error(`[${onde}] a hora congelada não se leu; a proposta não segue:`, e instanceof Error ? e.message : e);
    return { status: 503, erro: SEM_CONFERIR_A_HORA, acimaDaHora: false };
  }
  const json = escolhida?.tarifaCongeladaJson;
  if (!escolhida || json == null || json === "") return null;
  if (!tarifaCongeladaDeJson(json)) {
    console.error(`[${onde}] a tarifa congelada não se percebe; a proposta não segue.`);
    return { status: 503, erro: SEM_CONFERIR_A_HORA, acimaDaHora: false };
  }
  const problema = problemaDaHoraProposta(json, escolhida.pessoasEscolhidas, valor);
  return problema ? { status: 409, erro: problema, acimaDaHora: true } : null;
}
