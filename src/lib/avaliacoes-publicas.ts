/**
 * AS AVALIAÇÕES QUE O SITE CITA — UM SÓ NÚMERO, SEMPRE COM A FONTE.
 * (28-10-2026, decisão d1 «Plano de SEO e autoridade».)
 *
 * Três análises de fora leram 46, 42, 155 e 165 em páginas diferentes. O 46 é
 * o Google; o 165 era a soma do Google com a Fixando, mostrada como
 * «165 avaliações» sem dizer de onde; o 42 e o 155 eram o Google e a soma de
 * antes de 25-10-2026, ainda guardados por quem copiou a página. Quem lê
 * números diferentes não pensa que um é antigo — pensa que nenhum é verdade.
 *
 * Por isso:
 *   · o número diz de onde vem («46 avaliações no Google») e, como é uma
 *     contagem feita à mão no perfil, o mês em que foi vista;
 *   · quando o perfil mudar, muda-se AQUI (número, nota e `vistaEm`) e o site
 *     inteiro acompanha. Um teste chumba contagens escritas à mão noutro sítio.
 *
 * SÓ AS DO GOOGLE — 28-10-2026, decisão do dono. A contagem e a nota da
 * Fixando saíram de todos os textos e metadados, e as contratações de lá
 * também: a prova que o site cita é a que qualquer pessoa confirma num perfil
 * aberto, escrita por clientes. O endereço do perfil da Fixando fica só nos
 * dados estruturados (`sameAs`), onde liga a mesma entidade, sem número.
 * A regra j do teste da orquestra chumba qualquer contagem da Fixando.
 *
 * NOS DADOS ESTRUTURADOS NÃO ENTRAM. As regras do Google para os «review
 * snippets» não aceitam avaliações recolhidas noutros sites, nem o negócio a
 * avaliar-se a si próprio. As únicas estrelas declaradas no site são as das
 * páginas dos profissionais, feitas por clientes NA plataforma e lidas da
 * base («avaliações na CLYON»).
 *
 * Este ficheiro não importa nada, de propósito: o seo-data.ts reexporta-o.
 */

export interface ContagemDeAvaliacoes {
  /** De onde vêm — o nome que o cliente reconhece. */
  fonte: "Google";
  /** Quantas avaliações o perfil mostrava no dia `vistaEm`. */
  numero: number;
  /** A nota do perfil, com vírgula, como se escreve em português. */
  nota: string;
  /** AAAA-MM-DD: o dia em que alguém abriu o perfil e as contou. */
  vistaEm: string;
  /** O perfil onde qualquer pessoa as confirma — não uma pesquisa. */
  url: string;
}

/** O perfil da CLYON no Google, conferido a 25-10-2026 (passou de 42 para 46). */
export const AVALIACOES_NO_GOOGLE: ContagemDeAvaliacoes = {
  fonte: "Google",
  numero: 46,
  nota: "4,9",
  vistaEm: "2026-10-25",
  url: "https://www.google.com/maps/place/?q=place_id:ChIJ2xaOVcnL4kMR7EuKIRXfa1Y",
};

/**
 * O perfil da CLYON na Fixando — SÓ para o `sameAs` dos dados estruturados
 * (layout.tsx). Sem número, sem nota e sem ligação visível (28-10-2026).
 */
export const PERFIL_NA_FIXANDO_URL = "https://www.fixando.pt/profile/591621/clyon";

/** O endereço para pedir a um cliente que escreva a avaliação dele no Google. */
export const ESCREVER_NO_GOOGLE_URL =
  "https://search.google.com/local/writereview?placeid=ChIJ2xaOVcnL4kMR7EuKIRXfa1Y";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** «outubro de 2026» — o mês em que a contagem foi vista no perfil. */
export function mesDaContagem(c: { vistaEm: string }): string {
  const [ano, mes] = c.vistaEm.split("-").map(Number);
  return `${MESES[mes - 1]} de ${ano}`;
}

/** O mês da contagem do Google, para as frases que a citam. */
export const MES_DAS_CONTAGENS = mesDaContagem(AVALIACOES_NO_GOOGLE);

/** A forma que as páginas já liam (`AVALIACOES.google`, `.notaGoogle`…), feita da contagem de cima. */
export const AVALIACOES = {
  google: AVALIACOES_NO_GOOGLE.numero,
  notaGoogle: AVALIACOES_NO_GOOGLE.nota,
  googleUrl: AVALIACOES_NO_GOOGLE.url,
  escreverNoGoogleUrl: ESCREVER_NO_GOOGLE_URL,
} as const;

/** «4,9 no Google» — só a nota, para selos e linhas curtas. */
export const NOTAS_EM_LINHA = `${AVALIACOES.notaGoogle} no Google`;

/** «46 avaliações no Google» */
export const NO_GOOGLE = `${AVALIACOES_NO_GOOGLE.numero} avaliações no Google`;

/** «46 avaliações no Google (outubro de 2026)» — a contagem, com a fonte e o mês. */
export const CONTAGENS_EM_LINHA = `${NO_GOOGLE} (${MES_DAS_CONTAGENS})`;

/** «4,9 em 46 avaliações no Google (outubro de 2026)» — para frases. */
export const NOTAS_EM_FRASE = `${AVALIACOES_NO_GOOGLE.nota} em ${NO_GOOGLE} (${MES_DAS_CONTAGENS})`;

/**
 * As avaliações da própria plataforma (as de cada profissional, na base) têm
 * este nome sempre que aparecem com um número: «12 avaliações na CLYON».
 */
export function avaliacoesNaClyon(n: number): string {
  return `${n} ${n === 1 ? "avaliação" : "avaliações"} na CLYON`;
}
