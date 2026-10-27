/*
 * O TELEFONE DA CLYON, NUM SÍTIO SÓ — 27-10-2026 (decisão d12).
 *
 * Estava escrito à mão em 24 ficheiros (inicial, contactos, landing do Ads,
 * páginas de serviço, simulador, backoffice) e em três constantes
 * (BUSINESS_PHONE, IDENTIFICACAO.telefone, NUMERO_MANUAL_POR_OMISSAO). Hoje
 * diziam todos o mesmo; no dia em que o número mudar (o da API do WhatsApp
 * está à espera), muda-se aqui e mais nada. O teste da orquestra
 * (orquestra.test.ts, regra e) chumba o número escrito à mão noutro ficheiro.
 *
 * Sem imports de propósito: seo-data.ts e identificacao-legal.ts lêem daqui,
 * e um lê o outro.
 */

/** «+351931632622» — para `tel:` e para o schema.org. */
export const TELEFONE_DA_CLYON = "+351931632622";

/** «351931632622» — só os dígitos, para o `wa.me`. */
export const TELEFONE_DA_CLYON_DIGITOS = TELEFONE_DA_CLYON.replace(/\D/g, "");

/** «931 632 622» — como se diz em Portugal. */
export const TELEFONE_DA_CLYON_NACIONAL = TELEFONE_DA_CLYON_DIGITOS.slice(3).replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");

/** «+351 931 632 622» — como se lê, com o indicativo. */
export const TELEFONE_DA_CLYON_LEGIVEL = `+351 ${TELEFONE_DA_CLYON_NACIONAL}`;

/** «tel:+351931632622». */
export const TEL_DA_CLYON = `tel:${TELEFONE_DA_CLYON}`;

/** «https://wa.me/351931632622» — junta-se-lhe «?text=…». */
export const WHATSAPP_DA_CLYON = `https://wa.me/${TELEFONE_DA_CLYON_DIGITOS}`;
