/**
 * O MODELO SEM QUOTA PÕE-SE DE LADO, EM VEZ DE SE INSISTIR NELE.
 *
 * "Vamos corrigi-lo de uma vez esse erro." — 14-09-2026, sobre isto:
 *
 *   [429 Too Many Requests] You exceeded your current quota, please check
 *   your plan and billing details.
 *
 * A escada de modelos já existia — o bom primeiro, o de reserva a seguir — mas
 * era percorrida do princípio a CADA mensagem. Com o `gemini-2.5-flash` sem
 * quota, cada frase de cada cliente gastava uma chamada condenada antes de
 * chegar ao modelo que ainda podia responder. Não é o tempo que isso custa
 * (uma recusa por quota volta em dois décimos de segundo): é insistir num sítio
 * onde já se sabe que não há nada.
 *
 * O QUE ISTO NÃO RESOLVE, e convém dizê-lo: a quota. Se os dois modelos
 * estiverem esgotados, isto só faz o assistente desistir mais depressa. A
 * correcção a sério é facturação na conta da Google, ou um modelo com mais
 * folga em `GEMINI_MODEL`. Isto é o que impede uma conta esgotada de arrastar
 * consigo a que ainda tem saldo.
 *
 * QUINZE MINUTOS, E NÃO UM DIA. Um 429 tanto pode ser o limite por MINUTO como
 * o limite por DIA, e a mensagem da Google não distingue os dois. Um descanso
 * longo trataria um engasgo de sessenta segundos como se fosse o dia inteiro
 * perdido; um curto de mais volta a gastar chamadas sem parar. Quinze minutos
 * cobre o engasgo e, no caso do dia, custa quatro tentativas por hora — que é
 * o preço de voltar a tentar sozinho quando a quota se repuser.
 */

export const MINUTOS_DE_DESCANSO = 15;

/** Quem está de castigo, e até quando. Guardado no estado do WhatsApp. */
export type Descansos = Record<string, string>;

/**
 * A Google recusou por falta de quota?
 *
 * Só isto põe um modelo de lado. Um tempo esgotado ou um JSON mal formado são
 * problemas do momento e não dizem nada sobre o modelo estar ou não disponível
 * daqui a um segundo — pô-lo de castigo por causa deles tirava do ar o bom
 * modelo por causa de um soluço.
 */
export function eFaltaDeQuota(mensagem: string): boolean {
  const m = mensagem.toLowerCase();
  return m.includes("429") || m.includes("too many requests") || m.includes("quota");
}

export function aindaDescansa(descansos: Descansos, modelo: string, agora: Date): boolean {
  const ate = descansos[modelo];
  if (!ate) return false;
  const t = new Date(ate).getTime();
  // Uma data ilegível não pode calar um modelo para sempre.
  return Number.isFinite(t) && t > agora.getTime();
}

/** Põe o modelo de castigo, e limpa de caminho os castigos que já passaram. */
export function pôrADescansar(
  descansos: Descansos,
  modelo: string,
  agora: Date,
  minutos: number = MINUTOS_DE_DESCANSO,
): Descansos {
  const limpo: Descansos = {};
  for (const [m, ate] of Object.entries(descansos)) {
    if (m !== modelo && aindaDescansa(descansos, m, agora)) limpo[m] = ate;
  }
  limpo[modelo] = new Date(agora.getTime() + minutos * 60_000).toISOString();
  return limpo;
}

/**
 * Por que ordem se tentam os modelos agora.
 *
 * Os que descansam vão para o fim em vez de saírem: se todos estiverem de
 * castigo, tenta-se na mesma — mais vale uma chamada condenada do que um
 * assistente que decide sozinho não perceber ninguém.
 */
export function modelosAUsar(
  escada: readonly string[],
  descansos: Descansos,
  agora: Date,
): string[] {
  const unicos = [...new Set(escada.filter(Boolean))];
  const prontos = unicos.filter((m) => !aindaDescansa(descansos, m, agora));
  const aDescansar = unicos.filter((m) => aindaDescansa(descansos, m, agora));
  return [...prontos, ...aDescansar];
}

/** O que está guardado, lido sem confiar em nada. */
export function lerDescansos(json: string | null | undefined): Descansos {
  if (!json) return {};
  try {
    const o = JSON.parse(json);
    if (!o || typeof o !== "object" || Array.isArray(o)) return {};
    const r: Descansos = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (typeof v === "string") r[k] = v;
    }
    return r;
  } catch {
    return {};
  }
}
