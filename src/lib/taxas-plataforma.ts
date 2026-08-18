/**
 * As comissões da CLYON, num sítio só.
 *
 * Estavam prestes a ficar espalhadas por três ficheiros — o email ao
 * profissional, a página dele e o cálculo do pagamento — e três cópias de uma
 * percentagem é a forma mais rápida de um dia o cliente ver 6 % e a fatura
 * dizer outra coisa.
 *
 * Decidido em 16-08-2026. Não confundir com as da app, que são outras (5 % de
 * reserva ao cliente e 10 % de aceitação ao profissional, com o preço fechado
 * pela CLYON). A divergência é deliberada: testa-se o modelo novo no site
 * antes de lhe tocar na app.
 */

/** Somada ao valor acordado, no que o cliente paga. */
export const TAXA_CLIENTE = 0.06;

/** Descontada ao valor acordado, no que o profissional recebe. */
export const TAXA_PROFISSIONAL = 0.05;

function aosCentimos(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** O que a CLYON fica, sobre o valor acordado. */
export const TAXA_TOTAL = TAXA_CLIENTE + TAXA_PROFISSIONAL;

/**
 * IVA à taxa normal portuguesa.
 *
 * ⚠️ Aplica-se a TODOS os trabalhos, por decisão de 18-08-2026, e isso merece
 * ficar escrito com o alerta que lhe corresponde.
 *
 * Quem presta o serviço é o profissional, e o IVA é do regime DELE: um
 * profissional em isenção (art. 53.º do CIVA) não liquida IVA nenhum. Mostrar
 * 23 % a um cliente que contrata um isento é mostrar-lhe um imposto que ele não
 * deve — e que ninguém pode entregar ao Estado. O risco foi levantado e a
 * decisão foi tomada na mesma.
 *
 * Se um dia se quiser corrigir, o caminho é perguntar o regime na inscrição do
 * profissional e decidir por perfil; a decomposição abaixo continua a servir.
 */
export const TAXA_IVA = 0.23;

/**
 * O valor negociado JÁ INCLUI o IVA — decompõe-se, não se soma.
 *
 * A alternativa era somar 23 % ao valor acordado, e aí 350 € negociados
 * passavam a 430,50 € na confirmação. Ninguém aceita um salto desses depois de
 * ter combinado um número: o cliente negoceia sobre o que vai pagar pelo
 * serviço, não sobre uma base a que se acrescenta imposto no fim.
 */
export function decomporIva(valorComIva: number): { base: number; iva: number } {
  const base = aosCentimos(valorComIva / (1 + TAXA_IVA));
  // O IVA sai por diferença e não por multiplicação: assim base + iva dá
  // exactamente o valor acordado, sem um cêntimo a sobrar do arredondamento.
  return { base, iva: aosCentimos(valorComIva - base) };
}

/** O que o cliente paga: acordado + 6 %. */
export function quantoOClientePaga(acordado: number): number {
  return aosCentimos(acordado * (1 + TAXA_CLIENTE));
}

/**
 * O que o profissional recebe: acordado − 5 %.
 *
 * É este o número que se lhe mostra em todo o lado, incluindo no saldo cativo.
 * Nunca o bruto: mostrar 200 retidos e 190 disponíveis levantava a pergunta
 * "onde foram os 10 €", e a resposta certa é que nunca foram dele.
 */
export function quantoOProfissionalRecebe(acordado: number): number {
  return aosCentimos(acordado * (1 - TAXA_PROFISSIONAL));
}

/** O que fica para a CLYON sobre um trabalho fechado. */
export function comissaoDaClyon(acordado: number): number {
  return aosCentimos(quantoOClientePaga(acordado) - quantoOProfissionalRecebe(acordado));
}
