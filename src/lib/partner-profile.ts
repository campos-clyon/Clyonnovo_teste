/**
 * Perfil do profissional — regras partilhadas entre a API e o painel.
 *
 * Esquema real (types.ts gerado do Supabase, verificado a 25-07-2026):
 *   partner_profiles.id      → PK do PROFISSIONAL
 *   partner_profiles.user_id → FK para profiles.id (nome, email, telefone)
 *   partner_documents.partner_id → partner_profiles.id
 *   partner_services.partner_id  → partner_profiles.id
 *   reviews                  → NÃO tem partner_id; chega-se por
 *                              booking_id → bookings.partner_id
 *
 * ⚠️ Confundir `id` com `user_id` faz o painel listar profissionais sem
 * serviços, sem documentos e sem avaliações — sem erro nenhum.
 */

/** Estados do profissional (enum partner_status). */
export const PARTNER_STATUSES = ["pending", "in_review", "approved", "rejected", "suspended"] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export const PARTNER_STATUS_LABELS: Record<PartnerStatus, string> = {
  pending:   "Candidatura submetida",
  in_review: "Em análise",
  approved:  "Aprovado",
  rejected:  "Rejeitado",
  suspended: "Suspenso",
};

/** Estados de um documento (enum document_status). */
export const DOCUMENT_STATUSES = ["pending", "approved", "rejected"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/** Tipos de documento pedidos ao profissional no onboarding. */
export const REQUIRED_DOC_TYPES = ["id", "nif", "activity", "iban"] as const;

export const DOC_TYPE_LABELS: Record<string, string> = {
  id:       "Documento de identificação",
  nif:      "NIF",
  activity: "Início de actividade",
  iban:     "Comprovativo de IBAN",
};

/**
 * Documentos que o app exige para mostrar o selo de verificado ao cliente.
 * Aprovar o profissional NÃO chega — o selo só aparece com estes dois
 * documentos aprovados, e o painel tem de o dizer ao operador.
 */
export const BADGE_DOC_TYPES = ["id", "nif"] as const;

/**
 * Campos que SÓ o admin pode alterar. O profissional edita o resto pela app
 * (trade_name, bio, iban, regiões, serviços…), mas estes decidem se ele
 * trabalha e quanto ganha — nunca podem vir do lado dele.
 */
export const ADMIN_ONLY_FIELDS = [
  "status", "approved_at", "rejected_at", "rejection_reason",
  "suspended_until", "suspension_reason", "tier", "trust_score",
  "earning_share", "quality_flags", "rating", "jobs_completed",
] as const;

/** Campos públicos que o admin pode corrigir em nome do profissional. */
export const ADMIN_EDITABLE_PUBLIC_FIELDS = [
  "trade_name", "legal_name", "description", "bio",
  "regions", "service_categories", "has_vehicle",
  "vehicle_capacity_m3", "vehicle_max_weight_kg",
  "base_address", "base_radius_km",
] as const;

export interface PartnerDocumentLike {
  doc_type?: string | null;
  status?: string | null;
}

export interface VerificationState {
  /** true quando o app mostra o selo de verificado ao cliente */
  verified: boolean;
  /** Documentos do selo que faltam aprovar */
  missingDocs: string[];
  /** Explicação para o operador quando o selo não aparece */
  reason: string | null;
}

/**
 * Reproduz a condição EXACTA do selo de verificado no app:
 * status = 'approved' E os documentos 'id' e 'nif' ambos aprovados.
 */
export function verificationState(
  status: string | null | undefined,
  docs: PartnerDocumentLike[] | null | undefined,
): VerificationState {
  const aprovados = new Set(
    (docs ?? [])
      .filter((d) => d?.status === "approved")
      .map((d) => String(d?.doc_type ?? "")),
  );
  const missingDocs = BADGE_DOC_TYPES.filter((t) => !aprovados.has(t));

  if (status !== "approved") {
    return {
      verified: false,
      missingDocs,
      reason: missingDocs.length > 0
        ? `O profissional não está aprovado e faltam documentos aprovados: ${missingDocs.map((d) => DOC_TYPE_LABELS[d] ?? d).join(", ")}.`
        : "O profissional ainda não está aprovado — os documentos já estão em ordem.",
    };
  }

  if (missingDocs.length > 0) {
    return {
      verified: false,
      missingDocs,
      reason: `Aprovado, mas o selo de verificado não aparece no app: falta aprovar ${missingDocs.map((d) => DOC_TYPE_LABELS[d] ?? d).join(" e ")}.`,
    };
  }

  return { verified: true, missingDocs: [], reason: null };
}

/**
 * A descrição pública que o cliente vê no app é `description`. Mas a app do
 * profissional grava o texto dele em `bio` e NUNCA escreve `description` —
 * resultado: o ecrã do cliente cai num texto de marketing fixo sobre
 * limpezas em Lisboa, errado para qualquer outra categoria.
 *
 * Enquanto o app não for corrigido, é o painel que resolve isto: mostra a
 * divergência e oferece copiar a bio para a descrição pública.
 */
export function publicDescriptionState(
  description: string | null | undefined,
  bio: string | null | undefined,
): { needsAttention: boolean; canCopyFromBio: boolean; message: string | null } {
  const desc = (description ?? "").trim();
  const b = (bio ?? "").trim();

  if (desc.length > 0) return { needsAttention: false, canCopyFromBio: false, message: null };

  if (b.length > 0) {
    return {
      needsAttention: true,
      canCopyFromBio: true,
      message: "O cliente não vê a apresentação deste profissional: ele escreveu-a na bio, mas o app mostra o campo «descrição pública», que está vazio. Copia a bio para o corrigir.",
    };
  }

  return {
    needsAttention: true,
    canCopyFromBio: false,
    message: "Sem descrição pública, o app mostra um texto genérico sobre limpezas em Lisboa — errado para qualquer outra categoria. Escreve uma apresentação.",
  };
}

/** Um pedido de alteração só passa se todos os campos forem conhecidos. */
export function validateProfilePatch(
  patch: Record<string, unknown>,
): { ok: boolean; error: string | null; allowed: Record<string, unknown> } {
  const permitidos = new Set<string>([
    ...ADMIN_ONLY_FIELDS,
    ...ADMIN_EDITABLE_PUBLIC_FIELDS,
  ]);

  const allowed: Record<string, unknown> = {};
  const rejeitados: string[] = [];

  for (const [k, v] of Object.entries(patch)) {
    if (permitidos.has(k)) allowed[k] = v;
    else rejeitados.push(k);
  }

  if (rejeitados.length > 0) {
    return {
      ok: false,
      error: `Campos não editáveis pelo painel: ${rejeitados.join(", ")}.`,
      allowed: {},
    };
  }

  if (typeof allowed.status === "string" && !(PARTNER_STATUSES as readonly string[]).includes(allowed.status)) {
    return { ok: false, error: `Estado inválido: "${allowed.status}".`, allowed: {} };
  }

  if (allowed.earning_share !== undefined) {
    const n = Number(allowed.earning_share);
    if (!Number.isFinite(n) || n <= 0 || n > 1) {
      return {
        ok: false,
        error: "A quota do profissional tem de ser uma fracção entre 0 e 1 (ex: 0.65 = 65%).",
        allowed: {},
      };
    }
  }

  if (Object.keys(allowed).length === 0) {
    return { ok: false, error: "Nada para alterar.", allowed: {} };
  }

  return { ok: true, error: null, allowed };
}

/**
 * Carimbos e motivos que acompanham cada mudança de estado. Sem isto, um
 * profissional rejeitado fica sem razão registada e ninguém sabe porquê.
 */
export function statusSideEffects(
  status: PartnerStatus,
  reason?: string | null,
): { patch: Record<string, unknown>; error: string | null } {
  const agora = new Date().toISOString();
  const motivo = typeof reason === "string" ? reason.trim() : "";

  if (status === "rejected") {
    if (!motivo) return { patch: {}, error: "Motivo obrigatório para rejeitar um profissional." };
    return { patch: { status, rejected_at: agora, rejection_reason: motivo }, error: null };
  }

  if (status === "suspended") {
    if (!motivo) return { patch: {}, error: "Motivo obrigatório para suspender um profissional." };
    return { patch: { status, suspension_reason: motivo }, error: null };
  }

  if (status === "approved") {
    // Limpa marcas de rejeição/suspensão anteriores — um profissional
    // aprovado não deve arrastar o motivo pelo qual foi recusado antes.
    return {
      patch: {
        status, approved_at: agora,
        rejected_at: null, rejection_reason: null,
        suspended_until: null, suspension_reason: null,
      },
      error: null,
    };
  }

  return { patch: { status }, error: null };
}
