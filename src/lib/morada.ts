/**
 * Quão exacta é a morada que temos, e como a juntar para o Maps.
 *
 * O PROBLEMA
 *
 * A caixa de pesquisa do Google aceita qualquer coisa e devolve sempre um
 * resultado com ar de morada. Nos pedidos reais saiu isto:
 *
 *   #186  "Rua Professor Simões Raposo"        — rua sem número
 *   #12   "Ericeira, Mafra, Lisboa, Portugal"  — uma vila inteira
 *
 * As duas parecem preenchidas no ecrã e as duas dão uma distância à base.
 * Só que a segunda é o centro de Ericeira, e a carrinha pode ir parar a
 * quilómetros do sítio. A primeira serve para chegar à rua e depois andar à
 * procura da porta.
 *
 * A CORRECÇÃO NÃO É TROCAR A PESQUISA POR CAMPOS À MÃO
 *
 * A pesquisa é o que dá coordenadas certas e o código postal — escrever tudo
 * à mão obriga a geocodificar depois, e um erro de escrita passa a não
 * encontrar nada. O que falta é saber O QUE a pessoa escolheu e pedir-lhe o
 * que falta.
 *
 * É isso que este ficheiro faz: classifica o que o Google devolveu e diz o
 * que ainda falta perguntar.
 */

export type PrecisaoMorada =
  /** Rua e número — dá para bater à porta certa. */
  | "porta"
  /** Rua sem número — chega-se à rua e procura-se. */
  | "rua"
  /** Só localidade ou zona — pode ser em qualquer sítio dela. */
  | "localidade"
  /** Não há morada nenhuma. */
  | "nenhuma";

export type PartesDaMorada = {
  /** O nome da via, sem número: "Rua Professor Simões Raposo". */
  street?: string | null;
  /** O número de porta, tal como o cliente o escreve: "12", "12-A", "S/N". */
  streetNumber?: string | null;
  postalCode?: string | null;
  city?: string | null;
  /** O que o Google mostrou na caixa, para quando não há componentes. */
  formattedAddress?: string | null;
};

const limpo = (v: string | null | undefined) => (v ?? "").trim();

export function precisaoDaMorada(m: PartesDaMorada): PrecisaoMorada {
  const rua = limpo(m.street);
  const numero = limpo(m.streetNumber);
  if (rua && numero) return "porta";
  if (rua) return "rua";
  if (limpo(m.city) || limpo(m.formattedAddress)) return "localidade";
  return "nenhuma";
}

/**
 * Só a precisão "porta" serve para mandar uma equipa. As outras vão para a
 * frente na mesma — não vamos travar um pedido por causa disto — mas ficam
 * marcadas, e o formulário pede o que falta antes de deixar avançar.
 */
export function moradaServeParaTrabalhar(m: PartesDaMorada): boolean {
  return precisaoDaMorada(m) === "porta";
}

/** O que dizer à pessoa sobre o que ainda falta. Vazio quando está completa. */
export function faltaNaMorada(m: PartesDaMorada): string {
  switch (precisaoDaMorada(m)) {
    case "porta":
      return "";
    case "rua":
      return "Falta o número de porta.";
    case "localidade":
      return "Isto é uma localidade, não uma morada. Escreva o nome da rua e escolha-a na lista.";
    case "nenhuma":
      return "Indique a morada do serviço.";
  }
}

/**
 * Junta as partes numa morada única, para gravar e para o Maps.
 *
 * A ordem é a portuguesa — via, número, código postal, localidade — e cada
 * pedaço só entra se existir. Nada de vírgulas soltas nem de "undefined" no
 * meio, que é o que sai de concatenar campos sem pensar.
 *
 * A localidade não se repete se já vier no código postal ou na via.
 */
export function moradaCompleta(m: PartesDaMorada): string {
  const rua = limpo(m.street);
  const numero = limpo(m.streetNumber);
  const cp = limpo(m.postalCode);
  const cidade = limpo(m.city);

  // Sem componentes, vale o que o Google mostrou.
  if (!rua) return limpo(m.formattedAddress);

  const via = numero ? `${rua}, ${numero}` : rua;
  const local = [cp, cidade].filter(Boolean).join(" ");

  return [via, local].filter(Boolean).join(", ");
}

/**
 * Um número de porta escrito por uma pessoa.
 *
 * Aceita-se o que se usa mesmo: "12", "12-A", "12 A", "S/N", "Lote 4". O que
 * não se aceita é uma morada inteira escrita neste campo, que é o erro comum
 * quando alguém não percebe para que serve.
 */
export function numeroDePortaValido(valor: string | null | undefined): boolean {
  const v = limpo(valor);
  if (!v) return false;
  if (v.length > 20) return false;
  // Tem de ter pelo menos um dígito, ou ser um "sem número" reconhecível.
  if (/^s\/?n$/i.test(v)) return true;
  return /\d/.test(v);
}

/**
 * Link para abrir a morada no Google Maps.
 *
 * Usa a morada composta — via, número, código postal, localidade — e não só
 * o campo "morada completa" do pedido. É a diferença entre abrir na porta
 * certa e abrir no meio da rua: no pedido #186 o campo tem "Rua Professor
 * Simões Raposo" e o código postal está noutro campo, portanto juntá-los é o
 * que faz o Maps acertar.
 *
 * Quando há coordenadas, são elas que mandam: um ponto é sempre mais exacto
 * do que um texto que o Maps tem de voltar a interpretar.
 */
export function linkGoogleMaps(
  m: PartesDaMorada & { lat?: number | null; lng?: number | null },
): string | null {
  if (typeof m.lat === "number" && typeof m.lng === "number") {
    return `https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lng}`;
  }
  const texto = moradaCompleta(m);
  if (!texto) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(texto)}`;
}
