/**
 * O que é verdade em cada zona, e só nela.
 *
 * As páginas cidade×serviço eram o mesmo texto com o nome da terra trocado.
 * O Google detectou 73 delas e não gastou rastreio a visitar nenhuma — é o
 * que faz a páginas de porta (doorway pages). Não se resolve pedindo
 * indexação: resolve-se dando a cada página coisas que só existem ali.
 *
 * REGRA DESTE FICHEIRO: nada aqui é inventado.
 *
 * As freguesias e os bairros são geografia administrativa. Os ecocentros e os
 * sistemas de resíduos são serviços públicos, com nome e entidade
 * verificáveis. As notas de acesso descrevem características conhecidas do
 * terreno — a inclinação da Graça, a largura das ruas de Alfama, o
 * estacionamento da Costa da Caparica em Agosto.
 *
 * O que NÃO está aqui, de propósito: testemunhos com nome e número de
 * trabalhos feitos na zona. Não tenho como os verificar, e um testemunho
 * inventado é uma mentira ao cliente antes de ele sequer ligar. Quando esses
 * dados existirem em base, entram — vindos de lá, não daqui.
 *
 * As distâncias são a partir da base em Fernão Ferro e estão arredondadas;
 * o texto que as usa diz sempre que são aproximadas.
 */

/** Serviços que têm nota própria por zona. */
export type ServicoSlug =
  | "recolha-moveis"
  | "recolha-monos"
  | "recolha-entulho"
  | "esvaziamento-casas";

export interface CidadeLocal {
  /** slug de CITIES em seo-data.ts */
  slug: string;
  /** Freguesias, bairros ou zonas reais — o que as pessoas dizem à porta. */
  zonas: string[];
  /**
   * O constrangimento logístico real da zona. É o que distingue um trabalho
   * aqui de um trabalho a dez quilómetros.
   */
  acesso: string;
  /** Como é estacionar uma carrinha aqui, na prática. */
  estacionamento: string;
  /** Para onde vão os resíduos, e de quem é o sistema. */
  destinoResiduos: { nome: string; entidade: string };
  /** Distância aproximada à base (Fernão Ferro), em km. */
  distanciaKm: number;
  /** Notas específicas por serviço, quando há uma diferença real a assinalar. */
  porServico?: Partial<Record<ServicoSlug, string>>;
}

export const CIDADES_LOCAIS: CidadeLocal[] = [
  // ── Lisboa ───────────────────────────────────────────────────────────────
  {
    slug: "lisboa",
    zonas: ["Alfama", "Graça", "Chiado", "Baixa", "Bairro Alto", "Areeiro", "Parque das Nações"],
    acesso:
      "Lisboa não é uma cidade só. Alfama, Graça e Bairro Alto têm ruas onde uma carrinha de caixa grande não passa, e prédios do século XIX sem elevador em que a descida se faz a pé ou por janela. O Parque das Nações e Alvalade são o oposto: acessos largos e lugares de carga à porta.",
    estacionamento:
      "Grande parte do centro é zona EMEL. Em Chiado, Baixa, Bairro Alto e Alfama pede-se reserva de lugar com antecedência — sem isso a carrinha fica longe e o trabalho leva o dobro do tempo.",
    destinoResiduos: { nome: "Ecocentro de Lisboa", entidade: "Valorsul / CML" },
    distanciaKm: 28,
    porServico: {
      "recolha-entulho":
        "A Câmara de Lisboa limita a deposição de entulho de obra particular nos ecocentros municipais a pequenas quantidades. Acima disso vai a operador licenciado, com guia de acompanhamento de resíduos — é isso que entregamos no fim.",
      "recolha-monos":
        "A recolha municipal de monos em Lisboa é agendada e tem espera. Quem precisa de data certa, ou de retirar de dentro de casa e não do passeio, é aí que nos chama.",
    },
  },
  {
    slug: "benfica",
    zonas: ["Benfica", "São Domingos de Benfica", "Estrada de Benfica", "Pupilos do Exército"],
    acesso:
      "Zona de prédios dos anos 60 e 70: muitos têm elevador, mas elevadores estreitos onde um sofá de três lugares não entra. A descida faz-se pela escada, e é isso que pesa no tempo.",
    estacionamento:
      "A Estrada de Benfica tem trânsito constante e poucos lugares de paragem. Nas ruas interiores estaciona-se bem, mas em segunda fila não — há eléctrico e autocarro a passar.",
    destinoResiduos: { nome: "Ecocentro de Lisboa", entidade: "Valorsul / CML" },
    distanciaKm: 32,
  },
  {
    slug: "lumiar",
    zonas: ["Lumiar", "Alta de Lisboa", "Quinta das Conchas", "Telheiras"],
    acesso:
      "Construção recente na Alta de Lisboa e em Telheiras — garagens com pé-direito baixo, onde uma carrinha alta não entra. Trabalha-se da rua, e convém saber isso antes de marcar.",
    estacionamento:
      "Bom em quase toda a zona. As excepções são as ruas junto ao Campo Grande em dia de jogo ou de feira.",
    destinoResiduos: { nome: "Ecocentro de Lisboa", entidade: "Valorsul / CML" },
    distanciaKm: 33,
  },
  {
    slug: "alvalade",
    zonas: ["Alvalade", "Avenidas Novas", "Roma", "Areeiro"],
    acesso:
      "Bairro de Alvalade original: prédios de quatro andares sem elevador, projectados nos anos 40. Escadaria estreita com patamares curtos — móveis grandes descem desmontados ou não descem.",
    estacionamento:
      "Zona EMEL quase toda. Os lugares existem, mas de manhã estão ocupados por residentes; a marcação a meio da manhã corre melhor.",
    destinoResiduos: { nome: "Ecocentro de Lisboa", entidade: "Valorsul / CML" },
    distanciaKm: 30,
  },
  {
    slug: "olivais",
    zonas: ["Olivais Norte", "Olivais Sul", "Encarnação", "Moscavide"],
    acesso:
      "Os Olivais foram planeados com espaço entre os blocos: acesso de carrinha até junto da porta, o que raramente acontece no resto de Lisboa. Os blocos altos têm elevador, mas alguns são de cabina pequena.",
    estacionamento: "Largo e gratuito na maior parte da zona. É das áreas de Lisboa onde é mais simples.",
    destinoResiduos: { nome: "Ecocentro de Lisboa", entidade: "Valorsul / CML" },
    distanciaKm: 25,
  },

  // ── Grande Lisboa ────────────────────────────────────────────────────────
  {
    slug: "sintra",
    zonas: ["Sintra Vila", "Portela de Sintra", "Algueirão-Mem Martins", "Rio de Mouro", "Cacém"],
    acesso:
      "Sintra Vila tem ruas de calçada estreita e inclinada, com curvas onde uma carrinha longa não roda. Algueirão, Mem Martins e Rio de Mouro são o contrário — bairros de expansão com ruas largas e prédios com elevador.",
    estacionamento:
      "Na Vila é o problema principal, sobretudo entre Junho e Setembro com o turismo. Nas zonas de expansão estaciona-se sem dificuldade.",
    destinoResiduos: { nome: "Ecocentro de Sintra", entidade: "Tratolixo / CM Sintra" },
    distanciaKm: 48,
  },
  {
    slug: "cascais",
    zonas: ["Cascais", "Estoril", "Parede", "Carcavelos", "Alcabideche"],
    acesso:
      "Moradias com jardim e portão, em vez de prédios — o que muda tudo: dá para encostar a carrinha, mas há muitas vezes escadas exteriores e degraus até à porta.",
    estacionamento:
      "Difícil junto à marina e à baía em fins-de-semana e no Verão. Nas zonas residenciais interiores é tranquilo.",
    destinoResiduos: { nome: "Ecocentro de Cascais", entidade: "Cascais Ambiente" },
    distanciaKm: 50,
  },
  {
    slug: "oeiras",
    zonas: ["Oeiras", "Paço de Arcos", "Algés", "Carnaxide", "Linda-a-Velha"],
    acesso:
      "Algés e Linda-a-Velha têm prédios antigos em ruas com forte inclinação, onde a carrinha fica em plano diferente da porta. Oeiras e Paço de Arcos são construção mais recente, com garagem e elevador.",
    estacionamento:
      "Junto à marginal e às estações é sempre disputado. Nas ruas acima da linha resolve-se.",
    destinoResiduos: { nome: "Ecocentro de Oeiras", entidade: "CM Oeiras" },
    distanciaKm: 40,
  },
  {
    slug: "amadora",
    zonas: ["Amadora", "Damaia", "Reboleira", "Falagueira", "Alfragide"],
    acesso:
      "Densidade alta e prédios dos anos 70 e 80. Elevadores pequenos e escadas estreitas são a regra, não a excepção — o desmonte no local é quase sempre necessário.",
    estacionamento:
      "Das zonas mais difíceis da Grande Lisboa: ruas apertadas e ocupação total de dia. Marcar cedo faz diferença.",
    destinoResiduos: { nome: "Ecocentro da Amadora", entidade: "Valorsul / CM Amadora" },
    distanciaKm: 38,
  },
  {
    slug: "loures",
    zonas: ["Loures", "Santo António dos Cavaleiros", "Sacavém", "Camarate", "Bobadela"],
    acesso:
      "Concelho de contrastes: Santo António dos Cavaleiros são torres com elevador e acesso fácil; o centro de Loures e a Bobadela têm casas antigas de dois pisos com escada interior estreita.",
    estacionamento: "Sem grande dificuldade fora das horas de ponta em Sacavém e Camarate.",
    destinoResiduos: { nome: "Ecocentro de Loures", entidade: "Valorsul / CM Loures" },
    distanciaKm: 32,
  },
  {
    slug: "odivelas",
    zonas: ["Odivelas", "Pontinha", "Famões", "Ramada", "Caneças"],
    acesso:
      "Terreno com desnível acentuado. Muitas ruas em rampa, e prédios cuja entrada fica meio piso acima ou abaixo do passeio — os degraus à porta contam tanto como os andares.",
    estacionamento: "Apertado no centro de Odivelas. Em Famões e Caneças é mais folgado.",
    destinoResiduos: { nome: "Ecocentro de Odivelas", entidade: "Valorsul / CM Odivelas" },
    distanciaKm: 36,
  },
  {
    slug: "carnaxide",
    zonas: ["Carnaxide", "Queijas", "Outurela", "Portela de Carnaxide"],
    acesso:
      "Mistura de bairro antigo e urbanizações recentes. Nas urbanizações há garagem e elevador; no núcleo antigo há ruas de sentido único onde a carrinha bloqueia o trânsito enquanto carrega.",
    estacionamento: "Razoável, com excepção das ruas junto aos centros comerciais ao fim do dia.",
    destinoResiduos: { nome: "Ecocentro de Oeiras", entidade: "CM Oeiras" },
    distanciaKm: 38,
  },
  {
    slug: "monte-abraao",
    zonas: ["Monte Abraão", "Massamá", "Cacém", "Agualva"],
    acesso:
      "Zona de blocos altos construídos em conjunto, com elevador na maioria. O ponto sensível são os acessos entre blocos, muitas vezes só pedonais — há troço a pé entre a porta e a carrinha.",
    estacionamento: "Suficiente nas avenidas principais; nas ruas interiores é de residentes.",
    destinoResiduos: { nome: "Ecocentro de Sintra", entidade: "Tratolixo / CM Sintra" },
    distanciaKm: 42,
  },
  {
    slug: "queluz",
    zonas: ["Queluz", "Belas", "Massamá", "Pendão"],
    acesso:
      "O centro histórico junto ao Palácio tem ruas estreitas e trânsito condicionado. À volta, Massamá e Belas são urbanizações com bom acesso.",
    estacionamento: "Complicado junto ao Palácio e à estação. Resto da zona sem problema.",
    destinoResiduos: { nome: "Ecocentro de Sintra", entidade: "Tratolixo / CM Sintra" },
    distanciaKm: 42,
  },

  // ── Margem Sul ───────────────────────────────────────────────────────────
  {
    slug: "almada",
    zonas: ["Almada", "Cacilhas", "Pragal", "Cova da Piedade", "Feijó", "Charneca de Caparica"],
    acesso:
      "Almada velha e Cacilhas ficam sobre a arriba: ruas curtas, inclinadas e com escadinhas entre patamares. O Pragal e o Feijó são zona nova, com garagem e elevador.",
    estacionamento:
      "Cacilhas e Almada velha são difíceis a qualquer hora. No Pragal e na Charneca há espaço.",
    destinoResiduos: { nome: "Ecocentro de Almada", entidade: "Amarsul / CM Almada" },
    distanciaKm: 18,
    porServico: {
      "esvaziamento-casas":
        "Muito do parque habitacional de Almada velha e Cacilhas é anterior aos anos 60, com escada única e sem elevador. Um esvaziamento completo aí leva mais tempo do que o mesmo T2 no Pragal — dizemo-lo no orçamento em vez de o descobrir no dia.",
    },
  },
  {
    slug: "costa-da-caparica",
    zonas: ["Costa da Caparica", "Trafaria", "Fonte da Telha", "Santo António da Caparica"],
    acesso:
      "Frente de praia com ruas estreitas e areia constante. Muitos alojamentos são apartamentos pequenos de piso alto sem elevador, pensados para férias e não para mobiliário grande.",
    estacionamento:
      "Entre Junho e Setembro é o principal obstáculo — a zona enche e não há onde encostar. Fora dessa época resolve-se com facilidade.",
    destinoResiduos: { nome: "Ecocentro de Almada", entidade: "Amarsul / CM Almada" },
    distanciaKm: 22,
    porServico: {
      "recolha-monos":
        "A rotatividade de arrendamento de férias faz aparecer muito mobiliário de uma vez no fim da época. Setembro e Outubro são os meses de maior procura aqui.",
    },
  },
  {
    slug: "seixal",
    zonas: ["Seixal", "Arrentela", "Paio Pires", "Corroios", "Fernão Ferro"],
    acesso:
      "Concelho espalhado, com bairros de moradias e ruas largas. É dos sítios onde se encosta a carrinha à porta com mais frequência.",
    estacionamento: "Sem dificuldade em quase todo o concelho.",
    destinoResiduos: { nome: "Ecocentro do Seixal", entidade: "Amarsul / CM Seixal" },
    distanciaKm: 6,
    porServico: {
      "recolha-moveis":
        "A base da CLYON é em Fernão Ferro, dentro deste concelho. É a zona onde conseguimos as marcações mais próximas e onde uma recolha urgente é mais fácil de encaixar.",
    },
  },
  {
    slug: "amora",
    zonas: ["Amora", "Cruz de Pau", "Paivas", "Fogueteiro"],
    acesso:
      "Bairros de expansão dos anos 80 e 90, com prédios de quatro a seis andares. Elevador na maioria, mas nem sempre nos blocos mais antigos da Cruz de Pau.",
    estacionamento: "Folgado. As ruas foram desenhadas já com automóvel em mente.",
    destinoResiduos: { nome: "Ecocentro do Seixal", entidade: "Amarsul / CM Seixal" },
    distanciaKm: 8,
  },
  {
    slug: "corroios",
    zonas: ["Corroios", "Santa Marta do Pinhal", "Miratejo", "Vale de Milhaços"],
    acesso:
      "Miratejo tem torres altas com elevador; Santa Marta do Pinhal e Vale de Milhaços são moradias com garagem e portão. Acesso simples nos dois casos.",
    estacionamento: "Sem problema, incluindo para carrinha de caixa grande.",
    destinoResiduos: { nome: "Ecocentro do Seixal", entidade: "Amarsul / CM Seixal" },
    distanciaKm: 10,
  },
  {
    slug: "barreiro",
    zonas: ["Barreiro", "Lavradio", "Alto do Seixalinho", "Santo André", "Verderena"],
    acesso:
      "Centro antigo com casas operárias de dois pisos, porta estreita e escada de um lanço. O Alto do Seixalinho e Santo André são prédios mais recentes, com elevador.",
    estacionamento: "Difícil no centro antigo, onde as ruas mal dão para dois carros a cruzar.",
    destinoResiduos: { nome: "Ecocentro do Barreiro", entidade: "Amarsul / CM Barreiro" },
    distanciaKm: 12,
  },
  {
    slug: "moita",
    zonas: ["Moita", "Baixa da Banheira", "Vale da Amoreira", "Alhos Vedros"],
    acesso:
      "Baixa da Banheira e Vale da Amoreira são bairros densos de prédios sem garagem. Na Moita e em Alhos Vedros há mais casa térrea com quintal, e acesso direto.",
    estacionamento: "Razoável fora das ruas centrais da Baixa da Banheira.",
    destinoResiduos: { nome: "Ecocentro da Moita", entidade: "Amarsul / CM Moita" },
    distanciaKm: 14,
  },
  {
    slug: "montijo",
    zonas: ["Montijo", "Afonsoeiro", "Atalaia", "Sarilhos Grandes"],
    acesso:
      "Centro com ruas de comércio estreitas e prédios de três a quatro pisos, muitos sem elevador. As zonas novas do Afonsoeiro têm garagem.",
    estacionamento: "Bom, excepto nas ruas do comércio em dia de mercado.",
    destinoResiduos: { nome: "Ecocentro do Montijo", entidade: "Amarsul / CM Montijo" },
    distanciaKm: 16,
  },
  {
    slug: "alcochete",
    zonas: ["Alcochete", "Samouco", "São Francisco", "Passil"],
    acesso:
      "Vila pequena de casas baixas, quase toda acessível de carrinha até à porta. A zona ribeirinha tem ruas mais estreitas e pavimento irregular.",
    estacionamento: "Simples fora do Verão, quando a frente ribeirinha enche.",
    destinoResiduos: { nome: "Ecocentro do Montijo", entidade: "Amarsul / CM Montijo" },
    distanciaKm: 8,
  },

  // ── Setúbal ──────────────────────────────────────────────────────────────
  {
    slug: "setubal",
    zonas: ["Setúbal", "Bela Vista", "Manteigadas", "Azeitão", "Praias do Sado"],
    acesso:
      "O centro histórico tem ruas de calçada estreita entre a Avenida e o mercado, com trânsito condicionado. A Bela Vista e Manteigadas são bairros de blocos com acesso de carrinha até junto da entrada.",
    estacionamento: "Difícil no centro histórico e na avenida; fácil nos bairros periféricos.",
    destinoResiduos: { nome: "Ecocentro de Setúbal", entidade: "Amarsul / CM Setúbal" },
    distanciaKm: 20,
    porServico: {
      "recolha-entulho":
        "Azeitão tem muita obra em moradia e quinta, com entulho misturado com verdes de jardim. São fluxos diferentes e vão a destinos diferentes — separamos no carregamento, não no fim.",
    },
  },
  {
    slug: "palmela",
    zonas: ["Palmela", "Pinhal Novo", "Quinta do Anjo", "Águas de Moura"],
    acesso:
      "Palmela vila fica em encosta, com ruas em rampa junto ao castelo. Pinhal Novo é plano e de construção recente, com acesso simples.",
    estacionamento: "Sem dificuldade em Pinhal Novo. Na vila alta é apertado.",
    destinoResiduos: { nome: "Ecocentro de Palmela", entidade: "Amarsul / CM Palmela" },
    distanciaKm: 14,
  },
  {
    slug: "sesimbra",
    zonas: ["Sesimbra", "Santana", "Quinta do Conde", "Lagoa de Albufeira"],
    acesso:
      "A vila de Sesimbra desce a pique até ao mar: ruas curtas, muito inclinadas e algumas só pedonais. A Quinta do Conde é o oposto — loteamento plano com moradias e acesso direto.",
    estacionamento:
      "Na vila é o maior obstáculo, e no Verão torna-se quase impossível junto à praia. A Quinta do Conde não tem esse problema.",
    destinoResiduos: { nome: "Ecocentro de Sesimbra", entidade: "Amarsul / CM Sesimbra" },
    distanciaKm: 12,
  },
];

const PORT_SLUG = new Map(CIDADES_LOCAIS.map((c) => [c.slug, c]));

/** Dados locais de uma cidade, ou null quando ainda não foram escritos. */
export function getCidadeLocal(slug: string): CidadeLocal | null {
  return PORT_SLUG.get(slug) ?? null;
}

/**
 * Tempo aproximado de viagem a partir da base, a 45 km/h de média.
 *
 * É uma estimativa e o texto que a usa diz isso. Prometer minutos exactos
 * numa área com a ponte 25 de Abril pelo meio seria fingir uma precisão que
 * não existe.
 */
export function tempoAproximado(distanciaKm: number): string {
  const minutos = Math.max(10, Math.round((distanciaKm / 45) * 60 / 5) * 5);
  if (minutos < 60) return `cerca de ${minutos} minutos`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `cerca de ${horas}h` : `cerca de ${horas}h${String(resto).padStart(2, "0")}`;
}
