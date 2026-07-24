import { describe, it, expect } from "vitest";
import {
  NEXT_PHASE,
  ANALYSIS_STATUS,
  ENTRY_STATUSES,
  nextPhase,
  isTerminalStatus,
  isValidTransition,
  validTargets,
} from "./order-status-flow";

describe("nextPhase — sequência principal", () => {
  it("percorre a sequência completa do pedido até concluído", () => {
    const path: string[] = [];
    let status = "in_review";
    while (nextPhase(status)) {
      const adv = nextPhase(status)!;
      path.push(adv.next);
      status = adv.next;
      if (path.length > 20) break; // guarda contra ciclo infinito
    }
    expect(path).toEqual([
      "awaiting_deposit",
      "assignment_pending",
      "partner_selected",
      "confirmed",
      "in_route",
      "arrived",
      "in_execution",
      "awaiting_confirmation",
      "completed",
    ]);
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
    expect(isValidTransition("in_review", "awaiting_deposit")).toBe(true);
    expect(isValidTransition("awaiting_deposit", "assignment_pending")).toBe(true);
    expect(isValidTransition("in_route", "arrived")).toBe(true);
    expect(isValidTransition("awaiting_confirmation", "completed")).toBe(true);
  });

  it("bloqueia saltos de fase", () => {
    expect(isValidTransition("in_review", "confirmed")).toBe(false);
    expect(isValidTransition("awaiting_deposit", "completed")).toBe(false);
    expect(isValidTransition("received", "in_execution")).toBe(false);
  });

  it("bloqueia retrocessos", () => {
    expect(isValidTransition("confirmed", "in_review")).toBe(false);
    expect(isValidTransition("completed", "in_execution")).toBe(false);
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
    expect(isValidTransition("received", "awaiting_deposit")).toBe(true);
    expect(isValidTransition("open", "awaiting_deposit")).toBe(true);
    expect(isValidTransition("open", "in_review")).toBe(true);
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
  it("in_review → avanço, cancelamento e rejeição", () => {
    const t = validTargets("in_review");
    expect(t).toContain("awaiting_deposit");
    expect(t).toContain("canceled");
    expect(t).toContain("rejected");
    expect(t).not.toContain("completed");
  });

  it("estados terminais só têm laterais definidas", () => {
    expect(validTargets("canceled")).toEqual([]);
    expect(validTargets("completed")).toEqual(["in_dispute"]);
    const disputa = validTargets("in_dispute");
    expect(disputa).toContain("completed");
    expect(disputa).toContain("canceled");
  });
});

describe("ENTRY_STATUSES", () => {
  it("cobre os estados de criação da app móvel e do painel", () => {
    expect(ENTRY_STATUSES).toContain("open");
    expect(ENTRY_STATUSES).toContain("received");
  });
});
