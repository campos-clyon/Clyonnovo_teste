import { caminhoDoServicoNaCidade } from "./caminho-da-cidade";
import { PRECOS, type PrecoPublico } from "./precos-publicos";

/*
 * AS PÁGINAS EM INGLÊS — 14-10-2026 (auditoria de SEO, 90 dias).
 *
 * Lisboa, Cascais e Oeiras têm muita gente de fora — residentes estrangeiros,
 * senhorios de alojamento local, quem chega e quem parte — que pesquisa em
 * inglês («junk removal Lisbon», «furniture removal Cascais»). O site só
 * falava português, e a Fixando aparece nessas pesquisas com versão inglesa.
 *
 * O texto é o das páginas portuguesas destas terras (cidades-local.ts e
 * recolha-da-camara.ts), traduzido — nada que o site português não diga. O
 * pedido continua a fazer-se pelo WhatsApp (a Vitória e a equipa respondem na
 * língua do cliente) ou pelo simulador, que está em português.
 */

export type PaginaEmIngles = {
  /** O endereço: /en/<slug>. */
  slug: string;
  /** A terra, em inglês. */
  cidade: string;
  /** O slug da terra nas páginas portuguesas. */
  slugPt: string;
  titulo: string;
  descricao: string;
  intro: string;
  zonas: string[];
  acesso: string;
  estacionamento: string;
  /** A recolha gratuita da câmara, dita como as páginas portuguesas a dizem. */
  camara: string;
};

export const PAGINAS_EM_INGLES: PaginaEmIngles[] = [
  {
    slug: "junk-removal-lisbon",
    cidade: "Lisbon",
    slugPt: "lisboa",
    titulo: "Junk & Furniture Removal in Lisbon",
    descricao:
      "Furniture, junk and rubble removal and house clearances in Lisbon by verified local professionals. Quotes in under 6 hours, price fixed before work.",
    intro:
      "Old sofas, beds, wardrobes, appliances, a whole flat to clear, or rubble from a small renovation: CLYON connects you with verified professionals who work in Lisbon. You describe what needs to go, receive their quotes in under 6 hours, and choose — the price is agreed before anyone comes round.",
    zonas: ["Alfama", "Graça", "Chiado", "Baixa", "Bairro Alto", "Areeiro", "Parque das Nações", "Benfica", "Lumiar", "Alvalade", "Olivais"],
    acesso:
      "Lisbon is not one city. Alfama, Graça and Bairro Alto have streets where a large van does not fit, and 19th-century buildings without a lift, where everything comes down the stairs. Parque das Nações and Alvalade are the opposite: wide access and loading spaces at the door.",
    estacionamento:
      "Much of the centre is EMEL paid parking. In Chiado, Baixa, Bairro Alto and Alfama a loading space should be booked in advance — without it the van parks far away and the job takes twice as long. Mention it in your request.",
    camara:
      "Lisbon City Council collects bulky household items free of charge. You book it through Na Minha Rua LX, on 800 910 211 (free call) or at your parish council; the day, time and spot are agreed with the Council, and carrying the items to that spot is up to you. A paid collection makes sense when you need a set date, or the items carried out of the flat rather than from the pavement.",
  },
  {
    slug: "junk-removal-cascais",
    cidade: "Cascais",
    slugPt: "cascais",
    titulo: "Junk & Furniture Removal in Cascais",
    descricao:
      "Furniture, junk and rubble removal and house clearances in Cascais, Estoril and Carcavelos by verified local professionals. Quotes in under 6 hours.",
    intro:
      "Clearing a villa before a sale, emptying a holiday let between tenants, or getting rid of an old sofa and a broken washing machine: CLYON connects you with verified professionals who work in Cascais. You describe what needs to go, receive their quotes in under 6 hours, and choose — the price is agreed before anyone comes round.",
    zonas: ["Cascais", "Estoril", "Parede", "Carcavelos", "Alcabideche", "Oeiras", "Sintra"],
    acesso:
      "Villas with a garden and a gate rather than apartment blocks — which changes everything: the van can usually pull up close, but there are often outdoor steps and stairs up to the door.",
    estacionamento:
      "Parking is hard near the marina and the bay at weekends and in summer. In the residential areas inland it is easy.",
    camara:
      "In Cascais, bulky-item collection is free and is booked in advance with Cascais Ambiente through the Linha Cascais, 800 203 186 (free call, weekdays 9am–6pm), or on FixCascais. Items go out to the street only on the day given; doors, windows, sanitary ware and other renovation waste do not count as bulky items.",
  },
  {
    slug: "junk-removal-oeiras",
    cidade: "Oeiras",
    slugPt: "oeiras",
    titulo: "Junk & Furniture Removal in Oeiras",
    descricao:
      "Furniture, junk and rubble removal and house clearances in Oeiras, Paço de Arcos and Algés by verified local professionals. Quotes in under 6 hours.",
    intro:
      "Moving out, renovating, or finally clearing the storage room: CLYON connects you with verified professionals who work in Oeiras. You describe what needs to go, receive their quotes in under 6 hours, and choose — the price is agreed before anyone comes round.",
    zonas: ["Oeiras", "Paço de Arcos", "Algés", "Carnaxide", "Linda-a-Velha", "Cascais", "Amadora"],
    acesso:
      "Algés and Linda-a-Velha have older buildings on steep streets, where the van ends up on a different level from the door. Oeiras and Paço de Arcos are more recent, with garages and lifts.",
    estacionamento:
      "Near the seafront road and the train stations parking is always contested. In the streets above the railway line it is easy.",
    camara:
      "In Oeiras, bulky-item collection is requested from the Municipality on the free number 800 201 205 or by email to daqv@oeiras.pt. The day, time and spot are agreed with the Council on each area's collection days, and taking the items there is up to you.",
  },
];

export function paginaEmIngles(slug: string): PaginaEmIngles | null {
  return PAGINAS_EM_INGLES.find((p) => p.slug === slug) ?? null;
}

/** A página portuguesa equivalente — a da recolha de móveis da mesma terra. */
export function equivalenteEmPortugues(p: PaginaEmIngles): string {
  return caminhoDoServicoNaCidade("recolha-moveis", p.slugPt);
}

/** O endereço inglês de uma terra portuguesa, se a tiver. */
export function enderecoEmIngles(slugPt: string): string | null {
  const p = PAGINAS_EM_INGLES.find((x) => x.slugPt === slugPt);
  return p ? `/en/${p.slug}` : null;
}

/** «€40–120 + VAT», «from €110/m³ + VAT» — a tabela portuguesa, dita em inglês. */
export function precoEmIngles(p: PrecoPublico): string {
  const unidade = p.unidade ? `/${p.unidade}` : "";
  if (p.minimo != null && p.maximo != null) return `€${p.minimo}–${p.maximo} + VAT`;
  if (p.minimo != null) return `from €${p.minimo}${unidade} + VAT`;
  return "quote on request";
}

export const PRECOS_EM_INGLES = [
  { servico: "Furniture removal (sofa, bed, wardrobe…)", preco: precoEmIngles(PRECOS.recolha_moveis) },
  { servico: "Bulky waste and junk", preco: precoEmIngles(PRECOS.recolha_monos) },
  { servico: "Construction rubble, in bags", preco: precoEmIngles(PRECOS.recolha_entulho) },
  { servico: "House clearance", preco: precoEmIngles(PRECOS.esvaziamento_casa) },
];
