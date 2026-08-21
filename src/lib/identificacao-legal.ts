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
 *     sociedade da informação tem de se identificar de forma directa e
 *     permanente: nome, endereço, NIF e contactos;
 *   · RGPD, art. 13.º, n.º 1, al. a) — a identidade e os contactos do
 *     responsável pelo tratamento têm de constar da informação dada ao
 *     titular dos dados.
 *
 * Sem eles, os documentos existem e não cumprem. É por isso que estão aqui a
 * gritar em vez de estarem escondidos numa página qualquer.
 */

/** Marcador visível. Aparece tal e qual no site enquanto não for substituído. */
const POR_PREENCHER = "[POR PREENCHER]";

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
  nomeLegal: POR_PREENCHER,

  /** NIF de nove dígitos da pessoa singular com actividade aberta. */
  nif: POR_PREENCHER,

  /** O domicílio profissional declarado nas Finanças. */
  morada: "Belverde, Amora, 2845-513 Seixal, Portugal",

  email: "geral@clyon.pt",
  telefone: "+351 931 632 622",

  /**
   * A forma jurídica, escrita para ser lida por quem não é jurista.
   *
   * Importa dizê-la: quem contrata com um empresário em nome individual está a
   * contratar com uma pessoa, e não com uma sociedade de responsabilidade
   * limitada. Esconder isso não protege ninguém — e a lei obriga a
   * identificar-se com verdade.
   */
  formaJuridica: "Empresário em nome individual (actividade aberta)",

  /** Entidade de resolução alternativa de litígios de consumo, por região. */
  ralNome: "Centro de Arbitragem de Conflitos de Consumo de Lisboa",
  ralSite: "https://www.centroarbitragemlisboa.pt",

  /** O Livro de Reclamações electrónico é obrigatório para quem presta serviços. */
  livroDeReclamacoes: "https://www.livroreclamacoes.pt",

  /** A autoridade de controlo em matéria de dados pessoais. */
  cnpdSite: "https://www.cnpd.pt",
} as const;

/** Está pronto para ir para o ar? */
export function identificacaoCompleta(): boolean {
  return IDENTIFICACAO.nomeLegal !== POR_PREENCHER && IDENTIFICACAO.nif !== POR_PREENCHER;
}

/** A linha de identificação, montada por extenso. */
export function linhaDeIdentificacao(): string {
  return `${IDENTIFICACAO.nomeLegal}, ${IDENTIFICACAO.formaJuridica.toLowerCase()}, NIF ${IDENTIFICACAO.nif}, com domicílio profissional em ${IDENTIFICACAO.morada}, que opera sob o nome comercial ${IDENTIFICACAO.nomeComercial}`;
}

/** As percentagens, para não serem reescritas à mão nos documentos. */
export { TAXA_CLIENTE, TAXA_PROFISSIONAL, TAXA_IVA } from "./taxas-plataforma";
