/**
 * «RECUSAR» UMA PROPOSTA — d8 fase 2, S8 (28-10-2026; P4 do dono).
 *
 * As duas perguntas antes de recusar, iguais no site (a página do link e a
 * conta) e na app (`textos.recusar` da R5). `{nome}` é o nome do profissional.
 * Recusar é a acção `desistir` do cliente, e o profissional é avisado — no
 * telemóvel e por email.
 */
export const RECUSAR = {
  comOutras: "Recusar a proposta de {nome}? As outras continuam.",
  semOutras: "Recusar a proposta de {nome}? O pedido continua aberto a outras propostas.",
} as const;

export function perguntaDeRecusar(nome: string, haOutras: boolean): string {
  return (haOutras ? RECUSAR.comOutras : RECUSAR.semOutras).replaceAll("{nome}", nome);
}
