import { DESMONTAGEM_A_PEDIDO, NO_MESMO_DIA, O_DIA_DO_TRABALHO, PROMESSA_DO_PRAZO, PROPOSTAS_EM_ATE } from "./promessas-publicas";
import { PECAS_DE_REFERENCIA, PRECOS, SEM_IVA_NA_FRASE, maisIva, pecaEmLinha } from "./precos-publicos";
import { RECOLHA_DA_CAMARA, primeiraFrase } from "./recolha-da-camara";
import {
  COMO_SE_RECOLHE_ENTULHO,
  NAO_HA_CONTENTORES,
  PESO_DO_SACO,
  RESPOSTA_SOBRE_CONTENTORES,
  SACOS_POR_METRO_CUBICO,
} from "./sacos-de-entulho";
import { caminhoDoServicoNaCidade } from "./caminho-da-cidade";
import { getCidadeLocal } from "./cidades-local";
import {
  EXTRAS_DA_MUDANCA,
  HORAS_A_MAIS_COM_DESMONTAGEM,
  HORAS_POR_TIPOLOGIA,
  MINIMO_DA_MUDANCA,
  MINIMO_DE_HORAS,
  PESSOAS_NA_EQUIPA,
  PRECO_DA_MUDANCA_POR_EXTENSO,
  PRECO_POR_HORA,
  RAIO_INCLUIDO_KM,
  TIPOLOGIA_POR_EXTENSO,
  type Tipologia,
} from "./tabela-das-mudancas";

/*
 * AS HORAS DE CADA TIPOLOGIA, EM LINHAS — 14-10-2026.
 *
 * O artigo «Quanto custa uma mudança em Lisboa» prometia preços e dizia que
 * «o valor sai da descrição do caso, e não de uma tabela». Desde 13-10-2026
 * há tabela, e o dono manteve-a (50 € + IVA por hora). Os números saem de
 * tabela-das-mudancas.ts, para o artigo não voltar a divergir dela.
 */
const TIPOLOGIAS_DA_CASA: Tipologia[] = ["T0", "T1", "T2", "T3", "T4+"];
const HORAS_E_PRECO_POR_TIPOLOGIA = [
  ...TIPOLOGIAS_DA_CASA.map((t) => {
    const h = HORAS_POR_TIPOLOGIA[t];
    const horas = t === "T4+" ? `${h} horas ou mais` : `cerca de ${h} horas`;
    return `${TIPOLOGIA_POR_EXTENSO[t]}: ${horas} — ${h * PRECO_POR_HORA} € + IVA`;
  }),
  `Com desmontagem e montagem de móveis: mais ${HORAS_A_MAIS_COM_DESMONTAGEM} hora (${HORAS_A_MAIS_COM_DESMONTAGEM * PRECO_POR_HORA} € + IVA)`,
];

/*
 * O QUE ESTE FICHEIRO DEIXOU DE PUBLICAR — 30-09-2026.
 *
 * Vários artigos tinham, no corpo, notas de estratégia escritas para quem
 * gere o site («Uma boa estratégia SEO…», «Do lado do conteúdo SEO…», «Em
 * SEO, este tipo de conteúdo…», «a CLYON se posiciona bem nas pesquisas»),
 * e duas meta descriptions começavam por «Guia SEO» e «Artigo SEO». Era
 * isso que o Google mostrava a quem pesquisava. Passam a falar com o leitor.
 *
 * As respostas sobre prazos e desmontagem vêm de promessas-publicas.ts, e a
 * limpeza pós-obra deixa de aparecer como serviço da CLYON (não é categoria
 * de serviço em service-categories.ts).
 */

export type BlogPost = {
  slug: string;
  title: string;
  /**
   * O título para o <title> e o Google, quando o `title` não cabe.
   *
   * O layout acrescenta « | CLYON» e o Google corta por volta dos 60
   * caracteres; os títulos dos artigos iam até 113. O `title` fica inteiro
   * no H1 e no schema — é o que o leitor vê depois de clicar.
   */
  metaTitle?: string;
  description: string;
  category: string;
  keywords: string[];
  readingTime: string;
  publishDate: string;
  /**
   * A data do último retoque a sério, quando houve um.
   *
   * Sai como `dateModified` no schema, que é o que o Google mostra ao lado
   * do resultado. Só se põe aqui quando o artigo mudou mesmo: uma data nova
   * num texto igual é uma promessa de frescura que o leitor desmente no
   * primeiro parágrafo.
   */
  updatedDate?: string;
  heroLabel: string;
  intro: string;
  sections: Array<{
    title: string;
    paragraphs: string[];
    bullets?: string[];
  }>;
  faq: Array<{
    question: string;
    answer: string;
  }>;
};

/*
 * OS NÚMEROS DOS ARTIGOS DE 14-10-2026, tirados de onde o site os tira: a
 * peça do sofá e a faixa da recolha de móveis de precos-publicos.ts, a
 * recolha da Câmara de Lisboa de recolha-da-camara.ts, e o estacionamento
 * de Lisboa de cidades-local.ts. O artigo não diz outra coisa que a página.
 */
const SOFA = PECAS_DE_REFERENCIA.find((p) => p.peca.startsWith("Sofá"))!;
const CAMARA_DE_LISBOA = RECOLHA_DA_CAMARA.lisboa?.monos?.texto ?? "";
const ESTACIONAMENTO_EM_LISBOA = getCidadeLocal("lisboa")?.estacionamento ?? "";

/*
 * OS NÚMEROS DOS GUIAS DE 15-10-2026, tirados de onde o site os tira: os
 * preços de precos-publicos.ts, as regras das câmaras de recolha-da-camara.ts
 * (lidas a 07-10-2026), o serviço de entulho de sacos-de-entulho.ts e a tabela
 * das mudanças de tabela-das-mudancas.ts. As ligações às terras saem de
 * `caminhoDoServicoNaCidade`, que conhece as páginas que se juntaram a outras.
 */
const CONCELHOS_COM_REGRAS = Object.keys(RECOLHA_DA_CAMARA);

/** «[Almada](/recolha-monos-almada), [Seixal](…)» — os concelhos com regras publicadas. */
function ligacoesDasCamaras(
  servico: "recolha-monos" | "recolha-entulho",
  so: (concelho: string) => boolean = () => true,
): string {
  return CONCELHOS_COM_REGRAS.filter(so)
    .map((c) => `[${RECOLHA_DA_CAMARA[c].concelho}](${caminhoDoServicoNaCidade(servico, c)})`)
    .join(", ");
}

/** A primeira frase das regras do entulho de uma câmara, com a ligação à página dela. */
function entulhoNaCamara(concelho: string): string | null {
  const regras = RECOLHA_DA_CAMARA[concelho];
  const texto = regras?.entulho?.texto;
  if (!regras || !texto) return null;
  return `[${regras.concelho}](${caminhoDoServicoNaCidade("recolha-entulho", concelho)}): ${primeiraFrase(texto)}`;
}

/** Sem custo até um limite (Lisboa, Oeiras) e com tarifas diferentes (Almada, Seixal, Setúbal, Montijo). */
const EXEMPLOS_DE_ENTULHO = ["lisboa", "oeiras", "almada", "seixal", "setubal", "montijo"]
  .map(entulhoNaCamara)
  .filter((x): x is string => x != null);

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "recolha-gratuita-de-moveis-usados-costa-da-caparica",
    title:
      "Recolha gratuita de móveis usados na Costa da Caparica: quando faz sentido e quando pedir recolha privada",
    metaTitle: "Recolha Gratuita de Móveis na Costa da Caparica",
    description:
      "Recolha gratuita de móveis usados na Costa da Caparica: doação, recolha de monos pela junta de freguesia e quando compensa a recolha paga.",
    category: "Costa da Caparica",
    keywords: [
      "recolha gratuita de móveis costa da caparica",
      "recolha gratuita de móveis usados costa da caparica",
      "doar móveis costa da caparica",
      "recolha de móveis costa da caparica",
      "móveis usados costa da caparica",
      "recolha municipal de móveis costa da caparica",
    ],
    readingTime: "7 min",
    publishDate: "2026-04-27",
    updatedDate: "2026-10-28",
    heroLabel: "Guia local",
    intro:
      "Na Costa da Caparica, quem quer desfazer-se de móveis usados tem três caminhos: doá-los, marcar a recolha de monos com a junta de freguesia, ou pagar a um profissional que os retire. Este guia ajuda a perceber quando faz sentido tentar uma via gratuita e quando a recolha paga é a opção mais eficaz.",
    sections: [
      {
        title: "Recolha gratuita: o que existe na Costa da Caparica",
        paragraphs: [
          "Nem sempre é preciso pagar. Se os móveis ainda servem, podem ser doados — há quem os vá buscar a casa. Se já não servem, a Câmara de Almada encaminha os monos gratuitamente: a recolha agenda-se com a junta de freguesia e é feita à porta, e os volumes também podem ser entregues no Ecocentro de Almada.",
          "Quem recebe doações, e em que condições, está confirmado nos sites oficiais e reunido numa página: [doar móveis usados em Lisboa](/recolha-gratuita-de-moveis-usados).",
        ],
      },
      {
        title: "Quando faz sentido tentar doação ou reaproveitamento",
        paragraphs: [
          "Se os móveis usados estão em bom estado, limpos, completos e com utilidade real, pode fazer sentido tentar doação, oferta a particulares ou reaproveitamento antes da remoção definitiva.",
          "Isto aplica-se sobretudo a sofás em condições aceitáveis, camas completas, mesas, cadeiras e armários que ainda possam ser utilizados por outra pessoa.",
        ],
        bullets: [
          "Peças em bom estado e prontas a usar",
          "Móveis usados com valor social ou funcional",
          "Casos em que existe tempo para esperar resposta",
          "Pedidos em que a prioridade não é libertar o espaço depressa",
        ],
      },
      {
        title: "Quando a recolha privada compensa mais",
        paragraphs: [
          "Se o objetivo é tirar os móveis rapidamente, desmontar no local, descer escadas, carregar volumes pesados e libertar o espaço sem depender de várias entidades, a recolha privada passa a ser muito mais eficaz.",
          "É aqui que a CLYON pode ajudar na Costa da Caparica: liga-o a profissionais da zona que recolhem sofás, camas, armários, colchões, eletrodomésticos e recheios quando a via gratuita não resolve o problema prático. É um serviço pago, com propostas em menos de 6 horas.",
        ],
      },
    ],
    faq: [
      {
        question: "Existe recolha gratuita de móveis usados na Costa da Caparica?",
        answer:
          "Sim: a recolha de monos, gratuita, que se agenda com a junta de freguesia e é feita à porta, e a doação de peças em bom estado a instituições que as recebem.",
      },
      {
        question: "A CLYON faz recolha gratuita de móveis?",
        answer:
          "Não. A CLYON é um serviço pago: liga-o a profissionais que carregam, transportam e retiram tudo — e desmontam, se o pedir — quando a via gratuita não chega.",
      },
      {
        question: "Quando devo pedir recolha privada na Costa da Caparica?",
        answer:
          "Quando há urgência, peças pesadas, escadas, falta de transporte próprio, mistura de móveis e recheios ou necessidade de libertar o espaço sem depender de várias tentativas de doação.",
      },
    ],
  },
  {
    slug: "recolha-de-moveis-como-funciona",
    // 21-10-2026: a consulta que mais o mostra é «recolha gratuita de móveis
    // usados» (105 impressões em 28 dias, posição 10,5, CTR 1 %) e o título
    // não respondia a ela. A secção «Quando a recolha gratuita não resolve» já.
    title: "Recolha de móveis usados: gratuita ou paga, como funciona e quanto custa",
    metaTitle: "Recolha de Móveis Usados: Gratuita ou Paga?",
    description:
      "Recolha de móveis usados em Lisboa e Setúbal: quando a da câmara é gratuita, quando compensa pagar, quanto custa e como funciona.",
    category: "Móveis",
    keywords: [
      "recolha de móveis",
      "recolha de móveis usados",
      "despejo de móveis",
      "retirar móveis velhos",
      "recolha de sofás",
      "remoção de móveis",
    ],
    readingTime: "8 min",
    publishDate: "2026-03-16",
    updatedDate: "2026-10-28",
    heroLabel: "Guia prático",
    intro:
      "A recolha de móveis é dos pedidos mais frequentes na CLYON. Seja por mudança, renovação, venda de casa, fim de arrendamento, herança ou despejo de recheios, o objetivo costuma ser sempre o mesmo: libertar espaço depressa, com segurança e sem complicar acessos, desmontagens ou transporte. Precisa de recolha de móveis em Lisboa ou na Margem Sul? Veja a [recolha de móveis](/recolha-de-moveis) ou [simule um orçamento](/simulador). Para esvaziar uma casa ou apartamento completo, veja o [esvaziamento de casas](/esvaziamento-de-casas).",
    sections: [
      {
        title: "Quando faz sentido pedir recolha de móveis",
        paragraphs: [
          "Este serviço faz sentido quando existem peças grandes, pesadas ou em quantidade suficiente para tornar inviável a remoção por meios próprios. Sofás, camas, roupeiros, cómodas, mesas, eletrodomésticos e recheios mistos são os casos mais comuns.",
          "Também é muito frequente em apartamentos sem elevador, mudanças parciais, imóveis para arrendamento, escritórios em renovação e casas que precisam de ser libertadas antes de obras ou entrega de chave.",
        ],
        bullets: [
          "Sofás, colchões, camas e estrados",
          "Roupeiros, aparadores, cómodas e mesas",
          "Eletrodomésticos e recheios antigos",
          "Móveis desmontados ou por desmontar",
        ],
      },
      {
        title: "O que influencia o preço da recolha de móveis",
        paragraphs: [
          "O valor final depende do volume, distância, acessibilidade, número de andares, existência de elevador, necessidade de mais pessoas e tempo de desmontagem. Dois pedidos com o mesmo número de peças podem ter preços muito diferentes se um estiver num rés-do-chão e o outro num terceiro andar sem elevador.",
          "Quanto mais claro for o pedido inicial, mais rápido o orçamento e menor a margem para imprevistos no local. É por isso que uma boa descrição faz diferença: as propostas vêm mais certas.",
        ],
      },
      {
        title: "Como acelerar o pedido e evitar atrasos",
        paragraphs: [
          "O melhor ponto de partida é enviar morada, lista básica de peças, fotos quando possível, tipo de acesso ao imóvel e urgência do serviço. Se existir desmontagem prévia ou rua de acesso difícil, isso também deve ser referido.",
          `Na CLYON, o simulador dá uma primeira referência de valor e envia o pedido a profissionais da zona, que respondem com propostas ${PROPOSTAS_EM_ATE}. A data e a hora combinam-se com o profissional que escolher.`,
        ],
      },
      {
        title: "Quando doar e quando despejar",
        paragraphs: [
          "Nem todo o móvel precisa de ir para despejo. Peças em bom estado podem seguir para doação, reaproveitamento ou venda. Peças partidas, húmidas, sem ferragens ou sem viabilidade de uso tendem a justificar despejo direto.",
          "Antes de pagar uma recolha, vale a pena perguntar: doar, vender, reaproveitar ou despejar? Para peças em bom estado, veja onde [doar móveis usados em Lisboa](/recolha-gratuita-de-moveis-usados).",
        ],
      },
      {
        title: "Quando a recolha gratuita não resolve",
        paragraphs: [
          "A pesquisa por recolha gratuita de móveis usados é muito comum, mas nem sempre a via gratuita resolve o problema. A recolha municipal tem limitações: horários restritos, agendamento demorado, volume máximo e nenhum apoio para desmontagem ou retirada do interior do imóvel.",
          `Se o objetivo é libertar o espaço rapidamente, com carregamento porta a porta, desmontagem e retirada completa, a recolha paga é a opção mais eficaz. Pela CLYON, recebe propostas ${PROPOSTAS_EM_ATE} de profissionais da zona, que carregam dentro de casa e levam os móveis para destino licenciado.`,
          "A diferença principal: na recolha municipal, é muitas vezes quem pede que leva os móveis até à porta ou ao local combinado, e espera pela data marcada. Na recolha paga, o profissional entra no imóvel, desmonta se o pedir e resolve tudo num só pedido.",
        ],
        bullets: [
          "Recolha municipal: gratuita, mas limitada em volume, horários e sem desmontagem",
          "Doação: ideal para peças em bom estado, mas exige tempo e disponibilidade",
          "Recolha privada (CLYON): paga, mas com rapidez, desmontagem e carregamento completo",
        ],
      },
    ],
    faq: [
      {
        question: "A CLYON recolhe apenas uma peça, como um sofá?",
        answer:
          "Sim. A recolha pode ser para uma única peça ou para vários móveis, dependendo da disponibilidade, da localização e das condições de acesso.",
      },
      {
        question: "É possível recolher móveis no mesmo dia?",
        answer:
          NO_MESMO_DIA,
      },
      {
        question: "Tenho de desmontar os móveis antes?",
        answer:
          `Não. ${DESMONTAGEM_A_PEDIDO}`,
      },
    ],
  },
  {
    slug: "doacao-de-moveis-ou-despejo",
    title: "Doação de móveis ou despejo: como decidir o melhor destino para cada peça",
    metaTitle: "Doação de Móveis ou Despejo: Como Decidir",
    description:
      "Artigo completo sobre doação de móveis usados, reaproveitamento, reciclagem, venda e despejo responsável de peças sem utilidade.",
    category: "Doações",
    keywords: [
      "doação de móveis",
      "onde doar móveis usados",
      "despejo de móveis",
      "reutilização de móveis",
      "móveis para doação",
      "dar móveis usados",
    ],
    readingTime: "9 min",
    publishDate: "2026-03-16",
    heroLabel: "Decisão útil",
    intro:
      "Nem todos os móveis devem seguir para despejo. Em muitos casos, ainda podem ser doados, reaproveitados, vendidos ou encaminhados de forma mais responsável. A diferença está no estado da peça, na urgência do serviço, na logística disponível e no tempo que o cliente tem para resolver tudo.",
    sections: [
      {
        title: "Quando vale a pena doar",
        paragraphs: [
          "Peças estruturais em bom estado, sem danos graves, com portas, gavetas e estofos utilizáveis, podem ainda ter valor social ou funcional. Nestes casos, a doação é uma alternativa forte e mais sustentável.",
          "Isto acontece muito em mudanças, trocas de mobília, venda de casa e esvaziamentos parciais em que o objetivo é reduzir desperdício sem atrasar a libertação do espaço.",
        ],
      },
      {
        title: "Quando o despejo é a solução mais realista",
        paragraphs: [
          "Se o mobiliário está partido, com humidade, infestação, ferragens danificadas, mau cheiro, falta de estabilidade ou desgaste avançado, o mais prático costuma ser o despejo.",
          "Em operações urgentes, o cliente geralmente prefere uma solução direta: retirar tudo numa só visita, sem depender de vários contactos, triagens demoradas ou recolhas selectivas incertas.",
        ],
        bullets: [
          "Peças com danos estruturais",
          "Móveis com bolor, humidade ou sujidade pesada",
          "Itens sem valor de reutilização",
          "Objetos que atrasam a libertação do espaço",
        ],
      },
      {
        title: "Doação, venda e plataformas digitais",
        paragraphs: [
          "Em pesquisas relacionadas com móveis usados, muitas pessoas procuram alternativas antes de avançar para a recolha. Plataformas como a OLX podem ser úteis para tentar venda local ou oferta direta a particulares. Isso faz sentido quando a peça ainda tem valor e existe tempo para gerir mensagens, marcações e levantamento.",
          `Quando o problema principal é tirar volume depressa, com transporte, faz mais sentido uma recolha: pela CLYON, profissionais da zona respondem com propostas ${PROPOSTAS_EM_ATE}.`,
        ],
      },
      {
        title: "Doação com entidades e reaproveitamento",
        paragraphs: [
          "Há instituições que recebem móveis em condições de uso, e algumas vão buscá-los a casa. A REMAR, por exemplo, diz no site que recolhe móveis e eletrodomésticos em condições de reutilização, depois de avaliar cada pedido pelo tipo de bens, estado e localização.",
          "As que confirmámos nos sites oficiais, com as condições de cada uma, estão na página [doar móveis usados em Lisboa](/recolha-gratuita-de-moveis-usados).",
        ],
      },
    ],
    faq: [
      {
        question: "A CLYON faz recolha para doação?",
        answer:
          "Não. A CLYON liga-o a profissionais que retiram móveis — é um serviço pago, e o que sai vai para destino licenciado. Para doar, fale com as instituições que recebem móveis.",
      },
      {
        question: "Posso misturar doação e despejo no mesmo serviço?",
        answer:
          "Sim: doe primeiro o que ainda serve e peça a recolha do resto — o pedido fica mais pequeno, e a proposta também.",
      },
      {
        question: "Vale a pena tentar OLX antes da recolha?",
        answer:
          "Vale quando o móvel está bom, tem procura e existe tempo para tratar do anúncio. Quando a prioridade é libertar o espaço depressa, a recolha profissional costuma ser mais eficaz.",
      },
    ],
  },
  {
    slug: "onde-doar-vender-ou-anunciar-moveis-usados",
    title: "Onde doar, vender ou anunciar móveis usados antes de pedir recolha",
    metaTitle: "Onde Doar, Vender ou Anunciar Móveis Usados",
    description:
      "Onde doar, vender ou dar móveis usados: OLX, Marketplace, instituições como a REMAR — e quando compensa pedir a recolha.",
    category: "Alternativas",
    keywords: [
      "onde doar móveis usados",
      "vender móveis usados",
      "olx móveis usados",
      "dar móveis usados",
      "remar móveis",
    ],
    readingTime: "9 min",
    publishDate: "2026-03-16",
    updatedDate: "2026-10-28",
    heroLabel: "Alternativas",
    intro:
      "Antes de pedir recolha, vale a pena ver se os móveis ainda servem a alguém: doação, venda, entrega a instituições ou anúncio com procura local. Este guia ajuda a decidir quando compensa cada via e quando a recolha é o caminho mais prático.",
    sections: [
      {
        title: "Quando vender em vez de despejar",
        paragraphs: [
          "Se a peça está moderna, funcional, sem danos e com procura no mercado local, anunciar pode ser a melhor primeira tentativa. A OLX continua a ser uma referência natural neste tipo de pesquisa porque liga vendedores e compradores de forma direta.",
          "O problema é que vender demora. Exige criar anúncio, negociar, responder a mensagens e coordenar levantamento. Se a prioridade é libertar espaço depressa, numa data certa, a recolha profissional volta a ganhar vantagem.",
        ],
      },
      {
        title: "Quando a doação é mais útil",
        paragraphs: [
          "Se o objetivo não é recuperar dinheiro, mas dar um destino útil ao mobiliário, a doação pode ser a melhor saída. Há instituições que recebem móveis em bom estado — a REMAR, por exemplo, avalia cada pedido de recolha. A lista confirmada, com as condições de cada uma, está em [doar móveis usados em Lisboa](/recolha-gratuita-de-moveis-usados).",
          "O que não for aproveitado pode seguir para a recolha de monos da câmara ou para uma recolha paga.",
        ],
      },
      {
        title: "Retomas na compra de móveis novos",
        paragraphs: [
          "Quem está a renovar a casa pergunta muitas vezes à loja onde compra os móveis novos se retoma os antigos. Confirme diretamente com a loja o que aceita e em que condições.",
          "Mesmo com retoma, alguém tem de tirar as peças velhas de casa — e é aí que uma recolha pode fazer falta.",
        ],
      },
      {
        title: "Dar de graça, online",
        paragraphs: [
          "No OLX, os termos de utilização preveem que um artigo seja anunciado como disponibilizado gratuitamente. No Marketplace do Facebook, marca-se um artigo como gratuito pondo 0 no preço. Em ambos, o levantamento combina-se com quem fica com a peça.",
          `Se ninguém aceita os móveis, ou não pode esperar, a CLYON liga-o a profissionais da sua zona que os recolhem — é um serviço pago, e recebe propostas ${PROPOSTAS_EM_ATE}.`,
        ],
      },
    ],
    faq: [
      {
        question: "Vale a pena anunciar móveis usados antes da recolha?",
        answer:
          "Sim, se a peça estiver em bom estado e houver tempo para gerir o anúncio. Quando há urgência, a recolha direta costuma ser a solução mais prática.",
      },
      {
        question: "Posso doar umas peças e pedir recolha do resto?",
        answer:
          "Sim. Essa combinação é muito comum e ajuda a reduzir desperdício sem atrasar a libertação do espaço.",
      },
    ],
  },
  {
    slug: "recolha-de-entulho-legal-e-organizada",
    title: "Recolha de entulho: como fazer de forma legal, rápida e organizada",
    metaTitle: "Recolha de Entulho Legal, Rápida e Organizada",
    description:
      "Guia completo sobre recolha de entulho, resíduos de obra, sacos, restos de remodelação e boas práticas para remoção segura.",
    category: "Entulho",
    keywords: [
      "recolha de entulho",
      "remoção de entulho",
      "entulho de obra",
      "sacos de entulho",
      "recolha de resíduos de obra",
    ],
    readingTime: "8 min",
    publishDate: "2026-03-16",
    heroLabel: "Entulho",
    intro:
      "Depois de uma obra, remodelação ou limpeza pesada, o entulho transforma-se num problema de espaço, segurança e logística. A recolha profissional evita acumulação, atrasos de obra e risco desnecessário para quem tenta resolver tudo sem meios adequados.",
    sections: [
      {
        title: "Que tipos de entulho aparecem com mais frequência",
        paragraphs: [
          "Os pedidos mais comuns incluem restos de azulejo, cerâmica, madeira, gesso, loiças partidas, sacos de obra, pedra, metal e materiais mistos de demolição ligeira.",
          "Quando o material está no chão, o esforço operacional tende a ser maior do que quando já está ensacado e pronto para retirada.",
        ],
      },
      {
        title: "Ensacado ou no chão: porque faz diferença",
        paragraphs: [
          "Entulho no chão exige mais tempo de carga, mais organização e, muitas vezes, mais mão de obra. Quando o material já está ensacado, a operação fica mais linear e previsível.",
          "Essa distinção altera o esforço real do profissional e deve aparecer logo no pedido, para a proposta ficar certa.",
        ],
      },
      {
        title: "Entulho, limpeza e libertação de espaço",
        paragraphs: [
          "Quem pede recolha de entulho quer, quase sempre, continuar a obra, entregar o apartamento ou abrir uma loja. A recolha tira o entulho; a limpeza final, se for precisa, é outro trabalho — combina-se à parte, com uma empresa de limpezas.",
        ],
      },
    ],
    faq: [
      {
        question: "Recolhe-se entulho ensacado e também no chão?",
        answer:
          "Sim. Os dois cenários são possíveis, mas devem ser indicados no pedido porque alteram o tempo e o esforço da operação.",
      },
      {
        question: "O acesso ao prédio altera o valor?",
        answer:
          "Sim. Andares, elevador, distância até ao ponto de carga e acesso difícil têm impacto direto no esforço e no custo.",
      },
    ],
  },
  {
    slug: "recolha-de-monos-o-que-inclui",
    title: "Recolha de monos: o que inclui, quando pedir e como acelerar o serviço",
    metaTitle: "Recolha de Monos: o Que Inclui e Como Pedir",
    description:
      "Artigo completo sobre recolha de monos, volumosos, objetos sem uso, despejo rápido e libertação de espaço em casas, lojas e arrecadações.",
    category: "Monos",
    keywords: [
      "recolha de monos",
      "volumosos",
      "retirar monos",
      "despejo de monos",
      "recolha de tralha",
    ],
    readingTime: "7 min",
    publishDate: "2026-03-16",
    heroLabel: "Volumosos",
    intro:
      "Monos é um termo usado para definir objetos grandes, velhos ou sem utilidade que ocupam espaço e são difíceis de remover. A diferença para um pedido simples está no volume, na mistura de materiais e na falta de organização prévia do que vai sair.",
    sections: [
      {
        title: "Exemplos de monos mais comuns",
        paragraphs: [
          "Sofás velhos, colchões, madeira solta, eletrodomésticos fora de uso, cadeiras partidas, restos de arrumos, material acumulado em arrecadações e objetos sem valor de reaproveitamento entram frequentemente nesta categoria.",
        ],
        bullets: [
          "Sofás velhos e colchões",
          "Eletrodomésticos fora de uso",
          "Madeira solta e restos de arrumos",
          "Volumosos mistos em garagens e caves",
        ],
      },
      {
        title: "Como acelerar a recolha de monos",
        paragraphs: [
          "O mais eficaz é concentrar os itens, confirmar acesso e enviar uma lista ou fotos antes do agendamento. Isso reduz imprevistos, deixa as propostas mais certas e facilita o planeamento do profissional.",
          "Quando o cliente consegue separar o que vai sair do que vai ficar, o serviço torna-se mais rápido e limpo.",
        ],
      },
      {
        title: "Monos, lixo e limpeza do espaço",
        paragraphs: [
          "Em muitos pedidos, a recolha de monos aparece associada a acumulação, desorganização e lixo leve. O objetivo não é só levar objetos: é deixar a divisão utilizável de novo.",
        ],
      },
    ],
    faq: [
      {
        question: "Monos e móveis velhos são a mesma coisa?",
        answer:
          "Nem sempre. Alguns pedidos são só mobiliário. Outros incluem mistura de peças, tralha acumulada e volumosos diversos, o que entra mais na lógica de monos.",
      },
      {
        question: "Há recolha de monos em arrecadações e caves?",
        answer:
          "Sim, desde que as condições de acesso, volume e segurança sejam validadas no pedido.",
      },
    ],
  },
  {
    slug: "limpeza-pos-obra-e-retirada-de-residuos",
    title: "Limpeza pós-obra e retirada de resíduos: como deixar o espaço pronto",
    metaTitle: "Limpeza Pós-Obra e Retirada de Resíduos",
    description:
      "Depois da obra: como retirar o entulho e os resíduos e quando contratar a limpeza final, para vender, arrendar ou entregar o espaço.",
    category: "Pós-obra",
    keywords: [
      "limpeza pós-obra",
      "retirada de resíduos de obra",
      "entulho pós-obra",
      "limpeza final obra",
      "limpeza depois da remodelação",
    ],
    readingTime: "7 min",
    publishDate: "2026-03-16",
    heroLabel: "Acabamento",
    intro:
      "A limpeza pós-obra é a fase que transforma um espaço intervencionado num espaço pronto a usar. O problema é que essa fase junta pó, restos de material, embalagens, sobras de montagem e pontos de difícil acesso que atrasam a entrega do imóvel.",
    sections: [
      {
        title: "O que costuma ficar por fazer depois da obra",
        paragraphs: [
          "Mesmo quando a obra terminou, ainda é comum existirem restos de corte, embalagens, pó fino, resíduos mistos e áreas que precisam de limpeza final para o imóvel ficar apresentável.",
        ],
      },
      {
        title: "Primeiro os resíduos, depois a limpeza",
        paragraphs: [
          "A ordem certa é tirar primeiro o entulho e os resíduos e só depois fazer a limpeza de acabamento. Na CLYON pode pedir a primeira parte — a [recolha de entulho](/recolha-de-entulho), em sacos de obra; a limpeza não é um serviço da plataforma e combina-se à parte.",
        ],
      },
      {
        title: "A importância da limpeza para venda, aluguer e entrega",
        paragraphs: [
          "Por trás da limpeza pós-obra há quase sempre um prazo: vender, arrendar, reabrir um espaço ou concluir uma entrega. Não se trata apenas de limpar; trata-se de preparar o espaço para a próxima fase.",
        ],
      },
    ],
    faq: [
      {
        question: "A CLYON faz limpeza pós-obra?",
        answer:
          "Não. A limpeza não é um serviço da CLYON. Pela plataforma pode pedir a recolha do entulho e dos resíduos de obra, em sacos; a limpeza final contrata-se à parte, a uma empresa de limpezas.",
      },
    ],
  },
  {
    slug: "esvaziamento-de-casas-com-recheio",
    title: "Esvaziamento de casas com recheio: heranças, mudanças e imóveis para venda",
    metaTitle: "Esvaziamento de Casas com Recheio: Heranças",
    description:
      "Guia completo sobre esvaziamento de casas, recheios completos, heranças, imóveis para venda e retirada de móveis, monos e objetos acumulados.",
    category: "Esvaziamentos",
    keywords: [
      "esvaziamento de casas",
      "retirar recheio de casa",
      "casa com móveis antigos",
      "desocupar casa herdada",
      "esvaziar apartamento",
    ],
    readingTime: "8 min",
    publishDate: "2026-03-16",
    heroLabel: "Recheios",
    intro:
      "O esvaziamento de casas junta várias necessidades ao mesmo tempo: avaliar o que fica, o que sai, o que pode ser doado e o que precisa mesmo de despejo. Isto acontece muito em heranças, mudanças longas, imóveis para venda e casas fechadas há anos.",
    sections: [
      {
        title: "Situações mais frequentes",
        paragraphs: [
          "Casas herdadas, apartamentos devolvidos ao senhorio, imóveis que precisam de staging, divisões usadas como arrecadação e mudanças em que parte do recheio deixa de fazer sentido.",
        ],
      },
      {
        title: "Como organizar o esvaziamento por fases",
        paragraphs: [
          "Separar doação, retenção, lixo e despejo antes do dia da recolha reduz erros e acelera a operação. Quando isso não é possível, a triagem no local deve ser pensada com critério para não atrasar a saída.",
          "Para o que ainda serve, veja antes onde [doar móveis usados em Lisboa](/recolha-gratuita-de-moveis-usados).",
        ],
      },
      {
        title: "Quando o esvaziamento tem valor comercial",
        paragraphs: [
          "Há muitos casos em que o imóvel precisa de ser preparado para venda, aluguer ou remodelação. Nesses cenários, o esvaziamento não é só remoção: é uma etapa crítica para libertar o activo e avançar com a próxima decisão.",
        ],
      },
    ],
    faq: [
      {
        question: "Há esvaziamentos completos?",
        answer:
          "Sim, desde pedidos parciais até recheios completos, conforme o volume, o tipo de objetos e as condições de acesso.",
      },
    ],
  },
  {
    slug: "amarsul-ecocentros-e-destino-de-residuos",
    title: "Amarsul, ecocentros e destino de resíduos: quando usar solução pública e quando pedir recolha",
    metaTitle: "Amarsul e Ecocentros: Onde Levar Monos e Resíduos",
    description:
      "Ecocentros e recolha de monos na Margem Sul: quando levar monos, entulho leve e recicláveis por conta própria e quando compensa pedir a recolha.",
    category: "Resíduos",
    keywords: [
      "amarsul monos",
      "amarsul resíduos",
      "ecocentro móveis",
      "onde levar entulho",
      "recolha de lixo volumoso",
    ],
    readingTime: "8 min",
    publishDate: "2026-03-16",
    heroLabel: "Resíduos",
    intro:
      "Nem todo o volume precisa de recolha paga. Na Margem Sul há ecocentros para onde se podem levar resíduos que não cabem no contentor, e as câmaras e juntas recolhem monos com marcação. Este guia ajuda a perceber quando compensa cada via.",
    sections: [
      {
        title: "Quando faz sentido procurar ecocentro ou solução pública",
        paragraphs: [
          "Se o volume é pequeno, se existe viatura própria, tempo e capacidade de carga, pode fazer sentido procurar um ecocentro ou uma solução pública para encaminhar materiais.",
          "Isto é especialmente comum em pequenos despejos, restos leves de bricolage e objetos que o utilizador consegue transportar sozinho.",
        ],
      },
      {
        title: "Quando a recolha privada compensa mais",
        paragraphs: [
          "Quando o volume é grande, o acesso é difícil, existem vários pisos, faltam meios de transporte ou o espaço precisa de ficar livre rapidamente, a recolha privada passa a ser muito mais eficiente.",
          `É aí que a CLYON pode ajudar: descreve o pedido e recebe propostas de profissionais da zona ${PROPOSTAS_EM_ATE}.`,
        ],
      },
      {
        title: "Separar antes de decidir",
        paragraphs: [
          "Separar ajuda em qualquer caminho: recicláveis no ecoponto, volumosos no ecocentro ou na recolha de monos da câmara, e o resto na recolha paga. Em Almada, por exemplo, sofás, colchões e móveis podem ser entregues no Ecocentro de Almada.",
        ],
      },
    ],
    faq: [
      {
        question: "Vale a pena tentar solução pública antes da recolha privada?",
        answer:
          "Depende do volume, da urgência, do acesso e dos meios disponíveis. Para pequenas quantidades pode fazer sentido. Para operações maiores, a recolha privada tende a ser mais prática.",
      },
    ],
  },
  {
    slug: "quanto-custa-uma-mudanca-em-lisboa",
    title: "Quanto custa uma mudança em Lisboa em 2026? Guia completo de preços",
    metaTitle: "Quanto Custa uma Mudança em Lisboa em 2026?",
    description:
      `Quanto custa uma mudança em Lisboa: ${PRECO_POR_HORA} €/h + IVA pela equipa de ${PESSOAS_NA_EQUIPA}, mínimo ${MINIMO_DE_HORAS} horas — T1 cerca de ${HORAS_POR_TIPOLOGIA.T1 * PRECO_POR_HORA} €, T2 ${HORAS_POR_TIPOLOGIA.T2 * PRECO_POR_HORA} €, T3 ${HORAS_POR_TIPOLOGIA.T3 * PRECO_POR_HORA} €, sem IVA.`,
    category: "Mudanças",
    keywords: [
      "quanto custa mudança lisboa",
      "preço mudança lisboa",
      "mudança t1 preço",
      "mudança t2 preço",
      "mudança t3 preço",
      "empresa mudanças lisboa preços",
    ],
    readingTime: "8 min",
    publishDate: "2026-06-01",
    updatedDate: "2026-10-14",
    heroLabel: "Mudanças",
    intro:
      "O preço de uma mudança em Lisboa depende de vários fatores: o tamanho do apartamento, a distância entre moradas, o andar (com ou sem elevador), a necessidade de desmontagem e montagem de móveis e se quer incluir embalagem. Este guia ajuda a perceber valores reais e a evitar surpresas.",
    sections: [
      {
        title: "Preços por tipologia: a tabela à hora",
        paragraphs: [
          `Na CLYON a mudança paga-se à hora, pela mesma tabela em toda a zona: ${PRECO_DA_MUDANCA_POR_EXTENSO}`,
          "Ao comparar com outros preços à hora, veja se são por pessoa ou sem carrinha: aqui o valor é da equipa toda — três pessoas e a viatura.",
          "Antes de alguém ver a casa, contam-se estas horas pela tipologia, sem andares a pé nem distâncias longas. A proposta traz as horas previstas, e no fim pagam-se as horas feitas:",
        ],
        bullets: HORAS_E_PRECO_POR_TIPOLOGIA,
      },
      {
        title: "O que faz o preço subir ou descer",
        paragraphs: [
          EXTRAS_DA_MUDANCA,
          "Móveis grandes como pianos, cofres ou móveis de canto podem exigir técnicas especiais de transporte e mais tempo — diga-o no pedido para vir na proposta.",
          "No fim do mês há mais procura: peça com antecedência. Ao domingo depende de haver profissional disponível, e qualquer acréscimo vem na proposta.",
        ],
      },
      {
        title: "Como pedir orçamento",
        paragraphs: [
          "O ideal é enviar fotos de todos os móveis e caixas que vão na mudança, indicar os dois endereços com andar e tipo de acesso (elevador, escadas, rua estreita) e definir a data pretendida.",
          "Com esta informação, os profissionais conseguem propor um valor mais certo e evitar ajustes no dia da mudança. Veja as [mudanças em Lisboa](/mudancas/lisboa) ou as das [outras cidades](/mudancas); se for pouca coisa, uma [pequena mudança](/pequenas-mudancas).",
        ],
      },
    ],
    faq: [
      {
        question: "O preço pode mudar no dia da mudança?",
        answer:
          "Paga-se à hora: a proposta diz as horas previstas, e no fim contam-se as horas feitas. Se o volume ou os acessos forem diferentes do que foi descrito, a mudança demora mais — por isso fotos e uma descrição certa evitam surpresas.",
      },
      {
        question: "Vale a pena fazer a mudança sozinho?",
        answer:
          "Para volumes pequenos (algumas caixas e um ou dois móveis), pode fazer sentido. Para apartamentos inteiros, o tempo, o esforço e o risco de danos costumam justificar contratar uma equipa.",
      },
    ],
  },
  {
    slug: "como-organizar-uma-mudanca-de-casa",
    title: "Como organizar uma mudança de casa sem stress: checklist completa",
    metaTitle: "Como Organizar uma Mudança de Casa: Checklist",
    description:
      "Guia prático para organizar uma mudança de apartamento: o que fazer antes, durante e depois. Checklist, dicas e erros a evitar.",
    category: "Mudanças",
    keywords: [
      "como organizar mudança",
      "checklist mudança casa",
      "preparar mudança apartamento",
      "dicas mudança de casa",
      "o que fazer antes da mudança",
    ],
    readingTime: "7 min",
    publishDate: "2026-06-01",
    updatedDate: "2026-10-28",
    heroLabel: "Mudanças",
    intro:
      "Uma mudança bem organizada evita stress, perdas de tempo e problemas no dia. Com planeamento antecipado, triagem de objetos e comunicação clara com a equipa de mudanças, o processo torna-se muito mais simples. Este guia mostra o que fazer antes, durante e depois da mudança.",
    sections: [
      {
        title: "4 semanas antes: preparar e triar",
        paragraphs: [
          "Comece por percorrer todas as divisões e separar o que vai manter, doar, vender ou descartar. Quanto menos volume transportar, mais barata e rápida será a mudança.",
          "Peça orçamentos a empresas de mudanças, compare preços e confirme disponibilidade para a data pretendida. Reserve com antecedência, especialmente se for fim de mês ou fim de semana.",
        ],
        bullets: [
          "Fazer inventário de todos os móveis e objetos",
          "Separar o que não vai para a casa nova",
          "Pedir 2-3 orçamentos de mudanças",
          "Reservar a data e a equipa",
        ],
      },
      {
        title: "1 semana antes: embalar e preparar",
        paragraphs: [
          "Comece a embalar divisão a divisão, etiquetando as caixas com o conteúdo e o destino (ex.: 'Cozinha - Loiça'). Proteja objetos frágeis com papel ou plástico bolha.",
          "Confirme os detalhes com a empresa de mudanças: horário, moradas exatas, andar, elevador e contacto para o dia.",
        ],
        bullets: [
          "Embalar divisão a divisão",
          "Etiquetar todas as caixas",
          "Confirmar detalhes com a empresa",
          "Preparar caixa de 'essenciais' para o primeiro dia",
        ],
      },
      {
        title: "No dia: coordenar e supervisionar",
        paragraphs: [
          "Esteja presente para indicar à equipa quais as caixas e móveis prioritários e onde devem ficar na nova casa. Verifique se todos os objetos foram carregados antes de sair.",
          "Na chegada, confirme se não há danos e indique onde colocar cada volume. Móveis grandes devem ser posicionados primeiro.",
          "Com a lista feita, peça as propostas: veja as [mudanças por cidade](/mudancas), ou as [mudanças de escritório](/mudancas-de-escritorio) se for uma empresa.",
        ],
      },
    ],
    faq: [
      {
        question: "Devo embalar tudo ou a empresa faz isso?",
        answer:
          "Depende do serviço contratado. Pode embalar sozinho para poupar, ou pedir embalagem completa à empresa por um valor extra.",
      },
      {
        question: "E se tiver móveis para descartar?",
        answer:
          "Pode pedir recolha separada ou combinar com a empresa de mudanças para retirar na mesma data o que não vai para a casa nova.",
      },
    ],
  },
  {
    slug: "pequenas-mudancas-em-lisboa-quando-compensa",
    updatedDate: "2026-10-14",
    title: "Pequenas mudanças em Lisboa: quando compensa contratar uma equipa",
    metaTitle: "Pequenas Mudanças em Lisboa: Quando Compensa",
    description:
      "Guia sobre pequenas mudanças em Lisboa: transporte de 1-3 móveis, quando vale a pena contratar, preços e alternativas.",
    category: "Mudanças",
    keywords: [
      "pequenas mudanças lisboa",
      "transporte de móveis lisboa",
      "mudança de sofá",
      "mudança de cama",
      "transporte de armário",
      "pequena mudança preço",
    ],
    readingTime: "6 min",
    publishDate: "2026-06-01",
    heroLabel: "Mudanças",
    intro:
      "Nem toda a mudança envolve um apartamento inteiro. Muitas vezes, basta transportar um sofá novo, levar uma cama para outra casa ou mover um armário pesado. Para estes casos, contratar uma equipa pode poupar tempo, esforço e evitar danos. Veja quando compensa.",
    sections: [
      {
        title: "O que é uma pequena mudança",
        paragraphs: [
          "Consideramos pequena mudança o transporte de 1 a 3 peças grandes: sofá, cama, armário, secretária, frigorífico ou máquina de lavar. É diferente de uma mudança completa porque não envolve dezenas de caixas e mobiliário de todas as divisões.",
          `Pagam-se pela mesma tabela das mudanças: ${PRECO_POR_HORA} € + IVA por hora pela equipa de ${PESSOAS_NA_EQUIPA}, com o mínimo de ${MINIMO_DE_HORAS} horas — ${MINIMO_DA_MUDANCA} € + IVA. Uma pequena mudança conta-se, à partida, por esse mínimo, e por isso fica bem abaixo de uma mudança completa. Andares a pé e distâncias acima de ${RAIO_INCLUIDO_KM} km acrescem, e vêm na proposta.`,
        ],
      },
      {
        title: "Quando vale a pena contratar",
        paragraphs: [
          "Se o móvel é pesado, volumoso ou difícil de manobrar (escadas estreitas, sem elevador, portas pequenas), contratar uma equipa evita lesões e danos. Profissionais têm experiência em desmontar, proteger e transportar peças grandes.",
          "Se não tem carro ou carrinha adequada, o aluguer de veículo mais o tempo e esforço muitas vezes sai mais caro e trabalhoso do que contratar quem já tem tudo preparado.",
        ],
      },
      {
        title: "Como pedir orçamento",
        paragraphs: [
          "Envie fotos do móvel, indique as duas moradas com andar e tipo de acesso. Quanto mais detalhe, mais certo será o valor. Na CLYON, recebe propostas de profissionais da zona em menos de 6 horas — veja as [pequenas mudanças](/pequenas-mudancas) e o [transporte de móveis](/transporte-de-moveis).",
        ],
      },
    ],
    faq: [
      {
        question: "Posso transportar só um sofá?",
        answer:
          `Sim. É um dos pedidos mais comuns. Paga-se pela tabela à hora, com o mínimo de ${MINIMO_DE_HORAS} horas (${MINIMO_DA_MUDANCA} € + IVA); o tamanho do sofá, a distância e o acesso nos dois endereços dizem se esse mínimo chega.`,
      },
      {
        question: "E se o móvel não couber no elevador?",
        answer:
          "Sobe-se pelas escadas. É uma situação muito comum, mas pode aumentar o preço — diga-o no pedido para vir na proposta.",
      },
    ],
  },
  {
    slug: "quanto-custa-retirar-um-sofa-em-lisboa",
    title: "Quanto custa retirar um sofá em Lisboa? Preços, Câmara e alternativas",
    metaTitle: "Quanto Custa Retirar um Sofá em Lisboa?",
    description:
      `Retirar um sofá em Lisboa custa, como referência, ${SOFA.minimo} a ${SOFA.maximo} € + IVA. O que faz variar o preço, a recolha gratuita da Câmara e quando doar.`,
    category: "Recolha de móveis",
    keywords: [
      "quanto custa retirar sofá lisboa",
      "recolha de sofá lisboa",
      "retirar sofá velho",
      "levar sofá velho lisboa",
      "preço recolha de sofá",
    ],
    readingTime: "5 min",
    publishDate: "2026-10-14",
    updatedDate: "2026-10-28",
    heroLabel: "Recolha de móveis",
    intro:
      "O sofá é a peça que mais gente quer tirar de casa, e a que mais dúvidas levanta: cabe no elevador? Tem de ser desmontado? A Câmara leva-o de graça? Este guia junta os valores de referência da CLYON para Lisboa, o que os faz variar e as alternativas sem custo.",
    sections: [
      {
        title: "Quanto custa, em números",
        paragraphs: [
          `Como referência, retirar um sofá de 2 a 3 lugares em Lisboa fica entre ${SOFA.minimo} e ${SOFA.maximo} €, ${SEM_IVA_NA_FRASE}. Uma recolha com várias peças fica em ${PRECOS.recolha_moveis.etiqueta}, também sem IVA. O preço certo vem nas propostas dos profissionais da zona, fechado antes de começarem.`,
          "Para comparar, as outras peças que costumam sair com o sofá (valores sem IVA):",
        ],
        bullets: PECAS_DE_REFERENCIA.map(pecaEmLinha),
      },
      {
        title: "O que faz o preço subir ou descer",
        paragraphs: [
          "O andar e o elevador pesam mais do que o próprio sofá. Um sofá de três lugares raramente cabe num elevador antigo e desce pelas escadas — e num andar alto sem elevador, a descida é o que mais tempo leva.",
          "A desmontagem também conta: sofás-cama, chaise longues e sofás modulares saem muitas vezes em partes. Diga no pedido se o sofá se desmonta, ou mande uma fotografia de lado.",
          `E o sítio: ${ESTACIONAMENTO_EM_LISBOA}`,
        ],
      },
      {
        title: "A recolha gratuita da Câmara de Lisboa",
        paragraphs: [
          CAMARA_DE_LISBOA,
          "A recolha paga faz sentido quando precisa de uma data certa, quando o sofá tem de sair de dentro de casa e não do passeio, ou quando há escadas a descer.",
        ],
      },
      {
        title: "Se o sofá ainda está bom",
        paragraphs: [
          "Um sofá em bom estado pode ter outra vida: há instituições e lojas solidárias que recebem móveis, e plataformas onde se vende ou se dá. Explicamos onde em [recolha gratuita de móveis usados](/recolha-gratuita-de-moveis-usados) e em [onde doar, vender ou anunciar móveis usados](/blog/onde-doar-vender-ou-anunciar-moveis-usados).",
        ],
      },
      {
        title: "Como pedir",
        paragraphs: [
          `Mande duas ou três fotografias do sofá, de frente e de lado, diga o andar, se há elevador e se o sofá se desmonta, e a data que lhe serve. Com isso, os profissionais da zona respondem com propostas certas ${PROPOSTAS_EM_ATE}.`,
          "Veja a [recolha de sofás](/recolha-de-sofas) e a [recolha de móveis em Lisboa](/recolha-moveis-lisboa), ou peça já no [simulador](/simulador).",
        ],
      },
    ],
    faq: [
      {
        question: "A Câmara de Lisboa recolhe sofás de graça?",
        answer: `Sim: um sofá conta como mono. ${CAMARA_DE_LISBOA}`,
      },
      {
        question: "O preço inclui IVA?",
        answer:
          "Os valores de referência são sem IVA. Na proposta, o preço já vem com IVA incluído, e há fatura em todas as vendas.",
      },
      {
        question: "Dá para retirar o sofá no mesmo dia?",
        answer: NO_MESMO_DIA,
      },
    ],
  },
  {
    slug: "esvaziar-a-casa-de-um-familiar",
    title: "Esvaziar a casa de um familiar: por onde começar, quanto custa e o que fazer a cada coisa",
    metaTitle: "Esvaziar a Casa de um Familiar: Por Onde Começar",
    description:
      `Um guia para esvaziar a casa de um familiar: o que guardar, doar ou vender, quanto custa um esvaziamento (${PRECOS.esvaziamento_casa.etiqueta} + IVA) e como pedir.`,
    category: "Esvaziamento",
    keywords: [
      "esvaziar casa de familiar",
      "esvaziamento de casa herança",
      "esvaziar casa de pessoa falecida",
      "esvaziamento de recheio",
      "quanto custa esvaziar uma casa",
    ],
    readingTime: "6 min",
    publishDate: "2026-10-14",
    updatedDate: "2026-10-28",
    heroLabel: "Esvaziamento",
    intro:
      "Esvaziar a casa de um pai, de uma avó ou de um tio é das tarefas mais pesadas que há — pelo volume e pelo que cada objeto lembra. Não há uma ordem certa, mas há uma que poupa tempo e discussões. Este guia mostra-a, com os valores de referência da CLYON.",
    sections: [
      {
        title: "Antes de tirar seja o que for",
        paragraphs: [
          "Se a casa faz parte de uma herança por partilhar, combine com os outros herdeiros — e com quem trata da partilha — o que sai, antes de sair. Um móvel que um irmão queria e já foi não volta.",
          "Separe à parte os documentos e os papéis: do banco, das finanças, da casa, dos seguros e as fotografias. Costumam estar espalhados por gavetas e caixas, e são os primeiros a perder-se num esvaziamento feito à pressa.",
        ],
      },
      {
        title: "Separar em quatro",
        paragraphs: [
          "Divisão a divisão, cada coisa vai para um de quatro destinos. Etiquetas de cores, ou uma divisão para cada destino, evitam que se decida duas vezes a mesma coisa.",
        ],
        bullets: [
          "Guardar: o que a família quer, as recordações e os documentos.",
          "Vender: móveis e peças com valor — antiguidades, eletrodomésticos recentes, coleções.",
          "Doar: o que está bom e ninguém da família quer — roupa, loiça, móveis em bom estado.",
          "Retirar: o que já não serve a ninguém, para destino licenciado.",
        ],
      },
      {
        title: "Quanto custa esvaziar",
        paragraphs: [
          `Como referência, um esvaziamento de casa começa ${PRECOS.esvaziamento_casa.etiqueta}, e num apartamento fica em ${PRECOS.esvaziamento_apartamento.etiqueta}, conforme a tipologia — valores ${SEM_IVA_NA_FRASE}. A tabela por tipologia está em [esvaziamento de casas](/esvaziamento-de-casas).`,
          "O que mais faz variar é o volume do recheio, o andar e o elevador, e a distância. Separar antes o que é para guardar e doar baixa o volume — e o preço.",
        ],
      },
      {
        title: "O que ainda serve",
        paragraphs: [
          "Pode pedir que o que ainda serve vá para reaproveitamento ou doação: diga-o no pedido, e a proposta diz o que fica incluído. Se preferir tratar disso antes, explicamos onde em [onde doar, vender ou anunciar móveis usados](/blog/onde-doar-vender-ou-anunciar-moveis-usados).",
        ],
      },
      {
        title: "Como pedir",
        paragraphs: [
          `Mande fotografias de cada divisão, diga o andar, se há elevador e a data limite — a escritura, a entrega das chaves. Recebe as propostas dos profissionais da zona ${PROPOSTAS_EM_ATE}, e ${O_DIA_DO_TRABALHO}.`,
          "Veja o [esvaziamento de casas](/esvaziamento-de-casas), ou peça já no [simulador](/simulador).",
        ],
      },
    ],
    faq: [
      {
        question: "Os profissionais separam o que é para doar?",
        answer:
          "Pode pedir que o que ainda serve siga para reaproveitamento ou doação. Diga-o no pedido: a proposta diz o que fica incluído e para onde vai.",
      },
      {
        question: "O preço inclui IVA?",
        answer:
          "Os valores de referência são sem IVA. Na proposta, o preço já vem com IVA incluído, e há fatura em todas as vendas.",
      },
      {
        question: "Quanto tempo demora a ter uma resposta?",
        answer: PROMESSA_DO_PRAZO,
      },
    ],
  },
  {
    slug: "recolha-de-monos-camara-ou-profissional",
    title: "Recolha de monos: pela câmara ou por um profissional? Quando compensa cada um",
    metaTitle: "Recolha de Monos: Câmara ou Profissional?",
    description: `A maior parte das câmaras recolhe monos de graça, com regras. Quando compensa um profissional, e quanto custa: ${maisIva(PRECOS.recolha_monos.etiqueta)}.`,
    category: "Recolha de monos",
    keywords: [
      "recolha de monos câmara",
      "recolha de monos grátis",
      "como marcar recolha de monos",
      "recolha de monos preço",
      "monos câmara municipal",
    ],
    readingTime: "6 min",
    publishDate: "2026-10-15",
    heroLabel: "Recolha de monos",
    intro:
      "Na maior parte dos concelhos da área de Lisboa e de Setúbal, a câmara recolhe os monos sem custo. Mas cada uma tem as suas regras — marcação, dias, limites —, e há casos em que a recolha da câmara não chega. Este guia junta o que as câmaras publicam e diz quando compensa pedir a um profissional.",
    sections: [
      {
        title: "O que é um mono",
        paragraphs: [
          "Mono — ou «monstro» — é o nome que as câmaras dão aos objetos volumosos que não cabem no contentor do lixo: sofás, colchões, camas, roupeiros, mesas, cadeiras. O entulho de obras não é mono e tem regras próprias, que explicamos em [entulho de obras: sacos, big bag ou contentor](/blog/entulho-sacos-big-bag-ou-contentor).",
          "Os eletrodomésticos grandes têm muitas vezes um caminho à parte: em Sintra e na Moita, por exemplo, as câmaras indicam a Electrão, que os recolhe em casa sem custo, pelo 800 262 333.",
        ],
      },
      {
        title: "Como funciona a recolha da câmara",
        paragraphs: [
          "Em quase todos os concelhos marca-se a recolha — com a câmara, com os serviços municipalizados ou com a junta de freguesia — e os monos ficam no local e no dia combinados. Na Moita não há marcação: a câmara passa em circuitos fixos, em dias certos para cada zona.",
          "Levar os monos até à rua, ou até junto do contentor, é com o morador. E em vários concelhos deixá-los na rua fora do dia combinado dá coima.",
          "Algumas câmaras põem limites: no Seixal a recolha é gratuita até 8 m³, em Sintra até 10 peças por mês, em Sesimbra até 1100 litros de cada vez.",
        ],
      },
      {
        title: "Concelho a concelho",
        paragraphs: [
          `As regras de cada câmara — os contactos, os dias, os limites e as fontes — estão na página de recolha de monos de cada terra: ${ligacoesDasCamaras("recolha-monos")}.`,
        ],
      },
      {
        title: "Quando compensa um profissional",
        paragraphs: ["A recolha da câmara resolve muitos casos. Um profissional compensa quando:"],
        bullets: [
          "os monos estão dentro de casa, ou num andar sem elevador — a câmara recolhe na rua, e levá-los até lá é consigo;",
          "precisa de um dia e de uma hora certos, e não pode esperar pelo dia da sua zona;",
          "a quantidade passa os limites da câmara, ou é o recheio de uma casa inteira;",
          "é preciso desmontar antes — roupeiros, camas, estantes;",
          "há entulho ou lixo misturado, que a recolha dos monos não leva.",
        ],
      },
      {
        title: "Quanto custa",
        paragraphs: [
          `Como referência, a recolha de monos por um profissional fica em ${PRECOS.recolha_monos.etiqueta}, ${SEM_IVA_NA_FRASE}. O que faz variar é o volume, o andar e o elevador, e se há móveis para desmontar. O preço certo vem nas propostas, fechado antes de o trabalho começar.`,
        ],
      },
      {
        title: "Como pedir",
        paragraphs: [
          `Mande fotografias do que quer tirar, diga o andar, se há elevador e a data que lhe serve. Os profissionais da zona respondem com propostas ${PROPOSTAS_EM_ATE}.`,
          "Veja a [recolha de monos](/recolha-de-monos), ou peça já no [simulador](/simulador).",
        ],
      },
    ],
    faq: [
      {
        question: "A câmara recolhe os monos de graça?",
        answer:
          "Na maior parte dos concelhos da área de Lisboa e de Setúbal, sim — com marcação ou em dias certos, e às vezes com limites. As regras de cada câmara estão na página de recolha de monos de cada terra.",
      },
      {
        question: "Quem leva os monos até à rua?",
        answer:
          "Na recolha da câmara, o morador: os monos ficam no local e no dia combinados. Se estiverem dentro de casa ou num andar sem elevador, a recolha por um profissional tira-os de lá.",
      },
      {
        question: "O preço inclui IVA?",
        answer:
          "Os valores de referência são sem IVA. Na proposta, o preço já vem com IVA incluído, e há fatura em todas as vendas.",
      },
    ],
  },
  {
    slug: "entulho-sacos-big-bag-ou-contentor",
    title: "Entulho de obras: sacos, big bag da câmara ou contentor? Como escolher",
    metaTitle: "Entulho de Obras: Sacos, Big Bag ou Contentor?",
    description: `Três formas de tirar o entulho de uma obra: o big bag da câmara, um contentor alugado ou a recolha em sacos (${maisIva(PRECOS.recolha_entulho.etiqueta)}).`,
    category: "Recolha de entulho",
    keywords: [
      "big bag entulho câmara",
      "entulho de obras o que fazer",
      "recolha de entulho em sacos",
      "contentor de entulho",
      "preço recolha de entulho",
    ],
    readingTime: "6 min",
    publishDate: "2026-10-15",
    heroLabel: "Recolha de entulho",
    intro:
      "Uma obra pequena — uma casa de banho, uma cozinha, um quarto — deixa entulho que não pode ir para o contentor do lixo. Há três caminhos: o big bag que muitas câmaras recolhem, um contentor alugado à porta, ou a recolha em sacos por um profissional. Este guia compara os três, com as regras que as câmaras publicam.",
    sections: [
      {
        title: "O big bag da câmara",
        paragraphs: [
          "Muitas câmaras recolhem o entulho de pequenas obras em casa, isentas de licença, num big bag de cerca de 1 m³ — umas sem custo até um limite, outras com uma tarifa. Alguns exemplos, das regras que publicam:",
        ],
        bullets: EXEMPLOS_DE_ENTULHO,
      },
      {
        title: "O que as regras têm em comum",
        paragraphs: [
          "Quase sempre só para obras isentas de licença, e só com materiais inertes — betão, tijolo, ladrilho, telha, cerâmica. Amianto, tintas e misturas ficam de fora, e em várias câmaras o saco tem de ficar na rua, ao alcance do camião.",
          `As regras das outras câmaras estão na página de recolha de entulho de cada terra: ${ligacoesDasCamaras("recolha-entulho", (c) => Boolean(RECOLHA_DA_CAMARA[c]?.entulho))}.`,
        ],
      },
      {
        title: "O contentor alugado",
        paragraphs: [
          "Para uma obra grande — uma remodelação completa, uma demolição —, o caminho costuma ser uma empresa de contentores, que deixa o contentor à porta e o leva cheio. Na via pública, ocupar a rua costuma precisar de autorização da câmara: confirme com a empresa.",
          NAO_HA_CONTENTORES,
        ],
      },
      {
        title: "A recolha em sacos",
        paragraphs: [
          `${COMO_SE_RECOLHE_ENTULHO} Se o entulho estiver solto no chão, o profissional ensaca-o no local. Os sacos descem por qualquer escada, e a rua não fica ocupada com um contentor.`,
          `Como referência, a recolha fica ${maisIva(PRECOS.recolha_entulho.etiqueta)} — e um metro cúbico são uns ${SACOS_POR_METRO_CUBICO} sacos de ${PESO_DO_SACO}. Na proposta, o preço já vem com IVA incluído.`,
        ],
      },
      {
        title: "Qual escolher",
        paragraphs: [],
        bullets: [
          "Pouco entulho, já ensacado e sem pressa: o big bag da câmara, se a sua o tiver.",
          "Entulho dentro de casa, num andar sem elevador, ou com uma data certa: a recolha em sacos.",
          "Uma obra grande, com espaço na rua para o contentor: uma empresa de contentores.",
          "Entulho misturado com móveis ou monos: a recolha por um profissional, que leva tudo de uma vez.",
        ],
      },
      {
        title: "Como pedir",
        paragraphs: [
          `Mande fotografias do entulho e diga quanto é — em sacos ou em metros cúbicos —, o andar, se há elevador e a data. Os profissionais da zona respondem com propostas ${PROPOSTAS_EM_ATE}.`,
          "Veja a [recolha de entulho](/recolha-de-entulho), ou peça já no [simulador](/simulador).",
        ],
      },
    ],
    faq: [
      {
        question: "A CLYON aluga contentores?",
        answer: RESPOSTA_SOBRE_CONTENTORES,
      },
      {
        question: "Quantos sacos são um metro cúbico de entulho?",
        answer: `Uns ${SACOS_POR_METRO_CUBICO} sacos de ${PESO_DO_SACO}. Diga no pedido quantos sacos são, ou os metros cúbicos, e mande fotografias.`,
      },
      {
        question: "O preço inclui IVA?",
        answer:
          "Os valores de referência são sem IVA. Na proposta, o preço já vem com IVA incluído, e há fatura em todas as vendas.",
      },
    ],
  },
  {
    slug: "esvaziar-apartamento-para-arrendar-ou-vender",
    title: "Esvaziar um apartamento para arrendar ou vender: prazos, custos e o que fazer ao recheio",
    metaTitle: "Esvaziar um Apartamento para Arrendar ou Vender",
    description: `Fim de arrendamento ou venda: como planear o esvaziamento até à data das chaves, o que fazer ao recheio e quanto custa (${maisIva(PRECOS.esvaziamento_apartamento.etiqueta)}).`,
    category: "Esvaziamento",
    keywords: [
      "esvaziar apartamento",
      "esvaziamento de apartamento",
      "esvaziar casa para vender",
      "esvaziar casa para arrendar",
      "recheio fim de arrendamento",
    ],
    readingTime: "5 min",
    publishDate: "2026-10-15",
    updatedDate: "2026-10-28",
    heroLabel: "Esvaziamento",
    intro:
      "Entre um inquilino que sai e outro que entra, ou antes de uma escritura, o apartamento tem de ficar vazio numa data que não se mexe. Este guia mostra como planear o esvaziamento para chegar a essa data com a casa pronta — e quanto custa, com os valores de referência da CLYON.",
    sections: [
      {
        title: "Comece pela data",
        paragraphs: [
          "A data que manda é a da entrega das chaves ou a da escritura. Conte para trás: um T1 ou um T2 costuma esvaziar-se num dia, e um T3 ou um T4 com arrecadação pode levar dois. Antes disso, deixe uns dias para decidir o que fica, o que se vende e o que se doa.",
        ],
      },
      {
        title: "O que sai e o que fica",
        paragraphs: [
          "Num fim de arrendamento, o que é do inquilino sai com ele, e o que veio com a casa fica. Antes de retirar seja o que for, confira o que diz o contrato — e, se houver inventário, o que lá está.",
          "Numa venda, combine com o comprador o que fica: há quem prefira a cozinha equipada, ou um roupeiro embutido.",
        ],
      },
      {
        title: "Vender, doar ou retirar",
        paragraphs: [
          "O que tem valor vende-se antes; o que está bom e ninguém quer pode ser doado. Explicamos onde em [onde doar, vender ou anunciar móveis usados](/blog/onde-doar-vender-ou-anunciar-moveis-usados) e em [doar móveis usados em Lisboa](/recolha-gratuita-de-moveis-usados).",
          "O resto sai no esvaziamento, para destino licenciado. Pode pedir que o que ainda serve vá para reaproveitamento: diga-o no pedido, e a proposta diz o que fica incluído.",
        ],
      },
      {
        title: "Quanto custa",
        paragraphs: [
          `Como referência, esvaziar um apartamento fica em ${PRECOS.esvaziamento_apartamento.etiqueta}, ${SEM_IVA_NA_FRASE}. Uma casa com mais recheio começa ${PRECOS.esvaziamento_casa.etiqueta}, também sem IVA.`,
          "O que mais faz variar é o volume, o andar e o elevador, a arrecadação ou a garagem, e os móveis para desmontar. Vender e doar antes baixa o volume — e o preço.",
        ],
      },
      {
        title: "Antes de entregar as chaves",
        paragraphs: [
          "Tire fotografias de cada divisão vazia, com a data: servem de registo do estado em que a casa ficou — para o próximo inquilino, para o comprador, ou para a caução.",
        ],
      },
      {
        title: "Como pedir",
        paragraphs: [
          `Mande fotografias de cada divisão, diga o andar, se há elevador e a data limite. Os profissionais da zona respondem com propostas ${PROPOSTAS_EM_ATE}, e ${O_DIA_DO_TRABALHO}.`,
          "Veja o [esvaziamento de casas](/esvaziamento-de-casas) e o [esvaziamento de apartamento](/servicos/esvaziamento-apartamento), ou peça já no [simulador](/simulador).",
        ],
      },
    ],
    faq: [
      {
        question: "Quanto tempo demora a esvaziar um apartamento?",
        answer:
          "Um T1 ou um T2 costuma fazer-se num dia; um T3 ou um T4 com arrecadação pode levar dois. O prazo fica combinado na proposta, antes de começar.",
      },
      {
        question: "É preciso estar presente?",
        answer:
          "Não obrigatoriamente. Muitos esvaziamentos de fim de arrendamento fazem-se com alguém a abrir a porta e a fechar no fim. Combina-se caso a caso.",
      },
      {
        question: "O preço inclui IVA?",
        answer:
          "Os valores de referência são sem IVA. Na proposta, o preço já vem com IVA incluído, e há fatura em todas as vendas.",
      },
    ],
  },
  {
    slug: "mudanca-entre-lisboa-e-a-margem-sul",
    title: "Mudança entre Lisboa e a Margem Sul: pontes, tempos e quanto custa",
    metaTitle: "Mudança entre Lisboa e a Margem Sul",
    description: `De Lisboa para Almada, Seixal ou Barreiro, ou o contrário: a ponte, o tempo e o preço — ${PRECO_POR_HORA} €/h + IVA pela equipa de ${PESSOAS_NA_EQUIPA}, mínimo ${MINIMO_DE_HORAS} horas.`,
    category: "Mudanças",
    keywords: [
      "mudança lisboa margem sul",
      "mudança lisboa almada",
      "mudança lisboa seixal",
      "mudança lisboa barreiro",
      "mudança ponte 25 de abril",
    ],
    readingTime: "5 min",
    publishDate: "2026-10-15",
    heroLabel: "Mudanças",
    intro:
      "Muita gente muda de casa entre as duas margens do Tejo — de Lisboa para Almada, para o Seixal ou para o Barreiro, ou no sentido contrário. A travessia muda pouco a conta, mas muda o planeamento. Este guia junta o que pesa numa mudança entre margens, com a tabela da CLYON.",
    sections: [
      {
        title: "Que ponte",
        paragraphs: [
          "Para Almada, a Costa da Caparica, o Seixal, Corroios e o Barreiro, a travessia costuma ser pela ponte 25 de Abril; para o Montijo e Alcochete, pela ponte Vasco da Gama. A portagem da ponte entra na proposta.",
          "Cada terra tem a sua página, com as rotas, os acessos e as perguntas mais comuns: [Almada](/mudancas/almada), [Costa da Caparica](/mudancas/costa-da-caparica), [Seixal](/mudancas/seixal), [Corroios](/mudancas/corroios), [Barreiro](/mudancas/barreiro), [Montijo](/mudancas/montijo) e [Alcochete](/mudancas/alcochete).",
        ],
      },
      {
        title: "Quanto tempo leva a travessia",
        paragraphs: [
          "Pela ponte 25 de Abril, entre a Costa da Caparica e Lisboa, o trajeto leva 20 a 35 minutos; pela Vasco da Gama, entre Alcochete e Lisboa, 25 a 40 minutos — consoante a hora. Fora das horas de ponta, a mudança ganha tempo; e, como se paga à hora, poupa dinheiro.",
        ],
      },
      {
        title: "Quanto custa",
        paragraphs: [
          PRECO_DA_MUDANCA_POR_EXTENSO,
          `Entre Lisboa e a Margem Sul, a distância fica quase sempre dentro dos ${RAIO_INCLUIDO_KM} km incluídos. Um T2, por exemplo, leva cerca de ${HORAS_POR_TIPOLOGIA.T2} horas — ${HORAS_POR_TIPOLOGIA.T2 * PRECO_POR_HORA} € + IVA. A tabela por tipologia está em [quanto custa uma mudança em Lisboa](/blog/quanto-custa-uma-mudanca-em-lisboa).`,
          EXTRAS_DA_MUDANCA,
        ],
      },
      {
        title: "O que planear nas duas pontas",
        paragraphs: [
          `Em Lisboa, o estacionamento pesa. ${ESTACIONAMENTO_EM_LISBOA}`,
          "Na Margem Sul, Almada velha e Cacilhas ficam sobre a arriba, com ruas inclinadas e escadinhas onde a carrinha nem sempre chega à porta. Diga no pedido, nas duas moradas, o andar, se há elevador e se a carrinha chega à entrada.",
        ],
      },
      {
        title: "Como pedir",
        paragraphs: [
          `Diga as duas moradas, a tipologia, os andares e a data. Os profissionais respondem com propostas ${PROPOSTAS_EM_ATE}.`,
          "Veja as [mudanças](/mudancas), ou peça já no [simulador](/simulador?servico=mudanca).",
        ],
      },
    ],
    faq: [
      {
        question: "A portagem da ponte paga-se à parte?",
        answer: "Não: a portagem entra na proposta, sem surpresas.",
      },
      {
        question: "Quanto custa a mudança de um T2 de Lisboa para o Seixal?",
        answer: `Conte com cerca de ${HORAS_POR_TIPOLOGIA.T2} horas, ${HORAS_POR_TIPOLOGIA.T2 * PRECO_POR_HORA} € + IVA, mais os extras se os houver — andares sem elevador, desmontagem, materiais. O valor certo vem na proposta.`,
      },
      {
        question: "O preço inclui IVA?",
        answer: `A tabela é sem IVA: ${PRECO_POR_HORA} € + IVA por hora. Na proposta, o preço já vem com IVA incluído, e há fatura em todas as vendas.`,
      },
    ],
  },
];

/** Um pedaço de parágrafo: texto corrido, ou uma ligação interna. */
export type ParteDoTexto = { texto: string } | { texto: string; href: string };

/**
 * Parte um parágrafo em texto e ligações `[rótulo](/caminho)`.
 *
 * Os parágrafos são texto simples, e o artigo «como funciona» escrevia os
 * caminhos à mão («veja em /recolha-de-moveis») sem ligação nenhuma. Só se
 * aceitam caminhos internos (a começar por «/»): um endereço de fora não se
 * mete no meio de um artigo sem ninguém reparar.
 */
export function partesDoTexto(paragrafo: string): ParteDoTexto[] {
  const partes: ParteDoTexto[] = [];
  const re = /\[([^\]]+)\]\((\/[^)\s]*)\)/g;
  let desde = 0;
  for (const m of paragrafo.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > desde) partes.push({ texto: paragrafo.slice(desde, i) });
    partes.push({ texto: m[1], href: m[2] });
    desde = i + m[0].length;
  }
  if (desde < paragrafo.length) partes.push({ texto: paragrafo.slice(desde) });
  return partes;
}


export function getAllBlogPosts() {
  return BLOG_POSTS;
}

export function getBlogPost(slug: string) {
  return BLOG_POSTS.find((post) => post.slug === slug);
}
