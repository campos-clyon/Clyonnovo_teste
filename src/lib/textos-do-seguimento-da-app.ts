/**
 * OS TEXTOS NOVOS DO CONVITE E DO LEMBRETE DA APP DE CLIENTE — 17-11-2026 (d59).
 *
 * ONDE ENTRAM OS TEXTOS DO MARKETING. Estão a ser escritos pelo Marketing e
 * só valem depois da aprovação do dono: até lá ficam a `null` e os dois
 * interruptores DESLIGADOS. Com um texto a `null` nada sai por esse caminho
 * — o código não inventa um texto de recurso.
 *
 * Para os ligar: colar o texto aprovado à letra na constante dele e, para o
 * lembrete, pôr o interruptor a `true`. Os textos de hoje (o convite em massa
 * de 01-11 e o do programa de 11-11) NÃO estão aqui e não mudam.
 *
 * Marcas que se podem usar dentro dos textos (trocadas no envio):
 *   {linkDeAdesao}    — o link de adesão da Play (Configs)
 *   {linkDaPlayStore} — a página da app na Play Store
 *   {linkDaConta}     — a área de conta no site, onde está o formulário do
 *                       programa (é lá que a pessoa escreve o Gmail do telemóvel)
 *
 * Num email, uma linha em branco separa parágrafos; um link sozinho numa
 * linha fica um link.
 */

export type TextoDeEmail = { assunto: string; texto: string };

/**
 * 1. O CONVITE A QUEM TEM CONTA COM UM EMAIL QUE NÃO É GMAIL. A Play só dá
 * acesso a uma conta Google: este email pede-lhe o Gmail do telemóvel, pelo
 * formulário do programa ({linkDaConta}). Enquanto for `null`, estas contas
 * ficam fora do «Enviar a todos» (marcadas «falta o Gmail do telemóvel»).
 */
export const TEXTO_DO_CONVITE_QUE_PEDE_O_GMAIL: TextoDeEmail | null = null;

/** 2. O LEMBRETE POR EMAIL, 3 dias depois do convite, a quem ainda não aderiu. */
export const TEXTO_DO_LEMBRETE_POR_EMAIL: TextoDeEmail | null = null;

/** 3. O LEMBRETE POR WHATSAPP, ao mesmo tempo, a quem tem telefone na conta. */
export const TEXTO_DO_LEMBRETE_POR_WHATSAPP: string | null = null;

/** O lembrete (email) — DESLIGADO até o dono aprovar o texto. */
export const LEMBRETE_DA_APP_LIGADO: boolean = false;

/** O lembrete também por WhatsApp — DESLIGADO até o dono aprovar o texto. */
export const LEMBRETE_DA_APP_POR_WHATSAPP_LIGADO: boolean = false;
