/**
 * O RÓTULO DO MB WAY NO PERFIL DO PARCEIRO — d10. Opcional até 15-11-2026;
 * obrigatório depois (`dados-para-receber.ts`). O painel e a app CLYON Pro lêem-no
 * daqui, para dizerem o mesmo; quem diz se o modelo novo vale é o painel pela data
 * e a app pela resposta do servidor (`perfil.novoModelo`).
 *
 * Puro e sem imports: a app importa-o tal e qual.
 */
export function rotuloDoMbway(obrigatorio: boolean): string {
  return obrigatorio ? "MB WAY (obrigatório)" : "MB WAY (opcional)";
}

/**
 * A AJUDA POR BAIXO DO MB WAY — d16 (13-11-2026). Até 15-11 é por onde a CLYON
 * lhe paga; depois, é para onde o cliente lhe paga.
 */
export function ajudaDoMbway(obrigatorio: boolean): string {
  return obrigatorio
    ? "O número para onde o cliente lhe paga por MB WAY. Pode ser diferente do de contacto."
    : "Outra forma de lhe pagarmos. Pode ser um número diferente do de contacto.";
}
