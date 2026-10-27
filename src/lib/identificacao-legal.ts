/**
 * Quem é a CLYON, para efeitos legais.
 *
 * PORQUE ISTO EXISTE NUM SÍTIO SÓ
 *
 * Estes dados são obrigatórios em três documentos diferentes — Termos,
 * Privacidade e Cookies — e a lei exige que sejam os mesmos nos três. Escritos
 * à mão em cada página, um dia divergem: muda-se a morada num sítio e ficam
 * dois documentos a identificar entidades diferentes, o que é pior do que não
 * ter documento nenhum.
 *
 * O QUE FALTA PREENCHER
 *
 * A CLYON não é uma sociedade — é uma actividade aberta em nome de uma pessoa
 * singular. Isso muda a identificação: não há denominação social, nem NIPC,
 * nem matrícula na Conservatória, nem capital social. Há um nome, um NIF de
 * nove dígitos e um domicílio profissional.
 *
 * Os campos marcados com POR_PREENCHER são obrigatórios e não podem ir para o
 * ar em branco:
 *
 *   · DL 7/2004 (comércio electrónico), art. 10.º — quem presta um serviço da
 *     sociedade da informação tem de se identificar de forma direta e
 *     permanente: nome, endereço, NIF e contactos;
 *   · RGPD, art. 13.º, n.º 1, al. a) — a identidade e os contactos do
 *     responsável pelo tratamento têm de constar da informação dada ao
 *     titular dos dados.
 *
 * Sem eles, os documentos existem e não cumprem. É por isso que estão aqui a
 * gritar em vez de estarem escondidos numa página qualquer.
 */

import { TELEFONE_DA_CLYON_LEGIVEL } from "./telefone-da-clyon";

export const IDENTIFICACAO = {
  /** O nome comercial pelo qual toda a gente conhece a operação. */
  nomeComercial: "CLYON",

  /**
   * A pessoa que responde legalmente.
   *
   * Numa actividade aberta em nome individual, quem contrata é a pessoa — e é
   * o nome dela que tem de constar, mesmo que o negócio se apresente como
   * CLYON. Um documento assinado por uma marca não vincula ninguém.
   */
  nomeLegal: "Wanderson Campos Silva",

  /**
   * NIF de nove dígitos da pessoa singular com actividade aberta.
   *
   * Publicá-lo não é uma escolha: é exigido pelo artigo 10.º do DL 7/2004. E
   * não expõe nada de novo — vai em todas as facturas emitidas, e qualquer
   * cliente já servido tem-no. Escondê-lo do site não protegia ninguém e
   * deixava o site em incumprimento.
   */
  nif: "289165199",

  /**
   * A morada, ao nível da localidade — e não da porta.
   *
   * A CLYON trabalha a partir de casa e ainda não tem morada comercial. A rua
   * e o número são a residência de uma pessoa, e publicá-los num site que
   * qualquer um abre é uma exposição que nada aqui justifica.
   *
   * Esta localidade já era pública muito antes disto: o conteúdo do site diz
   * há meses que "a sede da CLYON fica em Belverde, Amora (Seixal),
   * 2845-513". Ao ficar por aqui não se acrescenta exposição nenhuma.
   *
   * ⚠️ NÃO É SUFICIENTE para o artigo 10.º do DL 7/2004, que exige o endereço
   * geográfico do estabelecimento. É um meio-termo assumido até haver morada
   * comercial — domiciliação no contabilista ou escritório virtual, que
   * custam entre 10 e 30 euros por mês e resolvem também a verificação do
   * perfil do Google, falhada sete vezes por não haver local físico.
   */
  morada: "Belverde, Amora, 2845-513 Seixal, Portugal",

  email: "geral@clyon.pt",
  telefone: TELEFONE_DA_CLYON_LEGIVEL,

  /**
   * A forma jurídica, escrita para ser lida por quem não é jurista.
   *
   * Importa dizê-la: quem contrata com um empresário em nome individual está a
   * contratar com uma pessoa, e não com uma sociedade de responsabilidade
   * limitada. Esconder isso não protege ninguém — e a lei obriga a
   * identificar-se com verdade.
   */
  formaJuridica: "Empresário em nome individual (actividade aberta)",

  /**
   * Registo de operador de resíduos, na Agência Portuguesa do Ambiente.
   *
   * Isto existia e não estava em lado nenhum do site. Os dois principais
   * concorrentes destacam o licenciamento ambiental deles — era apontado como
   * a maior desvantagem competitiva da CLYON, quando afinal o registo cá
   * estava desde sempre, só invisível.
   *
   * É um registo público, feito para ser mostrado. Mostrá-lo não expõe nada
   * que os concorrentes não exponham sobre si próprios.
   */
  codigoAPA: "APA13458563",

  /** Actividade principal e secundária, tal como registadas nas Finanças. */
  caePrincipal: "38111 — Recolha de resíduos inertes",
  caeSecundaria: "43110 — Demolição",

  /**
   * Regime de IVA da CLYON: isenção do artigo 53.º do CIVA.
   *
   * Não é um detalhe de contabilista — é o que o cliente vê no preço. Quem
   * está neste regime NÃO liquida IVA, e a factura tem de mencionar
   * "IVA — Regime de Isenção" (artigos 36.º e 40.º do CIVA).
   *
   * ⚠️ NÃO É ESTE O REGIME DA FACTURA AO CLIENTE. A CLYON está isenta e por
   * isso não pode liquidar os 23 % que o site anuncia — quem emite a factura
   * é a empresa parceira (`entidade-que-factura.ts`, só para o backoffice; ao
   * público, `QUEM_FACTURA_EM_PALAVRAS`, aqui em baixo). Confundir os dois é prometer
   * ao cliente um imposto que ninguém pode entregar ao Estado, que foi
   * exactamente o erro que este ficheiro nasceu para impedir.
   */
  regimeIva: "Isento — artigo 53.º do CIVA",

  /** Entidade de resolução alternativa de litígios de consumo, por região. */
  ralNome: "Centro de Arbitragem de Conflitos de Consumo de Lisboa",
  ralSite: "https://www.centroarbitragemlisboa.pt",

  /** O Livro de Reclamações electrónico é obrigatório para quem presta serviços. */
  livroDeReclamacoes: "https://www.livroreclamacoes.pt",

  /** A autoridade de controlo em matéria de dados pessoais. */
  cnpdSite: "https://www.cnpd.pt",
} as const;

/**
 * QUEM EMITE A FACTURA AO CLIENTE, DITO AO PÚBLICO — pela categoria, sem nome
 * nem NIF. 26-10-2026.
 *
 * A factura ao cliente não é da CLYON (que está na isenção do artigo 53.º e
 * não liquida IVA): é de uma empresa parceira, no regime normal. O dono, a
 * 26-10-2026: essa empresa não é a CLYON e não se expõe — o nome dela só vai
 * nas facturas impressas, que só o cliente recebe. No site, nas páginas em
 * inglês, nos dados estruturados, nos emails, nas mensagens, no comprovativo,
 * no painel do profissional e na app Pro diz-se só o que o cliente precisa: o
 * preço tem IVA incluído e a factura vem da empresa parceira da CLYON.
 *
 * O nome, o NIF e a morada dela vivem em `entidade-que-factura.ts`, que só o
 * backoffice importa. Este ficheiro é importado pelas páginas públicas e pela
 * app Pro: nada do que está aqui pode identificá-la. O teste
 * `empresa-parceira-fora-do-publico.test.ts` guarda as duas coisas.
 */
export const EMPRESA_PARCEIRA_AO_PUBLICO = "empresa parceira da CLYON";

/** O mesmo, em inglês, para /en. */
export const EMPRESA_PARCEIRA_EM_INGLES = "CLYON's partner company";

/**
 * QUEM EMITE A FACTURA, NUMA FRASE — a que vai para rodapés, emails e
 * mensagens. 29-09-2026; sem o nome da parceira desde 26-10-2026.
 *
 * Havia sete sítios a dizer ao cliente que «quem emite a fatura é o
 * profissional», e um a dizer «para lhe podermos passar factura», como se
 * fosse a CLYON. Nenhum era verdade desde 22-09-2026. Escrita uma vez, a
 * frase muda num sítio só.
 */
export const QUEM_FACTURA_EM_PALAVRAS = `A factura é emitida pela ${EMPRESA_PARCEIRA_AO_PUBLICO}.`;

/**
 * Falta alguma coisa para cumprir o artigo 10.º do DL 7/2004?
 *
 * Verificava se o nome e o NIF ainda eram marcadores. Deixou de servir quando
 * foram preenchidos — e o que falta agora é outra coisa: o endereço
 * geográfico do estabelecimento. A morada acima está ao nível da localidade,
 * de propósito, porque a rua é a residência de uma pessoa.
 *
 * Passar isto a `true` quando houver morada comercial faz o aviso desaparecer
 * de todas as páginas legais de uma só vez.
 */
const MORADA_COMPLETA = false;

export function identificacaoCompleta(): boolean {
  return MORADA_COMPLETA;
}

/** O que ainda falta, escrito para quem lê a página. */
export const O_QUE_FALTA =
  "Falta a morada completa do estabelecimento. A que consta está ao nível da " +
  "localidade — a CLYON opera a partir de casa e a rua é uma residência. " +
  "Resolve-se com uma morada comercial (domiciliação no contabilista ou " +
  "escritório virtual).";

/** A linha de identificação, montada por extenso. */
export function linhaDeIdentificacao(): string {
  return `${IDENTIFICACAO.nomeLegal}, ${IDENTIFICACAO.formaJuridica.toLowerCase()}, NIF ${IDENTIFICACAO.nif}, com domicílio profissional em ${IDENTIFICACAO.morada}, que opera sob o nome comercial ${IDENTIFICACAO.nomeComercial}`;
}

/** As percentagens, para não serem reescritas à mão nos documentos. */
export { TAXA_CLIENTE, TAXA_PROFISSIONAL, TAXA_IVA } from "./taxas-plataforma";
