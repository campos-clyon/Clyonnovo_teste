import { CONCELHOS_DA_COBERTURA } from "./concelhos-da-cobertura";
import { emTerra } from "./preposicao-da-terra";

/*
 * O LINK DO ANÚNCIO DA CASA — 16-11-2026 (decisão d48).
 *
 *   CLIENTE: Olá! Encontrei-vos no Google e quero um orçamento de recolha.
 *            Vou enviar fotos. (A1) estão neste site https://www.kasas-portugal.com/
 *            imovel/apartamento-t3-com-boas-areas-na-mina-de-agua-amadora/25630103
 *
 * O link dizia tudo o que a Vitória ia perguntar a seguir: é um T3, na Mina
 * de Água, na Amadora — a casa de um anúncio, quase sempre para esvaziar. A
 * Vitória leu «recolha de móveis» e pediu a morada três vezes.
 *
 * Lê-se SÓ O ENDEREÇO: as palavras que o portal põe no caminho do link (a
 * tipologia, a terra, às vezes o andar). A página não se abre — não há aqui
 * forma segura e rápida de a ir buscar, e a Vitória NUNCA diz que «abriu» ou
 * «viu» o anúncio: diz «pelo anúncio», que é o que o link mostra a quem o lê.
 *
 * Puro: lê-o a recolha do WhatsApp e os testes.
 */

/** Os portais de imóveis que se reconhecem pelo nome do sítio. */
const PORTAIS: ReadonlyArray<[RegExp, string]> = [
  [/(^|\.)idealista\.(pt|com)$/, "idealista"],
  [/(^|\.)imovirtual\.com$/, "imovirtual"],
  [/(^|\.)(kasas|casas?)-portugal\.(com|pt)$/, "kasas-portugal"],
  [/(^|\.)casa\.sapo\.pt$/, "casa sapo"],
  [/(^|\.)supercasa\.pt$/, "supercasa"],
  [/(^|\.)olx\.pt$/, "olx"],
  [/(^|\.)remax\.pt$/, "remax"],
  [/(^|\.)era\.pt$/, "era"],
  [/(^|\.)century21\.pt$/, "century21"],
  [/(^|\.)kwportugal\.pt$/, "kw"],
  [/(^|\.)zome\.pt$/, "zome"],
  [/(^|\.)casayes\.pt$/, "casayes"],
  [/(^|\.)custojusto\.pt$/, "custojusto"],
];

export type AnuncioDeImovel = {
  portal: string;
  /** «T0» a «T9», quando o link a diz. */
  tipologia?: string;
  moradia?: boolean;
  /** A terra dentro do concelho — «Mina de Água». */
  localidade?: string;
  /** O concelho, com o nome como se escreve — «Amadora». */
  concelho?: string;
  /** O andar como o simulador o grava («0», «2»…), quando o link o diz. */
  andar?: string;
};

const semAcentos = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** As palavras que perdem o acento no link e o têm no nome da terra. */
const COM_ACENTO: Record<string, string> = {
  agua: "Água", aguas: "Águas", sao: "São", joao: "João", antonio: "António", belem: "Belém",
  alcantara: "Alcântara", cacem: "Cacém", setubal: "Setúbal", azeitao: "Azeitão", alges: "Algés",
  paco: "Paço", fernao: "Fernão", merces: "Mercês", abraao: "Abraão", feijo: "Feijó", praca: "Praça",
  franca: "França", nacoes: "Nações", lumiar: "Lumiar", ameixoeira: "Ameixoeira", odivelas: "Odivelas",
  famoes: "Famões", canecas: "Caneças", sacavem: "Sacavém", camarate: "Camarate", estoril: "Estoril",
  parede: "Parede", carcavelos: "Carcavelos", alcabideche: "Alcabideche", sobreda: "Sobreda",
  laranjeiro: "Laranjeiro", pragal: "Pragal", cacilhas: "Cacilhas", piedade: "Piedade",
};
const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "a"]);

function nomeDaTerra(semAcento: string): string {
  return semAcento
    .split(/\s+/)
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : (COM_ACENTO[p] ?? p.charAt(0).toUpperCase() + p.slice(1))))
    .join(" ");
}

/** As terras de todos os concelhos, das mais compridas para as mais curtas («mina de agua» antes de «agua»). */
const TERRAS: ReadonlyArray<{ terra: string; concelho: string }> = CONCELHOS_DA_COBERTURA.flatMap((c) =>
  c.terras.map((terra) => ({ terra, concelho: c.nome })),
).sort((a, b) => b.terra.length - a.terra.length);

/** Os links da mensagem, com ou sem «https://». */
function linksDoTexto(texto: string): URL[] {
  const urls: URL[] = [];
  // Com «https://», com «www.», ou só o sítio e o caminho («supercasa.pt/venda-…»).
  for (const m of texto.matchAll(/\b(?:https?:\/\/|www\.)[^\s<>"«»]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:pt|com)\/[^\s<>"«»]*/gi)) {
    const bruto = m[0].replace(/[).,;!?]+$/, "");
    try {
      urls.push(new URL(/^https?:\/\//i.test(bruto) ? bruto : `https://${bruto}`));
    } catch {
      /* um link partido não é um anúncio */
    }
  }
  return urls;
}

function portalDe(url: URL): string | null {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  for (const [re, nome] of PORTAIS) if (re.test(host)) return nome;
  return null;
}

/**
 * O ANÚNCIO NA MENSAGEM, pelo endereço do link — ou null quando a mensagem
 * não traz o link de um portal de imóveis. No OLX só conta o que está nos
 * imóveis (lá vende-se de tudo).
 */
export function lerAnuncioDeImovel(texto: string | null | undefined): AnuncioDeImovel | null {
  for (const url of linksDoTexto(texto ?? "")) {
    const portal = portalDe(url);
    if (!portal) continue;
    let caminho = "";
    try {
      caminho = decodeURIComponent(url.pathname);
    } catch {
      caminho = url.pathname;
    }
    const t = ` ${semAcentos(caminho).replace(/[^a-z0-9]+/g, " ").trim()} `;
    if (portal === "olx" && !/ (imoveis|apartamento|moradia|casa|vivenda) /.test(t)) continue;

    const anuncio: AnuncioDeImovel = { portal };
    const tipologia = t.match(/ t\s?([0-9])(?:\s?\+\s?[0-9])? /);
    if (tipologia) anuncio.tipologia = `T${tipologia[1]}`;
    if (/ (moradia|vivenda|casa terrea) /.test(t)) anuncio.moradia = true;

    const andar = t.match(/ (\d{1,2}) (?:o )?(?:andar|piso) /);
    if (/ (r c|rc|res do chao) /.test(t)) anuncio.andar = "0";
    else if (andar) anuncio.andar = String(Number(andar[1]));

    for (const { terra, concelho } of TERRAS) {
      if (!t.includes(` ${terra} `)) continue;
      anuncio.concelho = concelho;
      if (semAcentos(concelho) !== terra) anuncio.localidade = nomeDaTerra(terra);
      break;
    }
    // A terra pode ser o próprio concelho e vir antes de uma freguesia dele: o concelho fica.
    if (!anuncio.concelho) {
      const so = CONCELHOS_DA_COBERTURA.find((c) => t.includes(` ${semAcentos(c.nome).replace(/-/g, " ")} `));
      if (so) anuncio.concelho = so.nome;
    }
    return anuncio;
  }
  return null;
}

/** O primeiro anúncio que ele mandou nesta recolha. */
export function anuncioNosTextos(textos: readonly string[]): AnuncioDeImovel | null {
  for (const t of textos) {
    const a = lerAnuncioDeImovel(t);
    if (a) return a;
  }
  return null;
}

/** A zona do anúncio, como se diz: «na Mina de Água (Amadora)», «na Amadora», ou "". */
export function zonaDoAnuncio(a: AnuncioDeImovel): string {
  if (a.localidade && a.concelho) return `${emTerra(a.localidade)} (${a.concelho})`;
  if (a.localidade) return emTerra(a.localidade);
  if (a.concelho) return emTerra(a.concelho);
  return "";
}

/** O imóvel, como se diz: «um T3», «uma moradia T4», «uma casa». */
function oImovel(a: AnuncioDeImovel): string {
  if (a.moradia) return a.tipologia ? `uma moradia ${a.tipologia}` : "uma moradia";
  if (a.tipologia) return `um ${a.tipologia}`;
  return "uma casa";
}

/**
 * «Pelo anúncio, é um T3 na Mina de Água (Amadora).» — o que o link diz, e
 * nada que só a página diria. Sem tipologia nem terra: «Pelo link, é o
 * anúncio de uma casa.»
 */
export function fraseDoAnuncio(a: AnuncioDeImovel): string {
  const zona = zonaDoAnuncio(a);
  const andar = a.andar && a.andar !== "0" && !a.moradia ? `, num ${a.andar}.º andar` : a.andar === "0" ? ", num rés-do-chão" : "";
  if (!a.tipologia && !a.moradia && !zona) return "Pela ligação, é o anúncio de uma casa.";
  return `Pelo anúncio, é ${oImovel(a)}${andar}${zona ? ` ${zona}` : ""}.`;
}

/** A pergunta que o anúncio pede: a casa toda é um esvaziamento. */
export const PERGUNTA_DO_ANUNCIO = "É para esvaziar a casa toda ou só alguns móveis?";

/** A linha do pedido: o que o link diz da casa, para a equipa e os parceiros. */
export function linhaDoAnuncio(a: AnuncioDeImovel): string {
  const partes = [
    a.moradia ? `moradia${a.tipologia ? ` ${a.tipologia}` : ""}` : (a.tipologia ?? null),
    a.andar ? (a.andar === "0" ? "r/c" : `${a.andar}.º andar`) : null,
    [a.localidade, a.concelho].filter(Boolean).join(", ") || null,
  ].filter(Boolean);
  return `Imóvel (pela ligação do anúncio que o cliente enviou): ${partes.length > 0 ? partes.join("; ") : "sem pormenores na ligação"}.`;
}
