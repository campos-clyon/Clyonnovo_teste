/**
 * Distância à base quando ainda não há uma medida a sério.
 *
 * O motor de preços precisa de quilómetros. Quando o pedido vem do simulador,
 * a distância foi calculada pelo Google a partir das coordenadas e é fiável.
 * Quando vem de um formulário — contactos, homepage — só há uma morada
 * escrita à mão, e às vezes nem isso.
 *
 * Esta tabela vivia dentro do /api/hero-quote. É regra de negócio, não
 * detalhe de uma rota: passou para aqui para que o formulário de contactos a
 * possa usar também, em vez de nascer uma segunda cópia com outros números.
 *
 * ⚠️ Isto é uma ESTIMATIVA por código postal. Serve para o pedido não chegar
 * ao painel com preço zero — não substitui a medição real, que é feita
 * quando a equipa confirma a morada.
 */

/** Base CLYON: Av. Q.ta das Laranjeiras, Fernão Ferro. */
export const KM_POR_OMISSAO = 25;

export function kmPorCodigoPostal(cp: string | null | undefined): number {
  const digitos = (cp ?? "").replace(/\D/g, "");
  const prefixo = parseInt(digitos.slice(0, 4), 10);
  if (Number.isNaN(prefixo)) return KM_POR_OMISSAO;

  // Fernão Ferro / Amora / Seixal imediato — a base é aqui ao lado
  if (prefixo >= 2845 && prefixo <= 2869) return 7;
  // Corroios / Belverde / Miratejo
  if (prefixo >= 2836 && prefixo <= 2844) return 10;
  // Barreiro / Moita / Montijo
  if (prefixo >= 2830 && prefixo <= 2835) return 15;
  // Almada / Pragal / Cacilhas
  if (prefixo >= 2800 && prefixo <= 2829) return 18;
  // Costa da Caparica / Trafaria
  if (prefixo >= 2870 && prefixo <= 2899) return 12;
  // Setúbal
  if (prefixo >= 2900 && prefixo <= 2959) return 45;
  // Palmela / Sesimbra
  if (prefixo >= 2960 && prefixo <= 2999) return 35;
  // Lisboa — atravessa a ponte
  if (prefixo >= 1000 && prefixo <= 1799) return 35;
  // Margem Norte próxima
  if (prefixo >= 1800 && prefixo <= 1999) return 25;

  return 30;
}

/**
 * Procura um código postal português dentro de texto livre.
 *
 * O formulário de contactos tem um campo de morada só, onde a pessoa escreve
 * o que quer. Muitas vezes o código postal está lá — "Rua X, 12, 2845-123
 * Amora" — e é a única pista boa que temos sobre a distância. Sem ele,
 * ficamos pelo valor por omissão.
 */
export function extrairCodigoPostal(texto: string | null | undefined): string | null {
  const m = (texto ?? "").match(/\b\d{4}-\d{3}\b/);
  return m ? m[0] : null;
}

/**
 * Os quilómetros a usar para um pedido, pela melhor pista disponível.
 *
 * A ordem importa: uma distância já medida ganha sempre a uma estimativa, e
 * um código postal ganha a um palpite. Devolve também de onde veio o número,
 * para o painel poder dizer à equipa em que é que pode confiar.
 */
export function kmParaOrcamento(dados: {
  distanciaMedidaKm?: number | null;
  codigoPostal?: string | null;
  morada?: string | null;
}): { km: number; origem: "medida" | "codigo_postal" | "omissao" } {
  const medida = Number(dados.distanciaMedidaKm ?? 0);
  if (medida > 0) return { km: medida, origem: "medida" };

  const cp = dados.codigoPostal?.trim() || extrairCodigoPostal(dados.morada);
  if (cp) return { km: kmPorCodigoPostal(cp), origem: "codigo_postal" };

  return { km: KM_POR_OMISSAO, origem: "omissao" };
}
