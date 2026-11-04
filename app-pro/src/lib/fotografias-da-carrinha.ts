/**
 * AS FOTOGRAFIAS DA CARRINHA, NA APP — 04-11-2026 (decisão d17).
 *
 * Os números e as frases são os de `src/lib/fotografias-da-carrinha.ts`, à
 * letra: o formulário do site, o painel e o servidor lêem de lá. A app não
 * pode importar esse ficheiro (ele e o `url-externo-seguro.ts` que ele importa
 * lêem `process.env`, que no telemóvel vem vazio, e a guarda de
 * `app-pro.test.ts` recusa-o). Por isso fica aqui uma cópia, e
 * `src/lib/app-pro-d17-fotografias.test.ts` chumba no dia em que as duas
 * deixarem de ser iguais — como a cópia de `sinais-do-cartao.ts`.
 */

/** Quantas, no mínimo, para a candidatura seguir. */
export const MINIMO_DE_FOTOGRAFIAS_DA_CARRINHA = 1;

/** Quantas, no máximo — na candidatura e no perfil («A minha carrinha»). */
export const MAXIMO_DE_FOTOGRAFIAS_DA_CARRINHA = 4;

/** O nome do campo na candidatura. */
export const ROTULO_DAS_FOTOGRAFIAS_DA_CARRINHA = "Fotografias da carrinha";

/** O texto por baixo do campo — na candidatura e no perfil. */
export const AJUDA_DAS_FOTOGRAFIAS_DA_CARRINHA =
  "Por fora e a caixa de carga, para sabermos o que a sua carrinha leva. O cliente não as vê.";

/** Sem fotografia nenhuma, a candidatura não segue (a mesma frase que o servidor devolve). */
export const MENSAGEM_SEM_FOTOGRAFIA =
  "Junte pelo menos uma fotografia da carrinha, por fora ou da caixa de carga. Sem ela, a candidatura não segue.";

/**
 * O lado maior de cada fotografia da candidatura, em px — o mesmo do
 * formulário do site (`LADO_MAXIMO` de `src/lib/reduzir-imagem.ts`).
 */
export const LADO_DAS_FOTOGRAFIAS_DA_CANDIDATURA = 1920;
