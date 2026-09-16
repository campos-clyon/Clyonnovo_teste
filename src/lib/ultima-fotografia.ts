/**
 * A ÚLTIMA FOTOGRAFIA — para o ecrã abrir já com alguma coisa.
 *
 * "isso deve ser instantâneo também para os profissionais e clientes"
 * — 16-09-2026. E antes: "na Fixando, quando vou abrir as telas, elas não
 * ficam a carregar; abrem rapidamente com o conteúdo já no site."
 *
 * O ciclo automático já trazia as novidades sozinhas, mas não resolvia isto:
 * a cada ENTRADA — mudar de página, voltar atrás, recarregar — o componente
 * nasce de novo, sem nada na memória, e fica na roda até a API responder. Um
 * segundo de ecrã branco, todas as vezes, a mostrar exactamente o que já lá
 * tinha estado.
 *
 * Aqui guarda-se a última resposta boa. Ao abrir, pinta-se com ela e pede-se a
 * nova por baixo: quem volta vê a lista de imediato, e ela actualiza-se sem
 * piscar. É a mesma ideia do `useAutoRefresh` — mostrar já, confirmar depois —
 * levada ao momento em que o ecrã nasce.
 *
 * PORQUÊ `sessionStorage` E NÃO `localStorage`. Isto é a conta de alguém: os
 * trabalhos dele, os valores dele, a morada dos clientes dele. O
 * `sessionStorage` morre com o separador, não é partilhado entre separadores e
 * não fica no disco à espera de quem se sentar a seguir ao computador. E
 * `limparFotografias()` corre ao sair, que é a outra metade da mesma regra.
 *
 * NADA DISTO PODE PARTIR NADA. Um browser em modo privado, o disco cheio, uma
 * política que proíbe armazenamento — em qualquer desses casos isto cala-se e
 * devolve null, e o ecrã comporta-se como se comportava antes: mostra a roda e
 * espera. Uma optimização que rebenta a página é pior do que não existir.
 */

const PREFIXO = "clyon:fotografia:";

/** O que se guardou da última vez, ou null se não houver nada legível. */
export function lerFotografia<T>(chave: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const cru = window.sessionStorage.getItem(PREFIXO + chave);
    if (!cru) return null;
    return JSON.parse(cru) as T;
  } catch {
    return null;
  }
}

/** Guarda a resposta boa. Falhar aqui não é notícia para ninguém. */
export function guardarFotografia(chave: string, dados: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PREFIXO + chave, JSON.stringify(dados));
  } catch {
    /* sem espaço, ou sem permissão: o ecrã continua a funcionar */
  }
}

/**
 * Apaga tudo o que foi guardado — ao sair, e só ao sair.
 *
 * Sair tem de levar isto atrás. Senão a pessoa seguinte a abrir o painel no
 * mesmo separador via, por um instante, os trabalhos de quem saiu.
 */
export function limparFotografias(): void {
  if (typeof window === "undefined") return;
  try {
    const chaves: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (k?.startsWith(PREFIXO)) chaves.push(k);
    }
    for (const k of chaves) window.sessionStorage.removeItem(k);
  } catch {
    /* idem */
  }
}
