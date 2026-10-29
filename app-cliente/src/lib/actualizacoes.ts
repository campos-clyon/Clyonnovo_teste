/**
 * AS ACTUALIZAÇÕES SOZINHAS (dono, 29-10-2026) — como a Oscar: sem abrir e
 * fechar a app duas vezes.
 *
 * Ao abrir e sempre que a app volta ao primeiro plano, procura um EAS Update,
 * descarrega-o e aplica-o logo, com um aviso curto («A atualizar a app…»).
 *
 * NUNCA A MEIO DE UM PEDIDO: no simulador (Pedir), na entrada, no pedido pelo
 * link, no pedido de empresa e na junção, a actualização fica à espera e
 * aplica-se quando o cliente sair desse ecrã (ou ao abrir a app outra vez). O
 * rascunho do simulador fica guardado a cada campo, mas uma fotografia a
 * meio do envio perdia-se — por isso espera-se.
 *
 * Puro de propósito: os testes do site importam-no.
 */

/** Os ecrãs onde o cliente pode estar a meio de escrever ou de enviar alguma coisa. */
export const ECRAS_QUE_ESPERAM = ["pedir", "entrar", "pedido-do-link", "empresa", "juntar", "pedido", "convidado"] as const;

/** Pode recarregar já? Só fora dos ecrãs onde o cliente pode estar a meio de alguma coisa. */
export function podeRecarregarAgora(segmentos: readonly string[] | null | undefined): boolean {
  const nomes = (segmentos ?? []).filter((s) => typeof s === "string");
  return !nomes.some((s) => (ECRAS_QUE_ESPERAM as readonly string[]).includes(s));
}

/** O aviso curto antes de recarregar, e quanto tempo fica à vista. */
export const AVISO_DA_ACTUALIZACAO = "A atualizar a app…";
export const ESPERA_ANTES_DE_RECARREGAR_MS = 1200;
/** Não procurar mais do que uma vez por minuto (voltar à app várias vezes seguidas). */
export const INTERVALO_MINIMO_MS = 60_000;

export function deveProcurar(ultimaVez: number | null, agora: number): boolean {
  return ultimaVez === null || agora - ultimaVez >= INTERVALO_MINIMO_MS;
}
