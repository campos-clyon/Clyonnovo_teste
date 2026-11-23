/**
 * O «VOU PENSAR» — d90 (CEO e dono, 23-11-2026).
 *
 * Depois da proposta (ou do orçamento), o cliente responde «vou pensar», «estou
 * a aguardar orçamentos de outras empresas», «depois digo», «ainda não
 * decidi». Até hoje a conversa ia para a equipa e o pedido ficava no «Precisa
 * de si» sem ninguém lhe pegar. Agora a Vitória responde com delicadeza (o
 * banco de objecções da d91, «Depois digo» e «outras empresas»), o pedido passa
 * a «A aguardar cliente» e o seguimento da d83 arranca sozinho, com a resposta
 * «vai_pensar» e a 1.ª mensagem no dia seguinte às 10h.
 *
 * Ficam com uma pessoa, como sempre: a contraproposta de preço (um número, um
 * «está caro»), a queixa, o pedido de alteração (a data, o que é para levar) e
 * «quero falar com alguém». Uma pergunta também — tem de levar resposta.
 *
 * PURO: lê o texto e escreve a resposta. A base está em
 * `seguimento-do-cliente-na-base.ts` (`arrancarOSeguimentoSozinho`).
 */

import { instanteEmLisboa, diaEmLisboa, somarDiasAoDia } from "./hora-de-lisboa";
import { semAcentos } from "./leitor-da-recolha";
import { SEM_PAGAMENTO_ADIANTADO } from "./o-pagamento-da-vitoria";

/** As duas formas: a que compara com outras empresas, e a que ainda não decidiu. */
export type OVaiPensar = "outras_empresas" | "depois";

/** O que vai no histórico do pedido quando o seguimento arranca sozinho (letra a letra, d90). */
export const NOTA_DO_VAI_PENSAR = "Seguimento automático — o cliente disse que ia pensar";

/** E quando arranca depois de a equipa responder à pergunta dele, sem mais nada do cliente. */
export const NOTA_DEPOIS_DA_EQUIPA = "Seguimento automático — o cliente não voltou a escrever depois da resposta da equipa";

/** A hora da 1.ª mensagem do seguimento que arranca sozinho, no dia seguinte (Lisboa). */
export const HORA_DO_SEGUIMENTO_SOZINHO = "10:00";

/** Quem marca o seguimento, no ciclo e no histórico. */
export const POR_A_VITORIA = "a Vitória (automático)";

const limpar = (texto: string) =>
  semAcentos(texto)
    .replace(/[’']/g, "'")
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

/** Comparar com outras empresas — pt, en, fr, es. */
const OUTRAS_EMPRESAS: readonly RegExp[] = [
  /\b(a aguardar|a espera de|aguardo|espero|estou a ver) (mais |outros |outras |os |as )?(orcamentos?|propostas?|precos?)\b/,
  /\b(outr[ao]s?) (orcamentos?|propostas?|empresas?)\b/,
  /\b(estou|estamos|vou|vamos) a comparar\b|\b(vou|vamos) comparar\b|\bcomparar (os |as )?(precos|orcamentos|propostas)\b/,
  /\b(waiting|wait) (for|on) (other|more|a few|some other) (quotes?|offers?|companies|prices)\b/,
  /\b(other|more) quotes\b|\b(comparing|compare) (quotes|prices|offers)\b|\bshopping around\b/,
  /\b(j'?attends?|attendre|en attente) (d'?autres|des autres|plusieurs) (devis|offres|propositions)\b|\bd'?autres devis\b|\bje compare\b/,
  /\b(espero|esperando|estoy esperando|a la espera de) (otros|mas|varios) (presupuestos|ofertas|precios)\b|\botros presupuestos\b|\bestoy comparando\b/,
];

/** Ainda não decidiu — pt, en, fr, es. */
const DEPOIS: readonly RegExp[] = [
  /\b(vou|vamos|tenho de|tenho que|preciso de|deixe-me|deixa-me|deixem-me|deixa me|deixe me) (pensar|ponderar|analisar|ver com calma|pensar melhor|decidir)\b/,
  /\b(vou|vamos) (ver|falar com (o meu|a minha|os meus|as minhas|o|a) (marido|mulher|esposa|esposo|familia|companheir[oa]|socio|socia|pais|filhos?|filhas?|senhorio|patrao))\b/,
  /\bainda (nao )?(decidi|decidimos|sei|sabemos|estou a decidir|estamos a decidir|estou a pensar|estamos a pensar)\b/,
  /\b(depois|mais tarde|logo|amanha|em breve|ja) (lhe |vos |te )?(digo|dizemos|dou noticias|damos noticias|dou mais informac\w*|damos mais informac\w*|falamos|falo|respondo|respondemos|confirmo|confirmamos|entro em contacto|contacto|dou resposta|damos resposta|aviso|avisamos|digo alguma coisa)\b/,
  /\b(digo|dizemos|aviso|confirmo|respondo) (depois|mais tarde|logo|amanha|em breve)\b/,
  /\b(let me|i'?ll|i will|we'?ll|we will|need to|have to) (think|think about it|think it over|consider it|decide)\b/,
  /\b(i'?ll|i will|we'?ll|we will) (let you know|get back to you|be in touch)\b|\bnot (yet )?decided( yet)?\b|\bhaven'?t decided\b/,
  /\b(je vais|nous allons|laissez-moi|je dois) (reflechir|y reflechir|y penser|decider)\b|\bje (vous )?(dirai|tiens au courant|reviens vers vous)\b|\bpas encore (decide|decidee)\b/,
  /\b(lo voy a pensar|voy a pensarlo|tengo que pensarlo|lo pienso|dejame pensarlo|dejeme pensarlo)\b|\b(le|te|les) (digo|aviso|confirmo) (luego|despues|manana|mas tarde)\b|\b(aun|todavia) no (lo )?(he decidido|se)\b/,
];

/** O que fica com uma pessoa, mesmo com um «vou pensar» na frase. */
const COM_UMA_PESSOA: readonly RegExp[] = [
  // Preço: um número, ou a palavra.
  /\d/,
  /\b(caro|cara|carissim\w*|barat\w*|desconto|baixar|baixa o|baixe|menos|preco melhor|melhor preco|valor mais|expensive|cheaper|discount|lower|cher|moins cher|remise|descuento|mas barato)\b/,
  // Alteração do pedido.
  /\b(mudar|alterar|trocar|outra data|outro dia|outra hora|acrescentar|tirar|change|another date|modifier|changer|autre date|cambiar|otra fecha)\b/,
  // Quer uma pessoa.
  /\b(falar com (alguem|uma pessoa|o responsavel|um colega|voces|a equipa)|ligue|liguem|ligar-me|telefone-me|telefonem|call me|speak to (someone|a person)|appelez|llamen|llameme)\b/,
  // Cancelar é outro caminho (d93).
  /\b(cancel\w*|annul\w*|ja nao preciso|nao preciso|desisto|no longer need|plus besoin|ya no (lo )?necesito)\b/,
];

/**
 * O CLIENTE DISSE QUE VAI PENSAR? Pura. «outras_empresas», «depois», ou null
 * (não é isso, ou tem uma coisa que fica com uma pessoa: preço, alteração,
 * queixa, pedir uma pessoa, uma pergunta). Frases curtas: uma mensagem longa
 * diz mais do que isto, e vai à equipa.
 */
export function disseQueVaiPensar(texto: string | null | undefined, opcoes: { queixa?: boolean } = {}): OVaiPensar | null {
  const cru = String(texto ?? "").trim();
  if (!cru || cru.length > 220 || opcoes.queixa) return null;
  if (/\?/.test(cru)) return null;
  const t = limpar(cru);
  if (COM_UMA_PESSOA.some((re) => re.test(t))) return null;
  if (OUTRAS_EMPRESAS.some((re) => re.test(t))) return "outras_empresas";
  if (DEPOIS.some((re) => re.test(t))) return "depois";
  return null;
}

/* ── As respostas (o banco de objecções da d91, secção 4) ────────────────── */

/** «Faz bem em comparar.» — a quem está a comparar com outras empresas. */
export const FAZ_BEM_EM_COMPARAR =
  "Faz bem em comparar. Para comparar com justiça: o valor de cada proposta já é o total a pagar, com o IVA e a taxa da plataforma.";

/** «Com certeza.» — a quem ainda não decidiu. */
export const COM_CERTEZA = "Com certeza, fica tudo guardado no seu pedido.";

/** A pergunta que ajuda a decidir, sem pressão. */
export const O_QUE_FALTA_DECIDIR = "Se ajudar, diga-me o que falta decidir (o valor, o dia ou outra coisa) e passo à equipa.";

/** A validade, quando a proposta a tem: «A proposta é válida até sexta-feira, 27/11.» */
export function aPropostaEValidaAte(dia: string): string {
  return `A proposta é válida até ${dia}.`;
}

/**
 * A RESPOSTA DA VITÓRIA AO «VOU PENSAR». Pura. Sem promessas que o código não
 * cumpre (o pagamento: `SEM_PAGAMENTO_ADIANTADO`, a frase de sempre) e sem
 * pressa; a validade só quando a há («sexta-feira, 27/11», `diaDaSemanaEDia`).
 */
export function respostaAoVaiPensar(tipo: OVaiPensar, validaAte?: string | null): string {
  const validade = validaAte ? ` ${aPropostaEValidaAte(validaAte)}` : "";
  if (tipo === "outras_empresas") return `${FAZ_BEM_EM_COMPARAR} ${SEM_PAGAMENTO_ADIANTADO}${validade}`;
  return `${COM_CERTEZA}${validade} ${O_QUE_FALTA_DECIDIR}`;
}

/** O instante da 1.ª mensagem: amanhã (Lisboa) às 10h00. */
export function voltarAmanhaAsDez(agora: Date): Date {
  const amanha = somarDiasAoDia(diaEmLisboa(agora), 1);
  return instanteEmLisboa(`${amanha}T${HORA_DO_SEGUIMENTO_SOZINHO}`) ?? new Date(agora.getTime() + 24 * 3600_000);
}

/** Hoje (Lisboa) às 10h00 — o seguimento que arranca depois da resposta da equipa. */
export function hojeAsDez(agora: Date): Date {
  return instanteEmLisboa(`${diaEmLisboa(agora)}T${HORA_DO_SEGUIMENTO_SOZINHO}`) ?? agora;
}

/* ── O cliente não voltou a escrever depois da resposta da equipa ────────── */

export type MensagemDoFio = { direccao: string; texto: string; haSegundos: number | null };

/**
 * A EQUIPA RESPONDEU À PERGUNTA DELE, E ELE NÃO DISSE MAIS NADA ATÉ HOJE? Pura.
 * A última mensagem do fio é da equipa, escrita à mão («[à mão]»), foi ONTEM
 * (Lisboa), e antes dela, no mesmo dia ou na véspera, há uma mensagem do
 * cliente com uma pergunta. Só uma vez, no dia seguinte: um fio de há uma
 * semana não arranca nada.
 */
export function aEquipaRespondeuEOClienteCalou(
  fio: ReadonlyArray<MensagemDoFio> | null | undefined,
  agora: Date,
  eDaEquipa: (texto: string) => boolean,
): boolean {
  if (!Array.isArray(fio) || fio.length < 2) return false;
  const ultima = fio[fio.length - 1];
  if (ultima.direccao !== "out" || !eDaEquipa(ultima.texto) || ultima.haSegundos == null) return false;
  const quando = new Date(agora.getTime() - ultima.haSegundos * 1000);
  if (diaEmLisboa(quando) !== somarDiasAoDia(diaEmLisboa(agora), -1)) return false;
  // A pergunta dele, antes da resposta (até 36 horas antes dela).
  for (let i = fio.length - 2; i >= 0; i--) {
    const m = fio[i];
    if (m.direccao !== "in") continue;
    if (m.haSegundos != null && m.haSegundos - ultima.haSegundos > 36 * 3600) return false;
    return /\?/.test(m.texto) || /^(como|quando|quanto|qual|quais|onde|porque|pode|podem|e se|ha|tem)\b/.test(limpar(m.texto));
  }
  return false;
}

/* ── A variante A/B (d91, secção 5) ──────────────────────────────────────── */

/** Par → A, ímpar → B. Fixo pelo número do pedido. */
export function varianteDoPedido(pedidoId: number): "A" | "B" {
  return Math.abs(Math.trunc(pedidoId)) % 2 === 0 ? "A" : "B";
}
