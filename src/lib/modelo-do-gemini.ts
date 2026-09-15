/**
 * O MODELO DO GEMINI — um só nome, num só sítio.
 *
 * A 15-09-2026 o assistente do WhatsApp passou o dia a responder por
 * palavras-chave. O termómetro do painel dizia porquê, com todas as letras:
 *
 *   [404 Not Found] This model models/gemini-2.5-flash is no longer available
 *   to new users. Please update your code to use models/gemini-3.6-flash
 *
 * A Google retirou o modelo. Todas as chamadas devolviam 404, a escada caía
 * para o irmão da mesma geração — que está no mesmo caso — e o cérebro ficou
 * sem leitura nenhuma. Foi por isto que «Parece-me bem» levou de volta um
 * ponto de situação e uma contraproposta de 250 € nunca chegou à mesa.
 *
 * O nome estava escrito à mão em seis ficheiros, com quatro valores
 * diferentes: `gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-flash` e
 * `google/gemini-2.0-flash`. Corrigir um deixava os outros a 404 até alguém
 * dar por isso — e dar por isso levou dois dias e uma cliente perdida.
 *
 * QUEM USA ISTO é quem fala pelo `@google/generative-ai`, com nomes secos.
 * As rotas do chat do simulador falam pelo SDK `ai`, que exige o nome com
 * fornecedor à frente (`google/…`) — essas têm o `CHAT_MODEL` só delas, e de
 * propósito: partilhar a variável fazia com que arranjar o WhatsApp partisse
 * o simulador.
 */

/** O que a Google mandou usar, na mensagem de erro dela própria. */
export const MODELO_ACTUAL = "gemini-3.6-flash";

/**
 * Os que já não respondem a quem chega agora.
 *
 * Isto não é uma lista de modelos velhos: é a lista dos que vimos devolver
 * 404. Está aqui para que uma variável de ambiente esquecida no Vercel — a
 * apontar para um modelo morto — não volte a calar o assistente enquanto
 * ninguém tem tempo de ir lá mudá-la. O código corrige-a sozinho e diz que a
 * corrigiu.
 */
export const RETIRADOS = new Set([
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
]);

/**
 * O modelo a usar, com a variável de ambiente a mandar — excepto quando ela
 * aponta para um modelo que já não existe.
 */
export function modeloDoGemini(...preferidos: Array<string | undefined>): string {
  for (const p of preferidos) {
    const nome = p?.trim();
    if (!nome) continue;
    if (RETIRADOS.has(nome)) {
      console.warn(
        `[gemini] ${nome} foi retirado pela Google — a usar ${MODELO_ACTUAL} em vez dele.`,
      );
      continue;
    }
    return nome;
  }
  return MODELO_ACTUAL;
}

/**
 * A escada, sem degraus podres e sem repetições.
 *
 * Não se inventa aqui um segundo modelo «mais fraco»: um nome adivinhado
 * devolve 404 tão depressa como o anterior, e gasta uma chamada e dezoito
 * segundos de quem está à espera no WhatsApp. Quem quiser um segundo degrau
 * põe-no na variável, com um nome que exista.
 */
export function escadaLimpa(...candidatos: Array<string | undefined>): string[] {
  const limpos = candidatos
    .map((c) => c?.trim())
    .filter((c): c is string => Boolean(c) && !RETIRADOS.has(c as string));
  return [...new Set([...limpos, MODELO_ACTUAL])];
}
