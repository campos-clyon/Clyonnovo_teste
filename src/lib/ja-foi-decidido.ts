/**
 * «JÁ FOI DECIDIDO» — 10-11-2026 (d26).
 *
 * O que lê quem chega em segundo: duas pessoas agiram na mesma negociação, ou
 * fecharam propostas diferentes do mesmo pedido, quase ao mesmo tempo. A base
 * só deixa passar a primeira (`gravarNegociacao`, com o estado que se leu); a
 * outra recebe 409 com esta frase, igual em todas as portas — o cliente, o
 * parceiro e a equipa em nome do cliente.
 */
export const JA_FOI_DECIDIDO = "Este pedido já foi decidido entretanto. Veja como ficou.";
