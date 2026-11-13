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
