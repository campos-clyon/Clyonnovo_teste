import { describe, it, expect } from "vitest";
import {
  NEXT_PHASE,
  ANALYSIS_STATUS,
  ENTRY_STATUSES,
  nextPhase,
  isTerminalStatus,
  isApprovedStatus,
  isWaitingOnCustomer,
  isPublishableStatus,
  isValidTransition,
  validTargets,
} from "./order-status-flow";

describe("nextPhase — sequência principal", () => {
  it("o admin avança até à proposta e pára — a decisão é do cliente", () => {
    const path: string[] = [];
    let status = "in_review";
    while (nextPhase(status)) {
      const adv = nextPhase(status)!;
      path.push(adv.next);
      status = adv.next;
      if (path.length > 20) break; // guarda contra ciclo infinito
    }
    // O admin envia a proposta e a sequência pára: aceitar/contrapor/cancelar
    // são acções do cliente (plano de negociação §4)
    expect(path).toEqual(["awaiting_customer_approval"]);
    expect(nextPhase("awaiting_customer_approval")).toBeNull();
  });

  it("depois do depósito pago, o admin volta a conduzir até concluído", () => {
    const path: string[] = [];
    let status = "awaiting_deposit";
    while (nextPhase(status)) {
      const adv = nextPhase(status)!;
      path.push(adv.next);
      status = adv.next;
      if (path.length > 20) break;
    }
    expect(path).toEqual([
      "confirmed",
      "assignment_pending",
      "partner_selected",
      "in_route",
      "arrived",
      "in_execution",
      "awaiting_confirmation",
      "completed",
    ]);
  });

  it("a proposta é a fase seguinte de in_review, não a confirmação", () => {
    expect(nextPhase("in_review")?.next).toBe("awaiting_customer_approval");
    expect(nextPhase("in_review")?.actionLabel).toMatch(/proposta/i);
  });

  it("awaiting_deposit avança para confirmed (depósito recebido)", () => {
    expect(nextPhase("awaiting_deposit")?.next).toBe("confirmed");
  });

  it("estados de entrada (open/received/draft) avançam para análise", () => {
    expect(nextPhase("open")?.next).toBe(ANALYSIS_STATUS);
    expect(nextPhase("received")?.next).toBe(ANALYSIS_STATUS);
    expect(nextPhase("draft")?.next).toBe(ANALYSIS_STATUS);
  });

  it("estados terminais não avançam", () => {
    expect(nextPhase("completed")).toBeNull();
    expect(nextPhase("canceled")).toBeNull();
    expect(nextPhase("rejected")).toBeNull();
    expect(nextPhase("in_dispute")).toBeNull();
  });

  it("revisão extra retoma a execução", () => {
    expect(nextPhase("extra_review_requested")?.next).toBe("in_execution");
  });

  it("cada avanço tem um rótulo de acção legível", () => {
    for (const [status, adv] of Object.entries(NEXT_PHASE)) {
      if (adv) {
        expect(adv.actionLabel.length, `actionLabel de ${status}`).toBeGreaterThan(3);
      }
    }
  });
});

describe("isTerminalStatus", () => {
  it("identifica terminais", () => {
    for (const s of ["completed", "in_dispute", "canceled", "rejected"]) {
      expect(isTerminalStatus(s), s).toBe(true);
    }
  });
  it("identifica activos", () => {
    for (const s of ["in_review", "awaiting_deposit", "confirmed", "in_execution"]) {
      expect(isTerminalStatus(s), s).toBe(false);
    }
  });
});

describe("isValidTransition", () => {
  it("permite avanços sequenciais", () => {
    expect(isValidTransition("in_review", "awaiting_customer_approval")).toBe(true);
    expect(isValidTransition("awaiting_deposit", "confirmed")).toBe(true);
    expect(isValidTransition("confirmed", "assignment_pending")).toBe(true);
    expect(isValidTransition("assignment_pending", "partner_selected")).toBe(true);
    expect(isValidTransition("partner_selected", "in_route")).toBe(true);
    expect(isValidTransition("in_route", "arrived")).toBe(true);
    expect(isValidTransition("awaiting_confirmation", "completed")).toBe(true);
  });

  it("negociação: cliente aceita, contrapõe, ou o admin aceita a contraproposta", () => {
    // customer_accept_proposal
    expect(isValidTransition("awaiting_customer_approval", "awaiting_deposit")).toBe(true);
    // customer_counter_proposal — devolve o pedido ao admin
    expect(isValidTransition("awaiting_customer_approval", "in_review")).toBe(true);
    // admin_accept_counter_proposal — salta a proposta
    expect(isValidTransition("in_review", "awaiting_deposit")).toBe(true);
    // customer_reject_and_cancel / expiração
    expect(isValidTransition("awaiting_customer_approval", "canceled")).toBe(true);
  });

  it("o cliente tem de decidir antes de publicar — sem atalho para confirmed", () => {
    // A única porta de entrada de confirmed é awaiting_deposit (depósito pago)
    expect(isValidTransition("in_review", "confirmed")).toBe(false);
    expect(isValidTransition("awaiting_customer_approval", "confirmed")).toBe(false);
    expect(isValidTransition("received", "confirmed")).toBe(false);
  });

  it("bloqueia saltos de fase", () => {
    expect(isValidTransition("in_review", "assignment_pending")).toBe(false);
    expect(isValidTransition("awaiting_deposit", "completed")).toBe(false);
    expect(isValidTransition("received", "in_execution")).toBe(false);
    expect(isValidTransition("awaiting_customer_approval", "assignment_pending")).toBe(false);
  });

  it("bloqueia retrocessos e a sequência antiga (partner_selected → confirmed)", () => {
    expect(isValidTransition("confirmed", "in_review")).toBe(false);
    expect(isValidTransition("completed", "in_execution")).toBe(false);
    expect(isValidTransition("partner_selected", "confirmed")).toBe(false);
  });

  it("permite cancelar/rejeitar de qualquer estado activo", () => {
    for (const s of ["in_review", "awaiting_deposit", "confirmed", "in_execution"]) {
      expect(isValidTransition(s, "canceled"), `${s} → canceled`).toBe(true);
      expect(isValidTransition(s, "rejected"), `${s} → rejected`).toBe(true);
    }
  });

  it("bloqueia cancelar um pedido já terminado", () => {
    expect(isValidTransition("completed", "canceled")).toBe(false);
    expect(isValidTransition("canceled", "rejected")).toBe(false);
  });

  it("received/open contam como in_review (promoção automática pendente)", () => {
    expect(isValidTransition("received", "awaiting_customer_approval")).toBe(true);
    expect(isValidTransition("open", "awaiting_customer_approval")).toBe(true);
    expect(isValidTransition("open", "in_review")).toBe(true);
    expect(isValidTransition("received", "awaiting_deposit")).toBe(true);
  });

  it("laterais: disputa e revisão extra", () => {
    expect(isValidTransition("in_execution", "extra_review_requested")).toBe(true);
    expect(isValidTransition("extra_review_requested", "in_execution")).toBe(true);
    expect(isValidTransition("awaiting_confirmation", "in_dispute")).toBe(true);
    expect(isValidTransition("completed", "in_dispute")).toBe(true);
    expect(isValidTransition("in_dispute", "completed")).toBe(true);
    expect(isValidTransition("in_dispute", "canceled")).toBe(true);
  });

  it("mesmo estado é sempre válido (no-op)", () => {
    expect(isValidTransition("confirmed", "confirmed")).toBe(true);
    expect(isValidTransition("received", "in_review")).toBe(true); // normalizados iguais
  });
});

describe("validTargets", () => {
  it("in_review → proposta, aceitar contraproposta, cancelar e rejeitar", () => {
    const t = validTargets("in_review");
    expect(t).toContain("awaiting_customer_approval");
    expect(t).toContain("awaiting_deposit");
    expect(t).toContain("canceled");
    expect(t).toContain("rejected");
    expect(t).not.toContain("confirmed");
    expect(t).not.toContain("completed");
  });

  it("awaiting_customer_approval continua cancelável apesar de não avançar", () => {
    const t = validTargets("awaiting_customer_approval");
    expect(t).toContain("awaiting_deposit");
    expect(t).toContain("in_review");
    expect(t).toContain("canceled");
    expect(t).toContain("rejected");
  });

  it("estados terminais só têm laterais definidas", () => {
    expect(validTargets("canceled")).toEqual([]);
    expect(validTargets("completed")).toEqual(["in_dispute"]);
    const disputa = validTargets("in_dispute");
    expect(disputa).toContain("completed");
    expect(disputa).toContain("canceled");
  });
});

describe("isApprovedStatus", () => {
  it("estados pós-aprovação contam como aprovados", () => {
    for (const s of [
      "awaiting_deposit", "assignment_pending", "partner_selected",
      "confirmed", "in_route", "arrived", "in_execution",
      "extra_review_requested", "awaiting_confirmation", "completed",
    ]) {
      expect(isApprovedStatus(s), s).toBe(true);
    }
  });

  it("estados pré-aprovação e terminais negativos NÃO contam", () => {
    for (const s of ["draft", "open", "received", "in_review", "canceled", "rejected", "in_dispute"]) {
      expect(isApprovedStatus(s), s).toBe(false);
    }
  });

  it("proposta enviada ainda NÃO é acordo — o cliente não decidiu", () => {
    expect(isApprovedStatus("awaiting_customer_approval")).toBe(false);
  });
});

describe("isPublishableStatus", () => {
  // assignment_pending publica tanto como confirmed — foi assim que a
  // admin_approve_request escapou à análise: publicava sem escrever "confirmed"
  it("os dois estados que tornam o pedido visível aos profissionais", () => {
    expect(isPublishableStatus("confirmed")).toBe(true);
    expect(isPublishableStatus("assignment_pending")).toBe(true);
  });

  it("nenhum estado anterior à decisão do cliente publica", () => {
    for (const s of ["draft", "received", "in_review", "awaiting_customer_approval", "awaiting_deposit"]) {
      expect(isPublishableStatus(s), s).toBe(false);
    }
  });

  it("nenhuma transição da negociação salta directamente para publicação", () => {
    for (const from of ["in_review", "awaiting_customer_approval", "received", "draft"]) {
      for (const to of ["confirmed", "assignment_pending"]) {
        expect(isValidTransition(from, to), `${from} → ${to}`).toBe(false);
      }
    }
  });
});

describe("isWaitingOnCustomer", () => {
  it("só awaiting_customer_approval espera pelo cliente", () => {
    expect(isWaitingOnCustomer("awaiting_customer_approval")).toBe(true);
    for (const s of ["in_review", "awaiting_deposit", "confirmed", "completed"]) {
      expect(isWaitingOnCustomer(s), s).toBe(false);
    }
  });

  it("esperar pelo cliente não é estado terminal — dá para cancelar", () => {
    expect(isTerminalStatus("awaiting_customer_approval")).toBe(false);
    expect(isValidTransition("awaiting_customer_approval", "canceled")).toBe(true);
  });
});

describe("ENTRY_STATUSES", () => {
  it("cobre os estados de criação da app móvel e do painel", () => {
    expect(ENTRY_STATUSES).toContain("open");
    expect(ENTRY_STATUSES).toContain("received");
  });
});
