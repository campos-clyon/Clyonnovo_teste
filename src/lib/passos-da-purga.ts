/**
 * OS PASSOS SECUNDÁRIOS DA PURGA — e o que se diz quando um falha.
 * 27-10-2026 (decisão d7).
 *
 * As recolhas do WhatsApp, as fotografias pendentes, os contactos a meio, o
 * arquivo dos apagados, os eventos da agenda e as regras novas correm a seguir
 * à purga, cada um com o seu `.catch`: uma falha num deles não pode estragar
 * o resumo da noite, que é a prova de que a purga correu. Mas o `.catch`
 * devolvia ZERO — e o resumo dizia «nada apagado» numa noite em que um passo
 * tinha rebentado. Zero e «não correu» pareciam iguais.
 *
 * Agora cada passo que falha deixa o nome e o motivo numa lista, e a lista vai
 * à CABEÇA do resumo da noite. Puro, para se testar sem base.
 */

/**
 * Corre um passo secundário. Se rebentar, escreve-o em `falhas` (nome e
 * motivo) e devolve `vazio` — a noite continua, mas não em silêncio.
 */
export async function passoSecundario<T>(
  nome: string,
  fazer: () => Promise<T>,
  vazio: T,
  falhas: string[],
): Promise<T> {
  try {
    return await fazer();
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e);
    console.error(`[cron/purgar-pedidos] ${nome}:`, e);
    falhas.push(`${nome}: ${motivo.replace(/\s+/g, " ").slice(0, 160)}`);
    return vazio;
  }
}

/** A cabeça do resumo: vazia numa noite limpa, e o primeiro que se lê quando não. */
export function cabecaDasFalhas(falhas: string[]): string {
  if (falhas.length === 0) return "";
  return `ATENÇÃO — ${falhas.length} passo(s) da purga falharam esta noite (${falhas.join("; ")}). `;
}

/** O resumo da noite com as falhas à cabeça. */
export function resumoComAsFalhas(falhas: string[], resumo: string): string {
  return cabecaDasFalhas(falhas) + resumo;
}

/** Os contactos a meio, ditos por palavras — e só quando há algum. */
export function contactosAMeioEmPalavras(n: number, aSerio: boolean, dias: number): string {
  if (n <= 0) return "";
  return aSerio
    ? `. Contactos a meio (mais de ${dias} dias): ${n} apagado(s)`
    : `. Contactos a meio (mais de ${dias} dias): ${n} sairiam`;
}
