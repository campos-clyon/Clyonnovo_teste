import { semAcentos } from "./leitor-da-recolha";
import { passoDaPergunta } from "./reler-a-conversa";
import { eDaEquipa } from "./rajada-do-whatsapp";
import {
  perguntaParaContinuar,
  primeiroPassoEmFalta,
  saltarAPergunta,
  type EstadoDaRecolha,
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
): RespostaDaRecolha {
  if (r.registar || r.desistir || r.pedirPessoa || !r.resposta.trim()) return r;
  const agora = passoDaPergunta(r.resposta);
  if (!agora || agora === "confirmar" || agora === "servico" || agora !== r.estado.passo) return r;
  const ditas = daVitoria(fio);
  const ultima = ditas.length > 0 ? passoDaPergunta(ditas[ditas.length - 1]) : null;
  const nomeJaPerguntado = agora === "nome" && ditas.some((t) => passoDaPergunta(t) === "nome");
  if (ultima !== agora && !nomeJaPerguntado) return r;
  const salto = saltarAPergunta(r.estado);
  // O que ela ia dizer antes da pergunta (o «obrigada», uma resposta) fica; a pergunta repetida sai.
  return { ...r, estado: salto.estado, resposta: salto.resposta };
}
