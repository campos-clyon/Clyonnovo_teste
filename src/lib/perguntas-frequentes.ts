import { EXTRAS_DA_MUDANCA, PRECO_DA_MUDANCA_POR_EXTENSO } from "./tabela-das-mudancas";
import {
  AVALIACOES,
  MES_DAS_CONTAGENS,
  COMO_SE_PAGA,
  FACTURA_EM_PALAVRAS,
  NOTA_DE_PRECO,
  PRAZO_DE_RESPOSTA,
} from "./seo-data";
import { PRECOS, etiquetaDoEsvaziamento } from "./precos-publicos";
import { IDENTIFICACAO } from "./identificacao-legal";
import { NO_MESMO_DIA, PROMESSA_DO_PRAZO } from "./promessas-publicas";

/**
 * AS PERGUNTAS FREQUENTES — 29-10-2026 (S12). Estavam escritas dentro de
 * `src/app/faq/page.tsx`; vivem aqui para a página e o catálogo da app de
 * cliente (R7) dizerem o mesmo, carácter a carácter.
 */
export const PERGUNTAS_FREQUENTES = [
  {
    category: "Recolha de Móveis em Lisboa",
    questions: [
      {
        q: "Quanto custa a recolha de móveis em Lisboa?",
        a: `O preço depende do volume, do tipo de móvel e dos acessos. Para peças soltas como sofá, armário ou cama, a referência é ${PRECOS.recolha_moveis.etiqueta}; volumes maiores ou andares sem elevador ficam mais caros. Descreva o pedido em clyon.pt/simulador e recebe as propostas dos parceiros da sua zona em menos de ${PRAZO_DE_RESPOSTA.porExtenso}. ${NOTA_DE_PRECO.curta}`,
      },
      {
        q: "Que móveis recolhem?",
        a: "Os parceiros recolhem qualquer tipo de móvel: sofás, camas, colchões, armários, estantes, secretárias, cadeiras, mesas, aparadores, cómodas, roupeiros e mobiliário de escritório. Também retiram eletrodomésticos (frigoríficos, máquinas de lavar, fogões, micro-ondas) e objetos de grandes dimensões que não cabem no contentor do lixo da rua.",
      },
      {
        q: "Fazem recolha de sofás em Lisboa no mesmo dia?",
        a: NO_MESMO_DIA,
      },
      {
        q: "Recolhem sofás, colchões e camas com ou sem desmontagem?",
        a: "Com ou sem desmontagem. Se o sofá ou a cama não passa pela porta ou pelo elevador, o parceiro desmonta antes de retirar. Indique-o no pedido, para a proposta já contar com isso.",
      },
      {
        q: "Recolhem móveis velhos ou danificados?",
        a: "Sim. Não há restrição sobre o estado do móvel — os parceiros levam peças partidas, com bolor, desmontadas ou incompletas. O importante é dizer o tipo e o volume, para a proposta ser certa.",
      },
      {
        q: "Como funciona a recolha de móveis — passo a passo?",
        a: "1) Faz o pedido no simulador ou por WhatsApp, com fotografias. 2) Recebe as propostas dos parceiros da sua zona, já com a taxa da plataforma, e escolhe uma. 3) O parceiro vai no dia combinado e retira os móveis do interior do imóvel. 4) Confirma que ficou feito.",
      },
      {
        q: "A recolha inclui subir ao apartamento para retirar os móveis?",
        a: "Sim. O parceiro sobe ao andar, retira os móveis do interior do imóvel, desce e carrega na viatura. Não tem de fazer esforço nenhum — só dizer no pedido o andar e se há elevador.",
      },
      {
        q: "Recolhem apenas uma peça ou precisam de vários móveis?",
        a: "Os parceiros recolhem desde uma única peça (um sofá, uma cama, um armário) até uma casa inteira. Não há mínimo de volume.",
      },
      {
        q: "Para onde vão os móveis recolhidos?",
        // 30-09-2026: dizia que os móveis em bom estado «podem ir para
        // instituições de solidariedade» — a plataforma não tem circuito de
        // doação nenhum, e o destino é decisão do profissional.
        a: "Quem transporta é o parceiro, e é ele que decide o destino: o que ainda serve pode ser reaproveitado; o resto tem de ir para um destino legal, e as regras da plataforma proíbem o transporte de resíduos sem as autorizações que a lei exige. Se quer doar peças em bom estado, veja /recolha-gratuita-de-moveis-usados.",
      },
      {
        q: "Existe recolha gratuita de móveis em Lisboa?",
        /*
         * Dizia que a recolha "pode ser gratuita" para móveis com valor de
         * revenda. A CLYON não faz recolha gratuita nenhuma — é a página de
         * que o cliente se lembra quando a proposta chega com preço. O
         * caminho interno no fim é desenhado como ligação pelo FAQClient.
         */
        a: "Na CLYON, não: é uma plataforma de serviços pagos, e o preço é o da proposta que o cliente aceita. Para uma opção gratuita, veja a recolha de monos da sua câmara municipal ou a doação a instituições — explicamos as diferenças em /recolha-gratuita-de-moveis-usados.",
      },
    ],
  },
  {
    category: "Esvaziamento de Casa em Lisboa",
    questions: [
      {
        q: "Quanto custa o esvaziamento de uma casa em Lisboa?",
        a: `Um esvaziamento de casa custa ${PRECOS.esvaziamento_casa.etiqueta}. Num apartamento o valor fica em ${PRECOS.esvaziamento_apartamento.etiqueta}, conforme a tipologia: um T0/T1 em ${etiquetaDoEsvaziamento("T0/T1")}, um T2 em ${etiquetaDoEsvaziamento("T2")}, um T3/T4 em ${etiquetaDoEsvaziamento("T3/T4")}. Numa moradia completa, ${etiquetaDoEsvaziamento("moradia")}. O valor final depende do volume de recheio, número de andares, elevador disponível e distância, e chega nas propostas dos parceiros. ${NOTA_DE_PRECO.curta}`,
      },
      {
        q: "O que inclui o serviço de esvaziamento de casa?",
        a: "O que pedir, e fica escrito na proposta. Normalmente: a retirada dos móveis e objetos indicados, a desmontagem do que for preciso e o transporte para destino adequado. Deixar o espaço varrido pode combinar-se com o parceiro; limpezas a fundo não são um serviço da CLYON.",
      },
      {
        q: "Fazem esvaziamento de casas de herança ou imóveis de senhorios?",
        a: "Sim — senhorios que recebem o imóvel com o recheio deixado pelo inquilino, ou famílias a tratar de um espólio. Não precisa de estar presente: o acesso combina-se com o parceiro que escolher.",
      },
      {
        q: "Quanto tempo demora o esvaziamento de uma casa?",
        a: "Como referência: um T1 leva 3 a 5 horas, com 2 a 3 pessoas; um T2, entre 4 e 7 horas; uma moradia ou um T3+ pode levar um dia inteiro ou ser dividida em dois dias. O prazo certo combina-se com o parceiro, e depende do volume e dos acessos.",
      },
      {
        q: "Fazem esvaziamento ao fim de semana em Lisboa?",
        a: "O atendimento da CLYON é de segunda a sábado, das 08:00 às 20:00. Trabalhos ao domingo dependem de haver parceiro disponível; qualquer acréscimo vem na proposta.",
      },
      {
        q: "Recolhem tudo numa casa — do mobiliário ao lixo?",
        a: "Sim. Os parceiros retiram móveis, eletrodomésticos, roupa, documentos para destruição, entulho de obras menores, objetos pessoais e qualquer outro conteúdo que esteja no imóvel. O cliente indica o que fica e o que vai — o resto é com eles.",
      },
      {
        q: "Fazem esvaziamento de apartamento em Lisboa no centro histórico?",
        a: "Sim. Os pedidos do centro histórico — Mouraria, Alfama, Intendente, Príncipe Real — chegam aos parceiros como os outros. Diga no pedido se a rua é estreita e se o elevador é pequeno ou não existe: a proposta tem de contar com isso.",
      },
      {
        q: "Precisam de autorização da câmara para estacionar o camião?",
        a: "Para serviços curtos, o parceiro usa um lugar de cargas e descargas. Para trabalhos maiores, que precisem de reservar espaço na via pública, pode ser preciso pedir licença à junta de freguesia ou à câmara — a equipa da CLYON explica-lhe como.",
      },
    ],
  },
  {
    category: "Esvaziamento de Apartamento",
    questions: [
      {
        q: "Qual a diferença entre esvaziamento de casa e de apartamento?",
        a: "Funcionalmente é o mesmo serviço. O esvaziamento de apartamento tende a ter a condicionante do elevador — tamanho, peso máximo, disponibilidade — e do estacionamento na via pública. Indique-as no pedido, para a proposta contar com elas e não haver surpresas.",
      },
      {
        q: "Fazem esvaziamento de apartamento sem elevador?",
        a: "Sim. Sem elevador, o preço sobe por andar, pelo esforço e pelo tempo de descer tudo a pé. Indique o andar no pedido, para a proposta já contar com isso.",
      },
      {
        q: "Consigo esvaziar o apartamento depressa?",
        a: `${PROMESSA_DO_PRAZO} Se for urgente, diga-o no pedido e mande fotografias do imóvel pelo WhatsApp — quanto mais claro o pedido, mais depressa se combina a data.`,
      },
      {
        q: "Recolhem os eletrodomésticos do apartamento?",
        a: "Sim. Frigorífico, máquina de lavar, máquina de secar, fogão, forno, micro-ondas, arca frigorífica — os parceiros retiram os eletrodomésticos incluídos no esvaziamento. Indique-os no pedido, sobretudo os grandes.",
      },
      {
        q: "O apartamento fica limpo depois do esvaziamento?",
        a: "Fica sem os volumes que pediu para retirar. Deixar o espaço varrido pode combinar-se com o parceiro; limpezas a fundo — pavimentos, paredes, casas de banho, cozinha — não são um serviço da CLYON.",
      },
    ],
  },
  {
    category: "Preços e Orçamentos",
    questions: [
      {
        q: "Como peço orçamento para recolha de móveis?",
        a: `Há três formas: (1) No simulador, em clyon.pt/simulador — indica o tipo de serviço, a morada e o volume, com fotografias. (2) Por WhatsApp — envie fotografias e a descrição. (3) Pelo formulário de contacto, em clyon.pt/contactos. Em qualquer delas, uma pessoa da CLYON confere o pedido e envia-o aos parceiros da sua zona, e as propostas chegam em menos de ${PRAZO_DE_RESPOSTA.porExtenso}.`,
      },
      {
        q: "O orçamento é gratuito e sem compromisso?",
        a: "Sim. Pedir propostas é gratuito e não o compromete: só há trabalho se aceitar uma.",
      },
      {
        q: "O preço pode mudar depois de aceitar o orçamento?",
        /*
         * Coerente com a garantia da página inicial. O valor é dado à
         * distância e confirma-se no local (orcamento-a-distancia.ts); o que
         * aparecer a mais combina-se antes de começar (itens-a-mais.ts) e
         * corrige-se na plataforma, com registo. Dizia "fazemos nova
         * estimativa" — a CLYON não estima trabalho de ninguém.
         */
        a: "O valor que aceitar fica combinado por escrito. Como é dado à distância, pelo que descreveu, confirma-se no local antes de começar: se houver mais do que descreveu, o parceiro diz-lhe o novo valor antes de começar, e só avança se aceitar — a correcção fica registada na plataforma. Depois do trabalho feito, não acresce nada.",
      },
      {
        q: "Quais os métodos de pagamento aceites?",
        a: COMO_SE_PAGA,
      },
      {
        q: "Há custo de deslocação para Lisboa e Margem Sul?",
        a: "O custo da deslocação entra na proposta de cada parceiro. Vê-o antes de aceitar.",
      },
      {
        q: "O entulho vai para onde? Estão licenciados?",
        /*
         * Isto existia e nao estava dito em lado nenhum.
         *
         * Os dois principais concorrentes destacam o licenciamento ambiental
         * deles, e uma auditoria apontou a falta disso como a maior
         * desvantagem competitiva da CLYON. O registo na APA ca estava desde
         * sempre.
         *
         * DEIXOU DE EXCLUIR A 14-09-2026, e a resposta dizia que excluía.
         * Dizia "quem não o tem verificado nem chega a ver o seu pedido", mas
         * em profissional-elegivel.ts a guia passou de filtro a AVISO: o
         * profissional sem transportador verificado vê o pedido e é avisado
         * antes de propor. O que o cliente vê é o selo «guia verificada» no
         * cartão da proposta (PropostasRecebidas.tsx) — é isso que se diz
         * agora, e o código APA sai da constante (30-09-2026).
         */
        a: `A CLYON está registada como operador de resíduos na Agência Portuguesa do Ambiente, com o código ${IDENTIFICACAO.codigoAPA}. Quem transporta o entulho é o parceiro que escolher, e as regras da plataforma obrigam-no a ter as autorizações que a lei exige. Quando o trabalho precisa de guia de acompanhamento de resíduos, o cartão de cada proposta mostra se a CLYON já verificou o número de transportador desse parceiro.`,
      },
      {
        q: "Fazem fatura ou recibo?",
        // Dizia que a fatura era emitida pelo profissional e que a CLYON
        // faturava só a taxa. Deixou de ser verdade a 22-09-2026: quem fatura
        // ao cliente é a parceira de `ENTIDADE_QUE_FACTURA`, sobre o preço da
        // proposta inteiro (30-09-2026). E «Sim, quando a pede» deixou de ser
        // verdade a 02-10-2026: há fatura em todas as vendas.
        a: `Sim, em todas as vendas. ${FACTURA_EM_PALAVRAS}`,
      },
    ],
  },
  {
    category: "Zonas de Atuação",
    questions: [
      {
        q: "Em que zonas de Lisboa fazem recolha de móveis?",
        a: "Toda a cidade de Lisboa — Alfama, Mouraria, Príncipe Real, Intendente, Arroios, Alvalade, Benfica, Lumiar, Telheiras, Parque das Nações, Belém, Alcântara, Campolide, Amoreiras, Avenidas Novas e as restantes freguesias — e concelhos vizinhos como Odivelas. O pedido chega aos parceiros cuja zona alcança a sua morada.",
      },
      {
        q: "Fazem recolha na Margem Sul?",
        a: "Sim. Os pedidos de Almada, Seixal, Barreiro, Corroios, Costa da Caparica, Laranjeiro, Charneca da Caparica, Feijó, Amora e arredores chegam aos parceiros da zona. O custo da deslocação entra na proposta de cada um.",
      },
      {
        q: "Fazem recolha em Setúbal, Palmela e Sesimbra?",
        a: "Sim: Setúbal, Palmela, Sesimbra, Quinta do Conde, Azeitão e concelhos próximos. Fora de Lisboa, da Margem Sul e de Setúbal, depende de haver parceiro disponível.",
      },
      {
        q: "Fazem recolha em Sintra, Cascais e Oeiras?",
        a: "Sim: Sintra, Cascais, Oeiras, Algés, Carnaxide, Paço de Arcos e toda a linha de Cascais. O custo da deslocação entra na proposta de cada parceiro.",
      },
      {
        q: "Trabalham em condomínios fechados?",
        a: "Sim. Nos condomínios fechados, o acesso trata-se com a segurança ou a portaria: basta avisar que vai entrar um parceiro com viatura para fazer o serviço.",
      },
    ],
  },
  {
    category: "Mudanças",
    questions: [
      {
        q: "Fazem mudanças de casa em Lisboa?",
        a: "Sim. Os parceiros verificados na CLYON fazem mudanças residenciais e comerciais em Lisboa, Margem Sul e Setúbal: carga, transporte e descarga. Embalagem e montagem pedem-se à parte, no pedido, e entram na proposta.",
      },
      {
        q: "Quanto custa uma mudança em Lisboa?",
        /*
         * As mudanças não publicam número — decisão de 22-08-2026, e a razão
         * está em `precos-publicos`. Esta resposta anunciava 50 €/hora e um
         * T1 a partir de 180 €, quando o motor factura uma mudança a partir
         * de 490 €. Qualquer número aqui volta a criar a mesma divergência.
         */
        /*
         * E DESDE 13-10-2026 HÁ TABELA — à hora, a do dono, a mesma que o motor
         * usa (`tabela-das-mudancas.ts`). Já não há divergência para evitar.
         */
        a: `Uma mudança paga-se à hora: ${PRECO_DA_MUDANCA_POR_EXTENSO} ${EXTRAS_DA_MUDANCA} Envie a morada de origem, a de destino e fotografias das divisões: recebe propostas grátis em menos de ${PRAZO_DE_RESPOSTA.porExtenso}.`,
      },
      {
        q: "Fazem mudanças para outras cidades como Porto ou Coimbra?",
        a: "As mudanças fazem-se a partir de Lisboa, da Margem Sul e de Setúbal. Para destinos mais longe, como o Porto ou o Algarve, depende de haver parceiro disponível — faça o pedido com as duas moradas.",
      },
      {
        q: "Incluem embalagem de caixas na mudança?",
        // "A embalagem básica está incluída" era uma promessa sobre o preço de
        // outra pessoa. O que se inclui é o que a proposta disser.
        a: "Depende da proposta. Diga no pedido o que quer embalado — as peças frágeis, a louça, os livros, a casa toda — para o parceiro contar com isso no preço.",
      },
    ],
  },
];
