import { AVALIACOES, PRAZO_DE_RESPOSTA, NOTAS_EM_FRASE } from "./seo-data";
import { ESVAZIAMENTO_POR_TIPOLOGIA, PRECOS, SEM_IVA_NA_FRASE } from "./precos-publicos";
import { ENTULHO_EM_FRASE, desdeSemEComIva, faixaSemEComIva } from "./preco-de-referencia";
import { ENTULHO_10_SACOS_NA_FRASE } from "./descricoes-seo";
import { IDENTIFICACAO } from "./identificacao-legal";
import {
  AO_FIM_DE_SEMANA,
  DESMONTAGEM_A_PEDIDO,
  ACRESCIMO_POR_URGENCIA,
  NO_MESMO_DIA,
  PROPOSTAS_EM_ATE,
  PROMESSA_DO_PRAZO,
} from "./promessas-publicas";
import {
  COMO_SE_RECOLHE_ENTULHO,
  NAO_HA_CONTENTORES,
  PESO_DO_SACO,
  RESPOSTA_SOBRE_CONTENTORES,
  SACOS_POR_METRO_CUBICO,
} from "./sacos-de-entulho";

/**
 * Conteúdo único e personalizado por cidade E por serviço para páginas SEO locais.
 * Cada combinação cidade+serviço tem conteúdo genuinamente diferente.
 *
 * A VOZ DESTE FICHEIRO É A DA PLATAFORMA — 30-09-2026.
 *
 * Estava escrito como se a CLYON fosse a empresa que vai a casa: «a nossa
 * sede em Belverde», «estamos no Seixal, a 10 minutos», «desmontamos»,
 * «levamos tudo», «os nossos preços no Seixal são os mais competitivos».
 * Nada disso é verdade numa plataforma: quem vai é o profissional que o
 * cliente escolher, a partir da base DELE, e é ele quem fixa o preço. Por
 * isso aqui não há distâncias à CLYON, nem comparações de preço entre zonas,
 * nem prazos que não sejam o das propostas. As respostas que se repetiam
 * (mesmo dia, fim de semana, desmontagem) vêm de `promessas-publicas.ts`.
 *
 * `localIntro`, `accessNotes`, `neighborhoodHighlight`, `landmarks` e `faqs`
 * aparecem na página (e as FAQ também no FAQPage do Google); `metaTitle`,
 * `h1` e `ctaText` não são lidos por nenhuma página, mas ficam no mesmo tom
 * para não voltarem a ensinar a voz errada a quem copiar uma cidade.
 */

export interface CityServiceContent {
  // Identificação
  citySlug: string;
  serviceSlug: string;

  // SEO único
  metaTitle: string;
  h1: string;

  // Conteúdo local único
  localIntro: string;
  accessNotes: string;
  neighborhoodHighlight: string;
  nearbyAreas: string[];

  // FAQs únicas (não parametrizadas)
  faqs: { q: string; a: string }[];

  // Preços específicos

  // CTA contextualizado
  ctaText: string;
}

// =============================================================================
// CONTEÚDO ÚNICO POR CIDADE+SERVIÇO (10 páginas prioritárias)
// =============================================================================

// As tipologias do esvaziamento, para as FAQ de preço (d96): da tabela, nunca à mão.
const T0T1 = ESVAZIAMENTO_POR_TIPOLOGIA.find((t) => t.chave === "T0/T1")!;
const T2 = ESVAZIAMENTO_POR_TIPOLOGIA.find((t) => t.chave === "T2")!;
const MORADIA = ESVAZIAMENTO_POR_TIPOLOGIA.find((t) => t.chave === "moradia")!;

export const CITY_SERVICE_CONTENT: Record<string, CityServiceContent> = {
  // ---------------------------------------------------------------------------
  // 1. RECOLHA DE MÓVEIS EM LISBOA
  // ---------------------------------------------------------------------------
  "recolha-moveis-lisboa": {
    citySlug: "lisboa",
    serviceSlug: "recolha-moveis",
    metaTitle: "Recolha de Móveis em Lisboa — Sofás, Camas e Recheios Completos",
    h1: "Recolha de Móveis Usados em Lisboa — Sofás, Camas, Armários e Recheios",
    localIntro:
      "Precisa de retirar móveis em Lisboa? Pela CLYON, parceiros retiram sofás velhos, camas com colchão, armários, mesas, cadeiras, eletrodomésticos e recheios completos de apartamentos — em toda a cidade, dos prédios antigos sem elevador de Alfama e da Mouraria aos condomínios do Parque das Nações. Se o sofá não passa na porta, o parceiro desmonta-o (diga-o no pedido); se há escadas estreitas, desce peça a peça; se o estacionamento é complicado, combina consigo o horário.",
    accessNotes:
      "Nos bairros históricos (Alfama, Mouraria, Graça, Bairro Alto), os acessos são por escadas em caracol ou ruas empedradas onde a carrinha não entra — por isso o pedido deve dizer o andar e o acesso, que é com o que o parceiro fecha o preço. Nas zonas mais modernas (Parque das Nações, Telheiras, Benfica), os acessos são normalmente fáceis.",
    neighborhoodHighlight:
      "As zonas de Lisboa com mais pedidos de recolha de móveis são Benfica, Lumiar, Alvalade, Olivais e Telheiras. São bairros residenciais com muitas mudanças, renovações e esvaziamentos de apartamentos arrendados.",
    nearbyAreas: ["Amadora", "Odivelas", "Loures", "Oeiras"],
    faqs: [
      {
        q: "Quanto custa recolher um sofá em Lisboa?",
        a: `O valor depende do volume, acesso, piso e necessidade de desmontagem. Num 5.º andar sem elevador em Alfama, o preço é diferente de um rés-do-chão em Telheiras. Descreva o sofá com fotos e recebe propostas de parceiros da zona ${PROPOSTAS_EM_ATE}.`,
      },
      {
        q: "Há recolha de camas e colchões em Lisboa?",
        a: `Sim. Os parceiros retiram camas de casal, camas de solteiro, beliches, colchões de todas as medidas, sommiers e estrados. ${DESMONTAGEM_A_PEDIDO} O valor depende do acesso e do conjunto de peças.`,
      },
      {
        q: "Recolhem armários e roupeiros em Lisboa?",
        a: `Sim. Os parceiros retiram armários de 2, 3 ou mais portas, roupeiros embutidos (quando removíveis), estantes e móveis de quarto. Se não couber nas escadas, desmonta-se no local. ${DESMONTAGEM_A_PEDIDO}`,
      },
      {
        q: "Há esvaziamento de recheio completo em Lisboa?",
        a: "Sim. Pela CLYON pode pedir o esvaziamento completo de apartamentos e moradias em Lisboa: o parceiro leva móveis, eletrodomésticos, roupa, tralha e decoração. Ideal para heranças, mudanças e entrega de imóveis arrendados.",
      },
      {
        q: "Recolhem eletrodomésticos junto com os móveis em Lisboa?",
        a: "Sim. Frigoríficos, máquinas de lavar roupa e loiça, fogões, fornos, micro-ondas, arcas e TVs podem ir no mesmo pedido que os móveis.",
      },
      {
        q: "Qual a diferença entre a CLYON e a recolha da Câmara de Lisboa?",
        a: "A remoção de monos da Câmara de Lisboa é gratuita para particulares e marca-se com antecedência, por exemplo na Na Minha Rua LX. Pela CLYON, o parceiro vai buscá-los dentro de casa, desmonta se o pedir e leva-os na data que combinar com ele — é um serviço pago.",
      },
      {
        q: "Fazem recolha de móveis ao sábado em Lisboa?",
        a: AO_FIM_DE_SEMANA,
      },
      {
        q: "Podem recolher móveis no mesmo dia em Lisboa?",
        a: NO_MESMO_DIA,
      },
      {
        q: "Fazem recolha de móveis em Benfica, Lumiar e Alvalade?",
        a: "Sim. O pedido chega aos parceiros que trabalham nesses bairros. Em Alvalade muitos prédios não têm elevador — diga o andar no pedido para vir contado na proposta.",
      },
    ],
    ctaText: `Móveis para retirar em Lisboa? Envie fotos pelo WhatsApp e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },

  // ---------------------------------------------------------------------------
  // 2. RECOLHA DE ENTULHO EM LISBOA
  // ---------------------------------------------------------------------------
  "recolha-entulho-lisboa": {
    citySlug: "lisboa",
    serviceSlug: "recolha-entulho",
    metaTitle: "Recolha de Entulho em Lisboa - Obras e Remodelações | CLYON",
    h1: "Recolha de Entulho de Obras em Lisboa",
    localIntro:
      `Lisboa está sempre em obras. Remodelações de apartamentos antigos, renovações de lojas no Chiado, restauros em Alfama. O entulho acumula-se e precisa de sair rápido para a obra avançar. ${COMO_SE_RECOLHE_ENTULHO} ${NAO_HA_CONTENTORES}`,
    accessNotes:
      "Em muitas obras de Lisboa o acesso é por escadas ou ruas estreitas, onde não entra nem estaciona nada de grande. É por isso que se trabalha a saco e à mão: desce por qualquer escada e não ocupa a rua nem precisa de licença.",
    neighborhoodHighlight:
      "As zonas com mais obras em Lisboa são o centro histórico (Alfama, Mouraria, Baixa), Avenidas Novas e Parque das Nações. Cada zona tem desafios de acesso diferentes.",
    nearbyAreas: ["Amadora", "Loures", "Odivelas", "Oeiras"],
    faqs: [
      {
        q: "Quanto custa recolher entulho de uma obra em Lisboa?",
        // O m³ ao preço dos sacos, ensacado ou a granel (d7, 04-11-2026): dizia «desde 120 €/m³».
        a: `Depende da quantidade. A recolha de entulho conta-se ${ENTULHO_EM_FRASE}. Uma remodelação de casa de banho ou de cozinha cabe normalmente em 1 m³, uns ${SACOS_POR_METRO_CUBICO} sacos. Diga quantos sacos tem, ou mande uma fotografia: é daí que os parceiros fazem a proposta.`,
      },
      {
        q: "A CLYON fornece contentor para entulho em Lisboa?",
        // A pergunta fica: é procurada, e quem a faz merece um não em dez
        // segundos em vez de o descobrir na véspera da obra.
        a: RESPOSTA_SOBRE_CONTENTORES,
      },
      {
        q: "Recolhem entulho de obras ao sábado em Lisboa?",
        // 30-09-2026: dizia «Domingos não trabalhamos», e a página de
        // mudanças prometia domingos com acréscimo. A regra é uma só.
        a: AO_FIM_DE_SEMANA,
      },
      {
        q: "Podem recolher entulho de um 4º andar sem elevador em Lisboa?",
        a: "Sim — é para isso que serve a recolha a saco: desce à mão por qualquer escada. Diga o andar no pedido, para o esforço da descida vir contado na proposta.",
      },
    ],
    ctaText: `Tem entulho de obra em Lisboa? Diga o volume e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },

  // ---------------------------------------------------------------------------
  // 2.5. RECOLHA DE MONOS EM LISBOA (PÁGINA PRIORITÁRIA)
  // ---------------------------------------------------------------------------
  "recolha-monos-lisboa": {
    citySlug: "lisboa",
    serviceSlug: "recolha-monos",
    metaTitle: "Monos em Lisboa: Câmara Grátis ou Parceiro em Casa",
    h1: "Recolha de Monos em Lisboa: pela Câmara ou de dentro de casa",
    localIntro:
      `Tem monos em casa que precisa de retirar? A remoção de monos da Câmara de Lisboa é gratuita para particulares e marca-se com antecedência. Pela CLYON, o parceiro vai buscá-los onde estiverem — num 5.º andar sem elevador em Alfama, numa cave na Graça ou numa garagem no Parque das Nações. Descreve o pedido, recebe propostas ${PROPOSTAS_EM_ATE}, e o parceiro escolhido aparece no dia combinado e leva tudo.`,
    accessNotes:
      "Em Lisboa, os acessos mais complicados são nos bairros históricos: Alfama, Mouraria, Graça e Castelo têm escadas estreitas, ruas empedradas e estacionamento impossível. Por isso o pedido deve dizer o andar e o tipo de escada: é com isso que o parceiro fecha o preço, e não há surpresas no dia.",
    neighborhoodHighlight:
      "As zonas de Lisboa com mais pedidos de recolha de monos são Benfica, Lumiar, Alvalade, Olivais e Telheiras. São bairros residenciais com muitas mudanças, renovações e esvaziamentos de casa.",
    nearbyAreas: ["Amadora", "Odivelas", "Loures", "Oeiras"],
    faqs: [
      {
        q: "Qual a diferença entre a recolha de monos da CLYON e a da Câmara de Lisboa?",
        // 30-09-2026: prometia «lista de espera de 2-4 semanas» na câmara — um
        // número que ninguém mediu — e que a CLYON «entra em casa». Fica a
        // diferença que é verdade dos dois lados.
        a: "A remoção de monos da Câmara de Lisboa é gratuita para particulares e marca-se com antecedência, na Na Minha Rua LX. Pela CLYON, o parceiro entra em casa, desmonta se o pedir, carrega e transporta, na data que combinar com ele — é um serviço pago.",
      },
      {
        q: "Quanto custa recolher monos em Lisboa?",
        a: `Depende do volume, acesso, urgência e necessidade de desmontagem. Descreva os monos com fotos e recebe propostas de parceiros da zona ${PROPOSTAS_EM_ATE}.`,
      },
      {
        q: "Há recolha de monos em prédios sem elevador em Lisboa?",
        a: "Sim, é das situações mais comuns em Alfama, na Mouraria e na Graça. O número de pisos e o tipo de escada entram na proposta do parceiro — diga-os no pedido.",
      },
      {
        q: "Podem retirar monos no mesmo dia em Lisboa?",
        a: NO_MESMO_DIA,
      },
      {
        q: "Que tipo de monos se recolhem em Lisboa?",
        a: "Os parceiros retiram todo o tipo de monos: sofás, camas, colchões, armários, mesas, cadeiras, eletrodomésticos, equipamento de ginásio, móveis de jardim, bicicletas velhas, tralha de garagem e cave. Basicamente, tudo o que precisa de sair e não cabe no lixo normal.",
      },
      {
        q: "Para onde vão os monos recolhidos em Lisboa?",
        // 30-09-2026: «Temos parcerias com operadores de resíduos» — não há
        // nenhuma que se possa mostrar. Quem transporta é o profissional, e é
        // ele que leva ao destino licenciado.
        a: "O parceiro leva-os para destino licenciado: o que se recicla vai para ecocentro ou operador de resíduos, e os eletrodomésticos para os circuitos próprios dos resíduos elétricos. Se tiver móveis em bom estado, pode doá-los antes da recolha.",
      },
      {
        q: "Quando compensa contratar a CLYON em vez de esperar pela Câmara?",
        a: "Compensa quando precisa dos monos fora depressa (mudança, venda de casa, obras), não os consegue levar para a rua sozinho, tem escadas sem elevador ou não pode esperar pela data da câmara. É um serviço pago: o preço vem na proposta, fechado antes de começar.",
      },
      {
        q: "Posso doar os meus móveis usados em Lisboa em vez de pagar pela recolha?",
        // 30-09-2026: nomeava a Comunidade Vida e Paz e a Re-Food como quem
        // aceita móveis — nenhuma das duas o diz no site oficial (a Re-Food
        // trabalha com comida) — e prometia que «a CLYON pode ajudar a
        // encaminhar móveis», o que não existe em lado nenhum. Quem recebe
        // doações, e em que condições, está confirmado numa página só.
        a: "Sim, se estiverem em bom estado. A página «Doar móveis usados em Lisboa» diz quem os recebe e em que condições. Os monos danificados, sujos ou partidos raramente são aceites para doação — aí fica a recolha de monos da câmara ou a recolha paga.",
      },
      {
        q: "Qual é a melhor empresa para retirar móveis usados em Lisboa?",
        a: `A CLYON tem ${NOTAS_EM_FRASE}. ${PRAZO_DE_RESPOSTA.frase}. Um parceiro carrega e leva — e desmonta, se o pedir. O pedido chega a parceiros de Lisboa e da Margem Sul. Para comparar, peça orçamento gratuito e veja as propostas que recebe.`,
      },
    ],
    ctaText: `Monos para retirar em Lisboa? Envie fotos pelo WhatsApp e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },

  // ---------------------------------------------------------------------------
  // 3. RECOLHA DE MÓVEIS EM ALMADA
  // ---------------------------------------------------------------------------
  "recolha-moveis-almada": {
    citySlug: "almada",
    serviceSlug: "recolha-moveis",
    metaTitle: "Recolha de Móveis em Almada — Parceiros da Zona",
    h1: "Recolha de Móveis em Almada — Cacilhas, Pragal, Laranjeiro e Costa",
    localIntro:
      "Precisa de retirar móveis em Almada? Pela CLYON, o pedido chega a parceiros que trabalham em todo o concelho: Cacilhas, Pragal, Laranjeiro, Feijó, Cova da Piedade, Almada Velha e Costa da Caparica. Cada zona pede um trabalho diferente — Cacilhas tem prédios antigos com escadas, o Pragal e o Laranjeiro urbanizações mais recentes com elevador, a Costa da Caparica apartamentos de férias — e é isso que o pedido deve dizer para as propostas virem certas.",
    accessNotes:
      "Em Cacilhas e Almada Velha, há prédios antigos sem elevador onde é preciso desmontar móveis para descer. No Pragal, Laranjeiro e Feijó, a maioria dos prédios tem elevador e bons acessos. Na Costa da Caparica, os acessos são fáceis mas em época balnear o estacionamento complica.",
    neighborhoodHighlight:
      "As zonas de Almada com mais pedidos de recolha são Cacilhas (esvaziamentos de apartamentos antigos), Pragal e Laranjeiro (mudanças e renovações), e a Costa da Caparica (apartamentos de férias esvaziados no final do verão).",
    nearbyAreas: ["Seixal", "Lisboa", "Setúbal", "Barreiro"],
    faqs: [
      {
        q: "Há recolha de móveis em Almada?",
        a: "Sim. O pedido chega aos parceiros que trabalham em Almada: Cacilhas, Pragal, Laranjeiro, Feijó, Cova da Piedade, Almada Velha e Costa da Caparica.",
      },
      {
        q: "Quanto custa recolher móveis em Almada?",
        a: `O valor depende do volume, acesso, piso e necessidade de desmontagem. Descreva o pedido com fotos e recebe propostas de parceiros da zona ${PROPOSTAS_EM_ATE}.`,
      },
      {
        q: "Recolhem móveis em Cacilhas com escadas?",
        a: `Sim. Cacilhas tem muitos prédios antigos sem elevador: diga o andar no pedido, para o esforço vir contado na proposta. ${DESMONTAGEM_A_PEDIDO}`,
      },
      {
        q: "Fazem recolha de móveis no Pragal e Laranjeiro?",
        a: "Sim. Pragal e Laranjeiro são zonas com urbanizações recentes e bons acessos. A maioria dos prédios tem elevador, o que facilita o trabalho.",
      },
      {
        q: "Fazem recolha de móveis na Costa da Caparica?",
        a: "Sim. Muitos apartamentos de férias na Costa precisam de esvaziamento no fim da época. Os parceiros retiram sofás-cama, colchões, móveis de jardim e eletrodomésticos.",
      },
      {
        q: "Há esvaziamento completo de casas em Almada?",
        a: "Sim. Pela CLYON pode pedir o esvaziamento de apartamentos e moradias completas em Almada: o parceiro leva móveis, eletrodomésticos, roupa e tralha. Ideal para heranças, mudanças e entrega de imóveis arrendados.",
      },
      {
        q: "Recolhem eletrodomésticos em Almada?",
        a: "Sim. Frigoríficos, máquinas de lavar, fogões, fornos, micro-ondas e TVs podem ir no mesmo pedido que os móveis.",
      },
      {
        q: "Fazem recolha de móveis no Feijó e Cova da Piedade?",
        // 30-09-2026: dizia «com preços competitivos». Quem fixa o preço é o
        // profissional; a página não pode prometer que uma zona sai barata.
        a: "Sim. Feijó e Cova da Piedade são zonas centrais de Almada com boa acessibilidade, e o pedido chega aos parceiros que lá trabalham.",
      },
      {
        q: "Posso pedir recolhas em Almada e em Lisboa?",
        // 30-09-2026: «Estamos no Seixal… para Lisboa os preços são
        // ligeiramente superiores pela travessia». Nem a CLYON está no Seixal
        // para ir a lado nenhum, nem pode dizer quanto custa a travessia de
        // cada profissional — isso vem na proposta dele.
        a: "Sim. Cada pedido chega aos parceiros da zona da morada, dos dois lados do Tejo. Se a recolha envolver as duas margens, diga-o no pedido: a travessia entra na proposta.",
      },
    ],
    ctaText: `Móveis para retirar em Almada? Envie fotos e receba propostas de parceiros da zona ${PROPOSTAS_EM_ATE}.`,
  },

  // ---------------------------------------------------------------------------
  // 4. RECOLHA DE MÓVEIS NO SEIXAL
  // ---------------------------------------------------------------------------
  "recolha-moveis-seixal": {
    citySlug: "seixal",
    serviceSlug: "recolha-moveis",
    metaTitle: "Recolha de Móveis no Seixal - Amora, Corroios e Arrentela | CLYON",
    h1: "Recolha de Móveis no Seixal - Amora, Corroios e Arrentela",
    localIntro:
      `Precisa de retirar móveis no Seixal? Pela CLYON, o pedido chega a parceiros que trabalham em todo o concelho — Amora, Corroios, Arrentela, Paio Pires, Cruz de Pau e Fernão Ferro. Recebe propostas ${PROPOSTAS_EM_ATE}, com o preço fechado, e combina a data com o parceiro escolhido.`,
    accessNotes:
      "O Seixal tem uma mistura de prédios com elevador (Corroios, Cruz de Pau) e moradias (Fernão Ferro, Paio Pires). Diga no pedido se é prédio ou moradia, e o andar: é com isso que o parceiro prepara o trabalho.",
    neighborhoodHighlight:
      "Amora e Corroios são as zonas com mais pedidos. São bairros residenciais com muita rotação de inquilinos e renovações de apartamentos.",
    nearbyAreas: ["Almada", "Barreiro", "Sesimbra", "Setúbal"],
    faqs: [
      {
        q: "A CLYON é do Seixal?",
        // 30-09-2026: respondia «Sim, a nossa sede é em Belverde… conseguimos
        // os melhores preços e tempos de resposta». A morada vem de
        // IDENTIFICACAO (é a mesma dos termos); o resto não era verdade numa
        // plataforma — o preço e a deslocação são do profissional.
        a: `A CLYON está registada em ${IDENTIFICACAO.morada}. Mas é uma plataforma: quem vai a sua casa é um parceiro da sua zona, a partir da base dele, e o preço é o que ele propõe.`,
      },
      {
        q: "Quanto custa recolher um sofá no Seixal?",
        a: `O valor depende do volume, acesso e necessidade de desmontagem. Descreva o sofá com fotos e recebe propostas de parceiros da zona ${PROPOSTAS_EM_ATE}.`,
      },
      {
        q: "Fazem recolha de móveis em Fernão Ferro?",
        a: "Sim. Fernão Ferro tem muitas moradias com garagem e jardim. Os parceiros retiram móveis e equipamento de jardim e esvaziam garagens.",
      },
      {
        q: "Podem recolher móveis no mesmo dia no Seixal?",
        a: NO_MESMO_DIA,
      },
    ],
    ctaText: `Móveis para retirar no Seixal? Envie fotos e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },

  // ---------------------------------------------------------------------------
  // RECOLHA DE ENTULHO NO SEIXAL - NOVA
  // ---------------------------------------------------------------------------
  "recolha-entulho-seixal": {
    citySlug: "seixal",
    serviceSlug: "recolha-entulho",
    metaTitle: "Recolha de Entulho no Seixal - Obras em Amora, Corroios e Arrentela | CLYON",
    h1: "Recolha de Entulho de Obras no Seixal",
    localIntro:
      `Obra no Seixal? Pela CLYON, o pedido chega a parceiros que recolhem entulho em Corroios, Amora, Arrentela, Paio Pires, Fernão Ferro e nas restantes freguesias do concelho. ${COMO_SE_RECOLHE_ENTULHO}`,
    accessNotes:
      "No Seixal há zonas onde a carrinha encosta à porta (Corroios, Cruz de Pau), outras mais antigas com escadas e ruas estreitas, e ruas com estacionamento condicionado. Dizer isso no pedido é o que deixa a proposta certa à primeira.",
    neighborhoodHighlight:
      "Corroios e Amora são as zonas com mais obras de remodelação no Seixal. Muitos apartamentos dos anos 80-90 estão a ser modernizados, o que gera entulho de demolição de WCs, cozinhas e divisórias.",
    nearbyAreas: ["Almada", "Barreiro", "Lisboa", "Setúbal"],
    faqs: [
      {
        q: "A CLYON é do Seixal?",
        a: `A CLYON está registada em ${IDENTIFICACAO.morada}. Mas é uma plataforma: quem vai à obra é um parceiro da sua zona, a partir da base dele, e o preço é o que ele propõe.`,
      },
      {
        q: "Quanto custa um contentor de entulho no Seixal?",
        a: RESPOSTA_SOBRE_CONTENTORES,
      },
      {
        q: "Podem deixar contentor em Corroios ou Amora?",
        a: `${NAO_HA_CONTENTORES} Em Corroios, Amora, Arrentela, Paio Pires e Fernão Ferro, o parceiro vai buscar o entulho ensacado e leva-o na mesma ida — não fica nada na rua nem é preciso licença de ocupação.`,
      },
      {
        q: "Recolhem entulho aos sacos no Seixal?",
        a: `Sim — em sacos de obra de ${PESO_DO_SACO}, carregados à mão; e, se estiver solto, a granel. Diga quantos sacos tem e recebe propostas ${PROPOSTAS_EM_ATE}.`,
      },
      {
        q: "Podem recolher entulho no mesmo dia no Seixal?",
        a: NO_MESMO_DIA,
      },
    ],
    ctaText: `Obra no Seixal? Diga quantos sacos tem e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },

  // ---------------------------------------------------------------------------
  // 5. RECOLHA DE ENTULHO EM ALMADA
  // ---------------------------------------------------------------------------
  "recolha-entulho-almada": {
    citySlug: "almada",
    serviceSlug: "recolha-entulho",
    metaTitle: "Recolha de Entulho em Almada - Obras na Margem Sul | CLYON",
    h1: "Recolha de Entulho de Obras em Almada",
    localIntro:
      `Almada tem muitas obras em curso: remodelações de apartamentos antigos em Cacilhas, renovações de casas de férias na Costa da Caparica, construções novas no Pragal. Pela CLYON, o pedido chega a parceiros que recolhem entulho em todo o concelho, e recebe propostas ${PROPOSTAS_EM_ATE}. ${COMO_SE_RECOLHE_ENTULHO}`,
    accessNotes:
      "Na Costa da Caparica a carrinha encosta quase sempre à porta. Em Cacilhas e Almada Velha, com ruas estreitas e escadas, o entulho desce a saco e à mão — que é a forma de o tirar de onde nada de grande entra.",
    neighborhoodHighlight:
      "A Costa da Caparica é a zona com mais obras de renovação em Almada. Muitos apartamentos antigos estão a ser modernizados.",
    nearbyAreas: ["Seixal", "Lisboa", "Barreiro", "Setúbal"],
    faqs: [
      {
        q: "Quanto custa um contentor de entulho em Almada?",
        a: `${NAO_HA_CONTENTORES} A recolha, essa, conta-se ${ENTULHO_EM_FRASE}, com transporte e destino licenciado incluídos.`,
      },
      {
        q: "A CLYON deixa contentor de entulho na Costa da Caparica?",
        a: `Não. ${COMO_SE_RECOLHE_ENTULHO} Vai tudo na mesma ida: não fica nada à porta da obra a ocupar lugar nem a atrair despejos de outros.`,
      },
      {
        q: "Recolhem entulho aos sacos em Almada?",
        a: `Sim — em sacos de obra de ${PESO_DO_SACO}, que descem por qualquer escada: é o que funciona em prédios sem elevador. Se estiver solto, recolhe-se a granel.`,
      },
      {
        q: "Podem recolher entulho de uma obra ao sábado em Almada?",
        a: AO_FIM_DE_SEMANA,
      },
    ],
    ctaText: `Obra em Almada? Diga quantos sacos tem e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },

  // ---------------------------------------------------------------------------
  // 6. RECOLHA DE MÓVEIS EM CASCAIS
  // ---------------------------------------------------------------------------
  "recolha-moveis-cascais": {
    citySlug: "cascais",
    serviceSlug: "recolha-moveis",
    metaTitle: "Recolha de Móveis em Cascais - Estoril, Parede e Carcavelos | CLYON",
    h1: "Recolha de Móveis em Cascais e Estoril",
    localIntro:
      "Cascais tem características próprias: muitas moradias com jardim, apartamentos de gama alta no Estoril, e casas de férias em Carcavelos. Os móveis são frequentemente maiores e mais pesados do que a média. Diga no pedido o tipo de imóvel e os acessos: em condomínios fechados, a entrada combina-se com a portaria, e é isso que o parceiro prepara.",
    accessNotes:
      "Muitas moradias em Cascais têm acesso por escadas exteriores ou jardins que dificultam a passagem de móveis grandes. Em condomínios fechados, a entrada combina-se com o porteiro ou a administração.",
    neighborhoodHighlight:
      "O Estoril e São João do Estoril têm muitos apartamentos em renovação. Carcavelos tem casas de férias que são esvaziadas sazonalmente.",
    nearbyAreas: ["Oeiras", "Sintra", "Lisboa", "Estoril"],
    faqs: [
      {
        q: "Há recolha de móveis em Cascais?",
        a: "Sim. O pedido chega aos parceiros que trabalham em Cascais, Estoril, Parede, Carcavelos e São Domingos de Rana.",
      },
      {
        q: "Quanto custa recolher móveis de uma moradia em Cascais?",
        a: `Depende do volume. O esvaziamento de casa é ${PRECOS.esvaziamento_casa.etiqueta}, ${SEM_IVA_NA_FRASE} — uma moradia com sala, quartos e garagem fica na parte alta do intervalo, e o valor exato vem na proposta.`,
      },
      {
        q: "Recolhem móveis antigos e peças grandes em Cascais?",
        a: "Sim. Muitas casas em Cascais têm móveis antigos pesados — aparadores, cómodas, armários grandes. Diga no pedido quantas peças são e o acesso, para o parceiro vir preparado.",
      },
      {
        q: "Fazem recolha em condomínios fechados em Cascais?",
        a: "Sim. A entrada combina-se com a portaria ou a administração — deixe o contacto dela no pedido.",
      },
    ],
    ctaText: `Móveis para retirar em Cascais? Descreva o acesso e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },

  // ---------------------------------------------------------------------------
  // 7. RECOLHA DE MÓVEIS EM SINTRA
  // ---------------------------------------------------------------------------
  "recolha-moveis-sintra": {
    citySlug: "sintra",
    serviceSlug: "recolha-moveis",
    metaTitle: "Recolha de Móveis em Sintra - Mem Martins, Cacém e Rio de Mouro | CLYON",
    h1: "Recolha de Móveis em Sintra e Arredores",
    localIntro:
      "Sintra é um concelho grande com zonas muito diferentes: o centro histórico com ruas estreitas e empedradas, Mem Martins e Rio de Mouro com urbanizações de prédios, Cacém com uma mistura de ambos. Por isso o pedido deve dizer a zona e o acesso: no centro histórico de Sintra os acessos são complicados; em Mem Martins a maioria dos prédios tem elevador e o trabalho é mais simples.",
    accessNotes:
      "O centro histórico de Sintra tem ruas de paralelepípedo e inclinações fortes. Aqui o trabalho é mais demorado. Mem Martins, Cacém e Rio de Mouro têm acessos normais de urbanização.",
    neighborhoodHighlight:
      "Mem Martins e Cacém são as zonas com mais pedidos em Sintra. São bairros residenciais com muita rotação de inquilinos.",
    nearbyAreas: ["Amadora", "Cascais", "Oeiras"],
    faqs: [
      {
        q: "Há recolha de móveis no centro de Sintra?",
        a: "Sim, mas os acessos no centro histórico são complicados e pedem mais tempo e, às vezes, mais uma pessoa. Descreva a rua e o acesso no pedido para a proposta vir certa.",
      },
      {
        q: "Quanto custa recolher móveis em Mem Martins?",
        a: `Em Mem Martins, a maioria dos prédios tem elevador e bons acessos, o que simplifica o trabalho. O valor depende do volume e do conjunto de peças: descreva o pedido com fotos e recebe propostas ${PROPOSTAS_EM_ATE}.`,
      },
      {
        q: "Recolhem móveis de quintas em Sintra?",
        a: "Sim. Sintra tem muitas quintas com recheio para esvaziar. É um trabalho maior: descreva-o bem no pedido, com fotos, para as propostas virem certas.",
      },
      {
        q: "Fazem recolha de móveis no mesmo dia em Sintra?",
        a: NO_MESMO_DIA,
      },
    ],
    ctaText: `Móveis para retirar em Sintra? Diga a zona e o acesso e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },

  // ---------------------------------------------------------------------------
  // 8. RECOLHA DE MÓVEIS EM SETÚBAL
  // ---------------------------------------------------------------------------
  "recolha-moveis-setubal": {
    citySlug: "setubal",
    serviceSlug: "recolha-moveis",
    metaTitle: "Recolha de Móveis em Setúbal — Apartamentos, Quintas e Azeitão",
    h1: "Recolha de Móveis em Setúbal — Apartamentos, Moradias e Quintas",
    localIntro:
      "Precisa de retirar móveis em Setúbal? A CLYON tem parceiros de recolha de móveis usados em todo o concelho: centro histórico de Setúbal, Bairro Azul, Manteigadas, Avenida Luísa Todi, Azeitão e zona da Arrábida. Os parceiros retiram sofás, camas, armários, mesas, cadeiras e eletrodomésticos de apartamentos, moradias, lojas e escritórios. Em Azeitão, há parceiros com experiência no esvaziamento de quintas com móveis antigos e volumes grandes.",
    accessNotes:
      "O centro de Setúbal tem estacionamento limitado em algumas ruas da zona histórica. Azeitão tem quintas com acessos de terra batida — diga-o no pedido para vir contado na proposta. Nas urbanizações novas, os acessos são normalmente fáceis.",
    neighborhoodHighlight:
      "As zonas de Setúbal com mais pedidos de recolha são o Bairro Azul, Manteigadas e o centro. Azeitão destaca-se pelo esvaziamento de quintas e casas de família com muito recheio.",
    nearbyAreas: ["Palmela", "Sesimbra", "Seixal", "Barreiro"],
    faqs: [
      {
        q: "Há recolha de móveis em Setúbal?",
        // 30-09-2026: dizia que os preços eram «ligeiramente mais altos do que
        // na Margem Sul». Quem fixa o preço é o profissional, na proposta.
        a: "Sim. O pedido chega aos parceiros que trabalham no concelho de Setúbal, incluindo o centro, o Bairro Azul, as Manteigadas e Azeitão.",
      },
      {
        q: "Quanto custa recolher móveis em Setúbal?",
        a: `O valor depende do volume, acesso, piso e necessidade de desmontagem. Setúbal tem uma mistura de prédios antigos no centro e urbanizações mais recentes — o acesso entra na proposta. Descreva o pedido com fotos e recebe propostas ${PROPOSTAS_EM_ATE}.`,
      },
      {
        q: "Recolhem móveis em quintas de Azeitão?",
        a: "Sim. Azeitão tem muitas quintas com móveis antigos e volumes grandes. Algumas têm caminhos de terra ou escadas — diga-o no pedido para vir contado na proposta.",
      },
      {
        q: "Há recolha de móveis de lojas e escritórios em Setúbal?",
        a: "Sim. Os parceiros retiram mobiliário de lojas, escritórios, consultórios e espaços comerciais em Setúbal. Se precisar fora do horário laboral, diga-o no pedido — as propostas dizem quem o pode fazer.",
      },
      {
        q: "Fazem esvaziamento completo de casas em Setúbal?",
        a: "Sim. Pela CLYON pode pedir o esvaziamento de apartamentos e moradias completas em Setúbal: o parceiro leva móveis, eletrodomésticos, roupa e tralha. Ideal para heranças, mudanças e entrega de imóveis arrendados.",
      },
      {
        q: "Recolhem eletrodomésticos em Setúbal?",
        a: "Sim. Frigoríficos, máquinas de lavar, fogões, fornos, micro-ondas, arcas e TVs podem ir no mesmo pedido que os móveis.",
      },
      {
        q: "Podem recolher móveis no mesmo dia em Setúbal?",
        // 30-09-2026: dizia «Setúbal fica a cerca de 40 minutos da nossa base
        // no Seixal». Quem vai é um profissional da zona, não alguém do Seixal.
        a: NO_MESMO_DIA,
      },
      {
        q: "Em que zonas de Setúbal há mais pedidos de recolha?",
        a: "As zonas com mais pedidos são o centro de Setúbal, Bairro Azul, Manteigadas e Azeitão. São áreas com muitos apartamentos e quintas que precisam de esvaziamento.",
      },
    ],
    ctaText: `Móveis para retirar em Setúbal? Envie fotos pelo WhatsApp e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },

  // ---------------------------------------------------------------------------
  // 9.5. RECOLHA DE ENTULHO EM SETÚBAL (PÁGINA PRIORITÁRIA)
  // ---------------------------------------------------------------------------
  "recolha-entulho-setubal": {
    citySlug: "setubal",
    serviceSlug: "recolha-entulho",
    metaTitle: "Recolha de Entulho em Setúbal — Sacos de Obra de 25 a 30 kg",
    h1: "Recolha de Entulho em Setúbal — em Sacos, Sem Nada à Porta da Obra",
    localIntro:
      `Tem entulho de obra em Setúbal? ${COMO_SE_RECOLHE_ENTULHO} O pedido chega a parceiros de todo o concelho, do centro histórico a Azeitão e à Arrábida. ${NAO_HA_CONTENTORES} O entulho sai na mesma ida do parceiro: não fica nada à porta da obra.`,
    accessNotes:
      "No centro de Setúbal há ruas onde não se estaciona nada de grande nem por dez minutos — e é onde trabalhar a saco resolve, porque não é preciso licença de ocupação da via nem esperar por lugar. Em Azeitão e nas quintas, a carrinha encosta à porta.",
    neighborhoodHighlight:
      "As zonas com mais obras em Setúbal são o centro histórico (renovações de edifícios antigos), a Avenida Luísa Todi e as novas urbanizações. Azeitão tem muitas quintas em remodelação.",
    nearbyAreas: ["Palmela", "Sesimbra", "Seixal", "Barreiro"],
    faqs: [
      {
        q: "Quanto custa recolher entulho em Setúbal?",
        a: `A recolha de entulho conta-se ${ENTULHO_EM_FRASE}, em sacos de ${PESO_DO_SACO}. Diga a quantidade e o local e recebe propostas ${PROPOSTAS_EM_ATE}.`,
      },
      {
        q: "A CLYON fornece contentores para entulho em Setúbal?",
        a: RESPOSTA_SOBRE_CONTENTORES,
      },
      {
        q: "Em quanto tempo recolhem o entulho em Setúbal?",
        a: `${PROMESSA_DO_PRAZO} ${ACRESCIMO_POR_URGENCIA} Como não há contentor para entregar nem para ir buscar, é uma deslocação só.`,
      },
      {
        q: "Recolhem entulho de obras pequenas em Setúbal?",
        a: "Sim, e é onde isto funciona melhor: remodelações de casas de banho, cozinhas, substituição de pavimentos. Retiram-se os sacos e vai tudo de uma vez — sem aluguer, sem dias de espera e sem nada parado à porta.",
      },
      {
        q: "Que tipo de entulho se recolhe em Setúbal?",
        a: "Os parceiros recolhem restos de construção (tijolos, cimento, azulejos), sacos de obra, resíduos de remodelação, madeiras de demolição, gessos e materiais mistos. Amianto e resíduos perigosos não.",
      },
      {
        q: "Para onde vai o entulho recolhido em Setúbal?",
        // 30-09-2026: «Emitimos guia de transporte» — quem transporta é o
        // profissional, e é ele quem a pode emitir; a CLYON não o garante.
        a: "Para operadores de resíduos licenciados, com triagem e separação quando é preciso. Se precisar de guia de resíduos para a obra, indique-o no pedido: o parceiro diz na proposta se a emite.",
      },
      {
        q: "Recolhem entulho em locais com acesso difícil em Setúbal?",
        a: `Sim — é o que a recolha a saco permite. Cada saco leva ${PESO_DO_SACO} e desce à mão por escadas, corredores estreitos ou ruas onde não entra nada de grande. Diga o acesso no pedido: entra na proposta, e não há surpresas no dia.`,
      },
      {
        q: "Há recolha de entulho em Azeitão e na Arrábida?",
        a: "Sim. O pedido chega aos parceiros que trabalham no concelho de Setúbal, incluindo Azeitão e a Arrábida, e em Palmela. Há muitas quintas em remodelação com entulho para retirar.",
      },
    ],
    ctaText: `Entulho para retirar em Setúbal? Diga o volume e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },

  // ---------------------------------------------------------------------------
  // 10. ESVAZIAMENTO DE CASAS EM LISBOA
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // 11. MUDANÇAS EM LISBOA
  // ---------------------------------------------------------------------------
  "mudancas-lisboa": {
    citySlug: "lisboa",
    serviceSlug: "mudancas",
    metaTitle: "Mudanças em Lisboa - Residenciais e Comerciais | CLYON",
    h1: "Mudanças em Lisboa: Residenciais e Comerciais",
    localIntro:
      "Mudar de casa em Lisboa tem desafios próprios: apartamentos em prédios antigos sem elevador em Alfama, estacionamento difícil na Baixa, horários restritos em condomínios no Parque das Nações. Pela CLYON, descreve a mudança e recebe propostas de parceiros da zona: embalagem, proteção dos móveis, transporte e montagem na casa nova, conforme o que pedir. O parceiro pode tratar da licença de estacionamento (EMEL ou junta de freguesia); o custo vem discriminado na proposta.",
    accessNotes:
      "Em bairros históricos de Lisboa (Alfama, Mouraria, Bairro Alto), o estacionamento é o maior desafio: o parceiro pode tratar da licença para reservar lugar (EMEL ou junta de freguesia), com o custo discriminado na proposta. Em condomínios novos, o horário combina-se com a administração.",
    neighborhoodHighlight:
      "As zonas com mais mudanças em Lisboa são Benfica, Alvalade, Lumiar e Parque das Nações. São bairros residenciais com muita rotação de inquilinos e compradores.",
    nearbyAreas: ["Amadora", "Odivelas", "Loures", "Oeiras"],
    faqs: [
      {
        q: "Quanto custa uma mudança de T2 em Lisboa?",
        /*
         * As mudanças não publicam preço. Ver precos-publicos.ts: o site
         * anunciava 150 € e o motor factura a partir de 490 €, e enquanto os
         * dois não estiverem alinhados não se publica número nenhum.
         *
         * Esta resposta escapou à primeira passagem porque vive num ficheiro
         * de conteúdo e não numa página — mas é renderizada, e ia parar ao
         * texto visível E ao FAQPage que o Google lê.
         */
        a: `Depende do piso, do volume e da distância para a nova casa. Descreva a mudança e recebe propostas de parceiros ${PROPOSTAS_EM_ATE}, sem compromisso.`,
      },
      {
        q: "Há quem embale os meus pertences em Lisboa?",
        a: "Sim, se o pedir: o parceiro embala loiça, livros, roupa, quadros e objetos frágeis, com caixas, papel kraft, plástico bolha e fita. A embalagem vem discriminada na proposta.",
      },
      {
        q: "Fazem mudanças ao fim de semana em Lisboa?",
        a: AO_FIM_DE_SEMANA,
      },
      {
        q: "Montam os móveis na casa nova em Lisboa?",
        a: "Se o pedir, sim: o parceiro monta camas, roupeiros, secretárias e mesas no sítio certo. Indique-o no pedido para vir incluído na proposta.",
      },
      {
        q: "Fazem mudanças de escritórios em Lisboa?",
        a: "Sim. Mudanças de escritórios, lojas e consultórios em Lisboa. Se precisar fora do horário laboral, diga-o no pedido — as propostas dizem quem o pode fazer.",
      },
    ],
    ctaText: `Vai mudar de casa em Lisboa? Peça orçamento grátis e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },

  "esvaziamento-casas-lisboa": {
    citySlug: "lisboa",
    serviceSlug: "esvaziamento-casas",
    metaTitle: "Esvaziamento de Casas em Lisboa - Heranças e Arrendamentos | CLYON",
    h1: "Esvaziamento de Casas e Apartamentos em Lisboa",
    localIntro:
      "Esvaziar uma casa em Lisboa é um trabalho grande: há móveis para retirar, eletrodomésticos, roupa, papéis, tralha acumulada. Pela CLYON, pede o esvaziamento completo, da sala aos armários da cozinha, a parceiros da zona. Este serviço é muito procurado em casos de herança (o imóvel precisa de ser libertado para venda), fim de arrendamento (o inquilino deixou tudo) e mudanças (não vale a pena levar os móveis velhos).",
    accessNotes:
      "Em Lisboa, os esvaziamentos são frequentemente em prédios antigos sem elevador. O acesso faz grande diferença no custo, por isso diga-o no pedido: entra na proposta.",
    neighborhoodHighlight:
      "Os bairros com mais pedidos de esvaziamento em Lisboa são Benfica, Lumiar, Alvalade e o centro histórico. São zonas com muitos apartamentos antigos.",
    nearbyAreas: ["Amadora", "Odivelas", "Loures", "Oeiras"],
    faqs: [
      {
        q: "O que inclui o esvaziamento de casa em Lisboa?",
        a: "Os parceiros retiram tudo o que indicar: móveis, eletrodomésticos, roupa, livros, papéis, decoração, plantas, e deixam o espaço vazio. Se quiser que fique também varrido, diga-o no pedido.",
      },
      {
        q: "Quanto custa esvaziar um apartamento T2 em Lisboa?",
        a: `O esvaziamento de apartamento é ${PRECOS.esvaziamento_apartamento.etiqueta}, ${SEM_IVA_NA_FRASE}. Um T2 fica a meio do intervalo; depende do volume, do piso e do acesso.`,
      },
      {
        q: "Fazem esvaziamento de casas de herança em Lisboa?",
        a: "Sim, é dos pedidos mais frequentes. É uma situação delicada: diga no pedido o que quer guardar, e combine com o parceiro a entrega das chaves.",
      },
      {
        q: "E o que ainda pode ser doado?",
        // 30-09-2026: prometia que a CLYON encaminha para doação — não há nada
        // na plataforma que o faça. Quem recebe doações está na página própria.
        a: "Se quiser doar peças em bom estado, separe-as antes do esvaziamento: a página «Doar móveis usados em Lisboa» diz quem as recebe e em que condições. O resto, o parceiro leva para destino licenciado.",
      },
      {
        q: "Podem esvaziar só uma parte da casa em Lisboa?",
        a: "Sim. Indique no pedido o que fica e o que sai: a proposta conta só o volume que sai.",
      },
    ],
    ctaText: `Precisa de esvaziar uma casa em Lisboa? Envie fotos e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },

  // ---------------------------------------------------------------------------
  // MONTE ABRAÃO - NOVA CIDADE
  // ---------------------------------------------------------------------------
  "recolha-moveis-monte-abraao": {
    citySlug: "monte-abraao",
    serviceSlug: "recolha-moveis",
    metaTitle: "Recolha de Móveis em Monte Abraão - Queluz e Massamá | CLYON",
    h1: "Recolha de Móveis em Monte Abraão - Sofás, Camas e Armários",
    localIntro:
      `Precisa de retirar móveis em Monte Abraão? Pela CLYON, parceiros da zona recolhem sofás, camas, armários e eletrodomésticos em toda a freguesia e zonas vizinhas: Queluz, Massamá, Belas e Agualva-Cacém. O preço vem na proposta, conforme o volume, o acesso, a urgência e a necessidade de desmontagem — e recebe propostas ${PROPOSTAS_EM_ATE} depois de descrever o pedido.`,
    accessNotes:
      "Monte Abraão tem maioritariamente prédios com elevador, o que facilita a recolha. Nas zonas mais antigas próximas do centro de Queluz, alguns edifícios têm escadas estreitas — diga-o no pedido para vir na proposta.",
    neighborhoodHighlight:
      "Monte Abraão e Massamá são zonas residenciais com muitas famílias e apartamentos arrendados. Os pedidos mais frequentes são recolha de sofás, camas de casal e mobília de quarto durante mudanças.",
    nearbyAreas: ["Queluz", "Massamá", "Sintra", "Amadora"],
    faqs: [
      {
        q: "Há recolha de móveis em Monte Abraão?",
        a: "Sim. O pedido chega aos parceiros que trabalham em Monte Abraão, Queluz e Massamá — zona com bons acessos pelo IC19.",
      },
      {
        q: "Quanto custa recolher um sofá em Monte Abraão?",
        a: `O valor depende do piso, acesso e dimensões do sofá. A maioria dos prédios em Monte Abraão tem elevador, o que ajuda a manter o custo mais baixo. Descreva o sofá com fotos e recebe propostas ${PROPOSTAS_EM_ATE}.`,
      },
      {
        q: "Podem recolher móveis no mesmo dia em Monte Abraão?",
        a: NO_MESMO_DIA,
      },
      {
        q: "Recolhem também em Queluz e Massamá?",
        a: "Sim. O pedido chega aos parceiros que trabalham em Queluz, Massamá, Monte Abraão e Belas. Se tiver recolhas em várias moradas próximas, junte-as no mesmo pedido.",
      },
      {
        q: "Fazem esvaziamento de apartamentos em Monte Abraão?",
        a: "Sim, há esvaziamento completo de apartamentos para mudanças, heranças ou fim de arrendamento. Os parceiros retiram móveis, eletrodomésticos e tralha.",
      },
    ],
    ctaText: `Precisa de recolha de móveis em Monte Abraão? Envie fotos e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },

  // ---------------------------------------------------------------------------
  // MONTE ABRAÃO - RECOLHA DE ENTULHO
  // ---------------------------------------------------------------------------
  "recolha-entulho-monte-abraao": {
    citySlug: "monte-abraao",
    serviceSlug: "recolha-entulho",
    metaTitle: "Recolha de Entulho em Monte Abraão - Obras em Queluz e Massamá | CLYON",
    h1: "Recolha de Entulho de Obras em Monte Abraão",
    localIntro:
      `Monte Abraão e Massamá têm muitos apartamentos dos anos 80-90 que estão a ser renovados. Remodelações de casas de banho, cozinhas e demolição de divisórias geram entulho que precisa de ser retirado rapidamente para a obra avançar. ${COMO_SE_RECOLHE_ENTULHO} ${NAO_HA_CONTENTORES}`,
    accessNotes:
      `A maioria dos prédios em Monte Abraão tem elevador, mas o entulho é pesado e sujo. Trabalha-se com sacos resistentes de ${PESO_DO_SACO} — que cabem no elevador e não rebentam a meio — e protegem-se as zonas comuns durante o transporte.`,
    neighborhoodHighlight:
      "As zonas com mais obras de remodelação em Monte Abraão são os edifícios junto à estação de comboio e as urbanizações de Massamá Norte. São apartamentos familiares em processo de modernização.",
    nearbyAreas: ["Queluz", "Massamá", "Sintra", "Amadora"],
    faqs: [
      {
        q: "Há recolha de entulho de obras em Monte Abraão?",
        a: `Sim. Os parceiros recolhem entulho de remodelações em Monte Abraão, Queluz e Massamá. ${COMO_SE_RECOLHE_ENTULHO}`,
      },
      {
        q: "Podem recolher entulho de um apartamento em Monte Abraão?",
        a: "Sim. O parceiro sobe ao apartamento, ensaca o entulho se for preciso e leva-o até à carrinha, protegendo as zonas comuns do prédio.",
      },
      {
        q: "Quanto custa a recolha de entulho em Monte Abraão?",
        a: `O valor depende do volume de entulho, tipo de resíduos e facilidade de acesso. Descreva a obra com fotos e recebe propostas ${PROPOSTAS_EM_ATE}.`,
      },
      {
        q: "Fornecem contentor para obras em Monte Abraão?",
        a: RESPOSTA_SOBRE_CONTENTORES,
      },
    ],
    ctaText: "Obra em Monte Abraão? Envie fotos do entulho para orçamento grátis.",
  },

  // ---------------------------------------------------------------------------
  // QUELUZ
  // ---------------------------------------------------------------------------
  "recolha-moveis-queluz": {
    citySlug: "queluz",
    serviceSlug: "recolha-moveis",
    metaTitle: "Recolha de Móveis em Queluz - Belas e Monte Abraão | CLYON",
    h1: "Recolha de Móveis em Queluz - Sofás, Camas e Armários",
    localIntro:
      "Precisa de retirar móveis em Queluz? Pela CLYON, parceiros da zona recolhem sofás, camas, armários e eletrodomésticos em toda a zona: centro de Queluz, Belas, Monte Abraão e Massamá. Queluz tem uma mistura de zonas históricas (perto do Palácio) e urbanizações modernas, com acessos muito diferentes — por isso diga o seu no pedido.",
    accessNotes:
      "O centro histórico de Queluz tem algumas ruas mais estreitas e prédios antigos. As zonas mais recentes (Monte Abraão, Massamá Norte) têm excelentes acessos e elevadores. Diga o acesso no pedido para vir contado na proposta.",
    neighborhoodHighlight:
      "Queluz é uma freguesia grande com muitos apartamentos. Os pedidos mais frequentes vêm de mudanças, renovações de apartamentos arrendados e esvaziamentos de heranças.",
    nearbyAreas: ["Monte Abraão", "Massamá", "Sintra", "Amadora", "Belas"],
    faqs: [
      {
        q: "Há recolha de móveis em Queluz?",
        a: `Sim. O pedido chega aos parceiros que trabalham em Queluz, Belas e Monte Abraão, e recebe propostas ${PROPOSTAS_EM_ATE}.`,
      },
      {
        q: "Quanto custa recolher móveis em Queluz?",
        a: `O valor depende do acesso, piso e volume. Queluz tem uma mistura de edifícios antigos e modernos — o acesso entra na proposta. Descreva o pedido com fotos e recebe propostas ${PROPOSTAS_EM_ATE}.`,
      },
      {
        q: "Há recolha na zona do Palácio de Queluz?",
        a: "Sim, o pedido chega aos parceiros de toda a freguesia, incluindo a zona histórica junto ao Palácio. Aí os acessos são mais difíceis — diga-o no pedido para vir contado na proposta.",
      },
      {
        q: "Fazem recolha em Belas?",
        a: "Sim. Belas é uma zona com muitas moradias e condomínios, geralmente com bons acessos, e o pedido chega aos parceiros que lá trabalham.",
      },
      {
        q: "Recolhem eletrodomésticos junto com os móveis em Queluz?",
        a: "Sim. Frigoríficos, máquinas de lavar, fogões e TVs podem ir no mesmo pedido que os móveis — e costuma compensar juntar tudo.",
      },
    ],
    ctaText: "Precisa de recolha de móveis em Queluz? Envie fotos para orçamento grátis.",
  },

  // ---------------------------------------------------------------------------
  // CARNAXIDE
  // ---------------------------------------------------------------------------
  "recolha-moveis-carnaxide": {
    citySlug: "carnaxide",
    serviceSlug: "recolha-moveis",
    metaTitle: "Recolha de Móveis em Carnaxide - Linda-a-Velha e Queijas | CLYON",
    h1: "Recolha de Móveis em Carnaxide - Sofás, Camas e Armários",
    localIntro:
      "Precisa de retirar móveis em Carnaxide? Pela CLYON, parceiros da zona recolhem sofás, camas, armários e eletrodomésticos em toda a freguesia e zonas vizinhas: Linda-a-Velha, Queijas e Miraflores. Carnaxide é uma zona residencial moderna com bons acessos pelo IC19 e pela A5.",
    accessNotes:
      "Carnaxide tem maioritariamente prédios recentes com elevador e bons acessos. Algumas urbanizações fechadas requerem coordenação prévia para entrada — o acesso pode influenciar o orçamento e deve ser confirmado antes da marcação.",
    neighborhoodHighlight:
      "Carnaxide e Linda-a-Velha são zonas muito procuradas por famílias, com muitos apartamentos em condomínios modernos. Os pedidos mais frequentes são recolha de sofás, camas de casal e mobília de quarto durante mudanças ou renovações.",
    nearbyAreas: ["Oeiras", "Lisboa", "Amadora", "Algés"],
    faqs: [
      {
        q: "Há recolha de móveis em Carnaxide?",
        a: `Sim. O pedido chega aos parceiros que trabalham em Carnaxide, Linda-a-Velha e Queijas, e recebe propostas ${PROPOSTAS_EM_ATE}.`,
      },
      {
        q: "Quanto custa recolher um sofá em Carnaxide?",
        a: `O valor depende do piso, acesso e dimensões. A maioria dos prédios em Carnaxide tem elevador, o que facilita o trabalho. Descreva o sofá com fotos e recebe propostas ${PROPOSTAS_EM_ATE}.`,
      },
      {
        q: "Podem entrar em condomínios fechados em Carnaxide?",
        a: "Sim. Num condomínio fechado, a entrada combina-se com o parceiro — ou deixa o nome dele na portaria.",
      },
      {
        q: "Recolhem em Linda-a-Velha e Queijas?",
        a: "Sim. O pedido chega aos parceiros que trabalham em Linda-a-Velha, Queijas e no resto do concelho de Oeiras. Se tiver recolhas em várias moradas próximas, junte-as no mesmo pedido.",
      },
      {
        q: "Fazem esvaziamento de apartamentos em Carnaxide?",
        a: "Sim, há esvaziamento completo de apartamentos para mudanças, heranças ou fim de arrendamento. Os parceiros retiram móveis, eletrodomésticos e tralha, e deixam o espaço vazio.",
      },
    ],
    ctaText: `Precisa de recolha de móveis em Carnaxide? Envie fotos e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },

  // ---------------------------------------------------------------------------
  // d96 (23-11-2026): AS 15 PÁGINAS DE CIDADE QUE O GOOGLE PÔS DE LADO.
  //
  // Eram o texto genérico com o nome da terra trocado. Cada uma tem agora o
  // seu: as freguesias, o tipo de casa, o acesso, o serviço da câmara ou da
  // junta DESSA terra (das páginas oficiais, lidas a 23-11-2026) e uma
  // pergunta que só ali se faz. Preços só pelas constantes. Um teste mede a
  // semelhança entre quaisquer duas páginas (cidades-sem-texto-repetido-d96).
  // ---------------------------------------------------------------------------
  "recolha-monos-odivelas": {
    citySlug: "odivelas",
    serviceSlug: "recolha-monos",
    metaTitle: "Monos em Odivelas: Junta Grátis ou Parceiro em Casa",
    h1: "Recolha de Monos em Odivelas: pela junta ou de dentro de casa",
    localIntro:
      `Em Odivelas, a recolha de monos é das juntas de freguesia: a Câmara passou-lhes esse serviço, e cada uma tem o seu contacto. Os SIMAR também os recolhem, sem custo para os seus clientes, na data e no local combinados. Um parceiro da CLYON faz sentido quando o sofá ainda está lá em cima, quando não dá para esperar ou quando é preciso desmontar antes de descer. Descreve o pedido e recebe propostas ${PROPOSTAS_EM_ATE}.`,
    accessNotes:
      "Odivelas é terra de rampas. No centro, na Ramada e na Pontinha há prédios com a porta meio piso acima ou abaixo do passeio, e esses degraus contam tanto como os andares. Em Caneças e Famões há mais moradias, e a carrinha encosta melhor. No pedido diga o andar, se há elevador e quantos degraus separam a rua da entrada.",
    neighborhoodHighlight:
      "Os contactos das juntas estão na página da Câmara de Odivelas, por exemplo: Pontinha e Famões, 214 787 280; Póvoa de Santo Adrião e Olival Basto, 219 379 990; Ramada e Caneças, 210 529 834. Os SIMAR atendem pela linha gratuita 800 100 250.",
    nearbyAreas: ["Loures","Lumiar","Lisboa","Amadora"],
    faqs: [
      {
        q: "Em Odivelas, quem recolhe os monos: a Câmara ou a junta?",
        a: "A junta da sua zona: a Câmara de Odivelas diz que o serviço é das juntas. Se for cliente dos SIMAR, também pode pedir pelo 800 100 250. Nos dois casos os monos ficam no local e no dia combinados. Para os ir buscar dentro de casa, peça propostas a parceiros da CLYON.",
      },
      {
        q: "Quanto custa a recolha de monos em Odivelas com um parceiro?",
        a: `A recolha começa ${desdeSemEComIva(PRECOS.recolha_monos.minimo!)}, e cada peça conta pela tabela desta página. Os degraus à porta, o andar e a desmontagem entram na proposta, que recebe ${PROPOSTAS_EM_ATE}. Não paga nada adiantado.`,
      },
    ],
    ctaText: `Monos para tirar de casa em Odivelas? Envie fotografias e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },

  "recolha-monos-sesimbra": {
    citySlug: "sesimbra",
    serviceSlug: "recolha-monos",
    metaTitle: "Monos em Sesimbra: Câmara Grátis ou Parceiro em Casa",
    h1: "Recolha de Monos em Sesimbra e na Quinta do Conde",
    localIntro:
      `Sesimbra tem dois feitios. A vila desce até ao mar por ruas curtas e inclinadas, algumas só para peões. A Quinta do Conde é plana, de moradias e prédios baixos, com a carrinha à porta. A Câmara recolhe monos sem custo, no espaço público, até 1100 litros de cada vez. Quando o volume é maior, quando os móveis estão dentro de casa ou quando é preciso desmontar, pede a um parceiro da CLYON e recebe propostas ${PROPOSTAS_EM_ATE}.`,
    accessNotes:
      "Na vila, diga no pedido a rua e se a carrinha chega à porta: onde não chega, as peças vão a pé até onde ela pode parar, e isso conta no tempo. Na Quinta do Conde, na Lagoa de Albufeira e no Zambujal o acesso é simples; conte com a garagem e o quintal.",
    neighborhoodHighlight:
      "A recolha da Câmara pede-se na app Nós Sesimbra, pelo 21 228 85 82 ou no Balcão Único de Serviços. Para grandes quantidades a Câmara aluga contentores de 3 ou 7 m³. Também pode entregar os monos nos pontos REMOVE ou, sem custo, no Ecocentro de Sesimbra, da Amarsul, no Pinhal do Cabedal.",
    nearbyAreas: ["Seixal","Setúbal","Palmela","Almada"],
    faqs: [
      {
        q: "Quanto leva a recolha grátis de monos da Câmara de Sesimbra?",
        a: "Até 1100 litros de cada vez, deixados no espaço público no dia marcado, nunca na via pública antes disso nem junto aos contentores. Se tem um recheio inteiro, ou peças que ainda estão lá dentro, um parceiro da CLYON vai buscá-las a casa e leva tudo de uma vez.",
      },
      {
        q: "Quanto custa a recolha de monos em Sesimbra com um parceiro?",
        a: `Começa ${desdeSemEComIva(PRECOS.recolha_monos.minimo!)}, com cada peça pela tabela desta página. Na vila, a distância entre a porta e a carrinha pesa no tempo; diga-a no pedido para vir na proposta. Não paga nada adiantado.`,
      },
    ],
    ctaText: `Monos na vila ou na Quinta do Conde? Envie fotografias e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },

  "recolha-monos-montijo": {
    citySlug: "montijo",
    serviceSlug: "recolha-monos",
    metaTitle: "Monos no Montijo: Câmara Grátis ou Parceiro em Casa",
    h1: "Recolha de Monos no Montijo: pela Câmara, pela junta ou de casa",
    localIntro:
      `No Montijo, quem recolhe os monos depende da freguesia. Na União de Freguesias de Montijo e Afonsoeiro é a Câmara; em Atalaia e Alto Estanqueiro-Jardia, Sarilhos Grandes, Canha e Pegões é a junta. Em qualquer delas o serviço não tem custo. A recolha paga, por um parceiro da CLYON, serve para o que não pode esperar pela data e para o que está dentro de casa ou num andar sem elevador. Descreve o pedido e recebe propostas ${PROPOSTAS_EM_ATE}.`,
    accessNotes:
      "O centro tem ruas de comércio estreitas e prédios de três a quatro pisos, muitos sem elevador; o Afonsoeiro tem construção mais recente, com garagem. O concelho tem duas partes separadas, e Canha e Pegões ficam longe da cidade: diga a morada completa no pedido, para a proposta contar com a viagem.",
    neighborhoodHighlight:
      "Na União de Freguesias de Montijo e Afonsoeiro, a recolha marca-se com o Serviço de Higiene Urbana da Câmara, pelo 212 327 837, de segunda a sábado das 8h às 14h. Se preferir levar os monos, o Ecocentro do Montijo, da Amarsul, fica na Estrada do Seixalinho e recebe sem custo colchões, móveis e sofás.",
    nearbyAreas: ["Alcochete","Moita","Barreiro","Palmela"],
    faqs: [
      {
        q: "A quem peço a recolha de monos no Montijo?",
        a: "Se mora na União de Freguesias de Montijo e Afonsoeiro, à Câmara, pelo 212 327 837. Nas outras freguesias, à sua junta. A Câmara diz que estes serviços não têm qualquer custo. Para quem não pode pôr os móveis cá fora, um parceiro da CLYON vai buscá-los dentro de casa, na data que combinar com ele.",
      },
      {
        q: "Quanto custa a recolha de monos no Montijo com um parceiro?",
        a: `Começa ${desdeSemEComIva(PRECOS.recolha_monos.minimo!)}, e cada peça conta pela tabela desta página. O andar sem elevador, a desmontagem e a distância, em Canha ou Pegões, entram na proposta. Não paga nada adiantado.`,
      },
    ],
    ctaText: `Monos para tirar de casa no Montijo? Envie fotografias e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },

  "recolha-monos-carnaxide": {
    citySlug: "carnaxide",
    serviceSlug: "recolha-monos",
    metaTitle: "Monos em Carnaxide: Grátis até 1 m³ ou de Casa",
    h1: "Recolha de Monos em Carnaxide e Queijas",
    localIntro:
      `Carnaxide e Queijas são do concelho de Oeiras, e é a Câmara de Oeiras que recolhe os monos: por marcação antecipada, sem custo até 1 m³, e com orçamento quando é mais do que isso. A recolha faz-se nos dias de cada zona, que se sabem pelo Número Verde. Um parceiro da CLYON faz sentido quando o volume passa de 1 m³, quando os móveis estão lá dentro ou quando é preciso desmontar um roupeiro. Descreve o pedido e recebe propostas ${PROPOSTAS_EM_ATE}.`,
    accessNotes:
      "A freguesia mistura o núcleo antigo de Carnaxide, com ruas de sentido único onde a carrinha bloqueia o trânsito enquanto carrega, com urbanizações de garagem e elevador na Outurela, na Portela e em Queijas. Em condomínio fechado, diga no pedido se é preciso avisar a portaria ou reservar o elevador.",
    neighborhoodHighlight:
      "A marcação faz-se pelo Número Verde do Ambiente de Oeiras, 800 201 205 (chamada gratuita, de segunda a sexta das 9h às 17h30), ou por daqv@oeiras.pt. A Câmara pede o contacto prévio para os monos não ficarem vários dias na rua à espera.",
    nearbyAreas: ["Oeiras","Benfica","Amadora","Cascais"],
    faqs: [
      {
        q: "A recolha de monos em Carnaxide é grátis?",
        a: "Sim, até 1 m³: a Câmara de Oeiras recolhe sem custo, com marcação pelo 800 201 205. Acima disso faz uma avaliação e um orçamento. Para esses casos, ou para tirar as peças de dentro de casa, peça propostas a parceiros da CLYON.",
      },
      {
        q: "Quanto custa a recolha de monos em Carnaxide com um parceiro?",
        a: `Começa ${desdeSemEComIva(PRECOS.recolha_monos.minimo!)}, e cada peça conta pela tabela desta página. O elevador, a garagem e as regras do condomínio entram na proposta. Não paga nada adiantado.`,
      },
    ],
    ctaText: `Mais de 1 m³ de monos em Carnaxide? Envie fotografias e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },

  "recolha-monos-olivais": {
    citySlug: "olivais",
    serviceSlug: "recolha-monos",
    metaTitle: "Monos nos Olivais: Câmara Grátis ou Parceiro em Casa",
    h1: "Recolha de Monos nos Olivais",
    localIntro:
      `Os Olivais Norte e Sul foram planeados com espaço entre os blocos, e a carrinha chega quase sempre junto da porta. O Bairro da Encarnação é diferente: casas baixas, com quintal e ruas mais estreitas. A Câmara de Lisboa recolhe monos sem custo a quem pede em nome individual. Um parceiro da CLYON serve para o que tem de sair de dentro de casa, para o que não pode esperar pela marcação e para desmontar antes de descer. Descreve o pedido e recebe propostas ${PROPOSTAS_EM_ATE}.`,
    accessNotes:
      "Nos blocos altos há elevador, mas alguns são de cabina pequena, onde um sofá de três lugares não entra: diga no pedido as medidas da peça maior e o andar. Na Encarnação conte com o que está no quintal e no anexo. O estacionamento é largo e gratuito na maior parte da freguesia.",
    neighborhoodHighlight:
      "A recolha da Câmara pede-se na Na Minha Rua LX, pelo 800 910 211 (chamada gratuita) ou pelo 218 170 552. O Ecocentro do Lumiar, da Valorsul, é o mais perto e é público e gratuito; não recebe entulho de obras.",
    nearbyAreas: ["Alvalade","Lumiar","Loures","Lisboa"],
    faqs: [
      {
        q: "A Câmara de Lisboa recolhe monos de uma empresa ou de um senhorio com vários andares?",
        a: "A remoção gratuita de volumosos é só para pessoas em nome individual; empresas e associações recorrem a um coletor particular, diz a Câmara. Para esvaziar uma loja, um escritório ou vários apartamentos nos Olivais, peça propostas a parceiros da CLYON, com o preço fechado antes de começar.",
      },
      {
        q: "Quanto custa a recolha de monos nos Olivais com um parceiro?",
        a: `Começa ${desdeSemEComIva(PRECOS.recolha_monos.minimo!)}, e cada peça conta pela tabela desta página. O elevador pequeno, o andar e a desmontagem entram na proposta. Não paga nada adiantado.`,
      },
    ],
    ctaText: `Monos nos Olivais ou na Encarnação? Envie fotografias e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },

  "esvaziamento-casas-almada": {
    citySlug: "almada",
    serviceSlug: "esvaziamento-casas",
    metaTitle: "Esvaziamento de Casas em Almada e Cacilhas",
    h1: "Esvaziamento de Casas e Apartamentos em Almada",
    localIntro:
      `Em Almada, o mesmo T2 dá trabalhos muito diferentes. Em Almada velha e Cacilhas há muitos prédios anteriores aos anos 60, de escada única e sem elevador, sobre a arriba; no Pragal e no Feijó há elevador e garagem; na Charneca de Caparica e na Sobreda há moradias com anexo e quintal. Para heranças, vendas e fins de arrendamento, os parceiros retiram móveis, eletrodomésticos e o recheio miúdo, e deixam a casa vazia. Descreve a casa e recebe propostas ${PROPOSTAS_EM_ATE}.`,
    accessNotes:
      "Diga no pedido o andar, se há elevador e se há degraus entre a rua e a porta: em Cacilhas e em Almada velha é isso que decide quantas pessoas vão e quanto tempo leva. Na Costa da Caparica, entre junho e setembro, estacionar junto à praia é o maior obstáculo.",
    neighborhoodHighlight:
      "Se quiser tirar parte dos monos antes, as juntas de Almada recolhem-nos grátis à porta, por marcação na linha verde de cada uma (a de Almada, Cova da Piedade, Pragal e Cacilhas é o 800 100 304). O Ecocentro de Almada, da Amarsul, fica na Sobreda (Quinta da Matosa) e recebe colchões, móveis e sofás.",
    nearbyAreas: ["Seixal","Lisboa","Sesimbra","Barreiro"],
    faqs: [
      {
        q: "Posso levar parte do recheio ao Ecocentro de Almada?",
        a: "Pode. O Ecocentro de Almada, na Sobreda, recebe colchões, móveis e sofás; abre de segunda a sábado. A entrega nos ecocentros da Amarsul é gratuita para quem vive na área. Para uma casa inteira, um parceiro leva tudo numa só vez.",
      },
      {
        q: "Quanto custa esvaziar uma casa em Almada?",
        a: `A tabela de referência por tipologia está nesta página: um T2 ${faixaSemEComIva(T2.minimo, T2.maximo!)}. Em Almada velha, sem elevador, a proposta conta com mais tempo do que no Pragal. Não paga nada adiantado.`,
      },
    ],
    ctaText: `Uma casa para esvaziar em Almada? Envie fotografias de cada divisão e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },

  "esvaziamento-casas-seixal": {
    citySlug: "seixal",
    serviceSlug: "esvaziamento-casas",
    metaTitle: "Esvaziamento de Casas no Seixal, Amora e Corroios",
    h1: "Esvaziamento de Casas no Seixal, na Amora, em Corroios e Fernão Ferro",
    localIntro:
      `O concelho do Seixal tem dois tipos de casa. Na Amora, na Cruz de Pau e no Miratejo são prédios de vários andares; em Fernão Ferro, Santa Marta do Pinhal e Vale de Milhaços são moradias com garagem, arrecadação e quintal, onde o recheio de fora costuma ser tanto como o de dentro. Os parceiros esvaziam tudo: móveis, eletrodomésticos, caixas, ferramentas e o que está no anexo. Descreve a casa, fotografa também a garagem e recebe propostas ${PROPOSTAS_EM_ATE}.`,
    accessNotes:
      "Estacionar não é problema em quase todo o concelho, e nas moradias a carrinha encosta ao portão. O que pesa é o volume: diga no pedido se há garagem, sótão ou quintal com coisas, para a proposta não ficar curta no dia.",
    neighborhoodHighlight:
      "A Câmara do Seixal recolhe monos sem custo até 8 m³, com marcação pela Linha Seixal Limpo, 210 976 011, ou por seixal.limpo@cm-seixal.pt, num dia fixo por semana para cada freguesia. Também os pode entregar, sem custo, no Centro Municipal de Higiene Urbana de Fernão Ferro ou no Ecocentro de Vale de Milhaços.",
    nearbyAreas: ["Almada","Barreiro","Sesimbra","Lisboa"],
    faqs: [
      {
        q: "A Câmara do Seixal leva o recheio de uma casa?",
        a: "Leva os monos, até 8 m³ sem custo, no dia da sua freguesia e com marcação prévia. O recheio miúdo, como roupa, loiça, livros e caixas, não é mono, e os monos têm de estar cá fora no dia. Para esvaziar a casa inteira de uma vez, com o que está na garagem, um parceiro da CLYON faz o trabalho todo.",
      },
      {
        q: "Quanto custa esvaziar uma casa no Seixal?",
        a: `A tabela por tipologia está nesta página: um T2 ${faixaSemEComIva(T2.minimo, T2.maximo!)}, uma moradia completa ${desdeSemEComIva(MORADIA.minimo)}. A garagem e o quintal contam no volume. Não paga nada adiantado.`,
      },
    ],
    ctaText: `Uma casa ou moradia para esvaziar no Seixal? Envie fotografias e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },

  "esvaziamento-casas-oeiras": {
    citySlug: "oeiras",
    serviceSlug: "esvaziamento-casas",
    metaTitle: "Esvaziamento de Casas em Oeiras e Algés",
    h1: "Esvaziamento de Casas e Apartamentos em Oeiras",
    localIntro:
      `Em Oeiras, a encosta faz a diferença. Algés, Linda-a-Velha e a Cruz Quebrada têm prédios antigos em ruas inclinadas, onde a carrinha fica num plano diferente da porta; Oeiras, Paço de Arcos e Porto Salvo têm mais construção recente, com elevador e garagem. Quando a casa tem de ficar livre para uma venda ou uma partilha, o parceiro escolhido leva tudo, do sofá à última caixa de loiça. Descreve a casa e recebe propostas ${PROPOSTAS_EM_ATE}.`,
    accessNotes:
      "Junto à marginal e às estações de Algés, Paço de Arcos e Oeiras, estacionar é sempre disputado; nas ruas acima da linha resolve-se. Diga no pedido se a casa fica num desses troços e se há elevador, para o parceiro vir com as pessoas certas.",
    neighborhoodHighlight:
      "A Câmara de Oeiras recolhe resíduos volumosos por marcação prévia, pelo Número Verde 800 201 205 ou por daqv@oeiras.pt. É gratuito até 1 m³; acima disso o serviço é avaliado e orçamentado. Os dias de recolha de cada zona dizem-se pelo mesmo número.",
    nearbyAreas: ["Carnaxide","Cascais","Amadora","Lisboa"],
    faqs: [
      {
        q: "A Câmara de Oeiras leva os móveis de uma casa inteira?",
        a: "Sem custo, só até 1 m³; acima disso a Câmara faz uma avaliação e um orçamento, e os volumosos ficam na via pública no dia marcado. Uma casa inteira passa quase sempre desse volume, e o recheio miúdo não conta como volumoso. Para tudo de uma vez, de dentro de casa, um parceiro da CLYON faz o esvaziamento completo.",
      },
      {
        q: "Quanto custa esvaziar uma casa em Oeiras?",
        a: `A tabela por tipologia está nesta página: um T0/T1 ${faixaSemEComIva(T0T1.minimo, T0T1.maximo!)}, um T2 ${faixaSemEComIva(T2.minimo, T2.maximo!)}. A rua inclinada e a falta de elevador entram na proposta. Não paga nada adiantado.`,
      },
    ],
    ctaText: `Uma casa para esvaziar em Oeiras? Envie fotografias de cada divisão e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },

  "esvaziamento-casas-barreiro": {
    citySlug: "barreiro",
    serviceSlug: "esvaziamento-casas",
    metaTitle: "Esvaziamento de Casas no Barreiro e no Lavradio",
    h1: "Esvaziamento de Casas no Barreiro",
    localIntro:
      `No Barreiro velho e nos bairros operários que cresceram à volta das fábricas, muitas casas são de dois pisos, com porta estreita e escada de um lanço, onde um roupeiro só sai desmontado. No Alto do Seixalinho, em Santo André e na Verderena os prédios são mais recentes e têm elevador. O parceiro tira os móveis, os eletrodomésticos e o que está nos armários, e a casa fica pronta para a escritura ou para a entrega das chaves. As propostas chegam ${PROPOSTAS_EM_ATE}.`,
    accessNotes:
      "No centro antigo as ruas mal dão para dois carros se cruzarem, e a carrinha pode ter de ficar mais longe: diga a rua no pedido. Em Santo António da Charneca e em Palhais há mais moradias, com espaço à porta.",
    neighborhoodHighlight:
      "A Câmara do Barreiro recolhe monos sem custo: liga-se para o 212 068 068 e combina-se a recolha. Também se podem entregar no Ecocentro do Barreiro, da Amarsul, no Lavradio (Rua Mártires da Guerra Colonial), que recebe colchões, móveis e sofás sem custo.",
    nearbyAreas: ["Moita","Seixal","Montijo","Almada"],
    faqs: [
      {
        q: "No Barreiro, a recolha de monos da Câmara chega para esvaziar uma casa?",
        a: "Para os móveis grandes pode chegar: o serviço é gratuito e combina-se pelo 212 068 068. Mas o recheio miúdo fica de fora, e é preciso pôr tudo no local combinado. Quando a casa tem de ficar vazia para uma escritura ou uma entrega de chaves, um parceiro da CLYON retira tudo de uma vez, de dentro de casa.",
      },
      {
        q: "Quanto custa esvaziar uma casa no Barreiro?",
        a: `A tabela por tipologia está nesta página: um T0/T1 ${faixaSemEComIva(T0T1.minimo, T0T1.maximo!)}, um T2 ${faixaSemEComIva(T2.minimo, T2.maximo!)}. A escada estreita e a desmontagem entram na proposta. Não paga nada adiantado.`,
      },
    ],
    ctaText: `Uma casa para esvaziar no Barreiro? Envie fotografias e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },

  "esvaziamento-casas-queluz": {
    citySlug: "queluz",
    serviceSlug: "esvaziamento-casas",
    metaTitle: "Esvaziamento de Casas em Queluz, Belas e Massamá",
    h1: "Esvaziamento de Casas em Queluz e Belas",
    localIntro:
      `Queluz tem o centro antigo à volta do Palácio, com ruas estreitas e trânsito condicionado, e à volta urbanizações de prédios com elevador, no Pendão, em Belas e em Massamá. São casas em que se junta muito ao longo dos anos: arrecadação na cave, marquise cheia, roupeiros embutidos. Os parceiros levam tudo isso, com os móveis e os eletrodomésticos, até a casa ficar vazia. Descreve o que há e recebe propostas ${PROPOSTAS_EM_ATE}.`,
    accessNotes:
      "Junto ao Palácio e à estação estacionar é difícil; no resto da zona resolve-se. Se há arrecadação na cave ou no sótão do prédio, diga-o no pedido e fotografe-a: é o que mais vezes fica de fora da descrição e aparece no dia.",
    neighborhoodHighlight:
      "Antes do esvaziamento, os eletrodomésticos grandes podem sair sem custo: desde março de 2025 o Electrão e o Município de Sintra recolhem-nos porta a porta em todas as freguesias do concelho, Queluz e Belas incluída, a pedido à junta ou aos SMAS de Sintra.",
    nearbyAreas: ["Monte Abraão","Amadora","Sintra","Benfica"],
    faqs: [
      {
        q: "O que faço ao frigorífico e à máquina de lavar antes de esvaziar a casa?",
        a: "Em Queluz e Belas há recolha gratuita porta a porta de eletrodomésticos grandes, do Electrão com o Município de Sintra: pede-se à junta ou aos SMAS de Sintra. Se preferir que saia tudo na mesma viagem, o parceiro que esvazia a casa leva também os eletrodomésticos, e encaminha-os para o circuito dos resíduos elétricos.",
      },
      {
        q: "Quanto custa esvaziar uma casa em Queluz?",
        a: `A tabela por tipologia está nesta página: um T0/T1 ${faixaSemEComIva(T0T1.minimo, T0T1.maximo!)}, um T2 ${faixaSemEComIva(T2.minimo, T2.maximo!)}. A arrecadação e a marquise contam no volume. Não paga nada adiantado.`,
      },
    ],
    ctaText: `Uma casa para esvaziar em Queluz ou Belas? Envie fotografias e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },

  "esvaziamento-casas-monte-abraao": {
    citySlug: "monte-abraao",
    serviceSlug: "esvaziamento-casas",
    metaTitle: "Esvaziamento de Casas em Monte Abraão e Massamá",
    h1: "Esvaziamento de Apartamentos em Monte Abraão e Massamá",
    localIntro:
      `Monte Abraão e Massamá cresceram em blocos altos, construídos em conjunto, quase todos com elevador. O que complica um esvaziamento aqui não é a escada: são os acessos entre blocos, muitas vezes só para peões, que obrigam a levar tudo a pé até onde a carrinha pode parar. Os parceiros fazem esse percurso as vezes que forem precisas e deixam o apartamento vazio, com móveis, eletrodomésticos e recheio. Descreve a casa e recebe propostas ${PROPOSTAS_EM_ATE}.`,
    accessNotes:
      "Diga no pedido a distância aproximada entre a porta do prédio e o sítio onde a carrinha pode parar, e se o elevador leva um sofá. Nas avenidas principais há onde parar; nas ruas interiores os lugares são dos residentes.",
    neighborhoodHighlight:
      "A União das Freguesias de Massamá e Monte Abraão recolhe monos sem custo: marca-se na plataforma O Meu Bairro, em «Ambiente, Higiene, Limpeza Urbana» e depois «Remoção de Monos». A união diz que já recolheu mais de 330 toneladas de monos deixados na rua desde 2019. O contacto geral é o 210 133 550.",
    nearbyAreas: ["Queluz","Sintra","Amadora","Oeiras"],
    faqs: [
      {
        q: "Como marco a recolha grátis de monos em Monte Abraão?",
        a: "Na plataforma O Meu Bairro: escolha o tipo «Ambiente, Higiene, Limpeza Urbana» e o subtipo «Remoção de Monos». É um serviço da União das Freguesias de Massamá e Monte Abraão, para os monos que deixa no local combinado. Se o apartamento tem de ficar vazio de uma vez, com o recheio todo, um parceiro da CLYON trata disso.",
      },
      {
        q: "Quanto custa esvaziar um apartamento em Monte Abraão?",
        a: `A tabela por tipologia está nesta página: um T0/T1 ${faixaSemEComIva(T0T1.minimo, T0T1.maximo!)}, um T2 ${faixaSemEComIva(T2.minimo, T2.maximo!)}. O percurso a pé entre o prédio e a carrinha entra na proposta. Não paga nada adiantado.`,
      },
    ],
    ctaText: `Um apartamento para esvaziar em Monte Abraão? Envie fotografias e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },

  "esvaziamento-casas-alcochete": {
    citySlug: "alcochete",
    serviceSlug: "esvaziamento-casas",
    metaTitle: "Esvaziamento de Casas em Alcochete e no Samouco",
    h1: "Esvaziamento de Casas e Moradias em Alcochete",
    localIntro:
      `Alcochete é vila de casas baixas, e quase todas se alcançam de carrinha até à porta. No Samouco e em São Francisco há mais moradias com quintal e anexo, onde o recheio de fora pesa tanto como o de dentro. A zona ribeirinha tem ruas mais estreitas e pavimento irregular. O parceiro escolhido esvazia a casa e o exterior, e deixa-a pronta para vender ou arrendar. Descreve o que há e recebe propostas ${PROPOSTAS_EM_ATE}.`,
    accessNotes:
      "Fora do Verão, estacionar é simples; nos meses quentes a frente ribeirinha enche. Se a casa tem anexo, garagem ou quintal com coisas, fotografe-os e diga-o no pedido.",
    neighborhoodHighlight:
      "A Câmara de Alcochete recolhe monos sem custo, por marcação no 212 348 671 ou por dahuev@cm-alcochete.pt, nos dias úteis das 9h às 12h30 e das 14h às 17h30. Também se podem entregar sem custo no Ecocentro de Alcochete, no Caminho Municipal 1004 (Pinheiro Marco Batel), aberto nos dias úteis das 9h às 19h.",
    nearbyAreas: ["Montijo","Moita","Palmela","Barreiro"],
    faqs: [
      {
        q: "Posso levar móveis de uma casa em Alcochete ao ecocentro?",
        a: "Pode: o Ecocentro de Alcochete recebe-os sem custo, nos dias úteis das 9h às 19h (linha gratuita da Amarsul, 800 911 400). Precisa de carro ou carrinha para lá chegar. Se não tem como os levar, ou se a casa tem de ficar vazia de uma vez, um parceiro da CLYON retira tudo de dentro de casa.",
      },
      {
        q: "Quanto custa esvaziar uma casa em Alcochete?",
        a: `A tabela por tipologia está nesta página: um T2 ${faixaSemEComIva(T2.minimo, T2.maximo!)}, uma moradia completa ${desdeSemEComIva(MORADIA.minimo)}. O anexo e o quintal contam no volume. Não paga nada adiantado.`,
      },
    ],
    ctaText: `Uma casa para esvaziar em Alcochete? Envie fotografias e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },

  "esvaziamento-casas-carnaxide": {
    citySlug: "carnaxide",
    serviceSlug: "esvaziamento-casas",
    metaTitle: "Esvaziamento de Casas em Carnaxide e Queijas",
    h1: "Esvaziamento de Casas em Carnaxide e Queijas",
    localIntro:
      `Em Carnaxide e Queijas, a maior parte das casas está em urbanizações com elevador, garagem e, muitas vezes, condomínio com regras próprias para mudanças e cargas. No núcleo antigo de Carnaxide há ruas de sentido único, onde a carrinha bloqueia o trânsito enquanto carrega. Com as regras do condomínio no pedido, o parceiro esvazia o apartamento de uma vez: móveis, eletrodomésticos e o que está nos armários. As propostas chegam ${PROPOSTAS_EM_ATE}.`,
    accessNotes:
      "Antes de marcar, pergunte à administração do condomínio se há horário para cargas, se o elevador tem de ser protegido e onde a carrinha pode parar. Ao fim do dia, as ruas junto aos centros comerciais ficam cheias.",
    neighborhoodHighlight:
      "Carnaxide e Queijas são do concelho de Oeiras: a Câmara recolhe volumosos por marcação pelo 800 201 205 ou por daqv@oeiras.pt, sem custo até 1 m³ e com orçamento acima disso, nos dias de recolha de cada zona.",
    nearbyAreas: ["Oeiras","Benfica","Amadora","Lisboa"],
    faqs: [
      {
        q: "O condomínio pode impedir um esvaziamento em Carnaxide?",
        a: "Pode impor regras: horário para usar o elevador, protecção das paredes e do chão, sítio para a carrinha parar. Pergunte à administração antes de marcar e escreva essas regras no pedido. Assim entram na proposta do parceiro, e o dia corre sem discussões à porta.",
      },
      {
        q: "Quanto custa esvaziar uma casa em Carnaxide?",
        a: `A tabela por tipologia está nesta página: um T0/T1 ${faixaSemEComIva(T0T1.minimo, T0T1.maximo!)}, um T2 ${faixaSemEComIva(T2.minimo, T2.maximo!)}. As regras do condomínio e a protecção do elevador entram na proposta. Não paga nada adiantado.`,
      },
    ],
    ctaText: `Um apartamento para esvaziar em Carnaxide? Envie fotografias e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },

  "esvaziamento-casas-olivais": {
    citySlug: "olivais",
    serviceSlug: "esvaziamento-casas",
    metaTitle: "Esvaziamento de Casas nos Olivais e na Encarnação",
    h1: "Esvaziamento de Casas nos Olivais",
    localIntro:
      `Nos Olivais Norte e Sul, os blocos têm espaço à volta e a carrinha encosta quase à porta, o que em Lisboa é raro; alguns elevadores, porém, são de cabina pequena. No Bairro da Encarnação as casas são baixas, com quintal e anexo. Os parceiros retiram tudo, do roupeiro aos sacos de roupa, e deixam a casa pronta para entregar. Descreve a casa e recebe propostas ${PROPOSTAS_EM_ATE}.`,
    accessNotes:
      "Estacionar é largo e gratuito na maior parte da freguesia. Diga no pedido o andar e as medidas da peça maior, para se saber se desce no elevador ou pela escada.",
    neighborhoodHighlight:
      "A Câmara de Lisboa recolhe volumosos sem custo a quem pede em nome individual, na Na Minha Rua LX ou pelo 800 910 211. Empresas e associações têm de recorrer a um coletor particular. O Ecocentro do Lumiar, da Valorsul, é público e gratuito.",
    nearbyAreas: ["Alvalade","Lumiar","Loures","Lisboa"],
    faqs: [
      {
        q: "Uma imobiliária pode pedir à Câmara para levar o recheio de uma casa nos Olivais?",
        a: "Não: a remoção gratuita de volumosos da Câmara de Lisboa é só para pessoas em nome individual, e as empresas têm de recorrer a um coletor particular. Uma imobiliária, um senhorio com empresa ou um gestor de alojamento local pode pedir propostas a parceiros da CLYON, com o preço fechado antes de começar.",
      },
      {
        q: "Quanto custa esvaziar uma casa nos Olivais?",
        a: `A tabela por tipologia está nesta página: um T0/T1 ${faixaSemEComIva(T0T1.minimo, T0T1.maximo!)}, um T2 ${faixaSemEComIva(T2.minimo, T2.maximo!)}. O elevador pequeno e o anexo da Encarnação entram na proposta. Não paga nada adiantado.`,
      },
    ],
    ctaText: `Uma casa para esvaziar nos Olivais? Envie fotografias e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },

  "recolha-entulho-loures": {
    citySlug: "loures",
    serviceSlug: "recolha-entulho",
    metaTitle: "Recolha de Entulho em Loures: SIMAR ou a Saco",
    h1: "Recolha de Entulho em Loures, Sacavém e Santo António dos Cavaleiros",
    localIntro:
      `Em Loures, o entulho de uma pequena obra feita pelo próprio pode ir pelos SIMAR: o serviço é gratuito para os clientes, até 1 m³ por obra, e só aceita alguns materiais. Quando a obra é maior, quando há madeira, louças ou outros restos misturados, ou quando o entulho está lá em cima e não pode esperar uma semana, um parceiro da CLYON recolhe-o em sacos de obra de ${PESO_DO_SACO} ou a granel. Descreve o pedido e recebe propostas ${PROPOSTAS_EM_ATE}.`,
    accessNotes:
      "Santo António dos Cavaleiros são torres com elevador, onde os sacos descem bem; no centro de Loures e na Bobadela há casas antigas de dois pisos com escada interior estreita. Diga o andar e se o entulho já está ensacado.",
    neighborhoodHighlight:
      "Os SIMAR aceitam betão, tijolo, ladrilho, telha, cerâmica, pladur, fios eléctricos e plásticos, de obras isentas de licença. Pede-se pelo formulário no site, por geral@simar-louresodivelas.pt ou pelo 219 848 500; entregam o saco no dia combinado e levam-no uma semana depois. A Valorsul não tem ecocentro no concelho, e o do Lumiar não recebe entulho.",
    nearbyAreas: ["Odivelas","Lumiar","Olivais","Lisboa"],
    faqs: [
      {
        q: "Os SIMAR recolhem o entulho da minha obra em Loures?",
        a: "Se for cliente dos SIMAR, a obra estiver isenta de licença e o entulho não passar de 1 m³, sim, sem custo, e só com os materiais da lista deles. Fora disso, ou com pressa, um parceiro da CLYON recolhe-o em sacos ou a granel. A CLYON não fornece contentores.",
      },
      {
        q: "Quanto custa a recolha de entulho em Loures com um parceiro?",
        a: `${ENTULHO_10_SACOS_NA_FRASE}, e conta-se saco a saco a partir daí. O andar e a escada entram na proposta. Não paga nada adiantado.`,
      },
    ],
    ctaText: `Entulho de obras em Loures? Diga quantos sacos são e receba propostas ${PROPOSTAS_EM_ATE}.`,
  },
};

// =============================================================================
// CONTEÚDO BASE POR CIDADE (para páginas não prioritárias)
// =============================================================================

export interface CityBaseContent {
  slug: string;
  name: string;
  region: "lisboa" | "margem-sul" | "setubal";
  localIntro: string;
  landmarks: string[];
  accessNotes: string;
  nearbyAreas: string[];
}

export const CITY_BASE_CONTENT: Record<string, CityBaseContent> = {
  lisboa: {
    slug: "lisboa",
    name: "Lisboa",
    region: "lisboa",
    localIntro: "Em Lisboa, o pedido chega a parceiros que trabalham em todas as freguesias, do centro histórico às zonas mais recentes como o Parque das Nações.",
    landmarks: ["Baixa-Chiado", "Alfama", "Parque das Nações", "Benfica", "Campo de Ourique", "Areeiro"],
    accessNotes: "Nos bairros históricos (Alfama, Mouraria, Graça), os acessos são frequentemente por escadas estreitas.",
    nearbyAreas: ["Amadora", "Odivelas", "Loures", "Oeiras"],
  },
  almada: {
    slug: "almada",
    name: "Almada",
    region: "margem-sul",
    localIntro: "Em Almada, o pedido chega a parceiros que trabalham da Costa da Caparica ao Pragal e a Cacilhas.",
    landmarks: ["Costa da Caparica", "Cacilhas", "Pragal", "Feijó", "Cova da Piedade", "Almada Velha"],
    accessNotes: "O centro de Almada e Cacilhas têm ruas mais estreitas. A Costa da Caparica tem bons acessos.",
    nearbyAreas: ["Seixal", "Lisboa", "Setúbal"],
  },
  seixal: {
    slug: "seixal",
    name: "Seixal",
    region: "margem-sul",
    localIntro: "No Seixal, o pedido chega a parceiros que trabalham em todo o concelho, de Amora e Corroios a Fernão Ferro.",
    landmarks: ["Amora", "Corroios", "Arrentela", "Paio Pires", "Fernão Ferro", "Cruz de Pau"],
    accessNotes: "O Seixal tem zonas urbanas com bons acessos e zonas mais rurais com moradias.",
    nearbyAreas: ["Almada", "Barreiro", "Sesimbra", "Setúbal"],
  },
  cascais: {
    slug: "cascais",
    name: "Cascais",
    region: "lisboa",
    localIntro: "Em Cascais, o pedido chega a parceiros que trabalham da linha de costa ao interior do concelho, incluindo Estoril, Parede e Carcavelos.",
    landmarks: ["Centro de Cascais", "Estoril", "Parede", "Carcavelos", "São Domingos de Rana", "Alcabideche"],
    accessNotes: "As zonas residenciais de Cascais têm geralmente bons acessos. Condomínios fechados requerem coordenação.",
    nearbyAreas: ["Oeiras", "Sintra", "Lisboa"],
  },
  sintra: {
    slug: "sintra",
    name: "Sintra",
    region: "lisboa",
    localIntro: "Em Sintra, o pedido chega a parceiros que trabalham da zona histórica às urbanizações de Mem Martins, Rio de Mouro e Cacém.",
    landmarks: ["Centro histórico de Sintra", "Mem Martins", "Rio de Mouro", "Cacém", "Queluz", "Agualva"],
    accessNotes: "Na serra de Sintra e centro histórico, os acessos podem ser desafiantes. As zonas urbanas têm bons acessos.",
    nearbyAreas: ["Amadora", "Cascais", "Oeiras"],
  },
  setubal: {
    slug: "setubal",
    name: "Setúbal",
    region: "setubal",
    localIntro: "Em Setúbal, o pedido chega a parceiros que trabalham em toda a cidade e arredores, da Avenida Luísa Todi a Azeitão.",
    landmarks: ["Centro histórico", "Avenida Luísa Todi", "Bairro Azul", "Manteigadas", "Arrábida", "Azeitão"],
    accessNotes: "O centro de Setúbal tem zonas com estacionamento limitado. Azeitão tem quintas com acessos variados.",
    nearbyAreas: ["Palmela", "Sesimbra", "Seixal", "Barreiro"],
  },
  oeiras: {
    slug: "oeiras",
    name: "Oeiras",
    region: "lisboa",
    localIntro: "Em Oeiras, o pedido chega a parceiros que trabalham em todas as freguesias, de Algés e Carnaxide a Linda-a-Velha e Paço de Arcos.",
    landmarks: ["Algés", "Carnaxide", "Linda-a-Velha", "Paço de Arcos", "Taguspark", "Porto Salvo"],
    accessNotes: "Oeiras tem excelentes acessos rodoviários. As zonas empresariais facilitam operações de maior escala.",
    nearbyAreas: ["Lisboa", "Amadora", "Cascais", "Sintra"],
  },
  carnaxide: {
    slug: "carnaxide",
    name: "Carnaxide",
    region: "lisboa",
    localIntro: "Em Carnaxide, o pedido chega a parceiros de toda a freguesia, incluindo Linda-a-Velha, Queijas e as zonas residenciais junto ao IC19. Carnaxide combina urbanizações modernas com condomínios fechados e prédios tradicionais.",
    landmarks: ["Centro de Carnaxide", "Linda-a-Velha", "Queijas", "Outurela", "Fórum Oeiras", "Estádio de Oeiras"],
    accessNotes: "Carnaxide tem excelentes acessos pelo IC19 e A5. A maioria dos prédios são recentes e têm elevador. Algumas urbanizações fechadas requerem coordenação prévia para entrada.",
    nearbyAreas: ["Oeiras", "Lisboa", "Amadora", "Algés"],
  },
  amadora: {
    slug: "amadora",
    name: "Amadora",
    region: "lisboa",
    localIntro: "Na Amadora, o pedido chega a parceiros que trabalham em todas as freguesias, da Reboleira a Alfragide e à Damaia.",
    landmarks: ["Alfragide", "Reboleira", "Damaia", "Brandoa", "Venda Nova", "Mina de Água"],
    accessNotes: "A maioria dos prédios na Amadora tem elevador ou acessos razoáveis.",
    nearbyAreas: ["Lisboa", "Sintra", "Odivelas", "Oeiras"],
  },
  barreiro: {
    slug: "barreiro",
    name: "Barreiro",
    region: "margem-sul",
    localIntro: "No Barreiro, o pedido chega a parceiros que trabalham em todo o concelho, da zona ribeirinha ao Alto do Seixalinho e à Verderena.",
    landmarks: ["Centro do Barreiro", "Alto do Seixalinho", "Verderena", "Lavradio", "Santo António da Charneca", "Coina"],
    accessNotes: "O Barreiro tem uma mistura de zonas industriais reconvertidas e áreas residenciais.",
    nearbyAreas: ["Seixal", "Moita", "Montijo", "Setúbal"],
  },
  palmela: {
    slug: "palmela",
    name: "Palmela",
    region: "setubal",
    localIntro: "Em Palmela, o pedido chega a parceiros que trabalham em todo o concelho, incluindo Pinhal Novo, Quinta do Anjo e a zona histórica.",
    landmarks: ["Centro de Palmela", "Pinhal Novo", "Quinta do Anjo", "Poceirão", "Marateca", "Águas de Moura"],
    accessNotes: "Pinhal Novo tem excelentes acessos. A zona histórica de Palmela tem ruas mais estreitas.",
    nearbyAreas: ["Setúbal", "Seixal", "Montijo", "Sesimbra"],
  },
  sesimbra: {
    slug: "sesimbra",
    name: "Sesimbra",
    region: "setubal",
    localIntro: "Em Sesimbra, o pedido chega a parceiros que trabalham da vila piscatória às praias e à Quinta do Conde.",
    landmarks: ["Centro de Sesimbra", "Praia da Califórnia", "Lagoa de Albufeira", "Aldeia do Meco", "Quinta do Conde"],
    accessNotes: "O centro de Sesimbra tem ruas estreitas. Quinta do Conde tem urbanizações com bons acessos.",
    nearbyAreas: ["Seixal", "Setúbal", "Almada", "Palmela"],
  },
  loures: {
    slug: "loures",
    name: "Loures",
    region: "lisboa",
    localIntro: "Em Loures, o pedido chega a parceiros que trabalham de Sacavém e Moscavide às zonas mais rurais, como Lousa e Bucelas.",
    landmarks: ["Sacavém", "Moscavide", "Portela", "Camarate", "Santo António dos Cavaleiros", "Bobadela"],
    accessNotes: "As zonas urbanas de Loures têm bons acessos. Algumas freguesias rurais têm estradas mais estreitas.",
    nearbyAreas: ["Lisboa", "Odivelas"],
  },
  odivelas: {
    slug: "odivelas",
    name: "Odivelas",
    region: "lisboa",
    localIntro: "Em Odivelas, o pedido chega a parceiros que trabalham em todo o concelho, incluindo Ramada, Pontinha, Caneças e Famões.",
    landmarks: ["Centro de Odivelas", "Ramada", "Pontinha", "Caneças", "Famões", "Olival Basto"],
    accessNotes: "Odivelas tem uma mistura de prédios mais antigos e urbanizações recentes com elevador.",
    nearbyAreas: ["Lisboa", "Loures", "Amadora", "Sintra"],
  },
  moita: {
    slug: "moita",
    name: "Moita",
    region: "margem-sul",
    localIntro: "Na Moita, o pedido chega a parceiros que trabalham em todas as freguesias, incluindo Baixa da Banheira, Alhos Vedros e Vale da Amoreira.",
    landmarks: ["Baixa da Banheira", "Alhos Vedros", "Vale da Amoreira", "Moita", "Gaio-Rosário"],
    accessNotes: "A Moita tem zonas residenciais com bons acessos. Algumas áreas mais antigas têm ruas mais estreitas.",
    nearbyAreas: ["Barreiro", "Montijo", "Alcochete", "Seixal"],
  },
  montijo: {
    slug: "montijo",
    name: "Montijo",
    region: "margem-sul",
    localIntro: "No Montijo, o pedido chega a parceiros que trabalham em todo o concelho, com a ponte Vasco da Gama a ligar rapidamente a Lisboa.",
    landmarks: ["Centro do Montijo", "Afonsoeiro", "Alto Estanqueiro", "Sarilhos Grandes", "Canha", "Pegões"],
    accessNotes: "O Montijo tem bons acessos na zona urbana. As freguesias rurais podem ter estradas mais estreitas.",
    nearbyAreas: ["Alcochete", "Moita", "Palmela", "Lisboa"],
  },
  alcochete: {
    slug: "alcochete",
    name: "Alcochete",
    region: "margem-sul",
    localIntro: "Em Alcochete, o pedido chega a parceiros que trabalham em todo o concelho, do centro histórico às novas urbanizações.",
    landmarks: ["Centro histórico", "Urbanização do Freeport", "Passil", "Samouco"],
    accessNotes: "O centro histórico de Alcochete tem ruas mais estreitas. As zonas novas têm excelentes acessos.",
    nearbyAreas: ["Montijo", "Moita", "Palmela", "Setúbal"],
  },
  "monte-abraao": {
    slug: "monte-abraao",
    name: "Monte Abraão",
    region: "lisboa",
    localIntro: "Monte Abraão, no concelho de Sintra, é uma zona urbana densa com excelentes acessos pela IC19 e linha de comboio. O pedido chega a parceiros de toda a freguesia.",
    landmarks: ["Centro de Monte Abraão", "Estação de Monte Abraão", "Massamá", "Queluz"],
    accessNotes: "Monte Abraão tem muitos prédios com elevador, facilitando a recolha de móveis. As ruas são geralmente acessíveis de carrinha.",
    nearbyAreas: ["Queluz", "Massamá", "Sintra", "Amadora"],
  },
  queluz: {
    slug: "queluz",
    name: "Queluz",
    region: "lisboa",
    localIntro: "Queluz, no concelho de Sintra, combina o charme histórico do Palácio de Queluz com zonas residenciais modernas. O pedido chega a parceiros de toda a freguesia, incluindo Belas e Monte Abraão.",
    landmarks: ["Palácio de Queluz", "Centro de Queluz", "Belas", "Monte Abraão", "Massamá Norte"],
    accessNotes: "Queluz tem uma mistura de prédios antigos no centro e edifícios modernos com elevador nas zonas mais recentes. Diga o tipo de acesso no pedido.",
    nearbyAreas: ["Monte Abraão", "Massamá", "Sintra", "Amadora"],
  },
};

// =============================================================================
// FUNÇÕES DE ACESSO
// =============================================================================

/**
 * Obtém conteúdo único para uma combinação cidade+serviço (páginas prioritárias)
 */
export function getCityServiceContent(citySlug: string, serviceSlug: string): CityServiceContent | undefined {
  const key = `${serviceSlug}-${citySlug}`;
  return CITY_SERVICE_CONTENT[key];
}

/**
 * Obtém conteúdo base de uma cidade (para páginas não prioritárias)
 */
export function getCityBaseContent(citySlug: string): CityBaseContent | undefined {
  return CITY_BASE_CONTENT[citySlug.toLowerCase()];
}

/**
 * Verifica se uma combinação cidade+serviço tem conteúdo prioritário
 */
export function hasPriorityContent(citySlug: string, serviceSlug: string): boolean {
  const key = `${serviceSlug}-${citySlug}`;
  return key in CITY_SERVICE_CONTENT;
}

/**
 * Lista todas as páginas prioritárias
 */
export function getPriorityPages(): string[] {
  return Object.keys(CITY_SERVICE_CONTENT);
}

// =============================================================================
// FUNÇÕES AUXILIARES PARA COMPATIBILIDADE
// =============================================================================

/**
 * Alias para getCityBaseContent (compatibilidade com código existente)
 */
export function getCityContent(citySlug: string): CityBaseContent | undefined {
  return getCityBaseContent(citySlug);
}

/**
 * Lista todas as cidades de uma região específica
 */
export function getCitiesByRegion(region: "lisboa" | "margem-sul" | "setubal"): CityBaseContent[] {
  return Object.values(CITY_BASE_CONTENT).filter((city) => city.region === region);
}

/**
 * Lista todas as cidades
 */
export function getAllCities(): CityBaseContent[] {
  return Object.values(CITY_BASE_CONTENT);
}
