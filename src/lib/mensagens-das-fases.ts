import { primeiroNome } from "./mensagem-whatsapp";

/**
 * AS MENSAGENS QUE FALTAVAM, UMA POR FASE — d55 (CEO e dono, 17-11-2026).
 *
 * Na Mesa e no cartão do Trabalho CLYON, cada fase tem os seus botões; os que
 * falam com o cliente só ABREM o WhatsApp de quem está ao backoffice com a
 * mensagem escrita (`abrirWhatsAppNaLingua`) — nada sai sozinho. Estas são as
 * que ainda não existiam:
 *
 *   · «Trabalho concluído» — nos Feitos, à espera de confirmação: o parceiro
 *     deu o trabalho por feito, e pergunta-se ao cliente se correu bem.
 *   · O agradecimento, com o pedido de avaliação — nos Concluídos. A nota
 *     responde-se na conversa, e a equipa regista-a («Avaliar pela CLYON», com
 *     o «como o cliente o disse»).
 *   · O cancelamento — nos Cancelados. O texto é o do dono, palavra por palavra.
 *
 * Em voz de plataforma: quem faz o trabalho é o parceiro, nunca a CLYON; sem
 * promessas de prazos que a CLYON não controla.
 */

export type DadosDaFase = {
  pedidoId: number;
  cliente: string | null | undefined;
  /** A empresa que fez o trabalho, quando a há. */
  parceiro?: string | null;
};

const ola = (cliente: string | null | undefined) => {
  const p = primeiroNome(cliente);
  return p ? `Olá, ${p}!` : "Olá!";
};

/** Nos Feitos: o parceiro deu o trabalho por feito — correu bem? */
export function mensagemDeTrabalhoConcluido(d: DadosDaFase): string {
  const quem = d.parceiro?.trim() ? `O parceiro ${d.parceiro.trim()}` : "O parceiro";
  return [
    `${ola(d.cliente)} ${quem} deu por concluído o trabalho do seu pedido n.º ${d.pedidoId}.`,
    "Correu tudo bem? Se faltar alguma coisa, diga-nos por aqui e falamos com o parceiro.",
    "Obrigado,\nEquipa CLYON",
  ].join("\n\n");
}

/** Nos Concluídos: obrigado, e a avaliação do parceiro (de 1 a 5, aqui na conversa). */
export function mensagemDeAgradecimento(d: DadosDaFase): string {
  const com = d.parceiro?.trim() ? ` com ${d.parceiro.trim()}` : "";
  return [
    `${ola(d.cliente)} Obrigado por ter escolhido a CLYON. O seu pedido n.º ${d.pedidoId} ficou concluído${com}.`,
    "A sua opinião ajuda outros clientes a escolher. De 1 a 5, que nota dá ao parceiro? Se quiser, junte uma palavra sobre como correu.",
    "Muito obrigado, e até à próxima!\nEquipa CLYON",
  ].join("\n\n");
}

/** Nos Cancelados — o texto aprovado pelo dono (d55, 17-11-2026), palavra por palavra. */
export const MENSAGEM_DE_CANCELAMENTO = [
  "Olá! Obrigado por nos ter dito. 🙏",
  "O seu pedido fica cancelado e não vai seguir para nenhum parceiro. Os dados que nos deu para este pedido serão apagados do nosso sistema, conforme a nossa Política de Privacidade.",
  "Se precisar de nós no futuro, basta fazer um pedido novo, pelo site clyon.pt ou por aqui, e a equipa analisa-o de raiz.",
  "Muito obrigado pela confiança, e até à próxima!",
  "Equipa CLYON",
].join("\n");

export function mensagemDeCancelamento(): string {
  return MENSAGEM_DE_CANCELAMENTO;
}
