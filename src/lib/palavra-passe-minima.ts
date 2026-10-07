/**
 * O MÍNIMO DA PALAVRA-PASSE DO PROFISSIONAL, à parte — 07-10-2026.
 *
 * Vivia em `profissional-auth.ts`, que é do servidor: assina sessões com a
 * `jose` e compara palavras-passe com o `bcryptjs`. Os dois ecrãs que mostram
 * o mínimo («Pelo menos 10 caracteres») importavam-no de lá, e com ele iam
 * parar ao telemóvel do profissional cerca de 70 KB de código que lá não
 * serve para nada — num painel que o Speed Insights já dava como lento.
 *
 * Aqui não há dependência nenhuma; `profissional-auth.ts` reexporta-o, e as
 * regras continuam a ser as de lá (`validarPalavraPasse`).
 */

/** Mínimo aceitável. Curta demais não protege nada. */
export const MINIMO_DA_PALAVRA_PASSE = 10;
