import type { AvisoAntesDeCotar } from "./profissional-elegivel";

/**
 * O QUE SE DIZ AO PROFISSIONAL ANTES DE ELE MANDAR O NÚMERO.
 *
 * "Caso ele não emita fatura e o pedido tenha essa opção, antes de ele enviar
 * aparece a mensagem em amarelo: «atenção, esse cliente deseja fatura e você
 * não marcou que emite, deseja continuar mesmo assim?». Pode melhorar a frase
 * para ser mais completa e informativa." — 14-09-2026.
 *
 * Melhorar aqui não é escrever mais bonito: é responder às perguntas que a
 * frase original deixa em aberto, e que ele vai ter de responder por telefone
 * se a frase não as responder.
 *
 *   1. O QUE É QUE O CLIENTE PEDIU, exactamente?
 *   2. O QUE ACONTECE SE EU CONTINUAR? — o trabalho fica meu na mesma? o
 *      cliente é avisado? posso perdê-lo depois?
 *   3. E SE ISTO ESTIVER ERRADO? — a maioria emite fatura e nunca marcou a
 *      caixa. A frase tem de dizer onde se corrige, senão ele carrega em
 *      «continuar» todas as vezes e o campo fica errado para sempre.
 *
 * AS DUAS NÃO PESAM O MESMO, e o texto não finge que sim. A fatura é uma
 * preferência do cliente: continuar é assumir um compromisso comercial. A
 * guia de transporte de resíduos é uma exigência legal de quem transporta —
 * continuar sem ela não é um risco de negócio, é um risco de coima, e para o
 * cliente também.
 */

export type FichaDoAviso = {
  /** Uma linha, para caber num cartão ao lado do valor. */
  curto: string;
  /** O título da caixa amarela. */
  titulo: string;
  /** O que o cliente pediu, e o que acontece se continuar. */
  corpo: string;
  /** Onde se corrige, quando o aviso é só uma caixa por marcar. */
  ondeSeCorrige: string;
  /** O botão que segue em frente. Diz o que faz, não diz «OK». */
  botao: string;
  /** A guia é lei; a fatura é combinação. O ecrã pinta-as de forma diferente. */
  gravidade: "aviso" | "serio";
};

export const FICHA_DO_AVISO: Record<AvisoAntesDeCotar, FichaDoAviso> = {
  cliente_quer_fatura: {
    curto: "O cliente pediu fatura",
    titulo: "Este cliente pediu fatura — e no seu perfil diz que não emite",
    corpo:
      "Ao registar o pedido, o cliente marcou que precisa de fatura com NIF. " +
      "No seu perfil, a emissão de fatura está por marcar. " +
      "Pode avançar com a proposta na mesma, mas fica o compromisso: se fechar " +
      "o trabalho, o cliente vai esperar fatura no fim. Não conseguir emiti-la " +
      "nessa altura costuma acabar em trabalho feito e por pagar.",
    ondeSeCorrige:
      "Se emite fatura e só não marcou a caixa, corrija em Perfil › Faturação e IVA — " +
      "leva menos de um minuto e este aviso deixa de aparecer.",
    botao: "Emito fatura — continuar",
    gravidade: "aviso",
  },
  trabalho_exige_guia: {
    curto: "Exige guia de transporte",
    titulo: "Este trabalho exige guia de transporte de resíduos",
    corpo:
      "Transportar resíduos exige estar registado como transportador e emitir a " +
      "guia de acompanhamento. No seu perfil isso não está declarado, ou ainda " +
      "não foi verificado pela CLYON. " +
      "Pode avançar com a proposta, mas a responsabilidade do transporte é de " +
      "quem o faz: sem registo válido, a coima é sua e o cliente fica igualmente " +
      "exposto. Se continuar, fica registado no pedido que foi avisado.",
    ondeSeCorrige:
      "Se é transportador registado, ponha o número em Perfil › Guia de transporte. " +
      "A CLYON verifica-o e o aviso desaparece.",
    botao: "Sou transportador registado — continuar",
    gravidade: "serio",
  },
};

/** Os avisos pela ordem em que se mostram: o mais sério em cima. */
export function porGravidade(avisos: AvisoAntesDeCotar[]): AvisoAntesDeCotar[] {
  const peso = (a: AvisoAntesDeCotar) => (FICHA_DO_AVISO[a].gravidade === "serio" ? 0 : 1);
  return [...avisos].sort((a, b) => peso(a) - peso(b));
}

/**
 * A linha que fica no histórico do pedido quando alguém avança mesmo assim.
 *
 * É a razão de o aviso da guia dizer «fica registado no pedido»: sem rasto, a
 * frase é só uma frase. Com rasto, no dia em que houver um problema sabe-se
 * quem foi avisado, de quê, e quando.
 */
export function comoFicaRegistado(avisos: AvisoAntesDeCotar[], nome: string): string {
  const lista = porGravidade(avisos)
    .map((a) => FICHA_DO_AVISO[a].curto.toLowerCase())
    .join(" e ");
  return `${nome} foi avisado (${lista}) e avançou com a proposta.`;
}

/** Há algum aviso que justifique parar para confirmar? */
export function precisaDeConfirmacao(avisos: AvisoAntesDeCotar[] | null | undefined): boolean {
  return Array.isArray(avisos) && avisos.length > 0;
}
