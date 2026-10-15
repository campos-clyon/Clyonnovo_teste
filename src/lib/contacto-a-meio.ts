/*
 * O CONTACTO DE QUEM PAROU A MEIO — 14-10-2026.
 *
 * «Guardar o nome e o telefone logo no primeiro passo do formulário da
 * página inicial, para a equipa ligar a quem desiste a meio?» — o dono: «Sim,
 * com aviso». Ao avançar do passo 1 grava-se um lead com esta origem; o
 * formulário diz por baixo do botão que isso acontece, e a política de
 * privacidade diz por quanto tempo.
 *
 * Quem termina o pedido deixa de estar «a meio»: o lead apaga-se quando o
 * pedido completo chega (a equipa não liga a quem já pediu). Quem não termina
 * sai na purga da noite ao fim de DIAS_DOS_CONTACTOS_A_MEIO (retencao.ts).
 */
export const ORIGEM_DO_CONTACTO_A_MEIO = "hero_quote_parcial";

/** A frase que vai por baixo do botão do passo 1. */
export const AVISO_DO_CONTACTO_A_MEIO =
  "Ao continuar, guardamos o nome e o telefone para a equipa o poder ajudar se não terminar o pedido.";
