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
/**
 * Distância aproximada a partir do NOME da cidade.
 *
 * A pesquisa de moradas devolve muitas vezes só "Lisboa, Portugal" — sem
 * número de porta e sem código postal. Nesse caso não havia nada a fazer e a
 * conta caía no valor por omissão, que trata Lisboa e Fernão Ferro por igual.
 *
 * A cidade é uma pista pior do que o código postal e melhor do que nada: um
 * pedido em Lisboa atravessa a ponte, e isso são trinta e cinco quilómetros
 * que não podem valer zero no combustível.
 */
const KM_POR_CIDADE: Array<{ nomes: string[]; km: number }> = [
  { nomes: ["fernão ferro", "fernao ferro"], km: 5 },
  { nomes: ["amora", "seixal", "arrentela", "cruz de pau"], km: 7 },
  { nomes: ["corroios", "miratejo", "belverde"], km: 10 },
  { nomes: ["costa da caparica", "trafaria", "charneca"], km: 12 },
  { nomes: ["barreiro", "moita", "montijo", "alhos vedros", "baixa da banheira"], km: 15 },
  { nomes: ["almada", "cacilhas", "pragal", "laranjeiro", "feijó", "feijo"], km: 18 },
  { nomes: ["odivelas", "amadora", "loures", "sacavém", "sacavem", "queluz"], km: 30 },
  { nomes: ["palmela", "sesimbra", "quinta do conde"], km: 35 },
  { nomes: ["lisboa", "lisbon"], km: 35 },
  { nomes: ["oeiras", "carnaxide", "algés", "alges", "cascais", "sintra"], km: 45 },
  { nomes: ["setúbal", "setubal"], km: 45 },
];

export function kmPorCidade(texto: string | null | undefined): number | null {
  const t = (texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!t.trim()) return null;
  for (const entrada of KM_POR_CIDADE) {
    for (const nome of entrada.nomes) {
      const semAcentos = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (t.includes(semAcentos)) return entrada.km;
    }
  }
  return null;
}

export function kmParaOrcamento(dados: {
  distanciaMedidaKm?: number | null;
  codigoPostal?: string | null;
  morada?: string | null;
  cidade?: string | null;
}): { km: number; origem: "medida" | "codigo_postal" | "cidade" | "omissao" } {
  const medida = Number(dados.distanciaMedidaKm ?? 0);
  if (medida > 0) return { km: medida, origem: "medida" };

  const cp = dados.codigoPostal?.trim() || extrairCodigoPostal(dados.morada);
  if (cp) return { km: kmPorCodigoPostal(cp), origem: "codigo_postal" };

  // A morada primeiro: "Rua X, Almada" é mais preciso do que a localidade que
  // o selector do cabeçalho tiver adivinhado pelo IP.
  const porCidade = kmPorCidade(dados.morada) ?? kmPorCidade(dados.cidade);
  if (porCidade != null) return { km: porCidade, origem: "cidade" };

  return { km: KM_POR_OMISSAO, origem: "omissao" };
}
