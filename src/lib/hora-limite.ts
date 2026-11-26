/**
 * A HORA-LIMITE DO DIA — 26-11-2026 (decisão d131). PURO e sem dependências
 * (também o lê o navegador).
 *
 * *«Tem que ser dia 2 de manhã até às 13 ou 13h30.»* O «até às 13h30» não é a
 * hora a que o parceiro chega: é a hora até à qual tem de estar feito. Lida
 * como a hora do pedido, marcava-o para as 13h30 — e o resumo dizia «às
 * 13:30», uma hora que o cliente nunca pediu. Aqui separa-se: a hora-limite
 * vai para as notas do parceiro e para o resumo («de manhã (até às 13h30)»),
 * e a hora do pedido fica a da parte do dia (manhã = 9h, tarde = 14h) ou a que
 * ele disse sem «até».
 *
 * O texto entra já «plano» (minúsculas, sem acentos, o mesmo comprimento do
 * original), para as posições valerem no original.
 */

export type HoraLimite = {
  /** «até às 13h30», «antes das 12h». */
  texto: string;
  /** A hora e os minutos do limite (o mais tarde, num «13 ou 13h30»). */
  hora: number;
  minutos: number;
  inicio: number;
  fim: number;
};

const MARCA = "(\\s*h\\s*(\\d{2})?|:(\\d{2})|\\s*horas)?";
const LIMITE = new RegExp(
  `\\b(ate as|ate a|ate|antes das|antes da)\\s+(\\d{1,2})${MARCA}(?:\\s*(?:ou|a|-)\\s*(?:as\\s+)?(\\d{1,2})${MARCA})?(?![\\d/.]|\\s*de\\s|-\\d)`,
  "g",
);

/** As horas-limite da frase, pela ordem. */
export function horasLimiteNaFrase(plano: string): HoraLimite[] {
  const out: HoraLimite[] = [];
  for (const m of plano.matchAll(LIMITE)) {
    const [, prende, h1, marca1, mh1, mm1, h2, marca2, mh2, mm2] = m;
    const a = Number(h1);
    const b = h2 != null ? Number(h2) : null;
    if (a > 23 || (b != null && b > 23)) continue;
    // «até 13» sem «às» nem «h» pode ser outra coisa («até 13 sacos»): sem marca, não é hora.
    if (prende === "ate" && !marca1 && !marca2) continue;
    const segunda = b != null && b >= a;
    const hora = segunda ? (b as number) : a;
    const minutos = Number((segunda ? mh2 ?? mm2 : mh1 ?? mm1) ?? 0) || 0;
    const rotulo = prende.startsWith("antes") ? "antes das" : "até às";
    const inicio = m.index ?? 0;
    const fim = inicio + m[0].length;
    out.push({ texto: `${rotulo} ${hora}h${minutos ? String(minutos).padStart(2, "0") : ""}`, hora, minutos, inicio, fim });
  }
  return out;
}

/** A primeira hora-limite da frase, ou null. */
export function horaLimiteNaFrase(plano: string): HoraLimite | null {
  return horasLimiteNaFrase(plano)[0] ?? null;
}

/** A frase sem as horas-limite — espaços no lugar delas, o mesmo comprimento. */
export function semAHoraLimite(plano: string): string {
  let t = plano;
  for (const l of horasLimiteNaFrase(plano)) t = t.slice(0, l.inicio) + " ".repeat(l.fim - l.inicio) + t.slice(l.fim);
  return t;
}
