/**
 * O número de MB WAY de um profissional, lido do que ele (ou o backoffice)
 * escreveu.
 *
 * Só os dígitos, e um número português tem nove e começa por 9. Um MB WAY mal
 * escrito não devolve o dinheiro nem dá erro: paga a outra pessoa. Vale a pena
 * recusar aqui em vez de descobrir depois.
 *
 * Saiu da rota do perfil a 01-10-2026, quando o backoffice passou a poder
 * corrigir o MB WAY de um profissional: duas cópias desta regra acabavam por
 * aceitar números diferentes, e a que aceitasse mais era a que pagava mal.
 */
export type LeituraDoMbway = { ok: true; valor: string | null } | { ok: false; mensagem: string };

export function lerMbway(bruto: string): LeituraDoMbway {
  const texto = bruto.trim();
  if (!texto) return { ok: true, valor: null };
  const digitos = texto.replace(/[^0-9]/g, "").replace(/^351/, "");
  if (digitos.length !== 9 || !/^9/.test(digitos)) {
    return { ok: false, mensagem: "Indique um telemóvel português de 9 dígitos." };
  }
  return { ok: true, valor: digitos };
}
