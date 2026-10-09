import { DESMONTAGEM_A_PEDIDO, NO_MESMO_DIA, PROPOSTAS_EM_ATE } from "./promessas-publicas";

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
          "Pedidos em que a prioridade não é libertar o espaço no mesmo dia",
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
    title: "Recolha de móveis: como funciona, quanto custa e quando pedir apoio",
    metaTitle: "Recolha de Móveis: Como Funciona e Quanto Custa",
    description:
      "Guia completo sobre recolha de móveis usados, móveis velhos, sofás, camas, armários, recheios e despejos em Lisboa, Margem Sul e Setúbal.",
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
    heroLabel: "Alternativas",
    intro:
      "Antes de pedir recolha, vale a pena ver se os móveis ainda servem a alguém: doação, venda, entrega a instituições ou anúncio com procura local. Este guia ajuda a decidir quando compensa cada via e quando a recolha é o caminho mais prático.",
    sections: [
      {
        title: "Quando vender em vez de despejar",
        paragraphs: [
          "Se a peça está moderna, funcional, sem danos e com procura no mercado local, anunciar pode ser a melhor primeira tentativa. A OLX continua a ser uma referência natural neste tipo de pesquisa porque liga vendedores e compradores de forma direta.",
          "O problema é que vender demora. Exige criar anúncio, negociar, responder a mensagens e coordenar levantamento. Se a prioridade é libertar espaço no mesmo dia ou numa janela curta, a recolha profissional volta a ganhar vantagem.",
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
      "Preços de mudanças em Lisboa para T1, T2 e T3. Fatores que influenciam o custo: volume, distância, andar, elevador e serviços extra.",
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
    heroLabel: "Mudanças",
    intro:
      "O preço de uma mudança em Lisboa depende de vários fatores: o tamanho do apartamento, a distância entre moradas, o andar (com ou sem elevador), a necessidade de desmontagem e montagem de móveis e se quer incluir embalagem. Este guia ajuda a perceber valores reais e a evitar surpresas.",
    sections: [
      {
        title: "Preços médios por tipologia de apartamento",
        paragraphs: [
          "O que faz o preço variar é o volume real de móveis e caixas, a tipologia, o piso e a distância. Um T1 dentro de Lisboa e um T4 com garagem são trabalhos de escalas diferentes — e é por isso que o valor sai da descrição do caso, e não de uma tabela.",
          "O orçamento inclui normalmente carga, transporte, descarga e proteção básica dos móveis. Embalagem completa e montagem de móveis são serviços extra e vêm sempre discriminados na proposta, para não haver surpresas no fim.",
        ],
      },
      {
        title: "O que faz o preço subir ou descer",
        paragraphs: [
          "O andar é um dos principais fatores. Um 5.º andar sem elevador exige mais tempo e esforço da equipa, o que se reflecte no orçamento. A distância entre a casa antiga e a nova também conta: uma mudança dentro do mesmo bairro sai mais barata do que uma mudança para outra cidade.",
          "Móveis grandes como pianos, cofres ou móveis de canto podem exigir técnicas especiais de transporte e aumentar o custo. Dias de fim de semana ou fim de mês também tendem a ter maior procura e preços ligeiramente mais altos.",
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
          "Sim, se o volume real for muito diferente do previsto ou se houver dificuldades de acesso não comunicadas. Por isso, fotos detalhadas ajudam a evitar surpresas.",
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
          "Pode pedir recolha separada ou combinar com a empresa de mudanças para retirar no mesmo dia o que não vai para a casa nova.",
      },
    ],
  },
  {
    slug: "pequenas-mudancas-em-lisboa-quando-compensa",
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
          "Estes serviços são rápidos — uma a duas horas — e por isso ficam bastante abaixo de uma mudança completa. O valor exato depende do volume e da distância, e vem na proposta.",
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
          "Sim. É um dos pedidos mais comuns. O preço depende do tamanho do sofá, da distância e do acesso nos dois endereços.",
      },
      {
        question: "E se o móvel não couber no elevador?",
        answer:
          "Sobe-se pelas escadas. É uma situação muito comum, mas pode aumentar o preço — diga-o no pedido para vir na proposta.",
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
