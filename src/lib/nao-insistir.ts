import { falaDeCoisas, falaDoAcesso, perguntaPeloPreco, semAcentos } from "./leitor-da-recolha";
import { eUmaPergunta } from "./voz-da-vitoria";
import { passoDaPergunta } from "./reler-a-conversa";
import { eDaEquipa, eMarcaDeImagem, eUmaPerguntaNossa, semMarcaDeMao } from "./rajada-do-whatsapp";
import {
  guardarARespostaComoVeio,
  passosEmFalta,
  perguntaParaContinuar,
  primeiroPassoEmFalta,
  saltarAPergunta,
  type EstadoDaRecolha,
  type PassoDaRecolha,
  type RespostaDaRecolha,
} from "./whatsapp-recolha";

/**
 * NÃO INSISTIR — 16-11-2026 (d51, acrescento do dono). Da mesma conversa
 * real: a Vitória pediu as fotografias a quem disse que não as podia mandar
 * agora, perguntou o nome duas vezes, e repetiu a mesma pergunta em mensagens
 * seguidas. Três regras, puras:
 *
 *   · «Não consigo enviar agora», «depois envio» às fotografias → «Sem
 *     problema, pode enviar mais tarde.», e segue sem elas;
 *   · o nome pergunta-se no máximo uma vez nesta recolha;
 *   · a mesma pergunta nunca sai em duas mensagens seguidas — à segunda,
 *     fica para depois e passa-se à seguinte.
 *
 * (Uma mensagem IGUAL a outra dos últimos minutos já não saía: `jaFoiDito` e
 * `semFicarCalada`, d48. Isto apanha a mesma pergunta dita de outra maneira —
 * «Peço desculpa, não apanhei bem. Com quem tenho o gosto de falar?».)
 */

type MensagemDoFio = { direccao?: string; texto?: string };

export const PODE_ENVIAR_MAIS_TARDE = "Sem problema, pode enviar mais tarde.";

/** As mensagens da Vitória no fio — as da equipa à mão não são perguntas dela. */
function daVitoria(fio: ReadonlyArray<MensagemDoFio> | null | undefined): string[] {
  if (!Array.isArray(fio)) return [];
  return fio
    .filter((m) => m?.direccao === "out" && typeof m.texto === "string" && !eDaEquipa(m.texto))
    .map((m) => m.texto as string);
}

/** «Não consigo enviar agora», «depois envio», «mando mais logo», «agora não dá para tirar fotos». */
export function adiaAsFotografias(texto: string): boolean {
  const t = semAcentos(texto);
  return (
    /\b(?:nao\s+(?:consigo|posso|da\s+para|tenho\s+como)\s+(?:(?:as\s+)?(?:enviar|mandar|tirar)|agora))\b/.test(t) ||
    /\b(?:depois|mais\s+tarde|mais\s+logo|logo|amanha|quando\s+(?:chegar|puder|estiver))\s+(?:eu\s+)?(?:envio|mando|tiro|as\s+envio|as\s+mando|lhe\s+envio|lhe\s+mando)\b/.test(t) ||
    /\b(?:envio|mando|tiro)\s+(?:as\s+(?:fotos|fotografias|imagens)\s+)?(?:depois|mais\s+tarde|mais\s+logo|amanha)\b/.test(t) ||
    /\bagora\s+nao\s+(?:da|consigo|posso)\b/.test(t)
  );
}

/** A última mensagem da Vitória pediu fotografias? */
function pediuFotografias(fio: ReadonlyArray<MensagemDoFio> | null | undefined): boolean {
  const ditas = daVitoria(fio);
  const ultima = ditas[ditas.length - 1];
  return Boolean(ultima) && /\b(fotos?|fotografias?|imagens?)\b/.test(semAcentos(ultima));
}

/**
 * QUEM NÃO PODE MANDAR AS FOTOGRAFIAS AGORA — ou `null`. Só quando a última
 * mensagem dela as pediu (ou ele fala delas): a pergunta em cima, se era a da
 * descrição, fica para depois; e segue-se para a que falta.
 */
export function fotografiasParaDepois(
  e: EstadoDaRecolha,
  texto: string,
  fio: ReadonlyArray<MensagemDoFio> | null | undefined,
): RespostaDaRecolha | null {
  if (!adiaAsFotografias(texto)) return null;
  const falaDelas = /\b(fotos?|fotografias?|imagens?)\b/.test(semAcentos(texto));
  if (!pediuFotografias(fio) && !falaDelas) return null;
  const dados = { ...e.dados, fotosDitas: false };
  if (e.passo === "descricao") dados.saltados = [...new Set([...(e.dados.saltados ?? []), "descricao" as const])];
  const passo = primeiroPassoEmFalta(dados);
  const seguinte = passo === "confirmar" ? "" : ` ${perguntaParaContinuar(passo, dados)}`;
  return { estado: { passo, dados }, resposta: `${PODE_ENVIAR_MAIS_TARDE}${seguinte}` };
}

/**
 * A MESMA PERGUNTA NÃO SAI DUAS VEZES SEGUIDAS — nem o nome duas vezes na
 * recolha. Recebe a resposta que ia sair; se ela volta a perguntar o que a
 * última da Vitória perguntou (ou o nome, que já se perguntou), essa fica para
 * depois e pergunta-se a seguinte.
 */
export function semRepetirAPergunta(
  r: RespostaDaRecolha,
  fio: ReadonlyArray<MensagemDoFio> | null | undefined,
  /** A mensagem dele de agora, se o fio ainda a não tiver. */
  texto?: string,
): RespostaDaRecolha {
  if (r.registar || r.desistir || r.pedirPessoa || !r.resposta.trim()) return r;
  const agora = passoDaPergunta(r.resposta);
  if (!agora || agora === "confirmar" || agora === "servico" || agora !== r.estado.passo) return r;
  /*
   * JÁ RESPONDIDA NA CONVERSA — 18-11-2026 (decisão d69). Perguntada antes
   * (por ela, ou pela equipa à mão) e respondida a seguir: não se pergunta
   * outra vez. A resposta fica como veio e segue-se — e sem «essa pode ficar
   * para depois», que é para quem não respondeu. Só se pergunta de novo, por
   * outras palavras e uma vez, quando o que ele disse foi claramente outra
   * coisa (uma pergunta dele).
   */
  const { vezes, respostas } = respostasAPergunta(agora, comAMensagemDeAgora(fio, texto));
  if (respostas.length > 0) {
    if (vezes >= 2 || agora === "nome" || !respostas.every(eOutraCoisa)) return seguirComARespostaComoVeio(r, agora, respostas.join("\n"));
    // Foi outra coisa (uma pergunta dele): a pergunta repete-se, desta vez.
    return r;
  }
  const ditas = daVitoria(fio);
  const ultima = ditas.length > 0 ? passoDaPergunta(ditas[ditas.length - 1]) : null;
  const nomeJaPerguntado = agora === "nome" && ditas.some((t) => passoDaPergunta(t) === "nome");
  if (ultima !== agora && !nomeJaPerguntado) return r;
  const salto = saltarAPergunta(r.estado);
  // O que ela ia dizer antes da pergunta (o «obrigada», uma resposta) fica; a pergunta repetida sai.
  return { ...r, estado: salto.estado, resposta: salto.resposta };
}

/* ──────────────────────────────────────────────────────────────────────────
 * A PERGUNTA JÁ RESPONDIDA — 18-11-2026 (decisão d69).
 *
 *   EQUIPA (à mão): Perfeito. E a carrinha consegue encostar à porta, ou fica
 *                   um bocadinho longe?
 *   CLIENTE:        Tem poucas escadas até à estrada
 *   VITÓRIA:        Sem problema, essa pode ficar para depois. E a carrinha
 *                   consegue encostar à porta, ou fica um bocadinho longe?
 *
 * — uma moradia em Alfragide. A recolha estava gravada no andar (a resposta
 * «É uma moradia» tinha chegado no meio das fotografias); a equipa fez a
 * pergunta da carrinha à mão; a Vitória leu a resposta contra o andar,
 * repetiu o andar, e ao «não insistir» saltou-o — para a carrinha, que já
 * estava respondida. Agora: a pergunta que está em cima é a que se responde
 * (`naPerguntaEmCima`), e nenhuma pergunta respondida na conversa se repete
 * (`semRepetirAPergunta`).
 * ────────────────────────────────────────────────────────────────────────── */

/** «Obrigada, fica anotado.» — à frente da pergunta seguinte, quando ele já tinha respondido. */
export const FICA_ANOTADO = "Obrigada, fica anotado.";

/** Uma marca (fotografia, vídeo, áudio, chamada) não é uma resposta com palavras. */
function eSoUmaMarca(texto: string): boolean {
  return eMarcaDeImagem(texto) || /^\s*\[[^\]]{1,60}\]\s*$/.test(texto);
}

/** O fio com a mensagem de agora no fim, se ainda lá não estiver. */
function comAMensagemDeAgora(fio: ReadonlyArray<MensagemDoFio> | null | undefined, texto?: string): MensagemDoFio[] {
  const lista = Array.isArray(fio) ? [...fio] : [];
  const t = texto?.trim();
  if (!t) return lista;
  const ultimaDele = [...lista].reverse().find((m) => m?.direccao === "in");
  const jaLaEsta = lista.length > 0 && lista[lista.length - 1]?.direccao === "in" && (ultimaDele?.texto ?? "").trim() !== "" && t.includes((ultimaDele?.texto ?? "").trim());
  return jaLaEsta ? lista : [...lista, { direccao: "in", texto: t }];
}

/** A pergunta que esta mensagem nossa faz (da Vitória ou da equipa à mão) — só se for mesmo uma pergunta. */
function passoPerguntado(m: MensagemDoFio | undefined): PassoDaRecolha | null {
  if (m?.direccao !== "out" || typeof m.texto !== "string") return null;
  const t = semMarcaDeMao(m.texto);
  if (!eUmaPerguntaNossa(t)) return null;
  return passoDaPergunta(t);
}

/**
 * QUANTAS VEZES SE PERGUNTOU ESTE PASSO, E O QUE ELE RESPONDEU da última vez
 * que respondeu — as mensagens dele entre essa pergunta e a mensagem nossa
 * seguinte, sem as fotografias. Pura.
 */
export function respostasAPergunta(
  passo: PassoDaRecolha,
  fio: ReadonlyArray<MensagemDoFio> | null | undefined,
): { vezes: number; respostas: string[] } {
  const lista = Array.isArray(fio) ? fio : [];
  let vezes = 0;
  let respostas: string[] = [];
  for (let i = 0; i < lista.length; i++) {
    if (passoPerguntado(lista[i]) !== passo) continue;
    vezes += 1;
    const depois: string[] = [];
    for (let j = i + 1; j < lista.length && lista[j]?.direccao !== "out"; j++) {
      const t = lista[j]?.texto;
      if (lista[j]?.direccao === "in" && typeof t === "string" && t.trim() && !eSoUmaMarca(t)) depois.push(t.trim());
    }
    if (depois.length > 0) respostas = depois;
  }
  return { vezes, respostas };
}

/**
 * Claramente outra coisa: uma pergunta dele (que tem resposta própria), o
 * preço, ou as coisas para levar — que ficam onde são, e não são a resposta.
 * O acesso (degraus, escadas, a carrinha) nunca é outra coisa.
 */
function eOutraCoisa(texto: string): boolean {
  const t = texto.trim();
  if (falaDoAcesso(t)) return false;
  return eUmaPergunta(t) || perguntaPeloPreco(t) || falaDeCoisas(t);
}

/** A resposta fica como veio, e pergunta-se a seguinte — com «fica anotado», não com «fica para depois». */
function seguirComARespostaComoVeio(r: RespostaDaRecolha, passo: PassoDaRecolha, dito: string): RespostaDaRecolha {
  const dados = guardarARespostaComoVeio(r.estado.dados, passo, dito);
  const seguinte = primeiroPassoEmFalta(dados);
  return { ...r, estado: { passo: seguinte, dados }, resposta: `${FICA_ANOTADO} ${perguntaParaContinuar(seguinte, dados)}` };
}

/**
 * A PERGUNTA QUE ESTÁ EM CIMA É A QUE SE RESPONDE — quando a última mensagem
 * nossa é uma pergunta da equipa, escrita à mão, de um passo que ainda falta
 * e não é o que está gravado, a mensagem dele lê-se contra essa. Pura.
 */
export function naPerguntaEmCima(
  e: EstadoDaRecolha,
  fio: ReadonlyArray<MensagemDoFio> | null | undefined,
): EstadoDaRecolha {
  const lista = Array.isArray(fio) ? fio : [];
  const ultimaNossa = [...lista].reverse().find((m) => m?.direccao === "out");
  if (!ultimaNossa || typeof ultimaNossa.texto !== "string" || !eDaEquipa(ultimaNossa.texto)) return e;
  const p = passoPerguntado(ultimaNossa);
  if (!p || p === e.passo || p === "servico" || p === "confirmar" || e.passo === "servico" || e.passo === "confirmar") return e;
  if (!passosEmFalta(e.dados).includes(p)) return e;
  return { ...e, passo: p };
}
