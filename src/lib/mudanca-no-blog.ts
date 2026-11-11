import { descricaoQueCabe } from "./descricoes-seo";
import { faixaEmTexto } from "./lista-de-parceiros-da-mudanca";
import { REFERENCIA_DA_MUDANCA } from "./modelo-da-mudanca";
import { comIva, euros } from "./quanto-custa";
import { valorSemEComIva } from "./preco-de-referencia";
import {
  HORAS_COM_TRES_PESSOAS,
  HORAS_DA_DESMONTAGEM,
  MINIMO_DA_MUDANCA,
  MINIMO_DE_HORAS,
  PESSOAS_NA_EQUIPA,
  PRECO_POR_HORA,
  TIPOLOGIA_POR_EXTENSO,
  horasEscritas,
  intervaloDeHorasEmTexto,
  referenciaDaCasa,
  type Tipologia,
} from "./tabela-das-mudancas";
import {
  desdeCurtoDaLista,
  desdeDaListaEmTexto,
  estimativaPelaLista,
  exemploDaListaEmTexto,
  exemplosDaListaNumaFrase,
  minimoDaListaEmTexto,
  oQueOExemploLeva,
  precoDaMudancaNaDescricao,
  type PrecoPublicoDasMudancas,
} from "./preco-publico-das-mudancas";

/**
 * AS MUDANÇAS NO BLOG, PELO PREÇO PÚBLICO — d7, 11-11-2026.
 *
 * Os artigos de mudanças diziam sempre a tabela de referência («na
 * referência, 50 €/h + IVA — T2 310–410 € + IVA»), porque o blog não lia a
 * base. Com parceiros na lista esse número não se contrata em lado nenhum, e
 * a lista dava cerca do dobro num T2. A regra (CEO e dono, 11-11-2026):
 *   · com parceiros na lista, o artigo diz o que a lista dá — o «desde» de 2
 *     e de 3 pessoas, o mínimo dos parceiros e a estimativa de cada casa, com
 *     a proteção e os km;
 *   · com a lista vazia, a referência, dita como referência.
 *
 * PURA: `blog-data.ts` monta os artigos com estas frases, e a página do
 * artigo passa-lhe o preço público lido da base. O teste da orquestra lê-as
 * com e sem parceiros (regra z).
 */

const TIPOLOGIAS_DA_CASA: Tipologia[] = ["T0", "T1", "T2", "T3", "T4+"];

/** «310–410 €» — a referência de uma casa, sem IVA (ou com ele). */
const faixaDaCasa = (t: Tipologia, comOIva = false) => {
  const o = referenciaDaCasa(t);
  const [a, b] = comOIva ? [comIva(o.totalSemIvaMinimo), comIva(o.totalSemIvaMaximo)] : [o.totalSemIvaMinimo, o.totalSemIvaMaximo];
  return `${euros(a).replace(" €", "")}–${euros(b)}`;
};

const DESMONTAGEM =
  `Com desmontagem e montagem de móveis: mais ${horasEscritas(HORAS_DA_DESMONTAGEM.T1)} h num T1 e até ${horasEscritas(HORAS_DA_DESMONTAGEM["T4+"])} h num T4 ou maior`;

const PELO_MAIS_BAIXO = "pelo parceiro com o preço mais baixo de hoje";

export type MudancaNoBlog = {
  /** A descrição do artigo «Quanto custa uma mudança em Lisboa». */
  descricaoDoQuantoCusta: string;
  /** Depois do modelo: o «desde» da lista e os exemplos, ou a referência. */
  paraTerUmaIdeia: string;
  /** A frase antes das linhas por tipologia. */
  antesDasLinhas: string;
  /** As horas e o preço por tipologia, em linhas. */
  linhasPorTipologia: string[];
  /** O parágrafo do artigo das pequenas mudanças. */
  pequenasMudancas: string;
  /** «Posso transportar só um sofá?» */
  soUmSofa: string;
  /** A descrição do artigo «Mudança entre Lisboa e a Margem Sul». */
  descricaoDaMargemSul: string;
  /** O T2 de exemplo, no artigo da Margem Sul. */
  umT2PorExemplo: string;
  /** «Quanto custa a mudança de um T2 de Lisboa para o Seixal?» */
  t2ParaOSeixal: string;
  /** «O preço inclui IVA?» */
  incluiIva: string;
};

const TABELA_NO_BLOG = "A tabela por tipologia está em [quanto custa uma mudança em Lisboa](/blog/quanto-custa-uma-mudanca-em-lisboa).";

function pelaLista(preco: Extract<PrecoPublicoDasMudancas, { tipo: "parceiros" }>): MudancaNoBlog {
  const desde = desdeDaListaEmTexto(preco);
  const exemplos = exemplosDaListaNumaFrase(preco);
  const minimo = minimoDaListaEmTexto(preco);
  const hoje = minimo ? ` (hoje, ${minimo})` : "";
  const t2 = estimativaPelaLista(preco, "T2", false);
  const linhas = TIPOLOGIAS_DA_CASA.flatMap((t) => {
    const e = estimativaPelaLista(preco, t, false);
    return e
      ? [`${TIPOLOGIA_POR_EXTENSO[t]}: ${intervaloDeHorasEmTexto(e.horas)} com ${e.pessoas} pessoas — ${faixaEmTexto(e.minimo, e.maximo)}, ${oQueOExemploLeva(e)}`]
      : [];
  });
  const umT2 = t2 ? `${exemploDaListaEmTexto(t2)}, ${PELO_MAIS_BAIXO}, ${oQueOExemploLeva(t2)} mínimos dele` : null;
  return {
    descricaoDoQuantoCusta: descricaoQueCabe(
      [
        `Quanto custa uma mudança em Lisboa: à hora, ${precoDaMudancaNaDescricao(preco)}.`,
        t2 ? `Um T2 pela lista: ${faixaEmTexto(t2.minimo, t2.maximo)}.` : "",
      ].filter(Boolean),
    ),
    paraTerUmaIdeia: `Hoje, na lista: ${desde}.${exemplos ? ` ${exemplos}` : ""}`,
    antesDasLinhas:
      `Antes de alguém ver a casa, conta-se assim pela tipologia, ${PELO_MAIS_BAIXO} (com os km mínimos dele, sem andares a pé nem distâncias longas). ` +
      "No fim pagam-se as horas confirmadas na folha do dia:",
    linhasPorTipologia: [...linhas, DESMONTAGEM],
    pequenasMudancas:
      `Pagam-se como as mudanças: à hora, ao preço do parceiro que escolher, com o mínimo de horas dele${hoje}. Hoje, na lista: ${desde}. ` +
      "Uma pequena mudança conta-se, à partida, pelo mínimo, e por isso fica bem abaixo de uma mudança completa. No simulador vê o preço de cada parceiro.",
    soUmSofa:
      `Sim. É um dos pedidos mais comuns. Paga-se à hora, ao preço do parceiro que escolher, com o mínimo de horas dele${hoje}; ` +
      "o tamanho do sofá, a distância e o acesso nos dois endereços dizem se esse mínimo chega.",
    descricaoDaMargemSul: descricaoQueCabe([
      `De Lisboa para Almada, Seixal ou Barreiro, ou o contrário: a ponte, o tempo e o preço — à hora, ${desdeCurtoDaLista(preco)}.`,
    ]),
    umT2PorExemplo: umT2
      ? `Por exemplo, pela lista de hoje, ${umT2}; os km entre as margens contam pela tarifa do parceiro. ${TABELA_NO_BLOG}`
      : `Os km entre as margens contam pela tarifa do parceiro. ${TABELA_NO_BLOG}`,
    t2ParaOSeixal:
      (umT2 ? `Pela lista de hoje, ${umT2} — ` : "Depende do parceiro que escolher — ") +
      "mais os km do percurso acima desses, e as caixas, se as pedir. Cada parceiro tem o seu preço por hora: no simulador vê os disponíveis e escolhe.",
    incluiIva: `Na lista dos parceiros cada preço por hora aparece sem IVA e com IVA (hoje, ${desde}). Há fatura em todas as vendas.`,
  };
}

function naReferencia(): MudancaNoBlog {
  return {
    // A hora com o com IVA ao lado; dizia «…, T3 250 €, sem IVA.» (31-10-2026).
    descricaoDoQuantoCusta: `Quanto custa uma mudança em Lisboa: cada parceiro tem o seu preço por hora; na referência, ${PRECO_POR_HORA} €/h + IVA (${euros(comIva(PRECO_POR_HORA))}/h com IVA) — T2 ${faixaDaCasa("T2")} + IVA.`,
    paraTerUmaIdeia: `Para ter uma ideia antes de comparar, a ${REFERENCIA_DA_MUDANCA}.`,
    antesDasLinhas:
      "Antes de alguém ver a casa, contam-se estas horas pela tipologia (equipa de 3; com 2 pessoas leva mais tempo), sem andares a pé nem distâncias longas. No fim pagam-se as horas confirmadas na folha do dia:",
    linhasPorTipologia: [
      ...TIPOLOGIAS_DA_CASA.map((t) => {
        const horas = intervaloDeHorasEmTexto(HORAS_COM_TRES_PESSOAS[t]);
        const equipa = t === "T3" || t === "T4+" ? ", só com 3 pessoas" : " com 3 pessoas";
        return `${TIPOLOGIA_POR_EXTENSO[t]}: ${horas}${equipa} — ${faixaDaCasa(t)} + IVA (${faixaDaCasa(t, true)} com IVA) na referência, com a proteção`;
      }),
      DESMONTAGEM,
    ],
    pequenasMudancas: `Pagam-se como as mudanças: à hora, ao preço do parceiro que escolher, com o mínimo de horas dele. Na referência, ${PRECO_POR_HORA} € + IVA por hora pela equipa de ${PESSOAS_NA_EQUIPA}, com o mínimo de ${MINIMO_DE_HORAS} horas — ${MINIMO_DA_MUDANCA} € + IVA (${euros(comIva(MINIMO_DA_MUDANCA))} com IVA). Uma pequena mudança conta-se, à partida, pelo mínimo, e por isso fica bem abaixo de uma mudança completa. No simulador vê o preço de cada parceiro.`,
    soUmSofa: `Sim. É um dos pedidos mais comuns. Paga-se à hora, ao preço do parceiro que escolher, com o mínimo de horas dele (na referência, ${MINIMO_DE_HORAS} horas, ${MINIMO_DA_MUDANCA} € + IVA, ${euros(comIva(MINIMO_DA_MUDANCA))} com IVA); o tamanho do sofá, a distância e o acesso nos dois endereços dizem se esse mínimo chega.`,
    descricaoDaMargemSul: `De Lisboa para Almada, Seixal ou Barreiro, ou o contrário: a ponte, o tempo e o preço — à hora, ao preço do parceiro (referência ${PRECO_POR_HORA} €/h + IVA).`,
    umT2PorExemplo: `Um T2, por exemplo, leva ${intervaloDeHorasEmTexto(HORAS_COM_TRES_PESSOAS.T2)} com 3 pessoas — ${faixaDaCasa("T2")} + IVA na referência, com a proteção (${faixaDaCasa("T2", true)} com IVA); os km entre as margens contam pela tarifa do parceiro. ${TABELA_NO_BLOG}`,
    t2ParaOSeixal: `Conte com ${intervaloDeHorasEmTexto(HORAS_COM_TRES_PESSOAS.T2)} com 3 pessoas — na referência, com a proteção, ${faixaDaCasa("T2")} + IVA (${faixaDaCasa("T2", true)} com IVA) —, mais os km e as caixas, se as pedir. Cada parceiro tem o seu preço por hora: no simulador vê os disponíveis e escolhe.`,
    incluiIva: `Na lista dos parceiros cada preço por hora aparece sem IVA e com IVA (na referência, ${valorSemEComIva(PRECO_POR_HORA)} por hora). Há fatura em todas as vendas.`,
  };
}

/** As frases das mudanças nos artigos: pela lista com parceiros, pela referência com a lista vazia. */
export function mudancaNoBlog(preco: PrecoPublicoDasMudancas): MudancaNoBlog {
  return preco.tipo === "parceiros" ? pelaLista(preco) : naReferencia();
}
