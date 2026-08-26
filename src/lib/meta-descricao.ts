/**
 * Limite prático da meta description antes de o Google a cortar nos
 * resultados. O relatório de SEO mede em pixels (1000px); 160 caracteres é a
 * aproximação em texto que se usa na prática e que já deixa margem.
 */
export const LIMITE_DESCRICAO = 160;

/**
 * Encurta uma meta description sem a deixar cortada a meio de uma frase.
 *
 * As descrições das páginas de cidade+serviço eram montadas por concatenação e
 * cortadas em bruto aos 320 caracteres — ou seja, ao dobro do que aparece no
 * resultado de pesquisa, e muitas vezes a meio de uma palavra. Quem lê o
 * resultado via uma frase truncada, e isso paga-se em cliques.
 *
 * A regra aqui: fica com o maior número de frases inteiras que caiba no
 * limite. Se nem a primeira frase couber, corta na última palavra e marca com
 * reticências, que é melhor do que uma palavra partida ao meio.
 */
export function limitarDescricao(texto: string, limite = LIMITE_DESCRICAO): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (limpo.length <= limite) return limpo;

  // Frases inteiras: acumula enquanto couber.
  const frases = limpo.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (frases) {
    let acumulado = "";
    for (const frase of frases) {
      const proximo = (acumulado + frase).trimEnd();
      if (proximo.length > limite) break;
      acumulado = proximo + " ";
    }
    const resultado = acumulado.trim();
    if (resultado.length > 0) return resultado;
  }

  // Nem a primeira frase cabe — corta na última palavra completa.
  const corte = limpo.slice(0, limite - 1);
  const ultimoEspaco = corte.lastIndexOf(" ");
  return `${(ultimoEspaco > 0 ? corte.slice(0, ultimoEspaco) : corte).replace(/[,;:]$/, "")}…`;
}
