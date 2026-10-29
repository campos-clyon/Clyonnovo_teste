/**
 * A APP PRO ACTUALIZA-SE SOZINHA (dono, 29-10-2026) — como a app de cliente.
 *
 * Ao abrir e sempre que volta ao primeiro plano, procura um EAS Update,
 * descarrega-o e aplica-o logo, com um aviso curto («A atualizar a app…»).
 *
 * NUNCA A MEIO DE UMA PROPOSTA: no trabalho (propor, ajuste, marcar como
 * feito, avaliar), no link de um pedido, na carteira (levantamento), na conta
 * e nos ecrãs de entrada, a actualização espera que o profissional saia desse
 * ecrã — só se aplica na lista dos trabalhos e na agenda.
 *
 * Puro de propósito: os testes do site importam-no.
 */

/** Os ecrãs onde o profissional pode estar a meio de escrever ou de enviar alguma coisa. */
export const ECRAS_QUE_ESPERAM = ["trabalho", "abrir", "carteira", "conta", "entrar", "registo", "repor", "definir-senha"] as const;

export function podeRecarregarAgora(segmentos: readonly string[] | null | undefined): boolean {
  const nomes = (segmentos ?? []).filter((s) => typeof s === "string");
  return !nomes.some((s) => (ECRAS_QUE_ESPERAM as readonly string[]).includes(s));
}

export const AVISO_DA_ACTUALIZACAO = "A atualizar a app…";
export const ESPERA_ANTES_DE_RECARREGAR_MS = 1200;
/** Não procurar mais do que uma vez por minuto (voltar à app várias vezes seguidas). */
export const INTERVALO_MINIMO_MS = 60_000;

export function deveProcurar(ultimaVez: number | null, agora: number): boolean {
  return ultimaVez === null || agora - ultimaVez >= INTERVALO_MINIMO_MS;
}
