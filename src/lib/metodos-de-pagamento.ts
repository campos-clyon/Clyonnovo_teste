/**
 * OS MÉTODOS DE PAGAMENTO DA ADJUDICAÇÃO — 27-10-2026.
 *
 * O texto com os métodos de pagamento que vai na mensagem de adjudicação
 * (`mensagem-de-adjudicacao.ts`) escreve-se nas Configurações do backoffice
 * (Configs → «Métodos de pagamento para a adjudicação») e guarda-se na base.
 * Não vive no código: o repositório é público, e dados de pagamento não se
 * publicam com o código.
 *
 * Só o administrador muda o texto (`requireAdminGeral` na rota); quem prepara
 * a adjudicação (Configs e a Mesa) só o lê.
 *
 * Este ficheiro não toca na base — serve ao browser e ao servidor.
 */

/** A chave na tabela das configurações da plataforma. */
export const CHAVE_DOS_METODOS_DE_PAGAMENTO = "metodos_pagamento_adjudicacao";

/** Um limite largo para várias opções, e curto para não virar um depósito. */
export const MAXIMO_DOS_METODOS_DE_PAGAMENTO = 2000;

/** O que a mensagem diz quando ainda não há métodos escritos nas Configs. */
export const SEM_METODOS_DE_PAGAMENTO = "Enviamos-lhe os dados para o pagamento a seguir.";

/** A frase que abre a lista de opções, quando há métodos escritos. */
export const ABERTURA_DOS_METODOS = "Para o pagamento, pode usar uma destas opções:";

/**
 * O texto escrito por uma pessoa, arrumado: sem emojis (chegavam ao cliente
 * como «�», 22-10-2026), linhas sem espaços a sobrar, no máximo duas quebras
 * seguidas, e cortado no limite. Vazio, `null`.
 */
export function limparMetodosDePagamento(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const limpo = v
    .replace(/\r\n?/g, "\n")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAXIMO_DOS_METODOS_DE_PAGAMENTO)
    .trim();
  return limpo || null;
}

/** O bloco dos métodos na mensagem ao cliente — a abertura e o texto, ou a frase de espera. */
export function blocoDosMetodosDePagamento(texto: string | null | undefined): string {
  const limpo = limparMetodosDePagamento(texto ?? null);
  if (!limpo) return SEM_METODOS_DE_PAGAMENTO;
  // Se o administrador já escreveu uma abertura, não se repete.
  return /^para o pagamento/i.test(limpo) ? limpo : `${ABERTURA_DOS_METODOS}\n\n${limpo}`;
}
