/**
 * Dados por cidade para as páginas /mudancas/[cidade].
 *
 * Cada cidade tem conteúdo genuinamente diferente — rotas comuns, pontos de referência locais, FAQ específico e
 * schema.org LocalBusiness com areaServed. É o padrão do pSEO que o
 * Fixando/Habitissimo usam para ranquear em long-tails ("mudanças
 * alcochete", "mudanças barreiro").
 *
 * Para adicionar uma cidade nova: copia um objeto existente, muda os
 * campos. Não é preciso mexer em código.
 *
 * NÃO HÁ PREÇOS AQUI — decisão de 22-08-2026
 *
 * Este ficheiro tinha `precoMin`/`precoMax` por cidade (de 140 a 220 € de
 * piso) e eram esses números que alimentavam o herói, o cartão de faixa, a
 * meta description e o `AggregateOffer` das treze páginas indexadas.
 * O motor factura a mudança a partir de 490 € — sete horas a 70 €/h. Eram
 * 340 € de diferença entre o que o Google mostrava e o que a factura dizia,
 * multiplicados por treze páginas.
 *
 * Os campos foram removidos, e não substituídos por outro número: enquanto o
 * site e o motor não estiverem alinhados, a mudança anuncia orçamento
 * personalizado. As FAQ "quanto custa" ficaram — a pergunta é real e traz
 * tráfego — mas respondem com o que faz variar o preço, não com um valor.
 */

export interface CidadeMudanca {
  /** slug URL, ex.: "alcochete" — usado em /mudancas/[slug] */
  slug: string;
  /** Nome oficial, ex.: "Alcochete" */
  nome: string;
  /** Distrito, ex.: "Setúbal" */
  distrito: string;
  // 30-09-2026: aqui estavam `distanceKm` e `tempoMedio`, a distância à
  // «base CLYON» em Fernão Ferro. A CLYON é uma plataforma: quem faz a
  // mudança é um profissional da zona, a partir da base dele. Os números
  // eram internos e nem batiam com os de cidades-local.ts (Montijo a 6 km
  // aqui e a 16 km lá, Sesimbra a 25 e a 12).
  //
  // ESTE FICHEIRO NÃO IMPORTA NADA, de propósito: o next.config.ts importa-o
  // (getAllCidadeSlugs) e não resolve os caminhos «@/…» que seo-data usa.
  // Por isso o prazo «6 horas» está escrito à mão aqui, e só aqui.
  /** Coordenadas para schema.org */
  geo: { lat: number; lng: number };
  // Aqui estavam `precoMin`/`precoMax`. Ver a nota no topo do ficheiro: o
  // site anunciava a partir de 150 € e o motor factura a partir de 490 €.
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
    geo: { lat: 38.7223, lng: -9.1393 },
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
      "Lisboa central tem ruas apertadas em Alfama, Graça e Bairro Alto — pedem carrinha de dimensão adequada e, às vezes, cordas de descida quando o acesso pela escada não é viável — diga-o no pedido. Zonas ZER (Zona de Emissões Reduzidas) exigem veículos compatíveis.",
    faqs: [
      {
        pergunta: "Fazem mudanças na Baixa e Chiado com restrições de acesso?",
        resposta:
          "Sim. O profissional pode tratar da licença de estacionamento (EMEL ou câmara) em zonas de acesso condicionado como Chiado, Baixa e Bairro Alto; o custo vem discriminado na proposta.",
      },
      {
        pergunta: "Quanto custa uma mudança dentro de Lisboa?",
        resposta:
          "Depende do volume, da complexidade dos acessos e da distância entre as duas moradas — não há tabela que sirva a todos os casos. Prédios sem elevador em bairros antigos como Alfama ou Graça exigem subida manual e mais tempo, e isso pesa. Diga a tipologia e as duas moradas: recebe propostas grátis em até 6 horas.",
      },
      {
        pergunta: "Precisam de licença EMEL para estacionar no dia da mudança?",
        resposta:
          "Em várias zonas de Lisboa sim — Chiado, Baixa, Bairro Alto, Alfama. O profissional pode tratar da licença de estacionamento (EMEL ou câmara); o custo vem discriminado na proposta.",
      },
    ],
    // 30-09-2026: estava aqui um testemunho de «Mariana R., Chiado» que não
    // existe em reviews-data.ts. Testemunho que não se pode mostrar de onde
    // veio não entra.
    testemunho: null,
    cidadesVizinhas: ["oeiras", "cascais", "sintra", "almada"],
  },
  {
    slug: "alcochete",
    nome: "Alcochete",
    distrito: "Setúbal",
    geo: { lat: 38.7548, lng: -8.9694 },
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
      "Alcochete tem, no centro histórico junto ao rio, ruas onde a largura da carrinha conta — diga a rua no pedido, para o profissional vir com a viatura certa.",
    faqs: [
      {
        pergunta: "Quanto tempo demora uma mudança de Alcochete para Lisboa?",
        resposta:
          "O trajecto pela ponte Vasco da Gama demora entre 25 a 40 minutos consoante a hora. Uma mudança T1 Alcochete → Lisboa completa-se normalmente num único dia útil.",
      },
      {
        pergunta: "Fazem mudanças a partir de Alcochete para o Alentejo?",
        resposta:
          "Depende do profissional: alguns fazem rotas para fora da região, com o custo da distância na proposta. Indique o destino no pedido.",
      },
    ],
    testemunho: null,
    cidadesVizinhas: ["montijo", "barreiro", "seixal", "lisboa"],
  },
  {
    slug: "barreiro",
    nome: "Barreiro",
    distrito: "Setúbal",
    geo: { lat: 38.6656, lng: -9.0722 },
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
      "O Barreiro Velho tem prédios sem elevador em ruas estreitas — nestes casos, o profissional pode precisar de mais uma pessoa, e isso vem na proposta. As zonas novas do Alto do Seixalinho e Santo André têm boas condições de acesso.",
    faqs: [
      {
        pergunta: "Quanto custa uma mudança de Barreiro para Lisboa?",
        resposta:
          "Depende do volume, do andar e do bairro de destino em Lisboa. A portagem da ponte entra na proposta, sem surpresas. Recebe propostas grátis em até 6 horas.",
      },
      {
        pergunta: "Fazem mudanças no Barreiro Velho, onde as ruas são estreitas?",
        resposta:
          "Sim. Diga a rua no pedido, para o profissional vir com a carrinha certa para o centro histórico. O profissional pode tratar da licença de estacionamento (EMEL ou câmara); o custo vem discriminado na proposta.",
      },
    ],
    testemunho: null,
    cidadesVizinhas: ["seixal", "moita", "almada", "lisboa"],
  },
  {
    slug: "montijo",
    nome: "Montijo",
    distrito: "Setúbal",
    geo: { lat: 38.7062, lng: -8.9741 },
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
      "Montijo tem uma mistura de centro urbano com moradias em zonas rurais (Sarilhos, Canha). Nas moradias das zonas rurais, o acesso de carrinha deve ser confirmado antes — diga-o no pedido.",
    faqs: [
      {
        pergunta: "Quanto custa mudança no Montijo?",
        resposta:
          "Depende do volume, do andar e dos acessos. Diga a tipologia e as moradas e recebe propostas grátis em até 6 horas.",
      },
      {
        pergunta: "Fazem mudanças de/para o Aeroporto do Montijo?",
        resposta:
          "Sim. O pedido chega aos profissionais que trabalham na zona, incluindo as áreas próximas da futura infraestrutura aeroportuária. Descreva a mudança para receber propostas.",
      },
    ],
    testemunho: null,
    cidadesVizinhas: ["alcochete", "palmela", "setubal", "lisboa"],
  },
  {
    slug: "sintra",
    nome: "Sintra",
    distrito: "Lisboa",
    geo: { lat: 38.8029, lng: -9.3817 },
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
      "Sintra vai desde vilas históricas com ruas medievais até bairros urbanos densos como Massamá e Queluz. No centro histórico, o acesso de veículos maiores é restrito e pede autorização da autarquia.",
    faqs: [
      {
        pergunta: "Fazem mudanças no centro histórico de Sintra?",
        resposta:
          "Sim, mas o centro histórico UNESCO tem restrições rigorosas de acesso e pede carrinhas mais pequenas. O profissional pode tratar da licença de estacionamento (EMEL ou câmara); o custo vem discriminado na proposta.",
      },
      {
        pergunta: "Quanto custa uma mudança Sintra → Lisboa?",
        resposta:
          "A distância (~25 km centro-a-centro) pesa no orçamento, tal como o volume e os acessos nas duas pontas. Não há tabela para esta rota: recebe propostas grátis em até 6 horas.",
      },
    ],
    testemunho: null,
    cidadesVizinhas: ["oeiras", "cascais", "lisboa"],
  },
  {
    slug: "oeiras",
    nome: "Oeiras",
    distrito: "Lisboa",
    geo: { lat: 38.6979, lng: -9.3086 },
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
      "Oeiras tem muito prédio dos anos 60/70 com elevadores pequenos que só levam 2-3 caixas de cada vez — vale a pena dizer no pedido se o elevador é pequeno. Zonas empresariais (Taguspark) costumam pedir mudanças fora de horas.",
    faqs: [
      {
        pergunta: "Fazem mudanças de escritório em Oeiras?",
        resposta:
          "Sim, especialmente na zona do Taguspark e Lagoas Park. Se precisar fora do horário laboral ou ao fim de semana, para não interromper a actividade, diga-o no pedido — as propostas dizem quem o pode fazer.",
      },
      {
        pergunta: "Quanto custa mudança Oeiras → Lisboa?",
        resposta:
          "A distância é curta (~15 km), mas o trânsito na A5 em horas de ponta pode alongar o serviço — por isso muitas mudanças se fazem cedo ou ao fim do dia. O valor depende do volume e dos acessos; recebe propostas grátis em até 6 horas.",
      },
    ],
    testemunho: null,
    cidadesVizinhas: ["cascais", "amadora", "sintra", "lisboa"],
  },
  {
    slug: "carnaxide",
    nome: "Carnaxide",
    distrito: "Lisboa",
    geo: { lat: 38.7145, lng: -9.2376 },
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
      "Carnaxide tem uma mistura de prédios de anos 80 com elevadores de dimensão reduzida e moradias com acesso direto pela A5. O trânsito na IC19 e A5 em horas de ponta é o principal factor de tempo — convém marcar fora dos picos.",
    faqs: [
      {
        pergunta: "Fazem mudanças de Carnaxide para Lisboa?",
        resposta:
          "Sim, é uma das rotas mais rápidas — pela A5 chega-se a Lisboa em 15 a 25 minutos fora das horas de ponta. O preço depende do volume e dos acessos nas duas moradas; recebe propostas grátis em até 6 horas.",
      },
      {
        pergunta: "Conseguem entrar na Zona Industrial de Carnaxide com camião?",
        resposta:
          "Sim, a Zona Industrial tem boas vias de acesso para veículos de grande porte. Se a mudança tiver de ser ao fim de semana, para não interferir com os negócios, diga-o no pedido.",
      },
    ],
    testemunho: null,
    cidadesVizinhas: ["oeiras", "amadora", "lisboa", "sintra"],
  },
  {
    slug: "corroios",
    nome: "Corroios",
    distrito: "Setúbal",
    geo: { lat: 38.6336, lng: -9.1559 },
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
      "Os prédios dos anos 80 em Corroios têm frequentemente elevadores pequenos, que obrigam a mais viagens — diga-o no pedido para vir contado na proposta.",
    faqs: [
      {
        pergunta: "Quanto custa uma mudança em Corroios?",
        resposta:
          "Depende do volume, do andar e do elevador. Recebe propostas grátis em até 6 horas.",
      },
      {
        pergunta: "Fazem mudanças Corroios → Lisboa?",
        resposta:
          "Sim, pela ponte 25 de Abril o trajecto é rápido e a portagem entra na proposta. O valor depende do volume e dos acessos nas duas moradas — diga os dados e recebe propostas em até 6 horas.",
      },
    ],
    testemunho: null,
    cidadesVizinhas: ["seixal", "almada", "barreiro", "montijo"],
  },
  {
    slug: "palmela",
    nome: "Palmela",
    distrito: "Setúbal",
    geo: { lat: 38.5676, lng: -8.9025 },
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
      "Palmela tem um centro histórico medieval com ruas muito estreitas que exigem carrinha pequena. As zonas periféricas (Quinta do Anjo, Pinhal Novo) têm excelentes acessos pela A2/A12. Para o castelo e o centro antigo, a rota deve ser confirmada antes — diga a rua no pedido.",
    faqs: [
      {
        pergunta: "Conseguem fazer mudança no centro histórico de Palmela?",
        resposta:
          "Sim, com viaturas mais pequenas. Para as ruas junto ao castelo, o profissional pode tratar da licença de estacionamento (EMEL ou câmara); o custo vem discriminado na proposta.",
      },
      {
        pergunta: "Fazem mudanças de Palmela para Lisboa?",
        resposta:
          "Sim. Pela A2 chega-se a Lisboa em 35 a 50 minutos. O preço depende do volume, da tipologia e dos acessos, e as propostas chegam-lhe grátis em até 6 horas.",
      },
    ],
    testemunho: null,
    cidadesVizinhas: ["montijo", "setubal", "almada", "alcochete"],
  },
  {
    slug: "odivelas",
    nome: "Odivelas",
    distrito: "Lisboa",
    geo: { lat: 38.7952, lng: -9.1853 },
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
      "Odivelas é uma das zonas mais densamente habitadas da Grande Lisboa — o trânsito nas horas de ponta (IC17, CRIL) pode atrasar significativamente. Convém marcar de manhã cedo ou ao fim de semana. Prédios dos anos 80 têm elevadores de tamanho variável.",
    faqs: [
      {
        pergunta: "Quanto custa mudança em Odivelas?",
        resposta:
          "A distância é média, mas o trânsito na IC17 e na CRIL pode alongar o serviço — por isso compensa começar cedo. O valor depende do volume, do andar e do elevador; recebe propostas grátis em até 6 horas.",
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
    geo: { lat: 38.7700, lng: -9.1570 },
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
          "Sim, o pedido chega aos profissionais que trabalham em toda a freguesia do Lumiar. Alta de Lisboa tem acessos modernos e amplos. Telheiras é uma zona residencial tranquila com bom estacionamento de apoio.",
      },
      {
        pergunta: "Quanto custa mudança no Lumiar?",
        resposta:
          "Depende do volume, do elevador e do percurso até ao destino — a Alta de Lisboa tem acessos amplos, Telheiras tem prédios mais antigos. Recebe propostas grátis em até 6 horas.",
      },
    ],
    testemunho: null,
    cidadesVizinhas: ["lisboa", "odivelas", "loures", "amadora"],
  },
  {
    slug: "sesimbra",
    nome: "Sesimbra",
    distrito: "Setúbal",
    geo: { lat: 38.4439, lng: -9.1014 },
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
      "A vila de Sesimbra tem acesso condicionado em época estival — de junho a setembro o centro histórico tem trânsito proibido a veículos pesados em determinadas horas. Por isso as mudanças na vila fazem-se de manhã cedo ou fora de época.",
    faqs: [
      {
        pergunta: "Fazem mudanças no centro de Sesimbra no verão?",
        resposta:
          "Sim, mas no verão a carga e descarga na vila faz-se cedo, antes de as restrições de acesso apertarem. Indique a data no pedido e combine a hora com o profissional.",
      },
      {
        pergunta: "Quanto custa mudança em Sesimbra?",
        resposta:
          "Depende do volume, dos acessos e da época do ano — no verão a carga na vila tem de ser feita de manhã cedo, e isso condiciona o planeamento. Para Lisboa, a portagem da ponte entra na proposta. Recebe propostas grátis em até 6 horas.",
      },
    ],
    testemunho: null,
    cidadesVizinhas: ["almada", "seixal", "palmela", "costa-da-caparica"],
  },
  {
    slug: "costa-da-caparica",
    nome: "Costa da Caparica",
    distrito: "Setúbal",
    geo: { lat: 38.6412, lng: -9.2353 },
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
      "Costa da Caparica é popular no verão — entre junho e setembro o estacionamento de suporte à mudança na frente de mar é quase impossível. Recomenda-se mudar fora de época ou muito cedo de manhã. No inverno as condições são excelentes.",
    faqs: [
      {
        pergunta: "É difícil fazer mudança na Costa da Caparica no verão?",
        resposta:
          "Na zona de praia, sim — o estacionamento é totalmente tomado. No verão, as mudanças fazem-se de manhã cedo — combine a hora com o profissional. Fora de época é muito simples.",
      },
      {
        pergunta: "Quanto custa mudança Costa da Caparica → Lisboa?",
        resposta:
          "Pela ponte 25 de Abril o trajecto demora 20 a 35 minutos e a portagem entra na proposta. O valor depende do volume e dos acessos; recebe propostas grátis em até 6 horas.",
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
