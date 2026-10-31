/*
 * O «OUTRO SERVIÇO» — 31-10-2026 (decisão d6 de 30-10, aprovada pelo dono e
 * pelo CEO).
 *
 * Desde 29-10-2026 o envio decide pelo GRUPO do serviço (service-categories.ts)
 * e o «Outro serviço» não tem grupo: só chegava a quem o tinha gravado tal e
 * qual. A inscrição, a candidatura, o painel e a app Pro só mostram os quatro
 * grupos — nenhum profissional novo o pode marcar —, e a lista de quem o
 * recebia só podia encolher, até um pedido destes não chegar a ninguém sem
 * ninguém dar por isso.
 *
 * Duas regras, as duas aqui:
 *
 *   1. Um pedido «outro» chega também a quem tem o grupo «Manutenção da casa»
 *      (`profissional-elegivel.ts`), com as regras de sempre — aprovado,
 *      activo, dentro do raio. Quem já tinha «outro» gravado continua a
 *      recebê-lo.
 *   2. Se foi aos profissionais e passou um dia sem nenhuma proposta, volta à
 *      Mesa, ao «Por decidir» (`outroSemPropostas`): a equipa redistribui,
 *      escolhe à mão ou passa-o a valor fixo.
 *
 * O grupo NÃO muda em `grupoDoServico`: isso converteria o «outro» gravado de
 * quem o tem em «Manutenção da casa» (`normalizarCategorias`) e punha as
 * páginas públicas a dizer que esse profissional faz reparações.
 */

/** O serviço «Outro serviço» do simulador e do WhatsApp. */
export const OUTRO_SERVICO = "outro";

/** O grupo que também recebe o «Outro serviço». */
export const GRUPO_QUE_RECEBE_O_OUTRO = "manutencao_da_casa";

/** Quanto tempo um «outro» espera por uma proposta antes de voltar ao «Por decidir». */
export const HORAS_ATE_VOLTAR_AO_POR_DECIDIR = 24;

/** O que a regra precisa de cada negociação — o molde da Mesa serve. */
export type NegociacaoParaContar = {
  estado: string;
  propostasJson: string | null;
  /** Quando o pedido chegou a este profissional. */
  criadaEm: string | Date | null;
};

function propostaDoProfissional(json: string | null): boolean {
  if (!json) return false;
  try {
    const l = JSON.parse(json);
    return Array.isArray(l) && l.some((p) => p && typeof p === "object" && (p as { por?: unknown }).por === "profissional");
  } catch {
    return false;
  }
}

function instante(v: string | Date | null): number | null {
  if (v == null) return null;
  const t = (v instanceof Date ? v : new Date(v)).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Um pedido «Outro serviço» que foi aos profissionais e está há
 * `HORAS_ATE_VOLTAR_AO_POR_DECIDIR` horas sem nenhuma proposta.
 *
 * Conta-se a partir da ÚLTIMA vez que chegou a alguém: redistribuir a quem
 * entrou depois dá-lhe outro dia, e só volta se esse também passar em vão.
 * Uma negociação desistida conta como enviada e sem proposta (ele disse que
 * não); as mortas (o pedido mudou de tipo, ou fechou com outro) não contam.
 * Basta uma proposta de um profissional numa negociação aberta, ou um aceite,
 * para não ser «sem propostas».
 */
export function outroSemPropostas(
  pedido: { serviceType: string | null; negociacoes: readonly NegociacaoParaContar[] },
  agora: Date,
): boolean {
  if (pedido.serviceType !== OUTRO_SERVICO) return false;
  const vivas = pedido.negociacoes.filter((n) => n.estado !== "morta");
  if (vivas.length === 0) return false;
  if (vivas.some((n) => n.estado === "acordada" || n.estado === "aguarda_contratacao")) return false;
  if (vivas.some((n) => n.estado === "aberta" && propostaDoProfissional(n.propostasJson))) return false;
  const chegadas = vivas.map((n) => instante(n.criadaEm)).filter((t): t is number => t != null);
  if (chegadas.length === 0) return false;
  const ultima = Math.max(...chegadas);
  return agora.getTime() - ultima >= HORAS_ATE_VOLTAR_AO_POR_DECIDIR * 60 * 60 * 1000;
}
