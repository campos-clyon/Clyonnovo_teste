/**
 * AS PERGUNTAS DE DEPOIS DO PEDIDO — 27-10-2026 (decisão d2, o pedido #853).
 *
 * Depois do «Pedido #853 registado!», a cliente perguntou «Pode ser um
 * vídeo?» e, quando chegou a proposta «por carga», «Não entendi, o que é a
 * carga? A carrinha?». A Vitória calou-se nas duas; respondeu uma pessoa da
 * equipa. São perguntas que se repetem, e o site já tem a resposta a quase
 * todas — aqui junta-se cada uma à frase que o site diz, sem texto novo à mão.
 *
 * Só as que se reconhecem com segurança. O resto continua a ir para a equipa
 * («Boa pergunta! Deixo-a anotada para uma pessoa da CLYON»), como sempre.
 *
 * ESTE FICHEIRO É PURO: lê o texto e devolve a resposta, ou nada.
 */
import { O_QUE_E_UMA_CARGA } from "./base-do-preco";
import { semAcentos } from "./leitor-da-recolha";
import { NO_MESMO_DIA, QUEM_FAZ_O_TRABALHO, RECEBE_PROPOSTAS } from "./promessas-publicas";
import { RESPOSTA_SOBRE_CONTENTORES } from "./sacos-de-entulho";
import { COMO_SE_PAGA, NA_PROPOSTA_COM_IVA, PRAZO_DE_RESPOSTA } from "./seo-data";

/** Fotografias e vídeos: sim, por aqui. */
export const PODE_MANDAR_IMAGENS =
  "Pode, sim! Mande as fotografias ou os vídeos por aqui — ficam juntos ao seu pedido e ajudam os profissionais a acertar o preço.";

/** A carga, explicada com a mesma frase da nota da proposta (`O_QUE_E_UMA_CARGA`). */
export const O_QUE_E_A_CARGA =
  `${O_QUE_E_UMA_CARGA.charAt(0).toUpperCase()}${O_QUE_E_UMA_CARGA.slice(1)}. ` +
  "O preço por carga é o de cada carrinha cheia: o total depende de quantas cargas forem, " +
  "e o número de cargas confirma-se consigo antes de começar.";

/** O IVA: incluído na proposta, e o valor sem IVA sempre ao lado. */
export const O_IVA_NA_PROPOSTA = `${NA_PROPOSTA_COM_IVA} E vem sempre também o valor sem IVA ao lado.`;

/** Uma linha por mensagem: a rajada junta-as com quebras de linha. */
function linhas(texto: string): string[] {
  return texto
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** «Pode ser um vídeo?», «posso mandar fotos?», «envio-lhe um vídeo?». */
export function perguntaSePodeMandarImagens(texto: string): boolean {
  return linhas(texto).some((l) => {
    const t = semAcentos(l);
    const imagens = /\b(videos?|fotos?|fotografias?|imagens?|filmagem|filme)\b/.test(t);
    if (!imagens) return false;
    const pergunta = /\?\s*$/.test(l) || /^(posso|pode|podia|da para|aceitam|aceita|serve|e possivel)\b/.test(t);
    // «envio as fotos» sem pergunta é ele a dizer que as mandou, e não a perguntar.
    return pergunta && /\b(posso|pode|podia|da para|aceitam|aceita|envio|mando|enviar|mandar|serve|e possivel|ser)\b/.test(t);
  });
}

/** «O que é a carga?», «o que quer dizer por carga?», «a carga é a carrinha?». */
export function perguntaOQueEACarga(texto: string): boolean {
  const t = semAcentos(texto);
  return (
    /\bo\s+que\s+(e|quer\s+dizer|significa)\s+(a|uma|o|por)?\s*carga\b/.test(t) ||
    /\bcarga\s+(e|quer\s+dizer|significa)\b[^?\n]*\?/.test(t) ||
    /\b(nao\s+(entendi|percebi)|como\s+assim)\b[^\n]*\bcargas?\b/.test(t) ||
    /\bpor\s+carga\s*\?/.test(t) ||
    /\bquantas\s+cargas\b[^\n]*\?/.test(t)
  );
}

/** «É possível hoje?», «no mesmo dia?» — o site responde com `NO_MESMO_DIA`. */
export function perguntaPeloMesmoDia(texto: string): boolean {
  const t = semAcentos(texto);
  return /\?/.test(texto) && /\b(hoje|no\s+mesmo\s+dia|ainda\s+hoje|hoje\s+mesmo|amanha\s+de\s+manha|amanha)\b/.test(t);
}

/** «Quando recebo as propostas?», «quanto tempo demora a resposta?». */
export function perguntaPeloPrazoDasPropostas(texto: string): boolean {
  const t = semAcentos(texto);
  return (
    /\b(quando|quanto\s+tempo|em\s+quanto\s+tempo|demora)\b[^\n]*\b(propostas?|orcamentos?|resposta|valor|preco)\b/.test(t) ||
    /\b(propostas?|orcamentos?|resposta)\b[^\n]*\b(demora|demoram|quando)\b/.test(t)
  );
}

/** «O preço tem IVA?», «já inclui IVA?», «é com IVA?». */
export function perguntaPeloIva(texto: string): boolean {
  const t = semAcentos(texto);
  return /\biva\b/.test(t) && (/\?/.test(texto) || /\b(inclui|incluido|com\s+iva|sem\s+iva|acresce)\b/.test(t));
}

/** «Têm contentor?», «trazem big bags?». */
export function perguntaPorContentores(texto: string): boolean {
  const t = semAcentos(texto);
  return /\b(contentor\w*|big\s?bags?)\b/.test(t) && (/\?/.test(texto) || /\b(alugam|tem|trazem|fornecem|deixam)\b/.test(t));
}

/** «São vocês que fazem?», «quem vem fazer o trabalho?». */
export function perguntaQuemFaz(texto: string): boolean {
  const t = semAcentos(texto);
  return (
    /\bquem\s+(e\s+que\s+)?(vem|faz|fara|vai\s+fazer|executa|realiza)\b/.test(t) ||
    /\b(sao|e)\s+(voces|a\s+clyon)\s+(que|quem)\s+(fazem|faz|vem|vao)\b/.test(t) ||
    /\b(voces|a\s+clyon)\s+(e\s+que\s+)?(fazem|vem\s+fazer)\s+o\s+(trabalho|servico)\b/.test(t)
  );
}

/** «Como se paga?», «posso pagar em dinheiro?», «aceitam MB Way?». */
export function perguntaComoSePaga(texto: string): boolean {
  const t = semAcentos(texto);
  return (
    /\bcomo\s+(e\s+que\s+)?(se\s+)?(paga|pago|pagamos|e\s+o\s+pagamento|funciona\s+o\s+pagamento)\b/.test(t) ||
    /\b(posso|podemos|da\s+para)\s+pagar\b/.test(t) ||
    /\b(aceitam|aceita)\s+(mb\s?way|multibanco|dinheiro|transferencia|cartao)\b/.test(t) ||
    /\b(forma|formas|metodo|modo)s?\s+de\s+pagamento\b/.test(t) ||
    /\bpaga-se\s+(quando|como|antes|depois)\b/.test(t)
  );
}

/**
 * COMO FUNCIONA — 28-10-2026 (decisão d35).
 *
 * *«so how does it work now?»* — a meio do registo, depois do resumo. A
 * Vitória repetiu-lhe o resumo inteiro, em português. A resposta é o caminho
 * da plataforma: o pedido vai aos profissionais verificados da zona, as
 * propostas chegam em menos de 6 horas, e ele escolhe — grátis e sem
 * compromisso. Depois lembra-se o que falta (`lembreteDoQueFalta`), sem
 * repetir o resumo.
 */
export const COMO_FUNCIONA =
  "Funciona assim: o seu pedido vai para os profissionais verificados da sua zona, e as propostas " +
  `chegam-lhe por aqui em menos de ${PRAZO_DE_RESPOSTA.porExtenso}. Depois escolhe a que preferir — ` +
  "é grátis e sem compromisso.";

/** «Como funciona?», «How does it work?», «Comment ça marche ?» — a pergunta pelo caminho todo. */
export function perguntaComoFunciona(texto: string): boolean {
  return linhas(texto).some((l) => {
    const t = semAcentos(l).replace(/[’']/g, "").replace(/\s+/g, " ").trim();
    return (
      // No fim da frase: «como funciona o pagamento?» é outra pergunta (`perguntaComoSePaga`).
      /\bcomo (e que )?(isto |isso |tudo |o servico |a plataforma )?funciona( agora| entao| daqui para a frente| a seguir)?\s*[?!.]*$/.test(t) ||
      /\bhow (does|do|will|would) (it|this|that|everything|the process) work( now| then| from here| next)?\s*[?!.]*$/.test(t) ||
      /\bhow (it|this) works\b/.test(t) ||
      /\bcomment (ca|cela|ceci) (marche|fonctionne)\b/.test(t) ||
      /\bcomo funciona (esto|eso|ahora)\b/.test(t)
    );
  });
}

/**
 * «E agora?», «what now?», «what happens next?» — no meio do registo é a mesma
 * pergunta: o que acontece a seguir. Fora dele (com propostas em cima da
 * mesa) não: aí «e agora?» é o ponto de situação, e não se lhe responde isto.
 */
export function perguntaOQueAconteceAgora(texto: string): boolean {
  if (perguntaComoFunciona(texto)) return true;
  return linhas(texto).some((l) => {
    const t = semAcentos(l).replace(/[’']/g, "").replace(/\s+/g, " ").trim();
    return (
      /^(e|and|so|et|y|entao|ok|okay)?\s*(agora|now|maintenant|ahora)\s*[?]+$/.test(t) ||
      /^(e|so|and)?\s*(depois|then)\s*[?]+$/.test(t) ||
      /\bo que (e que )?(acontece|se passa|vem) (agora|a seguir|depois)\b/.test(t) ||
      /\b(quais|qual) (sao |e )?(os|o) proximos? passos?\b/.test(t) ||
      /\bwhat (happens|comes) (now|next)\b|\bwhat now\s*[?]|\bwhat are the next steps\b|\bwhat do i do now\b|\bwhats next\b/.test(t) ||
      /\bque se passe-t-il\b|\bet maintenant\s*[?]|\bet apres\s*[?]/.test(t) ||
      /\bque pasa ahora\b|\by ahora\s*[?]/.test(t)
    );
  });
}

/**
 * A RESPOSTA DO SITE à pergunta que ele fez — ou `null`, quando não é uma das
 * que se reconhecem. Duas perguntas na mesma rajada levam as duas respostas,
 * pela ordem desta lista.
 */
export function respostaFrequente(texto: string): string | null {
  const t = texto.trim();
  if (!t) return null;
  const respostas: string[] = [];
  if (perguntaSePodeMandarImagens(t)) respostas.push(PODE_MANDAR_IMAGENS);
  if (perguntaOQueEACarga(t)) respostas.push(O_QUE_E_A_CARGA);
  if (perguntaPeloMesmoDia(t)) respostas.push(NO_MESMO_DIA);
  else if (perguntaPeloPrazoDasPropostas(t)) respostas.push(RECEBE_PROPOSTAS);
  if (perguntaPeloIva(t)) respostas.push(O_IVA_NA_PROPOSTA);
  if (perguntaPorContentores(t)) respostas.push(RESPOSTA_SOBRE_CONTENTORES);
  if (perguntaQuemFaz(t)) respostas.push(QUEM_FAZ_O_TRABALHO);
  if (perguntaComoSePaga(t)) respostas.push(COMO_SE_PAGA);
  if (perguntaComoFunciona(t)) respostas.push(COMO_FUNCIONA);
  return respostas.length > 0 ? respostas.join("\n\n") : null;
}
