/**
 * Máquina de estados dos pedidos App CLYON (Supabase service_requests).
 *
 * ⚠️ GERADO A PARTIR DE CONTRATO.md (§2 — Máquina de estados) + plano de
 * negociação de preço de 24-07-2026 (§4). Não alterar a sequência aqui sem
 * actualizar primeiro o contrato no projecto CLYON Bridge — o Bridge é o dono
 * do contrato, das migrações e das RPCs.
 *
 * Fluxo com negociação de preço:
 *   in_review → awaiting_customer_approval → awaiting_deposit → confirmed
 *             → assignment_pending → partner_selected → in_route → arrived
 *             → in_execution → awaiting_confirmation → completed
 *
 * O cliente decide antes de publicar: só depois de aceitar a proposta E pagar
 * a reserva é que o pedido chega a `confirmed` e o trigger publica aos
 * profissionais. `confirmed` tem uma única porta de entrada legítima:
 * customer_mark_deposit_paid.
 *
 * Contrapropostas do cliente devolvem o pedido a `in_review` (máx. 2 rondas,
 * contadas na tabela price_proposals do Bridge — nunca no painel).
 */

/** Estados que representam um pedido acabado de submeter pelo cliente. */
export const ENTRY_STATUSES = ["open", "received"] as const;

/** Estado em que todo o pedido novo deve entrar: em análise. */
export const ANALYSIS_STATUS = "in_review" as const;

/**
 * Estado onde o pedido espera pela decisão do cliente sobre a proposta de
 * preço. Nenhum profissional o vê. Criado pelo Bridge (fase 1 do plano).
 */
export const CUSTOMER_APPROVAL_STATUS = "awaiting_customer_approval" as const;

/**
 * Estado canónico de publicação. Só alcançável por customer_mark_deposit_paid
 * (plano §4). O painel não deve escrevê-lo directamente.
 */
export const APPROVAL_TARGET_STATUS = "confirmed" as const;

export interface PhaseAdvance {
  /** Estado seguinte na sequência */
  next: string;
  /** Rótulo da ACÇÃO que o admin executa para avançar (evento da fase) */
  actionLabel: string;
}

/**
 * Fase seguinte por estado actual, na perspectiva do ADMIN.
 * `null` = o admin não tem acção de avanço aqui (estado terminal, ou a bola
 * está do lado do cliente).
 */
export const NEXT_PHASE: Record<string, PhaseAdvance | null> = {
  draft:                  { next: "in_review",                actionLabel: "Iniciar análise" },
  open:                   { next: "in_review",                actionLabel: "Iniciar análise" },
  received:               { next: "in_review",                actionLabel: "Iniciar análise" },
  in_review:              { next: CUSTOMER_APPROVAL_STATUS,   actionLabel: "Enviar proposta ao cliente" },
  // Bola do lado do cliente — aceitar, contrapor ou cancelar são acções dele
  awaiting_customer_approval: null,
  awaiting_deposit:       { next: "confirmed",                actionLabel: "Depósito recebido" },
  // Normalmente automático (trigger auto_match) — mantido como fallback manual
  confirmed:              { next: "assignment_pending",       actionLabel: "Publicar aos parceiros" },
  assignment_pending:     { next: "partner_selected",         actionLabel: "Parceiro atribuído" },
  partner_selected:       { next: "in_route",                 actionLabel: "Equipa a caminho" },
  in_route:               { next: "arrived",                  actionLabel: "Chegou ao local" },
  arrived:                { next: "in_execution",             actionLabel: "Iniciar execução" },
  in_execution:           { next: "awaiting_confirmation",    actionLabel: "Trabalho terminado" },
  extra_review_requested: { next: "in_execution",             actionLabel: "Retomar execução" },
  awaiting_confirmation:  { next: "completed",                actionLabel: "Concluir pedido" },
  completed:              null,
  in_dispute:             null,
  canceled:               null,
  rejected:               null,
};

/**
 * Estados verdadeiramente terminais — o pedido acabou. Distinto de "sem acção
 * de avanço do admin": em awaiting_customer_approval o pedido está vivo e pode
 * ser cancelado, apenas espera pelo cliente.
 */
const TERMINAL_STATUSES = new Set(["completed", "in_dispute", "canceled", "rejected"]);

/**
 * Estados em que a decisão pertence ao cliente — o painel mostra "à espera
 * do cliente" em vez de um botão de avanço.
 */
const WAITING_ON_CUSTOMER = new Set<string>([CUSTOMER_APPROVAL_STATUS]);

/**
 * Transições laterais fora da sequência principal (CONTRATO.md §2 — ramos;
 * plano de negociação §4), sempre permitidas a partir do estado indicado.
 * Cancelar/rejeitar são permitidos de qualquer estado não-terminal.
 */
const LATERAL_TRANSITIONS: Record<string, string[]> = {
  // admin_accept_counter_proposal: aceita o valor do cliente e salta a proposta
  in_review:                  ["awaiting_deposit"],
  // customer_accept_proposal → awaiting_deposit; customer_counter_proposal → in_review
  awaiting_customer_approval: ["awaiting_deposit", "in_review"],
  in_execution:               ["extra_review_requested"],
  awaiting_confirmation:      ["in_dispute"],
  completed:                  ["in_dispute"],
  in_dispute:                 ["completed", "canceled"],
};

/** Estados terminais — o pedido acabou (não confundir com "à espera do cliente"). */
export function isTerminalStatus(status: string | null | undefined): boolean {
  return TERMINAL_STATUSES.has(status ?? "");
}

/** true quando a decisão pertence ao cliente e o admin só pode esperar. */
export function isWaitingOnCustomer(status: string | null | undefined): boolean {
  return WAITING_ON_CUSTOMER.has(status ?? "");
}

/**
 * Estados que só existem DEPOIS do orçamento ter sido acordado com o cliente.
 * Usado para mostrar o selo "Aprovado" no painel. `awaiting_customer_approval`
 * NÃO conta — há proposta enviada, mas ainda não há acordo.
 */
const POST_APPROVAL_STATUSES = new Set([
  "awaiting_deposit", "confirmed", "assignment_pending", "partner_selected",
  "in_route", "arrived", "in_execution",
  "extra_review_requested", "awaiting_confirmation", "completed",
]);

/** true quando o estado implica que o orçamento já foi aceite pelo cliente. */
export function isApprovedStatus(status: string | null | undefined): boolean {
  return POST_APPROVAL_STATUSES.has(status ?? "");
}

/** Fase seguinte para o estado actual, ou null se terminal/à espera do cliente. */
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
