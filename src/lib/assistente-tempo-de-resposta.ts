/**
 * QUANTO TEMPO O ASSISTENTE ESPERA ANTES DE RESPONDER.
 *
 * "Quero adicionar configurações para o assistente, a primeira será tempo de
 * resposta, onde posso mudar o tempo que ele levará para responder às
 * mensagens enviadas." — 14-09-2026.
 *
 * Hoje responde no instante em que a mensagem chega, e isso lê-se. Uma
 * resposta em trezentos milissegundos diz «máquina» antes de dizer o que quer
 * que seja — e, mais importante, não deixa ninguém chegar primeiro: quem está
 * no painel vê a mensagem e o assistente já respondeu por cima.
 *
 * COMEÇA EM ZERO, de propósito. Zero é exactamente o que o sistema faz hoje,
 * e uma configuração nova que mude o comportamento de produção no dia em que
 * nasce é uma configuração que ninguém pediu. Sobe-se quando se quiser.
 *
 * ONDE ISTO É APLICADO: na fila de saída. A ponte do Winapp não recebe a
 * resposta — vem buscá-la — e por isso basta a resposta não estar disponível
 * antes da hora. Não há ninguém a dormir à espera, não há cron novo, e o
 * atraso é ao segundo. Ver `guardarNaFilaWhatsApp` e `filaWhatsAppPorEnviar`.
 */

/** A chave desta configuração na tabela. Fica escrita UMA vez. */
export const CHAVE_DO_ATRASO = "atrasoDeResposta";

/** Responder já — o que o sistema sempre fez, e o que fica por omissão. */
export const SEM_ATRASO = 0;

/**
 * O tecto: dez minutos.
 *
 * Acima disto já não é «tempo de resposta», é deixar a pessoa pendurada — e
 * quem escreve a um número de empresa e não tem resposta em dez minutos vai
 * escrever a outro lado. O tecto existe para que um zero a mais no campo não
 * cale o assistente durante um dia inteiro.
 */
export const ATRASO_MAXIMO = 600;

/** Os degraus que o painel oferece. Escrever um número à mão também vale. */
export const ATRASOS_SUGERIDOS = [0, 5, 15, 30, 60, 120, 300] as const;

/**
 * O número que veio do painel, ou null se não serve.
 *
 * NULL E NÃO UM PALPITE: um campo mal preenchido não pode virar «dez minutos»
 * por arredondamento. Quem chama recusa e diz porquê.
 */
export function lerAtraso(valor: unknown): number | null {
  const n =
    typeof valor === "number"
      ? valor
      : typeof valor === "string" && valor.trim() !== ""
        ? Number(valor.trim())
        : NaN;
  if (!Number.isFinite(n)) return null;
  const inteiro = Math.round(n);
  if (inteiro < 0 || inteiro > ATRASO_MAXIMO) return null;
  return inteiro;
}

/**
 * O que está guardado na base, já seguro.
 *
 * Aqui NÃO se devolve null: um valor estragado na tabela — escrito à mão, ou
 * de uma versão antiga — não pode impedir o assistente de responder. Cai no
 * zero, que é o comportamento de sempre.
 */
export function atrasoGuardado(valor: unknown): number {
  return lerAtraso(valor) ?? SEM_ATRASO;
}

/** «imediata», «15 segundos», «2 minutos» — para o painel e para os avisos. */
export function atrasoPorExtenso(segundos: number): string {
  const s = atrasoGuardado(segundos);
  if (s === 0) return "imediata";
  if (s < 60) return `${s} segundo${s === 1 ? "" : "s"}`;
  const minutos = s / 60;
  if (Number.isInteger(minutos)) return `${minutos} minuto${minutos === 1 ? "" : "s"}`;
  const m = Math.floor(minutos);
  const resto = s - m * 60;
  return `${m} min ${resto} s`;
}

/**
 * O instante a partir do qual esta resposta pode sair.
 *
 * Função, e não uma conta escrita no SQL, porque é ela que os testes
 * interrogam — e porque o dia em que o atraso deixar de ser um número fixo
 * (variar com a hora, com a fila, com o cliente) muda-se aqui e mais nada.
 */
export function podeSairA(agora: Date, segundos: number): Date {
  return new Date(agora.getTime() + atrasoGuardado(segundos) * 1000);
}

/**
 * O canal em uso respeita o atraso?
 *
 * A ponte e o envio à mão passam pela FILA, e a fila é onde o atraso vive. A
 * API da Meta envia na hora, direto — ali o atraso não se aplica, e é melhor
 * o painel dizê-lo do que ficar um campo a prometer o que não acontece.
 */
export function canalRespeitaOAtraso(canal: string): boolean {
  return canal === "ponte" || canal === "manual";
}
