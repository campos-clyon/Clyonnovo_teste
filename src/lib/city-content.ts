/**
 * Conteúdo único e personalizado por cidade E por serviço para páginas SEO locais.
 * Cada combinação cidade+serviço tem conteúdo genuinamente diferente.
 */

export interface CityServiceContent {
  // Identificação
  citySlug: string;
  serviceSlug: string;

  // SEO único
  metaTitle: string;
  metaDescription: string;
  h1: string;

  // Conteúdo local único
  localIntro: string;
  accessNotes: string;
  neighborhoodHighlight: string;
  nearbyAreas: string[];

  // FAQs únicas (não parametrizadas)
  faqs: { q: string; a: string }[];

  // Preços específicos
  pricingNotes: string[];

  // CTA contextualizado
  ctaText: string;
}

// =============================================================================
// CONTEÚDO ÚNICO POR CIDADE+SERVIÇO (10 páginas prioritárias)
// =============================================================================

export const CITY_SERVICE_CONTENT: Record<string, CityServiceContent> = {
  // ---------------------------------------------------------------------------
  // 1. RECOLHA DE MÓVEIS EM LISBOA
  // ---------------------------------------------------------------------------
  "recolha-moveis-lisboa": {
    citySlug: "lisboa",
    serviceSlug: "recolha-moveis",
    metaTitle: "Recolha de Moveis em Lisboa — Sofas, Camas e Recheios Completos",
    metaDescription:
      "Recolha de moveis usados em Lisboa: sofas, camas, colchoes, armarios e electrodomesticos. Entramos em casa, desmontamos, carregamos. 163 avaliacoes. Orcamento gratis.",
    h1: "Recolha de Moveis Usados em Lisboa — Sofas, Camas, Armarios e Recheios",
    localIntro:
      "Precisa de retirar móveis em Lisboa? A CLYON retira sofás velhos, camas com colchão, armários, mesas, cadeiras, electrodomésticos e recheios completos de apartamentos. Trabalhamos em toda Lisboa: desde os prédios antigos sem elevador em Alfama e Mouraria até aos condomínios do Parque das Nações. Se o sofá não passa na porta, desmontamos. Se há escadas estreitas, descemos peça a peça. Se o estacionamento é complicado, coordenamos horário para evitar problemas.",
    accessNotes:
      "Nos bairros históricos (Alfama, Mouraria, Graça, Bairro Alto), os acessos são por escadas em caracol ou ruas empedradas onde a carrinha não entra. Avaliamos sempre antes de dar preço. Nas zonas mais modernas (Parque das Nações, Telheiras, Benfica), os acessos são normalmente fáceis.",
    neighborhoodHighlight:
      "As zonas de Lisboa com mais pedidos de recolha de móveis são Benfica, Lumiar, Alvalade, Olivais e Telheiras. São bairros residenciais com muitas mudanças, renovações e esvaziamentos de apartamentos arrendados.",
    nearbyAreas: ["Amadora", "Odivelas", "Loures", "Oeiras"],
    faqs: [
      {
        q: "Quanto custa recolher um sofá em Lisboa?",
        a: "O valor depende do volume, acesso, piso e necessidade de desmontagem. Num 5º andar sem elevador em Alfama, o orçamento é diferente de um rés-do-chão em Telheiras. Enviamos orçamento personalizado após ver fotos.",
      },
      {
        q: "A CLYON retira camas e colchões em Lisboa?",
        a: "Sim. Retiramos camas de casal, camas de solteiro, beliches, colchões de todas as medidas, sommiers e estrados. Desmontamos a cama se necessário. O valor depende do acesso e do conjunto de itens — enviamos orçamento após ver fotos.",
      },
      {
        q: "Recolhem armários e roupeiros em Lisboa?",
        a: "Sim. Retiramos armários de 2, 3 ou mais portas, roupeiros embutidos (quando removíveis), estantes e móveis de quarto. Desmontamos no local se não couber nas escadas.",
      },
      {
        q: "A CLYON faz esvaziamento de recheio completo em Lisboa?",
        a: "Sim. Esvaziamos apartamentos e moradias completas em Lisboa: móveis, electrodomésticos, roupa, tralha, decoração — levamos tudo. Ideal para heranças, mudanças e entrega de imóveis arrendados.",
      },
      {
        q: "Recolhem electrodomésticos junto com os móveis em Lisboa?",
        a: "Sim. Frigoríficos, máquinas de lavar roupa e loiça, fogões, fornos, micro-ondas, arcas e TVs. Podemos recolher no mesmo serviço que os móveis.",
      },
      {
        q: "Qual a diferença entre a CLYON e a recolha da Câmara de Lisboa?",
        a: "A Câmara de Lisboa faz recolha gratuita mas tem lista de espera de semanas, não entra em casa, não sobe escadas e não desmonta móveis. A CLYON entra no imóvel, desmonta, carrega e leva no dia combinado. É mais rápido e resolve tudo de uma vez.",
      },
      {
        q: "Fazem recolha de móveis ao sábado em Lisboa?",
        a: "Sim, aos sábados trabalhamos em Lisboa mediante disponibilidade. É melhor contactar durante a semana para garantir vaga no dia pretendido.",
      },
      {
        q: "Podem recolher móveis no mesmo dia em Lisboa?",
        a: "Se contactar de manhã e tivermos disponibilidade, sim. Fazemos recolhas urgentes em Lisboa com frequência. Para garantir, o ideal é marcar com 24-48h de antecedência.",
      },
      {
        q: "Fazem recolha de móveis em Benfica, Lumiar e Alvalade?",
        a: "Sim. Benfica, Lumiar e Alvalade são das zonas onde mais trabalhamos em Lisboa. São bairros residenciais com bons acessos e muita procura de recolha de móveis.",
      },
    ],
    pricingNotes: [
      "Sofá: orçamento conforme volume, acesso, urgência e necessidade de desmontagem",
      "Cama de casal com colchão: orçamento conforme acesso e piso",
      "Armário de 2-3 portas: valor depende do número de portas e piso",
      "Frigorífico ou electrodoméstico: orçamento personalizado",
      "Esvaziamento de apartamento: orçamento conforme volume total e tipologia",
    ],
    ctaText: "Moveis para retirar em Lisboa? Envie fotos pelo WhatsApp e receba orcamento em 15 minutos.",
  },

  // ---------------------------------------------------------------------------
  // 2. RECOLHA DE ENTULHO EM LISBOA
  // ---------------------------------------------------------------------------
  "recolha-entulho-lisboa": {
    citySlug: "lisboa",
    serviceSlug: "recolha-entulho",
    metaTitle: "Recolha de Entulho em Lisboa - Obras e Remodelações | CLYON",
    metaDescription:
      "Recolha de entulho de obras em Lisboa. Retiramos restos de construção, azulejos, tijolos e sacos de cimento. Preços desde 120EUR, resposta em 24h.",
    h1: "Recolha de Entulho de Obras em Lisboa",
    localIntro:
      "Lisboa está sempre em obras. Remodelações de apartamentos antigos, renovações de lojas no Chiado, restauros em Alfama. O entulho acumula-se e precisa de sair rápido para a obra avançar. A CLYON recolhe entulho em sacos, a granel ou em contentores, adaptando o serviço ao volume e ao tipo de acesso do imóvel.",
    accessNotes:
      "Em muitas obras de Lisboa, o acesso é por escadas ou ruas estreitas onde não entra contentor grande. Nestes casos, trabalhamos com sacos big bag ou recolha manual com carrinho de mão.",
    neighborhoodHighlight:
      "As zonas com mais obras em Lisboa são o centro histórico (Alfama, Mouraria, Baixa), Avenidas Novas e Parque das Nações. Cada zona tem desafios de acesso diferentes.",
    nearbyAreas: ["Amadora", "Loures", "Odivelas", "Oeiras"],
    faqs: [
      {
        q: "Quanto custa recolher entulho de uma obra em Lisboa?",
        a: "Depende do volume. Uma remodelação de casa de banho gera cerca de 10-15 sacos e custa entre 120EUR e 180EUR. Uma obra maior pode precisar de contentor e o preço sobe proporcionalmente.",
      },
      {
        q: "A CLYON fornece contentor para entulho em Lisboa?",
        a: "Fornecemos contentores de vários tamanhos para obras em Lisboa. O contentor fica no local o tempo combinado e depois vamos buscar. O preço inclui transporte e despejo.",
      },
      {
        q: "Recolhem entulho de obras ao sábado em Lisboa?",
        a: "Aos sábados de manhã conseguimos fazer recolhas em Lisboa, mediante marcação prévia. Domingos não trabalhamos.",
      },
      {
        q: "Podem recolher entulho de um 4º andar sem elevador em Lisboa?",
        a: "Sim, fazemos isso regularmente em prédios antigos de Lisboa. O preço é ajustado ao esforço de descida, mas temos equipa preparada para estes acessos.",
      },
    ],
    pricingNotes: [
      "Até 10 sacos de entulho: 120EUR a 150EUR",
      "Contentor pequeno (2m³): 180EUR a 220EUR",
      "Contentor médio (5m³): 280EUR a 350EUR",
      "Remodelação de WC completa: 150EUR a 200EUR",
      "Obra de cozinha: 200EUR a 300EUR",
    ],
    ctaText: "Tem entulho de obra em Lisboa? Diga-nos o volume e enviamos orçamento hoje.",
  },

  // ---------------------------------------------------------------------------
  // 2.5. RECOLHA DE MONOS EM LISBOA (PÁGINA PRIORITÁRIA)
  // ---------------------------------------------------------------------------
  "recolha-monos-lisboa": {
    citySlug: "lisboa",
    serviceSlug: "recolha-monos",
    metaTitle: "Recolha de Monos em Lisboa — Alternativa Rapida a Camara",
    metaDescription:
      "Recolha de monos em Lisboa: entramos em casa, retiramos moveis usados, electrodomesticos e tralha. Alternativa a Camara sem lista de espera. 163 avaliacoes. Resposta em 11 min.",
    h1: "Recolha de Monos em Lisboa — A Alternativa Rapida a Camara Municipal",
    localIntro:
      "Tem monos em casa que precisa de retirar? A CLYON é a alternativa rápida à recolha municipal em Lisboa. Enquanto a Câmara de Lisboa tem lista de espera de semanas e não entra no imóvel, nós vamos buscar os monos onde estiverem — seja num 5º andar sem elevador em Alfama, numa cave na Graça ou numa garagem no Parque das Nações. A diferença é simples: ligamos, combinamos, aparecemos no dia marcado e levamos tudo.",
    accessNotes:
      "Em Lisboa, os acessos mais complicados são nos bairros históricos: Alfama, Mouraria, Graça e Castelo têm escadas estreitas, ruas empedradas e estacionamento impossível. Mesmo assim, trabalhamos lá todos os dias. Avaliamos sempre o acesso antes de dar preço para não haver surpresas.",
    neighborhoodHighlight:
      "As zonas de Lisboa onde fazemos mais recolhas de monos são Benfica, Lumiar, Alvalade, Olivais e Telheiras. São bairros residenciais com muitas mudanças, renovações e esvaziamentos de casa.",
    nearbyAreas: ["Amadora", "Odivelas", "Loures", "Oeiras"],
    faqs: [
      {
        q: "Qual a diferença entre a recolha de monos da CLYON e a da Câmara de Lisboa?",
        a: "A Câmara de Lisboa faz recolha gratuita mas tem lista de espera de 2-4 semanas, não entra no imóvel, não sobe escadas, não desmonta móveis e só recolhe o que estiver na rua. A CLYON entra em casa, desmonta se necessário, carrega, transporta e faz no dia combinado. É mais rápido e resolve o problema de uma vez.",
      },
      {
        q: "Quanto custa recolher monos em Lisboa?",
        a: "Depende do volume, acesso, urgência e necessidade de desmontagem. Enviamos orçamento personalizado após ver fotos — respondemos em minutos.",
      },
      {
        q: "A CLYON retira monos em prédios sem elevador em Lisboa?",
        a: "Sim, é uma das situações mais comuns. Temos experiência em prédios antigos de Alfama, Mouraria e Graça. O preço é ajustado ao número de pisos e ao tipo de escada, mas fazemos sempre.",
      },
      {
        q: "Podem retirar monos no mesmo dia em Lisboa?",
        a: "Se tivermos disponibilidade, sim. Fazemos recolhas urgentes em Lisboa com frequência. Contacte-nos de manhã e tentamos encaixar no próprio dia.",
      },
      {
        q: "Que tipo de monos a CLYON retira em Lisboa?",
        a: "Retiramos todo o tipo de monos: sofás, camas, colchões, armários, mesas, cadeiras, electrodomésticos, equipamento de ginásio, móveis de jardim, bicicletas velhas, tralha de garagem e cave. Basicamente, tudo o que precisa de sair e não cabe no lixo normal.",
      },
      {
        q: "Onde deixam os monos que recolhem em Lisboa?",
        a: "Fazemos triagem responsável. O que pode ser reciclado vai para centros de reciclagem licenciados. Electrodomésticos vão para pontos de recolha específicos. Móveis em bom estado podem ir para reutilização. Temos parcerias com operadores de resíduos certificados.",
      },
      {
        q: "Quando compensa contratar a CLYON em vez de esperar pela Câmara?",
        a: "Compensa sempre que: precisa dos monos fora rapidamente (mudança, venda de casa, obras), não consegue levar os monos para a rua sozinho, tem escadas sem elevador, ou simplesmente não quer esperar semanas. O preço compensa pela rapidez e conveniência.",
      },
      {
        q: "Posso doar os meus móveis usados em Lisboa em vez de pagar pela recolha?",
        a: "Se os móveis estiverem em bom estado, pode contactar instituições como Cáritas, Comunidade Vida e Paz ou Re-Food que aceitam doações. A CLYON pode ajudar a encaminhar móveis reutilizáveis, mas na maioria dos casos os monos já não estão em condições de doação — estão danificados, sujos ou desactualizados.",
      },
      {
        q: "Qual é a melhor empresa para retirar móveis usados em Lisboa?",
        a: "A CLYON tem 163 avaliações 5 estrelas no Fixando e resposta média de 11 minutos. Entramos em casa, desmontamos, carregamos e levamos. Cobrimos toda Lisboa e Margem Sul. Para comparar, peça orçamento gratuito e veja a rapidez da resposta.",
      },
    ],
    pricingNotes: [
      "Sofá ou cadeirão: orçamento conforme volume, acesso e necessidade de desmontagem",
      "Cama completa: orçamento conforme acesso e piso",
      "Armário ou roupeiro: valor depende do número de portas e piso",
      "Electrodoméstico: orçamento personalizado",
      "Esvaziamento de apartamento: orçamento conforme volume total e tipologia",
    ],
    ctaText: "Monos para retirar em Lisboa? Envie fotos pelo WhatsApp e receba orçamento em 15 minutos.",
  },

  // ---------------------------------------------------------------------------
  // 3. RECOLHA DE MÓVEIS EM ALMADA
  // ---------------------------------------------------------------------------
  "recolha-moveis-almada": {
    citySlug: "almada",
    serviceSlug: "recolha-moveis",
    metaTitle: "Recolha de Moveis em Almada — Empresa Local, Resposta Rapida",
    metaDescription:
      "Recolha de moveis em Almada, Cacilhas, Pragal, Laranjeiro e Costa da Caparica. Empresa local no Seixal. Resposta em minutos. Orcamento gratis.",
    h1: "Recolha de Moveis em Almada — Cacilhas, Pragal, Laranjeiro e Costa",
    localIntro:
      "Precisa de retirar móveis em Almada? A CLYON é a empresa local para recolha de móveis usados em todo o concelho: Cacilhas, Pragal, Laranjeiro, Feijó, Cova da Piedade, Almada Velha e Costa da Caparica. Estamos sediados no Seixal, a 10 minutos de qualquer ponto de Almada. Conhecemos bem as diferenças entre Cacilhas (prédios antigos com escadas), Pragal e Laranjeiro (urbanizações mais recentes com elevador), e a Costa da Caparica (apartamentos de férias). Por sermos locais, respondemos mais depressa e com melhor preço do que empresas de Lisboa.",
    accessNotes:
      "Em Cacilhas e Almada Velha, há prédios antigos sem elevador onde é preciso desmontar móveis para descer. No Pragal, Laranjeiro e Feijó, a maioria dos prédios tem elevador e bons acessos. Na Costa da Caparica, os acessos são fáceis mas em época balnear o estacionamento complica.",
    neighborhoodHighlight:
      "As zonas de Almada com mais pedidos de recolha são Cacilhas (esvaziamentos de apartamentos antigos), Pragal e Laranjeiro (mudanças e renovações), e a Costa da Caparica (apartamentos de férias esvaziados no final do verão).",
    nearbyAreas: ["Seixal", "Lisboa", "Setúbal", "Barreiro"],
    faqs: [
      {
        q: "A CLYON faz recolha de móveis em Almada?",
        a: "Sim. Almada é uma das zonas onde mais trabalhamos. Estamos no Seixal, mesmo ao lado. Cobrimos Cacilhas, Pragal, Laranjeiro, Feijó, Cova da Piedade, Almada Velha e Costa da Caparica.",
      },
      {
        q: "Quanto custa recolher móveis em Almada?",
        a: "O valor depende do volume, acesso, piso e necessidade de desmontagem. Por estarmos sediados no Seixal, conseguimos responder com eficiência a pedidos em Almada. Envie fotos para orçamento personalizado.",
      },
      {
        q: "Recolhem móveis em Cacilhas com escadas?",
        a: "Sim. Cacilhas tem muitos prédios antigos sem elevador. Temos experiência nesses acessos, desmontamos móveis se necessário e ajustamos o preço ao esforço real.",
      },
      {
        q: "Fazem recolha de móveis no Pragal e Laranjeiro?",
        a: "Sim. Pragal e Laranjeiro são zonas com urbanizações recentes e bons acessos. A maioria dos prédios tem elevador, o que facilita o trabalho e baixa o preço.",
      },
      {
        q: "Fazem recolha de móveis na Costa da Caparica?",
        a: "Sim, frequentemente. Muitos apartamentos de férias na Costa precisam de esvaziamento no final da época. Retiramos sofás-cama, colchões, móveis de jardim e electrodomésticos.",
      },
      {
        q: "A CLYON faz esvaziamento completo de casas em Almada?",
        a: "Sim. Esvaziamos apartamentos e moradias completas em Almada: móveis, electrodomésticos, roupa, tralha — levamos tudo. Ideal para heranças, mudanças e entrega de imóveis arrendados.",
      },
      {
        q: "Recolhem electrodomésticos em Almada?",
        a: "Sim. Frigoríficos, máquinas de lavar, fogões, fornos, micro-ondas e TVs. Podemos recolher junto com os móveis no mesmo serviço.",
      },
      {
        q: "Fazem recolha de móveis no Feijó e Cova da Piedade?",
        a: "Sim. Feijó e Cova da Piedade são zonas centrais de Almada com boa acessibilidade. Trabalhamos regularmente nestes bairros com preços competitivos.",
      },
      {
        q: "A CLYON também faz recolhas em Lisboa a partir de Almada?",
        a: "Sim. Estamos no Seixal e cobrimos tanto Almada como Lisboa. Para Lisboa os preços são ligeiramente superiores pela travessia, mas continuamos a ser competitivos e rápidos.",
      },
    ],
    pricingNotes: [
      "Sofá: orçamento conforme volume, acesso e necessidade de desmontagem",
      "Cama de casal com colchão: orçamento conforme acesso e piso",
      "Armário de 2-3 portas: valor depende do número de portas e piso",
      "Frigorífico ou máquina: orçamento personalizado",
      "Esvaziamento de apartamento: orçamento conforme volume total e tipologia",
    ],
    ctaText: "Móveis para retirar em Almada? Somos locais — envie fotos e receba orçamento em minutos.",
  },

  // ---------------------------------------------------------------------------
  // 4. RECOLHA DE MÓVEIS NO SEIXAL
  // ---------------------------------------------------------------------------
  "recolha-moveis-seixal": {
    citySlug: "seixal",
    serviceSlug: "recolha-moveis",
    metaTitle: "Recolha de Móveis no Seixal - Amora, Corroios e Arrentela | CLYON",
    metaDescription:
      "Recolha de móveis usados no Seixal. A CLYON está sediada em Amora - resposta imediata para Corroios, Arrentela e Paio Pires. Orçamento grátis.",
    h1: "Recolha de Móveis no Seixal - A Nossa Base",
    localIntro:
      "O Seixal é a nossa casa. A sede da CLYON fica em Belverde, Amora. Isto significa que para qualquer pedido no Seixal - seja em Corroios, Arrentela, Paio Pires ou Fernão Ferro - conseguimos responder em minutos e estar no local no mesmo dia. Os nossos preços no Seixal são os mais competitivos porque não temos deslocação.",
    accessNotes:
      "O Seixal tem uma mistura de prédios com elevador (Corroios, Cruz de Pau) e moradias (Fernão Ferro, Paio Pires). Conhecemos bem cada zona e adaptamos a equipa ao tipo de acesso.",
    neighborhoodHighlight:
      "Amora e Corroios são as zonas com mais pedidos. São bairros residenciais com muita rotação de inquilinos e renovações de apartamentos.",
    nearbyAreas: ["Almada", "Barreiro", "Sesimbra", "Setúbal"],
    faqs: [
      {
        q: "A CLYON é do Seixal?",
        a: "Sim, a nossa sede é em Belverde, Amora (Seixal), 2845-513. Para pedidos no Seixal, conseguimos os melhores preços e tempos de resposta.",
      },
      {
        q: "Quanto custa recolher um sofá no Seixal?",
        a: "O valor depende do volume, acesso e necessidade de desmontagem. Por estarmos sediados em Amora, não há custos de deslocação para o Seixal. Envie fotos para orçamento personalizado.",
      },
      {
        q: "Fazem recolha de móveis em Fernão Ferro?",
        a: "Sim. Fernão Ferro tem muitas moradias com garagem e jardim. Retiramos móveis, equipamento de jardim e limpamos garagens.",
      },
      {
        q: "Podem recolher móveis no mesmo dia no Seixal?",
        a: "Na maioria dos casos, sim. Por estarmos em Amora, conseguimos encaixar pedidos urgentes no Seixal com facilidade.",
      },
    ],
    pricingNotes: [
      "Sofá: orçamento conforme volume, acesso e necessidade de desmontagem",
      "Cama de casal com estrado: orçamento conforme acesso e piso",
      "Armário: valor depende do número de portas e piso",
      "Garagem ou tralha acumulada: orçamento conforme volume",
      "Esvaziamento de apartamento: orçamento conforme volume total e tipologia",
    ],
    ctaText: "No Seixal, somos vizinhos. Envie fotos agora e respondemos em minutos.",
  },

  // ---------------------------------------------------------------------------
  // RECOLHA DE ENTULHO NO SEIXAL - NOVA
  // ---------------------------------------------------------------------------
  "recolha-entulho-seixal": {
    citySlug: "seixal",
    serviceSlug: "recolha-entulho",
    metaTitle: "Recolha de Entulho no Seixal - Obras em Amora, Corroios e Arrentela | CLYON",
    metaDescription:
      "Recolha de entulho de obras no Seixal. Contentores e sacos big bag em Amora, Corroios, Arrentela e Paio Pires. Empresa local - os melhores preços.",
    h1: "Recolha de Entulho de Obras no Seixal - Preços Locais",
    localIntro:
      "A sede da CLYON fica em Belverde, Amora - no coração do Seixal. Isto significa que para recolha de entulho no Seixal conseguimos os melhores preços e tempos de resposta do mercado. Servimos obras em Corroios, Arrentela, Paio Pires, Fernão Ferro e todas as freguesias do concelho sem custos de deslocação.",
    accessNotes:
      "No Seixal temos excelente conhecimento local: sabemos onde cabe contentor (Corroios, Cruz de Pau), onde é melhor trabalhar com sacos (zonas mais antigas) e onde há restrições de estacionamento. Isto permite-nos dar orçamentos precisos à primeira.",
    neighborhoodHighlight:
      "Corroios e Amora são as zonas com mais obras de remodelação no Seixal. Muitos apartamentos dos anos 80-90 estão a ser modernizados, gerando entulho de demolição de WCs, cozinhas e divisórias.",
    nearbyAreas: ["Almada", "Barreiro", "Lisboa", "Setúbal"],
    faqs: [
      {
        q: "A CLYON é do Seixal?",
        a: "Sim, a nossa sede é em Belverde, Amora (Seixal), 2845-513. Para entulho no Seixal, conseguimos os melhores preços porque não há deslocação.",
      },
      {
        q: "Quanto custa um contentor de entulho no Seixal?",
        a: "Por estarmos sediados em Amora, conseguimos preços mais competitivos no Seixal do que em zonas mais distantes. O valor depende do volume, tipo de entulho e duração. Peça orçamento sem compromisso.",
      },
      {
        q: "Podem deixar contentor em Corroios ou Amora?",
        a: "Sim. Deixamos contentores em obras em Corroios, Amora, Arrentela, Paio Pires e Fernão Ferro. O contentor fica o tempo combinado e depois vamos buscar.",
      },
      {
        q: "Recolhem entulho aos sacos no Seixal?",
        a: "Sim. Para obras mais pequenas trabalhamos com sacos big bag. Por estarmos sediados em Amora, o custo de deslocação é mínimo, o que torna o preço mais competitivo. Peça orçamento.",
      },
      {
        q: "Podem recolher entulho no mesmo dia no Seixal?",
        a: "Na maioria dos casos, sim. Por estarmos em Amora, conseguimos encaixar pedidos urgentes de entulho no Seixal com facilidade.",
      },
    ],
    pricingNotes: [
      "Sacos big bag de entulho: valor orientativo a partir de 80€ (depende do volume)",
      "Contentor pequeno: orçamento personalizado — sem custo de deslocação no Seixal",
      "Contentor médio: orçamento personalizado conforme volume e duração",
      "Entulho de remodelação de WC: orçamento personalizado conforme volume",
      "Demolição de divisória: orçamento personalizado conforme resíduos",
    ],
    ctaText: "Obra no Seixal? Somos vizinhos - contentor ou sacos, entregamos hoje.",
  },

  // ---------------------------------------------------------------------------
  // 5. RECOLHA DE ENTULHO EM ALMADA
  // ---------------------------------------------------------------------------
  "recolha-entulho-almada": {
    citySlug: "almada",
    serviceSlug: "recolha-entulho",
    metaTitle: "Recolha de Entulho em Almada - Obras na Margem Sul | CLYON",
    metaDescription:
      "Recolha de entulho de obras em Almada, Costa da Caparica e Cacilhas. Contentores e sacos big bag. Empresa local, preços desde 100EUR.",
    h1: "Recolha de Entulho de Obras em Almada",
    localIntro:
      "Almada tem muitas obras em curso: remodelações de apartamentos antigos em Cacilhas, renovações de casas de férias na Costa da Caparica, construções novas no Pragal. A CLYON está a 10 minutos de qualquer ponto de Almada e consegue responder rápido a pedidos de recolha de entulho, seja em sacos, a granel ou com contentor.",
    accessNotes:
      "Na Costa da Caparica, a maioria das obras tem bom acesso para contentor. Em Cacilhas e Almada Velha, trabalhamos mais com sacos por causa das ruas estreitas.",
    neighborhoodHighlight:
      "A Costa da Caparica é a zona com mais obras de renovação em Almada. Muitos apartamentos antigos estão a ser modernizados.",
    nearbyAreas: ["Seixal", "Lisboa", "Barreiro", "Setúbal"],
    faqs: [
      {
        q: "Quanto custa um contentor de entulho em Almada?",
        a: "Um contentor pequeno (2m³) em Almada custa entre 150EUR e 200EUR, incluindo transporte, aluguer e despejo. Somos locais, por isso conseguimos bom preço.",
      },
      {
        q: "A CLYON deixa contentor de entulho na Costa da Caparica?",
        a: "Sim. Deixamos contentores em obras na Costa da Caparica. O contentor fica o tempo combinado e depois vamos buscar.",
      },
      {
        q: "Recolhem entulho aos sacos em Almada?",
        a: "Sim. Para obras mais pequenas ou acessos difíceis, trabalhamos com sacos big bag. É mais prático em prédios sem elevador.",
      },
      {
        q: "Podem recolher entulho de uma obra ao sábado em Almada?",
        a: "Aos sábados de manhã conseguimos fazer recolhas em Almada, mediante marcação prévia.",
      },
    ],
    pricingNotes: [
      "Até 10 sacos de entulho: 100EUR a 140EUR",
      "Contentor pequeno (2m³): 150EUR a 200EUR",
      "Contentor médio (5m³): 250EUR a 320EUR",
      "Remodelação de WC: 120EUR a 180EUR",
      "Demolição de divisória: 150EUR a 220EUR",
    ],
    ctaText: "Obra em Almada? Somos locais - contentor ou sacos, entregamos rápido.",
  },

  // ---------------------------------------------------------------------------
  // 6. RECOLHA DE MÓVEIS EM CASCAIS
  // ---------------------------------------------------------------------------
  "recolha-moveis-cascais": {
    citySlug: "cascais",
    serviceSlug: "recolha-moveis",
    metaTitle: "Recolha de Móveis em Cascais - Estoril, Parede e Carcavelos | CLYON",
    metaDescription:
      "Recolha de móveis usados em Cascais, Estoril e Carcavelos. Retiramos sofás, camas e armários de moradias e apartamentos. Serviço cuidado, preços desde 40EUR.",
    h1: "Recolha de Móveis em Cascais e Estoril",
    localIntro:
      "Cascais tem características próprias: muitas moradias com jardim, apartamentos de gama alta no Estoril, e casas de férias em Carcavelos. Os móveis são frequentemente maiores e mais pesados do que a média. A CLYON adapta a equipa ao tipo de imóvel e tem cuidado extra com os acessos em condomínios fechados, onde é preciso coordenar com a portaria.",
    accessNotes:
      "Muitas moradias em Cascais têm acesso por escadas exteriores ou jardins que dificultam a passagem de móveis grandes. Em condomínios fechados, coordenamos a entrada com o porteiro ou administração.",
    neighborhoodHighlight:
      "O Estoril e São João do Estoril têm muitos apartamentos em renovação. Carcavelos tem casas de férias que são esvaziadas sazonalmente.",
    nearbyAreas: ["Oeiras", "Sintra", "Lisboa", "Estoril"],
    faqs: [
      {
        q: "A CLYON faz recolha de móveis em Cascais?",
        a: "Sim, regularmente. Cobrimos Cascais, Estoril, Parede, Carcavelos e São Domingos de Rana. Conhecemos bem a zona e os acessos.",
      },
      {
        q: "Quanto custa recolher móveis de uma moradia em Cascais?",
        a: "Depende do volume. Uma moradia típica em Cascais com sala, quartos e garagem pode custar entre 400EUR e 700EUR para esvaziamento completo.",
      },
      {
        q: "Recolhem móveis antigos e peças grandes em Cascais?",
        a: "Sim. Muitas casas em Cascais têm móveis antigos pesados. Temos equipa e equipamento para retirar aparadores, cómodas e armários grandes.",
      },
      {
        q: "Fazem recolha em condomínios fechados em Cascais?",
        a: "Sim. Coordenamos a entrada com a portaria ou administração. Já trabalhamos em vários condomínios na zona de Cascais e Estoril.",
      },
    ],
    pricingNotes: [
      "Sofá: orçamento conforme volume, acesso e necessidade de desmontagem",
      "Cama: orçamento conforme acesso e piso",
      "Armário: valor depende do número de portas e piso",
      "Esvaziamento de apartamento: orçamento conforme volume total e tipologia",
      "Moradia completa: orçamento personalizado após visita ou fotos",
    ],
    ctaText: "Móveis para retirar em Cascais? Enviamos equipa preparada para qualquer acesso.",
  },

  // ---------------------------------------------------------------------------
  // 7. RECOLHA DE MÓVEIS EM SINTRA
  // ---------------------------------------------------------------------------
  "recolha-moveis-sintra": {
    citySlug: "sintra",
    serviceSlug: "recolha-moveis",
    metaTitle: "Recolha de Móveis em Sintra - Mem Martins, Cacém e Rio de Mouro | CLYON",
    metaDescription:
      "Recolha de móveis usados em Sintra, Mem Martins, Cacém e Rio de Mouro. Retiramos sofás, camas e armários. Orçamento grátis, resposta rápida.",
    h1: "Recolha de Móveis em Sintra e Arredores",
    localIntro:
      "Sintra é um concelho grande com zonas muito diferentes: o centro histórico com ruas estreitas e empedradas, Mem Martins e Rio de Mouro com urbanizações de prédios, Cacém com uma mistura de ambos. A CLYON conhece estas diferenças e adapta o serviço. No centro histórico de Sintra, os acessos são complicados. Em Mem Martins, a maioria dos prédios tem elevador e o trabalho é mais simples.",
    accessNotes:
      "O centro histórico de Sintra tem ruas de paralelepípedo e inclinações fortes. Aqui o trabalho é mais demorado. Mem Martins, Cacém e Rio de Mouro têm acessos normais de urbanização.",
    neighborhoodHighlight:
      "Mem Martins e Cacém são as zonas com mais pedidos em Sintra. São bairros residenciais com muita rotação de inquilinos.",
    nearbyAreas: ["Amadora", "Cascais", "Oeiras", "Mafra"],
    faqs: [
      {
        q: "A CLYON faz recolha de móveis no centro de Sintra?",
        a: "Sim, mas avisamos que os acessos no centro histórico são complicados. Avaliamos sempre antes de dar preço porque pode ser necessário mais tempo e equipa.",
      },
      {
        q: "Quanto custa recolher móveis em Mem Martins?",
        a: "Em Mem Martins, a maioria dos prédios tem elevador e bons acessos, o que simplifica o trabalho. O valor depende do volume e do conjunto de itens — enviamos orçamento após ver fotos.",
      },
      {
        q: "Recolhem móveis de quintas em Sintra?",
        a: "Sim. Sintra tem muitas quintas que precisam de esvaziamento. É um trabalho maior mas fazemos com frequência.",
      },
      {
        q: "Fazem recolha de móveis no mesmo dia em Sintra?",
        a: "Se tivermos disponibilidade, sim. Para Mem Martins e Cacém é mais fácil encaixar pedidos urgentes do que para o centro histórico.",
      },
    ],
    pricingNotes: [
      "Sofá: orçamento conforme volume, acesso e necessidade de desmontagem",
      "Cama de casal com estrado: orçamento conforme acesso e piso",
      "Armário: valor depende do número de portas e piso",
      "Esvaziamento de apartamento: orçamento conforme volume total e tipologia",
      "Quinta com móveis antigos: orçamento personalizado após visita ou fotos",
    ],
    ctaText: "Móveis para retirar em Sintra? Diga-nos a zona e damos preço ajustado ao acesso.",
  },

  // ---------------------------------------------------------------------------
  // 8. LIMPEZA PÓS-OBRA EM LISBOA
  // ---------------------------------------------------------------------------
  "limpeza-pos-obra-lisboa": {
    citySlug: "lisboa",
    serviceSlug: "limpeza-pos-obra",
    metaTitle: "Limpeza Pós-Obra em Lisboa - Apartamentos, Lojas e Escritórios | CLYON",
    metaDescription:
      "Limpeza pós-obra profissional em Lisboa. Retiramos pó de construção, manchas de tinta e cimento. Apartamentos, lojas e escritórios. Orçamento grátis, equipa experiente.",
    h1: "Limpeza Pós-Obra Profissional em Lisboa",
    localIntro:
      "Acabou a obra e o espaço está cheio de pó fino, restos de massa, manchas de tinta e cimento no chão? A CLYON faz a limpeza final profissional para entregar o imóvel pronto a habitar. Trabalhamos em todo o tipo de obras em Lisboa: remodelações de apartamentos antigos em Alfama e Mouraria, renovações de lojas na Baixa e Chiado, obras de escritórios nas Avenidas Novas e Saldanha. A nossa equipa sabe que o pó de obra é diferente - penetra em todas as frestas e precisa de técnica própria para remover.",
    accessNotes:
      "Em muitas obras de Lisboa, a limpeza só pode ser feita depois de sair o último entulho. Podemos coordenar a recolha de entulho e a limpeza no mesmo dia para simplificar o processo.",
    neighborhoodHighlight:
      "As zonas com mais pedidos de limpeza pós-obra em Lisboa são as Avenidas Novas (escritórios), o centro histórico (apartamentos em renovação) e o Parque das Nações (apartamentos e lojas novas).",
    nearbyAreas: ["Amadora", "Loures", "Odivelas", "Oeiras"],
    faqs: [
      {
        q: "O que inclui a limpeza pós-obra da CLYON em Lisboa?",
        a: "Retiramos pó de obra de todas as superfícies (paredes, tetos, rodapés), limpamos vidros por dentro e fora, removemos manchas de tinta e massa do chão, aspiramos e lavamos todos os pavimentos. O espaço fica pronto a mobilar ou entregar ao proprietário.",
      },
      {
        q: "Quanto custa limpeza pós-obra de um T2 em Lisboa?",
        a: "Um apartamento T2 em Lisboa (cerca de 70m²), após remodelação completa, custa entre 150EUR e 250EUR. Se a obra foi só numa divisão, o preço é proporcional. Enviamos orçamento após ver fotos do estado atual.",
      },
      {
        q: "A CLYON retira entulho e faz limpeza no mesmo dia?",
        a: "Sim, é um dos nossos serviços mais pedidos. Primeiro retiramos os sacos de entulho e restos maiores, depois fazemos a limpeza fina. Coordenamos as duas equipas para o cliente não ter de marcar dois dias.",
      },
      {
        q: "Fazem limpeza pós-obra de escritórios em Lisboa?",
        a: "Sim. Escritórios, lojas, consultórios e espaços comerciais. Podemos trabalhar ao fim de semana ou fora do horário laboral para não interferir com a atividade.",
      },
      {
        q: "A limpeza pós-obra inclui vidros e caixilhos?",
        a: "Sim. Limpamos vidros, caixilhos, peitoris e portadas. O pó de obra cola-se muito aos vidros e é uma das partes mais demoradas da limpeza.",
      },
    ],
    pricingNotes: [
      "Apartamento T1 (até 50m²): 100EUR a 150EUR",
      "Apartamento T2 (50-80m²): 150EUR a 250EUR",
      "Apartamento T3 (80-120m²): 200EUR a 350EUR",
      "Loja ou escritório pequeno (até 60m²): 120EUR a 200EUR",
      "Escritório médio (100m²): 180EUR a 300EUR",
    ],
    ctaText: "Obra acabada em Lisboa? Deixamos o espaço pronto a usar - peça orçamento.",
  },

  // ---------------------------------------------------------------------------
  // 9. RECOLHA DE MÓVEIS EM SETÚBAL
  // ---------------------------------------------------------------------------
  "recolha-moveis-setubal": {
    citySlug: "setubal",
    serviceSlug: "recolha-moveis",
    metaTitle: "Recolha de Moveis em Setubal — Apartamentos, Quintas e Azeito",
    metaDescription:
      "Recolha de moveis em Setubal, Azeito e Arrabida. Sofas, camas, armarios, electrodomesticos. Apartamentos, moradias, lojas e quintas. Desde 40EUR. Orcamento gratis.",
    h1: "Recolha de Moveis em Setubal — Apartamentos, Moradias e Quintas",
    localIntro:
      "Precisa de retirar móveis em Setúbal? A CLYON faz recolha de móveis usados em todo o concelho: centro histórico de Setúbal, Bairro Azul, Manteigadas, Avenida Luísa Todi, Azeitão e zona da Arrábida. Retiramos sofás, camas, armários, mesas, cadeiras e electrodomésticos de apartamentos, moradias, lojas e escritórios. Em Azeitão, temos experiência no esvaziamento de quintas com móveis antigos e volumes grandes.",
    accessNotes:
      "O centro de Setúbal tem estacionamento limitado em algumas ruas da zona histórica. Azeitão tem quintas com acessos de terra batida — avaliamos sempre antes de dar preço. Nas urbanizações novas, os acessos são normalmente fáceis.",
    neighborhoodHighlight:
      "As zonas de Setúbal com mais pedidos de recolha são o Bairro Azul, Manteigadas e o centro. Azeitão destaca-se pelo esvaziamento de quintas e casas de família com muito recheio.",
    nearbyAreas: ["Palmela", "Sesimbra", "Seixal", "Barreiro"],
    faqs: [
      {
        q: "A CLYON faz recolha de móveis em Setúbal?",
        a: "Sim. Cobrimos todo o concelho de Setúbal, incluindo centro, Bairro Azul, Manteigadas e Azeitão. Os preços são ligeiramente mais altos do que na Margem Sul por causa da distância, mas continuamos competitivos.",
      },
      {
        q: "Quanto custa recolher móveis em Setúbal?",
        a: "O valor depende do volume, acesso, piso e necessidade de desmontagem. Setúbal tem uma mistura de prédios antigos no centro e urbanizações mais recentes — avaliamos o acesso antes de confirmar. Enviamos orçamento personalizado após ver fotos.",
      },
      {
        q: "Recolhem móveis em quintas de Azeitão?",
        a: "Sim. Azeitão tem muitas quintas com móveis antigos e volumes grandes. Avaliamos o acesso antes de dar preço — algumas quintas têm caminhos de terra ou escadas. Temos experiência neste tipo de trabalho.",
      },
      {
        q: "A CLYON retira móveis de lojas e escritórios em Setúbal?",
        a: "Sim. Retiramos mobiliário de lojas, escritórios, consultórios e espaços comerciais em Setúbal. Podemos trabalhar fora do horário laboral se necessário.",
      },
      {
        q: "Fazem esvaziamento completo de casas em Setúbal?",
        a: "Sim. Esvaziamos apartamentos e moradias completas em Setúbal: móveis, electrodomésticos, roupa, tralha — levamos tudo. Ideal para heranças, mudanças e entrega de imóveis arrendados.",
      },
      {
        q: "Recolhem electrodomésticos em Setúbal?",
        a: "Sim. Frigoríficos, máquinas de lavar, fogões, fornos, micro-ondas, arcas e TVs. Podemos recolher junto com os móveis no mesmo serviço.",
      },
      {
        q: "Podem recolher móveis no mesmo dia em Setúbal?",
        a: "Se contactar de manhã e tivermos disponibilidade, tentamos encaixar no próprio dia. Setúbal fica a cerca de 40 minutos da nossa base no Seixal. Para garantir, marque com 24-48h de antecedência.",
      },
      {
        q: "Qual a zona de Setúbal onde a CLYON faz mais recolhas?",
        a: "As zonas com mais pedidos são o centro de Setúbal, Bairro Azul, Manteigadas e Azeitão. São áreas com muitos apartamentos e quintas que precisam de esvaziamento.",
      },
    ],
    pricingNotes: [
      "Sofá: orçamento conforme volume, acesso e necessidade de desmontagem",
      "Cama de casal com colchão: orçamento conforme acesso e piso",
      "Armário de 2-3 portas: valor depende do número de portas e piso",
      "Frigorífico ou máquina: orçamento personalizado",
      "Esvaziamento de apartamento: orçamento conforme volume total e tipologia",
      "Quinta com móveis antigos: orçamento personalizado após visita ou fotos",
    ],
    ctaText: "Móveis para retirar em Setúbal? Envie fotos pelo WhatsApp e receba orçamento hoje.",
  },

  // ---------------------------------------------------------------------------
  // 9.5. RECOLHA DE ENTULHO EM SETÚBAL (PÁGINA PRIORITÁRIA)
  // ---------------------------------------------------------------------------
  "recolha-entulho-setubal": {
    citySlug: "setubal",
    serviceSlug: "recolha-entulho",
    metaTitle: "Recolha de Entulho em Setubal — Contentores e Sacos de Obra",
    metaDescription:
      "Recolha de entulho em Setubal: contentores 3m3, 5m3, 8m3 e sacos de obra. Entrega em 24h. Remodelacoes, obras pequenas, limpezas. Orcamento gratis.",
    h1: "Recolha de Entulho em Setubal — Contentores, Sacos e Obras Pequenas",
    localIntro:
      "Tem entulho de obra em Setúbal? A CLYON fornece contentores e faz recolha de entulho em sacos para obras de qualquer dimensão. Cobrimos todo o concelho de Setúbal, desde o centro histórico até Azeitão e Arrábida. Para pequenas remodelações, retiramos sacos de entulho directamente. Para obras maiores, colocamos contentor no local pelo tempo necessário e depois vamos buscar.",
    accessNotes:
      "No centro de Setúbal, o estacionamento de contentores pode ser limitado em algumas ruas. Avaliamos sempre o local antes de colocar contentor. Em Azeitão e quintas, o acesso é normalmente mais fácil.",
    neighborhoodHighlight:
      "As zonas com mais obras em Setúbal são o centro histórico (renovações de edifícios antigos), a Avenida Luísa Todi e as novas urbanizações. Azeitão tem muitas quintas em remodelação.",
    nearbyAreas: ["Palmela", "Sesimbra", "Seixal", "Barreiro"],
    faqs: [
      {
        q: "Quanto custa recolher entulho em Setúbal?",
        a: "Depende do volume. Até 10 sacos de entulho custa entre 130EUR e 170EUR. Um contentor de 3m³ custa entre 200EUR e 260EUR. Contentores maiores de 5m³ ou 8m³ têm preços proporcionais. Enviamos orçamento exacto após saber o volume e local.",
      },
      {
        q: "A CLYON fornece contentores para entulho em Setúbal?",
        a: "Sim. Fornecemos contentores de 3m³, 5m³ e 8m³. Entregamos no local, o contentor fica pelo tempo combinado (normalmente 3-7 dias) e depois vamos buscar. O preço inclui entrega, aluguer e recolha.",
      },
      {
        q: "Em quanto tempo entregam contentor de entulho em Setúbal?",
        a: "Normalmente entregamos em 24 a 48 horas. Se for urgente e tivermos disponibilidade, conseguimos no próprio dia. Contacte-nos para verificar.",
      },
      {
        q: "Recolhem entulho de obras pequenas em Setúbal?",
        a: "Sim. Remodelações de casas de banho, cozinhas, substituição de pavimentos. Não é preciso contentor - retiramos os sacos directamente. É mais económico para obras pequenas.",
      },
      {
        q: "Que tipo de entulho a CLYON recolhe em Setúbal?",
        a: "Recolhemos: restos de construção (tijolos, cimento, azulejos), sacos de obra, resíduos de remodelação, madeiras de demolição, gessos e materiais mistos. Não recolhemos amianto nem resíduos perigosos.",
      },
      {
        q: "A CLYON trata do encaminhamento do entulho em Setúbal?",
        a: "Sim. Todo o entulho é encaminhado para operadores de resíduos licenciados. Fazemos triagem e separação quando necessário. Emitimos guia de transporte se o cliente precisar.",
      },
      {
        q: "Recolhem entulho em locais com acesso difícil em Setúbal?",
        a: "Sim. Se o contentor não couber ou a rua for estreita, fazemos recolha manual com sacos. Avaliamos sempre o local antes de dar preço para não haver surpresas.",
      },
      {
        q: "A CLYON também recolhe entulho em Azeitão e Arrábida?",
        a: "Sim. Cobrimos todo o concelho de Setúbal, incluindo Azeitão, Arrábida e Palmela. Muitas quintas em remodelação geram entulho que retiramos regularmente.",
      },
    ],
    pricingNotes: [
      "Até 10 sacos de entulho: 130EUR a 170EUR",
      "Contentor 3m³ (pequeno): 200EUR a 260EUR",
      "Contentor 5m³ (médio): 300EUR a 380EUR",
      "Contentor 8m³ (grande): 420EUR a 520EUR",
      "Remodelação de WC completa: 160EUR a 220EUR",
      "Obra de cozinha: 220EUR a 320EUR",
    ],
    ctaText: "Entulho para retirar em Setúbal? Diga-nos o volume e enviamos orçamento hoje.",
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
    metaDescription:
      "Mudanças em Lisboa com equipa profissional. Embalamos, transportamos, descarregamos e montamos móveis. Apartamentos, escritórios e lojas. Orçamento grátis, resposta rápida.",
    h1: "Mudanças em Lisboa: Residenciais e Comerciais",
    localIntro:
      "Mudar de casa em Lisboa tem desafios próprios: apartamentos em prédios antigos sem elevador em Alfama, estacionamento difícil na Baixa, horários restritos em condomínios no Parque das Nações. A CLYON conhece bem estas situações e organiza a mudança para minimizar imprevistos. Embalamos o que for preciso, protegemos os móveis, coordenamos o estacionamento com a junta de freguesia se necessário, e montamos tudo na nova casa.",
    accessNotes:
      "Em bairros históricos de Lisboa (Alfama, Mouraria, Bairro Alto), o estacionamento é o maior desafio. Pedimos licença à junta de freguesia para reservar lugar. Em condomínios novos, coordenamos horário com a administração.",
    neighborhoodHighlight:
      "As zonas com mais mudanças em Lisboa são Benfica, Alvalade, Lumiar e Parque das Nações. São bairros residenciais com muita rotação de inquilinos e compradores.",
    nearbyAreas: ["Amadora", "Odivelas", "Loures", "Oeiras"],
    faqs: [
      {
        q: "Quanto custa uma mudança de T2 em Lisboa?",
        a: "Uma mudança de T2 em Lisboa, com embalamento básico e montagem de móveis, custa entre 350EUR e 550EUR. Depende do piso, do volume e da distância para a nova casa.",
      },
      {
        q: "A CLYON embala os meus pertences em Lisboa?",
        a: "Sim. Embalamos loiça, livros, roupa, quadros e objetos frágeis. Usamos caixas, papel kraft, plástico bolha e fita. O serviço de embalamento é cobrado à parte.",
      },
      {
        q: "Fazem mudanças ao fim de semana em Lisboa?",
        a: "Aos sábados conseguimos fazer mudanças em Lisboa. Domingos e feriados não trabalhamos. É melhor marcar com antecedência para garantir vaga.",
      },
      {
        q: "Montam os móveis na casa nova em Lisboa?",
        a: "Sim. Camas, roupeiros, secretárias e mesas são montados no sítio certo. Verificamos que tudo fica funcional antes de sair.",
      },
      {
        q: "Fazem mudanças de escritórios em Lisboa?",
        a: "Sim. Mudanças de escritórios, lojas e consultórios em Lisboa. Trabalhamos fora do horário laboral se o cliente preferir.",
      },
    ],
    pricingNotes: [
      "Mudança de T1 em Lisboa: 250EUR a 400EUR",
      "Mudança de T2 em Lisboa: 350EUR a 550EUR",
      "Mudança de T3 em Lisboa: 500EUR a 750EUR",
      "Mudança de escritório pequeno: 400EUR a 650EUR",
      "Embalamento completo (adicional): 80EUR a 150EUR",
    ],
    ctaText: "Vai mudar de casa em Lisboa? Peça orçamento grátis - respondemos hoje.",
  },

  "esvaziamento-casas-lisboa": {
    citySlug: "lisboa",
    serviceSlug: "esvaziamento-casas",
    metaTitle: "Esvaziamento de Casas em Lisboa - Heranças e Arrendamentos | CLYON",
    metaDescription:
      "Esvaziamento de casas e apartamentos em Lisboa. Retiramos tudo: móveis, eletrodomésticos, roupa, papéis. Serviço completo para heranças, vendas e arrendamentos.",
    h1: "Esvaziamento de Casas e Apartamentos em Lisboa",
    localIntro:
      "Esvaziar uma casa em Lisboa é um trabalho grande: há móveis para retirar, eletrodomésticos, roupa, papéis, tralha acumulada. A CLYON faz o esvaziamento completo, desde a sala aos armários da cozinha. Este serviço é muito procurado em casos de herança (o imóvel precisa de ser libertado para venda), fim de arrendamento (o inquilino deixou tudo) e mudanças (não vale a pena levar os móveis velhos).",
    accessNotes:
      "Em Lisboa, os esvaziamentos são frequentemente em prédios antigos sem elevador. Avaliamos sempre o acesso antes de dar preço final porque faz grande diferença no custo.",
    neighborhoodHighlight:
      "Os bairros com mais pedidos de esvaziamento em Lisboa são Benfica, Lumiar, Alvalade e o centro histórico. São zonas com muitos apartamentos antigos.",
    nearbyAreas: ["Amadora", "Odivelas", "Loures", "Oeiras"],
    faqs: [
      {
        q: "O que inclui o esvaziamento de casa da CLYON em Lisboa?",
        a: "Retiramos tudo o que o cliente quiser: móveis, eletrodomésticos, roupa, livros, papéis, decoração, plantas. Deixamos o espaço vazio e varrido.",
      },
      {
        q: "Quanto custa esvaziar um apartamento T2 em Lisboa?",
        a: "Um T2 em Lisboa custa entre 350EUR e 600EUR para esvaziamento completo. Depende do volume de coisas, do piso e do acesso.",
      },
      {
        q: "Fazem esvaziamento de casas de herança em Lisboa?",
        a: "Sim, é um dos nossos serviços mais frequentes. Compreendemos que é uma situação delicada e trabalhamos com respeito e discrição.",
      },
      {
        q: "A CLYON separa o que pode ser doado?",
        a: "Sim. Móveis e objetos em bom estado podem ser encaminhados para doação ou reaproveitamento. Informamos o cliente do que pode ter esse destino.",
      },
      {
        q: "Podem esvaziar só uma parte da casa em Lisboa?",
        a: "Sim. Se quiser manter alguns móveis e retirar o resto, fazemos isso. O preço é ajustado ao volume que sai.",
      },
    ],
    pricingNotes: [
      "Apartamento T1 completo: 250EUR a 400EUR",
      "Apartamento T2 completo: 350EUR a 600EUR",
      "Apartamento T3 completo: 500EUR a 800EUR",
      "Garagem ou arrecadação: 100EUR a 200EUR",
      "Só quarto com armário cheio: 80EUR a 150EUR",
    ],
    ctaText: "Precisa de esvaziar uma casa em Lisboa? Fazemos tudo - envie fotos para orçamento.",
  },

  // ---------------------------------------------------------------------------
  // MONTE ABRAÃO - NOVA CIDADE
  // ---------------------------------------------------------------------------
  "recolha-moveis-monte-abraao": {
    citySlug: "monte-abraao",
    serviceSlug: "recolha-moveis",
    metaTitle: "Recolha de Móveis em Monte Abraão - Queluz e Massamá | CLYON",
    metaDescription:
      "Recolha de móveis usados em Monte Abraão, Queluz e Massamá. Sofás, camas, armários e electrodomésticos. Empresa local, orçamento grátis em minutos.",
    h1: "Recolha de Móveis em Monte Abraão - Sofás, Camas e Armários",
    localIntro:
      "Precisa de retirar móveis em Monte Abraão? A CLYON faz recolha de sofás, camas, armários e electrodomésticos em toda a freguesia e zonas vizinhas: Queluz, Massamá, Belas e Agualva-Cacém. O orçamento é sempre personalizado conforme o volume, acesso, urgência e necessidade de desmontagem — enviamos resposta em minutos após receber fotos.",
    accessNotes:
      "Monte Abraão tem maioritariamente prédios com elevador, o que facilita a recolha. Nas zonas mais antigas próximas do centro de Queluz, alguns edifícios têm escadas estreitas - avaliamos sempre antes de dar preço final.",
    neighborhoodHighlight:
      "Monte Abraão e Massamá são zonas residenciais com muitas famílias e apartamentos arrendados. Os pedidos mais frequentes são recolha de sofás, camas de casal e mobília de quarto durante mudanças.",
    nearbyAreas: ["Queluz", "Massamá", "Sintra", "Amadora"],
    faqs: [
      {
        q: "A CLYON faz recolha de móveis em Monte Abraão?",
        a: "Sim. Monte Abraão, Queluz e Massamá estão na nossa área de cobertura regular. Conseguimos responder rapidamente porque o acesso pela IC19 é muito bom.",
      },
      {
        q: "Quanto custa recolher um sofá em Monte Abraão?",
        a: "O valor depende do piso, acesso e dimensões do sofá. A maioria dos prédios em Monte Abraão tem elevador, o que ajuda a manter o custo mais baixo. Envie fotos para recebermos um orçamento personalizado.",
      },
      {
        q: "Podem recolher móveis no mesmo dia em Monte Abraão?",
        a: "Se contactar de manhã e tivermos disponibilidade, muitas vezes conseguimos ir no próprio dia. Monte Abraão é uma zona com boa cobertura operacional.",
      },
      {
        q: "Recolhem também em Queluz e Massamá?",
        a: "Sim. Queluz, Massamá, Monte Abraão e Belas são todos servidos pela CLYON. Podemos até combinar recolhas em várias moradas próximas.",
      },
      {
        q: "Fazem esvaziamento de apartamentos em Monte Abraão?",
        a: "Sim. Fazemos esvaziamento completo de apartamentos para mudanças, heranças ou fim de arrendamento. Retiramos móveis, electrodomésticos e tralha.",
      },
    ],
    pricingNotes: [
      "Sofá: orçamento conforme volume, acesso, urgência e necessidade de desmontagem",
      "Cama de casal com colchão: orçamento conforme acesso e piso",
      "Armário roupeiro: valor depende do número de portas e piso",
      "Frigorífico ou máquina de lavar: orçamento personalizado",
      "Esvaziamento de apartamento: orçamento conforme volume total e tipologia",
    ],
    ctaText: "Precisa de recolha de móveis em Monte Abraão? Envie fotos e respondemos em minutos.",
  },

  // ---------------------------------------------------------------------------
  // MONTE ABRAÃO - RECOLHA DE ENTULHO
  // ---------------------------------------------------------------------------
  "recolha-entulho-monte-abraao": {
    citySlug: "monte-abraao",
    serviceSlug: "recolha-entulho",
    metaTitle: "Recolha de Entulho em Monte Abraão - Obras em Queluz e Massamá | CLYON",
    metaDescription:
      "Recolha de entulho de obras em Monte Abraão, Queluz e Massamá. Contentores e sacos big bag. Orçamento grátis em minutos.",
    h1: "Recolha de Entulho de Obras em Monte Abraão",
    localIntro:
      "Monte Abraão e Massamá têm muitos apartamentos dos anos 80-90 que estão a ser renovados. Remodelações de casas de banho, cozinhas e demolição de divisórias geram entulho que precisa de ser retirado rapidamente para a obra avançar. A CLYON recolhe entulho em sacos big bag ou contentor, adaptando o serviço ao volume da obra e ao espaço disponível no prédio.",
    accessNotes:
      "A maioria dos prédios em Monte Abraão tem elevador, mas o entulho é pesado e sujo. Trabalhamos com sacos resistentes e protegemos as zonas comuns durante o transporte. Para obras maiores, podemos deixar contentor na rua se houver licença.",
    neighborhoodHighlight:
      "As zonas com mais obras de remodelação em Monte Abraão são os edifícios junto à estação de comboio e as urbanizações de Massamá Norte. São apartamentos familiares em processo de modernização.",
    nearbyAreas: ["Queluz", "Massamá", "Sintra", "Amadora"],
    faqs: [
      {
        q: "A CLYON recolhe entulho de obras em Monte Abraão?",
        a: "Sim. Recolhemos entulho de remodelações em Monte Abraão, Queluz e Massamá. Trabalhamos com sacos big bag para obras pequenas ou contentores para volumes maiores.",
      },
      {
        q: "Podem recolher entulho de um apartamento em Monte Abraão?",
        a: "Sim. Subimos ao apartamento, ensacamos o entulho se necessário e transportamos até à carrinha. Protegemos as zonas comuns do prédio durante o trabalho.",
      },
      {
        q: "Quanto custa a recolha de entulho em Monte Abraão?",
        a: "O valor depende do volume de entulho, tipo de resíduos e facilidade de acesso. Envie fotos da obra para recebermos um orçamento personalizado.",
      },
      {
        q: "Fornecem contentor para obras em Monte Abraão?",
        a: "Sim, fornecemos contentores de vários tamanhos. O contentor fica no local o tempo combinado. É necessário verificar se há espaço na rua ou garagem do prédio.",
      },
    ],
    pricingNotes: [
      "Sacos big bag: orçamento conforme volume",
      "Contentor pequeno: orçamento conforme duração",
      "Remodelação de WC: orçamento personalizado",
      "Demolição de divisória: orçamento personalizado",
    ],
    ctaText: "Obra em Monte Abraão? Envie fotos do entulho para orçamento grátis.",
  },

  // ---------------------------------------------------------------------------
  // MONTE ABRAÃO - ESVAZIAMENTO DE CASAS
  // ---------------------------------------------------------------------------
  "esvaziamento-casas-monte-abraao": {
    citySlug: "monte-abraao",
    serviceSlug: "esvaziamento-casas",
    metaTitle: "Esvaziamento de Casas em Monte Abraão - Heranças e Mudanças | CLYON",
    metaDescription:
      "Esvaziamento completo de apartamentos em Monte Abraão, Queluz e Massamá. Heranças, mudanças e entregas de imóveis. Orçamento grátis.",
    h1: "Esvaziamento de Casas e Apartamentos em Monte Abraão",
    localIntro:
      "Precisa de esvaziar um apartamento em Monte Abraão? A CLYON faz esvaziamento completo de casas para heranças, mudanças, entregas de imóveis arrendados e limpezas de recheios acumulados. Retiramos todos os móveis, electrodomésticos, roupa, decoração e tralha — o apartamento fica completamente vazio e pronto para entrega ou nova ocupação.",
    accessNotes:
      "Monte Abraão tem prédios com elevador na maioria, o que facilita o esvaziamento. Para apartamentos maiores ou com muito recheio, podemos precisar de fazer várias viagens ou usar equipa reforçada.",
    neighborhoodHighlight:
      "Os pedidos de esvaziamento em Monte Abraão vêm sobretudo de heranças (famílias que precisam de limpar casa de familiar falecido) e de senhorios que recuperam apartamentos arrendados com recheio deixado por inquilinos.",
    nearbyAreas: ["Queluz", "Massamá", "Sintra", "Amadora"],
    faqs: [
      {
        q: "A CLYON faz esvaziamento de apartamentos em Monte Abraão?",
        a: "Sim. Fazemos esvaziamento completo de apartamentos T1 a T4 em Monte Abraão, Queluz e Massamá. Retiramos tudo: móveis, electrodomésticos, roupa, decoração e lixo acumulado.",
      },
      {
        q: "Quanto custa esvaziar um apartamento em Monte Abraão?",
        a: "O valor depende da tipologia do apartamento, volume de recheio e facilidade de acesso. Um T2 standard em Monte Abraão tem um preço diferente de um T3 cheio até ao tecto. Enviamos orçamento após ver fotos.",
      },
      {
        q: "Fazem esvaziamento de heranças em Monte Abraão?",
        a: "Sim. Esvaziamento de heranças é um dos nossos serviços mais frequentes. Tratamos do recheio com respeito, separamos o que pode ser doado ou reciclado, e deixamos o imóvel pronto para venda ou arrendamento.",
      },
      {
        q: "Podem limpar o apartamento depois do esvaziamento?",
        a: "Sim. Após retirar o recheio, podemos fazer uma limpeza básica ou profunda conforme necessário. É um serviço adicional que muitos clientes pedem para entregar o imóvel em boas condições.",
      },
      {
        q: "Quanto tempo demora a esvaziar um apartamento em Monte Abraão?",
        a: "Um T2 standard pode ser esvaziado num dia. Apartamentos maiores ou com muito recheio podem precisar de mais tempo. Combinamos sempre o prazo antes de começar.",
      },
    ],
    pricingNotes: [
      "T1 com recheio normal: orçamento personalizado",
      "T2 com recheio normal: orçamento personalizado",
      "T3 ou maior: orçamento conforme volume",
      "Limpeza adicional: orçamento à parte",
    ],
    ctaText: "Precisa de esvaziar um apartamento em Monte Abraão? Envie fotos para orçamento.",
  },

  // ---------------------------------------------------------------------------
  // QUELUZ
  // ---------------------------------------------------------------------------
  "recolha-moveis-queluz": {
    citySlug: "queluz",
    serviceSlug: "recolha-moveis",
    metaTitle: "Recolha de Móveis em Queluz - Belas e Monte Abraão | CLYON",
    metaDescription:
      "Recolha de móveis usados em Queluz, Belas e Monte Abraão. Sofás, camas, armários e electrodomésticos. Empresa local, orçamento grátis em minutos.",
    h1: "Recolha de Móveis em Queluz - Sofás, Camas e Armários",
    localIntro:
      "Precisa de retirar móveis em Queluz? A CLYON faz recolha de sofás, camas, armários e electrodomésticos em todo o concelho: centro de Queluz, Belas, Monte Abraão e Massamá. Queluz tem uma mistura interessante de zonas históricas (perto do Palácio) e urbanizações modernas, e conhecemos bem as diferenças de acesso entre elas.",
    accessNotes:
      "O centro histórico de Queluz tem algumas ruas mais estreitas e prédios antigos. As zonas mais recentes (Monte Abraão, Massamá Norte) têm excelentes acessos e elevadores. Avaliamos sempre antes de dar preço.",
    neighborhoodHighlight:
      "Queluz é uma freguesia grande com muitos apartamentos. Os pedidos mais frequentes vêm de mudanças, renovações de apartamentos arrendados e esvaziamentos de heranças.",
    nearbyAreas: ["Monte Abraão", "Massamá", "Sintra", "Amadora", "Belas"],
    faqs: [
      {
        q: "A CLYON faz recolha de móveis em Queluz?",
        a: "Sim. Queluz, Belas e Monte Abraão estão na nossa área de cobertura. Respondemos rapidamente a pedidos na zona.",
      },
      {
        q: "Quanto custa recolher móveis em Queluz?",
        a: "O valor depende do acesso, piso e volume. Queluz tem uma mistura de edifícios antigos e modernos — avaliamos sempre antes de confirmar o preço. Envie fotos para orçamento personalizado.",
      },
      {
        q: "Podem ir ao Palácio de Queluz?",
        a: "Trabalhamos em toda a freguesia de Queluz, incluindo a zona histórica perto do Palácio. Nessa zona os acessos podem ser mais difíceis, mas resolvemos.",
      },
      {
        q: "Fazem recolha em Belas?",
        a: "Sim. Belas faz parte da nossa cobertura. É uma zona com muitas moradias e condomínios, geralmente com bons acessos.",
      },
      {
        q: "Recolhem electrodomésticos junto com os móveis em Queluz?",
        a: "Sim. Frigoríficos, máquinas de lavar, fogões, TVs - levamos tudo no mesmo serviço. Pode ser mais eficiente avaliar vários itens no mesmo pedido.",
      },
    ],
    pricingNotes: [
      "Sofá: orçamento conforme volume, acesso, urgência e necessidade de desmontagem",
      "Cama de casal com colchão: orçamento conforme acesso e piso",
      "Armário roupeiro: valor depende do número de portas e piso",
      "Frigorífico ou máquina de lavar: orçamento personalizado",
      "Esvaziamento de apartamento: orçamento conforme volume total e tipologia",
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
    metaDescription:
      "Recolha de móveis usados em Carnaxide, Linda-a-Velha e Queijas. Sofás, camas, armários e electrodomésticos. Orçamento grátis em minutos.",
    h1: "Recolha de Móveis em Carnaxide - Sofás, Camas e Armários",
    localIntro:
      "Precisa de retirar móveis em Carnaxide? A CLYON faz recolha de sofás, camas, armários e electrodomésticos em toda a freguesia e zonas vizinhas: Linda-a-Velha, Queijas, Alto da Loba e Miraflores. Carnaxide é uma zona residencial moderna com excelentes acessos pelo IC19 e A5, permitindo-nos chegar rapidamente e oferecer preços competitivos.",
    accessNotes:
      "Carnaxide tem maioritariamente prédios recentes com elevador e bons acessos. Algumas urbanizações fechadas (como o Alto da Loba) requerem coordenação prévia para entrada — o acesso pode influenciar o orçamento e deve ser confirmado antes da marcação.",
    neighborhoodHighlight:
      "Carnaxide e Linda-a-Velha são zonas muito procuradas por famílias, com muitos apartamentos em condomínios modernos. Os pedidos mais frequentes são recolha de sofás, camas de casal e mobília de quarto durante mudanças ou renovações.",
    nearbyAreas: ["Oeiras", "Lisboa", "Amadora", "Algés"],
    faqs: [
      {
        q: "A CLYON faz recolha de móveis em Carnaxide?",
        a: "Sim. Carnaxide, Linda-a-Velha e Queijas estão na nossa área de cobertura regular. Conseguimos responder rapidamente porque o acesso pelo IC19 é muito bom.",
      },
      {
        q: "Quanto custa recolher um sofá em Carnaxide?",
        a: "O valor depende do piso, acesso e dimensões. A maioria dos prédios em Carnaxide tem elevador, o que favorece um custo mais baixo. Envie fotos para orçamento personalizado.",
      },
      {
        q: "Podem entrar em condomínios fechados em Carnaxide?",
        a: "Sim. Trabalhamos regularmente em condomínios fechados no Alto da Loba e outras urbanizações. Basta coordenar connosco a entrada ou deixar o nome na portaria.",
      },
      {
        q: "Recolhem em Linda-a-Velha e Queijas?",
        a: "Sim. Linda-a-Velha, Queijas e todo o concelho de Oeiras são servidos pela CLYON. Podemos combinar recolhas em várias moradas próximas.",
      },
      {
        q: "Fazem esvaziamento de apartamentos em Carnaxide?",
        a: "Sim. Fazemos esvaziamento completo de apartamentos para mudanças, heranças ou fim de arrendamento. Retiramos móveis, electrodomésticos e tralha - deixamos o espaço vazio.",
      },
    ],
    pricingNotes: [
      "Sofá: orçamento conforme volume, acesso, urgência e necessidade de desmontagem",
      "Cama de casal com colchão: orçamento conforme acesso e piso",
      "Armário roupeiro: valor depende do número de portas e piso",
      "Frigorífico ou máquina de lavar: orçamento personalizado",
      "Esvaziamento de apartamento: orçamento conforme volume total e tipologia",
    ],
    ctaText: "Precisa de recolha de móveis em Carnaxide? Envie fotos e respondemos em minutos.",
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
    localIntro: "Em Lisboa, a CLYON atua em todas as freguesias, desde o centro histórico até às zonas mais recentes como o Parque das Nações.",
    landmarks: ["Baixa-Chiado", "Alfama", "Parque das Nações", "Benfica", "Campo de Ourique", "Areeiro"],
    accessNotes: "Nos bairros históricos (Alfama, Mouraria, Graça), os acessos são frequentemente por escadas estreitas.",
    nearbyAreas: ["Amadora", "Odivelas", "Loures", "Oeiras"],
  },
  almada: {
    slug: "almada",
    name: "Almada",
    region: "margem-sul",
    localIntro: "Em Almada, somos a escolha local para recolhas rápidas. Cobrimos desde a Costa da Caparica até ao Pragal e Cacilhas.",
    landmarks: ["Costa da Caparica", "Cacilhas", "Pragal", "Feijó", "Cova da Piedade", "Almada Velha"],
    accessNotes: "O centro de Almada e Cacilhas têm ruas mais estreitas. A Costa da Caparica tem bons acessos.",
    nearbyAreas: ["Seixal", "Lisboa", "Setúbal"],
  },
  seixal: {
    slug: "seixal",
    name: "Seixal",
    region: "margem-sul",
    localIntro: "No Seixal, estamos mesmo ao lado. A nossa sede fica em Amora, permitindo tempos de resposta imbatíveis.",
    landmarks: ["Amora", "Corroios", "Arrentela", "Paio Pires", "Fernão Ferro", "Cruz de Pau"],
    accessNotes: "O Seixal tem zonas urbanas com bons acessos e zonas mais rurais com moradias.",
    nearbyAreas: ["Almada", "Barreiro", "Sesimbra", "Setúbal"],
  },
  cascais: {
    slug: "cascais",
    name: "Cascais",
    region: "lisboa",
    localIntro: "Em Cascais, atuamos desde a linha de costa até ao interior do concelho, incluindo Estoril, Parede e Carcavelos.",
    landmarks: ["Centro de Cascais", "Estoril", "Parede", "Carcavelos", "São Domingos de Rana", "Alcabideche"],
    accessNotes: "As zonas residenciais de Cascais têm geralmente bons acessos. Condomínios fechados requerem coordenação.",
    nearbyAreas: ["Oeiras", "Sintra", "Lisboa"],
  },
  sintra: {
    slug: "sintra",
    name: "Sintra",
    region: "lisboa",
    localIntro: "Em Sintra, cobrimos desde a zona histórica até às urbanizações de Mem Martins, Rio de Mouro e Cacém.",
    landmarks: ["Centro histórico de Sintra", "Mem Martins", "Rio de Mouro", "Cacém", "Queluz", "Agualva"],
    accessNotes: "Na serra de Sintra e centro histórico, os acessos podem ser desafiantes. As zonas urbanas têm bons acessos.",
    nearbyAreas: ["Amadora", "Cascais", "Oeiras", "Mafra"],
  },
  setubal: {
    slug: "setubal",
    name: "Setúbal",
    region: "setubal",
    localIntro: "Em Setúbal, somos a referência para recolhas em toda a cidade e arredores, desde a Avenida Luísa Todi até Azeitão.",
    landmarks: ["Centro histórico", "Avenida Luísa Todi", "Bairro Azul", "Manteigadas", "Arrábida", "Azeitão"],
    accessNotes: "O centro de Setúbal tem zonas com estacionamento limitado. Azeitão tem quintas com acessos variados.",
    nearbyAreas: ["Palmela", "Sesimbra", "Seixal", "Barreiro"],
  },
  oeiras: {
    slug: "oeiras",
    name: "Oeiras",
    region: "lisboa",
    localIntro: "Em Oeiras, operamos em todas as freguesias, com destaque para Algés, Carnaxide, Linda-a-Velha e Paço de Arcos.",
    landmarks: ["Algés", "Carnaxide", "Linda-a-Velha", "Paço de Arcos", "Taguspark", "Porto Salvo"],
    accessNotes: "Oeiras tem excelentes acessos rodoviários. As zonas empresariais facilitam operações de maior escala.",
    nearbyAreas: ["Lisboa", "Amadora", "Cascais", "Sintra"],
  },
  carnaxide: {
    slug: "carnaxide",
    name: "Carnaxide",
    region: "lisboa",
    localIntro: "Em Carnaxide, atuamos em toda a freguesia incluindo Linda-a-Velha, Queijas e as zonas residenciais junto ao IC19. Carnaxide combina urbanizações modernas com condomínios fechados e prédios tradicionais.",
    landmarks: ["Centro de Carnaxide", "Linda-a-Velha", "Queijas", "Urbanização do Alto da Loba", "Fórum Oeiras", "Estádio de Oeiras"],
    accessNotes: "Carnaxide tem excelentes acessos pelo IC19 e A5. A maioria dos prédios são recentes e têm elevador. Algumas urbanizações fechadas requerem coordenação prévia para entrada.",
    nearbyAreas: ["Oeiras", "Lisboa", "Amadora", "Algés"],
  },
  amadora: {
    slug: "amadora",
    name: "Amadora",
    region: "lisboa",
    localIntro: "Na Amadora, prestamos serviços em todas as freguesias, com foco especial na Reboleira, Alfragide e Damaia.",
    landmarks: ["Alfragide", "Reboleira", "Damaia", "Brandoa", "Venda Nova", "Mina de Água"],
    accessNotes: "A maioria dos prédios na Amadora tem elevador ou acessos razoáveis.",
    nearbyAreas: ["Lisboa", "Sintra", "Odivelas", "Oeiras"],
  },
  barreiro: {
    slug: "barreiro",
    name: "Barreiro",
    region: "margem-sul",
    localIntro: "No Barreiro, atuamos em todo o concelho, desde a zona ribeirinha até ao Alto do Seixalinho e Verderena.",
    landmarks: ["Centro do Barreiro", "Alto do Seixalinho", "Verderena", "Lavradio", "Santo António da Charneca", "Coina"],
    accessNotes: "O Barreiro tem uma mistura de zonas industriais reconvertidas e áreas residenciais.",
    nearbyAreas: ["Seixal", "Moita", "Montijo", "Setúbal"],
  },
  palmela: {
    slug: "palmela",
    name: "Palmela",
    region: "setubal",
    localIntro: "Em Palmela, cobrimos todo o concelho incluindo Pinhal Novo, Quinta do Anjo e a zona histórica.",
    landmarks: ["Centro de Palmela", "Pinhal Novo", "Quinta do Anjo", "Poceirão", "Marateca", "Águas de Moura"],
    accessNotes: "Pinhal Novo tem excelentes acessos. A zona histórica de Palmela tem ruas mais estreitas.",
    nearbyAreas: ["Setúbal", "Seixal", "Montijo", "Sesimbra"],
  },
  sesimbra: {
    slug: "sesimbra",
    name: "Sesimbra",
    region: "setubal",
    localIntro: "Em Sesimbra, atuamos desde a vila piscatória até às praias e à Quinta do Conde.",
    landmarks: ["Centro de Sesimbra", "Praia da California", "Lagoa de Albufeira", "Aldeia do Meco", "Quinta do Conde"],
    accessNotes: "O centro de Sesimbra tem ruas estreitas. Quinta do Conde tem urbanizações com bons acessos.",
    nearbyAreas: ["Seixal", "Setúbal", "Almada", "Palmela"],
  },
  loures: {
    slug: "loures",
    name: "Loures",
    region: "lisboa",
    localIntro: "Em Loures, cobrimos desde Sacavém e Moscavide até às zonas mais rurais como Lousa e Bucelas.",
    landmarks: ["Sacavém", "Moscavide", "Portela", "Camarate", "Santo António dos Cavaleiros", "Bobadela"],
    accessNotes: "As zonas urbanas de Loures têm bons acessos. Algumas freguesias rurais têm estradas mais estreitas.",
    nearbyAreas: ["Lisboa", "Odivelas", "Vila Franca de Xira"],
  },
  odivelas: {
    slug: "odivelas",
    name: "Odivelas",
    region: "lisboa",
    localIntro: "Em Odivelas, atuamos em todo o concelho, incluindo Ramada, Pontinha, Caneças e Famões.",
    landmarks: ["Centro de Odivelas", "Ramada", "Pontinha", "Caneças", "Famões", "Olival Basto"],
    accessNotes: "Odivelas tem uma mistura de prédios mais antigos e urbanizações recentes com elevador.",
    nearbyAreas: ["Lisboa", "Loures", "Amadora", "Sintra"],
  },
  moita: {
    slug: "moita",
    name: "Moita",
    region: "margem-sul",
    localIntro: "Na Moita, cobrimos todas as freguesias incluindo Baixa da Banheira, Alhos Vedros e Vale da Amoreira.",
    landmarks: ["Baixa da Banheira", "Alhos Vedros", "Vale da Amoreira", "Moita", "Gaio-Rosário"],
    accessNotes: "A Moita tem zonas residenciais com bons acessos. Algumas áreas mais antigas têm ruas mais estreitas.",
    nearbyAreas: ["Barreiro", "Montijo", "Alcochete", "Seixal"],
  },
  montijo: {
    slug: "montijo",
    name: "Montijo",
    region: "margem-sul",
    localIntro: "No Montijo, atuamos em todo o concelho, beneficiando da ponte Vasco da Gama para ligação rápida a Lisboa.",
    landmarks: ["Centro do Montijo", "Afonsoeiro", "Alto Estanqueiro", "Sarilhos Grandes", "Canha", "Pegões"],
    accessNotes: "O Montijo tem bons acessos na zona urbana. As freguesias rurais podem ter estradas mais estreitas.",
    nearbyAreas: ["Alcochete", "Moita", "Palmela", "Lisboa"],
  },
  alcochete: {
    slug: "alcochete",
    name: "Alcochete",
    region: "margem-sul",
    localIntro: "Em Alcochete, servimos todo o concelho com especial atenção ao centro histórico e às novas urbanizações.",
    landmarks: ["Centro histórico", "Urbanização do Freeport", "Passil", "Samouco"],
    accessNotes: "O centro histórico de Alcochete tem ruas mais estreitas. As zonas novas têm excelentes acessos.",
    nearbyAreas: ["Montijo", "Moita", "Palmela", "Setúbal"],
  },
  "monte-abraao": {
    slug: "monte-abraao",
    name: "Monte Abraão",
    region: "lisboa",
    localIntro: "Monte Abraão, no concelho de Sintra, é uma zona urbana densa com excelentes acessos pela IC19 e linha de comboio. A CLYON serve toda a freguesia com resposta rápida.",
    landmarks: ["Centro de Monte Abraão", "Estação de Monte Abraão", "Massamá", "Queluz"],
    accessNotes: "Monte Abraão tem muitos prédios com elevador, facilitando a recolha de móveis. As ruas são geralmente acessíveis para a nossa carrinha.",
    nearbyAreas: ["Queluz", "Massamá", "Sintra", "Amadora"],
  },
  queluz: {
    slug: "queluz",
    name: "Queluz",
    region: "lisboa",
    localIntro: "Queluz, no concelho de Sintra, combina o charme histórico do Palácio de Queluz com zonas residenciais modernas. A CLYON cobre toda a freguesia, incluindo Belas e Monte Abraão.",
    landmarks: ["Palácio de Queluz", "Centro de Queluz", "Belas", "Monte Abraão", "Massamá Norte"],
    accessNotes: "Queluz tem uma mistura de prédios antigos no centro e edifícios modernos com elevador nas zonas mais recentes. Adaptamos a equipa ao tipo de acesso.",
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
