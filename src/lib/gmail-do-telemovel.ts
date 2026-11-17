/**
 * O GMAIL DO TELEMÓVEL — 17-11-2026 (d61).
 *
 * A lista de testadores da Google Play reconhece a conta Google que está no
 * telemóvel Android. Quase sempre é um @gmail.com (o @googlemail.com é o mesmo
 * Gmail, com o nome antigo). Uma empresa convidada para o teste da app usou o
 * email da empresa, e a Play não lhe abria nada: por isso a adesão em passos
 * (/app-pro e /app-cliente) avisa logo, numa frase, quando o email não é Gmail.
 *
 * Puro: serve ao navegador e ao servidor.
 */

export const GMAIL = /^[a-z0-9.+_-]+@(gmail|googlemail)\.com$/;

/** O email limpo (minúsculas, sem espaços à volta). */
export function emailLimpo(cru: unknown): string {
  return typeof cru === "string" ? cru.trim().toLowerCase() : "";
}

/** É um Gmail (ou um Googlemail) — o que a Play reconhece no telemóvel. */
export function eGmail(cru: unknown): boolean {
  const e = emailLimpo(cru);
  return e.length <= 120 && GMAIL.test(e);
}
