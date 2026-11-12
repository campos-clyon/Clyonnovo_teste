import { CODIGOS_DA_PALAVRA_PASSE } from "../../../src/lib/dados-de-pagamento-mudados";

/**
 * O 401 QUE NÃO É A SESSÃO A ACABAR — 12-11-2026 (decisão d1).
 *
 * Mudar o IBAN, o titular ou o MB WAY pede a palavra-passe da conta
 * (`palavraPasse` no corpo do PUT do perfil). Sem ela, ou errada, o site
 * responde 401 com um `codigo` (`CODIGOS_DA_PALAVRA_PASSE`, em
 * src/lib/dados-de-pagamento-mudados.ts). Regra do contrato: um 401 COM
 * `codigo` diz o que falta e NUNCA faz sair; só o 401 sem ele
 * («Não autenticado») é a sessão que expirou.
 */
export function quatrocentosEUmComCodigo(estado: number, corpo: Record<string, unknown>): boolean {
  return estado === 401 && typeof corpo.codigo === "string" && corpo.codigo.length > 0;
}

/** O 401 é o da palavra-passe dos dados de pagamento (falta, errada, ou a conta não tem). */
export function eDaPalavraPasse(corpo: Record<string, unknown>): boolean {
  return (Object.values(CODIGOS_DA_PALAVRA_PASSE) as string[]).includes(String(corpo.codigo ?? ""));
}

/** A conta ainda não tem palavra-passe: o ecrã mostra «Esqueci-me da palavra-passe». */
export function contaSemPalavraPasse(corpo: Record<string, unknown>): boolean {
  return corpo.codigo === CODIGOS_DA_PALAVRA_PASSE.semPalavraPasse;
}
