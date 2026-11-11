import type { ConteudoDaPaginaDePreco } from "@/components/precos/PaginaDePreco";
import { descricaoQueCabe } from "./descricoes-seo";
import { faixaEmTexto } from "./lista-de-parceiros-da-mudanca";
import { PRECO_FECHADO } from "./promessas-publicas";
import {
  comIva,
  euros,
  exemplosDeMudanca,
  extrasDasMudancas,
  linhasDasMudancas,
  type LinhaDaTabela,
} from "./quanto-custa";
import {
  HORAS_COM_TRES_PESSOAS,
  MATERIAIS,
  MINIMO_DA_MUDANCA,
  MINIMO_DE_HORAS,
  PESSOAS_NA_EQUIPA,
  POR_ANDAR_SEM_ELEVADOR,
  PRECO_POR_HORA,
  PRECO_POR_KM_LONGE,
  RAIO_INCLUIDO_KM,
  TIPOLOGIA_POR_EXTENSO,
  deslocacao,
  intervaloDeHorasEmTexto,
  referenciaDaCasa,
  type Tipologia,
} from "./tabela-das-mudancas";
import { TAXA_IVA } from "./taxas-plataforma";
import {
  estimativaPelaLista,
  exemploDaLista,
  exemploDaListaEmTexto,
  exemplosDaListaNumaFrase,
  minimoDaListaEmTexto,
  oQueOExemploLeva,
  precoDaMudancaNaCabeca,
  precoDaMudancaNaDescricao,
  type EstimativaDaLista,
  type PrecoPublicoDasMudancas,
} from "./preco-publico-das-mudancas";

/**
 * O QUE A PÁGINA /precos/mudancas DIZ, PELO PREÇO PÚBLICO — d7, 11-11-2026.
 *
 * A página publicava sempre os totais «na referência» (T2 310–410 € + IVA),
 * mesmo com parceiros na lista — e a lista dava cerca do dobro num T2. A
 * regra (CEO e dono, 11-11-2026):
 *   · com parceiros na lista, a página diz o que a lista dá — o «desde» por
 *     hora de 2 e de 3 pessoas e a estimativa de cada casa pelo parceiro com
 *     o preço mais baixo, com a proteção e os km — e a referência não aparece;
 *   · com a lista vazia, a tabela de referência, dita como referência.
 *
 * PURA: a página lê o preço público da base e passa-o aqui; o teste da
 * orquestra lê estes textos com e sem parceiros (regra z).
 */

type Conteudo = Omit<ConteudoDaPaginaDePreco, "pagina" | "tom" | "oferta" | "relacionados" | "ctaTitulo" | "mensagemWhatsApp" | "porConcelho">;

const IVA = `${Math.round(TAXA_IVA * 100)} %`;
type Casa = "T0" | "T1" | "T2" | "T3" | "T4+";
/** A referência de uma casa, em intervalo e com a proteção: «310–410 €». */
const faixa = (t: Casa) => {
  const o = referenciaDaCasa(t);
  return `${euros(o.totalSemIvaMinimo).replace(" €", "")}–${euros(o.totalSemIvaMaximo)}`;
};
const faixaComIva = (t: Casa) => {
  const o = referenciaDaCasa(t);
  return `${euros(comIva(o.totalSemIvaMinimo)).replace(" €", "")}–${euros(comIva(o.totalSemIvaMaximo))}`;
};
const KM_DO_EXEMPLO = 120;
const caixaMaisBarata = Math.min(...MATERIAIS.map((m) => m.preco));
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const NO_SIMULADOR =
  "No simulador vê os parceiros disponíveis, com a nota, o preço por hora, a equipa de 2 ou 3 e o material, e escolhe; " +
  "o valor final sai das horas, dos km e do material que confirma na folha do dia.";

const FATORES = [
  "A tipologia, e quanta coisa vai",
  "Os andares e o elevador nas duas casas",
  "Desmontar e montar móveis",
  "O preço por hora do parceiro que escolher, e os km pela tarifa dele",
  "O estacionamento à porta das duas casas",
  "Ter tudo embalado antes do dia poupa horas",
];

const O_PRECO_E_FECHADO = {
  question: "O preço é fechado?",
  answer:
    "A hora é a do parceiro que escolher, e fica congelada no pedido; o total sai das horas, dos km e do material que confirma na folha do dia. " +
    "É por isso que vale a pena dizer no pedido o que vai, os andares e o elevador.",
};

/** A descrição que o Google mostra (até 155 caracteres, o essencial primeiro). */
export function descricaoDoPrecoDasMudancas(preco: PrecoPublicoDasMudancas): string {
  const t2 = exemploDaLista(preco, "T2");
  return descricaoQueCabe([
    `Mudanças à hora, ${precoDaMudancaNaDescricao(preco)}.`,
    preco.tipo === "parceiros"
      ? t2
        ? `Um T2 pela lista: ${faixaEmTexto(t2.minimo, t2.maximo)}.`
        : ""
      : `Na referência, T1 ${faixa("T1")}, T2 ${faixa("T2")} + IVA.`,
    "Compare os parceiros e escolha.",
  ].filter(Boolean));
}

/** Uma linha da tabela pela lista: a casa, as horas e a equipa, e a estimativa do cartão mais barato. */
function linhaPelaLista(e: EstimativaDaLista): LinhaDaTabela {
  return {
    oQue: e.tipologia === "itens" ? "Pequena mudança (alguns móveis)" : TIPOLOGIA_POR_EXTENSO[e.tipologia],
    exemplo: `${maiuscula(intervaloDeHorasEmTexto(e.horas))} com ${e.pessoas} pessoas, ${oQueOExemploLeva(e)}`,
    valor:
      e.minimo.semIvaCent === e.maximo.semIvaCent
        ? { tipo: "cerca", valor: e.minimo.semIvaCent / 100 }
        : { tipo: "faixa", de: e.minimo.semIvaCent / 100, ate: e.maximo.semIvaCent / 100 },
  };
}

/** «um T2 com 2 pessoas (entre 6,5 e 9 h), 735–904 € com IVA (598–735 € sem IVA)» de uma casa, ou null. */
function casaPelaLista(preco: PrecoPublicoDasMudancas, t: Tipologia): string | null {
  const e = estimativaPelaLista(preco, t, false);
  return e ? exemploDaListaEmTexto(e) : null;
}

function comParceiros(preco: Extract<PrecoPublicoDasMudancas, { tipo: "parceiros" }>): Conteudo {
  const estimativas = (preco.estimativas ?? []).filter((e) => !e.desmontagem);
  const exemplos = exemplosDaListaNumaFrase(preco);
  const t2 = casaPelaLista(preco, "T2");
  const t0 = casaPelaLista(preco, "T0");
  const t1 = casaPelaLista(preco, "T1");
  const minimo = minimoDaListaEmTexto(preco);
  const PELO_MAIS_BAIXO = "pelo parceiro com o preço mais baixo de hoje, com os km mínimos dele";
  return {
    h1: "Quanto custa uma mudança?",
    resposta:
      `${precoDaMudancaNaCabeca(preco)} ${NO_SIMULADOR}` +
      (exemplos ? ` ${exemplos}` : "") +
      ` Um T3 leva ${intervaloDeHorasEmTexto(HORAS_COM_TRES_PESSOAS.T3)} com 3 pessoas — um dia inteiro.`,
    tabela: {
      titulo: "Pela lista de hoje, por tipologia",
      linhas: estimativas.map(linhaPelaLista),
    },
    caixa: {
      titulo: "O que vem na hora",
      itens: [
        "A carrinha e a equipa do parceiro — 2 ou 3 pessoas, à sua escolha",
        "Carregar, transportar e descarregar",
        "Os km do percurso, pela tarifa do parceiro",
        "A proteção dos móveis e do chão entra na estimativa; caixas e embalamento à parte, ao preço do parceiro",
      ],
    },
    fatores: FATORES,
    faqs: [
      {
        question: "Quanto custa a mudança de um T2?",
        answer: t2
          ? `Pela lista de hoje, ${t2}, ${PELO_MAIS_BAIXO}. Com o parceiro que escolher, é o preço por hora dele, e na lista vê a conta de cada um para o seu percurso.`
          : `Depende do parceiro que escolher: ${NO_SIMULADOR}`,
      },
      {
        question: "Quanto custa a mudança de um T0 ou T1?",
        answer:
          t0 && t1
            ? `Pela lista de hoje, ${t0}; ${t1} — ${PELO_MAIS_BAIXO}. Nunca menos do que o mínimo de horas do parceiro.`
            : `Depende do parceiro que escolher, e nunca menos do que o mínimo de horas dele: ${NO_SIMULADOR}`,
      },
      {
        question: "Quanto custa uma mudança para longe?",
        answer:
          "Os km contam pela tarifa de cada parceiro, e cada um diz até que distância vai: na lista vê o preço por km e os km mínimos de cada um, " +
          "e a estimativa já feita para o seu percurso. As portagens somam-se.",
      },
      O_PRECO_E_FECHADO,
      {
        question: "Há um preço mínimo?",
        answer: `Sim: o mínimo de horas de cada parceiro, que se vê na lista${minimo ? ` (hoje, ${minimo})` : ""}.`,
      },
      {
        question: "Os preços já têm IVA?",
        answer: `Na lista dos parceiros e nesta página, cada preço aparece sem IVA e com IVA (${IVA}). ${PRECO_FECHADO}`,
      },
    ],
  };
}

function naReferencia(preco: PrecoPublicoDasMudancas): Conteudo {
  return {
    h1: "Quanto custa uma mudança?",
    resposta:
      `${precoDaMudancaNaCabeca(preco)} ${NO_SIMULADOR} ` +
      `Na referência (${euros(PRECO_POR_HORA)} + IVA por hora, ${euros(comIva(PRECO_POR_HORA))} com IVA, equipa de ${PESSOAS_NA_EQUIPA}), ` +
      `com a proteção dos móveis e do chão, um T1 fica em ${faixa("T1")}, um T2 em ${faixa("T2")} e um T3 em ${faixa("T3")}, sempre + IVA ` +
      `(um T3 com IVA: ${faixaComIva("T3")}). Um T3 leva ${intervaloDeHorasEmTexto(HORAS_COM_TRES_PESSOAS.T3)} com 3 pessoas — um dia inteiro.`,
    tabela: { titulo: "Na referência, por tipologia", linhas: linhasDasMudancas() },
    extras: {
      titulo: "Os extras, na referência",
      intro: "Somam-se às horas, quando se aplicam. Cada parceiro tem a sua tarifa: a hora, os km e o material de cada um vêem-se na lista.",
      linhas: extrasDasMudancas(),
    },
    exemplos: {
      titulo: "Quatro mudanças, com as contas feitas",
      intro:
        "Feitas pela tabela de referência. São estimativas: com o parceiro que escolher, a conta é a da tarifa dele, e paga-se pelas horas confirmadas na folha do dia.",
      itens: exemplosDeMudanca(),
    },
    caixa: {
      titulo: "O que vem na hora",
      itens: [
        "A carrinha e a equipa do parceiro — 2 ou 3 pessoas, à sua escolha",
        "Carregar, transportar e descarregar",
        "Os km do percurso, pela tarifa do parceiro",
        `Materiais de embalamento à parte, ao preço do parceiro (na referência, caixas a partir de ${euros(caixaMaisBarata)})`,
      ],
    },
    fatores: FATORES,
    faqs: [
      {
        question: "Quanto custa a mudança de um T2?",
        answer:
          `Conta-se ${intervaloDeHorasEmTexto(HORAS_COM_TRES_PESSOAS.T2)} com 3 pessoas: na referência, com a proteção, ${faixa("T2")} + IVA (${faixaComIva("T2")} com IVA), ` +
          `com elevador nas duas casas e até ${RAIO_INCLUIDO_KM} km (cada andar sem elevador acresce ${euros(POR_ANDAR_SEM_ELEVADOR)}). Com o parceiro que escolher, é o preço por hora dele.`,
      },
      {
        question: "Quanto custa a mudança de um T0 ou T1?",
        answer:
          `Um T0 leva ${intervaloDeHorasEmTexto(HORAS_COM_TRES_PESSOAS.T0)} com 3 pessoas e um T1 ${intervaloDeHorasEmTexto(HORAS_COM_TRES_PESSOAS.T1)}, nunca menos do que o mínimo do parceiro. ` +
          `Na referência, com a proteção: T0 ${faixa("T0")} + IVA (${faixaComIva("T0")} com IVA), T1 ${faixa("T1")} + IVA (${faixaComIva("T1")} com IVA).`,
      },
      {
        question: "Quanto custa uma mudança para longe?",
        answer:
          `Os km contam pela tarifa de cada parceiro, e cada um diz até que distância vai. Na referência, até ${RAIO_INCLUIDO_KM} km de percurso a deslocação está incluída; acima disso, ${euros(PRECO_POR_KM_LONGE)} por km, ` +
          `contando todos os km, ida e volta, mais portagens: ${KM_DO_EXEMPLO} km são ${euros(deslocacao(KM_DO_EXEMPLO))} de deslocação, mais as horas.`,
      },
      O_PRECO_E_FECHADO,
      {
        question: "Há um preço mínimo?",
        answer: `Sim: o mínimo de horas de cada parceiro, que se vê na lista. Na referência, ${MINIMO_DE_HORAS} horas da equipa, ${euros(MINIMO_DA_MUDANCA)} + IVA (${euros(comIva(MINIMO_DA_MUDANCA))} com IVA).`,
      },
      {
        question: "Os preços já têm IVA?",
        answer: `Os valores da tabela são sem IVA, e a coluna ao lado tem o valor com IVA (${IVA}); na lista dos parceiros, cada preço aparece sem e com IVA. ${PRECO_FECHADO}`,
      },
    ],
  };
}

/** O miolo da página: pela lista com parceiros (e com estimativas), pela referência com a lista vazia. */
export function conteudoDoPrecoDasMudancas(preco: PrecoPublicoDasMudancas): Conteudo {
  if (preco.tipo === "parceiros" && (preco.estimativas ?? []).some((e) => !e.desmontagem)) return comParceiros(preco);
  return naReferencia(preco);
}
