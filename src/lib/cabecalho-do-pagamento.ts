/**
 * O cabeçalho onde o ecrã do pagamento manda o token do link (d24, 10-11-2026).
 * Num ficheiro à parte, puro, para o componente do browser e a rota lerem o
 * mesmo nome sem o componente importar a rota.
 */
export const CABECALHO_DO_TOKEN_DO_PAGAMENTO = "x-clyon-token-do-pedido";
