/**
 * A avaliação do profissional, pelo cliente.
 *
 * Numa plataforma sem reputação, o cliente só tem o preço para decidir — e o
 * preço sozinho premeia quem corta no trabalho. A avaliação é o que dá valor a
 * fazer bem feito, e é a única coisa que um profissional novo não pode
 * comprar.
 *
 * Só avalia quem contratou E confirmou. Uma avaliação de quem não chegou a ser
 * servido não diz nada sobre o trabalho — diz sobre a negociação, que é outra
 * conversa — e é a porta por onde entram as avaliações compradas e as
 * vinganças.
 */

export const ESTRELAS_MINIMAS = 1;
export const ESTRELAS_MAXIMAS = 5;

/** Acima disto, um comentário deixa de ser um comentário. */
export const MAXIMO_DO_COMENTARIO = 600;

export type ErroDeAvaliacao = { campo: string; mensagem: string };

export type ResultadoDaAvaliacao =
  | { ok: true; dados: { estrelas: number; comentario: string | null } }
  | { ok: false; erros: ErroDeAvaliacao[] };

export function validarAvaliacao(corpo: unknown): ResultadoDaAvaliacao {
  const erros: ErroDeAvaliacao[] = [];
  const c = (corpo ?? {}) as Record<string, unknown>;

  const estrelas = Number(c.estrelas);
  if (
    !Number.isInteger(estrelas) ||
    estrelas < ESTRELAS_MINIMAS ||
    estrelas > ESTRELAS_MAXIMAS
  ) {
    erros.push({ campo: "estrelas", mensagem: "Escolha de 1 a 5 estrelas." });
  }

  // O comentário é opcional. Obrigá-lo faria a maior parte das pessoas não
  // avaliar de todo — e uma nota sem texto continua a valer.
  const comentario =
    typeof c.comentario === "string" ? c.comentario.trim().slice(0, MAXIMO_DO_COMENTARIO) : "";

  if (erros.length > 0) return { ok: false, erros };
  return { ok: true, dados: { estrelas, comentario: comentario || null } };
}

export type Avaliacao = { estrelas: number };

/**
 * A média e quantas.
 *
 * A média sozinha mente: 5,0 de uma avaliação não é melhor do que 4,6 de
 * quarenta. Quem mostra uma tem de mostrar a outra ao lado.
 */
export function mediaDasAvaliacoes(lista: Avaliacao[]): {
  media: number | null;
  quantas: number;
} {
  const validas = lista.filter(
    (a) => Number.isFinite(a.estrelas) && a.estrelas >= 1 && a.estrelas <= 5,
  );
  if (validas.length === 0) return { media: null, quantas: 0 };
  const soma = validas.reduce((s, a) => s + a.estrelas, 0);
  return {
    media: Math.round((soma / validas.length) * 10) / 10,
    quantas: validas.length,
  };
}
