import { DIAS_ATE_LIBERTAR_SOZINHO } from "./trabalho";

/**
 * AS FRASES DO PEDIDO QUE O SITE E A APP DE CLIENTE DIZEM IGUAIS — 31-10-2026
 * (decisão d8, a orquestra de sábado).
 *
 * A mesma fase do pedido dizia coisas diferentes no /pedido/[token] e na app:
 * «Às sábado, 31 de outubro, às 13:20.» (a data de `quandoEmLisboa` começa
 * pelo dia da semana e ficava partida a meio da frase), «Pedido #12: há um
 * problema.» num lado e «…com o trabalho.» no outro, e o «7 dias» escrito à
 * mão. Vivem aqui, sem dependências de servidor, porque a app importa este
 * ficheiro directamente (a cadeia fica em src/lib — ver app-pro.test.ts).
 */

/**
 * A data a meio da frase, numa forma única: «no sábado, 31 de outubro, às
 * 13:20», «na sexta-feira, 30 de outubro». Recebe o texto de `quandoEmLisboa`
 * (que começa pelo dia da semana); outra forma («30/10/2026») leva «a».
 */
export function naData(quando: string): string {
  const t = quando.trim();
  const primeira = t.split(/[,\s]/)[0].toLowerCase();
  if (primeira === "sábado" || primeira === "domingo") return `no ${t}`;
  if (/-feira$/.test(primeira)) return `na ${t}`;
  return `a ${t}`;
}

/** «Chegou no sábado, 31 de outubro, às 13:20.» — o «Cheguei» do parceiro. */
export const chegouNaData = (quando: string) => `Chegou ${naData(quando)}.`;

/** «Aceitou este preço no sábado, …» — num Trabalho CLYON; «agora» (acabou de aceitar) fica sem data. */
export const aceitouOPrecoNaData = (quando: string | null | undefined) =>
  quando && quando !== "agora" ? `Aceitou este preço ${naData(quando)}.` : "Aceitou este preço.";

/** «Pago no sábado, …» */
export const pagoNaData = (quando: string | null | undefined) => (quando ? `Pago ${naData(quando)}.` : "Pago.");

/** «Marcado como feito no sábado, …» */
export const marcadoComoFeitoNaData = (quando: string) => `Marcado como feito ${naData(quando)}.`;

/** Depois do «Está feito»: o prazo de `DIAS_ATE_LIBERTAR_SOZINHO`, nunca escrito à mão. */
export const SE_NAO_DISSER_NADA = `Se não disser nada, fica confirmado ${DIAS_ATE_LIBERTAR_SOZINHO} dias depois.`;

/** «Há um problema» — o texto que vai já escrito no WhatsApp da CLYON, no site e na app. */
export const mensagemDoProblema = (pedidoId: number) => `Pedido #${pedidoId}: há um problema.`;

/** «Pedir troca de parceiro» — o texto que vai já escrito no WhatsApp da CLYON, no site e na app. */
export const mensagemDaTrocaDeParceiro = (pedidoId: number) => `Pedido #${pedidoId}: queria pedir a troca de parceiro.`;

export const HA_UM_PROBLEMA = "Há um problema";
export const PEDIR_TROCA_DE_PARCEIRO = "Pedir troca de parceiro";
