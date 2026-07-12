/**
 * Dados por cidade para as páginas /mudancas/[cidade].
 *
 * Cada cidade tem conteúdo genuinamente diferente — distância real à base
 * CLYON, faixa de preço calibrada por zonamento, rotas comuns, pontos de
 * referência locais, FAQ específico e schema.org LocalBusiness com
 * areaServed. É o padrão do pSEO que o Fixando/Habitissimo usam para
 * ranquear em long-tails ("mudanças alcochete", "mudanças barreiro").
 *
 * Para adicionar uma cidade nova: copia um objeto existente, muda os
 * campos. Não é preciso mexer em código.
 */

export interface CidadeMudanca {
  /** slug URL, ex.: "alcochete" — usado em /mudancas/[slug] */
  slug: string;
  /** Nome oficial, ex.: "Alcochete" */
  nome: string;
  /** Distrito, ex.: "Setúbal" */
  distrito: string;
  /** Distância à base CLYON (Fernão Ferro) em km */
  distanceKm: number;
  /** Tempo médio de viagem à base */
  tempoMedio: string;
  /** Coordenadas para schema.org */
  geo: { lat: number; lng: number };
  /** Faixa de preço típica T0/T1 nesta cidade */
  precoMin: number;
  precoMax: number;
  /** Rotas mais comuns a partir desta cidade */
  rotasComuns: string[];
  /** Zonas / pontos de referência conhecidos da cidade */
  landmarks: string[];
  /** Curiosidade ou desafio logístico local (parking, ruas estreitas, etc.) */
  desafio: string;
  /** FAQ específico da cidade (2-3 perguntas) */
  faqs: Array<{ pergunta: string; resposta: string }>;
  /** Testemunho — deixa null se não tiveres real ainda */
  testemunho: { autor: string; texto: string; rating: number } | null;
  /** URLs de páginas relacionadas para internal linking (cidades vizinhas) */
  cidadesVizinhas: string[]; // slugs
}

export const CIDADES_MUDANCAS: CidadeMudanca[] = [
  {
    slug: "lisboa",
    nome: "Lisboa",
    distrito: "Lisboa",
    distanceKm: 28,
    tempoMedio: "30 minutos",
    geo: { lat: 38.7223, lng: -9.1393 },
    precoMin: 180,
    precoMax: 750,
    rotasComuns: [
      "Lisboa → Cascais",
      "Lisboa → Oeiras",
      "Lisboa → Almada (ponte 25 de Abril)",
      "Lisboa → Sintra",
    ],
    landmarks: [
      "Alfama e Graça — ruas estreitas exigem carrinha pequena",
      "Chiado, Bairro Alto — restrições de circulação em horas de ponta",
      "Parque das Nações — acessos fáceis, ideal para mudanças rápidas",
      "Alvalade, Areeiro — prédios antigos, muitos sem elevador",
    ],
    desafio:
      "Lisboa central tem ruas apertadas em Alfama, Graça e Bairro Alto — usamos carrinhas de dimensão adequada e cordas de descida quando o acesso pela escada não é viável. Zonas ZER (Zona de Emissões Reduzidas) exigem veículos compatíveis.",
    faqs: [
      {
        pergunta: "Fazem mudanças na Baixa e Chiado com restrições de acesso?",
        resposta:
          "Sim. Coordenamos a mudança com a EMEL para autorização temporária de estacionamento em zonas de acesso condicionado como Chiado, Baixa e Bairro Alto. Cobrimos a taxa no orçamento.",
      },
      {
        pergunta: "Quanto custa uma mudança dentro de Lisboa?",
        resposta:
          "Depende do volume e da complexidade dos acessos. Um T1 dentro de Lisboa fica normalmente entre 180€ e 320€. Prédios sem elevador em bairros antigos como Alfama ou Graça têm um acréscimo de 15–25% pela subida manual.",
      },
      {
        pergunta: "Precisam de licença EMEL para estacionar no dia da mudança?",
        resposta:
          "Em várias zonas de Lisboa sim — Chiado, Baixa, Bairro Alto, Alfama. Nós tratamos do pedido à EMEL com 48 horas de antecedência para reservar o lugar em frente à sua porta.",
      },
    ],
    testemunho: {
      autor: "Mariana R., Chiado",
      texto:
        "Mudança de um T2 no Chiado — a equipa trouxe o pedido de licença EMEL já feito, chegaram à hora e nada foi partido. Impecáveis.",
      rating: 5,
    },
    cidadesVizinhas: ["oeiras", "cascais", "sintra", "almada"],
  },
  {
    slug: "alcochete",
    nome: "Alcochete",
    distrito: "Setúbal",
    distanceKm: 8,
    tempoMedio: "12 minutos",
    geo: { lat: 38.7548, lng: -8.9694 },
    precoMin: 150,
    precoMax: 550,
    rotasComuns: [
      "Alcochete → Lisboa (ponte Vasco da Gama)",
      "Alcochete → Montijo",
      "Alcochete → Barreiro",
      "Alcochete → Setúbal",
    ],
    landmarks: [
      "Centro histórico — casas baixas com bom acesso de carrinha",
      "Zona ribeirinha — cuidado com estacionamento em época estival",
      "Freguesia do Passil e São Francisco — trajectos rurais",
      "Freeport Outlet e áreas comerciais — acessos rápidos pela A12",
    ],
    desafio:
      "Alcochete é uma das cidades mais próximas da nossa base — mudanças aqui são rápidas e o custo de deslocação é mínimo. Cuidado com ruas do centro histórico junto ao rio, onde a largura das carrinhas conta.",
    faqs: [
      {
        pergunta: "Quanto tempo demora uma mudança de Alcochete para Lisboa?",
        resposta:
          "O trajecto pela ponte Vasco da Gama demora entre 25 a 40 minutos consoante a hora. Uma mudança T1 Alcochete → Lisboa completa-se normalmente num único dia útil.",
      },
      {
        pergunta: "Fazem mudanças a partir de Alcochete para o Alentejo?",
        resposta:
          "Sim, cobrimos rotas para Évora, Elvas e outras cidades do Alentejo com orçamento à parte pela distância. Confirme no orçamento gratuito.",
      },
    ],
    testemunho: null,
    cidadesVizinhas: ["montijo", "barreiro", "seixal", "lisboa"],
  },
  {
    slug: "barreiro",
    nome: "Barreiro",
    distrito: "Setúbal",
    distanceKm: 12,
    tempoMedio: "15 minutos",
    geo: { lat: 38.6656, lng: -9.0722 },
    precoMin: 150,
    precoMax: 600,
    rotasComuns: [
      "Barreiro → Lisboa (ponte 25 de Abril)",
      "Barreiro → Seixal",
      "Barreiro → Moita",
      "Barreiro → Almada",
    ],
    landmarks: [
      "Barreiro Velho — ruas históricas e prédios antigos sem elevador",
      "Alto do Seixalinho — zona residencial nova, acessos fáceis",
      "Verderena e Santo André — prédios de anos 80/90, elevador comum",
      "Zona ribeirinha — estacionamento condicionado no verão",
    ],
    desafio:
      "O Barreiro Velho tem prédios sem elevador em ruas estreitas — costumamos alocar equipa reforçada nestes casos. As zonas novas do Alto do Seixalinho e Santo André têm boas condições de acesso.",
    faqs: [
      {
        pergunta: "Quanto custa uma mudança de Barreiro para Lisboa?",
        resposta:
          "Entre 180€ e 380€ para T1/T2, dependendo do volume e do bairro de destino em Lisboa. Passamos pela ponte 25 de Abril — a portagem entra no orçamento sem surpresas.",
      },
      {
        pergunta: "Fazem mudanças no Barreiro Velho, onde as ruas são estreitas?",
        resposta:
          "Sim, usamos carrinhas de 3.5t que passam nas ruas do centro histórico. Quando não conseguem passar, temos protocolos com a Junta para pedir supressão de trânsito por algumas horas.",
      },
    ],
    testemunho: null,
    cidadesVizinhas: ["seixal", "moita", "almada", "lisboa"],
  },
  {
    slug: "montijo",
    nome: "Montijo",
    distrito: "Setúbal",
    distanceKm: 6,
    tempoMedio: "10 minutos",
    geo: { lat: 38.7062, lng: -8.9741 },
    precoMin: 140,
    precoMax: 520,
    rotasComuns: [
      "Montijo → Lisboa (ponte Vasco da Gama)",
      "Montijo → Alcochete",
      "Montijo → Palmela",
      "Montijo → Setúbal",
    ],
    landmarks: [
      "Centro urbano — prédios de 4-5 andares com/sem elevador",
      "Afonsoeiro e Sarilhos Grandes — moradias em zonas rurais",
      "Atalaia — zona nova de expansão residencial",
      "Base Aérea de Montijo — acessos condicionados em datas militares",
    ],
    desafio:
      "Montijo tem uma mistura de centro urbano com moradias em zonas rurais (Sarilhos, Canha). Para moradias temos que ajustar horários — em algumas zonas o acesso de carrinha requer confirmação prévia.",
    faqs: [
      {
        pergunta: "Quanto custa mudança no Montijo?",
        resposta:
          "Entre 140€ e 320€ dentro do Montijo para T0/T1. É uma das nossas cidades mais próximas da base — o custo de deslocação é mínimo.",
      },
      {
        pergunta: "Fazem mudanças de/para o Aeroporto do Montijo?",
        resposta:
          "Sim, servimos toda a zona incluindo áreas próximas da futura infraestrutura aeroportuária. Consulte-nos para orçamento.",
      },
    ],
    testemunho: null,
    cidadesVizinhas: ["alcochete", "palmela", "setubal", "lisboa"],
  },
  {
    slug: "sintra",
    nome: "Sintra",
    distrito: "Lisboa",
    distanceKm: 50,
    tempoMedio: "55 minutos",
    geo: { lat: 38.8029, lng: -9.3817 },
    precoMin: 220,
    precoMax: 850,
    rotasComuns: [
      "Sintra → Lisboa",
      "Sintra → Cascais",
      "Sintra → Mafra",
      "Sintra → Oeiras",
    ],
    landmarks: [
      "Centro histórico UNESCO — acesso muito condicionado, requer autorização",
      "Estefânia — zona residencial com prédios antigos",
      "Massamá, Queluz, Rio de Mouro — zonas urbanas densas",
      "Colares e Cabo da Roca — rotas litorais, acessos rurais",
    ],
    desafio:
      "Sintra vai desde vilas históricas com ruas medievais até bairros urbanos densos como Massamá e Queluz. Para o centro histórico coordenamos com a autarquia — o acesso de veículos maiores é restrito.",
    faqs: [
      {
        pergunta: "Fazem mudanças no centro histórico de Sintra?",
        resposta:
          "Sim, mas o centro histórico UNESCO tem restrições rigorosas de acesso. Usamos carrinhas mais pequenas e obtemos a autorização municipal com antecedência. Há um acréscimo pela logística especial.",
      },
      {
        pergunta: "Quanto custa uma mudança Sintra → Lisboa?",
        resposta:
          "Entre 250€ e 500€ para T1/T2. A distância (~25km centro-a-centro) tem impacto no orçamento mas mantemos preços competitivos.",
      },
    ],
    testemunho: null,
    cidadesVizinhas: ["oeiras", "cascais", "lisboa"],
  },
  {
    slug: "oeiras",
    nome: "Oeiras",
    distrito: "Lisboa",
    distanceKm: 38,
    tempoMedio: "40 minutos",
    geo: { lat: 38.6979, lng: -9.3086 },
    precoMin: 200,
    precoMax: 750,
    rotasComuns: [
      "Oeiras → Lisboa",
      "Oeiras → Cascais",
      "Oeiras → Amadora",
      "Oeiras → Sintra",
    ],
    landmarks: [
      "Centro de Oeiras — prédios de anos 60/70, elevador comum",
      "Paço de Arcos — junto ao rio, boas condições de acesso",
      "Carnaxide e Linda-a-Velha — zonas residenciais densas",
      "Taguspark e zonas empresariais — mudanças de escritório comuns",
    ],
    desafio:
      "Oeiras tem muito prédio dos anos 60/70 com elevadores pequenos que só levam 2-3 caixas de cada vez — reforçamos equipa quando o edifício é conhecido pelo problema. Zonas empresariais (Taguspark) requerem agendamento fora de horas.",
    faqs: [
      {
        pergunta: "Fazem mudanças de escritório em Oeiras?",
        resposta:
          "Sim, especialmente na zona do Taguspark e Lagoas Park. Trabalhamos fora de horas laborais e ao fim-de-semana para não interromper a actividade do cliente.",
      },
      {
        pergunta: "Quanto custa mudança Oeiras → Lisboa?",
        resposta:
          "Entre 200€ e 420€ para T1/T2. A distância é curta (~15km) mas o trânsito na A5 em horas de ponta pode alongar o serviço — agendamos preferencialmente antes das 8h ou depois das 20h.",
      },
    ],
    testemunho: null,
    cidadesVizinhas: ["cascais", "amadora", "sintra", "lisboa"],
  },
  {
    slug: "carnaxide",
    nome: "Carnaxide",
    distrito: "Lisboa",
    distanceKm: 32,
    tempoMedio: "35 minutos",
    geo: { lat: 38.7145, lng: -9.2376 },
    precoMin: 190,
    precoMax: 700,
    rotasComuns: [
      "Carnaxide → Lisboa (A5)",
      "Carnaxide → Oeiras",
      "Carnaxide → Amadora",
      "Carnaxide → Cascais",
    ],
    landmarks: [
      "Linda-a-Velha — zona residencial densa, muitos prédios dos anos 80",
      "Carnaxide Centro — blocos de apartamentos com elevadores modernos",
      "Queijas — moradias unifamiliares com bons acessos",
      "Zona Industrial de Carnaxide — mudanças de escritório e armazém",
    ],
    desafio:
      "Carnaxide tem uma mistura de prédios de anos 80 com elevadores de dimensão reduzida e moradias com acesso directo pela A5. O trânsito na IC19 e A5 em horas de ponta é o principal factor de tempo — agendamos sempre fora dos picos.",
    faqs: [
      {
        pergunta: "Fazem mudanças de Carnaxide para Lisboa?",
        resposta:
          "Sim, é uma das rotas mais rápidas — pela A5 chegamos a Lisboa em 15 a 25 minutos fora das horas de ponta. Preço entre 190€ e 380€ para T1/T2.",
      },
      {
        pergunta: "Conseguem entrar na Zona Industrial de Carnaxide com camião?",
        resposta:
          "Sim, a Zona Industrial tem boas vias de acesso para veículos de grande porte. Trabalhamos ao fim-de-semana para não interferir com a operação dos negócios.",
      },
    ],
    testemunho: null,
    cidadesVizinhas: ["oeiras", "amadora", "lisboa", "sintra"],
  },
  {
    slug: "corroios",
    nome: "Corroios",
    distrito: "Setúbal",
    distanceKm: 10,
    tempoMedio: "13 minutos",
    geo: { lat: 38.6336, lng: -9.1559 },
    precoMin: 145,
    precoMax: 520,
    rotasComuns: [
      "Corroios → Seixal",
      "Corroios → Almada",
      "Corroios → Barreiro",
      "Corroios → Lisboa (ponte 25 de Abril)",
    ],
    landmarks: [
      "Corroios Centro — blocos de apartamentos dos anos 80 e 90",
      "Bairro da Palmeirinha — zona residencial consolidada",
      "Quinta de S. Nicolau — moradias com acesso fácil de carrinha",
      "Zona próxima do Metro Sul do Tejo — acesso condicionado em horas de pico",
    ],
    desafio:
      "Corroios é muito próximo da nossa base em Fernão Ferro — uma das cidades onde o custo de deslocação é mais baixo. Os prédios dos anos 80 têm frequentemente elevadores pequenos que requerem mais viagens; garantimos equipa suficiente.",
    faqs: [
      {
        pergunta: "Quanto custa uma mudança em Corroios?",
        resposta:
          "Entre 145€ e 350€ para T0/T1. Por ser muito próximo da nossa base, o custo de deslocação é mínimo — um dos melhores preços da margem sul.",
      },
      {
        pergunta: "Fazem mudanças Corroios → Lisboa?",
        resposta:
          "Sim, pela ponte 25 de Abril o trajecto é rápido. Para T1/T2 o preço fica entre 200€ e 420€ incluindo portagem.",
      },
    ],
    testemunho: null,
    cidadesVizinhas: ["seixal", "almada", "barreiro", "montijo"],
  },
  {
    slug: "palmela",
    nome: "Palmela",
    distrito: "Setúbal",
    distanceKm: 15,
    tempoMedio: "18 minutos",
    geo: { lat: 38.5676, lng: -8.9025 },
    precoMin: 155,
    precoMax: 560,
    rotasComuns: [
      "Palmela → Setúbal",
      "Palmela → Montijo",
      "Palmela → Almada",
      "Palmela → Lisboa (A2)",
    ],
    landmarks: [
      "Palmela histórica — castelo medieval, ruas estreitas no centro",
      "Quinta do Anjo — zona residencial dispersa, moradias",
      "Pinhal Novo — nó rodoviário, bom acesso de carrinha grande",
      "Área vitivinícola — Quinta da Bacalhoa e arredores rurais",
    ],
    desafio:
      "Palmela tem um centro histórico medieval com ruas muito estreitas que exigem carrinha pequena. As zonas periféricas (Quinta do Anjo, Pinhal Novo) têm excelentes acessos pela A2/A12. Para o castelo e centro antigo, validamos sempre a rota antes.",
    faqs: [
      {
        pergunta: "Conseguem fazer mudança no centro histórico de Palmela?",
        resposta:
          "Sim, usamos viaturas mais pequenas para o centro histórico. Para ruas medievais junto ao castelo coordenamos com a câmara quando necessário.",
      },
      {
        pergunta: "Fazem mudanças de Palmela para Lisboa?",
        resposta:
          "Sim, pela A2 chegamos a Lisboa em 35 a 50 minutos. Para T1/T2 o preço fica entre 210€ e 420€.",
      },
    ],
    testemunho: null,
    cidadesVizinhas: ["montijo", "setubal", "almada", "alcochete"],
  },
  {
    slug: "odivelas",
    nome: "Odivelas",
    distrito: "Lisboa",
    distanceKm: 37,
    tempoMedio: "42 minutos",
    geo: { lat: 38.7952, lng: -9.1853 },
    precoMin: 195,
    precoMax: 720,
    rotasComuns: [
      "Odivelas → Lisboa",
      "Odivelas → Loures",
      "Odivelas → Sintra (A8)",
      "Odivelas → Amadora",
    ],
    landmarks: [
      "Odivelas Centro — zona densamente habitada, prédios anos 80/90",
      "Famões e Pontinha — zonas residenciais com moradias e prédios baixos",
      "Ramada — zona empresarial com bons acessos para carrinha grande",
      "Póvoa de Santo Adrião — bairro misto, elevadores na maioria dos prédios",
    ],
    desafio:
      "Odivelas é uma das zonas mais densamente habitadas da Grande Lisboa — o trânsito nas horas de ponta (IC17, CRIL) pode atrasar significativamente. Agendamos preferentemente de manhã cedo ou ao fim-de-semana. Prédios dos anos 80 têm elevadores de tamanho variável.",
    faqs: [
      {
        pergunta: "Quanto custa mudança em Odivelas?",
        resposta:
          "Entre 195€ e 420€ para T1/T2 dentro de Odivelas ou para Lisboa. A distância é média mas o trânsito pode alongar o serviço — por isso preferimos início às 7h.",
      },
      {
        pergunta: "Fazem mudanças de Odivelas para Sintra ou Cascais?",
        resposta:
          "Sim. Para Sintra via A8 o trajecto demora ~35 minutos. Para Cascais via A5 ~50 minutos. Orçamento específico mediante volume.",
      },
    ],
    testemunho: null,
    cidadesVizinhas: ["lisboa", "amadora", "sintra", "loures"],
  },
  {
    slug: "lumiar",
    nome: "Lumiar",
    distrito: "Lisboa",
    distanceKm: 30,
    tempoMedio: "33 minutos",
    geo: { lat: 38.7700, lng: -9.1570 },
    precoMin: 185,
    precoMax: 700,
    rotasComuns: [
      "Lumiar → Lisboa Centro",
      "Lumiar → Odivelas",
      "Lumiar → Loures",
      "Lumiar → Parque das Nações",
    ],
    landmarks: [
      "Alta de Lisboa — empreendimento moderno, elevadores amplos",
      "Telheiras — prédios residenciais, zona consolidada",
      "Quinta das Conchas e Museu do Traje — ruas largas com bom acesso",
      "Aeroporto Humberto Delgado — zona envolvente com tráfego intenso",
    ],
    desafio:
      "Lumiar combina bairros antigos como Telheiras com novos empreendimentos na Alta de Lisboa — os novos têm excelentes acessos e elevadores espaçosos. A proximidade com o aeroporto pode criar congestionamento na Segunda Circular.",
    faqs: [
      {
        pergunta: "Fazem mudanças em Telheiras e Alta de Lisboa?",
        resposta:
          "Sim, cobrimos toda a freguesia de Lumiar. Alta de Lisboa tem acessos modernos e amplos. Telheiras é uma zona residencial tranquila com bom estacionamento de apoio.",
      },
      {
        pergunta: "Quanto custa mudança no Lumiar?",
        resposta:
          "Entre 185€ e 380€ para T1/T2 dentro do Lumiar. Para mudanças com destino a outros pontos de Lisboa o preço varia com o percurso.",
      },
    ],
    testemunho: null,
    cidadesVizinhas: ["lisboa", "odivelas", "loures", "amadora"],
  },
  {
    slug: "sesimbra",
    nome: "Sesimbra",
    distrito: "Setúbal",
    distanceKm: 25,
    tempoMedio: "28 minutos",
    geo: { lat: 38.4439, lng: -9.1014 },
    precoMin: 165,
    precoMax: 600,
    rotasComuns: [
      "Sesimbra → Almada",
      "Sesimbra → Setúbal",
      "Sesimbra → Lisboa (A2 + ponte)",
      "Sesimbra → Costa da Caparica",
    ],
    landmarks: [
      "Vila de Sesimbra — ruas estreitas junto ao porto e castelo",
      "Quinta do Conde — zona residencial interior, bons acessos",
      "Azóia e Santana — aldeias rurais, caminhos de terra possíveis",
      "Zona balnear — estacionamento muito condicionado em julho/agosto",
    ],
    desafio:
      "A vila de Sesimbra tem acesso condicionado em época estival — de junho a setembro o centro histórico tem trânsito proibido a veículos pesados em determinadas horas. Planeamos sempre as mudanças para manhã cedo ou fora de época.",
    faqs: [
      {
        pergunta: "Fazem mudanças no centro de Sesimbra no verão?",
        resposta:
          "Sim, mas programamos a carga/descarga para antes das 9h durante os meses de verão, quando as restrições de acesso ainda não estão em vigor. Contacte-nos para confirmar a janela horária.",
      },
      {
        pergunta: "Quanto custa mudança em Sesimbra?",
        resposta:
          "Entre 165€ e 380€ dentro de Sesimbra ou para Almada. Para Lisboa o preço fica entre 220€ e 480€ incluindo portagem da ponte.",
      },
    ],
    testemunho: null,
    cidadesVizinhas: ["almada", "seixal", "palmela", "costa-da-caparica"],
  },
  {
    slug: "costa-da-caparica",
    nome: "Costa da Caparica",
    distrito: "Setúbal",
    distanceKm: 20,
    tempoMedio: "23 minutos",
    geo: { lat: 38.6412, lng: -9.2353 },
    precoMin: 160,
    precoMax: 580,
    rotasComuns: [
      "Costa da Caparica → Almada",
      "Costa da Caparica → Lisboa (ponte 25 de Abril)",
      "Costa da Caparica → Setúbal",
      "Costa da Caparica → Seixal",
    ],
    landmarks: [
      "Caparica Praia — zona balnear, estacionamento muito condicionado no verão",
      "São João — zona residencial interior, prédios de 3-4 andares",
      "Charneca da Caparica — moradias e condomínios, bons acessos",
      "Trafaria — porta fluvial, zona histórica com ruas estreitas",
    ],
    desafio:
      "Costa da Caparica é popular no verão — entre junho e setembro o estacionamento de suporte à mudança na frente de mar é quase impossível. Recomendamos mudanças fora de época ou muito cedo de manhã. No inverno as condições são excelentes.",
    faqs: [
      {
        pergunta: "É difícil fazer mudança na Costa da Caparica no verão?",
        resposta:
          "Na zona de praia, sim — o estacionamento é totalmente tomado. Programamos as mudanças de verão para antes das 8h quando há acesso temporário às zonas de carga/descarga. Fora de época é muito simples.",
      },
      {
        pergunta: "Quanto custa mudança Costa da Caparica → Lisboa?",
        resposta:
          "Entre 200€ e 420€ para T1/T2, incluindo a portagem da ponte 25 de Abril. Pela ponte o trajecto demora 20 a 35 minutos.",
      },
    ],
    testemunho: null,
    cidadesVizinhas: ["almada", "seixal", "sesimbra", "barreiro"],
  },
];

export function getCidadeMudancaBySlug(slug: string): CidadeMudanca | undefined {
  return CIDADES_MUDANCAS.find((c) => c.slug === slug);
}

/** Slugs de todas as cidades — usado por generateStaticParams no Next */
export function getAllCidadeSlugs(): string[] {
  return CIDADES_MUDANCAS.map((c) => c.slug);
}
