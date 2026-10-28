/**
 * AS AVALIAÇÕES QUE O SITE CITA — UM SÓ NÚMERO POR FONTE, SEMPRE COM A FONTE.
 * (28-10-2026, decisão d1 «Plano de SEO e autoridade».)
 *
 * Três análises de fora leram 46, 42, 155 e 165 em páginas diferentes. O 46 é
 * o Google; o 165 era a soma do Google com a Fixando, mostrada como
 * «165 avaliações» sem dizer de onde; o 42 e o 155 eram o Google e a soma de
 * antes de 25-10-2026, ainda guardados por quem copiou a página. Quem lê
 * números diferentes não pensa que um é antigo — pensa que nenhum é verdade.
 *
 * Por isso:
 *   · cada fonte tem o seu número e a sua nota, e nunca se somam;
 *   · cada número diz de onde vem («46 avaliações no Google») e, como é uma
 *     contagem feita à mão no perfil, o mês em que foi vista;
 *   · quando o perfil mudar, muda-se AQUI (número, nota e `vistaEm`) e o site
 *     inteiro acompanha. Um teste chumba contagens escritas à mão noutro sítio.
 *
 * NOS DADOS ESTRUTURADOS NÃO ENTRAM. As regras do Google para os «review
 * snippets» não aceitam avaliações recolhidas noutros sites (Google, Fixando),
 * nem o negócio a avaliar-se a si próprio. As únicas estrelas declaradas no
 * site são as das páginas dos profissionais, feitas por clientes NA
 * plataforma e lidas da base («avaliações na CLYON»).
 *
 * Este ficheiro não importa nada, de propósito: o seo-data.ts reexporta-o.
 */

export interface ContagemDeAvaliacoes {
  /** De onde vêm — o nome que o cliente reconhece. */
  fonte: "Google" | "Fixando";
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

/** O perfil da CLYON na Fixando, conferido a 28-10-2026 (119, nota 5,0). */
export const AVALIACOES_NA_FIXANDO: ContagemDeAvaliacoes = {
  fonte: "Fixando",
  numero: 119,
  nota: "5,0",
  vistaEm: "2026-10-28",
  url: "https://www.fixando.pt/profile/591621/clyon",
};

/**
 * As contratações registadas na Fixando — contadas a 22-08-2026. A página
 * pública do perfil não as mostra sem JavaScript, e a 28-10-2026 não se
 * conseguiram reconfirmar; por isso levam o mês da contagem.
 */
export const CONTRATACOES_NA_FIXANDO = { numero: 158, vistaEm: "2026-08-22" } as const;

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

/** «outubro de 2026», ou «outubro e agosto de 2026» quando as duas não coincidem. */
function mesesDasContagens(...cs: Array<{ vistaEm: string }>): string {
  const meses = [...new Set(cs.map(mesDaContagem))];
  return meses.length === 1 ? meses[0] : meses.join(" e ");
}

/** O mês das duas contagens de avaliações, para as frases que citam as duas. */
export const MES_DAS_CONTAGENS = mesesDasContagens(AVALIACOES_NO_GOOGLE, AVALIACOES_NA_FIXANDO);

/**
 * A forma antiga, que as páginas já liam (`AVALIACOES.google`, `.notaGoogle`…),
 * agora feita das contagens de cima. Não há total: as fontes não se somam.
 */
export const AVALIACOES = {
  google: AVALIACOES_NO_GOOGLE.numero,
  notaGoogle: AVALIACOES_NO_GOOGLE.nota,
  fixando: AVALIACOES_NA_FIXANDO.numero,
  notaFixando: AVALIACOES_NA_FIXANDO.nota,
  /** Contratações registadas na Fixando (ver CONTRATACOES_NA_FIXANDO). */
  contratacoes: CONTRATACOES_NA_FIXANDO.numero,
  googleUrl: AVALIACOES_NO_GOOGLE.url,
  escreverNoGoogleUrl: ESCREVER_NO_GOOGLE_URL,
  fixandoUrl: AVALIACOES_NA_FIXANDO.url,
} as const;

/** «4,9 no Google · 5,0 na Fixando» — só as notas, para selos e linhas curtas. */
export const NOTAS_EM_LINHA = `${AVALIACOES.notaGoogle} no Google · ${AVALIACOES.notaFixando} na Fixando`;

/** «46 avaliações no Google» */
export const NO_GOOGLE = `${AVALIACOES_NO_GOOGLE.numero} avaliações no Google`;

/** «119 avaliações na Fixando» */
export const NA_FIXANDO = `${AVALIACOES_NA_FIXANDO.numero} avaliações na Fixando`;

/** «46 no Google · 119 na Fixando (outubro de 2026)» — as duas contagens, cada uma com a sua fonte. */
export const CONTAGENS_EM_LINHA =
  `${AVALIACOES_NO_GOOGLE.numero} no Google · ${AVALIACOES_NA_FIXANDO.numero} na Fixando ` +
  `(${MES_DAS_CONTAGENS})`;

/** «4,9 em 46 avaliações no Google e 5,0 em 119 na Fixando (outubro de 2026)» — para frases. */
export const NOTAS_EM_FRASE =
  `${AVALIACOES_NO_GOOGLE.nota} em ${NO_GOOGLE} e ` +
  `${AVALIACOES_NA_FIXANDO.nota} em ${AVALIACOES_NA_FIXANDO.numero} na Fixando (${MES_DAS_CONTAGENS})`;

/** «158 trabalhos contratados na Fixando (agosto de 2026)» */
export const CONTRATACOES_EM_FRASE =
  `${CONTRATACOES_NA_FIXANDO.numero} trabalhos contratados na Fixando (${mesDaContagem(CONTRATACOES_NA_FIXANDO)})`;

/**
 * As avaliações da própria plataforma (as de cada profissional, na base) têm
 * este nome sempre que aparecem com um número: «12 avaliações na CLYON».
 */
export function avaliacoesNaClyon(n: number): string {
  return `${n} ${n === 1 ? "avaliação" : "avaliações"} na CLYON`;
}
