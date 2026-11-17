import type { FaseDaOferta } from "./oferta-clyon";

/**
 * CADA FASE SÓ COM OS SEUS BOTÕES — d55 (CEO e dono, 17-11-2026).
 *
 * Na Mesa e no cartão do Trabalho CLYON apareciam botões de outras fases: o
 * «Enviar proposta ao cliente» num trabalho já feito (o #623, em «Feito —
 * confirmar»), e o «Enviar adjudicação» sumia depois de o parceiro dar o
 * trabalho por feito, quando ainda faltava mandar ao cliente os dados para
 * pagar. A regra vive aqui, uma vez, e os dois ecrãs perguntam-na:
 *
 *   · À espera / escolher / ninguém aceitou: a proposta ao cliente.
 *   · Contratados (atribuída): a adjudicação — o parceiro, o dia e como pagar.
 *   · Feitos, à espera de confirmação: confirmar; «trabalho concluído»; e os
 *     dados para pagamento (no modelo antigo, os «valores para pagamento» à
 *     CLYON; no de 15-11, a adjudicação com o pagamento ao parceiro).
 *   · Concluídos: o agradecimento com o pedido de avaliação (e as faturas).
 *   · Cancelados: a mensagem de cancelamento (e «Reabrir»/«Restaurar»).
 *
 * Os botões só ABREM a mensagem no WhatsApp de quem está ao backoffice:
 * nada sai sozinho para o cliente.
 */
export type BotoesDaFase = {
  proposta: boolean;
  adjudicacao: boolean;
  /** A adjudicação faz de «Enviar dados para pagamento» (nos Feitos). */
  dadosParaPagamento: boolean;
  valoresParaPagamento: boolean;
  trabalhoConcluido: boolean;
  agradecimento: boolean;
  cancelamento: boolean;
};

const NADA: BotoesDaFase = {
  proposta: false,
  adjudicacao: false,
  dadosParaPagamento: false,
  valoresParaPagamento: false,
  trabalhoConcluido: false,
  agradecimento: false,
  cancelamento: false,
};

/** O cartão do Trabalho CLYON, pela fase da oferta. */
export function botoesDaFaseDoTrabalhoClyon(fase: FaseDaOferta, novoModelo: boolean): BotoesDaFase {
  switch (fase) {
    case "a_espera":
    case "escolher":
    case "sem_ninguem":
      return { ...NADA, proposta: true };
    case "atribuida":
      return { ...NADA, adjudicacao: true };
    case "por_confirmar":
      return novoModelo
        ? { ...NADA, adjudicacao: true, dadosParaPagamento: true, trabalhoConcluido: true }
        : { ...NADA, valoresParaPagamento: true, trabalhoConcluido: true };
    case "confirmada":
    case "paga":
      // No antigo, o cliente de um Trabalho CLYON paga depois de feito: enquanto não pagou, os valores continuam.
      return { ...NADA, agradecimento: true, valoresParaPagamento: !novoModelo };
    case "cancelada":
      return { ...NADA, cancelamento: true };
    default:
      return NADA;
  }
}

/** O cartão da Mesa (negociações), pelo estado do pedido e da contratada. */
export function botoesDaFaseDaMesa(p: {
  cancelado: boolean;
  concluido: boolean;
  acordada: { execucaoEnviadaEm?: string | null; confirmadoEm?: string | null } | null;
}): BotoesDaFase {
  if (p.cancelado) return { ...NADA, cancelamento: true };
  // Dado por feito e ainda por confirmar vem antes do «concluído»: o estado do pedido pode já dizer concluído.
  if (p.acordada?.execucaoEnviadaEm && !p.acordada.confirmadoEm) {
    return { ...NADA, adjudicacao: true, dadosParaPagamento: true, trabalhoConcluido: true };
  }
  if (p.concluido || p.acordada?.confirmadoEm) return { ...NADA, agradecimento: true };
  if (p.acordada) return { ...NADA, adjudicacao: true };
  return { ...NADA, proposta: true };
}
