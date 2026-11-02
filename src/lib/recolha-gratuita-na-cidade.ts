/**
 * «RECOLHA GRATUITA DE MÓVEIS USADOS» — LISBOA E SETÚBAL — 02-11-2026.
 *
 * Em Outubro, «recolha gratuita de móveis usados» foi a pesquisa que mais
 * cresceu, e a variante «… setúbal» também. Quem a faz quer grátis; a CLYON
 * cobra. A resposta honesta é a mesma das páginas de monos («Câmara ou de
 * casa», 31-10): pela Câmara é grátis, com marcação e no local combinado; sem
 * esperar e de dentro de casa, com um parceiro — pago, com o preço à vista.
 *
 * PORQUÊ UMA SECÇÃO E NÃO UMA PÁGINA NOVA: no Search Console (28 dias), estas
 * pesquisas já caem em /recolha-moveis-lisboa e /recolha-moveis-setubal, as
 * páginas que ganham. Uma página nova a disputar a mesma pesquisa dividia-a
 * em duas. A secção responde dentro da página que o Google já escolheu; a
 * página de doar (/recolha-gratuita-de-moveis-usados) fica com quem quer doar.
 *
 * REGRA: como em `recolha-da-camara.ts`, nada aqui é inventado. Cada frase
 * sai das fontes em `fontes`, lidas a `LIDAS_EM`. O que não se confirmou (a
 * Betel não abriu nesse dia; a REMAR não diz que vai a Setúbal) ficou de fora.
 */

import { PRECOS } from "@/lib/precos-publicos";
import { faixaSemEComIva } from "@/lib/preco-de-referencia";
import { PROPOSTAS_EM_ATE } from "@/lib/promessas-publicas";
import type { FonteOficial } from "@/lib/recolha-da-camara";

export const LIDAS_EM = "2026-11-02";

/** Onde fica a secção, para as ligações de fora (a página de doar). */
export const ANCORA_DA_RECOLHA_GRATUITA = "recolha-gratuita";

export type Doacao = { nome: string; oQueDiz: string; fonte: FonteOficial };

export type RecolhaGratuitaNaCidade = {
  titulo: string;
  intro: string;
  camara: { titulo: string; frases: string[]; fontes: FonteOficial[] };
  doar: Doacao[];
  faqs: { q: string; a: string }[];
};

/** «40 – 120 € + IVA (49,20 – 147,60 € com IVA)» — da fonte única. */
export const PRECO_DOS_MOVEIS = faixaSemEComIva(PRECOS.recolha_moveis.minimo!, PRECOS.recolha_moveis.maximo!);

/** Quando compensa pedir a um parceiro — igual nas duas terras. */
export const QUANDO_COMPENSA_UM_PARCEIRO: string[] = [
  "Os móveis estão dentro de casa ou num andar sem elevador: o parceiro vai buscá-los lá dentro, e não tem de os pôr na rua.",
  `Não pode esperar pela data da Câmara: recebe propostas ${PROPOSTAS_EM_ATE} e combina o dia com o parceiro que escolher.`,
  "É preciso desmontar um roupeiro, uma cama ou uma estante antes de sair.",
  "Vai tudo de uma vez: móveis, eletrodomésticos, colchões e caixas num só pedido, com o preço fechado antes de começar.",
];

const REMAR: Doacao = {
  nome: "REMAR Portugal",
  oQueDiz:
    "Recolhe móveis, eletrodomésticos e outros bens em condições de reutilização, em Lisboa e Vale do Tejo. Avalia cada pedido pelo tipo de bens, o estado, a localização e a disponibilidade das equipas — a recolha não é garantida. Pede-se num formulário no site, com fotografias.",
  fonte: { nome: "remar.pt — Donativos", url: "https://remar.pt/donativos/" },
};

const CARITAS_SETUBAL: Doacao = {
  nome: "Cáritas Diocesana de Setúbal",
  oQueDiz:
    "Recebe donativos de mobiliário e de outros bens em espécie; o site pede que a contacte antes. Não diz se vai buscá-los a casa.",
  fonte: { nome: "caritassetubal.pt — Campanhas de donativos", url: "https://www.caritassetubal.pt/campanhas-de-donativos/" },
};

export const RECOLHA_GRATUITA_NA_CIDADE: Record<string, RecolhaGratuitaNaCidade> = {
  lisboa: {
    titulo: "Recolha gratuita de móveis usados em Lisboa: a Câmara ou de casa",
    intro:
      "Há duas formas de tirar móveis usados de casa em Lisboa. Pela Câmara é grátis, com marcação, e os móveis ficam no local e no dia combinados. Sem esperar e de dentro de casa, um parceiro da plataforma vai buscá-los — é pago, com o preço fechado antes.",
    camara: {
      titulo: "Pela Câmara de Lisboa: grátis, com marcação",
      frases: [
        "A remoção de objetos volumosos é gratuita e reservada a pessoas em nome individual; empresas e associações recorrem a um coletor particular.",
        "Pede-se na Na Minha Rua LX, pelo 800 910 211 (chamada gratuita), pelo 218 170 552 (dias úteis das 8h às 20h, sábado das 10h às 18h) ou na junta de freguesia.",
        "O dia, a hora e o local combinam-se com a Câmara, e levar os móveis até esse local é consigo — deixá-los na rua sem esse acordo não é permitido.",
      ],
      fontes: [
        { nome: "lisboa.pt — Separação e reciclagem", url: "https://www.lisboa.pt/temas/higiene-urbana/separacao-e-reciclagem" },
        { nome: "servicos.lisboa.pt — Pedido de intervenção", url: "https://servicos.lisboa.pt/pedidos/detalhe/pedido-de-intervencao-ambiente" },
        {
          nome: "Regulamento de Resíduos de Lisboa",
          url: "https://www.lisboa.pt/fileadmin/info_administrativa/normativas/regulamentos/ambiente/Regulamento_de_Gest%C3%A3o_de_Res%C3%ADduos_Limpeza_e_Higiene_Urbana_de_Lisboa.pdf",
        },
      ],
    },
    doar: [REMAR],
    faqs: [
      {
        q: "A recolha de móveis usados é gratuita em Lisboa?",
        a: `Pela Câmara, sim: é gratuita para particulares e pede-se na Na Minha Rua LX ou pelo 800 910 211; os móveis ficam no local e no dia combinados. Se estão dentro de casa ou não pode esperar, um parceiro da CLYON vai buscá-los — é pago, com referência de ${PRECO_DOS_MOVEIS}.`,
      },
      {
        q: "Onde doar móveis usados em Lisboa?",
        a: "A REMAR recolhe móveis em condições de reutilização em Lisboa e Vale do Tejo, depois de avaliar cada pedido no formulário do site. Para peças estragadas fica a recolha de monos da Câmara.",
      },
    ],
  },

  setubal: {
    titulo: "Recolha gratuita de móveis usados em Setúbal: a Câmara ou de casa",
    intro:
      "Há duas formas de tirar móveis usados de casa em Setúbal. Pelos Serviços Municipalizados é grátis, com marcação antes de pôr os móveis na rua. Sem esperar e de dentro de casa, um parceiro da plataforma vai buscá-los — é pago, com o preço fechado antes.",
    camara: {
      titulo: "Pelos Serviços Municipalizados de Setúbal: grátis, com marcação",
      frases: [
        "Os Serviços Municipalizados (SMS) recolhem gratuitamente mobiliário, equipamentos elétricos, colchões e outros objetos fora de uso.",
        "Marca-se antes de pôr o que quer que seja na rua: 800 210 522 (chamada gratuita) ou 265 245 900.",
        "Ao comprar um eletrodoméstico grande, a loja é obrigada por lei a recolher o usado, mesmo quando entrega o novo.",
      ],
      fontes: [
        {
          nome: "sms-setubal.pt — Recolha de monos e objetos fora de uso",
          url: "https://sms-setubal.pt/sms-residuos/recolha-de-monos-e-objetos-fora-de-uso/",
        },
      ],
    },
    doar: [CARITAS_SETUBAL],
    faqs: [
      {
        q: "A recolha de móveis usados é gratuita em Setúbal?",
        a: `Pelos Serviços Municipalizados, sim: marca-se pelo 800 210 522 (chamada gratuita) ou pelo 265 245 900 antes de pôr os móveis na rua. Se estão dentro de casa ou não pode esperar, um parceiro da CLYON vai buscá-los — é pago, com referência de ${PRECO_DOS_MOVEIS}.`,
      },
      {
        q: "Onde doar móveis usados em Setúbal?",
        a: "A Cáritas Diocesana de Setúbal recebe donativos de mobiliário e pede que a contacte antes; o site não diz se vai buscá-los a casa. Para peças estragadas fica a recolha de monos dos Serviços Municipalizados.",
      },
    ],
  },
};

/** A secção só existe nas páginas de móveis destas terras. */
export function recolhaGratuitaNaCidade(serviceSlug: string, citySlug: string): RecolhaGratuitaNaCidade | null {
  if (serviceSlug !== "recolha-moveis") return null;
  return RECOLHA_GRATUITA_NA_CIDADE[citySlug] ?? null;
}
