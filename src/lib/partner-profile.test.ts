import { describe, it, expect } from "vitest";
import {
  verificationState,
  publicDescriptionState,
  validateProfilePatch,
  statusSideEffects,
  PARTNER_STATUSES,
  BADGE_DOC_TYPES,
  REQUIRED_DOC_TYPES,
} from "./partner-profile";

describe("verificationState — condição EXACTA do selo no app", () => {
  const docsCompletos = [
    { doc_type: "id", status: "approved" },
    { doc_type: "nif", status: "approved" },
    { doc_type: "activity", status: "pending" },
  ];

  it("aprovado + id e nif aprovados = selo visível", () => {
    const v = verificationState("approved", docsCompletos);
    expect(v.verified).toBe(true);
    expect(v.missingDocs).toEqual([]);
    expect(v.reason).toBeNull();
  });

  it("aprovado mas sem os documentos do selo — explica porque não aparece", () => {
    const v = verificationState("approved", [{ doc_type: "id", status: "approved" }]);
    expect(v.verified).toBe(false);
    expect(v.missingDocs).toEqual(["nif"]);
    expect(v.reason).toMatch(/não aparece no app/i);
  });

  it("documentos em ordem mas ainda não aprovado", () => {
    const v = verificationState("in_review", docsCompletos);
    expect(v.verified).toBe(false);
    expect(v.missingDocs).toEqual([]);
    expect(v.reason).toMatch(/ainda não está aprovado/i);
  });

  it("documento rejeitado não conta como aprovado", () => {
    const v = verificationState("approved", [
      { doc_type: "id", status: "approved" },
      { doc_type: "nif", status: "rejected" },
    ]);
    expect(v.verified).toBe(false);
    expect(v.missingDocs).toContain("nif");
  });

  it("activity e iban não bloqueiam o selo (só id e nif)", () => {
    const v = verificationState("approved", [
      { doc_type: "id", status: "approved" },
      { doc_type: "nif", status: "approved" },
      { doc_type: "activity", status: "rejected" },
      { doc_type: "iban", status: "rejected" },
    ]);
    expect(v.verified).toBe(true);
  });

  it("sem documentos nenhuns não rebenta", () => {
    expect(verificationState("approved", []).verified).toBe(false);
    expect(verificationState("approved", null).missingDocs).toEqual(["id", "nif"]);
    expect(verificationState(null, undefined).verified).toBe(false);
  });

  it("o selo exige exactamente dois documentos, dos quatro pedidos", () => {
    expect(BADGE_DOC_TYPES).toEqual(["id", "nif"]);
    expect(REQUIRED_DOC_TYPES).toHaveLength(4);
  });
});

describe("publicDescriptionState — depois da correcção do Bridge (25-07)", () => {
  it("descrição preenchida não pede atenção", () => {
    const s = publicDescriptionState("Recolhas e mudanças na Grande Lisboa.", "qualquer coisa");
    expect(s.needsAttention).toBe(false);
    expect(s.canCopyFromBio).toBe(false);
  });

  // A app passou a ler bio como segunda opção: o cliente VÊ a apresentação,
  // por isso deixou de ser urgente — mas continua a valer a pena arrumar.
  it("só bio preenchida — arrumar sim, urgente não", () => {
    const s = publicDescriptionState(null, "15 anos a fazer mudanças em Setúbal.");
    expect(s.needsAttention).toBe(false);
    expect(s.canCopyFromBio).toBe(true);
    expect(s.message).toMatch(/bio/i);
  });

  it("ambas vazias — aí sim o cliente vê o texto genérico errado", () => {
    const s = publicDescriptionState("", "   ");
    expect(s.needsAttention).toBe(true);
    expect(s.canCopyFromBio).toBe(false);
    expect(s.message).toMatch(/genérico/i);
  });

  it("espaços em branco não contam como descrição", () => {
    expect(publicDescriptionState("   ", "bio real").canCopyFromBio).toBe(true);
  });
});

describe("validateProfilePatch — o painel não escreve o que não deve", () => {
  it("aceita campos administrativos", () => {
    const r = validateProfilePatch({ status: "approved", tier: "gold", earning_share: 0.7 });
    expect(r.ok).toBe(true);
    expect(r.allowed).toEqual({ status: "approved", tier: "gold", earning_share: 0.7 });
  });

  it("aceita campos públicos que o admin corrige em nome do profissional", () => {
    const r = validateProfilePatch({ description: "Recolhas na Margem Sul.", trade_name: "Silva & Filhos" });
    expect(r.ok).toBe(true);
  });

  it("recusa campos fora da lista — incluindo os de identidade", () => {
    expect(validateProfilePatch({ user_id: "outro" }).ok).toBe(false);
    expect(validateProfilePatch({ id: "outro" }).ok).toBe(false);
    expect(validateProfilePatch({ nif: "123" }).error).toMatch(/não editáveis/i);
    expect(validateProfilePatch({ iban: "PT50" }).ok).toBe(false);
  });

  it("recusa estados fora do enum", () => {
    expect(validateProfilePatch({ status: "activo" }).error).toMatch(/Estado inválido/i);
    for (const s of PARTNER_STATUSES) {
      expect(validateProfilePatch({ status: s }).ok, s).toBe(true);
    }
  });

  it("earning_share tem de ser fracção entre 0 e 1", () => {
    expect(validateProfilePatch({ earning_share: 65 }).error).toMatch(/fracção/i);
    expect(validateProfilePatch({ earning_share: 0 }).ok).toBe(false);
    expect(validateProfilePatch({ earning_share: -0.5 }).ok).toBe(false);
    expect(validateProfilePatch({ earning_share: 0.65 }).ok).toBe(true);
    expect(validateProfilePatch({ earning_share: 1 }).ok).toBe(true);
  });

  it("patch vazio não passa", () => {
    expect(validateProfilePatch({}).error).toMatch(/Nada para alterar/i);
  });
});

describe("statusSideEffects — cada mudança deixa rasto", () => {
  it("rejeitar exige motivo e carimba a data", () => {
    expect(statusSideEffects("rejected").error).toMatch(/Motivo obrigatório/i);
    expect(statusSideEffects("rejected", "  ").error).toMatch(/Motivo obrigatório/i);

    const r = statusSideEffects("rejected", "Documentos ilegíveis.");
    expect(r.error).toBeNull();
    expect(r.patch.status).toBe("rejected");
    expect(r.patch.rejection_reason).toBe("Documentos ilegíveis.");
    expect(typeof r.patch.rejected_at).toBe("string");
  });

  it("suspender exige motivo", () => {
    expect(statusSideEffects("suspended").error).toMatch(/Motivo obrigatório/i);
    const r = statusSideEffects("suspended", "Duas reclamações graves.");
    expect(r.patch.suspension_reason).toBe("Duas reclamações graves.");
  });

  it("aprovar limpa marcas de rejeição e suspensão anteriores", () => {
    const r = statusSideEffects("approved");
    expect(r.error).toBeNull();
    expect(r.patch.status).toBe("approved");
    expect(typeof r.patch.approved_at).toBe("string");
    expect(r.patch.rejection_reason).toBeNull();
    expect(r.patch.rejected_at).toBeNull();
    expect(r.patch.suspension_reason).toBeNull();
    expect(r.patch.suspended_until).toBeNull();
  });

  it("pending e in_review não exigem motivo", () => {
    expect(statusSideEffects("pending").error).toBeNull();
    expect(statusSideEffects("in_review").error).toBeNull();
  });
});
