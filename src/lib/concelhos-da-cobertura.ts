import { distanciaEmLinhaRecta, pontoValido } from "./distancia-entre-pontos";

/**
 * OS CONCELHOS QUE SE MEDEM — 04-11-2026 (d16, Fase A do plano de expansão).
 *
 * Os 16 onde a CLYON já trabalha, e Vila Franca de Xira e Mafra (os dois que
 * fecham a Área Metropolitana, na Fase B). Para cada um, o nome, o ponto de
 * onde se medem as distâncias (o centro de onde vive a maior parte das
 * pessoas, não o centro geométrico), as terras que o identificam numa morada e
 * os códigos postais (os quatro primeiros algarismos).
 *
 * `concelhoDoPedido` diz de que concelho é um pedido pela melhor pista que
 * houver, por esta ordem: o código postal, o nome da terra na localidade, o
 * nome da terra na morada e, por fim, o ponto no mapa (a menos de 12 km de um
 * centro). Sem nenhuma, null — e o quadro conta-o à parte, nunca adivinha.
 *
 * Puro: lê-o o quadro da cobertura, a página de recrutamento e os testes.
 */

export type IdDoConcelho =
  | "lisboa"
  | "almada"
  | "seixal"
  | "sintra"
  | "oeiras"
  | "setubal"
  | "barreiro"
  | "amadora"
  | "cascais"
  | "montijo"
  | "odivelas"
  | "palmela"
  | "sesimbra"
  | "alcochete"
  | "loures"
  | "moita"
  | "vila-franca-de-xira"
  | "mafra";

export type ConcelhoDaCobertura = {
  id: IdDoConcelho;
  nome: string;
  /** Fora dos 16 de hoje: só abre na Fase B. */
  faseB: boolean;
  centro: { lat: number; lng: number };
  /** Terras e freguesias que, numa morada, dizem este concelho (sem acentos, minúsculas). */
  terras: string[];
  /** Os códigos postais, pelos quatro primeiros algarismos: intervalos fechados. */
  codigosPostais: Array<[number, number]>;
};

/** A ordem do quadro: a ordem da ordem do CEO (os 16), e depois a Fase B. */
export const CONCELHOS_DA_COBERTURA: readonly ConcelhoDaCobertura[] = [
  {
    id: "lisboa",
    nome: "Lisboa",
    faseB: false,
    centro: { lat: 38.7369, lng: -9.1427 },
    terras: [
      "lisboa", "lisbon", "benfica", "lumiar", "olivais", "alvalade", "marvila", "belem", "alcantara",
      "campolide", "areeiro", "arroios", "penha de franca", "avenidas novas", "campo de ourique", "carnide",
      "sao domingos de benfica", "beato", "parque das nacoes", "telheiras", "restelo", "chelas", "alfama",
      "chiado", "saldanha", "ameixoeira",
    ],
    // 1495 é Algés (Oeiras), 1675 e 1685 são da Pontinha e de Caneças/Famões (Odivelas), 1885 é Moscavide (Loures).
    codigosPostais: [[1000, 1494], [1496, 1674], [1676, 1684], [1686, 1884], [1887, 1999]],
  },
  {
    id: "almada",
    nome: "Almada",
    faseB: false,
    centro: { lat: 38.6620, lng: -9.1720 },
    terras: [
      "almada", "cacilhas", "pragal", "laranjeiro", "feijo", "sobreda", "charneca da caparica",
      "charneca de caparica", "costa da caparica", "caparica", "trafaria", "cova da piedade", "monte de caparica",
    ],
    codigosPostais: [[2800, 2829]],
  },
  {
    id: "seixal",
    nome: "Seixal",
    faseB: false,
    centro: { lat: 38.6200, lng: -9.1100 },
    terras: [
      "seixal", "amora", "corroios", "fernao ferro", "arrentela", "paio pires", "aldeia de paio pires",
      "cruz de pau", "miratejo", "fogueteiro", "belverde", "torre da marinha", "foros de amora",
      "pinhal de frades", "casal do marco",
    ],
    codigosPostais: [[2840, 2859], [2865, 2869]],
  },
  {
    id: "sintra",
    nome: "Sintra",
    faseB: false,
    centro: { lat: 38.7800, lng: -9.3200 },
    terras: [
      "sintra", "cacem", "agualva", "queluz", "massama", "monte abraao", "rio de mouro", "mem martins",
      "algueirao", "belas", "colares", "sao marcos", "tapada das merces", "pero pinheiro", "casal de cambra",
      "mira sintra", "terrugem", "almargem do bispo", "sao joao das lampas", "montelavar",
    ],
    codigosPostais: [[2605, 2605], [2635, 2639], [2705, 2719], [2725, 2729], [2735, 2739], [2745, 2749]],
  },
  {
    id: "oeiras",
    nome: "Oeiras",
    faseB: false,
    centro: { lat: 38.7050, lng: -9.2700 },
    terras: [
      "oeiras", "carnaxide", "alges", "linda a velha", "paco de arcos", "caxias", "porto salvo", "barcarena",
      "queijas", "cruz quebrada", "dafundo", "tercena", "leceia", "outurela", "portela de carnaxide", "taguspark",
    ],
    codigosPostais: [[1495, 1495], [2730, 2734], [2740, 2744], [2760, 2764], [2770, 2774], [2780, 2784], [2790, 2799]],
  },
  {
    id: "setubal",
    nome: "Setúbal",
    faseB: false,
    centro: { lat: 38.5244, lng: -8.8882 },
    terras: ["setubal", "azeitao", "vila nogueira de azeitao"],
    codigosPostais: [[2900, 2929]],
  },
  {
    id: "barreiro",
    nome: "Barreiro",
    faseB: false,
    centro: { lat: 38.6610, lng: -9.0730 },
    terras: [
      "barreiro", "lavradio", "coina", "santo antonio da charneca", "palhais", "verderena",
      "alto do seixalinho", "quinta da lomba",
    ],
    codigosPostais: [[2830, 2834]],
  },
  {
    id: "amadora",
    nome: "Amadora",
    faseB: false,
    centro: { lat: 38.7540, lng: -9.2300 },
    terras: [
      "amadora", "damaia", "reboleira", "venda nova", "falagueira", "brandoa", "buraca", "alfragide",
      "mina de agua", "venteira", "encosta do sol", "alfornelos", "aguas livres",
    ],
    codigosPostais: [[2610, 2614], [2650, 2654], [2700, 2704], [2720, 2724]],
  },
  {
    id: "cascais",
    nome: "Cascais",
    faseB: false,
    centro: { lat: 38.7100, lng: -9.3900 },
    terras: [
      "cascais", "estoril", "parede", "carcavelos", "sao domingos de rana", "alcabideche", "sao joao do estoril",
      "monte estoril", "tires", "abobada", "birre", "matarraque", "talaide", "trajouce", "manique",
    ],
    codigosPostais: [[2645, 2649], [2750, 2759], [2765, 2769], [2775, 2779], [2785, 2789]],
  },
  {
    id: "montijo",
    nome: "Montijo",
    faseB: false,
    centro: { lat: 38.7060, lng: -8.9740 },
    terras: ["montijo", "pegoes", "canha", "afonsoeiro", "sarilhos grandes", "alto estanqueiro"],
    codigosPostais: [[2870, 2874], [2985, 2985]],
  },
  {
    id: "odivelas",
    nome: "Odivelas",
    faseB: false,
    centro: { lat: 38.7900, lng: -9.1800 },
    terras: [
      "odivelas", "pontinha", "famoes", "canecas", "povoa de santo adriao", "olival basto", "ramada", "serra da luz",
    ],
    codigosPostais: [[1675, 1675], [1685, 1685], [2620, 2624], [2675, 2679]],
  },
  {
    id: "palmela",
    nome: "Palmela",
    faseB: false,
    centro: { lat: 38.5900, lng: -8.9000 },
    terras: ["palmela", "pinhal novo", "quinta do anjo", "poceirao", "aguas de moura", "marateca"],
    codigosPostais: [[2950, 2959], [2965, 2965]],
  },
  {
    id: "sesimbra",
    nome: "Sesimbra",
    faseB: false,
    centro: { lat: 38.5200, lng: -9.0800 },
    terras: ["sesimbra", "quinta do conde", "alfarim", "lagoa de albufeira"],
    codigosPostais: [[2970, 2979]],
  },
  {
    id: "alcochete",
    nome: "Alcochete",
    faseB: false,
    centro: { lat: 38.7550, lng: -8.9610 },
    terras: ["alcochete", "samouco"],
    codigosPostais: [[2890, 2894]],
  },
  {
    id: "loures",
    nome: "Loures",
    faseB: false,
    centro: { lat: 38.8100, lng: -9.1300 },
    terras: [
      "loures", "sacavem", "moscavide", "portela", "camarate", "santo antonio dos cavaleiros", "bobadela",
      "santa iria de azoia", "santa iria da azoia", "sao joao da talha", "prior velho", "unhos", "frielas",
      "bucelas", "apelacao", "fanhoes", "lousa", "sao juliao do tojal", "santo antao do tojal",
    ],
    codigosPostais: [[1885, 1886], [2660, 2664], [2670, 2674], [2680, 2699]],
  },
  {
    id: "moita",
    nome: "Moita",
    faseB: false,
    centro: { lat: 38.6550, lng: -9.0100 },
    terras: ["moita", "baixa da banheira", "alhos vedros", "vale da amoreira", "gaio rosario", "sarilhos pequenos"],
    codigosPostais: [[2835, 2839], [2860, 2864]],
  },
  {
    id: "vila-franca-de-xira",
    nome: "Vila Franca de Xira",
    faseB: true,
    centro: { lat: 38.9000, lng: -9.0400 },
    terras: [
      "vila franca de xira", "alverca", "povoa de santa iria", "forte da casa", "vialonga", "alhandra",
      "castanheira do ribatejo", "sobralinho", "sao joao dos montes", "calhandriz",
    ],
    codigosPostais: [[2600, 2604], [2615, 2619], [2625, 2629]],
  },
  {
    id: "mafra",
    nome: "Mafra",
    faseB: true,
    centro: { lat: 38.9300, lng: -9.3300 },
    terras: [
      "mafra", "ericeira", "malveira", "venda do pinheiro", "milharado", "santo isidoro", "carvoeira",
      "encarnacao", "igreja nova",
    ],
    codigosPostais: [[2640, 2644], [2655, 2659], [2665, 2669]],
  },
];

const POR_ID = new Map(CONCELHOS_DA_COBERTURA.map((c) => [c.id, c]));

/** O concelho pelo id («sintra», «vila-franca-de-xira») — ou pelo nome, com ou sem acentos. */
export function concelhoPorId(v: unknown): ConcelhoDaCobertura | null {
  if (typeof v !== "string") return null;
  const limpo = normalizar(v).replace(/ /g, "-");
  return POR_ID.get(limpo as IdDoConcelho) ?? null;
}

/** Sem acentos, minúsculas, só letras e algarismos separados por um espaço. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * O concelho de um código postal (os quatro primeiros algarismos), ou null.
 * Num texto livre (a morada) só vale o código inteiro, «2845-123»: quatro
 * algarismos soltos podem ser um número de porta ou um lote.
 */
export function concelhoDoCodigoPostal(cp: unknown, dentroDeTexto = false): IdDoConcelho | null {
  if (typeof cp !== "string" && typeof cp !== "number") return null;
  const m = String(cp).match(dentroDeTexto ? /\b(\d{4})\s*-\s*\d{3}\b/ : /^\s*(\d{4})(?:\s*-?\s*\d{3})?\s*$/);
  if (!m) return null;
  const n = Number(m[1]);
  for (const c of CONCELHOS_DA_COBERTURA) {
    if (c.codigosPostais.some(([de, ate]) => n >= de && n <= ate)) return c.id;
  }
  return null;
}

/*
 * As terras de todos, da mais comprida para a mais curta: «santo antonio dos
 * cavaleiros» (Loures) ganha a «santo antonio da charneca» (Barreiro) e a
 * «portela de carnaxide» (Oeiras) ganha à «portela» (Loures). «lisboa» fica
 * para o fim de tudo: aparece em moradas de toda a região («distrito de Lisboa»,
 * «Rua de Lisboa»), e só conta quando nenhuma outra terra aparece.
 */
const TERRAS = CONCELHOS_DA_COBERTURA.flatMap((c) => c.terras.map((t) => ({ t, id: c.id })))
  .filter((x) => x.t !== "lisboa" && x.t !== "lisbon")
  .sort((a, b) => b.t.length - a.t.length);

/** O concelho pelo nome de uma terra no texto, ou null. */
export function concelhoDoTexto(texto: unknown): IdDoConcelho | null {
  if (typeof texto !== "string" || !texto.trim()) return null;
  const t = ` ${normalizar(texto)} `;
  for (const { t: terra, id } of TERRAS) if (t.includes(` ${terra} `)) return id;
  if (t.includes(" lisboa ") || t.includes(" lisbon ")) return "lisboa";
  return null;
}

/** O concelho com o centro mais perto do ponto, se estiver a menos de 12 km; senão null. */
export function concelhoDoPonto(ponto: unknown): IdDoConcelho | null {
  if (!pontoValido(ponto)) return null;
  let melhor: { id: IdDoConcelho; km: number } | null = null;
  for (const c of CONCELHOS_DA_COBERTURA) {
    const km = distanciaEmLinhaRecta(ponto, c.centro);
    if (!melhor || km < melhor.km) melhor = { id: c.id, km };
  }
  return melhor && melhor.km <= 12 ? melhor.id : null;
}

/** O concelho da morada de um pedido, pela melhor pista — ou null. */
export function concelhoDoPedido(p: {
  postalCode?: unknown;
  city?: unknown;
  address?: unknown;
  lat?: unknown;
  lng?: unknown;
}): IdDoConcelho | null {
  return (
    concelhoDoCodigoPostal(p.postalCode) ??
    concelhoDoCodigoPostal(typeof p.postalCode === "string" ? p.postalCode : null, true) ??
    concelhoDoCodigoPostal(typeof p.address === "string" ? p.address : null, true) ??
    concelhoDoTexto(p.city) ??
    concelhoDoTexto(p.address) ??
    concelhoDoPonto({ lat: Number(p.lat), lng: Number(p.lng) })
  );
}
