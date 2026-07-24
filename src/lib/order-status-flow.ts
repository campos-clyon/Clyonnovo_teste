/**
 * Máquina de estados dos pedidos App CLYON (Supabase service_requests).
 *
 * O estado avança automaticamente pela sequência conforme as fases do
 * pedido são cumpridas — o admin marca o EVENTO da fase (ex: "Depósito
 * recebido") e o estado seguinte é aplicado pelo servidor, em vez de
 * escolher manualmente entre 16 estados num dropdown.
 *
 * Sequência principal:
 *   in_review → awaiting_deposit → assignment_pending → partner_selected
 *   → confirmed → in_route → arrived → in_execution → awaiting_confirmation
 *   → completed
 *
 * Entradas legadas: pedidos criados como "open" (app móvel) ou "received"
 * são promovidos automaticamente a "in_review" quando entram no painel —
 * quando o cliente envia, o pedido fica logo em análise.
 */

/** Estados que representam um pedido acabado de submeter pelo cliente. */
export const ENTRY_STATUSES = ["open", "received"] as const;

/** Estado em que todo o pedido novo deve entrar: em análise. */
export const ANALYSIS_STATUS = "in_review" as const;

export interface PhaseAdvance {
  /** Estado seguinte na sequência */
  next: string;
  /** Rótulo da ACÇÃO que o admin executa para avançar (evento da fase) */
  actionLabel: string;
}

/**
 * Fase seguinte por estado actual. `null` = estado terminal (não avança).
 * Estados de entrada legados avançam directamente para análise.
 */
export const NEXT_PHASE: Record<string, PhaseAdvance | null> = {
  draft:                  { next: "in_review",             actionLabel: "Iniciar análise" },
  open:                   { next: "in_review",             actionLabel: "Iniciar análise" },
  received:               { next: "in_review",             actionLabel: "Iniciar análise" },
  in_review:              { next: "awaiting_deposit",      actionLabel: "Aprovar orçamento" },
  awaiting_deposit:       { next: "assignment_pending",    actionLabel: "Depósito recebido" },
  assignment_pending:     { next: "partner_selected",      actionLabel: "Parceiro atribuído" },
  partner_selected:       { next: "confirmed",             actionLabel: "Confirmar agendamento" },
  confirmed:              { next: "in_route",              actionLabel: "Equipa a caminho" },
  in_route:               { next: "arrived",               actionLabel: "Chegou ao local" },
  arrived:                { next: "in_execution",          actionLabel: "Iniciar execução" },
  in_execution:           { next: "awaiting_confirmation", actionLabel: "Trabalho terminado" },
  extra_review_requested: { next: "in_execution",          actionLabel: "Retomar execução" },
  awaiting_confirmation:  { next: "completed",             actionLabel: "Concluir pedido" },
  completed:              null,
  in_dispute:             null,
  canceled:               null,
  rejected:               null,
};

/**
 * Transições laterais fora da sequência principal, sempre permitidas
 * a partir do estado indicado (além de canceled/rejected, permitidos
 * de qualquer estado activo, com motivo).
 */
const LATERAL_TRANSITIONS: Record<string, string[]> = {
  in_execution:          ["extra_review_requested"],
  awaiting_confirmation: ["in_dispute"],
  completed:             ["in_dispute"],
  in_dispute:            ["completed", "canceled"],
};

/** Estados terminais — não têm fase seguinte na sequência. */
export function isTerminalStatus(status: string | null | undefined): boolean {
  return NEXT_PHASE[status ?? ""] === null;
}

/**
 * Estados que só existem DEPOIS do orçamento ter sido aprovado.
 * Usado para mostrar o selo "Aprovado" no painel — a partir de
 * awaiting_deposit, o pedido tem sempre um orçamento aprovado.
 */
const POST_APPROVAL_STATUSES = new Set([
  "awaiting_deposit", "assignment_pending", "partner_selected",
  "confirmed", "in_route", "arrived", "in_execution",
  "extra_review_requested", "awaiting_confirmation", "completed",
]);

/** true quando o estado implica que o orçamento já foi aprovado. */
export function isApprovedStatus(status: string | null | undefined): boolean {
  return POST_APPROVAL_STATUSES.has(status ?? "");
}

/** Fase seguinte para o estado actual, ou null se terminal/desconhecido. */
export function nextPhase(status: string | null | undefined): PhaseAdvance | null {
  return NEXT_PHASE[status ?? ""] ?? null;
}

/**
 * Normaliza estados de entrada legados: "open"/"received" contam como
 * "in_review" para efeitos de validação de transições (a promoção
 * automática pode ainda não ter corrido).
 */
function normalized(status: string): string {
  return (ENTRY_STATUSES as readonly string[]).includes(status) ? ANALYSIS_STATUS : status;
}

/**
 * Valida se a transição from → to respeita a sequência de fases.
 * Cancelamento/rejeição são sempre permitidos a partir de estados
 * não-terminais (o motivo é validado na rota).
 */
export function isValidTransition(from: string, to: string): boolean {
  if (from === to) return true;

  const f = normalized(from);
  const t = normalized(to);
  if (f === t) return true;

  // Cancelar/rejeitar: permitido de qualquer estado não-terminal
  if ((t === "canceled" || t === "rejected") && !isTerminalStatus(f)) return true;

  // Avanço sequencial
  if (NEXT_PHASE[f]?.next === t) return true;

  // Transições laterais específicas
  if (LATERAL_TRANSITIONS[f]?.includes(t)) return true;

  return false;
}

/**
 * Lista de estados de destino válidos a partir de um estado — usada
 * para mensagens de erro e para a UI mostrar apenas opções legais.
 */
export function validTargets(from: string): string[] {
  const f = normalized(from);
  const targets = new Set<string>();
  const seq = NEXT_PHASE[f];
  if (seq) targets.add(seq.next);
  for (const t of LATERAL_TRANSITIONS[f] ?? []) targets.add(t);
  if (!isTerminalStatus(f)) {
    targets.add("canceled");
    targets.add("rejected");
  }
  return [...targets];
}
