/**
 * O EMAIL MASCARADO — uma função só (d8, S1, 28-10-2026).
 *
 * Os ecrãs de entrada mostram de quem é a conta sem a escrever toda: a
 * primeira letra antes da @, «•••», a @ e o domínio inteiro — «j•••@gmail.com».
 * A app (E1a) e o site dizem-no da mesma maneira porque usam esta função.
 *
 * Pura: o browser e a app podem importá-la.
 */
export function mascararEmail(email: string | null | undefined): string {
  const e = (email ?? "").trim();
  const arroba = e.lastIndexOf("@");
  if (arroba <= 0 || arroba === e.length - 1) return "•••";
  const primeira = [...e.slice(0, arroba)][0] ?? "";
  return `${primeira}•••@${e.slice(arroba + 1)}`;
}
